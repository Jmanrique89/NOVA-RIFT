// ============================================================================
// runeRecommendations — capa de presentación de runas para el Champion Select
// ----------------------------------------------------------------------------
// P2-1. El asistente de champion select necesita pintar una PÁGINA DE RUNAS
// estilo op.gg para el campeón recomendado: árbol PRIMARIO (keystone + 3 runas
// menores), árbol SECUNDARIO (2 runas) y los 3 FRAGMENTOS (ofensivo / flexible
// / defensivo).
//
// La SELECCIÓN de keystone/árbol por campeón (y los overrides por matchup) ya
// existe y está testeada en `utils/recommendRunes.js`. Para NO duplicar ese
// motor, este módulo lo COMPONE y añade encima la capa que falta para la UI:
//
//   1. FRAGMENTOS (3 shards) por arquetipo — recommendRunes no los devuelve.
//   2. Mapa keystone (nombre legible) → clave de icono de Data Dragon, para
//      que el componente resuelva el icono vía `getRuneImageUrl`.
//   3. Metadatos de árbol (etiqueta ES + color canónico de la rama de runas)
//      para darle el look op.gg sobre fondo oscuro.
//
// Mantiene el contrato "por arquetipo (AD/AP/tanque/soporte) o por campeón":
// recommendRunes ya resuelve por campeón curado y, si no, por damage type;
// aquí derivamos además el arquetipo para elegir los fragmentos correctos.
//
// 100% puro: sin red, sin estado, sin React.
// ============================================================================
import { recommendRunes } from '../utils/recommendRunes';
import { CHAMPIONS } from '../data/championsCatalog';

// Lookup O(1) sobre el catálogo para deducir role/damageType del campeón.
const CHAMPION_BY_ID = CHAMPIONS.reduce((acc, c) => {
  acc[c.id] = c;
  return acc;
}, {});

// ─── Nombre legible de keystone → clave de icono en getRuneImageUrl ──────────
// `recommendRunes` devuelve el keystone como nombre legible ("Press the Attack")
// pero `getRuneImageUrl` (utils/dataDragon) indexa por la clave PascalCase de
// Data Dragon ("PressTheAttack"). Este mapa traduce de uno a otro. Si una
// keystone no tiene icono mapeado (p.ej. "Hail of Blades", default MIXED), el
// componente cae a un placeholder de texto — honesto, sin icono roto.
export const KEYSTONE_ICON_KEY = {
  'Conqueror':        'Conqueror',
  'Press the Attack': 'PressTheAttack',
  'Lethal Tempo':     'LethalTempo',
  'Fleet Footwork':   'FleetFootwork',
  'Electrocute':      'Electrocute',
  'Dark Harvest':     'DarkHarvest',
  'Predator':         'Predator',
  'Arcane Comet':     'ArcaneComet',
  'Summon Aery':      'SummonAery',
  'Phase Rush':       'PhaseRush',
  'Grasp of the Undying': 'GraspOfTheUndying',
  'Aftershock':       'Aftershock',
  'Guardian':         'Guardian',
  'Glacial Augment':  'GlacialAugment',
  'First Strike':     'FirstStrike',
  // 'Hail of Blades' no está en el set de iconos de DD del proyecto → null.
};

// ─── Metadatos de árbol: etiqueta ES + color canónico de la rama ─────────────
// Los colores son los oficiales de cada rama de runas de LoL, que sobre el
// fondo OSCURO del champ select dan el contraste op.gg sin reactivar el tema
// claro.
export const TREE_META = {
  PRECISION:   { label: 'Precisión',   color: '#C8AA6E' }, // dorado
  DOMINATION:  { label: 'Dominación',  color: '#DC4747' }, // rojo
  SORCERY:     { label: 'Brujería',    color: '#9AA4F4' }, // azul/violeta
  RESOLVE:     { label: 'Valor',       color: '#A1D586' }, // verde
  INSPIRATION: { label: 'Inspiración', color: '#49C5D6' }, // cian
};

