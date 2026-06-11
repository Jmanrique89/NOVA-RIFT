// ============================================================================
// GAMEPS — etiqueta interpretativa por partida (op.gg-inspired)
// ----------------------------------------------------------------------------
// A diferencia de Fate (que evalúa al equipo), GAMEPS te evalúa A TI dentro
// de la partida. Se asigna en función de novaScore + win + position (ranking
// 1-10 entre los 10 jugadores).
//
// Etiquetas:
// Victorias: MVP · ACE · VICTOR · LATE_BLOOMER
// Derrotas: RESILIENT · UNLUCKY · AVERAGE · STRUGGLE · DOWNFALL
// ============================================================================

export const GAMEPS_LABELS = {
  // Victorias
  MVP:          { text: 'MVP',          color: '#FFC93C' },  // mejor del equipo
  ACE:          { text: 'ACE',          color: '#FF9800' },  // mejor de los 10
  VICTOR:       { text: 'Victor',       color: '#4CAF50' },  // victoria normal
  LATE_BLOOMER: { text: 'Late Bloomer', color: '#8BC34A' },  // empezó mal, subió
  // Derrotas
  RESILIENT:    { text: 'Resistente',   color: '#7B76DD' },  // buen rendimiento en derrota
  UNLUCKY:      { text: 'Unlucky',      color: '#9C27B0' },  // jugó bien pero perdió por team
  AVERAGE:      { text: 'Normal',       color: '#9E9E9E' },  // performance normal
  STRUGGLE:     { text: 'Struggle',     color: '#FF7043' },  // bajó mucho
  DOWNFALL:     { text: 'Caída',        color: '#F44336' },  // hundido
};

/**
 * Asigna una GAMEPS label a una partida en base a novaScore (0-100), win bool
 * y position (1=mejor de los 10, 10=peor). Devuelve la KEY (ej. 'MVP').
 */
export const assignGAMEPS = ({ novaScore, win, position }) => {
  if (novaScore >= 90)                          return win ? 'ACE'    : 'RESILIENT';
  if (novaScore >= 75 && position <= 2)         return win ? 'MVP'    : 'RESILIENT';
  if (novaScore >= 60 && !win && position <= 3) return 'UNLUCKY';
  if (novaScore >= 50)                          return win ? 'VICTOR' : 'AVERAGE';
  if (novaScore >= 35)                          return win ? 'VICTOR' : 'STRUGGLE';
  return win ? 'LATE_BLOOMER' : 'DOWNFALL';
};
