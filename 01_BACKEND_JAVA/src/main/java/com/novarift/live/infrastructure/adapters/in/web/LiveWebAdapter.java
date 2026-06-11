package com.novarift.live.infrastructure.adapters.in.web;

import com.novarift.live.application.LiveSessionStartResult;
import com.novarift.live.application.StartLiveSessionUseCase;
import com.novarift.live.domain.LiveSession;
import com.novarift.live.domain.recommendation.RecommendationResult;
import com.novarift.live.domain.recommendation.ScoredItem;
import com.novarift.live.infrastructure.adapters.in.web.dto.LiveSessionResponse;
import com.novarift.live.infrastructure.adapters.in.web.dto.ScoredItemDto;
import com.novarift.live.infrastructure.adapters.in.web.dto.ThreatAssessmentDto;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestTemplate;

import com.novarift.api.LiveRiftApi;
import com.novarift.api.dto.StartLiveSessionRequest;

import java.util.*;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.stream.Collectors;

/**
 * Adaptador de entrada (driving adapter) REST del modulo Live.
 *
 * <p>Es la puerta HTTP del radar en partida: implementa el contrato {@link LiveRiftApi}
 * (generado desde OpenAPI) y delega en el caso de uso {@link StartLiveSessionUseCase}.
 * Su unica logica es mapear el resultado de aplicacion a la respuesta REST enriquecida
 * (score total, razones, items puntuados y evaluacion de amenaza).
 *
 * <p>Tambien expone el inventario de items en directo: en modo MOCK avanza una secuencia
 * simulada de compras; en modo REAL hace de proxy al Live Game Client de Riot
 * ({@code https://127.0.0.1:2999}) y devuelve 503 si el cliente no esta disponible.
 * El modo se controla con {@code app.riot.mode}.
 */
@RestController
@CrossOrigin(origins = "*")
public class LiveWebAdapter implements LiveRiftApi {

    private static final Logger log = LoggerFactory.getLogger(LiveWebAdapter.class);

    private static final String LIVE_CLIENT_URL =
            "https://127.0.0.1:2999/liveclientdata/activeplayer/items";

    private final StartLiveSessionUseCase startLiveSessionUseCase;
    private final RestTemplate restTemplate;

    @Value("${app.riot.mode:MOCK}")
    private String riotMode;

    // Almacén en memoria para compras manuales (MOCK mode) — reset on restart
    private final List<Map<String, Object>> mockPurchasedItems = new CopyOnWriteArrayList<>();

    // Secuencia simulada de ítems que se van "comprando" en MOCK (para modo REAL-DEMO)
    private static final List<Map<String, Object>> MOCK_ITEM_SEQUENCE = List.of(
        Map.of("itemId", 3047, "displayName", "Plated Steelcaps", "slot", 1),
        Map.of("itemId", 3026, "displayName", "Guardian Angel",    "slot", 2),
        Map.of("itemId", 3157, "displayName", "Zhonya's Hourglass", "slot", 3)
    );
    private int mockSequenceIndex = 0;

    public LiveWebAdapter(StartLiveSessionUseCase startLiveSessionUseCase) {
        this.startLiveSessionUseCase = startLiveSessionUseCase;
        this.restTemplate = new RestTemplate();
    }

    // ─── POST /api/v1/live/start ───────────────────────────────────────────────
    @Override
    public ResponseEntity<Object> startLiveSession(StartLiveSessionRequest payload) {
        String summoner = payload.getSummonerName() != null ? payload.getSummonerName() : "Unknown";
        String hash    = payload.getImageHash()    != null ? payload.getImageHash()    : "dummy-hash";
        mockPurchasedItems.clear();
        mockSequenceIndex = 0;

        LiveSessionStartResult result = startLiveSessionUseCase.executeEnriched(summoner, hash);
        return ResponseEntity.ok(buildResponse(result));
    }

    // ─── GET /api/v1/live/client/items ────────────────────────────────────────
    /**
     * MOCK mode → avanza automáticamente en la secuencia simulada de ítems.
     * REAL mode → hace proxy a http://127.0.0.1:2999 (Riot Live Game Client).
     */
    @GetMapping("/api/v1/live/client/items")
    public ResponseEntity<Object> getLiveClientItems() {
        if ("REAL".equalsIgnoreCase(riotMode)) {
            return fetchFromRealLiveClient();
        }
        return buildMockInventoryResponse();
    }

