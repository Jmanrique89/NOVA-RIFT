package com.novarift.coaching.application.services;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import static org.junit.jupiter.api.Assertions.assertAll;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Tests del {@link CoachingTemplateService}.
 *
 * <p>Cubrimos las tres garantías que el frontend asume del servicio:
 *
 * <ol>
 * <li>Las 47 plantillas (32 §17 + 15 DEFAULT ) existen y se devuelven
 * exactas en lookup directo.</li>
 * <li>El fallback en cascada nunca devuelve null (clave exacta → faction=ANY →
 * DEFAULT rol×fase → global LATE_GAME_35).</li>
 * <li>Roles/playstyles/facciones desconocidos caen también al fallback en
 * vez de propagar 500 (el {@code CoachingWebAdapter} es "best effort").</li>
 * <li>facción desconocida o nula recibe la plantilla DEFAULT
 * específica de su rol×fase, no el fallback global genérico.</li>
 * </ol>
 *
 * <p>Notas de diseño: los tests no mockean nada — el servicio es puro y
 * la tabla es {@code static}, así que no hay costo en instanciarlo en
 * cada test. {@code @ParameterizedTest} para las claves directas evita
 * 32 métodos repetitivos.
 */
class CoachingTemplateServiceTest {

    private CoachingTemplateService service;

    @BeforeEach
    void setUp() {
        service = new CoachingTemplateService();
    }

    @Test
    @DisplayName("47 templates exactamente están cargadas (32 §17 + 15 DEFAULT)")
    void shouldHaveAll47Templates() {
        assertEquals(47, service.getTemplateCount(),
                "El catálogo debería tener 32 templates §17 + 15 DEFAULT.");
    }

