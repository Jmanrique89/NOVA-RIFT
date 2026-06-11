import { normalizeChampionName } from './championImage';

// Patch alineado con BRAIN.md / LoL-Research (16.8.1). Antes 14.24.1.
const DD_VERSION = '16.8.1';
const DD_BASE = `https://ddragon.leagueoflegends.com/cdn/${DD_VERSION}`;

// Square icon 120×120 (la cara que recorta Riot). Normalizamos el nombre al id
// de DD por si llega un display name con espacios/apóstrofos ("Miss Fortune").
export const getChampionImageUrl = (championName) =>
  `${DD_BASE}/img/champion/${normalizeChampionName(championName)}.png`;

export const getItemImageUrl = (itemId) =>
  `${DD_BASE}/img/item/${itemId}.png`;

export const getProfileIconUrl = (iconId) =>
  `${DD_BASE}/img/profileicon/${iconId}.png`;

// ── Iconos de hechizos de invocador (Data Dragon) ──────────────────
// Portado desde InGameHUD.js: Data Dragon usa IDs internos distintos al nombre
// visible, así que este mapa convierte el nombre legible al ID del sprite.
const SPELL_DD_ID = {
  Flash:     'SummonerFlash',
  Ignite:    'SummonerDot',
  Teleport:  'SummonerTeleport',
  Ghost:     'SummonerHaste',
  Exhaust:   'SummonerExhaust',
  Heal:      'SummonerHeal',
  Barrier:   'SummonerBarrier',
  Cleanse:   'SummonerBoost',
  Smite:     'SummonerSmite',
};

export const getSpellImageUrl = (spellName) => {
  const id = SPELL_DD_ID[spellName];
  if (!id) return null;
  return `${DD_BASE}/img/spell/${id}.png`;
};

// ── Iconos de runas / keystone (Data Dragon perk-icons) ────────────
// DataDragon sirve los iconos de perks bajo /cdn/img/<iconPath> SIN versión
// (los perk-images viven en un namespace estable, no versionado por patch).
// Mapeamos cada keystone a su ruta de icono oficial de DD.
const RUNE_DD_ICON = {
  // Precision
  PressTheAttack: 'perk-images/Styles/Precision/PressTheAttack/PressTheAttack.png',
  LethalTempo:    'perk-images/Styles/Precision/LethalTempo/LethalTempoTemp.png',
  FleetFootwork:  'perk-images/Styles/Precision/FleetFootwork/FleetFootwork.png',
  Conqueror:      'perk-images/Styles/Precision/Conqueror/Conqueror.png',
  // Domination
  Electrocute:    'perk-images/Styles/Domination/Electrocute/Electrocute.png',
  Predator:       'perk-images/Styles/Domination/Predator/Predator.png',
  DarkHarvest:    'perk-images/Styles/Domination/DarkHarvest/DarkHarvest.png',
  // Sorcery
  SummonAery:     'perk-images/Styles/Sorcery/SummonAery/SummonAery.png',
  Aery:           'perk-images/Styles/Sorcery/SummonAery/SummonAery.png',
  ArcaneComet:    'perk-images/Styles/Sorcery/ArcaneComet/ArcaneComet.png',
  Comet:          'perk-images/Styles/Sorcery/ArcaneComet/ArcaneComet.png',
  PhaseRush:      'perk-images/Styles/Sorcery/PhaseRush/PhaseRush.png',
  // Resolve
  GraspOfTheUndying: 'perk-images/Styles/Resolve/GraspOfTheUndying/GraspOfTheUndying.png',
  Aftershock:     'perk-images/Styles/Resolve/VeteranAftershock/VeteranAftershock.png',
  Guardian:       'perk-images/Styles/Resolve/Guardian/Guardian.png',
  // Inspiration
  GlacialAugment: 'perk-images/Styles/Inspiration/GlacialAugment/GlacialAugment.png',
  FirstStrike:    'perk-images/Styles/Inspiration/FirstStrike/FirstStrike.png',
};

export const getRuneImageUrl = (runeKey) => {
  const iconPath = RUNE_DD_ICON[runeKey];
  if (!iconPath) return null;
  return `https://ddragon.leagueoflegends.com/cdn/img/${iconPath}`;
};

