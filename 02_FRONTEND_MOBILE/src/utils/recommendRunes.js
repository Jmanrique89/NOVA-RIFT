// ============================================================================
// recommendRunes — motor de recomendación de runas según pick + matchup
// ----------------------------------------------------------------------------
// Recibe el champion del usuario y los picks enemigos, y devuelve:
// Keystone primaria (la "top tree" — Precision, Domination, Sorcery,
// Resolve, Inspiration).
// Hasta 3 secundarias del mismo árbol primario.
// Árbol secundario + 2 runas dentro.
// Razón humana ("Conqueror para sustained trades en Lucian").
//
// La tabla de keystones por champion está curada a mano sobre el catálogo
// `championsCatalog.js`. Si el champion no está en la tabla, devolvemos un
// default genérico por damage type (AD → Conqueror Precision, AP → Arcane
// Comet Sorcery, MIXED → Hail of Blades Domination).
//
// Heurísticas anti-matchup:
// vs SUSTAINED comp → fuerza Conqueror si el champ lo tiene; sino
// Lethal Tempo. Razón: corte de heal con anti-heal items + sustained
// dps neutraliza el drain.
// vs BURST_PICK enemy + champ tanky → fuerza Aftershock (Resolve)
// si el champ es engager (Malphite, Leona, Amumu...). Razón: aguanta
// el burst durante la animación de su engage.
// vs HYPER_CARRY → fuerza Press the Attack si el champ es ranged ADC
// con auto chains. Razón: el +12% damage taken acelera el shutdown
// antes del scaling.
//
// El motor es 100% PURO. Sin llamadas a red. Las runas no afectan a la
// recomendación de pick (`recommendPick`); son una capa adicional para el
// usuario que ya ha confirmado su pick.
// ============================================================================

