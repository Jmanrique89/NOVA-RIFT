package com.novarift.live.infrastructure.adapters.out.knowledge.jpa;

import com.novarift.live.domain.knowledge.ChampionData;
import jakarta.persistence.*;

import java.util.Arrays;
import java.util.Collections;
import java.util.List;

/**
 * Entidad JPA para campeones de la KB.
 * Roles se persisten como CSV simple (compatible con scripts data.sql).
 */
@Entity
@Table(name = "KB_CHAMPIONS")
public class ChampionJpaEntity {

    @Id
    @Column(name = "champion_id")
    private Integer championId;

    @Column(name = "patch_version", length = 16, nullable = false)
    private String patchVersion;

    @Column(name = "key_name", length = 80)
    private String keyName;

    @Column(name = "display_name", length = 120)
    private String displayName;

    @Column(name = "roles_csv", length = 200)
    private String rolesCsv;

    @Column(name = "damage_profile", length = 16)
    private String damageProfile;

    public ChampionData toDomain() {
        List<String> roles = (rolesCsv == null || rolesCsv.isBlank())
            ? Collections.emptyList()
            : Arrays.asList(rolesCsv.split("\\s*,\\s*"));
        return new ChampionData(championId, keyName, displayName, roles, damageProfile, patchVersion);
    }

    // Getters / setters mínimos
    public Integer getChampionId() { return championId; }
    public void setChampionId(Integer championId) { this.championId = championId; }
    public String getPatchVersion() { return patchVersion; }
    public void setPatchVersion(String patchVersion) { this.patchVersion = patchVersion; }
    public String getKeyName() { return keyName; }
    public void setKeyName(String keyName) { this.keyName = keyName; }
    public String getDisplayName() { return displayName; }
    public void setDisplayName(String displayName) { this.displayName = displayName; }
    public String getRolesCsv() { return rolesCsv; }
    public void setRolesCsv(String rolesCsv) { this.rolesCsv = rolesCsv; }
    public String getDamageProfile() { return damageProfile; }
    public void setDamageProfile(String damageProfile) { this.damageProfile = damageProfile; }
}
