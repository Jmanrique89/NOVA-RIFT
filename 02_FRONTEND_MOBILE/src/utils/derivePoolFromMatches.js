// ============================================================================
// derivePoolFromMatches.js — Pool efectivo a partir de partidas REALES
// ----------------------------------------------------------------------------
// Cuando un jugador entra con su cuenta de Riot por login directo (sin pasar por
// el onboarding), no tiene un champion pool elegido. Hasta ahora el Hub heredaba
// el pool del mock NovaRift (Lucian/Ezreal/Jinx/Caitlyn) con winrates fantasma
// (100% WR), aunque el jugador nunca hubiera tocado esos campeones.
//
// Esta función deriva el pool EFECTIVO de las partidas reales del jugador:
// agrupa por campeón, ordena por número de partidas y toma los más jugados como
// 2 MAIN + 2 SECUNDARIOS, con sus estadísticas (WR/KDA/CS/visión) AGREGADAS de
// esas mismas partidas. Así el tab CHAMPION POOL, el main recomendado y el
// asistente reflejan a quién juega de verdad el usuario.
//
// Función PURA (sin React, sin red): tolera el shape crudo del backend
// (`result: 'WIN'|'LOSS'`, `totalMinionsKilled`, `durationMin|durationMinutes`)
// y el ya normalizado del front (`result: 'W'|'L'`, `cs`, `cspm`). Devuelve el
// mismo shape que el mock (poolDetail/topChampions/championPool) para que las
// vistas que ya lo consumen no necesiten cambios.
// ============================================================================

/** @param {*} r Resultado crudo de la partida. @returns {boolean} */
function isWin(r) {
  return r === 'W' || r === 'WIN' || r === true;
}

/** Convierte a número finito o devuelve el fallback. */
function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/** Redondea a 1 decimal (los valores que muestran las cards del pool). */
function round1(v) {
  return Math.round(v * 10) / 10;
}

/**
 * @typedef {Object} DerivedPool
 * @property {string[]} pool Nombres de campeón, del más jugado al menos.
 * @property {Array<object>} poolDetail Shape de NOVA_POOL_DETAIL (con mastery objeto).
 * @property {Array<object>} topChampions Shape de NOVA_TOP_CHAMPIONS (mastery numérico).
 * @property {Array<object>} championPool Alias simplificado.
 */

/**
 * Deriva el champion pool efectivo de una lista de partidas reales.
 *
 * @param {Array<object>} recentMatches Partidas (crudas del backend o normalizadas).
 * @param {{ maxSlots?: number, mainSlots?: number }} [opts]
 * @returns {DerivedPool|null} null si no hay ninguna partida con campeón.
 */
export function derivePoolFromMatches(recentMatches, opts = {}) {
  const { maxSlots = 4, mainSlots = 2 } = opts;
  const list = Array.isArray(recentMatches) ? recentMatches : [];

  // Agregación por campeón: partidas, victorias y sumas para promediar.
  const byChamp = new Map();
  for (const m of list) {
    const name = m && m.championName;
    if (!name) continue;
    const dur = Math.max(1, num(m.durationMin ?? m.durationMinutes, 1));
    const cs  = num(m.totalMinionsKilled ?? m.cs, 0);
    const k   = num(m.kills);
    const d   = num(m.deaths);
    const a   = num(m.assists);

    const entry = byChamp.get(name) || {
      championName: name,
      championId:   m.championId ?? null,
      games: 0, wins: 0, sumKda: 0, sumCspm: 0, sumVision: 0,
    };
    entry.games += 1;
    if (isWin(m.result ?? m.win)) entry.wins += 1;
    // Si el front ya trae kda/cspm calculados los respeta; si no, los deriva.
    entry.sumKda    += Number.isFinite(m.kda)  ? m.kda  : (k + a) / Math.max(1, d);
    entry.sumCspm   += Number.isFinite(m.cspm) ? m.cspm : cs / dur;
    entry.sumVision += num(m.visionScore, 0);
    if (entry.championId == null && m.championId != null) entry.championId = m.championId;
    byChamp.set(name, entry);
  }

  const ranked = Array.from(byChamp.values()).sort((x, y) => (
    // Más partidas primero; a igualdad, mayor winrate.
    y.games - x.games || (y.wins / y.games) - (x.wins / x.games)
  ));
  if (ranked.length === 0) return null;

  const top = ranked.slice(0, maxSlots);
  const maxGames = top[0].games || 1;

  const poolDetail = top.map((c, i) => {
    const winrate = Math.round((c.wins / c.games) * 100);
    // Maestría = proxy de COMODIDAD a partir del volumen de partidas en la
    // muestra (el summary de Riot no expone puntos de maestría). Es honesto:
    // refleja a quién juega más, no un dato inventado.
    const level = Math.max(4, Math.min(7, 3 + Math.round((c.games / maxGames) * 4)));
    const progressPct = Math.max(8, Math.min(100, Math.round((c.games / maxGames) * 100)));
    return {
      championId:   c.championId ?? c.championName,
      championName: c.championName,
      slot:         i < mainSlots ? 'main' : 'sec',
      winrate,
      games:        c.games,
      avgKDA:       round1(c.sumKda / c.games),
      avgCSPM:      round1(c.sumCspm / c.games),
      avgVision:    round1(c.sumVision / c.games),
      mastery:      { level, progressPct },
    };
  });

  const pool = poolDetail.map((c) => c.championName);

  const topChampions = poolDetail.map((c) => ({
    championId:   c.championId,
    championName: c.championName,
    winrate:      c.winrate,
    games:        c.games,
    avgKDA:       c.avgKDA,
    avgCSPM:      c.avgCSPM,
    mastery:      c.mastery.level,
    slot:         c.slot,
  }));

  const championPool = poolDetail.map((c) => ({
    championId:   c.championId,
    championName: c.championName,
    winrate:      c.winrate,
    games:        c.games,
    avgKDA:       c.avgKDA,
    mastery:      c.mastery.level,
  }));

  return { pool, poolDetail, topChampions, championPool };
}