// ─── Fragmentos (3 shards) por arquetipo ─────────────────────────────────────
// Cada fila de shards de op.gg: ofensivo / flexible / defensivo. Elegimos el
// shard típico por arquetipo. Texto en ES (coherente con el resto de la app).
const FRAGMENTS = {
  ADC:     { offense: 'Vel. de ataque',  flex: 'Fuerza adaptativa', defense: 'Vida' },
  AP:      { offense: 'Fuerza adaptativa', flex: 'Fuerza adaptativa', defense: 'Vida' },
  AD:      { offense: 'Fuerza adaptativa', flex: 'Fuerza adaptativa', defense: 'Vida' },
  TANK:    { offense: 'Fuerza adaptativa', flex: 'Vida (escala)',     defense: 'Armadura / RM' },
  SUPPORT: { offense: 'Fuerza adaptativa', flex: 'Fuerza adaptativa', defense: 'Vida' },
};

// Etiquetas legibles del arquetipo (para el subtítulo de la página).
const ARCHETYPE_LABEL = {
  ADC:     'ADC / Tirador',
  AP:      'Mago AP',
  AD:      'Luchador / Asesino AD',
  TANK:    'Tanque / Iniciador',
  SUPPORT: 'Soporte',
};

// ─── Overrides de runas POR CAMPEÓN concreto (B1) ────────────────────────────
// El motor `recommendRunes` tiene una tabla curada (~30 campeones); el resto cae
// a UN default genérico por tipo de daño (AD→Conqueror, AP→Arcane Comet,
// MIXED→Hail of Blades). Eso hacía que muchos campeones — sobre todo ADCs del
// catálogo y picks del pool fuera de la tabla — compartieran EXACTAMENTE las
// mismas runas y parecieran "estáticas".
//
// Este mapa añade variación REAL por campeón. Misma forma que la tabla del
// motor: keystone + tree + 3 runas menores del primario + secondTree + 2 runas
// del secundario + notes. Las keystones se eligen del set con icono mapeado
// (KEYSTONE_ICON_KEY) para que el medallón se pinte, no un placeholder.
//
// IMPORTANTE: solo se aplica cuando el motor cayó al DEFAULT (campeón NO curado).
// Los campeones ya curados conservan su build + overrides de matchup del motor.
const CHAMPION_RUNE_OVERRIDES = {
  // ─── ADCs del catálogo (no curados en el motor) ──────────────────────────
  Ashe: {
    keystone: 'Lethal Tempo', tree: 'PRECISION',
    secondary: ['Presence of Mind', 'Legend: Alacrity', 'Coup de Grace'],
    secondTree: 'INSPIRATION',
    secondaryRunes: ['Biscuit Delivery', 'Cosmic Insight'],
    notes: 'Lethal Tempo + W (Volea) → attack speed sostenido para kitear y hacer poke a distancia.',
  },
  MissFortune: {
    keystone: 'Press the Attack', tree: 'PRECISION',
    secondary: ['Presence of Mind', 'Legend: Alacrity', 'Cut Down'],
    secondTree: 'DOMINATION',
    secondaryRunes: ['Cheap Shot', 'Treasure Hunter'],
    notes: 'Press the Attack + E (Lluvia de balas) → burst de teamfight con Doble Ataque y R.',
  },
  Ezreal: {
    keystone: 'First Strike', tree: 'INSPIRATION',
    secondary: ['Magical Footwear', 'Biscuit Delivery', 'Cosmic Insight'],
    secondTree: 'PRECISION',
    secondaryRunes: ['Presence of Mind', 'Legend: Alacrity'],
    notes: 'First Strike: oro extra por el poke constante de Q (Disparo místico) — Ezreal poke/escalado.',
  },
  Draven: {
    keystone: 'Press the Attack', tree: 'PRECISION',
    secondary: ['Triumph', 'Legend: Bloodline', 'Coup de Grace'],
    secondTree: 'DOMINATION',
    secondaryRunes: ['Sudden Impact', 'Treasure Hunter'],
    notes: 'Press the Attack + Hachas giratorias → snowball de lane bully; convierte bounties en ventaja.',
  },
  KogMaw: {
    keystone: 'Lethal Tempo', tree: 'PRECISION',
    secondary: ['Presence of Mind', 'Legend: Alacrity', 'Coup de Grace'],
    secondTree: 'SORCERY',
    secondaryRunes: ['Manaflow Band', 'Gathering Storm'],
    notes: 'Lethal Tempo + W (Bio-arcano) → rompe el cap de attack speed para DPS on-hit tardío.',
  },
  Tristana: {
    keystone: 'Press the Attack', tree: 'PRECISION',
    secondary: ['Triumph', 'Legend: Alacrity', 'Coup de Grace'],
    secondTree: 'DOMINATION',
    secondaryRunes: ['Sudden Impact', 'Treasure Hunter'],
    notes: 'Press the Attack para ventana de all-in con E (Carga explosiva) + salto reset.',
  },
  Sivir: {
    keystone: 'Fleet Footwork', tree: 'PRECISION',
    secondary: ['Presence of Mind', 'Legend: Alacrity', 'Coup de Grace'],
    secondTree: 'SORCERY',
    secondaryRunes: ['Manaflow Band', 'Gathering Storm'],
    notes: 'Fleet Footwork para sustain en lane + waveclear con W (Ricochet); R para engages de equipo.',
  },
  Twitch: {
    keystone: 'Lethal Tempo', tree: 'PRECISION',
    secondary: ['Triumph', 'Legend: Alacrity', 'Coup de Grace'],
    secondTree: 'DOMINATION',
    secondaryRunes: ['Sudden Impact', 'Treasure Hunter'],
    notes: 'Lethal Tempo + sigilo (Q) → spray-and-pray con E acumulando veneno en teamfight.',
  },
  Samira: {
    keystone: 'Conqueror', tree: 'PRECISION',
    secondary: ['Triumph', 'Legend: Alacrity', 'Last Stand'],
    secondTree: 'DOMINATION',
    secondaryRunes: ['Sudden Impact', 'Treasure Hunter'],
    notes: 'Conqueror para combos en rango cuerpo a cuerpo + sustain de su pasiva (Daredevil).',
  },
  Xayah: {
    keystone: 'Lethal Tempo', tree: 'PRECISION',
    secondary: ['Presence of Mind', 'Legend: Alacrity', 'Coup de Grace'],
    secondTree: 'RESOLVE',
    secondaryRunes: ['Bone Plating', 'Revitalize'],
    notes: 'Lethal Tempo + plumas (E) → DPS sostenido; R (Tormenta de plumas) como escape defensivo.',
  },
  Kalista: {
    keystone: 'Press the Attack', tree: 'PRECISION',
    secondary: ['Presence of Mind', 'Legend: Alacrity', 'Cut Down'],
    secondTree: 'DOMINATION',
    secondaryRunes: ['Sudden Impact', 'Relentless Hunter'],
    notes: 'Press the Attack + lanzas (Q) → lane bully temprano; Rend ejecuta tras acumular stacks.',
  },
  Aphelios: {
    keystone: 'Conqueror', tree: 'PRECISION',
    secondary: ['Presence of Mind', 'Legend: Alacrity', 'Coup de Grace'],
    secondTree: 'DOMINATION',
    secondaryRunes: ['Taste of Blood', 'Treasure Hunter'],
    notes: 'Conqueror para peleas largas — escala con el ciclo de armas y el doble buff de su R.',
  },
  Nilah: {
    keystone: 'Conqueror', tree: 'PRECISION',
    secondary: ['Triumph', 'Legend: Alacrity', 'Last Stand'],
    secondTree: 'RESOLVE',
    secondaryRunes: ['Bone Plating', 'Revitalize'],
    notes: 'Conqueror para trades cuerpo a cuerpo sostenidos + curación compartida (ADC melee).',
  },

  // ─── Picks del pool por defecto fuera de la tabla curada ─────────────────
  LeeSin: {
    keystone: 'Conqueror', tree: 'PRECISION',
    secondary: ['Triumph', 'Legend: Alacrity', 'Last Stand'],
    secondTree: 'DOMINATION',
    secondaryRunes: ['Sudden Impact', 'Relentless Hunter'],
    notes: 'Conqueror para skirmishes tempranos sostenidos; presión de gank con Q-Q insec.',
  },
};

