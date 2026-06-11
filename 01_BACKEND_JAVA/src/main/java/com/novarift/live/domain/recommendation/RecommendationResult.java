package com.novarift.live.domain.recommendation;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Resultado completo de una recomendación con trazabilidad.
 */
public record RecommendationResult(
    String policyVersion,
    List<ScoredItem> items,
    double confidence,           // 0.0-1.0: confianza agregada
    List<String> topFactors,     // razones principales de la recomendación
    String tradeoffPrincipal,    // trade-off más significativo
    ThreatAssessment threatAssessment,
    LocalDateTime generatedAt
) {
    /**
     * Recomendación conservadora cuando la confianza es baja.
     */
    public static RecommendationResult lowConfidenceFallback(String policyVersion, List<ScoredItem> items) {
        return new RecommendationResult(
            policyVersion,
            items,
            0.25,
            List.of("Datos insuficientes para recomendación de alta confianza"),
            "Se recomienda build estándar hasta disponer de más información del draft enemigo",
            new ThreatAssessment(50, "MIXED", List.of(), List.of(), List.of()),
            LocalDateTime.now()
        );
    }
}
