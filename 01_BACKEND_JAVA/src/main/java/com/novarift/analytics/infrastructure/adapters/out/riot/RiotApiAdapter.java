package com.novarift.analytics.infrastructure.adapters.out.riot;

import com.fasterxml.jackson.databind.JsonNode;
import com.novarift.analytics.domain.model.ChampionMetrics;
import com.novarift.analytics.domain.port.out.RiotDataRepositoryPort;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import com.novarift.shared.config.RiotApiKeyHolder;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.ArrayList;
import java.util.List;

import com.novarift.analytics.infrastructure.adapters.out.persistence.ChampionAnalyticsEntity;
import com.novarift.analytics.infrastructure.adapters.out.persistence.ChampionAnalyticsJpaRepository;
import com.novarift.analytics.domain.exception.RiotDataExtractionException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;

/**
 * Adaptador de Infraestructura para comunicarse con Riot API (Match-v5 y League-v4).
 * Responsabilidad: Rate Limiting, Headers y extracción dura de JSONs.
 */
@Service
public class RiotApiAdapter implements RiotDataRepositoryPort {

    private static final Logger log = LoggerFactory.getLogger(RiotApiAdapter.class);

    // Endpoint Base Europa Oeste
    private static final String MATCH_V5_URL = "https://europe.api.riotgames.com/lol/match/v5/matches";

    private final RestTemplate restTemplate;
    private final ChampionAnalyticsJpaRepository jpaRepository;
    private final RiotApiKeyHolder keyHolder;

    @Autowired
    public RiotApiAdapter(
            @Qualifier("riotRestTemplate") RestTemplate restTemplate,
            ChampionAnalyticsJpaRepository jpaRepository,
            RiotApiKeyHolder keyHolder) {
        this.restTemplate = restTemplate;
        this.jpaRepository = jpaRepository;
        this.keyHolder = keyHolder;
    }

    @Override
    public List<String> fetchHighEloMatchIds(int count) {
        log.info("Obteniendo una muestra de {} partidas de High Elo de RIOT MATCH-V5... (SIMULADO PARA MVP)", count);
        // En Producción: Consultaríamos players de Challenger con League-v4 y luego Match-v5 por PUUID.
        // Simulando listado para no gastar API keys prematuramente
        List<String> mockMatches = new ArrayList<>();
        for (int i = 0; i < Math.min(count, 5); i++) {
            mockMatches.add("EUW1_12345678" + i);
        }
        return mockMatches;
    }

    @Override
    public ChampionMetrics extractMetricsFromMatch(String matchId, int championId) {
        log.debug("Extrayendo data masiva de RIOT para match {}. Rate limit administrado manual.", matchId);
        enforceRateLimit();

        HttpHeaders headers = new HttpHeaders();
        headers.set("X-Riot-Token", keyHolder.getKey());
        HttpEntity<String> entity = new HttpEntity<>(headers);

        try {
            String endpoint = MATCH_V5_URL + "/" + matchId;
            ResponseEntity<JsonNode> response = restTemplate.exchange(endpoint, HttpMethod.GET, entity, JsonNode.class);
            JsonNode participants = response.getBody().path("info").path("participants");
            
            // Buscar al campeón específico dentro de los 10 participantes
            JsonNode targetParticipant = null;
            for (JsonNode participant : participants) {
                if (participant.path("championId").asInt() == championId) {
                    targetParticipant = participant;
                    break;
                }
            }

            if (targetParticipant == null) {
                log.warn("El campeón {} no estaba en la partida {}", championId, matchId);
                throw new RiotDataExtractionException("Campeón no encontrado en esta partida.");
            }

            JsonNode challenges = targetParticipant.path("challenges");
            
            double burstData = challenges.path("burstDmg").asDouble(0.0);
            double ccScore = targetParticipant.path("timeCCingOthers").asDouble(0.0);
            
            // Lógica empírica en crudo
            return new ChampionMetrics(
                     championId,
                     targetParticipant.path("championName").asText(), 
                     null, // Damage Profile se mapearía después
                     false, // Serán calculados en Aplicación In-Memory
                     false,
                     burstData,
                     ccScore
             );
        } catch (Exception e) {
            log.error("Fallo al contactar Endpoint RIOT V5 para match {}: {}", matchId, e.getMessage());
            throw new RiotDataExtractionException("Error en Adaptador de Riot: " + e.getMessage(), e);
        }
    }

    /**
     * Sistema simple de Rate Limiting para evitar baneos de App en la API gratuita.
     * Restricción Riot: 20 peticiones / 1 seg y 100 peticiones / 2 min.
     * En lugar de Resilience4j, inyectamos un sleep conservador (1.5 segundos por llamada garantiza no pasar 100 en 2 min).
     */
    private void enforceRateLimit() {
        try {
            // Un retraso de 1500ms asegura un máximo de ~80 llamadas cada 2 minutos (por debajo de las 100 del límite crudo)
            Thread.sleep(1500);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }

    @Override
    public void saveInferredMetrics(ChampionMetrics metrics) {
        log.info("✅ [Data Analytics Pipeline]: Salvando en H2/Oracle -> Campeón ID {}, HyperCarry: {}, EarlyAgro: {}",
                metrics.championId(), metrics.isLateGameHypercarry(), metrics.isEarlyGameAggressor());
        
        ChampionAnalyticsEntity entityToSave = new ChampionAnalyticsEntity(
            metrics.championId(),
            metrics.championName(),
            metrics.isLateGameHypercarry(),
            metrics.isEarlyGameAggressor(),
            metrics.averageBurstDamage(),
            metrics.averageControlScore()
        );
        
        jpaRepository.save(entityToSave);
    }
}