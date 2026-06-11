// ============================================================================
// coachingTips.js — Tips de coaching estilo "coach del banquillo" por fase y rol
// ----------------------------------------------------------------------------
// Estructura:
// COACHING_TIPS[phase][role] → array de strings (consejos cortos en ES).
// Fases por gameTime (segundos):
// early → 0 – 7 min (0 – 420)
// laning → 7 – 14 min (420 – 840)
// midgame → 14 – 21 min (840 – 1260)
// lategame → 21 – 28 min (1260 – 1680)
// endgame → 28+ min (1680+) — tips comunes a TODOS los roles
//
// Roles soportados: TOP, JG, MID, ADC, SUPPORT.
// Para `endgame` se usa la clave ALL.
//
// API:
// getCoachingTip(phase, role) → string aleatorio del bucket o null.
// getCoachingTipIndex(phase, role, index)
// → string en `index` con wrap-around o null.
// getPhaseFromGameTime(seconds) → 'early' | 'laning' | 'midgame' | 'lategame' | 'endgame'.
// ============================================================================

export const COACHING_TIPS = {
  early: { // 0-7 min
    TOP: [
      "Prioriza el farm sobre los trades si no tienes ventaja de runa",
      "Guarda el TP para hacer presión en bot tras ganar el nivel 3",
      "Freezea cerca de tu torre si vas perdiendo el matchup",
      "Empuja al nivel 2 para forzar trade antes de que reaccione",
    ],
    JG: [
      "Empieza por el buff que esté más cerca de la primera pelea de bot",
      "Trackea al JG enemigo por los lados del mapa que no limpió",
      "Pelea scuttle del 3:15 solo si tu top o mid pueden ayudar",
      "Wardea raptors/gruff enemigos antes del primer scuttle",
    ],
    MID: [
      "Pushea la wave antes de hacer roam para no perder CS ni EXP",
      "Controla la visión del río antes del min 5",
      "Anota flashes enemigos: cada flash gastado = 5 min de ventana",
      "Si tu jg ganka tu mid, llama al freeze para encadenar el trade",
    ],
    ADC: [
      "Last-hit bajo torre: al 66% HP para cañones, 33% para melee",
      "Posiciónate detrás de tu minion wave para evitar el engage enemigo",
      "No empujes contra setup de gank — wardea ríu primero",
      "Sincroniza recall con tu support: solo en bot = muerto",
    ],
    SUPPORT: [
      "Coloca wards en los arbustos del río antes del min 2:00",
      "Haz el primer walk-in level 1 para ganar visión del jungle enemigo",
      "No gastes Exhaust/Ignite sin coordinar con ADC",
      "Roam al mid si tu ADC puede farmear seguro y el mid lo necesita",
    ],
  },
  laning: { // 7-14 min
    TOP: [
      "Cuando el JG enemigo aparece bot, es tu señal para atacar torre",
      "Si tienes ventaja de TP, úsalo en bot cuando caiga la torre top",
      "Hala las placas de la torre antes del minuto 14 para extra gold",
      "Pushea antes del recall — perder 2 oleadas = perder el split",
    ],
    JG: [
      "Prioriza el drake si tu bot lane tiene ventaja o es 50-50",
      "Haz counter-jungle cuando veas al JG enemigo en el mapa",
      "No pelees solo si el jg enemigo invadió tu jungle",
      "Cuenta flashes del support enemigo — uno caído = kill setup",
    ],
    MID: [
      "Roamea bot cuando tu wave esté pushando lenta hacia su torre",
      "Coge el scuttler cuando el JG enemigo esté del otro lado",
      "Counter-pickea side lanes con TP para controlar oleadas",
      "No reveles tu ulti contra setup pre-fight; guarda para teamfight",
    ],
    ADC: [
      "Cuando llegues a 3 objetos, cambia a juego agresivo",
      "Comunica a tu support cuándo quieres hacer el engage",
      "Halar placa de torre + recall = 200g extra por oleada",
      "Si vas detrás, freezea cerca de torre y espera al jg",
    ],
    SUPPORT: [
      "Rota a mid si ves que el MID enemigo está overextended",
      "Desvard los arbustos del rio cuando tengas disponible el Sweeper",
      "Wardea pit del dragon ANTES de la pelea — visión es victoria",
      "Compra un control ward cada recall — denegar visión gana fights",
    ],
  },
  midgame: { // 14-21 min
    TOP: [
      "Splitpush bot si tu equipo tiene el Drake controlado",
      "Iguala waves antes de juntarte con el equipo en objetivos",
      "Cuidado con flank — un ulti desde fog wipea backline",
      "Trade torre por dragon es siempre profit (salvo inhibidora)",
    ],
    JG: [
      "Usa el control de visión para preparar el Baron desde el min 18",
      "Si ganáis el Drake 3, empieza a presionar hacia Baron",
      "Contesta dragon O cede por baron pit — nunca ambos",
      "Smiteguard objetivos solo si tienes visión del jg enemigo",
    ],
    MID: [
      "Siempre flanquea por los lados antes de un fight de equipo",
      "Sé el primero en llevar los objetivos épicos al equipo",
      "Pickeo desde fog = teamfight gratis — no engagee abierto",
      "Tu cooldown de ulti define ventanas de pelea del equipo",
    ],
    ADC: [
      "En fights de equipo mantente en el backline, nunca adelantado",
      "Prioriza dañar al objetivo más accesible, no siempre al carry",
      "No te aísles — tu valor es en teamfight 5v5",
      "Cada placa de torre vale 175g + presión de mapa: foco en torres",
    ],
    SUPPORT: [
      "Entra en los flancos del enemigo con tu CC antes del fight principal",
      "Guarda tus habilidades de protección para cuando tu ADC sea foco",
      "Visión proactiva: warde pit antes del spawn, no después",
      "Tu engage = la pelea. Si fallas, perdiste 4 cooldowns",
    ],
  },
  lategame: { // 21-28 min
    TOP: [
      "Con Barón, splitpushea 1-3-1 con el campeón de más presión de tu equipo",
      "No despilfarres el buff de Barón — planifica el asalto a base",
      "Wardea jungla enemiga antes de pelear — flank = ace",
      "Trade Baron por Soul: Soul gana teamfights, Baron acelera siege",
    ],
    JG: [
      "Con Elder Drake, busca el fight si tu comp tiene AoE o burst",
      "Niega el vision de Baron con wards y sweepers antes de intentarlo",
      "Smite ready para Baron — perderlo = -3000g del equipo",
      "Counter-engage > engage: espera el pick de tu support",
    ],
    MID: [
      "Haz side-lane con tus mejores waves si tienes ventaja de escala",
      "En composiciones de poke, mantén al equipo agrupado para poke continuo",
      "Stand back en teamfight — assassins te buscan antes que ADC",
      "Sweeper > control ward en lategame: deniega visión enemiga",
    ],
    ADC: [
      "En late game eres el carry principal — pelea desde posición segura siempre",
      "Con items completos haz 1v1 a cualquier enemigo que esté solo",
      "GA, Maw o Wits End según el threat dominante del equipo enemigo",
      "Bait cooldowns con QSS — fuerza al engage, no juegues su game",
    ],
    SUPPORT: [
      "Tu prioridad cambia a proteger al carry con más objetos del equipo",
      "Coloca visión en los flancos del Baron/Nashor antes de cada intento",
      "Body block engages — tu vida vale menos que la del ADC",
      "Vanguard initiate: pickea al backliner enemigo aislado",
    ],
  },
  endgame: { // 28+ min
    ALL: [
      "Con ventaja: presión las tres lanes simultáneamente antes de Baron/Elder",
      "Sin ventaja: busca el pick aislado con trampa de visión para resetear el juego",
      "Siempre haz base después de un fight ganado cerca de Baron — no intentéis Baron con poca vida",
      "El Inhibidor abierto = presión constante de super minions, aprovéchalo",
    ],
    TOP: [
      "Split push solo si tienes TP listo y tu equipo puede stall 30s sin ti",
      "Elder execute > Baron buff: prioriza Elder en endgame",
      "Wardea TODAS las rutas de flanqueo — un asesino cierra la partida",
      "Nashor solo si llevas GA o están atrás — riesgo/reward absoluto",
    ],
    JG: [
      "Smite contestado: 1 segundo de delay y perdiste Elder",
      "Cuenta cooldowns enemigos uno por uno — sin info, sin pelea",
      "Catch en fog = ace. Espera la oportunidad, no la fuerces",
      "Si pierdes baron, no force fight — stall hasta el siguiente spawn",
    ],
    MID: [
      "Tu ulti debe pegar mínimo a 2 — si fallas, perdiste la pelea",
      "Pickeo desde fog = victoria, no engagee 5v5 abierto",
      "GA o Zhonya: un escape adicional vale 5000g en endgame",
      "Si vas escalado, juega como ADC: detrás del front, full DPS",
    ],
    ADC: [
      "Un solo paso fuera de posición = ace — mantén la línea",
      "GA + IE + Bloodthirster = late game completo, botas situacionales",
      "No te acerques al baron pit sin tu equipo full HP",
      "Maridaje peeling: support y tank están para ti, no los abandones",
    ],
    SUPPORT: [
      "Tu rol es body block + visión — no mueras antes que el carry",
      "Wardea Elder pit con CONTROL ward — visión normal no basta",
      "Stopwatch/Zhonya como support: salva al carry de ulti enemigo",
      "Engage perfecto = victoria — engage malo = ace en contra, espera",
    ],
  },
};

