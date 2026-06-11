package com.novarift.analytics.infrastructure.adapters.out.persistence;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

/**
 * Spring Data JPA Repository para almacenar la métrica consolidada del campeón.
 */
@Repository
public interface ChampionAnalyticsJpaRepository extends JpaRepository<ChampionAnalyticsEntity, Integer> {
}