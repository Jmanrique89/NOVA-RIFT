// ============================================================================
// KPICoachingWidget — tarjeta de objetivo semanal del jugador
// ----------------------------------------------------------------------------
// Renderiza UNA tarjeta con el KPI activo (CS/min, visión, muertes o winrate).
// El usuario navega entre los 4 objetivos con las flechas ‹ ›; la semana solo
// decide cuál se sugiere al principio. Pensado para ProfileScreen / HubScreen.
//
// Cómo se calcula la semana del usuario:
// El primer montaje escribe `novarift_kpi_started_at` en AsyncStorage.
// appWeek = floor((now - kpiStartedAt) / 7 días) + 1.
// Semana 1: CS/min (o visión si el rol es SUPPORT/JUNGLE).
// Semana 2: la métrica complementaria.
// Semana 3+: alterna por paridad → coaching continuo.
//
// Tolerante a datos mock: si `matches` viene vacío usa NOVA_MATCHES. La copy
// completa de props y comportamiento está en el JSDoc de abajo.
// ============================================================================

/**
 * @module KPICoachingWidget
 *
 * Tarjeta de coaching semanal que muestra el KPI activo del jugador (CS/min o
 * Vision Score) con un anillo circular de progreso, texto motivacional y
 * percentil de rango. Pensada para ProfileScreen / HubScreen.
 *
 * Lógica de semana:
 * El primer montaje persiste `novarift_kpi_started_at` en AsyncStorage.
 * `appWeek = floor((now − kpiStartedAt) / 7 días) + 1`.
 * Semana 1: CS/min (o Vision si el rol es SUPPORT/JUNGLE).
 * Semana 2: la métrica complementaria.
 * Semana 3+: alterna por paridad — coaching continuo.
 *
 * Es tolerante a datos mock: si `matches` llega vacío usa `NOVA_MATCHES`, y si
 * `globalStats` falta usa `NOVA_GLOBAL_STATS`. Soporta estados `loading`
 * (esqueletos) y `error` (con reintento), evaluados tras los hooks.
 *
 * Estados (DIN1-UD3):
 * Normal:  tarjeta con anillo de progreso, tendencia y consejo del coach.
 * Loading: `loading=true` → 3 SkeletonCard (shimmer) en lugar de la tarjeta.
 * Error:   `error="mensaje"` → ErrorState con botón de reintento (`onRetry`).
 * Vacío:   sin `matches` → cae a los mocks `NOVA_MATCHES` (nunca pinta NaN);
 *          el estado "cuenta sin partidas" lo comunica el contenedor.
 *
 * Dónde se usa: HubScreen (sección de coaching semanal) y
 * ComponentShowcaseScreen (catálogo vivo: semanas 1-3, loading y error).
 *
 * @see module:CircularProgressRing — anillo de progreso reutilizado aquí.
 *
 * @example
 * <KPICoachingWidget user={user} matches={matches} globalStats={stats} />
 */

/**
 * @typedef {Object} KPIUser
 * @property {string} [mainRole] Rol principal (ADC, SUPPORT, JUNGLE…). Decide
 * qué métrica toca y el objetivo. Default 'ADC'.
 * @property {string} [tier] Rango del jugador (usado para calcular target).
 * @property {string} [riotId] Riot ID del jugador.
 * @property {string} [faction] Facción NOVA RIFT del jugador.
 */

