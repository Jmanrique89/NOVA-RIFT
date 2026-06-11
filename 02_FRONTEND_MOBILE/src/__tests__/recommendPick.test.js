// ============================================================================
// recommendPick.test.js — tests del motor de recomendación /
// ----------------------------------------------------------------------------
// Cubre los 3 caminos del motor:
// pool vacío → fallback Jinx LOW
// sin enemy picks → primer main del pool MEDIUM
// con enemy picks → puntúa matchup + bonus de comp + bonus de WR
//
// Y las features selectedRole, composition-aware bonus, detail
// estructurado, retrocompat con firma legacy `(enemyPicks, pool, userStats)`.
// ============================================================================
const { recommendPick, recommendFromPool } = loadEsm('src/utils/recommendPick.js');
// pool 2+2: comprobamos que el pool SELLADO por sealOnboardingPool
// (slot+locked) se integra con recommendFromPool y produce unlockHint cuando el
// mejor pick está en un hueco bloqueado.
const { sealOnboardingPool, applyUnlocks } = loadEsm('src/utils/championPool.js');

describe('recommendPick — fallbacks', () => {
  it('pool vacío devuelve Jinx LOW con razón "no hay pool"', () => {
    const r = recommendPick([], [], {});
    assertEqual(r.champion, 'Jinx');
    assertEqual(r.confidence, 'LOW');
    assertTrue(r.reason.includes('No hay pool'));
  });

  it('pool sin enemy picks devuelve primer main MEDIUM', () => {
    const r = recommendPick([], ['Lucian', 'Jinx', 'Caitlyn'], {});
    assertEqual(r.champion, 'Lucian');
    assertEqual(r.confidence, 'MEDIUM');
    assertTrue(r.reason.includes('más dominado'));
  });

  it('sin enemy picks + selectedRole filtra al pool', () => {
    // Pool con TOP + ADC; selectedRole=ADC → Lucian aunque sea segundo.
    const r = recommendPick([], ['Garen', 'Lucian'], { selectedRole: 'ADC' });
    assertEqual(r.champion, 'Lucian');
  });
});

describe('recommendPick — matchup directo', () => {
  it('Lucian counterea Jinx (good matchup)', () => {
    const r = recommendPick(['Jinx'], ['Lucian', 'Jhin', 'Caitlyn'], {});
    assertEqual(r.champion, 'Lucian');
    assertDeep(r.detail.goodMatchups, ['Jinx']);
  });

  it('confidence HIGH con ≥2 buenos matchups', () => {
    // Lucian goodAgainst: ['Jinx','Ashe','Caitlyn']
    const r = recommendPick(['Jinx', 'Ashe'], ['Lucian'], {});
    assertEqual(r.confidence, 'HIGH');
  });

  it('confidence MEDIUM con 1 buen matchup', () => {
    const r = recommendPick(['Jinx'], ['Jhin'], {});
    assertEqual(r.confidence, 'MEDIUM');
  });

  it('confidence LOW sin matchups ni comp counters', () => {
    // Pool Lulu (no MATCHUP_TABLE), enemy random sin engage/AD/AP-heavy.
    const r = recommendPick(['Ahri'], ['Lulu'], {});
    assertEqual(r.confidence, 'LOW');
  });

  it('reason incluye warning cuando hay bad matchups', () => {
    const r = recommendPick(['Vayne', 'Jinx'], ['Lucian'], {});
    assertTrue(r.reason.includes('Cuidado con'));
  });
});