export const ITEM_ID_MAP = {
  // Botas
  'Plated Steelcaps': 3047,
  "Mercury's Treads": 3111,
  'Sorcerer\'s Shoes': 3020,
  'Boots of Swiftness': 3009,
  'Ionian Boots of Lucidity': 3158,
  'Berserker\'s Greaves': 3006,
  'Mobility Boots': 1001,

  // Defensivos
  'Guardian Angel': 3026,
  "Zhonya's Hourglass": 3157,
  'Frozen Heart': 3110,
  "Randuin's Omen": 3143,
  'Maw of Malmortius': 3156,
  "Sterak's Gage": 3053,
  'Spirit Visage': 3065,
  'Warmog\'s Armor': 3083,
  'Sunfire Aegis': 3068,
  'Thornmail': 3075,
  'Gargoyle Stoneplate': 3193,
  'Jak\'Sho, The Protean': 6665,

  // Ofensivos AD
  'Infinity Edge': 3031,
  'Trinity Force': 3078,
  'Black Cleaver': 3071,
  'Kraken Slayer': 6672,
  "Death's Dance": 6333,
  'Ravenous Hydra': 3074,
  'Galeforce': 6631,
  'Lord Dominik\'s Regards': 3036,
  'Mortal Reminder': 3033,
  'Phantom Dancer': 3046,
  'Wit\'s End': 3091,

  // Ofensivos AP
  'Rabadon\'s Deathcap': 3089,
  'Luden\'s Tempest': 6655,
  'Shadowflame': 4645,
  'Void Staff': 3135,
  'Morellonomicon': 3165,
  'Riftmaker': 4633,
  'Cosmic Drive': 4629,
  'Nashor\'s Tooth': 3115,
  'Demonic Embrace': 4637,

  // Objetos de Jungla / Utilidad
  'Wardstone': 4642,
  'Analizador Hextech': 4005,
  'Escudo Vivo': 3800,
  'Redemption': 3107,
  'Aegis': 3105,

  // Alias en español (del mock backend)
  'Steelcaps': 3047,
  'Steelcaps con Placas': 3047,

  // Aliases para el MOCK_GAME_SESSION (InGameHUD demo) y la tienda
  'KrakenSlayer':          6672,
  'Kraken Slayer':         6672,
  'BF Sword':              1038,
  'Long Sword':            1036,
  'Amplifying Tome':       1052,
  'Ruby Crystal':          1028,
  'Cloth Armor':           1029,
  'Null-Magic Mantle':     1033,
  'Dagger':                1042,
  'Berserker Greaves':     3006,
  'Ionian Boots':          3158,
  'Rapid Firecannon':      3094,
  "Runaan's Hurricane":    3085,
  'Phantom Dancer':        3046,
  'Duskblade':             6691,
  'Edge of Night':         6692,
  "Serpent's Fang":        3172,
  "Dead Man's Plate":      3742,
  'Needlessly Large Rod':  1058,
  'Sheen':                 3057,
};

export const getItemIdByName = (itemName) => ITEM_ID_MAP[itemName] || null;

export const CHAMPION_ID_TO_NAME = {
  202: 'Jhin', 16: 'Soraka', 101: 'Xerath', 41: 'Gangplank',
  245: 'Ekko', 238: 'Zed', 37: 'Sona', 98: 'Shen',
  131: 'Diana', 222: 'Jinx', 99: 'Lux', 11: 'MasterYi',
  157: 'Yasuo', 64: 'LeeSin', 412: 'Thresh', 53: 'Blitzcrank',
  1: 'Annie', 51: 'Caitlyn', 22: 'Ashe', 114: 'Fiora',
  84: 'Akali', 12: 'Alistar', 24: 'Jax', 133: 'Quinn',
  8: 'Vladimir', 887: 'Gwen', 111: 'Nautilus', 106: 'Volibear',
  26: 'Zilean', 233: 'Briar'
};

export const fetchChampionMap = async () => {
  try {
    const res = await fetch(`${DD_BASE}/data/es_ES/champion.json`);
    const json = await res.json();
    const map = {};
    Object.values(json.data).forEach(champ => {
      map[parseInt(champ.key, 10)] = {
        name: champ.id,
        displayName: champ.name,
        tags: champ.tags,
        title: champ.title
      };
    });
    return map;
  } catch (e) {
    console.warn('DataDragon champion fetch failed, using fallback');
    return null;
  }
};

export const fetchItemMap = async () => {
  try {
    const res = await fetch(`${DD_BASE}/data/es_ES/item.json`);
    const json = await res.json();
    const map = {};
    Object.entries(json.data).forEach(([id, item]) => {
      map[item.name] = {
        id: parseInt(id, 10),
        description: item.plaintext,
        tags: item.tags,
        imageUrl: getItemImageUrl(parseInt(id, 10))
      };
    });
    return map;
  } catch (e) {
    console.warn('DataDragon item fetch failed, using fallback');
    return null;
  }
};
