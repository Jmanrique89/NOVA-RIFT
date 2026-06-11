package com.novarift.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.util.ReflectionTestUtils;

import java.io.IOException;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Tests del {@link RateLimitFilter}.
 *
 * <p>Sin {@code @SpringBootTest} para mantenerlo rápido — instanciamos el
 * filter directamente y populamos los `@Value` vía
 * {@link ReflectionTestUtils}. Usamos {@link MockHttpServletRequest} y
 * {@link MockHttpServletResponse} de Spring Test (ya en classpath).
 *
 * <p>Cobertura:
 * <ul>
 * <li>Endpoints fuera del scope (`/api/v1/auth/...`) pasan sin throttle.</li>
 * <li>Endpoints en scope respetan capacity (60 req → todas pasan).</li>
 * <li>Petición #61 con bucket vacío devuelve 429 con `Retry-After`.</li>
 * <li>Buckets independientes por IP (X-Forwarded-For).</li>
 * <li>Flag {@code enabled=false} deshabilita el filtro.</li>
 * </ul>
 */
class RateLimitFilterTest {

    private RateLimitFilter filter;

    @BeforeEach
    void setUp() {
        filter = new RateLimitFilter();
        // Capacity bajo para tests rápidos: 5 tokens, refill 5 / 60s.
        ReflectionTestUtils.setField(filter, "enabled", true);
        ReflectionTestUtils.setField(filter, "capacity", 5);
        ReflectionTestUtils.setField(filter, "refillTokens", 5);
        ReflectionTestUtils.setField(filter, "refillPeriodSeconds", 60);
    }

    @Test
    @DisplayName("Endpoints fuera del scope no se throttle (auth pasa sin tocar bucket)")
    void unlimitedEndpointsAlwaysPass() throws Exception {
        MockHttpServletRequest req = newReq("/api/v1/auth/login", "10.0.0.1");
        for (int i = 0; i < 100; i++) {
            MockHttpServletResponse resp = new MockHttpServletResponse();
            CountingChain chain = new CountingChain();
            filter.doFilterInternal(req, resp, chain);
            assertEquals(1, chain.calls, "auth endpoint debería pasar siempre");
            assertEquals(200, resp.getStatus());
        }
    }

    @Test
    @DisplayName("Endpoints en scope: primeras N peticiones pasan, la N+1 → 429")
    void rateLimitedEndpointBlocksAfterCapacity() throws Exception {
        MockHttpServletRequest req = newReq("/api/v1/riot/summoner-summary", "10.0.0.2");

        // Capacity = 5 → 5 primeras pasan.
        for (int i = 0; i < 5; i++) {
            MockHttpServletResponse resp = new MockHttpServletResponse();
            CountingChain chain = new CountingChain();
            filter.doFilterInternal(req, resp, chain);
            assertEquals(1, chain.calls, "petición " + i + " debería pasar");
        }

        // 6ª → 429.
        MockHttpServletResponse blocked = new MockHttpServletResponse();
        CountingChain chain6 = new CountingChain();
        filter.doFilterInternal(req, blocked, chain6);

        assertEquals(0, chain6.calls, "6ª petición no debería continuar la chain");
        assertEquals(429, blocked.getStatus());
        assertNotNull(blocked.getHeader("Retry-After"), "header Retry-After debería estar presente");
        assertTrue(blocked.getContentAsString().contains("RATE_LIMITED"));
    }

    @Test
    @DisplayName("Coaching endpoint también está en scope")
    void coachingEndpointIsRateLimited() throws Exception {
        MockHttpServletRequest req = newReq("/api/v1/coaching/message", "10.0.0.3");

        for (int i = 0; i < 5; i++) {
            filter.doFilterInternal(req, new MockHttpServletResponse(), new CountingChain());
        }

        MockHttpServletResponse blocked = new MockHttpServletResponse();
        filter.doFilterInternal(req, blocked, new CountingChain());
        assertEquals(429, blocked.getStatus());
    }

    @Test
    @DisplayName("Buckets independientes por IP — IP A bloqueada no afecta a IP B")
    void bucketsAreIndependentPerIp() throws Exception {
        MockHttpServletRequest reqA = newReq("/api/v1/riot/test", "10.0.0.10");
        MockHttpServletRequest reqB = newReq("/api/v1/riot/test", "10.0.0.20");

        // Agotamos el bucket de A.
        for (int i = 0; i < 5; i++) {
            filter.doFilterInternal(reqA, new MockHttpServletResponse(), new CountingChain());
        }
        MockHttpServletResponse aBlocked = new MockHttpServletResponse();
        filter.doFilterInternal(reqA, aBlocked, new CountingChain());
        assertEquals(429, aBlocked.getStatus());

        // B sigue libre.
        MockHttpServletResponse bResp = new MockHttpServletResponse();
        CountingChain chainB = new CountingChain();
        filter.doFilterInternal(reqB, bResp, chainB);
        assertEquals(1, chainB.calls);
        assertEquals(200, bResp.getStatus());
    }

    @Test
    @DisplayName("X-Forwarded-For tiene prioridad sobre remote addr")
    void xForwardedForIsHonored() throws Exception {
        // Mismo remote addr, distinto X-Forwarded-For → buckets separados.
        MockHttpServletRequest req1 = newReq("/api/v1/riot/test", "10.0.0.99");
        req1.addHeader("X-Forwarded-For", "1.2.3.4");
        MockHttpServletRequest req2 = newReq("/api/v1/riot/test", "10.0.0.99");
        req2.addHeader("X-Forwarded-For", "5.6.7.8");

        // Agotar req1 (cliente 1.2.3.4).
        for (int i = 0; i < 5; i++) {
            filter.doFilterInternal(req1, new MockHttpServletResponse(), new CountingChain());
        }
        MockHttpServletResponse blocked1 = new MockHttpServletResponse();
        filter.doFilterInternal(req1, blocked1, new CountingChain());
        assertEquals(429, blocked1.getStatus());

        // req2 (cliente 5.6.7.8) sigue libre.
        MockHttpServletResponse resp2 = new MockHttpServletResponse();
        CountingChain chain2 = new CountingChain();
        filter.doFilterInternal(req2, resp2, chain2);
        assertEquals(1, chain2.calls);
    }

    @Test
    @DisplayName("Flag enabled=false desactiva el filtro completamente")
    void disabledFlagSkipsFilter() throws Exception {
        ReflectionTestUtils.setField(filter, "enabled", false);
        MockHttpServletRequest req = newReq("/api/v1/riot/test", "10.0.0.50");

        // 100 peticiones, todas pasan (sin throttle).
        for (int i = 0; i < 100; i++) {
            MockHttpServletResponse resp = new MockHttpServletResponse();
            CountingChain chain = new CountingChain();
            filter.doFilterInternal(req, resp, chain);
            assertEquals(1, chain.calls);
        }
    }

    // ─── helpers ──────────────────────────────────────────────────────────────

    private static MockHttpServletRequest newReq(String uri, String ip) {
        MockHttpServletRequest req = new MockHttpServletRequest();
        req.setRequestURI(uri);
        req.setRemoteAddr(ip);
        return req;
    }

    /** FilterChain que incrementa un contador para verificar que se ejecuta. */
    private static class CountingChain implements FilterChain {
        int calls = 0;
        @Override
        public void doFilter(jakarta.servlet.ServletRequest req,
                             jakarta.servlet.ServletResponse resp)
                throws IOException, ServletException {
            calls++;
        }
    }
}
