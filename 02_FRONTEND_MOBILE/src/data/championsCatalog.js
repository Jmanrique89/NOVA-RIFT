// ============================================================================
// championsCatalog — datos curados para el algoritmo recommendChampions
// ----------------------------------------------------------------------------
// Cada champion lleva:
// id → ID Data Dragon (PascalCase, ej. "MissFortune")
// displayName → nombre legible
// role → rol primario LoL
// playstyles → array de perfiles compatibles (puede ser >1)
// difficulty → 1-10 (Riot's official difficulty curve, redondeada)
// ranged → true/false
// damageType → AD | AP | MIXED
//
// Algoritmo de scoring: recommendChampions(...) más abajo.
// ============================================================================
// El campo opcional `secondaryRoles: string[]` indica los roles donde el
// campeón es viable además del primario. Cubre los flex picks canónicos
// del meta competitivo (Yasuo MID+TOP, Sylas MID+JUNGLE, Sett TOP+SUPPORT,
// etc.). El motor `recommendPick` lo consulta cuando el usuario filtra por
// `selectedRole` para no excluir flex picks útiles.

export const CHAMPIONS = [
  // ─── TOP ─────────────────────────────────────────────────────────────────
  { id: 'Garen',       displayName: 'Garen',        role: 'TOP',     playstyles: ['DOMINANTE', 'AGRESIVO'],   difficulty: 2, ranged: false, damageType: 'AD'    },
  { id: 'Darius',      displayName: 'Darius',       role: 'TOP',     playstyles: ['AGRESIVO', 'DOMINANTE'],   difficulty: 4, ranged: false, damageType: 'AD'    },
  { id: 'Fiora',       displayName: 'Fiora',        role: 'TOP',     playstyles: ['DOMINANTE'],               difficulty: 7, ranged: false, damageType: 'AD'    },
  { id: 'Jax',         displayName: 'Jax',          role: 'TOP',     playstyles: ['DOMINANTE', 'TACTICO'],    difficulty: 5, ranged: false, damageType: 'MIXED' },
  { id: 'Malphite',    displayName: 'Malphite',     role: 'TOP',     playstyles: ['TACTICO', 'SUPPORTIVE'],   difficulty: 3, ranged: false, damageType: 'AP'   , secondaryRoles: ['SUPPORT'] },
  { id: 'Mordekaiser', displayName: 'Mordekaiser',  role: 'TOP',     playstyles: ['DOMINANTE', 'AGRESIVO'],   difficulty: 4, ranged: false, damageType: 'AP'   , secondaryRoles: ['JUNGLE'] },
  { id: 'Sett',        displayName: 'Sett',         role: 'TOP',     playstyles: ['AGRESIVO', 'SUPPORTIVE'],  difficulty: 4, ranged: false, damageType: 'AD'   , secondaryRoles: ['SUPPORT'] },
  { id: 'Camille',     displayName: 'Camille',      role: 'TOP',     playstyles: ['AGRESIVO', 'DOMINANTE'],   difficulty: 7, ranged: false, damageType: 'AD'    },
  { id: 'Riven',       displayName: 'Riven',        role: 'TOP',     playstyles: ['AGRESIVO'],                difficulty: 8, ranged: false, damageType: 'AD'    },
  { id: 'Tryndamere',  displayName: 'Tryndamere',   role: 'TOP',     playstyles: ['DOMINANTE', 'AGRESIVO'],   difficulty: 5, ranged: false, damageType: 'AD'    },

  // ─── JUNGLE ──────────────────────────────────────────────────────────────
  { id: 'MasterYi',    displayName: 'Master Yi',    role: 'JUNGLE',  playstyles: ['TACTICO', 'AGRESIVO'],     difficulty: 4, ranged: false, damageType: 'AD'    },
  { id: 'LeeSin',      displayName: 'Lee Sin',      role: 'JUNGLE',  playstyles: ['AGRESIVO'],                difficulty: 7, ranged: false, damageType: 'AD'    },
  { id: 'Warwick',     displayName: 'Warwick',      role: 'JUNGLE',  playstyles: ['AGRESIVO', 'SUPPORTIVE'],  difficulty: 3, ranged: false, damageType: 'MIXED' },
  { id: 'Vi',          displayName: 'Vi',           role: 'JUNGLE',  playstyles: ['AGRESIVO', 'SUPPORTIVE'],  difficulty: 4, ranged: false, damageType: 'AD'    },
  { id: 'Amumu',       displayName: 'Amumu',        role: 'JUNGLE',  playstyles: ['SUPPORTIVE', 'TACTICO'],   difficulty: 3, ranged: false, damageType: 'AP'    },
  { id: 'Diana',       displayName: 'Diana',        role: 'JUNGLE',  playstyles: ['AGRESIVO'],                difficulty: 5, ranged: false, damageType: 'AP'   , secondaryRoles: ['MID'] },
  { id: 'KhaZix',      displayName: "Kha'Zix",      role: 'JUNGLE',  playstyles: ['AGRESIVO'],                difficulty: 6, ranged: false, damageType: 'AD'    },
  { id: 'Hecarim',     displayName: 'Hecarim',      role: 'JUNGLE',  playstyles: ['AGRESIVO', 'DOMINANTE'],   difficulty: 6, ranged: false, damageType: 'AD'    },
  { id: 'Sejuani',     displayName: 'Sejuani',      role: 'JUNGLE',  playstyles: ['SUPPORTIVE', 'TACTICO'],   difficulty: 4, ranged: false, damageType: 'AP'   , secondaryRoles: ['TOP'] },

  // ─── MID ─────────────────────────────────────────────────────────────────
  { id: 'Annie',       displayName: 'Annie',        role: 'MID',     playstyles: ['AGRESIVO', 'TACTICO'],     difficulty: 2, ranged: true,  damageType: 'AP'   , secondaryRoles: ['SUPPORT'] },
  { id: 'Veigar',      displayName: 'Veigar',       role: 'MID',     playstyles: ['TACTICO'],                 difficulty: 4, ranged: true,  damageType: 'AP'    },
  { id: 'Ahri',        displayName: 'Ahri',         role: 'MID',     playstyles: ['AGRESIVO', 'TACTICO'],     difficulty: 5, ranged: true,  damageType: 'AP'    },
  { id: 'Zed',         displayName: 'Zed',          role: 'MID',     playstyles: ['AGRESIVO'],                difficulty: 7, ranged: false, damageType: 'AD'    },
  { id: 'Yasuo',       displayName: 'Yasuo',        role: 'MID',     playstyles: ['AGRESIVO', 'DOMINANTE'],   difficulty: 9, ranged: false, damageType: 'AD'   , secondaryRoles: ['TOP'] },
  { id: 'Kassadin',    displayName: 'Kassadin',     role: 'MID',     playstyles: ['TACTICO'],                 difficulty: 5, ranged: false, damageType: 'AP'    },
  { id: 'Orianna',     displayName: 'Orianna',      role: 'MID',     playstyles: ['TACTICO', 'SUPPORTIVE'],   difficulty: 7, ranged: true,  damageType: 'AP'    },
  { id: 'Katarina',    displayName: 'Katarina',     role: 'MID',     playstyles: ['AGRESIVO'],                difficulty: 7, ranged: false, damageType: 'AP'    },
  { id: 'Syndra',      displayName: 'Syndra',       role: 'MID',     playstyles: ['AGRESIVO', 'TACTICO'],     difficulty: 7, ranged: true,  damageType: 'AP'    },

  // ─── ADC ─────────────────────────────────────────────────────────────────
  { id: 'Ashe',        displayName: 'Ashe',         role: 'ADC',     playstyles: ['TACTICO', 'SUPPORTIVE'],   difficulty: 4, ranged: true,  damageType: 'AD'   , secondaryRoles: ['SUPPORT'] },
  { id: 'Caitlyn',     displayName: 'Caitlyn',      role: 'ADC',     playstyles: ['TACTICO', 'AGRESIVO'],     difficulty: 5, ranged: true,  damageType: 'AD'    },
  { id: 'Jinx',        displayName: 'Jinx',         role: 'ADC',     playstyles: ['TACTICO', 'DOMINANTE'],    difficulty: 6, ranged: true,  damageType: 'AD'    },
  { id: 'MissFortune', displayName: 'Miss Fortune', role: 'ADC',     playstyles: ['AGRESIVO'],                difficulty: 5, ranged: true,  damageType: 'AD'   , secondaryRoles: ['SUPPORT'] },
  { id: 'Ezreal',      displayName: 'Ezreal',       role: 'ADC',     playstyles: ['TACTICO', 'SUPPORTIVE'],   difficulty: 7, ranged: true,  damageType: 'MIXED' },
  { id: 'Vayne',       displayName: 'Vayne',        role: 'ADC',     playstyles: ['DOMINANTE', 'AGRESIVO'],   difficulty: 8, ranged: true,  damageType: 'AD'   , secondaryRoles: ['TOP'] },
  { id: 'Lucian',      displayName: 'Lucian',       role: 'ADC',     playstyles: ['AGRESIVO'],                difficulty: 6, ranged: true,  damageType: 'AD'   , secondaryRoles: ['MID'] },
  { id: 'Jhin',        displayName: 'Jhin',         role: 'ADC',     playstyles: ['TACTICO', 'AGRESIVO'],     difficulty: 6, ranged: true,  damageType: 'AD'    },

  // ─── TOP (ampliado) ──────────────────────────────────────────────────────
  { id: 'Shen',        displayName: 'Shen',         role: 'TOP',     playstyles: ['SUPPORTIVE', 'TACTICO'],   difficulty: 5, ranged: false, damageType: 'MIXED', secondaryRoles: ['SUPPORT'] },
  { id: 'Kennen',      displayName: 'Kennen',       role: 'TOP',     playstyles: ['AGRESIVO', 'TACTICO'],     difficulty: 5, ranged: true,  damageType: 'AP'   , secondaryRoles: ['MID'] },
  { id: 'Illaoi',      displayName: 'Illaoi',       role: 'TOP',     playstyles: ['DOMINANTE', 'AGRESIVO'],   difficulty: 5, ranged: false, damageType: 'AD'    },
  { id: 'Teemo',       displayName: 'Teemo',        role: 'TOP',     playstyles: ['TACTICO', 'AGRESIVO'],     difficulty: 5, ranged: true,  damageType: 'AP'   , secondaryRoles: ['MID'] },
  { id: 'Irelia',      displayName: 'Irelia',       role: 'TOP',     playstyles: ['AGRESIVO', 'DOMINANTE'],   difficulty: 8, ranged: false, damageType: 'AD'   , secondaryRoles: ['MID'] },
  { id: 'Aatrox',      displayName: 'Aatrox',       role: 'TOP',     playstyles: ['AGRESIVO', 'DOMINANTE'],   difficulty: 6, ranged: false, damageType: 'AD'    },
  { id: 'Urgot',       displayName: 'Urgot',        role: 'TOP',     playstyles: ['DOMINANTE'],               difficulty: 5, ranged: true,  damageType: 'AD'    },
  { id: 'Nasus',       displayName: 'Nasus',        role: 'TOP',     playstyles: ['DOMINANTE', 'TACTICO'],    difficulty: 3, ranged: false, damageType: 'AD'    },
  { id: 'Vladimir',    displayName: 'Vladimir',     role: 'TOP',     playstyles: ['DOMINANTE', 'TACTICO'],    difficulty: 6, ranged: false, damageType: 'AP'   , secondaryRoles: ['MID'] },
  { id: 'Cho\'Gath',   displayName: "Cho'Gath",     role: 'TOP',     playstyles: ['DOMINANTE', 'SUPPORTIVE'], difficulty: 3, ranged: false, damageType: 'AP'   , secondaryRoles: ['JUNGLE'] },
  { id: 'Ornn',        displayName: 'Ornn',         role: 'TOP',     playstyles: ['SUPPORTIVE', 'TACTICO'],   difficulty: 5, ranged: false, damageType: 'AP'    },
  { id: 'Gwen',        displayName: 'Gwen',         role: 'TOP',     playstyles: ['DOMINANTE', 'AGRESIVO'],   difficulty: 6, ranged: false, damageType: 'AP'    },
  { id: 'Renekton',    displayName: 'Renekton',     role: 'TOP',     playstyles: ['AGRESIVO', 'DOMINANTE'],   difficulty: 4, ranged: false, damageType: 'AD'    },
  { id: 'Pantheon',    displayName: 'Pantheon',     role: 'TOP',     playstyles: ['AGRESIVO'],                difficulty: 4, ranged: false, damageType: 'AD'   , secondaryRoles: ['MID', 'SUPPORT'] },
  { id: 'Gragas',      displayName: 'Gragas',       role: 'TOP',     playstyles: ['AGRESIVO', 'TACTICO'],     difficulty: 5, ranged: false, damageType: 'AP'   , secondaryRoles: ['JUNGLE', 'MID'] },
  { id: 'Wukong',      displayName: 'Wukong',       role: 'TOP',     playstyles: ['AGRESIVO', 'DOMINANTE'],   difficulty: 4, ranged: false, damageType: 'AD'   , secondaryRoles: ['JUNGLE'] },

  // ─── JUNGLE (ampliado) ───────────────────────────────────────────────────
  { id: 'Graves',      displayName: 'Graves',       role: 'JUNGLE',  playstyles: ['AGRESIVO'],                difficulty: 6, ranged: true,  damageType: 'AD'    },
  { id: 'Ekko',        displayName: 'Ekko',         role: 'JUNGLE',  playstyles: ['AGRESIVO', 'TACTICO'],     difficulty: 7, ranged: false, damageType: 'AP'   , secondaryRoles: ['MID'] },
  { id: 'Evelynn',     displayName: 'Evelynn',      role: 'JUNGLE',  playstyles: ['AGRESIVO'],                difficulty: 5, ranged: false, damageType: 'AP'    },
  { id: 'Shaco',       displayName: 'Shaco',        role: 'JUNGLE',  playstyles: ['AGRESIVO', 'TACTICO'],     difficulty: 8, ranged: false, damageType: 'AD'   , secondaryRoles: ['SUPPORT'] },
  { id: 'Nocturne',    displayName: 'Nocturne',     role: 'JUNGLE',  playstyles: ['AGRESIVO', 'DOMINANTE'],   difficulty: 4, ranged: false, damageType: 'AD'   , secondaryRoles: ['MID'] },
  { id: 'Nunu',        displayName: 'Nunu & Willump',role: 'JUNGLE', playstyles: ['SUPPORTIVE', 'AGRESIVO'],  difficulty: 3, ranged: false, damageType: 'AP'    },
  { id: 'RekSai',      displayName: "Rek'Sai",      role: 'JUNGLE',  playstyles: ['AGRESIVO', 'TACTICO'],     difficulty: 6, ranged: false, damageType: 'AD'    },
  { id: 'Sylas',       displayName: 'Sylas',        role: 'JUNGLE',  playstyles: ['AGRESIVO'],                difficulty: 7, ranged: false, damageType: 'AP'   , secondaryRoles: ['MID'] },
  { id: 'Viego',       displayName: 'Viego',        role: 'JUNGLE',  playstyles: ['AGRESIVO', 'DOMINANTE'],   difficulty: 6, ranged: false, damageType: 'AD'   , secondaryRoles: ['TOP'] },
  { id: 'Kindred',     displayName: 'Kindred',      role: 'JUNGLE',  playstyles: ['AGRESIVO', 'TACTICO'],     difficulty: 6, ranged: true,  damageType: 'AD'    },
  { id: 'Rammus',      displayName: 'Rammus',       role: 'JUNGLE',  playstyles: ['SUPPORTIVE', 'TACTICO'],   difficulty: 3, ranged: false, damageType: 'AP'    },

  // ─── MID (ampliado) ──────────────────────────────────────────────────────
  { id: 'Malzahar',    displayName: 'Malzahar',     role: 'MID',     playstyles: ['TACTICO', 'AGRESIVO'],     difficulty: 4, ranged: true,  damageType: 'AP'    },
  { id: 'Viktor',      displayName: 'Viktor',       role: 'MID',     playstyles: ['TACTICO'],                 difficulty: 7, ranged: true,  damageType: 'AP'    },
  { id: 'TwistedFate', displayName: 'Twisted Fate', role: 'MID',     playstyles: ['TACTICO'],                 difficulty: 7, ranged: true,  damageType: 'MIXED' },
  { id: 'Fizz',        displayName: 'Fizz',         role: 'MID',     playstyles: ['AGRESIVO'],                difficulty: 6, ranged: false, damageType: 'AP'   , secondaryRoles: ['JUNGLE'] },
  { id: 'Akali',       displayName: 'Akali',        role: 'MID',     playstyles: ['AGRESIVO'],                difficulty: 8, ranged: false, damageType: 'AP'   , secondaryRoles: ['TOP'] },
  { id: 'Leblanc',     displayName: 'LeBlanc',      role: 'MID',     playstyles: ['AGRESIVO', 'TACTICO'],     difficulty: 8, ranged: true,  damageType: 'AP'    },
  { id: 'Yone',        displayName: 'Yone',         role: 'MID',     playstyles: ['AGRESIVO', 'DOMINANTE'],   difficulty: 7, ranged: false, damageType: 'MIXED', secondaryRoles: ['TOP'] },
  { id: 'Corki',       displayName: 'Corki',        role: 'MID',     playstyles: ['TACTICO', 'AGRESIVO'],     difficulty: 7, ranged: true,  damageType: 'MIXED' },
  { id: 'Cassiopeia',  displayName: 'Cassiopeia',   role: 'MID',     playstyles: ['DOMINANTE', 'TACTICO'],    difficulty: 8, ranged: true,  damageType: 'AP'    },
  { id: 'Galio',       displayName: 'Galio',        role: 'MID',     playstyles: ['TACTICO', 'SUPPORTIVE'],   difficulty: 5, ranged: false, damageType: 'AP'   , secondaryRoles: ['SUPPORT'] },
  { id: 'Talon',       displayName: 'Talon',        role: 'MID',     playstyles: ['AGRESIVO'],                difficulty: 6, ranged: false, damageType: 'AD'   , secondaryRoles: ['JUNGLE'] },
  { id: 'Xerath',      displayName: 'Xerath',       role: 'MID',     playstyles: ['TACTICO'],                 difficulty: 6, ranged: true,  damageType: 'AP'   , secondaryRoles: ['SUPPORT'] },

  // ─── ADC (ampliado) ──────────────────────────────────────────────────────
  { id: 'Draven',      displayName: 'Draven',       role: 'ADC',     playstyles: ['AGRESIVO', 'DOMINANTE'],   difficulty: 9, ranged: true,  damageType: 'AD'    },
  { id: 'KogMaw',      displayName: "Kog'Maw",      role: 'ADC',     playstyles: ['DOMINANTE', 'SUPPORTIVE'], difficulty: 6, ranged: true,  damageType: 'MIXED' },
  { id: 'Tristana',    displayName: 'Tristana',     role: 'ADC',     playstyles: ['AGRESIVO', 'DOMINANTE'],   difficulty: 6, ranged: true,  damageType: 'AD'    },
  { id: 'Sivir',       displayName: 'Sivir',        role: 'ADC',     playstyles: ['TACTICO', 'DOMINANTE'],    difficulty: 4, ranged: true,  damageType: 'AD'    },
  { id: 'Twitch',      displayName: 'Twitch',       role: 'ADC',     playstyles: ['AGRESIVO', 'DOMINANTE'],   difficulty: 6, ranged: true,  damageType: 'AD'   , secondaryRoles: ['JUNGLE'] },
  { id: 'Samira',      displayName: 'Samira',       role: 'ADC',     playstyles: ['AGRESIVO'],                difficulty: 8, ranged: true,  damageType: 'AD'    },
  { id: 'Xayah',       displayName: 'Xayah',        role: 'ADC',     playstyles: ['AGRESIVO', 'TACTICO'],     difficulty: 7, ranged: true,  damageType: 'AD'    },
  { id: 'Kalista',     displayName: 'Kalista',      role: 'ADC',     playstyles: ['TACTICO'],                 difficulty: 9, ranged: true,  damageType: 'AD'    },
  { id: 'Aphelios',    displayName: 'Aphelios',     role: 'ADC',     playstyles: ['TACTICO', 'AGRESIVO'],     difficulty: 10,ranged: true,  damageType: 'AD'    },
  { id: 'Nilah',       displayName: 'Nilah',        role: 'ADC',     playstyles: ['AGRESIVO', 'DOMINANTE'],   difficulty: 7, ranged: false, damageType: 'AD'    },

  // ─── SUPPORT ─────────────────────────────────────────────────────────────
  { id: 'Soraka',      displayName: 'Soraka',       role: 'SUPPORT', playstyles: ['SUPPORTIVE'],              difficulty: 3, ranged: true,  damageType: 'AP'    },
  { id: 'Janna',       displayName: 'Janna',        role: 'SUPPORT', playstyles: ['SUPPORTIVE'],              difficulty: 4, ranged: true,  damageType: 'AP'    },
  { id: 'Lulu',        displayName: 'Lulu',         role: 'SUPPORT', playstyles: ['SUPPORTIVE'],              difficulty: 5, ranged: true,  damageType: 'AP'    },
  { id: 'Leona',       displayName: 'Leona',        role: 'SUPPORT', playstyles: ['AGRESIVO', 'SUPPORTIVE'],  difficulty: 4, ranged: false, damageType: 'AP'    },
  { id: 'Thresh',      displayName: 'Thresh',       role: 'SUPPORT', playstyles: ['TACTICO', 'SUPPORTIVE'],   difficulty: 7, ranged: false, damageType: 'AP'    },
  { id: 'Nautilus',    displayName: 'Nautilus',     role: 'SUPPORT', playstyles: ['SUPPORTIVE', 'AGRESIVO'],  difficulty: 5, ranged: false, damageType: 'AP'   , secondaryRoles: ['TOP'] },
  { id: 'Blitzcrank',  displayName: 'Blitzcrank',   role: 'SUPPORT', playstyles: ['AGRESIVO', 'TACTICO'],     difficulty: 4, ranged: true,  damageType: 'AP'    },
  { id: 'Pyke',        displayName: 'Pyke',         role: 'SUPPORT', playstyles: ['AGRESIVO'],                difficulty: 7, ranged: false, damageType: 'AD'   , secondaryRoles: ['MID'] },
  { id: 'Nami',        displayName: 'Nami',         role: 'SUPPORT', playstyles: ['SUPPORTIVE', 'TACTICO'],   difficulty: 5, ranged: true,  damageType: 'AP'    },
  { id: 'Morgana',     displayName: 'Morgana',      role: 'SUPPORT', playstyles: ['TACTICO', 'SUPPORTIVE'],   difficulty: 3, ranged: true,  damageType: 'AP'   , secondaryRoles: ['MID'] },
  { id: 'Lux',         displayName: 'Lux',          role: 'SUPPORT', playstyles: ['TACTICO', 'AGRESIVO'],     difficulty: 5, ranged: true,  damageType: 'AP'   , secondaryRoles: ['MID'] },
  { id: 'Sona',        displayName: 'Sona',         role: 'SUPPORT', playstyles: ['SUPPORTIVE'],              difficulty: 3, ranged: true,  damageType: 'AP'    },
  { id: 'Braum',       displayName: 'Braum',        role: 'SUPPORT', playstyles: ['SUPPORTIVE', 'AGRESIVO'],  difficulty: 4, ranged: false, damageType: 'AP'    },
  { id: 'Karma',       displayName: 'Karma',        role: 'SUPPORT', playstyles: ['SUPPORTIVE', 'AGRESIVO'],  difficulty: 4, ranged: true,  damageType: 'AP'   , secondaryRoles: ['MID'] },
  { id: 'Zilean',      displayName: 'Zilean',       role: 'SUPPORT', playstyles: ['TACTICO', 'SUPPORTIVE'],   difficulty: 7, ranged: true,  damageType: 'AP'    },
  { id: 'Milio',       displayName: 'Milio',        role: 'SUPPORT', playstyles: ['SUPPORTIVE'],              difficulty: 4, ranged: true,  damageType: 'AP'    },
  { id: 'Renata',      displayName: 'Renata Glasc', role: 'SUPPORT', playstyles: ['SUPPORTIVE', 'TACTICO'],   difficulty: 6, ranged: true,  damageType: 'AP'    },
  { id: 'RenataGlasc', displayName: 'Renata Glasc', role: 'SUPPORT', playstyles: ['SUPPORTIVE', 'TACTICO'],   difficulty: 6, ranged: true,  damageType: 'AP'    },
  { id: 'Alistar',     displayName: 'Alistar',      role: 'SUPPORT', playstyles: ['AGRESIVO', 'SUPPORTIVE'],  difficulty: 5, ranged: false, damageType: 'AP'    },
  { id: 'TahmKench',   displayName: 'Tahm Kench',   role: 'SUPPORT', playstyles: ['SUPPORTIVE', 'DOMINANTE'], difficulty: 4, ranged: false, damageType: 'AP'   , secondaryRoles: ['TOP'] },
];

