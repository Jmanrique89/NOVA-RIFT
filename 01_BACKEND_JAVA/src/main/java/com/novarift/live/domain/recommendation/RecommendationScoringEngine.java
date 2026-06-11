package com.novarift.live.domain.recommendation;

import com.novarift.live.domain.knowledge.*;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Motor de scoring de recomendaciones Live — el corazon algoritmico de NOVA RIFT.
 *
 * <p>Es logica PURA de dominio: no depende de Spring, JPA ni de la red, lo que la
 * hace testeable de forma aislada y reutilizable por cualquier caso de uso. Recibe
 * el contexto del enfrentamiento, la evaluacion de amenaza y los items candidatos,
 * y produce una recomendacion ordenada con su explicacion.
 *
 * <p><b>Formula de puntuacion.</b> Cada item se evalua con una combinacion lineal
 * ponderada de seis sub-scores (cada uno normalizado a 0-100). Los pesos suman 1.0
 * en la parte positiva y se resta un termino de penalizacion:
 * <pre>
 * Score(item, contexto) =
 * 0.35 * ThreatMitigation (mitigar la amenaza dominante — el factor de mas peso)
 * + 0.20 * MatchupValue (urgencia segun winrates del enfrentamiento)
 * + 0.15 * TimingFit (encaje temporal del item en la partida)
 * + 0.15 * Synergy (sinergia con el campeon/carril propio)
 * + 0.10 * Reliability (fiabilidad: tamano de muestra + efectividad)
 * 0.05 * OpportunityCost (coste de oportunidad frente a mejores items)
 * </pre>
 *
 * <p><b>Que calcula cada sub-score</b> (un metodo {@code compute*} por cada uno):
 * <ul>
 * <li>{@code computeThreatMitigation} — premia que el perfil de dano del item
 * coincida con el perfil dominante del enemigo (AD/AP/MIXED) mas su efectividad.</li>
 * <li>{@code computeMatchupValue} — convierte los winrates adversos en "urgencia":
 * cuanto mas pierde el jugador en ese matchup, mas valor tiene el counter.</li>
 * <li>{@code computeTimingFit} — puntua segun la ventana temporal del item
 * (EARLY/ALL valen mas para la primera compra que MID/LATE).</li>
 * <li>{@code computeSynergy} — sinergia basica por carril (items defensivos rinden
 * mas en TOP/MID 1v1 y en BOT por supervivencia).</li>
 * <li>{@code computeReliability} — confianza en el dato: combina el tamano de
 * muestra de los matchups con la efectividad intrinseca del item.</li>
 * <li>{@code computeOpportunityCost} — penaliza al item si existen alternativas
 * claramente mas efectivas en el conjunto de candidatos.</li>
 * </ul>
 *
 * <p>Ademas {@code assessThreat} construye la {@link ThreatAssessment} aplicando las
 * reglas de la base de conocimiento (per-champion y por tag de composicion). Si la
 * confianza agregada baja del umbral, devuelve un fallback conservador en lugar de
 * arriesgar una recomendacion sin datos.
 *
 * <p><b>Determinista:</b> misma entrada produce siempre la misma salida (clave para
 * poder testearlo y para que el resultado sea defendible).
 */
public class RecommendationScoringEngine {

    public static final String POLICY_VERSION = "v1.0.0-phase1";
    private static final double CONFIDENCE_THRESHOLD = 0.40;

    // Pesos de la fórmula
    private static final double W_THREAT  = 0.35;
    private static final double W_MATCHUP = 0.20;
    private static final double W_TIMING  = 0.15;
    private static final double W_SYNERGY = 0.15;
    private static final double W_RELIABILITY = 0.10;
    private static final double W_OPPORTUNITY = 0.05;

