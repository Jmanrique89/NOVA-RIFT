package com.novarift.riot.domain.port.out;

import com.novarift.riot.domain.model.MatchSummary;
import com.novarift.riot.domain.model.RankedEntry;
import com.novarift.riot.domain.model.SummonerSummary;

import java.util.List;

/**
 * Puerto de salida para acceder a la Riot API.
 *
 * <p>El contrato está dividido en operaciones atómicas (cuenta, summoner,
 * entries, match list, match detail) para que el caso de uso pueda
 * componerlas como necesite. La implementación real
 * ({@code RiotApiClient}) cuenta con rate limiting, auth y deserialización
 * en uno; los tests de la application layer mockean este puerto.
 *
 * <p>Todos los métodos pueden lanzar
 * {@link com.novarift.riot.domain.exception.RiotApiException} con la
 * razón clasificada (UNAUTHORIZED / RATE_LIMITED / NOT_FOUND / etc.).
 */
public interface RiotApiPort {

    /**
     * Devuelve los datos básicos de cuenta para un riotId tipo "Faker#KR1".
     *
     * @return array de tamaño 3: {@code [puuid, gameName, tagLine]}.
     */
    String[] fetchAccountByRiotId(String gameName, String tagLine);

    /**
     * Devuelve los datos de summoner para un puuid: {@code [summonerId, name, level, profileIconId]}.
     */
    Object[] fetchSummonerByPuuid(String puuid);

    /**
     * Lista las entries ranked del summoner. Devuelve lista vacía si no
     * juega ranked. Nunca devuelve null.
     */
    List<RankedEntry> fetchRankedEntries(String summonerId);

    /**
     * Últimos N matchIds ranked del summoner (queue 420 SoloQ por defecto).
     */
    List<String> fetchRecentMatchIds(String puuid, int count);

    /**
     * Detalle (proyección) de una partida concreta para el puuid dado.
     * Si el puuid no participó, lanza {@link com.novarift.riot.domain.exception.RiotApiException}.
     */
    MatchSummary fetchMatchSummary(String matchId, String puuid);

    /**
     * Combina todas las llamadas anteriores en un solo {@link SummonerSummary}.
     * Si alguna falla con razón "fallback-eligible", la implementación
     * decide si propagar o devolver un summary parcialmente vacío.
     *
     * @param riotId identificador completo "Faker#KR1"
     * @param region región del cluster ("euw1" / "na1" / etc.)
     * @return resumen completo
     */
    SummonerSummary fetchSummonerSummary(String riotId, String region);
}
