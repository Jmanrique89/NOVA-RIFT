// ============================================================================
// itemBuilds.js — Builds de ítems estilo op.gg / u.gg (datos MOCK)
// ----------------------------------------------------------------------------
// P2-2. Para cada campeón (y rol) definimos 2-3 BUILDS alternativas. Cada build
// tiene:
//   • name        → etiqueta legible ("Crit Estándar", "On-Hit"…).
//   • winrate     → % de victorias MOCK (estilo op.gg, 48-55%).
//   • pickrate    → % de elección MOCK (qué porcentaje de jugadores la usa).
//   • core        → NÚCLEO de 3 ítems (lo que define la build).
//   • alternatives→ ítems situacionales que se intercambian según la partida.
//
// Cada ítem es { id, name, cost } donde `id` es el id de Data Dragon (para
// pintar el icono con getItemImageUrl) y `cost` el oro aproximado.
//
// IMPORTANTE: son datos de demostración (no hay backend de meta-stats todavía).
// La UI (InGameHUD → ItemShop) los muestra ordenados por winrate y permite
// "Priorizar" una build para fijarla arriba.
//
// `getBuildsForChampion(champion, role)` SIEMPRE devuelve un array no vacío:
// busca por campeón → por (campeón sin rol) → genérica por rol → genérica.
// ============================================================================

