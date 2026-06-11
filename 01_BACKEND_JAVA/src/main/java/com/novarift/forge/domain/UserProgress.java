package com.novarift.forge.domain;

import java.time.LocalDateTime;

/**
 * Entidad de dominio que representa la progresion de un jugador en el modulo Forge.
 *
 * <p>Record inmutable y sin dependencias de framework: es el modelo puro del hexagono
 * Forge. Agrupa las metricas de rendimiento sobre las que se calculan los retos de mejora
 * (CS por minuto actual y objetivo, vision score, forjas completadas, KDA y participacion
 * en kills) junto al Riot ID del jugador y la fecha de ultima actualizacion.
 */
public record UserProgress(
    Long id,
    String riotId,
    Double currentCsMin,
    Double targetCsMin,
    Double visionScore,
    Integer forgesCompleted,
    Double kda,
    Double killParticipation,
    LocalDateTime lastUpdated
) {
}