// ─── Tabla de runas por champion ────────────────────────────────────────────
// keystone — runa primaria del top tree
// tree — árbol primario ('PRECISION' | 'DOMINATION' | 'SORCERY' | 'RESOLVE' | 'INSPIRATION')
// secondary — array de runas del primario (3 posiciones)
// secondTree — árbol secundario
// secondaryRunes — 2 runas del secundario
// notes — texto humano para el por qué
const RUNES_BY_CHAMPION = {
  // ─── Bruisers / Drain tanks (Precision Conqueror) ──────────────────────
  Aatrox: {
    keystone: 'Conqueror', tree: 'PRECISION',
    secondary: ['Triumph', 'Legend: Tenacity', 'Last Stand'],
    secondTree: 'RESOLVE',
    secondaryRunes: ['Conditioning', 'Revitalize'],
    notes: 'Conqueror para sustained trades + healing en R.',
  },
  Darius: {
    keystone: 'Conqueror', tree: 'PRECISION',
    secondary: ['Triumph', 'Legend: Tenacity', 'Last Stand'],
    secondTree: 'RESOLVE',
    secondaryRunes: ['Bone Plating', 'Demolish'],
    notes: 'Conqueror potencia Hemorrhage stacks en peleas largas.',
  },
  Garen: {
    keystone: 'Conqueror', tree: 'PRECISION',
    secondary: ['Triumph', 'Legend: Tenacity', 'Last Stand'],
    secondTree: 'RESOLVE',
    secondaryRunes: ['Conditioning', 'Unflinching'],
    notes: 'Conqueror para spin sostenido + ult execute.',
  },
  Sett: {
    keystone: 'Conqueror', tree: 'PRECISION',
    secondary: ['Triumph', 'Legend: Tenacity', 'Last Stand'],
    secondTree: 'RESOLVE',
    secondaryRunes: ['Bone Plating', 'Unflinching'],
    notes: 'Conqueror para combo W+E sostenido.',
  },
  Camille: {
    keystone: 'Conqueror', tree: 'PRECISION',
    secondary: ['Triumph', 'Legend: Alacrity', 'Coup de Grace'],
    secondTree: 'DOMINATION',
    secondaryRunes: ['Sudden Impact', 'Ravenous Hunter'],
    notes: 'Conqueror + Coup de Grace aprovecha True Damage del E.',
  },
  Riven: {
    keystone: 'Conqueror', tree: 'PRECISION',
    secondary: ['Triumph', 'Legend: Alacrity', 'Coup de Grace'],
    secondTree: 'DOMINATION',
    secondaryRunes: ['Taste of Blood', 'Ravenous Hunter'],
    notes: 'Conqueror para Q-W-AA chain en duelos largos.',
  },

  // ─── ADCs lane sustained (Lucian/Lulu/Cait con Press the Attack) ───────
  Lucian: {
    keystone: 'Press the Attack', tree: 'PRECISION',
    secondary: ['Presence of Mind', 'Legend: Alacrity', 'Cut Down'],
    secondTree: 'SORCERY',
    secondaryRunes: ['Manaflow Band', 'Gathering Storm'],
    notes: 'Press the Attack triggea con Q-passive-AA, +12% dmg al ADC.',
  },
  Caitlyn: {
    keystone: 'Press the Attack', tree: 'PRECISION',
    secondary: ['Presence of Mind', 'Legend: Alacrity', 'Coup de Grace'],
    secondTree: 'SORCERY',
    secondaryRunes: ['Manaflow Band', 'Scorch'],
    notes: 'Press the Attack para early-game pressure con headshots.',
  },
  Jhin: {
    keystone: 'Fleet Footwork', tree: 'PRECISION',
    secondary: ['Triumph', 'Legend: Alacrity', 'Coup de Grace'],
    secondTree: 'DOMINATION',
    secondaryRunes: ['Taste of Blood', 'Ultimate Hunter'],
    notes: 'Fleet Footwork sustain + kite — Jhin no tiene escape.',
  },

  // ─── Hyper-carries (Lethal Tempo) ──────────────────────────────────────
  Jinx: {
    keystone: 'Lethal Tempo', tree: 'PRECISION',
    secondary: ['Triumph', 'Legend: Alacrity', 'Coup de Grace'],
    secondTree: 'DOMINATION',
    secondaryRunes: ['Taste of Blood', 'Treasure Hunter'],
    notes: 'Lethal Tempo + Q-rocket attack speed = late game DPS rey.',
  },
  Vayne: {
    keystone: 'Lethal Tempo', tree: 'PRECISION',
    secondary: ['Triumph', 'Legend: Alacrity', 'Coup de Grace'],
    secondTree: 'DOMINATION',
    secondaryRunes: ['Sudden Impact', 'Treasure Hunter'],
    notes: 'Lethal Tempo + W tumble → True Damage stacks letales.',
  },
  Tryndamere: {
    keystone: 'Conqueror', tree: 'PRECISION',
    secondary: ['Triumph', 'Legend: Alacrity', 'Last Stand'],
    secondTree: 'RESOLVE',
    secondaryRunes: ['Bone Plating', 'Overgrowth'],
    notes: 'Conqueror para split sostenido — sinergia con E spam.',
  },

  // ─── Burst APs (Sorcery Arcane Comet) ──────────────────────────────────
  Lux: {
    keystone: 'Arcane Comet', tree: 'SORCERY',
    secondary: ['Manaflow Band', 'Transcendence', 'Scorch'],
    secondTree: 'INSPIRATION',
    secondaryRunes: ['Biscuit Delivery', 'Cosmic Insight'],
    notes: 'Arcane Comet garantizado con E (binding) → poke seguro.',
  },
  Veigar: {
    keystone: 'Phase Rush', tree: 'SORCERY',
    secondary: ['Manaflow Band', 'Transcendence', 'Scorch'],
    secondTree: 'INSPIRATION',
    secondaryRunes: ['Biscuit Delivery', 'Cosmic Insight'],
    notes: 'Phase Rush para escapar tras stun + AP infinito de pasiva.',
  },
  Syndra: {
    keystone: 'Electrocute', tree: 'DOMINATION',
    secondary: ['Sudden Impact', 'Eyeball Collection', 'Ultimate Hunter'],
    secondTree: 'SORCERY',
    secondaryRunes: ['Manaflow Band', 'Transcendence'],
    notes: 'Electrocute para Q-W-E combo → one-shot al carry.',
  },
  Ahri: {
    keystone: 'Electrocute', tree: 'DOMINATION',
    secondary: ['Cheap Shot', 'Eyeball Collection', 'Ultimate Hunter'],
    secondTree: 'SORCERY',
    secondaryRunes: ['Manaflow Band', 'Transcendence'],
    notes: 'Electrocute combo Charm + Q + E para roam pickoffs.',
  },
  Orianna: {
    keystone: 'Summon Aery', tree: 'SORCERY',
    secondary: ['Manaflow Band', 'Transcendence', 'Scorch'],
    secondTree: 'INSPIRATION',
    secondaryRunes: ['Biscuit Delivery', 'Cosmic Insight'],
    notes: 'Summon Aery para poke + shield safety en lane.',
  },

  // ─── Assassins (Domination Electrocute) ────────────────────────────────
  Zed: {
    keystone: 'Electrocute', tree: 'DOMINATION',
    secondary: ['Sudden Impact', 'Eyeball Collection', 'Ultimate Hunter'],
    secondTree: 'SORCERY',
    secondaryRunes: ['Transcendence', 'Gathering Storm'],
    notes: 'Electrocute + Sudden Impact triggers con W shadow → burst tras ult.',
  },
  Yasuo: {
    keystone: 'Conqueror', tree: 'PRECISION',
    secondary: ['Triumph', 'Legend: Alacrity', 'Coup de Grace'],
    secondTree: 'RESOLVE',
    secondaryRunes: ['Bone Plating', 'Unflinching'],
    notes: 'Conqueror para sustained trades — Yasuo necesita stacks rápidos.',
  },
  Katarina: {
    keystone: 'Electrocute', tree: 'DOMINATION',
    secondary: ['Sudden Impact', 'Eyeball Collection', 'Ultimate Hunter'],
    secondTree: 'PRECISION',
    secondaryRunes: ['Triumph', 'Coup de Grace'],
    notes: 'Electrocute combo Q-E reset + ulti gana teamfights.',
  },
  KhaZix: {
    keystone: 'Electrocute', tree: 'DOMINATION',
    secondary: ['Sudden Impact', 'Eyeball Collection', 'Ultimate Hunter'],
    secondTree: 'PRECISION',
    secondaryRunes: ['Triumph', 'Coup de Grace'],
    notes: 'Electrocute + Sudden Impact con Leap → isolation burst.',
  },

  // ─── Tanks engage (Resolve Aftershock) ─────────────────────────────────
  Malphite: {
    keystone: 'Aftershock', tree: 'RESOLVE',
    secondary: ['Shield Bash', 'Conditioning', 'Unflinching'],
    secondTree: 'SORCERY',
    secondaryRunes: ['Manaflow Band', 'Gathering Storm'],
    notes: 'Aftershock activa al impactar R → +60 armor mientras hace daño AOE.',
  },
  Amumu: {
    keystone: 'Aftershock', tree: 'RESOLVE',
    secondary: ['Demolish', 'Conditioning', 'Revitalize'],
    secondTree: 'INSPIRATION',
    secondaryRunes: ['Biscuit Delivery', 'Cosmic Insight'],
    notes: 'Aftershock para tank engage con R + Q.',
  },
  Leona: {
    keystone: 'Aftershock', tree: 'RESOLVE',
    secondary: ['Demolish', 'Conditioning', 'Unflinching'],
    secondTree: 'INSPIRATION',
    secondaryRunes: ['Biscuit Delivery', 'Cosmic Insight'],
    notes: 'Aftershock al stun → Leona se vuelve unkillable durante engage.',
  },
  Nautilus: {
    keystone: 'Aftershock', tree: 'RESOLVE',
    secondary: ['Font of Life', 'Conditioning', 'Revitalize'],
    secondTree: 'INSPIRATION',
    secondaryRunes: ['Biscuit Delivery', 'Cosmic Insight'],
    notes: 'Aftershock al hook + W shield → engage seguro.',
  },

  // ─── Enchanters (Resolve Guardian o Sorcery Aery) ──────────────────────
  Lulu: {
    keystone: 'Summon Aery', tree: 'SORCERY',
    secondary: ['Manaflow Band', 'Transcendence', 'Scorch'],
    secondTree: 'RESOLVE',
    secondaryRunes: ['Font of Life', 'Revitalize'],
    notes: 'Summon Aery escala con shield/poke. Resolve para sobrevivir engages.',
  },
  Soraka: {
    keystone: 'Summon Aery', tree: 'SORCERY',
    secondary: ['Manaflow Band', 'Transcendence', 'Scorch'],
    secondTree: 'RESOLVE',
    secondaryRunes: ['Font of Life', 'Revitalize'],
    notes: 'Aery escala con heal/poke — Soraka no necesita Guardian.',
  },
  Janna: {
    keystone: 'Summon Aery', tree: 'SORCERY',
    secondary: ['Manaflow Band', 'Transcendence', 'Scorch'],
    secondTree: 'RESOLVE',
    secondaryRunes: ['Font of Life', 'Revitalize'],
    notes: 'Aery escala con shield del E → utility maxima.',
  },
  Thresh: {
    keystone: 'Aftershock', tree: 'RESOLVE',
    secondary: ['Font of Life', 'Conditioning', 'Revitalize'],
    secondTree: 'INSPIRATION',
    secondaryRunes: ['Biscuit Delivery', 'Cosmic Insight'],
    notes: 'Aftershock al hook → tank el follow-up del ADC.',
  },
};

