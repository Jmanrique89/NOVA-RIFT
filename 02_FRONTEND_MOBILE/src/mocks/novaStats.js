// ============================================================================
// novaStats.js — Mock de estadísticas del usuario demo NovaRift#EUW
// ----------------------------------------------------------------------------
// Cubre los 3 modos del HubScreen (PERFIL · POOL · OFF-CHAMPION-POOL) y se
// apoya en investigación competitiva de rangos reales.
//
// Diferenciadores NOVA RIFT que el mock alimenta:
// Top 5 campeones con barra de WR coloreada por bucket.
// Pool 2+2 (2 main + 2 sec) como unidad de progreso RPG con maestría.
// Métrica destacada por facción (KDA Noxus, Visión Demacia, CS Ionia, WR Zaun).
// Off-pool con flag por match + cálculo agregado.
// Grade S+/S/A/B/C/D adoptado de deeplol.
// LP delta por partida + percentile dentro del rango.
//
// Cuando exista el backend (Riot Data Ingestion), sustituir por
// fetch(`/api/v1/stats/${riotId}`) manteniendo el mismo shape.
// ============================================================================

// ─── Pool oficial 2+2 — main vs secondary ────────────────────────────
// 2 main slots + 2 secondary slots = unidad de identidad de juego.
export const NOVA_POOL_2PLUS2 = {
  main: ['Lucian', 'Ezreal'],
  sec:  ['Jinx',   'Caitlyn'],
};
// Lista plana para compatibilidad con código que aún usa el pool flat
export const NOVA_POOL = [
  ...NOVA_POOL_2PLUS2.main,
  ...NOVA_POOL_2PLUS2.sec,
];

// ─── Maestría por campeón con progreso hacia el siguiente nivel ──────────────
// thresholds de Data Dragon (mastery 6→7 ≈ 21,600 pts; 5→6 ≈ 21,600).
export const NOVA_MASTERY = {
  Lucian:  { level: 7, points: 184_500, nextThreshold: 184_500, progressPct: 100 }, // M7 max
  Ezreal:  { level: 6, points:  18_400, nextThreshold:  21_600, progressPct: 85  },
  Jinx:    { level: 5, points:   9_300, nextThreshold:  21_600, progressPct: 43  },
  Caitlyn: { level: 4, points:   5_100, nextThreshold:  12_600, progressPct: 40  },
};

