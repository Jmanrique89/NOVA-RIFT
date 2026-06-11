package com.novarift.analytics.application;

import com.novarift.analytics.domain.model.ChampionMetrics;
import com.novarift.analytics.domain.port.in.AnalyzeChampionMetricsUseCase;
import com.novarift.analytics.domain.port.out.RiotDataRepositoryPort;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.List;

/**
 * Caso de Uso de la Ingestión e Inferencia Analítica basada en Data (Big Data).
 * Aquí reside la lógica principal para parametrizar
 * qué campeón es hypercarry o agresor de early de forma empírica.
 */
public class RiotDataIngestionService implements AnalyzeChampionMetricsUseCase {

    private static final Logger log = LoggerFactory.getLogger(RiotDataIngestionService.class);
    
    // Constantes extraídas de "Magic Numbers" - Refactor QA (Iván Alcalino)
    private static final int DEFAULT_SAMPLE_SIZE = 50;
    private static final double HYPERCARRY_BURST_THRESHOLD = 15000.0;
    private static final double EARLY_AGGRO_CC_THRESHOLD = 50.0;
    
    private final RiotDataRepositoryPort riotDataRepository;
    
    // Inyectado vía Spring Config en la capa de Infra
    public RiotDataIngestionService(RiotDataRepositoryPort riotDataRepository) {
        this.riotDataRepository = riotDataRepository;
    }

    @Override
    public void calibrateChampion(int championId) {
        log.info("Iniciando calibración analítica bruta para el Campeón ID: {}", championId);
        
        // 1. Extraemos muestra de partidas 'Diamante+' para el análisis empírico
        List<String> matchIds = riotDataRepository.fetchHighEloMatchIds(DEFAULT_SAMPLE_SIZE);
        log.info("Muestra obtenida: {} partidas de nivel élite extraídas del servidor.", matchIds.size());
        
        double totalBurst = 0;
        double totalCC = 0;
        int validMatches = 0;

        for (String match : matchIds) {
            // Simulación de control de Rate Limit - Esto delega la extracción cruda a Infra
            try {
                ChampionMetrics matchMetric = riotDataRepository.extractMetricsFromMatch(match, championId);
                totalBurst += matchMetric.averageBurstDamage();
                totalCC += matchMetric.averageControlScore();
                validMatches++;
            } catch (Exception e) {
                log.warn("Fallo procesando métricas en la partida {}: {}", match, e.getMessage());
            }
        }
        
        if (validMatches > 0) {
            // Inferencia de roles eliminando números mágicos
            boolean isHyperCarry = (totalBurst / validMatches) > HYPERCARRY_BURST_THRESHOLD;
            boolean isEarlyAgro = (totalCC / validMatches) > EARLY_AGGRO_CC_THRESHOLD;
            
            // Consolidamos la métrica final (Simplificando el DTO final)
            ChampionMetrics finalMetrics = new ChampionMetrics(
                championId,
                "CALIBRADO_DINAMICAMENTE",
                null,
                isHyperCarry,
                isEarlyAgro,
                totalBurst / validMatches,
                totalCC / validMatches
            );
            
            riotDataRepository.saveInferredMetrics(finalMetrics);
            log.info("¡Calibración empírica completa para Campeón ID {}!", championId);
        }
    }

    @Override
    public void runGlobalAnalyticsPipeline() {
        log.info(">>>> INICIANDO PIPELINE ANALÍTICO MASIVO (NOVA RIFT) <<<<");
        // Ejemplo simplificado con el Catálogo de la Demo + Algunos extra
        List<Integer> catalogIDs = List.of(236, 412, 222, 86, 64, 238, 516, 254, 13, 25);
        catalogIDs.forEach(this::calibrateChampion);
        log.info(">>>> PIPELINE MASIVO FINALIZADO <<<<");
    }
}