// ── Builds por campeón ──────────────────────────────────────────────
// Clave: nombre del campeón (id de Data Dragon, sin espacios). Valor: mapa
// rol → lista de builds. La mayoría de campeones juegan un solo rol, pero el
// mapa por rol deja la puerta abierta a flex picks (p. ej. un Garen TOP/MID).
export const ITEM_BUILDS = {
  // ─── ADC ────────────────────────────────────────────────────────────────
  Jinx: {
    ADC: [
      {
        id: 'jinx-crit', name: 'Crit Estándar', winrate: 53.4, pickrate: 64.2,
        // Ejemplo literal de la especificación: cada ítem del núcleo lleva sus
        // COMPONENTES (pieza + coste). El resto de ítems del juego resuelven sus
        // componentes vía ITEM_COMPONENTS / getItemComponents (más abajo), así
        // que TODO ítem de core/alternatives tiene componentes disponibles.
        core: [
          { id: 6672, name: 'Kraken Slayer',      cost: 3100, components: [
            { id: 1038, name: 'B.F. Sword',       cost: 1300 },
            { id: 1043, name: 'Recurve Bow',      cost: 1000 },
            { id: 1018, name: 'Cloak of Agility', cost: 600 },
          ] },
          { id: 3031, name: 'Infinity Edge',      cost: 3400, components: [
            { id: 1038, name: 'B.F. Sword',       cost: 1300 },
            { id: 1037, name: 'Pickaxe',          cost: 875 },
            { id: 1018, name: 'Cloak of Agility', cost: 600 },
          ] },
          { id: 3085, name: "Runaan's Hurricane", cost: 2600, components: [
            { id: 1043, name: 'Recurve Bow',      cost: 1000 },
            { id: 3086, name: 'Zeal',             cost: 1100 },
            { id: 1042, name: 'Dagger',           cost: 300 },
          ] },
        ],
        alternatives: [
          { id: 3072, name: 'Bloodthirster',       cost: 3400 },
          { id: 3036, name: "Lord Dominik's Regards", cost: 3000 },
        ],
      },
      {
        id: 'jinx-shieldbow', name: 'Shieldbow Seguro', winrate: 51.6, pickrate: 23.8,
        core: [
          { id: 6673, name: 'Immortal Shieldbow', cost: 3400 },
          { id: 3031, name: 'Infinity Edge',      cost: 3400 },
          { id: 3094, name: 'Rapid Firecannon',   cost: 2500 },
        ],
        alternatives: [
          { id: 3046, name: 'Phantom Dancer',      cost: 2600 },
          { id: 3072, name: 'Bloodthirster',       cost: 3400 },
        ],
      },
      {
        id: 'jinx-onhit', name: 'On-Hit', winrate: 49.9, pickrate: 11.0,
        core: [
          { id: 6672, name: 'Kraken Slayer',      cost: 3100 },
          { id: 3085, name: "Runaan's Hurricane", cost: 2600 },
          { id: 3091, name: "Wit's End",          cost: 2800 },
        ],
        alternatives: [
          { id: 3153, name: "Blade of the Ruined King", cost: 3200 },
          { id: 3031, name: 'Infinity Edge',       cost: 3400 },
        ],
      },
    ],
  },
  // Senna es un caso especial (ADC lethality-crit o SUPPORT enchanter). La
  // cuenta de demo la usa como main, así que le damos builds propias en vez de
  // caer al genérico de rol. Los ítems no listados resuelven sus componentes vía
  // ITEM_COMPONENTS (ver The Collector / Moonstone / Ardent más abajo).
  Senna: {
    ADC: [
      {
        id: 'senna-lethality', name: 'Letalidad Crítico', winrate: 52.3, pickrate: 41.5,
        core: [
          { id: 6701, name: 'Opportunity',     cost: 2700 },
          { id: 3031, name: 'Infinity Edge',   cost: 3400 },
          { id: 6676, name: 'The Collector',   cost: 3000 },
        ],
        alternatives: [
          { id: 3036, name: "Lord Dominik's Regards", cost: 3000 },
          { id: 3072, name: 'Bloodthirster',   cost: 3400 },
        ],
      },
      {
        id: 'senna-crit', name: 'Crítico Estándar', winrate: 50.8, pickrate: 28.9,
        core: [
          { id: 3031, name: 'Infinity Edge',   cost: 3400 },
          { id: 3094, name: 'Rapid Firecannon', cost: 2500 },
          { id: 3036, name: "Lord Dominik's Regards", cost: 3000 },
        ],
        alternatives: [
          { id: 6676, name: 'The Collector',   cost: 3000 },
          { id: 3046, name: 'Phantom Dancer',  cost: 2600 },
        ],
      },
    ],
    SUPPORT: [
      {
        id: 'senna-enchant', name: 'Encantador Visión', winrate: 51.9, pickrate: 35.2,
        core: [
          { id: 6617, name: 'Moonstone Renewer', cost: 2500 },
          { id: 3504, name: 'Ardent Censer',      cost: 2300 },
          { id: 3222, name: "Mikael's Blessing",  cost: 2300 },
        ],
        alternatives: [
          { id: 3107, name: 'Redemption',         cost: 2300 },
          { id: 6620, name: 'Echoes of Helia',    cost: 2200 },
        ],
      },
    ],
  },
  Caitlyn: {
    ADC: [
      {
        id: 'cait-crit', name: 'Crit Poke', winrate: 52.1, pickrate: 58.7,
        core: [
          { id: 3031, name: 'Infinity Edge',    cost: 3400 },
          { id: 3094, name: 'Rapid Firecannon', cost: 2500 },
          { id: 3036, name: "Lord Dominik's Regards", cost: 3000 },
        ],
        alternatives: [
          { id: 3072, name: 'Bloodthirster',    cost: 3400 },
          { id: 3046, name: 'Phantom Dancer',   cost: 2600 },
        ],
      },
      {
        id: 'cait-galeforce', name: 'Galeforce Móvil', winrate: 50.4, pickrate: 27.3,
        core: [
          { id: 6671, name: 'Galeforce',        cost: 3400 },
          { id: 3031, name: 'Infinity Edge',    cost: 3400 },
          { id: 3094, name: 'Rapid Firecannon', cost: 2500 },
        ],
        alternatives: [
          { id: 3036, name: "Lord Dominik's Regards", cost: 3000 },
          { id: 3026, name: 'Guardian Angel',   cost: 2800 },
        ],
      },
    ],
  },

  // ─── MID ────────────────────────────────────────────────────────────────
  Ahri: {
    MID: [
      {
        id: 'ahri-burst', name: 'Burst Mago', winrate: 52.8, pickrate: 55.1,
        core: [
          { id: 6655, name: "Luden's Tempest",   cost: 3200 },
          { id: 4645, name: 'Shadowflame',        cost: 3000 },
          { id: 3089, name: "Rabadon's Deathcap", cost: 3600 },
        ],
        alternatives: [
          { id: 3157, name: "Zhonya's Hourglass", cost: 2600 },
          { id: 3135, name: 'Void Staff',         cost: 3000 },
        ],
      },
      {
        id: 'ahri-control', name: 'Control Sostenido', winrate: 51.0, pickrate: 30.4,
        core: [
          { id: 6653, name: "Liandry's Anguish",  cost: 3200 },
          { id: 3157, name: "Zhonya's Hourglass", cost: 2600 },
          { id: 3089, name: "Rabadon's Deathcap", cost: 3600 },
        ],
        alternatives: [
          { id: 4645, name: 'Shadowflame',        cost: 3000 },
          { id: 3135, name: 'Void Staff',         cost: 3000 },
        ],
      },
    ],
  },
  Zed: {
    MID: [
      {
        id: 'zed-lethality', name: 'Letalidad Asesino', winrate: 51.7, pickrate: 61.9,
        core: [
          { id: 6691, name: 'Duskblade of Draktharr', cost: 3100 },
          { id: 6692, name: 'Eclipse',            cost: 2900 },
          { id: 3814, name: 'Edge of Night',      cost: 2900 },
        ],
        alternatives: [
          { id: 3179, name: 'Umbral Glaive',      cost: 2400 },
          { id: 3156, name: 'Maw of Malmortius',  cost: 3100 },
        ],
      },
      {
        id: 'zed-bruiser', name: 'Bruiser Resistente', winrate: 49.6, pickrate: 18.2,
        core: [
          { id: 6692, name: 'Eclipse',            cost: 2900 },
          { id: 3071, name: 'Black Cleaver',      cost: 3000 },
          { id: 6333, name: "Death's Dance",      cost: 3300 },
        ],
        alternatives: [
          { id: 3053, name: "Sterak's Gage",      cost: 3000 },
          { id: 3156, name: 'Maw of Malmortius',  cost: 3100 },
        ],
      },
    ],
  },

  // ─── TOP ────────────────────────────────────────────────────────────────
  Garen: {
    TOP: [
      {
        id: 'garen-bruiser', name: 'Bruiser Estándar', winrate: 52.5, pickrate: 49.8,
        core: [
          { id: 6333, name: "Death's Dance",      cost: 3300 },
          { id: 3071, name: 'Black Cleaver',      cost: 3000 },
          { id: 3053, name: "Sterak's Gage",      cost: 3000 },
        ],
        alternatives: [
          { id: 3742, name: "Dead Man's Plate",   cost: 2900 },
          { id: 3065, name: 'Spirit Visage',      cost: 2900 },
        ],
      },
      {
        id: 'garen-tank', name: 'Tanque Split', winrate: 50.9, pickrate: 28.6,
        core: [
          { id: 3068, name: 'Sunfire Aegis',      cost: 2700 },
          { id: 3742, name: "Dead Man's Plate",   cost: 2900 },
          { id: 3075, name: 'Thornmail',          cost: 2700 },
        ],
        alternatives: [
          { id: 3065, name: 'Spirit Visage',      cost: 2900 },
          { id: 3193, name: 'Gargoyle Stoneplate', cost: 3200 },
        ],
      },
    ],
  },

  // ─── JUNGLE ───────────────────────────────────────────────────────────────
  LeeSin: {
    JUNGLE: [
      {
        id: 'lee-bruiser', name: 'Bruiser Tempo', winrate: 51.3, pickrate: 52.0,
        core: [
          { id: 3071, name: 'Black Cleaver',      cost: 3000 },
          { id: 6333, name: "Death's Dance",      cost: 3300 },
          { id: 3053, name: "Sterak's Gage",      cost: 3000 },
        ],
        alternatives: [
          { id: 3156, name: 'Maw of Malmortius',  cost: 3100 },
          { id: 6610, name: 'Sundered Sky',       cost: 3100 },
        ],
      },
      {
        id: 'lee-lethality', name: 'Letalidad Carrileo', winrate: 49.4, pickrate: 22.7,
        core: [
          { id: 6692, name: 'Eclipse',            cost: 2900 },
          { id: 3179, name: 'Umbral Glaive',      cost: 2400 },
          { id: 6333, name: "Death's Dance",      cost: 3300 },
        ],
        alternatives: [
          { id: 3814, name: 'Edge of Night',      cost: 2900 },
          { id: 3053, name: "Sterak's Gage",      cost: 3000 },
        ],
      },
    ],
  },

  // ─── SUPPORT ───────────────────────────────────────────────────────────────
  Thresh: {
    SUPPORT: [
      {
        id: 'thresh-engage', name: 'Enganche Utilidad', winrate: 52.0, pickrate: 47.5,
        core: [
          { id: 3190, name: 'Locket of the Iron Solari', cost: 2500 },
          { id: 3109, name: "Knight's Vow",       cost: 2300 },
          { id: 3111, name: "Mercury's Treads",   cost: 1100 },
        ],
        alternatives: [
          { id: 3050, name: "Zeke's Convergence",  cost: 2400 },
          { id: 3107, name: 'Redemption',          cost: 2300 },
        ],
      },
      {
        id: 'thresh-tank', name: 'Tanque Aguante', winrate: 50.6, pickrate: 26.1,
        core: [
          { id: 3068, name: 'Sunfire Aegis',      cost: 2700 },
          { id: 3193, name: 'Gargoyle Stoneplate', cost: 3200 },
          { id: 3075, name: 'Thornmail',          cost: 2700 },
        ],
        alternatives: [
          { id: 3190, name: 'Locket of the Iron Solari', cost: 2500 },
          { id: 3065, name: 'Spirit Visage',      cost: 2900 },
        ],
      },
    ],
  },
};

