package com.novarift.riot.domain.model;

/**
 * Entry de ranking solo/duo o flex devuelta por League V4.
 *
 * <p>Representa una entrada de la liga clasificatoria del summoner: tier
 * ({@code IRON}…{@code CHALLENGER}), división ({@code I}…{@code IV}) y
 * los datos derivados (LP, victorias y derrotas). El winrate se expone
 * como porcentaje entero 0-100 para evitar conversiones en el frontend.
 *
 * <p>Para Master+ la división es siempre {@code "I"} (Riot lo unifica).
 *
 * @param queueType "RANKED_SOLO_5x5" | "RANKED_FLEX_SR" | "UNRANKED"
 * @param tier IRON | BRONZE | SILVER | GOLD | PLATINUM | EMERALD |
 * DIAMOND | MASTER | GRANDMASTER | CHALLENGER | UNRANKED
 * @param division I | II | III | IV (vacío si Master+)
 * @param leaguePoints LP actuales (0..100, salvo Master+ donde puede ser >100)
 * @param wins victorias en esta cola
 * @param losses derrotas en esta cola
 */
public record RankedEntry(
        String queueType,
        String tier,
        String division,
        int leaguePoints,
        int wins,
        int losses
) {
    /** Winrate como porcentaje entero 0-100. Devuelve 0 si no hay partidas. */
    public int winrate() {
        int total = wins + losses;
        return total == 0 ? 0 : Math.round((wins * 100f) / total);
    }

    /** Etiqueta legible: "Gold II · 47 LP" o "Unranked". */
    public String label() {
        if ("UNRANKED".equals(tier)) return "Unranked";
        if (division == null || division.isBlank()) {
            return capitalize(tier) + " · " + leaguePoints + " LP";
        }
        return capitalize(tier) + " " + division + " · " + leaguePoints + " LP";
    }

    /** Factory para representar un summoner sin entries (sin ranked). */
    public static RankedEntry unranked() {
        return new RankedEntry("UNRANKED", "UNRANKED", "", 0, 0, 0);
    }

    private static String capitalize(String s) {
        if (s == null || s.isEmpty()) return s;
        return s.charAt(0) + s.substring(1).toLowerCase();
    }
}
