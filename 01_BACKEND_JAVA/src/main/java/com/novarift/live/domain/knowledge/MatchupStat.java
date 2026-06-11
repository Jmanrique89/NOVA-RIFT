package com.novarift.live.domain.knowledge;

/**
 * Estadística de matchup entre dos campeones en un carril y parche dados.
 * Fuente: datos curados / agregados de partidas.
 */
public record MatchupStat(
    String matchupId,
    String patchVersion,
    String lane,           // TOP, JUNGLE, MID, BOT, SUPPORT
    int championId,
    int versusChampionId,
    int sampleSize,
    double winRate,         // 0.0 - 1.0
    double goldDiff15       // diferencia de oro a minuto 15 (positivo = favorable)
) {}
