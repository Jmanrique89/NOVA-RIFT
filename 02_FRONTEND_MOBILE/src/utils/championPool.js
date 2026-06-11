// ============================================================================
// championPool.js — Modelo de datos + DESBLOQUEO por progresión del pool 2+2
// ----------------------------------------------------------------------------
// Implementa el "champion pool 2+2".
//
// Por rol el usuario tiene 4 huecos (slots):
// slot 0 y slot 1 → ACTIVOS desde el principio (locked:false)
// slot 2 y slot 3 → BLOQUEADOS al cerrar el onboarding (locked:true)
//
// Los 2 huecos bloqueados se DESBLOQUEAN jugando partidas CON NOVA RIFT
// (recompensa de progresión por usar la app): cuando el usuario alcanza el
// umbral de partidas de un slot, ese slot pasa a locked:false de forma
// permanente.
//
// Este módulo es 100% PURO (sin React, sin AsyncStorage, sin UI): es la única
// fuente de verdad de los umbrales y de la transición locked→unlocked. Lo
// consumen:
// ChampionPickScreen (onboarding) → para SELLAR slot+locked al guardar.
// ForgeScreen (perfil/forja) → para APLICAR los desbloqueos según las
// partidas jugadas y PINTAR el progreso.
// recommendPick.recommendFromPool → ya lee el flag `locked` de cada entrada
// (NO se toca aquí; solo se le alimenta).
//
// Diseño deliberadamente conservador y ADITIVO: si una entrada antigua del pool
// no trae `locked`/`slot` (datos pre-mejora), se trata como DESBLOQUEADA para no
// romper cuentas existentes ni el flujo actual.
// ============================================================================

// ─── Configuración del pool 2+2 ─────────────────────────────────────────────
// Nº de huecos por rol y cuántos arrancan activos. El resto nacen bloqueados.
export const POOL_SLOTS_PER_ROLE = 4; // 2 activos + 2 bloqueados
export const ACTIVE_SLOTS        = 2; // los 2 primeros (slot 0 y 1) están siempre activos

// ─── Umbrales de desbloqueo (partidas jugadas con Nova Rift) ────────────────
// Mapa índice-de-slot → nº de partidas necesarias para desbloquearlo.
// El 3er hueco (índice 2) se desbloquea a las 10 partidas.
// El 4º hueco (índice 3) se desbloquea a las 25 partidas.
// Los slots 0 y 1 no aparecen aquí porque nunca están bloqueados.
//
// Elección de los números:
// 10 partidas ≈ una tarde/semana de juego casual → primer "premio" pronto,
// suficiente para enganchar sin regalar nada.
// 25 partidas ≈ varias semanas de uso sostenido → recompensa de fidelidad
// que premia seguir usando Nova Rift.
// Están centralizados aquí para poder ajustarlos en un solo sitio.
export const SLOT_UNLOCK_GAMES = {
  2: 10, // 3er slot
  3: 25, // 4º slot
};

// Orden visible de slots para iterar la UI (0..3).
export const SLOT_INDICES = Array.from({ length: POOL_SLOTS_PER_ROLE }, (_, i) => i);

/**
 * ¿El slot `index` nace bloqueado al crear el pool?
 * Verdadero para todo índice >= ACTIVE_SLOTS (es decir, el 3º y 4º).
 *
 * @param {number} index índice 0-based del slot dentro de su rol.
 * @returns {boolean}
 */
export function isSlotInitiallyLocked(index) {
  return index >= ACTIVE_SLOTS;
}

/**
 * Partidas necesarias para desbloquear el slot `index`.
 * Devuelve 0 para los slots activos (no requieren nada).
 *
 * @param {number} index
 * @returns {number} umbral de partidas (0 si el slot es activo).
 */
export function gamesRequiredForSlot(index) {
  return SLOT_UNLOCK_GAMES[index] || 0;
}

