package com.novarift.coaching.application.services;

import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.Map;

/**
 * Servicio de aplicacion que actua como biblioteca de mensajes de coaching contextuales.
 *
 * <p>Mantiene en memoria 47 plantillas indexadas por la tupla
 * {@code (role, playStyle, faction, context)}. La tupla actua como clave de busqueda:
 * el motor tactico convierte el estado de la partida en una de estas claves y obtiene
 * el consejo que se mostrara al jugador.
 *
 * <ul>
 * <li><b>role</b> — TOP · JUNGLE · MID · ADC · SUPPORT (o ANY)</li>
 * <li><b>playStyle</b> — AGGRESSIVE · DEFENSIVE (o ANY)</li>
 * <li><b>faction</b> — NOXUS · DEMACIA (variantes internas de estilo) ·
 * DEFAULT (set neutro) · ANY</li>
 * <li><b>context</b> — EARLY_GAME · MID_GAME · LATE_GAME · LATE_GAME_35 · COMEBACK</li>
 * </ul>
 *
 * <p>Las facciones no son visibles para el usuario: NOXUS/DEMACIA se conservan como
 * variantes internas de estilo (agresivo/defensivo) para no romper la API, y el set
 * DEFAULT {rol x fase} garantiza coaching util para cualquier usuario, tenga la faccion
 * que tenga (o ninguna).
 *
 * <p><b>Cascada de fallback en 4 niveles</b> (ver {@link #getCoachingMessage}), de mas
 * especifico a mas generico, de modo que nunca devuelve null:
 * <ol>
 * <li>Clave exacta {@code (role, playStyle, faction, context)}.</li>
 * <li>Misma combinacion con {@code faction = "ANY"}.</li>
 * <li>Set DEFAULT por {@code (role, "ANY", "DEFAULT", context)} — cubre faccion
 * desconocida o nula.</li>
 * <li>Fallback global (mensaje de cierre de partida o constante por defecto).</li>
 * </ol>
 */
@Service
public class CoachingTemplateService {

    /** Clave compuesta inmutable usada como llave del mapa de plantillas. */
    public record CoachingKey(String role, String playStyle, String faction, String context) {}

    private static final Map<CoachingKey, String> TEMPLATES = new HashMap<>();

