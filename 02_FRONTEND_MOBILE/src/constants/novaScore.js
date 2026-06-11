// ============================================================================
// NOVA-Score — sustituye al sistema S+/A/B/C/D heredado de deeplol/u.gg
// ----------------------------------------------------------------------------
// Decisión basada en investigación competitiva de rangos reales (OP.GG / DeepLoL).
// Inspirado en el AI-Score de deeplol pero con escala 0-100 + 5 buckets de
// color y nombre propio. El campo en mock/API se llama `novaScore`.
//
// Buckets:
// 100+ LEGENDARIO (oro) — performance excepcional sostenido
// 75-99 ÉLITE (naranja) — top tier de la partida
// 50-74 SÓLIDO (turquesa) — rendimiento competitivo
// 25-49 BAJO (rojo) — necesita corregir
// 0-24 CRÍTICO (rojo oscuro) — partida hundida
// ============================================================================

export const NOVA_SCORE_BUCKETS = [
  { min: 100, max: Infinity, label: 'LEGENDARIO', color: '#FFC93C', bg: 'rgba(255,201,60,0.15)' },
  { min: 75,  max: 99,       label: 'ÉLITE',      color: '#FF9800', bg: 'rgba(255,152,0,0.15)'  },
  { min: 50,  max: 74,       label: 'SÓLIDO',     color: '#36C4A8', bg: 'rgba(54,196,168,0.15)' },
  { min: 25,  max: 49,       label: 'BAJO',       color: '#F44336', bg: 'rgba(244,67,54,0.15)'  },
  { min: 0,   max: 24,       label: 'CRÍTICO',    color: '#B71C1C', bg: 'rgba(183,28,28,0.15)'  },
];

/**
 * Devuelve el bucket de NOVA-Score correspondiente a un score 0..∞.
 * Si el score es null/undefined o no encaja en ningún bucket, devuelve BAJO.
 */
export const getNovaScoreBucket = (score) => {
  if (score == null || Number.isNaN(score)) return NOVA_SCORE_BUCKETS[3];
  return NOVA_SCORE_BUCKETS.find(b => score >= b.min && score <= b.max) || NOVA_SCORE_BUCKETS[3];
};
