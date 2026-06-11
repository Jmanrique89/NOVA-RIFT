// ============================================================================
// demoSession.js — Mock estático para flujo DEMO sin backend
// ----------------------------------------------------------------------------
// El backend puede estar caído, sin Riot API o lento. El usuario NovaRift/DEMO/MOCK
// debe poder navegar la app entera con datos creíbles, instantáneamente.
//
// Este archivo replica el shape del JSON que devolvería el endpoint
// POST /api/v1/live/start cuando funciona — pero servido client-side.
// ============================================================================

export const DEMO_SUMMONERS = ['NovaRift', 'DEMO', 'MOCK'];

/**
 * Detecta si el invocador es uno de los test users que NUNCA tocan el backend.
 * Acepta cualquiera de estos formatos (case-insensitive):
 * NovaRift NovaRift-EUW NovaRift#EUW
 * demo DEMO-NA Demo#KR
 * MOCK mock-LAS
 */
export const isDemoSummoner = (summonerName) => {
  if (!summonerName) return false;
  // Splittear tanto por '-' como por '#' y quedarnos con el primer fragmento.
  // Comparamos case-insensitive contra el array de demo summoners.
  const namePart = summonerName.split(/[-#]/)[0].trim().toUpperCase();
  return DEMO_SUMMONERS.some(d => d.toUpperCase() === namePart);
};

// Draft enemigo simulado (forma compatible con el parser de LiveScreen)
const ENEMY_DRAFT = {
  gameId: 'demo-001',
  gameMode: 'CLASSIC',
  gameStartTime: Date.now() - 900000, // 15 min en juego
  participants: [
    // Equipo aliado (teamId 100)
    { summonerName: 'NovaRift',      championId: 236, teamId: 100 },
    { summonerName: 'AllyTop',      championId: 516, teamId: 100 },
    { summonerName: 'AllyJungle',   championId: 254, teamId: 100 },
    { summonerName: 'AllyMid',      championId: 13,  teamId: 100 },
    { summonerName: 'AllySupport',  championId: 412, teamId: 100 },
    // Equipo enemigo (teamId 200)
    { summonerName: 'EnemyADC',     championId: 222, teamId: 200 },
    { summonerName: 'EnemyTop',     championId: 86,  teamId: 200 },
    { summonerName: 'EnemyJungle',  championId: 64,  teamId: 200 },
    { summonerName: 'EnemyMid',     championId: 238, teamId: 200 },
    { summonerName: 'EnemySupport', championId: 25,  teamId: 200 },
  ],
};

// Build recomendada (forma del JSON que devuelve el motor)
const RECOMMENDED_BUILD = {
  primaryTarget: 'Optimización por Motor Inteligente v1.0.0-phase1',
  items: ['Plated Steelcaps', "Zhonya's Hourglass", 'Maw of Malmortius', 'Frozen Heart', 'Guardian Angel'],
  tactics: 'Zhonya supera a Mercury\'s Treads en 12.4 puntos — clara primera opción',
  variants: [
    {
      name: "Zhonya's Hourglass Build",
      primaryTarget: 'Stasis 2.5s contra burst AD asesinos',
      items: ["Zhonya's Hourglass"],
      tactics: 'Score: 78.2 | Confianza: 85%',
    },
    {
      name: 'Plated Steelcaps Build',
      primaryTarget: 'Reduce dano de ataques basicos AD en un 12%',
      items: ['Plated Steelcaps'],
      tactics: 'Score: 71.5 | Confianza: 82%',
    },
    {
      name: 'Maw of Malmortius Build',
      primaryTarget: 'Escudo anti-AP al bajar de 50% HP',
      items: ['Maw of Malmortius'],
      tactics: 'Score: 65.8 | Confianza: 78%',
    },
  ],
};

// Items rankeados (output completo del scoring engine)
const RECOMMENDATION_ITEMS = [
  {
    itemId: '3157', itemName: "Zhonya's Hourglass",
    scoreTotal: 78.2, confidence: 0.85,
    threatMitigation: 92, matchupValue: 76, timingFit: 75, synergyScore: 70,
    explanation: 'Stasis 2.5s contra burst AD - counter critico de asesinos | Mitigación: 92 | Valor matchup: 76',
  },
  {
    itemId: '3047', itemName: 'Plated Steelcaps',
    scoreTotal: 71.5, confidence: 0.82,
    threatMitigation: 85, matchupValue: 70, timingFit: 90, synergyScore: 65,
    explanation: 'Reduce dano de ataques basicos AD en un 12% | Mitigación: 85 | Valor matchup: 70',
  },
  {
    itemId: '3156', itemName: 'Maw of Malmortius',
    scoreTotal: 65.8, confidence: 0.78,
    threatMitigation: 86, matchupValue: 68, timingFit: 75, synergyScore: 62,
    explanation: 'Escudo anti-AP al bajar de 50% HP - sobrevive el burst | Mitigación: 86 | Valor matchup: 68',
  },
  {
    itemId: '3110', itemName: 'Frozen Heart',
    scoreTotal: 62.4, confidence: 0.74,
    threatMitigation: 80, matchupValue: 65, timingFit: 75, synergyScore: 60,
    explanation: 'Reduce velocidad de ataque enemiga en area en 20%',
  },
  {
    itemId: '3026', itemName: 'Guardian Angel',
    scoreTotal: 58.9, confidence: 0.71,
    threatMitigation: 78, matchupValue: 60, timingFit: 50, synergyScore: 65,
    explanation: 'Resucita tras morir con 50% HP/Mana - clutch en teamfights',
  },
];

const THREAT_ASSESSMENT = {
  threatScore: 82,
  damageProfile: 'AD',
  ccTags: ['STUN', 'KNOCKUP', 'ROOT'],
  triggeredRules: 6,
};

const RECOMMENDATION_REASONS = [
  'Perfil de daño enemigo: AD (Zed + Lee Sin + Garen + Jinx)',
  'Nivel de amenaza: 82/100 — alta presión asesina',
  'CC detectado: STUN, KNOCKUP, ROOT',
  'Item principal: Zhonya\'s Hourglass (score 78.2)',
  'Trade-off: Zhonya supera a Mercury\'s Treads en 12.4 puntos',
];

/**
 * Devuelve la respuesta exacta que daría POST /api/v1/live/start para NovaRift.
 * El frontend la consume idéntica al backend.
 */
export function buildDemoLiveSession(summonerName) {
  return {
    id: -1,
    summonerName: summonerName || 'NovaRift',
    enemyDraftPattern: JSON.stringify(ENEMY_DRAFT),
    recommendedFirstBuy: JSON.stringify(RECOMMENDED_BUILD),
    status: 'ACTIVE',
    startedAt: new Date().toISOString(),

    recommendationVersion: 'v1.0.0-phase1',
    recommendationScore: 78.2,
    recommendationTotalScore: 78.2,
    recommendationConfidence: 0.85,
    recommendationBreakdown: JSON.stringify({
      policyVersion: 'v1.0.0-phase1',
      confidence: 0.85,
      topFactors: RECOMMENDATION_REASONS,
      tradeoff: 'Zhonya supera a Mercury\'s Treads en 12.4 puntos — clara primera opción',
      threat: {
        score: 82, damageProfile: 'AD',
        ccTags: ['STUN', 'KNOCKUP', 'ROOT'],
        rulesTriggered: 6,
      },
      items: RECOMMENDATION_ITEMS.map(i => ({
        name: i.itemName, score: i.scoreTotal, threat: i.threatMitigation,
        matchup: i.matchupValue, timing: i.timingFit,
        synergy: i.synergyScore, confidence: i.confidence,
      })),
    }),

    recommendationItems: RECOMMENDATION_ITEMS,
    recommendationReasons: RECOMMENDATION_REASONS,
    threatAssessment: THREAT_ASSESSMENT,

    isMockClientSide: true, // marcador para debugging
  };
}
