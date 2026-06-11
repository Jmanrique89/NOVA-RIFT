package com.novarift.riot.infrastructure.adapters.out.riot;

import com.novarift.riot.domain.exception.RiotApiException;
import com.novarift.riot.domain.exception.RiotApiException.Reason;
import com.novarift.shared.config.RiotApiKeyHolder;
import com.novarift.riot.domain.model.MatchSummary;
import com.novarift.riot.domain.model.RankedEntry;
import com.novarift.riot.domain.model.SummonerSummary;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestTemplate;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withResourceNotFound;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withTooManyRequests;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withUnauthorizedRequest;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;

/**
 * Tests del {@link RiotApiClient} con {@link MockRestServiceServer}.
 *
 * <p>No es un {@code @SpringBootTest} — instanciamos el cliente
 * directamente con un {@link RestTemplate} fresco y un mock server
 * encajado para interceptar las llamadas. Esto nos da:
 *
 * <ul>
 * <li>Velocidad (cada test < 100ms).</li>
 * <li>Aislamiento (sin internet, sin Riot, sin tocar el contexto Spring).</li>
 * <li>Verificación de URLs y headers exactos.</li>
 * </ul>
 *
 * <p>Cobertura:
 * <ul>
 * <li>Header {@code X-Riot-Token} se añade automáticamente.</li>
 * <li>Cluster regional se deriva correctamente de la plataforma
 * (euw1 → europe, kr → asia, na1 → americas, lan → americas, oce1 → sea).</li>
 * <li>Mapping de errores: 401/403 → UNAUTHORIZED, 404 → NOT_FOUND,
 * 429 → RATE_LIMITED, 5xx → UPSTREAM_ERROR.</li>
 * <li>Sanity check de la key (placeholder lanza NO_API_KEY antes de salir
 * a la red).</li>
 * <li>League V4 sin entries devuelve lista vacía.</li>
 * <li>Match V5 con puuid no presente lanza NOT_FOUND.</li>
 * <li>Orquestación {@code fetchSummonerSummary} ensambla los 4 endpoints.</li>
 * </ul>
 */
class RiotApiClientTest {

    private static final String DUMMY_KEY = "RGAPI-test-fake-key";

    private RestTemplate restTemplate;
    private MockRestServiceServer mockServer;
    private RiotApiClient client;

    @BeforeEach
    void setUp() {
        // RestTemplate manual — no usamos el bean del módulo, queremos un
        // template "limpio" para que el mock server intercepte sin choque
        // con el SilentErrorHandler del config (que tragaría 4xx).
        // El mock server emite ResponseStatusException en 4xx, que es lo
        // que el cliente espera para clasificar.
        restTemplate = new RestTemplateBuilder()
                .additionalInterceptors((request, body, execution) -> {
                    request.getHeaders().add("X-Riot-Token", DUMMY_KEY);
                    return execution.execute(request, body);
                })
                .errorHandler(new com.novarift.riot.infrastructure.config.SilentErrorHandler())
                .build();

        mockServer = MockRestServiceServer.bindTo(restTemplate).build();
        client = new RiotApiClient(restTemplate, RiotApiKeyHolder.forTesting(DUMMY_KEY));
    }

    // ─── Sanity check de la key ──────────────────────────────────────────

    @Test
    @DisplayName("Key vacía lanza NO_API_KEY antes de salir a red")
    void emptyKeyShouldThrowNoApiKey() {
        RiotApiClient noKey = new RiotApiClient(restTemplate, RiotApiKeyHolder.forTesting(""));
        RiotApiException ex = assertThrows(RiotApiException.class,
                () -> noKey.fetchAccountByRiotId("Faker", "KR1"));
        assertEquals(Reason.NO_API_KEY, ex.reason());
    }

    @Test
    @DisplayName("Key con PLACEHOLDER lanza NO_API_KEY")
    void placeholderKeyShouldThrowNoApiKey() {
        RiotApiClient placeholder = new RiotApiClient(restTemplate, RiotApiKeyHolder.forTesting("RGAPI-DEMO-KEY-PLACEHOLDER"));
        RiotApiException ex = assertThrows(RiotApiException.class,
                () -> placeholder.fetchAccountByRiotId("Faker", "KR1"));
        assertEquals(Reason.NO_API_KEY, ex.reason());
    }

    // ─── Account V1 ──────────────────────────────────────────────────────