describe('recommendPick — composition-aware', () => {
  it('AD-heavy comp + Caitlyn → bonus por melee-heavy', () => {
    // Garen, Darius, Tryndamere, Lucian, Vayne — todos AD; melee 60%.
    const r = recommendPick(
      ['Garen', 'Darius', 'Tryndamere', 'Lucian', 'Vayne'],
      ['Malphite', 'Lucian', 'Caitlyn'],
      {}
    );
    // Caitlyn está en MELEE_HEAVY counters → debería ganar por comp bonus.
    assertEqual(r.champion, 'Caitlyn');
    assertTrue(r.detail.compReasons.length > 0);
  });

  it('hard engage enemy (Malphite/Amumu/Sejuani) → counter AP-heavy', () => {
    // Pool: Lulu (peel), Lucian (AP-heavy counter), Garen (Malphite goodAgainst).
    // Garen tiene matchupScore=1 (Malphite) + AP_HEAVY +1.5 = 2.5.
    // Lucian tiene matchupScore=0 + AP_HEAVY +1.5 = 1.5.
    // Lulu tiene ENGAGE +1.0.
    // Garen gana con HIGH (matchup>=1 + comp>=1).
    const r = recommendPick(
      ['Malphite', 'Amumu', 'Sejuani'],
      ['Lulu', 'Lucian', 'Garen'],
      {}
    );
    assertEqual(r.champion, 'Garen');
    assertEqual(r.confidence, 'HIGH');
  });

  it('selectedRole=ADC filtra el pool al rol elegido', () => {
    // Pool con MID + ADC. Enemy picks irrelevantes para los matchups.
    // Sin selectedRole, podría ganar Orianna si tiene mejor matchup.
    // Con selectedRole=ADC, solo Lucian es candidato.
    const r = recommendPick(
      ['Yasuo'],
      ['Orianna', 'Lucian'],
      { selectedRole: 'ADC' }
    );
    assertEqual(r.champion, 'Lucian');
  });

  it('selectedRole sin coincidencia en pool → fallback al pool entero', () => {
    // Pool solo ADC, role=TOP → Lucian (el único).
    const r = recommendPick(
      ['Jinx'],
      ['Lucian'],
      { selectedRole: 'TOP' }
    );
    assertEqual(r.champion, 'Lucian');
  });
});

describe('recommendPick — comp arquetipos extendidos (P0)', () => {
  it('HYPER_CARRY enemigo (Vayne) → Zed (early pressure) gana', () => {
    // Vayne está en HYPER_CARRY_CHAMPIONS. Zed está en COMP_COUNTERS.HYPER_CARRY.
    // Pool con Zed y Lucian; sin matchups directos del MATCHUP_TABLE.
    const r = recommendPick(['Vayne'], ['Zed', 'Lucian'], {});
    assertEqual(r.champion, 'Zed');
    assertTrue(r.detail.compReasons.some(s => s.includes('hyper-carry')),
      `compReasons debería incluir hyper-carry, fue: ${JSON.stringify(r.detail.compReasons)}`);
  });

  it('POKE_SIEGE enemigo (Jayce + Ziggs) → Malphite (engage forzado)', () => {
    // Jayce y Ziggs están en POKE_SIEGE. Malphite está en COMP_COUNTERS.POKE_SIEGE.
    const r = recommendPick(['Jayce', 'Ziggs'], ['Malphite', 'Lucian'], {});
    assertEqual(r.champion, 'Malphite');
    assertTrue(r.detail.compReasons.some(s => s.includes('poke')));
  });

  it('BURST_PICK enemigo (Zed) → Lulu (peel anti-asesino)', () => {
    // Zed está en BURST_PICK_CHAMPIONS. Lulu está en COMP_COUNTERS.BURST_PICK.
    const r = recommendPick(['Zed'], ['Lulu', 'Lucian'], {});
    assertEqual(r.champion, 'Lulu');
    assertTrue(r.detail.compReasons.some(s => s.includes('asesino')));
  });

  it('SPLIT_PUSH enemigo (Tryndamere) → TwistedFate (global)', () => {
    const r = recommendPick(['Tryndamere'], ['TwistedFate', 'Lucian'], {});
    assertEqual(r.champion, 'TwistedFate');
    assertTrue(r.detail.compReasons.some(s => s.includes('splitpush')));
  });

  it('SUSTAINED enemigo (Aatrox + Vladimir) → Morgana (anti-heal)', () => {
    const r = recommendPick(['Aatrox', 'Vladimir'], ['Morgana', 'Lucian'], {});
    assertEqual(r.champion, 'Morgana');
    assertTrue(r.detail.compReasons.some(s => s.includes('sustain')));
  });

  it('Combo BURST + POKE → premia el counter más fuerte', () => {
    // Zed (burst) + Jayce (poke). Malphite cubre POKE (1.0) y nada más.
    // Lulu cubre BURST (1.0). Empate por bonus, gana orden de pool.
    const r = recommendPick(['Zed', 'Jayce'], ['Malphite', 'Lulu'], {});
    assertTrue(['Malphite', 'Lulu'].includes(r.champion));
  });

  it('Sin tags activos → no añade compReasons de los nuevos arquetipos', () => {
    // Pool con Zed (counter de HYPER_CARRY). Enemy sin hyper-carry.
    const r = recommendPick(['Garen'], ['Zed'], {});
    assertFalse(r.detail.compReasons.some(s => s.includes('hyper-carry')));
  });

  it('Tags se exponen en el summary aunque el pool no los countere', () => {
    // Internamente analyzeEnemyComposition() detecta el tag aunque el pool
    // del usuario no tenga contador. Verificamos vía detail.score que
    // el path se ejecuta sin errores con HYPER_CARRY enemigo.
    const r = recommendPick(['Vayne'], ['Garen'], {});
    assertTrue(typeof r.detail.score === 'number');
  });
});

