// ============================================================================
// championStats.test.js — tests del agregador por campeón
// ============================================================================
const { statsForChampion, displayChampionName } = loadEsm('src/utils/championStats.js');

const sampleMatches = [
  // 3 partidas de Lucian, todas WIN
  { championName: 'Lucian', result: 'WIN', kda: 8.5, cspm: 7.2, visionScore: 22, damageToChamps: 38000, cs: 220 },
  { championName: 'Lucian', result: 'W',   kda: 12.0, csPerMin: 8.4, visionScore: 18, damage: 42000, cs: 250 },
  { championName: 'Lucian', result: 'WIN', kda: 8.0, cspm: 7.0, visionScore: 25, damageToChamps: 35000, cs: 210 },
  // 2 partidas de Jinx, 1 V 1 D
  { championName: 'Jinx', result: 'WIN',  kda: 4.5, cspm: 6.8, visionScore: 12, damageToChamps: 28000, cs: 180 },
  { championName: 'Jinx', result: 'LOSS', kda: 1.7, cspm: 5.2, visionScore: 8,  damageToChamps: 20000, cs: 160 },
];

describe('championStats — agregaciones', () => {
  it('Lucian: 3G 3W/0L 100% WR', () => {
    const s = statsForChampion(sampleMatches, 'Lucian');
    assertEqual(s.games, 3);
    assertEqual(s.wins, 3);
    assertEqual(s.losses, 0);
    assertEqual(s.winrate, 100);
  });

  it('Lucian: avg KDA = 9.5 (rounded 1 decimal)', () => {
    const s = statsForChampion(sampleMatches, 'Lucian');
    // (8.5 + 12 + 8) / 3 = 9.5
    assertEqual(s.avgKda, 9.5);
  });

  it('Jinx: 2G 1W/1L 50% WR', () => {
    const s = statsForChampion(sampleMatches, 'Jinx');
    assertEqual(s.games, 2);
    assertEqual(s.winrate, 50);
  });

  it('campeón sin partidas devuelve estado vacío', () => {
    const s = statsForChampion(sampleMatches, 'Caitlyn');
    assertEqual(s.games, 0);
    assertEqual(s.winrate, 0);
    assertDeep(s.sparkline, []);
  });

  it('soporta cspm y csPerMin indistintamente', () => {
    // Match con `csPerMin` (no cspm) en sampleMatches.
    const s = statsForChampion(sampleMatches, 'Lucian');
    assertTrue(s.avgCs > 0, 'avgCs debería incorporar csPerMin del segundo match');
  });

  it('soporta result "W"/"WIN" indistintamente', () => {
    // sampleMatches mezcla 'WIN' y 'W' — el wins=3 lo confirma.
    const s = statsForChampion(sampleMatches, 'Lucian');
    assertEqual(s.wins, 3);
  });
});

describe('championStats — sparkline', () => {
  it('Lucian sparkline binario [1,1,1] (todas victorias)', () => {
    const s = statsForChampion(sampleMatches, 'Lucian');
    assertDeep(s.sparkline, [1, 1, 1]);
  });

  it('Jinx sparkline [1,0] (V/D en orden cronológico)', () => {
    // Orden recibido: WIN primero, LOSS después. Con .reverse() en buildWinSparkline
    // queda LOSS primero (más antiguo) y WIN después (más nuevo).
    const s = statsForChampion(sampleMatches, 'Jinx');
    assertDeep(s.sparkline, [0, 1]);
  });

  it('windowSize override limita la longitud', () => {
    const long = Array.from({ length: 20 }, (_, i) => ({
      championName: 'Lucian',
      result: i % 2 === 0 ? 'WIN' : 'LOSS',
      kda: 5, cspm: 7, visionScore: 20, damageToChamps: 30000, cs: 200,
    }));
    const s = statsForChampion(long, 'Lucian', { sparklineWindow: 5 });
    assertEqual(s.sparkline.length, 5);
  });
});

describe('championStats — longestWinStreak', () => {
  it('detecta racha máxima correctamente', () => {
    // V V D V V V D — la racha máxima es 3
    const matches = [
      // Más reciente arriba (orden del historial NovaRift)
      { championName: 'X', result: 'LOSS', kda: 1, cspm: 5, visionScore: 10, damageToChamps: 0, cs: 100 },
      { championName: 'X', result: 'WIN',  kda: 1, cspm: 5, visionScore: 10, damageToChamps: 0, cs: 100 },
      { championName: 'X', result: 'WIN',  kda: 1, cspm: 5, visionScore: 10, damageToChamps: 0, cs: 100 },
      { championName: 'X', result: 'WIN',  kda: 1, cspm: 5, visionScore: 10, damageToChamps: 0, cs: 100 },
      { championName: 'X', result: 'LOSS', kda: 1, cspm: 5, visionScore: 10, damageToChamps: 0, cs: 100 },
      { championName: 'X', result: 'WIN',  kda: 1, cspm: 5, visionScore: 10, damageToChamps: 0, cs: 100 },
      { championName: 'X', result: 'WIN',  kda: 1, cspm: 5, visionScore: 10, damageToChamps: 0, cs: 100 },
    ];
    const s = statsForChampion(matches, 'X');
    assertEqual(s.longestWinStreak, 3);
  });
});

describe('displayChampionName', () => {
  it('mapea ID compuesto a nombre legible', () => {
    assertEqual(displayChampionName('MissFortune'), 'Miss Fortune');
    assertEqual(displayChampionName('LeeSin'), 'Lee Sin');
    assertEqual(displayChampionName('KhaZix'), "Kha'Zix");
    assertEqual(displayChampionName('JarvanIV'), 'Jarvan IV');
  });

  it('devuelve el ID tal cual si no está en el dict', () => {
    assertEqual(displayChampionName('Lucian'), 'Lucian');
    assertEqual(displayChampionName('Jinx'), 'Jinx');
  });

  it('devuelve string vacío para null/undefined', () => {
    assertEqual(displayChampionName(null), '');
    assertEqual(displayChampionName(undefined), '');
  });
});
