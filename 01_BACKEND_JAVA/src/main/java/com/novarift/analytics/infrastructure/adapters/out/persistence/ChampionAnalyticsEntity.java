package com.novarift.analytics.infrastructure.adapters.out.persistence;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "CHAMPION_ANALYTICS")
@Getter
@NoArgsConstructor
public class ChampionAnalyticsEntity {

    @Id
    private Integer championId;

    private String name;

    private boolean lateGameHypercarry;

    private boolean earlyGameAggressor;

    private double burstDamageScore;

    private double controlScore;

    public ChampionAnalyticsEntity(int championId, String name,
                                   boolean lateGameHypercarry, boolean earlyGameAggressor,
                                   double burstDamageScore, double controlScore) {
        this.championId = championId;
        this.name = name;
        this.lateGameHypercarry = lateGameHypercarry;
        this.earlyGameAggressor = earlyGameAggressor;
        this.burstDamageScore = burstDamageScore;
        this.controlScore = controlScore;
    }

}