    static {
        // ─── TOP ────────────────────────────────────────────────────────────
        put("TOP", "AGGRESSIVE", "NOXUS", "EARLY_GAME",
            "Gana el nivel 2. Fuerza un intercambio antes de que escale. Si no dominas botton a botton, pierdes.");
        put("TOP", "AGGRESSIVE", "NOXUS", "MID_GAME",
            "El enemy jungler va a venir. Posiciónate para hacer el counter-gank. Que venga, y tú castigalo primero.");
        put("TOP", "AGGRESSIVE", "NOXUS", "LATE_GAME",
            "Esta es tu wave: protégela. Si te la roban, es derrota. No permitas waveclear gratis.");
        put("TOP", "DEFENSIVE", "DEMACIA", "EARLY_GAME",
            "Escala tranquilo. No te expongas. Cada muerte de lado es una tower y 30 CS de desventaja. Vuelve seguro.");
        put("TOP", "DEFENSIVE", "DEMACIA", "MID_GAME",
            "Control de onda es todo. Manten la wave near your tower. A nivel 9 con items, ganamos.");
        put("TOP", "DEFENSIVE", "DEMACIA", "LATE_GAME",
            "El teamfight es 5v5. Posiciónate atrás del equipo. Que la línea de tanques absorba el daño.");

        // ─── JUNGLE ─────────────────────────────────────────────────────────
        put("JUNGLE", "AGGRESSIVE", "NOXUS", "EARLY_GAME",
            "Nivel 2 es tu pico. Gank el lane más weak antes de que lo escalen. First blood = ventaja doble.");
        put("JUNGLE", "AGGRESSIVE", "NOXUS", "MID_GAME",
            "No farmees sin objetivo. Cada clear debe preparar un gank o un Dragon. Farm = tiempo muerto.");
        put("JUNGLE", "AGGRESSIVE", "NOXUS", "LATE_GAME",
            "Lee Sin no es carry. Es enganche. Encuentra al portador enemy y acábalo. Simplify.");
        put("JUNGLE", "DEFENSIVE", "DEMACIA", "EARLY_GAME",
            "Prioridad: Counter-jungle seguro. Defiende a tus laners que se exponen. Wards = tu mejor amigo.");
        put("JUNGLE", "DEFENSIVE", "DEMACIA", "MID_GAME",
            "El gold es compartido. Ayuda a escalarse a quien tiene mejor matchup. Ganareis juntos.");
        put("JUNGLE", "DEFENSIVE", "DEMACIA", "LATE_GAME",
            "Si no sabes dónde está el enemy jungler, asume que te va a flanquear. Juega lejos de paredes.");

        // ─── MID ────────────────────────────────────────────────────────────
        put("MID", "AGGRESSIVE", "NOXUS", "EARLY_GAME",
            "Domina tu lane 0-6. Lvl 6 con ulti: rota a sidelanes antes que el enemy se entere. First rotation = kill.");
        put("MID", "AGGRESSIVE", "NOXUS", "MID_GAME",
            "El mapa es tuyo si acallas la lane del enemy. Shove minions, fuerza el push, y rota.");
        put("MID", "AGGRESSIVE", "NOXUS", "LATE_GAME",
            "Push cuando el enemy está en low HP. Cuando limpio, roto. Sincronización es dinero.");
        put("MID", "DEFENSIVE", "DEMACIA", "EARLY_GAME",
            "No overextiendes. Si no tienes visión, asume el peligro. Pierde CS antes que pierdas vida.");
        put("MID", "DEFENSIVE", "DEMACIA", "MID_GAME",
            "El teamfight gira alrededor del wave. Si puedes pelear bajo torre con setup, genial. Si no, juega macro.");
        put("MID", "DEFENSIVE", "DEMACIA", "LATE_GAME",
            "Shove slow, wait for setup, ulti follow. Boring = safe = elo.");

        // ─── ADC ────────────────────────────────────────────────────────────
        put("ADC", "AGGRESSIVE", "NOXUS", "EARLY_GAME",
            "Jinx + Thresh = kill lane. Presiona minutos 0-6. Cada intercambio que ganas es un reset de poke.");
        put("ADC", "AGGRESSIVE", "NOXUS", "MID_GAME",
            "Farming es secundario. Tu prioridad es matar al enemy ADC. Si lo matas, farm 40 por minuto sin amenaza.");
        put("ADC", "AGGRESSIVE", "NOXUS", "LATE_GAME",
            "2v4 si el Support sigue la rotación. ADC + Support = pareja. Sincronización = gold en mano.");
        put("ADC", "DEFENSIVE", "DEMACIA", "EARLY_GAME",
            "Farmea seguro. 5 CS/min es más que una muerte temprana. Late game 1v5 si tienes gold.");
        put("ADC", "DEFENSIVE", "DEMACIA", "MID_GAME",
            "El Support te protege. Síguelo. Donde va él, vas tú. No splitpushees sin visión.");
        put("ADC", "DEFENSIVE", "DEMACIA", "LATE_GAME",
            "Ashe gana en teamfight. Ulti setup = guaranteed engage. Tu único trabajo es DPS seguro.");

        // ─── SUPPORT ────────────────────────────────────────────────────────
        put("SUPPORT", "AGGRESSIVE", "NOXUS", "EARLY_GAME",
            "Thresh = máquina de kills. Hook al primero que veas. Si lo enganchas, el ADC lo mata.");
        put("SUPPORT", "AGGRESSIVE", "NOXUS", "MID_GAME",
            "Visión es poder. Coloca wards en jungle entry. Cuando ves al jungler, engage. 3v2 ganado.");
        put("SUPPORT", "AGGRESSIVE", "NOXUS", "LATE_GAME",
            "El enganche es timing. Cuando el enemy se expone 1 metro, engancha. Fallo = 10s de cooldown.");
        put("SUPPORT", "DEFENSIVE", "DEMACIA", "EARLY_GAME",
            "Tu trabajo es escudo. Janna ult + negate engage. Nami ult + kite. Braum E + reduce burst.");
        put("SUPPORT", "DEFENSIVE", "DEMACIA", "MID_GAME",
            "Visión controlada es sustentable. Defiende tu bot lane. Si pierdes el support, pierden la bottom.");
        put("SUPPORT", "DEFENSIVE", "DEMACIA", "LATE_GAME",
            "Teamfight = protect positioning. Adelanta para dar space al ADC. Que sufras daño tú, no tu carry.");

        // ─── ESPECIALES ─────────────────────────────────────────────────────
        put("ANY", "ANY", "ANY", "LATE_GAME_35",
            "El mapa se cierra. Un solo teamfight y GG. Posiciónate perfecto. Un error = nexo. Calma, precisión, ejecución.");
        put("ANY", "ANY", "ANY", "COMEBACK",
            "El coinflip es tu arma. Fuerza un teamfight cuando el enemy es arrogante. Un ACE = comeback. Cree en la clutch.");

        // ─── DEFAULT — rol × fase, neutro, para cualquier usuario ───────────
        // Cubre facción desconocida/nula y playstyles sin plantilla propia.
        put("TOP", "ANY", "DEFAULT", "EARLY_GAME",
            "Juega el matchup, no el ego: intercambia solo con ventaja de nivel o de wave, y guarda el TP para volver con tempo.");
        put("TOP", "ANY", "DEFAULT", "MID_GAME",
            "Empuja tu side antes de rotar: una wave grande contra torre vale tanto como tu presencia en el teamfight.");
        put("TOP", "ANY", "DEFAULT", "LATE_GAME",
            "Splitpush con visión: presiona el side contrario al objetivo y fuerza al rival a elegir entre dos males.");

        put("JUNGLE", "ANY", "DEFAULT", "EARLY_GAME",
            "Full clear con timing: llega al primer scuttle con nivel 3 y gankea solo lanes con CC o con ventaja clara.");
        put("JUNGLE", "ANY", "DEFAULT", "MID_GAME",
            "Juega alrededor de objetivos: 90 segundos antes de cada Dragón asegura la visión del pit y prepara el lado.");
        put("JUNGLE", "ANY", "DEFAULT", "LATE_GAME",
            "No mueras primero: tu Smite vale la partida. Llega vivo a Baron/Elder y deja que el frontline inicie.");

        put("MID", "ANY", "DEFAULT", "EARLY_GAME",
            "Prioridad de wave = control del mapa: empuja rápido y usa esa ventana para wardear o seguir a tu jungla.");
        put("MID", "ANY", "DEFAULT", "MID_GAME",
            "Rota con la wave empujada, nunca congelada: cada rotación sin push regala una torre gratis.");
        put("MID", "ANY", "DEFAULT", "LATE_GAME",
            "Agrupa y busca el pick ANTES del objetivo, no después: un catch a min 30 cierra la partida.");

        put("ADC", "ANY", "DEFAULT", "EARLY_GAME",
            "CS sobre kills: 8/min te hace carry aunque vayas 0-0. No intercambies sin tu support al lado.");
        put("ADC", "ANY", "DEFAULT", "MID_GAME",
            "Pega a lo que tengas delante: DPS constante al más cercano gana fights; perseguir al carry te mata.");
        put("ADC", "ANY", "DEFAULT", "LATE_GAME",
            "Posición > daño: en late un error tuyo es la derrota. Espera el engage de tu frontline y limpia desde atrás.");

        put("SUPPORT", "ANY", "DEFAULT", "EARLY_GAME",
            "Controla el river: ward al 1:00 en el arbusto central y castiga cada paso adelantado del rival.");
        put("SUPPORT", "ANY", "DEFAULT", "MID_GAME",
            "Visión profunda con escolta: limpia wards con tu jungla y convierte la oscuridad enemiga en picks.");
        put("SUPPORT", "ANY", "DEFAULT", "LATE_GAME",
            "Tu carry es la win condition: reserva tu cooldown defensivo para él y deja que el frontline tanquee.");
    }

