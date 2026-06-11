package com.novarift.identity;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Tests de integración para el módulo Identity.
 * En perfil test, la Riot API real no está disponible, así que
 * validamos el manejo de errores y formato.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
public class IdentityWebAdapterTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    public void testIdentityByPath_InvalidFormat_ReturnsBadRequest() throws Exception {
        // Sin guión separador = formato inválido
        mockMvc.perform(get("/api/v1/identity/summoner/SinTag"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("Formato invalido. Usa NombreInvocador#TAG"));
    }

    @Test
    public void testIdentityByQueryParam_InvalidFormat_ReturnsBadRequest() throws Exception {
        mockMvc.perform(get("/api/v1/identity/summoner")
                .param("riotId", "SinTag"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("Formato invalido. Usa NombreInvocador#TAG"));
    }

    @Test
    public void testIdentityByQueryParam_ValidFormat_CallsRiotApi() throws Exception {
        // En perfil test, la URL de Riot es localhost:8080/mock, que dará error de conexión.
        // Lo importante es que NO devuelva 400 (formato es válido), sino un error de backend/gateway.
        mockMvc.perform(get("/api/v1/identity/summoner")
                .param("riotId", "TestPlayer-EUW"))
                .andExpect(status().is5xxServerError())
                .andExpect(jsonPath("$.error").exists());
    }

    @Test
    public void testIdentityByPath_ValidFormat_CallsRiotApi() throws Exception {
        mockMvc.perform(get("/api/v1/identity/summoner/TestPlayer-EUW"))
                .andExpect(status().is5xxServerError())
                .andExpect(jsonPath("$.error").exists());
    }

    @Test
    public void testIdentity_MissingParameter_ReturnsNotFound() throws Exception {
        // No riotId parameter at all
        mockMvc.perform(get("/api/v1/identity/summoner"))
                .andExpect(status().isBadRequest());
    }
}
