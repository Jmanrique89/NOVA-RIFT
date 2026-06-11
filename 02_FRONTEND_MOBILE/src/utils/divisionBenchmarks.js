// ============================================================================
// divisionBenchmarks — perfil esperado por división y por ROL
// ----------------------------------------------------------------------------
// Dos capas de datos:
// 1) PROFILES_GENERIC: 5 ejes 0..100 para FactionRadarChart —
// Winrate · CS/min · Oro · Daño · Visión. El winrate de referencia de una
// división es ~50 (equilibrio del matchmaking); el resto escala con el rango.
// 2) ROLE_BENCHMARKS: KPIs absolutos (CS/min, KDA, Vision Score, KP%, GD@15…)
// por rol y rango. Usados por kpiAlerts.js para pintar tarjetas
// verde/amarillo/rojo y consejos accionables.
//
// Fuentes: Mobalytics / OP.GG / lolalytics (meta 2026) + threads de coaching.
// ============================================================================

// Ejes: [Winrate, CS/min, Oro, Daño, Visión]. El winrate de referencia ~50
// (la media de cualquier división tiende al 50% por matchmaking); el resto de
// ejes escala con la división.
const PROFILES_GENERIC = {
  IRON:        [50, 30, 35, 32, 22],
  BRONZE:      [50, 38, 42, 40, 28],
  SILVER:      [50, 48, 50, 48, 36],
  GOLD:        [50, 58, 60, 58, 45],
  PLATINUM:    [50, 68, 68, 66, 54],
  EMERALD:     [50, 74, 74, 72, 62],
  DIAMOND:     [50, 82, 80, 80, 72],
  MASTER:      [50, 88, 86, 86, 80],
  GRANDMASTER: [50, 92, 90, 90, 86],
  CHALLENGER:  [50, 95, 94, 94, 92],
};

