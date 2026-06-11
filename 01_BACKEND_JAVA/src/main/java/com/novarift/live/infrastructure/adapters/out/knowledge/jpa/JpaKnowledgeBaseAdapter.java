package com.novarift.live.infrastructure.adapters.out.knowledge.jpa;

import com.novarift.live.domain.knowledge.AbilityData;
import com.novarift.live.domain.knowledge.ChampionData;
import com.novarift.live.domain.knowledge.ItemCounter;
import com.novarift.live.domain.knowledge.ThreatRule;
import com.novarift.live.domain.recommendation.KnowledgeBasePort;
import com.novarift.live.infrastructure.adapters.out.knowledge.InMemoryKnowledgeBaseAdapter;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

/**
 * Adaptador de salida (driven adapter) de la base de conocimiento respaldado por JPA
 * (H2 en dev/tests, Oracle en produccion).
 *
 * <p>Implementa el puerto {@link KnowledgeBasePort}: el dominio consulta campeones,
 * reglas e items counter sin saber que detras hay una BD. Marcado como {@link Primary},
 * toma precedencia sobre {@link InMemoryKnowledgeBaseAdapter} cuando ambos beans coexisten,
 * de modo que la fuente de verdad sea la base de datos.
 *
 * <p>Las habilidades ({@link AbilityData}) se delegan al adapter en memoria por ahora,
 * ya que su modelado relacional con tags repetibles anade complejidad innecesaria para
 * esta fase. Ademas, si la BD esta vacia (p.ej. tests sin data.sql) delega todo al
 * adapter en memoria para no romper el flujo.
 */
@Component
@Primary
public class JpaKnowledgeBaseAdapter implements KnowledgeBasePort {

    private static final Logger log = LoggerFactory.getLogger(JpaKnowledgeBaseAdapter.class);

    private final SpringDataChampionRepository championRepo;
    private final SpringDataItemCounterRepository itemCounterRepo;
    private final SpringDataThreatRuleRepository threatRuleRepo;
    private final InMemoryKnowledgeBaseAdapter inMemoryFallback;

    public JpaKnowledgeBaseAdapter(
            SpringDataChampionRepository championRepo,
            SpringDataItemCounterRepository itemCounterRepo,
            SpringDataThreatRuleRepository threatRuleRepo,
            InMemoryKnowledgeBaseAdapter inMemoryFallback) {
        this.championRepo = championRepo;
        this.itemCounterRepo = itemCounterRepo;
        this.threatRuleRepo = threatRuleRepo;
        this.inMemoryFallback = inMemoryFallback;
    }

    @Override
    @Cacheable(value = "threatRules", key = "#patchVersion + '-' + #context")
    public List<ThreatRule> findActiveRules(String patchVersion, String context) {
        try {
            List<ThreatRule> jpa = threatRuleRepo
                .findAllByPatchVersionAndContextAndEnabledTrue(patchVersion, context)
                .stream()
                .map(ThreatRuleJpaEntity::toDomain)
                .collect(Collectors.toList());
            if (!jpa.isEmpty()) return jpa;
        } catch (Exception e) {
            log.warn("[KB-JPA] Falló la lectura de reglas, fallback a memoria: {}", e.getMessage());
        }
        return inMemoryFallback.findActiveRules(patchVersion, context);
    }

    @Override
    @Cacheable(value = "itemCounters", key = "#damageProfile + '-' + #ccProfile + '-' + #patchVersion")
    public List<ItemCounter> findCountersForProfile(String damageProfile, String ccProfile, String patchVersion) {
        try {
            List<ItemCounter> jpa = itemCounterRepo.findAllByPatchVersion(patchVersion).stream()
                .map(ItemCounterJpaEntity::toDomain)
                .filter(ic -> ic.targetDamageProfile() != null
                    && (ic.targetDamageProfile().equals(damageProfile) || "MIXED".equals(ic.targetDamageProfile())))
                .collect(Collectors.toList());
            if (!jpa.isEmpty()) return jpa;
        } catch (Exception e) {
            log.warn("[KB-JPA] Falló la lectura de counters, fallback a memoria: {}", e.getMessage());
        }
        return inMemoryFallback.findCountersForProfile(damageProfile, ccProfile, patchVersion);
    }

    /**
     * Audit v3 / Bloque 1.3: cacheado en memoria para evitar 30+ queries kb_champions
     * por cada llamada al motor (1 query por campeón enemigo). El TTL es la vida de la JVM.
     * Spring usa ConcurrentMap por defecto, no requiere infra extra.
     */
    @Override
    @Cacheable(value = "champions", key = "#championId + '-' + #patchVersion")
    public Optional<ChampionData> findChampion(int championId, String patchVersion) {
        try {
            Optional<ChampionData> jpa = championRepo
                .findByChampionIdAndPatchVersion(championId, patchVersion)
                .map(ChampionJpaEntity::toDomain);
            if (jpa.isPresent()) return jpa;
        } catch (Exception e) {
            log.warn("[KB-JPA] Falló la lectura de campeón {}, fallback a memoria: {}", championId, e.getMessage());
        }
        return inMemoryFallback.findChampion(championId, patchVersion);
    }

    @Override
    public List<AbilityData> findAbilities(int championId, String patchVersion) {
        // Fase 1: las habilidades no están persistidas en JPA, delegamos a InMemory
        return inMemoryFallback.findAbilities(championId, patchVersion);
    }

    @Override
    public List<ChampionData> findAllChampions(String patchVersion) {
        try {
            List<ChampionData> jpa = championRepo.findAllByPatchVersion(patchVersion).stream()
                .map(ChampionJpaEntity::toDomain)
                .collect(Collectors.toList());
            if (!jpa.isEmpty()) return jpa;
        } catch (Exception e) {
            log.warn("[KB-JPA] Falló la lectura de campeones, fallback a memoria: {}", e.getMessage());
        }
        return inMemoryFallback.findAllChampions(patchVersion);
    }

    @Override
    public List<ItemCounter> findAllCounters(String patchVersion) {
        try {
            List<ItemCounter> jpa = itemCounterRepo.findAllByPatchVersion(patchVersion).stream()
                .map(ItemCounterJpaEntity::toDomain)
                .collect(Collectors.toList());
            if (!jpa.isEmpty()) return jpa;
        } catch (Exception e) {
            log.warn("[KB-JPA] Falló la lectura de counters, fallback a memoria: {}", e.getMessage());
        }
        return inMemoryFallback.findAllCounters(patchVersion);
    }
}
