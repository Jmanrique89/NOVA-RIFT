package com.novarift.identity.infrastructure.adapters.in.web;

import com.novarift.api.IdentityApi;
import com.novarift.live.infrastructure.config.RiotApiConfig;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;

/**
 * Adaptador de entrada (driving adapter) del modulo Identity.
 *
 * <p>Resuelve un Riot ID con formato {@code NombreInvocador#TAG} contra la
 * Account-V1 de Riot y devuelve los datos del invocador. Implementa el contrato
 * {@link IdentityApi} generado desde OpenAPI, de modo que el contrato de la API
 * queda separado de la implementacion.
 *
 * <p>Actua a la vez como cliente de un servicio externo: usa {@link RestClient}
 * para llamar a Riot y traduce los errores HTTP de Riot (401/403/404/429) a
 * respuestas propias. Para los usuarios de prueba (AN00, DEMO, MOCK) cortocircuita
 * la llamada y devuelve datos simulados, permitiendo demos sin internet ni clave valida.
 */
@RestController
@CrossOrigin(origins = "*")
public class IdentityWebAdapter implements IdentityApi {

    private final RiotApiConfig riotApiConfig;
    private final RestClient restClient;

    public IdentityWebAdapter(RiotApiConfig riotApiConfig) {
        this.riotApiConfig = riotApiConfig;
        this.restClient = RestClient.create();
    }

    @Override
    public ResponseEntity<Object> getSummonerByRiotIdQuery(String riotId) {
        return resolveSummonerByRiotId(riotId);
    }

    @Override
    public ResponseEntity<Object> getSummonerByRiotId(String riotId) {
        return resolveSummonerByRiotId(riotId);
    }

    private ResponseEntity<Object> resolveSummonerByRiotId(String riotId) {
        try {
            String decoded = URLDecoder.decode(riotId, StandardCharsets.UTF_8);
            int lastDash = decoded.lastIndexOf("-");
            if (lastDash == -1) {
                return errorResponse(HttpStatus.BAD_REQUEST, "Formato invalido. Usa NombreInvocador#TAG");
            }

            String gameName = decoded.substring(0, lastDash);
            String tagLine = decoded.substring(lastDash + 1);

            // Usuario de prueba: se salta la llamada a Riot y devuelve datos simulados.
            if (isTestUser(gameName)) {
                return ResponseEntity.ok(buildTestUserResponse(gameName, tagLine));
            }

            String url = riotApiConfig.getAccountUrl()
                + "/accounts/by-riot-id/" + gameName + "/" + tagLine;

            Map<String, Object> riotResponse = restClient.get()
                .uri(url)
                .header("X-Riot-Token", riotApiConfig.getApiKey())
                .retrieve()
                .body(new ParameterizedTypeReference<Map<String, Object>>() {
                });

            if (riotResponse == null || riotResponse.isEmpty()) {
                return errorResponse(HttpStatus.NOT_FOUND, "Invocador no encontrado");
            }

            Map<String, Object> result = new HashMap<>(riotResponse);
            result.put("region", "EUW");
            result.put("summonerLevel", 100);
            result.put("profileIconId", 4567);

            return ResponseEntity.ok(result);
        } catch (RestClientResponseException exception) {
            int statusCode = exception.getStatusCode().value();
            if (statusCode == 404) {
                return errorResponse(HttpStatus.NOT_FOUND, "Invocador no encontrado");
            }
            if (statusCode == 401 || statusCode == 403) {
                return errorResponse(HttpStatus.BAD_GATEWAY, "Riot API Key invalida o caducada");
            }
            if (statusCode == 429) {
                return errorResponse(HttpStatus.TOO_MANY_REQUESTS, "Riot API rate limit excedido");
            }
            return errorResponse(HttpStatus.BAD_GATEWAY, "Error al consultar Riot API");
        } catch (Exception exception) {
            return errorResponse(HttpStatus.INTERNAL_SERVER_ERROR, "Error interno en Identity");
        }
    }

    private ResponseEntity<Object> errorResponse(HttpStatus status, String message) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("error", message);
        return ResponseEntity.status(status).body(payload);
    }

    /**
     * Indica si el invocador es uno de los usuarios de prueba (AN00, DEMO, MOCK)
     * que evitan llamar a la Riot API. El gameName ya viene sin separador porque
     * resolveSummonerByRiotId hace el split antes.
     */
    private boolean isTestUser(String gameName) {
        if (gameName == null) return false;
        // Defensivo: también stripeamos '#' por si llegara aquí pegado
        String upper = gameName.split("[-#]")[0].trim().toUpperCase();
        return "AN00".equals(upper) || "DEMO".equals(upper) || "MOCK".equals(upper);
    }

    private Map<String, Object> buildTestUserResponse(String gameName, String tagLine) {
        Map<String, Object> result = new HashMap<>();
        result.put("puuid", "AN00-TEST-PUUID-DO-NOT-CALL-RIOT-API");
        result.put("gameName", gameName);
        result.put("tagLine", tagLine != null && !tagLine.isBlank() ? tagLine : "EUW");
        result.put("region", "EUW");
        result.put("summonerLevel", 247);
        result.put("profileIconId", 4567);
        result.put("isTestUser", true);
        return result;
    }
}