// ─── Match history — últimas 10 partidas ─────────────────────────────────────
// 7 in-pool + 3 off-champion-pool. Cada match incluye los campos del sistema:
// novaScore — 0-100 (sustituye al `grade` deeplol)
// position — 1-10 ranking del jugador en la partida
// gameps — KEY de GAMEPS_LABELS (MVP/ACE/RESILIENT/STRUGGLE…)
// fate — KEY de FATE (GODLIKE/SOLID/BALANCED/MESSY/FRUSTRATING)
// Mantienen lpDelta, visionScore, kp y resto de stats existentes.
export const NOVA_MATCHES = [
  {
    matchId:      'EUW1-6901234',
    championId:   236,
    championName: 'Lucian',
    result:       'W',
    kills:        8,  deaths: 2, assists: 4,
    cs:           210, durationMin: 32.5, cspm: 6.5, kda: 6.0,
    visionScore:  24, wardsPlaced: 11, kp: 71, gold: 13_400, damageToChamps: 28_500,
    doubleKills:  2, tripleKills: 0, quadraKills: 0, pentaKills: 0,
    novaScore:    78,
    position:     2,
    gameps:       'MVP',
    fate:         'SOLID',
    lpDelta:      18,
    gameMode:     'RANKED_SOLO',
  },
  {
    matchId:      'EUW1-6901233',
    championId:   81,
    championName: 'Ezreal',
    result:       'W',
    kills:        6,  deaths: 3, assists: 7,
    cs:           195, durationMin: 28.0, cspm: 7.0, kda: 4.3,
    visionScore:  19, wardsPlaced: 9, kp: 62, gold: 12_800, damageToChamps: 24_100,
    doubleKills:  1, tripleKills: 0, quadraKills: 0, pentaKills: 0,
    novaScore:    67,
    position:     3,
    gameps:       'VICTOR',
    fate:         'BALANCED',
    lpDelta:      16,
    gameMode:     'RANKED_SOLO',
  },
  {
    matchId:      'EUW1-6901232',
    championId:   222,
    championName: 'Jinx',
    result:       'L',
    kills:        4,  deaths: 6, assists: 3,
    cs:           180, durationMin: 35.0, cspm: 5.1, kda: 1.2,
    visionScore:  14, wardsPlaced: 6, kp: 41, gold: 10_900, damageToChamps: 18_200,
    doubleKills:  0, tripleKills: 0, quadraKills: 0, pentaKills: 0,
    novaScore:    42,
    position:     7,
    gameps:       'AVERAGE',
    fate:         'MESSY',
    lpDelta:      -14,
    gameMode:     'RANKED_SOLO',
  },
  {
    matchId:      'EUW1-6901231',
    championId:   236,
    championName: 'Lucian',
    result:       'W',
    kills:        10, deaths: 1, assists: 5,
    cs:           225, durationMin: 26.0, cspm: 8.7, kda: 15.0,
    visionScore:  22, wardsPlaced: 10, kp: 79, gold: 14_900, damageToChamps: 31_200,
    doubleKills:  1, tripleKills: 1, quadraKills: 0, pentaKills: 0,
    novaScore:    91,
    position:     1,
    gameps:       'ACE',
    fate:         'GODLIKE',
    lpDelta:      22,
    gameMode:     'RANKED_SOLO',
  },
  // ── Partida off-champion-pool: Tristana ────────────────────────────────────
  {
    matchId:      'EUW1-6901230',
    championId:   18,
    championName: 'Tristana',
    result:       'L',
    kills:        3,  deaths: 7, assists: 2,
    cs:           150, durationMin: 38.0, cspm: 3.9, kda: 0.7,
    visionScore:  10, wardsPlaced: 4, kp: 28, gold:  9_100, damageToChamps: 13_800,
    doubleKills:  0, tripleKills: 0, quadraKills: 0, pentaKills: 0,
    novaScore:    28,
    position:     9,
    gameps:       'DOWNFALL',
    fate:         'FRUSTRATING',
    lpDelta:      -19,
    gameMode:     'RANKED_SOLO',
    offPool:      true,
  },
  {
    matchId:      'EUW1-6901229',
    championId:   81,
    championName: 'Ezreal',
    result:       'W',
    kills:        7,  deaths: 2, assists: 9,
    cs:           205, durationMin: 30.0, cspm: 6.8, kda: 8.0,
    visionScore:  21, wardsPlaced: 10, kp: 73, gold: 13_100, damageToChamps: 26_400,
    doubleKills:  1, tripleKills: 1, quadraKills: 0, pentaKills: 0,
    novaScore:    84,
    position:     1,
    gameps:       'ACE',
    fate:         'SOLID',
    lpDelta:      19,
    gameMode:     'RANKED_SOLO',
  },
  {
    matchId:      'EUW1-6901228',
    championId:   222,
    championName: 'Jinx',
    result:       'W',
    kills:        9,  deaths: 3, assists: 6,
    cs:           220, durationMin: 31.0, cspm: 7.1, kda: 5.0,
    visionScore:  17, wardsPlaced: 8, kp: 65, gold: 13_700, damageToChamps: 27_200,
    doubleKills:  2, tripleKills: 1, quadraKills: 0, pentaKills: 0,
    novaScore:    72,
    position:     2,
    gameps:       'MVP',
    fate:         'GODLIKE',
    lpDelta:      17,
    gameMode:     'RANKED_SOLO',
  },
  // ── Partida off-champion-pool: Vayne ───────────────────────────────────────
  {
    matchId:      'EUW1-6901227',
    championId:   67,
    championName: 'Vayne',
    result:       'L',
    kills:        2,  deaths: 8, assists: 1,
    cs:           130, durationMin: 40.0, cspm: 3.3, kda: 0.4,
    visionScore:   8, wardsPlaced: 3, kp: 22, gold:  8_200, damageToChamps: 11_400,
    doubleKills:  0, tripleKills: 0, quadraKills: 0, pentaKills: 0,
    novaScore:    18,
    position:     10,
    gameps:       'DOWNFALL',
    fate:         'FRUSTRATING',
    lpDelta:      -22,
    gameMode:     'RANKED_SOLO',
    offPool:      true,
  },
  {
    matchId:      'EUW1-6901226',
    championId:   236,
    championName: 'Lucian',
    result:       'W',
    kills:        11, deaths: 2, assists: 4,
    cs:           235, durationMin: 27.0, cspm: 8.7, kda: 7.5,
    visionScore:  20, wardsPlaced: 9, kp: 68, gold: 14_500, damageToChamps: 29_800,
    doubleKills:  1, tripleKills: 0, quadraKills: 1, pentaKills: 0,
    novaScore:    87,
    position:     1,
    gameps:       'ACE',
    fate:         'SOLID',
    lpDelta:      18,
    gameMode:     'RANKED_SOLO',
  },
  // ── Partida off-champion-pool: MissFortune ─────────────────────────────────
  {
    matchId:      'EUW1-6901225',
    championId:   21,
    championName: 'MissFortune',
    result:       'L',
    kills:        5,  deaths: 6, assists: 4,
    cs:           160, durationMin: 36.0, cspm: 4.4, kda: 1.5,
    visionScore:  12, wardsPlaced: 5, kp: 46, gold: 10_200, damageToChamps: 17_900,
    doubleKills:  1, tripleKills: 0, quadraKills: 0, pentaKills: 0,
    novaScore:    54,
    position:     5,
    gameps:       'RESILIENT',
    fate:         'MESSY',
    lpDelta:      -16,
    gameMode:     'RANKED_SOLO',
    offPool:      true,
  },
];

