package com.novarift.live.domain.recommendation;

import java.util.List;

/**
 * Contexto de la partida para el motor de recomendaciones.
 * Contiene toda la información necesaria para calcular el scoring.
 */
public record MatchupContext(
    int ownChampionId,
    List<Integer> enemyChampionIds,
    String lane,            // TOP, JUNGLE, MID, BOT, SUPPORT
    String patchVersion,
    String gameMode          // CLASSIC, ARAM, etc.
) {
    /**
     * Factory para contextos simplificados (cuando no se conoce el campeón propio).
     */
    public static MatchupContext forUnknownOwn(List<Integer> enemyChampionIds, String patchVersion) {
        return new MatchupContext(0, enemyChampionIds, "MID", patchVersion, "CLASSIC");
    }
}
