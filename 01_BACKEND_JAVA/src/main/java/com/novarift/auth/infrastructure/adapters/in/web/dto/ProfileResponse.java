package com.novarift.auth.infrastructure.adapters.in.web.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.novarift.auth.domain.model.User;
import com.novarift.auth.domain.model.UserChampionPick;

import java.util.List;
import java.util.stream.Collectors;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record ProfileResponse(
    Long userId,
    String username,
    String email,
    String faction,
    String mainRole,
    String secondaryRole,
    String playstyle,
    boolean setupComplete,
    List<ChampionDto> champions,
    String role
) {
    public record ChampionDto(String championId, int priority) {}

    public static ProfileResponse from(User user) {
        List<ChampionDto> champs = user.champions() == null ? List.of()
            : user.champions().stream()
                .map(c -> new ChampionDto(c.championId(), c.priority()))
                .collect(Collectors.toList());
        return new ProfileResponse(
            user.id(), user.username(), user.email(),
            user.faction(), user.mainRole(), user.secondaryRole(), user.playstyle(),
            user.setupComplete(), champs,
            user.role()
        );
    }
}
