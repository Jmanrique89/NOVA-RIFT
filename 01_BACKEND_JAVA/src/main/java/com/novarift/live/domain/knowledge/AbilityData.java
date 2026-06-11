package com.novarift.live.domain.knowledge;

import java.util.List;

/**
 * Datos de una habilidad de campeón con tags de CC y anti-mecánicas.
 * Slot: P (pasiva), Q, W, E, R.
 */
public record AbilityData(
    String abilityId,
    int championId,
    String slot,
    String name,
    String damageType,          // PHYSICAL, MAGIC, TRUE, NONE
    List<String> crowdControlTags,   // STUN, ROOT, SLOW, KNOCKUP, SILENCE, SUPPRESS
    List<String> antiMechanicsTags,  // ANTI_HEAL, ANTI_SHIELD, EXECUTE, ARMOR_PEN, MAGIC_PEN
    double cooldownBase
) {}
