package com.novarift.forge;

import com.novarift.forge.application.AnalyzeProgressionUseCaseImpl;
import com.novarift.forge.domain.UserProgress;
import com.novarift.forge.domain.UserProgressRepository;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit test puro del caso de uso AnalyzeProgression.
 * Sin Spring, sin DB, sin HTTP — solo lógica de dominio.
 */
public class AnalyzeProgressionUseCaseTest {

    @Test
    void testDefaultProgress_GeneratesThreeChallenges() {
        var useCase = new AnalyzeProgressionUseCaseImpl(emptyRepo());
        var result = useCase.execute("NewPlayer-EUW");

        assertEquals("NewPlayer-EUW", result.get("riotId"));
        assertNotNull(result.get("challenges"));

        @SuppressWarnings("unchecked")
        var challenges = (List<Map<String, Object>>) result.get("challenges");
        assertEquals(3, challenges.size(), "Debe generar exactamente 3 retos");

        // Cada reto debe tener los campos obligatorios
        for (var challenge : challenges) {
            assertNotNull(challenge.get("icon"), "Falta icono");
            assertNotNull(challenge.get("title"), "Falta titulo");
            assertNotNull(challenge.get("description"), "Falta descripcion");
            assertNotNull(challenge.get("progress"), "Falta progreso");
            assertNotNull(challenge.get("tip"), "Falta tip");
        }
    }

    @Test
    void testHighSkillPlayer_GetsFewerGapChallenges() {
        var repo = staticRepo(new UserProgress(
            1L, "ProPlayer-KR", 9.5, 10.0, 40.0, 5, 6.0, 80.0, LocalDateTime.now()
        ));

        var useCase = new AnalyzeProgressionUseCaseImpl(repo);
        var result = useCase.execute("ProPlayer-KR");

        @SuppressWarnings("unchecked")
        var challenges = (List<Map<String, Object>>) result.get("challenges");
        assertEquals(3, challenges.size(), "Siempre devuelve 3 retos (relleno si necesario)");

        // Al menos uno debería ser de tipo "Macro" (relleno)
        boolean hasMacro = challenges.stream()
            .anyMatch(c -> "Macro de Objetivos".equals(c.get("title")));
        assertTrue(hasMacro, "Un jugador con stats altos debe recibir retos de relleno (Macro)");
    }

    @Test
    void testLowVisionPlayer_PrioritizesVision() {
        var repo = staticRepo(new UserProgress(
            2L, "BlindPlayer-EUW", 8.0, 7.0, 3.0, 3, 4.0, 70.0, LocalDateTime.now()
        ));

        var useCase = new AnalyzeProgressionUseCaseImpl(repo);
        var result = useCase.execute("BlindPlayer-EUW");

        @SuppressWarnings("unchecked")
        var challenges = (List<Map<String, Object>>) result.get("challenges");

        // Vision tiene la brecha más grande (3/20 = 85% gap) -> debe ser primer reto
        var firstChallenge = challenges.get(0);
        assertEquals("Dominio de Vision", firstChallenge.get("title"),
            "Con vision score 3/20, la vision debe ser el primer reto por brecha relativa");
    }

    @Test
    void testResponseContainsAllMetrics() {
        var repo = staticRepo(new UserProgress(
            3L, "CompletePlayer-NA", 7.0, 8.0, 20.0, 2, 3.5, 60.0, LocalDateTime.now()
        ));

        var useCase = new AnalyzeProgressionUseCaseImpl(repo);
        var result = useCase.execute("CompletePlayer-NA");

        // Todos los campos de respuesta deben estar presentes
        assertNotNull(result.get("riotId"));
        assertNotNull(result.get("csPerMin"));
        assertNotNull(result.get("targetCsMin"));
        assertNotNull(result.get("visionScore"));
        assertNotNull(result.get("forgesCompleted"));
        assertNotNull(result.get("kda"));
        assertNotNull(result.get("killParticipation"));
        assertNotNull(result.get("csComparison"));
        assertNotNull(result.get("challenges"));
        assertNotNull(result.get("forgingMissions"));
    }

    @Test
    void testNormalizeRiotId_HandlesHashFormat() {
        var useCase = new AnalyzeProgressionUseCaseImpl(emptyRepo());
        var result = useCase.execute("Player#EUW");
        assertEquals("Player-EUW", result.get("riotId"),
            "El # debe normalizarse a -");
    }

    // --- Test helpers ---

    private UserProgressRepository emptyRepo() {
        return new UserProgressRepository() {
            @Override
            public Optional<UserProgress> findByRiotId(String riotId) {
                return Optional.empty();
            }
            @Override
            public UserProgress save(UserProgress progress) {
                return progress;
            }
        };
    }

    private UserProgressRepository staticRepo(UserProgress fixed) {
        return new UserProgressRepository() {
            @Override
            public Optional<UserProgress> findByRiotId(String riotId) {
                return Optional.of(fixed);
            }
            @Override
            public UserProgress save(UserProgress progress) {
                return progress;
            }
        };
    }
}