// KPIs reales por rango y rol (valores absolutos para KpiCard y alerts).
// Mapeo:
// csMin → CS por minuto
// kda → KDA medio
// visionScore → Vision Score por partida
// kp → Kill Participation %
// gd15 → Gold Diff @ 15 min
// deathsPerGame / ganks / roams / controlWards → métricas auxiliares por rol
export const ROLE_BENCHMARKS = {
  TOP: {
    IRON:     { csMin: 5.0, kda: 1.8, visionScore: 16, kp: 35, gd15: -300, deathsPerGame: 4 },
    BRONZE:   { csMin: 5.5, kda: 1.8, visionScore: 16, kp: 35, gd15: -300, deathsPerGame: 4 },
    SILVER:   { csMin: 6.5, kda: 2.2, visionScore: 22, kp: 40, gd15:    0, deathsPerGame: 3 },
    GOLD:     { csMin: 7.5, kda: 2.5, visionScore: 28, kp: 45, gd15: +300, deathsPerGame: 3 },
    PLATINUM: { csMin: 8.0, kda: 3.0, visionScore: 35, kp: 50, gd15: +500, deathsPerGame: 2 },
    EMERALD:  { csMin: 8.5, kda: 3.2, visionScore: 42, kp: 54, gd15: +600, deathsPerGame: 2 },
    DIAMOND:  { csMin: 9.0, kda: 3.5, visionScore: 50, kp: 55, gd15: +800, deathsPerGame: 2 },
    MASTER:   { csMin: 9.5, kda: 4.0, visionScore: 60, kp: 60, gd15: +900, deathsPerGame: 1 },
  },
  JUNGLE: {
    IRON:     { csMin: 3.0, kda: 1.5, visionScore: 18, kp: 45, gd15: -300, ganks: 2 },
    BRONZE:   { csMin: 3.5, kda: 1.5, visionScore: 18, kp: 50, gd15: -200, ganks: 2 },
    SILVER:   { csMin: 4.0, kda: 2.0, visionScore: 25, kp: 55, gd15: +100, ganks: 3 },
    GOLD:     { csMin: 5.0, kda: 2.5, visionScore: 32, kp: 60, gd15: +300, ganks: 3 },
    PLATINUM: { csMin: 6.0, kda: 3.0, visionScore: 40, kp: 65, gd15: +500, ganks: 4 },
    EMERALD:  { csMin: 6.5, kda: 3.2, visionScore: 48, kp: 68, gd15: +600, ganks: 5 },
    DIAMOND:  { csMin: 7.0, kda: 3.5, visionScore: 58, kp: 70, gd15: +700, ganks: 5 },
    MASTER:   { csMin: 7.5, kda: 4.0, visionScore: 68, kp: 75, gd15: +900, ganks: 6 },
  },
  MID: {
    IRON:     { csMin: 5.0, kda: 1.6, visionScore: 18, kp: 40, gd15: -300, roams: 2 },
    BRONZE:   { csMin: 5.5, kda: 1.6, visionScore: 18, kp: 40, gd15: -200, roams: 2 },
    SILVER:   { csMin: 6.5, kda: 2.0, visionScore: 25, kp: 45, gd15: +100, roams: 3 },
    GOLD:     { csMin: 8.0, kda: 2.8, visionScore: 32, kp: 52, gd15: +400, roams: 4 },
    PLATINUM: { csMin: 8.5, kda: 3.2, visionScore: 40, kp: 57, gd15: +600, roams: 5 },
    EMERALD:  { csMin: 9.0, kda: 3.5, visionScore: 48, kp: 62, gd15: +700, roams: 6 },
    DIAMOND:  { csMin: 9.5, kda: 3.8, visionScore: 58, kp: 65, gd15: +900, roams: 6 },
    MASTER:   { csMin:10.0, kda: 4.2, visionScore: 68, kp: 70, gd15:+1000, roams: 7 },
  },
  ADC: {
    IRON:     { csMin: 5.5, kda: 2.0, visionScore: 16, kp: 40, gd15: -300, deathsPerGame: 5 },
    BRONZE:   { csMin: 6.5, kda: 2.0, visionScore: 16, kp: 40, gd15: -200, deathsPerGame: 4 },
    SILVER:   { csMin: 7.5, kda: 2.5, visionScore: 22, kp: 45, gd15: +100, deathsPerGame: 4 },
    GOLD:     { csMin: 8.5, kda: 3.0, visionScore: 28, kp: 52, gd15: +400, deathsPerGame: 3 },
    PLATINUM: { csMin: 9.5, kda: 3.5, visionScore: 35, kp: 57, gd15: +600, deathsPerGame: 2 },
    EMERALD:  { csMin:10.0, kda: 3.8, visionScore: 42, kp: 62, gd15: +700, deathsPerGame: 2 },
    DIAMOND:  { csMin:10.5, kda: 4.0, visionScore: 50, kp: 65, gd15: +800, deathsPerGame: 2 },
    MASTER:   { csMin:11.0, kda: 4.5, visionScore: 60, kp: 70, gd15:+1000, deathsPerGame: 1 },
  },
  SUPPORT: {
    IRON:     { csMin: 0.5, kda: 1.8, visionScore: 38,  kp: 48, gd15: -600, controlWards: 2 },
    BRONZE:   { csMin: 0.8, kda: 1.8, visionScore: 38,  kp: 48, gd15: -500, controlWards: 3 },
    SILVER:   { csMin: 1.0, kda: 2.2, visionScore: 52,  kp: 52, gd15: -300, controlWards: 4 },
    GOLD:     { csMin: 1.5, kda: 2.8, visionScore: 65,  kp: 57, gd15: -100, controlWards: 5 },
    PLATINUM: { csMin: 1.8, kda: 3.3, visionScore: 80,  kp: 62, gd15: +100, controlWards: 6 },
    EMERALD:  { csMin: 2.0, kda: 3.6, visionScore: 95,  kp: 66, gd15: +200, controlWards: 7 },
    DIAMOND:  { csMin: 2.2, kda: 4.0, visionScore: 118, kp: 70, gd15: +300, controlWards: 7 },
    MASTER:   { csMin: 2.5, kda: 4.5, visionScore: 140, kp: 75, gd15: +400, controlWards: 8 },
  },
};

