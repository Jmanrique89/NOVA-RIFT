package com.novarift.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Adaptador de entrada (driving adapter) REST de health-check.
 *
 * <p>Endpoint publico y ligero para que el frontend confirme que el backend esta vivo
 * antes de lanzar la peticion pesada al radar. No tiene logica de negocio: devuelve estado,
 * modo Riot activo (MOCK/REAL), version y timestamp.
 *
 * <pre>
 * GET /api/health → 200 OK
 * { "status": "UP", "mode": "MOCK" | "REAL", "version": "v2", "timestamp": "..." }
 * </pre>
 *
 * <p>Si el frontend recibe 200, procede con la llamada al motor; si recibe error o timeout,
 * cae al modo demo offline (que funciona en el lado del cliente).
 */
@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "*") // redundante (CorsConfig ya cubre /**) pero explícito
public class HealthController {

    @Value("${app.riot.mode:MOCK}")
    private String riotMode;

    @GetMapping("/health")
    public ResponseEntity<Map<String, Object>> health() {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("status", "UP");
        body.put("mode", riotMode);
        body.put("version", "v2");
        body.put("timestamp", Instant.now().toString());
        return ResponseEntity.ok(body);
    }
}
