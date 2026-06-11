package com.novarift.live.infrastructure.adapters.out.knowledge.jpa;

import com.novarift.live.domain.knowledge.ItemCounter;
import jakarta.persistence.*;

@Entity
@Table(name = "KB_ITEM_COUNTERS")
public class ItemCounterJpaEntity {

    @Id
    @Column(name = "item_counter_id", length = 32)
    private String itemCounterId;

    @Column(name = "patch_version", length = 16, nullable = false)
    private String patchVersion;

    @Column(name = "counter_item_id", length = 16)
    private String counterItemId;

    @Column(name = "counter_item_name", length = 120)
    private String counterItemName;

    @Column(name = "target_damage_profile", length = 16)
    private String targetDamageProfile;

    @Column(name = "target_cc_profile", length = 16)
    private String targetCcProfile;

    @Column(name = "effectiveness_score")
    private Integer effectivenessScore;

    @Column(name = "explanation", length = 500)
    private String explanation;

    @Column(name = "timing_window", length = 16)
    private String timingWindow;

    public ItemCounter toDomain() {
        return new ItemCounter(
            itemCounterId,
            patchVersion,
            counterItemId,
            counterItemName,
            targetDamageProfile,
            targetCcProfile,
            effectivenessScore != null ? effectivenessScore : 0,
            explanation,
            timingWindow
        );
    }

    public String getItemCounterId() { return itemCounterId; }
    public void setItemCounterId(String itemCounterId) { this.itemCounterId = itemCounterId; }
    public String getPatchVersion() { return patchVersion; }
    public void setPatchVersion(String patchVersion) { this.patchVersion = patchVersion; }
    public String getCounterItemId() { return counterItemId; }
    public void setCounterItemId(String counterItemId) { this.counterItemId = counterItemId; }
    public String getCounterItemName() { return counterItemName; }
    public void setCounterItemName(String counterItemName) { this.counterItemName = counterItemName; }
    public String getTargetDamageProfile() { return targetDamageProfile; }
    public void setTargetDamageProfile(String targetDamageProfile) { this.targetDamageProfile = targetDamageProfile; }
    public String getTargetCcProfile() { return targetCcProfile; }
    public void setTargetCcProfile(String targetCcProfile) { this.targetCcProfile = targetCcProfile; }
    public Integer getEffectivenessScore() { return effectivenessScore; }
    public void setEffectivenessScore(Integer effectivenessScore) { this.effectivenessScore = effectivenessScore; }
    public String getExplanation() { return explanation; }
    public void setExplanation(String explanation) { this.explanation = explanation; }
    public String getTimingWindow() { return timingWindow; }
    public void setTimingWindow(String timingWindow) { this.timingWindow = timingWindow; }
}
