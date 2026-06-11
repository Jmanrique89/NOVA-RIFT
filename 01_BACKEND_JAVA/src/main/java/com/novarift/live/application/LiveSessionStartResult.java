package com.novarift.live.application;

import com.novarift.live.domain.LiveSession;
import com.novarift.live.domain.recommendation.RecommendationResult;

import java.util.Optional;

/**
 * Resultado completo del caso de uso StartLiveSession.
 *
 * Empaqueta la sesión persistida ({@link LiveSession}) y, opcionalmente,
 * la recomendación calculada por el motor ({@link RecommendationResult}).
 *
 * El campo opcional permite que el adapter web exponga los nuevos campos
 * (recommendationItems, recommendationReasons, threatAssessment, ...) sin
 * tener que re-parsear el JSON de breakdown que ya se persiste.
 */
public record LiveSessionStartResult(
        LiveSession session,
        Optional<RecommendationResult> recommendation
) {
    public static LiveSessionStartResult legacy(LiveSession session) {
        return new LiveSessionStartResult(session, Optional.empty());
    }

    public static LiveSessionStartResult enriched(LiveSession session, RecommendationResult recommendation) {
        return new LiveSessionStartResult(session, Optional.ofNullable(recommendation));
    }
}
