package com.novarift.riot.infrastructure.config;

import org.springframework.http.client.ClientHttpResponse;
import org.springframework.web.client.ResponseErrorHandler;

import java.io.IOException;

/**
 * Error handler que NO lanza excepción en 4xx/5xx, dejando que el cliente
 * inspeccione el código de estado a mano.
 *
 * <p>Esto es importante para nuestro proxy Riot: queremos diferenciar
 * 401/403 (clave inválida → fallback mock) de 404 (summoner no existe →
 * 404 al frontend) de 429 (rate limit → fallback temporal). El handler
 * por defecto de Spring lanza {@code HttpClientErrorException} y obliga
 * a un try/catch granular por código en cada llamada.
 *
 * <p>Lectura: el cliente de este módulo siempre revisa
 * {@code response.getStatusCode()} explícitamente.
 */
public class SilentErrorHandler implements ResponseErrorHandler {

    @Override
    public boolean hasError(ClientHttpResponse response) throws IOException {
        return false; // nunca consideramos error → cliente decide
    }

    @Override
    public void handleError(ClientHttpResponse response) throws IOException {
        // No-op: cliente lo hace.
    }
}