    /**
     * Evalua la amenaza del equipo enemigo a partir de sus campeones.
     *
     * <p>Recorre cada campeon para sumar su perfil de dano y sus tags de CC, dispara
     * las reglas de la KB que apliquen (per-champion y, una sola vez, las de tag de
     * composicion como HEAVY_HEALING/HEAVY_ENGAGE) y normaliza el resultado a 0-100.
     * Devuelve tambien el perfil de dano dominante (AD/AP/MIXED) que guiara el scoring.
     */
    public ThreatAssessment assessThreat(
            List<Integer> enemyChampionIds,
            List<ThreatRule> activeRules,
            KnowledgeBasePort kb,
            String patchVersion) {

        Map<String, Integer> damageCount = new HashMap<>();
        List<String> allCcTags = new ArrayList<>();
        List<String> allAntiTags = new ArrayList<>();
        Set<String> triggeredRuleIds = new LinkedHashSet<>();
        int totalThreat = 0;
        int ruleCount = 0;

        // Detectar tags de composición agregados (HEAVY_HEALING, HEAVY_ENGAGE, ...)
        Set<String> compTags = detectCompositionTags(enemyChampionIds);

        for (int champId : enemyChampionIds) {
            // Obtener perfil de daño del campeón
            kb.findChampion(champId, patchVersion).ifPresent(champ -> {
                damageCount.merge(champ.damageProfile(), 1, Integer::sum);
            });

            // Obtener habilidades y sus tags
            List<AbilityData> abilities = kb.findAbilities(champId, patchVersion);
            for (AbilityData ability : abilities) {
                allCcTags.addAll(ability.crowdControlTags());
                allAntiTags.addAll(ability.antiMechanicsTags());
            }

            // Evaluar reglas de amenaza per-champion
            for (ThreatRule rule : activeRules) {
                // Reglas comp-tag se evalúan UNA sola vez (fuera del loop), no aquí
                if (rule.ifEnemyCompTag() != null) continue;

                if (ruleMatchesChampion(rule, champId, allCcTags, damageCount, compTags)) {
                    if (triggeredRuleIds.add(rule.ruleId())) {
                        totalThreat += rule.thenThreatScore();
                        ruleCount++;
                    }
                }
            }
        }

        // Reglas comp-tag se evalúan a nivel de equipo (una vez)
        for (ThreatRule rule : activeRules) {
            if (rule.ifEnemyCompTag() == null) continue;
            if (matchesCompTag(rule.ifEnemyCompTag(), damageCount, compTags)) {
                if (triggeredRuleIds.add(rule.ruleId())) {
                    totalThreat += rule.thenThreatScore();
                    ruleCount++;
                }
            }
        }

        // Normalizar amenaza a 0-100
        int normalizedThreat = ruleCount > 0
            ? Math.min(100, totalThreat / ruleCount)
            : 50; // default medio si no hay reglas

        // Determinar perfil de daño dominante
        String dominantProfile = damageCount.entrySet().stream()
            .max(Map.Entry.comparingByValue())
            .map(Map.Entry::getKey)
            .orElse("MIXED");

        // Si hay empate AD/AP, es MIXED
        if (damageCount.getOrDefault("AD", 0).equals(damageCount.getOrDefault("AP", 0))
                && damageCount.getOrDefault("AD", 0) > 0) {
            dominantProfile = "MIXED";
        }

        return new ThreatAssessment(
            normalizedThreat,
            dominantProfile,
            allCcTags.stream().distinct().collect(Collectors.toList()),
            allAntiTags.stream().distinct().collect(Collectors.toList()),
            new ArrayList<>(triggeredRuleIds)
        );
    }

