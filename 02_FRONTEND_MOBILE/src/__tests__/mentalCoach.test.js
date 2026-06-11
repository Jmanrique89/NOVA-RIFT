// ============================================================================
// mentalCoach.test.js — tests del motor del Coach Mental
// ----------------------------------------------------------------------------
// Cubre las 5 reglas de bienestar y su orden de prioridad, además de la
// tolerancia a ambos shapes de resultado ('W'/'L' del mock y 'WIN'/'LOSS' del
// backend Riot) y los casos degenerados (sin datos, racha mixta).
// ============================================================================
const { evaluateMentalState, leadingStreak } = loadEsm('src/utils/mentalCoach.js');
const { evaluateMentalFactors } = loadEsm('src/utils/mentalCoach.js');

// Helper: localiza una señal del desglose por su id estable.
const factor = (factors, id) => factors.find((f) => f.id === id);

// Helpers de fixtures: arrays de partidas en orden descendente (más reciente 0).
const wins = (n) => Array.from({ length: n }, () => ({ result: 'W' }));
const losses = (n) => Array.from({ length: n }, () => ({ result: 'L' }));

describe('mentalCoach — leadingStreak', () => {
  it('cuenta la racha de victorias desde la más reciente', () => {
    const s = leadingStreak([...wins(3), { result: 'L' }]);
    assertEqual(s.type, 'win');
    assertEqual(s.count, 3);
  });

  it('cuenta la racha de derrotas desde la más reciente', () => {
    const s = leadingStreak([...losses(4), { result: 'W' }]);
    assertEqual(s.type, 'loss');
    assertEqual(s.count, 4);
  });

  it('se rompe en cuanto cambia el resultado (no cuenta no-consecutivas)', () => {
    // V D V V V → racha líder = 1 victoria
    const s = leadingStreak([{ result: 'W' }, { result: 'L' }, ...wins(3)]);
    assertEqual(s.type, 'win');
    assertEqual(s.count, 1);
  });

  it('lista vacía / no-array → sin racha', () => {
    assertEqual(leadingStreak([]).count, 0);
    assertEqual(leadingStreak(undefined).count, 0);
    assertEqual(leadingStreak(null).type, null);
  });
});