// ─── Defaults por damage type ───────────────────────────────────────────────
const DEFAULTS = {
  AD: {
    keystone: 'Conqueror', tree: 'PRECISION',
    secondary: ['Triumph', 'Legend: Alacrity', 'Last Stand'],
    secondTree: 'RESOLVE',
    secondaryRunes: ['Bone Plating', 'Revitalize'],
    notes: 'Conqueror sostenido — default para AD bruiser/duelist.',
  },
  AP: {
    keystone: 'Arcane Comet', tree: 'SORCERY',
    secondary: ['Manaflow Band', 'Transcendence', 'Scorch'],
    secondTree: 'INSPIRATION',
    secondaryRunes: ['Biscuit Delivery', 'Cosmic Insight'],
    notes: 'Arcane Comet — default para AP poke/control mage.',
  },
  MIXED: {
    keystone: 'Hail of Blades', tree: 'DOMINATION',
    secondary: ['Sudden Impact', 'Eyeball Collection', 'Ultimate Hunter'],
    secondTree: 'PRECISION',
    secondaryRunes: ['Triumph', 'Coup de Grace'],
    notes: 'Hail of Blades — default para mixed damage burst.',
  },
};

// ─── Override por matchup ───────────────────────────────────────────────────
//
// Si la comp enemiga es BURST_PICK y el user es un engager con Aftershock
// natural, mantenemos Aftershock. Si es SUSTAINED y el user es ADC con
// auto chains, fuerza Press the Attack. Las heurísticas se aplican como
// "soft override" — solo si no rompen el árbol primario nativo del champ.