/**
 * Sella el campo `slot` (orden, 0-based) y `locked` (bool) sobre una lista PLANA
 * de campeones recién elegidos en el onboarding, AGRUPANDO por rol.
 *
 * Regla por rol: los 2 primeros campeones → locked:false; el 3º y 4º →
 * locked:true. El `slot` es el orden DENTRO de su rol (0..3), no el índice
 * global, para que el desbloqueo por slot funcione igual en todos los roles.
 *
 * Es tolerante con el shape de entrada (acepta los objetos que produce
 * ChampionPickScreen: `{championId, priority, displayName, slot:'main'|'secondary'}`)
 * y CONSERVA todas las claves originales; solo sobreescribe `slot` (a número) y
 * añade `locked` y `roleSlot`. La clave textual original `slot:'main'|'secondary'`
 * se preserva como `slotKind` para no perder la compat con HubScreen.
 *
 * @param {Array<object|string>} flatPool pool plano del onboarding.
 * @param {function} [roleOf] resolutor opcional id→rol; si no se pasa, se usa
 * el campo `.role`/`.roleKind` de la entrada o, en su
 * defecto, un único grupo (orden global).
 * @returns {Array<object>} mismas entradas con `slot`(number)+`locked`(bool)+`roleSlot`.
 */
export function sealOnboardingPool(flatPool, roleOf) {
  if (!Array.isArray(flatPool)) return [];

  // Contador de cuántos campeones llevamos por rol, para asignar el orden 0..3
  // dentro de cada rol. Si no podemos resolver el rol, todos caen en '__all__'
  // y el orden es global (comportamiento simple y predecible).
  const perRoleCount = {};

  return flatPool.map((entry) => {
    // Normalizamos a objeto (un string suelto se envuelve en {championId}).
    const base = (entry && typeof entry === 'object')
      ? { ...entry }
      : { championId: entry };

    // Resolver el rol de esta entrada (para agrupar el orden por rol).
    let role = '__all__';
    if (typeof roleOf === 'function') {
      role = roleOf(base.championId || base.id || base.displayName) || '__all__';
    } else if (base.role) {
      role = base.role;
    } else if (base.roleKind) {
      role = base.roleKind;
    }

    const orderInRole = perRoleCount[role] || 0;
    perRoleCount[role] = orderInRole + 1;

    // Preservamos la clave textual original ('main'|'secondary') por compat.
    const slotKind = typeof base.slot === 'string' ? base.slot : (base.slotKind || null);

    return {
      ...base,
      slotKind,                                   // 'main'|'secondary' (compat HubScreen)
      slot:     orderInRole,                      // orden 0-based DENTRO del rol
      roleSlot: orderInRole,                      // alias explícito por legibilidad
      locked:   isSlotInitiallyLocked(orderInRole),
    };
  });
}

/**
 * ¿Está bloqueada `entry` ahora mismo? Tolerante con datos antiguos:
 * Si `locked` es undefined (entrada pre-mejora) → NO bloqueada.
 * Si `locked === true/false` → se respeta.
 *
 * @param {object|string} entry
 * @returns {boolean}
 */
export function isEntryLocked(entry) {
  if (!entry || typeof entry !== 'object') return false;
  return entry.locked === true;
}

/**
 * Resuelve el índice de slot 0-based de una entrada, tolerando varios shapes:
 * `slot` numérico (modelo nuevo) → ese número.
 * `roleSlot` numérico → ese número.
 * `slot` textual 'main'/'secondary' (legacy) → null (no hay orden fiable).
 * Devuelve null si no se puede determinar.
 *
 * @param {object} entry
 * @returns {number|null}
 */
export function slotIndexOf(entry) {
  if (!entry || typeof entry !== 'object') return null;
  if (Number.isInteger(entry.slot))     return entry.slot;
  if (Number.isInteger(entry.roleSlot)) return entry.roleSlot;
  return null;
}

/**
 * APLICA LOS DESBLOQUEOS por progresión sobre un pool, dadas las partidas
 * jugadas con Nova Rift. Función PURA: no muta la entrada original, devuelve un
 * NUEVO array (y solo clona las entradas que cambian).
 *
 * Para cada entrada bloqueada cuyo slot ya alcanzó su umbral de partidas, pone
 * `locked:false`. El resto se devuelve intacto. Una entrada que ya estaba
 * desbloqueada nunca se vuelve a bloquear (el progreso es permanente).
 *
 * Es idempotente: aplicarla dos veces con el mismo `gamesPlayed` da el mismo
 * resultado. Tolera entradas sin `slot` numérico (las deja como están).
 *
 * @param {Array<object|string>} pool pool del usuario (array plano).
 * @param {number} gamesPlayed partidas jugadas con Nova Rift.
 * @returns {{ pool: Array, changed: boolean, unlockedSlots: number[] }}
 * pool: el pool (posiblemente con entradas desbloqueadas).
 * changed: true si alguna entrada pasó de locked a unlocked.
 * unlockedSlots: índices de slot que se desbloquearon en ESTA llamada.
 */
