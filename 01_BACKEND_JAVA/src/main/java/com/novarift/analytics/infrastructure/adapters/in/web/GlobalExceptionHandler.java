package com.novarift.analytics.infrastructure.adapters.in.web;

import com.novarift.analytics.domain.exception.RiotDataExtractionException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.ErrorResponseException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

/**
 * Manejo centralizado de excepciones (Controller Advice).
 *
 * <p>Captura excepciones de dominio del módulo {@code analytics} y, como
 * último recurso, cualquier {@link Exception} no contemplada — devolviendo
 * un payload de error estandarizado y sin filtrar stacktraces.
 *
 * <p>Re-lanza las excepciones que Spring sabe convertir a 4xx (parámetros
 * faltantes, métodos HTTP no soportados, etc.) para que su
 * {@code DefaultHandlerExceptionResolver} las traduzca al status correcto, en
 * lugar de atraparlas en el catch-all y devolver un 500 indebido.
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(RiotDataExtractionException.class)
    public ResponseEntity<Map<String, Object>> handleRiotDataExtractionException(RiotDataExtractionException ex) {
        log.error("Excepción de dominio capturada: {}", ex.getMessage());
        Map<String, Object> errorResponse = new HashMap<>();
        errorResponse.put("timestamp", LocalDateTime.now());
        errorResponse.put("status", HttpStatus.SERVICE_UNAVAILABLE.value());
        errorResponse.put("error", "Service Unavailable");
        errorResponse.put("message", ex.getMessage());
        return new ResponseEntity<>(errorResponse, HttpStatus.SERVICE_UNAVAILABLE);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, Object>> handleGlobalException(Exception ex) throws Exception {
        // Re-lanzamos las excepciones que Spring debe manejar (4xx) — el
        // resolver por defecto las traduce al status correcto. Sin esto,
        // {@link MissingServletRequestParameterException} → 400 se convertiría
        // erróneamente a 500.
        if (ex instanceof MissingServletRequestParameterException
                || ex instanceof org.springframework.web.HttpRequestMethodNotSupportedException
                || ex instanceof org.springframework.web.HttpMediaTypeNotSupportedException
                || ex instanceof org.springframework.http.converter.HttpMessageNotReadableException
                || ex instanceof org.springframework.web.servlet.NoHandlerFoundException
                || ex instanceof org.springframework.web.servlet.resource.NoResourceFoundException
                || ex instanceof org.springframework.web.method.annotation.MethodArgumentTypeMismatchException
                || ex instanceof ErrorResponseException) {
            throw ex;
        }

        log.error("Excepción no controlada capturada: {}", ex.getMessage(), ex);
        Map<String, Object> errorResponse = new HashMap<>();
        errorResponse.put("timestamp", LocalDateTime.now());
        errorResponse.put("status", HttpStatus.INTERNAL_SERVER_ERROR.value());
        errorResponse.put("error", "Internal Server Error");
        errorResponse.put("message", "Ocurrió un error inesperado al procesar la solicitud.");
        return new ResponseEntity<>(errorResponse, HttpStatus.INTERNAL_SERVER_ERROR);
    }
}