// Quick fix por rol — consejo accionable cuando una métrica está por debajo
// del benchmark. Indexado por rol → métrica → consejo en una línea.
export const ROLE_QUICK_FIXES = {
  TOP: [
    { metric: 'csMin',       fix: 'Farm sin pelear. TOP gana el 1v1 pero pierde la partida farmando menos.' },
    { metric: 'kda',         fix: 'Evita peleas sin TP disponible. Juega para escalar, no para kills.' },
    { metric: 'visionScore', fix: 'Ward tri-bush y río. El TP sin visión es un TP desperdiciado.' },
    { metric: 'kp',          fix: 'Usa el TP en peleas de mid o dragón. No solo para volver a línea.' },
    { metric: 'gd15',        fix: 'Si pierdes early, juega pasivo y espera el power spike del 2do item.' },
  ],
  JUNGLE: [
    { metric: 'csMin',       fix: 'Clearea todos los campos antes de gankear. El oro del jungle es tuyo.' },
    { metric: 'kda',         fix: 'Gankea solo líneas con CC. Sin setup, el gank fracasa.' },
    { metric: 'visionScore', fix: 'Controla el Scuttle Crab para visión y coger el río.' },
    { metric: 'kp',          fix: 'Sigue a tus líneas, no te aísles en el jungle. KP bajo = poca presencia.' },
    { metric: 'gd15',        fix: 'El jungle es el único rol donde tú controlas qué líneas ganan. Prioriza.' },
  ],
  MID: [
    { metric: 'csMin',       fix: 'Empuja la oleada rápido para poder rotar. Sin farm no escala.' },
    { metric: 'kda',         fix: 'Juega con visión de río. Los ganks mid son los más letales.' },
    { metric: 'visionScore', fix: 'Ward los lados del río antes de empujar. Es tu seguro de vida.' },
    { metric: 'kp',          fix: 'Después de empujar la oleada, rota a TOP o BOT. No te quedes farmando.' },
    { metric: 'gd15',        fix: 'Si rompes la tele del enemigo, empuja HARD. Crea presión inmediata.' },
  ],
  ADC: [
    { metric: 'csMin',       fix: 'ADC es el rol más dependiente de CS. 100 CS = 500 gold de ventaja.' },
    { metric: 'kda',         fix: 'Posiciónate siempre tras tu tank. Si mueres, tu equipo pierde el teamfight.' },
    { metric: 'visionScore', fix: 'Compra Control Wards en cada base. Tu seguridad depende de la visión.' },
    { metric: 'kp',          fix: 'Agrupa con tu equipo en cuanto tengas 2 ítems. No splittees solo.' },
    { metric: 'gd15',        fix: 'Farmear bajo torre es una skill. Practica last-hitting a tower range.' },
  ],
  SUPPORT: [
    { metric: 'visionScore', fix: 'Coloca 2 wards cada 2 minutos. Support sin visión = equipo ciego.' },
    { metric: 'kda',         fix: 'No peeles innecesariamente. Tu vida importa más que un kill suelto.' },
    { metric: 'kp',          fix: 'Agrupa con tu equipo en mid game. Support aislado no sirve.' },
    { metric: 'csMin',       fix: 'Compra Control Wards en cada base. Vision denial = ventaja de mapa.' },
    { metric: 'gd15',        fix: 'Si ganas botlane, rota a dragón. Los objetivos ganan partidas.' },
  ],
};

/**
 * @param {string} tier — 'GOLD', 'PLATINUM', etc.
 * @returns {number[]} 5 valores del perfil esperado de la división (radar genérico).
 */
export function benchmarkForTier(tier) {
  const key = String(tier || '').toUpperCase();
  return PROFILES_GENERIC[key] || PROFILES_GENERIC.GOLD;
}

/**
 * Devuelve los KPIs absolutos esperados por rol+rango. Si el rol o el tier
 * no están en el dataset, fallback a ADC/GOLD (la combinación más representativa).
 */
export function benchmarkForRoleAndTier(role, tier) {
  const r = String(role || 'ADC').toUpperCase();
  const t = String(tier || 'GOLD').toUpperCase();
  const roleData = ROLE_BENCHMARKS[r] || ROLE_BENCHMARKS.ADC;
  return roleData[t] || roleData.GOLD;
}

/** Quick fixes (consejos accionables) por rol. */
export function getQuickFixes(role) {
  return ROLE_QUICK_FIXES[String(role || 'ADC').toUpperCase()] || ROLE_QUICK_FIXES.ADC;
}

const AXIS_NAMES = ['Winrate', 'CS/min', 'Oro', 'Daño', 'Visión'];

/**
 * Devuelve el peor eje del usuario respecto al perfil de su división.
 * Útil como hint principal debajo del radar.
 */
export function topGap(userStats, tier) {
  const bench = benchmarkForTier(tier);
  if (!Array.isArray(userStats) || userStats.length !== AXIS_NAMES.length) {
    return { axisIdx: -1, axis: null, gap: 0, label: null };
  }
  let worst = { idx: -1, gap: 0 };
  for (let i = 0; i < AXIS_NAMES.length; i++) {
    const gap = (userStats[i] || 0) - bench[i];
    if (gap < worst.gap) worst = { idx: i, gap };
  }
  if (worst.idx < 0) {
    return { axisIdx: -1, axis: null, gap: 0, label: 'Tu perfil iguala o supera el de tu división.' };
  }
  return {
    axisIdx: worst.idx,
    axis:    AXIS_NAMES[worst.idx],
    gap:     worst.gap,
    label:   `${AXIS_NAMES[worst.idx]} es tu mayor oportunidad: ${Math.abs(worst.gap)} pts por debajo de la media de la división.`,
  };
}
