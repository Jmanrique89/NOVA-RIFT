package com.novarift.live.application;

import com.novarift.live.application.recommendation.ComputeLiveRecommendationUseCase;
import com.novarift.live.domain.LiveSession;
import com.novarift.live.domain.LiveSessionRepository;
import com.novarift.live.domain.RiotMatchPort;
import com.novarift.live.domain.recommendation.MatchupContext;
import com.novarift.live.domain.recommendation.RecommendationResult;
import com.novarift.live.domain.recommendation.ScoredItem;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Implementacion del caso de uso de inicio de sesion live (capa application).
 *
 * <p>Coordina el puerto de salida {@link RiotMatchPort} (adaptador MOCK o REAL) para
 * obtener el draft enemigo, el {@link ComputeLiveRecommendationUseCase} para puntuar
 * la build, y el repositorio de dominio para persistir la sesion. Enriquece la build
 * "legacy" con el resultado del scoring y serializa el desglose a JSON.
 *
 * <p>Diseno tolerante a fallos: si el motor de recomendaciones lanza una excepcion,
 * cae al build legacy sin recomendacion en lugar de propagar el error, de modo que la
 * sesion siempre arranca. El parseo de IDs de campeon es defensivo y usa un draft de
 * ejemplo si no logra extraer ninguno.
 */
public class StartLiveSessionUseCaseImpl implements StartLiveSessionUseCase {

    private static final String CURRENT_PATCH = "14.24";

    private final LiveSessionRepository repository;
    private final RiotMatchPort riotMatchPort;
    private final ComputeLiveRecommendationUseCase recommendationUseCase;

    public StartLiveSessionUseCaseImpl(
            LiveSessionRepository repository,
            RiotMatchPort riotMatchPort,
            ComputeLiveRecommendationUseCase recommendationUseCase) {
        this.repository = repository;
        this.riotMatchPort = riotMatchPort;
        this.recommendationUseCase = recommendationUseCase;
    }

    @Override
    public LiveSession execute(String summonerName, String imageHash) {
        return executeEnriched(summonerName, imageHash).session();
    }

    @Override
    public LiveSessionStartResult executeEnriched(String summonerName, String imageHash) {
        // 1. Obtener draft enemigo del adapter Riot (MOCK o REAL)
        final var enemyDraft = riotMatchPort.getEnemyDraftAnalysis(summonerName, imageHash);

        // 2. Build legacy del adapter (fallback)
        final var legacyBuild = riotMatchPort.getRecommendedBuild(enemyDraft);

        // 3. Intentar motor inteligente de recomendaciones
        try {
            List<Integer> enemyChampionIds = extractChampionIds(enemyDraft);
            MatchupContext context = MatchupContext.forUnknownOwn(enemyChampionIds, CURRENT_PATCH);

            RecommendationResult result = recommendationUseCase.compute(context);

            // Enriquecer la build legacy con scoring
            String enrichedBuild = enrichBuildWithScoring(legacyBuild, result);
            String breakdown = buildBreakdownJson(result);

            final var session = LiveSession.startWithScoring(
                summonerName,
                enemyDraft,
                enrichedBuild,
                result.policyVersion(),
                result.items().isEmpty() ? 0.0 : result.items().get(0).scoreTotal(),
                breakdown,
                result.confidence()
            );
            return LiveSessionStartResult.enriched(repository.save(session), result);

        } catch (Exception e) {
            // Fallback: si el motor de recomendaciones falla, usar build legacy sin bloquear
            System.err.println("Recommendation engine fallback: " + e.getMessage());
            final var session = LiveSession.startNew(summonerName, enemyDraft, legacyBuild);
            return LiveSessionStartResult.legacy(repository.save(session));
        }
    }

    /**
     * Extrae IDs de campeones del JSON de draft (parsing defensivo).
     */
    private List<Integer> extractChampionIds(String draftJson) {
        List<Integer> ids = new ArrayList<>();
        try {
            // Buscar patron "championId": XXX en el JSON
            String search = "\"championId\"";
            int idx = 0;
            while ((idx = draftJson.indexOf(search, idx)) != -1) {
                int colonIdx = draftJson.indexOf(":", idx + search.length());
                if (colonIdx == -1) break;

                StringBuilder num = new StringBuilder();
                for (int i = colonIdx + 1; i < draftJson.length(); i++) {
                    char c = draftJson.charAt(i);
                    if (Character.isDigit(c)) {
                        num.append(c);
                    } else if (num.length() > 0) {
                        break;
                    }
                }
                if (num.length() > 0) {
                    ids.add(Integer.parseInt(num.toString()));
                }
                idx = colonIdx + 1;
            }
        } catch (Exception e) {
            // Si falla el parsing, retornar lista vacía (el motor usará defaults)
        }

        // Si no se encuentran IDs reales, usar campeones de ejemplo para que el motor funcione
        if (ids.isEmpty()) {
            ids.addAll(List.of(238, 64, 99, 222, 412)); // Zed, Lee Sin, Lux, Jinx, Thresh
        }
        return ids;
    }

