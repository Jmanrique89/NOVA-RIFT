// ============================================================================
// championHistory.js — historial de partidas de la cuenta de DEMO (datos mock)
// ----------------------------------------------------------------------------
// NO son partidas reales: es el historial simulado de la cuenta de demostración
// (datos fijos, pensados para que la demo siempre muestre lo mismo). A partir de
// este array, las funciones de abajo calculan:
// El main champion recomendado (score: winrate + volumen + KDA).
// El Top 3 de campeones para la pantalla de identidad.
// Las stats agregadas de temporada.
// El foco prioritario de mejora y 3 acciones concretas para subir.
//
// Cuando haya backend con historial real, estas mismas funciones operan sobre
// los datos reales sin cambiar su forma.
// ============================================================================

const HISTORY = [
  // Lucian — main (75% WR sobre 4 partidas, KDA bueno)
  { championName: 'Lucian',  championId: 236, role: 'ADC',     win: true,  k: 6, d: 2, a: 8,  csPerMin: 7.1, visionScore: 14 },
  { championName: 'Lucian',  championId: 236, role: 'ADC',     win: true,  k: 5, d: 3, a: 6,  csPerMin: 6.8, visionScore: 11 },
  { championName: 'Lucian',  championId: 236, role: 'ADC',     win: false, k: 3, d: 5, a: 4,  csPerMin: 5.9, visionScore:  9 },
  { championName: 'Lucian',  championId: 236, role: 'ADC',     win: true,  k: 7, d: 2, a: 9,  csPerMin: 7.3, visionScore: 16 },
  // Jinx — secundario (33% WR, peor KDA)
  { championName: 'Jinx',    championId: 222, role: 'ADC',     win: false, k: 4, d: 6, a: 3,  csPerMin: 5.2, visionScore:  8 },
  { championName: 'Jinx',    championId: 222, role: 'ADC',     win: false, k: 2, d: 7, a: 2,  csPerMin: 4.8, visionScore:  6 },
  { championName: 'Jinx',    championId: 222, role: 'ADC',     win: true,  k: 5, d: 4, a: 5,  csPerMin: 6.1, visionScore: 10 },
  // Ezreal — backup (50% WR, 3 partidas)
  { championName: 'Ezreal',  championId: 81,  role: 'ADC',     win: false, k: 3, d: 5, a: 3,  csPerMin: 5.5, visionScore:  9 },
  { championName: 'Ezreal',  championId: 81,  role: 'ADC',     win: true,  k: 4, d: 3, a: 7,  csPerMin: 6.2, visionScore: 12 },
  { championName: 'Ezreal',  championId: 81,  role: 'ADC',     win: false, k: 2, d: 6, a: 4,  csPerMin: 5.0, visionScore:  7 },
];

const computeKda = (k, d, a) => (d === 0 ? (k + a) : (k + a) / d);

/**
 * Genera un historial sintético (mismo shape que HISTORY) a partir del champion
 * pool REAL del usuario. Sirve para que "TU MAIN RECOMENDADO" y el roadmap de
 * ELO Forge reflejen los campeones que el usuario eligió en el registro, en vez
 * de los ADC fijos del mock demo (Lucian/Ezreal/Jinx). Determinista: el primer
 * campeón del pool recibe una partida ganada extra → queda como main.
 *
 * @param {string[]} poolNames nombres de campeón del pool del usuario
 * @returns {Array} historial sintético (cae a HISTORY si el pool viene vacío)
 */
export function historyForPool(poolNames) {
  const pool = (poolNames || []).filter(Boolean);
  if (pool.length === 0) return HISTORY;
  const TEMPLATES = [
    { win: true,  k: 7, d: 2, a: 8, csPerMin: 7.2, visionScore: 18 },
    { win: true,  k: 6, d: 3, a: 6, csPerMin: 6.8, visionScore: 15 },
    { win: false, k: 4, d: 5, a: 5, csPerMin: 6.1, visionScore: 12 },
  ];
  const out = [];
  pool.forEach((name, ci) => {
    const games = ci === 0 ? 4 : 3; // el primero (main) juega una partida más
    for (let g = 0; g < games; g++) {
      const t = TEMPLATES[g % TEMPLATES.length];
      out.push({
        championName: name,
        championId:   0,
        role:         'FLEX',
        win:          ci === 0 && g === 3 ? true : t.win,
        k: t.k, d: t.d, a: t.a,
        csPerMin: t.csPerMin, visionScore: t.visionScore,
      });
    }
  });
  return out;
}