// ── Builds genéricas por rol (fallback) ─────────────────────────────
// Si el campeón no figura arriba caemos a una build razonable por rol, para que
// la tienda SIEMPRE muestre 2 opciones aunque no tengamos datos del campeón.
export const GENERIC_BUILDS_BY_ROLE = {
  ADC: [
    {
      id: 'gen-adc-crit', name: 'Crito Estándar', winrate: 51.2, pickrate: 44.0,
      core: [
        { id: 6672, name: 'Kraken Slayer',  cost: 3100 },
        { id: 3031, name: 'Infinity Edge',  cost: 3400 },
        { id: 3036, name: "Lord Dominik's Regards", cost: 3000 },
      ],
      alternatives: [
        { id: 3072, name: 'Bloodthirster',  cost: 3400 },
        { id: 3046, name: 'Phantom Dancer', cost: 2600 },
      ],
    },
    {
      id: 'gen-adc-onhit', name: 'On-Hit', winrate: 49.7, pickrate: 18.3,
      core: [
        { id: 3153, name: "Blade of the Ruined King", cost: 3200 },
        { id: 3091, name: "Wit's End",      cost: 2800 },
        { id: 3085, name: "Runaan's Hurricane", cost: 2600 },
      ],
      alternatives: [
        { id: 3031, name: 'Infinity Edge',  cost: 3400 },
        { id: 3026, name: 'Guardian Angel', cost: 2800 },
      ],
    },
  ],
  MID: [
    {
      id: 'gen-mid-ap', name: 'Mago Burst', winrate: 51.0, pickrate: 41.2,
      core: [
        { id: 6655, name: "Luden's Tempest",   cost: 3200 },
        { id: 3135, name: 'Void Staff',         cost: 3000 },
        { id: 3089, name: "Rabadon's Deathcap", cost: 3600 },
      ],
      alternatives: [
        { id: 3157, name: "Zhonya's Hourglass", cost: 2600 },
        { id: 4645, name: 'Shadowflame',        cost: 3000 },
      ],
    },
    {
      id: 'gen-mid-ad', name: 'Asesino AD', winrate: 49.8, pickrate: 19.6,
      core: [
        { id: 6691, name: 'Duskblade of Draktharr', cost: 3100 },
        { id: 6692, name: 'Eclipse',            cost: 2900 },
        { id: 6333, name: "Death's Dance",      cost: 3300 },
      ],
      alternatives: [
        { id: 3814, name: 'Edge of Night',      cost: 2900 },
        { id: 3156, name: 'Maw of Malmortius',  cost: 3100 },
      ],
    },
  ],
  TOP: [
    {
      id: 'gen-top-bruiser', name: 'Bruiser', winrate: 51.4, pickrate: 43.0,
      core: [
        { id: 6333, name: "Death's Dance",  cost: 3300 },
        { id: 3071, name: 'Black Cleaver',  cost: 3000 },
        { id: 3053, name: "Sterak's Gage",  cost: 3000 },
      ],
      alternatives: [
        { id: 3742, name: "Dead Man's Plate", cost: 2900 },
        { id: 3065, name: 'Spirit Visage',  cost: 2900 },
      ],
    },
    {
      id: 'gen-top-tank', name: 'Tanque', winrate: 50.2, pickrate: 24.8,
      core: [
        { id: 3068, name: 'Sunfire Aegis',  cost: 2700 },
        { id: 3075, name: 'Thornmail',      cost: 2700 },
        { id: 3193, name: 'Gargoyle Stoneplate', cost: 3200 },
      ],
      alternatives: [
        { id: 3065, name: 'Spirit Visage',  cost: 2900 },
        { id: 3742, name: "Dead Man's Plate", cost: 2900 },
      ],
    },
  ],
  JUNGLE: [
    {
      id: 'gen-jg-bruiser', name: 'Bruiser', winrate: 51.1, pickrate: 40.5,
      core: [
        { id: 3071, name: 'Black Cleaver',  cost: 3000 },
        { id: 6333, name: "Death's Dance",  cost: 3300 },
        { id: 3053, name: "Sterak's Gage",  cost: 3000 },
      ],
      alternatives: [
        { id: 3156, name: 'Maw of Malmortius', cost: 3100 },
        { id: 3075, name: 'Thornmail',      cost: 2700 },
      ],
    },
    {
      id: 'gen-jg-ap', name: 'Mago Jungla', winrate: 49.5, pickrate: 17.4,
      core: [
        { id: 6655, name: "Luden's Tempest", cost: 3200 },
        { id: 3157, name: "Zhonya's Hourglass", cost: 2600 },
        { id: 3089, name: "Rabadon's Deathcap", cost: 3600 },
      ],
      alternatives: [
        { id: 3135, name: 'Void Staff',     cost: 3000 },
        { id: 4645, name: 'Shadowflame',    cost: 3000 },
      ],
    },
  ],
  SUPPORT: [
    {
      id: 'gen-sup-enchant', name: 'Encantador', winrate: 51.6, pickrate: 38.9,
      core: [
        { id: 3107, name: 'Redemption',     cost: 2300 },
        { id: 3222, name: "Mikael's Blessing", cost: 2300 },
        { id: 3190, name: 'Locket of the Iron Solari', cost: 2500 },
      ],
      alternatives: [
        { id: 3050, name: "Zeke's Convergence", cost: 2400 },
        { id: 3109, name: "Knight's Vow",   cost: 2300 },
      ],
    },
    {
      id: 'gen-sup-tank', name: 'Tanque Enganche', winrate: 50.0, pickrate: 23.5,
      core: [
        { id: 3190, name: 'Locket of the Iron Solari', cost: 2500 },
        { id: 3068, name: 'Sunfire Aegis',  cost: 2700 },
        { id: 3075, name: 'Thornmail',      cost: 2700 },
      ],
      alternatives: [
        { id: 3193, name: 'Gargoyle Stoneplate', cost: 3200 },
        { id: 3065, name: 'Spirit Visage',  cost: 2900 },
      ],
    },
  ],
  // Si ni el rol se reconoce, una build neutra de objetos de combate.
  DEFAULT: [
    {
      id: 'gen-default', name: 'Build Estándar', winrate: 50.5, pickrate: 30.0,
      core: [
        { id: 3031, name: 'Infinity Edge',  cost: 3400 },
        { id: 6333, name: "Death's Dance",  cost: 3300 },
        { id: 3026, name: 'Guardian Angel', cost: 2800 },
      ],
      alternatives: [
        { id: 3071, name: 'Black Cleaver',  cost: 3000 },
        { id: 3157, name: "Zhonya's Hourglass", cost: 2600 },
      ],
    },
    {
      id: 'gen-default-2', name: 'Build Defensiva', winrate: 49.3, pickrate: 14.2,
      core: [
        { id: 3068, name: 'Sunfire Aegis',  cost: 2700 },
        { id: 3075, name: 'Thornmail',      cost: 2700 },
        { id: 3065, name: 'Spirit Visage',  cost: 2900 },
      ],
      alternatives: [
        { id: 3193, name: 'Gargoyle Stoneplate', cost: 3200 },
        { id: 3026, name: 'Guardian Angel', cost: 2800 },
      ],
    },
  ],
};

