// ============================================================================
// presentationScenarios.js — escenarios pre-grabados para "Modo Presentación"
// ----------------------------------------------------------------------------
// Set de 4 escenarios que rotan cada 8 segundos en el
// InGameHUD cuando el usuario activa el modo presentación. Permite ver
// el sistema completo (alerts, coaching, threat assessment) sin tocar
// nada — una demostración autónoma de la arquitectura.
//
// Cada escenario es un patch parcial sobre `MOCK_GAME_SESSION`:
// Override de `alerts` (set distinto de tipos de alerta).
// Override de `coaching` (mensaje principal coherente con la situación).
// Override de `phase` y `gameTime` para mostrar progresión temporal.
// Override del `nextItem` del player.
//
// El mergeo se hace en `getPresentationScene(idx)` — es shallow merge sobre
// las claves overridable; el resto del session base se mantiene.
// ============================================================================

/**
 * Catálogo de escenarios. Diseñados para mostrar 4 momentos clave de una
 * partida competitiva en orden cronológico:
 *
 * 1. EARLY · primeros 10 min — establecimiento, flash tracking.
 * 2. MID-GAME · 14-20 min — power spikes, decisiones de macro.
 * 3. LATE-GAME · 25-30 min — baron, teamfights, splitpush.
 * 4. CLUTCH · 32+ min — terminación, win condition crítica.
 *
 * Cada escenario tiene 3 alerts en orden de prioridad (HIGH → MED → LOW).
 * El primer alert es el que el FloatingRadarWidget muestra en idle.
 */
