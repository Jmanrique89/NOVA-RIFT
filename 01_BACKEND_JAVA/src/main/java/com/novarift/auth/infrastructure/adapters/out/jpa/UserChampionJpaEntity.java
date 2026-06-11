package com.novarift.auth.infrastructure.adapters.out.jpa;

import jakarta.persistence.*;

@Entity
@Table(name = "USER_CHAMPIONS")
public class UserChampionJpaEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private UserJpaEntity user;

    @Column(name = "champion_id", length = 50, nullable = false)
    private String championId;

    @Column(name = "priority", nullable = false)
    private int priority;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public UserJpaEntity getUser() { return user; }
    public void setUser(UserJpaEntity user) { this.user = user; }
    public String getChampionId() { return championId; }
    public void setChampionId(String championId) { this.championId = championId; }
    public int getPriority() { return priority; }
    public void setPriority(int priority) { this.priority = priority; }
}
