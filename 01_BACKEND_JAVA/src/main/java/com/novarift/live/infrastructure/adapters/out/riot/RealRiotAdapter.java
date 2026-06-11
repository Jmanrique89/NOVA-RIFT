package com.novarift.live.infrastructure.adapters.out.riot;

import com.novarift.live.domain.RiotMatchPort;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;

import java.util.Map;

/**
 * Adaptador de salida (driven adapter) que implementa {@link RiotMatchPort} contra
 * la API real de Riot Games.
 *
 * <p>Es el "lado derecho" del hexagono del modulo Live: traduce el puerto de dominio
 * en llamadas HTTP reales (Account-V1 para el PUUID, Spectator-V5 para la partida en
 * curso). Spring lo activa solo cuando {@code app.riot.mode=REAL}; en otro caso se
 * usa {@link MockRiotAdapter}, de modo que el dominio no se entera de cual esta activo.
 *
 * <p>Es robusto ante fallos: si la cuenta no esta en partida (404) o la conexion falla,
 * devuelve un JSON de fallback en vez de romper. Los usuarios de prueba (AN00/DEMO/MOCK)
 * se sirven desde un snapshot local sin tocar la red.
 */
@Component
@ConditionalOnProperty(name = "app.riot.mode", havingValue = "REAL")
public class RealRiotAdapter implements RiotMatchPort {

    private final RestTemplate riotRestTemplate;
    private final String accountUrl;
    private final String spectatorUrl;

    public RealRiotAdapter(
            RestTemplate riotRestTemplate,
            @Value("${app.riot.url.account}") String accountUrl,
            @Value("${app.riot.url.spectator}") String spectatorUrl) {
        this.riotRestTemplate = riotRestTemplate;
        this.accountUrl = accountUrl;
        this.spectatorUrl = spectatorUrl;
    }

    @Override
    public String getEnemyDraftAnalysis(String summonerName, String sourceHash) {
        // Usuario de prueba: se sirve desde snapshot local, sin llamar a Riot.
        if (isTestUser(summonerName)) {
            return loadMockMatch();
        }

        try {
            // 1. Obtener PUUID mediante Account-V1 (Asume formato GameName-TagLine)
            String[] parts = summonerName.split("-");
            String gameName = parts.length > 0 ? parts[0] : summonerName;
            String tagLine = parts.length > 1 ? parts[1] : "EUW";

            String accountEndpoint = accountUrl + "/accounts/by-riot-id/" + gameName + "/" + tagLine;
            ResponseEntity<Map> accountResponse = riotRestTemplate.getForEntity(accountEndpoint, Map.class);
            
            if (accountResponse.getBody() == null || !accountResponse.getBody().containsKey("puuid")) {
                return generateFallbackJson("Error de cuenta", "Imposible localizar invocador.");
            }
            
            String puuid = accountResponse.getBody().get("puuid").toString();

            // 2. Obtener partida activa (Spectator-V5)
            String activeGameEndpoint = spectatorUrl + "/active-games/by-summoner/" + puuid;
            
            try {
                // Intento real en la API oficial de partidas en curso (Live)
                ResponseEntity<String> gameResponseString = riotRestTemplate.getForEntity(activeGameEndpoint, String.class);
                
                // --- SNAPSHOT MOCKING (GRABADORA) ---
                try {
                    java.nio.file.Path mockPath = java.nio.file.Paths.get(System.getProperty("user.dir"), "src", "main", "resources", "mocks", "last_real_match.json");
                    java.nio.file.Files.writeString(mockPath, gameResponseString.getBody() != null ? gameResponseString.getBody() : "{}");
                } catch (Exception e) {
                    System.err.println("Aviso: No se pudo grabar el Snapshot local: " + e.getMessage());
                }
                
                // Si llegamos aquí, el usuario está jugando de verdad.
                // Retornaríamos un JSON con los equipos reales parseando gameResponseString.
                return "{ \"team\": \"Partida Oficial V5\", \"threatLevel\": \"Extremo\", \"composition\": \"Partida interceptada. JSON guardado con éxito localmente.\", \"champions\": [\"Grabación Completada\"] }";
                
            } catch (HttpClientErrorException.NotFound e) {
                // 404 capturado sutilmente: Significa que la cuenta existe, pero no está jugando ahora mismo.
                return "{ \"team\": \"Base Local\", \"threatLevel\": \"Pacífico\", \"composition\": \"El invocador " + summonerName + " no está en partida oficial actualmente.\", \"champions\": [] }";
            }

        } catch (Exception e) {
            return generateFallbackJson("Fallo Extremo de Conexión", e.getMessage());
        }
    }