/**
 * @typedef {Object} KPICoachingWidgetProps
 * @property {KPIUser} user Perfil del jugador (rol y rango).
 * @property {Object[]} [matches] Partidas recientes (orden descendente).
 * Si está vacío se usan los mocks `NOVA_MATCHES`.
 * @property {Object} [globalStats] Estadísticas globales con `rank.tier` y
 * `rank.percentile`. Fallback a `NOVA_GLOBAL_STATS`.
 * @property {number} [appWeek] Fuerza la semana mostrada (útil para
 * previews/Storybook); si se omite se calcula desde AsyncStorage.
 * @property {boolean} [loading=false] Si `true`, renderiza 3 `SkeletonCard`.
 * @property {string|null} [error=null] Si es truthy, renderiza `ErrorState`
 * con este mensaje.
 * @property {() => void} [onRetry] Callback de reintento pasado a `ErrorState`.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import CircularProgressRing from './CircularProgressRing';
import { useTheme } from '../context/ThemeContext';
import { SkeletonCard } from './feedback/LoadingSkeleton';
import ErrorState from './feedback/ErrorState';
// Explicabilidad: el botón "¿Por qué este objetivo?" abre este modal con la
// lógica detrás del KPI.
import AIInsightTooltip from './ai/AIInsightTooltip';
// B4 (DIN2-UD5) — botones 👍/👎 bajo el consejo del coach (feedback loop).
import AIFeedbackButtons from './ai/AIFeedbackButtons';
import {
  csTargetFor,
  visionTargetFor,
  deathsTargetFor,
  winrateTargetFor,
  pickWeeklyKpi,
  motivationFor,
  kpiTipFor,
  KPI_LABELS,
  KPI_KEYS,
} from '../constants/kpiTargets';
import { NOVA_MATCHES, NOVA_GLOBAL_STATS } from '../mocks/novaStats';

const KPI_START_KEY = 'novarift_kpi_started_at';
// El objetivo elegido por el usuario persiste entre sesiones.
const KPI_SELECTED_KEY = 'novarift_kpi_selected';
const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;
const PRIMARY = '#7B76DD';

/**
 * Recorta un número al rango [0, 1]; devuelve 0 si no es finito.
 *
 * @param {number} v Valor a recortar.
 * @returns {number} Valor en [0, 1].
 */
function clamp01(v) {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(1, v));
}

/**
 * Promedio de un campo numérico sobre las N partidas más recientes (ya vienen
 * en orden descendente en `NOVA_MATCHES`).
 *
 * @param {Object[]} matches Lista de partidas.
 * @param {string} field Nombre del campo numérico a promediar.
 * @param {number} [lookback=10] Cuántas partidas (las más recientes) considerar.
 * @returns {number|null} La media, o `null` si no hay valores finitos.
 */
