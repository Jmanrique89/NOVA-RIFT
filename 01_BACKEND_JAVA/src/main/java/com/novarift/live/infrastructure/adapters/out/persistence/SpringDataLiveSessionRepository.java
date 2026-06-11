package com.novarift.live.infrastructure.adapters.out.persistence;

import org.springframework.data.jpa.repository.JpaRepository;

public interface SpringDataLiveSessionRepository extends JpaRepository<LiveSessionJpaEntity, Long> {
}
