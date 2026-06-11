# DATASET MOCK: NOVA RIFT (v1_MVP)

**Ubicación:** `01_BACKEND_JAVA/src/main/resources/mock/`
**Estado:** Integrado para pruebas E2E (Evoca Fallback offline).

## Version 1.0 - Escenarios Cubiertos

1. **Escenario Nominal Absoluto:**
   - **Archivo:** `last_real_match.json`
   - **Caso de Uso:** Usuario conecta correctamente en Live-Rift y solicita la forja de estadísticas de un nombre válido ("Faker-T1", "AN00").
   - **Comportamiento:** El backend procesa 200 OK y devuelve un MatchProfile y misiones simuladas de progresión (ForgingMissions).

2. **Escenario Error Externo (Riot Down):**
   - **Archivo:** Simulado en lógica de MockAdapter al recibir nombres no registrados.
   - **Caso de Uso:** Timeout de la API oficial o Rate Limit excedido.
   - **Comportamiento:** LiveWebAdapter captura excepción RestClientException y devuelve 503 Bad Gateway con mensaje estandarizado.

3. **Escenario Datos Incompletos / Malformados:**
   - **Archivo:** Dinámico (Invocado vía Unit Test Integrado).
   - **Caso de Uso:** La request llega sin `summonerName` en el DTO o el nombre es nulo.
   - **Comportamiento:** Spring Validation / Controlador aborta antes de tocar el dominio y devuelve 400 Bad Request. Mantiene la pureza Hexagonal inviolada.
