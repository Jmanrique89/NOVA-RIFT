// ============================================================================
// runeRecommendations.test.js — capa de presentación de runas (P2-1)
// ----------------------------------------------------------------------------
// runeRecommendations COMPONE el motor testeado recommendRunes y añade los
// fragmentos, el mapeo de icono y los metadatos de árbol. Aquí cubrimos la
// capa nueva: shape op.gg garantizado, clasificación de arquetipo (para los
// fragmentos), mapeo keystone→icono y propagación de overrides por matchup.
// ============================================================================
const { getRuneRecommendation, KEYSTONE_ICON_KEY, TREE_META } = loadEsm('src/mocks/runeRecommendations.js');
const { getRuneImageUrl } = loadEsm('src/utils/dataDragon.js');

describe('getRuneRecommendation — shape op.gg', () => {
  it('devuelve árbol primario (keystone + 3 runas), secundario (2) y 3 fragmentos', () => {
    const r = getRuneRecommendation('Lucian');
    assertTrue(!!r, 'debería devolver una página');
    assertTrue(typeof r.primary.keystone === 'string' && r.primary.keystone.length > 0);
    assertTrue(Array.isArray(r.primary.runes) && r.primary.runes.length === 3);
    assertTrue(Array.isArray(r.secondary.runes) && r.secondary.runes.length === 2);
    assertTrue(typeof r.fragments.offense === 'string');
    assertTrue(typeof r.fragments.flex === 'string');
    assertTrue(typeof r.fragments.defense === 'string');
  });

  it('cada árbol trae etiqueta ES y color para el look op.gg', () => {
    const r = getRuneRecommendation('Ahri');
    assertTrue(typeof r.primary.treeLabel === 'string' && r.primary.treeLabel.length > 0);
    assertTrue(/^#/.test(r.primary.color), 'color primario debería ser hex');
    assertTrue(/^#/.test(r.secondary.color), 'color secundario debería ser hex');
  });

  it('devuelve null sin campeón', () => {
    assertEqual(getRuneRecommendation(null), null);
    assertEqual(getRuneRecommendation(''), null);
  });
});

describe('getRuneRecommendation — arquetipo (selección de fragmentos)', () => {
  it('Caitlyn (ADC) → arquetipo ADC con shard de velocidad de ataque', () => {
    const r = getRuneRecommendation('Caitlyn');
    assertEqual(r.archetype, 'ADC');
    assertTrue(/ataque/i.test(r.fragments.offense), 'ADC ofensivo debería ser vel. de ataque');
  });

  it('Malphite (keystone Resolve) → arquetipo TANK', () => {
    const r = getRuneRecommendation('Malphite');
    assertEqual(r.archetype, 'TANK');
  });

  it('Zed → arquetipo AD; Ahri → arquetipo AP', () => {
    assertEqual(getRuneRecommendation('Zed').archetype, 'AD');
    assertEqual(getRuneRecommendation('Ahri').archetype, 'AP');
  });

  it('Soraka (SUPPORT enchanter) → arquetipo SUPPORT', () => {
    assertEqual(getRuneRecommendation('Soraka').archetype, 'SUPPORT');
  });
});

describe('getRuneRecommendation — mapeo de icono de keystone', () => {
  it('keystone curada mapea a una clave de icono resoluble por getRuneImageUrl', () => {
    const r = getRuneRecommendation('Aatrox'); // Conqueror
    assertEqual(r.primary.keystone, 'Conqueror');
    assertEqual(r.primary.keystoneIconKey, 'Conqueror');
    assertTrue(typeof getRuneImageUrl(r.primary.keystoneIconKey) === 'string',
      'getRuneImageUrl debería resolver el icono del keystone');
  });

  it('todas las claves de KEYSTONE_ICON_KEY resuelven un icono real', () => {
    for (const key of Object.values(KEYSTONE_ICON_KEY)) {
      assertTrue(typeof getRuneImageUrl(key) === 'string',
        `getRuneImageUrl('${key}') debería devolver una URL`);
    }
  });
});

describe('getRuneRecommendation — overrides por matchup', () => {
  it('Jinx vs HYPER_CARRY → overridden y keystone Lethal Tempo', () => {
    const r = getRuneRecommendation('Jinx', { enemyTags: ['HYPER_CARRY'] });
    assertTrue(r.overridden, 'debería marcar overridden');
    assertEqual(r.primary.keystone, 'Lethal Tempo');
  });

  it('sin enemyTags no aplica override', () => {
    const r = getRuneRecommendation('Lucian');
    assertFalse(r.overridden);
  });
});
