package com.novarift.coaching.infrastructure.adapters.in.web;

import com.novarift.coaching.application.services.CoachingTemplateService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Adaptador de entrada (driving adapter) REST del modulo de coaching.
 *
 * <p>Expone {@link CoachingTemplateService} via HTTP: traduce los parametros de la
 * query en una clave de coaching y devuelve el mensaje resuelto. No tiene logica de
 * negocio propia mas alla de normalizar los parametros a mayusculas y ensamblar el JSON.
 *
 * <p><b>Endpoint:</b><br>
 * {@code GET /api/v1/coaching/message?role=ADC&playStyle=AGGRESSIVE&faction=NOXUS&context=MID_GAME}
 *
 * <p><b>Respuesta:</b><br>
 * {@code { "message": "...", "role": "ADC", "playStyle": "AGGRESSIVE", "faction": "NOXUS", "context": "MID_GAME", "templates": 32 }}
 *
 * <p><b>Valores válidos:</b>
 * <ul>
 * <li>role — TOP · JUNGLE · MID · ADC · SUPPORT · ANY (default)</li>
 * <li>playStyle — AGGRESSIVE · DEFENSIVE · ANY (default)</li>
 * <li>faction — NOXUS · DEMACIA · ANY (default) · ZAUN/IONIA caen a ANY</li>
 * <li>context — EARLY_GAME · MID_GAME (default) · LATE_GAME · LATE_GAME_35 · COMEBACK</li>
 * </ul>
 *
 * <p>El servicio aplica una cascada de fallback (exacto → faction=ANY →
 * global) y nunca devuelve null ni 500 — esto permite al frontend tratar el
 * endpoint como "best effort" sin manejar excepciones de servidor.
 */
@RestController
@CrossOrigin(origins = "*")
@RequestMapping("/api/v1/coaching")
public class CoachingWebAdapter {

    private final CoachingTemplateService coachingTemplateService;

    public CoachingWebAdapter(CoachingTemplateService coachingTemplateService) {
        this.coachingTemplateService = coachingTemplateService;
    }

    /**
     * Devuelve el mensaje de coaching más adecuado para la situación dada.
     * Todos los parámetros son opcionales — el servicio aplica fallback si
     * faltan o son nulos. Los valores se normalizan a mayúsculas antes de
     * pasar al servicio.
     */
    @GetMapping("/message")
    public ResponseEntity<Map<String, Object>> getCoachingMessage(
            @RequestParam(defaultValue = "ANY")      String role,
            @RequestParam(defaultValue = "ANY")      String playStyle,
            @RequestParam(defaultValue = "ANY")      String faction,
            @RequestParam(defaultValue = "MID_GAME") String context
    ) {
        final String roleUp      = role.toUpperCase();
        final String playStyleUp = playStyle.toUpperCase();
        final String factionUp   = faction.toUpperCase();
        final String contextUp   = context.toUpperCase();

        final String message = coachingTemplateService.getCoachingMessage(
                roleUp, playStyleUp, factionUp, contextUp
        );

        // LinkedHashMap para preservar orden de claves en la respuesta JSON.
        final Map<String, Object> body = new LinkedHashMap<>();
        body.put("message",   message);
        body.put("role",      roleUp);
        body.put("playStyle", playStyleUp);
        body.put("faction",   factionUp);
        body.put("context",   contextUp);
        body.put("templates", coachingTemplateService.getTemplateCount());

        return ResponseEntity.ok(body);
    }
}
