package com.novarift.live.recommendation;

import com.novarift.live.application.recommendation.ComputeLiveRecommendationUseCaseImpl;
import com.novarift.live.domain.knowledge.*;
import com.novarift.live.domain.recommendation.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class ComputeLiveRecommendationUseCaseTest {

    private KnowledgeBasePort knowledgeBase;
    private MatchupStatsPort matchupStats;
    private RecommendationTelemetryPort telemetry;
    private RecommendationScoringEngine scoringEngine;
    private ComputeLiveRecommendationUseCaseImpl useCase;

    @BeforeEach
    void setUp() {
        knowledgeBase = mock(KnowledgeBasePort.class);
        matchupStats = mock(MatchupStatsPort.class);
        telemetry = mock(RecommendationTelemetryPort.class);
        scoringEngine = new RecommendationScoringEngine();

        useCase = new ComputeLiveRecommendationUseCaseImpl(knowledgeBase, matchupStats, telemetry, scoringEngine);
    }

    @Test
    void testComputeOrchestratesCorrectly() {
        MatchupContext context = new MatchupContext(1, List.of(2), "MID", "14.24", "CLASSIC");

        // Mock dependencies
        when(knowledgeBase.findActiveRules("14.24", "LANE")).thenReturn(List.of());
        when(knowledgeBase.findCountersForProfile("MIXED", "LOW_CC", "14.24")).thenReturn(List.of());
        when(matchupStats.findAllVersus(1, "14.24")).thenReturn(List.of());

        // Execute
        RecommendationResult result = useCase.compute(context);

        // Assert
        assertNotNull(result);
        assertEquals("v1.0.0-phase1", result.policyVersion());
        verify(knowledgeBase).findActiveRules("14.24", "LANE");
        verify(knowledgeBase).findCountersForProfile("MIXED", "LOW_CC", "14.24");
        verify(matchupStats).findAllVersus(1, "14.24");

        // Verify telemetry was recorded asynchronously
        ArgumentCaptor<RecommendationEvent> eventCaptor = ArgumentCaptor.forClass(RecommendationEvent.class);
        verify(telemetry).recordRecommendation(eventCaptor.capture());
        RecommendationEvent event = eventCaptor.getValue();
        assertEquals("v1.0.0-phase1", event.policyVersion());
    }

    @Test
    void testTelemetryExceptionDoesNotBlockExecution() {
        MatchupContext context = new MatchupContext(1, List.of(2), "MID", "14.24", "CLASSIC");

        // Throw exception when recording telemetry
        doThrow(new RuntimeException("DB Error")).when(telemetry).recordRecommendation(any());

        // Should not throw exception
        RecommendationResult result = useCase.compute(context);
        
        assertNotNull(result);
    }
}