// Total de oro del núcleo de una build (3 ítems). Útil para mostrar el coste.
export function getBuildCoreCost(build) {
  if (!build || !Array.isArray(build.core)) return 0;
  return build.core.reduce((sum, it) => sum + (Number(it.cost) || 0), 0);
}

// Devuelve las builds de un campeón/rol. SIEMPRE devuelve un array no vacío:
//   1. ITEM_BUILDS[champion][role]      (campeón + rol exacto)
//   2. ITEM_BUILDS[champion][cualquier] (campeón, primer rol disponible)
//   3. GENERIC_BUILDS_BY_ROLE[role]     (genérica del rol)
//   4. GENERIC_BUILDS_BY_ROLE.DEFAULT   (último recurso)
// Las builds salen ORDENADAS por winrate descendente (estilo op.gg).
export function getBuildsForChampion(champion, role) {
  const roleKey = String(role || '').toUpperCase();
  const byChamp = champion ? ITEM_BUILDS[champion] : null;

  let builds = null;
  if (byChamp) {
    builds = byChamp[roleKey] || byChamp[Object.keys(byChamp)[0]] || null;
  }
  if (!builds || builds.length === 0) {
    builds = GENERIC_BUILDS_BY_ROLE[roleKey] || GENERIC_BUILDS_BY_ROLE.DEFAULT;
  }

  // Copia ordenada por winrate desc (no mutamos la fuente). H4 — adjuntamos a
  // cada build las BOTAS COMPLETAS de su rol (build.boots) para que la guía suba
  // de botas básicas → completas; si la build ya trae unas propias, se respetan.
  const completeBoots = getCompleteBootsForRole(roleKey);
  return [...builds]
    .sort((a, b) => (b.winrate || 0) - (a.winrate || 0))
    .map(b => ({ ...b, boots: b.boots || completeBoots }));
}

