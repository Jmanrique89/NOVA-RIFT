// ============================================================================
// mentalCoach.js — Motor puro del Coach Mental
// ----------------------------------------------------------------------------
// Reglas de bienestar que deciden si es buen momento para jugar ranked, según
// investigación de psicología del jugador de LoL.
//
// Función PURA (sin React, sin estado, sin red): vive en utils/ con cobertura
// de tests dedicada (src/__tests__/mentalCoach.test.js), igual que el resto de
// motores del FE (eloEstimate, calcOffPoolStats…). El componente
// MentalCoachCard solo consume `evaluateMentalState` y mapea el estado a color.
//
// Estados (semáforo): OPTIMAL (verde) · CAUTION (amarillo) · AVOID (rojo).
// ============================================================================

/**
 * @module utils/mentalCoach
 */

/**
 * @typedef {'OPTIMAL'|'CAUTION'|'AVOID'} MentalStatus
 * ÓPTIMO / PRECAUCIÓN / NO JUEGUES.
 */

/**
 * @typedef {Object} MentalCoachMatch
 * @property {string} result Resultado de la partida. Acepta el shape del mock
 * (`'W'` | `'L'`) y el del backend Riot (`'WIN'` | `'LOSS'`).
 */

/**
 * @typedef {Object} MentalEvaluation
 * @property {MentalStatus} status Estado mental resultante.
 * @property {string} message Texto de recomendación contextual (en español).
 */

// ── Etiquetas en mayúsculas por estado (texto del indicador) ─────────────────
// Texto puro (sin color): el color/semáforo lo aplica el componente con los
// tokens semánticos de COLORS. Aquí solo vive la copy en español.
export const STATUS_LABELS = {
  OPTIMAL: 'ÓPTIMO',
  CAUTION: 'PRECAUCIÓN',
  AVOID:   'NO JUEGUES',
};

// ── Titulares del veredicto (vista de detalle / modal) ───────────────────────
// Versión en lenguaje natural del estado global, pensada como título grande de
// la pantalla "¿listo para otra ranked?". La copy vive en el motor (igual que
// STATUS_LABELS) para que el componente solo la muestre, no la redacte.
export const STATUS_VERDICTS = {
  OPTIMAL: 'Listo para otra ranked',
  CAUTION: 'Puedes jugar, con cabeza',
  AVOID:   'No busques partida ahora',
};

// ── Normalización del resultado de partida ───────────────────────────────────
// Soporta ambos shapes (mock 'W'/'L' y backend Riot 'WIN'/'LOSS') para que el
// caller no tenga que traducir nada antes de pasar las partidas.

/** @param {string} r Resultado crudo. @returns {boolean} true si es victoria. */
function isWin(r) {
  return r === 'W' || r === 'WIN';
}

/** @param {string} r Resultado crudo. @returns {boolean} true si es derrota. */
function isLoss(r) {
  return r === 'L' || r === 'LOSS';
}

/**
 * Calcula la racha que arranca en la partida más reciente (índice 0). Cuenta
 * cuántas partidas consecutivas comparten el resultado de la primera, parando
 * en cuanto cambia. Sin datos o con un resultado no reconocible devuelve count 0.
 *
 * @param {MentalCoachMatch[]} matches Partidas en orden descendente.
 * @returns {{ type: ('win'|'loss'|null), count: number }} Tipo y longitud.
 */
export function leadingStreak(matches) {
  if (!Array.isArray(matches) || matches.length === 0) {
    return { type: null, count: 0 };
  }
  const first = matches[0]?.result;
  const firstIsWin = isWin(first);
  const firstIsLoss = isLoss(first);
  if (!firstIsWin && !firstIsLoss) return { type: null, count: 0 };

  let count = 0;
  for (const m of matches) {
    const w = isWin(m?.result);
    const l = isLoss(m?.result);
    if (firstIsWin && w) count++;
    else if (firstIsLoss && l) count++;
    else break; // se rompe la racha en cuanto cambia el resultado
  }
  return { type: firstIsWin ? 'win' : 'loss', count };
}