// ─── Algoritmo de recomendación ───────────────────────────────────────────
const ADJACENT = {
  AGRESIVO:   'DOMINANTE',
  DOMINANTE:  'AGRESIVO',
  TACTICO:    'SUPPORTIVE',
  SUPPORTIVE: 'TACTICO',
};

function playstyleFit(c, playstyle) {
  if (!playstyle) return 25;                  // sin perfil = neutral medio
  if (c.playstyles.includes(playstyle)) return 45;
  const adj = ADJACENT[playstyle];
  if (adj && c.playstyles.includes(adj)) return 25;
  return 0;
}

function rolFit(c, mainRole, secondaryRole) {
  if (c.role === mainRole)      return 35;
  if (c.role === secondaryRole) return 20;
  return 0;
}

function difficultyFit(c) {
  if (c.difficulty <= 3) return 20;
  if (c.difficulty <= 6) return 15;
  if (c.difficulty <= 8) return 10;
  return 5;
}

/**
 * Filtra catálogo por las 5 respuestas del ChampionQuiz.
 * Las preferencias suaves restan score, las duras filtran.
 */
function passesQuiz(c, q) {
  if (!q) return true;
  // Q5: ranged vs melee — filtro DURO si el usuario lo eligió
  if (q.range === 'RANGED' && !c.ranged) return false;
  if (q.range === 'MELEE'  &&  c.ranged) return false;
  // Q4: damage type — filtro DURO si AD o AP elegidos (NO si "no me importa")
  if (q.damage === 'AD' && c.damageType === 'AP') return false;
  if (q.damage === 'AP' && c.damageType === 'AD') return false;
  return true;
}

