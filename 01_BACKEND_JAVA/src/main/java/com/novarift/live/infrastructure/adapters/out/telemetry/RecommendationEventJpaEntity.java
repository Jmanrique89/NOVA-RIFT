package com.novarift.live.infrastructure.adapters.out.telemetry;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "RECOMMENDATION_EVENTS")
public class RecommendationEventJpaEntity {

    @Id
    @Column(name = "event_id")
    private String eventId;

    @Column(name = "session_id")
    private Long sessionId;

    @Column(name = "policy_version")
    private String policyVersion;

    @Column(name = "context_snapshot", length = 50000)
    private String contextSnapshotJson;

    @Column(name = "recommended_items", length = 50000)
    private String recommendedItemsJson;

    @Column(name = "score_breakdown", length = 50000)
    private String scoreBreakdownJson;

    @Column(name = "confidence")
    private Double confidence;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    // Getters and Setters

    public String getEventId() { return eventId; }
    public void setEventId(String eventId) { this.eventId = eventId; }

    public Long getSessionId() { return sessionId; }
    public void setSessionId(Long sessionId) { this.sessionId = sessionId; }

    public String getPolicyVersion() { return policyVersion; }
    public void setPolicyVersion(String policyVersion) { this.policyVersion = policyVersion; }

    public String getContextSnapshotJson() { return contextSnapshotJson; }
    public void setContextSnapshotJson(String contextSnapshotJson) { this.contextSnapshotJson = contextSnapshotJson; }

    public String getRecommendedItemsJson() { return recommendedItemsJson; }
    public void setRecommendedItemsJson(String recommendedItemsJson) { this.recommendedItemsJson = recommendedItemsJson; }

    public String getScoreBreakdownJson() { return scoreBreakdownJson; }
    public void setScoreBreakdownJson(String scoreBreakdownJson) { this.scoreBreakdownJson = scoreBreakdownJson; }

    public Double getConfidence() { return confidence; }
    public void setConfidence(Double confidence) { this.confidence = confidence; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