// ── STARTERS por rol (nivel 1) ──────────────────────────────────────
// Los objetos de INICIO que se compran nada más entrar a la grieta (antes del
// primer recall). Cada uno trae `id` de Data Dragon (icono garantizado) + coste.
// El asistente del HUD los ofrece a nivel bajo mientras sean asequibles.
export const STARTERS_BY_ROLE = {
  ADC: [
    { id: 1055, name: "Doran's Blade",  cost: 450, tag: 'INICIO' },
    { id: 2003, name: 'Health Potion',  cost: 50,  tag: 'INICIO' },
  ],
  // La especificación agrupa ADC/MID con Doran's Blade; MID AD (Zed) encaja y el
  // mago (Ahri) lo cambia por su ítem AP en cuanto puede.
  MID: [
    { id: 1055, name: "Doran's Blade",  cost: 450, tag: 'INICIO' },
    { id: 2003, name: 'Health Potion',  cost: 50,  tag: 'INICIO' },
  ],
  TOP: [
    { id: 1054, name: "Doran's Shield", cost: 450, tag: 'INICIO' },
    { id: 2003, name: 'Health Potion',  cost: 50,  tag: 'INICIO' },
  ],
  JUNGLE: [
    { id: 1101, name: 'Gustwalker Hatchling', cost: 350, tag: 'INICIO' },
    { id: 2003, name: 'Health Potion',        cost: 50,  tag: 'INICIO' },
  ],
  SUPPORT: [
    { id: 3858, name: 'Relic Shield',   cost: 400, tag: 'INICIO' },
    { id: 2003, name: 'Health Potion',  cost: 50,  tag: 'INICIO' },
  ],
  // Si el rol no se reconoce, un inicio neutro y barato.
  DEFAULT: [
    { id: 1054, name: "Doran's Shield", cost: 450, tag: 'INICIO' },
    { id: 2003, name: 'Health Potion',  cost: 50,  tag: 'INICIO' },
  ],
};

// Botas base (nivel 1): el primer escalón de movilidad antes de las botas finales.
export const BOOTS_STARTER = { id: 1001, name: 'Boots', cost: 300, tag: 'BOTAS' };

// H4 — BOTAS COMPLETAS por rol. Las botas básicas (BOOTS_STARTER, 300) son sólo
// el primer escalón: la guía las MEJORA a estas completas (mismo slot). Cada una
// lleva 'Boots' (id 1001, 300) entre sus componentes (ver ITEM_COMPONENTS), así
// que comprar las completas RETIRA las básicas del inventario (las reemplaza).
export const COMPLETE_BOOTS_BY_ROLE = {
  ADC:     { id: 3006, name: "Berserker's Greaves", cost: 1100, tag: 'BOTAS' },
  MID:     { id: 3020, name: "Sorcerer's Shoes",    cost: 1100, tag: 'BOTAS' },
  TOP:     { id: 3047, name: 'Plated Steelcaps',    cost: 1100, tag: 'BOTAS' },
  JUNGLE:  { id: 3047, name: 'Plated Steelcaps',    cost: 1100, tag: 'BOTAS' },
  SUPPORT: { id: 3111, name: "Mercury's Treads",    cost: 1100, tag: 'BOTAS' },
  DEFAULT: { id: 3111, name: "Mercury's Treads",    cost: 1100, tag: 'BOTAS' },
};

// Botas completas recomendadas para un rol (siempre devuelve un objeto válido).
export function getCompleteBootsForRole(role) {
  const key = String(role || '').toUpperCase();
  return COMPLETE_BOOTS_BY_ROLE[key] || COMPLETE_BOOTS_BY_ROLE.DEFAULT;
}

// Devuelve los starters del rol (array no vacío). Cae a DEFAULT si el rol no
// figura en STARTERS_BY_ROLE.
export function getStartersForRole(role) {
  const key = String(role || '').toUpperCase();
  return STARTERS_BY_ROLE[key] || STARTERS_BY_ROLE.DEFAULT;
}

