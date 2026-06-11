// ============================================================================
// championPool.test.js — tests del modelo + desbloqueo del pool 2+2
// ----------------------------------------------------------------------------
// Cubre las funciones puras de utils/championPool.js:
// sealOnboardingPool: sella slot(orden por rol) + locked (2 activos + 2 lock)
// applyUnlocks: desbloquea slots al alcanzar el umbral de partidas
// describeLockedProgress: estado de las barras de progreso
// resolveGamesPlayed: resolución del nº de partidas (varios shapes)
// tolerancia con datos antiguos (sin locked/slot → desbloqueado)
// ============================================================================
const {
  sealOnboardingPool,
  applyUnlocks,
  describeLockedProgress,
  resolveGamesPlayed,
  isEntryLocked,
  slotIndexOf,
  SLOT_UNLOCK_GAMES,
  ACTIVE_SLOTS,
} = loadEsm('src/utils/championPool.js');

describe('championPool — sealOnboardingPool', () => {
  it('los 2 primeros quedan activos y el 3º/4º bloqueados', () => {
    const flat = [
      { championId: 'Lucian',   slot: 'main' },
      { championId: 'Jinx',     slot: 'secondary' },
      { championId: 'Caitlyn',  slot: 'secondary' },
      { championId: 'Ezreal',   slot: 'secondary' },
    ];
    const sealed = sealOnboardingPool(flat);
    assertEqual(sealed[0].slot, 0);
    assertEqual(sealed[0].locked, false);
    assertEqual(sealed[1].slot, 1);
    assertEqual(sealed[1].locked, false);
    assertEqual(sealed[2].slot, 2);
    assertEqual(sealed[2].locked, true);
    assertEqual(sealed[3].slot, 3);
    assertEqual(sealed[3].locked, true);
  });

  it('preserva la clave textual original como slotKind (compat HubScreen)', () => {
    const sealed = sealOnboardingPool([{ championId: 'Lucian', slot: 'main' }]);
    assertEqual(sealed[0].slotKind, 'main');
    assertEqual(sealed[0].slot, 0); // slot textual sobreescrito por número
  });

  it('envuelve strings sueltos en {championId}', () => {
    const sealed = sealOnboardingPool(['Lucian', 'Jinx']);
    assertEqual(sealed[0].championId, 'Lucian');
    assertEqual(sealed[0].locked, false);
    assertEqual(sealed[1].championId, 'Jinx');
  });

  it('agrupa el orden por rol cuando se pasa un resolutor', () => {
    const flat = [
      { championId: 'Garen' }, { championId: 'Darius' }, { championId: 'Shen' },
      { championId: 'Lucian' }, { championId: 'Jinx' }, { championId: 'Caitlyn' },
    ];
    const roleOf = (id) =>
      ['Garen', 'Darius', 'Shen'].includes(id) ? 'TOP' : 'ADC';
    const sealed = sealOnboardingPool(flat, roleOf);
    // Cada rol arranca su propio contador 0..N.
    assertEqual(sealed[0].slot, 0); // Garen TOP#0
    assertEqual(sealed[2].slot, 2); // Shen TOP#2 → locked
    assertEqual(sealed[2].locked, true);
    assertEqual(sealed[3].slot, 0); // Lucian ADC#0 → activo
    assertEqual(sealed[3].locked, false);
    assertEqual(sealed[5].slot, 2); // Caitlyn ADC#2 → locked
    assertEqual(sealed[5].locked, true);
  });
});