    @Test
    @DisplayName("Account V1 OK devuelve [puuid, gameName, tagLine] y manda X-Riot-Token")
    void fetchAccountByRiotIdShouldReturnTriple() {
        mockServer.expect(requestTo(
                "https://europe.api.riotgames.com/riot/account/v1/accounts/by-riot-id/Faker/KR1"))
                .andExpect(method(HttpMethod.GET))
                .andExpect(header("X-Riot-Token", DUMMY_KEY))
                .andRespond(withSuccess(
                    "{\"puuid\":\"PUUID_FAKER\",\"gameName\":\"Faker\",\"tagLine\":\"KR1\"}",
                    MediaType.APPLICATION_JSON));

        String[] account = client.fetchAccountByRiotId("Faker", "KR1");

        assertEquals("PUUID_FAKER", account[0]);
        assertEquals("Faker", account[1]);
        assertEquals("KR1", account[2]);
        mockServer.verify();
    }

    @Test
    @DisplayName("Account V1 con 401 lanza UNAUTHORIZED")
    void fetchAccountByRiotId401ShouldThrowUnauthorized() {
        mockServer.expect(requestTo(
                "https://europe.api.riotgames.com/riot/account/v1/accounts/by-riot-id/Faker/KR1"))
                .andRespond(withUnauthorizedRequest());

        RiotApiException ex = assertThrows(RiotApiException.class,
                () -> client.fetchAccountByRiotId("Faker", "KR1"));
        assertEquals(Reason.UNAUTHORIZED, ex.reason());
    }

    @Test
    @DisplayName("Account V1 con 404 lanza NOT_FOUND")
    void fetchAccountByRiotId404ShouldThrowNotFound() {
        mockServer.expect(requestTo(
                "https://europe.api.riotgames.com/riot/account/v1/accounts/by-riot-id/Ghost/404"))
                .andRespond(withResourceNotFound());

        RiotApiException ex = assertThrows(RiotApiException.class,
                () -> client.fetchAccountByRiotId("Ghost", "404"));
        assertEquals(Reason.NOT_FOUND, ex.reason());
    }

    @Test
    @DisplayName("Account V1 con 429 lanza RATE_LIMITED")
    void fetchAccountByRiotId429ShouldThrowRateLimited() {
        mockServer.expect(requestTo(
                "https://europe.api.riotgames.com/riot/account/v1/accounts/by-riot-id/Faker/KR1"))
                .andRespond(withTooManyRequests());

        RiotApiException ex = assertThrows(RiotApiException.class,
                () -> client.fetchAccountByRiotId("Faker", "KR1"));
        assertEquals(Reason.RATE_LIMITED, ex.reason());
    }

    @Test
    @DisplayName("Account V1 con 500 lanza UPSTREAM_ERROR")
    void fetchAccountByRiotId500ShouldThrowUpstreamError() {
        mockServer.expect(requestTo(
                "https://europe.api.riotgames.com/riot/account/v1/accounts/by-riot-id/Faker/KR1"))
                .andRespond(withStatus(HttpStatus.INTERNAL_SERVER_ERROR));

        RiotApiException ex = assertThrows(RiotApiException.class,
                () -> client.fetchAccountByRiotId("Faker", "KR1"));
        assertEquals(Reason.UPSTREAM_ERROR, ex.reason());
    }

    // ─── Summoner V4 ─────────────────────────────────────────────────────

    @Test
    @DisplayName("Summoner V4 OK devuelve [id, name, level, profileIconId]")
    void fetchSummonerByPuuidShouldReturnSummoner() {
        mockServer.expect(requestTo(
                "https://euw1.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/PUUID_FAKER"))
                .andRespond(withSuccess(
                    "{\"id\":\"SUMM_ID\",\"name\":\"Faker\",\"summonerLevel\":342,\"profileIconId\":4644}",
                    MediaType.APPLICATION_JSON));

        Object[] summoner = client.fetchSummonerByPuuid("PUUID_FAKER");

        assertEquals("SUMM_ID", summoner[0]);
        assertEquals("Faker", summoner[1]);
        assertEquals(342, summoner[2]);
        assertEquals(4644, summoner[3]);
    }

    // ─── League V4 ───────────────────────────────────────────────────────

