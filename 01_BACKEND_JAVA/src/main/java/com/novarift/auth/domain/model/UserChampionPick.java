package com.novarift.auth.domain.model;

/**
 * Campeón seleccionado por un usuario durante el onboarding.
 * priority 1 = main, 2 = secundario, 3+ = pool de pruebas.
 */
public record UserChampionPick(
    Long id,
    String championId,
    int priority
) {
    public static UserChampionPick of(String championId, int priority) {
        return new UserChampionPick(null, championId, priority);
    }
}
