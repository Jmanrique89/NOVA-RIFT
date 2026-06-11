package com.novarift.live.infrastructure.config;

import com.novarift.live.application.StartLiveSessionUseCase;
import com.novarift.live.application.StartLiveSessionUseCaseImpl;
import com.novarift.live.application.recommendation.ComputeLiveRecommendationUseCase;
import com.novarift.live.application.recommendation.ComputeLiveRecommendationUseCaseImpl;
import com.novarift.live.domain.LiveSessionRepository;
import com.novarift.live.domain.RiotMatchPort;
import com.novarift.live.domain.recommendation.KnowledgeBasePort;
import com.novarift.live.domain.recommendation.MatchupStatsPort;
import com.novarift.live.domain.recommendation.RecommendationScoringEngine;
import com.novarift.live.domain.recommendation.RecommendationTelemetryPort;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class LiveConfig {

    @Bean
    public RecommendationScoringEngine recommendationScoringEngine() {
        return new RecommendationScoringEngine();
    }

    @Bean
    public ComputeLiveRecommendationUseCase computeLiveRecommendationUseCase(
            KnowledgeBasePort knowledgeBase,
            MatchupStatsPort matchupStats,
            RecommendationTelemetryPort telemetry,
            RecommendationScoringEngine scoringEngine) {
        return new ComputeLiveRecommendationUseCaseImpl(knowledgeBase, matchupStats, telemetry, scoringEngine);
    }

    @Bean
    public StartLiveSessionUseCase startLiveSessionUseCase(
            LiveSessionRepository repository,
            RiotMatchPort riotMatchPort,
            ComputeLiveRecommendationUseCase recommendationUseCase) {
        return new StartLiveSessionUseCaseImpl(repository, riotMatchPort, recommendationUseCase);
    }
}