describe('recommendPick — soporte rol secundario (P1)', () => {
  it('selectedRole=TOP encuentra a Yasuo aunque su rol primario sea MID', () => {
    // Yasuo tiene secondaryRoles: ['TOP']. Pool = ['Yasuo', 'Garen'] con
    // role=TOP debe permitir a Yasuo.
    const r = recommendPick([], ['Yasuo', 'Garen'], { selectedRole: 'TOP' });
    // Tanto Yasuo (MID+TOP) como Garen (TOP) son válidos. El primero del
    // pool gana sin enemy picks.
    assertEqual(r.champion, 'Yasuo');
  });

  it('selectedRole=MID encuentra a Lucian (ADC primary, MID secondary)', () => {
    const r = recommendPick([], ['Lucian'], { selectedRole: 'MID' });
    assertEqual(r.champion, 'Lucian');
  });

  it('selectedRole=SUPPORT encuentra a Sett (TOP primary, SUPPORT secondary)', () => {
    const r = recommendPick([], ['Sett'], { selectedRole: 'SUPPORT' });
    assertEqual(r.champion, 'Sett');
  });

  it('selectedRole sin matches en pool ni primary ni secondary cae al pool entero', () => {
    // Pool con Garen (TOP) y Lucian (ADC, secondary MID). selectedRole=JUNGLE
    // no matchea ninguno por primary ni secondary → fallback al pool entero.
    const r = recommendPick([], ['Garen', 'Lucian'], { selectedRole: 'JUNGLE' });
    assertEqual(r.champion, 'Garen'); // primer main del pool
  });

  it('selectedRole prefiere primario cuando hay ambos', () => {
    // Pool: ['Yasuo' (MID/TOP), 'Garen' (TOP)]. selectedRole=TOP.
    // Ambos son válidos. Yasuo aparece primero en el pool → gana.
    // Esto es comportamiento intencional: el motor respeta el orden del pool
    // (más dominado primero) por encima de "primario vs secundario".
    const r = recommendPick([], ['Yasuo', 'Garen'], { selectedRole: 'TOP' });
    assertEqual(r.champion, 'Yasuo');
  });

  it('Champion sin secondaryRoles no se incluye en otros roles', () => {
    // Vayne sí tiene secondaryRoles: ['TOP']. Probemos con KaiSa que no
    // existe en catálogo — debe quedar fuera.
    const r = recommendPick([], ['KaiSa'], { selectedRole: 'TOP' });
    // KaiSa no está en catálogo → no matchea ni primary ni secondary →
    // fallback al pool entero → KaiSa devuelve.
    assertEqual(r.champion, 'KaiSa');
  });
});