    private static void put(String role, String playStyle, String faction, String context, String msg) {
        TEMPLATES.put(new CoachingKey(role, playStyle, faction, context), msg);
    }

    /**
     * Devuelve el mensaje de coaching mas adecuado aplicando la cascada de 4 niveles.
     * Va de lo mas especifico a lo mas generico (exacto → cualquier faccion → DEFAULT
     * del rol×fase → fallback global) y nunca devuelve null.
     */
    public String getCoachingMessage(String role, String playStyle, String faction, String context) {
        // 1) Búsqueda exacta
        String msg = TEMPLATES.get(new CoachingKey(role, playStyle, faction, context));
        if (msg != null) return msg;

        // 2) Fallback: cualquier facción (mismo rol + estilo)
        msg = TEMPLATES.get(new CoachingKey(role, playStyle, "ANY", context));
        if (msg != null) return msg;

        // 3) Set DEFAULT por rol×fase: cualquier usuario recibe un consejo
        // específico de su rol aunque su facción no tenga plantilla propia.
        msg = TEMPLATES.get(new CoachingKey(role, "ANY", "DEFAULT", context));
        if (msg != null) return msg;

        // 4) Fallback global
        return TEMPLATES.getOrDefault(
            new CoachingKey("ANY", "ANY", "ANY", "LATE_GAME_35"),
            "Mantén el foco. Cada decisión cuenta."
        );
    }

    /** Número de plantillas cargadas — útil para tests y diagnósticos. */
    public int getTemplateCount() {
        return TEMPLATES.size();
    }
}
