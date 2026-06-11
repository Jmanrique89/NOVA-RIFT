package com.novarift.live.application.recommendation;

import com.novarift.live.domain.knowledge.ItemCounter;
import com.novarift.live.domain.knowledge.MatchupStat;
import com.novarift.live.domain.knowledge.ThreatRule;
import com.novarift.live.domain.recommendation.*;

import java.util.List;

/**
 * Implementacion del caso de uso de recomendacion live (capa application).
 *
 * <p>Es el orquestador: coordina los puertos de salida y el motor de dominio, pero
 * no contiene reglas de negocio propias (esas viven en {@link RecommendationScoringEngine}).
 * Solo depende de puertos ({@link KnowledgeBasePort}, {@link MatchupStatsPort},
 * {@link RecommendationTelemetryPort}), nunca de adaptadores concretos ni de Riot.
 *
 * <p>Flujo: base de conocimiento → evaluacion de amenaza → busqueda de items counter
 * → estadisticas de matchup → scoring → registro de telemetria. La telemetria se
 * captura en try/catch porque nunca debe bloquear ni romper el flujo principal.
 */
public class ComputeLiveRecommendationUseCaseImpl implements ComputeLiveRecommendationUseCase {

    private final KnowledgeBasePort knowledgeBase;
    private final MatchupStatsPort matchupStats;
    private final RecommendationTelemetryPort telemetry;
    private final RecommendationScoringEngine scoringEngine;

    public ComputeLiveRecommendationUseCaseImpl(
            KnowledgeBasePort knowledgeBase,
            MatchupStatsPort matchupStats,
            RecommendationTelemetryPort telemetry,
            RecommendationScoringEngine scoringEngine) {
        this.knowledgeBase = knowledgeBase;
        this.matchupStats = matchupStats;
        this.telemetry = telemetry;
        this.scoringEngine = scoringEngine;
    }

    @Override
    public RecommendationResult compute(MatchupContext context) {
        // 1. Obtener reglas activas de la KB
        List<ThreatRule> activeRules = knowledgeBase.findActiveRules(
            context.patchVersion(), "LANE");

        // 2. Evaluar amenaza del equipo enemigo
        ThreatAssessment threat = scoringEngine.assessThreat(
            context.enemyChampionIds(),
            activeRules,
            knowledgeBase,
            context.patchVersion()
        );

        // 3. Obtener items counter candidatos
        String ccProfile = threat.ccTags().size() >= 3 ? "HIGH_CC" : "LOW_CC";
        List<ItemCounter> candidates = knowledgeBase.findCountersForProfile(
            threat.damageProfile(), ccProfile, context.patchVersion());

        // 4. Obtener estadísticas de matchup
        List<MatchupStat> stats = matchupStats.findAllVersus(
            context.ownChampionId(), context.patchVersion());

        // 5. Ejecutar scoring
        RecommendationResult result = scoringEngine.computeRecommendation(
            context, threat, candidates, stats);

        // 6. Registrar telemetría (no-blocking)
        try {
            String contextJson = "{\"ownChampion\":" + context.ownChampionId()
                + ",\"enemies\":" + context.enemyChampionIds()
                + ",\"lane\":\"" + context.lane()
                + "\",\"patch\":\"" + context.patchVersion() + "\"}";

            RecommendationEvent event = RecommendationEvent.from(null, result, contextJson);
            telemetry.recordRecommendation(event);
        } catch (Exception e) {
            // Telemetría nunca bloquea el flujo principal
            System.err.println("Warning: telemetry recording failed: " + e.getMessage());
        }

        return result;
    }
}