/**
 * Deriva el arquetipo del campeón para elegir los fragmentos. Combina la
 * metadata del catálogo (role/damageType) con el árbol primario que ya eligió
 * `recommendRunes` (un keystone de RESOLVE implica build tanque aunque el
 * damageType sea AP, como Malphite/Amumu).
 *
 * @param {string} championId
 * @param {{tree?: string}} runes Resultado de recommendRunes (para leer el árbol).
 * @returns {'ADC'|'AP'|'AD'|'TANK'|'SUPPORT'}
 */
function classifyArchetype(championId, runes) {
  const meta = CHAMPION_BY_ID[championId];
  if (meta?.role === 'ADC') return 'ADC';
  if (meta?.role === 'SUPPORT') {
    // Soportes tanque (Leona, Naut, Thresh) llevan Resolve → fragmentos tanque.
    return runes?.tree === 'RESOLVE' ? 'TANK' : 'SUPPORT';
  }
  if (runes?.tree === 'RESOLVE') return 'TANK';
  if (meta?.damageType === 'AP') return 'AP';
  return 'AD';
}

/**
 * Compone la página de runas completa para un campeón, lista para renderizar.
 *
 * @param {string} championId - ID canónico (PascalCase) del campeón.
 * @param {Object} [opts]
 * @param {string[]} [opts.enemyTags] - Tags de la comp enemiga (de recommendPick);
 *                                       activan los overrides por matchup.
 * @returns {{
 *   champion: string,
 *   archetype: string,
 *   archetypeLabel: string,
 *   source: 'curated'|'default',
 *   overridden: boolean,
 *   notes: string,
 *   primary: {
 *     tree: string, treeLabel: string, color: string,
 *     keystone: string, keystoneIconKey: string|null,
 *     runes: string[]            // 3 runas menores del árbol primario
 *   },
 *   secondary: {
 *     tree: string, treeLabel: string, color: string,
 *     runes: string[]            // 2 runas del árbol secundario
 *   },
 *   fragments: { offense: string, flex: string, defense: string }
 * } | null}
 */
