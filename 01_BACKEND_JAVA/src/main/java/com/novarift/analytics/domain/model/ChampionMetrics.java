package com.novarift.analytics.domain.model;

import java.util.Map;

/**
 * Entidad de Dominio que representa las métricas crudas consolidadas
 * de un Campeón obtenidas mediante inferencia de Data Analytics.
 */
public record ChampionMetrics(
    int championId,
    String championName,
    Map<String, Double> damageProfile, // ej: "PHYSICAL" -> 70.5, "MAGIC" -> 20.0, "TRUE" -> 9.5
    boolean isLateGameHypercarry,
    boolean isEarlyGameAggressor,
    double averageBurstDamage,
    double averageControlScore
) {}