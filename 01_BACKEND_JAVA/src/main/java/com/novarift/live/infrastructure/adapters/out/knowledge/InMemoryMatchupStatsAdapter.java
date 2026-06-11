package com.novarift.live.infrastructure.adapters.out.knowledge;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.novarift.live.domain.knowledge.MatchupStat;
import com.novarift.live.domain.recommendation.MatchupStatsPort;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import jakarta.annotation.PostConstruct;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

/**
 * Adapter InMemory para estadísticas de Matchups: carga seed data desde JSON en resources.
 */
@Component
public class InMemoryMatchupStatsAdapter implements MatchupStatsPort {

    private static final Logger log = LoggerFactory.getLogger(InMemoryMatchupStatsAdapter.class);
    private final ObjectMapper objectMapper = new ObjectMapper();

    private List<MatchupStat> matchupStats = new ArrayList<>();

    @PostConstruct
    public void loadSeedData() {
        try (InputStream is = getClass().getResourceAsStream("/knowledge/matchup_stats.json")) {
            if (is == null) {
                log.warn("Matchup stats seed file not found");
                return;
            }
            matchupStats = objectMapper.readValue(is, new TypeReference<>() {});
            log.info("Matchup stats cargadas: {}", matchupStats.size());
        } catch (Exception e) {
            log.error("Error loading Matchup stats seed: {}", e.getMessage());
        }
    }

    @Override
    public Optional<MatchupStat> findMatchup(int championId, int versusChampionId, String lane, String patchVersion) {
        return matchupStats.stream()
            .filter(m -> m.patchVersion().equals(patchVersion))
            .filter(m -> m.lane().equals(lane))
            .filter(m -> m.championId() == championId && m.versusChampionId() == versusChampionId)
            .findFirst();
    }

    @Override
    public List<MatchupStat> findAllVersus(int championId, String patchVersion) {
        return matchupStats.stream()
            .filter(m -> m.patchVersion().equals(patchVersion))
            .filter(m -> m.championId() == championId)
            .collect(Collectors.toList());
    }
}