// ── COMPONENTES de cada ítem terminado ──────────────────────────────
// Biblioteca compartida nombre→piezas (cada pieza: id de Data Dragon + coste).
// Permite que CUALQUIER ítem de core/alternatives ofrezca sus componentes sin
// tener que inlinearlos en cada build (los de Jinx sí van inline como ejemplo).
// Los costes son aproximados a los reales de LoL (datos MOCK).
export const ITEM_COMPONENTS = {
  // ── ADC / crit / on-hit ──
  'Kraken Slayer':            [{ id: 1038, name: 'B.F. Sword', cost: 1300 }, { id: 1043, name: 'Recurve Bow', cost: 1000 }, { id: 1018, name: 'Cloak of Agility', cost: 600 }],
  'Infinity Edge':            [{ id: 1038, name: 'B.F. Sword', cost: 1300 }, { id: 1037, name: 'Pickaxe', cost: 875 }, { id: 1018, name: 'Cloak of Agility', cost: 600 }],
  "Runaan's Hurricane":       [{ id: 1043, name: 'Recurve Bow', cost: 1000 }, { id: 3086, name: 'Zeal', cost: 1100 }, { id: 1042, name: 'Dagger', cost: 300 }],
  'Immortal Shieldbow':       [{ id: 1038, name: 'B.F. Sword', cost: 1300 }, { id: 1053, name: 'Vampiric Scepter', cost: 900 }, { id: 1018, name: 'Cloak of Agility', cost: 600 }],
  'Rapid Firecannon':         [{ id: 3086, name: 'Zeal', cost: 1100 }, { id: 1043, name: 'Recurve Bow', cost: 1000 }, { id: 1042, name: 'Dagger', cost: 300 }],
  "Wit's End":                [{ id: 1043, name: 'Recurve Bow', cost: 1000 }, { id: 1033, name: 'Null-Magic Mantle', cost: 450 }, { id: 1042, name: 'Dagger', cost: 300 }],
  'Bloodthirster':            [{ id: 1038, name: 'B.F. Sword', cost: 1300 }, { id: 1053, name: 'Vampiric Scepter', cost: 900 }, { id: 1018, name: 'Cloak of Agility', cost: 600 }],
  "Lord Dominik's Regards":   [{ id: 3035, name: 'Last Whisper', cost: 1300 }, { id: 1037, name: 'Pickaxe', cost: 875 }, { id: 1018, name: 'Cloak of Agility', cost: 600 }],
  'Opportunity':              [{ id: 3134, name: 'Serrated Dirk', cost: 1100 }, { id: 1036, name: 'Long Sword', cost: 350 }, { id: 1037, name: 'Pickaxe', cost: 875 }],
  'The Collector':            [{ id: 3134, name: 'Serrated Dirk', cost: 1100 }, { id: 1018, name: 'Cloak of Agility', cost: 600 }, { id: 1037, name: 'Pickaxe', cost: 875 }],
  'Phantom Dancer':           [{ id: 3086, name: 'Zeal', cost: 1100 }, { id: 1043, name: 'Recurve Bow', cost: 1000 }, { id: 1042, name: 'Dagger', cost: 300 }],
  'Blade of the Ruined King': [{ id: 1053, name: 'Vampiric Scepter', cost: 900 }, { id: 1043, name: 'Recurve Bow', cost: 1000 }, { id: 1037, name: 'Pickaxe', cost: 875 }],
  'Galeforce':                [{ id: 1038, name: 'B.F. Sword', cost: 1300 }, { id: 3086, name: 'Zeal', cost: 1100 }, { id: 1018, name: 'Cloak of Agility', cost: 600 }],
  'Guardian Angel':           [{ id: 1038, name: 'B.F. Sword', cost: 1300 }, { id: 1031, name: 'Chain Vest', cost: 800 }],

  // ── Magos (AP) ──
  "Luden's Tempest":          [{ id: 3802, name: 'Lost Chapter', cost: 1100 }, { id: 1026, name: 'Blasting Wand', cost: 850 }, { id: 1052, name: 'Amplifying Tome', cost: 435 }],
  'Shadowflame':              [{ id: 3145, name: 'Hextech Alternator', cost: 1100 }, { id: 1026, name: 'Blasting Wand', cost: 850 }, { id: 1052, name: 'Amplifying Tome', cost: 435 }],
  "Rabadon's Deathcap":       [{ id: 1058, name: 'Needlessly Large Rod', cost: 1250 }, { id: 1026, name: 'Blasting Wand', cost: 850 }, { id: 1052, name: 'Amplifying Tome', cost: 435 }],
  "Liandry's Anguish":        [{ id: 1026, name: 'Blasting Wand', cost: 850 }, { id: 1052, name: 'Amplifying Tome', cost: 435 }, { id: 1028, name: 'Ruby Crystal', cost: 400 }],
  "Zhonya's Hourglass":       [{ id: 1058, name: 'Needlessly Large Rod', cost: 1250 }, { id: 1031, name: 'Chain Vest', cost: 800 }, { id: 1052, name: 'Amplifying Tome', cost: 435 }],
  'Void Staff':               [{ id: 1026, name: 'Blasting Wand', cost: 850 }, { id: 1052, name: 'Amplifying Tome', cost: 435 }, { id: 1033, name: 'Null-Magic Mantle', cost: 450 }],

  // ── Asesinos / letalidad ──
  'Duskblade of Draktharr':   [{ id: 3134, name: 'Serrated Dirk', cost: 1100 }, { id: 1037, name: 'Pickaxe', cost: 875 }, { id: 1036, name: 'Long Sword', cost: 350 }],
  'Eclipse':                  [{ id: 3134, name: 'Serrated Dirk', cost: 1100 }, { id: 1037, name: 'Pickaxe', cost: 875 }, { id: 1036, name: 'Long Sword', cost: 350 }],
  'Edge of Night':            [{ id: 3134, name: 'Serrated Dirk', cost: 1100 }, { id: 1028, name: 'Ruby Crystal', cost: 400 }, { id: 1033, name: 'Null-Magic Mantle', cost: 450 }],
  'Umbral Glaive':            [{ id: 3134, name: 'Serrated Dirk', cost: 1100 }, { id: 1036, name: 'Long Sword', cost: 350 }],
  'Maw of Malmortius':        [{ id: 3133, name: "Caulfield's Warhammer", cost: 1050 }, { id: 1057, name: 'Negatron Cloak', cost: 810 }, { id: 1037, name: 'Pickaxe', cost: 875 }],
  "Serpent's Fang":           [{ id: 3134, name: 'Serrated Dirk', cost: 1100 }, { id: 1036, name: 'Long Sword', cost: 350 }],

  // ── Bruisers / luchadores ──
  'Black Cleaver':            [{ id: 3133, name: "Caulfield's Warhammer", cost: 1050 }, { id: 1028, name: 'Ruby Crystal', cost: 400 }, { id: 1036, name: 'Long Sword', cost: 350 }],
  "Death's Dance":            [{ id: 3133, name: "Caulfield's Warhammer", cost: 1050 }, { id: 1037, name: 'Pickaxe', cost: 875 }, { id: 1029, name: 'Cloth Armor', cost: 300 }],
  "Sterak's Gage":            [{ id: 1011, name: "Giant's Belt", cost: 900 }, { id: 3133, name: "Caulfield's Warhammer", cost: 1050 }],
  'Sundered Sky':             [{ id: 3133, name: "Caulfield's Warhammer", cost: 1050 }, { id: 3067, name: 'Kindlegem', cost: 800 }, { id: 1036, name: 'Long Sword', cost: 350 }],
  'Trinity Force':            [{ id: 3057, name: 'Sheen', cost: 700 }, { id: 3051, name: 'Hearthbound Axe', cost: 1000 }, { id: 3067, name: 'Kindlegem', cost: 800 }],

  // ── Tanques / defensivos ──
  'Sunfire Aegis':            [{ id: 3751, name: "Bami's Cinder", cost: 900 }, { id: 1031, name: 'Chain Vest', cost: 800 }, { id: 1028, name: 'Ruby Crystal', cost: 400 }],
  'Thornmail':                [{ id: 3076, name: 'Bramble Vest', cost: 900 }, { id: 1031, name: 'Chain Vest', cost: 800 }, { id: 1028, name: 'Ruby Crystal', cost: 400 }],
  "Dead Man's Plate":         [{ id: 1031, name: 'Chain Vest', cost: 800 }, { id: 3066, name: 'Winged Moonplate', cost: 800 }, { id: 1028, name: 'Ruby Crystal', cost: 400 }],
  'Spirit Visage':            [{ id: 3067, name: 'Kindlegem', cost: 800 }, { id: 1057, name: 'Negatron Cloak', cost: 810 }, { id: 1028, name: 'Ruby Crystal', cost: 400 }],
  'Gargoyle Stoneplate':      [{ id: 1031, name: 'Chain Vest', cost: 800 }, { id: 1057, name: 'Negatron Cloak', cost: 810 }, { id: 1028, name: 'Ruby Crystal', cost: 400 }],

  // ── Soporte / utilidad ──
  'Locket of the Iron Solari': [{ id: 3067, name: 'Kindlegem', cost: 800 }, { id: 1029, name: 'Cloth Armor', cost: 300 }, { id: 1033, name: 'Null-Magic Mantle', cost: 450 }],
  "Knight's Vow":             [{ id: 3067, name: 'Kindlegem', cost: 800 }, { id: 1029, name: 'Cloth Armor', cost: 300 }, { id: 1028, name: 'Ruby Crystal', cost: 400 }],
  "Mercury's Treads":         [{ id: 1001, name: 'Boots', cost: 300 }, { id: 1033, name: 'Null-Magic Mantle', cost: 450 }],
  "Zeke's Convergence":       [{ id: 3067, name: 'Kindlegem', cost: 800 }, { id: 3024, name: 'Glacial Buckler', cost: 900 }],
  'Redemption':               [{ id: 3801, name: 'Crystalline Bracer', cost: 800 }, { id: 3114, name: 'Forbidden Idol', cost: 800 }, { id: 1004, name: 'Faerie Charm', cost: 200 }],
  "Mikael's Blessing":        [{ id: 3114, name: 'Forbidden Idol', cost: 800 }, { id: 1004, name: 'Faerie Charm', cost: 200 }, { id: 1033, name: 'Null-Magic Mantle', cost: 450 }],
  'Moonstone Renewer':        [{ id: 3114, name: 'Forbidden Idol', cost: 800 }, { id: 3067, name: 'Kindlegem', cost: 800 }, { id: 1004, name: 'Faerie Charm', cost: 200 }],
  'Ardent Censer':            [{ id: 3114, name: 'Forbidden Idol', cost: 800 }, { id: 1052, name: 'Amplifying Tome', cost: 435 }, { id: 1004, name: 'Faerie Charm', cost: 200 }],
  'Echoes of Helia':          [{ id: 3067, name: 'Kindlegem', cost: 800 }, { id: 3114, name: 'Forbidden Idol', cost: 800 }, { id: 1027, name: 'Sapphire Crystal', cost: 350 }],

  // ── Botas completas (H4) — 'Boots' básicas (1001, 300) como ÚNICO componente:
  // la guía recomienda primero las básicas y, al tener oro, sube a las completas;
  // comprarlas RETIRA las básicas del inventario (mismo slot). 'Mercury's Treads'
  // ya figura arriba (en la sección de soporte) con 'Boots' como primera pieza.
  "Berserker's Greaves":      [{ id: 1001, name: 'Boots', cost: 300 }],
  "Sorcerer's Shoes":         [{ id: 1001, name: 'Boots', cost: 300 }],
  'Plated Steelcaps':         [{ id: 1001, name: 'Boots', cost: 300 }],
};

