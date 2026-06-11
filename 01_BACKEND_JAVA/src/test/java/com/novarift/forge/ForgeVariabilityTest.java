package com.novarift.forge;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Test clave de variabilidad:
 * Dos jugadores con perfiles históricos distintos deben recibir
 * conjuntos de retos diferentes de Elo Forge.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
public class ForgeVariabilityTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    public void testDifferentProfiles_ProduceDifferentChallenges() throws Exception {
        // Jugador A: farmero fuerte pero con mala vision y KDA bajo
        String metricsPlayerA = "{ \"csPerMin\": 8.5, \"visionScore\": 8, \"kda\": 1.2, \"killParticipation\": 35 }";
        mockMvc.perform(post("/api/v1/forge/complete/PlayerA-EUW")
                .contentType(MediaType.APPLICATION_JSON)
                .content(metricsPlayerA))
                .andExpect(status().isOk());

        // Jugador B: mal farmeo pero buena vision y KDA alto
        String metricsPlayerB = "{ \"csPerMin\": 3.5, \"visionScore\": 35, \"kda\": 5.0, \"killParticipation\": 72 }";
        mockMvc.perform(post("/api/v1/forge/complete/PlayerB-EUW")
                .contentType(MediaType.APPLICATION_JSON)
                .content(metricsPlayerB))
                .andExpect(status().isOk());

        // Obtener retos de Jugador A
        MvcResult resultA = mockMvc.perform(get("/api/v1/forge/analytics/PlayerA-EUW"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.challenges").isArray())
                .andExpect(jsonPath("$.challenges.length()").value(3))
                .andReturn();

        // Obtener retos de Jugador B
        MvcResult resultB = mockMvc.perform(get("/api/v1/forge/analytics/PlayerB-EUW"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.challenges").isArray())
                .andExpect(jsonPath("$.challenges.length()").value(3))
                .andReturn();

        // Los conjuntos de retos DEBEN ser distintos
        String challengesA = resultA.getResponse().getContentAsString();
        String challengesB = resultB.getResponse().getContentAsString();
        assertNotEquals(challengesA, challengesB,
                "Dos jugadores con perfiles diferentes deben recibir retos distintos");
    }

    @Test
    public void testPlayerA_GetsVisionAndKDAChallenges() throws Exception {
        // Jugador con vision baja y KDA bajo -> debería priorizar esos retos
        String metrics = "{ \"csPerMin\": 9.0, \"visionScore\": 5, \"kda\": 1.0, \"killParticipation\": 30 }";
        mockMvc.perform(post("/api/v1/forge/complete/VisionLowPlayer-EUW")
                .contentType(MediaType.APPLICATION_JSON)
                .content(metrics))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/v1/forge/analytics/VisionLowPlayer-EUW"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.visionScore").value(5.0))
                .andExpect(jsonPath("$.kda").value(1.0))
                .andExpect(jsonPath("$.challenges[0].title").exists())
                .andExpect(jsonPath("$.challenges[1].title").exists())
                .andExpect(jsonPath("$.challenges[2].title").exists());
    }

    @Test
    public void testPlayerB_GetsFarmeoChallenges() throws Exception {
        // Jugador con CS bajo pero todo lo demás bien -> debería priorizar farmeo
        String metrics = "{ \"csPerMin\": 3.0, \"visionScore\": 30, \"kda\": 4.5, \"killParticipation\": 70 }";
        mockMvc.perform(post("/api/v1/forge/complete/CSLowPlayer-EUW")
                .contentType(MediaType.APPLICATION_JSON)
                .content(metrics))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/v1/forge/analytics/CSLowPlayer-EUW"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.csPerMin").value(3.0))
                .andExpect(jsonPath("$.challenges[0].title").exists());
    }

    @Test
    public void testForgeCompletion_IncrementsCounter() throws Exception {
        String metrics = "{ \"csPerMin\": 6.0, \"visionScore\": 15, \"kda\": 2.5, \"killParticipation\": 50 }";

        // Primera forja
        mockMvc.perform(post("/api/v1/forge/complete/CounterPlayer-EUW")
                .contentType(MediaType.APPLICATION_JSON)
                .content(metrics))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.forgesCompleted").value(1));

        // Segunda forja
        mockMvc.perform(post("/api/v1/forge/complete/CounterPlayer-EUW")
                .contentType(MediaType.APPLICATION_JSON)
                .content(metrics))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.forgesCompleted").value(2));

        // Tercera forja
        mockMvc.perform(post("/api/v1/forge/complete/CounterPlayer-EUW")
                .contentType(MediaType.APPLICATION_JSON)
                .content(metrics))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.forgesCompleted").value(3));
    }
}