// ─── Match details (TAREA 2) ─────────────────────────────────────────────
// Cada partida del historial expande en HubScreen tab PERFIL para mostrar la
// tarjeta tipo op.gg con los 10 jugadores, KDA, CS, daño e ítems.
//
// En vez de hand-craftear 10×80 líneas de objetos, generamos los detalles de
// forma determinista por `matchId`: 4 plantillas de team comp, una per-match
// según hash, e inyectamos los datos REALES de NovaRift (campeón/KDA/CS/daño)
// en el slot ADC del equipo azul. NovaRift siempre va en blueTeam con isUser=true.
// blueTeam gana ↔ result === 'W'.
//
// Cuando exista el backend (post-TFG), el endpoint match-v5 devolverá los
// 10 jugadores reales — basta con sustituir la generación por el fetch.

const SUMMONER_NAMES = {
  TOP:      ['FrostKing',     'IronWall',    'TopLaneAce',  'BlueShield',  'StoneFist'],
  JUNGLE:   ['ShadowJG',      'NightHunter', 'JunglAce',    'WildClaw',    'RiverWolf'],
  MID:      ['MidLaneGod',    'SoloLane',    'PixelMage',   'CrystalArc',  'StormPath'],
  ADC:      ['BotLaneDPS',    'CritMaster',  'LongRange',   'Marksman9',   'KitedYou'],
  SUPPORT:  ['VisionBot',     'WardWizard',  'SuppCarry',   'ShieldMaiden','Engager99'],
};

// Item builds canónicos por rol como IDs numéricos de Data
// Dragon. Cada slot 0 = vacío, ID > 0 = ítem real. MatchExpandedPanel renderiza
// `getItemImageUrl(id)` por cada ID > 0. Builds realistas patch 16.x.
const ITEMS_BY_ROLE = {
  TOP: [
    [3078, 3742, 3071, 3047, 3053, 0],   // Trinity / Dead Man / Cleaver / Steelcaps / Sterak's
    [6630, 3071, 6333, 3111, 3133, 0],   // Goredrinker / Cleaver / Death's Dance / Mercury / Phage
    [6665, 3068, 3193, 3111, 3082, 0],   // Jak'Sho / Sunfire / Gargoyle / Mercury / Warden
  ],
  JUNGLE: [
    [3078, 3742, 3071, 3111, 1037, 0],   // Trinity / Dead Man / Cleaver / Mercury / Long Sword
    [6630, 3071, 6333, 3111, 3133, 0],   // Goredrinker / Cleaver / Death's Dance / Mercury / Phage
    [6665, 3068, 4637, 3111, 1028, 0],   // Jak'Sho / Sunfire / Demonic / Mercury / Ruby Crystal
  ],
  MID: [
    [6653, 3165, 3157, 3020, 3108, 0],   // Liandry / Morello / Zhonya / Sorcerer / Lost Chapter
    [6655, 3089, 4645, 3020, 1058, 0],   // Luden / Rabadon / Shadowflame / Sorcerer / Needlessly
    [3147, 3814, 3156, 3158, 1037, 0],   // Duskblade / Edge of Night / Maw / Ionian / Long Sword
  ],
  ADC: [
    [3031, 6672, 3094, 3006, 3046, 0],   // Infinity / Kraken / Runaan / Berserker / Phantom
    [6671, 3031, 3094, 3006, 3046, 0],   // Galeforce / Infinity / Runaan / Berserker / Phantom
    [3071, 3031, 3036, 3006, 1037, 0],   // Cleaver / Infinity / Lord Dominik / Berserker / Long Sword
  ],
  SUPPORT: [
    [4005, 3190, 3109, 3117, 3108, 0],   // Imperial Mandate / Locket / Knight's Vow / Mobility / Lost Chapter
    [6655, 4645, 3089, 3020, 1058, 0],   // Luden / Shadowflame / Rabadon / Sorcerer / Needlessly
    [3190, 3107, 3222, 3117, 3801, 0],   // Locket / Redemption / Mikael / Mobility / Crystalline
  ],
};

