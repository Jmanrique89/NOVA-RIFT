package com.novarift.auth.infrastructure.adapters.in.web.dto;

/**
 * Body del endpoint PATCH /api/v1/admin/users/{id}/role.
 */
public record RoleChangeRequest(String role) {}
