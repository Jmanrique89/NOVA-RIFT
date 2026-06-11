package com.novarift.live.recommendation;

import com.novarift.live.domain.knowledge.*;
import com.novarift.live.domain.recommendation.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class RecommendationScoringEngineTest {

    private RecommendationScoringEngine engine;
    private KnowledgeBasePort kbMock;

    @BeforeEach
    void setUp() {
        engine = new RecommendationScoringEngine();
        kbMock = mock(KnowledgeBasePort.class);
    }

    @Test
    void testAssessThreat_HeavyAdComposition() {
        // Mock KB para devolver perfil AD
        when(kbMock.findChampion(anyInt(), anyString())).thenReturn(
                Optional.of(new ChampionData(1, "Zed", "Zed", List.of("ASSASSIN"), "AD", "14.24")));
        when(kbMock.findAbilities(anyInt(), anyString())).thenReturn(List.of());

        List<ThreatRule> rules = List.of(
                new ThreatRule("R1", "14.24", "LANE", null, null, "HEAVY_AD", 90, List.of("3047"), "ARMOR", "Explicación", 0.9, true)
        );

        // Simulamos 3 campeones enemigos AD para trigger la regla HEAVY_AD
        List<Integer> enemies = List.of(1, 1, 1);

        ThreatAssessment threat = engine.assessThreat(enemies, rules, kbMock, "14.24");

        assertEquals("AD", threat.damageProfile());
        assertEquals(90, threat.threatScore()); // El totalThreat es 90, normalizado (90/1 = 90) por 1 regla triggereada
        assertTrue(threat.triggeredRuleIds().contains("R1"));
    }

    @Test
    void testComputeRecommendation_FallbackOnLowConfidence() {
        ThreatAssessment threat = new ThreatAssessment(50, "MIXED", List.of(), List.of(), List.of());
        MatchupContext context = new MatchupContext(1, List.of(2, 3), "MID", "14.24", "CLASSIC");

        List<ItemCounter> candidates = List.of(
                new ItemCounter("I1", "14.24", "3047", "Plated Steelcaps", "AD", "LOW_CC", 50, "Exp", "EARLY")
        );

        // Sin stats ni reglas triggereadas, la confianza será bajísima
        RecommendationResult result = engine.computeRecommendation(context, threat, candidates, List.of());

        assertEquals(RecommendationScoringEngine.POLICY_VERSION, result.policyVersion());
        // Confianza baja => fallback
        assertEquals(0.25, result.confidence(), 0.01);
        assertEquals("Datos insuficientes para recomendación de alta confianza", result.topFactors().get(0));
    }

    @Test
    void testComputeRecommendation_HighConfidence() {
        ThreatAssessment threat = new ThreatAssessment(80, "AD", List.of("STUN"), List.of(), List.of("R1", "R2"));
        MatchupContext context = new MatchupContext(1, List.of(2), "MID", "14.24", "CLASSIC");

        List<ItemCounter> candidates = List.of(
                new ItemCounter("I1", "14.24", "3157", "Zhonya's Hourglass", "AD", "LOW_CC", 90, "Stasis", "MID"),
                new ItemCounter("I2", "14.24", "3111", "Mercury's Treads", "AP", "HIGH_CC", 60, "Tenacidad", "EARLY")
        );

        List<MatchupStat> stats = List.of(
                new MatchupStat("MS1", "14.24", "MID", 1, 2, 1000, 0.40, -200) // Urgencia alta
        );

        RecommendationResult result = engine.computeRecommendation(context, threat, candidates, stats);

        assertFalse(result.items().isEmpty());
        assertEquals("3157", result.items().get(0).itemId()); // Zhonya debería ganar
        assertTrue(result.confidence() > 0.40); // Alta confianza
        assertEquals("Zhonya's Hourglass", result.items().get(0).itemName());
    }
}
