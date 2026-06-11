package com.novarift.live.infrastructure.adapters.in.web.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.novarift.live.domain.recommendation.ThreatAssessment;

import java.util.List;

/**
 * DTO web para la evaluación de amenaza enemiga.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ThreatAssessmentDto {
    private final int threatScore;
    private final String damageProfile;
    private final List<String> ccTags;
    private final int triggeredRules;

    public ThreatAssessmentDto(ThreatAssessment source) {
        this.threatScore = source.threatScore();
        this.damageProfile = source.damageProfile();
        this.ccTags = source.ccTags();
        this.triggeredRules = source.triggeredRuleIds() != null ? source.triggeredRuleIds().size() : 0;
    }

    @JsonProperty public int getThreatScore() { return threatScore; }
    @JsonProperty public String getDamageProfile() { return damageProfile; }
    @JsonProperty public List<String> getCcTags() { return ccTags; }
    @JsonProperty public int getTriggeredRules() { return triggeredRules; }
}
