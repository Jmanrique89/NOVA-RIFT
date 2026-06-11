package com.novarift.live.infrastructure.adapters.out.telemetry;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface SpringDataRecommendationEventRepository extends JpaRepository<RecommendationEventJpaEntity, String> {
}
