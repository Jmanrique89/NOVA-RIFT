package com.novarift.forge.application;

import com.novarift.forge.domain.UserProgress;
import com.novarift.forge.domain.UserProgressRepository;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

public class CompleteForgeUseCaseImpl implements CompleteForgeUseCase {

    private final UserProgressRepository repository;

    public CompleteForgeUseCaseImpl(UserProgressRepository repository) {
        this.repository = repository;
    }

    @Override
    public Map<String, Object> execute(String riotId, Map<String, Object> metrics) {
        var normalizedRiotId = riotId.trim().replace('#', '-');

        var existing = repository.findByRiotId(normalizedRiotId).orElse(null);

        double csPerMin = extractDouble(metrics, "csPerMin", existing != null ? existing.currentCsMin() : 6.0);
        double visionScore = extractDouble(metrics, "visionScore", existing != null ? existing.visionScore() : 15.0);
        double kda = extractDouble(metrics, "kda", existing != null ? existing.kda() : 2.0);
        double killParticipation = extractDouble(metrics, "killParticipation",
                existing != null ? existing.killParticipation() : 45.0);
        int forgesCompleted = (existing != null ? existing.forgesCompleted() : 0) + 1;

        // Calcular target CS dinámico basado en progreso actual
        double targetCsMin = Math.max(csPerMin + 1.0, existing != null ? existing.targetCsMin() : 7.0);

        var updated = new UserProgress(
            existing != null ? existing.id() : null,
            normalizedRiotId,
            csPerMin,
            targetCsMin,
            visionScore,
            forgesCompleted,
            kda,
            killParticipation,
            LocalDateTime.now()
        );

        var saved = repository.save(updated);

        var response = new HashMap<String, Object>();
        response.put("riotId", saved.riotId());
        response.put("forgesCompleted", saved.forgesCompleted());
        response.put("csPerMin", saved.currentCsMin());
        response.put("visionScore", saved.visionScore());
        response.put("kda", saved.kda());
        response.put("killParticipation", saved.killParticipation());
        response.put("lastUpdated", saved.lastUpdated() != null ? saved.lastUpdated().toString() : null);
        response.put("message", "Forja #" + saved.forgesCompleted() + " completada. Progreso actualizado.");
        return response;
    }

    private double extractDouble(Map<String, Object> metrics, String key, Double fallback) {
        if (metrics == null || !metrics.containsKey(key)) {
            return fallback != null ? fallback : 0.0;
        }
        var raw = metrics.get(key);
        if (raw instanceof Number) {
            return ((Number) raw).doubleValue();
        }
        try {
            return Double.parseDouble(String.valueOf(raw));
        } catch (NumberFormatException e) {
            return fallback != null ? fallback : 0.0;
        }
    }
}
