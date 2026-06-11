package com.novarift.live.infrastructure.adapters.out.knowledge.jpa;

import com.novarift.live.domain.knowledge.ThreatRule;
import jakarta.persistence.*;

import java.util.Arrays;
import java.util.Collections;
import java.util.List;

@Entity
@Table(name = "KB_THREAT_RULES")
public class ThreatRuleJpaEntity {

    @Id
    @Column(name = "rule_id", length = 32)
    private String ruleId;

    @Column(name = "patch_version", length = 16, nullable = false)
    private String patchVersion;

    @Column(name = "context", length = 32, nullable = false)
    private String context;

    @Column(name = "if_enemy_champion_id")
    private Integer ifEnemyChampionId;

    @Column(name = "if_enemy_ability_tag", length = 32)
    private String ifEnemyAbilityTag;

    @Column(name = "if_enemy_comp_tag", length = 32)
    private String ifEnemyCompTag;

    @Column(name = "then_threat_score")
    private Integer thenThreatScore;

    /** CSV de IDs de items counter (compatible con scripts SQL). */
    @Column(name = "then_counter_item_ids_csv", length = 200)
    private String thenCounterItemIdsCsv;

    @Column(name = "then_counter_stat_focus", length = 32)
    private String thenCounterStatFocus;

    @Column(name = "explanation_template", length = 500)
    private String explanationTemplate;

    @Column(name = "confidence")
    private Double confidence;

    @Column(name = "enabled")
    private Boolean enabled;

    public ThreatRule toDomain() {
        List<String> ids = (thenCounterItemIdsCsv == null || thenCounterItemIdsCsv.isBlank())
            ? Collections.emptyList()
            : Arrays.asList(thenCounterItemIdsCsv.split("\\s*,\\s*"));
        return new ThreatRule(
            ruleId,
            patchVersion,
            context,
            ifEnemyChampionId,
            ifEnemyAbilityTag,
            ifEnemyCompTag,
            thenThreatScore != null ? thenThreatScore : 0,
            ids,
            thenCounterStatFocus,
            explanationTemplate,
            confidence != null ? confidence : 0.5,
            enabled != null ? enabled : true
        );
    }

    public String getRuleId() { return ruleId; }
    public void setRuleId(String ruleId) { this.ruleId = ruleId; }
    public String getPatchVersion() { return patchVersion; }
    public void setPatchVersion(String patchVersion) { this.patchVersion = patchVersion; }
    public String getContext() { return context; }
    public void setContext(String context) { this.context = context; }
    public Integer getIfEnemyChampionId() { return ifEnemyChampionId; }
    public void setIfEnemyChampionId(Integer ifEnemyChampionId) { this.ifEnemyChampionId = ifEnemyChampionId; }
    public String getIfEnemyAbilityTag() { return ifEnemyAbilityTag; }
    public void setIfEnemyAbilityTag(String ifEnemyAbilityTag) { this.ifEnemyAbilityTag = ifEnemyAbilityTag; }
    public String getIfEnemyCompTag() { return ifEnemyCompTag; }
    public void setIfEnemyCompTag(String ifEnemyCompTag) { this.ifEnemyCompTag = ifEnemyCompTag; }
    public Integer getThenThreatScore() { return thenThreatScore; }
    public void setThenThreatScore(Integer thenThreatScore) { this.thenThreatScore = thenThreatScore; }
    public String getThenCounterItemIdsCsv() { return thenCounterItemIdsCsv; }
    public void setThenCounterItemIdsCsv(String thenCounterItemIdsCsv) { this.thenCounterItemIdsCsv = thenCounterItemIdsCsv; }
    public String getThenCounterStatFocus() { return thenCounterStatFocus; }
    public void setThenCounterStatFocus(String thenCounterStatFocus) { this.thenCounterStatFocus = thenCounterStatFocus; }
    public String getExplanationTemplate() { return explanationTemplate; }
    public void setExplanationTemplate(String explanationTemplate) { this.explanationTemplate = explanationTemplate; }
    public Double getConfidence() { return confidence; }
    public void setConfidence(Double confidence) { this.confidence = confidence; }
    public Boolean getEnabled() { return enabled; }
    public void setEnabled(Boolean enabled) { this.enabled = enabled; }
}