function averageField(matches, field, lookback = 10) {
  if (!Array.isArray(matches) || matches.length === 0) return null;
  const slice = matches.slice(0, lookback);
  const vals = slice
    .map(m => m?.[field])
    .filter(v => Number.isFinite(v));
  if (vals.length === 0) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

/**
 * Tarjeta de coaching semanal con KPI, anillo de progreso y percentil.
 *
 * @param {KPICoachingWidgetProps} props Propiedades del componente.
 * @returns {React.ReactElement} La tarjeta de KPI (o sus estados loading/error).
 */
function KPICoachingWidget({
  user,
  matches,
  globalStats,
  appWeek,         // opcional — fuerza la semana (útil para previews/Storybook)
  loading = false, // si true → muestra 3 SkeletonCard en vez del contenido
  error = null,    // si truthy (string) → muestra ErrorState con el mensaje
  onRetry,         // callback de reintento — se pasa a ErrorState.onRetry
}) {
  const { colors: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  const role = user?.mainRole || 'ADC';
  const tier =
    user?.tier ||
    globalStats?.rank?.tier ||
    NOVA_GLOBAL_STATS.rank.tier;

  // ── 0) Explicabilidad de IA — modal "¿Por qué este objetivo?" ──────────────
  const [showInsight, setShowInsight] = useState(false);

  // ── 1) Semana del usuario en la app ────────────────────────────────────────
  /** @type {number} semana calculada desde AsyncStorage (1-indexada) */
  const [computedWeek, setComputedWeek] = useState(1);
  useEffect(() => {
    if (typeof appWeek === 'number') return; // override por prop
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(KPI_START_KEY);
        let startedAt = raw ? parseInt(raw, 10) : NaN;
        if (!Number.isFinite(startedAt)) {
          startedAt = Date.now();
          await AsyncStorage.setItem(KPI_START_KEY, String(startedAt));
        }
        const weeks = Math.floor((Date.now() - startedAt) / MS_PER_WEEK) + 1;
        if (!cancelled) setComputedWeek(Math.max(1, weeks));
      } catch (_) {
        if (!cancelled) setComputedWeek(1);
      }
    })();
    return () => { cancelled = true; };
  }, [appWeek]);

  const week = typeof appWeek === 'number' ? appWeek : computedWeek;

  // ── 2) Qué KPI se muestra ──────────────────────────────────────────────────
  // No es fijo por semana: el usuario navega entre los 4 objetivos (CS/min ·
  // visión · muertes · WR) con las flechas. La semana solo decide el KPI inicial
  // sugerido; la elección del usuario persiste en AsyncStorage.
  const weeklyDefault = pickWeeklyKpi(week, role); // 'CSPM' | 'VISION'
  const [selectedKpi, setSelectedKpi] = useState(null); // null = aún sin cargar
  // T16 — desplegable de objetivos: además del carrusel ‹ ›, el título abre una
  // lista con los 4 objetivos clave para selección directa.
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(KPI_SELECTED_KEY);
        if (!cancelled) {
          setSelectedKpi(KPI_KEYS.includes(raw) ? raw : weeklyDefault);
        }
      } catch (_) {
        if (!cancelled) setSelectedKpi(weeklyDefault);
      }
    })();
    return () => { cancelled = true; };
    // weeklyDefault solo importa para el primer valor — no re-disparar al cambiar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const kpiKey = selectedKpi || weeklyDefault;
  const { title, axis, unit, lowerIsBetter } = KPI_LABELS[kpiKey];

  /** Navega al KPI anterior/siguiente y persiste la elección. */
  const stepKpi = (dir) => {
    const idx = KPI_KEYS.indexOf(kpiKey);
    const next = KPI_KEYS[(idx + dir + KPI_KEYS.length) % KPI_KEYS.length];
    setSelectedKpi(next);
    AsyncStorage.setItem(KPI_SELECTED_KEY, next).catch(() => {});
  };

  /** T16 — selección directa desde el desplegable de objetivos. */
  const selectKpi = (key) => {
    setSelectedKpi(key);
    setMenuOpen(false);
    AsyncStorage.setItem(KPI_SELECTED_KEY, key).catch(() => {});
  };

  const target = useMemo(() => {
    switch (kpiKey) {
      case 'CSPM':    return csTargetFor(role, tier);
      case 'VISION':  return visionTargetFor(role, tier);
      case 'DEATHS':  return deathsTargetFor(tier);
      case 'WINRATE': return winrateTargetFor(tier);
      default:        return csTargetFor(role, tier);
    }
  }, [kpiKey, role, tier]);

  // ── 3) Valor actual del jugador (mock-friendly) ────────────────────────────
  const safeMatches = Array.isArray(matches) && matches.length > 0
    ? matches
    : NOVA_MATCHES;

  const current = useMemo(() => {
    // WINRATE no es un campo de partida: se deriva de result W/L (últimas 10).
    if (kpiKey === 'WINRATE') {
      const slice = safeMatches.slice(0, 10).filter(m => m && typeof m === 'object');
      if (slice.length === 0) return 0;
      const wins = slice.filter(m => m.result === 'W' || m.result === 'WIN' || m.win === true).length;
      return (wins / slice.length) * 100;
    }
    const v = averageField(safeMatches, axis, 10);
    return Number.isFinite(v) ? v : 0;
  }, [safeMatches, axis, kpiKey]);

  // lowerIsBetter (MUERTES): el progreso se invierte — estar por debajo del
  // objetivo es estar al 100%. Con 0 muertes el ratio sería ∞ → clamp01 lo recorta.
  const ratio = lowerIsBetter
    ? (current > 0 ? target / current : 1)
    : current / (target || 1);
  const progress = clamp01(ratio);
  const motivational = motivationFor(ratio);
  const reached = lowerIsBetter ? current <= target : current >= target;
  // Una línea de consejo accionable según el KPI activo y la distancia al objetivo.
  const tip = kpiTipFor(kpiKey, current, target);

  // ── 4) Percentil (mejor que el X% del rango) ───────────────────────────────
  const stats = globalStats || NOVA_GLOBAL_STATS;
  const tierPercentile = stats?.rank?.percentile;
  const betterThanPct = Number.isFinite(tierPercentile)
    ? Math.max(0, Math.min(99, 100 - tierPercentile))
    : null;

  // ── 5) Formato visual ──────────────────────────────────────────────────────
  const fmt = (kpiKey === 'CSPM' || kpiKey === 'DEATHS')
    ? (n) => n.toFixed(1)
    : (n) => `${Math.round(n)}${unit || ''}`;

  // ── Estados de carga / error ───────────────────────────────────────────────
  // Se evalúan tras los hooks (regla de hooks) y cortocircuitan el render real.
  if (loading) {
    return (
      <View style={styles.stateWrap}>
        <SkeletonCard />
        <SkeletonCard style={styles.skeletonGap} />
        <SkeletonCard style={styles.skeletonGap} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.stateWrap}>
        <ErrorState message={error} onRetry={onRetry} />
      </View>
    );
  }

  return (
    <>
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.weekTag}>SEMANA {week} · OBJETIVO</Text>
        <Text style={styles.diamond}>◈</Text>
      </View>

      {/* Selector de objetivo: ‹ título › + dots de posición. El usuario navega
          entre CS/min · visión · muertes · WR; su elección persiste en
          AsyncStorage (novarift_kpi_selected). */}
      <View style={styles.selectorRow}>
        <TouchableOpacity
          onPress={() => stepKpi(-1)}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Objetivo anterior"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={styles.arrowBtn}
        >
          <Text style={styles.arrowText}>‹</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setMenuOpen((o) => !o)}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityState={{ expanded: menuOpen }}
          accessibilityLabel="Elegir objetivo de la lista"
          style={styles.titleBtn}
        >
          <Text style={[styles.title, styles.titleCentered]} numberOfLines={1}>
            {title}
          </Text>
          <Text style={styles.titleChevron}>{menuOpen ? '▴' : '▾'}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => stepKpi(1)}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Objetivo siguiente"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={styles.arrowBtn}
        >
          <Text style={styles.arrowText}>›</Text>
        </TouchableOpacity>
      </View>

      {/* T16 — desplegable de objetivos clave: selección directa de cualquiera
          de los 4 KPIs sin tener que recorrer el carrusel con las flechas. */}
      {menuOpen && (
        <View style={styles.dropdown}>
          {KPI_KEYS.map((k) => (
            <TouchableOpacity
              key={k}
              onPress={() => selectKpi(k)}
              activeOpacity={0.7}
              accessibilityRole="button"
              style={[styles.dropdownItem, k === kpiKey && styles.dropdownItemActive]}
            >
              <Text style={[styles.dropdownText, k === kpiKey && styles.dropdownTextActive]}>
                {KPI_LABELS[k].title}
              </Text>
              {k === kpiKey && <Text style={styles.dropdownCheck}>✓</Text>}
            </TouchableOpacity>
          ))}
        </View>
      )}

      <View style={styles.dotsRow}>
        {KPI_KEYS.map((k) => (
          <View
            key={k}
            style={[styles.dot, k === kpiKey && styles.dotActive]}
          />
        ))}
      </View>

      <View style={styles.body}>
        <CircularProgressRing
          progress={progress}
          size={108}
          strokeWidth={9}
          color={PRIMARY}
          trackColor={c.onSurface(0.08)}
        >
          <Text style={styles.ringValue}>{fmt(current)}</Text>
          <Text style={styles.ringTarget}>/ {fmt(target)}</Text>
        </CircularProgressRing>

        <View style={styles.copyCol}>
          <Text style={styles.objectiveLabel}>OBJETIVO</Text>
          <Text style={styles.objectiveValue}>{fmt(target)}</Text>

          <Text
            style={[
              styles.motivation,
              reached && styles.motivationReached,
            ]}
            numberOfLines={2}
          >
            {motivational}
          </Text>

          {/* Consejo accionable de 1 línea para el KPI activo */}
          <Text style={styles.tipText} numberOfLines={3}>
            {tip}
          </Text>

          {betterThanPct !== null && (
            <Text style={styles.percentile}>
              Mejor que el {betterThanPct}% de tu rango
            </Text>
          )}

          {/* Explicabilidad: por qué se fija este objetivo */}
          <TouchableOpacity
            onPress={() => setShowInsight(true)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="¿Por qué este objetivo?"
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Text style={styles.whyLink}>¿Por qué este objetivo?</Text>
          </TouchableOpacity>

          {/* B4 (DIN2-UD5) — feedback loop del insight del coach */}
          <AIFeedbackButtons tipo="kpi_insight" id={kpiKey} accentColor={PRIMARY} />
        </View>
      </View>

      {/* Barra lineal de refuerzo — visible bajo el anillo para reforzar el % */}
      <View style={styles.bar}>
        <View
          style={[
            styles.barFill,
            { width: `${(progress * 100).toFixed(1)}%` },
          ]}
        />
      </View>
      <Text style={styles.progressPct}>{Math.round(progress * 100)}%</Text>
    </View>

    <AIInsightTooltip
      visible={showInsight}
      onClose={() => setShowInsight(false)}
      title="¿Por qué este objetivo?"
      explanation={`Tu objetivo de ${title} se calcula comparando tu media de las últimas 10 partidas con el percentil 60 de jugadores de tu rango y rol.`}
      dataPoints={[
        { label: 'Tu media', value: fmt(current) },
        { label: 'Objetivo tier', value: fmt(target) },
        { label: 'Partidas analizadas', value: '10' },
      ]}
    />
    </>
  );
}

