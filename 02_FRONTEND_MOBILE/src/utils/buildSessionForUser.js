// ============================================================================
// buildSessionForUser.js — personaliza la sesión de demo con el usuario actual
// ----------------------------------------------------------------------------
// Construye la sesión de demo IN-GAME tomando MOCK_GAME_SESSION como base pero
// con la IDENTIDAD DEL USUARIO LOGUEADO: su main (slot 'main' del onboarding)
// como campeón jugado y su rol principal.
//
// Motivo: ProfileScreen abría el HUD con el mock crudo, así que enseñaba SIEMPRE
// el campeón del mock (Jinx) aunque el usuario hubiera elegido otro main. Este
// helper unifica esa ruta para que el HUD muestre el campeón correcto.
//
// Shape real de user.champions (no inventar campos):
// [{ championId: 'Lucian', priority: 1, displayName: 'Lucian', slot: 'main' },
// { championId: 'Ezreal', priority: 2, displayName: 'Ezreal', slot: 'secondary' }]
// ============================================================================

import { MOCK_GAME_SESSION } from '../mocks/mockGameSession';

/**
 * Sesión de demo personalizada para el usuario logueado.
 * Campeón jugado = main del pool (slot 'main'), o el primero del pool,
 * o el del mock como último recurso (cuenta demo sin pool).
 * Rol = mainRole del onboarding si existe.
 * El resto del mock (KDA, ítems, aliados, enemigos, alertas, mapa) se
 * conserva tal cual: es la situación táctica de la demo, no la identidad.
 *
 * @param {object|null} user usuario del UserContext (puede ser null)
 * @returns {object} sesión con el shape de MOCK_GAME_SESSION
 */
export function buildSessionForUser(user) {
  const champs = Array.isArray(user?.champions) ? user.champions : [];
  // El pool sellado (sealOnboardingPool) lleva el textual en `slotKind` y un
  // `slot` numérico; el demo aún usa slot:'main'. Aceptamos ambos shapes.
  const mainChamp =
    champs.find((c) => c?.slot === 'main' || c?.slotKind === 'main')?.championId
    || champs[0]?.championId
    || MOCK_GAME_SESSION.player.champion;

  const role = user?.mainRole || MOCK_GAME_SESSION.player.role;

  return {
    ...MOCK_GAME_SESSION,
    player: {
      ...MOCK_GAME_SESSION.player,
      champion: mainChamp,
      role,
    },
  };
}

export default buildSessionForUser;
