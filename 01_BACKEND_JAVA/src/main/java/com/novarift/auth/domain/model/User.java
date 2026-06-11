package com.novarift.auth.domain.model;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Entidad de dominio que representa al usuario del sistema NOVA RIFT.
 *
 * <p>Es el nucleo del hexagono del modulo auth: un record inmutable, sin
 * dependencias de framework ni de persistencia. La identidad (login) y el
 * onboarding (faccion, roles, playstyle, pool de campeones) conviven con los
 * campos de administracion ({@code role}, {@code banned}, {@code lastLoginAt}).
 *
 * <p>Al ser inmutable, toda modificacion se hace con metodos {@code withXxx}
 * que devuelven una copia nueva; la factoria {@link #newUser} crea el usuario
 * recien registrado (sin id, sin setup, rol USER).
 */
public record User(
    Long id,
    String username,
    String email,
    String passwordHash,
    String faction,
    String mainRole,
    String secondaryRole,
    String playstyle,
    boolean setupComplete,
    LocalDateTime createdAt,
    List<UserChampionPick> champions,
    String role,
    boolean banned,
    LocalDateTime lastLoginAt
) {
    /** Factory para crear un usuario nuevo (sin id, sin setup). */
    public static User newUser(String username, String email, String passwordHash) {
        return new User(
            null, username, email, passwordHash,
            null, null, null, null,
            false, LocalDateTime.now(), List.of(),
            "USER", false, null
        );
    }

    /** Devuelve copia con campos de onboarding rellenos y setupComplete = true. */
    public User withSetup(String faction, String mainRole, String secondaryRole,
                           String playstyle, List<UserChampionPick> champions) {
        return new User(
            id, username, email, passwordHash,
            faction, mainRole, secondaryRole, playstyle,
            true, createdAt, champions,
            role, banned, lastLoginAt
        );
    }

    public User withLastLogin(LocalDateTime when) {
        return new User(
            id, username, email, passwordHash,
            faction, mainRole, secondaryRole, playstyle,
            setupComplete, createdAt, champions,
            role, banned, when
        );
    }

    public User withRole(String newRole) {
        return new User(
            id, username, email, passwordHash,
            faction, mainRole, secondaryRole, playstyle,
            setupComplete, createdAt, champions,
            newRole, banned, lastLoginAt
        );
    }

    public User withBanned(boolean newBanned) {
        return new User(
            id, username, email, passwordHash,
            faction, mainRole, secondaryRole, playstyle,
            setupComplete, createdAt, champions,
            role, newBanned, lastLoginAt
        );
    }
}
