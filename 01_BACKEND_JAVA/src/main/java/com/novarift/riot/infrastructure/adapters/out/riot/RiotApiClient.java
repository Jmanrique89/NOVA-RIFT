package com.novarift.riot.infrastructure.adapters.out.riot;

import com.fasterxml.jackson.databind.JsonNode;
import com.novarift.riot.domain.exception.RiotApiException;
import com.novarift.riot.domain.exception.RiotApiException.Reason;
import com.novarift.riot.domain.model.MatchSummary;
import com.novarift.riot.domain.model.RankedEntry;
import com.novarift.riot.domain.model.SummonerSummary;
import com.novarift.riot.domain.port.out.RiotApiPort;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import com.novarift.shared.config.RiotApiKeyHolder;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * RiotApiClient — implementación real del puerto {@link RiotApiPort}.
 *
 * <p>Orquesta los 4 endpoints públicos de Riot necesarios para construir
 * un {@link SummonerSummary}:
 *
 * <ol>
 * <li>Account V1 — {@code https://europe.api.riotgames.com/riot/account/v1/accounts/by-riot-id/{name}/{tag}}</li>
 * <li>Summoner V4 — {@code https://{platform}.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/{puuid}}</li>
 * <li>League V4 — {@code https://{platform}.api.riotgames.com/lol/league/v4/entries/by-summoner/{id}}</li>
 * <li>Match V5 — {@code https://europe.api.riotgames.com/lol/match/v5/matches/by-puuid/{puuid}/ids?count=N}</li>
 * <li>Match V5 detail — {@code https://europe.api.riotgames.com/lol/match/v5/matches/{matchId}}</li>
 * </ol>
 *
 * <p>El parámetro {@code region} se interpreta como código de plataforma
 * ({@code euw1}, {@code na1}, {@code kr}…). El cluster regional para
 * Account/Match V5 se deriva de la plataforma — Europa para EUW/EUNE/RU/TR,
 * Americas para NA/BR/LAN/LAS, Asia para KR/JP, SEA para resto.
 *
 * <p>Rate limiting: este cliente es "best effort". No implementa Resilience4j
 * confiamos en la cuota de la dev key (20 req/s, 100 req/2min) que para
 * el TFG es generoso. En producción se pondría un {@code @RateLimiter}.
 */
@Component
public class RiotApiClient implements RiotApiPort {

    private static final Logger log = LoggerFactory.getLogger(RiotApiClient.class);

    private static final int MAX_RECENT_MATCHES = 5;

    private final RestTemplate restTemplate;
    private final RiotApiKeyHolder keyHolder;

    public RiotApiClient(
            @Qualifier("riotProxyRestTemplate") RestTemplate restTemplate,
            RiotApiKeyHolder keyHolder
    ) {
        this.restTemplate = restTemplate;
        this.keyHolder = keyHolder;
    }

    // ─── Cluster regional helpers ─────────────────────────────────────────────

    /** Devuelve el cluster regional para Account/Match V5 dada la plataforma. */
    private static String regionalCluster(String platform) {
        if (platform == null) return "europe";
        String p = platform.toLowerCase();
        if (p.startsWith("euw") || p.startsWith("eun") || p.equals("ru") || p.equals("tr1")) return "europe";
        if (p.equals("na1") || p.equals("br1") || p.startsWith("la")) return "americas";
        if (p.equals("kr") || p.equals("jp1")) return "asia";
        return "sea";
    }

    private static String platformBase(String platform) {
        return "https://" + platform.toLowerCase() + ".api.riotgames.com";
    }

    private static String regionalBase(String platform) {
        return "https://" + regionalCluster(platform) + ".api.riotgames.com";
    }

    // ─── Sanity check de la key ───────────────────────────────────────────────

    private void ensureApiKeyConfigured() {
        if (!keyHolder.isValid()) {
            throw new RiotApiException(Reason.NO_API_KEY,
                    "Riot API key sin configurar (placeholder o vacía). Actualízala desde el panel admin.");
        }
    }

    /** Expone la clave actual (para RiotApiConfig si es necesario). */
    public String getApiKey() {
        return keyHolder.getKey();
    }

    // ─── Account V1 ───────────────────────────────────────────────────────────

    @Override
    public String[] fetchAccountByRiotId(String gameName, String tagLine) {
        ensureApiKeyConfigured();
        // Account V1 vive en cluster regional, no plataforma. Usamos europa por defecto;
        // la cuenta es global, así que da igual mientras escojas un cluster válido.
        final String url = "https://europe.api.riotgames.com/riot/account/v1/accounts/by-riot-id/"
                + encode(gameName) + "/" + encode(tagLine);

        ResponseEntity<JsonNode> resp = exchange(url);
        JsonNode body = resp.getBody();
        if (body == null) {
            throw new RiotApiException(Reason.UPSTREAM_ERROR, "Respuesta vacía Account V1.");
        }
        return new String[]{
                body.path("puuid").asText(),
                body.path("gameName").asText(gameName),
                body.path("tagLine").asText(tagLine),
        };
    }

    // ─── Summoner V4 ──────────────────────────────────────────────────────────

    @Override
    public Object[] fetchSummonerByPuuid(String puuid) {
        ensureApiKeyConfigured();
        // Por simplicidad, EUW1 por defecto. El uso real recibe el `region` desde el
        // controlador y lo propaga a través de fetchSummonerSummary.
        return fetchSummonerByPuuidOnPlatform(puuid, "euw1");
    }

    private Object[] fetchSummonerByPuuidOnPlatform(String puuid, String platform) {
        ensureApiKeyConfigured();
        final String url = platformBase(platform) + "/lol/summoner/v4/summoners/by-puuid/" + encode(puuid);
        ResponseEntity<JsonNode> resp = exchange(url);
        JsonNode body = resp.getBody();
        if (body == null) {
            throw new RiotApiException(Reason.UPSTREAM_ERROR, "Respuesta vacía Summoner V4.");
        }
        return new Object[]{
                body.path("id").asText(),
                body.path("name").asText(""),
                body.path("summonerLevel").asInt(0),
                body.path("profileIconId").asInt(0),
        };
    }

    // ─── League V4 ────────────────────────────────────────────────────────────

    @Override
    public List<RankedEntry> fetchRankedEntries(String puuid) {
        ensureApiKeyConfigured();
        return fetchRankedEntriesOnPlatform(puuid, "euw1");
    }

    private List<RankedEntry> fetchRankedEntriesOnPlatform(String puuid, String platform) {
        ensureApiKeyConfigured();
        // Riot deprecó el endpoint by-summoner (encryptedSummonerId) en 2025.
        // El reemplazo oficial es by-puuid; el llamador ya pasa el puuid.
        final String url = platformBase(platform) + "/lol/league/v4/entries/by-puuid/" + encode(puuid);
        ResponseEntity<JsonNode> resp = exchange(url);
        JsonNode body = resp.getBody();
        if (body == null || !body.isArray()) return Collections.emptyList();

        List<RankedEntry> out = new ArrayList<>();
        for (JsonNode entry : body) {
            out.add(new RankedEntry(
                    entry.path("queueType").asText("UNRANKED"),
                    entry.path("tier").asText("UNRANKED"),
                    entry.path("rank").asText(""),
                    entry.path("leaguePoints").asInt(0),
                    entry.path("wins").asInt(0),
                    entry.path("losses").asInt(0)
            ));
        }
        return out;
    }

    // ─── Match V5 ─────────────────────────────────────────────────────────────

    @Override
    public List<String> fetchRecentMatchIds(String puuid, int count) {
        ensureApiKeyConfigured();
        int safeCount = Math.max(1, Math.min(count, 20));
        // Por defecto cluster Europa — el cluster regional para Match V5 depende de la
        // plataforma; el caso de uso pasa por `fetchSummonerSummary` que lo conoce.
        final String url = "https://europe.api.riotgames.com/lol/match/v5/matches/by-puuid/"
                + encode(puuid) + "/ids?count=" + safeCount;

        ResponseEntity<JsonNode> resp = exchange(url);
        JsonNode body = resp.getBody();
        if (body == null || !body.isArray()) return Collections.emptyList();

        List<String> ids = new ArrayList<>();
        for (JsonNode id : body) ids.add(id.asText());
        return ids;
    }

    @Override
    public MatchSummary fetchMatchSummary(String matchId, String puuid) {
        ensureApiKeyConfigured();
        final String url = "https://europe.api.riotgames.com/lol/match/v5/matches/" + encode(matchId);
        ResponseEntity<JsonNode> resp = exchange(url);
        JsonNode body = resp.getBody();
        if (body == null) {
            throw new RiotApiException(Reason.UPSTREAM_ERROR, "Respuesta vacía Match V5.");
        }

        JsonNode info = body.path("info");
        JsonNode participants = info.path("participants");
        if (!participants.isArray() || participants.isEmpty()) {
            throw new RiotApiException(Reason.NOT_FOUND, "Sin participantes en match " + matchId);
        }

        JsonNode mine = null;
        for (JsonNode p : participants) {
            if (puuid.equals(p.path("puuid").asText())) { mine = p; break; }
        }
        if (mine == null) {
            throw new RiotApiException(Reason.NOT_FOUND, "Puuid no presente en match " + matchId);
        }

        long durationSec = info.path("gameDuration").asLong(0);
        int durationMin = (int) Math.round(durationSec / 60.0);

        return new MatchSummary(
                matchId,
                mine.path("championName").asText(""),
                mine.path("teamPosition").asText("UNKNOWN"),
                mine.path("win").asBoolean(false) ? "WIN" : "LOSS",
                mine.path("kills").asInt(0),
                mine.path("deaths").asInt(0),
                mine.path("assists").asInt(0),
                mine.path("totalMinionsKilled").asInt(0) + mine.path("neutralMinionsKilled").asInt(0),
                durationMin,
                mine.path("visionScore").asInt(0),
                mine.path("totalDamageDealtToChampions").asInt(0)
        );
    }

    // ─── Summary orquestado ──────────────────────────────────────────────────

    @Override
    public SummonerSummary fetchSummonerSummary(String riotId, String region) {
        if (riotId == null || !riotId.contains("#")) {
            throw new RiotApiException(Reason.NOT_FOUND, "RiotId con formato inválido: " + riotId);
        }
        String[] parts = riotId.split("#", 2);
        String gameName = parts[0];
        String tagLine = parts[1];
        String platform = (region == null || region.isBlank()) ? "euw1" : region.toLowerCase();

        ensureApiKeyConfigured();

        // 1) Account V1
        String[] account = fetchAccountByRiotId(gameName, tagLine);
        String puuid = account[0];

        // 2) Summoner V4 (depende de plataforma)
        Object[] summoner = fetchSummonerByPuuidOnPlatform(puuid, platform);
        // Riot dejó de devolver summonerId y `name`. Fallback a gameName si no llega.
        String rawName = (String) summoner[1];
        String summonerName = (rawName == null || rawName.isBlank()) ? gameName : rawName;
        int summonerLevel  = (Integer) summoner[2];
        int profileIconId  = (Integer) summoner[3];

        // 3) League V4 entries — by-puuid (by-summoner deprecado)
        List<RankedEntry> entries = fetchRankedEntriesOnPlatform(puuid, platform);
        RankedEntry solo = entries.stream()
                .filter(e -> "RANKED_SOLO_5x5".equals(e.queueType()))
                .findFirst().orElse(RankedEntry.unranked());
        RankedEntry flex = entries.stream()
                .filter(e -> "RANKED_FLEX_SR".equals(e.queueType()))
                .findFirst().orElse(RankedEntry.unranked());

        // 4) Match V5 — últimas 5
        List<String> matchIds = fetchRecentMatchIds(puuid, MAX_RECENT_MATCHES);
        List<MatchSummary> matches = new ArrayList<>();
        for (String id : matchIds) {
            try {
                matches.add(fetchMatchSummary(id, puuid));
            } catch (RiotApiException e) {
                log.warn("Saltando match {} ({}): {}", id, e.reason(), e.getMessage());
                // Best effort: si una partida falla, seguimos con el resto.
            }
        }

        return new SummonerSummary(
                gameName + "#" + tagLine,
                gameName,
                tagLine,
                platform.toUpperCase(),
                puuid,
                summonerName,
                summonerLevel,
                profileIconId,
                solo,
                flex,
                matches,
                false
        );
    }

    // ─── Wiring común ────────────────────────────────────────────────────────

    private ResponseEntity<JsonNode> exchange(String url) {
        try {
            // Pasamos un URI ya codificado (no un String-template): así RestTemplate
            // NO vuelve a codificar y nuestro %20 no se convierte en %2520 → evita 404.
            java.net.URI uri = java.net.URI.create(url);
            ResponseEntity<JsonNode> resp = restTemplate.getForEntity(uri, JsonNode.class);
            HttpStatusCode code = resp.getStatusCode();
            if (code.is2xxSuccessful()) return resp;

            int value = code.value();
            if (value == 401 || value == 403) {
                throw new RiotApiException(Reason.UNAUTHORIZED,
                        "Riot API rechazó la key (HTTP " + value + ").");
            }
            if (value == 404) {
                throw new RiotApiException(Reason.NOT_FOUND,
                        "Riot API recurso no encontrado (HTTP 404): " + url);
            }
            if (value == 429) {
                throw new RiotApiException(Reason.RATE_LIMITED,
                        "Riot API rate limit excedido.");
            }
            throw new RiotApiException(Reason.UPSTREAM_ERROR,
                    "Riot API HTTP " + value + " en " + url);
        } catch (RiotApiException ex) {
            throw ex;
        } catch (Exception ex) {
            log.warn("Fallo IO contra Riot API ({}): {}", url, ex.getMessage());
            throw new RiotApiException(Reason.UPSTREAM_ERROR,
                    "Error IO/timeout contra Riot API.", ex);
        }
    }

    private static String encode(String s) {
        if (s == null) return "";
        // URLEncoder está pensado para query strings (espacio → '+'). Aquí encodeamos
        // SEGMENTOS DE PATH, donde '+' es un literal y el espacio debe ir como %20.
        // Sin esta corrección, "El mini hakim" viaja como "El+mini+hakim" → Riot 404.
        return java.net.URLEncoder.encode(s, java.nio.charset.StandardCharsets.UTF_8)
                .replace("+", "%20");
    }
}
