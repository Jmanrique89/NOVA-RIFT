package com.novarift.live.infrastructure.adapters.out.knowledge;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.novarift.live.domain.knowledge.*;
import com.novarift.live.domain.recommendation.KnowledgeBasePort;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import jakarta.annotation.PostConstruct;
import java.io.InputStream;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Adapter InMemory para la KB: carga seed data desde JSON en resources.
 * Versionado por patchVersion para queries filtradas.
 */
@Component
public class InMemoryKnowledgeBaseAdapter implements KnowledgeBasePort {

    private static final Logger log = LoggerFactory.getLogger(InMemoryKnowledgeBaseAdapter.class);
    private final ObjectMapper objectMapper = new ObjectMapper();

    private List<ChampionData> champions = new ArrayList<>();
    private List<ThreatRule> threatRules = new ArrayList<>();
    private List<ItemCounter> itemCounters = new ArrayList<>();
    private List<AbilityData> abilities = new ArrayList<>();

    @PostConstruct
    public void loadSeedData() {
        champions = loadJson("/knowledge/champions.json", new TypeReference<>() {});
        threatRules = loadJson("/knowledge/threat_rules.json", new TypeReference<>() {});
        itemCounters = loadJson("/knowledge/item_counters.json", new TypeReference<>() {});
        // Abilities se generan programáticamente para Fase 1
        abilities = generateAbilitySeed();
        log.info("KB cargada: {} campeones, {} reglas, {} items counter, {} habilidades",
            champions.size(), threatRules.size(), itemCounters.size(), abilities.size());
    }

    @Override
    public List<ThreatRule> findActiveRules(String patchVersion, String context) {
        return threatRules.stream()
            .filter(r -> r.enabled())
            .filter(r -> r.patchVersion().equals(patchVersion))
            .filter(r -> r.context().equals(context))
            .collect(Collectors.toList());
    }

    @Override
    public List<ItemCounter> findCountersForProfile(String damageProfile, String ccProfile, String patchVersion) {
        return itemCounters.stream()
            .filter(ic -> ic.patchVersion().equals(patchVersion))
            .filter(ic -> ic.targetDamageProfile().equals(damageProfile) || "MIXED".equals(ic.targetDamageProfile()))
            .collect(Collectors.toList());
    }

    @Override
    public Optional<ChampionData> findChampion(int championId, String patchVersion) {
        return champions.stream()
            .filter(c -> c.championId() == championId)
            .filter(c -> c.patchVersion().equals(patchVersion))
            .findFirst();
    }

    @Override
    public List<AbilityData> findAbilities(int championId, String patchVersion) {
        return abilities.stream()
            .filter(a -> a.championId() == championId)
            .collect(Collectors.toList());
    }

    @Override
    public List<ChampionData> findAllChampions(String patchVersion) {
        return champions.stream()
            .filter(c -> c.patchVersion().equals(patchVersion))
            .collect(Collectors.toList());
    }

    @Override
    public List<ItemCounter> findAllCounters(String patchVersion) {
        return itemCounters.stream()
            .filter(ic -> ic.patchVersion().equals(patchVersion))
            .collect(Collectors.toList());
    }

    private <T> List<T> loadJson(String path, TypeReference<List<T>> typeRef) {
        try (InputStream is = getClass().getResourceAsStream(path)) {
            if (is == null) {
                log.warn("KB seed file not found: {}", path);
                return new ArrayList<>();
            }
            return objectMapper.readValue(is, typeRef);
        } catch (Exception e) {
            log.error("Error loading KB seed {}: {}", path, e.getMessage());
            return new ArrayList<>();
        }
    }

    /**
     * Genera datos de habilidades básicas para campeones clave (Fase 1).
     */
    private List<AbilityData> generateAbilitySeed() {
        List<AbilityData> seed = new ArrayList<>();
        // Zed
        seed.add(new AbilityData("ZED-R", 238, "R", "Death Mark", "PHYSICAL", List.of(), List.of("ARMOR_PEN"), 120));
        seed.add(new AbilityData("ZED-W", 238, "W", "Living Shadow", "PHYSICAL", List.of("SLOW"), List.of(), 22));
        // Thresh
        seed.add(new AbilityData("THRESH-Q", 412, "Q", "Death Sentence", "MAGIC", List.of("STUN"), List.of(), 20));
        seed.add(new AbilityData("THRESH-E", 412, "E", "Flay", "MAGIC", List.of("KNOCKUP"), List.of(), 9));
        // Nautilus
        seed.add(new AbilityData("NAUT-P", 111, "P", "Staggering Blow", "PHYSICAL", List.of("ROOT"), List.of(), 0));
        seed.add(new AbilityData("NAUT-R", 111, "R", "Depth Charge", "MAGIC", List.of("KNOCKUP"), List.of(), 120));
        // Lux
        seed.add(new AbilityData("LUX-Q", 99, "Q", "Light Binding", "MAGIC", List.of("ROOT"), List.of(), 11));
        // Blitzcrank
        seed.add(new AbilityData("BLITZ-Q", 53, "Q", "Rocket Grab", "MAGIC", List.of("STUN"), List.of(), 20));
        seed.add(new AbilityData("BLITZ-R", 53, "R", "Static Field", "MAGIC", List.of("SILENCE"), List.of(), 60));
        // Lee Sin
        seed.add(new AbilityData("LEE-R", 64, "R", "Dragon's Rage", "PHYSICAL", List.of("KNOCKUP"), List.of(), 90));
        // Yasuo
        seed.add(new AbilityData("YASUO-Q3", 157, "Q", "Steel Tempest (3rd)", "PHYSICAL", List.of("KNOCKUP"), List.of(), 4));
        // Annie
        seed.add(new AbilityData("ANNIE-P", 1, "P", "Pyromania", "NONE", List.of("STUN"), List.of(), 0));
        // Diana
        seed.add(new AbilityData("DIANA-E", 131, "E", "Lunar Rush", "MAGIC", List.of("SLOW"), List.of("MAGIC_PEN"), 22));
        // Akali
        seed.add(new AbilityData("AKALI-R", 84, "R", "Perfect Execution", "MAGIC", List.of(), List.of("EXECUTE"), 100));
        // Vladimir
        seed.add(new AbilityData("VLAD-Q", 8, "Q", "Transfusion", "MAGIC", List.of(), List.of("ANTI_SHIELD"), 9));
        return seed;
    }
}
