package com.novarift.riot.domain.model;

/**
 * Resumen de una partida ranked recientemente jugada.
 *
 * <p>Es una proyección lean del enorme JSON de Match V5 con solo los
 * campos que el frontend de NOVA RIFT necesita para mostrar el historial:
 *
 * <ul>
 * <li>{@code matchId} — identificador único (formato {@code EUW1_xxxxxx}).</li>
 * <li>{@code championName} — nombre canónico DataDragon (PascalCase).</li>
 * <li>{@code role} — rol jugado (TOP/JUNGLE/MID/BOTTOM/UTILITY) según
 * {@code teamPosition} de Match V5.</li>
 * <li>{@code result} — {@code "WIN"} o {@code "LOSS"} (plain English para
 * facilitar deserialización en el cliente).</li>
 * <li>{@code kills}, {@code deaths}, {@code assists} — KDA bruto.</li>
 * <li>{@code cs} — total minions + jungla (creepScore).</li>
 * <li>{@code durationMinutes} — duración en minutos enteros.</li>
 * <li>{@code visionScore} — score combinado de visión.</li>
 * <li>{@code damageToChamps} — daño total a campeones.</li>
 * </ul>
 */
public record MatchSummary(
        String matchId,
        String championName,
        String role,
        String result,
        int kills,
        int deaths,
        int assists,
        int cs,
        int durationMinutes,
        int visionScore,
        int damageToChamps
) {
    /** KDA como ratio. Muerte 0 → trata como 1 para evitar Infinity. */
    public double kda() {
        int safeDeaths = Math.max(deaths, 1);
        return Math.round(((kills + assists) * 10.0) / safeDeaths) / 10.0;
    }

    /** CS por minuto, redondeado a 1 decimal. 0 si la duración es 0. */
    public double csPerMin() {
        if (durationMinutes <= 0) return 0;
        return Math.round((cs * 10.0) / durationMinutes) / 10.0;
    }
}
