// ============================================================================
// computeRadarStats.test.js — tests del agregador del FactionRadarChart
// ----------------------------------------------------------------------------
// 5 ejes (H36-T9): [Winrate, CS/min, Oro, Daño, Visión], cada uno 0..100.
// ============================================================================
const { computeRadarStats } = loadEsm('src/utils/computeRadarStats.js');

describe('computeRadarStats — defaults y normalización (5 ejes)', () => {
  it('matches vacío devuelve pentágono neutral [50,50,50,50,50]', () => {
    assertDeep(computeRadarStats([]), [50, 50, 50, 50, 50]);
    assertDeep(computeRadarStats(null), [50, 50, 50, 50, 50]);
    assertDeep(computeRadarStats(undefined), [50, 50, 50, 50, 50]);
  });

  it('devuelve 5 ejes, todos en [0..100]', () => {
    const r = computeRadarStats([
      { result: 'W', cspm: 7, gold: 13000, damageToChamps: 25000, visionScore: 20 },
    ]);
    assertEqual(r.length, 5);
    for (const v of r) assertTrue(v >= 0 && v <= 100, `valor fuera [0..100]: ${v}`);
  });

  it('valores extremos cap a 100 (no se sobrepasa)', () => {
    const r = computeRadarStats([{ result: 'W', cspm: 99, gold: 999999, damageToChamps: 999999, visionScore: 999 }]);
    for (const v of r) assertTrue(v <= 100, `cap a 100 falló: ${v}`);
  });
});

describe('computeRadarStats — semantics por eje', () => {
  it('Winrate: 100 si todas victorias, 0 si todas derrotas, 50 mixto', () => {
    assertEqual(computeRadarStats([{ result: 'W' }, { result: 'WIN' }])[0], 100);
    assertEqual(computeRadarStats([{ result: 'L' }, { result: 'LOSS' }])[0], 0);
    assertEqual(computeRadarStats([{ result: 'W' }, { result: 'L' }])[0], 50);
  });

  it('CS/min alto → eje de farmeo alto (ceiling 9.0)', () => {
    const [, csmin] = computeRadarStats([{ result: 'W', cspm: 9 }]);
    assertTrue(csmin >= 99, `CS/min=9 debería ser ~100: ${csmin}`);
  });

  it('soporta cspm y csPerMin indistintamente (compatibilidad)', () => {
    const a = computeRadarStats([{ result: 'W', cspm: 7 }]);
    const b = computeRadarStats([{ result: 'W', csPerMin: 7 }]);
    assertEqual(a[1], b[1]);
  });

  it('Oro: usa m.gold si está; si falta, lo estima (>0, no colapsa)', () => {
    assertEqual(computeRadarStats([{ result: 'W', gold: 16000 }])[2], 100);
    const estimated = computeRadarStats([{ result: 'W', cs: 200, kills: 5, assists: 5, durationMin: 30 }]);
    assertTrue(estimated[2] > 0, `oro estimado debería ser > 0: ${estimated[2]}`);
  });

  it('Daño: normaliza damageToChamps y totalDamageDealtToChampions (ceiling 35k)', () => {
    assertEqual(computeRadarStats([{ result: 'W', damageToChamps: 35000 }])[3], 100);
    assertEqual(computeRadarStats([{ result: 'W', totalDamageDealtToChampions: 35000 }])[3], 100);
  });

  it('Visión: visionScore normalizado (ceiling 40)', () => {
    assertEqual(computeRadarStats([{ result: 'W', visionScore: 40 }])[4], 100);
    assertEqual(computeRadarStats([{ result: 'W', visionScore: 20 }])[4], 50);
  });
});
