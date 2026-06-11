// ============================================================================
// kpiTargets.js — objetivos semanales de coaching (sistema KPI semana 1/2/3+)
// ----------------------------------------------------------------------------
// Targets simplificados en 3 buckets de rango (Bronce-Plata / Oro-Platino /
// Diamante+) para el widget de KPI semanal del Hub/Profile. Los benchmarks
// granulares por división siguen viviendo en utils/divisionBenchmarks.js —
// este fichero es la capa "macro" que consume el coaching widget para mostrar
// un único objetivo claro por semana.
// ============================================================================

// Buckets de rango — Iron cae a low, Emerald a high (no aparecen en el spec
// original pero se asimilan al bucket adyacente para no dejar huecos).
export const RANK_BUCKETS = {
  LOW:  ['IRON', 'BRONZE', 'SILVER'],
  MID:  ['GOLD', 'PLATINUM'],
  HIGH: ['EMERALD', 'DIAMOND', 'MASTER', 'GRANDMASTER', 'CHALLENGER'],
};

export function bucketForTier(tier) {
  const T = String(tier || 'GOLD').toUpperCase();
  if (RANK_BUCKETS.LOW.includes(T))  return 'LOW';
  if (RANK_BUCKETS.HIGH.includes(T)) return 'HIGH';
  return 'MID';
}

// CS/min — objetivo por rol y bucket. Los roles agrupados (TOP/MID, ADC,
// SUPPORT/JG) forman parte del sistema KPI semanal.
export const CS_PER_MIN_TARGETS = {
  TOP:     { LOW: 5.0, MID: 6.5, HIGH: 8.0 },
  MID:     { LOW: 5.0, MID: 6.5, HIGH: 8.0 },
  ADC:     { LOW: 6.0, MID: 7.5, HIGH: 9.0 },
  SUPPORT: { LOW: 0.8, MID: 1.5, HIGH: 2.2 },
  JUNGLE:  { LOW: 3.5, MID: 5.0, HIGH: 7.0 },
};

// Vision Score — objetivo en partida completa. SUPPORT y JUNGLE son los roles
// con visión como métrica prioritaria; el resto usa estos valores como
// referencia secundaria en la semana 3+.
export const VISION_SCORE_TARGETS = {
  SUPPORT: { LOW: 20, MID: 30, HIGH: 40 },
  JUNGLE:  { LOW: 20, MID: 30, HIGH: 40 },
  TOP:     { LOW: 16, MID: 28, HIGH: 50 },
  MID:     { LOW: 18, MID: 32, HIGH: 58 },
  ADC:     { LOW: 16, MID: 28, HIGH: 50 },
};

export function csTargetFor(role, tier) {
  const r = String(role || 'ADC').toUpperCase();
  const bucket = bucketForTier(tier);
  const table = CS_PER_MIN_TARGETS[r] || CS_PER_MIN_TARGETS.ADC;
  return table[bucket];
}

export function visionTargetFor(role, tier) {
  const r = String(role || 'SUPPORT').toUpperCase();
  const bucket = bucketForTier(tier);
  const table = VISION_SCORE_TARGETS[r] || VISION_SCORE_TARGETS.SUPPORT;
  return table[bucket];
}

// ─── KPI semanal — qué se muestra según la semana del usuario en la app ──────
// Semana 1: CS/min (o Vision para SUPPORT/JG, que no se rigen por CS).
// Semana 2: Vision Score (objetivo de control de mapa).
// Semana 3+: KPI combinado — gana relevancia el rol y se alternan métricas.
export function pickWeeklyKpi(week, role) {
  const w = Math.max(1, Math.floor(week || 1));
  const r = String(role || 'ADC').toUpperCase();
  const visionRoles = r === 'SUPPORT' || r === 'JUNGLE';

  if (w === 1) {
    // Semana 1: lo más medible y motivador del rol del jugador
    return visionRoles ? 'VISION' : 'CSPM';
  }
  if (w === 2) {
    // Semana 2: la cara opuesta — fomenta hábitos completos
    return visionRoles ? 'CSPM' : 'VISION';
  }
  // Semana 3+: combinado — alterna por paridad de semana para mantener foco
  return w % 2 === 1 ? 'CSPM' : 'VISION';
}

