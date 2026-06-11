package com.novarift.forge.infrastructure.adapters.out.persistence;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface SpringDataUserProgressRepository extends JpaRepository<UserProgressJpaEntity, Long> {
    Optional<UserProgressJpaEntity> findByRiotId(String riotId);
}
