// ============================================================================
// computeRadarStats — deriva los 5 ejes del FactionRadarChart
// ----------------------------------------------------------------------------
// Función PURA. Recibe `matches` (array de partidas con shape novaStats.js o el
// normalizado del front) y devuelve `[Winrate, CS/min, Oro, Daño, Visión]`
// donde cada componente es 0..100.
//
// Normalización: cada métrica (salvo el winrate, que ya es un %) tiene un
// "techo de referencia". Valores por encima del techo se cap a 100 (no
// penalizamos buen juego). Defaults a 50 cuando no hay datos para que el radar
// se renderice como un pentágono medio en lugar de colapsar a un punto.
//
// Compatibilidad de campos del match (novaStats.js + backend canónico):
//   Resultado → m.result ('W'|'L'|'WIN'|'LOSS') | m.win
//   CS/min    → m.cspm | m.csPerMin
//   Oro       → m.gold (si falta, se estima de CS + KDA + duración)
//   Daño      → m.damageToChamps | m.totalDamageDealtToChampions
//   Visión    → m.visionScore
// ============================================================================

// Techos de referencia por eje (el valor que mapea a 100 pts).
const CEILINGS = {
  cspm:   9.0,     // CS/min ≥ 9.0   → 100 pts
  gold:   16000,   // oro total/partida ≥ 16k → 100 pts
  damage: 35000,   // daño a campeones/partida ≥ 35k → 100 pts
  vision: 40,      // vision score/partida ≥ 40 → 100 pts
};

function clamp01to100(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function normalize(value, ceiling) {
  if (!Number.isFinite(value) || ceiling <= 0) return 0;
  return clamp01to100((value / ceiling) * 100);
}

function isWin(m) {
  return m.result === 'W' || m.result === 'WIN' || m.win === true;
}

// Oro de la partida. El summary lean de Riot (Match V5) no siempre trae el oro,
// así que si falta lo estimamos de forma plausible: oro de súbditos (~21/CS) +
// kills/asistencias + oro pasivo por tiempo. Para el radar (perfil aproximado)
// basta con un valor coherente, no exacto.
function goldForMatch(m) {
  if (Number.isFinite(m.gold)) return m.gold;
  const cs  = Number(m.cs ?? m.totalMinionsKilled) || 0;
  const k   = Number(m.kills)   || 0;
  const a   = Number(m.assists) || 0;
  const dur = Number(m.durationMin ?? m.durationMinutes) || 30;
  return cs * 21 + k * 300 + a * 150 + dur * 120 + 500;
}

/**
 * @param {Array} matches — partidas (shape novaStats.js o normalizado)
 * @returns {number[]} `[Winrate, CS/min, Oro, Daño, Visión]` (5 valores 0..100)
 */
export function computeRadarStats(matches) {
  if (!Array.isArray(matches) || matches.length === 0) {
    // Defaults — radar plano "neutral" para que la UI no colapse a un punto.
    return [50, 50, 50, 50, 50];
  }

  const n = matches.length;

  // ── Winrate: % de victorias (ya es 0..100, sin techo) ─────────────────────
  const wins = matches.filter(isWin).length;
  const winrate = clamp01to100((wins / n) * 100);

  // ── CS/min: promedio normalizado ──────────────────────────────────────────
  const sumCs = matches.reduce((acc, m) => acc + (Number(m.cspm ?? m.csPerMin) || 0), 0);
  const csmin = normalize(sumCs / n, CEILINGS.cspm);

  // ── Oro: oro medio por partida (real o estimado) normalizado ──────────────
  const sumGold = matches.reduce((acc, m) => acc + goldForMatch(m), 0);
  const oro = normalize(sumGold / n, CEILINGS.gold);

  // ── Daño: daño a campeones medio por partida normalizado ──────────────────
  const sumDmg = matches.reduce(
    (acc, m) => acc + (Number(m.damageToChamps ?? m.totalDamageDealtToChampions) || 0),
    0
  );
  const dano = normalize(sumDmg / n, CEILINGS.damage);

  // ── Visión: vision score medio por partida normalizado ────────────────────
  const sumVision = matches.reduce((acc, m) => acc + (Number(m.visionScore) || 0), 0);
  const vision = normalize(sumVision / n, CEILINGS.vision);

  return [winrate, csmin, oro, dano, vision];
}
