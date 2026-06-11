package com.novarift.riot.application.services;

import com.novarift.riot.domain.exception.RiotApiException;
import com.novarift.riot.domain.exception.RiotApiException.Reason;
import com.novarift.riot.domain.model.MatchSummary;
import com.novarift.riot.domain.model.RankedEntry;
import com.novarift.riot.domain.model.SummonerSummary;
import com.novarift.riot.domain.port.out.RiotApiPort;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Tests del {@link SummonerSummaryService}.
 *
 * <p>Cubrimos las 4 ramas del caso de uso:
 *
 * <ul>
 * <li>RiotId mal formado → 400 vía {@link RiotApiException}.</li>
 * <li>Llamada exitosa → propaga el resumen del puerto.</li>
 * <li>Excepción "fallback-elegible" + {@code allowMock=true} → mock fallback.</li>
 * <li>Excepción "fallback-elegible" + {@code allowMock=false} → propaga.</li>
 * <li>Excepción NOT_FOUND siempre se propaga (no genera mock).</li>
 * </ul>
 */
@ExtendWith(MockitoExtension.class)
class SummonerSummaryServiceTest {

    @Mock
    private RiotApiPort riotApiPort;

    @InjectMocks
    private SummonerSummaryService service;

    @Test
    @DisplayName("RiotId sin '#' lanza RiotApiException NOT_FOUND")
    void invalidRiotIdShouldThrow() {
        RiotApiException ex = assertThrows(
                RiotApiException.class,
                () -> service.getSummonerSummary("RiotIdSinTag", "euw1", true)
        );
        assertEquals(Reason.NOT_FOUND, ex.reason());
    }

    @Test
    @DisplayName("RiotId nulo lanza RiotApiException NOT_FOUND")
    void nullRiotIdShouldThrow() {
        assertThrows(RiotApiException.class,
                () -> service.getSummonerSummary(null, "euw1", true));
    }

    @Test
    @DisplayName("Llamada exitosa propaga el resumen del adapter")
    void successfulFetchPropagatesSummary() {
        SummonerSummary expected = sampleSummary("Faker#KR1", false);
        when(riotApiPort.fetchSummonerSummary("Faker#KR1", "kr")).thenReturn(expected);

        SummonerSummary actual = service.getSummonerSummary("Faker#KR1", "kr", true);

        assertEquals(expected, actual);
        assertFalse(actual.mock(), "Llamada exitosa no debería ser mock.");
    }

    @Test
    @DisplayName("UNAUTHORIZED + allowMock=true → fallback mock")
    void unauthorizedWithMockAllowedReturnsFallback() {
        when(riotApiPort.fetchSummonerSummary(anyString(), anyString()))
                .thenThrow(new RiotApiException(Reason.UNAUTHORIZED, "401 invalid key"));

        SummonerSummary out = service.getSummonerSummary("AN00#TFG", "euw1", true);

        assertTrue(out.mock(), "Fallback debería marcarse como mock.");
        assertEquals("AN00#TFG", out.riotId());
        assertEquals("AN00", out.gameName());
        assertEquals("TFG", out.tagLine());
        assertEquals("EUW1", out.region());
    }

    @Test
    @DisplayName("RATE_LIMITED + allowMock=true → fallback mock")
    void rateLimitedWithMockAllowedReturnsFallback() {
        when(riotApiPort.fetchSummonerSummary(anyString(), anyString()))
                .thenThrow(new RiotApiException(Reason.RATE_LIMITED, "429"));

        SummonerSummary out = service.getSummonerSummary("AN00#TFG", "euw1", true);

        assertTrue(out.mock());
    }

    @Test
    @DisplayName("UPSTREAM_ERROR + allowMock=true → fallback mock")
    void upstreamErrorWithMockAllowedReturnsFallback() {
        when(riotApiPort.fetchSummonerSummary(anyString(), anyString()))
                .thenThrow(new RiotApiException(Reason.UPSTREAM_ERROR, "timeout"));

        SummonerSummary out = service.getSummonerSummary("AN00#TFG", "euw1", true);

        assertTrue(out.mock());
    }

    @Test
    @DisplayName("NO_API_KEY + allowMock=true → fallback mock")
    void noApiKeyWithMockAllowedReturnsFallback() {
        when(riotApiPort.fetchSummonerSummary(anyString(), anyString()))
                .thenThrow(new RiotApiException(Reason.NO_API_KEY, "placeholder"));

        SummonerSummary out = service.getSummonerSummary("AN00#TFG", "euw1", true);

        assertTrue(out.mock());
    }

    @Test
    @DisplayName("UNAUTHORIZED + allowMock=false → propaga")
    void unauthorizedWithMockDisallowedThrows() {
        when(riotApiPort.fetchSummonerSummary(anyString(), anyString()))
                .thenThrow(new RiotApiException(Reason.UNAUTHORIZED, "401"));

        RiotApiException ex = assertThrows(
                RiotApiException.class,
                () -> service.getSummonerSummary("AN00#TFG", "euw1", false)
        );
        assertEquals(Reason.UNAUTHORIZED, ex.reason());
    }

    @Test
    @DisplayName("NOT_FOUND siempre se propaga (incluso con allowMock=true)")
    void notFoundAlwaysPropagates() {
        when(riotApiPort.fetchSummonerSummary(anyString(), anyString()))
                .thenThrow(new RiotApiException(Reason.NOT_FOUND, "summoner missing"));

        RiotApiException ex = assertThrows(
                RiotApiException.class,
                () -> service.getSummonerSummary("Ghost#404", "euw1", true)
        );
        assertEquals(Reason.NOT_FOUND, ex.reason());
    }

    @Test
    @DisplayName("Region nula se normaliza a 'EUW1' en el fallback")
    void nullRegionIsNormalizedInFallback() {
        // Usamos any() en lugar de anyString() porque region viene null y
        // anyString() de Mockito no matchea null.
        when(riotApiPort.fetchSummonerSummary(any(), any()))
                .thenThrow(new RiotApiException(Reason.NO_API_KEY, "no key"));

        SummonerSummary out = service.getSummonerSummary("AN00#TFG", null, true);
        assertEquals("EUW1", out.region());
    }

    @Test
    @DisplayName("RiotId inválido NO llama al puerto")
    void invalidRiotIdShouldNotCallPort() {
        assertThrows(RiotApiException.class,
                () -> service.getSummonerSummary("malformatted", "euw1", true));
        verify(riotApiPort, never()).fetchSummonerSummary(anyString(), anyString());
    }

    // ─── helpers ──────────────────────────────────────────────────────────

    private static SummonerSummary sampleSummary(String riotId, boolean mock) {
        String[] parts = riotId.split("#", 2);
        RankedEntry solo = new RankedEntry("RANKED_SOLO_5x5", "GOLD", "II", 47, 60, 40);
        MatchSummary match = new MatchSummary(
                "EUW1_1", "Lucian", "BOTTOM", "WIN",
                10, 3, 7, 220, 28, 18, 35000
        );
        return new SummonerSummary(
                riotId,
                parts[0],
                parts.length > 1 ? parts[1] : "",
                "EUW1",
                "PUUID_" + parts[0],
                parts[0],
                145,
                4644,
                solo,
                RankedEntry.unranked(),
                List.of(match),
                mock
        );
    }
}
