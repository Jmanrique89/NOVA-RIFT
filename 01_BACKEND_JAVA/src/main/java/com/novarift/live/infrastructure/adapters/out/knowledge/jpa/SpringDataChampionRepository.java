package com.novarift.live.infrastructure.adapters.out.knowledge.jpa;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface SpringDataChampionRepository extends JpaRepository<ChampionJpaEntity, Integer> {
    Optional<ChampionJpaEntity> findByChampionIdAndPatchVersion(Integer championId, String patchVersion);
    List<ChampionJpaEntity> findAllByPatchVersion(String patchVersion);
}
