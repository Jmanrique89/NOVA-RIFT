// ============================================================================
// championStats — agregaciones por campeón desde el historial
// ----------------------------------------------------------------------------
// Función pura. Recibe `matches` y `championName` y devuelve las stats
// agregadas que necesita ChampionDetailModal:
//
// { games, wins, losses, winrate, avgKda, avgCs, avgVision, longestWinStreak,
// winRateSparkline (array de 0/1 de las últimas N partidas, antiguas → nuevas) }
//
// Compatibilidad de campos: igual que el resto del proyecto, soporta el
// shape de novaStats.js (`cspm`, `durationMin`, `result: 'W'|'L'`) y
// cualquier shape canónico futuro del backend (`csPerMin`, `durationMinutes`,
// `result: 'WIN'|'LOSS'`).
// ============================================================================

const isWin = (m) => m.result === 'W' || m.result === 'WIN';

/**
 * Sparkline binario {0,1} de las últimas `windowSize` partidas con el champ.
 * Orden: antigua → nueva (reverse del array original que viene en orden
 * descendente por fecha en `NOVA_MATCHES`).
 */
function buildWinSparkline(matches, windowSize) {
  const recent = matches.slice(0, windowSize).reverse();
  return recent.map(m => (isWin(m) ? 1 : 0));
}

/**
 * Calcula la racha de victorias más larga en una secuencia.
 */
function longestWinStreak(matches) {
  // Recorremos del más antiguo al más nuevo para contar rachas correctamente.
  const reversed = [...matches].reverse();
  let best = 0;
  let cur  = 0;
  for (const m of reversed) {
    if (isWin(m)) { cur++; best = Math.max(best, cur); }
    else { cur = 0; }
  }
  return best;
}

/**
 * Stats agregadas por campeón.
 *
 * @param {Array} matches
 * @param {string} championName — id canónico DataDragon ('Lucian', 'MissFortune'…)
 * @param {Object} [opts]
 * @param {number} [opts.sparklineWindow=10]
 * @returns {{
 * games, wins, losses, winrate,
 * avgKda, avgCs, avgVision, avgDamage,
 * longestWinStreak, sparkline,
 * bestKda, bestCs,
 * }}
 */
export function statsForChampion(matches, championName, opts = {}) {
  const windowSize = opts.sparklineWindow ?? 10;
  const filtered = (matches || []).filter(m => m.championName === championName);

  if (filtered.length === 0) {
    return {
      games: 0, wins: 0, losses: 0, winrate: 0,
      avgKda: 0, avgCs: 0, avgVision: 0, avgDamage: 0, avgGold: 0,
      longestWinStreak: 0, sparkline: [],
      bestKda: 0, bestCs: 0,
    };
  }

  const games  = filtered.length;
  const wins   = filtered.filter(isWin).length;
  const losses = games - wins;
  const winrate = Math.round((wins / games) * 100);

  const sumKda    = filtered.reduce((s, m) => s + (Number(m.kda) || 0), 0);
  const sumCs     = filtered.reduce((s, m) => s + (Number(m.cspm ?? m.csPerMin) || 0), 0);
  const sumVision = filtered.reduce((s, m) => s + (Number(m.visionScore) || 0), 0);
  const sumDamage = filtered.reduce((s, m) => s + (Number(m.damageToChamps ?? m.damage) || 0), 0);
  // Oro: lo consume la métrica ORO del modal de campeón. Los mocks traen `gold`
  // y las partidas reales aportarán `goldEarned` cuando el backend lo exponga;
  // si no hay dato, queda en 0 y el modal muestra '--'.
  const sumGold   = filtered.reduce((s, m) => s + (Number(m.gold ?? m.goldEarned) || 0), 0);

  const bestKda = Math.max(...filtered.map(m => Number(m.kda) || 0));
  const bestCs  = Math.max(...filtered.map(m => Number(m.cs) || 0));

  return {
    games,
    wins,
    losses,
    winrate,
    avgKda:    Math.round((sumKda    / games) * 10) / 10,
    avgCs:     Math.round((sumCs     / games) * 10) / 10,
    avgVision: Math.round((sumVision / games) * 10) / 10,
    avgDamage: Math.round(sumDamage  / games),
    avgGold:   Math.round(sumGold    / games),
    longestWinStreak: longestWinStreak(filtered),
    sparkline:        buildWinSparkline(filtered, windowSize),
    bestKda:          Math.round(bestKda * 10) / 10,
    bestCs,
  };
}

/**
 * Devuelve un nombre humano para el campeón si conocemos su displayName.
 * Pequeño diccionario para los más comunes; si no, devuelve el id tal cual.
 */
const CHAMPION_DISPLAY_NAME = {
  MissFortune: 'Miss Fortune',
  LeeSin:      'Lee Sin',
  KhaZix:      "Kha'Zix",
  KaiSa:       "Kai'Sa",
  KSante:      'K\'Sante',
  XinZhao:     'Xin Zhao',
  MasterYi:    'Master Yi',
  TwistedFate: 'Twisted Fate',
  JarvanIV:    'Jarvan IV',
  Renata:      'Renata Glasc',
};

export function displayChampionName(id) {
  if (!id) return '';
  return CHAMPION_DISPLAY_NAME[id] || id;
}
