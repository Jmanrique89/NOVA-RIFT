package com.novarift.config;

import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Duration;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Filtro de infraestructura (cross-cutting) que aplica rate-limiting por IP mediante el
 * algoritmo token bucket de Bucket4j.
 *
 * <p>Es un {@link OncePerRequestFilter} de Spring que se ejecuta antes de los controladores
 * (no forma parte del hexagono de ningun modulo, sino del borde HTTP comun). Limita N
 * peticiones por minuto y por IP sobre los endpoints sensibles: {@code /api/v1/riot/**}
 * (proxy a Riot, con cuota externa de coste) y {@code /api/v1/coaching/**} (alto volumen
 * potencial desde el HUD en partida).
 *
 * <p>El filtro NO bloquea otros endpoints (auth, forge, identity, live,
 * actuator) porque tienen mecanismos propios o no son sensibles a abuso
 * por volumen.
 *
 * <p>Implementación:
 * <ul>
 * <li>Un {@link Bucket} por IP cacheado en {@code ConcurrentHashMap}
 * (suficiente para single-instance — para multi-instance habría
 * que migrar a Redis con {@code bucket4j-redis}).</li>
 * <li>Refill greedy de {@code capacity} tokens cada {@code refillPeriod}
 * (default 60 tokens / 60s = ~1 req/s sostenido, con burst de 60).</li>
 * <li>429 + header {@code Retry-After} cuando se excede.</li>
 * </ul>
 *
 * <p>Configuración via {@code application.properties}:
 * <pre>
 * app.rate-limit.enabled=true
 * app.rate-limit.capacity=60
 * app.rate-limit.refill-tokens=60
 * app.rate-limit.refill-period-seconds=60
 * </pre>
 *
 * <p>Ejecuta antes que la mayoría de filtros Spring (Order HIGHEST_PRECEDENCE+10)
 * para detectar abuso antes de tocar cualquier handler.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 10)
// El filter se monta en todos los perfiles excepto "test". Los tests
// unitarios del propio filter (`RateLimitFilterTest`) lo instancian
// directamente con `new RateLimitFilter()` y `ReflectionTestUtils`, sin
// pasar por Spring — funcionan independientemente.
@Profile("!test")
public class RateLimitFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(RateLimitFilter.class);

    /** Endpoints con rate-limit activo. Otros pasan sin throttle. */
    private static final String[] LIMITED_PREFIXES = {
            "/api/v1/riot/",
            "/api/v1/coaching/",
    };

    @Value("${app.rate-limit.enabled:true}")
    private boolean enabled;

    @Value("${app.rate-limit.capacity:60}")
    private int capacity;

    @Value("${app.rate-limit.refill-tokens:60}")
    private int refillTokens;

    @Value("${app.rate-limit.refill-period-seconds:60}")
    private int refillPeriodSeconds;

    /**
     * Cache de buckets por IP. Su tamano depende de las IPs distintas que acceden;
     * en produccion se sustituiria por Caffeine con expireAfterAccess(10min) para
     * acotar la memoria.
     */
    private final Map<String, Bucket> bucketsByIp = new ConcurrentHashMap<>();

    @Override
    protected void doFilterInternal(HttpServletRequest req,
                                    HttpServletResponse resp,
                                    FilterChain chain)
            throws ServletException, IOException {

        if (!enabled || !isLimitedEndpoint(req.getRequestURI())) {
            chain.doFilter(req, resp);
            return;
        }

        String ip = clientIp(req);
        Bucket bucket = bucketsByIp.computeIfAbsent(ip, this::newBucket);

        if (bucket.tryConsume(1)) {
            chain.doFilter(req, resp);
            return;
        }

        // Excedido — devolver 429 con Retry-After estimado.
        // Jakarta Servlet 5+ no expone SC_TOO_MANY_REQUESTS como constante;
        // usamos el código numérico estándar (RFC 6585).
        long waitSeconds = Math.max(1L,
                Duration.ofSeconds(refillPeriodSeconds).dividedBy(Math.max(1, refillTokens)).toSeconds());
        resp.setStatus(429);
        resp.setHeader("Retry-After", String.valueOf(waitSeconds));
        resp.setContentType("application/json");
        resp.getWriter().write(
                "{\"error\":\"RATE_LIMITED\",\"message\":\"Demasiadas peticiones. Reintenta en breve.\"}"
        );
        log.warn("Rate limit excedido en {} desde IP {}", req.getRequestURI(), ip);
    }

    private boolean isLimitedEndpoint(String uri) {
        if (uri == null) return false;
        for (String prefix : LIMITED_PREFIXES) {
            if (uri.startsWith(prefix)) return true;
        }
        return false;
    }

    /**
     * Extrae la IP cliente. Prioriza {@code X-Forwarded-For} (proxy/CDN)
     * sobre el remote addr nativo. Si X-Forwarded-For trae una lista
     * separada por comas, toma el primer elemento (cliente original).
     */
    private static String clientIp(HttpServletRequest req) {
        String xff = req.getHeader("X-Forwarded-For");
        if (xff != null && !xff.isBlank()) {
            int comma = xff.indexOf(',');
            return (comma >= 0 ? xff.substring(0, comma) : xff).trim();
        }
        String real = req.getHeader("X-Real-IP");
        if (real != null && !real.isBlank()) return real.trim();
        return req.getRemoteAddr();
    }

    private Bucket newBucket(String ip) {
        Bandwidth limit = Bandwidth.builder()
                .capacity(capacity)
                .refillGreedy(refillTokens, Duration.ofSeconds(refillPeriodSeconds))
                .build();
        return Bucket.builder()
                .addLimit(limit)
                .build();
    }
}
