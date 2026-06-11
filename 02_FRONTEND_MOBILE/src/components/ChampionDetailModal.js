// ============================================================================
// ChampionDetailModal — ficha de campeón con profundidad
// ----------------------------------------------------------------------------
// Bottom-sheet que se abre desde HubScreen/LiveScreen al tocar un campeón.
// Toda la descripción de su anatomía (header, orbital, comparativas, fases,
// retos) y de su contrato de props está en el bloque JSDoc de abajo, que es la
// fuente de verdad para estudiar el componente.
// ============================================================================

/**
 * @module ChampionDetailModal
 *
 * Modal de ficha de campeón en formato bottom-sheet animado. De arriba a abajo:
 *
 * 1. **Header** — splash art a pantalla completa con overlay degradado SVG,
 * nombre centrado y subtítulo "N partidas · WR%".
 * 2. **Orbital** — hexágono central con el loading art del campeón y 5
 * métricas en círculo (winrate, KDA, visión, daño, oro), cada una con
 * badge de tier. El retrato es estático (sin anillo giratorio).
 * 3. **Comparativa de rango** — filas tipo "Farmeas como un Diamante" + valor.
 * 4. **Nivel pro** — comparativas con jugadores profesionales y el OTP famoso
 * del campeón. Se omite si ninguna stat lo merece.
 * 5. **Fases de partida** — chips seleccionables (EARLY…END) + panel de detalle.
 * 6. **Retos** — 3 objetivos con barra de progreso ligada a las stats reales.
 *
 * No recibe stats por prop: las agrega desde `matches` con `statsForChampion`,
 * igual que HubScreen/LiveScreen, que son quienes lo invocan. Si no hay
 * `championName` o no se pueden calcular stats, no renderiza nada.
 *
 * @example
 * <ChampionDetailModal
 * visible={open}
 * championName="Jinx"
 * matches={matches}
 * factionTheme={theme}
 * onClose={() => setOpen(false)}
 * />
 */

