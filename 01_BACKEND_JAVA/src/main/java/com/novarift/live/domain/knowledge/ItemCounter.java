package com.novarift.live.domain.knowledge;

/**
 * Relación ítem-counter: qué objeto comprar contra un perfil de daño/CC enemigo.
 * timingWindow: EARLY (< 15 min), MID , LATE (> 25)
 */
public record ItemCounter(
    String itemCounterId,
    String patchVersion,
    String counterItemId,
    String counterItemName,
    String targetDamageProfile,   // AD, AP, MIXED, TRUE
    String targetCcProfile,       // HIGH_CC, LOW_CC, BURST, SUSTAINED
    int effectivenessScore,       // 0-100
    String explanation,
    String timingWindow           // EARLY, MID, LATE, ALL
) {}
