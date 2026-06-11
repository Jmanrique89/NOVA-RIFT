package com.novarift.riot.domain.model;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

/**
 * Tests de los métodos derivados de {@link RankedEntry}: winrate y label.
 */
class RankedEntryTest {

    @Test
    @DisplayName("winrate() con 0 partidas devuelve 0")
    void winrateZeroGamesReturnsZero() {
        RankedEntry e = new RankedEntry("RANKED_SOLO_5x5", "GOLD", "II", 47, 0, 0);
        assertEquals(0, e.winrate());
    }

    @Test
    @DisplayName("winrate() redondea a entero más cercano")
    void winrateRoundsToNearestInt() {
        // 60 wins / 100 total = 60% exacto
        assertEquals(60, new RankedEntry("RANKED_SOLO_5x5", "GOLD", "II", 47, 60, 40).winrate());
        // 7 wins / 13 total = 53.8% → 54
        assertEquals(54, new RankedEntry("RANKED_SOLO_5x5", "GOLD", "II", 47, 7, 6).winrate());
        // 1 win / 3 total = 33.3% → 33
        assertEquals(33, new RankedEntry("RANKED_SOLO_5x5", "GOLD", "II", 47, 1, 2).winrate());
    }

    @Test
    @DisplayName("label() formatea 'Gold II · 47 LP'")
    void labelFormatsTierDivisionLp() {
        RankedEntry e = new RankedEntry("RANKED_SOLO_5x5", "GOLD", "II", 47, 60, 40);
        assertEquals("Gold II · 47 LP", e.label());
    }

    @Test
    @DisplayName("label() omite division en Master+")
    void labelOmitsDivisionWhenBlank() {
        RankedEntry e = new RankedEntry("RANKED_SOLO_5x5", "MASTER", "", 152, 100, 80);
        assertEquals("Master · 152 LP", e.label());
    }

    @Test
    @DisplayName("label() devuelve 'Unranked' para tier=UNRANKED")
    void labelUnrankedReturnsUnranked() {
        assertEquals("Unranked", RankedEntry.unranked().label());
    }

    @Test
    @DisplayName("unranked() factory devuelve entry vacía consistente")
    void unrankedFactoryReturnsEmptyEntry() {
        RankedEntry e = RankedEntry.unranked();
        assertEquals("UNRANKED", e.queueType());
        assertEquals("UNRANKED", e.tier());
        assertEquals(0, e.leaguePoints());
        assertEquals(0, e.wins());
        assertEquals(0, e.losses());
        assertEquals(0, e.winrate());
    }
}