    // ─── POST /api/v1/live/purchase ──────────────────────────────────────────
    /**
     * Registra una compra manual de ítem (para modo MOCK o demos sin partida real).
     * Body: { "itemId": 3047, "itemName": "Plated Steelcaps" }
     */
    @PostMapping("/api/v1/live/purchase")
    public ResponseEntity<Object> registerItemPurchase(@RequestBody Map<String, Object> body) {
        final var item = new HashMap<String, Object>();
        item.put("itemId",      body.getOrDefault("itemId",   0));
        item.put("displayName", body.getOrDefault("itemName", "Unknown"));
        item.put("slot",        mockPurchasedItems.size() + 1);
        mockPurchasedItems.add(item);
        log.info("[NOVA RIFT] Ítem registrado manualmente: {}", item.get("displayName"));
        return ResponseEntity.ok(Map.of(
            "registered",      true,
            "totalPurchased",  mockPurchasedItems.size(),
            "item",            item
        ));
    }

    // ─── Helpers privados ─────────────────────────────────────────────────────

    /**
     * Construye la respuesta enriquecida: anade los campos del motor de recomendacion
     * (recommendationTotalScore, recommendationReasons, recommendationItems,
     * threatAssessment) cuando el motor estuvo activo; en caso contrario devuelve solo
     * los datos de la sesion legacy.
     */
    private LiveSessionResponse buildResponse(LiveSessionStartResult startResult) {
        LiveSession s = startResult.session();
        Optional<RecommendationResult> recOpt = startResult.recommendation();

        Double totalScore = s.recommendationScore(); // alias
        List<String> reasons = null;
        List<ScoredItemDto> items = null;
        ThreatAssessmentDto threat = null;

        if (recOpt.isPresent()) {
            RecommendationResult r = recOpt.get();
            // Reasons = topFactors + tradeoff (si existe)
            reasons = new ArrayList<>(r.topFactors());
            if (r.tradeoffPrincipal() != null && !r.tradeoffPrincipal().isBlank()) {
                reasons.add("Trade-off: " + r.tradeoffPrincipal());
            }
            items = r.items().stream()
                .map(ScoredItemDto::new)
                .collect(Collectors.toList());
            threat = new ThreatAssessmentDto(r.threatAssessment());
            // En modo enriquecido, totalScore es el del item top
            if (!r.items().isEmpty()) {
                totalScore = round2(r.items().get(0).scoreTotal());
            }
        }

        return new LiveSessionResponse(
            s.id(),
            s.summonerName(),
            s.enemyDraftPattern(),
            s.recommendedFirstBuy(),
            s.status(),
            s.startedAt(),
            s.recommendationVersion(),
            s.recommendationScore(),
            s.recommendationBreakdown(),
            s.recommendationConfidence(),
            totalScore,
            reasons,
            items,
            threat
        );
    }

    private static Double round2(double v) {
        return Math.round(v * 100.0) / 100.0;
    }

    private ResponseEntity<Object> buildMockInventoryResponse() {
        // Avanza la secuencia MOCK para simular que el jugador va comprando
        if (mockSequenceIndex < MOCK_ITEM_SEQUENCE.size()) {
            mockPurchasedItems.add(new HashMap<>(MOCK_ITEM_SEQUENCE.get(mockSequenceIndex)));
            mockSequenceIndex++;
        }
        return ResponseEntity.ok(Map.of(
            "mode",  "MOCK",
            "items", new ArrayList<>(mockPurchasedItems)
        ));
    }

    private ResponseEntity<Object> fetchFromRealLiveClient() {
        try {
            // El Live Game Client de Riot expone HTTPS en localhost sin cert válido.
            // En producción sería necesario un SSLContext que ignore la verificación
            // del certificado self-signed de Riot. Para el MVP, intentamos y fallback.
            final var items = restTemplate.getForObject(LIVE_CLIENT_URL, Object.class);
            return ResponseEntity.ok(Map.of(
                "mode",  "REAL",
                "items", items != null ? items : List.of()
            ));
        } catch (ResourceAccessException e) {
            log.warn("[NOVA RIFT] Live Client API no disponible: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(Map.of(
                "error", "Live Client API no disponible. Asegúrate de tener el cliente de LoL abierto y estar en partida.",
                "hint",  "Si estás probando sin partida, usa el endpoint MOCK (app.riot.mode=MOCK)"
            ));
        } catch (Exception e) {
            log.error("[NOVA RIFT] Error al conectar con Live Client: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of(
                "error", "Error interno al conectar con el Live Game Client."
            ));
        }
    }
}
