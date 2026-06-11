// ============================================================================
// effectivePool.js — Caché de sesión del champion pool efectivo
// ----------------------------------------------------------------------------
// El pool efectivo de una cuenta REAL sin onboarding se deriva en HubScreen, que
// es quien tiene el `riotSummary` con las partidas reales. Otras pantallas
// (LiveScreen / asistente, ForgeScreen) NO cargan ese summary: solo reciben el
// objeto `user`. Para que el asistente preseleccione del pool efectivo y la
// forja muestre el main correcto sin duplicar la llamada de red, el Hub PUBLICA
// aquí los nombres del pool derivado y esas pantallas lo LEEN como fallback,
// después del pool de onboarding (`user.champions`) y antes del pool demo.
//
// Caché de proceso (vive mientras la app está abierta). Es deliberadamente
// simple: una sola cuenta activa por sesión de demo. Se sobreescribe cada vez
// que el Hub deriva, así que siempre refleja a la cuenta en uso.
// ============================================================================

let derivedPoolNames = null;
// Rango REAL de Riot (tier/división/LP) de la cuenta activa. Lo publica el Hub
// (que sí carga el summary) para que ForgeScreen muestre "Riot dice X" junto al
// ELO estimado sin volver a pedirlo. null en la cuenta demo (usa el mock).
let realRank = null;

/**
 * Publica el pool efectivo derivado de partidas reales (lo llama el Hub).
 * Ignora valores vacíos para no borrar un pool válido ya publicado.
 *
 * @param {string[]} names Nombres de campeón, del más jugado al menos.
 */
export function publishEffectivePool(names) {
  if (Array.isArray(names) && names.length > 0) {
    derivedPoolNames = names.slice();
  }
}

/**
 * Lee el pool efectivo publicado por el Hub.
 *
 * @returns {string[]|null} Nombres del pool, o null si el Hub aún no derivó.
 */
export function readEffectivePool() {
  return derivedPoolNames;
}

/**
 * Publica el rango real de Riot (lo llama el Hub para cuentas no-demo).
 * @param {{tier?: string, division?: string, lp?: number}} rank
 */
export function publishRealRank(rank) {
  if (rank && rank.tier) realRank = { tier: rank.tier, division: rank.division, lp: rank.lp };
}

/** Lee el rango real publicado por el Hub. null si no hay (cuenta demo). */
export function readRealRank() {
  return realRank;
}

/** Limpia la caché (p. ej. al cerrar sesión). */
export function clearEffectivePool() {
  derivedPoolNames = null;
  realRank = null;
}
