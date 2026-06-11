// ============================================================================
// trophies.js — definición canónica de la Sala de Trofeos NOVA RIFT
// ----------------------------------------------------------------------------
// Antes vivía inline en `src/screens/ProfileScreen.js`. Movido aquí porque:
// El motor `src/utils/trophies.js` lo consume sin tocar la UI.
// Otros agentes / pantallas pueden necesitar listar trofeos (ej. progress
// embebido en HubScreen o coaching messages que referencien por id).
// El catálogo es contenido de producto, no de presentación.
//
// Cada trofeo declara:
// id → identificador estable para snapshots de AsyncStorage.
// name/icon → presentación.
// description → texto humano del criterio (mostrado al usuario).
// faction → facción ancla (futuro: tinte de la card si earned).
// target → umbral numérico que debe alcanzarse en la métrica.
// key → identificador del cálculo en `computeMetric` del motor.
// Valores soportados: csPerMin · vsPerMin · kda · kdaWr.
// window → cantidad de partidas recientes a evaluar.
//
// Las fórmulas exactas viven en `src/utils/trophies.js`.
// ============================================================================

export const ALL_TROPHIES = [
  {
    id:          'wuju_harvest',
    name:        'Wuju Harvest',
    icon:        'WH',
    description: 'Alcanza 7.0 CS/min de media en 5 partidas',
    faction:     'IONIA',
    target:      7.0,
    key:         'csPerMin',
    window:      5,
  },
  {
    id:          'ojos_vacio',
    name:        'Ojos del Vacío',
    icon:        'OV',
    description: 'Mantén 1.5 VS/min de media en 5 partidas',
    faction:     'DEMACIA',
    target:      1.5,
    key:         'vsPerMin',
    window:      5,
  },
  {
    id:          'estilo_ruler',
    name:        'Estilo Ruler',
    icon:        'ER',
    description: 'Consigue KDA ≥ 4.0 de media en 5 partidas',
    faction:     'NOXUS',
    target:      4.0,
    key:         'kda',
    window:      5,
  },
  {
    id:          'ingenio_plata',
    name:        'Ingenio de Plata',
    icon:        'IP',
    description: 'KDA ≥ 3.0 y WR ≥ 55% en 10 partidas',
    faction:     'ZAUN',
    target:      3.0,
    key:         'kdaWr',
    window:      10,
  },

  // ─── Nueva tanda de insignias (Hito ranks/recompensas) ────────────────────
  // Cada una declara `overlay` = tinte RGBA del portrait del campeón main del
  // jugador en el modal de celebración (BadgeUnlockModal). Si el motor no
  // reconoce `key`, el trofeo permanece bloqueado — útil mientras conectamos
  // los hooks de partidas analizadas / Vision Score sostenido / pool stats.
  {
    id:          'first_blood_coach',
    name:        'First Blood Coach',
    icon:        'FB',
    description: 'Analiza tus primeras 10 partidas con NOVA RIFT',
    faction:     'NOXUS',
    target:      10,
    key:         'matchesAnalyzed',
    window:      10,
    color:       '#FFD700',
    overlay:     'rgba(255,215,0,0.45)',
    reward:      'Marco dorado en tu próximo análisis',
  },
  {
    id:          'vision_master',
    name:        'Vision Master',
    icon:        'VM',
    description: 'Supera el target de Vision Score en 5 partidas seguidas',
    faction:     'DEMACIA',
    target:      5,
    key:         'visionStreak',
    window:      5,
    color:       '#00C8E0',
    overlay:     'rgba(0,200,224,0.40)',
    reward:      'Ping de visión dorado en LiveRift',
  },
  {
    id:          'farm_machine',
    name:        'Farm Machine',
    icon:        'FM',
    description: 'CS/min por encima del target durante 7 días seguidos',
    faction:     'IONIA',
    target:      7,
    key:         'farmStreakDays',
    window:      7,
    color:       '#7B76DD',
    overlay:     'rgba(123,118,221,0.45)',
    reward:      'Skin alternativa púrpura del portrait',
  },
  {
    id:          'pool_expert',
    name:        'Pool Expert',
    icon:        'PE',
    description: 'Juega 50 partidas con el mismo campeón',
    faction:     'ZAUN',
    target:      50,
    key:         'mainChampionGames',
    window:      50,
    color:       '#E0AA3E',
    overlay:     'rgba(224,170,62,0.50)',
    reward:      'Marco "Maestría" en tu campeón main',
  },
  {
    id:          'nova_veteran',
    name:        'Nova Veteran',
    icon:        'NV',
    description: 'Registra 100 partidas en NOVA RIFT',
    faction:     'IONIA',
    target:      100,
    key:         'totalMatches',
    window:      100,
    color:       '#C29BFF',
    overlay:     'rgba(194,155,255,0.50)',
    reward:      'Marco de perfil "Veterano" permanente',
  },
];

export default ALL_TROPHIES;