export function applyUnlocks(pool, gamesPlayed) {
  if (!Array.isArray(pool)) return { pool: [], changed: false, unlockedSlots: [] };
  const games = Number.isFinite(gamesPlayed) ? gamesPlayed : 0;

  let changed = false;
  const unlockedSlots = [];

  const next = pool.map((entry) => {
    // Strings o entradas no-objeto: nada que desbloquear (se tratan como activas).
    if (!entry || typeof entry !== 'object') return entry;
    if (entry.locked !== true) return entry; // ya desbloqueada → intacta

    const idx = slotIndexOf(entry);
    if (idx === null) return entry; // sin orden fiable → no tocamos

    const required = gamesRequiredForSlot(idx);
    // required === 0 significaría un slot "activo" marcado locked por error;
    // lo desbloqueamos igualmente (defensivo). Si hay umbral, exigimos llegar.
    if (required === 0 || games >= required) {
      changed = true;
      unlockedSlots.push(idx);
      return { ...entry, locked: false };
    }
    return entry;
  });

  return { pool: changed ? next : pool, changed, unlockedSlots };
}

/**
 * Calcula el ESTADO DE PROGRESO de cada slot bloqueado para pintarlo en la UI
 * (barra "X/N partidas para desbloquear"). NO modifica nada; solo describe.
 *
 * Recorre los huecos bloqueados que aún no llegaron a su umbral y, para cada
 * uno, devuelve cuántas partidas faltan y la fracción 0..1 de progreso.
 *
 * @param {Array<object>} pool pool del usuario.
 * @param {number} gamesPlayed partidas jugadas con Nova Rift.
 * @returns {Array<{ slot:number, championId:(string|null), required:number,
 * gamesPlayed:number, remaining:number, progress:number }>}
 * Una entrada por hueco bloqueado pendiente, ordenada por slot.
 */
export function describeLockedProgress(pool, gamesPlayed) {
  if (!Array.isArray(pool)) return [];
  const games = Number.isFinite(gamesPlayed) ? gamesPlayed : 0;

  return pool
    .filter((e) => isEntryLocked(e))
    .map((e) => {
      const slot = slotIndexOf(e);
      const required = slot === null ? 0 : gamesRequiredForSlot(slot);
      const remaining = Math.max(0, required - games);
      const progress = required > 0 ? Math.max(0, Math.min(1, games / required)) : 1;
      return {
        slot,
        championId: e.championId || e.id || e.displayName || null,
        required,
        gamesPlayed: games,
        remaining,
        progress,
      };
    })
    // Solo los que aún no se han alcanzado (los que ya llegan deberían pasar por
    // applyUnlocks, pero filtramos por robustez de la UI).
    .filter((p) => p.remaining > 0 && p.slot !== null)
    .sort((a, b) => a.slot - b.slot);
}

/**
 * Resuelve cuántas PARTIDAS CON NOVA RIFT tiene el usuario, tolerando los
 * distintos shapes que maneja la app. Útil para que las pantallas no repitan
 * la misma cascada de fallbacks. Orden de preferencia:
 * 1. `user.gamesPlayed` (campo explícito, si el backend lo expone).
 * 2. `user.recentMatches.length` (partidas reales cargadas).
 * 3. `fallbackGames` (p.ej. mock NOVA_GLOBAL_STATS.gamesPlayed).
 *
 * @param {object} user
 * @param {number} [fallbackGames=0]
 * @returns {number}
 */
export function resolveGamesPlayed(user, fallbackGames = 0) {
  if (user && Number.isFinite(user.gamesPlayed)) return user.gamesPlayed;
  if (user && Array.isArray(user.recentMatches) && user.recentMatches.length > 0) {
    return user.recentMatches.length;
  }
  return Number.isFinite(fallbackGames) ? fallbackGames : 0;
}
