package com.novarift.live.domain.recommendation;

import java.util.List;

/**
 * Objeto de valor de dominio con la evaluacion de amenaza del equipo enemigo.
 *
 * <p>Es la salida de {@link RecommendationScoringEngine#assessThreat} y entrada del
 * scoring de items: resume "contra que estamos jugando". Lo produce el motor a partir
 * de las reglas de la base de conocimiento y de los campeones detectados, y es inmutable.
 *
 * <p>Campos: nivel de amenaza agregado (0-100), perfil de dano dominante, tags de CC
 * y anti-mecanicas presentes, e IDs de las reglas que se dispararon (trazabilidad).
 */
public record ThreatAssessment(
    int threatScore,                  // 0-100 agregado
    String damageProfile,             // AD, AP, MIXED, TRUE (dominante)
    List<String> ccTags,              // tags de CC presentes en la composición
    List<String> antiMechanicsTags,   // tags anti-mecánicas detectadas
    List<String> triggeredRuleIds     // IDs de reglas que dispararon
) {}
