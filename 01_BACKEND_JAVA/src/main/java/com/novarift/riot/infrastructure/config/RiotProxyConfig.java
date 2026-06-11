package com.novarift.riot.infrastructure.config;

import com.novarift.shared.config.RiotApiKeyHolder;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestTemplate;

import java.time.Duration;

/**
 * RiotProxyConfig — configuración del módulo {@code riot}.
 *
 * <p>Usa {@link RiotApiKeyHolder} para obtener la clave en cada request,
 * permitiendo actualizarla desde el panel de admin sin reiniciar.
 */
@Configuration
public class RiotProxyConfig {

    private static final Logger log = LoggerFactory.getLogger(RiotProxyConfig.class);

    private final RiotApiKeyHolder keyHolder;

    public RiotProxyConfig(RiotApiKeyHolder keyHolder) {
        this.keyHolder = keyHolder;
    }

    @Bean(name = "riotProxyRestTemplate")
    public RestTemplate riotProxyRestTemplate(RestTemplateBuilder builder) {
        return builder
                .setConnectTimeout(Duration.ofSeconds(4))
                .setReadTimeout(Duration.ofSeconds(6))
                .additionalInterceptors((request, body, execution) -> {
                    String url = request.getURI().toString();
                    if (!url.contains("ddragon.leagueoflegends.com")) {
                        request.getHeaders().add("X-Riot-Token", keyHolder.getKey());
                    }
                    return execution.execute(request, body);
                })
                .errorHandler(new SilentErrorHandler())
                .build();
    }
}
