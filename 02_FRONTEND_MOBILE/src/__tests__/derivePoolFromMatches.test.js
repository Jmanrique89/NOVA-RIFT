// ============================================================================
// derivePoolFromMatches.test.js — pool efectivo desde partidas reales (H36-T1)
// ----------------------------------------------------------------------------
// Cubre el motor que deriva el champion pool de una cuenta sin onboarding a
// partir de sus partidas reales: orden por nº de partidas, asignación main/sec,
// stats agregadas reales y tolerancia a ambos shapes (backend crudo / front).
// ============================================================================
const { derivePoolFromMatches } = loadEsm('src/utils/derivePoolFromMatches.js');

// Partidas crudas estilo backend Riot (result 'WIN'/'LOSS', totalMinionsKilled,
// durationMin). Aatrox 4P (3W) · Garen 3P (1W) · Sett 2P (1W) · Yasuo 1P (0W).
const RAW = [
  { championName: 'Aatrox', result: 'WIN',  kills: 8, deaths: 2, assists: 4, totalMinionsKilled: 220, durationMin: 30, visionScore: 20 },
  { championName: 'Aatrox', result: 'WIN',  kills: 6, deaths: 3, assists: 5, totalMinionsKilled: 210, durationMin: 30, visionScore: 18 },
  { championName: 'Aatrox', result: 'LOSS', kills: 3, deaths: 6, assists: 2, totalMinionsKilled: 180, durationMin: 30, visionScore: 14 },
  { championName: 'Aatrox', result: 'WIN',  kills: 9, deaths: 1, assists: 6, totalMinionsKilled: 240, durationMin: 30, visionScore: 22 },
  { championName: 'Garen',  result: 'WIN',  kills: 5, deaths: 4, assists: 3, totalMinionsKilled: 190, durationMin: 30, visionScore: 12 },
  { championName: 'Garen',  result: 'LOSS', kills: 2, deaths: 7, assists: 2, totalMinionsKilled: 160, durationMin: 30, visionScore: 10 },
  { championName: 'Garen',  result: 'LOSS', kills: 4, deaths: 5, assists: 4, totalMinionsKilled: 170, durationMin: 30, visionScore: 11 },
  { championName: 'Sett',   result: 'WIN',  kills: 7, deaths: 3, assists: 5, totalMinionsKilled: 200, durationMin: 30, visionScore: 15 },
  { championName: 'Sett',   result: 'LOSS', kills: 3, deaths: 6, assists: 3, totalMinionsKilled: 175, durationMin: 30, visionScore: 13 },
  { championName: 'Yasuo',  result: 'LOSS', kills: 2, deaths: 8, assists: 1, totalMinionsKilled: 150, durationMin: 30, visionScore: 9 },
];

describe('derivePoolFromMatches', () => {
  it('null si no hay partidas', () => {
    assertEqual(derivePoolFromMatches([]), null);
    assertEqual(derivePoolFromMatches(undefined), null);
  });

  it('ordena por nº de partidas y asigna 2 MAIN + 2 SEC', () => {
    const { pool, poolDetail } = derivePoolFromMatches(RAW);
    assertDeep(pool, ['Aatrox', 'Garen', 'Sett', 'Yasuo']);
    assertEqual(poolDetail[0].slot, 'main');
    assertEqual(poolDetail[1].slot, 'main');
    assertEqual(poolDetail[2].slot, 'sec');
    assertEqual(poolDetail[3].slot, 'sec');
  });

  it('calcula winrate REAL por campeón (no 100% fantasma)', () => {
    const { poolDetail } = derivePoolFromMatches(RAW);
    const aatrox = poolDetail.find(c => c.championName === 'Aatrox');
    const garen  = poolDetail.find(c => c.championName === 'Garen');
    assertEqual(aatrox.winrate, 75); // 3 de 4
    assertEqual(garen.winrate, 33);  // 1 de 3 → 33%
    assertEqual(aatrox.games, 4);
  });

  it('poolDetail trae mastery como objeto con level y progressPct (lo exige la card)', () => {
    const { poolDetail } = derivePoolFromMatches(RAW);
    for (const c of poolDetail) {
      assertEqual(typeof c.mastery, 'object');
      assertTrue(Number.isFinite(c.mastery.level), `level de ${c.championName}`);
      assertTrue(Number.isFinite(c.mastery.progressPct), `progressPct de ${c.championName}`);
      assertTrue(Number.isFinite(c.avgKDA) && Number.isFinite(c.avgCSPM), `medias de ${c.championName}`);
    }
  });

  it('topChampions trae mastery numérico y championPool el alias simplificado', () => {
    const { topChampions, championPool } = derivePoolFromMatches(RAW);
    assertEqual(typeof topChampions[0].mastery, 'number');
    assertEqual(championPool.length, 4);
    assertEqual(championPool[0].championName, 'Aatrox');
  });

  it('respeta el cap de slots (maxSlots) y tolera el shape ya normalizado (W/L, cspm)', () => {
    const normalized = [
      { championName: 'Ahri', result: 'W', kills: 5, deaths: 2, assists: 7, cspm: 7.2, visionScore: 16 },
      { championName: 'Ahri', result: 'L', kills: 3, deaths: 5, assists: 4, cspm: 6.1, visionScore: 12 },
      { championName: 'Zed',  result: 'W', kills: 8, deaths: 3, assists: 2, cspm: 7.8, visionScore: 10 },
    ];
    const { pool } = derivePoolFromMatches(normalized, { maxSlots: 2 });
    assertDeep(pool, ['Ahri', 'Zed']);
  });
});