// Paleta de componentes genéricos (del más caro al más barato) para descomponer
// un ítem que no figure en ITEM_COMPONENTS y no traiga `components` inline. Todas
// son piezas reales con icono, así que el desglose siempre muestra algo válido.
const GENERIC_COMPONENT_PALETTE = [
  { id: 1038, name: 'B.F. Sword',           cost: 1300 },
  { id: 1058, name: 'Needlessly Large Rod', cost: 1250 },
  { id: 1037, name: 'Pickaxe',              cost: 875 },
  { id: 1018, name: 'Cloak of Agility',     cost: 600 },
  { id: 1028, name: 'Ruby Crystal',         cost: 400 },
  { id: 1036, name: 'Long Sword',           cost: 350 },
];

// Descompone genéricamente un coste en hasta 3 piezas reales (greedy de mayor a
// menor). Red de seguridad para ítems sin componentes declarados.
function genericComponents(cost) {
  let remaining = Number(cost) || 0;
  const pieces = [];
  for (const piece of GENERIC_COMPONENT_PALETTE) {
    if (pieces.length >= 3) break;
    if (piece.cost <= remaining) {
      pieces.push(piece);
      remaining -= piece.cost;
    }
  }
  // Si nada encajó (coste < 350) ofrece la pieza más barata como aproximación.
  if (pieces.length === 0 && (Number(cost) || 0) > 0) {
    pieces.push(GENERIC_COMPONENT_PALETTE[GENERIC_COMPONENT_PALETTE.length - 1]);
  }
  return pieces;
}

