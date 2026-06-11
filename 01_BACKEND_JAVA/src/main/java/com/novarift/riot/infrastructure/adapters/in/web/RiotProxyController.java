package com.novarift.riot.infrastructure.adapters.in.web;

import com.novarift.riot.domain.exception.RiotApiException;
import com.novarift.riot.domain.model.SummonerSummary;
import com.novarift.riot.domain.port.in.GetSummonerSummaryUseCase;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * RiotProxyController — endpoint REST para el frontend.
 *
 * <p>Expone {@link com.novarift.riot.domain.port.in.GetSummonerSummaryUseCase}
 * con un único endpoint:
 *
 * <pre>{@code
 * GET /api/v1/riot/summoner-summary?riotId=Faker%23KR1&region=kr&allowMock=true
 * }</pre>
 *
 * <p>Por defecto {@code allowMock=true} → si la key falla el cliente recibe
 * 200 con un {@link SummonerSummary} mock para que el frontend no muestre
 * pantallas vacías. {@code allowMock=false} hace que el controller propague
 * el código de estado correcto (401/429/502).
 *
 * <p>Validación: el parámetro {@code riotId} debe contener "#"; si no, 400.
 * El {@code region} es libre — el adapter normaliza a {@code euw1} si vacío.
 */
@RestController
@CrossOrigin(origins = "*")
@RequestMapping("/api/v1/riot")
public class RiotProxyController {

    private static final Logger log = LoggerFactory.getLogger(RiotProxyController.class);

    private final GetSummonerSummaryUseCase useCase;

    public RiotProxyController(GetSummonerSummaryUseCase useCase) {
        this.useCase = useCase;
    }

    @GetMapping("/summoner-summary")
    public ResponseEntity<?> getSummonerSummary(
            @RequestParam String riotId,
            @RequestParam(defaultValue = "euw1") String region,
            @RequestParam(defaultValue = "true") boolean allowMock
    ) {
        if (riotId == null || !riotId.contains("#")) {
            return ResponseEntity.badRequest().body(Map.of(
                    "error", "INVALID_RIOT_ID",
                    "message", "Esperado 'GameName#TAG'."
            ));
        }
        log.info("Riot proxy → {} (region={}, allowMock={})", riotId, region, allowMock);
        SummonerSummary summary = useCase.getSummonerSummary(riotId, region, allowMock);
        return ResponseEntity.ok(summary);
    }

    /**
     * Maneja excepciones de dominio y mapea a códigos HTTP correctos.
     *
     * <ul>
     * <li>NOT_FOUND → 404</li>
     * <li>RATE_LIMITED → 429</li>
     * <li>UNAUTHORIZED → 401</li>
     * <li>NO_API_KEY → 503 (server misconfigurado)</li>
     * <li>UPSTREAM_ERROR → 502</li>
     * </ul>
     */
    @ExceptionHandler(RiotApiException.class)
    public ResponseEntity<Map<String, Object>> handleRiotApiException(RiotApiException ex) {
        HttpStatus status = switch (ex.reason()) {
            case NOT_FOUND     -> HttpStatus.NOT_FOUND;
            case RATE_LIMITED  -> HttpStatus.TOO_MANY_REQUESTS;
            case UNAUTHORIZED  -> HttpStatus.UNAUTHORIZED;
            case NO_API_KEY    -> HttpStatus.SERVICE_UNAVAILABLE;
            case UPSTREAM_ERROR -> HttpStatus.BAD_GATEWAY;
        };
        return ResponseEntity.status(status).body(Map.of(
                "error",   ex.reason().name(),
                "message", ex.getMessage()
        ));
    }
}