// 4 plantillas de team comp para variedad — el ADC del equipo azul lo
// reemplazamos por NovaRift antes de devolver el matchDetails.
const TEAM_TEMPLATES = [
  {
    blue: [
      { role: 'TOP',     champion: 'Ornn',   itemSet: 0 },
      { role: 'JUNGLE',  champion: 'Vi',     itemSet: 0 },
      { role: 'MID',     champion: 'Ryze',   itemSet: 0 },
      { role: 'ADC',     champion: '$USER$', itemSet: 0 },
      { role: 'SUPPORT', champion: 'Thresh', itemSet: 0 },
    ],
    red: [
      { role: 'TOP',     champion: 'Garen',   itemSet: 1 },
      { role: 'JUNGLE',  champion: 'LeeSin',  itemSet: 1 },
      { role: 'MID',     champion: 'Zed',     itemSet: 2 },
      { role: 'ADC',     champion: 'Lucian',  itemSet: 1 },
      { role: 'SUPPORT', champion: 'Morgana', itemSet: 1 },
    ],
  },
  {
    blue: [
      { role: 'TOP',     champion: 'Camille',  itemSet: 1 },
      { role: 'JUNGLE',  champion: 'Graves',   itemSet: 1 },
      { role: 'MID',     champion: 'Sylas',    itemSet: 2 },
      { role: 'ADC',     champion: '$USER$',   itemSet: 1 },
      { role: 'SUPPORT', champion: 'Nautilus', itemSet: 0 },
    ],
    red: [
      { role: 'TOP',     champion: 'Aatrox',   itemSet: 2 },
      { role: 'JUNGLE',  champion: 'Nidalee',  itemSet: 0 },
      { role: 'MID',     champion: 'Ahri',     itemSet: 1 },
      { role: 'ADC',     champion: 'Caitlyn',  itemSet: 0 },
      { role: 'SUPPORT', champion: 'Lulu',     itemSet: 2 },
    ],
  },
  {
    blue: [
      { role: 'TOP',     champion: 'KSante',   itemSet: 2 },
      { role: 'JUNGLE',  champion: 'Sejuani',  itemSet: 2 },
      { role: 'MID',     champion: 'Orianna',  itemSet: 1 },
      { role: 'ADC',     champion: '$USER$',   itemSet: 2 },
      { role: 'SUPPORT', champion: 'Karma',    itemSet: 1 },
    ],
    red: [
      { role: 'TOP',     champion: 'Renekton',  itemSet: 0 },
      { role: 'JUNGLE',  champion: 'JarvanIV',  itemSet: 1 },
      { role: 'MID',     champion: 'Akshan',    itemSet: 2 },
      { role: 'ADC',     champion: 'Jhin',      itemSet: 2 },
      { role: 'SUPPORT', champion: 'Yuumi',     itemSet: 0 },
    ],
  },
  {
    blue: [
      { role: 'TOP',     champion: 'Malphite', itemSet: 0 },
      { role: 'JUNGLE',  champion: 'Hecarim', itemSet: 1 },
      { role: 'MID',     champion: 'Galio',    itemSet: 0 },
      { role: 'ADC',     champion: '$USER$',   itemSet: 0 },
      { role: 'SUPPORT', champion: 'Leona',    itemSet: 2 },
    ],
    red: [
      { role: 'TOP',     champion: 'Jax',        itemSet: 0 },
      { role: 'JUNGLE',  champion: 'MasterYi',   itemSet: 2 },
      { role: 'MID',     champion: 'Diana',      itemSet: 0 },
      { role: 'ADC',     champion: 'KaiSa',      itemSet: 1 },
      { role: 'SUPPORT', champion: 'Senna',      itemSet: 2 },
    ],
  },
];

// Hash determinista — devuelve la misma plantilla siempre que matchId no cambie.
function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function pseudoRandom(seed) {
  // LCG ligero — determinista per-seed
  let v = seed % 2147483647;
  return () => {
    v = (v * 16807) % 2147483647;
    return v / 2147483647;
  };
}

// Hechizos de invocador plausibles por rol (Flash siempre + un secundario).
const SPELLS_BY_ROLE = {
  TOP:     ['Flash', 'Teleport'],
  JUNGLE:  ['Flash', 'Smite'],
  MID:     ['Flash', 'Ignite'],
  ADC:     ['Flash', 'Heal'],
  SUPPORT: ['Flash', 'Ignite'],
};

// Keystone plausible por rol (claves que entiende getRuneImageUrl).
const RUNE_BY_ROLE = {
  TOP:     'Conqueror',
  JUNGLE:  'Electrocute',
  MID:     'Electrocute',
  ADC:     'LethalTempo',
  SUPPORT: 'Guardian',
};

// Glifos de objetivo (mismos que pinta MatchExpandedPanel).
const OBJECTIVE_GLYPHS = { dragon: '🐉', herald: '👁', baron: '🟣', tower: '🗼' };

// Orden cronológico de objetivos (estilo op.gg): combina los objetivos de ambos
// equipos en una línea temporal determinista, con minutos plausibles por tipo
// (heralds pronto, barones tarde, dragones repartidos). Ordenada por minuto.
function buildObjectiveOrder(blueObj, redObj, dur, rng) {
  const events = [];
  const add = (team, type, count, tMin, tMax) => {
    for (let i = 0; i < (count || 0); i++) {
      const span = Math.max(1, tMax - tMin);
      const minute = Math.max(1, Math.min(Math.round(dur), Math.round(tMin + rng() * span)));
      events.push({ team, type, glyph: OBJECTIVE_GLYPHS[type], minute });
    }
  };
  [['blue', blueObj], ['red', redObj]].forEach(([team, o]) => {
    if (!o) return;
    add(team, 'herald', o.herald,  8, 14);
    add(team, 'dragon', o.dragons, 5, Math.min(32, dur));
    add(team, 'baron',  o.baron,  20, Math.max(22, dur));
    add(team, 'tower',  o.towers,  6, dur);
  });
  // Ordenada por minuto; cap a 12 hitos para que la tira no se desborde.
  return events.sort((a, b) => a.minute - b.minute).slice(0, 12);
}

