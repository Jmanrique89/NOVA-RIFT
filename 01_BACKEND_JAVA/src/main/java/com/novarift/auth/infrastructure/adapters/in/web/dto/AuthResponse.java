package com.novarift.auth.infrastructure.adapters.in.web.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

/**
 * Respuesta de /auth/login y /auth/register.
 * Incluye role para que el frontend pueda mostrar/ocultar el panel admin.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record AuthResponse(
    String token,
    Long userId,
    String username,
    boolean setupComplete,
    String faction,
    String mainRole,
    String role
) {}
