package com.novarift.live.application.recommendation;

import com.novarift.live.domain.recommendation.MatchupContext;
import com.novarift.live.domain.recommendation.RecommendationResult;

/**
 * Puerto de entrada (driving port) del caso de uso "calcular recomendacion live".
 *
 * <p>Define el contrato que la capa de aplicacion ofrece al exterior sin revelar la
 * implementacion: dado un {@link MatchupContext} devuelve la {@link RecommendationResult}.
 * Lo implementa {@link ComputeLiveRecommendationUseCaseImpl} y lo consume, entre otros,
 * el flujo de inicio de sesion live.
 */
public interface ComputeLiveRecommendationUseCase {

    RecommendationResult compute(MatchupContext context);
}
