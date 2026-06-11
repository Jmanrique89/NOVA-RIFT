package com.novarift.shared.infrastructure.adapters.out.persistence;

import com.novarift.shared.domain.port.RuntimeConfigPort;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Optional;

/**
 * Adaptador de salida (driven adapter) que implementa {@link RuntimeConfigPort} sobre la
 * tabla {@code APP_CONFIG} con Spring Data JPA.
 *
 * <p>Es el "lado derecho" del hexagono para la configuracion en caliente: conecta el puerto
 * de dominio con la base de datos. Realiza un UPSERT manual ({@link #put(String, String)}
 * comprueba con {@code findById} si la entrada existe y decide actualizar o insertar) para
 * poder fijar tambien {@code updatedAt} de forma explicita y dejar traza de auditoria.
 */
@Component
public class JpaRuntimeConfigAdapter implements RuntimeConfigPort {

    private static final Logger log = LoggerFactory.getLogger(JpaRuntimeConfigAdapter.class);

    private final AppConfigRepository repository;

    public JpaRuntimeConfigAdapter(AppConfigRepository repository) {
        this.repository = repository;
    }

    @Override
    public Optional<String> get(String key) {
        if (key == null || key.isBlank()) return Optional.empty();
        return repository.findById(key)
                .map(AppConfigEntity::getConfigValue)
                .filter(v -> v != null && !v.isBlank());
    }

    @Override
    @Transactional
    public void put(String key, String value) {
        if (key == null || key.isBlank() || value == null || value.isBlank()) {
            return;
        }
        Instant now = Instant.now();
        // Log explícito de errores de persistencia: si el save falla, se registra
        // el fallo y se propaga la excepción al caller (que puede avisar al admin),
        // en lugar de fallar de forma silenciosa.
        try {
            repository.findById(key).ifPresentOrElse(existing -> {
                existing.setConfigValue(value);
                existing.setUpdatedAt(now);
                repository.save(existing);
                log.info("[RuntimeConfig] UPDATE {}={}…", key, mask(value));
            }, () -> {
                repository.save(new AppConfigEntity(key, value, now));
                log.info("[RuntimeConfig] INSERT {}={}…", key, mask(value));
            });
        } catch (RuntimeException ex) {
            log.error("[RuntimeConfig] FALLO al persistir {} — la clave NO sobrevivirá al reinicio: {}",
                    key, ex.getMessage(), ex);
            throw ex;
        }
    }

    /** Enmascara el valor en logs — solo últimos 6 chars visibles. */
    private static String mask(String value) {
        if (value == null) return "??";
        if (value.length() <= 6) return "***";
        return "***" + value.substring(value.length() - 6);
    }
}
