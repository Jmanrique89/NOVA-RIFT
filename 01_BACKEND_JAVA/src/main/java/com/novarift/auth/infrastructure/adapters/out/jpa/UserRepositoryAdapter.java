package com.novarift.auth.infrastructure.adapters.out.jpa;

import com.novarift.auth.domain.model.User;
import com.novarift.auth.domain.model.UserChampionPick;
import com.novarift.auth.domain.port.out.UserRepositoryPort;
import org.springframework.stereotype.Repository;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

/**
 * Adaptador hexagonal: traduce entre el dominio puro (User record) y JPA.
 */
@Repository
public class UserRepositoryAdapter implements UserRepositoryPort {

    private final SpringDataUserRepository springRepo;

    public UserRepositoryAdapter(SpringDataUserRepository springRepo) {
        this.springRepo = springRepo;
    }

    @Override
    public User save(User user) {
        UserJpaEntity entity = (user.id() != null)
            ? springRepo.findById(user.id()).orElse(new UserJpaEntity())
            : new UserJpaEntity();

        entity.setUsername(user.username());
        entity.setEmail(user.email());
        entity.setPasswordHash(user.passwordHash());
        entity.setFaction(user.faction());
        entity.setMainRole(user.mainRole());
        entity.setSecondaryRole(user.secondaryRole());
        entity.setPlaystyle(user.playstyle());
        entity.setSetupComplete(user.setupComplete());
        entity.setRole(user.role() != null ? user.role() : "USER");
        entity.setBanned(user.banned());
        entity.setLastLoginAt(user.lastLoginAt());
        if (entity.getCreatedAt() == null) {
            entity.setCreatedAt(user.createdAt() != null ? user.createdAt() : java.time.LocalDateTime.now());
        }

        entity.getChampions().clear();
        if (user.champions() != null) {
            for (UserChampionPick pick : user.champions()) {
                UserChampionJpaEntity champEntity = new UserChampionJpaEntity();
                champEntity.setUser(entity);
                champEntity.setChampionId(pick.championId());
                champEntity.setPriority(pick.priority());
                entity.getChampions().add(champEntity);
            }
        }

        UserJpaEntity saved = springRepo.save(entity);
        return toDomain(saved);
    }

    @Override
    public Optional<User> findById(Long id) {
        return springRepo.findById(id).map(this::toDomain);
    }

    @Override
    public Optional<User> findByUsername(String username) {
        return springRepo.findByUsername(username).map(this::toDomain);
    }

    @Override
    public Optional<User> findByEmail(String email) {
        return springRepo.findByEmail(email).map(this::toDomain);
    }

    @Override
    public boolean existsByUsername(String username) {
        return springRepo.existsByUsername(username);
    }

    @Override
    public boolean existsByEmail(String email) {
        return springRepo.existsByEmail(email);
    }

    @Override
    public List<User> findAll() {
        return springRepo.findAll().stream().map(this::toDomain).toList();
    }

    @Override
    public void deleteById(Long id) {
        springRepo.deleteById(id);
    }

    @Override
    public long count() {
        return springRepo.count();
    }

    // ─── Mappers ───────────────────────────────────────────────────────────
    private User toDomain(UserJpaEntity e) {
        List<UserChampionPick> picks = new ArrayList<>();
        if (e.getChampions() != null) {
            for (UserChampionJpaEntity c : e.getChampions()) {
                picks.add(new UserChampionPick(c.getId(), c.getChampionId(), c.getPriority()));
            }
        }
        return new User(
            e.getId(),
            e.getUsername(),
            e.getEmail(),
            e.getPasswordHash(),
            e.getFaction(),
            e.getMainRole(),
            e.getSecondaryRole(),
            e.getPlaystyle(),
            e.isSetupComplete(),
            e.getCreatedAt(),
            picks,
            e.getRole(),
            e.isBanned(),
            e.getLastLoginAt()
        );
    }
}
