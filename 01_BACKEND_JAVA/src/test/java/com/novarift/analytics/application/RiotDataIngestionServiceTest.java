package com.novarift.analytics.application;

import com.novarift.analytics.domain.model.ChampionMetrics;
import com.novarift.analytics.domain.port.out.RiotDataRepositoryPort;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RiotDataIngestionServiceTest {

    @Mock
    private RiotDataRepositoryPort riotDataRepository;

    @InjectMocks
    private RiotDataIngestionService service;

    @Test
    void calibrateChampion_shouldInferAndPersist_whenAtLeastOneMatchIsValid() {
        when(riotDataRepository.fetchHighEloMatchIds(anyInt())).thenReturn(List.of("EUW1_1", "EUW1_2"));
        when(riotDataRepository.extractMetricsFromMatch("EUW1_1", 236))
                .thenReturn(new ChampionMetrics(236, "Lucian", null, false, false, 20000.0, 70.0));
        when(riotDataRepository.extractMetricsFromMatch("EUW1_2", 236))
                .thenReturn(new ChampionMetrics(236, "Lucian", null, false, false, 18000.0, 55.0));

        service.calibrateChampion(236);

        ArgumentCaptor<ChampionMetrics> captor = ArgumentCaptor.forClass(ChampionMetrics.class);
        verify(riotDataRepository, times(1)).saveInferredMetrics(captor.capture());

        ChampionMetrics persisted = captor.getValue();
        assertEquals(236, persisted.championId());
        assertTrue(persisted.isLateGameHypercarry());
        assertTrue(persisted.isEarlyGameAggressor());
        assertEquals(19000.0, persisted.averageBurstDamage());
        assertEquals(62.5, persisted.averageControlScore());
    }

    @Test
    void calibrateChampion_shouldSkipBrokenMatches_andPersistWithValidOnes() {
        when(riotDataRepository.fetchHighEloMatchIds(anyInt())).thenReturn(List.of("EUW1_1", "EUW1_2"));
        when(riotDataRepository.extractMetricsFromMatch("EUW1_1", 64))
                .thenThrow(new RuntimeException("Riot timeout"));
        when(riotDataRepository.extractMetricsFromMatch("EUW1_2", 64))
                .thenReturn(new ChampionMetrics(64, "LeeSin", null, false, false, 12000.0, 30.0));

        service.calibrateChampion(64);

        ArgumentCaptor<ChampionMetrics> captor = ArgumentCaptor.forClass(ChampionMetrics.class);
        verify(riotDataRepository).saveInferredMetrics(captor.capture());

        ChampionMetrics persisted = captor.getValue();
        assertFalse(persisted.isLateGameHypercarry());
        assertFalse(persisted.isEarlyGameAggressor());
        assertEquals(12000.0, persisted.averageBurstDamage());
        assertEquals(30.0, persisted.averageControlScore());
    }

    @Test
    void calibrateChampion_shouldNotPersist_whenAllMatchesFail() {
        when(riotDataRepository.fetchHighEloMatchIds(anyInt())).thenReturn(List.of("EUW1_1", "EUW1_2"));
        when(riotDataRepository.extractMetricsFromMatch("EUW1_1", 412))
                .thenThrow(new RuntimeException("Riot unavailable"));
        when(riotDataRepository.extractMetricsFromMatch("EUW1_2", 412))
                .thenThrow(new RuntimeException("Riot unavailable"));

        service.calibrateChampion(412);

        verify(riotDataRepository, never()).saveInferredMetrics(org.mockito.ArgumentMatchers.any());
    }
}
