package com.novarift.riot.domain.port.in;

import com.novarift.riot.domain.model.SummonerSummary;

/**
 * Caso de uso primario del módulo Riot — obtener un resumen completo
 * de un summoner para que el frontend pinte la pantalla "Buscar jugador".
 *
 * <p>El flag {@code allowMock} controla la política de fallback:
 *
 * <ul>
 * <li>{@code allowMock = true} (recomendado) — si la API key está vacía
 * o devuelve 401/403/429/5xx, el caso de uso devuelve un
 * {@link SummonerSummary#mockFallback} para que el frontend muestre
 * contenido demo en vez de un error.</li>
 * <li>{@code allowMock = false} — propaga la excepción para que el
 * cliente decida qué hacer (debug / tests).</li>
 * </ul>
 */
public interface GetSummonerSummaryUseCase {

    SummonerSummary getSummonerSummary(String riotId, String region, boolean allowMock);
}
