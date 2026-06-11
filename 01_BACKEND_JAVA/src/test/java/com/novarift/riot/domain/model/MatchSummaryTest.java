package com.novarift.riot.domain.model;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class MatchSummaryTest {

    @Test
    @DisplayName("kda() con 0 deaths se calcula como si fuera 1")
    void kdaWithZeroDeathsTreatsAsOne() {
        MatchSummary m = new MatchSummary("EUW1_1", "Lucian", "BOTTOM", "WIN",
                10, 0, 5, 200, 25, 20, 30000);
        // (10+5)/1 = 15.0
        assertEquals(15.0, m.kda());
    }

    @Test
    @DisplayName("kda() redondea a 1 decimal")
    void kdaRoundsTo1Decimal() {
        MatchSummary m = new MatchSummary("EUW1_1", "Lucian", "BOTTOM", "WIN",
                7, 3, 4, 200, 25, 20, 30000);
        // (7+4)/3 = 3.666 → 3.7
        assertEquals(3.7, m.kda());
    }

    @Test
    @DisplayName("csPerMin() con duración 0 devuelve 0")
    void csPerMinZeroDurationReturnsZero() {
        MatchSummary m = new MatchSummary("EUW1_1", "Lucian", "BOTTOM", "WIN",
                10, 3, 5, 200, 0, 20, 30000);
        assertEquals(0, m.csPerMin());
    }

    @Test
    @DisplayName("csPerMin() típico ~ 8 cs/min")
    void csPerMinTypical() {
        MatchSummary m = new MatchSummary("EUW1_1", "Lucian", "BOTTOM", "WIN",
                10, 3, 5, 240, 30, 20, 30000);
        // 240 / 30 = 8.0
        assertEquals(8.0, m.csPerMin());
    }

    @Test
    @DisplayName("csPerMin() redondea a 1 decimal")
    void csPerMinRoundsTo1Decimal() {
        MatchSummary m = new MatchSummary("EUW1_1", "Lucian", "BOTTOM", "WIN",
                10, 3, 5, 100, 13, 20, 30000);
        // 100 / 13 = 7.692 → 7.7
        assertEquals(7.7, m.csPerMin());
    }
}
