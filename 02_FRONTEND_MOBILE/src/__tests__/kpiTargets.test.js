// ============================================================================
// kpiTargets.test.js: KPI semanal dinámico (selector de objetivos)
// ----------------------------------------------------------------------------
// Nuevos objetivos (muertes, WR), orden del selector y consejos de 1 línea.
// Convención del runner propio: CJS + loadEsm + describe/it + asserts globales.
// ============================================================================
const {
  deathsTargetFor,
  winrateTargetFor,
  kpiTipFor,
  KPI_KEYS,
  KPI_LABELS,
  pickWeeklyKpi,
} = loadEsm('src/constants/kpiTargets.js');

describe('kpiTargets', () => {
  it('KPI_KEYS contiene los 4 objetivos en orden canónico', () => {
    assertDeep(KPI_KEYS, ['CSPM', 'VISION', 'DEATHS', 'WINRATE']);
  });

  it('cada KPI_KEY tiene label con title y axis', () => {
    for (const k of KPI_KEYS) {
      assertTrue(!!KPI_LABELS[k], `falta label de ${k}`);
      assertTrue(!!KPI_LABELS[k].title, `falta title de ${k}`);
      assertTrue(!!KPI_LABELS[k].axis, `falta axis de ${k}`);
    }
  });

  it('DEATHS está marcado lowerIsBetter; el resto no', () => {
    assertEqual(KPI_LABELS.DEATHS.lowerIsBetter, true);
    assertFalse(!!KPI_LABELS.CSPM.lowerIsBetter);
    assertFalse(!!KPI_LABELS.WINRATE.lowerIsBetter);
  });

  it('deathsTargetFor baja el listón al subir de rango (menos muertes permitidas)', () => {
    assertTrue(deathsTargetFor('BRONZE') > deathsTargetFor('GOLD'));
    assertTrue(deathsTargetFor('GOLD') > deathsTargetFor('DIAMOND'));
  });

  it('winrateTargetFor sube con el rango y nunca baja del 50%', () => {
    assertTrue(winrateTargetFor('BRONZE') >= 50);
    assertTrue(winrateTargetFor('DIAMOND') > winrateTargetFor('BRONZE'));
  });

  it('kpiTipFor devuelve consejo no-vacío y distinto según logro (4 KPIs)', () => {
    for (const k of KPI_KEYS) {
      const below = kpiTipFor(k, 1, 100);
      const above = kpiTipFor(k, 100, 1);
      assertTrue(typeof below === 'string' && below.length > 10, `tip below de ${k}`);
      assertTrue(typeof above === 'string' && above.length > 10, `tip above de ${k}`);
      assertTrue(below !== above, `el consejo de ${k} debe cambiar al alcanzar el objetivo`);
    }
  });

  it('kpiTipFor DEATHS: invertido — pocas muertes = mensaje de conseguido', () => {
    const ok  = kpiTipFor('DEATHS', 2.0, 5.0); // 2 muertes, objetivo ≤5 → bien
    const bad = kpiTipFor('DEATHS', 8.0, 5.0); // 8 muertes → consejo correctivo
    assertTrue(/sigue|Pocas/i.test(ok), `mensaje ok DEATHS: ${ok}`);
    assertTrue(/8\.0|máximo/.test(bad), `mensaje correctivo DEATHS: ${bad}`);
  });

  it('pickWeeklyKpi sigue devolviendo solo CSPM/VISION (default sugerido)', () => {
    assertTrue(['CSPM', 'VISION'].includes(pickWeeklyKpi(1, 'ADC')));
    assertTrue(['CSPM', 'VISION'].includes(pickWeeklyKpi(2, 'SUPPORT')));
    assertTrue(['CSPM', 'VISION'].includes(pickWeeklyKpi(7, 'JUNGLE')));
  });

  // H36-T3 (a) — el binding valor↔métrica del círculo depende de que cada KPI
  // lea su PROPIO eje. Esta guarda evita que WIN RATE acabe mostrando CS/min.
  it('cada KPI mapea a su eje correcto (binding del círculo de progreso)', () => {
    assertEqual(KPI_LABELS.CSPM.axis, 'cspm');
    assertEqual(KPI_LABELS.VISION.axis, 'visionScore');
    assertEqual(KPI_LABELS.DEATHS.axis, 'deaths');
    assertEqual(KPI_LABELS.WINRATE.axis, 'winrate');
    assertEqual(KPI_LABELS.WINRATE.unit, '%');
  });

  // H36-T3 (c) — el consejo de WR conseguido ya no usa el "No cambies nada"
  // (no accionable). Debe ser un consejo concreto.
  it('kpiTipFor WINRATE conseguido NO contiene "No cambies nada"', () => {
    const tip = kpiTipFor('WINRATE', 60, 52);
    assertFalse(/no cambies nada/i.test(tip), `copy residual: ${tip}`);
    assertTrue(tip.length > 10);
  });
});