/**
 * Evalúa el estado mental del jugador según las reglas de bienestar de la
 * investigación. Determinista para unos mismos datos → fácil de testear.
 *
 * Orden de prioridad (de mayor a menor): la seguridad mental (tilt) manda sobre
 * todo. CUALQUIER derrota reciente (1L/2L/3L+) pisa al resto de señales — si
 * acabas de perder, ni el LP bajo ni la madrugada cambian el consejo correcto:
 * no busques partida en caliente. La madrugada pesa más que una racha positiva.
 *
 * 1. 3+ derrotas seguidas → AVOID · "Cierra la cola y sal a dar un paseo…"
 * 2. 2 derrotas seguidas → CAUTION · "Corta ya: 30 min lejos de la pantalla…"
 * 3. 1 derrota reciente → CAUTION · "Acabas de perder. Espera 10 minutos…"
 * 4. madrugada 00:00–04:00 → CAUTION · "Rendimiento cognitivo reducido…"
 * 5. recién ascendido (LP < 20) → OPTIMAL · "Momento de impulso. Tu motivación…"
 * 6. 3+ victorias seguidas → OPTIMAL · "Racha positiva. Buen momento…"
 * 7. por defecto → CAUTION · mensaje neutro motivacional
 *
 * @param {{ matches?: MentalCoachMatch[], hour?: number, lp?: number }} [data]
 * `matches` en orden descendente; `hour` en 0-23; `lp` en la división actual.
 * @returns {MentalEvaluation} Estado + recomendación contextual.
 */
export function evaluateMentalState({ matches, hour, lp } = {}) {
  const streak = leadingStreak(matches);

  // ── Regla 1 — 3+ derrotas seguidas → tilt (máxima prioridad: bienestar) ────
  // Loss streak + sesgo de confirmación + cortisol acumulado: parar es la mejor
  // jugada competitiva (Shen et al., ACM CHI 2021; Kahneman & Tversky, λ≈2).
  // El consejo es concreto y accionable (parar y volver mañana), no genérico.
  if (streak.type === 'loss' && streak.count >= 3) {
    return {
      status: 'AVOID',
      message: `${streak.count} derrotas seguidas. Cierra la cola y sal a dar un paseo: volver mañana gana más LP que la siguiente partida.`,
    };
  }

  // ── Regla 2 — 2 derrotas seguidas → cortar la espiral antes del tilt ───────
  // Intervención temprana: dos derrotas aún no son tilt, pero la probabilidad
  // de encadenar la tercera sube si se re-entra en caliente. Por eso escala la
  // pausa (30 min) sobre los 10 min de la regla de 1 derrota.
  if (streak.type === 'loss' && streak.count === 2) {
    return {
      status: 'CAUTION',
      message: 'Dos derrotas seguidas. Corta ya: 30 minutos lejos de la pantalla y vuelve solo si tienes un plan claro para la siguiente.',
    };
  }

  // ── Regla 3 — 1 derrota reciente → pausa de 10 min antes de buscar cola ────
  // Mensaje directo y literal tras perder. Re-entrar en caliente tras una
  // derrota es la forma más rápida de encadenar la segunda (loss-chasing;
  // Kahneman & Tversky: la derrota pesa ~2x y empuja a "recuperar"). Prioridad
  // ALTA a propósito: pisa madrugada/LP/racha — si acabas de perder, el consejo
  // correcto es siempre esperar, da igual el resto de señales.
  if (streak.type === 'loss' && streak.count === 1) {
    return {
      status: 'CAUTION',
      message: 'Acabas de perder. Es mejor que esperes 10 minutos antes de buscar partida: rejugar en caliente es la forma más rápida de encadenar la segunda.',
    };
  }

  // ── Regla 4 — madrugada 00:00–04:00 → rendimiento cognitivo reducido ───────
  // Valle circadiano + presión homeostática del sueño (Bougard et al., 2016;
  // datos de winrate por hora de LoL Brain). Horas 0,1,2,3 (antes de las 04:00).
  if (typeof hour === 'number' && hour >= 0 && hour < 4) {
    return {
      status: 'CAUTION',
      message: 'Rendimiento cognitivo reducido en horario nocturno.',
    };
  }

  // ── Regla 5 — recién ascendido de división (LP < 20) → pico de motivación ──
  // LP bajo en la nueva división = ascenso reciente. Aprovechar el impulso.
  if (typeof lp === 'number' && lp >= 0 && lp < 20) {
    return {
      status: 'OPTIMAL',
      message: 'Momento de impulso. Tu motivación está alta.',
    };
  }

  // ── Regla 6 — 3+ victorias seguidas → racha positiva / estado de flujo ─────
  if (streak.type === 'win' && streak.count >= 3) {
    return {
      status: 'OPTIMAL',
      message: 'Racha positiva. Buen momento para jugar ranked.',
    };
  }

  // ── Por defecto — precaución neutra/motivacional ───────────────────────────
  return {
    status: 'CAUTION',
    message: 'Juega con cabeza: fíjate un objetivo por partida.',
  };
}

