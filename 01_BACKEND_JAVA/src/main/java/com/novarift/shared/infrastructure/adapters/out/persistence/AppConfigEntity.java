package com.novarift.shared.infrastructure.adapters.out.persistence;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;

/**
 * Entidad JPA mapeada a la tabla {@code APP_CONFIG} para configuración mutable
 * en caliente. Una sola entrada por clave; los valores son strings cortos
 * (hasta 512 chars). Tipos elegidos para ser compatibles tanto con H2 (dev/tests)
 * como con Oracle (prod) — sin tipos exóticos.
 *
 * <p>Schema:
 * <pre>
 * CREATE TABLE APP_CONFIG (
 * CONFIG_KEY VARCHAR(64) PRIMARY KEY,
 * CONFIG_VALUE VARCHAR(512) NOT NULL,
 * UPDATED_AT TIMESTAMP NOT NULL
 * );
 * </pre>
 *
 * <p>{@code ddl-auto=update} la crea automáticamente en ambos perfiles.
 *
 * <p>Entradas conocidas:
 * <ul>
 * <li>{@code riot.api-key} — Riot API key activa (origen panel admin).</li>
 * </ul>
 */
@Entity
@Table(name = "APP_CONFIG")
public class AppConfigEntity {

    @Id
    @Column(name = "CONFIG_KEY", length = 64, nullable = false)
    private String configKey;

    @Column(name = "CONFIG_VALUE", length = 512, nullable = false)
    private String configValue;

    @Column(name = "UPDATED_AT", nullable = false)
    private Instant updatedAt;

    protected AppConfigEntity() { /* JPA */ }

    public AppConfigEntity(String configKey, String configValue, Instant updatedAt) {
        this.configKey = configKey;
        this.configValue = configValue;
        this.updatedAt = updatedAt;
    }

    public String getConfigKey() { return configKey; }
    public String getConfigValue() { return configValue; }
    public Instant getUpdatedAt() { return updatedAt; }

    public void setConfigValue(String configValue) { this.configValue = configValue; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
