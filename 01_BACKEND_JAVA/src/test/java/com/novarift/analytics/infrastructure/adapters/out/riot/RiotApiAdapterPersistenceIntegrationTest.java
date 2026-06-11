package com.novarift.analytics.infrastructure.adapters.out.riot;

import com.novarift.analytics.domain.model.ChampionMetrics;
import com.novarift.analytics.infrastructure.adapters.out.persistence.ChampionAnalyticsEntity;
import com.novarift.analytics.infrastructure.adapters.out.persistence.ChampionAnalyticsJpaRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

@SpringBootTest
@ActiveProfiles("test")
class RiotApiAdapterPersistenceIntegrationTest {

    @Autowired
    private RiotApiAdapter riotApiAdapter;

    @Autowired
    private ChampionAnalyticsJpaRepository championAnalyticsJpaRepository;

    @BeforeEach
    void cleanDatabase() {
        championAnalyticsJpaRepository.deleteAll();
    }

    @Test
    void saveInferredMetrics_shouldPersistChampionAnalyticsEntity() {
        ChampionMetrics metrics = new ChampionMetrics(
                516,
                "Ornn",
                null,
                true,
                false,
                17350.5,
                44.2
        );

        riotApiAdapter.saveInferredMetrics(metrics);

        Optional<ChampionAnalyticsEntity> saved = championAnalyticsJpaRepository.findById(516);
        assertTrue(saved.isPresent());
        assertEquals("Ornn", saved.get().getName());
        assertTrue(saved.get().isLateGameHypercarry());
        assertEquals(17350.5, saved.get().getBurstDamageScore());
        assertEquals(44.2, saved.get().getControlScore());
    }
}
