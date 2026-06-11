package com.novarift.live.infrastructure.adapters.out.persistence;

import com.novarift.live.domain.LiveSession;
import com.novarift.live.domain.LiveSessionRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Repository;

@Repository
public class LiveSessionRepositoryAdapter implements LiveSessionRepository {

    private static final Logger log = LoggerFactory.getLogger(LiveSessionRepositoryAdapter.class);

    private final SpringDataLiveSessionRepository springDataRepo;

    public LiveSessionRepositoryAdapter(SpringDataLiveSessionRepository springDataRepo) {
        this.springDataRepo = springDataRepo;
    }

    @Override
    public LiveSession save(LiveSession session) {
        try {
            LiveSessionJpaEntity entity = toInfra(session);
            LiveSessionJpaEntity savedEntity = springDataRepo.save(entity);
            return fromInfra(savedEntity);
        } catch (RuntimeException ex) {
            // Fallback defensivo para demo: si la persistencia no está disponible, no bloquea el flujo Live.
            log.error("No se pudo persistir la sesión Live. Se devuelve respuesta sin persistencia para mantener continuidad de demo.", ex);
            return new LiveSession(
                session.id() != null ? session.id() : -1L,
                session.summonerName(),
                session.enemyDraftPattern(),
                session.recommendedFirstBuy(),
                session.status(),
                session.startedAt(),
                session.recommendationVersion(),
                session.recommendationScore(),
                session.recommendationBreakdown(),
                session.recommendationConfidence()
            );
        }
    }

    private LiveSessionJpaEntity toInfra(LiveSession session) {
        LiveSessionJpaEntity entity = new LiveSessionJpaEntity();
        entity.setId(session.id());
        entity.setSummonerId(session.summonerName());
        entity.setEnemyDraft(session.enemyDraftPattern());
        entity.setRecommendedBuild(session.recommendedFirstBuy());
        entity.setStatus(session.status());
        entity.setStartedAt(session.startedAt());
        entity.setRecommendationVersion(session.recommendationVersion());
        entity.setRecommendationScore(session.recommendationScore());
        entity.setRecommendationBreakdown(session.recommendationBreakdown());
        entity.setRecommendationConfidence(session.recommendationConfidence());
        return entity;
    }

    private LiveSession fromInfra(LiveSessionJpaEntity entity) {
        return new LiveSession(
            entity.getId(),
            entity.getSummonerId(),
            entity.getEnemyDraft(),
            entity.getRecommendedBuild(),
            entity.getStatus(),
            entity.getStartedAt(),
            entity.getRecommendationVersion(),
            entity.getRecommendationScore(),
            entity.getRecommendationBreakdown(),
            entity.getRecommendationConfidence()
        );
    }
}
