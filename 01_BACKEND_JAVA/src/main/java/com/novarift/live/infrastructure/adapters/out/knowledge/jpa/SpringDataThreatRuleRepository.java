package com.novarift.live.infrastructure.adapters.out.knowledge.jpa;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface SpringDataThreatRuleRepository extends JpaRepository<ThreatRuleJpaEntity, String> {
    List<ThreatRuleJpaEntity> findAllByPatchVersionAndContextAndEnabledTrue(String patchVersion, String context);
    List<ThreatRuleJpaEntity> findAllByPatchVersionAndEnabledTrue(String patchVersion);
}
