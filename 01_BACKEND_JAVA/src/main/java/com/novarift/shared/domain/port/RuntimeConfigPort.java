package com.novarift.shared.domain.port;

import java.util.Optional;

/**
 * Puerto de salida (driven port) de dominio para configuracion mutable en caliente.
 *
 * <p>Permite a la capa de aplicacion leer/escribir entradas {@code (key, value)} sin
 * acoplarse a un mecanismo de persistencia concreto: el dominio depende de esta interfaz,
 * no de JPA. La implementacion canonica es {@code JpaRuntimeConfigAdapter} (tabla
 * {@code APP_CONFIG}); en tests se puede sustituir por un stub in-memory sin Spring.
 *
 * <p>Lo usa sobre todo {@code RiotApiKeyHolder} para persistir la clave introducida por
 * el admin, de forma que sobreviva al reinicio (prioridad BD > env > properties > placeholder).
 *
 * <p>Contrato:
 * <ul>
 * <li>{@code get(key)} devuelve {@link Optional#empty()} si la entrada no
 * existe o si el valor es blank.</li>
 * <li>{@code put(key, value)} hace UPSERT (insert o update según exista
 * la clave). Si {@code value} es {@code null} o blank, no persiste.</li>
 * </ul>
 */
public interface RuntimeConfigPort {

    Optional<String> get(String key);

    void put(String key, String value);
}