export function getRuneRecommendation(championId, opts = {}) {
  if (!championId) return null;

  const meta = CHAMPION_BY_ID[championId];
  const engine = recommendRunes(championId, {
    damageType: meta?.damageType,
    enemyTags:  Array.isArray(opts.enemyTags) ? opts.enemyTags : [],
  });

  // B1 — Override por campeón concreto SOLO cuando el motor cayó al default
  // genérico (campeón no curado): así los ADCs del catálogo y los picks del pool
  // fuera de la tabla dejan de compartir las mismas runas. Los curados conservan
  // su build + overrides de matchup (no se tocan).
  const override = CHAMPION_RUNE_OVERRIDES[championId];
  const base = (override && engine.source === 'default')
    ? { ...engine, ...override, source: 'curated' }
    : engine;

  const archetype = classifyArchetype(championId, base);
  const primaryMeta = TREE_META[base.tree] || { label: base.tree, color: '#C8AA6E' };
  const secMeta     = TREE_META[base.secondTree] || { label: base.secondTree, color: '#9AA4F4' };

  return {
    champion:       championId,
    archetype,
    archetypeLabel: ARCHETYPE_LABEL[archetype] || archetype,
    source:         base.source,
    overridden:     Boolean(base.overridden),
    notes:          base.notes,
    primary: {
      tree:            base.tree,
      treeLabel:       primaryMeta.label,
      color:           primaryMeta.color,
      keystone:        base.keystone,
      keystoneIconKey: KEYSTONE_ICON_KEY[base.keystone] || null,
      // OJO: en recommendRunes, `secondary` son las 3 runas MENORES del árbol
      // PRIMARIO (no del secundario, que son `secondaryRunes`). Aquí las
      // exponemos como `primary.runes` para evitar esa confusión aguas abajo.
      runes:           Array.isArray(base.secondary) ? base.secondary : [],
    },
    secondary: {
      tree:      base.secondTree,
      treeLabel: secMeta.label,
      color:     secMeta.color,
      runes:     Array.isArray(base.secondaryRunes) ? base.secondaryRunes : [],
    },
    fragments: FRAGMENTS[archetype] || FRAGMENTS.AD,
  };
}

export default getRuneRecommendation;
