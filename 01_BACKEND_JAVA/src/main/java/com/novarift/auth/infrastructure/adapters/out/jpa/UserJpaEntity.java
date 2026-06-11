package com.novarift.auth.infrastructure.adapters.out.jpa;

import jakarta.persistence.*;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * Tabla USERS — espejo JPA del aggregate User.
 * Incluye campos de administración: role, banned, lastLoginAt.
 */
@Entity
@Table(name = "USERS",
       uniqueConstraints = {
           @UniqueConstraint(name = "uk_users_username", columnNames = "username"),
           @UniqueConstraint(name = "uk_users_email",    columnNames = "email"),
       })
public class UserJpaEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "username", length = 50, nullable = false)
    private String username;

    @Column(name = "email", length = 100, nullable = false)
    private String email;

    @Column(name = "password_hash", length = 255, nullable = false)
    private String passwordHash;

    @Column(name = "faction", length = 20)
    private String faction;

    @Column(name = "main_role", length = 20)
    private String mainRole;

    @Column(name = "secondary_role", length = 20)
    private String secondaryRole;

    @Column(name = "playstyle", length = 20)
    private String playstyle;

    @Column(name = "setup_complete", nullable = false)
    private boolean setupComplete = false;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @OneToMany(mappedBy = "user", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.EAGER)
    private List<UserChampionJpaEntity> champions = new ArrayList<>();

    @Column(name = "role", length = 10, nullable = false)
    private String role = "USER";

    @Column(name = "banned", nullable = false)
    private boolean banned = false;

    @Column(name = "last_login_at")
    private LocalDateTime lastLoginAt;

    // Getters / setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public String getPasswordHash() { return passwordHash; }
    public void setPasswordHash(String passwordHash) { this.passwordHash = passwordHash; }
    public String getFaction() { return faction; }
    public void setFaction(String faction) { this.faction = faction; }
    public String getMainRole() { return mainRole; }
    public void setMainRole(String mainRole) { this.mainRole = mainRole; }
    public String getSecondaryRole() { return secondaryRole; }
    public void setSecondaryRole(String secondaryRole) { this.secondaryRole = secondaryRole; }
    public String getPlaystyle() { return playstyle; }
    public void setPlaystyle(String playstyle) { this.playstyle = playstyle; }
    public boolean isSetupComplete() { return setupComplete; }
    public void setSetupComplete(boolean setupComplete) { this.setupComplete = setupComplete; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public List<UserChampionJpaEntity> getChampions() { return champions; }
    public void setChampions(List<UserChampionJpaEntity> champions) { this.champions = champions; }
    public String getRole() { return role; }
    public void setRole(String role) { this.role = role; }
    public boolean isBanned() { return banned; }
    public void setBanned(boolean banned) { this.banned = banned; }
    public LocalDateTime getLastLoginAt() { return lastLoginAt; }
    public void setLastLoginAt(LocalDateTime lastLoginAt) { this.lastLoginAt = lastLoginAt; }
}
