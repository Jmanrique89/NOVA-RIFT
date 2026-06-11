package com.novarift.auth.application;

import com.novarift.auth.domain.model.User;
import com.novarift.auth.domain.port.out.UserRepositoryPort;
import com.novarift.auth.infrastructure.adapters.in.web.dto.AdminStatsDTO;
import com.novarift.auth.infrastructure.adapters.in.web.dto.AdminUserDTO;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Lógica del panel de administración: listado, ban, cambio de rol, stats.
 */
@Service
public class AdminService {

    private final UserRepositoryPort users;
    private final JwtUtil jwt;

    public AdminService(UserRepositoryPort users, JwtUtil jwt) {
        this.users = users;
        this.jwt = jwt;
    }

    /** Verifica que el token pertenece a un ADMIN. Devuelve el userId. */
    public Long requireAdmin(String token) {
        if (token == null || token.isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Token ausente");
        }
        try {
            Long userId = jwt.extractUserId(token);
            String role = jwt.extractRole(token);
            if (!"ADMIN".equals(role)) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Acceso denegado: se requiere rol ADMIN");
            }
            return userId;
        } catch (ResponseStatusException e) {
            throw e;
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Token inválido o expirado");
        }
    }

    /** Lista todos los usuarios como DTOs. */
    public List<AdminUserDTO> listUsers() {
        return users.findAll().stream()
            .map(AdminUserDTO::from)
            .toList();
    }

    /** Elimina un usuario por ID. */
    public void deleteUser(Long id) {
        users.findById(id).orElseThrow(
            () -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Usuario no encontrado"));
        users.deleteById(id);
    }

    /** Toggle ban: si está baneado lo desbaneamos y viceversa. */
    public AdminUserDTO toggleBan(Long id) {
        User user = users.findById(id).orElseThrow(
            () -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Usuario no encontrado"));
        User updated = user.withBanned(!user.banned());
        return AdminUserDTO.from(users.save(updated));
    }

    /** Cambia el rol de un usuario. */
    public AdminUserDTO changeRole(Long id, String newRole) {
        if (!"USER".equals(newRole) && !"ADMIN".equals(newRole)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Rol inválido: USER o ADMIN");
        }
        User user = users.findById(id).orElseThrow(
            () -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Usuario no encontrado"));
        User updated = user.withRole(newRole);
        return AdminUserDTO.from(users.save(updated));
    }

    /** Estadísticas globales del sistema. */
    public AdminStatsDTO getStats() {
        List<User> all = users.findAll();
        long total = all.size();
        long active = all.stream().filter(u -> !u.banned()).count();
        long admins = all.stream().filter(u -> "ADMIN".equals(u.role())).count();
        LocalDateTime weekAgo = LocalDateTime.now().minusDays(7);
        long newUsers = all.stream()
            .filter(u -> u.createdAt() != null && u.createdAt().isAfter(weekAgo))
            .count();
        return new AdminStatsDTO(total, active, admins, newUsers);
    }
}