    /**
     * Ejecuta el scoring completo sobre los items candidatos y devuelve la recomendacion.
     *
     * <p>Para cada item calcula los seis sub-scores, los combina con los pesos de la
     * formula, ordena de mayor a menor y se queda con el top 5. Calcula una confianza
     * agregada y, si queda por debajo de {@code CONFIDENCE_THRESHOLD} (0.40), devuelve
     * un fallback de baja confianza en vez de una recomendacion poco fiable.
     */
    public RecommendationResult computeRecommendation(
            MatchupContext context,
            ThreatAssessment threat,
            List<ItemCounter> candidateItems,
            List<MatchupStat> matchupStats) {

        if (candidateItems.isEmpty()) {
            return RecommendationResult.lowConfidenceFallback(
                POLICY_VERSION,
                List.of(createDefaultItem())
            );
        }

        List<ScoredItem> scoredItems = new ArrayList<>();

        for (ItemCounter item : candidateItems) {
            double threatMitigation = computeThreatMitigation(item, threat);
            double matchupValue = computeMatchupValue(item, matchupStats, context);
            double timingFit = computeTimingFit(item);
            double synergyScore = computeSynergy(item, context);
            double reliability = computeReliability(item, matchupStats);
            double opportunityCost = computeOpportunityCost(item, candidateItems);

            double total = W_THREAT * threatMitigation
                         + W_MATCHUP * matchupValue
                         + W_TIMING * timingFit
                         + W_SYNERGY * synergyScore
                         + W_RELIABILITY * reliability
                         - W_OPPORTUNITY * opportunityCost;

            double confidence = computeItemConfidence(reliability, matchupStats.size(), threat.triggeredRuleIds().size());

            String explanation = buildExplanation(item, threat, threatMitigation, matchupValue, confidence);

            scoredItems.add(new ScoredItem(
                item.counterItemId(),
                item.counterItemName(),
                Math.round(total * 100.0) / 100.0,
                threatMitigation,
                matchupValue,
                timingFit,
                synergyScore,
                reliability,
                opportunityCost,
                explanation,
                confidence
            ));
        }

        // Ordenar por score descendente (natural ordering de ScoredItem)
        Collections.sort(scoredItems);

        // Top 5 items
        List<ScoredItem> topItems = scoredItems.stream().limit(5).collect(Collectors.toList());

        // Calcular confianza agregada
        double avgConfidence = topItems.stream()
            .mapToDouble(ScoredItem::confidence)
            .average()
            .orElse(0.25);

        // Generar factores principales
        List<String> topFactors = generateTopFactors(threat, topItems);

        // Generar tradeoff
        String tradeoff = generateTradeoff(topItems, threat);

        // Si la confianza es muy baja, devolver fallback
        if (avgConfidence < CONFIDENCE_THRESHOLD) {
            return RecommendationResult.lowConfidenceFallback(POLICY_VERSION, topItems);
        }

        return new RecommendationResult(
            POLICY_VERSION,
            topItems,
            Math.round(avgConfidence * 100.0) / 100.0,
            topFactors,
            tradeoff,
            threat,
            LocalDateTime.now()
        );
    }

    // ─── Subscores ───────────────────────────────────────

    private double computeThreatMitigation(ItemCounter item, ThreatAssessment threat) {
        double score = 0;

        // Coincidencia de perfil de daño
        if (item.targetDamageProfile() != null && item.targetDamageProfile().equals(threat.damageProfile())) {
            score += 60;
        } else if ("MIXED".equals(threat.damageProfile())) {
            score += 30; // items generales tienen algo de valor contra MIXED
        }

        // Bonus por efectividad intrínseca del item
        score += item.effectivenessScore() * 0.4;

        return Math.min(100, score);
    }

    private double computeMatchupValue(ItemCounter item, List<MatchupStat> stats, MatchupContext context) {
        if (stats.isEmpty()) return 50; // neutral si no hay datos

        // Promedio ponderado de winrates adversos → mayor necesidad de counter
        double avgEnemyWinRate = stats.stream()
            .mapToDouble(MatchupStat::winRate)
            .average()
            .orElse(0.5);

        // Si los enemigos tienen alto winrate contra nosotros, el valor del counter sube
        double urgency = (1.0 - avgEnemyWinRate) * 100; // invertido: si perdemos mucho, más urgencia

        // Combinar con efectividad del item
        return Math.min(100, (urgency * 0.6) + (item.effectivenessScore() * 0.4));
    }

