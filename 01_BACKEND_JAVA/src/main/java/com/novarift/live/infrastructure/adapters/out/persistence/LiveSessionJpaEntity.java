package com.novarift.live.infrastructure.adapters.out.persistence;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "LIVE_SESSIONS")
public class LiveSessionJpaEntity {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(name = "summoner_id")
    private String summonerId;
    
    @Column(name = "enemy_draft", length = 50000)
    private String enemyDraft;
    
    @Column(name = "recommended_build", length = 50000)
    private String recommendedBuild;
    
    private String status;
    private LocalDateTime startedAt;

    @Column(name = "recommendation_version")
    private String recommendationVersion;

    @Column(name = "recommendation_score")
    private Double recommendationScore;

    @Column(name = "recommendation_breakdown", length = 50000)
    private String recommendationBreakdown;

    @Column(name = "recommendation_confidence")
    private Double recommendationConfidence;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getSummonerId() { return summonerId; }
    public void setSummonerId(String summonerId) { this.summonerId = summonerId; }
    public String getEnemyDraft() { return enemyDraft; }
    public void setEnemyDraft(String enemyDraft) { this.enemyDraft = enemyDraft; }
    public String getRecommendedBuild() { return recommendedBuild; }
    public void setRecommendedBuild(String recommendedBuild) { this.recommendedBuild = recommendedBuild; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public LocalDateTime getStartedAt() { return startedAt; }
    public void setStartedAt(LocalDateTime startedAt) { this.startedAt = startedAt; }
    public String getRecommendationVersion() { return recommendationVersion; }
    public void setRecommendationVersion(String recommendationVersion) { this.recommendationVersion = recommendationVersion; }
    public Double getRecommendationScore() { return recommendationScore; }
    public void setRecommendationScore(Double recommendationScore) { this.recommendationScore = recommendationScore; }
    public String getRecommendationBreakdown() { return recommendationBreakdown; }
    public void setRecommendationBreakdown(String recommendationBreakdown) { this.recommendationBreakdown = recommendationBreakdown; }
    public Double getRecommendationConfidence() { return recommendationConfidence; }
    public void setRecommendationConfidence(Double recommendationConfidence) { this.recommendationConfidence = recommendationConfidence; }
}
