package com.novarift.forge.application;

import com.novarift.forge.domain.UserProgress;
import com.novarift.forge.domain.UserProgressRepository;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Implementacion del caso de uso de analisis de progresion (capa application).
 *
 * <p>Recupera el {@link UserProgress} del jugador via el puerto de salida
 * {@link UserProgressRepository} (o usa valores por defecto si no existe) y genera un
 * informe con retos personalizados. La logica clave esta en {@code buildChallenges}:
 * calcula la brecha entre cada metrica actual y su objetivo (CS/min, vision, KDA,
 * participacion en kills, racha de forjas) y prioriza los retos por brecha relativa,
 * garantizando un minimo de tres.
 *
 * <p>Los usuarios de prueba (AN00/DEMO/MOCK) reciben metricas simuladas para poder
 * mostrar el flujo completo sin datos reales.
 */
public class AnalyzeProgressionUseCaseImpl implements AnalyzeProgressionUseCase {

    private static final double DEFAULT_CURRENT_CS = 6.0;
    private static final double DEFAULT_TARGET_CS = 7.0;
    private static final double DEFAULT_VISION_SCORE = 15.0;
    private static final int DEFAULT_FORGES_COMPLETED = 0;
    private static final double DEFAULT_KDA = 2.0;
    private static final double DEFAULT_KILL_PARTICIPATION = 45.0;

    private final UserProgressRepository repository;

    public AnalyzeProgressionUseCaseImpl(UserProgressRepository repository) {
        this.repository = repository;
    }

    @Override
    public Map<String, Object> execute(String riotId) {
        var normalizedRiotId = normalizeRiotId(riotId);
        var progress = resolveProgress(normalizedRiotId);
        var report = new HashMap<String, Object>();
        var challenges = buildChallenges(progress);

        report.put("riotId", normalizedRiotId);
        report.put("csPerMin", progress.currentCsMin());
        report.put("targetCsMin", progress.targetCsMin());
        report.put("visionScore", progress.visionScore());
        report.put("forgesCompleted", progress.forgesCompleted());
        report.put("kda", progress.kda());
        report.put("killParticipation", progress.killParticipation());
        report.put("csComparison", "Tu farmeo es " + progress.currentCsMin() + ", tu objetivo es " + progress.targetCsMin() + ".");
        report.put("challenges", challenges);

        var missions = new HashMap<String, String>();
        for (var i = 0; i < challenges.size(); i++) {
            var challenge = challenges.get(i);
            missions.put("mission" + (i + 1), String.valueOf(challenge.get("description")));
        }
        report.put("forgingMissions", missions);

        return report;
    }

    private UserProgress resolveProgress(String riotId) {
        // Usuarios de prueba: devuelven stats de demo prefijadas.
        if (isTestUser(riotId)) {
            return new UserProgress(
                null,
                riotId,
                6.4,    // CS/min — cerca de Oro pero con margen
                7.0,    // target Oro
                18.0,   // vision score
                12,     // forges completed
                2.7,    // KDA
                58.0,   // kill participation
                null
            );
        }

        return repository.findByRiotId(riotId)
            .orElseGet(() -> new UserProgress(
                null,
                riotId,
                DEFAULT_CURRENT_CS,
                DEFAULT_TARGET_CS,
                DEFAULT_VISION_SCORE,
                DEFAULT_FORGES_COMPLETED,
                DEFAULT_KDA,
                DEFAULT_KILL_PARTICIPATION,
                null
            ));
    }

    private boolean isTestUser(String riotId) {
        if (riotId == null) return false;
        String upper = riotId.split("[-#]")[0].trim().toUpperCase();
        return "AN00".equals(upper) || "DEMO".equals(upper) || "MOCK".equals(upper);
    }

    private String normalizeRiotId(String riotId) {
        if (riotId == null) {
            return "";
        }
        return riotId.trim().replace('#', '-');
    }