// Objetivos de equipo plausibles. El equipo ganador sesga más alto (más
// dragones/heralds/barones/torres), espejando el patrón de isWinner de fillSlot.
function buildObjectives(isWinner, rng) {
  if (isWinner) {
    return {
      dragons: Math.floor(2 + rng() * 3), // 2-4
      herald:  rng() < 0.7 ? 1 : 0,
      baron:   rng() < 0.6 ? 1 : 0,
      towers:  Math.floor(6 + rng() * 6), // 6-11
    };
  }
  return {
    dragons: Math.floor(0 + rng() * 3),   // 0-2
    herald:  rng() < 0.4 ? 1 : 0,
    baron:   rng() < 0.2 ? 1 : 0,
    towers:  Math.floor(0 + rng() * 6),   // 0-5
  };
}

// Genera stats plausibles para un slot dado (KDA + CS + damage), respetando
// si el equipo ganó o perdió (ganador suele tener mejor KDA).
function fillSlot(slot, durationMin, isWinner, rng) {
  const base = isWinner
    ? { kMin: 4, kMax: 9,  dMin: 1, dMax: 4, aMin: 4, aMax: 11 }
    : { kMin: 1, kMax: 6,  dMin: 3, dMax: 8, aMin: 1, aMax: 6  };

  const k = Math.floor(base.kMin + rng() * (base.kMax - base.kMin + 1));
  const d = Math.floor(base.dMin + rng() * (base.dMax - base.dMin + 1));
  const a = Math.floor(base.aMin + rng() * (base.aMax - base.aMin + 1));

  // CS por rol (support muy bajo, ADC/MID alto, JUNGLE medio).
  const csByRole = {
    TOP:     [140, 200],
    JUNGLE:  [80,  130],
    MID:     [180, 230],
    ADC:     [160, 230],
    SUPPORT: [15,  35],
  };
  const [csMin, csMax] = csByRole[slot.role] || [100, 200];
  const cs = Math.floor(csMin + rng() * (csMax - csMin + 1));

  // Damage proporcional a kills+assists, mid es alto, support bajo.
  const dmgFactor = slot.role === 'SUPPORT' ? 0.45 : slot.role === 'ADC' ? 1.3 : 1.0;
  const damage = Math.floor((8000 + (k + a) * 1800 + rng() * 4000) * dmgFactor);

  // Oro de la partida — proporcional a CS, kills/asistencias y duración.
  const gold = Math.floor(cs * 110 + (k + a) * 320 + durationMin * 120 + rng() * 1400 + 500);

  const itemSet = ITEMS_BY_ROLE[slot.role][slot.itemSet % ITEMS_BY_ROLE[slot.role].length];

  return {
    kda:    `${k}/${d}/${a}`,
    cs,
    damage,
    gold,
    items:  itemSet,
    role:           slot.role,
    summonerSpells: SPELLS_BY_ROLE[slot.role] || ['Flash', 'Ignite'],
    primaryRune:    RUNE_BY_ROLE[slot.role] || 'Electrocute',
  };
}

