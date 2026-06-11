package com.novarift.live.domain;

public interface RiotMatchPort {
    /**
     * Devuelve el JSON puro de la formación o draft enemigo a partir de una imagen.
     * En el modo MOCK esto será estático. En realidad, cruzará APIs.
     */
    String getEnemyDraftAnalysis(String summonerName, String sourceHash);
    
    /**
     * Predicción de la ruta de objetos a construir basada en la composición rival.
     */
    String getRecommendedBuild(String enemyDraft);
}
