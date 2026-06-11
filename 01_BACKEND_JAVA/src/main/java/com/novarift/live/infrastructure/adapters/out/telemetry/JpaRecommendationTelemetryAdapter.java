package com.novarift.live.infrastructure.adapters.out.telemetry;

import com.novarift.live.domain.recommendation.RecommendationEvent;
import com.novarift.live.domain.recommendation.RecommendationTelemetryPort;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Adapter de persistencia para telemetría.
 * Usa @Async para evitar bloquear la respuesta principal al usuario.
 */
@Component
public class JpaRecommendationTelemetryAdapter implements RecommendationTelemetryPort {

    private static final Logger log = LoggerFactory.getLogger(JpaRecommendationTelemetryAdapter.class);

    private final SpringDataRecommendationEventRepository repository;

    public JpaRecommendationTelemetryAdapter(SpringDataRecommendationEventRepository repository) {
        this.repository = repository;
    }

    @Override
    @Async
    @Transactional
    public void recordRecommendation(RecommendationEvent event) {
        try {
            RecommendationEventJpaEntity entity = new RecommendationEventJpaEntity();
            entity.setEventId(event.eventId());
            entity.setSessionId(event.sessionId());
            entity.setPolicyVersion(event.policyVersion());
            entity.setContextSnapshotJson(event.contextSnapshotJson());
            entity.setRecommendedItemsJson(event.recommendedItemsJson());
            entity.setScoreBreakdownJson(event.scoreBreakdownJson());
            entity.setConfidence(event.confidence());
            entity.setCreatedAt(event.createdAt());

            repository.save(entity);
            log.debug("Recommendation telemetry recorded for session {}", event.sessionId());
        } catch (Exception e) {
            // Log & swallow: la telemetría no debe romper el flujo de la aplicación
            log.error("Failed to record recommendation telemetry for session {}: {}", event.sessionId(), e.getMessage());
        }
    }
}