describe('mentalCoach — reglas de evaluación', () => {
  it('Regla 1: 3+ derrotas seguidas → NO JUEGUES (tilt)', () => {
    const r = evaluateMentalState({ matches: losses(3), hour: 15, lp: 50 });
    assertEqual(r.status, 'AVOID');
    // el mensaje incluye el nº de derrotas y un consejo accionable (paseo).
    assertTrue(r.message.includes('3 derrotas seguidas'), `mensaje tilt: ${r.message}`);
    assertTrue(r.message.includes('paseo'), `mensaje tilt accionable: ${r.message}`);
  });

  it('Regla 2: exactamente 2 derrotas seguidas → PRECAUCIÓN, corte de 30 min', () => {
    const r = evaluateMentalState({ matches: [...losses(2), { result: 'W' }], hour: 15, lp: 50 });
    assertEqual(r.status, 'CAUTION');
    assertTrue(r.message.includes('Dos derrotas'), `mensaje 2L: ${r.message}`);
    assertTrue(r.message.includes('30 minutos'), `mensaje 2L escala la pausa: ${r.message}`);
  });

  it('Regla 3: 1 derrota → "Acabas de perder" + espera de 10 minutos', () => {
    const r = evaluateMentalState({ matches: [{ result: 'L' }, ...wins(3)], hour: 15, lp: 50 });
    assertEqual(r.status, 'CAUTION');
    assertTrue(r.message.includes('Acabas de perder'), `mensaje 1L: ${r.message}`);
    assertTrue(r.message.includes('10 minutos'), `mensaje 1L pausa: ${r.message}`);
  });

  it('Regla 3: la derrota reciente pisa a la madrugada (mensaje específico)', () => {
    // 1 derrota a las 02:00 → manda el "acabas de perder", no el nocturno.
    const r = evaluateMentalState({ matches: [{ result: 'L' }, ...wins(2)], hour: 2, lp: 50 });
    assertEqual(r.status, 'CAUTION');
    assertTrue(r.message.includes('Acabas de perder'), `1L > madrugada: ${r.message}`);
  });

  it('Regla 3: la derrota reciente pisa al impulso por LP bajo (no ÓPTIMO en caliente)', () => {
    // Recién ascendido (LP 5) pero acaba de perder → esperar, no "momento de impulso".
    const r = evaluateMentalState({ matches: [{ result: 'L' }, ...wins(2)], hour: 18, lp: 5 });
    assertEqual(r.status, 'CAUTION');
    assertTrue(r.message.includes('Acabas de perder'), `1L > LP bajo: ${r.message}`);
  });

  it('Regla 1: tilt manda sobre madrugada y LP bajo (prioridad máxima)', () => {
    // 3 derrotas + madrugada + LP bajo: gana el tilt (rojo).
    const r = evaluateMentalState({ matches: losses(5), hour: 2, lp: 5 });
    assertEqual(r.status, 'AVOID');
  });

  it('Regla 2: madrugada 00:00–04:00 → PRECAUCIÓN', () => {
    const r = evaluateMentalState({ matches: wins(1), hour: 2, lp: 50 });
    assertEqual(r.status, 'CAUTION');
    assertEqual(r.message, 'Rendimiento cognitivo reducido en horario nocturno.');
  });

  it('Regla 2: la madrugada pesa más que una racha positiva', () => {
    // 3 victorias pero a las 03:00 → precaución, no óptimo.
    const r = evaluateMentalState({ matches: wins(3), hour: 3, lp: 50 });
    assertEqual(r.status, 'CAUTION');
  });

  it('Regla 2: 04:00 ya NO es madrugada (límite del rango)', () => {
    // Sin otras señales (sin racha, sin LP) → por defecto precaución, pero el
    // mensaje NO debe ser el nocturno.
    const r = evaluateMentalState({ matches: wins(1), hour: 4, lp: 50 });
    assertFalse(r.message.includes('nocturno'), `04:00 no es madrugada: ${r.message}`);
  });

  it('Regla 3: recién ascendido (LP < 20) → ÓPTIMO (impulso)', () => {
    const r = evaluateMentalState({ matches: wins(1), hour: 18, lp: 12 });
    assertEqual(r.status, 'OPTIMAL');
    assertEqual(r.message, 'Momento de impulso. Tu motivación está alta.');
  });

  it('Regla 3: LP exactamente 0 también es ascenso reciente', () => {
    const r = evaluateMentalState({ matches: [], hour: 18, lp: 0 });
    assertEqual(r.status, 'OPTIMAL');
  });

  it('Regla 4: 3+ victorias seguidas → ÓPTIMO (racha positiva)', () => {
    const r = evaluateMentalState({ matches: wins(3), hour: 18, lp: 50 });
    assertEqual(r.status, 'OPTIMAL');
    assertEqual(r.message, 'Racha positiva. Buen momento para jugar ranked.');
  });

  it('Por defecto → PRECAUCIÓN con mensaje neutro motivacional', () => {
    // Sin racha relevante, hora normal, LP medio.
    const r = evaluateMentalState({ matches: [{ result: 'W' }, { result: 'L' }], hour: 18, lp: 50 });
    assertEqual(r.status, 'CAUTION');
    assertTrue(r.message.length > 0);
    assertFalse(r.message.includes('nocturno'));
  });

  it('demo FAKER: 3 victorias · 22:00 · Gold II (47 LP) → ÓPTIMO racha positiva', () => {
    const r = evaluateMentalState({ matches: wins(3), hour: 22, lp: 47 });
    assertEqual(r.status, 'OPTIMAL');
    assertEqual(r.message, 'Racha positiva. Buen momento para jugar ranked.');
  });
});

describe('mentalCoach — tolerancia de datos', () => {
  it('acepta el shape del backend Riot (WIN/LOSS) igual que el mock (W/L)', () => {
    const real = evaluateMentalState({
      matches: [{ result: 'LOSS' }, { result: 'LOSS' }, { result: 'LOSS' }],
      hour: 15,
      lp: 50,
    });
    assertEqual(real.status, 'AVOID');
  });

  it('sin argumentos no revienta → devuelve un estado válido', () => {
    const r = evaluateMentalState();
    assertTrue(['OPTIMAL', 'CAUTION', 'AVOID'].includes(r.status));
  });

  it('lp no numérico (unranked) no dispara la regla de ascenso', () => {
    const r = evaluateMentalState({ matches: [{ result: 'W' }], hour: 18, lp: undefined });
    assertEqual(r.status, 'CAUTION');
  });
});

