package com.novarift.live.infrastructure.adapters.in.web.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.time.LocalDateTime;
import java.util.List;

/**
 * DTO de respuesta para {@code POST /api/v1/live/start}.
 *
 * <p>Objeto de transporte de la capa web: separa el modelo de dominio
 * ({@code LiveSession}) de lo que se serializa al cliente. Mantiene los campos
 * originales de la sesion (compatibilidad hacia atras) y anade los del motor de
 * recomendacion:
 * <ul>
 * <li>recommendationTotalScore — alias semantico de recommendationScore</li>
 * <li>recommendationReasons — motivos legibles (array de strings)</li>
 * <li>recommendationItems — items rankeados por el motor</li>
 * <li>threatAssessment — evaluacion de amenaza enemiga</li>
 * </ul>
 *
 * <p>Los campos nuevos son opcionales: si el motor de scoring no estuvo disponible
 * (fallback legacy), no aparecen en el JSON gracias a {@code @JsonInclude(NON_NULL)}.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class LiveSessionResponse {

    // ─── Campos legacy (idénticos a LiveSession) ──────────────────────────
    private final Long id;
    private final String summonerName;
    private final String enemyDraftPattern;
    private final String recommendedFirstBuy;
    private final String status;
    private final LocalDateTime startedAt;
    private final String recommendationVersion;
    private final Double recommendationScore;
    private final String recommendationBreakdown;
    private final Double recommendationConfidence;

    // ─── Campos nuevos (Motor de Recomendación v2) ────────────────────────
    private final Double recommendationTotalScore;
    private final List<String> recommendationReasons;
    private final List<ScoredItemDto> recommendationItems;
    private final ThreatAssessmentDto threatAssessment;

    public LiveSessionResponse(
            Long id,
            String summonerName,
            String enemyDraftPattern,
            String recommendedFirstBuy,
            String status,
            LocalDateTime startedAt,
            String recommendationVersion,
            Double recommendationScore,
            String recommendationBreakdown,
            Double recommendationConfidence,
            Double recommendationTotalScore,
            List<String> recommendationReasons,
            List<ScoredItemDto> recommendationItems,
            ThreatAssessmentDto threatAssessment) {
        this.id = id;
        this.summonerName = summonerName;
        this.enemyDraftPattern = enemyDraftPattern;
        this.recommendedFirstBuy = recommendedFirstBuy;
        this.status = status;
        this.startedAt = startedAt;
        this.recommendationVersion = recommendationVersion;
        this.recommendationScore = recommendationScore;
        this.recommendationBreakdown = recommendationBreakdown;
        this.recommendationConfidence = recommendationConfidence;
        this.recommendationTotalScore = recommendationTotalScore;
        this.recommendationReasons = recommendationReasons;
        this.recommendationItems = recommendationItems;
        this.threatAssessment = threatAssessment;
    }

    @JsonProperty public Long getId() { return id; }
    @JsonProperty public String getSummonerName() { return summonerName; }
    @JsonProperty public String getEnemyDraftPattern() { return enemyDraftPattern; }
    @JsonProperty public String getRecommendedFirstBuy() { return recommendedFirstBuy; }
    @JsonProperty public String getStatus() { return status; }
    @JsonProperty public LocalDateTime getStartedAt() { return startedAt; }
    @JsonProperty public String getRecommendationVersion() { return recommendationVersion; }
    @JsonProperty public Double getRecommendationScore() { return recommendationScore; }
    @JsonProperty public String getRecommendationBreakdown() { return recommendationBreakdown; }
    @JsonProperty public Double getRecommendationConfidence() { return recommendationConfidence; }
    @JsonProperty public Double getRecommendationTotalScore() { return recommendationTotalScore; }
    @JsonProperty public List<String> getRecommendationReasons() { return recommendationReasons; }
    @JsonProperty public List<ScoredItemDto> getRecommendationItems() { return recommendationItems; }
    @JsonProperty public ThreatAssessmentDto getThreatAssessment() { return threatAssessment; }
}
