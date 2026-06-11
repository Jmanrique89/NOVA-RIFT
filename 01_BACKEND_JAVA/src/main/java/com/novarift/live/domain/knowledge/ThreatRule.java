package com.novarift.live.domain.knowledge;

import java.util.List;

/**
 * Regla de amenaza condicional: si se detecta un patrón enemigo,
 * se dispara un score de amenaza con items counter sugeridos.
 * context: LANE, SKIRMISH, TEAMFIGHT, OBJECTIVE
 */
public record ThreatRule(
    String ruleId,
    String patchVersion,
    String context,
    Integer ifEnemyChampionId,     // null = aplica a cualquier campeón
    String ifEnemyAbilityTag,      // null = no filtra por tag de habilidad
    String ifEnemyCompTag,         // null = no filtra por composición (e.g. HEAVY_AD, HEAVY_AP)
    int thenThreatScore,           // 0-100
    List<String> thenCounterItemIds,
    String thenCounterStatFocus,   // ARMOR, MAGIC_RESIST, HEALTH, TENACITY, ANTI_HEAL
    String explanationTemplate,
    double confidence,
    boolean enabled
) {}