// Genera el detalle op.gg completo (10 jugadores, objetivos, oro, runas, orden
// de objetivos) de CUALQUIER partida con el shape base de novaStats. Es PURO y
// determinista por `matchId` (mismo matchId → mismo detalle). Exportado para que
// el mapeo de partidas REALES del backend (HubScreen.mapRealMatches) pueda
// rellenar `matchDetails` en lugar de dejarlo en null — así el panel rico se
// pinta SIEMPRE al desplegar una partida, sea mock o real (C2).
export function buildMatchDetails(match) {
  const seed = hashStr(match.matchId || match.championName || 'seed');
  const rng  = pseudoRandom(seed);
  const tpl  = TEAM_TEMPLATES[seed % TEAM_TEMPLATES.length];
  const userWins = match.result === 'W' || match.result === 'WIN';
  const dur = match.durationMin || 30;

  // Si NovaRift jugó un campeón que ya está en el equipo rojo de la plantilla,
  // sustituimos al ADC enemigo por otro alternativo para que no aparezca el
  // mismo champion en ambos equipos. CLON local (no mutamos `tpl.red`, que es
  // una referencia compartida del módulo): al reutilizar buildMatchDetails con
  // muchas partidas, mutar la plantilla la contaminaría entre partidas.
  const ALT_ADCS = ['Caitlyn', 'Jhin', 'KaiSa', 'Sivir', 'Xayah', 'Samira'];
  const redSlots = tpl.red.map((s) =>
    (s.role === 'ADC' && s.champion === match.championName)
      ? { ...s, champion: ALT_ADCS.find((c) => c !== match.championName) || 'Caitlyn' }
      : s
  );

  const buildTeam = (slots, isWinner, nameOffset) => slots.map((slot, i) => {
    if (slot.champion === '$USER$') {
      // Slot del usuario — datos REALES de la partida.
      const items = ITEMS_BY_ROLE.ADC[slot.itemSet] || ITEMS_BY_ROLE.ADC[0];
      return {
        summonerName: 'NovaRift',
        champion:     match.championName,
        kda:          `${match.kills}/${match.deaths}/${match.assists}`,
        cs:           match.cs,
        damage:       match.damageToChamps || Math.floor(match.cs * 130 + match.kills * 1800),
        gold:         match.gold || Math.floor(match.cs * 115 + (match.kills + match.assists) * 320 + dur * 120 + 500),
        items,
        isUser:       true,
        role:           slot.role,
        summonerSpells: ['Flash', 'Heal'],
        primaryRune:    'LethalTempo',
      };
    }
    const pool  = SUMMONER_NAMES[slot.role];
    const fill  = fillSlot(slot, dur, isWinner, rng);
    return {
      summonerName: pool[(i + nameOffset) % pool.length],
      champion:     slot.champion,
      kda:          fill.kda,
      cs:           fill.cs,
      damage:       fill.damage,
      gold:         fill.gold,
      items:        fill.items,
      isUser:       false,
      role:           fill.role,
      summonerSpells: fill.summonerSpells,
      primaryRune:    fill.primaryRune,
    };
  });

  const blueWins = userWins;
  const redWins  = !userWins;
  // Oro total por equipo: el ganador va ligeramente por delante. Base ~55k.
  const blueGold = Math.floor(48000 + (blueWins ? 9000 : 0) + rng() * 8000);
  const redGold  = Math.floor(48000 + (redWins  ? 9000 : 0) + rng() * 8000);

  const blueObjectives = buildObjectives(blueWins, rng);
  const redObjectives  = buildObjectives(redWins,  rng);

  return {
    blueTeam: buildTeam(tpl.blue, userWins,  0),
    redTeam:  buildTeam(redSlots, !userWins, 2 + (seed % 3)), // offset distinto para evitar duplicados
    blueObjectives,
    redObjectives,
    blueGold,
    redGold,
    // Línea temporal de objetivos (estilo op.gg) para la pestaña ANÁLISIS.
    objectiveOrder: buildObjectiveOrder(blueObjectives, redObjectives, dur, rng),
  };
}

// Inyectamos `matchDetails` en cada partida una sola vez al cargar el módulo.
// Mutación local — el array vive aquí y no se exporta como inmutable.
NOVA_MATCHES.forEach(m => { m.matchDetails = buildMatchDetails(m); });

// ─── CS/min canónico — UNA métrica = UN valor en toda la app ─────────────────
// Único punto donde se define "CS/min": la media del cspm por partida sobre el
// set dado, redondeada a 1 decimal (mismo criterio que el agregado real del Hub,
// HubScreen.realAgg). Lo consumen ForgeScreen, HubScreen y el KPI para que el
// CS/min NO diverja entre Perfil y Forge (antes: literal mock 6.2 en Forge/pill
// vs media real de las partidas, ~6.1, en el widget KPI).
//
// @param {Array} matches partidas con `cspm` (o `csPerMin`).
// @param {number|null} [fallback=null] valor si no hay partidas con CS válido.
export function avgCsPerMin(matches, fallback = null) {
  const vals = (Array.isArray(matches) ? matches : [])
    .map((m) => Number(m?.cspm ?? m?.csPerMin))
    .filter((v) => Number.isFinite(v) && v > 0);
  if (vals.length === 0) return fallback;
  return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
}

// ─── CS/min canónico de SESIÓN — una métrica = un valor entre pantallas ──────
// El Perfil (HubScreen) es quien tiene el set de partidas autoritativo de la
// cuenta activa (mock NovaRift en demo, o las reales de Riot). Publica aquí su
// CS/min ya calculado con `avgCsPerMin`, y ForgeScreen lo LEE como fuente única
// en vez de promediar su propio set (que en cuentas reales no ve las partidas de
// Riot y caía al mock). Así el CS/min COINCIDE entre Perfil y Elo Forge (C3).
// Caché de proceso (mismo patrón que utils/effectivePool): vive mientras la app
// está abierta y se sobreescribe en cada render del Perfil.
let _profileCsPerMin = null;

/** Publica el CS/min canónico del Perfil (lo llama HubScreen en cada render). */
export function publishProfileCsPerMin(value) {
  if (Number.isFinite(value) && value > 0) _profileCsPerMin = value;
}

/** Lee el CS/min publicado por el Perfil. null si el Perfil aún no lo publicó. */
export function readProfileCsPerMin() {
  return _profileCsPerMin;
}

// CS/min de la cuenta demo (NovaRift) DERIVADO de las MISMAS 10 partidas que
// alimentan el historial — no un literal hand-typed que pueda divergir del dato.
export const NOVA_AVG_CSPM = avgCsPerMin(NOVA_MATCHES, 6.2);

