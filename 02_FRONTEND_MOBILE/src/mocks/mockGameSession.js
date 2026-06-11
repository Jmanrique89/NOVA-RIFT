// ============================================================================
// mockGameSession.js — fuente de verdad para la demo IN-GAME
// ----------------------------------------------------------------------------
// Datos ultra-realistas basados en un matchup real de botlane (mock 1). El
// jugador es NovaRift con Jinx ADC, facción ZAUN, en mid-game contra la
// composición Garen / LeeSin / Zed / Lucian / Morgana.
//
// Este objeto alimenta:
// LiveScreen (estado IN-GAME) — ver `src/screens/LiveScreen.js`
// FloatingRadarWidget (cuando hay gameSession activa) — ver el widget
// El botón "SIMULAR PARTIDA EN VIVO" del HubScreen (modo demo)
//
// Cuando exista la integración real con Riot Live Client (post-TFG), el
// shape de este objeto será el contrato a respetar — el resto del front
// se acopla a estos campos, no al mock.
// ============================================================================

export const MOCK_GAME_SESSION = {
  active:   true,
  gameTime: 847,            // segundos → 14:07
  phase:    'MID_GAME',     // 'EARLY' | 'MID_GAME' | 'LATE'

  // ─── El jugador ──────────────────────────────────────────────────────────
  player: {
    champion: 'Jinx',
    role:     'ADC',
    level:    11,
    kda:      { kills: 3, deaths: 1, assists: 7 },
    cs:       98,
    csPerMin: 6.9,
    gold:     7340,
    // NOTA: el InGameHUD ya NO lee estos campos. El ITEM TRACKER se rellena con
    // lo que el jugador compra de verdad (purchasedItems) y el SIGUIENTE ITEM se
    // deriva de la build elegida (activeBuild.core, primer ítem sin comprar). El
    // campo `nextItem` se ELIMINÓ a propósito (H2): era estático y se filtraba al
    // card "SIGUIENTE ITEM". El FloatingRadarWidget lo lee con guarda opcional
    // (`player.nextItem && …`), así que su ausencia no rompe nada.
    items:    ['KrakenSlayer', 'BF Sword', 'Long Sword', null, null, null],
    spells:   { flash: true, heal: true },
  },

  // ─── Aliados ─────────────────────────────────────────────────────────────
  allies: [
    { champion: 'Ornn',   role: 'TOP',     kda: '2/1/3', alive: true  },
    { champion: 'Vi',     role: 'JUNGLE',  kda: '4/2/5', alive: true  },
    { champion: 'Ryze',   role: 'MID',     kda: '1/3/4', alive: false },
    { champion: 'Thresh', role: 'SUPPORT', kda: '0/1/9', alive: true  },
  ],

  // ─── Enemigos ────────────────────────────────────────────────────────────
  enemies: [
    { champion: 'Garen',   role: 'TOP',     flashUp: true,  summoners: ['Flash', 'Teleport'] },
    { champion: 'LeeSin',  role: 'JUNGLE',  flashUp: false, summoners: ['Flash', 'Smite']    }, // flash caído → ventana de 5 min
    { champion: 'Zed',     role: 'MID',     flashUp: true,  summoners: ['Flash', 'Ignite']   },
    { champion: 'Lucian',  role: 'ADC',     flashUp: true,  summoners: ['Flash', 'Heal']     },
    { champion: 'Morgana', role: 'SUPPORT', flashUp: true,  summoners: ['Flash', 'Exhaust']  },
  ],

  // ─── Estado del mapa ─────────────────────────────────────────────────────
  map: {
    dragonSoul:      null,
    nextDragonSpawn: 187,    // segundos hasta el próximo dragón
    baronAlive:      true,
    baronSpawn:      613,    // segundos hasta Baron
    grubs:           3,      // tomados
  },

  // ─── Alertas activas (motor táctico) ─────────────────────────────────────
  // Orden = prioridad descendente. La primera es la "alerta principal" que
  // muestra el FloatingRadarWidget cuando está en active+gameSession.
  alerts: [
    {
      type:     'FLASH_DOWN',
      priority: 'HIGH',
      icon:     'flash',
      text:     'Lee Sin sin Flash — ventana de 5 min. Juega agresivo en su jungla.',
      color:    '#FFB300',
    },
    {
      type:     'WIN_CONDITION',
      priority: 'HIGH',
      icon:     'target',
      text:     'Composición Full-Teamfight. Agrúpate con Ornn. Tú escalas — no te adelantes.',
      color:    '#7B76DD',
    },
    {
      type:     'POWER_SPIKE',
      priority: 'MED',
      icon:     'spike',
      text:     'A 2 ítems serás imparable. Farm seguro hasta Infinity Edge.',
      color:    '#00C8E0',
    },
  ],

  // ─── Coaching por facción ────────────────────────────────────────────────
  coaching: {
    ZAUN:    'Adapta el play. Thresh amaga el hook para forzar el escudo de Morgana — entonces atacas.',
    NOXUS:   'Lee Sin sin Flash = kill gratis. Pide a Vi que invada su jungla ahora.',
    DEMACIA: 'Farm seguro hasta Infinity Edge. Tu valor explota en late con Ornn.',
    IONIA:   'Composición de teamfight. Posiciónate perfecta — un error con 3 ítems y es GG.',
  },
};

/** Devuelve el mensaje de coaching del game session para la facción dada. */
export function getGameCoaching(faction) {
  const key = String(faction || '').toUpperCase();
  return MOCK_GAME_SESSION.coaching[key] || MOCK_GAME_SESSION.coaching.DEMACIA;
}

/** Formatea segundos en mm:ss. */
export function formatGameTime(seconds) {
  const safe = Math.max(0, Math.floor(seconds || 0));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
