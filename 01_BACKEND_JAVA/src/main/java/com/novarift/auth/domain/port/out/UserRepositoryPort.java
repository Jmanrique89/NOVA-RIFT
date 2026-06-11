package com.novarift.auth.domain.port.out;

import com.novarift.auth.domain.model.User;

import java.util.List;
import java.util.Optional;

/**
 * Puerto secundario hexagonal para persistir/leer usuarios.
 * El dominio NO conoce JPA — solo este contrato.
 */
public interface UserRepositoryPort {

    User save(User user);

    Optional<User> findById(Long id);

    Optional<User> findByUsername(String username);

    Optional<User> findByEmail(String email);

    boolean existsByUsername(String username);

    boolean existsByEmail(String email);

    List<User> findAll();

    void deleteById(Long id);

    long count();
}
