// ============================================================================
// divisionBenchmarks.test.js — tests de los perfiles por división
// ----------------------------------------------------------------------------
// `PROFILES` es un constante interna (no exportada), se testea indirectamente
// vía `benchmarkForTier`. El return de `topGap` es:
// { axisIdx, axis, gap, label }
// 5 ejes (H36-T9): [Winrate, CS/min, Oro, Daño, Visión]. axisIdx es 0..4.
// ============================================================================
const { benchmarkForTier, topGap } = loadEsm('src/utils/divisionBenchmarks.js');

describe('benchmarkForTier', () => {
  it('devuelve un perfil de 5 ejes para cada tier conocido', () => {
    for (const tier of ['IRON','BRONZE','SILVER','GOLD','PLATINUM','DIAMOND','MASTER','CHALLENGER']) {
      const p = benchmarkForTier(tier);
      assertTrue(Array.isArray(p) && p.length === 5, `${tier} debería tener 5 ejes`);
      for (const v of p) assertTrue(v >= 0 && v <= 100, `valor fuera de [0..100]: ${v}`);
    }
  });

  it('soporta también EMERALD y GRANDMASTER (tiers nuevos)', () => {
    assertTrue(benchmarkForTier('EMERALD').length === 5);
    assertTrue(benchmarkForTier('GRANDMASTER').length === 5);
  });

  it('Gold > Iron en todos los ejes', () => {
    const gold = benchmarkForTier('GOLD');
    const iron = benchmarkForTier('IRON');
    for (let i = 0; i < gold.length; i++) {
      assertTrue(gold[i] >= iron[i], `eje ${i}: Gold ${gold[i]} < Iron ${iron[i]}`);
    }
  });

  it('tier desconocido cae al fallback GOLD', () => {
    const p = benchmarkForTier('FAKE_TIER');
    assertDeep(p, benchmarkForTier('GOLD'));
  });

  it('tier en lowercase también funciona (case-insensitive)', () => {
    assertDeep(benchmarkForTier('gold'), benchmarkForTier('GOLD'));
  });
});

describe('topGap — detecta el mayor déficit', () => {
  it('retorna { axisIdx, axis, gap, label } con shape correcto', () => {
    const userStats = [10, 10, 10, 10, 10]; // todo muy bajo vs GOLD
    const out = topGap(userStats, 'GOLD');
    assertTrue(typeof out.axisIdx === 'number');
    assertTrue(typeof out.axis === 'string', `axis debería ser nombre string, fue ${typeof out.axis}`);
    assertTrue(typeof out.gap === 'number' && out.gap < 0);
    assertTrue(typeof out.label === 'string' && out.label.length > 0);
  });

  it('[60,60,62,60,20] vs Gold detecta "Visión" como peor (gap más negativo)', () => {
    // Gold: [50, 58, 60, 58, 45]
    // gaps: [+10, +2, +2, +2, -25] → peor = Visión (-25).
    const userStats = [60, 60, 62, 60, 20];
    const out = topGap(userStats, 'GOLD');
    assertEqual(out.axis, 'Visión');
    assertTrue(out.gap < 0);
    assertTrue(out.label.includes('Visión'));
  });

  it('user igual al benchmark devuelve label "iguala o supera"', () => {
    const tier = benchmarkForTier('GOLD');
    const out = topGap(tier, 'GOLD');
    assertEqual(out.gap, 0);
    assertTrue(out.label.includes('iguala'));
  });

  it('userStats inválidos (no array de 5) devuelve shape vacío', () => {
    const out = topGap([1, 2, 3], 'GOLD');
    assertEqual(out.axisIdx, -1);
    assertEqual(out.axis, null);
    assertEqual(out.gap, 0);
  });
});
