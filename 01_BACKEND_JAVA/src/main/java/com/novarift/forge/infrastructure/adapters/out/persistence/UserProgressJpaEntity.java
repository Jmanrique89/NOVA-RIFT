package com.novarift.forge.infrastructure.adapters.out.persistence;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "USER_PROGRESS")
public class UserProgressJpaEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "riot_id", unique = true)
    private String riotId;

    @Column(name = "current_cs_min")
    private Double currentCsMin;

    @Column(name = "target_cs_min")
    private Double targetCsMin;

    @Column(name = "vision_score")
    private Double visionScore;

    @Column(name = "forges_completed")
    private Integer forgesCompleted;

    @Column(name = "kda")
    private Double kda;

    @Column(name = "kill_participation")
    private Double killParticipation;

    @Column(name = "last_updated")
    private LocalDateTime lastUpdated;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getRiotId() { return riotId; }
    public void setRiotId(String riotId) { this.riotId = riotId; }
    public Double getCurrentCsMin() { return currentCsMin; }
    public void setCurrentCsMin(Double currentCsMin) { this.currentCsMin = currentCsMin; }
    public Double getTargetCsMin() { return targetCsMin; }
    public void setTargetCsMin(Double targetCsMin) { this.targetCsMin = targetCsMin; }
    public Double getVisionScore() { return visionScore; }
    public void setVisionScore(Double visionScore) { this.visionScore = visionScore; }
    public Integer getForgesCompleted() { return forgesCompleted; }
    public void setForgesCompleted(Integer forgesCompleted) { this.forgesCompleted = forgesCompleted; }
    public Double getKda() { return kda; }
    public void setKda(Double kda) { this.kda = kda; }
    public Double getKillParticipation() { return killParticipation; }
    public void setKillParticipation(Double killParticipation) { this.killParticipation = killParticipation; }
    public LocalDateTime getLastUpdated() { return lastUpdated; }
    public void setLastUpdated(LocalDateTime lastUpdated) { this.lastUpdated = lastUpdated; }
}
