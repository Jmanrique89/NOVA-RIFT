package com.novarift.forge.infrastructure.adapters.out.persistence;

import com.novarift.forge.domain.UserProgress;
import com.novarift.forge.domain.UserProgressRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public class UserProgressRepositoryAdapter implements UserProgressRepository {

    private final SpringDataUserProgressRepository springDataRepo;

    public UserProgressRepositoryAdapter(SpringDataUserProgressRepository springDataRepo) {
        this.springDataRepo = springDataRepo;
    }

    @Override
    public Optional<UserProgress> findByRiotId(String riotId) {
        return springDataRepo.findByRiotId(riotId).map(this::fromInfra);
    }

    @Override
    public UserProgress save(UserProgress progress) {
        UserProgressJpaEntity entity = toInfra(progress);
        UserProgressJpaEntity savedEntity = springDataRepo.save(entity);
        return fromInfra(savedEntity);
    }

    private UserProgressJpaEntity toInfra(UserProgress progress) {
        UserProgressJpaEntity entity = new UserProgressJpaEntity();
        entity.setId(progress.id());
        entity.setRiotId(progress.riotId());
        entity.setCurrentCsMin(progress.currentCsMin());
        entity.setTargetCsMin(progress.targetCsMin());
        entity.setVisionScore(progress.visionScore());
        entity.setForgesCompleted(progress.forgesCompleted());
        entity.setKda(progress.kda());
        entity.setKillParticipation(progress.killParticipation());
        entity.setLastUpdated(progress.lastUpdated());
        return entity;
    }

    private UserProgress fromInfra(UserProgressJpaEntity entity) {
        return new UserProgress(
            entity.getId(),
            entity.getRiotId(),
            entity.getCurrentCsMin(),
            entity.getTargetCsMin(),
            entity.getVisionScore(),
            entity.getForgesCompleted(),
            entity.getKda(),
            entity.getKillParticipation(),
            entity.getLastUpdated()
        );
    }
}
