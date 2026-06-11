package com.novarift.live.domain;

import java.time.LocalDateTime;

/**
 * Domain record, immutable, no Spring/Hibernate annotations.
 * Extended with optional recommendation scoring fields.
 */
public record LiveSession(
    Long id,
    String summonerName,
    String enemyDraftPattern,
    String recommendedFirstBuy,
    String status,
    LocalDateTime startedAt,
    String recommendationVersion,
    Double recommendationScore,
    String recommendationBreakdown,
    Double recommendationConfidence
) {
    /**
     * Legacy factory — mantiene compatibilidad con el flujo existente.
     */
    public static LiveSession startNew(String summonerName, String enemyDraftPattern, String recommendedFirstBuy) {
        return new LiveSession(null, summonerName, enemyDraftPattern, recommendedFirstBuy,
            "ACTIVE", LocalDateTime.now(), null, null, null, null);
    }

    /**
     * Factory con scoring — usado cuando el motor de recomendaciones está activo.
     */
    public static LiveSession startWithScoring(
            String summonerName,
            String enemyDraftPattern,
            String recommendedFirstBuy,
            String recommendationVersion,
            Double recommendationScore,
            String recommendationBreakdown,
            Double recommendationConfidence) {
        return new LiveSession(null, summonerName, enemyDraftPattern, recommendedFirstBuy,
            "ACTIVE", LocalDateTime.now(),
            recommendationVersion, recommendationScore,
            recommendationBreakdown, recommendationConfidence);
    }
}
