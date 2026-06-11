package com.novarift.live.domain.knowledge;

import java.util.List;

/**
 * Datos estáticos de un campeón en una versión de parche concreta.
 * Fuente: Data Dragon + curación manual para roles y perfil de daño.
 */
public record ChampionData(
    int championId,
    String keyName,
    String displayName,
    List<String> roles,
    String damageProfile,   // AD, AP, MIXED, TRUE
    String patchVersion
) {}
