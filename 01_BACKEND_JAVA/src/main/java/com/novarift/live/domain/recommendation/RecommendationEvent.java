package com.novarift.live.domain.recommendation;

import java.time.LocalDateTime;

/**
 * Evento de telemetría: registra cada recomendación emitida para auditoría.
 */
public record RecommendationEvent(
    String eventId,
    Long sessionId,
    String policyVersion,
    String contextSnapshotJson,
    String recommendedItemsJson,
    String scoreBreakdownJson,
    double confidence,
    LocalDateTime createdAt
) {
    public static RecommendationEvent from(Long sessionId, RecommendationResult result, String contextJson) {
        return new RecommendationEvent(
            java.util.UUID.randomUUID().toString(),
            sessionId,
            result.policyVersion(),
            contextJson,
            serializeItems(result),
            serializeBreakdown(result),
            result.confidence(),
            result.generatedAt()
        );
    }

    private static String serializeItems(RecommendationResult result) {
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < result.items().size(); i++) {
            ScoredItem item = result.items().get(i);
            if (i > 0) sb.append(",");
            sb.append("{\"itemId\":\"").append(item.itemId())
              .append("\",\"itemName\":\"").append(item.itemName())
              .append("\",\"score\":").append(String.format("%.2f", item.scoreTotal()))
              .append(",\"confidence\":").append(String.format("%.2f", item.confidence()))
              .append("}");
        }
        sb.append("]");
        return sb.toString();
    }

    private static String serializeBreakdown(RecommendationResult result) {
        StringBuilder sb = new StringBuilder("{\"topFactors\":[");
        for (int i = 0; i < result.topFactors().size(); i++) {
            if (i > 0) sb.append(",");
            sb.append("\"").append(result.topFactors().get(i).replace("\"", "\\\"")).append("\"");
        }
        sb.append("],\"tradeoff\":\"").append(
            result.tradeoffPrincipal() != null ? result.tradeoffPrincipal().replace("\"", "\\\"") : ""
        ).append("\",\"confidence\":").append(String.format("%.2f", result.confidence()));
        sb.append("}");
        return sb.toString();
    }
}
