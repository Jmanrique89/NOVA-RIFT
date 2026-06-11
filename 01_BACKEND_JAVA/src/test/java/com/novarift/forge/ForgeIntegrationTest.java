package com.novarift.forge;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
public class ForgeIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    public void testGetForgeAnalytics_ReturnsAnalyzedData() throws Exception {
        mockMvc.perform(get("/api/v1/forge/analytics/Oner-T1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.riotId").value("Oner-T1"))
                .andExpect(jsonPath("$.csComparison").exists())
                .andExpect(jsonPath("$.forgingMissions").exists())
                .andExpect(jsonPath("$.kda").exists())
                .andExpect(jsonPath("$.killParticipation").exists())
                .andExpect(jsonPath("$.challenges").isArray())
                .andExpect(jsonPath("$.challenges.length()").value(3));
    }

    @Test
    public void testGetForgeAnalytics_MissingId_ReturnsNotFound() throws Exception {
        mockMvc.perform(get("/api/v1/forge/analytics/"))
                .andExpect(status().isNotFound());
    }

    @Test
    public void testGetForgeAnalytics_InvalidMethod_ReturnsMethodNotAllowed() throws Exception {
        mockMvc.perform(post("/api/v1/forge/analytics/Oner-T1"))
                .andExpect(status().isMethodNotAllowed());
    }

    @Test
    public void testCompleteForge_PersistsProgress() throws Exception {
        String metrics = "{ \"csPerMin\": 7.5, \"visionScore\": 25, \"kda\": 4.0, \"killParticipation\": 68 }";

        mockMvc.perform(post("/api/v1/forge/complete/TestPlayer-EUW")
                .contentType(MediaType.APPLICATION_JSON)
                .content(metrics))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.riotId").value("TestPlayer-EUW"))
                .andExpect(jsonPath("$.forgesCompleted").value(1))
                .andExpect(jsonPath("$.kda").value(4.0))
                .andExpect(jsonPath("$.killParticipation").value(68.0))
                .andExpect(jsonPath("$.message").exists());

        // Second forge should increment counter
        mockMvc.perform(post("/api/v1/forge/complete/TestPlayer-EUW")
                .contentType(MediaType.APPLICATION_JSON)
                .content(metrics))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.forgesCompleted").value(2));
    }
}