function quizSoftBonus(c, q) {
  let bonus = 0;
  if (!q) return 0;
  // Q1: kill speed (BURST → low diff bonus) vs TANK
  if (q.killStyle === 'BURST'   && c.playstyles.includes('AGRESIVO')) bonus += 4;
  if (q.killStyle === 'TANK'    && c.playstyles.includes('SUPPORTIVE')) bonus += 4;
  // Q2: solo vs team
  if (q.teamFit === 'SOLO'      && c.playstyles.includes('DOMINANTE')) bonus += 3;
  if (q.teamFit === 'TEAM'      && c.playstyles.includes('SUPPORTIVE')) bonus += 3;
  // Q3: simple vs complex
  if (q.complexity === 'SIMPLE' && c.difficulty <= 4) bonus += 4;
  if (q.complexity === 'COMPLEX' && c.difficulty >= 7) bonus += 4;
  return bonus;
}

/**
 * Recomienda los TOP N campeones para el perfil del jugador.
 *
 * @param {object} profile { mainRole, secondaryRole, playstyle, quizAnswers, isNewbie }
 * @param {number} n cantidad a devolver (default 5)
 * @returns {array} champions ordenados desc por score
 */
export function recommendChampions(profile, n = 5) {
  const { mainRole, secondaryRole, playstyle, quizAnswers, isNewbie = false } = profile || {};
  const scored = CHAMPIONS
    .filter(c => !isNewbie || c.difficulty < 8)
    .filter(c => passesQuiz(c, quizAnswers))
    .map(c => {
      const ps = playstyleFit(c, playstyle);
      const ro = rolFit(c, mainRole, secondaryRole);
      const di = difficultyFit(c);
      const base  = (ps * 0.45) + (ro * 0.35) + (di * 0.20);
      const bonus = quizSoftBonus(c, quizAnswers);
      return { ...c, score: base + bonus };
    })
    .sort((a, b) => b.score - a.score);

  // Asegurar diversidad — no todos del mismo rol si no es lo que el user pidió
  // (relajamos solo si quedan menos de N picks tras filtrar)
  return scored.slice(0, n);
}