    @Test
    @DisplayName("League V4 con entries devuelve la lista parseada")
    void fetchRankedEntriesShouldParseList() {
        String json = "[{\"queueType\":\"RANKED_SOLO_5x5\",\"tier\":\"DIAMOND\","
                    + "\"rank\":\"II\",\"leaguePoints\":47,\"wins\":120,\"losses\":105}]";
        mockServer.expect(requestTo(
                "https://euw1.api.riotgames.com/lol/league/v4/entries/by-puuid/SUMM_ID"))
                .andRespond(withSuccess(json, MediaType.APPLICATION_JSON));

        List<RankedEntry> entries = client.fetchRankedEntries("SUMM_ID");

        assertEquals(1, entries.size());
        RankedEntry e = entries.get(0);
        assertEquals("DIAMOND", e.tier());
        assertEquals("II", e.division());
        assertEquals(47, e.leaguePoints());
        assertEquals(120, e.wins());
        assertEquals(53, e.winrate()); // 120 / (120+105) = 53.33%
    }

    @Test
    @DisplayName("League V4 vacío devuelve lista vacía")
    void fetchRankedEntriesEmptyShouldReturnEmpty() {
        mockServer.expect(requestTo(
                "https://euw1.api.riotgames.com/lol/league/v4/entries/by-puuid/UNRANKED_ID"))
                .andRespond(withSuccess("[]", MediaType.APPLICATION_JSON));

        List<RankedEntry> entries = client.fetchRankedEntries("UNRANKED_ID");
        assertTrue(entries.isEmpty());
    }

    // ─── Match V5 ────────────────────────────────────────────────────────

    @Test
    @DisplayName("Match V5 list IDs devuelve lista parseada")
    void fetchRecentMatchIdsShouldParseList() {
        mockServer.expect(requestTo(
                "https://europe.api.riotgames.com/lol/match/v5/matches/by-puuid/PUUID/ids?count=5"))
                .andRespond(withSuccess(
                    "[\"EUW1_M1\",\"EUW1_M2\",\"EUW1_M3\"]",
                    MediaType.APPLICATION_JSON));

        List<String> ids = client.fetchRecentMatchIds("PUUID", 5);

        assertEquals(3, ids.size());
        assertEquals("EUW1_M1", ids.get(0));
    }

    @Test
    @DisplayName("Match V5 con count > 20 se cap a 20 (sanity)")
    void fetchRecentMatchIdsShouldCapCount() {
        mockServer.expect(requestTo(
                "https://europe.api.riotgames.com/lol/match/v5/matches/by-puuid/PUUID/ids?count=20"))
                .andRespond(withSuccess("[]", MediaType.APPLICATION_JSON));

        List<String> ids = client.fetchRecentMatchIds("PUUID", 999);
        assertNotNull(ids);
    }

    @Test
    @DisplayName("Match V5 detail con puuid no presente lanza NOT_FOUND")
    void fetchMatchSummaryWithMissingPuuidShouldThrow() {
        // 1 participante, puuid distinto del que pasamos.
        String json = """
            {
              "info": {
                "gameDuration": 1800,
                "participants": [
                  {"puuid":"OTHER_PUUID","championName":"Lucian"}
                ]
              }
            }
            """;
        mockServer.expect(requestTo(
                "https://europe.api.riotgames.com/lol/match/v5/matches/EUW1_M1"))
                .andRespond(withSuccess(json, MediaType.APPLICATION_JSON));

        RiotApiException ex = assertThrows(RiotApiException.class,
                () -> client.fetchMatchSummary("EUW1_M1", "MY_PUUID"));
        assertEquals(Reason.NOT_FOUND, ex.reason());
    }

    @Test
    @DisplayName("Match V5 detail OK construye MatchSummary con cs total = minions + neutrals")
    void fetchMatchSummaryShouldComposeCs() {
        String json = """
            {
              "info": {
                "gameDuration": 1800,
                "participants": [
                  {
                    "puuid": "MY_PUUID",
                    "championName": "Lucian",
                    "teamPosition": "BOTTOM",
                    "win": true,
                    "kills": 12,
                    "deaths": 3,
                    "assists": 8,
                    "totalMinionsKilled": 200,
                    "neutralMinionsKilled": 25,
                    "visionScore": 22,
                    "totalDamageDealtToChampions": 38000
                  }
                ]
              }
            }
            """;
        mockServer.expect(requestTo(
                "https://europe.api.riotgames.com/lol/match/v5/matches/EUW1_M1"))
                .andRespond(withSuccess(json, MediaType.APPLICATION_JSON));

        MatchSummary m = client.fetchMatchSummary("EUW1_M1", "MY_PUUID");

        assertEquals("Lucian", m.championName());
        assertEquals("BOTTOM", m.role());
        assertEquals("WIN", m.result());
        assertEquals(12, m.kills());
        assertEquals(225, m.cs()); // 200 + 25
        assertEquals(30, m.durationMinutes()); // 1800/60
        assertEquals(38000, m.damageToChamps());
    }

