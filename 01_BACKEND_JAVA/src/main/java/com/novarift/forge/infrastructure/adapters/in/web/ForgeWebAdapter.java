package com.novarift.forge.infrastructure.adapters.in.web;

import com.novarift.forge.application.AnalyzeProgressionUseCase;
import com.novarift.forge.application.CompleteForgeUseCase;
import com.novarift.api.EloForgeApi;
import com.novarift.api.dto.CompleteForgeRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

/**
 * Adaptador de entrada (driving adapter) REST del modulo Forge (progresion del jugador).
 *
 * <p>Implementa el contrato {@link EloForgeApi} (generado desde OpenAPI) y delega en dos
 * casos de uso: {@link AnalyzeProgressionUseCase} para consultar el analisis de mejora y
 * {@link CompleteForgeUseCase} para registrar las metricas de una "forja" completada.
 * Su unico trabajo es mapear el request HTTP a las llamadas de aplicacion.
 */
@RestController
@CrossOrigin(origins = "*")
public class ForgeWebAdapter implements EloForgeApi {

    private final AnalyzeProgressionUseCase analyzeProgressionUseCase;
    private final CompleteForgeUseCase completeForgeUseCase;

    public ForgeWebAdapter(AnalyzeProgressionUseCase analyzeProgressionUseCase,
                           CompleteForgeUseCase completeForgeUseCase) {
        this.analyzeProgressionUseCase = analyzeProgressionUseCase;
        this.completeForgeUseCase = completeForgeUseCase;
    }

    @Override
    public ResponseEntity<Object> getForgeAnalytics(String riotId) {
        return ResponseEntity.ok(analyzeProgressionUseCase.execute(riotId));
    }

    @Override
    public ResponseEntity<Object> completeForge(String riotId, CompleteForgeRequest request) {
        Map<String, Object> metrics = new HashMap<>();
        if (request.getCsPerMin() != null) {
            metrics.put("csPerMin", request.getCsPerMin());
        }
        if (request.getVisionScore() != null) {
            metrics.put("visionScore", request.getVisionScore());
        }
        if (request.getKda() != null) {
            metrics.put("kda", request.getKda());
        }
        if (request.getKillParticipation() != null) {
            metrics.put("killParticipation", request.getKillParticipation());
        }
        return ResponseEntity.ok(completeForgeUseCase.execute(riotId, metrics));
    }
}