/**
 * @typedef {Object} ChampionDetailModalProps
 * @property {boolean} visible Si el modal está visible (controla la
 * animación de entrada/salida del sheet).
 * @property {string} championName Nombre interno del campeón (clave Data
 * Dragon). Si es falsy, el modal no renderiza.
 * @property {Object[]} matches Partidas usadas para agregar las stats del
 * campeón vía `statsForChampion`.
 * @property {{primary?: string}} [factionTheme] Tema de facción; `primary` se
 * usa como color de acento (default `#7B76DD`).
 * @property {() => void} onClose Callback para cerrar el modal.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, Image, StyleSheet, Modal, TouchableOpacity, Animated,
  Dimensions, Easing, Platform, ScrollView,
} from 'react-native';
import Svg, { Polygon, Path, Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../context/ThemeContext';
import { statsForChampion, displayChampionName } from '../utils/championStats';
import { normalizeChampionName } from '../utils/championImage';
// Icono CUADRADO oficial de Data Dragon (versionado, fiable) para el hexágono:
// reemplaza al loading art vertical, que se recortaba descentrado.
import { getChampionImageUrl } from '../utils/dataDragon';
// Curva de poder por campeón (consejos por fase) + ranking estimado.
import { phaseTipsFor, estimatedLadderRank } from '../utils/championPhases';
// Medallón estándar de trofeos (color por tier). Reutilizado en INSIGNIAS · DOMINIO.
import TrophyBadge, { resolveTier, TIER_LABEL } from './TrophyBadge';
// Trofeos de la SALA DE TROFEOS (mismo motor que Forge): los mostramos también
// por campeón en el modal (C1) — medallón con el RETRATO del campeón.
import { computeAllTrophies } from '../utils/trophies';
import { ALL_TROPHIES } from '../data/trophies';

// Logros por campeón persistidos entre sesiones en AsyncStorage. Estructura:
// { [championName]: { [nombreDelReto]: timestampDesbloqueo } }
const ACHIEVEMENTS_KEY = 'novarift_champ_achievements';

const { width: SW, height: SH } = Dimensions.get('window');
const SHEET_HEIGHT = Math.min(SH * 0.9, 760);
const HEADER_H = 160;

// Texto claro FIJO para los textos que se superponen al splash art del header
// (nombre + botón cerrar): se quedan claros en ambos modos por legibilidad
// sobre la imagen oscura del campeón. El cuerpo del sheet usa c.textPrimary.
const TEXT_MAIN = '#E8E4FF';

const LOADING_URL = (name) =>
  `https://ddragon.leagueoflegends.com/cdn/img/champion/loading/${normalizeChampionName(name)}_0.jpg`;
const SPLASH_URL = (name) =>
  `https://cdn.communitydragon.org/latest/champion/${normalizeChampionName(name)}/splash-art/centered`;
// Arte CENTRADO (CommunityDragon): el splash crudo recortaba mal a los campeones
// con arte descentrado (Ezreal salía sin cabeza en el header del modal).

// ─── Orbital ────────────────────────────────────────────────────────────────
const ORBIT_SIZE    = 320;
const ORBIT_CENTER  = ORBIT_SIZE / 2;
const HEX_SIZE      = 110;
const RING_SIZE     = 134;
const METRIC_RADIUS = 130;
const METRIC_W      = 72;
const METRIC_H      = 54;

const HEX_POINTS  = '60,4 113,32 113,88 60,116 7,88 7,32';
const HEX_MASK_D  = 'M0 0 H120 V120 H0 Z M60 4 L113 32 L113 88 L60 116 L7 88 L7 32 Z';
const RING_POINTS = (() => {
  const c = RING_SIZE / 2;
  const r = RING_SIZE / 2 - 2;
  return Array.from({ length: 6 }, (_, i) => {
    const a = -Math.PI / 2 + i * Math.PI / 3;
    return `${(c + r * Math.cos(a)).toFixed(1)},${(c + r * Math.sin(a)).toFixed(1)}`;
  }).join(' ');
})();

// Métricas que se colocan en el orbital. El orbital reparte los nodos en
// círculo automáticamente (el ángulo de cada uno = índice / METRIC_DEFS.length),
// así que añadir o quitar una métrica aquí reordena el círculo sin más cambios.
// Son las 5 que importan para evaluar a un campeón: winrate, KDA, visión, daño
// y oro. statsForChampion agrega `avgGold`; con datos de demo/mocks (que traen
// `gold`) muestra valor real, y con un backend que aún no expone goldEarned
// mostrará '--' sin romper nada.
const METRIC_DEFS = [
  { label: 'WIN RATE', key: 'winRate' },
  { label: 'KDA',      key: 'kda' },
  { label: 'VISIÓN',   key: 'visionScore' },
  { label: 'DAÑO',     key: 'damageDealt' },
  { label: 'ORO',      key: 'goldEarned' },
];

// ─── Tiers ────────────────────────────────────────────────────────────────
const TIER_COLOR = {
  silver:     'rgba(170,170,200,1)',
  gold:       'rgba(205,160,40,1)',
  platinum:   'rgba(0,200,150,1)',
  diamond:    'rgba(60,180,255,1)',
  challenger: 'rgba(255,210,50,1)',
};
const TIER_SHORT = {
  silver: 'PLATA', gold: 'ORO', platinum: 'PLATINO',
  diamond: 'DIAMANTE', challenger: 'CHALL',
};

const tierForCSPM = (v) => {
  if (v < 4)    return { tier: 'silver',     text: 'Tu farmeo está en Silver' };
  if (v < 5.5)  return { tier: 'gold',       text: 'Farmeas como la mayoría en Gold' };
  if (v < 7)    return { tier: 'platinum',   text: 'Tu CS/min es nivel Platino' };
  if (v <= 8.5) return { tier: 'diamond',    text: 'Farmeas como un Diamante' };
  return              { tier: 'challenger', text: 'CS/min de nivel Challenger' };
};
const tierForKDA = (v) => {
  if (v < 2)   return { tier: 'silver',     text: 'KDA típico de Bronze-Silver' };
  if (v < 3)   return { tier: 'gold',       text: 'KDA nivel Gold' };
  if (v < 4.5) return { tier: 'platinum',   text: 'KDA de Platino' };
  if (v <= 6)  return { tier: 'diamond',    text: 'KDA nivel Diamante' };
  return             { tier: 'challenger', text: 'KDA de Challenger' };
};
const tierForVision = (v) => {
  if (v < 15)  return { tier: 'silver',     text: 'Vision score de Silver' };
  if (v < 22)  return { tier: 'gold',       text: 'Vision como un Gold' };
  if (v <= 30) return { tier: 'platinum',   text: 'Vision nivel Platino-Diamante' };
  return             { tier: 'challenger', text: 'Vision score de jugador profesional' };
};
const tierForWinRate = (v) => {
  if (v < 45)  return { tier: 'silver',   text: 'WR por debajo de la media' };
  if (v < 55)  return { tier: 'gold',     text: 'WR equilibrado' };
  if (v <= 65) return { tier: 'platinum', text: 'WR de jugador sólido (Plat+)' };
  return             { tier: 'diamond',  text: 'WR extraordinario — nivel Diamante+' };
};

function metricTier(key, stats) {
  let t = null;
  if (key === 'csPerMin'    && stats.avgCs     > 0) t = tierForCSPM(stats.avgCs).tier;
  else if (key === 'kda'         && stats.avgKda    > 0) t = tierForKDA(stats.avgKda).tier;
  else if (key === 'visionScore' && stats.avgVision > 0) t = tierForVision(stats.avgVision).tier;
  else if (key === 'winRate'     && stats.games     > 0) t = tierForWinRate(stats.winrate).tier;
  if (!t) return null;
  return { short: TIER_SHORT[t], color: TIER_COLOR[t] };
}

function buildTierRows(stats) {
  const rows = [];
  if (stats.avgCs > 0) {
    const r = tierForCSPM(stats.avgCs);
    rows.push({ ...r, sub: `${stats.avgCs.toFixed(1)} CS/min` });
  }
  if (stats.avgKda > 0) {
    const r = tierForKDA(stats.avgKda);
    rows.push({ ...r, sub: `${stats.avgKda.toFixed(1)} KDA` });
  }
  if (stats.games > 0) {
    const r = tierForWinRate(stats.winrate);
    rows.push({ ...r, sub: `${stats.winrate}% WR` });
  }
  if (stats.avgVision > 0) {
    const r = tierForVision(stats.avgVision);
    rows.push({ ...r, sub: `${Math.round(stats.avgVision)} vision/partida` });
  }
  return rows;
}

// ─── Comparativas con jugadores pro ───────────────────────────────────────
const PRO_COMPARISONS = {
  cspm: [
    { threshold: 8.0, text: 'CS/min comparable a Uzi',    player: 'Uzi',   stat: 'CS/min' },
    { threshold: 7.5, text: 'Farmeo de carry profesional', player: 'Ruler', stat: 'CS/min' },
  ],
  kda: [
    { threshold: 5.0, text: 'KDA al nivel de Faker',      player: 'Faker', stat: 'KDA' },
    { threshold: 4.0, text: 'Rendimiento de jugador pro', player: 'BeryL', stat: 'KDA' },
  ],
  winRate: [
    { threshold: 70, text: 'Win rate de one-trick challenger', player: 'Challenger OTP', stat: 'Win Rate' },
    { threshold: 60, text: 'Consistencia de jugador semipro',  player: 'Jugador semipro', stat: 'Win Rate' },
  ],
};

const CHAMPION_PRO = {
  Lux:       { player: 'IWillDominate', stat: 'support' },
  Jinx:      { player: 'Uzi',          stat: 'ADC legendary' },
  LeBlanc:   { player: 'Faker',        stat: 'mid assassin' },
  Zed:       { player: 'Faker',        stat: 'mid assassin' },
  Syndra:    { player: 'Faker',        stat: 'mid control' },
  Katarina:  { player: 'CarryU',       stat: 'mid snowball' },
  Yasuo:     { player: 'Rascal',       stat: 'carry' },
  Fiora:     { player: 'TheShy',       stat: 'top split' },
  Garen:     { player: 'TheShy',       stat: 'top dominator' },
  Lucian:    { player: 'Uzi',          stat: 'ADC aggression' },
  Vayne:     { player: 'Uzi',          stat: 'ADC mechanics' },
  Thresh:    { player: 'BeryL',        stat: 'support plays' },
  Nautilus:  { player: 'Keria',        stat: 'support engage' },
};

const pickPro = (list, value) => list.find((it) => value >= it.threshold) || null;

function buildProRows(stats, championName, displayName) {
  const rows = [];
  const otp = CHAMPION_PRO[championName];
  if (otp && stats.games > 0) {
    rows.push({
      player: otp.player,
      text: `Dominas a ${displayName} como ${otp.player}`,
      sub: `${otp.player} · ${otp.stat}`,
    });
  }
  const kdaRow = pickPro(PRO_COMPARISONS.kda, stats.avgKda);
  if (kdaRow) rows.push({ player: kdaRow.player, text: kdaRow.text, sub: `${stats.avgKda.toFixed(1)} ${kdaRow.stat}` });
  const csRow = pickPro(PRO_COMPARISONS.cspm, stats.avgCs);
  if (csRow) rows.push({ player: csRow.player, text: csRow.text, sub: `${stats.avgCs.toFixed(1)} ${csRow.stat}` });
  const wrRow = pickPro(PRO_COMPARISONS.winRate, stats.winrate);
  if (wrRow) rows.push({ player: wrRow.player, text: wrRow.text, sub: `${stats.winrate}% ${wrRow.stat}` });
  return rows.slice(0, 2);
}

// ─── Retos del campeón ─────────────────────────────────────────────────────
const clamp01 = (v) => Math.max(0, Math.min(1, v));

function buildChallenges(stats, matches, championName) {
  const champMatches = (matches || []).filter((m) => m.championName === championName);
  const kdaOver3 = champMatches.filter((m) => (Number(m.kda) || 0) > 3).length;
  const streak = stats.longestWinStreak || 0;
  return [
    {
      name: 'Alcanza 7 CS/min',
      progress: clamp01(stats.avgCs / 7),
      label: `${stats.avgCs.toFixed(1)} / 7.0 CS/min`,
      done: stats.avgCs >= 7,
    },
    {
      name: 'KDA > 3.0 en 5 partidas',
      progress: clamp01(kdaOver3 / 5),
      label: `${kdaOver3} / 5 partidas`,
      done: kdaOver3 >= 5,
    },
    {
      name: '3 victorias consecutivas',
      progress: clamp01(streak / 3),
      label: `Racha máx. ${Math.min(streak, 3)} / 3`,
      done: streak >= 3,
    },
  ];
}

// ─── Récords personales con el campeón (H36-T8) ────────────────────────────
// Derivados de las partidas disponibles (reales si las hay). Mejor multikill a
// partir de los contadores penta/quadra/triple/double cuando existen; récord de
// kills en una partida; y mejor racha ganadora.
const MULTI_LABEL = { 5: 'Pentakill', 4: 'Cuádruple', 3: 'Triple', 2: 'Doble', 0: '—' };
function buildChampRecords(matches, championName) {
  const ms = (matches || []).filter((m) => m.championName === championName);
  if (ms.length === 0) return null;
  let multi = 0;
  for (const m of ms) {
    if ((m.pentaKills || 0) > 0)       multi = Math.max(multi, 5);
    else if ((m.quadraKills || 0) > 0) multi = Math.max(multi, 4);
    else if ((m.tripleKills || 0) > 0) multi = Math.max(multi, 3);
    else if ((m.doubleKills || 0) > 0) multi = Math.max(multi, 2);
  }
  const bestKills = ms.reduce((mx, m) => Math.max(mx, Number(m.kills) || 0), 0);
  let cur = 0, streak = 0;
  for (const m of ms) {
    if (m.result === 'W' || m.result === 'WIN') { cur += 1; streak = Math.max(streak, cur); }
    else cur = 0;
  }
  return { multiLabel: MULTI_LABEL[multi] || '—', bestKills, streak };
}

// ─── Insignias por nivel de dominio (H36-T8 · estándar de trofeos) ──────────
// Medallones de maestría: una insignia por dimensión de rendimiento (farmeo,
// combate, win rate, visión) coloreada con el MISMO tier que ya calculan
// tierForCSPM/tierForKDA/tierForVision/tierForWinRate. El medallón (TrophyBadge)
// es el mismo que la Vitrina de Forge → estándar de trofeos único en la app.
function buildMasteryBadges(stats) {
  const out = [];
  if (stats.avgCs > 0) {
    const t = tierForCSPM(stats.avgCs).tier;
    out.push({ key: 'farm', label: 'FARMEO', value: stats.avgCs.toFixed(1), tier: t, tierLabel: TIER_LABEL[resolveTier(t)] });
  }
  if (stats.avgKda > 0) {
    const t = tierForKDA(stats.avgKda).tier;
    out.push({ key: 'kda', label: 'KDA', value: stats.avgKda.toFixed(1), tier: t, tierLabel: TIER_LABEL[resolveTier(t)] });
  }
  if (stats.games > 0) {
    const t = tierForWinRate(stats.winrate).tier;
    out.push({ key: 'wr', label: 'WIN RATE', value: `${stats.winrate}%`, tier: t, tierLabel: TIER_LABEL[resolveTier(t)] });
  }
  if (stats.avgVision > 0) {
    const t = tierForVision(stats.avgVision).tier;
    out.push({ key: 'vis', label: 'VISIÓN', value: String(Math.round(stats.avgVision)), tier: t, tierLabel: TIER_LABEL[resolveTier(t)] });
  }
  return out;
}

// ─── Trofeos por campeón (SALA DE TROFEOS) ──────────────────────────────────
// Tier del medallón por trofeo — MISMA escalera bronce→master que la VITRINA de
// ForgeScreen, para que el estándar de trofeos sea idéntico en toda la app.
const TROPHY_TIER = {
  first_blood_coach: 'bronce',
  ojos_vacio:        'plata',
  ingenio_plata:     'plata',
  wuju_harvest:      'oro',
  estilo_ruler:      'oro',
  farm_machine:      'oro',
  vision_master:     'diamante',
  pool_expert:       'diamante',
  nova_veteran:      'master',
};

// Trofeos del campeón ordenados (conseguidos primero, luego por progreso). Se
// evalúan SOLO sobre las partidas de ese campeón → trofeos "del campeón".
function buildChampionTrophies(matches, championName) {
  const champMatches = (matches || []).filter((m) => m.championName === championName);
  if (champMatches.length === 0) return [];
  const all = computeAllTrophies(ALL_TROPHIES, champMatches);
  return [...all].sort((a, b) => {
    const ae = a.state === 'earned' ? 1 : 0;
    const be = b.state === 'earned' ? 1 : 0;
    if (ae !== be) return be - ae;
    return (b.progress || 0) - (a.progress || 0);
  });
}

// ─── Fases de partida ──────────────────────────────────────────────────────
const fmtDamage = (v) =>
  !v || v <= 0 ? '--' : v >= 1000 ? `${(v / 1000).toFixed(1)}k` : Math.round(v).toString();

// Los consejos de fase NO son genéricos: vienen de la curva de poder del
// campeón (phaseTipsFor: tabla curada + heurística del catálogo). Si el campeón
// escala mal o bien, el aviso es explícito en la fase correspondiente.
function phasesFor(stats, championName, displayName) {
  const hasData = stats.games > 0;
  const tips = phaseTipsFor(championName, displayName);
  return [
    { id: 'early',  label: 'EARLY',  range: "0-7'",   metric: stats.avgCs > 0 ? `${stats.avgCs.toFixed(1)} CS/min` : '--', tip: tips.early },
    { id: 'laning', label: 'LANING', range: "7-14'",  metric: hasData ? `${stats.winrate}% WR` : '--',                    tip: tips.laning },
    { id: 'mid',    label: 'MID',    range: "14-21'", metric: stats.avgKda > 0 ? `${stats.avgKda.toFixed(1)} KDA` : '--', tip: tips.mid },
    { id: 'late',   label: 'LATE',   range: "21-28'", metric: stats.avgVision > 0 ? `${Math.round(stats.avgVision)} vision` : '--', tip: tips.late },
    { id: 'end',    label: 'END',    range: "28'+",   metric: fmtDamage(stats.avgDamage) === '--' ? '--' : `${fmtDamage(stats.avgDamage)} daño`, tip: tips.end },
  ];
}

// Valor central de cada métrica orbital ("--" si no hay datos). El oro reutiliza
// el mismo formateador en miles (fmtDamage → "12.3k") que el daño.
function formatMetric(key, stats) {
  switch (key) {
    case 'csPerMin':    return stats.avgCs     > 0 ? stats.avgCs.toFixed(1)                  : '--';
    case 'kda':         return stats.avgKda    > 0 ? stats.avgKda.toFixed(1)                 : '--';
    case 'visionScore': return stats.avgVision > 0 ? Math.round(stats.avgVision).toString()  : '--';
    case 'damageDealt': return fmtDamage(stats.avgDamage);
    case 'winRate':     return stats.games     > 0 ? `${stats.winrate}%`                     : '--';
    case 'gamesPlayed': return stats.games     > 0 ? stats.games.toString()                  : '--';
    case 'goldEarned':  return fmtDamage(stats.avgGold);
    default:            return '--';
  }
}

/**
 * Modal de ficha de campeón con orbital de métricas, comparativas y retos.
 *
 * @param {ChampionDetailModalProps} props Propiedades del componente.
 * @returns {React.ReactElement|null} El modal, o `null` si no hay campeón/stats.
 */
