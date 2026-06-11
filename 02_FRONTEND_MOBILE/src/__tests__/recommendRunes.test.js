// ============================================================================
// recommendRunes.test.js — tests del motor de runas P1
// ============================================================================
const { recommendRunes } = loadEsm('src/utils/recommendRunes.js');

describe('recommendRunes — tabla curada', () => {
  it('Aatrox → Conqueror Precision', () => {
    const r = recommendRunes('Aatrox');
    assertEqual(r.keystone, 'Conqueror');
    assertEqual(r.tree, 'PRECISION');
    assertEqual(r.source, 'curated');
    assertFalse(r.overridden);
  });

  it('Lulu → Summon Aery Sorcery', () => {
    const r = recommendRunes('Lulu');
    assertEqual(r.keystone, 'Summon Aery');
    assertEqual(r.tree, 'SORCERY');
  });

  it('Malphite → Aftershock Resolve', () => {
    const r = recommendRunes('Malphite');
    assertEqual(r.keystone, 'Aftershock');
    assertEqual(r.tree, 'RESOLVE');
  });

  it('Zed → Electrocute Domination', () => {
    const r = recommendRunes('Zed');
    assertEqual(r.keystone, 'Electrocute');
    assertEqual(r.tree, 'DOMINATION');
  });

  it('cada entrada curada tiene 3 runas secundarias + 2 del segundo árbol', () => {
    const r = recommendRunes('Lucian');
    assertTrue(Array.isArray(r.secondary) && r.secondary.length === 3);
    assertTrue(Array.isArray(r.secondaryRunes) && r.secondaryRunes.length === 2);
    assertTrue(typeof r.notes === 'string' && r.notes.length > 0);
  });
});

describe('recommendRunes — defaults por damage type', () => {
  it('champion desconocido AD → Conqueror', () => {
    const r = recommendRunes('CampeonInventadoAD', { damageType: 'AD' });
    assertEqual(r.keystone, 'Conqueror');
    assertEqual(r.source, 'default');
  });

  it('champion desconocido AP → Arcane Comet', () => {
    const r = recommendRunes('CampeonInventadoAP', { damageType: 'AP' });
    assertEqual(r.keystone, 'Arcane Comet');
    assertEqual(r.source, 'default');
  });

  it('champion desconocido MIXED → Hail of Blades', () => {
    const r = recommendRunes('CampeonInventadoMIX', { damageType: 'MIXED' });
    assertEqual(r.keystone, 'Hail of Blades');
  });

  it('sin damageType cae a AD por defecto', () => {
    const r = recommendRunes('CampeonInventado');
    assertEqual(r.keystone, 'Conqueror');
  });
});

describe('recommendRunes — overrides por matchup', () => {
  it('Lucian vs SUSTAINED → Press the Attack', () => {
    // Default Lucian es Press the Attack ya, pero si el override entra,
    // overridden=true marca que se ha aplicado la heurística.
    const r = recommendRunes('Lucian', { enemyTags: ['SUSTAINED'] });
    assertEqual(r.keystone, 'Press the Attack');
    assertTrue(r.overridden, 'overridden flag debería ser true');
    assertTrue(r.notes.toLowerCase().includes('sustain'));
  });

  it('Jinx vs HYPER_CARRY → Lethal Tempo', () => {
    const r = recommendRunes('Jinx', { enemyTags: ['HYPER_CARRY'] });
    assertEqual(r.keystone, 'Lethal Tempo');
    assertTrue(r.overridden);
  });

  it('Caitlyn vs HYPER_CARRY → Lethal Tempo (override sobre Press the Attack)', () => {
    // Caitlyn por defecto es Press the Attack pero el override la lleva
    // a Lethal Tempo cuando hay hyper-carry rival.
    const r = recommendRunes('Caitlyn', { enemyTags: ['HYPER_CARRY'] });
    assertEqual(r.keystone, 'Lethal Tempo');
  });

  it('Champion no afectado por override mantiene su keystone', () => {
    // Aatrox no está en SUSTAINED override list, mantiene Conqueror.
    const r = recommendRunes('Aatrox', { enemyTags: ['SUSTAINED', 'HYPER_CARRY'] });
    assertEqual(r.keystone, 'Conqueror');
    assertFalse(r.overridden);
  });

  it('enemyTags vacío no aplica override', () => {
    const r = recommendRunes('Lucian', { enemyTags: [] });
    assertEqual(r.keystone, 'Press the Attack'); // su default curado
    assertFalse(r.overridden);
  });

  it('enemyTags undefined no rompe', () => {
    const r = recommendRunes('Lucian');
    assertEqual(r.keystone, 'Press the Attack');
    assertFalse(r.overridden);
  });
});

describe('recommendRunes — shape garantizado', () => {
  it('todos los campos están presentes en respuesta curada', () => {
    const r = recommendRunes('Yasuo');
    assertTrue(typeof r.keystone === 'string');
    assertTrue(typeof r.tree === 'string');
    assertTrue(Array.isArray(r.secondary));
    assertTrue(typeof r.secondTree === 'string');
    assertTrue(Array.isArray(r.secondaryRunes));
    assertTrue(typeof r.notes === 'string');
    assertTrue(typeof r.source === 'string');
  });

  it('todos los campos están presentes en respuesta default', () => {
    const r = recommendRunes('Inexistente');
    assertTrue(typeof r.keystone === 'string');
    assertTrue(typeof r.tree === 'string');
    assertTrue(Array.isArray(r.secondary));
    assertTrue(typeof r.secondTree === 'string');
    assertTrue(Array.isArray(r.secondaryRunes));
    assertTrue(typeof r.notes === 'string');
    assertTrue(r.source === 'default');
  });
});
