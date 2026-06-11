package com.novarift.live.infrastructure.adapters.out.riot;

import com.novarift.live.domain.RiotMatchPort;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Adaptador de salida (driven adapter) que implementa {@link RiotMatchPort} con datos
 * simulados, sin contactar con Riot.
 *
 * <p>Es la implementacion alternativa del mismo puerto que {@link RealRiotAdapter}:
 * demuestra el desacoplamiento de la arquitectura hexagonal, ya que el dominio depende
 * del puerto y no de la fuente de datos. Spring lo activa cuando {@code app.riot.mode=MOCK}
 * (y por defecto si la propiedad falta, gracias a {@code matchIfMissing=true}).
 *
 * <p>Carga un snapshot local de partida si existe; si no, devuelve un draft fijo de
 * ejemplo. Permite ejecutar el flujo completo en demos sin internet ni clave de API valida.
 */
@Component
@ConditionalOnProperty(name = "app.riot.mode", havingValue = "MOCK", matchIfMissing = true)
public class MockRiotAdapter implements RiotMatchPort {

    @Override
    public String getEnemyDraftAnalysis(String summonerName, String sourceHash) {
        try {
            java.nio.file.Path mockPath = java.nio.file.Paths.get(System.getProperty("user.dir"), "src", "main", "resources", "mocks", "last_real_match.json");
            if (java.nio.file.Files.exists(mockPath)) {
                return java.nio.file.Files.readString(mockPath);
            }
        } catch (Exception e) {
            System.err.println("Error leyendo la grabación local: " + e.getMessage());
        }
        return "{ \"team\": \"T1 vs G2 (Mock Fallback Fuerte)\", \"threatLevel\": \"High\", \"composition\": \"Heavy AD / Assassin (Sin base de datos offline)\", \"champions\": [\"Zed\"] }";
    }

    @Override
    public String getRecommendedBuild(String enemyDraft) {
        return "{ \"primaryTarget\": \"Armor Optimization\", \"items\": [\"Plated Steelcaps\", \"Guardian Angel\", \"Zhonya's Hourglass\"], \"tactics\": \"Evita peleas en jungla cerrada contra Talon.\", \"variants\": [ { \"name\": \"Anti-AD\", \"primaryTarget\": \"Armor Optimization\", \"items\": [\"Plated Steelcaps\", \"Frozen Heart\", \"Randuin's Omen\"], \"tactics\": \"Frontlinea y reduce DPS continuo.\" }, { \"name\": \"Burst Safe\", \"primaryTarget\": \"Mitigar burst\", \"items\": [\"Mercury's Treads\", \"Maw of Malmortius\", \"Guardian Angel\"], \"tactics\": \"Prioriza supervivencia antes del engage.\" }, { \"name\": \"Snowball\", \"primaryTarget\": \"Cerrar partida rapido\", \"items\": [\"Plated Steelcaps\", \"Death's Dance\", \"Sterak's Gage\"], \"tactics\": \"Forzar escaramuzas tras ventaja temprana.\" } ] }";
    }
}
