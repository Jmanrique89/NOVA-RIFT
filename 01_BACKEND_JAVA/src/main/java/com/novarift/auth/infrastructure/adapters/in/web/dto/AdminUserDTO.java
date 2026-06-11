package com.novarift.auth.infrastructure.adapters.in.web.dto;

import com.novarift.auth.domain.model.User;

import java.time.LocalDateTime;

/**
 * DTO para la lista de usuarios del panel de administración.
 */
public record AdminUserDTO(
    Long id,
    String username,
    String email,
    String role,
    boolean banned,
    LocalDateTime createdAt,
    LocalDateTime lastLoginAt,
    String faction,
    boolean setupComplete
) {
    public static AdminUserDTO from(User u) {
        return new AdminUserDTO(
            u.id(), u.username(), u.email(),
            u.role(), u.banned(),
            u.createdAt(), u.lastLoginAt(),
            u.faction(), u.setupComplete()
        );
    }
}
