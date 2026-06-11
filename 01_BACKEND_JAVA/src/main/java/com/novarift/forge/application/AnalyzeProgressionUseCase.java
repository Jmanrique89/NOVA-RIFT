package com.novarift.forge.application;

import java.util.Map;

/**
 * Puerto de entrada (driving port) del caso de uso "analizar progresion del jugador".
 *
 * <p>Define el contrato que ofrece la capa de aplicacion: dado un Riot ID, devuelve un
 * informe (mapa serializable a JSON) con metricas actuales, objetivos y retos de mejora.
 * Lo implementa {@link AnalyzeProgressionUseCaseImpl} y lo consume {@code ForgeWebAdapter}.
 */
public interface AnalyzeProgressionUseCase {
    Map<String, Object> execute(String riotId);
}
