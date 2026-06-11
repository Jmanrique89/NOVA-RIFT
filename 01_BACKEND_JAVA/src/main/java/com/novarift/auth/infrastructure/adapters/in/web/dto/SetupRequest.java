package com.novarift.auth.infrastructure.adapters.in.web.dto;

import java.util.List;

/**
 * Body de POST /api/v1/user/setup.
 * Cierra el onboarding: guarda facción + roles + playstyle + champion pool.
 */
public record SetupRequest(
    String faction,
    String mainRole,
    String secondaryRole,
    String playstyle,
    List<ChampionPickDto> champions
) {
    public record ChampionPickDto(String championId, int priority) {}
}
