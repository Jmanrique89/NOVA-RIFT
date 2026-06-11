package com.novarift.live;

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
public class LiveIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    public void testStartLiveSession_ReturnsMockedData() throws Exception {
        String requestPayload = "{ \"summonerName\": \"Faker-T1\", \"imageHash\": \"abc123hash\" }";

        mockMvc.perform(post("/api/v1/live/start")
                .contentType(MediaType.APPLICATION_JSON)
                .content(requestPayload))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.summonerName").value("Faker-T1"))
                // Expects that the MockAdapter successfully injected the "Heavy AD" format
                .andExpect(jsonPath("$.enemyDraftPattern").exists())
                .andExpect(jsonPath("$.recommendedFirstBuy").exists())
                // Assertions for new recommendation engine fields (if present, they shouldn't be null even if empty breakdown)
                .andExpect(jsonPath("$.recommendationVersion").exists())
                .andExpect(jsonPath("$.recommendationScore").exists())
                .andExpect(jsonPath("$.recommendationConfidence").exists());
    }

    @Test
    public void testStartLiveSession_MissingPayload_ReturnsBadRequest() throws Exception {
        mockMvc.perform(post("/api/v1/live/start")
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isBadRequest());
    }

    @Test
    public void testStartLiveSession_InvalidMethod_ReturnsMethodNotAllowed() throws Exception {
        mockMvc.perform(get("/api/v1/live/start")
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isMethodNotAllowed());
    }
}