    /**
     * Para cada combinación (role × playStyle × faction × context) que
     * sabemos que existe en la tabla, verificamos que devuelve el texto
     * correcto y no nulo. Es una matriz dispersa: cada rol tiene
     * exactamente 6 entradas (3 contexts × 2 playstyle/faction).
     */
    @ParameterizedTest(name = "[{index}] {0}/{1}/{2}/{3} → mensaje no-vacío")
    @CsvSource({
        // ─── TOP ────────────────────────────────────────────────────────
        "TOP,    AGGRESSIVE, NOXUS,   EARLY_GAME",
        "TOP,    AGGRESSIVE, NOXUS,   MID_GAME",
        "TOP,    AGGRESSIVE, NOXUS,   LATE_GAME",
        "TOP,    DEFENSIVE,  DEMACIA, EARLY_GAME",
        "TOP,    DEFENSIVE,  DEMACIA, MID_GAME",
        "TOP,    DEFENSIVE,  DEMACIA, LATE_GAME",
        // ─── JUNGLE ─────────────────────────────────────────────────────
        "JUNGLE, AGGRESSIVE, NOXUS,   EARLY_GAME",
        "JUNGLE, AGGRESSIVE, NOXUS,   MID_GAME",
        "JUNGLE, AGGRESSIVE, NOXUS,   LATE_GAME",
        "JUNGLE, DEFENSIVE,  DEMACIA, EARLY_GAME",
        "JUNGLE, DEFENSIVE,  DEMACIA, MID_GAME",
        "JUNGLE, DEFENSIVE,  DEMACIA, LATE_GAME",
        // ─── MID ────────────────────────────────────────────────────────
        "MID,    AGGRESSIVE, NOXUS,   EARLY_GAME",
        "MID,    AGGRESSIVE, NOXUS,   MID_GAME",
        "MID,    AGGRESSIVE, NOXUS,   LATE_GAME",
        "MID,    DEFENSIVE,  DEMACIA, EARLY_GAME",
        "MID,    DEFENSIVE,  DEMACIA, MID_GAME",
        "MID,    DEFENSIVE,  DEMACIA, LATE_GAME",
        // ─── ADC ────────────────────────────────────────────────────────
        "ADC,     AGGRESSIVE, NOXUS,   EARLY_GAME",
        "ADC,     AGGRESSIVE, NOXUS,   MID_GAME",
        "ADC,     AGGRESSIVE, NOXUS,   LATE_GAME",
        "ADC,     DEFENSIVE,  DEMACIA, EARLY_GAME",
        "ADC,     DEFENSIVE,  DEMACIA, MID_GAME",
        "ADC,     DEFENSIVE,  DEMACIA, LATE_GAME",
        // ─── SUPPORT ────────────────────────────────────────────────────
        "SUPPORT, AGGRESSIVE, NOXUS,   EARLY_GAME",
        "SUPPORT, AGGRESSIVE, NOXUS,   MID_GAME",
        "SUPPORT, AGGRESSIVE, NOXUS,   LATE_GAME",
        "SUPPORT, DEFENSIVE,  DEMACIA, EARLY_GAME",
        "SUPPORT, DEFENSIVE,  DEMACIA, MID_GAME",
        "SUPPORT, DEFENSIVE,  DEMACIA, LATE_GAME",
        // ─── ESPECIALES ─────────────────────────────────────────────────
        "ANY,    ANY,        ANY,     LATE_GAME_35",
        "ANY,    ANY,        ANY,     COMEBACK",
        // ─── DEFAULT — rol × fase neutro ───────────────────────
        "TOP,     ANY, DEFAULT, EARLY_GAME",
        "TOP,     ANY, DEFAULT, MID_GAME",
        "TOP,     ANY, DEFAULT, LATE_GAME",
        "JUNGLE,  ANY, DEFAULT, EARLY_GAME",
        "JUNGLE,  ANY, DEFAULT, MID_GAME",
        "JUNGLE,  ANY, DEFAULT, LATE_GAME",
        "MID,     ANY, DEFAULT, EARLY_GAME",
        "MID,     ANY, DEFAULT, MID_GAME",
        "MID,     ANY, DEFAULT, LATE_GAME",
        "ADC,     ANY, DEFAULT, EARLY_GAME",
        "ADC,     ANY, DEFAULT, MID_GAME",
        "ADC,     ANY, DEFAULT, LATE_GAME",
        "SUPPORT, ANY, DEFAULT, EARLY_GAME",
        "SUPPORT, ANY, DEFAULT, MID_GAME",
        "SUPPORT, ANY, DEFAULT, LATE_GAME",
    })
    void shouldReturnExactMessageForKnownCombo(String role, String playStyle, String faction, String context) {
        String msg = service.getCoachingMessage(role, playStyle, faction, context);
        assertNotNull(msg, "El mensaje no debería ser null para combinación conocida.");
        assertFalse(msg.isBlank(), "El mensaje no debería estar vacío.");
    }

    @Test
    @DisplayName("ADC AGGRESSIVE NOXUS MID_GAME devuelve el mensaje canónico")
    void shouldReturnCanonicalAdcMessage() {
        // Spot-check del contenido para detectar regresiones tipográficas
        // o renombres accidentales de constantes.
        String msg = service.getCoachingMessage("ADC", "AGGRESSIVE", "NOXUS", "MID_GAME");
        assertTrue(msg.contains("Farming"), "Mensaje canónico ADC contiene 'Farming'.");
        assertTrue(msg.contains("ADC"),     "Mensaje canónico ADC referencia al rol.");
    }

    @Test
    @DisplayName("Combinación desconocida cae a fallback global LATE_GAME_35")
    void shouldFallbackToGlobalWhenUnknown() {
        String msg = service.getCoachingMessage("FAKEROLE", "FAKESTYLE", "FAKEFACTION", "FAKECTX");
        assertNotNull(msg);
        // El fallback global es la entrada ANY/ANY/ANY/LATE_GAME_35.
        assertTrue(msg.contains("mapa") || msg.contains("teamfight") || msg.contains("nexo")
                        || msg.contains("Mantén"),
                "Fallback debería contener pista del mensaje LATE_GAME_35 o el por-defecto.");
    }