/**
 * @typedef {'OPTIMAL'|'CAUTION'|'AVOID'|'NEUTRAL'} FactorStatus
 * Semáforo de una señal por separado. NEUTRAL = la señal no aporta ni a favor
 * ni en contra (el detalle se pinta en gris en la vista de detalle).
 */

/**
 * @typedef {Object} MentalFactor
 * @property {string} id        Identificador estable de la señal.
 * @property {string} label     Nombre legible de la señal (titular de la fila).
 * @property {FactorStatus} status Semáforo de la señal evaluada de forma aislada.
 * @property {string} detail    Explicación corta y contextual (en español).
 */

/**
 * Desglosa la evaluación en señales independientes para la vista de detalle.
 * No sustituye a `evaluateMentalState`: el veredicto global mantiene su
 * jerarquía de prioridades (una señal pisa a otra), mientras que aquí cada
 * señal se evalúa de forma AUTÓNOMA para explicar por separado cómo se llega a
 * ese veredicto. Por eso la madrugada sigue marcándose como precaución aunque
 * la racha sea de victorias: en el desglose no hay jerarquía.
 *
 * Los umbrales reutilizan exactamente los de `evaluateMentalState` (rachas,
 * franja 00:00–04:00, LP < 20) para que el detalle no contradiga al veredicto.
 *
 * @param {{ matches?: MentalCoachMatch[], hour?: number, lp?: number }} [data]
 * @returns {MentalFactor[]} Una entrada por señal: racha, hora y momento de liga.
 */
export function evaluateMentalFactors({ matches, hour, lp } = {}) {
  const streak = leadingStreak(matches);

  // ── Señal · Racha reciente ─────────────────────────────────────────────────
  // Mismo escalado que las reglas 1-3 y 6 del veredicto. Sin racha relevante
  // (1-2 victorias, racha mixta o sin datos) → NEUTRAL: ni ayuda ni penaliza.
  let streakFactor;
  if (streak.type === 'loss' && streak.count >= 3) {
    streakFactor = { status: 'AVOID',   detail: `${streak.count} derrotas seguidas: riesgo de tilt` };
  } else if (streak.type === 'loss' && streak.count === 2) {
    streakFactor = { status: 'CAUTION', detail: 'Dos derrotas seguidas: corta la espiral' };
  } else if (streak.type === 'loss' && streak.count === 1) {
    streakFactor = { status: 'CAUTION', detail: 'Acabas de perder: espera 10 minutos' };
  } else if (streak.type === 'win' && streak.count >= 3) {
    streakFactor = { status: 'OPTIMAL', detail: `${streak.count} victorias seguidas: buen momento` };
  } else {
    streakFactor = { status: 'NEUTRAL', detail: 'Sin racha activa' };
  }

  // ── Señal · Hora del día ───────────────────────────────────────────────────
  // Franja 00:00–03:59 = valle circadiano (regla 4). Fuera de ahí no penaliza.
  const isLateNight = typeof hour === 'number' && hour >= 0 && hour < 4;
  const hourFactor = isLateNight
    ? { status: 'CAUTION', detail: 'Madrugada: rendimiento cognitivo reducido' }
    : { status: 'OPTIMAL', detail: 'Horario sin penalización cognitiva' };

  // ── Señal · Momento de liga (LP) ───────────────────────────────────────────
  // LP < 20 = ascenso reciente, pico de motivación (regla 5). LP alto en la
  // división o sin dato no inclina la balanza → NEUTRAL.
  let momentumFactor;
  if (typeof lp === 'number' && lp >= 0 && lp < 20) {
    momentumFactor = { status: 'OPTIMAL', detail: 'Ascenso reciente: aprovecha el impulso' };
  } else if (typeof lp === 'number') {
    momentumFactor = { status: 'NEUTRAL', detail: `${lp} LP en tu división actual` };
  } else {
    momentumFactor = { status: 'NEUTRAL', detail: 'Sin datos de LP' };
  }

  return [
    { id: 'streak',   label: 'Racha reciente',  ...streakFactor },
    { id: 'hour',     label: 'Hora del día',    ...hourFactor },
    { id: 'momentum', label: 'Momento de liga', ...momentumFactor },
  ];
}
