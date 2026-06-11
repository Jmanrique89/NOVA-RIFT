// ============================================================================
// championPhases.test.js: curva de poder por campeón + ranking estimado
// ----------------------------------------------------------------------------
// Convención del runner propio: CJS + loadEsm + describe/it + asserts globales
// (sin describes anidados — el runner no los soporta).
// ============================================================================
const {
  championCurve,
  phaseTipsFor,
  estimatedLadderRank,
  CURVE_OVERRIDES,
} = loadEsm('src/utils/championPhases.js');

describe('championPhases — curva de poder', () => {
  it('Lucian usa la curva curada: fuerte early-mid, cae en late', () => {
    assertDeep(championCurve('Lucian'), { early: 'strong', mid: 'strong', late: 'weak' });
  });

  it('campeón del catálogo sin override usa heurística por playstyle', () => {
    // Camille (AGRESIVO) no está en CURVE_OVERRIDES → heurística agresiva.
    assertEqual(CURVE_OVERRIDES.Camille, undefined);
    assertDeep(championCurve('Camille'), { early: 'strong', mid: 'ok', late: 'weak' });
  });

  it('campeón desconocido cae a curva equilibrada (no revienta)', () => {
    assertDeep(championCurve('NoExisteChamp'), { early: 'ok', mid: 'ok', late: 'ok' });
  });

  it('phaseTipsFor devuelve las 5 fases con texto no vacío y nombre interpolado', () => {
    const tips = phaseTipsFor('Lucian', 'Lucian');
    for (const k of ['early', 'laning', 'mid', 'late', 'end']) {
      assertTrue(typeof tips[k] === 'string' && tips[k].length > 15, `fase ${k} vacía`);
    }
    assertTrue(tips.early.includes('Lucian'), `interpolación: ${tips.early}`);
  });

  it('escalado malo se avisa explícitamente en late (Lucian → min 30 / CAE)', () => {
    const tips = phaseTipsFor('Lucian', 'Lucian');
    assertTrue(/min 30|CAE/i.test(tips.late), `aviso de escalado: ${tips.late}`);
  });

  it('escalado bueno se avisa explícitamente (Jinx escala)', () => {
    const tips = phaseTipsFor('Jinx', 'Jinx');
    assertTrue(/escala/i.test(tips.late), `aviso de hyper-carry: ${tips.late}`);
  });
});

describe('championPhases — ranking estimado determinístico', () => {
  const stats = { winrate: 60, games: 12 };

  it('es determinístico: misma entrada → mismo puesto', () => {
    assertEqual(
      estimatedLadderRank('Lucian', stats),
      estimatedLadderRank('Lucian', stats)
    );
  });

  it('null sin partidas', () => {
    assertEqual(estimatedLadderRank('Lucian', { winrate: 0, games: 0 }), null);
    assertEqual(estimatedLadderRank('Lucian', null), null);
  });

  it('mejor WR → mejor puesto (número menor)', () => {
    const low  = estimatedLadderRank('Lucian', { winrate: 40, games: 10 });
    const high = estimatedLadderRank('Lucian', { winrate: 70, games: 10 });
    assertTrue(high < low, `high=${high} debería ser < low=${low}`);
  });

  it('rango plausible [517, 45000]', () => {
    const best  = estimatedLadderRank('Lucian', { winrate: 100, games: 50 });
    const worst = estimatedLadderRank('Lucian', { winrate: 0, games: 1 });
    assertTrue(best >= 517, `best=${best}`);
    assertTrue(worst <= 45000, `worst=${worst}`);
  });

  it('campeones distintos con mismas stats reciben puestos distintos (jitter)', () => {
    const a = estimatedLadderRank('Lucian', stats);
    const b = estimatedLadderRank('Jinx', stats);
    assertTrue(a !== b, `jitter: Lucian=${a} vs Jinx=${b}`);
  });
});