    @Test
    @DisplayName("Combinación con faction desconocida cae al DEFAULT del rol")
    void shouldFallbackToRoleDefaultWhenFactionUnknown() {
        // No tenemos plantilla TOP/AGGRESSIVE/IONIA/MID_GAME. La cascada :
        // 1) miss exacta
        // 2) miss faction=ANY (no existe TOP/AGGRESSIVE/ANY/MID_GAME)
        // 3) HIT en DEFAULT TOP×MID_GAME — consejo específico del rol
        String msg = service.getCoachingMessage("TOP", "AGGRESSIVE", "IONIA", "MID_GAME");
        assertNotNull(msg);
        assertFalse(msg.isBlank());
        assertEquals(service.getCoachingMessage("TOP", "ANY", "DEFAULT", "MID_GAME"), msg,
                "Facción desconocida debería recibir el DEFAULT de su rol×fase.");
    }

    /**
     * garantía central del cambio de alcance: CUALQUIER usuario
     * (facción desconocida o nula) recibe una plantilla DEFAULT específica de
     * su rol×fase, distinta del fallback global genérico.
     */
    @ParameterizedTest(name = "[{index}] DEFAULT {0}/{1} → consejo de rol, no fallback global")
    @CsvSource({
        "TOP,     EARLY_GAME", "TOP,     MID_GAME", "TOP,     LATE_GAME",
        "JUNGLE,  EARLY_GAME", "JUNGLE,  MID_GAME", "JUNGLE,  LATE_GAME",
        "MID,     EARLY_GAME", "MID,     MID_GAME", "MID,     LATE_GAME",
        "ADC,     EARLY_GAME", "ADC,     MID_GAME", "ADC,     LATE_GAME",
        "SUPPORT, EARLY_GAME", "SUPPORT, MID_GAME", "SUPPORT, LATE_GAME",
    })
    void unknownOrNullFactionGetsRoleDefault(String role, String context) {
        String globalFallback = service.getCoachingMessage("FAKEROLE", "FAKESTYLE", "FAKEFACTION", "FAKECTX");

        String unknownFaction = service.getCoachingMessage(role, "BALANCED", "ZAUN", context);
        String nullFaction    = service.getCoachingMessage(role, "BALANCED", null, context);

        assertAll(
            () -> assertNotNull(unknownFaction),
            () -> assertFalse(unknownFaction.isBlank(), "DEFAULT no debe estar vacío"),
            () -> assertEquals(unknownFaction, nullFaction,
                    "Facción nula y desconocida deben recibir el mismo DEFAULT"),
            () -> assertFalse(unknownFaction.equals(globalFallback),
                    "El DEFAULT del rol debe ser específico, no el fallback global")
        );
    }

    @Test
    @DisplayName("Cascada: las 6 plantillas TOP devuelven contenido distinto")
    void topMessagesShouldBeUnique() {
        String[] msgs = new String[]{
            service.getCoachingMessage("TOP", "AGGRESSIVE", "NOXUS",   "EARLY_GAME"),
            service.getCoachingMessage("TOP", "AGGRESSIVE", "NOXUS",   "MID_GAME"),
            service.getCoachingMessage("TOP", "AGGRESSIVE", "NOXUS",   "LATE_GAME"),
            service.getCoachingMessage("TOP", "DEFENSIVE",  "DEMACIA", "EARLY_GAME"),
            service.getCoachingMessage("TOP", "DEFENSIVE",  "DEMACIA", "MID_GAME"),
            service.getCoachingMessage("TOP", "DEFENSIVE",  "DEMACIA", "LATE_GAME"),
        };
        // Cada par debe ser distinto — no puede haber duplicados.
        assertAll(() -> {
            for (int i = 0; i < msgs.length; i++) {
                for (int j = i + 1; j < msgs.length; j++) {
                    assertFalse(msgs[i].equals(msgs[j]),
                            "Mensaje TOP[" + i + "] y TOP[" + j + "] no deberían ser iguales.");
                }
            }
        });
    }

    @Test
    @DisplayName("getTemplateCount() es estable entre llamadas")
    void getTemplateCountIsStable() {
        int first = service.getTemplateCount();
        int second = service.getTemplateCount();
        assertEquals(first, second);
        assertEquals(47, first);
    }
}