export default function ChampionDetailModal({
  visible,
  championName,
  matches,
  factionTheme,
  onClose,
}) {
  const { colors: c } = useTheme();
  const styles = useMemo(() => makeModalStyles(c), [c]);
  const accent = factionTheme?.primary || '#7B76DD';
  const stats  = championName ? statsForChampion(matches || [], championName) : null;

  /** @type {'early'|'laning'|'mid'|'late'|'end'} fase de partida seleccionada */
  const [activePhase, setActivePhase] = useState('early');

  // Logros del campeón: { [nombreReto]: timestamp }. Persisten en AsyncStorage
  // (clave global ACHIEVEMENTS_KEY, con un sub-mapa por campeón).
  const [achievements, setAchievements] = useState({});

  /** @type {React.MutableRefObject<Animated.Value>} opacidad del backdrop (0→1) */
  const backdropAnim = useRef(new Animated.Value(0)).current;
  /** @type {React.MutableRefObject<Animated.Value>} translateY del sheet (oculto→0) */
  const sheetAnim    = useRef(new Animated.Value(SHEET_HEIGHT)).current;
  /** Pulso de la fila LOGROS al desbloquear (scale 1→1.12→1). */
  const unlockAnim   = useRef(new Animated.Value(1)).current;
  // El anillo giratorio del retrato se retiró por simplicidad visual; el
  // hexágono del retrato se mantiene estático.

  useEffect(() => {
    if (visible) {
      setActivePhase('early');
      Animated.parallel([
        Animated.timing(backdropAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.timing(sheetAnim, {
          toValue: 0, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: true,
        }),
      ]).start();
    } else {
      backdropAnim.setValue(0);
      sheetAnim.setValue(SHEET_HEIGHT);
    }
  }, [visible]);

  // Al abrir (o cambiar de campeón) recupera sus logros guardados.
  useEffect(() => {
    if (!visible || !championName) return;
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(ACHIEVEMENTS_KEY);
        const all = raw ? JSON.parse(raw) : {};
        if (!cancelled) setAchievements(all?.[championName] || {});
      } catch (_) {
        if (!cancelled) setAchievements({});
      }
    })();
    return () => { cancelled = true; };
  }, [visible, championName]);

  /**
   * Reclama un reto completado: lo persiste como logro y dispara la animación
   * corta de la fila LOGROS. Idempotente (volver a tocarlo no lo duplica).
   */
  const claimAchievement = async (challenge) => {
    if (!challenge?.done || achievements[challenge.name]) return;
    const next = { ...achievements, [challenge.name]: Date.now() };
    setAchievements(next);
    Animated.sequence([
      Animated.timing(unlockAnim, { toValue: 1.12, duration: 140, useNativeDriver: true }),
      Animated.spring(unlockAnim, { toValue: 1, friction: 4, useNativeDriver: true }),
    ]).start();
    try {
      const raw = await AsyncStorage.getItem(ACHIEVEMENTS_KEY);
      const all = raw ? JSON.parse(raw) : {};
      all[championName] = next;
      await AsyncStorage.setItem(ACHIEVEMENTS_KEY, JSON.stringify(all));
    } catch (_) { /* best effort — el estado en memoria ya refleja el logro */ }
  };

  if (!championName || !stats) return null;

  const displayName = displayChampionName(championName);

  const tierRows  = buildTierRows(stats);
  const proRows   = buildProRows(stats, championName, displayName);
  const challenges = buildChallenges(stats, matches, championName);
  const records   = buildChampRecords(matches, championName);
  const masteryBadges = buildMasteryBadges(stats);
  // C1 — retrato CUADRADO del campeón (Data Dragon) para los medallones de
  // INSIGNIAS · DOMINIO y de la sección TROFEOS (estándar "medallón con cara").
  const championPortrait = getChampionImageUrl(championName);
  const championTrophies = buildChampionTrophies(matches, championName);
  const phases    = phasesFor(stats, championName, displayName);
  const phase     = phases.find((p) => p.id === activePhase) || phases[0];
  // Ranking estimado determinístico (se marca con badge ESTIMADO en el UI).
  const ladderRank = estimatedLadderRank(championName, stats);
  const unlockedList = Object.keys(achievements);
  // El .map de retos usa `c` como variable de reto (sombrea el `c` del tema),
  // así que precalculamos aquí el neutro tematizado del estado "en progreso".
  const stateMuted = c.onSurface(0.4);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View
        style={[styles.backdrop, { opacity: backdropAnim }]}
        pointerEvents={visible ? 'auto' : 'none'}
      >
        <TouchableOpacity activeOpacity={1} onPress={onClose} style={StyleSheet.absoluteFillObject} />
      </Animated.View>

      <Animated.View
        style={[
          styles.sheet,
          { transform: [{ translateY: sheetAnim }], borderColor: accent + '44' },
        ]}
      >
        {/* ── Header: splash + degradado SVG + nombre centrado ────────────── */}
        <View style={styles.header}>
          <Image
            source={{ uri: SPLASH_URL(championName) }}
            style={[
              StyleSheet.absoluteFillObject,
              // T10 — encuadre alto en web para que la cabeza no quede recortada
              // en el header bajo (refuerza el endpoint /splash-art/centered).
              Platform.OS === 'web' ? { objectFit: 'cover', objectPosition: '50% 22%' } : null,
            ]}
            resizeMode="cover"
          />
          <Svg style={StyleSheet.absoluteFillObject} width={SW} height={HEADER_H}>
            <Defs>
              <LinearGradient id="hdrGrad" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0"    stopColor={c.bg1} stopOpacity="0" />
                <Stop offset="0.45" stopColor={c.bg1} stopOpacity="0.4" />
                <Stop offset="1"    stopColor={c.bg1} stopOpacity="1" />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width={SW} height={HEADER_H} fill="url(#hdrGrad)" />
          </Svg>

          <TouchableOpacity
            onPress={onClose}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.closeBtn}
          >
            <Text style={styles.closeBtnText}>×</Text>
          </TouchableOpacity>

          <View style={styles.headerContent}>
            <Text style={styles.headerName} numberOfLines={1}>{displayName}</Text>
            <Text style={styles.headerSub}>
              {stats.games > 0
                ? `${stats.games} ${stats.games === 1 ? 'partida' : 'partidas'} · ${stats.winrate}% WR`
                : 'Sin partidas todavía'}
            </Text>
          </View>
        </View>

        <ScrollView
          style={styles.bodyScroll}
          contentContainerStyle={styles.bodyContent}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Orbital: retrato hexagonal estático + 5 métricas en círculo ── */}
          <View style={styles.orbital}>
            <View style={styles.hex}>
              <Image
                source={{ uri: getChampionImageUrl(championName) }}
                style={styles.hexImage}
                resizeMode="cover"
              />
              <Svg
                width={HEX_SIZE}
                height={HEX_SIZE}
                viewBox="0 0 120 120"
                style={StyleSheet.absoluteFillObject}
                pointerEvents="none"
              >
                <Path d={HEX_MASK_D} fill={c.bg1} fillRule="evenodd" />
                <Polygon points={HEX_POINTS} fill="transparent" stroke={accent} strokeWidth={2} />
              </Svg>
            </View>

            {METRIC_DEFS.map((m, i) => {
              const angle = (i * 2 * Math.PI) / METRIC_DEFS.length - Math.PI / 2;
              const left  = ORBIT_CENTER + Math.cos(angle) * METRIC_RADIUS - METRIC_W / 2;
              const top   = ORBIT_CENTER + Math.sin(angle) * METRIC_RADIUS - METRIC_H / 2;
              const tb    = metricTier(m.key, stats);
              return (
                <View key={m.key} style={[styles.metric, { left, top }]}>
                  <Text style={styles.metricValue} numberOfLines={1}>{formatMetric(m.key, stats)}</Text>
                  <Text style={styles.metricLabel} numberOfLines={1}>{m.label}</Text>
                  {tb ? (
                    <View style={[styles.metricBadge, { backgroundColor: tb.color + '22' }]}>
                      <Text style={[styles.metricBadgeText, { color: tb.color }]} numberOfLines={1}>{tb.short}</Text>
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>

          {/* ── Ranking estimado (mock honesto, determinístico) ──────────── */}
          {ladderRank !== null ? (
            <View style={[styles.rankCard, { borderColor: accent + '33' }]}>
              <Text style={styles.rankText}>
                Eres el {displayName} <Text style={[styles.rankNumber, { color: accent }]}>nº{ladderRank.toLocaleString('es-ES')}</Text> de EUW
              </Text>
              <View style={styles.rankBadge}>
                <Text style={styles.rankBadgeText}>ESTIMADO</Text>
              </View>
            </View>
          ) : null}

          {/* ── Comparativa de rango ────────────────────────────────────── */}
          {tierRows.length > 0 ? (
            <View style={styles.tierCard}>
              <Text style={styles.tierTitle}>COMPARATIVA DE RANGO</Text>
              {tierRows.map((r, idx) => (
                <View key={idx} style={[styles.cmpRow, idx > 0 && styles.cmpRowSpaced]}>
                  <View style={[styles.tierSquare, { backgroundColor: TIER_COLOR[r.tier] }]} />
                  <View style={styles.cmpTextWrap}>
                    <Text style={styles.cmpText}>{r.text}</Text>
                    <Text style={styles.cmpSub}>({r.sub})</Text>
                  </View>
                </View>
              ))}
            </View>
          ) : null}

          {/* ── Nivel pro ───────────────────────────────────────────────── */}
          {proRows.length > 0 ? (
            <View style={styles.proCard}>
              <Text style={styles.proTitle}>NIVEL PRO</Text>
              {proRows.map((r, idx) => (
                <View key={idx} style={[styles.cmpRow, idx > 0 && styles.cmpRowSpaced]}>
                  <View style={styles.proSquare} />
                  <View style={styles.cmpTextWrap}>
                    <Text style={styles.cmpText}>{r.text}</Text>
                    <Text style={styles.cmpSub}>({r.sub})</Text>
                  </View>
                </View>
              ))}
            </View>
          ) : null}

          {/* ── Récords personales (H36-T8) ─────────────────────────────── */}
          {records ? (
            <>
              <Text style={styles.sectionHeader}>RÉCORDS</Text>
              <View style={styles.recordsRow}>
                <View style={styles.recordCard}>
                  <Text style={[styles.recordValue, { color: accent }]}>{records.multiLabel}</Text>
                  <Text style={styles.recordLabel}>Mejor multikill</Text>
                </View>
                <View style={styles.recordCard}>
                  <Text style={[styles.recordValue, { color: accent }]}>{records.bestKills}</Text>
                  <Text style={styles.recordLabel}>Kills en una partida</Text>
                </View>
                <View style={styles.recordCard}>
                  <Text style={[styles.recordValue, { color: accent }]}>{records.streak}W</Text>
                  <Text style={styles.recordLabel}>Mejor racha</Text>
                </View>
              </View>
            </>
          ) : null}

          {/* ── Insignias por nivel de dominio (medallón con RETRATO + tier) ── */}
          {masteryBadges.length > 0 ? (
            <>
              <Text style={styles.sectionHeader}>INSIGNIAS · DOMINIO</Text>
              <View style={styles.badgeGrid}>
                {masteryBadges.map((b) => (
                  <View key={b.key} style={styles.masteryCard}>
                    {/* C1 — medallón con la CARA del campeón y aro de tier; el
                        valor de la métrica pasa a texto bajo el medallón. */}
                    <TrophyBadge tier={b.tier} portraitUrl={championPortrait} size={48} />
                    <Text style={[styles.masteryValue, { color: accent }]} numberOfLines={1}>{b.value}</Text>
                    <Text style={styles.masteryLabel} numberOfLines={1}>{b.label}</Text>
                    <Text style={styles.masteryTier} numberOfLines={1}>{b.tierLabel}</Text>
                  </View>
                ))}
              </View>
            </>
          ) : null}

          {/* ── TROFEOS del campeón (SALA DE TROFEOS por campeón, con retrato) ──
              Los mismos trofeos de la Forja, evaluados sobre las partidas de
              ESTE campeón. El medallón lleva la cara del campeón (estándar
              "Estilo Ruler"). Aparece también al abrir el modal desde CHAMPION
              POOL → cubre la petición de "ver trofeos en el champion pool". */}
          {championTrophies.length > 0 ? (
            <>
              <Text style={styles.sectionHeader}>TROFEOS</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.trophyRow}
              >
                {championTrophies.map(({ trophy, state, progress }) => {
                  const isEarned = state === 'earned';
                  return (
                    <View
                      key={trophy.id}
                      style={[
                        styles.trophyCard,
                        { borderColor: isEarned ? accent + '88' : c.onSurface(0.08), opacity: isEarned ? 1 : 0.6 },
                      ]}
                    >
                      {/* Sin `locked`: la card ya atenúa los no conseguidos con
                          su opacity; doblar el atenuado dejaría la cara ilegible. */}
                      <TrophyBadge
                        tier={TROPHY_TIER[trophy.id] || 'oro'}
                        portraitUrl={championPortrait}
                        size={42}
                      />
                      <Text style={styles.trophyName} numberOfLines={2}>{trophy.name}</Text>
                      <Text
                        style={[styles.trophyState, { color: isEarned ? c.success : c.onSurface(0.4) }]}
                        numberOfLines={1}
                      >
                        {isEarned ? 'CONSEGUIDO' : `${Math.round((progress || 0) * 100)}%`}
                      </Text>
                    </View>
                  );
                })}
              </ScrollView>
            </>
          ) : null}

          {/* ── Fases de partida ────────────────────────────────────────── */}
          <Text style={styles.sectionHeader}>FASES DE PARTIDA</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.phaseChips}
          >
            {phases.map((p) => {
              const active = p.id === activePhase;
              return (
                <TouchableOpacity
                  key={p.id}
                  activeOpacity={0.8}
                  onPress={() => setActivePhase(p.id)}
                  style={[
                    styles.phaseChip,
                    active
                      ? { backgroundColor: accent + '22', borderColor: accent }
                      : { borderColor: c.onSurface(0.1) },
                  ]}
                >
                  <Text style={[styles.phaseChipLabel, { color: active ? c.textPrimary : c.onSurface(0.4) }]}>
                    {p.label}
                  </Text>
                  <Text style={[styles.phaseChipRange, { color: active ? accent : c.onSurface(0.3) }]}>
                    {p.range}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          <View style={[styles.phaseDetail, { borderLeftColor: accent }]}>
            <Text style={styles.phaseDetailValue}>{phase.metric}</Text>
            <Text style={styles.phaseDetailTip}>{phase.tip}</Text>
          </View>

          {/* ── Retos del campeón (completado → pulsable → desbloquea logro) ── */}
          <Text style={styles.sectionHeader}>{`RETOS CON ${displayName.toUpperCase()}`}</Text>
          <View style={styles.challengeList}>
            {challenges.map((c, idx) => {
              const claimed = !!achievements[c.name];
              return (
                <TouchableOpacity
                  key={idx}
                  activeOpacity={c.done && !claimed ? 0.7 : 1}
                  disabled={!c.done || claimed}
                  onPress={() => claimAchievement(c)}
                  style={[
                    styles.challengeCard,
                    c.done && !claimed && { borderColor: accent + '88' },
                  ]}
                >
                  <View style={styles.challengeTop}>
                    <Text style={styles.challengeName} numberOfLines={1}>{c.name}</Text>
                    <Text style={[styles.challengeState, { color: c.done ? accent : stateMuted }]}>
                      {claimed ? 'LOGRO ✓' : c.done ? 'COMPLETADO' : 'EN PROGRESO'}
                    </Text>
                  </View>
                  <View style={styles.progressTrack}>
                    <View
                      style={[
                        styles.progressFill,
                        { width: `${Math.round(c.progress * 100)}%`, backgroundColor: accent },
                      ]}
                    />
                  </View>
                  <Text style={styles.challengeLabel}>
                    {c.done && !claimed ? `${c.label} · Toca para reclamar el logro` : c.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* ── LOGROS desbloqueados (persisten tras recargar la app) ────── */}
          {unlockedList.length > 0 ? (
            <>
              <Text style={styles.sectionHeader}>LOGROS</Text>
              <Animated.View
                style={[styles.achievementsRow, { transform: [{ scale: unlockAnim }] }]}
              >
                {unlockedList.map((name) => (
                  <View key={name} style={[styles.achievementChip, { borderColor: accent + '66' }]}>
                    <Text style={styles.achievementTrophy}>🏆</Text>
                    <Text style={[styles.achievementText, { color: accent }]} numberOfLines={1}>
                      {name}
                    </Text>
                  </View>
                ))}
              </Animated.View>
            </>
          ) : null}
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

const makeModalStyles = (c) => StyleSheet.create({
  // El backdrop es un scrim NEGRO de oscurecimiento (no una superficie neutra):
  // se mantiene literal para no alterar el modo oscuro (c.scrim sería 0.55).
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.65)' },
  sheet: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    height: SHEET_HEIGHT,
    // B4.5 — elevación dark-mode by design: los modales usan bg2 (no bg0/bg1)
    // para "surgir" del fondo de la pantalla.
    backgroundColor: c.bg2,
    borderTopLeftRadius: 18, borderTopRightRadius: 18,
    borderWidth: 1, borderBottomWidth: 0,
    overflow: 'hidden',
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 -8px 32px rgba(0,0,0,0.6)' }
      : {
          shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 16,
          shadowOffset: { width: 0, height: -8 }, elevation: 12,
        }),
  },

  // ── Header ─────────────────────────────────────────────────────────────
  header: { width: '100%', height: HEADER_H, position: 'relative' },
  closeBtn: {
    position: 'absolute', top: 12, right: 12, zIndex: 2,
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: 'rgba(7,7,13,0.6)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
  },
  closeBtnText: { color: TEXT_MAIN, fontSize: 20, fontWeight: '600', lineHeight: 20 },
  headerContent: {
    position: 'absolute', left: 0, right: 0, bottom: 14,
    alignItems: 'center', paddingHorizontal: 16,
  },
  headerName: {
    color: TEXT_MAIN,
    fontFamily: 'Rajdhani_700Bold',
    fontSize: 28,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  headerSub: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 12, marginTop: 2, textAlign: 'center',
  },

  // ── Body ───────────────────────────────────────────────────────────────
  bodyScroll: { flex: 1 },
  bodyContent: { paddingHorizontal: 16, paddingBottom: 28 },

  // ── Orbital ──────────────────────────────────────────────────────────────
  orbital: { width: ORBIT_SIZE, height: ORBIT_SIZE, alignSelf: 'center', position: 'relative', marginTop: 4 },
  ring: {
    position: 'absolute',
    top: ORBIT_CENTER - RING_SIZE / 2,
    left: ORBIT_CENTER - RING_SIZE / 2,
    width: RING_SIZE, height: RING_SIZE,
    alignItems: 'center', justifyContent: 'center',
    ...(Platform.OS === 'web'
      ? { filter: 'drop-shadow(0 0 6px rgba(123,118,221,0.5))' }
      : { shadowOpacity: 0.6, shadowRadius: 8, shadowOffset: { width: 0, height: 0 } }),
  },
  hex: {
    position: 'absolute',
    top: ORBIT_CENTER - HEX_SIZE / 2,
    left: ORBIT_CENTER - HEX_SIZE / 2,
    width: HEX_SIZE, height: HEX_SIZE,
    backgroundColor: c.bg1,
    overflow: 'hidden',
  },
  // Loading art mas alto que el hex y anclado arriba: la cara (tercio superior
  // del art 308x560) queda centrada dentro del hexagono.
  hexImage: {
    position: 'absolute',
    left: 0,
    top: -HEX_SIZE * 0.2,
    width: HEX_SIZE,
    height: HEX_SIZE * 1.4,
    transform: [{ translateY: -10 }],
  },

  metric: { position: 'absolute', width: METRIC_W, height: METRIC_H, alignItems: 'center', justifyContent: 'flex-start' },
  // El orbital de métricas se asienta sobre el cuerpo del sheet (c.bg1), no sobre
  // el splash del header, así que su texto se tematiza para ser legible en claro.
  metricValue: {
    color: c.textPrimary,
    fontFamily: 'Rajdhani_700Bold',
    fontSize: 20,
    letterSpacing: 0.3,
    fontVariant: ['tabular-nums'],
  },
  metricLabel: {
    color: c.onSurface(0.55),
    fontSize: 9, fontWeight: '800', letterSpacing: 1.2, marginTop: 1,
  },
  metricBadge: {
    marginTop: 3, paddingHorizontal: 5, paddingVertical: 1, borderRadius: 50,
  },
  metricBadgeText: { fontSize: 7, fontWeight: '900', letterSpacing: 0.6 },

  // ── Cards de comparativa ─────────────────────────────────────────────────
  sectionHeader: {
    fontFamily: 'Rajdhani_700Bold',
    color: c.onSurface(0.55),
    fontSize: 10, fontWeight: '900', letterSpacing: 2.5,
    textTransform: 'uppercase', marginTop: 12, marginBottom: 10,
  },
  // ── Récords (H36-T8) ──
  recordsRow: { flexDirection: 'row', gap: 10 },
  recordCard: {
    flex: 1,
    backgroundColor: 'rgba(123,118,221,0.08)',
    borderRadius: 10, paddingVertical: 12, paddingHorizontal: 8, alignItems: 'center',
  },
  recordValue: { fontSize: 18, fontWeight: '900', marginBottom: 4 },
  recordLabel: { color: c.onSurface(0.45), fontSize: 9, fontWeight: '700', letterSpacing: 0.5, textAlign: 'center' },
  // ── Insignias por nivel (medallón de maestría por tier) ──
  badgeGrid: { flexDirection: 'row', gap: 8 },
  masteryCard: {
    flex: 1, alignItems: 'center', gap: 5,
    paddingVertical: 4,
  },
  masteryValue: {
    fontFamily: 'Rajdhani_700Bold',
    fontSize: 13, fontWeight: '900', letterSpacing: 0.3,
    fontVariant: ['tabular-nums'], textAlign: 'center',
  },
  masteryLabel: {
    color: c.textPrimary, fontSize: 10, fontWeight: '900', letterSpacing: 0.8,
    textAlign: 'center',
  },
  masteryTier: {
    color: c.onSurface(0.45), fontSize: 8, fontWeight: '800', letterSpacing: 1,
    textAlign: 'center',
  },
  // ── TROFEOS por campeón (carrusel de medallones con retrato) ──
  trophyRow: { gap: 10, paddingVertical: 2, paddingRight: 6 },
  trophyCard: {
    width: 96, alignItems: 'center', gap: 6,
    borderWidth: 1, borderRadius: 10,
    paddingVertical: 10, paddingHorizontal: 6,
    backgroundColor: c.onSurface(0.03),
  },
  trophyName: {
    color: c.textPrimary, fontSize: 10, fontWeight: '900',
    letterSpacing: 0.3, textAlign: 'center',
    fontFamily: 'Rajdhani_700Bold',
  },
  trophyState: { fontSize: 9, fontWeight: '900', letterSpacing: 0.5, textAlign: 'center' },
  tierCard: {
    backgroundColor: 'rgba(123,118,221,0.08)',
    borderWidth: 1, borderColor: 'rgba(123,118,221,0.25)',
    borderRadius: 12, padding: 14, marginTop: 12,
  },
  tierTitle: {
    fontFamily: 'Rajdhani_700Bold',
    color: '#7B76DD', fontSize: 10, fontWeight: '900', letterSpacing: 2.5, marginBottom: 10,
  },
  proCard: {
    backgroundColor: 'rgba(205,160,40,0.08)',
    borderWidth: 1, borderColor: 'rgba(205,160,40,0.3)',
    borderRadius: 12, padding: 14, marginTop: 12,
  },
  proTitle: {
    fontFamily: 'Rajdhani_700Bold',
    color: 'rgba(205,160,40,1)', fontSize: 10, fontWeight: '900', letterSpacing: 2.5, marginBottom: 10,
  },
  cmpRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cmpRowSpaced: { marginTop: 10 },
  tierSquare: { width: 14, height: 14, borderRadius: 3 },
  proSquare: { width: 14, height: 14, borderRadius: 3, backgroundColor: 'rgba(205,160,40,1)' },
  cmpTextWrap: { flex: 1, flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap' },
  cmpText: {
    fontFamily: 'Rajdhani_600SemiBold',
    color: c.textPrimary, fontSize: 13, fontWeight: '700', marginRight: 6,
  },
  cmpSub: { color: c.onSurface(0.45), fontSize: 10 },

  // ── Fases ────────────────────────────────────────────────────────────────
  phaseChips: { gap: 8, paddingRight: 4 },
  phaseChip: {
    borderWidth: 1, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 8, alignItems: 'center', minWidth: 64,
  },
  phaseChipLabel: { fontFamily: 'Rajdhani_700Bold', fontSize: 12, letterSpacing: 1.2 },
  phaseChipRange: { fontSize: 9, fontWeight: '700', marginTop: 1, letterSpacing: 0.5 },
  phaseDetail: {
    marginTop: 10, borderLeftWidth: 3,
    backgroundColor: 'rgba(123,118,221,0.06)',
    borderTopRightRadius: 8, borderBottomRightRadius: 8,
    paddingVertical: 10, paddingHorizontal: 12,
  },
  phaseDetailValue: {
    fontFamily: 'Rajdhani_700Bold',
    color: c.textPrimary, fontSize: 18, letterSpacing: 0.5,
  },
  phaseDetailTip: { color: c.onSurface(0.7), fontSize: 12, marginTop: 3 },

  // ── Ranking estimado ──────────────────────────────────────────────────────
  rankCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: c.onSurface(0.04),
    borderWidth: 1, borderRadius: 10,
    paddingVertical: 8, paddingHorizontal: 12,
    marginTop: 4, alignSelf: 'center',
  },
  rankText: {
    fontFamily: 'Rajdhani_600SemiBold',
    color: c.textPrimary, fontSize: 13, fontWeight: '700',
  },
  rankNumber: { fontFamily: 'Rajdhani_700Bold', fontSize: 14 },
  rankBadge: {
    backgroundColor: c.onSurface(0.08),
    borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2,
  },
  rankBadgeText: {
    color: c.onSurface(0.5),
    fontSize: 8, fontWeight: '900', letterSpacing: 1.2,
  },

  // ── Logros ────────────────────────────────────────────────────────────────
  achievementsRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8,
  },
  achievementChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: c.onSurface(0.05),
    borderWidth: 1, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 6,
    maxWidth: '100%',
  },
  achievementTrophy: { fontSize: 12 },
  achievementText: {
    fontFamily: 'Rajdhani_600SemiBold',
    fontSize: 11, fontWeight: '800', letterSpacing: 0.5,
  },

  // ── Retos ────────────────────────────────────────────────────────────────
  challengeList: { gap: 10 },
  challengeCard: {
    backgroundColor: c.onSurface(0.04),
    borderWidth: 1, borderColor: c.onSurface(0.08),
    borderRadius: 12, padding: 12,
  },
  challengeTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  challengeName: {
    fontFamily: 'Rajdhani_600SemiBold',
    color: c.textPrimary, fontSize: 13, fontWeight: '700', flex: 1, marginRight: 8,
  },
  challengeState: { fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  progressTrack: {
    height: 6, borderRadius: 50, backgroundColor: c.onSurface(0.08), overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 50 },
  challengeLabel: { color: c.onSurface(0.45), fontSize: 10, marginTop: 6 },
});
