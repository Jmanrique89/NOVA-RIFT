package com.novarift.analytics.domain.exception;

/**
 * Excepción base para fallos al invocar APIs externas (Riot, Data Dragon,
 * etc.). Pertenece a la capa de dominio porque representa un caso de error
 * de negocio (la app NO puede operar sin estos datos), no un detalle técnico.
 *
 * Uso típico:
 * throw new ExternalApiException("Riot API devolvió 429 (rate limit)", cause);
 *
 * Manejada centralmente en {@link com.novarift.analytics.infrastructure
 * .adapters.in.web.GlobalExceptionHandler} → respuesta 503 Service Unavailable.
 *
 * Excepción específica (en lugar de un RuntimeException genérico), manejada con
 * @RestControllerAdvice como recomiendan los principios de Clean Architecture.
 */
public class ExternalApiException extends RuntimeException {

    public ExternalApiException(String message) {
        super(message);
    }

    public ExternalApiException(String message, Throwable cause) {
        super(message, cause);
    }
}
