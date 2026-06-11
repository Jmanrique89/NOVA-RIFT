package com.novarift.auth.infrastructure.adapters.in.web;

import com.novarift.auth.application.AdminService;
import com.novarift.auth.infrastructure.adapters.in.web.dto.*;
import com.novarift.shared.config.RiotApiKeyHolder;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * REST adapter para el panel de administración.
 * Todos los endpoints requieren rol ADMIN (verificado via JWT claim).
 */
@RestController
@RequestMapping("/api/v1/admin")
@CrossOrigin(origins = "*")
public class AdminController {

    private final AdminService adminService;
    private final RiotApiKeyHolder riotApiKeyHolder;

    @Value("${app.riot.mode:MOCK}")
    private String riotMode;

    /** Endpoint usado para validar la clave contra Riot (status público). */
    private static final String RIOT_STATUS_URL =
            "https://euw1.api.riotgames.com/lol/status/v4/platform-data";

    public AdminController(AdminService adminService, RiotApiKeyHolder riotApiKeyHolder) {
        this.adminService = adminService;
        this.riotApiKeyHolder = riotApiKeyHolder;
    }

    @GetMapping("/users")
    public ResponseEntity<List<AdminUserDTO>> listUsers(@RequestHeader("Authorization") String auth) {
        adminService.requireAdmin(stripBearer(auth));
        return ResponseEntity.ok(adminService.listUsers());
    }

    @DeleteMapping("/users/{id}")
    public ResponseEntity<Void> deleteUser(
            @RequestHeader("Authorization") String auth,
            @PathVariable Long id) {
        adminService.requireAdmin(stripBearer(auth));
        adminService.deleteUser(id);
        return ResponseEntity.noContent().build();
    }

    @PatchMapping("/users/{id}/ban")
    public ResponseEntity<AdminUserDTO> toggleBan(
            @RequestHeader("Authorization") String auth,
            @PathVariable Long id) {
        adminService.requireAdmin(stripBearer(auth));
        return ResponseEntity.ok(adminService.toggleBan(id));
    }

    @PatchMapping("/users/{id}/role")
    public ResponseEntity<AdminUserDTO> changeRole(
            @RequestHeader("Authorization") String auth,
            @PathVariable Long id,
            @RequestBody RoleChangeRequest req) {
        adminService.requireAdmin(stripBearer(auth));
        return ResponseEntity.ok(adminService.changeRole(id, req.role()));
    }

    @GetMapping("/stats")
    public ResponseEntity<AdminStatsDTO> getStats(@RequestHeader("Authorization") String auth) {
        adminService.requireAdmin(stripBearer(auth));
        return ResponseEntity.ok(adminService.getStats());
    }

    // ─── Configuración Riot API ───────────────────────────────────────────────