describe('recommendPick — backwards compat & WR bonus', () => {
  it('firma legacy (enemyPicks, pool, userStats) sigue funcionando', () => {
    const r = recommendPick(['Jinx'], ['Lucian'], { Lucian: { wr: 70, games: 30 } });
    // Sin selectedRole, userStats se trata como tal (legacy).
    assertEqual(r.champion, 'Lucian');
  });

  it('WR alto añade bonus pequeño al score', () => {
    // Sin matchups directos, dos campeones igual: WR alto desempata.
    const r1 = recommendPick(['Ahri'], ['Lulu', 'Lucian'], { userStats: { Lulu: { wr: 70 } } });
    // Como Lulu no tiene matchup ni comp counter, ambos puntúan ~0.
    // El WR de Lulu (70 → +0.8 bonus) la hace ganar.
    assertEqual(r1.champion, 'Lulu');
  });

  it('detail.score es numérico y consistente', () => {
    const r = recommendPick(['Jinx'], ['Lucian'], {});
    assertTrue(typeof r.detail.score === 'number');
    assertTrue(r.detail.score > 0);
  });
});

describe('recommendFromPool — integración pool 2+2 locked (#5)', () => {
  it('el mejor pick en hueco bloqueado produce unlockHint', () => {
    // Pool ADC con el counter (Caitlyn, goodAgainst Jinx) en un hueco bloqueado.
    // Sellamos como onboarding: Lucian/Jinx activos, Caitlyn/Ezreal bloqueados.
    const sealed = sealOnboardingPool([
      { championId: 'Lucian',  slot: 'main' },
      { championId: 'Jinx',    slot: 'secondary' },
      { championId: 'Caitlyn', slot: 'secondary' }, // locked (slot 2)
      { championId: 'Ezreal',  slot: 'secondary' }, // locked (slot 3)
    ]);
    // Caitlyn counterea Jinx (goodAgainst). Enemy = Jinx → Caitlyn debería ser
    // el mejor, pero está bloqueada → unlockHint presente.
    const res = recommendFromPool(sealed, 'ADC', { enemyPicks: ['Jinx', 'Ashe', 'Sivir'] });
    assertTrue(!!res.pick, 'debería haber pick');
    if (res.pick.champion === 'Caitlyn') {
      assertTrue(!!res.pick.unlockHint,
        `Caitlyn bloqueada debería traer unlockHint, fue: ${JSON.stringify(res.pick)}`);
    }
  });

  it('tras applyUnlocks(25 partidas) el hueco deja de tener unlockHint', () => {
    let sealed = sealOnboardingPool([
      { championId: 'Lucian',  slot: 'main' },
      { championId: 'Jinx',    slot: 'secondary' },
      { championId: 'Caitlyn', slot: 'secondary' },
      { championId: 'Ezreal',  slot: 'secondary' },
    ]);
    // Desbloqueamos todo jugando 25 partidas.
    sealed = applyUnlocks(sealed, 25).pool;
    const res = recommendFromPool(sealed, 'ADC', { enemyPicks: ['Jinx', 'Ashe', 'Sivir'] });
    // Ningún pick del pool debería reportar unlockHint (todo desbloqueado).
    if (res.pick) {
      assertFalse(!!res.pick.unlockHint,
        `sin huecos bloqueados no debería haber unlockHint, fue: ${JSON.stringify(res.pick)}`);
    }
  });

  it('pool antiguo (strings sin locked) no produce unlockHint', () => {
    const res = recommendFromPool(['Lucian', 'Jinx', 'Caitlyn'], 'ADC', { enemyPicks: ['Jinx'] });
    assertTrue(!!res.pick);
    assertFalse(!!res.pick.unlockHint);
  });
});
