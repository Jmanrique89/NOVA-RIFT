package com.novarift.auth.application;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;

/**
 * Utilidad de aplicacion para emitir y validar JSON Web Tokens (HS256).
 *
 * <p>Es un colaborador tecnico de {@link AuthService}: genera el token tras un
 * login/registro correcto y lo valida en cada peticion protegida. Firma con una
 * clave simetrica (HMAC-SHA256) cargada de {@code app.jwt.secret}; exige minimo
 * 32 caracteres porque HS256 necesita una clave de 256 bits.
 *
 * <p>El token lleva como subject el id de usuario y dos claims utiles para
 * autorizacion: {@code username} y {@code role} (este ultimo distingue ADMIN de
 * USER). La caducidad se controla con {@code app.jwt.ttl-days} (30 dias por defecto).
 */
@Component
public class JwtUtil {

    private final SecretKey signingKey;
    private final long ttlMillis;

    public JwtUtil(
            @Value("${app.jwt.secret:novarift_super_secret_2026_minimum_32_chars_xx}") String secret,
            @Value("${app.jwt.ttl-days:30}") long ttlDays) {
        byte[] bytes = secret.getBytes(StandardCharsets.UTF_8);
        if (bytes.length < 32) {
            throw new IllegalStateException(
                "app.jwt.secret debe tener al menos 32 caracteres (HS256 requiere 256 bits).");
        }
        this.signingKey = Keys.hmacShaKeyFor(bytes);
        this.ttlMillis = ttlDays * 24L * 60L * 60L * 1000L;
    }

    /** Genera token con userId como subject + username y role como claims. */
    public String generate(Long userId, String username, String role) {
        Date now = new Date();
        return Jwts.builder()
            .setSubject(String.valueOf(userId))
            .claim("username", username)
            .claim("role", role != null ? role : "USER")
            .setIssuedAt(now)
            .setExpiration(new Date(now.getTime() + ttlMillis))
            .signWith(signingKey, SignatureAlgorithm.HS256)
            .compact();
    }

    /** Devuelve el userId del subject. Lanza si el token es inválido o expiró. */
    public Long extractUserId(String token) {
        Claims claims = parse(token);
        return Long.parseLong(claims.getSubject());
    }

    public String extractUsername(String token) {
        return parse(token).get("username", String.class);
    }

    public String extractRole(String token) {
        String role = parse(token).get("role", String.class);
        return role != null ? role : "USER";
    }

    private Claims parse(String token) {
        return Jwts.parserBuilder()
            .setSigningKey(signingKey)
            .build()
            .parseClaimsJws(token)
            .getBody();
    }
}
