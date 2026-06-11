package com.novarift.analytics.domain.port.out;

import com.novarift.analytics.domain.model.ChampionMetrics;
import java.util.List;

/**
 * Puerto de Salida para extraer datos crudos de Riot y para
 * persistir la KB calculada por nosotros.
 */
public interface RiotDataRepositoryPort {
    
    /**
     * Extrae un volumen masivo de IDs de partidas en Master/Challenger para inferir datos.
     */
    List<String> fetchHighEloMatchIds(int count);
    
    /**
     * Descarga la biometría y métricas crudas de una partida específica
     * desde el endpoint Match-v5 de Riot.
     */
    ChampionMetrics extractMetricsFromMatch(String matchId, int championId);
    
    /**
     * Guarda en base de datos la métrica inferida del campeón para uso del motor táctico.
     */
    void saveInferredMetrics(ChampionMetrics metrics);
}