/**
 * Devuelve stats agrupados por campeón.
 */
export function statsByChampion(history = HISTORY) {
  const map = {};
  for (const m of history) {
    if (!map[m.championName]) {
      map[m.championName] = {
        championName: m.championName,
        championId: m.championId,
        role: m.role,
        games: 0, wins: 0,
        sumKda: 0, sumCs: 0, sumVision: 0,
      };
    }
    const s = map[m.championName];
    s.games++;
    if (m.win) s.wins++;
    s.sumKda += computeKda(m.k, m.d, m.a);
    s.sumCs += m.csPerMin;
    s.sumVision += m.visionScore;
  }
  return Object.values(map).map(s => ({
    championName: s.championName,
    championId: s.championId,
    role: s.role,
    games: s.games,
    wins: s.wins,
    winRate: s.wins / s.games,
    avgKda: s.sumKda / s.games,
    avgCs: s.sumCs / s.games,
    avgVision: s.sumVision / s.games,
  }));
}

/**
 * Calcula el main champion por score compuesto:
 * 50% winrate + 30% volumen relativo + 20% KDA normalizado
 */
export function calculateMainChampion(history = HISTORY) {
  const stats = statsByChampion(history);
  const totalGames = stats.reduce((s, c) => s + c.games, 0);
  const scored = stats.map(c => ({
    ...c,
    score: (c.winRate * 0.50)
         + ((c.games / totalGames) * 0.30)
         + (Math.min(c.avgKda / 3.0, 1.0) * 0.20),
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored[0];
}

export function topChampions(n = 3, history = HISTORY) {
  return statsByChampion(history)
    .sort((a, b) => b.games - a.games || b.winRate - a.winRate)
    .slice(0, n);
}

export function seasonStats(history = HISTORY) {
  const stats = statsByChampion(history);
  const games = stats.reduce((s, c) => s + c.games, 0);
  const wins  = stats.reduce((s, c) => s + c.wins, 0);
  const avgKda = stats.reduce((s, c) => s + c.avgKda * c.games, 0) / games;
  const avgCs  = stats.reduce((s, c) => s + c.avgCs  * c.games, 0) / games;
  return {
    games, wins,
    losses: games - wins,
    winRate: wins / games,
    avgKda,
    avgCs,
  };
}

/**
 * Detecta el foco prioritario de mejora comparando stats actuales vs targets de un rango objetivo.
 * Devuelve { metric, currentValue, targetValue, gapPct }.
 */
export function calculatePriorityFocus(currentStats, targetBenchmark) {
  const gaps = [
    {
      metric: 'FARMEO',
      label: 'Farmeo en línea (CS/min)',
      currentValue: currentStats.csMin,
      targetValue: targetBenchmark.csMin,
      gapPct: targetBenchmark.csMin > 0 ? (targetBenchmark.csMin - currentStats.csMin) / targetBenchmark.csMin : 0,
    },
    {
      metric: 'SUPERVIVENCIA',
      label: 'Supervivencia (KDA)',
      currentValue: currentStats.kda,
      targetValue: targetBenchmark.kda,
      gapPct: targetBenchmark.kda > 0 ? (targetBenchmark.kda - currentStats.kda) / targetBenchmark.kda : 0,
    },
    {
      metric: 'VISIÓN',
      label: 'Control de mapa (Vision Score)',
      currentValue: currentStats.visionScore,
      targetValue: targetBenchmark.visionScore,
      gapPct: targetBenchmark.visionScore > 0 ? (targetBenchmark.visionScore - currentStats.visionScore) / targetBenchmark.visionScore : 0,
    },
    {
      metric: 'IMPACTO',
      label: 'Participación en peleas (KP)',
      currentValue: currentStats.killParticipation,
      targetValue: targetBenchmark.killParticipation,
      gapPct: targetBenchmark.killParticipation > 0 ? (targetBenchmark.killParticipation - currentStats.killParticipation) / targetBenchmark.killParticipation : 0,
    },
  ];
  // El que más brecha tiene = foco prioritario
  gaps.sort((a, b) => b.gapPct - a.gapPct);
  return gaps[0];
}

/**
 * Genera 3 acciones específicas en función del foco detectado.
 */
export function generateClimbActions(focus, mainChamp) {
  const champ = mainChamp?.championName || 'tu main';

  const actionsByMetric = {
    FARMEO: [
      {
        title: `Practica last-hit y lee el estado de la oleada`,
        body: `En práctica con ${champ}: 80 CS al min 10 y 100 al 15 SIN gastar habilidades en farmear. Aprende los estados de oleada — empuja antes de recall (slow push) y congela cuando te superan. No cambies CS por una kill insegura. Te lleva de ${focus.currentValue.toFixed(1)} a ~${focus.targetValue.toFixed(1)} CS/min en 2 semanas.`,
      },
      {
        title: 'Congela la oleada al minuto 3',
        body: 'Bloquea minions enemigos a 2 pasos de tu torre con 4 minions aliados. Mantén el cs sin perder torre.',
      },
      {
        title: 'Limita tu pool de campeones a 1+1',
        body: `Tu winrate con ${champ} es muy superior al de los demás. Banea counters y juega solo ${champ} hasta el siguiente rango.`,
      },
    ],
    SUPERVIVENCIA: [
      {
        title: `Reduce muertes evitables: vas a ${focus.currentValue.toFixed(1)} de KDA`,
        body: 'La mayoría de tus muertes ocurren con 0 visión y el resumen del enemigo arriba: antes de empujar, comprueba dónde están los 5 rivales. Respeta el power spike enemigo (sus 2 ítems) y recuerda que en late una muerte cuesta 50s+ — no busques peleas sin un objetivo a cambio.',
      },
      {
        title: 'Activa visión antes del minuto 5',
        body: 'Coloca ward de río al 1:30 y renueva en cada vuelta. Esto evita ganks y mejora tu KDA directamente.',
      },
      {
        title: `Especialízate en ${champ}`,
        body: `Tu KDA con ${champ} es notablemente mejor. Reduce variedad y consolida muscle memory en 1 sola pick.`,
      },
    ],
    VISIÓN: [
      {
        title: 'Control Ward + deep wards proactivas',
        body: `Tu vision score (${focus.currentValue.toFixed(0)}) está lejos del objetivo (${focus.targetValue}). Lleva SIEMPRE una Control Ward (75g) y colócala en el objetivo activo, no en tu base. Wardea proactivo en la jungla enemiga cuando tu equipo tiene prio: ver al jungla rival antes de un objetivo vale más que 20 wards defensivas.`,
      },
      {
        title: 'Limpia wards enemigas',
        body: 'Usa el trinket Sweeping Lens al rotar. Cada ward enemiga limpiada vale 30 oro y 1 vision score.',
      },
      {
        title: 'Stackea wards en objetivos clave',
        body: 'Setea visión 40 segundos antes de Drake/Heraldo/Baron. Es el momento donde más vision score se gana.',
      },
    ],
    IMPACTO: [
      {
        title: 'Convierte prioridad en presión de mapa',
        body: `Tu KP (${focus.currentValue.toFixed(0)}%) está bajo: el problema casi nunca es "no pelear", es elegir CUÁNDO. Cuando empujes con prio, no farmees parado — roamea a mid o ayuda a tu jungla en el objetivo. Llega 1-2s ANTES de que empiece la pelea, no cuando ya se decidió.`,
      },
      {
        title: 'Sincroniza con tu jungla',
        body: 'Pingea cada 60s en MIA. Ofrece gankear cuando el enemigo no tiene resumen disponible.',
      },
      {
        title: `Mejora con ${champ} antes de probar otros`,
        body: `Tu ratio de impacto con ${champ} es óptimo. No diluyas tu pool hasta consolidar el rango.`,
      },
    ],
  };

  return actionsByMetric[focus.metric] || actionsByMetric.FARMEO;
}
