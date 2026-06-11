package com.novarift.shared.config;

import com.novarift.shared.domain.port.RuntimeConfigPort;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.Optional;
import java.util.concurrent.atomic.AtomicReference;

/**
 * Fuente unica y mutable en caliente de la clave de la Riot API.
 *
 * <p>Es un bean de configuracion (capa shared) que centraliza de donde sale la clave
 * y permite cambiarla sin reiniciar. Prioridad de carga al arrancar, de mas a menos
 * autoritativa:
 * <ol>
 * <li><b>BD</b> ({@code APP_CONFIG.riot.api-key}) — clave introducida por el admin
 * en el panel; es la fuente de verdad y sobrevive a reinicios.</li>
 * <li><b>env / properties</b> ({@code app.riot.api-key}, con default
 * {@code RGAPI-DEMO-KEY-PLACEHOLDER}) — usada solo si la BD no tiene clave.</li>
 * </ol>
 *
 * <p>El endpoint {@code PATCH /api/v1/admin/config/riot-key} llama a {@link #setKey(String)},
 * que actualiza el valor en memoria <b>y</b> lo persiste en BD a traves del puerto
 * {@link RuntimeConfigPort}, de modo que tras un reinicio se recarga desde la BD.
 *
 * <p>Los componentes que necesiten la clave deben inyectar este bean y llamar a
 * {@link #getKey()} en cada peticion (no cachearla en un campo final). {@link #getSource()}
 * informa del origen del valor activo ({@code panel(BD)} o {@code env/properties}) para
 * el panel admin y la auditoria.
 */
@Component
public class RiotApiKeyHolder {

    private static final Logger log = LoggerFactory.getLogger(RiotApiKeyHolder.class);

    /** Clave usada para persistir la API key en {@code APP_CONFIG}. */
    public static final String CONFIG_KEY = "riot.api-key";

    private final AtomicReference<String> key = new AtomicReference<>();
    private final AtomicReference<String> source = new AtomicReference<>("env/properties");

    @Value("${app.riot.api-key:RGAPI-DEMO-KEY-PLACEHOLDER}")
    private String initialKey;

    /**
     * Puerto de persistencia. Es {@code @Autowired(required=false)} para que
     * los tests unitarios sigan funcionando con {@link #forTesting(String)}.
     * En producción Spring lo inyecta siempre vía {@code JpaRuntimeConfigAdapter}.
     */
    @Autowired(required = false)
    private RuntimeConfigPort runtimeConfig;

    @PostConstruct
    void init() {
        // Prioridad: BD (panel admin) → env/properties.
        Optional<String> fromDb = runtimeConfig != null
                ? runtimeConfig.get(CONFIG_KEY)
                : Optional.empty();

        if (fromDb.isPresent()) {
            key.set(fromDb.get());
            source.set("panel(BD)");
            log.info("[RiotApiKeyHolder] clave cargada desde BD (panel admin) — {}", maskedTail(fromDb.get()));
        } else {
            key.set(initialKey);
            source.set("env/properties");
            log.info("[RiotApiKeyHolder] clave cargada desde env/properties — {}", maskedTail(initialKey));
        }
    }

    public String getKey() {
        return key.get();
    }

    /**
     * Origen del valor activo: {@code "panel(BD)"} o {@code "env/properties"}.
     * Cambia a {@code "panel(BD)"} tras una llamada exitosa a {@link #setKey}.
     */
    public String getSource() {
        return source.get();
    }

    /**
     * Actualiza la clave en memoria <b>y</b> persiste en BD vía el puerto
     * {@link RuntimeConfigPort}. Tras un reinicio del servidor, la clave se
     * recargará desde BD (es la fuente de verdad).
     *
     * <p>Si {@code runtimeConfig} es {@code null} (tests sin Spring) solo se
     * actualiza la memoria, sin persistir.
     */
    public void setKey(String newKey) {
        if (newKey == null || newKey.isBlank()) {
            throw new IllegalArgumentException("La clave Riot no puede estar vacía");
        }
        String trimmed = newKey.trim();
        key.set(trimmed);
        source.set("panel(BD)");
        if (runtimeConfig != null) {
            runtimeConfig.put(CONFIG_KEY, trimmed);
        }
        log.info("[RiotApiKeyHolder] clave actualizada desde el panel admin — nueva: {}", maskedTail(trimmed));
    }

    public boolean isValid() {
        String k = key.get();
        return k != null && !k.isBlank() && !k.contains("PLACEHOLDER") && k.startsWith("RGAPI-");
    }

    /**
     * Factory para tests unitarios — crea un holder con la clave dada sin
     * necesitar contexto Spring ni {@code @PostConstruct}. El puerto
     * {@link RuntimeConfigPort} queda {@code null} (los tests del holder no
     * verifican persistencia; para eso está el adapter test).
     */
    public static RiotApiKeyHolder forTesting(String key) {
        RiotApiKeyHolder h = new RiotApiKeyHolder();
        h.key.set(key != null ? key : "");
        h.source.set("env/properties");
        return h;
    }

    private static String maskedTail(String s) {
        if (s == null) return "??";
        return s.length() > 6 ? "..." + s.substring(s.length() - 6) : "??";
    }
}