    private double computeTimingFit(ItemCounter item) {
        // Para Fase 1, simplificamos: EARLY/ALL son mejores para primera compra
        return switch (item.timingWindow()) {
            case "EARLY" -> 90;
            case "ALL"   -> 75;
            case "MID"   -> 55;
            case "LATE"  -> 30;
            default      -> 50;
        };
    }

    private double computeSynergy(ItemCounter item, MatchupContext context) {
        // Fase 1: sinergia básica por carril
        // Items defensivos tienen más sinergia en TOP/MID (lanes de 1v1)
        if ("TOP".equals(context.lane()) || "MID".equals(context.lane())) {
            if (item.targetDamageProfile() != null) return 70;
        }
        if ("BOT".equals(context.lane())) {
            // En BOT, items de supervivencia tienen valor extra
            return 65;
        }
        return 50; // neutral
    }

    private double computeReliability(ItemCounter item, List<MatchupStat> stats) {
        // Fiabilidad basada en: sample size de matchups + effectivenessScore
        if (stats.isEmpty()) return 30;

        double avgSample = stats.stream()
            .mapToInt(MatchupStat::sampleSize)
            .average()
            .orElse(0);

        double sampleReliability = Math.min(100, avgSample / 10.0); // 1000 partidas = 100%
        return (sampleReliability * 0.5) + (item.effectivenessScore() * 0.5);
    }

    private double computeOpportunityCost(ItemCounter item, List<ItemCounter> allItems) {
        // Coste de oportunidad: si hay items mucho mejores, este tiene coste alto
        double maxEffectiveness = allItems.stream()
            .mapToInt(ItemCounter::effectivenessScore)
            .max()
            .orElse(50);

        return Math.max(0, (maxEffectiveness - item.effectivenessScore()) * 1.0);
    }

    // ─── Helpers ─────────────────────────────────────────

    private double computeItemConfidence(double reliability, int matchupCount, int ruleCount) {
        double dataConfidence = Math.min(1.0, (matchupCount * 0.1 + ruleCount * 0.15));
        double reliabilityFactor = reliability / 100.0;
        return Math.round((dataConfidence * 0.5 + reliabilityFactor * 0.5) * 100.0) / 100.0;
    }

    private boolean ruleMatchesChampion(ThreatRule rule, int champId, List<String> ccTags,
                                         Map<String, Integer> dmgProfile, Set<String> compTags) {
        // Match por campeón específico
        if (rule.ifEnemyChampionId() != null && rule.ifEnemyChampionId() == champId) {
            return true;
        }
        // Match por tag de CC
        if (rule.ifEnemyAbilityTag() != null && ccTags.contains(rule.ifEnemyAbilityTag())) {
            return true;
        }
        return false;
    }

    /**
     * Evalúa una regla a nivel de COMPOSICIÓN (no per-champion).
     * Soporta: HEAVY_AD, HEAVY_AP, HEAVY_HEALING, HEAVY_ENGAGE,
     * HEAVY_SHIELDS, HYPER_CARRY, POKE_SIEGE, SPLIT_PUSH, BURST_PICK.
     */
    private boolean matchesCompTag(String compTag, Map<String, Integer> dmgProfile, Set<String> compTags) {
        if (compTag == null) return false;
        if ("HEAVY_AD".equals(compTag)) return dmgProfile.getOrDefault("AD", 0) >= 3;
        if ("HEAVY_AP".equals(compTag)) return dmgProfile.getOrDefault("AP", 0) >= 3;
        return compTags.contains(compTag);
    }

