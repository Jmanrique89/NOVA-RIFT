package com.novarift.auth.infrastructure.adapters.in.web;

import com.novarift.auth.application.AuthService;
import com.novarift.auth.infrastructure.adapters.in.web.dto.*;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * Adaptador de entrada (driving adapter) REST del modulo de autenticacion.
 *
 * <p>En arquitectura hexagonal este es el "lado izquierdo": traduce peticiones
 * HTTP del exterior en llamadas al caso de uso de aplicacion {@link AuthService}.
 * No contiene logica de negocio; solo mapea request/response y extrae el token.
 *
 * <p>Endpoints expuestos:
 * <ul>
 * <li>{@code POST /api/v1/auth/register} — crea cuenta y devuelve JWT</li>
 * <li>{@code POST /api/v1/auth/login} — login y devuelve JWT</li>
 * <li>{@code GET /api/v1/user/profile} — perfil del usuario del Bearer</li>
 * <li>{@code POST /api/v1/user/setup} — cierra el onboarding</li>
 * </ul>
 */
@RestController
@CrossOrigin(origins = "*")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/api/v1/auth/register")
    public ResponseEntity<AuthResponse> register(@RequestBody RegisterRequest req) {
        return ResponseEntity.ok(authService.register(req));
    }

    @PostMapping("/api/v1/auth/login")
    public ResponseEntity<AuthResponse> login(@RequestBody LoginRequest req) {
        return ResponseEntity.ok(authService.login(req));
    }

    @GetMapping("/api/v1/user/profile")
    public ResponseEntity<ProfileResponse> profile(@RequestHeader("Authorization") String authorization) {
        return ResponseEntity.ok(authService.getProfile(stripBearer(authorization)));
    }

    @PostMapping("/api/v1/user/setup")
    public ResponseEntity<ProfileResponse> setup(
            @RequestHeader("Authorization") String authorization,
            @RequestBody SetupRequest req) {
        return ResponseEntity.ok(authService.completeSetup(stripBearer(authorization), req));
    }

    /** Quita el prefijo "Bearer " del header Authorization y deja el token crudo. */
    private String stripBearer(String header) {
        if (header == null) return "";
        return header.replaceFirst("(?i)^Bearer\\s+", "").trim();
    }
}
