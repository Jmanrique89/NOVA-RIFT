// ============================================================================
// adminConfig — Lista de Riot IDs con acceso al panel de administración
// ----------------------------------------------------------------------------
// Hardcoded para la demo. En producción esto vendría del backend
// como un claim del JWT (`isAdmin`/`role: 'ADMIN'`) y se evaluaría en el
// gate de navegación en lugar de comparar strings client-side.
// ============================================================================

export const ADMIN_RIOT_IDS = [
  'jorgemlara',  // autor
  'Faker#EUW',   // mock admin para demo
  'admin#NOVA',  // cuenta de admin para defensa
];

/**
 * Devuelve true si el riotId pertenece a un administrador.
 * Coincidencia case-insensitive y tolerante: acepta tanto el ID completo
 * `nombre#TAG` como solo el nombre (los entries de ADMIN_RIOT_IDS pueden
 * tener o no la parte `#TAG`).
 */
export function isAdminUser(riotId) {
  if (!riotId || typeof riotId !== 'string') return false;
  const lower = riotId.toLowerCase();
  return ADMIN_RIOT_IDS.some(id => {
    const idLower = id.toLowerCase();
    if (lower === idLower) return true;
    // El input del usuario empieza por el nombre admin (sin tag)
    const nameOnly = idLower.split('#')[0];
    return lower.startsWith(nameOnly);
  });
}
