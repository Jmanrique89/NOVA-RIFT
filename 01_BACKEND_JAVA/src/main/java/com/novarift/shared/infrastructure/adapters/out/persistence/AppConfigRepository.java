package com.novarift.shared.infrastructure.adapters.out.persistence;

import org.springframework.data.jpa.repository.JpaRepository;

/**
 * Repositorio Spring Data JPA de {@link AppConfigEntity}.
 *
 * <p>Pieza del adaptador de persistencia: el CRUD basico por {@code configKey} (PK)
 * basta, ya que la tabla es esencialmente un almacen clave-valor con pocas entradas
 * (sin queries custom ni paginacion).
 */
public interface AppConfigRepository extends JpaRepository<AppConfigEntity, String> {
}
