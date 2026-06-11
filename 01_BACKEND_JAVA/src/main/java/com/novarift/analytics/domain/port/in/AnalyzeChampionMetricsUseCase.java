package com.novarift.analytics.domain.port.in;

/**
 * Puerto de Entrada: Define el caso de uso del Pipeline Analítico.
 */
public interface AnalyzeChampionMetricsUseCase {
    
    /**
     * Extrae data masiva y calibra las etiquetas tácticas para un campeón concreto.
     */
    void calibrateChampion(int championId);
    
    /**
     * Cronjob o tarea recurrente para calibrar la DB completa tras un Parche.
     */
    void runGlobalAnalyticsPipeline();
}