describe('mentalCoach — evaluateMentalFactors (desglose para el modal)', () => {
  it('devuelve siempre las 3 señales en orden estable', () => {
    const f = evaluateMentalFactors({ matches: wins(3), hour: 18, lp: 47 });
    assertEqual(f.length, 3);
    assertEqual(f[0].id, 'streak');
    assertEqual(f[1].id, 'hour');
    assertEqual(f[2].id, 'momentum');
  });

  it('3 derrotas → streak AVOID; las otras señales coherentes (no penalizan)', () => {
    const f = evaluateMentalFactors({ matches: losses(3), hour: 18, lp: 50 });
    assertEqual(factor(f, 'streak').status, 'AVOID');
    assertEqual(factor(f, 'hour').status, 'OPTIMAL');
    assertEqual(factor(f, 'momentum').status, 'NEUTRAL');
  });

  it('2 derrotas → streak CAUTION', () => {
    const f = evaluateMentalFactors({ matches: [...losses(2), { result: 'W' }], hour: 18, lp: 50 });
    assertEqual(factor(f, 'streak').status, 'CAUTION');
  });

  it('1 derrota → streak CAUTION', () => {
    const f = evaluateMentalFactors({ matches: [{ result: 'L' }, ...wins(3)], hour: 18, lp: 50 });
    assertEqual(factor(f, 'streak').status, 'CAUTION');
  });

  it('3 victorias + tarde (18h) + lp 47 → streak OPTIMAL, hour OPTIMAL, momentum NEUTRAL', () => {
    const f = evaluateMentalFactors({ matches: wins(3), hour: 18, lp: 47 });
    assertEqual(factor(f, 'streak').status, 'OPTIMAL');
    assertEqual(factor(f, 'hour').status, 'OPTIMAL');
    assertEqual(factor(f, 'momentum').status, 'NEUTRAL');
  });

  it('el desglose es independiente del veredicto: hour 2 → CAUTION aunque la racha sea de victorias', () => {
    const f = evaluateMentalFactors({ matches: wins(3), hour: 2, lp: 50 });
    assertEqual(factor(f, 'hour').status, 'CAUTION');
    // la racha sigue siendo OPTIMAL por separado (no la pisa la madrugada).
    assertEqual(factor(f, 'streak').status, 'OPTIMAL');
  });

  it('momentum: lp 12 → OPTIMAL; sin lp → NEUTRAL', () => {
    assertEqual(factor(evaluateMentalFactors({ matches: wins(1), hour: 18, lp: 12 }), 'momentum').status, 'OPTIMAL');
    assertEqual(factor(evaluateMentalFactors({ matches: wins(1), hour: 18 }), 'momentum').status, 'NEUTRAL');
  });

  it('sin datos en absoluto → no revienta y las 3 señales tienen estado válido', () => {
    const f = evaluateMentalFactors();
    assertEqual(f.length, 3);
    const valid = ['OPTIMAL', 'CAUTION', 'AVOID', 'NEUTRAL'];
    f.forEach((s) => assertTrue(valid.includes(s.status), `estado válido: ${s.id}=${s.status}`));
    // sin racha → NEUTRAL; sin hora → no es madrugada → OPTIMAL; sin lp → NEUTRAL.
    assertEqual(factor(f, 'streak').status, 'NEUTRAL');
    assertEqual(factor(f, 'hour').status, 'OPTIMAL');
    assertEqual(factor(f, 'momentum').status, 'NEUTRAL');
  });

  it('guardia de regresión: evaluateMentalState sigue devolviendo lo de antes', () => {
    // mismos inputs que el caso demo FAKER → veredicto intacto.
    const r = evaluateMentalState({ matches: wins(3), hour: 22, lp: 47 });
    assertEqual(r.status, 'OPTIMAL');
    assertEqual(r.message, 'Racha positiva. Buen momento para jugar ranked.');
  });
});
