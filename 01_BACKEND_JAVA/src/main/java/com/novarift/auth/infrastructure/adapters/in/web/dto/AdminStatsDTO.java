package com.novarift.auth.infrastructure.adapters.in.web.dto;

/**
 * DTO con estadísticas globales para el panel de administración.
 */
public record AdminStatsDTO(
    long totalUsers,
    long activeUsers,
    long adminCount,
    long newUsersLast7Days
) {}
