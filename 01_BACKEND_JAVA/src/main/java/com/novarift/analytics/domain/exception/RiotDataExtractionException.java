package com.novarift.analytics.domain.exception;

/**
 * Excepción específica de dominio para fallos en la extracción de datos
 * hacia APIs externas como Riot Games u Origin.
 */
public class RiotDataExtractionException extends RuntimeException {

    public RiotDataExtractionException(String message) {
        super(message);
    }

    public RiotDataExtractionException(String message, Throwable cause) {
        super(message, cause);
    }
}
