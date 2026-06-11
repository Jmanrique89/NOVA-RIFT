package com.novarift.analytics.infrastructure.adapters.in.web;

import com.novarift.analytics.domain.exception.RiotDataExtractionException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class GlobalExceptionHandlerTest {

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders
                .standaloneSetup(new DummyController())
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @Test
    void shouldMapRiotDataExtractionExceptionToServiceUnavailable() throws Exception {
        mockMvc.perform(get("/test/riot-error").accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.status").value(503))
                .andExpect(jsonPath("$.error").value("Service Unavailable"))
                .andExpect(jsonPath("$.message").value("Riot API no responde"));
    }

    @Test
    void shouldMapGenericExceptionToInternalServerError() throws Exception {
        mockMvc.perform(get("/test/unexpected-error").accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.status").value(500))
                .andExpect(jsonPath("$.error").value("Internal Server Error"))
                .andExpect(jsonPath("$.message").value("Ocurrió un error inesperado al procesar la solicitud."));
    }

    @RestController
    static class DummyController {

        @GetMapping("/test/riot-error")
        public String throwRiotError() {
            throw new RiotDataExtractionException("Riot API no responde");
        }

        @GetMapping("/test/unexpected-error")
        public String throwUnexpectedError() {
            throw new IllegalStateException("Fallo inesperado");
        }
    }
}