export const PRESENTATION_SCENARIOS = [
  // ─── 1. EARLY · 8:24 ─────────────────────────────────────────────────────
  {
    id: 'EARLY_FLASH_TRACKING',
    label: 'Early · Flash Tracking',
    phase: 'EARLY',
    gameTime: 504,
    nextItem: {
      name: 'B.F. Sword',
      reason: 'Spike de daño antes del 1er Dragón. Recall en próxima wave.',
    },
    alerts: [
      {
        type: 'FLASH_DOWN',
        priority: 'HIGH',
        icon: 'flash',
        text: 'Zed gastó Flash. Ventana de 5 min — pide gank a Vi para snowball.',
        color: '#FFB300',
      },
      {
        type: 'OBJECTIVE',
        priority: 'MED',
        icon: 'dragon',
        text: 'Dragón en 45s. Pushea wave y baja a setup. Ward en pixel.',
        color: '#00C8E0',
      },
      {
        type: 'TIP',
        priority: 'LOW',
        icon: 'tip',
        text: 'Estás a 30 CS por delante de Lucian. Mantén la presión sin overextender.',
        color: '#7B76DD',
      },
    ],
    coaching: {
      ZAUN:    'Forzando el reset post-dragón. Buy Pickaxe + Long Sword + boots T1.',
      NOXUS:   'Zed sin flash = kill garantizado. Coordina dive con Vi al minuto 11.',
      DEMACIA: 'Farma seguro hasta B.F. Sword. Mantén tu lead en CS, no fuerces.',
      IONIA:   'Wave management ganando — empuja antes del recall, libera presión bot.',
    },
  },

  // ─── 2. MID-GAME · 14:07 ─────────────────────────────────────────────────
  {
    id: 'MID_POWER_SPIKE',
    label: 'Mid · Power Spike',
    phase: 'MID_GAME',
    gameTime: 847,
    nextItem: {
      name: 'Infinity Edge',
      reason: 'Tu spike llega con 2 ítems. Prioridad máxima.',
    },
    alerts: [
      {
        type: 'WIN_CONDITION',
        priority: 'HIGH',
        icon: 'target',
        text: 'Composición Full-Teamfight. Agrúpate con Ornn. Tú escalas — no te adelantes.',
        color: '#7B76DD',
      },
      {
        type: 'POWER_SPIKE',
        priority: 'MED',
        icon: 'spike',
        text: 'A 2 ítems serás imparable. Farm seguro hasta Infinity Edge.',
        color: '#00C8E0',
      },
      {
        type: 'POSITIONING',
        priority: 'MED',
        icon: 'shield',
        text: 'Lee Sin viendo en bot. Wards en tribush + alarma. No farmees solo.',
        color: '#FFB300',
      },
    ],
    coaching: {
      ZAUN:    'Adapta el play. Thresh amaga el hook para forzar el escudo de Morgana.',
      NOXUS:   'Lee Sin sin Flash = kill gratis. Pide a Vi que invada su jungla ahora.',
      DEMACIA: 'Farm seguro hasta Infinity Edge. Tu valor explota en late con Ornn.',
      IONIA:   'Posiciónate perfecta — un error con 3 ítems y es GG.',
    },
  },

  // ─── 3. LATE-GAME · 26:18 — Baron decision ───────────────────────────────
  {
    id: 'LATE_BARON_CALL',
    label: 'Late · Baron Call',
    phase: 'LATE',
    gameTime: 1578,
    nextItem: {
      name: "Mortal Reminder",
      reason: 'Aatrox enemigo casi 2-shot. Grievous Wounds antes del Baron.',
    },
    alerts: [
      {
        type: 'OBJECTIVE',
        priority: 'HIGH',
        icon: 'crown',
        text: 'Baron en 12s. Vis 3 enemigos en bot. Toma Baron AHORA — counter pick imposible.',
        color: '#FF5252',
      },
      {
        type: 'THREAT',
        priority: 'HIGH',
        icon: 'warn',
        text: 'Zed con Hourglass — su all-in dura 4s. Cluster con Ornn antes del fight.',
        color: '#FFB300',
      },
      {
        type: 'WIN_CONDITION',
        priority: 'MED',
        icon: 'trophy',
        text: 'Con Baron buff: pushea mid, derriba 2 torres, presiona 3 Inhibidores.',
        color: '#7B76DD',
      },
    ],
    coaching: {
      ZAUN:    'Baron call ahora — el caos los va a confundir. Engage con Vi al primer ward.',
      NOXUS:   'Baron es tuyo. Si vienen, smite-steal con Vi. Tras buff: terminar partida.',
      DEMACIA: 'Disciplina. Baron, recall organizado, push controlado mid-bot.',
      IONIA:   'Baron + visión total = control absoluto del mapa. Una decisión correcta gana.',
    },
  },

  // ─── 4. CLUTCH · 32:45 — Match point ─────────────────────────────────────
  {
    id: 'CLUTCH_MATCH_POINT',
    label: 'Clutch · Match Point',
    phase: 'LATE',
    gameTime: 1965,
    nextItem: {
      name: 'Guardian Angel',
      reason: 'Match point — un revive vale el ACE. Cierra ahora con seguridad.',
    },
    alerts: [
      {
        type: 'WIN_CONDITION',
        priority: 'HIGH',
        icon: 'trophy',
        text: 'Match point. Solo un teamfight nos separa del nexus. Posición perfecta o GG.',
        color: '#7B76DD',
      },
      {
        type: 'THREAT',
        priority: 'HIGH',
        icon: 'skull',
        text: 'Karthus enemigo con ulti lista (60s). Después del fight, watch tu HP <40%.',
        color: '#FF5252',
      },
      {
        type: 'POSITIONING',
        priority: 'MED',
        icon: 'target',
        text: 'Tras Ornn engage: tú entras al frenesí. Q reset rocket + ulti = ACE.',
        color: '#7B76DD',
      },
    ],
    coaching: {
      ZAUN:    'Caos final. Trampas en jungla enemiga, hook surprise. Cierra con estilo.',
      NOXUS:   'Sangre fría. Posición. ACE. Nexus. Sin pausas, sin dudas.',
      DEMACIA: 'Disciplina hasta el último segundo. No fuerces si Karthus está vivo.',
      IONIA:   'Cada segundo cuenta. Respira, posiciona, ejecuta. La perfección gana partidas.',
    },
  },
];

/**
 * Devuelve el escenario actual según el índice del rotador.
 * Si idx > length, hace módulo (loop infinito).
 */
export function getPresentationScene(idx) {
  if (!Number.isFinite(idx) || idx < 0) return PRESENTATION_SCENARIOS[0];
  return PRESENTATION_SCENARIOS[idx % PRESENTATION_SCENARIOS.length];
}

/**
 * Aplica un escenario sobre la sesión base. Shallow merge — el escenario
 * sobreescribe `phase`, `gameTime`, `alerts`, `coaching`, `player.nextItem`.
 */
export function applyPresentationScene(baseSession, scene) {
  if (!baseSession || !scene) return baseSession;
  return {
    ...baseSession,
    phase:    scene.phase,
    gameTime: scene.gameTime,
    alerts:   scene.alerts,
    coaching: scene.coaching,
    player: {
      ...baseSession.player,
      nextItem: scene.nextItem,
    },
  };
}

/** Duración (ms) de cada escenario antes de rotar al siguiente. */
export const PRESENTATION_SCENE_DURATION_MS = 8000;
