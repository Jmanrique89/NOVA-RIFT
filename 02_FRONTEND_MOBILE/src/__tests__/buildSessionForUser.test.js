// ============================================================================
// buildSessionForUser.test.js Tarea 1 (adiós Jinx fantasma)
// ----------------------------------------------------------------------------
// El HUD debe reflejar al usuario logueado (su main del onboarding), nunca al
// Jinx hardcodeado del mock. Convención del runner propio (scripts/run-tests.js):
// CJS + loadEsm + describe/it + assertEqual/assertDeep/assertTrue.
// Nota: loadEsm crea instancias de módulo independientes → las comparaciones
// con el mock son por VALOR (assertDeep), no por identidad.
// ============================================================================
const { buildSessionForUser } = loadEsm('src/utils/buildSessionForUser.js');
const { MOCK_GAME_SESSION } = loadEsm('src/mocks/mockGameSession.js');

const userLucian = {
  mainRole: 'ADC',
  champions: [
    { championId: 'Lucian', priority: 1, displayName: 'Lucian', slot: 'main' },
    { championId: 'Ezreal', priority: 2, displayName: 'Ezreal', slot: 'secondary' },
  ],
};

describe('buildSessionForUser', () => {
  it('usa el champion del slot main del usuario', () => {
    const s = buildSessionForUser(userLucian);
    assertEqual(s.player.champion, 'Lucian');
  });

  it('usa el primer champion si no hay slot main', () => {
    const s = buildSessionForUser({
      champions: [{ championId: 'Sett', slot: 'secondary' }],
    });
    assertEqual(s.player.champion, 'Sett');
  });

  it('cae al champion del mock (Jinx) si el usuario no tiene pool (cuenta demo)', () => {
    assertEqual(buildSessionForUser({}).player.champion, 'Jinx');
    assertEqual(buildSessionForUser(null).player.champion, 'Jinx');
  });

  it('usa el mainRole del usuario si existe', () => {
    const s = buildSessionForUser({ ...userLucian, mainRole: 'MID' });
    assertEqual(s.player.role, 'MID');
  });

  it('conserva la situación táctica del mock (KDA, enemigos, alertas, mapa)', () => {
    const s = buildSessionForUser(userLucian);
    assertDeep(s.player.kda, MOCK_GAME_SESSION.player.kda);
    assertDeep(s.enemies, MOCK_GAME_SESSION.enemies);
    assertDeep(s.alerts, MOCK_GAME_SESSION.alerts);
    assertDeep(s.map, MOCK_GAME_SESSION.map);
    assertEqual(s.active, true);
  });

  it('no muta el mock interno: tras personalizar, el fallback sigue siendo Jinx', () => {
    // Si buildSessionForUser mutara MOCK_GAME_SESSION, la segunda llamada
    // (usuario sin pool) devolvería 'Lucian' en vez de 'Jinx'.
    buildSessionForUser(userLucian);
    assertEqual(buildSessionForUser({}).player.champion, 'Jinx');
  });
});