const SUSTAINED_HEAVY_TAGS = ['SUSTAINED'];

const HYPER_CARRY_TAGS = ['HYPER_CARRY'];

/**
 * Calcula el override de matchup. Devuelve `null` si no hay override.
 */
function matchupOverride(champ, runes, enemyTags) {
  if (!Array.isArray(enemyTags) || enemyTags.length === 0) return null;

  // SUSTAINED enemy → si tienes ADC con auto chains, prefer Press the Attack.
  if (enemyTags.some(t => SUSTAINED_HEAVY_TAGS.includes(t))) {
    if (['Lucian', 'Caitlyn', 'Jhin'].includes(champ)) {
      return {
        ...runes,
        keystone: 'Press the Attack',
        notes: 'Press the Attack vs comp con sustain — el +12% damage taken acelera el shutdown del drain.',
        overridden: true,
      };
    }
  }

  // HYPER_CARRY enemy + ADC user → Lethal Tempo para teamfight tardío.
  if (enemyTags.some(t => HYPER_CARRY_TAGS.includes(t))) {
    if (['Jinx', 'Vayne', 'Caitlyn'].includes(champ)) {
      return {
        ...runes,
        keystone: 'Lethal Tempo',
        notes: 'Lethal Tempo vs hyper-carry — necesitas más DPS sostenido para no quedarte atrás en scaling.',
        overridden: true,
      };
    }
  }

  return null;
}

/**
 * Recomienda runas para un champion + matchup enemigo.
 *
 * @param {string} champion - ID canónico (PascalCase) del campeón del usuario.
 * @param {Object} [opts]
 * @param {string[]} [opts.enemyTags] - Tags activos del enemyComposition (de
 * `recommendPick`). Activan overrides
 * de matchup.
 * @param {string} [opts.damageType] - Override del damage type (default
 * deducido del champion en runas table).
 * @returns {{
 * keystone: string, tree: string,
 * secondary: string[], secondTree: string,
 * secondaryRunes: string[],
 * notes: string,
 * overridden: boolean,
 * source: 'curated' | 'default'
 * }}
 */
export function recommendRunes(champion, opts = {}) {
  const enemyTags = Array.isArray(opts.enemyTags) ? opts.enemyTags : [];
  const damageType = opts.damageType;

  const curated = RUNES_BY_CHAMPION[champion];
  const baseSource = curated ? 'curated' : 'default';

  let runes;
  if (curated) {
    runes = { ...curated };
  } else {
    // Champion no en tabla — default por damage type.
    const dt = damageType || 'AD';
    runes = { ...(DEFAULTS[dt] || DEFAULTS.AD) };
  }

  // Override por matchup (si aplica).
  const override = matchupOverride(champion, runes, enemyTags);
  if (override) return { ...override, source: baseSource };

  return { ...runes, overridden: false, source: baseSource };
}