// Devuelve las piezas de un ítem: `components` inline si los trae, si no la
// entrada de ITEM_COMPONENTS por nombre, y como último recurso un desglose
// genérico por coste. SIEMPRE devuelve un array (vacío sólo si no hay coste).
export function getItemComponents(item) {
  if (!item) return [];
  if (Array.isArray(item.components) && item.components.length > 0) return item.components;
  const byName = ITEM_COMPONENTS[item.name];
  if (Array.isArray(byName) && byName.length > 0) return byName;
  return genericComponents(item.cost);
}

// ── I1 — Combinación automática: componentes → ítem completo ─────────────────
// Recorre los ítems de la build (NÚCLEO + BOTAS + ALTERNATIVAS). Para cada ítem
// cuyo conjunto COMPLETO de componentes esté en `set` y que NO esté ya construido,
// lo FUNDE: retira esos componentes de `set`, añade el ítem completo y cobra su
// COSTE DE COMBINACIÓN (coste del ítem − suma de sus componentes) del oro, SI hay
// oro suficiente. Así "comprar las 3 piezas del Filo Infinito + el oro de fusión"
// cuesta lo mismo que comprar el ítem completo (sin descuentos). Repite hasta
// estabilizar (una compra podría completar varios). PURA: no muta `set` ni nada
// externo; devuelve { set, gold, combined } (combined = nombres fundidos).
export function tryCombine(set, build, gold) {
  const result = {
    set: new Set(set instanceof Set ? set : []),
    gold: Number.isFinite(gold) ? gold : 0,
    combined: [],
  };
  if (!build) return result;
  const items = [
    ...(Array.isArray(build.core) ? build.core : []),
    ...(build.boots ? [build.boots] : []),
    ...(Array.isArray(build.alternatives) ? build.alternatives : []),
  ];
  let changed = true;
  while (changed) {
    changed = false;
    for (const item of items) {
      if (!item || !item.name || result.set.has(item.name)) continue;
      const comps = getItemComponents(item);
      if (!comps.length) continue;
      const allOwned = comps.every(c => c && c.name && result.set.has(c.name));
      if (!allOwned) continue;
      const compSum = comps.reduce((s, c) => s + (Number(c.cost) || 0), 0);
      const combineCost = Math.max(0, (Number(item.cost) || 0) - compSum);
      if (result.gold < combineCost) continue; // aún no hay oro para fundir
      comps.forEach(c => { if (c && c.name) result.set.delete(c.name); });
      result.set.add(item.name);
      result.gold -= combineCost;
      result.combined.push(item.name);
      changed = true;
    }
  }
  return result;
}

// Coste de combinación de un ítem (coste − suma de componentes). Lo usa la guía
// para decir cuánto oro falta para FUNDIR un ítem cuyas piezas ya están compradas.
export function getCombineCost(item) {
  if (!item) return 0;
  const comps = getItemComponents(item);
  const compSum = comps.reduce((s, c) => s + (Number(c.cost) || 0), 0);
  return Math.max(0, (Number(item.cost) || 0) - compSum);
}
