package com.novarift.analytics.infrastructure.config;

import com.novarift.analytics.application.RiotDataIngestionService;
import com.novarift.analytics.domain.port.in.AnalyzeChampionMetricsUseCase;
import com.novarift.analytics.domain.port.out.RiotDataRepositoryPort;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.Scheduled;

/**
 * Configuración de la capa de Analytics y Pipeline Big Data.
 * Este Bean de Arquitectura Hexagonal inyecta el Port de Infra en la Aplicación
 * y gestiona el Cronjob.
 */
@Configuration
public class RiotAnalyticsConfig {

    private static final Logger log = LoggerFactory.getLogger(RiotAnalyticsConfig.class);

    private final AnalyzeChampionMetricsUseCase useCase;

    public RiotAnalyticsConfig(RiotDataRepositoryPort riotDataRepository) {
        this.useCase = new RiotDataIngestionService(riotDataRepository);
    }

    @Bean
    public AnalyzeChampionMetricsUseCase analyzeChampionMetricsUseCase() {
        return useCase;
    }

    /**
     * CRONJOB MASIVO:
     * Para que no explote el Limitador de Riot ni agote nuestra DB.
     * En este ejemplo: Ejecuta el Pipeline todos los lunes a las 06:00 AM tras
     * el supuesto reseteo de datos de Riot.
     *
     * 0 0 6 * * MON = Cron Expression.
     */
    @Scheduled(cron = "0 0 6 * * MON")
    public void scheduleGlobalAnalyticsRun() {
        log.info("CronJob iniciado: Activando Pipeline de Datos Empíricos a Match-V5");
        // Llama al caso de uso de calibración mensual o semanal.
        useCase.runGlobalAnalyticsPipeline();
    }
}