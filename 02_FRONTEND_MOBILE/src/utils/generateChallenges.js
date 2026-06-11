// ============================================================================
// generateChallenges — sistema de retos enriquecido para ELO Forge
// ----------------------------------------------------------------------------
// Genera hasta 3 retos accionables a partir del estado del usuario:
// rank actual y stats medias.
// main champion (para personalizar "Maestro de {X}").
// flag isOTP (retos de un único campeón).
//
// Cada reto declara su `reward` — el nombre del emblema/título que se
// desbloquea al completarlo. Esto sustituye al generador anterior que
// devolvía retos genéricos sin recompensa explícita.
//
// API:
// generateChallenges({ rank, stats, mainChampion, isOTP }) → Array<Challenge>
//
// Cada Challenge tiene:
// { icon, title, description, progress, tip, reward, key }
// ============================================================================

const RANK_TARGETS = {
  Hierro:    { csMin: 4.0, visionScore: 10, killParticipation: 45, kda: 1.5, wr: 0.50 },
  Bronce:    { csMin: 5.0, visionScore: 15, killParticipation: 50, kda: 2.0, wr: 0.52 },
  Plata:     { csMin: 6.0, visionScore: 20, killParticipation: 55, kda: 2.5, wr: 0.53 },
  Oro:       { csMin: 7.0, visionScore: 25, killParticipation: 60, kda: 3.0, wr: 0.55 },
  Platino:   { csMin: 7.5, visionScore: 30, killParticipation: 65, kda: 3.5, wr: 0.56 },
  Esmeralda: { csMin: 8.0, visionScore: 35, killParticipation: 70, kda: 4.0, wr: 0.58 },
  Diamante:  { csMin: 9.0, visionScore: 40, killParticipation: 75, kda: 5.0, wr: 0.60 },
};

function clamp01(v) {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(1, v));
}

/**
 * Reto "Maestro de {Champ}" — sólo aparece si hay main champion conocido.
 * Para OTP el target es más alto (35 partidas, 65% WR); para non-OTP, 30/55%.
 */
function masteryOfChampion({ mainChampion, isOTP, stats }) {
  if (!mainChampion) return null;
  const target = isOTP ? 0.65 : 0.55;
  const games  = isOTP ? 35 : 30;
  const wr     = clamp01((stats?.winrate ?? 50) / 100);
  return {
    key:         'mastery_champion',
    icon:        'crown',
    title:       `Maestro de ${mainChampion}`,
    description: `${Math.round(target * 100)}% winrate en ${games} partidas con ${mainChampion}.`,
    progress:    clamp01(wr / target),
    tip:         isOTP
      ? 'Cíñete a un solo campeón. Cada matchup es una lección.'
      : `Especialízate en ${mainChampion}; mantén un secundario para cuando esté banneado.`,
    reward:      `Emblema "Maestro de ${mainChampion}"`,
  };
}

/** Reto de farm — 10 partidas con CS/min superior al objetivo de la división. */
function farmStreak({ rank, stats }) {
  const target = (RANK_TARGETS[rank] || RANK_TARGETS.Oro).csMin;
  const cs     = stats?.csMin ?? 0;
  return {
    key:         'farm_streak',
    icon:        'coin',
    title:       'Farmero de Élite',
    description: `10 partidas con CS/min ≥ ${target.toFixed(1)}.`,
    progress:    clamp01(cs / target),
    tip:         'Practica last-hits 15 min/día en modo entrenamiento.',
    reward:      'Emblema "Farmero de Élite"',
  };
}

/** Reto de racha — 5 victorias seguidas. */
function winStreak({ stats }) {
  const streak = Number(stats?.winStreak) || 0;
  return {
    key:         'win_streak',
    icon:        'kda',
    title:       'Racha Imparable',
    description: '5 victorias consecutivas.',
    progress:    clamp01(streak / 5),
    tip:         'Tras 2 wins, baja la dificultad: pick lo más cómodo.',
    reward:      'Emblema "Racha Imparable"',
  };
}

/** Reto de progresión KDA — KDA medio sube X durante 20 partidas. */
function kdaProgression({ rank, stats }) {
  const targetKda = (RANK_TARGETS[rank] || RANK_TARGETS.Oro).kda;
  const kda       = stats?.kda ?? 0;
  return {
    key:         'kda_progression',
    icon:        'spark',
    title:       'Progresión Probada',
    description: `KDA medio ≥ ${targetKda.toFixed(1)} en 20 partidas.`,
    progress:    clamp01(kda / targetKda),
    tip:         'Una muerte cuesta más que una kill. Reduce muertes evitables.',
    reward:      'Título "Progresión Probada"',
  };
}

/** Reto de visión — vision score sostenido en 10 partidas. */
function visionDiscipline({ rank, stats }) {
  const target = (RANK_TARGETS[rank] || RANK_TARGETS.Oro).visionScore;
  const vs     = stats?.visionScore ?? 0;
  return {
    key:         'vision_discipline',
    icon:        'eye',
    title:       'Control de Mapa',
    description: `Vision Score ≥ ${target} en 10 partidas.`,
    progress:    clamp01(vs / target),
    tip:         'Ward en río al 1:30 cada partida. No la guardes.',
    reward:      'Emblema "Ojos del Vacío"',
  };
}

/** Reto de KP — 60%+ Kill Participation en partidas tempranas. */
function killParticipation({ rank, stats }) {
  const target = (RANK_TARGETS[rank] || RANK_TARGETS.Oro).killParticipation;
  const kp     = stats?.killParticipation ?? 0;
  return {
    key:         'kill_participation',
    icon:        'swords',
    title:       'Kill Participation',
    description: `KP ≥ ${target}% en 5 partidas.`,
    progress:    clamp01(kp / target),
    tip:         'Rota cuando empujes; no farmees sólo.',
    reward:      'Título "Engager"',
  };
}

/**
 * Genera 3 retos priorizados por la mayor brecha respecto al objetivo.
 * Pool de templates: mastery_champion · farm_streak · kda_progression
 * vision_discipline · kill_participation · win_streak.
 *
 * @param {Object} ctx
 * @param {string} ctx.rank — 'Oro', 'Platino', etc.
 * @param {Object} ctx.stats — { csMin, visionScore, killParticipation, kda, winrate, winStreak }
 * @param {string} [ctx.mainChampion]
 * @param {boolean}[ctx.isOTP]
 * @returns {Challenge[]} hasta 3 retos ordenados por menor `progress`
 */
export function generateChallenges(ctx = {}) {
  const candidates = [
    masteryOfChampion(ctx),
    farmStreak(ctx),
    kdaProgression(ctx),
    visionDiscipline(ctx),
    killParticipation(ctx),
    winStreak(ctx),
  ].filter(Boolean);

  // Ordena por `progress` ASC — los retos con menor avance son los más
  // accionables (mayor margen de mejora).
  candidates.sort((a, b) => a.progress - b.progress);

  return candidates.slice(0, 3);
}