    /**
     * Detecta tags de composición agregados a partir de los IDs de campeones.
     * Cada tag se activa según los Sets predefinidos de roles funcionales LoL.
     */
    private Set<String> detectCompositionTags(List<Integer> enemyChampionIds) {
        Set<String> tags = new HashSet<>();
        int healers = 0, engagers = 0, shielders = 0, hypers = 0,
            pokers = 0, splitters = 0, assassins = 0, trueDmg = 0;

        for (int id : enemyChampionIds) {
            if (HEALING_CHAMPIONS.contains(id))   healers++;
            if (ENGAGE_INITIATORS.contains(id))   engagers++;
            if (SHIELD_GENERATORS.contains(id))   shielders++;
            if (HYPER_CARRIES.contains(id))       hypers++;
            if (POKE_CHAMPIONS.contains(id))      pokers++;
            if (SPLIT_PUSH_THREATS.contains(id))  splitters++;
            if (ASSASSIN_THREATS.contains(id))    assassins++;
            if (TRUE_DAMAGE_DEALERS.contains(id)) trueDmg++;
        }
        if (healers   >= 1) tags.add("HEAVY_HEALING");
        if (engagers  >= 2) tags.add("HEAVY_ENGAGE");
        if (shielders >= 2) tags.add("HEAVY_SHIELDS");
        if (hypers    >= 1) tags.add("HYPER_CARRY");
        if (pokers    >= 2) tags.add("POKE_SIEGE");
        if (splitters >= 1) tags.add("SPLIT_PUSH");
        if (assassins >= 2) tags.add("BURST_PICK");
        if (trueDmg   >= 2) tags.add("TRUE_DAMAGE_HEAVY");
        return tags;
    }

    // ─── Catálogos de roles funcionales (Riot patch ~14.x) ─────────────────
    // IDs reales de Data Dragon, agrupados por funcion de equipo para detectar
    // tags de composicion (curado/sano, enganche, escudos, hipercarry, etc.).
    private static final Set<Integer> HEALING_CHAMPIONS = Set.of(
        266, // Aatrox
        8,   // Vladimir
        19,  // Warwick
        36,  // Dr. Mundo
        50,  // Swain
        58,  // Renekton (W heal)
        875, // Sett (R heal)
        233, // Briar
        887, // Gwen
        122, // Darius (R heal)
        23,  // Tryndamere (W rage→ healing through R)
        11,  // Master Yi (Q reset/heal)
        5,   // Xin Zhao (W heal)
        114, // Fiora (R heal)
        245, // Ekko (R rewind)
        154, // Zac (P regen)
        517, // Sylas (E heal)
        16,  // Soraka
        350, // Yuumi
        267, // Nami
        37,  // Sona
        75,  // Nasus (Q lifesteal scaling)
        82,  // Mordekaiser (P shield + heal)
        43,  // Karma
        420  // Illaoi (E heal)
    );

    private static final Set<Integer> ENGAGE_INITIATORS = Set.of(
        54,  // Malphite (R)
        32,  // Amumu (R)
        59,  // Jarvan IV (R)
        89,  // Leona (E,R)
        111, // Nautilus (Q,R)
        120, // Hecarim (R)
        254, // Vi (R)
        516, // Ornn (R)
        12,  // Alistar (W,Q)
        875, // Sett (R)
        233, // Briar (R)
        154, // Zac (E,R)
        497, // Rakan (W)
        526, // Rell (W,R)
        72,  // Skarner (R)
        113, // Sejuani (R)
        56,  // Nocturne (R)
        57,  // Maokai (R)
        14   // Sion (R)
    );

    private static final Set<Integer> SHIELD_GENERATORS = Set.of(
        40,  // Janna (E)
        117, // Lulu (E)
        43,  // Karma (E)
        37,  // Sona (E)
        147, // Seraphine (E)
        15,  // Sivir (E)
        61,  // Orianna (E)
        875, // Sett (W)
        412, // Thresh (W)
        350, // Yuumi (E)
        235  // Senna (W root + indirect)
    );

    private static final Set<Integer> HYPER_CARRIES = Set.of(
        222, // Jinx
        96,  // Kog'Maw
        67,  // Vayne
        29,  // Twitch
        523, // Aphelios
        18,  // Tristana
        38,  // Kassadin
        45,  // Veigar
        11,  // Master Yi
        75,  // Nasus
        202, // Jhin
        221  // Zeri
    );

