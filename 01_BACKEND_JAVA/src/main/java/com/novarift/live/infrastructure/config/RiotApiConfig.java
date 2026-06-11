package com.novarift.live.infrastructure.config;

import com.novarift.shared.config.RiotApiKeyHolder;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.ClientHttpRequestInterceptor;
import org.springframework.web.client.RestTemplate;

@Configuration
public class RiotApiConfig {

    private final RiotApiKeyHolder keyHolder;

    @Value("${app.riot.url.account}")
    private String accountUrl;

    public RiotApiConfig(RiotApiKeyHolder keyHolder) {
        this.keyHolder = keyHolder;
    }

    @Bean
    public RestTemplate riotRestTemplate(RestTemplateBuilder builder) {
        return builder.additionalInterceptors((ClientHttpRequestInterceptor) (request, body, execution) -> {
            // T5 — Lee la clave en CALIENTE en cada peticion (panel admin > env >
            // properties). Antes capturaba el @Value en el closure, de modo que una
            // clave nueva guardada en el panel NO surtia efecto sin reiniciar.
            // Ahora delega siempre en RiotApiKeyHolder, la fuente unica mutable.
            request.getHeaders().add("X-Riot-Token", keyHolder.getKey());
            return execution.execute(request, body);
        }).build();
    }

    public String getApiKey() {
        return keyHolder.getKey();
    }

    public String getAccountUrl() {
        return accountUrl;
    }
}