    @Override
    public String getRecommendedBuild(String enemyDraft) {
        // Build táctica ajustada usando la info cruda obtenida
        if (enemyDraft != null && enemyDraft.contains("no está en partida")) {
            return "{ \"primaryTarget\": \"N/A\", \"items\": [\"Espera a entrar en partida\"], \"tactics\": \"Descansa Invocador.\", \"variants\": [ { \"name\": \"Standby\", \"primaryTarget\": \"N/A\", \"items\": [\"Espera a entrar en partida\"], \"tactics\": \"Sin partida activa no hay build competitiva.\" } ] }";
        }
        return "{ \"primaryTarget\": \"Adaptación Dinámica\", \"items\": [\"Analizador Hextech\", \"Escudo Vivo\"], \"tactics\": \"Aplica mecánicas de macro-game superior basándote en la info Live.\", \"variants\": [ { \"name\": \"Control Objetivos\", \"primaryTarget\": \"Macro y objetivos\", \"items\": [\"Analizador Hextech\", \"Escudo Vivo\", \"Wardstone\"], \"tactics\": \"Prioriza setup de vision para dragones/baron.\" }, { \"name\": \"Teamfight\", \"primaryTarget\": \"Frontline estable\", \"items\": [\"Escudo Vivo\", \"Aegis\", \"Redemption\"], \"tactics\": \"Juega a cooldowns defensivos y peel.\" }, { \"name\": \"Pickoff\", \"primaryTarget\": \"Eliminar objetivo aislado\", \"items\": [\"Analizador Hextech\", \"Shadowflame\", \"Zhonya's Hourglass\"], \"tactics\": \"Busca ventanas de 5v4 antes de objetivo mayor.\" } ] }";
    }
    
    private String generateFallbackJson(String threatLevel, String msg) {
        return "{ \"team\": \"Error\", \"threatLevel\": \"" + threatLevel + "\", \"composition\": \"" + msg + "\", \"champions\": [] }";
    }

    /** Detecta test users que bypassean la Riot API real. Acepta '-' o '#' como separador. */
    private boolean isTestUser(String summonerName) {
        if (summonerName == null) return false;
        String upper = summonerName.split("[-#]")[0].trim().toUpperCase();
        return "AN00".equals(upper) || "DEMO".equals(upper) || "MOCK".equals(upper);
    }

    /** Carga el JSON de partida grabado o devuelve un fallback robusto. */
    private String loadMockMatch() {
        try {
            java.nio.file.Path mockPath = java.nio.file.Paths.get(
                System.getProperty("user.dir"),
                "src", "main", "resources", "mocks", "last_real_match.json"
            );
            if (java.nio.file.Files.exists(mockPath)) {
                return java.nio.file.Files.readString(mockPath);
            }
        } catch (Exception e) {
            System.err.println("[REAL→TEST] Error leyendo mock: " + e.getMessage());
        }
        return "{ \"team\": \"AN00 vs Bots (Test User)\", \"threatLevel\": \"High\", "
             + "\"composition\": \"Heavy AD / Assassin (mock fijo)\", "
             + "\"champions\": [\"Zed\", \"Lee Sin\", \"Lux\", \"Jinx\", \"Thresh\"] }";
    }
}
