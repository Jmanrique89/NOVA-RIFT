// Cuenta oficial de demostración NOVA RIFT
// Cualquier usuario cuyo riotId contenga este string carga datos mock
export const DEMO_SUMMONER = 'FAKER';

// Devuelve true si el usuario es la cuenta demo
export function isDemoAccount(riotId) {
  if (!riotId) return false;
  return riotId.toUpperCase().includes(DEMO_SUMMONER.toUpperCase());
}

// Solo la cuenta FAKER usa mocks. El resto de usuarios ven el error real
// (estado "Sin conexión" / ErrorState) cuando Riot falla — nunca datos falsos.
export function useDemoData(riotId) {
  return isDemoAccount(riotId);
}
