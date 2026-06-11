// ============================================================================
// eloEstimate — estima un MMR/ELO numérico desde el rank de Riot
// ----------------------------------------------------------------------------
// Riot esconde el MMR real, pero se puede aproximar combinando:
// 1) Tier base (Iron 0 → Diamond 2400)
// 2) División (IV 0 → I 300, dentro del tier)
// 3) LP actuales × 0.3 (los LP no son lineales pero la curva ~30% acerca)
// 4) Winrate factor — bonificación si gana más del 50% (señal de subir).
//
// Esta es una ESTIMACIÓN — NO el MMR real. Al renderizarlo siempre etiquetar
// como "ELO aprox" o similar para que el usuario no lo confunda con el dato
// oficial de Riot.
//
// Outputs:
// { value: number, label: string, tooltip: string }
// ============================================================================

const TIER_BASE = {
  IRON:        0,
  BRONZE:      400,
  SILVER:      800,
  GOLD:        1200,
  PLATINUM:    1600,
  EMERALD:     2000,
  DIAMOND:     2400,
  MASTER:      2800,
  GRANDMASTER: 3000,
  CHALLENGER:  3200,
};

const DIVISION_BONUS = {
  IV:   0,
  III:  100,
  II:   200,
  I:    300,
  // En MASTER+ no hay divisiones — los enums quedan en 0.
};

const LP_FACTOR = 0.3;

/**
 * Bonificación por winrate. Si WR > 50%, suma; si < 50%, resta. Cap ±150 pts.
 * @param {number} wr — winrate 0..100 (porcentaje)
 */
function winrateFactor(wr) {
  if (!Number.isFinite(wr)) return 0;
  const delta = wr - 50;
  return Math.max(-150, Math.min(150, Math.round(delta * 3)));
}

/**
 * @typedef {Object} RankShape
 * @property {string} tier — 'GOLD', 'PLATINUM', etc.
 * @property {string} division — 'IV', 'III', 'II', 'I' (omitible en MASTER+)
 * @property {number} lp — League Points actuales (0..100)
 */

/**
 * @param {RankShape} rank
 * @param {number} winratePct — winrate en %; si no se proporciona, no contribuye.
 * @returns {{ value: number, label: string, tooltip: string }}
 */
export function computeEloEstimate(rank, winratePct) {
  if (!rank || !rank.tier) {
    return {
      value:   0,
      label:   '—',
      tooltip: 'Sin rank conocido todavía. Juega clasificatorias para fijar tu división.',
    };
  }

  const tierKey = String(rank.tier).toUpperCase();
  const divKey  = String(rank.division || '').toUpperCase();
  const base    = TIER_BASE[tierKey] ?? 0;
  const div     = DIVISION_BONUS[divKey] ?? 0;
  const lp      = Number.isFinite(rank.lp) ? rank.lp : 0;
  const wrBonus = winrateFactor(winratePct);

  // Floor en 0 — un usuario en Iron IV con WR muy bajo no debe ver ELO negativo.
  const value = Math.max(0, Math.round(base + div + lp * LP_FACTOR + wrBonus));

  return {
    value,
    label:   `ELO aprox · ${value.toLocaleString('es-ES')}`,
    tooltip: 'Estimación a partir de tu división, LP y winrate. ' +
             'Riot no expone el MMR real — este número es una aproximación útil para comparar progreso semanal.',
  };
}