const makeStyles = (c) => StyleSheet.create({
  card: {
    backgroundColor: c.surface,
    borderColor: PRIMARY + '33',
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    marginTop: 16,
  },

  // Contenedor de los estados loading / error — conserva el margen superior de
  // la card real para que el layout no salte al cambiar de estado.
  stateWrap: {
    marginTop: 16,
  },
  skeletonGap: {
    marginTop: 8,
  },

  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  weekTag: {
    color: PRIMARY + 'BB',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 2,
  },
  diamond: {
    color: PRIMARY,
    fontSize: 14,
  },

  title: {
    color: c.textPrimary,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 1.2,
    marginBottom: 12,
  },

  // ── Selector de objetivo (‹ título › + dots) ─────────────────────────────
  selectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  titleCentered: {
    flex: 1,
    textAlign: 'center',
    marginBottom: 0,
  },
  // T16 — título como disparador del desplegable (texto + chevron).
  titleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  titleChevron: {
    color: PRIMARY,
    fontSize: 14,
    fontWeight: '900',
  },
  dropdown: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: PRIMARY + '33',
    borderRadius: 10,
    backgroundColor: c.onSurface(0.03),
    overflow: 'hidden',
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 11,
    paddingHorizontal: 14,
  },
  dropdownItemActive: {
    backgroundColor: PRIMARY + '1A',
  },
  dropdownText: {
    color: c.onSurface(0.7),
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  dropdownTextActive: {
    color: c.textPrimary,
  },
  dropdownCheck: {
    color: PRIMARY,
    fontSize: 13,
    fontWeight: '900',
  },
  arrowBtn: {
    width: 28,
    height: 28,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: PRIMARY + '44',
    backgroundColor: PRIMARY + '14',
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowText: {
    color: PRIMARY,
    fontSize: 18,
    fontWeight: '900',
    lineHeight: 20,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginTop: 8,
    marginBottom: 12,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: c.onSurface(0.18),
  },
  dotActive: {
    backgroundColor: PRIMARY,
  },
  tipText: {
    color: c.onSurface(0.70),
    fontSize: 11,
    lineHeight: 15,
    marginTop: 6,
  },

  body: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },

  ringValue: {
    color: c.textPrimary,
    fontSize: 24,
    fontWeight: '900',
    lineHeight: 26,
  },
  ringTarget: {
    color: c.onSurface(0.45),
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },

  copyCol: {
    flex: 1,
    gap: 4,
  },
  objectiveLabel: {
    color: c.onSurface(0.45),
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  objectiveValue: {
    color: c.textPrimary,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  motivation: {
    color: PRIMARY,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 6,
  },
  motivationReached: {
    color: c.textPrimary,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  percentile: {
    color: c.onSurface(0.55),
    fontSize: 10,
    fontWeight: '600',
    marginTop: 4,
  },
  whyLink: {
    color: PRIMARY,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginTop: 8,
  },

  bar: {
    height: 6,
    backgroundColor: c.onSurface(0.08),
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: 14,
  },
  barFill: {
    height: '100%',
    backgroundColor: PRIMARY,
    borderRadius: 3,
  },
  progressPct: {
    color: c.onSurface(0.45),
    fontSize: 10,
    fontWeight: '700',
    alignSelf: 'flex-end',
    marginTop: 4,
  },
});

/**
 * Memoizado (comparación shallow por defecto): la tarjeta hace bastante trabajo
 * por render (useMemo de target/current, anillo SVG animado), así que evitamos
 * recalcular cuando el padre re-renderiza con las mismas props.
 */
export default React.memo(KPICoachingWidget);
