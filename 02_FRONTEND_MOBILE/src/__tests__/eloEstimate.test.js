// ============================================================================
// eloEstimate.test.js — tests del estimador de ELO
// ============================================================================
const { computeEloEstimate } = loadEsm('src/utils/eloEstimate.js');

describe('eloEstimate — casos canónicos', () => {
  it('Gold II 47 LP + 60% WR ≈ 1444', () => {
    const r = computeEloEstimate({ tier: 'GOLD', division: 'II', lp: 47 }, 60);
    // tier_base + division_bonus + lp*0.3 + wr_factor (≥ 0)
    assertTrue(r.value >= 1400 && r.value <= 1500,
      `Gold II 47 LP + 60% WR debería estar 1400-1500, fue ${r.value}`);
  });

  it('Iron IV 10 LP + 35% WR aplica floor 0 (no negativos)', () => {
    const r = computeEloEstimate({ tier: 'IRON', division: 'IV', lp: 10 }, 35);
    assertTrue(r.value >= 0, `ELO no puede ser negativo, fue ${r.value}`);
  });

  it('Master+ usa division="" (sin división) — el código no la auto-ignora', () => {
    // El código añade DIVISION_BONUS si la division está en la tabla. En
    // Master+ Riot no devuelve division, por eso el shape canónico pasa
    // division: '' → bonus 0. Si por error se pasa 'I', sumará +300.
    const masterEmpty = computeEloEstimate({ tier: 'MASTER', division: '', lp: 200 }, 55);
    const masterIv    = computeEloEstimate({ tier: 'MASTER', division: 'IV', lp: 200 }, 55);
    // Las dos NO suman bonus (IV=0, ''=fallback 0), deben ser iguales.
    assertEqual(masterEmpty.value, masterIv.value);
  });

  it('Challenger > Diamond > Gold > Iron (orden estricto)', () => {
    const ch = computeEloEstimate({ tier: 'CHALLENGER', division: 'I', lp: 0 }, 50);
    const di = computeEloEstimate({ tier: 'DIAMOND',    division: 'I', lp: 0 }, 50);
    const go = computeEloEstimate({ tier: 'GOLD',       division: 'I', lp: 0 }, 50);
    const ir = computeEloEstimate({ tier: 'IRON',       division: 'I', lp: 0 }, 50);
    assertTrue(ch.value > di.value);
    assertTrue(di.value > go.value);
    assertTrue(go.value > ir.value);
  });

  it('devuelve label y tooltip no vacíos', () => {
    const r = computeEloEstimate({ tier: 'GOLD', division: 'II', lp: 47 }, 60);
    assertTrue(r.label && r.label.length > 0);
    assertTrue(r.tooltip && r.tooltip.length > 0);
  });

  it('WR 50% no debería cambiar el ELO base por WR', () => {
    const a = computeEloEstimate({ tier: 'GOLD', division: 'II', lp: 47 }, 50);
    const b = computeEloEstimate({ tier: 'GOLD', division: 'II', lp: 47 }, 50.5);
    // Margen ±5 — el wrFactor cap a ±150 con WR 50% debería ser 0.
    const diff = Math.abs(a.value - b.value);
    assertTrue(diff <= 5, `WR 50%↔50.5% diff demasiado grande: ${diff}`);
  });

  it('WR muy alto (90%) cap el wrFactor a +150', () => {
    const wr50 = computeEloEstimate({ tier: 'GOLD', division: 'II', lp: 47 }, 50);
    const wr90 = computeEloEstimate({ tier: 'GOLD', division: 'II', lp: 47 }, 90);
    const diff = wr90.value - wr50.value;
    assertTrue(diff <= 150, `wrFactor debe estar cap'd a +150, fue ${diff}`);
  });
});
