package com.novarift.riot.application.services;

import com.novarift.riot.domain.exception.RiotApiException;
import com.novarift.riot.domain.model.SummonerSummary;
import com.novarift.riot.domain.port.in.GetSummonerSummaryUseCase;
import com.novarift.riot.domain.port.out.RiotApiPort;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * SummonerSummaryService — caso de uso primario del módulo Riot.
 *
 * <p>Aplica la política de fallback declarada en
 * {@link GetSummonerSummaryUseCase}: si el adapter lanza
 * {@link RiotApiException} con razón "fallback-elegible" (UNAUTHORIZED,
 * RATE_LIMITED, UPSTREAM_ERROR, NO_API_KEY) y el cliente acepta mock,
 * devolvemos un {@link SummonerSummary#mockFallback} con el riotId
 * solicitado.
 *
 * <p>NOT_FOUND se propaga siempre — al frontend le interesa diferenciar
 * "esta cuenta no existe" del "el server no pudo contactar Riot".
 */
@Service
public class SummonerSummaryService implements GetSummonerSummaryUseCase {

    private static final Logger log = LoggerFactory.getLogger(SummonerSummaryService.class);

    private final RiotApiPort riotApiPort;

    public SummonerSummaryService(RiotApiPort riotApiPort) {
        this.riotApiPort = riotApiPort;
    }

    @Override
    public SummonerSummary getSummonerSummary(String riotId, String region, boolean allowMock) {
        validateRiotId(riotId);

        try {
            return riotApiPort.fetchSummonerSummary(riotId, region);
        } catch (RiotApiException ex) {
            if (allowMock && ex.shouldFallback()) {
                log.info("Riot API {} → fallback mock para {}", ex.reason(), riotId);
                String[] parts = riotId.split("#", 2);
                return SummonerSummary.mockFallback(
                        riotId,
                        parts[0],
                        parts.length > 1 ? parts[1] : "",
                        region == null ? "EUW1" : region.toUpperCase()
                );
            }
            throw ex;
        }
    }

    private static void validateRiotId(String riotId) {
        if (riotId == null || !riotId.contains("#")) {
            throw new RiotApiException(
                    RiotApiException.Reason.NOT_FOUND,
                    "RiotId con formato inválido. Esperado 'GameName#TAG': " + riotId
            );
        }
    }
}
