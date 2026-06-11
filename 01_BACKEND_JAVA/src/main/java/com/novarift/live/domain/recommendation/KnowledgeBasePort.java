package com.novarift.live.domain.recommendation;

import com.novarift.live.domain.knowledge.AbilityData;
import com.novarift.live.domain.knowledge.ChampionData;
import com.novarift.live.domain.knowledge.ItemCounter;
import com.novarift.live.domain.knowledge.ThreatRule;

import java.util.List;
import java.util.Optional;

/**
 * Puerto de dominio para acceder a la base de conocimiento versionada.
 * El dominio NO sabe si la KB está en memoria, en BD o en remoto.
 */
public interface KnowledgeBasePort {

    List<ThreatRule> findActiveRules(String patchVersion, String context);

    List<ItemCounter> findCountersForProfile(String damageProfile, String ccProfile, String patchVersion);

    Optional<ChampionData> findChampion(int championId, String patchVersion);

    List<AbilityData> findAbilities(int championId, String patchVersion);

    List<ChampionData> findAllChampions(String patchVersion);

    List<ItemCounter> findAllCounters(String patchVersion);
}
