package com.novarift.live.infrastructure.adapters.out.knowledge.jpa;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface SpringDataItemCounterRepository extends JpaRepository<ItemCounterJpaEntity, String> {
    List<ItemCounterJpaEntity> findAllByPatchVersion(String patchVersion);
}
