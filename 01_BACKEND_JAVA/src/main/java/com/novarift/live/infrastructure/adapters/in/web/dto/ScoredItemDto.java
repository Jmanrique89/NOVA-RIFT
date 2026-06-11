package com.novarift.live.infrastructure.adapters.in.web.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.novarift.live.domain.recommendation.ScoredItem;

/**
 * DTO web para un item rankeado por el motor de scoring.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ScoredItemDto {
    private final String itemId;
    private final String itemName;
    private final double scoreTotal;
    private final double confidence;
    private final double threatMitigation;
    private final double matchupValue;
    private final double timingFit;
    private final double synergyScore;
    private final String explanation;

    public ScoredItemDto(ScoredItem source) {
        this.itemId = source.itemId();
        this.itemName = source.itemName();
        this.scoreTotal = round2(source.scoreTotal());
        this.confidence = round2(source.confidence());
        this.threatMitigation = round2(source.threatMitigation());
        this.matchupValue = round2(source.matchupValue());
        this.timingFit = round2(source.timingFit());
        this.synergyScore = round2(source.synergyScore());
        this.explanation = source.explanation();
    }

    private static double round2(double v) {
        return Math.round(v * 100.0) / 100.0;
    }

    @JsonProperty public String getItemId() { return itemId; }
    @JsonProperty public String getItemName() { return itemName; }
    @JsonProperty public double getScoreTotal() { return scoreTotal; }
    @JsonProperty public double getConfidence() { return confidence; }
    @JsonProperty public double getThreatMitigation() { return threatMitigation; }
    @JsonProperty public double getMatchupValue() { return matchupValue; }
    @JsonProperty public double getTimingFit() { return timingFit; }
    @JsonProperty public double getSynergyScore() { return synergyScore; }
    @JsonProperty public String getExplanation() { return explanation; }
}
