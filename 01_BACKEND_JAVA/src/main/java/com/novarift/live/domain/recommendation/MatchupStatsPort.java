package com.novarift.live.domain.recommendation;

import com.novarift.live.domain.knowledge.MatchupStat;

import java.util.List;
import java.util.Optional;

/**
 * Puerto de dominio para estadísticas de matchup entre campeones.
 */
public interface MatchupStatsPort {

    Optional<MatchupStat> findMatchup(int championId, int versusChampionId, String lane, String patchVersion);

    List<MatchupStat> findAllVersus(int championId, String patchVersion);
}