/**
 * Para el quiz de ROL (camino B): pesos por opción.
 * Devuelve el rol con más puntos.
 */
export function detectRoleFromAnswers(answers) {
  const score = { TOP: 0, JUNGLE: 0, MID: 0, ADC: 0, SUPPORT: 0 };
  Object.values(answers).forEach(roles => {
    if (Array.isArray(roles)) roles.forEach(r => { if (score[r] !== undefined) score[r] += 1; });
    else if (typeof roles === 'string' && score[roles] !== undefined) score[roles] += 1;
  });
  let best = 'MID', bestScore = -1;
  Object.entries(score).forEach(([k, v]) => { if (v > bestScore) { best = k; bestScore = v; } });
  return { best, score };
}

/**
 * Para el playstyle test: cuenta A/B/C/D y mapea al perfil.
 */
export const PLAYSTYLE_PROFILES = {
  AGRESIVO:   { code: 'AGRESIVO',   title: 'El Cazador',     desc: 'Vives para el kill. Snowboleas sin piedad.' },
  TACTICO:    { code: 'TACTICO',    title: 'El Escalador',   desc: 'Farmeas con precisión. Late game imbatible.' },
  SUPPORTIVE: { code: 'SUPPORTIVE', title: 'El Guardián',    desc: 'Tu equipo es tu prioridad. Tus carries no mueren.' },
  DOMINANTE:  { code: 'DOMINANTE',  title: 'El Presionador', desc: 'El mapa es tuyo. Splitpush, torres, presión.' },
};

export function detectPlaystyle(answersByLetter) {
  // answersByLetter = ['A','C','B','D','A'] (5 respuestas)
  const map = { A: 'AGRESIVO', B: 'TACTICO', C: 'SUPPORTIVE', D: 'DOMINANTE' };
  const counts = { AGRESIVO: 0, TACTICO: 0, SUPPORTIVE: 0, DOMINANTE: 0 };
  answersByLetter.slice(0, 4).forEach(letter => {
    const profile = map[letter];
    if (profile) counts[profile] += 1;
  });
  // Empate → desempata Q5
  let max = 0, winners = [];
  Object.entries(counts).forEach(([p, n]) => {
    if (n > max) { max = n; winners = [p]; }
    else if (n === max) winners.push(p);
  });
  if (winners.length === 1) return PLAYSTYLE_PROFILES[winners[0]];
  // Desempate por Q5
  const tieBreaker = map[answersByLetter[4]];
  if (tieBreaker && winners.includes(tieBreaker)) return PLAYSTYLE_PROFILES[tieBreaker];
  return PLAYSTYLE_PROFILES[winners[0]];
}