    /**
     * Genera retos ponderados por brecha entre valor actual y objetivo.
     * La prioridad se asigna por la magnitud de la brecha relativa:
     * cuanto mayor sea la diferencia porcentual entre actual y objetivo,
     * mayor prioridad tiene el reto.
     */
    private List<Map<String, Object>> buildChallenges(UserProgress progress) {
        var candidates = new ArrayList<Map<String, Object>>();
        var csGap = progress.targetCsMin() - progress.currentCsMin();

        // 1. CS/min gap
        if (csGap > 0) {
            double priority = csGap / progress.targetCsMin(); // brecha relativa
            candidates.add(challengeWithPriority(
                "🌾",
                "Maestro del Farmeo",
                "Sube tu CS/min a " + progress.targetCsMin() + " para cerrar la brecha de farmeo.",
                safeRatio(progress.currentCsMin(), progress.targetCsMin()),
                "Congela oleada al minuto 3 y prioriza ultimo golpe sobre intercambio.",
                priority
            ));
        }

        // 2. Vision Score gap (objetivo: 20+)
        double visionTarget = 20.0;
        if (progress.visionScore() < visionTarget) {
            double priority = (visionTarget - progress.visionScore()) / visionTarget;
            candidates.add(challengeWithPriority(
                "👁",
                "Dominio de Vision",
                "Alcanza " + (int) visionTarget + " de vision score para reducir picks sin informacion.",
                safeRatio(progress.visionScore(), visionTarget),
                "Compra Control Ward en cada vuelta y renueva wards antes del objetivo.",
                priority
            ));
        }

        // 3. KDA gap (objetivo: 3.0+)
        double kdaTarget = 3.0;
        double currentKda = progress.kda() != null ? progress.kda() : DEFAULT_KDA;
        if (currentKda < kdaTarget) {
            double priority = (kdaTarget - currentKda) / kdaTarget;
            candidates.add(challengeWithPriority(
                "🔥",
                "KDA Sostenido",
                "Mejora tu KDA a " + kdaTarget + " reduciendo deaths evitables.",
                safeRatio(currentKda, kdaTarget),
                "Evita picks sin vision y guarda hechizos defensivos para escapar.",
                priority
            ));
        }

        // 4. Kill Participation gap (objetivo: 60%+)
        double kpTarget = 60.0;
        double currentKp = progress.killParticipation() != null ? progress.killParticipation() : DEFAULT_KILL_PARTICIPATION;
        if (currentKp < kpTarget) {
            double priority = (kpTarget - currentKp) / kpTarget;
            candidates.add(challengeWithPriority(
                "⚔",
                "Participacion en Peleas",
                "Sube tu kill participation al " + (int) kpTarget + "% para impactar mas las teamfights.",
                safeRatio(currentKp, kpTarget),
                "Rota al mid cuando empujes tu linea y sincroniza con el jungla.",
                priority
            ));
        }

        // 5. Forges completed streak (objetivo: 3+)
        int forgesTarget = 3;
        if (progress.forgesCompleted() < forgesTarget) {
            double priority = (double) (forgesTarget - progress.forgesCompleted()) / forgesTarget;
            candidates.add(challengeWithPriority(
                "🧠",
                "Racha de Disciplina",
                "Completa " + forgesTarget + " forjas seguidas para consolidar habitos de mejora.",
                safeRatio(progress.forgesCompleted().doubleValue(), (double) forgesTarget),
                "Juega bloques cortos de 2 partidas y revisa la metrica principal al terminar.",
                priority
            ));
        }

        // Ordenar por prioridad descendente (mayor brecha primero)
        candidates.sort((a, b) -> Double.compare(
            (Double) b.get("_priority"),
            (Double) a.get("_priority")
        ));

        // Garantizar mínimo 3 retos
        while (candidates.size() < 3) {
            candidates.add(challengeWithPriority(
                "⚔",
                "Macro de Objetivos",
                "Prioriza 2 decisiones por objetivo neutral en tu siguiente partida.",
                0.5,
                "Sincroniza oleada y vision 40 segundos antes de dragon/heraldo.",
                0.0
            ));
        }

        // Limpiar campo interno de prioridad antes de devolver
        var result = candidates.subList(0, 3);
        result.forEach(c -> c.remove("_priority"));
        return result;
    }

    private Map<String, Object> challengeWithPriority(String icon, String title, String description,
                                                       double progress, String tip, double priority) {
        var challenge = new HashMap<String, Object>();
        challenge.put("icon", icon);
        challenge.put("title", title);
        challenge.put("description", description);
        challenge.put("progress", Math.max(0.0, Math.min(progress, 1.0)));
        challenge.put("tip", tip);
        challenge.put("_priority", priority);
        return challenge;
    }

    private double safeRatio(double current, double target) {
        if (target <= 0) {
            return 0;
        }
        return current / target;
    }
}
