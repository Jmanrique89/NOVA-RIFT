// ============================================================================
// FATE — contexto del equipo por partida (deeplol-inspired)
// ----------------------------------------------------------------------------
// Mide a tus ALIADOS, no a ti — reduce el estrés de ranked separando "yo
// jugué bien" de "el equipo sostuvo la partida". Se deriva del KDA medio de
// los 4 aliados (excluyéndote a ti).
//
// Sin iconos — la FateBadge en HubScreen ya pinta un dot del color
// semántico de la fate; el texto y el color cuentan la historia.
// ============================================================================

export const FATE = {
  GODLIKE:     { text: 'Godlike',     color: '#FFC93C', desc: 'Tu equipo dominó' },
  SOLID:       { text: 'Solid',       color: '#4CAF50', desc: 'Equipo solvente' },
  BALANCED:    { text: 'Balanced',    color: '#9E9E9E', desc: 'Partida equilibrada' },
  MESSY:       { text: 'Messy',       color: '#FF7043', desc: 'Equipo flojo' },
  FRUSTRATING: { text: 'Frustrating', color: '#F44336', desc: 'Equipo hundido' },
};

/**
 * Asigna la fate de la partida según el KDA medio del equipo (4 aliados).
 * Devuelve la KEY (ej. 'SOLID').
 */
export const assignFate = (teamAvgKDA) => {
  if (teamAvgKDA >= 4.0) return 'GODLIKE';
  if (teamAvgKDA >= 2.5) return 'SOLID';
  if (teamAvgKDA >= 1.8) return 'BALANCED';
  if (teamAvgKDA >= 1.2) return 'MESSY';
  return 'FRUSTRATING';
};
