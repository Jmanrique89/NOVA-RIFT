package com.novarift.riot.domain.exception;

/**
 * Excepción de dominio para fallos al consumir Riot API.
 *
 * <p>Se distingue por {@link Reason} para que el adapter REST decida si
 * devolver fallback (401/403/429), 404 (summoner no existe) o 502
 * (error inesperado upstream).
 */
public class RiotApiException extends RuntimeException {

    public enum Reason {
        /** Clave inválida o expirada (HTTP 401/403). */
        UNAUTHORIZED,
        /** Rate limit excedido (HTTP 429). */
        RATE_LIMITED,
        /** Summoner no encontrado (HTTP 404). */
        NOT_FOUND,
        /** Error transitorio o inesperado de upstream (5xx, timeout, IO). */
        UPSTREAM_ERROR,
        /** Riot API key vacía o placeholder en config — modo MOCK obligado. */
        NO_API_KEY,
    }

    private final Reason reason;

    public RiotApiException(Reason reason, String message) {
        super(message);
        this.reason = reason;
    }

    public RiotApiException(Reason reason, String message, Throwable cause) {
        super(message, cause);
        this.reason = reason;
    }

    public Reason reason() {
        return reason;
    }

    /** Indica si el adapter REST debería responder con fallback "mock" en vez de 5xx. */
    public boolean shouldFallback() {
        return reason == Reason.UNAUTHORIZED
                || reason == Reason.RATE_LIMITED
                || reason == Reason.UPSTREAM_ERROR
                || reason == Reason.NO_API_KEY;
    }
}