    private static final Set<Integer> POKE_CHAMPIONS = Set.of(
        126, // Jayce
        81,  // Ezreal
        101, // Xerath
        115, // Ziggs
        51,  // Caitlyn
        110, // Varus
        99,  // Lux
        76,  // Nidalee
        161, // Vel'Koz
        235, // Senna
        142, // Zoe
        268  // Azir
    );

    private static final Set<Integer> SPLIT_PUSH_THREATS = Set.of(
        114, // Fiora
        23,  // Tryndamere
        24,  // Jax
        164, // Camille
        83,  // Yorick
        875, // Sett
        86,  // Garen
        41,  // Gangplank
        84,  // Akali
        238, // Zed
        11,  // Master Yi
        104  // Graves
    );

    private static final Set<Integer> ASSASSIN_THREATS = Set.of(
        238, // Zed
        91,  // Talon
        246, // Qiyana
        107, // Rengar
        121, // Kha'Zix
        84,  // Akali
        131, // Diana
        245, // Ekko
        105, // Fizz
        55,  // Katarina
        7,   // LeBlanc
        28,  // Evelynn
        35,  // Shaco
        141, // Kayn
        56,  // Nocturne
        555  // Pyke
    );

    private static final Set<Integer> TRUE_DAMAGE_DEALERS = Set.of(
        67,  // Vayne (W)
        114, // Fiora (Vitals)
        164, // Camille (W)
        86,  // Garen (R)
        11,  // Master Yi (E)
        10,  // Kayle (R, true dmg execute late)
        31,  // Cho'Gath (R)
        161  // Vel'Koz (passive % true dmg)
    );

    private List<String> generateTopFactors(ThreatAssessment threat, List<ScoredItem> topItems) {
        List<String> factors = new ArrayList<>();

        factors.add("Perfil de daño enemigo: " + threat.damageProfile());
        factors.add("Nivel de amenaza: " + threat.threatScore() + "/100");

        if (!threat.ccTags().isEmpty()) {
            factors.add("CC detectado: " + String.join(", ", threat.ccTags()));
        }

        if (!topItems.isEmpty()) {
            ScoredItem best = topItems.get(0);
            factors.add("Item principal: " + best.itemName() + " (score " + String.format("%.1f", best.scoreTotal()) + ")");
        }

        return factors;
    }

    private String generateTradeoff(List<ScoredItem> topItems, ThreatAssessment threat) {
        if (topItems.size() < 2) return "Sin trade-off significativo";

        ScoredItem first = topItems.get(0);
        ScoredItem second = topItems.get(1);

        if (first.scoreTotal() - second.scoreTotal() < 5) {
            return first.itemName() + " y " + second.itemName()
                + " tienen scoring similar — priorizar según preferencia de juego";
        }

        return first.itemName() + " supera a " + second.itemName()
            + " en " + String.format("%.1f", first.scoreTotal() - second.scoreTotal())
            + " puntos — clara primera opción";
    }

    private String buildExplanation(ItemCounter item, ThreatAssessment threat,
                                     double threatMit, double matchupVal, double confidence) {
        StringBuilder sb = new StringBuilder();
        sb.append(item.counterItemName());

        if (item.explanation() != null && !item.explanation().isEmpty()) {
            sb.append(": ").append(item.explanation());
        }

        sb.append(" | Mitigación amenaza: ").append(String.format("%.0f", threatMit));
        sb.append(" | Valor matchup: ").append(String.format("%.0f", matchupVal));

        if (confidence < 0.5) {
            sb.append(" | ⚠ Confianza baja — datos limitados");
        }

        return sb.toString();
    }

    private ScoredItem createDefaultItem() {
        return new ScoredItem(
            "3047", "Plated Steelcaps",
            50.0, 50, 50, 50, 50, 30, 10,
            "Recomendación conservadora por defecto — datos insuficientes para personalizar",
            0.25
        );
    }
}