// Texto motivacional según el % de avance hacia el objetivo (0..1+).
export function motivationFor(progress) {
  if (!Number.isFinite(progress)) return 'Sigue practicando';
  if (progress >= 1.0)  return '¡OBJETIVO CONSEGUIDO!';
  if (progress >= 0.8)  return '¡Casi lo tienes!';
  if (progress >= 0.5)  return 'Vas bien, no pares';
  return 'Sigue practicando';
}

// ─── Muertes/partida (lower is better) y Win Rate ───────────────────
// Media de muertes aceptable por bucket — por debajo del objetivo = conseguido.
export const DEATHS_TARGETS = { LOW: 6.0, MID: 5.0, HIGH: 4.0 };

export function deathsTargetFor(tier) {
  return DEATHS_TARGETS[bucketForTier(tier)];
}

// Win rate objetivo (%) — por encima del 50% se sube; el listón crece con el rango.
export const WINRATE_TARGETS = { LOW: 50, MID: 52, HIGH: 54 };

export function winrateTargetFor(tier) {
  return WINRATE_TARGETS[bucketForTier(tier)];
}

// Labels visibles para cada KPI key.
// `lowerIsBetter`: el progreso se calcula al revés (menos = mejor).
export const KPI_LABELS = {
  CSPM:    { title: 'CS POR MINUTO',    unit: '',  axis: 'cspm' },
  VISION:  { title: 'VISION SCORE',     unit: '',  axis: 'visionScore' },
  DEATHS:  { title: 'MUERTES / PARTIDA', unit: '', axis: 'deaths', lowerIsBetter: true },
  WINRATE: { title: 'WIN RATE',         unit: '%', axis: 'winrate' },
};

// Orden canónico del selector del widget (carrusel de objetivos).
export const KPI_KEYS = ['CSPM', 'VISION', 'DEATHS', 'WINRATE'];

/**
 * Una línea de consejo accionable por KPI (misma filosofía que el
 * getSmartDailyTip del Hub: dato concreto + acción de hoy).
 *
 * @param {string} kpiKey 'CSPM' | 'VISION' | 'DEATHS' | 'WINRATE'
 * @param {number} current valor actual del jugador
 * @param {number} target objetivo
 * @returns {string} consejo de 1 línea
 */
export function kpiTipFor(kpiKey, current, target) {
  const c = Number.isFinite(current) ? current : 0;
  const t = Number.isFinite(target) ? target : 0;
  switch (kpiKey) {
    case 'CSPM':
      return c >= t
        ? 'Farmeo sólido. Mantén el ritmo incluso cuando rotes: wave antes de moverte.'
        : `Cada oleada perdida son ~100 de oro. Hoy: ${t.toFixed(1)} CS/min sin sacrificar posición.`;
    case 'VISION':
      return c >= t
        ? 'Buen control de mapa. Siguiente nivel: wardea la jungla enemiga, no solo el river.'
        : 'Hoy: 1 ward rosa en cada vuelta a base. La visión gana más partidas que las kills.';
    case 'DEATHS':
      return c <= t
        ? 'Pocas muertes regaladas — sigue jugando a no morir y deja que el rival se tire.'
        : `Estás muriendo ${c.toFixed(1)} veces/partida. Hoy: máximo ${Math.round(t)} — juega a no regalar.`;
    case 'WINRATE':
      return c >= t
        ? 'WR positivo. La estabilidad sube elo: encadena 20+ partidas con tus mismos campeones antes de tocar el pool.'
        : 'Revisa tus primeros 10 minutos: la mayoría de derrotas se deciden en el early. Juega simple.';
    default:
      return 'Constancia: pequeñas mejoras diarias suben más elo que cualquier racha.';
  }
}
