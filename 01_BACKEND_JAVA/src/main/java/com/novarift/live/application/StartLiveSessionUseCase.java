package com.novarift.live.application;

import com.novarift.live.domain.LiveSession;

/**
 * Puerto de entrada (driving port) del caso de uso "iniciar sesion live".
 *
 * <p>Lo invoca el adaptador web cuando el usuario arranca el radar en partida.
 * Expone dos variantes: {@link #execute} (legacy, solo la sesion persistida) y
 * {@link #executeEnriched}, que ademas adjunta la recomendacion calculada por el
 * motor para que el adaptador exponga items, razones y amenaza. El default de la
 * version enriquecida delega en la legacy, manteniendo la compatibilidad.
 */
public interface StartLiveSessionUseCase {

    /**
     * Ejecución legacy: devuelve únicamente la sesión persistida.
     * Mantenido por compatibilidad con tests y consumidores antiguos.
     */
    LiveSession execute(String summonerName, String imageHash);

    /**
     * Ejecución enriquecida: devuelve la sesión + (opcional) recomendación calculada
     * para que el adapter web pueda exponer los campos del Motor de Recomendación
     * (recommendationItems, recommendationReasons, threatAssessment).
     *
     * Implementación por defecto delega en {@link #execute(String, String)} y devuelve
     * {@link LiveSessionStartResult#legacy(LiveSession)} sin recomendación, manteniendo
     * la compatibilidad con implementaciones antiguas.
     */
    default LiveSessionStartResult executeEnriched(String summonerName, String imageHash) {
        return LiveSessionStartResult.legacy(execute(summonerName, imageHash));
    }
}