    /**
     * Actualiza la clave de Riot API en memoria SIN reiniciar el servidor.
     * Body: { "key": "RGAPI-xxxx" }
     */
    @PatchMapping("/config/riot-key")
    public ResponseEntity<Map<String, Object>> updateRiotKey(
            @RequestHeader("Authorization") String auth,
            @RequestBody Map<String, String> body) {
        adminService.requireAdmin(stripBearer(auth));
        String raw = body.get("key");
        // Trim ANTES de validar el formato, para que el valor validado y el
        // persistido por setKey() sean exactamente el mismo (sin espacios sobrantes).
        String trimmed = raw != null ? raw.trim() : "";
        if (!trimmed.startsWith("RGAPI-")) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "Clave inválida. Debe empezar por RGAPI-"));
        }
        riotApiKeyHolder.setKey(trimmed);
        String masked = trimmed.substring(0, 10) + "...";
        return ResponseEntity.ok(Map.of(
                "ok", true,
                "key", masked,
                "valid", riotApiKeyHolder.isValid()
        ));
    }

    /**
     * Devuelve el estado de la clave Riot actual (sin revelarla entera). Incluye
     * {@code "source"} ({@code panel(BD)} o {@code env/properties}) para que el panel
     * muestre de dónde se cargó la clave activa.
     */
    @GetMapping("/config/riot-key")
    public ResponseEntity<Map<String, Object>> getRiotKeyStatus(
            @RequestHeader("Authorization") String auth) {
        adminService.requireAdmin(stripBearer(auth));
        String k = riotApiKeyHolder.getKey();
        String masked = (k != null && k.length() > 12)
                ? k.substring(0, 10) + "..." + k.substring(k.length() - 6)
                : "??";
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("valid",  riotApiKeyHolder.isValid());
        body.put("key",    masked);
        body.put("source", riotApiKeyHolder.getSource());
        body.put("mode",   riotMode);
        return ResponseEntity.ok(body);
    }

    /**
     * Valida la clave actual <b>contra Riot real</b> (HTTP GET a
     * {@code /lol/status/v4/platform-data} con timeout de 5s).
     *
     * <ul>
     * <li>200 → {@code { valid:true, httpStatus:200 }}</li>
     * <li>401/403 → {@code { valid:false, httpStatus:401|403,
     * error:"Clave caducada o inválida" }}</li>
     * <li>red caída/IO → {@code { valid:false, httpStatus:0,
     * error:"Riot no accesible: <msg>" }}</li>
     * </ul>
     *
     * <p>Si {@code app.riot.mode=MOCK} no llama a Riot y responde
     * {@code { valid:true, mode:"MOCK", note:"Modo MOCK: la clave no se usa" }}.
     */
    @PostMapping("/config/riot-key/test")
    public ResponseEntity<Map<String, Object>> testRiotKey(
            @RequestHeader("Authorization") String auth) {
        adminService.requireAdmin(stripBearer(auth));

        if ("MOCK".equalsIgnoreCase(riotMode)) {
            Map<String, Object> body = new LinkedHashMap<>();
            body.put("valid", true);
            body.put("mode",  "MOCK");
            body.put("note",  "Modo MOCK: la clave no se usa");
            body.put("source", riotApiKeyHolder.getSource());
            return ResponseEntity.ok(body);
        }

        String key = riotApiKeyHolder.getKey();
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("source", riotApiKeyHolder.getSource());

        // Si la clave es vacía o sigue siendo el placeholder, NO llamar a Riot
        // (devolvería 401 sin pista del motivo real). Así el admin sabe que el
        // fallo es local: no hay clave configurada.
        if (key == null || key.isBlank() || key.contains("PLACEHOLDER")) {
            body.put("valid", false);
            body.put("httpStatus", 0);
            body.put("error", "Sin clave configurada — introduce una clave RGAPI- válida en este panel.");
            return ResponseEntity.ok(body);
        }

        try {
            RestClient client = RestClient.builder().build();
            ResponseEntity<Void> resp = client.get()
                    .uri(RIOT_STATUS_URL)
                    .header("X-Riot-Token", key)
                    .retrieve()
                    .toBodilessEntity();
            int status = resp.getStatusCode().value();
            body.put("valid", true);
            body.put("httpStatus", status);
            return ResponseEntity.ok(body);
        } catch (RestClientResponseException ex) {
            int status = ex.getStatusCode().value();
            body.put("valid", false);
            body.put("httpStatus", status);
            if (status == 401 || status == 403) {
                body.put("error", "Clave caducada o inválida");
            } else if (status == 429) {
                body.put("error", "Riot rate limit excedido");
            } else {
                body.put("error", "Riot devolvió HTTP " + status);
            }
            return ResponseEntity.ok(body);
        } catch (Exception ex) {
            // IO / DNS / timeout — el panel ve httpStatus=0 + error legible.
            body.put("valid", false);
            body.put("httpStatus", 0);
            body.put("error", "Riot no accesible: " + ex.getMessage());
            return ResponseEntity.ok(body);
        }
    }

    private String stripBearer(String header) {
        if (header == null) return "";
        return header.replaceFirst("(?i)^Bearer\\s+", "").trim();
    }
}