// ─── Stats globales — calculadas sobre las 10 partidas ───────────────────────
// Wins 6 / Losses 4 → WR 60%
// LP neto últimos 10 partidos: +18+16-14+22-19+19+17-22+18-16 = +39
export const NOVA_GLOBAL_STATS = {
  profileIconId: 4568,
  winrate:     60,
  avgKDA:      5.0,
  // Derivado de NOVA_MATCHES vía el helper canónico (no un literal): una métrica
  // = un valor. Si cambian las partidas, este CS/min se recalcula solo.
  avgCSPM:     NOVA_AVG_CSPM,
  avgVision:   16.7,
  avgKP:       55.5,
  rank: {
    tier:        'GOLD',
    division:    'II',
    lp:          47,
    lpToNext:    100,
    percentile:  23,            // top 23% del rango Gold
    lpNetLast10: 39,            // LP neto últimos 10 partidos
  },
  // Peak histórico (P-I) — pico de todas las temporadas. Sirve de motivación
  // y de referencia "tu nivel de élite cuando mejor jugaste".
  peakRank: {
    tier:     'PLATINUM',
    division: '2',
    lp:       82,
    season:   'S15',
  },
  // Ladder rank absoluto (P-K) — posición global en EUW. El percentile aquí
  // es del servidor entero, no solo del rango.
  ladder: {
    rank:       882_826,
    percentile: 33.54,
  },
  gamesPlayed: 10,
  wins:        6,
  losses:      4,
};

// ─── Top 5 campeones más jugados (ranking por games · WR%) ───────────────────
// Lucian : 3W/3G = 100% · avgKDA 9.5 · M7
// Ezreal : 2W/2G = 100% · avgKDA 6.2 · M6
// Jinx : 1W/2G = 50% · avgKDA 3.1 · M5
// Caitlyn: 0G en últimos 10 partidos pero histórico (mock) → 8G 50% M4
// Tristana: 0W/1G off-pool → 1G 0% M3
export const NOVA_TOP_CHAMPIONS = [
  { championId: 236, championName: 'Lucian',   winrate: 100, games: 3, avgKDA: 9.5, avgCSPM: 7.6, mastery: 7, slot: 'main' },
  { championId:  81, championName: 'Ezreal',   winrate: 100, games: 2, avgKDA: 6.2, avgCSPM: 6.9, mastery: 6, slot: 'main' },
  { championId: 222, championName: 'Jinx',     winrate:  50, games: 2, avgKDA: 3.1, avgCSPM: 6.1, mastery: 5, slot: 'sec'  },
  { championId:  51, championName: 'Caitlyn',  winrate:  62, games: 8, avgKDA: 4.2, avgCSPM: 7.2, mastery: 4, slot: 'sec'  },
  { championId:  18, championName: 'Tristana', winrate:   0, games: 1, avgKDA: 0.7, avgCSPM: 3.9, mastery: 3, slot: null   },
];

// ─── Pool 2+2 detallado (consumido por el modo POOL del Hub) ─────────────────
// Cada slot tiene su WR%, mastery con progreso, y la métrica destacada
// pre-calculada (no se calcula en el render — viene del mock).
export const NOVA_POOL_DETAIL = [
  {
    championId:   236,
    championName: 'Lucian',
    slot:         'main',
    winrate:      100,
    games:        3,
    avgKDA:       9.5,
    avgCSPM:      7.6,
    avgVision:    22.0,
    mastery:      NOVA_MASTERY.Lucian,
  },
  {
    championId:   81,
    championName: 'Ezreal',
    slot:         'main',
    winrate:      100,
    games:        2,
    avgKDA:       6.2,
    avgCSPM:      6.9,
    avgVision:    20.0,
    mastery:      NOVA_MASTERY.Ezreal,
  },
  {
    championId:   222,
    championName: 'Jinx',
    slot:         'sec',
    winrate:      50,
    games:        2,
    avgKDA:       3.1,
    avgCSPM:      6.1,
    avgVision:    15.5,
    mastery:      NOVA_MASTERY.Jinx,
  },
  {
    championId:   51,
    championName: 'Caitlyn',
    slot:         'sec',
    winrate:      62,
    games:        8,
    avgKDA:       4.2,
    avgCSPM:      7.2,
    avgVision:    18.0,
    mastery:      NOVA_MASTERY.Caitlyn,
  },
];

// ─── Stats por campeón del pool (alias de compatibilidad) ────────────────────
// HubScreen.js antiguo consume `championPool` con shape simple. Mantenemos
// el alias para no romper código que aún no se ha migrado.
export const NOVA_CHAMPION_POOL = NOVA_POOL_DETAIL.map(c => ({
  championId:   c.championId,
  championName: c.championName,
  winrate:      c.winrate,
  games:        c.games,
  avgKDA:       c.avgKDA,
  mastery:      c.mastery.level,
}));