    /**
     * Enriquece la build legacy con los items del scoring.
     */
    private String enrichBuildWithScoring(String legacyBuild, RecommendationResult result) {
        if (result.items().isEmpty()) return legacyBuild;

        StringBuilder sb = new StringBuilder();
        sb.append("{ \"primaryTarget\": \"Optimización por Motor Inteligente v")
          .append(result.policyVersion()).append("\", ");
        sb.append("\"items\": [");

        List<String> itemNames = result.items().stream()
            .map(ScoredItem::itemName)
            .collect(Collectors.toList());

        for (int i = 0; i < itemNames.size(); i++) {
            if (i > 0) sb.append(", ");
            sb.append("\"").append(itemNames.get(i)).append("\"");
        }
        sb.append("], ");

        sb.append("\"tactics\": \"").append(result.tradeoffPrincipal() != null
            ? result.tradeoffPrincipal().replace("\"", "'") : "Scoring inteligente aplicado").append("\", ");

        sb.append("\"variants\": [");
        // Generar variantes desde scoring
        for (int i = 0; i < Math.min(3, result.items().size()); i++) {
            ScoredItem item = result.items().get(i);
            if (i > 0) sb.append(", ");
            sb.append("{ \"name\": \"").append(item.itemName()).append(" Build\", ");
            sb.append("\"primaryTarget\": \"").append(item.explanation() != null
                ? item.explanation().replace("\"", "'").substring(0, Math.min(60, item.explanation().length()))
                : "Scoring").append("\", ");
            sb.append("\"items\": [\"").append(item.itemName()).append("\"], ");
            sb.append("\"tactics\": \"Score: ").append(String.format("%.1f", item.scoreTotal()))
              .append(" | Confianza: ").append(String.format("%.0f%%", item.confidence() * 100))
              .append("\" }");
        }
        sb.append("] }");

        return sb.toString();
    }

    /**
     * Serializa el breakdown de la recomendación a JSON.
     */
    private String buildBreakdownJson(RecommendationResult result) {
        StringBuilder sb = new StringBuilder("{");
        sb.append("\"policyVersion\":\"").append(result.policyVersion()).append("\",");
        sb.append("\"confidence\":").append(String.format("%.2f", result.confidence())).append(",");

        sb.append("\"topFactors\":[");
        for (int i = 0; i < result.topFactors().size(); i++) {
            if (i > 0) sb.append(",");
            sb.append("\"").append(result.topFactors().get(i).replace("\"", "'")).append("\"");
        }
        sb.append("],");

        sb.append("\"tradeoff\":\"").append(
            result.tradeoffPrincipal() != null ? result.tradeoffPrincipal().replace("\"", "'") : ""
        ).append("\",");

        sb.append("\"threat\":{");
        sb.append("\"score\":").append(result.threatAssessment().threatScore()).append(",");
        sb.append("\"damageProfile\":\"").append(result.threatAssessment().damageProfile()).append("\",");
        sb.append("\"ccTags\":").append(result.threatAssessment().ccTags()).append(",");
        sb.append("\"rulesTriggered\":").append(result.threatAssessment().triggeredRuleIds().size());
        sb.append("},");

        sb.append("\"items\":[");
        for (int i = 0; i < result.items().size(); i++) {
            ScoredItem item = result.items().get(i);
            if (i > 0) sb.append(",");
            sb.append("{\"name\":\"").append(item.itemName()).append("\",");
            sb.append("\"score\":").append(String.format("%.2f", item.scoreTotal())).append(",");
            sb.append("\"threat\":").append(String.format("%.0f", item.threatMitigation())).append(",");
            sb.append("\"matchup\":").append(String.format("%.0f", item.matchupValue())).append(",");
            sb.append("\"timing\":").append(String.format("%.0f", item.timingFit())).append(",");
            sb.append("\"synergy\":").append(String.format("%.0f", item.synergyScore())).append(",");
            sb.append("\"confidence\":").append(String.format("%.2f", item.confidence())).append("}");
        }
        sb.append("]");

        sb.append("}");
        return sb.toString();
    }
}
