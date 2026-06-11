package com.novarift.riot.domain.model;

import java.util.List;

/**
 * Resumen completo de un summoner — DTO de salida del proxy Riot.
 *
 * <p>Combina los datos cruzados de cuatro endpoints de Riot en una sola
 * estructura que el frontend consume con un solo fetch:
 *
 * <ol>
 * <li>Account V1 ({@code accounts/by-riot-id/{name}/{tag}}) → {@code puuid}, {@code gameName}, {@code tagLine}.</li>
 * <li>Summoner V4 ({@code summoners/by-puuid/{puuid}}) → {@code summonerId}, {@code level}, {@code profileIconId}.</li>
 * <li>League V4 ({@code entries/by-summoner/{id}}) → {@link RankedEntry} (solo/duo y/o flex).</li>
 * <li>Match V5 ({@code matches/by-puuid/{puuid}/ids?count=5}) + detalle por id → últimas {@link MatchSummary}.</li>
 * </ol>
 *
 * <p>El campo {@code mock} indica que el resumen viene del fallback (clave
 * inválida, rate limit excedido, summoner no encontrado, etc.). El frontend
 * lo usa para pintar un badge "DEMO" sin ocultar el contenido.
 *
 * @param riotId identificador completo "Faker#KR1"
 * @param gameName lado izquierdo del riotId
 * @param tagLine lado derecho del riotId
 * @param region cluster de la cuenta (EUW1 / NA1 / KR / etc.)
 * @param puuid identificador único de cuenta
 * @param summonerName nombre legacy del summoner (puede estar vacío post-rework)
 * @param summonerLevel nivel del summoner (1..N)
 * @param profileIconId id del icono actual (DataDragon)
 * @param soloRanked entrada de soloQ — nunca null (UNRANKED si no juega)
 * @param flexRanked entrada de flex — nunca null (UNRANKED si no juega)
 * @param recentMatches últimas 5 partidas — vacía si error / sin historial
 * @param mock true si el resumen viene del fallback
 */
public record SummonerSummary(
        String riotId,
        String gameName,
        String tagLine,
        String region,
        String puuid,
        String summonerName,
        int summonerLevel,
        int profileIconId,
        RankedEntry soloRanked,
        RankedEntry flexRanked,
        List<MatchSummary> recentMatches,
        boolean mock
) {
    /** Constructor de conveniencia para construir un fallback "mock" rápido. */
    public static SummonerSummary mockFallback(String riotId, String gameName, String tagLine, String region) {
        return new SummonerSummary(
                riotId,
                gameName,
                tagLine,
                region,
                "MOCK_PUUID_" + riotId,
                gameName,
                30,
                4644, // icon AN00
                RankedEntry.unranked(),
                RankedEntry.unranked(),
                List.of(),
                true
        );
    }
}