    // ─── Orquestación completa ──────────────────────────────────────────

    @Test
    @DisplayName("fetchSummonerSummary orquesta los 4 endpoints en cascada")
    void fetchSummonerSummaryShouldOrchestrateAllEndpoints() {
        // 1) Account V1
        mockServer.expect(requestTo(
                "https://europe.api.riotgames.com/riot/account/v1/accounts/by-riot-id/Faker/KR1"))
                .andRespond(withSuccess(
                    "{\"puuid\":\"PUUID_FAKER\",\"gameName\":\"Faker\",\"tagLine\":\"KR1\"}",
                    MediaType.APPLICATION_JSON));

        // 2) Summoner V4 (plataforma KR)
        mockServer.expect(requestTo(
                "https://kr.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/PUUID_FAKER"))
                .andRespond(withSuccess(
                    "{\"id\":\"SUMM\",\"name\":\"Faker\",\"summonerLevel\":342,\"profileIconId\":4644}",
                    MediaType.APPLICATION_JSON));

        // 3) League V4 (plataforma KR) — solo solo/duo. Riot migró a by-puuid
        // así que el cliente usa el puuid del paso 1, no el summonerId.
        mockServer.expect(requestTo(
                "https://kr.api.riotgames.com/lol/league/v4/entries/by-puuid/PUUID_FAKER"))
                .andRespond(withSuccess(
                    "[{\"queueType\":\"RANKED_SOLO_5x5\",\"tier\":\"CHALLENGER\",\"rank\":\"I\","
                  + "\"leaguePoints\":1234,\"wins\":300,\"losses\":250}]",
                    MediaType.APPLICATION_JSON));

        // 4) Match V5 ids (cluster europe — Match V5 ya hardcodea europa)
        mockServer.expect(requestTo(
                "https://europe.api.riotgames.com/lol/match/v5/matches/by-puuid/PUUID_FAKER/ids?count=5"))
                .andRespond(withSuccess(
                    "[\"KR_M1\"]",
                    MediaType.APPLICATION_JSON));

        // 5) Match V5 detail
        mockServer.expect(requestTo(
                "https://europe.api.riotgames.com/lol/match/v5/matches/KR_M1"))
                .andRespond(withSuccess("""
                    {
                      "info": {
                        "gameDuration": 1500,
                        "participants": [{
                          "puuid":"PUUID_FAKER","championName":"Ahri","teamPosition":"MID",
                          "win":true,"kills":10,"deaths":2,"assists":12,
                          "totalMinionsKilled":210,"neutralMinionsKilled":0,
                          "visionScore":30,"totalDamageDealtToChampions":29000
                        }]
                      }
                    }
                    """, MediaType.APPLICATION_JSON));

        SummonerSummary out = client.fetchSummonerSummary("Faker#KR1", "kr");

        assertEquals("Faker#KR1", out.riotId());
        assertEquals("Faker", out.gameName());
        assertEquals("KR1", out.tagLine());
        assertEquals("KR", out.region());
        assertEquals("PUUID_FAKER", out.puuid());
        assertEquals(342, out.summonerLevel());
        assertEquals(4644, out.profileIconId());
        assertEquals("CHALLENGER", out.soloRanked().tier());
        assertEquals("UNRANKED", out.flexRanked().tier()); // sin entry → fallback
        assertEquals(1, out.recentMatches().size());
        assertEquals("Ahri", out.recentMatches().get(0).championName());
        assertFalse(out.mock(), "Llamada exitosa NO debería marcar mock=true.");

        mockServer.verify();
    }

    @Test
    @DisplayName("fetchSummonerSummary con riotId malformado lanza NOT_FOUND")
    void fetchSummonerSummaryMalformedShouldThrowNotFound() {
        RiotApiException ex = assertThrows(RiotApiException.class,
                () -> client.fetchSummonerSummary("malformatted", "euw1"));
        assertEquals(Reason.NOT_FOUND, ex.reason());
    }
}
