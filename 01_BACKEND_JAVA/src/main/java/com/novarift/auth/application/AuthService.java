package com.novarift.auth.application;

import com.novarift.auth.domain.model.User;
import com.novarift.auth.domain.model.UserChampionPick;
import com.novarift.auth.domain.port.out.EmailNotificationPort;
import com.novarift.auth.domain.port.out.UserRepositoryPort;
import com.novarift.auth.infrastructure.adapters.in.web.dto.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Servicio de aplicacion del modulo de autenticacion (capa application del hexagono).
 *
 * <p>Orquesta los casos de uso de cuenta: registro, login, consulta de perfil y
 * cierre de onboarding. Habla con el dominio (record {@link User}) y con el
 * puerto de salida {@link UserRepositoryPort} para persistir; nunca conoce JPA
 * ni HTTP directamente (eso vive en los adaptadores).
 *
 * <p>Responsabilidades de seguridad: hashea las contrasenas con BCrypt y delega
 * la emision/validacion de JWT en {@link JwtUtil}. Los errores se traducen a
 * codigos HTTP via {@link ResponseStatusException} (401, 403, 409, 400).
 */
@Service
public class AuthService {

    private static final Logger log = LoggerFactory.getLogger(AuthService.class);

    private final UserRepositoryPort users;
    private final JwtUtil jwt;
    private final EmailNotificationPort emailNotifier;
    private final BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();

    public AuthService(UserRepositoryPort users, JwtUtil jwt, EmailNotificationPort emailNotifier) {
        this.users = users;
        this.jwt = jwt;
        this.emailNotifier = emailNotifier;
    }

    /** Crea cuenta nueva. El primer usuario o username=="admin" recibe rol ADMIN. */
    public AuthResponse register(RegisterRequest req) {
        validateRegisterInput(req);

        if (users.existsByUsername(req.username())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "El nombre de invocador ya existe");
        }
        if (users.existsByEmail(req.email())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "El email ya está registrado");
        }

        String hash = encoder.encode(req.password());
        User newUser = User.newUser(req.username().trim(), req.email().trim().toLowerCase(), hash);

        // Auto-asignar ADMIN al primer usuario o al username "admin"
        boolean isFirstUser = users.count() == 0;
        boolean isAdminUsername = "admin".equalsIgnoreCase(req.username().trim());
        if (isFirstUser || isAdminUsername) {
            newUser = newUser.withRole("ADMIN");
        }

        User saved = users.save(newUser);

        // Email de bienvenida (failsafe): si el envio falla, el registro NO debe romperse.
        // El puerto de salida abstrae el proveedor (LOG en demo / SMTP en real).
        try {
            emailNotifier.sendWelcome(saved.email(), saved.username());
        } catch (Exception e) {
            log.warn("No se pudo enviar el email de bienvenida a {} (el registro continua): {}",
                saved.email(), e.getMessage());
        }

        String token = jwt.generate(saved.id(), saved.username(), saved.role());
        return new AuthResponse(token, saved.id(), saved.username(), false, null, null, saved.role());
    }

    /** Login con username (o email) + password. Actualiza lastLoginAt. */
    public AuthResponse login(LoginRequest req) {
        if (req == null || req.username() == null || req.password() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Faltan credenciales");
        }
        String identifier = req.username().trim();

        User user = users.findByUsername(identifier)
            .or(() -> users.findByEmail(identifier.toLowerCase()))
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Credenciales incorrectas"));

        if (!encoder.matches(req.password(), user.passwordHash())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Credenciales incorrectas");
        }

        if (user.banned()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Cuenta suspendida");
        }

        // Actualizar lastLoginAt
        User updated = user.withLastLogin(LocalDateTime.now());
        users.save(updated);

        String token = jwt.generate(user.id(), user.username(), user.role());
        return new AuthResponse(
            token, user.id(), user.username(),
            user.setupComplete(), user.faction(), user.mainRole(),
            user.role()
        );
    }

    /** Devuelve el perfil completo (champions incluidos) para el token dado. */
    public ProfileResponse getProfile(String token) {
        Long userId = parseAndValidate(token);
        User user = users.findById(userId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Usuario no encontrado"));
        return ProfileResponse.from(user);
    }

    /** Cierra el onboarding: guarda facción + roles + playstyle + champion pool. */
    public ProfileResponse completeSetup(String token, SetupRequest req) {
        Long userId = parseAndValidate(token);
        User user = users.findById(userId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Usuario no encontrado"));

        List<UserChampionPick> picks = (req.champions() == null) ? List.of()
            : req.champions().stream()
                .map(c -> UserChampionPick.of(c.championId(), c.priority()))
                .toList();

        User updated = user.withSetup(
            req.faction(), req.mainRole(), req.secondaryRole(), req.playstyle(), picks
        );
        return ProfileResponse.from(users.save(updated));
    }

    /** Extrae userId del token. Usado por AdminService para verificar rol. */
    public Long parseAndValidate(String token) {
        if (token == null || token.isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Token ausente");
        }
        try {
            return jwt.extractUserId(token);
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Token inválido o expirado");
        }
    }

    // ─── Helpers privados ─────────────────────────────────────────────────

    private void validateRegisterInput(RegisterRequest req) {
        if (req == null
            || req.username() == null || req.username().trim().length() < 3
            || req.email() == null    || !req.email().contains("@")
            || req.password() == null || req.password().length() < 8) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                "Datos inválidos: username≥3, email válido, password≥8");
        }
    }
}
