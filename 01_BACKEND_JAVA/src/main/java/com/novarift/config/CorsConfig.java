package com.novarift.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * CORS global — sustituye los @CrossOrigin sueltos de cada adapter.
 *
 * Razón:
 * Frontend Expo Web sirve en :8081 y backend Spring Boot en :8080.
 * Sin esta config, el navegador rechaza la respuesta del POST /api/v1/live/start
 * por política CORS, aunque el backend HAYA procesado la petición correctamente
 * (los logs Hibernate confirman queries a kb_champions y inserts a live_sessions).
 *
 * allowedOriginPatterns en lugar de allowedOrigins → permite wildcards en el puerto
 * sin tener que listar :8081, :19006, :19000... uno por uno.
 *
 * allowCredentials(false) → no usamos cookies/auth header en este proyecto.
 * Si alguna vez se mete autenticación, hay que cambiar a true Y especificar
 * orígenes concretos (no se puede combinar con "*").
 */
@Configuration
public class CorsConfig {

    @Bean
    public WebMvcConfigurer corsConfigurer() {
        return new WebMvcConfigurer() {
            @Override
            public void addCorsMappings(CorsRegistry registry) {
                registry.addMapping("/**")
                    .allowedOriginPatterns(
                        "http://localhost:*",
                        "http://127.0.0.1:*"
                    )
                    .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD", "PATCH")
                    .allowedHeaders("*")
                    .exposedHeaders("Content-Type", "Authorization")
                    .allowCredentials(false)
                    .maxAge(3600);
            }
        };
    }
}