// ─── Métrica destacada por facción ───────────────────────────────────
// HubScreen consulta este mapa para decidir qué KPI rendir grande en MI POOL.
//
// Cada entry:
// key — campo a leer del pool detail (avgKDA / avgCSPM / avgVision / winrate)
// label — etiqueta que se muestra
// suffix — unidad ("KDA", "CS/min", "Vis", "%")
// color — opcional, si quieres color distinto al theme.primary
export const FACTION_HERO_METRIC = {
  ZAUN:    { key: 'winrate',   label: 'WR',          suffix: '%',     wrap: v => `${v}%` },
  NOXUS:   { key: 'avgKDA',    label: 'KDA',         suffix: 'KDA',   wrap: v => v.toFixed(1) },
  IONIA:   { key: 'avgCSPM',   label: 'CS/min',      suffix: 'CS/m',  wrap: v => v.toFixed(1) },
  DEMACIA: { key: 'avgVision', label: 'Visión',      suffix: 'Vis',   wrap: v => v.toFixed(1) },
};

// ─── Grade color map (deeplol.gg) ────────────────────────────────────────────
export const GRADE_COLOR = {
  'S+': '#A45EE5',
  'S':  '#FFD700',
  'A':  '#4CAF50',
  'B':  '#5383E8',
  'C':  '#FFC107',
  'D':  '#FF5252',
};

// ─── Shape completa del endpoint (exportación principal) ─────────────────────
const NOVA_STATS = {
  riotId:       'NovaRift#EUW',
  faction:      'ZAUN',
  role:         'ADC',
  pool:         NOVA_POOL,
  pool2plus2:   NOVA_POOL_2PLUS2,
  poolDetail:   NOVA_POOL_DETAIL,
  globalStats:  NOVA_GLOBAL_STATS,
  matches:      NOVA_MATCHES,
  championPool: NOVA_CHAMPION_POOL,
  topChampions: NOVA_TOP_CHAMPIONS,
  mastery:      NOVA_MASTERY,
};

// ─── Remapeo del mock al champion pool REAL del usuario (T4) ──────────────────
// Cuando el usuario registra su propio pool (p.ej. Garen/Malphite), el historial
// y el pool del HubScreen deben mostrar SUS campeones, no los ADC del mock demo.
// Función pura y determinista: sustituye los campeones on-pool del mock por los
// del pool real (preservando toda la riqueza — matchDetails op.gg, novaScore,
// maestría…) y recalcula el flag offPool. Las partidas off-pool del mock
// conservan un campeón FUERA del pool para que la comparativa on/off siga viva.
//
// @param {string[]} poolNames nombres del pool real del usuario (ya aplanado)
// @returns {{matches, poolDetail, topChampions, championPool}|null} null si no hay pool
export function remapNovaToPool(poolNames) {
  const pool = Array.from(new Set((poolNames || []).filter(Boolean)));
  if (pool.length === 0) return null;

  // Slots canónicos del mock (Lucian/Ezreal/Jinx/Caitlyn) → pool real, en orden.
  const slotMap = {};
  NOVA_POOL_DETAIL.forEach((c, i) => { slotMap[c.championName] = pool[i % pool.length]; });
  const mapName = (name) => slotMap[name] || pool[0];

  // Campeón off-pool de respaldo: el primero que NO esté en el pool del usuario.
  const OFF_FALLBACKS = ['Tristana', 'Vayne', 'MissFortune', 'Samira', 'Zeri', 'Smolder'];
  const offChamp = OFF_FALLBACKS.find((c) => !pool.includes(c)) || 'Tristana';

  const matches = NOVA_MATCHES.map((m) => {
    const remapped = { ...m };
    if (m.offPool) {
      remapped.championName = pool.includes(m.championName) ? offChamp : m.championName;
      remapped.offPool = true;
    } else {
      remapped.championName = mapName(m.championName);
      remapped.offPool = false;
    }
    remapped.matchDetails = buildMatchDetails(remapped); // detalle op.gg con el nuevo champ
    return remapped;
  });

  // Pool 2+2 → primeros N del pool real. Conservamos championId/championName/slot,
  // pero ANULAMOS las stats derivadas del mock (winrate/games/KDA/CSPM/visión/maestría):
  // el usuario onboarded aún no tiene partidas propias, así que heredarlas pintaría
  // stats fantasma (p.ej. el 100% WR / M7 / 9.5 KDA de Lucian sobre su campeón).
  // Con null, el Hub muestra un estado vacío honesto ("Sin partidas todavía").
  const poolDetail = NOVA_POOL_DETAIL.map((entry, i) => ({
    ...entry,
    championName: pool[i % pool.length],
    winrate:   null,
    games:     null,
    avgKDA:    null,
    avgCSPM:   null,
    avgVision: null,
    mastery:   null,
  }));

  const topChampions = NOVA_TOP_CHAMPIONS.map((c) => ({
    ...c,
    championName: c.slot ? mapName(c.championName) : offChamp,
  }));

  // championPool hereda los null de poolDetail: sin partidas propias todavía,
  // el Hub no debe mostrar winrate/games/KDA/maestría fantasma.
  const championPool = poolDetail.map((c) => ({
    championId:   c.championId,
    championName: c.championName,
    winrate:      null,
    games:        null,
    avgKDA:       null,
    mastery:      null,
  }));

  return { matches, poolDetail, topChampions, championPool };
}

export default NOVA_STATS;