// ─── Helpers ────────────────────────────────────────────────────────────────
const PHASE_BUCKETS = [
  { phase: 'early',    maxSec: 7 * 60 },
  { phase: 'laning',   maxSec: 14 * 60 },
  { phase: 'midgame',  maxSec: 21 * 60 },
  { phase: 'lategame', maxSec: 28 * 60 },
];

export function getPhaseFromGameTime(seconds) {
  const s = Number(seconds) || 0;
  for (const { phase, maxSec } of PHASE_BUCKETS) {
    if (s < maxSec) return phase;
  }
  return 'endgame';
}

function bucketFor(phase, role) {
  const phaseBucket = COACHING_TIPS[phase];
  if (!phaseBucket) return [];
  const upperRole = String(role || '').toUpperCase();
  const tips = phaseBucket[upperRole] || phaseBucket.ALL || [];
  return Array.isArray(tips) ? tips : [];
}

export function getCoachingTip(phase, role) {
  const tips = bucketFor(phase, role);
  if (!tips.length) return null;
  return tips[Math.floor(Math.random() * tips.length)];
}

// Útil para rotación determinista (botón ↻ del UI).
export function getCoachingTipIndex(phase, role, index) {
  const tips = bucketFor(phase, role);
  if (!tips.length) return null;
  const safeIndex = ((Number(index) || 0) % tips.length + tips.length) % tips.length;
  return tips[safeIndex];
}

export function getCoachingTipCount(phase, role) {
  return bucketFor(phase, role).length;
}
