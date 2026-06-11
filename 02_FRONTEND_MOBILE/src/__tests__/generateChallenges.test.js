// ============================================================================
// generateChallenges.test.js — tests del motor de retos
// ============================================================================
const { generateChallenges } = loadEsm('src/utils/generateChallenges.js');

describe('generateChallenges — shape básico', () => {
  it('devuelve hasta 3 retos', () => {
    const out = generateChallenges({
      rank: 'Oro',
      stats: { csMin: 5, visionScore: 10, killParticipation: 40, kda: 2, winrate: 50, winStreak: 0 },
      mainChampion: 'Lucian',
    });
    assertTrue(out.length <= 3);
    assertTrue(out.length > 0);
  });

  it('cada reto tiene shape { key, icon, title, description, progress, tip, reward }', () => {
    const out = generateChallenges({
      rank: 'Oro',
      stats: { csMin: 5, visionScore: 10, killParticipation: 40, kda: 2, winrate: 50 },
      mainChampion: 'Lucian',
    });
    for (const c of out) {
      assertTrue(typeof c.key === 'string');
      assertTrue(typeof c.icon === 'string');
      assertTrue(typeof c.title === 'string');
      assertTrue(typeof c.description === 'string');
      assertTrue(typeof c.progress === 'number');
      assertTrue(c.progress >= 0 && c.progress <= 1, `progress fuera [0..1]: ${c.progress}`);
      assertTrue(typeof c.tip === 'string');
      assertTrue(typeof c.reward === 'string' && c.reward.length > 0);
    }
  });

  it('ordena por progress ASC (menor avance primero)', () => {
    const out = generateChallenges({
      rank: 'Oro',
      stats: { csMin: 6.5, visionScore: 10, killParticipation: 40, kda: 1.5, winrate: 60 },
      mainChampion: 'Lucian',
    });
    for (let i = 1; i < out.length; i++) {
      assertTrue(out[i - 1].progress <= out[i].progress,
        `Retos no ordenados: ${out[i - 1].progress} > ${out[i].progress}`);
    }
  });
});

describe('generateChallenges — personalización OTP', () => {
  // Para que el reto Maestro entre en el top 3 (los 3 con menor progress),
  // sus stats deben hacerlo "más urgente" que los demás. Ponemos otros
  // ejes ya cumplidos (>=target) y winrate bajo para que mastery brille.
  const URGENT_MASTERY_STATS = {
    csMin: 10, kda: 10, winrate: 10,
    visionScore: 100, killParticipation: 100, winStreak: 5,
  };

  it('OTP eleva el target del reto Maestro a 65% WR/35 partidas', () => {
    const otp = generateChallenges({
      rank: 'Oro',
      stats: URGENT_MASTERY_STATS,
      mainChampion: 'Yasuo',
      isOTP: true,
    });
    const mastery = otp.find(c => c.key === 'mastery_champion');
    assertTrue(mastery !== undefined, 'mastery_champion debería estar en el top 3');
    assertTrue(mastery.description.includes('65%'),
      `Description debería incluir 65%, fue: "${mastery.description}"`);
    assertTrue(mastery.description.includes('35'),
      `Description debería incluir 35, fue: "${mastery.description}"`);
  });

  it('non-OTP usa target 55% WR/30 partidas', () => {
    const reg = generateChallenges({
      rank: 'Oro',
      stats: URGENT_MASTERY_STATS,
      mainChampion: 'Lucian',
      isOTP: false,
    });
    const mastery = reg.find(c => c.key === 'mastery_champion');
    assertTrue(mastery !== undefined, 'mastery_champion debería estar en el top 3');
    assertTrue(mastery.description.includes('55%'),
      `Description debería incluir 55%, fue: "${mastery.description}"`);
    assertTrue(mastery.description.includes('30'),
      `Description debería incluir 30, fue: "${mastery.description}"`);
  });

  it('sin mainChampion el reto Maestro NO aparece', () => {
    const out = generateChallenges({
      rank: 'Oro',
      stats: { csMin: 5, kda: 2, winrate: 50, visionScore: 10, killParticipation: 40 },
      isOTP: false,
    });
    const mastery = out.find(c => c.key === 'mastery_champion');
    assertEqual(mastery, undefined);
  });
});

describe('generateChallenges — rank scaling', () => {
  it('Diamante exige más CS/min que Oro', () => {
    const oroOut = generateChallenges({
      rank: 'Oro', stats: { csMin: 7, kda: 3, winrate: 55, visionScore: 25, killParticipation: 60 },
    });
    const diaOut = generateChallenges({
      rank: 'Diamante', stats: { csMin: 7, kda: 3, winrate: 55, visionScore: 25, killParticipation: 60 },
    });
    const oroFarm = oroOut.find(c => c.key === 'farm_streak');
    const diaFarm = diaOut.find(c => c.key === 'farm_streak');
    // Si ambos retos farm están en el top 3, el target Diamante debería ser mayor.
    if (oroFarm && diaFarm) {
      const oroTarget = parseFloat(oroFarm.description.match(/[\d.]+/)?.[0] || '0');
      const diaTarget = parseFloat(diaFarm.description.match(/[\d.]+/)?.[0] || '0');
      assertTrue(diaTarget >= oroTarget,
        `Diamante target ${diaTarget} debería ser >= Oro ${oroTarget}`);
    }
  });

  it('rank desconocido cae al fallback Oro (no rompe)', () => {
    const out = generateChallenges({
      rank: 'FAKE_RANK',
      stats: { csMin: 5, kda: 2, winrate: 50, visionScore: 10, killParticipation: 40 },
    });
    assertTrue(out.length > 0);
  });
});

describe('generateChallenges — recompensas únicas', () => {
  it('todas las recompensas devueltas son strings no vacíos', () => {
    const out = generateChallenges({
      rank: 'Oro',
      stats: { csMin: 5, kda: 2, winrate: 50, visionScore: 10, killParticipation: 40, winStreak: 2 },
      mainChampion: 'Lucian',
    });
    for (const c of out) {
      assertTrue(c.reward.length > 0);
    }
  });

  it('Maestro de Lucian devuelve reward que incluye "Lucian"', () => {
    const out = generateChallenges({
      rank: 'Oro',
      stats: { csMin: 0.1, kda: 0.1, winrate: 30, visionScore: 0, killParticipation: 0 },
      mainChampion: 'Lucian',
    });
    const mastery = out.find(c => c.key === 'mastery_champion');
    if (mastery) {
      assertTrue(mastery.reward.includes('Lucian'));
    }
  });
});
