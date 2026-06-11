package com.novarift.live.domain.recommendation;

/**
 * Puerto de dominio para registrar eventos de telemetría de recomendaciones.
 * Permite auditar cada recomendación emitida por policyVersion.
 */
public interface RecommendationTelemetryPort {

    void recordRecommendation(RecommendationEvent event);
}
