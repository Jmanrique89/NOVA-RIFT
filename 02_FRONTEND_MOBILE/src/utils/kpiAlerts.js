// ============================================================================
// kpiAlerts — sistema rojo/amarillo/verde por KPI vs benchmark de rol+rango
// ----------------------------------------------------------------------------
// Cada métrica del usuario se compara con el benchmark esperado para su rol y
// división. Devuelve un status discreto (red/yellow/green) que el componente
// pinta como tarjeta y, si está en rojo, adjunta un quick fix accionable.
//
// Fuente de los benchmarks: divisionBenchmarks.ROLE_BENCHMARKS (Mobalytics /
// OP.GG / lolalytics, meta 2026).
// ============================================================================
import { benchmarkForRoleAndTier, getQuickFixes } from './divisionBenchmarks';

/**
 * Compara un valor contra su benchmark. Por defecto asume que más es mejor
 * (CS/min, KDA, Vision, KP). `higherIsBetter=false` invierte la lógica
 * para métricas como `deathsPerGame`.
 */
export function getKpiStatus(value, benchmark, higherIsBetter = true) {
  if (value == null || benchmark == null) return 'neutral';
  const ratio = higherIsBetter ? value / benchmark : benchmark / value;
  if (ratio >= 1.05) return 'green';
  if (ratio >= 0.85) return 'yellow';
  return 'red';
}

/**
 * Construye 4 tarjetas KPI core (CS/min, KDA, Visión, KP%) listas para
 * renderizar. Cada tarjeta incluye el status (color) y un fix textual si el
 * status es rojo.
 *
 * @param {object} stats { csMin, kda, visionScore, killParticipation }
 * @param {string} role 'TOP' | 'JUNGLE' | 'MID' | 'ADC' | 'SUPPORT'
 * @param {string} tier 'GOLD' | 'PLATINUM' | …
 */
export function buildKpiCards(stats, role, tier) {
  const b = benchmarkForRoleAndTier(role, tier);
  const fixes = getQuickFixes(role);
  const findFix = (metric) => fixes.find(f => f.metric === metric)?.fix || null;

  return [
    {
      key:       'csMin',
      label:     'CS/min',
      value:     stats?.csMin ?? 0,
      benchmark: b.csMin,
      unit:      '',
      status:    getKpiStatus(stats?.csMin, b.csMin),
      fix:       findFix('csMin'),
    },
    {
      key:       'kda',
      label:     'KDA',
      value:     stats?.kda ?? 0,
      benchmark: b.kda,
      unit:      '',
      status:    getKpiStatus(stats?.kda, b.kda),
      fix:       findFix('kda'),
    },
    {
      key:       'visionScore',
      label:     'Visión',
      value:     stats?.visionScore ?? 0,
      benchmark: b.visionScore,
      unit:      'VS',
      status:    getKpiStatus(stats?.visionScore, b.visionScore),
      fix:       findFix('visionScore'),
    },
    {
      key:       'kp',
      label:     'Kill Part.',
      value:     stats?.killParticipation ?? 0,
      benchmark: b.kp,
      unit:      '%',
      status:    getKpiStatus(stats?.killParticipation, b.kp),
      fix:       findFix('kp'),
    },
  ];
}

/**
 * Diagnóstico de hardstuck — detecta el problema principal del jugador y
 * devuelve un consejo único. Si no hay deficiencia clara, devuelve mensaje
 * neutral. Sirve como "tip principal" del bloque de KPIs.
 */
export function getHardstuckDiagnosis(stats, role, tier) {
  const b = benchmarkForRoleAndTier(role, tier);
  const issues = [];

  if ((stats?.winrate ?? 50) < 50) {
    issues.push({
      type: 'pool',
      label: 'WR < 50%',
      advice: 'Problema de champion pool. Si llevas 20+ partidas con WR < 45%, cambia de campeón.',
    });
  }
  if ((stats?.csMin ?? 0) < b.csMin * 0.85) {
    issues.push({
      type: 'farm',
      label: 'Farm bajo',
      advice: 'Tu CS/min está por debajo del 85% del benchmark de tu rango. Prioriza farmear sobre pelear.',
    });
  }
  if ((stats?.visionScore ?? 0) < b.visionScore * 0.8) {
    issues.push({
      type: 'vision',
      label: 'Visión baja',
      advice: 'Tu vision score está muy por debajo. Wardea el río cada 2 minutos sin excepción.',
    });
  }
  if ((stats?.killParticipation ?? 0) < b.kp - 10) {
    issues.push({
      type: 'macro',
      label: 'KP bajo',
      advice: 'No estás presente en suficientes peleas. Agrupa con el equipo en mid game.',
    });
  }

  if (issues.length === 0) {
    return { label: 'Sin hardstuck detectado. Sigue jugando para más datos.', issues: [] };
  }
  const primary = issues[0];
  return {
    label: `Diagnóstico: ${primary.label} — ${primary.advice}`,
    issues,
  };
}

/**
 * Alerta de campeones del pool con WR malo. Cualquier campeón con ≥20 partidas
 * y WR < 45% es candidato a dropear.
 *
 * @param {Array<{name:string, games:number, winrate:number}>} champStats
 */
export function getChampionPoolAlert(champStats) {
  if (!Array.isArray(champStats)) return [];
  return champStats
    .filter(c => c.games >= 20 && c.winrate < 45)
    .map(c => ({
      name:     c.name,
      winrate:  c.winrate,
      games:    c.games,
      alert:    `${c.name}: ${c.winrate}% WR en ${c.games} partidas — considera dropearlo`,
    }));
}
