// ============================================================================
// trophies.js — motor de cálculo del estado de los trofeos NOVA RIFT
// ----------------------------------------------------------------------------
// Helper puro (sin React, sin storage). Recibe la definición del trofeo y
// las partidas del usuario, devuelve el estado y el progreso.
//
// Compatibilidad de campos (mock + futuro backend):
// CS/min → m.cspm | m.csPerMin
// duración → m.durationMin | m.durationMinutes
// resultado → m.result === 'W' | 'WIN'
// K/D/A → m.kills, m.deaths, m.assists
// vision → m.visionScore
// Cuando llegue el backend con shape canónico, basta con leer la primera
// rama de cada `||` — el resto queda como red de seguridad.
// ============================================================================

const KDA_WR_TARGET_WR = 0.55;

/**
 * Calcula la métrica relevante para un conjunto de partidas.
 * Para `kdaWr` devuelve `{ kda, wr }`; para el resto un número.
 */
function computeMetric(key, matches) {
  if (!matches || matches.length === 0) return key === 'kdaWr' ? { kda: 0, wr: 0 } : 0;

  switch (key) {
    case 'csPerMin':
      return matches.reduce((sum, m) => sum + (m.cspm ?? m.csPerMin ?? 0), 0) / matches.length;

    case 'vsPerMin':
      return matches.reduce((sum, m) => {
        const dur = m.durationMin ?? m.durationMinutes ?? 1;
        const vs  = m.visionScore ?? 0;
        return sum + (dur > 0 ? vs / dur : 0);
      }, 0) / matches.length;

    case 'kda': {
      const sum = matches.reduce((s, m) => {
        const k = m.kills   ?? 0;
        const d = m.deaths  ?? 0;
        const a = m.assists ?? 0;
        return s + (d === 0 ? (k + a) : (k + a) / d);
      }, 0);
      return sum / matches.length;
    }

    case 'kdaWr': {
      const wins = matches.filter(m => m.result === 'W' || m.result === 'WIN').length;
      return {
        kda: computeMetric('kda', matches),
        wr:  wins / matches.length,
      };
    }

    // ─── Métricas nuevas (badges de progreso simple sobre el array) ──────────
    // matchesAnalyzed / totalMatches / mainChampionGames / visionStreak /
    // farmStreakDays son todos "cuenta de partidas que cumplen X". Mientras
    // el backend no exponga métricas dedicadas, las derivamos en cliente.
    case 'matchesAnalyzed':
    case 'totalMatches':
      return matches.length;

    case 'mainChampionGames': {
      const counts = {};
      for (const m of matches) {
        const id = m.championName ?? m.championId ?? m.champion ?? null;
        if (!id) continue;
        counts[id] = (counts[id] || 0) + 1;
      }
      return Object.values(counts).reduce((max, n) => (n > max ? n : max), 0);
    }

    case 'visionStreak': {
      // 5 partidas seguidas con VS/min >= 1.5 (target conservador en cliente).
      let streak = 0;
      for (const m of matches) {
        const dur = m.durationMin ?? m.durationMinutes ?? 1;
        const vs  = m.visionScore ?? 0;
        const vspm = dur > 0 ? vs / dur : 0;
        if (vspm >= 1.5) streak++; else break;
      }
      return streak;
    }

    case 'farmStreakDays': {
      // Cuenta partidas recientes con CS/min >= 7 hasta el primer fallo;
      // funciona como proxy hasta que llegue agregado por día del backend.
      let streak = 0;
      for (const m of matches) {
        const cspm = m.cspm ?? m.csPerMin ?? 0;
        if (cspm >= 7.0) streak++; else break;
      }
      return streak;
    }

    default:
      return 0;
  }
}

/**
 * Estado de un trofeo concreto.
 * @returns {{ state: 'earned'|'progress'|'locked', progress: number, label: string, value: any }}
 */
export function computeTrophyState(trophy, matches) {
  const N      = trophy.window || 5;
  const recent = (matches || []).slice(0, N);

  // LOCKED — aún no hay suficientes partidas evaluables.
  if (recent.length < N) {
    return {
      state:    'locked',
      progress: N > 0 ? recent.length / N : 0,
      label:    `Faltan ${N - recent.length} partidas`,
      value:    null,
    };
  }

  // Trofeo compuesto KDA + WR (Ingenio de Plata).
  if (trophy.key === 'kdaWr') {
    const { kda, wr } = computeMetric('kdaWr', recent);
    const kdaTarget   = trophy.target;
    const wrTarget    = KDA_WR_TARGET_WR;
    const earned      = kda >= kdaTarget && wr >= wrTarget;
    const progress    = Math.min(1, Math.min(kda / kdaTarget, wr / wrTarget));
    const label       = earned
      ? 'CONSEGUIDO'
      : `KDA ${kda.toFixed(1)} / ${kdaTarget.toFixed(1)} · WR ${Math.round(wr * 100)}% / ${Math.round(wrTarget * 100)}%`;
    return {
      state:    earned ? 'earned' : 'progress',
      progress,
      label,
      value:    { kda, wr },
    };
  }

  // Trofeo estándar (single-metric vs target).
  const value  = computeMetric(trophy.key, recent);
  const earned = value >= trophy.target;

  return {
    state:    earned ? 'earned' : 'progress',
    progress: trophy.target > 0 ? Math.min(1, value / trophy.target) : 0,
    label:    earned
      ? 'CONSEGUIDO'
      : `${value.toFixed(1)} / ${trophy.target.toFixed(1)}`,
    value,
  };
}

/**
 * Aplica `computeTrophyState` a un array de trofeos.
 * @returns {Array<{ trophy, state, progress, label, value }>}
 */
export function computeAllTrophies(trophies, matches) {
  return (trophies || []).map(trophy => ({
    trophy,
    ...computeTrophyState(trophy, matches),
  }));
}
