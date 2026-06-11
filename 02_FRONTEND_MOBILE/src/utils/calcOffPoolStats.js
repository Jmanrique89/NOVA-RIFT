// ============================================================================
// calcOffPoolStats.js — Calcula estadísticas on-pool vs off-champion-pool
// ----------------------------------------------------------------------------
// Decisión de diseño:
// Cálculo en FRONTEND sobre los datos de NovaRift (o reales cuando exista ingesta).
// Cuando Match-V5 de Riot alimente la DB, mover el cálculo a backend y
// sustituir la llamada por el valor que devuelva /api/v1/stats/{riotId}.
// El helper funciona igual con datos mock o reales siempre que respeten la
// misma forma del array de partidas.
//
// Uso:
// import { calcOffPoolStats } from '../utils/calcOffPoolStats';
// const stats = calcOffPoolStats(novaStats.matches, novaStats.pool);
// // → { onPool: {winrate, kda, games}, offPool: {winrate, kda, games, bleedPercent} }
//
// Tipos esperados:
// Match = { championName: string, result: 'W'|'L', kills, deaths, assists }
// pool = string[] ← lista de nombres de campeón tal como aparece en los matches
// ============================================================================

/**
 * Calcula la KDA media de un array de partidas.
 * KDA individual = (kills + assists) / max(1, deaths)
 * @param {Match[]} games
 * @returns {number} KDA redondeado a 2 decimales
 */
function _avgKDA(games) {
  if (games.length === 0) return 0;
  const total = games.reduce((acc, g) => {
    // Si el mock ya tiene kda precalculado, úsarlo para consistencia.
    // Si no, calcularlo sobre la marcha.
    const kda = typeof g.kda === 'number'
      ? g.kda
      : (g.kills + g.assists) / Math.max(1, g.deaths);
    return acc + kda;
  }, 0);
  return parseFloat((total / games.length).toFixed(2));
}

/**
 * Calcula el winrate (0–100) de un array de partidas.
 * @param {Match[]} games
 * @returns {number} entero 0–100
 */
function _winrate(games) {
  if (games.length === 0) return 0;
  const wins = games.filter(g => g.result === 'W').length;
  return Math.round((wins / games.length) * 100);
}

/**
 * Separa las partidas en on-pool y off-pool y calcula stats para cada grupo.
 *
 * @param {Match[]} matches Array de partidas (forma de NOVA_MATCHES)
 * @param {string[]} pool Nombres de campeón en el pool del usuario
 * @returns {{
 * onPool: { winrate: number, kda: number, games: number },
 * offPool: { winrate: number, kda: number, games: number, bleedPercent: number }
 * }}
 *
 * bleedPercent: cuántos puntos de winrate "sangra" el jugador por salir del pool.
 * bleedPercent = max(0, winrate_onPool - winrate_offPool)
 * Un valor de 0 significa que el off-pool no daña (o mejora) el rendimiento.
 */
export function calcOffPoolStats(matches, pool) {
  if (!Array.isArray(matches) || matches.length === 0) {
    return {
      onPool:  { winrate: 0, kda: 0, games: 0 },
      offPool: { winrate: 0, kda: 0, games: 0, bleedPercent: 0 },
    };
  }
  if (!Array.isArray(pool)) {
    pool = [];
  }

  // Normalizar pool a minúsculas para comparación case-insensitive
  const poolLower = pool.map(c => c.toLowerCase());

  const onPoolGames  = matches.filter(m => poolLower.includes((m.championName || '').toLowerCase()));
  const offPoolGames = matches.filter(m => !poolLower.includes((m.championName || '').toLowerCase()));

  const onPoolWR  = _winrate(onPoolGames);
  const offPoolWR = _winrate(offPoolGames);

  const bleedPercent = offPoolGames.length > 0
    ? Math.max(0, onPoolWR - offPoolWR)
    : 0;

  return {
    onPool: {
      winrate: onPoolWR,
      kda:     _avgKDA(onPoolGames),
      games:   onPoolGames.length,
    },
    offPool: {
      winrate:      offPoolWR,
      kda:          _avgKDA(offPoolGames),
      games:        offPoolGames.length,
      bleedPercent,
    },
  };
}

/**
 * Agrupa las partidas off-pool por campeón y devuelve un array
 * con stats resumidas por cada campeón jugado fuera del pool.
 * Útil para la tab OFF-CHAMPION-POOL de HubScreen.
 *
 * @param {Match[]} matches
 * @param {string[]} pool
 * @returns {Array<{ championName, championId, games, winrate, kda }>}
 */
export function offPoolByChampion(matches, pool) {
  if (!Array.isArray(matches)) return [];
  const poolLower = (pool || []).map(c => c.toLowerCase());

  const offPoolGames = matches.filter(
    m => !poolLower.includes((m.championName || '').toLowerCase())
  );

  // Agrupar por championName
  const byChamp = {};
  for (const game of offPoolGames) {
    const key = game.championName;
    if (!byChamp[key]) {
      byChamp[key] = {
        championName: game.championName,
        championId:   game.championId,
        games:        [],
      };
    }
    byChamp[key].games.push(game);
  }

  return Object.values(byChamp).map(({ championName, championId, games }) => ({
    championName,
    championId,
    games:   games.length,
    winrate: _winrate(games),
    kda:     _avgKDA(games),
  }));
}
