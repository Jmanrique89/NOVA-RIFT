package com.novarift.forge.domain;

import java.util.Optional;

public interface UserProgressRepository {
    Optional<UserProgress> findByRiotId(String riotId);
    UserProgress save(UserProgress progress);
}