describe('championPool — applyUnlocks', () => {
  const basePool = () => ([
    { championId: 'Lucian',  slot: 0, locked: false },
    { championId: 'Jinx',    slot: 1, locked: false },
    { championId: 'Caitlyn', slot: 2, locked: true },  // umbral 10
    { championId: 'Ezreal',  slot: 3, locked: true },  // umbral 25
  ]);

  it('con 0 partidas no desbloquea nada', () => {
    const { pool, changed, unlockedSlots } = applyUnlocks(basePool(), 0);
    assertEqual(changed, false);
    assertDeep(unlockedSlots, []);
    assertEqual(pool[2].locked, true);
    assertEqual(pool[3].locked, true);
  });

  it(`con ${SLOT_UNLOCK_GAMES[2]} partidas desbloquea el 3er slot (idx 2)`, () => {
    const { pool, changed, unlockedSlots } = applyUnlocks(basePool(), SLOT_UNLOCK_GAMES[2]);
    assertEqual(changed, true);
    assertDeep(unlockedSlots, [2]);
    assertEqual(pool[2].locked, false);
    assertEqual(pool[3].locked, true); // el 4º sigue bloqueado
  });

  it(`con ${SLOT_UNLOCK_GAMES[3]} partidas desbloquea AMBOS slots bloqueados`, () => {
    const { pool, changed, unlockedSlots } = applyUnlocks(basePool(), SLOT_UNLOCK_GAMES[3]);
    assertEqual(changed, true);
    assertDeep(unlockedSlots, [2, 3]);
    assertEqual(pool[2].locked, false);
    assertEqual(pool[3].locked, false);
  });

  it('es idempotente: no re-bloquea un slot ya abierto', () => {
    const once = applyUnlocks(basePool(), 100).pool;
    const { changed } = applyUnlocks(once, 100);
    assertEqual(changed, false);
  });

  it('no muta el array original (función pura)', () => {
    const original = basePool();
    applyUnlocks(original, 100);
    assertEqual(original[2].locked, true); // intacto
  });

  it('tolera entradas sin slot numérico (las deja igual)', () => {
    const pool = [{ championId: 'Lucian', locked: true }]; // sin slot
    const { pool: out, changed } = applyUnlocks(pool, 100);
    assertEqual(changed, false);
    assertEqual(out[0].locked, true);
  });
});

describe('championPool — describeLockedProgress', () => {
  it('reporta partidas restantes y progreso del slot bloqueado', () => {
    const pool = [
      { championId: 'Lucian', slot: 0, locked: false },
      { championId: 'Caitlyn', slot: 2, locked: true }, // umbral 10
    ];
    const prog = describeLockedProgress(pool, 4);
    assertEqual(prog.length, 1);
    assertEqual(prog[0].slot, 2);
    assertEqual(prog[0].required, SLOT_UNLOCK_GAMES[2]);
    assertEqual(prog[0].remaining, SLOT_UNLOCK_GAMES[2] - 4);
    assertTrue(prog[0].progress > 0 && prog[0].progress < 1);
  });

  it('no incluye slots cuyo umbral ya se alcanzó', () => {
    const pool = [{ championId: 'Caitlyn', slot: 2, locked: true }];
    const prog = describeLockedProgress(pool, 999);
    assertEqual(prog.length, 0);
  });
});

describe('championPool — tolerancia datos antiguos', () => {
  it('entrada sin locked se trata como desbloqueada', () => {
    assertEqual(isEntryLocked({ championId: 'Lucian' }), false);
    assertEqual(isEntryLocked('Lucian'), false);
  });

  it('slotIndexOf devuelve null para slot textual legacy', () => {
    assertEqual(slotIndexOf({ championId: 'Lucian', slot: 'main' }), null);
    assertEqual(slotIndexOf({ championId: 'Lucian', slot: 2 }), 2);
  });
});

describe('championPool — resolveGamesPlayed', () => {
  it('prioriza user.gamesPlayed', () => {
    assertEqual(resolveGamesPlayed({ gamesPlayed: 12 }, 99), 12);
  });
  it('usa recentMatches.length si no hay gamesPlayed', () => {
    assertEqual(resolveGamesPlayed({ recentMatches: [1, 2, 3] }, 99), 3);
  });
  it('cae al fallback cuando no hay datos', () => {
    assertEqual(resolveGamesPlayed({}, 7), 7);
    assertEqual(resolveGamesPlayed(null, 5), 5);
  });
  it('ACTIVE_SLOTS es 2 (modelo 2+2)', () => {
    assertEqual(ACTIVE_SLOTS, 2);
  });
});
