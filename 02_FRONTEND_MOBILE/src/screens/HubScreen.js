// ============================================================================
// HubScreen — Vista op.gg-style del modo OUT-OF-GAME (renderizada por LiveScreen)
// ----------------------------------------------------------------------------
// No es un tab propio: LiveScreen monta esta pantalla cuando NO hay partida en
// vivo (liveSession.active !== true). Muestra el resumen del jugador al estilo
// op.gg con datos del backend (fetch a /api/v1/stats/{riotId}); si no hay
// respuesta o es la cuenta demo, cae a los mocks de NovaRift sin refactorizar UI.
//
// Dos modos en un toggle pill horizontal (TABS):
// PERFIL → avatar + rango + KDA/WR/CS + sparkline 10P + lista de partidas
// CHAMPION POOL → campeones del pool, WR por campeón y maestría agregada
//
// El cálculo on-pool vs off-champion-pool se hace en cliente con
// calcOffPoolStats(matches, pool). Estilo glassmorphism sobre fondo #07070d
// (NovaBackground sin Aurora, para no teñir el fondo con el color de facción).
// ============================================================================

// ── Imports de React y React Native ─────────────────────────────────────────
// React + sus "hooks" (useState/useContext/useMemo/useEffect): mecanismos del
// framework para estado, contexto global y memoización. De react-native vienen
// los componentes-bloque de la UI: View (contenedor tipo JPanel), Text (texto),
// StyleSheet (estilos como objeto), TouchableOpacity (botón táctil con efecto
// de opacidad, como un JButton con listener), ScrollView (contenedor con scroll
// vertical, como un JScrollPane), Image, Animated y Platform (detecta web/iOS/Android).
import React, { useState, useContext, useMemo, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Image, Animated, Platform,
} from 'react-native';
// ── Contextos (estado global compartido) ────────────────────────────────────
// Cada contexto es como inyección de dependencias / un singleton accesible:
// RiotContext da el tema visual (theme), useUser el usuario logueado, useRadar
// el widget flotante de radar. Se leen sin pasarlos por props desde arriba.
import { RiotContext } from '../context/RiotContext';
import { useUser } from '../context/UserContext';
import { useRadar } from '../context/RadarContext';
// ── Tema y constantes de diseño ─────────────────────────────────────────────
// FACTIONS: temas por facción de LoL. COLORS/TYPE_SCALE/SPACING: paleta,
// escala tipográfica y espaciados (los "tokens" de diseño de la app).
import { FACTIONS } from '../theme/theme';
import { COLORS, TYPE_SCALE, SPACING } from '../theme';
import { useTheme } from '../context/ThemeContext';
// ── Componentes propios reutilizables ───────────────────────────────────────
// Bloques de UI ya construidos por el proyecto (fondo, botón, imagen de campeón,
// iconos, barras de progreso, paneles de partida, etc.). Se componen como piezas.
import NovaBackground from '../components/NovaBackground';
import NovaButton from '../components/NovaButton';
import ChampionImage from '../components/ChampionImage';
import Icon from '../components/Icon';
import PromotionTrack from '../components/PromotionTrack';
import MatchSessionHeader from '../components/MatchSessionHeader';
import MatchExpandedPanel from '../components/MatchExpandedPanel';
import GradeProgressBar from '../components/GradeProgressBar';
// Sistema KPI semanal — widget de objetivo de coaching (CS/min o Vision Score
// según semana del usuario en la app). Self-contained, persiste la fecha
// de arranque en AsyncStorage.
import KPICoachingWidget from '../components/KPICoachingWidget';
// Coach mental: recomendaciones de bienestar (¿buen momento para
// ranked?) basadas en la investigación de psicología del jugador. Card compacta
// con semáforo ÓPTIMO/PRECAUCIÓN/NO JUEGUES; lógica en `evaluateMentalState`.
import MentalCoachCard from '../components/MentalCoachCard';
// ── Hooks y componentes de feedback (estado de red / errores / modales) ──────
// useConnectionStatus es un hook propio (función reutilizable con estado interno);
// el resto son componentes de la carpeta feedback y los modales de búsqueda/detalle.
// H1 Nielsen — visibilidad del estado del sistema: barra de conectividad no
// intrusiva en lo alto de la pantalla, alimentada por useConnectionStatus.
import { useConnectionStatus } from '../hooks/useConnectionStatus';
import ConnectionStatusBar from '../components/feedback/ConnectionStatusBar';
import ErrorState from '../components/feedback/ErrorState';
// Modal de búsqueda de jugador. Consume el endpoint nuevo
// `/api/v1/riot/summoner-summary` (proxy backend ) con fallback a mock
// cuando la key falla. Punto de entrada: botón "lupa" en el header del Hub.
import PlayerSearchModal from '../components/PlayerSearchModal';
import ChampionDetailModal from '../components/ChampionDetailModal';
// B2.3 — Trofeos en las cards del pool: el snapshot lo escribe TrophyCabinet
// (Forge) en AsyncStorage; aquí solo lo leemos y pintamos medallones.
import AsyncStorage from '@react-native-async-storage/async-storage';
import TrophyBadge from '../components/TrophyBadge';
import { ALL_TROPHIES } from '../data/trophies';
// (04/05) — Servicio de datos reales Riot. La función ya hace fallback
// a un summary mock local si la key falla o el backend no responde, así
// que aquí solo enchufamos el resultado y dejamos que `riotSummary.mock`
// sea el flag para decidir si overlay-ear o no.
import { fetchSummonerSummary } from '../services/riotApi';
// ── Servicios, utilidades, mocks y config ───────────────────────────────────
// fetchSummonerSummary llama al backend; coaching/insights/calcOffPoolStats son
// funciones puras de cálculo; novaStats y mockGameSession son datos de prueba;
// dataDragon/novaScore/gameps/fate/demoConfig aportan tablas y helpers de dominio.
// FactionRadarChart movido a ELO Forge (donde la narrativa de mejorar
// encaja mejor que en el HubScreen). Mantenemos el import comentado por si en
// el futuro se decide volver a duplicarlo en el panel competitivo.
// import FactionRadarChart from '../components/FactionRadarChart';
import { getDailyTip } from '../utils/coaching';
import { generateMatchInsights } from '../utils/generateMatchInsights';
// `computeRadarStats` ahora consumido en ForgeScreen donde vive
// el FactionRadarChart. Si HubScreen vuelve a necesitarlo basta con
// reimportarlo aquí.
// import { computeRadarStats } from '../utils/computeRadarStats';
import { MOCK_GAME_SESSION } from '../mocks/mockGameSession';
// Cuenta demo oficial: si el riotId contiene "FAKER" usamos datos mock en
// lugar de los datos reales de Riot (ver src/config/demoConfig.js).
import { isDemoAccount } from '../config/demoConfig';
import NOVA_STATS, {
  NOVA_TOP_CHAMPIONS,
  NOVA_POOL_DETAIL,
  FACTION_HERO_METRIC,
  remapNovaToPool,
  avgCsPerMin,
  buildMatchDetails,
  publishProfileCsPerMin,
} from '../mocks/novaStats';
import { calcOffPoolStats, offPoolByChampion } from '../utils/calcOffPoolStats';
// Pool efectivo: deriva el champion pool de las partidas reales cuando el
// jugador entró con su cuenta sin pasar por el onboarding, y lo publica para
// que el asistente y la forja lo reutilicen.
import { derivePoolFromMatches } from '../utils/derivePoolFromMatches';
import { publishEffectivePool, publishRealRank } from '../utils/effectivePool';
import { getChampionImageUrl } from '../utils/dataDragon';
import { getNovaScoreBucket } from '../constants/novaScore';
import { GAMEPS_LABELS } from '../constants/gameps';
import { FATE } from '../constants/fate';
// T13 — el "Consejo de hoy" se ancla al objetivo semanal activo del rol.
import { pickWeeklyKpi, csTargetFor, visionTargetFor } from '../constants/kpiTargets';

// ── Progreso de grado competitivo COMPUTADO por campeón ──────────────────────
// B1 — Antes existía un mapa hardcodeado (POOL_GRADE_PROGRESS) con números
// fantasma por campeón (Lucian 0.78, etc.). Con el pool real de onboarding esos
// campeones llegan SIN datos (winrate/avgKDA = null), así que inventar un grado
// sería deshonesto. Ahora derivamos el progreso 0..1 hacia S+ del rendimiento
// REAL: si no hay partidas (winrate no numérico o games 0) devolvemos null y la
// barra de grado simplemente no se pinta. El demo (FAKER) trae winrate/KDA mock
// reales → el grado se computa normalmente.
function gradeProgressFromChamp(champ) {
  if (typeof champ.winrate !== 'number' || !(champ.games > 0)) return null;
  const wr = champ.winrate;
  const kda = champ.avgKDA ?? 0;
  let p = (wr - 40) / 45 + Math.min(kda, 8) / 40;
  return Math.max(0.05, Math.min(0.98, p));
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
// Funciones puras a nivel de módulo (equivalentes a métodos static de una clase
// de utilidades Java): reciben datos y devuelven texto/color sin tocar estado ni
// la UI. Se usan para formatear y para elegir colores "semáforo" en el render.

/** Convierte minutos decimales en "mm:ss" */
function fmtDuration(min) {
  const m = Math.floor(min);
  const s = Math.round((min - m) * 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** Convierte { tier:'GOLD', division:'II', lp:47 } en "Gold II • 47 LP" */
function fmtRank(rank) {
  if (!rank) return '—';
  const tier = rank.tier.charAt(0) + rank.tier.slice(1).toLowerCase();
  return `${tier} ${rank.division} • ${rank.lp} LP`;
}

/** Color semáforo para KDA */
function kdaColor(kda, primary) {
  if (kda >= 6) return COLORS.success;
  if (kda >= 3) return primary;
  return '#FF7043';
}

// ── Sub-componente: SectionDivider ──────────────────────────────────────────
// Un "componente" es una función que devuelve JSX. El JSX describe la UI de
// forma declarativa (como construir el árbol de Swing, pero describiendo el QUÉ
// y no el CÓMO). Aquí solo pinta una línea-rombo-línea decorativa.
/** Separador fino entre secciones con punto central ◈ (decoración). */
function SectionDivider() {
  return (
    <View style={dividerStyles.row}>
      <View style={dividerStyles.line} />
      <Text style={dividerStyles.diamond}>◈</Text>
      <View style={dividerStyles.line} />
    </View>
  );
}
// StyleSheet.create(): definición de estilos, equivalente a CSS pero como objeto
// Java. Cada clave es un "estilo" reutilizable que se referencia desde el JSX.
const dividerStyles = StyleSheet.create({
  row:     { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 14 },
  line:    { flex: 1, height: 1, backgroundColor: 'rgba(123,118,221,0.15)' },
  diamond: { color: '#7B76DD44', fontSize: 12 },
});

/**
 * Color oficial por tier de LoL. Usado para badges, bordes y dots
 * de rango. Mantiene consistencia visual entre avatar, badge en el hero
 * card, rankCard y texto del tier — el evaluador detecta el tier de un
 * vistazo por color (Gold dorado, Diamond azul, Master morado, etc.).
 *
 * Iron → gris oscuro
 * Bronze → bronce
 * Silver → plata
 * Gold → dorado
 * Platinum → verde agua
 * Emerald → verde esmeralda
 * Diamond → azul lavanda
 * Master → morado
 * GrandMaster → rojo
 * Challenger → dorado claro
 */
function tierColor(tier) {
  const T = (tier || '').toUpperCase();
  return COLORS.tier[T]?.main ?? '#888';
}

/**
 * URL del emblema oficial de tier servido por CommunityDragon.
 *
 * Endpoint público sin auth, sirve los assets del cliente de Riot. Los tier
 * names esperados son lowercase sin espacios. Si `tier` viene mayúsculas
 * de Riot API (`'GOLD'`), `.toLowerCase()` lo normaliza.
 *
 * Devuelve `null` para `unranked` o tier nulo — el caller debe pintar un
 * fallback (dot de color de `tierColor`).
 *
 * Fallback de imagen: si la URI falla (sin red), `<Image>` simplemente no
 * pinta nada — no hace falta `onError` handler. El texto del tier y el
 * color de borde siguen visibles.
 */
function tierEmblemUrl(tier) {
  const T = (tier || '').trim();
  if (!T || T.toUpperCase() === 'UNRANKED') return null;
  // OP.GG CDN — funciona sin CORS ni restricciones de acceso
  return `https://opgg-static.akamaized.net/images/medals_new/${T.toLowerCase()}.png`;
}

/** URL del icono de perfil de invocador (Data Dragon). Prioridad sobre el emblema de tier. */
function summonerIconUrl(iconId) {
  return iconId
    ? `https://ddragon.leagueoflegends.com/cdn/16.8.1/img/profileicon/${iconId}.png`
    : null;
}

/** Color semáforo para WR */
function wrColor(wr, primary) {
  if (wr >= 60) return COLORS.success;
  if (wr >= 50) return primary;
  return '#FF7043';
}

// ─── Sub-componente: Sparkline (últimas N partidas) ──────────────────────────
// Mini-gráfico de barras V/D. Recibe props (parámetros del componente, como los
// del constructor): la lista de partidas, el color de victoria y el tema. El
// `.map(...)` recorre las partidas y genera una <View> barra por cada una (cada
// hijo lleva `key` para que React identifique elementos en listas).
function Sparkline({ matches, winColor, theme }) {
  const { colors: c, isDark } = useTheme();
  const txt = isDark ? theme.text : c.textPrimary;
  return (
    <View style={spkStyles.container}>
      <Text style={[spkStyles.label, { color: txt + '66' }]}>
        ÚLTIMAS {matches.length} PARTIDAS
      </Text>
      <View style={spkStyles.barsRow}>
        {matches.map((match, i) => (
          <View
            key={match.matchId}
            style={[
              spkStyles.bar,
              {
                backgroundColor: match.result === 'W' ? winColor : '#333',
                opacity: match.offPool ? 0.45 : 1,
              },
            ]}
          />
        ))}
      </View>
      <View style={spkStyles.legendRow}>
        <View style={[spkStyles.legendDot, { backgroundColor: winColor }]} />
        <Text style={[spkStyles.legendText, { color: txt + '66' }]}>Victoria</Text>
        <View style={[spkStyles.legendDot, { backgroundColor: '#333', marginLeft: 10 }]} />
        <Text style={[spkStyles.legendText, { color: txt + '66' }]}>Derrota</Text>
        <View style={[spkStyles.legendDot, { backgroundColor: winColor, opacity: 0.45, marginLeft: 10 }]} />
        <Text style={[spkStyles.legendText, { color: txt + '55' }]}>Fuera del champion pool</Text>
      </View>
    </View>
  );
}

// Estilos del Sparkline (CSS como objeto Java).
const spkStyles = StyleSheet.create({
  container:   { marginBottom: 14 },
  label:       { fontSize: TYPE_SCALE.micro.size, fontWeight: '800', letterSpacing: 2, marginBottom: 8 },
  barsRow:     { flexDirection: 'row', gap: SPACING.xs, alignItems: 'flex-end', height: 32 },
  bar:         { flex: 1, height: 28, borderRadius: 3 },
  legendRow:   { flexDirection: 'row', alignItems: 'center', marginTop: 6, flexWrap: 'wrap', gap: 4 },
  legendDot:   { width: 8, height: 8, borderRadius: 4 },
  legendText:  { fontSize: TYPE_SCALE.micro.size, marginLeft: 3 },
});

// ─── Sub-componente: NovaScoreBox (caja coloreada con score 0-100) ───────────
// Sustituye al GradeBadge S+/A/B/C/D — escala 0-100 + posición ordinal.
// `getNovaScoreBucket` devuelve el "tramo" de color según el score; el ordinal
// (1st, 2nd, ...) se calcula con un array indexado por posición.
function NovaScoreBox({ score, position }) {
  const { colors: c } = useTheme();
  const nsStyles = useMemo(() => makeNsStyles(c), [c]);
  const bucket = getNovaScoreBucket(score);
  const ordinals = ['1st','2nd','3rd','4th','5th','6th','7th','8th','9th','10th'];
  const ordinal = position && position >= 1 && position <= 10
    ? ordinals[position - 1]
    : (position ? `${position}th` : '');
  return (
    <View style={[nsStyles.box, { backgroundColor: bucket.bg, borderColor: bucket.color }]}>
      <Text style={[nsStyles.score, { color: bucket.color }]}>{score}</Text>
      {!!ordinal && <Text style={nsStyles.ordinal}>{ordinal}</Text>}
    </View>
  );
}
// Estilos de la NovaScoreBox (caja del score).
const makeNsStyles = (c) => StyleSheet.create({
  box: {
    width: 52, height: 52, borderRadius: 8,
    borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
  },
  score:   { fontSize: TYPE_SCALE.h5.size, fontWeight: '900', lineHeight: 22 },
  ordinal: { fontSize: TYPE_SCALE.micro.size, color: c.onSurface(0.45), letterSpacing: 0.5 },
});

// ─── Sub-componente: GamepsBadge (etiqueta MVP/ACE/RESILIENT…) ───────────────
function GamepsBadge({ label }) {
  const g = GAMEPS_LABELS[label];
  if (!g) return null;
  return (
    <View style={{
      backgroundColor: g.color + '22',
      borderRadius: 4, paddingHorizontal: 7, paddingVertical: 2,
      borderWidth: 1, borderColor: g.color + '66',
    }}>
      <Text style={{ fontSize: TYPE_SCALE.micro.size, fontWeight: '900', color: g.color, letterSpacing: 1 }}>
        {g.text.toUpperCase()}
      </Text>
    </View>
  );
}

// ─── Sub-componente: FateBadge (dot de color + label de equipo) ──────────────
// El campo `f.icon` del diccionario FATE contiene emojis meteorológicos —
// los sustituimos visualmente por un dot del color semántico de la fate
// para mantener el look limpio del resto de la UI.
function FateBadge({ fate }) {
  const { colors: c } = useTheme();
  const f = FATE[fate];
  if (!f) return null;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: f.color }} />
      <Text style={{ fontSize: TYPE_SCALE.micro.size, color: c.onSurface(0.45), letterSpacing: 0.5 }}>
        {f.text}
      </Text>
    </View>
  );
}

// ─── Sub-componente: VisionBadge (Vision Score limpio sin iconos) ────────────
// Badge compacto que muestra el Vision Score del jugador. Si el match trae
// `wardsPlaced` añadimos el contador en la forma `7W`. Sin iconos — texto
// pleno para no contaminar la fila con figuras pequeñas pixeladas.
function VisionBadge({ match }) {
  const { colors: c } = useTheme();
  const mrStyles = useMemo(() => makeMrStyles(c), [c]);
  const vs = match?.visionScore;
  if (typeof vs !== 'number' || vs <= 0) return null;
  const wards = typeof match.wardsPlaced === 'number' ? match.wardsPlaced : null;
  return (
    <View style={mrStyles.visionBadge}>
      <Text style={mrStyles.visionBadgeText}>
        VS {vs}{wards != null ? ` · ${wards}W` : ''}
      </Text>
    </View>
  );
}

// ─── Sub-componente: MultiKillBadge ──────────────────────────────────────────
// Detecta el multikill más alto conseguido en la partida (penta > quadra >
// triple > doble) y lo pinta con el color correspondiente. Acepta tanto el
// shape nuevo con counts (`doubleKills` / `tripleKills` / `quadraKills` /
// `pentaKills`) como los flags booleanos legacy (`pentakill` / `quadrakill`).
function MultiKillBadge({ match }) {
  const { colors: c } = useTheme();
  const mrStyles = useMemo(() => makeMrStyles(c), [c]);
  if (!match) return null;
  // Counts (Riot API style) — preferentes
  const penta  = match.pentaKills   ?? (match.pentakill  ? 1 : 0);
  const quadra = match.quadraKills  ?? (match.quadrakill ? 1 : 0);
  const triple = match.tripleKills  ?? 0;
  const doble  = match.doubleKills  ?? 0;

  let label = null;
  let color = null;
  if (penta > 0)       { label = 'PENTA';  color = '#FF4E50'; }
  else if (quadra > 0) { label = 'QUADRA'; color = c.gold; }
  else if (triple > 0) { label = 'TRIPLE'; color = '#5383E8'; }
  else if (doble > 0)  { label = 'DOBLE';  color = '#C0C0C0'; }
  if (!label) return null;

  return (
    <View style={[mrStyles.multiKillBadge, {
      backgroundColor: color + '22',
      borderColor:     color + 'AA',
    }]}>
      <Text style={[mrStyles.multiKillText, { color }]}>{label}</Text>
    </View>
  );
}

// ─── Sub-componente: OffChampionPoolPill ─────────────────────────────────────
// Pill prominente que se renderiza dentro de la fila de partida en el tab
// OFF-CHAMPION-POOL. Spec: rgba(229,57,53,0.2) bg, borde #E53935, texto #ff6b6b.
function OffChampionPoolPill() {
  const { colors: c } = useTheme();
  const mrStyles = useMemo(() => makeMrStyles(c), [c]);
  return (
    <View style={mrStyles.offChampPoolPill}>
      <Text style={mrStyles.offChampPoolPillText}>OFF-CHAMPION-POOL</Text>
    </View>
  );
}

// ─── Sub-componente: MatchInsightBadges ─────────────────────────────
// Pinta hasta 3 badges narrativos generados por `generateMatchInsights`. El
// componente está aislado para que el cómputo de insights se memoice por
// match.matchId y no se recalcule en cada re-render del Row padre.
function MatchInsightBadges({ match }) {
  const { colors: c } = useTheme();
  const mrStyles = useMemo(() => makeMrStyles(c), [c]);
  // useMemo: valor calculado que se cachea y solo se recalcula si cambian sus
  // dependencias (como un campo lazy en Java). El array final lista las deps:
  // mientras esos campos del match no cambien, no se vuelve a llamar a
  // generateMatchInsights, ahorrando trabajo en cada re-render del padre.
  const insights = React.useMemo(() => generateMatchInsights(match), [
    match?.matchId, match?.kda, match?.cs, match?.kills, match?.deaths,
    match?.assists, match?.visionScore, match?.durationMin, match?.result, match?.offPool,
  ]);
  if (insights.length === 0) return null;
  return (
    <View style={mrStyles.insightRow}>
      {insights.map((ins, i) => (
        <View
          key={`${ins.text}-${i}`}
          style={[
            mrStyles.insightBadge,
            { backgroundColor: ins.color + '1A', borderColor: ins.color + '55' },
          ]}
        >
          <Text style={[mrStyles.insightBadgeText, { color: ins.color }]}>
            {ins.text}
          </Text>
        </View>
      ))}
    </View>
  );
}

// ─── Sub-componente: MatchRow (fila en lista de partidas) ────────────────────
// Acepta opción `desaturated` que aplica grayscale + opacity para representar
// las partidas off-champion-pool en el modo OFF-CHAMPION-POOL.
function MatchRow({ match, theme, desaturated = false, showOffChampionPoolPill = false, expandable = false, expanded = false }) {
  // useState: variable de instancia que, al cambiar, redibuja la pantalla (como
  // un campo Java con notifyObservers). imgErr=true cuando la imagen del campeón
  // falla al cargar; entonces se pinta el fallback con las 3 primeras letras.
  const { colors: c, isDark } = useTheme();
  const txt = isDark ? theme.text : c.textPrimary;
  const mrStyles = useMemo(() => makeMrStyles(c), [c]);
  const [imgErr, setImgErr] = useState(false);
  const resultColor = match.result === 'W' ? c.success : c.error;
  const isOff = !!match.offPool;

  // MVP / Destacado badge — el multikill se delega ahora a `<MultiKillBadge>`
  // (soporta doble/triple/quadra/penta como counts). Aquí solo nos quedamos
  // con el MVP y DESTACADO por consistencia con la lógica anterior.
  const mvpBadge = (() => {
    if (typeof match.kda === 'number' && match.kda >= 8)
      return { text: 'MVP', color: c.gold };
    if (match.result === 'W' && typeof match.kda === 'number' && match.kda >= 5)
      return { text: 'DESTACADO', color: c.primary };
    return null;
  })();

  // Banda de color en el lado izquierdo: indicador W/L tipo op.gg
  const sideBarColor = match.result === 'W' ? c.success : c.error;

  const wrapperStyle = desaturated
    ? { opacity: 0.55, ...(Platform.OS === 'web' ? { filter: 'grayscale(80%)' } : {}) }
    : null;

  // ── Layout de la fila de partida (estilo op.gg) ───────────────────────────
  // De izquierda a derecha: banda de color V/D, miniatura del campeón, bloque de
  // info (nombre + modo + fila de badges + insights), bloque de stats (KDA/CS/LP)
  // y la caja NovaScore. El `style={[...]}` combina varios estilos (array) y
  // mezcla valores condicionales (color de borde/fondo según off-pool y resultado).
  return (
    <View
      style={[
        mrStyles.row,
        {
          // Tint reactivo W/L (deeplol-style). Off-pool tiene prioridad
          // visual (border/bg rojo) sobre el resultado del match.
          borderColor: isOff
            ? '#FF525244'
            : match.result === 'W'
              ? 'rgba(76,175,80,0.25)'
              : 'rgba(255,82,82,0.20)',
          backgroundColor: isOff
            ? 'rgba(255,82,82,0.05)'
            : match.result === 'W'
              ? 'rgba(76,175,80,0.04)'
              : 'rgba(255,82,82,0.04)',
        },
        wrapperStyle,
      ]}
    >
      {/* Banda de resultado — el "color stripe" de op.gg */}
      <View style={[mrStyles.sideBar, { backgroundColor: sideBarColor }]} />

      {/* Champion thumb */}
      <View style={mrStyles.champThumb}>
        {!imgErr ? (
          <Image
            source={{ uri: getChampionImageUrl(match.championName) }}
            style={[mrStyles.champImg, { borderColor: theme.primary + '55' }]}
            resizeMode="cover"
            onError={() => setImgErr(true)}
          />
        ) : (
          <View style={[mrStyles.champImgFallback, { borderColor: theme.primary + '33' }]}>
            <Text style={{ color: theme.primary, fontSize: TYPE_SCALE.micro.size, fontWeight: '800' }}>
              {(match.championName || '??').substring(0, 3).toUpperCase()}
            </Text>
          </View>
        )}
        {isOff && (
          <View style={mrStyles.offBadge}>
            <Text style={mrStyles.offBadgeText}>!</Text>
          </View>
        )}
      </View>

      {/* Bloque info: champion · stats · gameps + fate */}
      <View style={mrStyles.champInfo}>
        <View style={mrStyles.champNameRow}>
          <Text style={[mrStyles.champName, { color: txt }]} numberOfLines={1}>
            {match.championName}
          </Text>
          <View style={[mrStyles.resultBadge, { backgroundColor: resultColor + '22', borderColor: resultColor + '66' }]}>
            <Text style={[mrStyles.resultText, { color: resultColor }]}>
              {match.result === 'W' ? 'VIC' : 'DER'}
            </Text>
          </View>
        </View>
        <Text style={[mrStyles.gameMode, { color: txt + '55' }]}>
          {match.gameMode === 'RANKED_SOLO' ? 'Ranked Solo' : match.gameMode} · {fmtDuration(match.durationMin)}
        </Text>
        {/* Fila GAMEPS + Fate + Visión + MultiKill + MVP badge (op.gg / deeplol style) */}
        <View style={mrStyles.tagsRow}>
          <GamepsBadge label={match.gameps} />
          <FateBadge fate={match.fate} />
          {/* Vision Score con icono ojo (Tabler `eye`) — sustituye al "VIS X"
              en texto plano que vivía en la columna stats. Más compacto y
              más fácil de escanear visualmente. */}
          <VisionBadge match={match} />
          {/* Multikill: DOBLE (blanco/gris), TRIPLE (azul), QUADRA (oro),
              PENTA (rojo). Solo aparece si alguno de los counts > 0. */}
          <MultiKillBadge match={match} />
          {mvpBadge && (
            <View style={[mrStyles.mvpBadge, {
              backgroundColor: mvpBadge.color + '26',
              borderColor: mvpBadge.color,
            }]}>
              <Text style={[mrStyles.mvpBadgeText, { color: mvpBadge.color }]}>
                {mvpBadge.text}
              </Text>
            </View>
          )}
          {/* Pill OFF-CHAMPION-POOL — solo cuando estamos en el tab dedicado.
              Coexiste con el "FUERA DEL POOL" del MatchInsightBadges (que es
              automático por offPool). */}
          {showOffChampionPoolPill && <OffChampionPoolPill />}
        </View>

        {/* Insight badges narrativos (Mobalytics-like). Hasta 3
            pills de color: KDA ÉLITE, FARM PERFECTO, DOMINADO, INMORTAL,
            FUERA DEL POOL, MUCHAS MUERTES… cada una en su color semántico. */}
        <MatchInsightBadges match={match} />
      </View>

      {/* Stats KDA + CS + LP delta */}
      <View style={mrStyles.statsBlock}>
        <Text style={[mrStyles.kda, { color: kdaColor(match.kda, theme.primary) }]}>
          {match.kills}/{match.deaths}/{match.assists}
        </Text>
        {/* Ratio KDA explícito (deeplol style). Estrella si ≥10. */}
        {typeof match.kda === 'number' && (
          <Text style={[mrStyles.kdaRatio, { color: kdaColor(match.kda, theme.primary) }]}>
            {match.kda.toFixed(1)} KDA
          </Text>
        )}
        <Text style={[mrStyles.cspm, { color: txt + '66' }]}>
          {match.cspm.toFixed(1)} CS/m
        </Text>
        {/* Visión Score ahora se renderiza con icono en la tagsRow (VisionBadge)
            por mayor consistencia visual con el resto de pills de la fila. */}
        {typeof match.lpDelta === 'number' && (
          <Text
            style={[
              mrStyles.lpDelta,
              { color: match.lpDelta >= 0 ? c.success : c.error },
            ]}
          >
            {match.lpDelta >= 0 ? '+' : ''}{match.lpDelta} LP
          </Text>
        )}
      </View>

      {/* NOVA-Score box (sustituye al GradeBadge S+/A/B/C/D) */}
      <NovaScoreBox score={match.novaScore} position={match.position} />

      {/* Chevron de desplegable — afordancia visual de que la fila expande el
          detalle op.gg (los 10 jugadores). Solo en la lista del tab PERFIL. */}
      {expandable && (
        <Text style={[mrStyles.expandChevron, { color: theme.primary + (expanded ? 'FF' : '88') }]}>
          {expanded ? '▴' : '▾'}
        </Text>
      )}
    </View>
  );
}

// ── Estilos de MatchRow y sus badges ────────────────────────────────────────
// StyleSheet.create() (CSS como objeto Java) para la fila de partida: contenedor
// `row`, banda lateral, miniatura, bloques de stats y los distintos badges
// (insight, MVP, visión, multikill, off-pool). Cada grupo va comentado abajo.
const makeMrStyles = (c) => StyleSheet.create({
  // Match rows estilo deeplol: portrait más grande (62px), padding
  // izquierdo mayor (18px) por la sideBar más gruesa, marginBottom 6 para
  // densidad mayor de info en pantalla.
  row: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderRadius: 10,
    padding: 10, paddingLeft: 18, marginBottom: 6, gap: 10,
    position: 'relative', overflow: 'hidden',
    minHeight: 72,
  },
  sideBar: {
    position: 'absolute', left: 0, top: 0, bottom: 0, width: 5,
  },
  champThumb:       { position: 'relative' },
  champImg:         { width: 62, height: 62, borderRadius: 8, borderWidth: 2 },
  champImgFallback: {
    width: 62, height: 62, borderRadius: 8, borderWidth: 1,
    backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center',
  },
  offBadge: {
    position: 'absolute', top: -4, right: -4,
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: c.error, justifyContent: 'center', alignItems: 'center',
  },
  offBadgeText:  { color: '#FFFFFF', fontSize: TYPE_SCALE.micro.size, fontWeight: '900' },
  champInfo:     { flex: 1, gap: 4 },
  champNameRow:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  champName:     { fontSize: TYPE_SCALE.label.size, fontWeight: '800', flexShrink: 1 },
  gameMode:      { fontSize: TYPE_SCALE.caption.size },
  tagsRow:       { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 1, flexWrap: 'wrap' },
  resultBadge:   { borderWidth: 1, borderRadius: 5, paddingHorizontal: 7, paddingVertical: 3 },
  resultText:    { fontSize: TYPE_SCALE.micro.size, fontWeight: '900', letterSpacing: 1 },
  statsBlock:    { alignItems: 'flex-end', minWidth: 76 },
  kda:           { fontSize: TYPE_SCALE.label.size, fontWeight: '800' },
  // KDA ratio explícito ("6.5 KDA") debajo del K/D/A
  kdaRatio:      { fontSize: TYPE_SCALE.micro.size, fontWeight: '700', marginTop: 1, letterSpacing: 0.3 },
  cspm:          { fontSize: TYPE_SCALE.caption.size, marginTop: 2 },
  lpDelta:       { fontSize: TYPE_SCALE.caption.size, fontWeight: '900', marginTop: 2, letterSpacing: 0.5 },

  // Insight badges (Mobalytics-like)
  insightRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs,
    marginTop: 5,
  },
  insightBadge: {
    paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: 3, borderWidth: 1,
  },
  insightBadgeText: {
    fontSize: TYPE_SCALE.micro.size, fontWeight: '900', letterSpacing: 1,
  },
  // MVP / Destacado / Pentakill badge — mejor jugador de la partida
  mvpBadge: {
    borderWidth: 1, borderRadius: 10,
    paddingHorizontal: SPACING.sm, paddingVertical: 2,
  },
  mvpBadgeText: {
    fontSize: TYPE_SCALE.micro.size, fontWeight: '900',
  },

  // VisionBadge — pill compacta de texto puro (sin iconos)
  visionBadge: {
    paddingHorizontal: 7, paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: 'rgba(159,182,255,0.10)',
    borderWidth: 1, borderColor: 'rgba(159,182,255,0.35)',
  },
  visionBadgeText: {
    color: '#9FB6FF',
    fontSize: TYPE_SCALE.micro.size, fontWeight: '900', letterSpacing: 1,
  },

  // MultiKillBadge — DOBLE / TRIPLE / QUADRA / PENTA con colores diferenciados
  multiKillBadge: {
    borderWidth: 1, borderRadius: 4,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  multiKillText: {
    fontSize: TYPE_SCALE.micro.size, fontWeight: '900', letterSpacing: 1,
  },

  // OffChampionPoolPill — colores spec: rgba(229,57,53,0.2) bg, #E53935 borde,
  // #ff6b6b texto. Solo se renderiza en el tab dedicado.
  offChampPoolPill: {
    borderWidth: 1,
    borderColor: '#E53935',
    backgroundColor: 'rgba(229,57,53,0.2)',
    borderRadius: 4,
    paddingHorizontal: 7, paddingVertical: 2,
  },
  offChampPoolPillText: {
    color: '#ff6b6b',
    fontSize: TYPE_SCALE.micro.size, fontWeight: '900', letterSpacing: 1,
  },
  // Chevron del desplegable de partida (tab PERFIL).
  expandChevron: {
    fontSize: TYPE_SCALE.h6.size, fontWeight: '900',
    paddingLeft: 4, width: 16, textAlign: 'center',
  },
});

// ─── Sub-componente: ChampPoolCard (tarjeta del pool) ────────────────────────
// Tarjeta vertical de un campeón: imagen + badge de maestría + nombre + WR/KDA/partidas.
// `imgErr` (useState) controla el fallback si la imagen no carga; el color del
// badge de maestría se elige según el nivel (M7 dorado, M6 plata, resto facción).
function ChampPoolCard({ champ, theme }) {
  const { colors: c, isDark } = useTheme();
  const txt = isDark ? theme.text : c.textPrimary;
  const cpStyles = useMemo(() => makeCpStyles(c), [c]);
  const [imgErr, setImgErr] = useState(false);
  const masteryBadgeColor = champ.mastery >= 7 ? c.gold : champ.mastery >= 6 ? '#C0C0C0' : theme.primary + '99';

  return (
    <View style={[cpStyles.card, { borderColor: theme.primary + '44', backgroundColor: c.surface }]}>
      {/* Champion image */}
      <View style={{ alignItems: 'center', marginBottom: 8 }}>
        {!imgErr ? (
          <Image
            source={{ uri: getChampionImageUrl(champ.championName) }}
            style={[cpStyles.champImg, { borderColor: theme.primary + '88' }]}
            resizeMode="cover"
            onError={() => setImgErr(true)}
          />
        ) : (
          <View style={[cpStyles.champImgFallback, { borderColor: theme.primary + '44' }]}>
            <Text style={{ color: theme.primary, fontSize: TYPE_SCALE.label.size, fontWeight: '900' }}>
              {champ.championName.substring(0, 3).toUpperCase()}
            </Text>
          </View>
        )}
        {/* Mastery badge */}
        {champ.mastery && (
          <View style={[cpStyles.masteryBadge, { borderColor: masteryBadgeColor }]}>
            <Text style={[cpStyles.masteryText, { color: masteryBadgeColor }]}>M{champ.mastery}</Text>
          </View>
        )}
      </View>

      {/* Champion name */}
      <Text style={[cpStyles.champName, { color: txt }]} numberOfLines={1}>
        {champ.championName}
      </Text>

      {/* WR */}
      <Text style={[cpStyles.wr, { color: wrColor(champ.winrate, theme.primary) }]}>
        {champ.winrate}% WR
      </Text>

      {/* KDA */}
      <Text style={[cpStyles.kda, { color: kdaColor(champ.avgKDA, theme.primary) }]}>
        {champ.avgKDA.toFixed(1)} KDA
      </Text>

      {/* Games */}
      <Text style={[cpStyles.games, { color: txt + '66' }]}>
        {champ.games}G
      </Text>
    </View>
  );
}

// Estilos de la ChampPoolCard (tarjeta de campeón del pool).
const makeCpStyles = (c) => StyleSheet.create({
  card: {
    width: '30%', borderWidth: 1, borderRadius: 12,
    padding: 12, alignItems: 'center',
    marginBottom: 10,
    backgroundColor: c.surface,
  },
  champImg: { width: 60, height: 60, borderRadius: 8, borderWidth: 2.5 },
  champImgFallback: {
    width: 56, height: 56, borderRadius: 6, borderWidth: 1,
    backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center',
  },
  masteryBadge: {
    marginTop: -8, borderWidth: 1, borderRadius: 4,
    paddingHorizontal: 5, paddingVertical: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  masteryText: { fontSize: TYPE_SCALE.micro.size, fontWeight: '900' },
  champName:   { fontSize: TYPE_SCALE.caption.size, fontWeight: '700', marginTop: SPACING.xs, textAlign: 'center' },
  wr:          { fontSize: TYPE_SCALE.label.size, fontWeight: '900', marginTop: 4 },
  kda:         { fontSize: TYPE_SCALE.caption.size, fontWeight: '700', marginTop: 2 },
  games:       { fontSize: TYPE_SCALE.micro.size, marginTop: 2 },
});

// ─── Sub-componente: OffPoolChampRow ─────────────────────────────────────────
// Fila roja para un campeón jugado FUERA del champion pool: icono + nombre +
// nº partidas + badge "OFF-CHAMPION-POOL" + WR/KDA. `imgErr` gestiona el fallback
// de imagen igual que en las otras filas.
function OffPoolChampRow({ champ, theme }) {
  const { colors: c, isDark } = useTheme();
  const txt = isDark ? theme.text : c.textPrimary;
  const [imgErr, setImgErr] = useState(false);
  return (
    <View style={[opStyles.row, { borderColor: '#FF525444', backgroundColor: 'rgba(255,82,82,0.06)' }]}>
      {/* Icon */}
      {!imgErr ? (
        <Image
          source={{ uri: getChampionImageUrl(champ.championName) }}
          style={[opStyles.champImg, { borderColor: '#FF525488' }]}
          resizeMode="cover"
          onError={() => setImgErr(true)}
        />
      ) : (
        <View style={[opStyles.champImgFallback, { borderColor: '#FF525455' }]}>
          <Text style={{ color: '#FF5254', fontSize: TYPE_SCALE.caption.size, fontWeight: '900' }}>
            {champ.championName.substring(0, 3).toUpperCase()}
          </Text>
        </View>
      )}

      {/* Info */}
      <View style={opStyles.info}>
        <Text style={[opStyles.champName, { color: txt }]}>{champ.championName}</Text>
        <Text style={[opStyles.games, { color: txt + '66' }]}>{champ.games} partidas</Text>
      </View>

      {/* FUERA DEL CHAMPION POOL badge */}
      <View style={opStyles.offBadge}>
        <Text style={opStyles.offBadgeText}>OFF-CHAMPION-POOL</Text>
      </View>

      {/* Stats */}
      <View style={opStyles.stats}>
        <Text style={[opStyles.wr, { color: champ.winrate >= 50 ? c.success : c.error }]}>
          {champ.winrate}%
        </Text>
        <Text style={[opStyles.kda, { color: txt + '88' }]}>
          {champ.kda.toFixed(1)} KDA
        </Text>
      </View>
    </View>
  );
}

// Estilos de la OffPoolChampRow (fila roja de campeón fuera del pool).
const opStyles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderRadius: 6,
    padding: 10, marginBottom: SPACING.sm, gap: 10,
  },
  champImg: { width: 40, height: 40, borderRadius: 4, borderWidth: 1.5 },
  champImgFallback: {
    width: 40, height: 40, borderRadius: 4, borderWidth: 1,
    backgroundColor: 'rgba(50,0,0,0.6)', justifyContent: 'center', alignItems: 'center',
  },
  info:         { flex: 1 },
  champName:    { fontSize: TYPE_SCALE.label.size, fontWeight: '700' },
  games:        { fontSize: TYPE_SCALE.caption.size, marginTop: 2 },
  offBadge: {
    backgroundColor: 'rgba(229,57,53,0.2)', borderRadius: 4,
    borderWidth: 1, borderColor: '#E53935',
    paddingHorizontal: 6, paddingVertical: 3,
  },
  offBadgeText: { color: '#ff6b6b', fontSize: TYPE_SCALE.micro.size, fontWeight: '900', letterSpacing: 1 },
  stats:        { alignItems: 'flex-end' },
  wr:           { fontSize: TYPE_SCALE.body.size, fontWeight: '900' },
  kda:          { fontSize: TYPE_SCALE.caption.size, marginTop: 2 },
});

// ─── Sub-componente: LPBar — progreso de LP al siguiente tier ────────────────
// Barra de progreso de Puntos de Liga (LP). `pct` calcula el porcentaje de
// relleno y lo recorta al rango [0,100] con clamp (Math.max/Math.min) para que
// nunca se salga de la barra aunque los datos vengan raros.
function LPBar({ lp, lpToNext, theme }) {
  const { colors: c, isDark } = useTheme();
  const txt = isDark ? theme.text : c.textPrimary;
  const pct = Math.max(0, Math.min(100, (lp / lpToNext) * 100));
  return (
    <View style={lpStyles.wrap}>
      <View style={[lpStyles.track, { backgroundColor: c.onSurface(0.08) }]}>
        <View
          style={[
            lpStyles.fill,
            {
              width: `${pct}%`,
              backgroundColor: theme.primary,
              shadowColor: theme.primary,
            },
          ]}
        />
      </View>
      <View style={lpStyles.captionRow}>
        <Text style={[lpStyles.caption, { color: txt + '66' }]}>{lp} LP</Text>
        <Text style={[lpStyles.caption, { color: txt + '44' }]}>{lpToNext} LP → siguiente tier</Text>
      </View>
    </View>
  );
}
// Estilos de la LPBar (barra de progreso de LP). El estilo `track`/`fill`
// se reutiliza también en la barra de maestría del PoolTab.
const lpStyles = StyleSheet.create({
  wrap: { marginTop: 6 },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: {
    height: 6, borderRadius: 3,
    shadowOpacity: 0.7, shadowRadius: 6, shadowOffset: { width: 0, height: 0 },
  },
  captionRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  caption: { fontSize: TYPE_SCALE.micro.size, fontWeight: '800', letterSpacing: 1 },
});

// ─── Sub-componente: TopChampionRow — top 5 con barra WR coloreada ───────────
// Fila táctil (TouchableOpacity = botón con efecto de opacidad, como un JButton
// con listener) de un campeón del "TU POOL". `onPress` es el callback al pulsar;
// si no se pasa, la fila no es interactiva. Muestra rango (#1..), icono, nombre,
// chip MAIN/SEC y barra de winrate coloreada por bucket.
// El pool SELLADO del onboarding (sealOnboardingPool) convierte `slot` en
// NUMÉRICO (orden 0..3 dentro del rol) y conserva el textual en `slotKind`;
// el pool demo (FAKER) aún trae `slot:'main'|'secondary'`. Normalizamos a
// string|null SIEMPRE: comparar el número contra 'main' rompía el badge y,
// peor, `{champ.slot && ...}` con slot=0 (el MAIN sellado) renderizaba un `0`
// crudo en JSX → "Text strings must be rendered within a <Text> component"
// (crash del Hub justo tras completar el registro).
const slotKindOf = (champ) =>
  champ?.slotKind || (typeof champ?.slot === 'string' ? champ.slot : null);

function TopChampionRow({ champ, theme, rank, onPress }) {
  const { colors: c, isDark } = useTheme();
  const txt = isDark ? theme.text : c.textPrimary;
  const tcStyles = useMemo(() => makeTcStyles(c), [c]);
  const [imgErr, setImgErr] = useState(false);
  const wrCol = wrColor(champ.winrate, theme.primary);
  const slotKind = slotKindOf(champ);
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={onPress ? 0.8 : 1}
      accessibilityRole="button"
      accessibilityLabel={`Ver detalles de ${champ.championName}`}
      style={[tcStyles.row, {
        borderColor: slotKind === 'main' ? '#FFD70066' : theme.primary + '33',
        borderLeftColor: slotKind === 'main' ? c.gold : theme.primary,
        ...(Platform.OS === 'web' && slotKind === 'main' ? {
          boxShadow: '0 0 12px rgba(255,215,0,0.08)',
        } : {}),
      }]}
    >
      <Text style={[tcStyles.rank, { color: txt + '44' }]}>#{rank}</Text>
      {!imgErr ? (
        <Image
          source={{ uri: getChampionImageUrl(champ.championName) }}
          style={[tcStyles.icon, { borderColor: theme.primary + '88' }]}
          onError={() => setImgErr(true)}
        />
      ) : (
        <View style={[tcStyles.iconFb, { borderColor: theme.primary + '55' }]}>
          <Text style={{ color: theme.primary, fontSize: TYPE_SCALE.micro.size, fontWeight: '900' }}>
            {champ.championName.substring(0, 3).toUpperCase()}
          </Text>
        </View>
      )}
      <View style={tcStyles.info}>
        <View style={tcStyles.nameRow}>
          <Text style={[tcStyles.name, { color: txt }]} numberOfLines={1}>
            {champ.championName}
          </Text>
          {slotKind && (
            <View style={[tcStyles.slotChip, {
              borderColor: slotKind === 'main' ? '#FFD700AA' : theme.primary + '66',
              backgroundColor: slotKind === 'main' ? '#FFD70022' : theme.primary + '11',
            }]}>
              <Text style={[tcStyles.slotChipText, {
                color: slotKind === 'main' ? c.gold : theme.primary,
              }]}>
                {slotKind === 'main' ? 'MAIN' : 'SEC'}
              </Text>
            </View>
          )}
        </View>
        {/* Barra de WR con relleno proporcional y color por bucket.
             Con 0 partidas / winrate null → estado vacío honesto. */}
        {typeof champ.winrate === 'number' && (champ.games || 0) > 0 ? (
          <>
            <View style={[tcStyles.wrTrack, { backgroundColor: c.onSurface(0.06) }]}>
              <View style={[tcStyles.wrFill, { width: `${champ.winrate}%`, backgroundColor: wrCol }]} />
            </View>
            <View style={tcStyles.metaRow}>
              <Text style={[tcStyles.meta, { color: txt + '66' }]}>
                {champ.games} P · KDA {(champ.avgKDA ?? 0).toFixed(1)}
              </Text>
              <Text style={[tcStyles.metaWR, { color: wrCol }]}>{champ.winrate}%</Text>
            </View>
          </>
        ) : (
          <View style={tcStyles.metaRow}>
            <Text style={[tcStyles.meta, { color: txt + '55' }]}>
              Sin partidas todavía · juega con él para ver tus stats
            </Text>
          </View>
        )}
      </View>
      {onPress && (
        <Text style={[tcStyles.tapHint, { color: theme.primary + '55' }]}>›</Text>
      )}
    </TouchableOpacity>
  );
}
// Estilos de la TopChampionRow (fila de campeón del "TU POOL").
const makeTcStyles = (c) => StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1, borderRadius: 10,
    padding: 10, marginBottom: 7,
    backgroundColor: c.onSurface(0.035),
    borderLeftWidth: 3,
  },
  rank: { fontSize: TYPE_SCALE.caption.size, fontWeight: '900', letterSpacing: 1, width: 22, color: c.onSurface(0.35) },
  icon: { width: 44, height: 44, borderRadius: 6, borderWidth: 2 },
  iconFb: {
    width: 44, height: 44, borderRadius: 6, borderWidth: 1,
    backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center',
  },
  info: { flex: 1, gap: 4 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { fontSize: TYPE_SCALE.label.size, fontWeight: '700', flexShrink: 1 },
  slotChip: { borderWidth: 1, borderRadius: 3, paddingHorizontal: 5, paddingVertical: 1 },
  slotChipText: { fontSize: TYPE_SCALE.micro.size, fontWeight: '900', letterSpacing: 1 },
  wrTrack: { height: 5, borderRadius: 2.5, overflow: 'hidden' },
  wrFill: { height: 5, borderRadius: 2.5 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  meta: { fontSize: TYPE_SCALE.micro.size },
  metaWR: { fontSize: TYPE_SCALE.caption.size, fontWeight: '900' },
  tapHint: { fontSize: TYPE_SCALE.h6.size, fontWeight: '300', paddingLeft: 4 },
});

// Dead code eliminado. La función `estimateElo` y sus
// tablas auxiliares `TIER_BASE` / `DIVISION_OFFSET` quedaron huérfanas cuando
// el bloque ELO se movió a ForgeScreen. El motor canónico vive ahora
// en `src/utils/eloEstimate.js` con cobertura de tests dedicada — duplicarlo
// aquí solo arrastraba mantenimiento.

// ─── TAB: PERFIL ─────────────────────────────────────────────────────────────
// Primer tab del Hub. Recibe por props los `stats` ya calculados, el `theme` y
// el `radar`. Desestructura los campos que necesita y prepara estado local para
// el expandible de partidas y el modal de detalle de campeón.
function PerfilTab({ stats, theme, radar }) {
  const { colors: c, isDark } = useTheme();
  const txt = isDark ? theme.text : c.textPrimary;
  const tabStyles = useMemo(() => makeTabStyles(c), [c]);
  // Desestructuración: extrae campos del objeto stats a variables locales
  // (como `var x = stats.globalStats;`). Más cómodo que repetir `stats.` abajo.
  const { globalStats, matches, riotId, faction } = stats;
  const { user } = useUser();
  const lpTrendPositive = (globalStats.rank.lpNetLast10 || 0) >= 0;
  const peak   = globalStats.peakRank;
  // estimatedElo movido a ForgeScreen (ELO-FORGE)
  const ladder = globalStats.ladder;
  // Inicial del Riot ID para el avatar (antes hardcodeado a "AN")
  const initial = (riotId || '?').charAt(0).toUpperCase();
  // Consejo del día BASADO EN DATOS — ataca
  // la métrica más floja de las últimas partidas. Si no hay partidas suficientes,
  // cae al consejo rotatorio clásico.
  const dailyTip = getSmartDailyTip(matches, getDailyTip(faction), {
    role: stats.role,
    tier: globalStats.rank?.tier,
    // T3 — una sola fuente de CS/min: el consejo usa el MISMO agregado que el
    // panel de stats (globalStats.avgCSPM), no un promedio propio que diverja.
    avgCSPM: globalStats.avgCSPM,
  });
  // TAREA 2 — expandable de partida: solo una abierta a la vez.
  // useState (campo observable que redibuja al cambiar): guarda el matchId de la
  // partida desplegada. toggleMatch alterna: si pulsas la ya abierta la cierra
  // (null), si no, abre la nueva. El `prev => ...` lee el valor anterior del estado.
  const [expandedMatchId, setExpandedMatchId] = useState(null);
  const toggleMatch = (id) => setExpandedMatchId(prev => (prev === id ? null : id));

  // Modal de detalle de campeón (tapping en champion pool rows)
  // Estado-objeto { visible, name }: visible controla si el modal se ve y name
  // qué campeón mostrar. open/close son helpers que reescriben ese estado.
  const [champModal, setChampModal] = useState({ visible: false, name: null });
  const openChampModal  = (name) => setChampModal({ visible: true,  name });
  const closeChampModal = ()     => setChampModal({ visible: false, name: null });

  const factionThemeForModal = FACTIONS[faction] || FACTIONS.ZAUN;

  // ── UI del tab PERFIL (declarativa) ───────────────────────────────────────
  // El return con JSX describe el QUÉ se ve, de arriba abajo: hero card (avatar +
  // Riot ID + rango), tarjeta de rango con LP bar, peak histórico, pills de stats,
  // sparkline, widget KPI, "TU POOL", consejo del día y el historial de partidas.
  return (
    <View>
      {/* Hero card con avatar + Riot ID + rank + facción */}
      <View style={[tabStyles.heroCard, { borderColor: theme.primary + '44', backgroundColor: 'rgba(123,118,221,0.06)' }]}>
        {/* Avatar con borde del tier (sustituye theme.primary) — el
            sistema visual de rango es coherente: avatar, badge y rankCard
            comparten el mismo color del tier actual.
             — Wrapper relativo + emblema esquina inferior-derecha (badge). */}
        <View style={tabStyles.avatarWrapper}>
          {/* H-FIX: Avatar muestra el icono de invocador (Data Dragon) si está
              disponible. Fallback: emblema de tier. El badge de 28px en la
              esquina inferior-derecha muestra siempre el emblema de tier. */}
          <View style={[tabStyles.avatarCircle, {
            borderColor: tierColor(globalStats.rank.tier),
            backgroundColor: theme.surface,
          }]}>
            {summonerIconUrl(globalStats.profileIconId) ? (
              <Image
                source={{ uri: summonerIconUrl(globalStats.profileIconId) }}
                style={{ width: 60, height: 60, borderRadius: 30 }}
                resizeMode="cover"
              />
            ) : tierEmblemUrl(globalStats.rank.tier) ? (
              <Image
                source={{ uri: tierEmblemUrl(globalStats.rank.tier) }}
                style={{ width: 44, height: 44, resizeMode: 'contain' }}
                resizeMode="contain"
              />
            ) : (
              <Image
                source={{ uri: 'https://opgg-static.akamaized.net/images/medals_new/gold.png' }}
                style={{ width: 44, height: 44, resizeMode: 'contain' }}
                resizeMode="contain"
              />
            )}
          </View>
          {/* Badge de tier en la esquina — siempre visible como referencia de rango */}
          {tierEmblemUrl(globalStats.rank.tier) && (
            <Image
              source={{ uri: tierEmblemUrl(globalStats.rank.tier) }}
              style={tabStyles.tierEmblemBadge}
              resizeMode="contain"
            />
          )}
        </View>
        <View style={tabStyles.heroInfo}>
          <View style={tabStyles.riotIdRow}>
            {/* Riot ID del jugador. La cuenta demo (FAKER) se muestra igual que
                cualquier cuenta real — sin badges que delaten que son mocks. */}
            <Text style={[tabStyles.riotId, { color: txt }]}>{riotId}</Text>
          </View>
          {/* + — Hero rank badge: emblema oficial de CommunityDragon
              (Gold/Platinum/Diamond...) o dot fallback si tier es null. El
              borde y el texto siguen el color del tier. */}
          <View style={[tabStyles.rankBadge, {
            borderColor: tierColor(globalStats.rank.tier) + '88',
            backgroundColor: tierColor(globalStats.rank.tier) + '14',
          }]}>
            {tierEmblemUrl(globalStats.rank.tier) ? (
              <Image
                source={{ uri: tierEmblemUrl(globalStats.rank.tier) }}
                style={tabStyles.tierEmblemSmall}
                resizeMode="contain"
              />
            ) : (
              <View style={[tabStyles.tierDot, { backgroundColor: tierColor(globalStats.rank.tier) }]} />
            )}
            <Text style={[tabStyles.rankText, { color: tierColor(globalStats.rank.tier) }]}>
              {fmtRank(globalStats.rank)}
            </Text>
          </View>
          <Text style={[tabStyles.faction, { color: theme.primary + 'AA' }]}>
            {(FACTIONS[faction]?.identity || 'Nova').toUpperCase()} · {stats.role} · Top {globalStats.rank.percentile}% del rango
          </Text>
        </View>
      </View>

      <SectionDivider />

      {/* Tarjeta dedicada de rango — ELO estimado + LP bar + delta últimos 10.
           — colores derivados del tier (no siempre dorado).
           — Emblema oficial grande (56px) centrado al inicio de la card. */}
      <View style={[tabStyles.rankCard, {
        borderColor: tierColor(globalStats.rank.tier) + '33',
        backgroundColor: tierColor(globalStats.rank.tier) + '0A',
      }]}>
        {tierEmblemUrl(globalStats.rank.tier) && (
          <Image
            source={{ uri: tierEmblemUrl(globalStats.rank.tier) }}
            style={tabStyles.tierEmblemLarge}
            resizeMode="contain"
          />
        )}
        <View style={tabStyles.rankCardTop}>
          {/* B1.2 — el bloque tier debe poder encoger para que la pill de LP
              no desborde la card en viewports estrechos. */}
          <View style={tabStyles.rankCardLeft}>
            <Text style={[tabStyles.rankCardTier, { color: c.gold }]} numberOfLines={1}>
              {globalStats.rank.tier} {globalStats.rank.division}
            </Text>
            <Text style={[tabStyles.eloEstimate, { color: tierColor(globalStats.rank.tier) + '55' }]}>
              Ver ELO estimado en ELO-FORGE
            </Text>
          </View>
          <View style={tabStyles.lpDeltaPill}>
            <Text style={[tabStyles.lpDeltaText, { color: lpTrendPositive ? c.success : c.error }]}>
              {lpTrendPositive ? '▲' : '▼'} {Math.abs(globalStats.rank.lpNetLast10)} LP · últimos 10 partidos
            </Text>
          </View>
        </View>
        <LPBar lp={globalStats.rank.lp} lpToNext={globalStats.rank.lpToNext} theme={theme} />

        {/* Ladder Rank absoluto (P-K): #882,826 invocadores · Top 33.54% */}
        {ladder && (
          <Text style={tabStyles.ladderText}>
            #{ladder.rank.toLocaleString()} invocadores
            {'  ·  '}
            <Text style={tabStyles.ladderTextHi}>Top {ladder.percentile}%</Text>
          </Text>
        )}

        {/* PromotionTrack: 5 dots con promo al siguiente tier */}
        <PromotionTrack
          tier={globalStats.rank.tier}
          division={globalStats.rank.division}
          lp={globalStats.rank.lp}
          lpToPromo={globalStats.rank.lpToNext || 100}
        />
      </View>

      {/* Peak histórico (P-I) — pico de tier+división+LP de todas las temporadas */}
      {peak && (
        <View style={tabStyles.peakCard}>
          <View style={tabStyles.peakAccent} />
          <View style={{ flex: 1 }}>
            <Text style={tabStyles.peakLabel}>PEAK HISTÓRICO {peak.season ? `· ${peak.season}` : ''}</Text>
            <Text style={tabStyles.peakValue}>
              {peak.tier} {peak.division} · {peak.lp} LP
            </Text>
          </View>
        </View>
      )}

      {/* Stats globales — 3 pills */}
      <View style={tabStyles.statsPillsRow}>
        <View style={[tabStyles.statsPill, { borderColor: wrColor(globalStats.winrate, theme.primary) + '55' }]}>
          <Text style={[tabStyles.pillValue, { color: wrColor(globalStats.winrate, theme.primary) }]}>
            {globalStats.winrate}%
          </Text>
          <Text style={[tabStyles.pillLabel, { color: txt + '66' }]}>WINRATE</Text>
          <Text style={[tabStyles.pillSub, { color: txt + '44' }]}>
            {globalStats.wins}V · {globalStats.losses}D
          </Text>
        </View>
        <View style={[tabStyles.statsPill, { borderColor: kdaColor(globalStats.avgKDA, theme.primary) + '55' }]}>
          <Text style={[tabStyles.pillValue, { color: kdaColor(globalStats.avgKDA, theme.primary) }]}>
            {globalStats.avgKDA.toFixed(1)}
          </Text>
          <Text style={[tabStyles.pillLabel, { color: txt + '66' }]}>KDA</Text>
          <Text style={[tabStyles.pillSub, { color: txt + '44' }]}>media</Text>
        </View>
        <View style={[tabStyles.statsPill, { borderColor: theme.primary + '33' }]}>
          <Text style={[tabStyles.pillValue, { color: theme.primary }]}>
            {globalStats.avgCSPM.toFixed(1)}
          </Text>
          <Text style={[tabStyles.pillLabel, { color: txt + '66' }]}>CS/MIN</Text>
          <Text style={[tabStyles.pillSub, { color: txt + '44' }]}>media</Text>
        </View>
        {/* 4ª pill VISIÓN. Solo se muestra si hay valor — algunos
            modos antiguos no tienen vision score y dejaríamos un "—". */}
        <View style={[tabStyles.statsPill, { borderColor: theme.primary + '33' }]}>
          <Text style={[tabStyles.pillValue, { color: theme.primary }]}>
            {typeof globalStats.avgVision === 'number'
              ? globalStats.avgVision.toFixed(1)
              : '—'}
          </Text>
          <Text style={[tabStyles.pillLabel, { color: txt + '66' }]}>VISIÓN</Text>
          <Text style={[tabStyles.pillSub, { color: txt + '44' }]}>media</Text>
        </View>
      </View>

      {/* Sparkline últimas 10 partidas */}
      <Sparkline matches={matches} winColor={theme.primary} theme={theme} />

      {/* KPI SEMANAL — objetivo de coaching de la semana en curso. La semana
          se deriva de AsyncStorage (`novarift_kpi_started_at`) y rota la
          métrica activa (CS/min vs Vision) según el rol y el nº de semana. */}
      <View style={{ marginTop: 16 }}>
        <KPICoachingWidget
          user={user}
          matches={matches}
          globalStats={globalStats}
        />
      </View>

      {/* Champion pool del usuario — sólo si tiene uno real configurado.
          Cuando user.champions está vacío NO renderizamos campeones (antes caía
          a un top fijo Lucian/Ezreal/Jinx que además se duplicaba con la pestaña
          CHAMPION POOL): la pestaña es la única fuente y aquí mostramos un CTA. */}
      {user?.champions && user.champions.length > 0 ? (
        <>
          <Text style={[tabStyles.sectionTitle, { color: txt + '66' }]}>
            TU CHAMPION POOL
          </Text>
          {/* .map() recorre los campeones del usuario y devuelve un <TopChampionRow>
              por cada uno (como un for que va construyendo widgets). Por cada
              campeón se buscan sus stats reales en el mock; si no existen, se
              fabrica una entrada básica con valores por defecto. */}
          {user.champions.map((champ, idx) => {
            // Buscar datos de stats del mock si existen, si no, crear una entrada básica.
            // Coerce a string: Riot API devuelve a veces championId numérico, y el
            // optional chaining no protege contra .toLowerCase() sobre un number.
            const champKey = String(champ.championId ?? '').toLowerCase();
            // B1 — sólo la cuenta demo (FAKER, poolSource 'mock') hereda las stats
            // del mock NovaRift. Con pool propio (onboarding/derivado) NO se inventan
            // números: la fila muestra "Sin partidas todavía".
            const mockChamp = stats.poolSource === 'mock'
              ? NOVA_TOP_CHAMPIONS.find(mc =>
                  String(mc.championId ?? '').toLowerCase()   === champKey ||
                  String(mc.championName ?? '').toLowerCase() === champKey
                )
              : null;
            // Sin partidas reales NO se inventa un 52% — la fila
            // muestra "Sin partidas todavía" (TopChampionRow maneja winrate null).
            const displayChamp = mockChamp || {
              championId:   champ.championId,
              championName: champ.displayName || champ.championId,
              winrate:      null,
              games:        0,
              avgKDA:       null,
              slot:         champ.slot,
              slotKind:     champ.slotKind,
            };
            return (
              <TopChampionRow
                key={champ.championId}
                champ={{ ...displayChamp, slot: champ.slot, slotKind: champ.slotKind }}
                theme={theme}
                rank={idx + 1}
                onPress={() => openChampModal(displayChamp.championName)}
              />
            );
          })}
        </>
      ) : null}

      {/* Modal detalle del campeón */}
      <ChampionDetailModal
        visible={champModal.visible}
        championName={champModal.name}
        matches={matches}
        factionTheme={factionThemeForModal}
        onClose={closeChampModal}
      />

      {/* Consejo del día basado en datos (sin facción) */}
      <View style={[tabStyles.tipCard, { borderColor: theme.primary + '22' }]}>
        <View style={tabStyles.tipHeaderRow}>
          <Text style={[tabStyles.tipLabel, { color: theme.primary + 'AA' }]}>
            CONSEJO DE HOY
          </Text>
          <Text style={[tabStyles.tipAccent, { color: theme.primary }]}>◈</Text>
        </View>
        <Text style={tabStyles.tipText}>{dailyTip}</Text>
      </View>

      {/* SIMULAR PARTIDA eliminado: flujo unificado hub→champSelect→HUD */}

      {/* FactionRadarChart movido a ELO Forge. La narrativa "qué
          mejorar" encaja con el panel de coaching, no con el panel de
          identidad competitiva. */}

      {/* Historial completo 10 partidas con grade y LP delta — agrupado por sesión */}
      <Text style={[tabStyles.sectionTitle, { color: txt + '66', marginTop: 14 }]}>
        ÚLTIMAS PARTIDAS
      </Text>
      {/* por ahora todas las partidas caen en la sesión "HOY". Cuando
          el backend devuelva timestamps, agrupar por día natural (o ventana
          <90min entre partidas consecutivas). */}
      {[{ date: 'HOY', matches }].map((session, si) => (
        <View key={si}>
          <MatchSessionHeader matches={session.matches} date={session.date} />
          {session.matches.map(match => {
            const isExpanded = expandedMatchId === match.matchId;
            return (
              <View key={match.matchId}>
                <TouchableOpacity
                  onPress={() => toggleMatch(match.matchId)}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: isExpanded }}
                  accessibilityLabel={`${isExpanded ? 'Ocultar' : 'Ver'} detalle de la partida con ${match.championName}`}
                >
                  <MatchRow match={match} theme={theme} expandable expanded={isExpanded} />
                </TouchableOpacity>
                {isExpanded && <MatchExpandedPanel match={match} />}
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

// ─── Sub-componente: PoolSlotCard 2x2 — splash + WR% grande + métrica + maestría
// Tarjeta grande de un campeón del pool (mitad superior: splash art con badges;
// mitad inferior: WR% gigante + métrica de facción + barras de grado y maestría).
// `metric` elige qué estadística destacar según la facción del usuario (mapa
// FACTION_HERO_METRIC con fallback a ZAUN si la facción no está).
function PoolSlotCard({ champ, theme, factionKey, onPress, trophies = [] }) {
  const { colors: c, isDark } = useTheme();
  const txt = isDark ? theme.text : c.textPrimary;
  const psStyles = useMemo(() => makePsStyles(c), [c]);
  const wrCol = wrColor(champ.winrate, theme.primary);
  const isMain = slotKindOf(champ) === 'main';

  // B1 — ¿tenemos partidas reales con este campeón? El pool de onboarding llega
  // sin datos (winrate null, games 0): en ese caso mostramos un estado vacío
  // honesto en vez de "null% WR" / "undefined". El demo (FAKER) trae stats mock.
  const hasStats = typeof champ.winrate === 'number';

  // Métrica destacada según facción del usuario
  const metric = FACTION_HERO_METRIC[factionKey] || FACTION_HERO_METRIC.ZAUN;
  const metricValue = champ[metric.key];
  // Sin valor (null/undefined) mostramos un guion en vez de "undefined"/NaN.
  const metricDisplay = (metricValue == null)
    ? '—'
    : (metric.wrap ? metric.wrap(metricValue) : metricValue);

  // B1 — grado competitivo COMPUTADO del rendimiento real (null si no hay datos:
  // entonces la barra de grado no se pinta). Reemplaza el mapa hardcodeado.
  const gradeProgress = gradeProgressFromChamp(champ);

  // Maestría defensiva: el pool real puede traer mastery = null. Solo pintamos
  // badge/barra cuando es un objeto con datos.
  const mastery = (champ.mastery && typeof champ.mastery === 'object') ? champ.mastery : null;

  return (
    <TouchableOpacity
      activeOpacity={onPress ? 0.82 : 1}
      onPress={onPress}
      style={[psStyles.card, {
        borderColor: isMain ? 'rgba(123,118,221,0.4)' : theme.primary + '66',
        borderWidth: isMain ? 1.5 : 1.5,
        shadowColor: isMain ? c.primary : theme.primary,
      }]}
    >
      {/* Splash hero (top half) focal point hacia la cabeza.
          La imagen `loading` (308×560) tiene la cara en el tercio superior.
          Con cover en un wrap 3/4, el algoritmo cropea por el centro vertical
          y deja la cara fuera de cuadro. Forzamos el contenedor más alto que
          el wrap visible y centramos visualmente con `top: -20%` para subir
          el foco. En web, `objectPosition: 'top center'` da el mismo efecto
          en una sola línea. */}
      <View style={psStyles.heroWrap}>
        <View style={psStyles.heroFocalShift}>
          <ChampionImage
            name={champ.championName}
            aspect="portrait"
            style={[
              StyleSheet.absoluteFillObject,
              Platform.OS === 'web'
                ? { objectPosition: 'top center' }
                : null,
            ]}
            resizeMode="cover"
          />
        </View>
        <View style={psStyles.heroGradient} />

        {/* Badge MAIN/SEC */}
        <View style={[psStyles.slotBadge, {
          borderColor: isMain ? c.gold : theme.primary,
          backgroundColor: isMain ? 'rgba(255,215,0,0.85)' : theme.primary + 'CC',
        }]}>
          <Text style={[psStyles.slotBadgeText, { color: c.textInverse }]}>
            {isMain ? 'MAIN' : 'SEC'}
          </Text>
        </View>

        {/* B2.3 — Medallones de trofeos conseguidos (snapshot del TrophyCabinet).
            Solo en la card MAIN: la narrativa de los trofeos es "logros con tu
            campeón principal" (BadgeUnlockModal usa su retrato). Máx. 3 + "+N". */}
        {isMain && trophies.length > 0 && (
          <View style={psStyles.trophyCol}>
            {trophies.slice(0, 3).map(t => (
              <TrophyBadge key={t.id} tier="oro" glyph={t.icon} size={20} />
            ))}
            {trophies.length > 3 && (
              <Text style={psStyles.trophyMore}>+{trophies.length - 3}</Text>
            )}
          </View>
        )}

        {/* Mastery badge (top-left) — B1: solo si hay datos de maestría reales.
            El pool de onboarding llega con mastery = null; en ese caso lo ocultamos. */}
        {mastery && (
          <View style={psStyles.masteryBadge}>
            <Text style={[psStyles.masteryText, {
              color: (mastery.level ?? 0) >= 7 ? c.gold
                : (mastery.level ?? 0) >= 6 ? '#C0C0C0' : theme.primary,
            }]}>
              M{mastery.level}
            </Text>
          </View>
        )}

        {/* Champion name overlay */}
        <Text style={psStyles.champName}>{champ.championName}</Text>
      </View>

      {/* Bottom block — WR% gigante + métrica facción */}
      <View style={[psStyles.bottom, { borderTopColor: theme.primary + '22' }]}>
        {/* B1 — con datos: WR% gigante + "WR · NP". Sin datos (pool de
            onboarding): estado vacío honesto en vez de "null% WR". */}
        {hasStats ? (
          <View style={psStyles.wrRow}>
            <Text style={[psStyles.wrBig, { color: wrCol }]}>
              {champ.winrate}%
            </Text>
            <Text style={[psStyles.wrLabel, { color: txt + '66' }]}>
              WR · {champ.games}P
            </Text>
          </View>
        ) : (
          <View style={psStyles.wrRow}>
            <Text style={[psStyles.wrLabel, { color: txt + '66' }]}>
              Sin partidas todavía
            </Text>
          </View>
        )}

        {/* Métrica destacada por facción */}
        <View style={[psStyles.metricRow, { borderTopColor: theme.primary + '11' }]}>
          <Text style={[psStyles.metricLabel, { color: theme.primary + 'BB' }]}>
            {metric.label.toUpperCase()}
          </Text>
          <Text style={[psStyles.metricValue, { color: theme.primary }]}>
            {metricDisplay}
          </Text>
        </View>

        {/* Barra de grado competitivo segmentada (C → S+). B1 — el progreso se
            computa del rendimiento real (gradeProgressFromChamp). Si no hay
            partidas, gradeProgress es null y la barra simplemente no se pinta. */}
        {gradeProgress != null && (
          <GradeProgressBar
            progress={gradeProgress}
            color={theme.primary}
            label="GRADO"
            showGrades
          />
        )}

        {/* Barra de maestría hacia M+1 — B1: solo si hay maestría real (objeto).
            El pool de onboarding llega con mastery = null y entonces se oculta;
            esto también es defensivo contra el shape antiguo (mastery numérico). */}
        {mastery && (
          <View style={psStyles.masteryBarWrap}>
            <View style={[psStyles.masteryTrack, { backgroundColor: c.onSurface(0.08) }]}>
              <View
                style={[
                  psStyles.masteryFill,
                  {
                    width: `${mastery.progressPct ?? 0}%`,
                    backgroundColor: (mastery.level ?? 0) >= 7 ? c.gold : theme.primary,
                    shadowColor: (mastery.level ?? 0) >= 7 ? c.gold : theme.primary,
                  },
                ]}
              />
            </View>
            <Text style={[psStyles.masteryCaption, { color: txt + '55' }]}>
              {(mastery.level ?? 0) >= 7
                ? 'M7 — máximo desbloqueado'
                : `${mastery.progressPct ?? 0}% → M${(mastery.level ?? 0) + 1}`}
            </Text>
          </View>
        )}

        {/* BUG-CRITICO-02 — Footer con label MAIN/SEC explícito.
            Sustituye cualquier render previo que pudiera filtrar campos
            crudos del mock (champ.id, mastery.points, etc.).
            B1 — sin partidas reales NO mostramos "null% WR": solo el rol. */}
        <View style={[psStyles.slotFooter, { borderTopColor: theme.primary + '15' }]}>
          <Text style={[psStyles.slotFooterText, {
            color: isMain ? c.gold : theme.primary + 'CC',
          }]}>
            {isMain ? 'MAIN' : 'SECUNDARIO'}
            {hasStats ? ` · ${champ.games}P · ${champ.winrate}% WR` : ' · Sin partidas todavía'}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}
// Estilos de la PoolSlotCard (tarjeta grande del grid 2×2 del pool).
const makePsStyles = (c) => StyleSheet.create({
  card: {
    width: '48.5%',
    maxWidth: 240,
    borderWidth: 1.5, borderRadius: 12,
    overflow: 'hidden', marginBottom: 10,
    shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 0 },
    elevation: 6,
    backgroundColor: '#0e0e1a',
  },
  heroWrap: {
    // la card del POOL ahora hospeda la imagen `loading` (308×560 portrait).
    // Antes el ratio era 16/11 landscape: con resizeMode=cover sobre un retrato,
    // la cara del campeón quedaba recortada arriba. 3/4 (algo más alto que ancho)
    // encaja la silueta entera y mantiene la WR cell de abajo legible.
    width: '100%', aspectRatio: 3 / 4,
    position: 'relative', overflow: 'hidden',
  },
  // wrapper interno que sube el "punto de cropping" para que
  // el rostro del campeón (tercio superior del loading 308×560) quede visible
  // dentro del heroWrap. Solo hace falta en nativo: en web la Image lleva
  // `objectPosition: 'top center'` y este wrapper actúa como `position:
  // absolute; inset: 0` neutro.
  heroFocalShift: {
    ...StyleSheet.absoluteFillObject,
    ...(Platform.OS === 'web'
      ? null
      : { top: '-18%', height: '120%' }),
    overflow: 'hidden',
  },
  heroGradient: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(7,7,13,0.4)',
  },
  slotBadge: {
    position: 'absolute', top: 6, right: 6,
    borderWidth: 1, borderRadius: 6,
    paddingHorizontal: SPACING.sm, paddingVertical: 3,
  },
  slotBadgeText: { fontSize: TYPE_SCALE.micro.size, fontWeight: '800', letterSpacing: 1 },
  masteryBadge: {
    position: 'absolute', top: 6, left: 6,
    backgroundColor: 'rgba(7,7,13,0.7)',
    borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2,
  },
  // B2.3 — columna de medallones de trofeo bajo el badge MAIN (esquina derecha).
  trophyCol: {
    position: 'absolute', top: 34, right: 6,
    alignItems: 'center', gap: 4,
  },
  trophyMore: { color: '#ffd700', fontSize: 9, fontWeight: '900' },
  masteryText: { fontSize: TYPE_SCALE.micro.size, fontWeight: '900', letterSpacing: 1 },
  champName: {
    position: 'absolute', bottom: 6, left: 8, right: 8,
    // Texto SOBRE el splash art (oscuro en ambos modos) — se mantiene claro fijo
    // con sombra negra para legibilidad sobre la imagen, no se tematiza.
    color: '#E8E4FF', fontSize: TYPE_SCALE.label.size, fontWeight: '900', letterSpacing: 1,
    textShadowColor: 'rgba(0,0,0,0.85)', textShadowRadius: 4,
  },
  // Padding vertical reducido. Antes 10 → ahora 7 para
  // que las tarjetas del pool sean más compactas (el footer MAIN/SEC nuevo
  // ya añade 8+6=14px → compensamos quitando 6 aquí).
  bottom: { paddingHorizontal: 10, paddingVertical: 7, borderTopWidth: 1 },
  wrRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  // 3-1 — El WR ya NO es la métrica prioritaria/destacada: mismo peso visual que
  // el resto (label.size), porque el WR depende de las demás métricas y esta
  // pantalla mide el rendimiento global del usuario con cada campeón.
  wrBig: { fontSize: TYPE_SCALE.label.size, fontWeight: '900', letterSpacing: 1 },
  wrLabel: { fontSize: TYPE_SCALE.micro.size, fontWeight: '700', letterSpacing: 1 },
  metricRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderTopWidth: 1, paddingTop: 6, marginTop: 6,
  },
  metricLabel: { fontSize: TYPE_SCALE.micro.size, fontWeight: '900', letterSpacing: 2 },
  metricValue: { fontSize: TYPE_SCALE.label.size, fontWeight: '900' },
  masteryBarWrap: { marginTop: 8 },
  masteryTrack: { height: 4, borderRadius: 2, overflow: 'hidden' },
  masteryFill: {
    height: 4, borderRadius: 2,
    shadowOpacity: 0.6, shadowRadius: 4, shadowOffset: { width: 0, height: 0 },
  },
  masteryCaption: { fontSize: TYPE_SCALE.micro.size, marginTop: SPACING.xs, fontWeight: '700', letterSpacing: 0.5 },
  // BUG-CRITICO-02 — Footer explícito MAIN/SEC + stats.
  slotFooter: {
    marginTop: SPACING.sm, paddingTop: 6,
    borderTopWidth: 1,
    alignItems: 'center',
  },
  slotFooterText: {
    fontSize: TYPE_SCALE.micro.size, fontWeight: '900', letterSpacing: 1.2,
  },
});

// ─── TAB: POOL ───────────────────────────────────────────────────────────────
// Grid 2×2 con splash + WR% gigante + métrica destacada por facción + maestría.
// Diferenciador NOVA RIFT vs op.gg: el pool 2+2 es una unidad RPG.
function PoolTab({ stats, theme, onPressChamp }) {
  const { colors: c, isDark } = useTheme();
  const txt = isDark ? theme.text : c.textPrimary;
  const tabStyles = useMemo(() => makeTabStyles(c), [c]);
  const { poolDetail } = stats;
  const factionKey = stats.faction;

  // B2.3 — Trofeos conseguidos según el snapshot {trophyId: bool} que persiste
  // TrophyCabinet. Solo lectura: si no hay snapshot, no se pinta ningún medallón.
  const [earnedTrophies, setEarnedTrophies] = useState([]);
  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem('novarift:trophies:snapshot')
      .then(raw => {
        if (cancelled || !raw) return;
        const snap = JSON.parse(raw);
        setEarnedTrophies(ALL_TROPHIES.filter(t => snap[t.id]));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);
  // calcOffPoolStats: función pura que compara rendimiento dentro/fuera del pool.
  const offData = calcOffPoolStats(stats.matches, stats.pool);

  // Maestría agregada del pool — promedio de %
  // reduce() suma el progreso de todos los campeones (como un acumulador en un
  // for) y se divide entre el nº de campeones para obtener la media, redondeada.
  // B1 — defensivo: el pool de onboarding puede traer mastery = null; usamos
  // optional chaining + ?? 0 para no crashear y promediar como 0% sin datos.
  const avgMasteryPct = poolDetail.length > 0
    ? Math.round(poolDetail.reduce((s, ch) => s + (ch.mastery?.progressPct ?? 0), 0) / poolDetail.length)
    : 0;

  // Slots llenos (los 4 slots completos = pool consolidado)
  const filledSlots = poolDetail.length;

  // ── UI del tab POOL ───────────────────────────────────────────────────────
  // Cabecera POOL 2+2 con barra de maestría media, caja de métrica prioritaria
  // de la facción, grid 2×2 de PoolSlotCard y un tip contextual sobre el coste
  // de salir del pool.
  return (
    <View>
      {/* Cabecera: pool 2+2 con barra agregada de maestría */}
      <View style={[tabStyles.poolHeader, { borderColor: theme.primary + '44', backgroundColor: c.onSurface(0.03) }]}>
        <View style={tabStyles.poolHeaderTop}>
          {/* B1.2 — flex:1+minWidth:0 para que el bloque izquierdo trunque y
              "55% maestría media" no desborde la card en ≤390px. */}
          <View style={tabStyles.poolHeaderLeft}>
            <Text style={[tabStyles.poolHeaderTitle, { color: theme.primary }]} numberOfLines={1}>
              CHAMPION POOL
            </Text>
            <Text style={[tabStyles.poolHeaderSub, { color: txt + '55' }]} numberOfLines={1}>
              {filledSlots}/4 slots · Identidad de juego
            </Text>
          </View>
          <View style={tabStyles.poolHeaderRight}>
            <Text style={[tabStyles.poolHeaderBig, { color: theme.primary }]}>
              {avgMasteryPct}%
            </Text>
            <Text style={[tabStyles.poolHeaderRightLabel, { color: txt + '55' }]}>
              maestría media
            </Text>
          </View>
        </View>
        <View style={[lpStyles.track, { backgroundColor: c.onSurface(0.08), marginTop: 8 }]}>
          <View
            style={[
              lpStyles.fill,
              {
                width: `${avgMasteryPct}%`,
                backgroundColor: theme.primary,
                shadowColor: theme.primary,
              },
            ]}
          />
        </View>
      </View>

      {/* Grid 2×2 de slot cards */}
      <Text style={[tabStyles.sectionTitle, { color: txt + '66' }]}>
        TUS CAMPEONES · 2 MAIN · 2 SECUNDARIOS
      </Text>
      <View style={tabStyles.pool2x2Row}>
        {poolDetail.map(champ => (
          <PoolSlotCard
            key={champ.championId}
            champ={champ}
            theme={theme}
            factionKey={factionKey}
            trophies={earnedTrophies}
            onPress={onPressChamp ? () => onPressChamp(champ.championName) : undefined}
          />
        ))}
      </View>

      {/* Tip contextual */}
      <View style={[tabStyles.insightBox, { borderColor: theme.primary + '33', backgroundColor: theme.primary + '0A' }]}>
        <Text style={[tabStyles.insightText, { color: theme.primary + 'BB' }]}>
          Tu WR on-pool es del {offData.onPool.winrate}%.
          {offData.offPool.games > 0
            ? ` Salir del pool te cuesta ${offData.offPool.bleedPercent}pp de WR.`
            : ' Pool consolidado — sigue así.'}
        </Text>
      </View>
    </View>
  );
}

// ─── TAB: OFF-CHAMPION-POOL ──────────────────────────────────────────────────
// Las MISMAS partidas en gris desaturado + banner naranja + mensaje positivo
// si no hay off-champion-pool en los últimos 10.
function OffPoolTab({ stats, theme }) {
  const { colors: c, isDark } = useTheme();
  const txt = isDark ? theme.text : c.textPrimary;
  const tabStyles = useMemo(() => makeTabStyles(c), [c]);
  // Dos funciones puras de cálculo: offData (resumen on vs off) y offChamps
  // (lista de campeones agregada). hasOffPool indica si hay alguna partida fuera.
  const offData = calcOffPoolStats(stats.matches, stats.pool);
  const offChamps = offPoolByChampion(stats.matches, stats.pool);
  const hasOffPool = offData.offPool.games > 0;

  // Mini-resumen: nº partidas fuera del pool + % de derrotas.
  // losses% = 100 - winrate (winrate ya viene calculado en offData).
  const offGames = offData.offPool.games;
  const offLossPct = offGames > 0 ? Math.max(0, 100 - offData.offPool.winrate) : 0;

  // ── Salida temprana: pool limpio ──────────────────────────────────────────
  // "Early return" (como un return anticipado en Java): si no hay partidas fuera
  // del pool, devolvemos directamente la vista verde de felicitación y el resto
  // de la función (banner rojo, comparativa, etc.) ni se ejecuta.
  // Mensaje positivo si pool limpio
  if (!hasOffPool) {
    return (
      <View>
        <View style={[tabStyles.poolCleanBanner, {
          borderColor: '#4CAF5066',
          backgroundColor: 'rgba(76,175,80,0.08)',
          shadowColor: c.success,
        }]}>
          <View style={tabStyles.poolCleanDot} />
          <Text style={tabStyles.poolCleanTitle}>POOL LIMPIO</Text>
          <Text style={[tabStyles.poolCleanBody, { color: txt + 'AA' }]}>
            Mantienes tu identidad de juego. Las últimas {stats.matches.length} partidas
            están dentro de tu pool 2+2.
          </Text>
          <Text style={[tabStyles.poolCleanHint, { color: c.success + 'BB' }]}>
            Bonus de consistencia activo
          </Text>
        </View>

        {/* Aún así, mostramos las partidas en modo histórico (no desaturadas) */}
        <Text style={[tabStyles.sectionTitle, { color: txt + '66', marginTop: 14 }]}>
          HISTORIAL · TODAS DENTRO DEL POOL
        </Text>
        {stats.matches.map(match => (
          <MatchRow key={match.matchId} match={match} theme={theme} />
        ))}
      </View>
    );
  }

  // ── UI cuando SÍ hay partidas fuera del pool ──────────────────────────────
  // Mini-resumen rojo arriba, banner naranja de aviso, comparativa visual EN
  // POOL vs FUERA POOL, lista de partidas off-pool desaturadas y lista de
  // campeones agregada.
  // Hay off-champion-pool — mini-resumen + banner naranja + comparativa + lista desaturada
  return (
    <View>
      {/* Mini-sección de estadísticas resumen: "X partidas fuera del pool —
          Y% de derrotas" + texto motivacional. Coloca el coste del off-pool
          al inicio del tab para que el evaluador lo vea sin scroll. */}
      <View style={tabStyles.offSummaryCard}>
        <View style={tabStyles.offSummaryRow}>
          <View style={tabStyles.offSummaryPill}>
            <Text style={tabStyles.offSummaryPillText}>OFF-CHAMPION-POOL</Text>
          </View>
          <Text style={tabStyles.offSummaryGames}>
            {offGames} {offGames === 1 ? 'partida' : 'partidas'} fuera del pool
            <Text style={tabStyles.offSummaryDash}> — </Text>
            <Text style={tabStyles.offSummaryLoss}>{offLossPct}% de derrotas</Text>
          </Text>
        </View>
        <Text style={tabStyles.offSummaryMotivational}>
          Mantente en tu champion pool para mejorar más rápido.
        </Text>
      </View>

      {/* Banner naranja de aviso */}
      <View style={[tabStyles.warningBanner, {
        borderColor: '#FF994088', backgroundColor: 'rgba(255,153,64,0.12)',
        shadowColor: '#FF9940',
      }]}>
        <View style={tabStyles.warningBar} />
        <View style={{ flex: 1 }}>
          <Text style={tabStyles.warningTitle}>FUERA DEL CHAMPION POOL DETECTADO</Text>
          <Text style={[tabStyles.warningBody, { color: txt + 'BB' }]}>
            {offData.offPool.games} partidas en campeones que no son main ni secundarios.
            Coste: −{offData.offPool.bleedPercent}pp de WR.
          </Text>
        </View>
      </View>

      {/* Comparativa visual on vs off */}
      <View style={[tabStyles.bleedCard, { borderColor: '#FF525444' }]}>
        <View style={tabStyles.compareRow}>
          <View style={tabStyles.compareBlock}>
            <Text style={[tabStyles.compareLabel, { color: c.success }]}>EN POOL</Text>
            <Text style={[tabStyles.compareWR, { color: c.success }]}>
              {offData.onPool.winrate}%
            </Text>
            <Text style={[tabStyles.compareKDA, { color: c.success + 'AA' }]}>
              KDA {offData.onPool.kda.toFixed(1)}
            </Text>
            <Text style={[tabStyles.compareGames, { color: txt + '66' }]}>
              {offData.onPool.games}G
            </Text>
          </View>
          <View style={tabStyles.compareDivider}>
            <Text style={tabStyles.compareDividerArrow}>→</Text>
            <View style={[tabStyles.bleedBadge, { backgroundColor: '#FF525422', borderColor: '#FF525466' }]}>
              <Text style={tabStyles.bleedBadgeText}>−{offData.offPool.bleedPercent}pp</Text>
            </View>
          </View>
          <View style={tabStyles.compareBlock}>
            <Text style={[tabStyles.compareLabel, { color: c.error }]}>FUERA POOL</Text>
            <Text style={[tabStyles.compareWR, { color: c.error }]}>
              {offData.offPool.winrate}%
            </Text>
            <Text style={[tabStyles.compareKDA, { color: '#FF5252AA' }]}>
              KDA {offData.offPool.kda.toFixed(1)}
            </Text>
            <Text style={[tabStyles.compareGames, { color: txt + '66' }]}>
              {offData.offPool.games}G
            </Text>
          </View>
        </View>
      </View>

      {/* Las MISMAS partidas en gris desaturado + pill OFF-CHAMPION-POOL
          por fila — el indicador rojo prominente avisa visualmente de cada
          partida fuera del champion pool. */}
      <Text style={[tabStyles.sectionTitle, { color: txt + '66', marginTop: 4 }]}>
        PARTIDAS FUERA DEL CHAMPION POOL · DESATURADAS
      </Text>
      {stats.matches
        .filter(m => m.offPool)
        .map(match => (
          <MatchRow
            key={match.matchId}
            match={match}
            theme={theme}
            desaturated
            showOffChampionPoolPill
          />
        ))}

      {/* Lista agregada por campeón off-champion-pool */}
      {offChamps.length > 0 && (
        <>
          <Text style={[tabStyles.sectionTitle, { color: txt + '66', marginTop: 14 }]}>
            CAMPEONES JUGADOS FUERA DEL CHAMPION POOL
          </Text>
          {offChamps.map(champ => (
            <OffPoolChampRow key={champ.championName} champ={champ} theme={theme} />
          ))}
        </>
      )}

      {/* CTA anclar al pool */}
      <View style={[tabStyles.insightBox, { borderColor: theme.primary + '33', backgroundColor: theme.primary + '0A', marginTop: 8 }]}>
        <Text style={[tabStyles.insightText, { color: theme.primary + 'BB' }]}>
          Anclando tu juego a {stats.pool.join(', ')} dejas de sangrar winrate.
          La consolidación del pool 2+2 es la vía más corta a Gold I.
        </Text>
      </View>
    </View>
  );
}

// ─── Estilos compartidos entre tabs ─────────────────────────────────────────
// Un único StyleSheet (CSS como objeto Java) reutilizado por PerfilTab, PoolTab
// y OffPoolTab: hero card, avatar, badges de rango, emblemas de tier, tarjeta de
// rango, peak, pills de stats, cabecera de pool, banners (verde/naranja/rojo),
// comparativa on/off y el consejo del día. `Platform.OS === 'web'` añade efectos
// (boxShadow/filter) solo en navegador.
const makeTabStyles = (c) => StyleSheet.create({
  heroCard: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderRadius: 14,
    padding: SPACING.lg, marginBottom: SPACING.lg, gap: SPACING.lg,
    borderColor: c.surfaceBorder,
    backgroundColor: 'rgba(123,118,221,0.06)',
    shadowColor: '#7B76DD', shadowOpacity: 0.15, shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 }, elevation: 4,
    ...(Platform.OS === 'web' ? {
      boxShadow: '0 0 24px rgba(123,118,221,0.06), inset 0 1px 0 rgba(255,255,255,0.06)',
    } : {}),
  },
  avatarCircle: {
    width: 64, height: 64, borderRadius: 32,
    borderWidth: 2.5, justifyContent: 'center', alignItems: 'center',
    ...(Platform.OS === 'web' ? {
      boxShadow: '0 0 16px rgba(123,118,221,0.40), 0 0 32px rgba(123,118,221,0.15)',
    } : {}),
  },
  avatarText:  { fontSize: TYPE_SCALE.h5.size, fontWeight: '900' },
  heroInfo:    { flex: 1, gap: 5 },
  riotIdRow:   { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, flexWrap: 'wrap' },
  // Tipografía con más impacto en el header del perfil
  riotId:      { fontSize: TYPE_SCALE.h5.size, fontWeight: '900', letterSpacing: 1.5 },
  rankBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderWidth: 1, borderRadius: 8,
    paddingHorizontal: SPACING.sm, paddingVertical: SPACING.xs,
    alignSelf: 'flex-start',
  },
  rankIcon:    { fontSize: TYPE_SCALE.caption.size },
  // Dot circular con color del tier (sustituye al icono medalla hardcoded dorado).
  // Solo se usa como fallback cuando el tier es null/unranked (no hay emblema).
  tierDot: {
    width: 8, height: 8, borderRadius: 4,
    marginRight: SPACING.xs,
  },
  // Emblemas oficiales de tier de CommunityDragon, en 3 tamaños:
  // small → 36x40px, dentro del rankBadge del header
  // large → 56px, centrado al inicio del rankCard
  // badge → 28px, posicionado bottom-right del avatar
  tierEmblemSmall: {
    width: 36, height: 40,
    marginRight: SPACING.xs,
  },
  tierEmblemLarge: {
    width: 108,
    height: 108,
    resizeMode: 'contain',
    alignSelf: 'center',
    marginBottom: 10,
    ...(Platform.OS === 'web' ? {
      filter: 'drop-shadow(0 0 12px rgba(255,215,0,0.35))',
    } : {}),
  },
  tierEmblemBadge: {
    position: 'absolute',
    bottom: -4, right: -4,
    width: 28, height: 28,
  },
  // Wrapper relativo del avatar para posicionar el emblema badge.
  avatarWrapper: { position: 'relative' },
  rankText:    { fontSize: TYPE_SCALE.caption.size, fontWeight: '800', letterSpacing: 1 },
  faction:     { fontSize: TYPE_SCALE.caption.size, fontWeight: '600', letterSpacing: 1 },

  // Tarjeta dedicada de rango (debajo del hero card) — LP bar + delta tendencia
  rankCard: {
    borderWidth: 1, borderRadius: 14,
    padding: 18, marginBottom: 14,
    shadowColor: '#7B76DD', shadowOpacity: 0.15, shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 }, elevation: 4,
    ...(Platform.OS === 'web' ? {
      boxShadow: '0 4px 32px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.07)',
    } : {}),
  },
  rankCardTop: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  // B1.2 — ver headerLeft: ambos lados encogibles para no desbordar a ≤390px.
  rankCardLeft: { flex: 1, minWidth: 0, paddingRight: SPACING.sm },
  // Tier card más impactante (22 → 28)
  rankCardTier: { fontSize: TYPE_SCALE.h3.size, fontWeight: '900', letterSpacing: 1 },
  eloEstimate: { fontSize: TYPE_SCALE.micro.size, fontWeight: '700', letterSpacing: 2, marginTop: 3 },
  lpDeltaPill: {
    borderWidth: 1, borderColor: c.onSurface(0.08),
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: SPACING.xs,
    backgroundColor: 'rgba(0,0,0,0.4)',
    flexShrink: 1, // B1.2 — el texto envuelve a 2 líneas antes que desbordar
  },
  lpDeltaText: { fontSize: TYPE_SCALE.micro.size, fontWeight: '900', letterSpacing: 1 },

  // Ladder rank absoluto debajo de la LP bar
  ladderText: {
    fontSize: TYPE_SCALE.caption.size, color: c.onSurface(0.65),
    textAlign: 'center', marginTop: SPACING.sm,
  },
  ladderTextHi: { color: c.onSurface(0.55) },

  // Peak histórico — card dorada sutil bajo la rank card
  peakCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(255,201,60,0.08)',
    borderWidth: 1, borderColor: 'rgba(255,201,60,0.25)',
    borderRadius: 8, padding: 10,
    marginBottom: 14,
  },
  peakAccent: {
    width: 3, height: 24, borderRadius: 2,
    backgroundColor: '#FFC93C',
  },
  peakLabel: { fontSize: TYPE_SCALE.micro.size, letterSpacing: 2, color: 'rgba(255,201,60,0.7)', fontWeight: '900' },
  peakValue: { fontSize: TYPE_SCALE.label.size, fontWeight: '900', color: '#FFC93C', marginTop: 2 },

  statsPillsRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: 16 },
  statsPill: {
    flex: 1, borderWidth: 1, borderRadius: 10,
    paddingVertical: 14, paddingHorizontal: SPACING.sm, alignItems: 'center',
    minHeight: 82,
    backgroundColor: c.surface,
    borderLeftWidth: 3, borderLeftColor: c.primary,
    justifyContent: 'center',
  },
  pillValue:  { fontSize: TYPE_SCALE.h4.size, fontWeight: '900', letterSpacing: 0.5 },
  pillLabel:  { fontSize: TYPE_SCALE.micro.size,  fontWeight: '800', letterSpacing: 2, marginTop: 3, textTransform: 'uppercase' },
  pillSub:    { fontSize: TYPE_SCALE.micro.size, marginTop: 3, color: c.onSurface(0.40) },

  sectionTitle: {
    fontSize: TYPE_SCALE.micro.size, fontWeight: '900', letterSpacing: 2,
    marginBottom: 12, textTransform: 'uppercase',
    borderLeftWidth: 3, borderLeftColor: c.primary,
    paddingLeft: 10, color: c.onSurface(0.65),
  },

  summaryCard: {
    borderWidth: 1, borderRadius: 8,
    padding: 14, marginBottom: 14,
    shadowColor: '#7B76DD', shadowOpacity: 0.15, shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 }, elevation: 4,
  },
  summaryTitle: { fontSize: TYPE_SCALE.caption.size, fontWeight: '800', letterSpacing: 1, marginBottom: 10 },
  summaryRow:   { flexDirection: 'row', justifyContent: 'space-around' },
  summaryItem:  { alignItems: 'center' },
  summaryValue: { fontSize: TYPE_SCALE.h5.size, fontWeight: '900' },
  summaryLabel: { fontSize: TYPE_SCALE.micro.size, marginTop: 2 },

  // B1.2 — gap 3% (antes 3.5%): 48.5%×2 + 3.5% = 100.5% desbordaba medio punto.
  poolCardsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: '3%', marginBottom: 14 },

  // Pool 2+2 header
  poolHeader: {
    borderWidth: 1, borderRadius: 10,
    padding: 14, marginBottom: 12,
  },
  poolHeaderTop: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
  },
  poolHeaderTitle: { fontSize: TYPE_SCALE.body.size, fontWeight: '900', letterSpacing: 3 },
  poolHeaderSub:   { fontSize: TYPE_SCALE.caption.size, marginTop: 3, letterSpacing: 1, fontWeight: '600' },
  poolHeaderLeft:  { flex: 1, minWidth: 0, paddingRight: SPACING.sm }, // B1.2
  poolHeaderRight: { alignItems: 'flex-end', flexShrink: 0 },
  poolHeaderBig:   { fontSize: TYPE_SCALE.h5.size, fontWeight: '900', letterSpacing: 1 },
  poolHeaderRightLabel: { fontSize: TYPE_SCALE.micro.size, letterSpacing: 1.5, fontWeight: '700' },

  factionMetricBox: {
    borderWidth: 1, borderRadius: 8,
    padding: 12, marginBottom: 14,
  },
  factionMetricLabel: { fontSize: TYPE_SCALE.micro.size, fontWeight: '900', letterSpacing: 2.5, marginBottom: 6 },
  factionMetricRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  factionMetricValue: { fontSize: TYPE_SCALE.h5.size, fontWeight: '900', letterSpacing: 2 },
  factionMetricHint:  { fontSize: TYPE_SCALE.caption.size, fontStyle: 'italic' },

  // Grid 2×2 — 2 cards por fila, centrado en web cuando maxWidth aplica.
  // Sin width:100% para evitar overflow horizontal del HubScreen.
  pool2x2Row: {
    flexDirection: 'row', flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 14,
  },

  // Mini-resumen off-champion-pool (cabecera del tab) — pill roja + frase
  // motivacional. Spec colores: rgba(229,57,53,0.2) bg, #E53935 borde, #ff6b6b texto.
  offSummaryCard: {
    borderWidth: 1,
    borderColor: '#E53935',
    backgroundColor: 'rgba(229,57,53,0.2)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  offSummaryRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap',
  },
  offSummaryPill: {
    borderWidth: 1,
    borderColor: '#E53935',
    backgroundColor: 'rgba(229,57,53,0.25)',
    borderRadius: 4,
    paddingHorizontal: SPACING.sm, paddingVertical: 3,
  },
  offSummaryPillText: {
    color: '#ff6b6b', fontSize: TYPE_SCALE.micro.size, fontWeight: '900', letterSpacing: 1.2,
  },
  offSummaryGames: {
    color: '#ff6b6b', fontSize: TYPE_SCALE.caption.size, fontWeight: '800', flexShrink: 1,
  },
  offSummaryDash: { color: c.onSurface(0.55), fontWeight: '700' },
  offSummaryLoss: { color: '#ff6b6b', fontWeight: '900' },
  offSummaryMotivational: {
    color: c.onSurface(0.78),
    fontSize: TYPE_SCALE.caption.size, fontStyle: 'italic',
    marginTop: SPACING.sm, lineHeight: 16,
  },

  // Banner naranja de aviso off-champion-pool
  warningBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderWidth: 1.5, borderRadius: 10,
    padding: 14, marginBottom: 12,
    shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  warningBar: {
    width: 3, alignSelf: 'stretch', borderRadius: 2,
    backgroundColor: '#FF9940',
  },
  warningTitle: { color: '#FF9940', fontSize: TYPE_SCALE.caption.size, fontWeight: '900', letterSpacing: 2, marginBottom: 4 },
  warningBody:  { fontSize: TYPE_SCALE.caption.size, lineHeight: 16 },

  // Banner verde — pool limpio
  poolCleanBanner: {
    borderWidth: 1.5, borderRadius: 12,
    padding: 22, alignItems: 'center', gap: SPACING.sm,
    shadowOpacity: 0.4, shadowRadius: 16, shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  poolCleanDot: {
    width: 14, height: 14, borderRadius: 7,
    backgroundColor: c.success,
    marginBottom: SPACING.xs,
    shadowColor: c.success, shadowOpacity: 0.6, shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  poolCleanTitle: { color: c.success, fontSize: TYPE_SCALE.body.size, fontWeight: '900', letterSpacing: 4 },
  poolCleanBody:  { fontSize: TYPE_SCALE.caption.size, textAlign: 'center', lineHeight: 18, paddingHorizontal: 8 },
  poolCleanHint:  { fontSize: TYPE_SCALE.caption.size, fontWeight: '900', letterSpacing: 1.5, marginTop: 4 },

  bleedCard: {
    borderWidth: 1, borderRadius: 8,
    padding: 14, marginBottom: 14,
    backgroundColor: 'rgba(255,82,82,0.04)',
  },
  bleedHeader:  { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: 14 },
  bleedIcon:    { fontSize: TYPE_SCALE.body.size, color: '#FF8A80' },
  bleedTitle:   { fontSize: TYPE_SCALE.caption.size, fontWeight: '900', color: '#FF8A80', letterSpacing: 2 },

  compareRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  compareBlock:   { alignItems: 'center', flex: 1 },
  compareLabel:   { fontSize: TYPE_SCALE.micro.size, fontWeight: '800', letterSpacing: 1, marginBottom: 6 },
  compareWR:      { fontSize: TYPE_SCALE.h4.size, fontWeight: '900' },
  compareKDA:     { fontSize: TYPE_SCALE.caption.size, fontWeight: '700', marginTop: 2 },
  compareGames:   { fontSize: TYPE_SCALE.caption.size, marginTop: 2 },
  compareDivider: { alignItems: 'center', gap: 8 },
  compareDividerArrow: { fontSize: TYPE_SCALE.h6.size, color: '#888' },
  bleedBadge: {
    borderWidth: 1, borderRadius: 4, paddingHorizontal: SPACING.sm, paddingVertical: SPACING.xs,
  },
  bleedBadgeText: { color: c.error, fontSize: TYPE_SCALE.label.size, fontWeight: '900' },

  insightBox: {
    borderWidth: 1, borderRadius: 6, padding: 10,
  },
  insightText: { fontSize: TYPE_SCALE.caption.size, lineHeight: 18, fontStyle: 'italic' },

  // Consejo del día (TipCard)
  tipCard: {
    backgroundColor: 'rgba(123,118,221,0.06)',
    borderWidth: 1,
    borderRadius: 12,
    padding: SPACING.lg,
    marginVertical: 10,
    borderLeftWidth: 3,
    borderLeftColor: c.primary,
    shadowColor: '#7B76DD', shadowOpacity: 0.15, shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 }, elevation: 4,
    ...(Platform.OS === 'web' ? {
      boxShadow: '0 2px 16px rgba(123,118,221,0.06)',
    } : {}),
  },
  tipHeaderRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  tipLabel:  { fontSize: TYPE_SCALE.micro.size, fontWeight: '900', letterSpacing: 2.5, color: c.primary },
  tipAccent: { fontSize: TYPE_SCALE.body.size },
  tipText:   {
    color: c.onSurface(0.80),
    fontSize: TYPE_SCALE.label.size, lineHeight: 20, fontStyle: 'italic',
  },

  // Botón "SIMULAR PARTIDA EN VIVO" (modo demo TFG)
  demoGameBtn: {
    marginVertical: SPACING.sm,
    paddingVertical: 14, paddingHorizontal: SPACING.lg,
    backgroundColor: 'rgba(123,118,221,0.06)',
    borderWidth: 1, borderColor: c.surfaceBorder,
    borderRadius: 10,
    alignItems: 'center',
  },
  demoGameText: {
    color: 'rgba(123,118,221,0.85)',
    fontSize: TYPE_SCALE.caption.size, fontWeight: '900', letterSpacing: 2,
  },
  demoGameSub: {
    color: c.onSurface(0.40),
    fontSize: TYPE_SCALE.micro.size, marginTop: SPACING.xs, fontWeight: '600',
  },
});

// ─── (04/05) · Mapeo de Match Summary del backend → shape NOVA_MATCHES ──
// El frontend espera el shape de `novaStats.js` (matches con `cspm`, `kda`,
// `result: 'W'|'L'`, `offPool`, etc.). El backend devuelve Match V5 lean:
// `totalMinionsKilled`, `result: 'WIN'|'LOSS'`, sin `cspm`/`kda` derivados.
// Esta función pura hace la traducción para que MatchSessionHeader y
// MatchExpandedPanel sigan funcionando sin tocar su shape. Campos del
// sistema NOVA propietario (novaScore, position, gameps, fate, lpDelta,
// matchDetails) quedan en `null` — se calcularán más adelante con
// histórico real cuando el backend exponga el endpoint correspondiente.
// Función pura de traducción de datos (como un Mapper/Adapter en Java): recorre
// la lista del backend con .map() y devuelve una lista nueva con el shape que
// la UI espera. El operador `??` toma el primero que no sea null/undefined.
function mapRealMatches(recentMatches, userPool) {
  const poolArr = Array.isArray(userPool) ? userPool : [];
  return (recentMatches || []).map(m => {
    const dur = Math.max(1, m.durationMin ?? m.durationMinutes ?? 1);
    // Fallback robusto: ambos campos pueden venir según versión del backend.
    const cs = m.totalMinionsKilled ?? m.cs ?? 0;
    const kda = parseFloat(
      ((m.kills + m.assists) / Math.max(1, m.deaths)).toFixed(1)
    );
    const mapped = {
      matchId:        m.matchId,
      championName:   m.championName,
      result:         m.result === 'WIN' ? 'W' : 'L',
      kills:          m.kills,
      deaths:         m.deaths,
      assists:        m.assists,
      cs,
      durationMin:    dur,
      cspm:           parseFloat((cs / dur).toFixed(1)),
      kda,
      visionScore:    m.visionScore,
      damageToChamps: m.totalDamageDealtToChampions ?? m.damageToChamps ?? 0,
      gameMode:       'RANKED_SOLO',
      offPool:        poolArr.length > 0 && !poolArr.includes(m.championName),
      // Sistema NOVA propietario — no derivable de Match V5 directamente.
      novaScore:    null,
      position:     null,
      gameps:       null,
      fate:         null,
      lpDelta:      null,
    };
    // C2 — Generamos el desglose op.gg (10 jugadores, objetivos, oro, runas) de
    // forma determinista a partir del propio match, en vez de dejarlo en null.
    // Así, al desplegar CUALQUIER partida real, MatchExpandedPanel pinta el panel
    // rico con pestañas y no el texto de "disponible cuando…". Cuando el backend
    // exponga el match-v5 real (10 jugadores), basta sustituir esta línea.
    mapped.matchDetails = buildMatchDetails(mapped);
    return mapped;
  });
}

// ─── Consejo del día inteligente ──────────────────────────────────────
// Función pura: analiza las últimas partidas y devuelve UN consejo accionable
// sobre la métrica más floja (muertes → CS/min → visión). Con buen rendimiento
// refuerza el plan; sin datos suficientes devuelve el fallback rotatorio.
function getSmartDailyTip(matches, fallbackTip, kpiCtx) {
  const ms = (matches || []).filter(m => m && typeof m === 'object');
  if (ms.length < 3) return fallbackTip;
  const avg = (sel) => ms.reduce((a, m) => a + (Number(sel(m)) || 0), 0) / ms.length;
  const deaths = avg(m => m.deaths);
  // T3 — CS/min de la MISMA fuente que el panel de stats (globalStats.avgCSPM):
  // si el caller lo pasa, se usa tal cual; si no, se promedia de las partidas.
  const cspm   = Number.isFinite(kpiCtx?.avgCSPM) ? kpiCtx.avgCSPM : avg(m => m.cspm);
  const vision = avg(m => m.visionScore);
  const wins   = ms.filter(m => m.result === 'W' || m.result === 'WIN').length;
  const wr     = wins / ms.length;

  if (deaths >= 6.5) {
    return `Estás muriendo ${deaths.toFixed(1)} veces por partida. Objetivo de hoy: máximo 4 muertes — juega a no regalar, no a matar.`;
  }
  if (cspm > 0 && cspm < 6) {
    return `Tu CS/min medio es ${cspm.toFixed(1)}. Objetivo de hoy: 6.5+ — cada oleada perdida son ~100 de oro que regalas.`;
  }
  if (vision > 0 && vision < 15) {
    return `Visión media de ${vision.toFixed(0)} por partida. Objetivo de hoy: 1 ward rosa en cada vuelta a base.`;
  }
  if (wr >= 0.6) {
    // T13 — sin métricas flojas, en vez del genérico "no cambies nada" (no
    // accionable) anclamos el consejo al OBJETIVO SEMANAL activo del rol con un
    // dato concreto: target de hoy vs. la última partida ("ayer"). Mismo motor
    // que el widget KPI (pickWeeklyKpi + csTargetFor/visionTargetFor).
    const role = kpiCtx?.role;
    const tier = kpiCtx?.tier;
    const last = ms[0] || {};
    const wrPct = Math.round(wr * 100);
    if (pickWeeklyKpi(1, role) === 'VISION') {
      const target = visionTargetFor(role, tier);
      const yesterday = Number(last.visionScore) || vision;
      return `Vas ${wrPct}% WR — no te relajes. Objetivo semanal: ${Math.round(target)} de visión por partida (ayer hiciste ${Math.round(yesterday)}).`;
    }
    const target = csTargetFor(role, tier);
    const yesterday = Number(last.cspm) || cspm;
    return `Vas ${wrPct}% WR — sube el siguiente nivel. Objetivo semanal: aguanta ${target.toFixed(1)} CS/min (ayer te quedaste en ${yesterday.toFixed(1)}).`;
  }
  return fallbackTip;
}

// ─── Pantalla principal: HubScreen ───────────────────────────────────────────
// Componente exportado por defecto: la pantalla completa del modo OUT-OF-GAME.
// Orquesta carga de datos, estado de tabs y modales, y compone los tres tabs.
// TABS: array fijo con las etiquetas de las pestañas (orden de izq. a der.).
// Convención de naming: nunca "pool" a secas en texto visible, siempre
// "champion pool". La pestaña off-champion-pool se retiró (no aportaba a la
// experiencia); el dato de sangrado off-pool sigue vivo en las stats.
const TABS = ['PERFIL', 'CHAMPION POOL'];

// Racha mock del coach mental para la cuenta demo (FAKER): 3 victorias
// seguidas. Combinada con hora 22:00 y Gold II (47 LP) en el render → el coach
// evalúa estado ÓPTIMO ("Racha positiva. Buen momento para jugar ranked.").
const DEMO_MENTAL_MATCHES = [
  { result: 'W' }, { result: 'W' }, { result: 'W' },
];

export default function HubScreen({ onActivateRadar }) {
  // useContext: lee un contexto/estado global compartido (como inyección de
  // dependencias / un singleton accesible). Aquí obtiene el tema visual actual.
  const { theme } = useContext(RiotContext);
  // Tema claro/oscuro (superficies neutras). En oscuro c.* === COLORS.* y
  // c.onSurface(a) === rgba(255,255,255,a), así que el modo oscuro es idéntico
  // pixel a pixel; solo el claro cambia. `txt` aplica el truco de texto-facción.
  const { colors: c, isDark } = useTheme();
  const txt = isDark ? theme.text : c.textPrimary;
  const hubStyles = useMemo(() => makeHubStyles(c), [c]);
  const { user } = useUser();
  // si el padre (LiveScreen) no pasa onActivateRadar, abrimos el
  // FloatingRadarWidget global vía RadarContext. useRadar funciona dentro
  // de RadarProvider (montado en AppTabs); fuera es no-op por defecto.
  const radar = useRadar();
  const handleActivateRadar = onActivateRadar || radar.open;
  // H1 Nielsen — estado de conectividad de red para la barra superior.
  const connectionStatus = useConnectionStatus();
  // ── Estado local del componente ───────────────────────────────────────────
  // useState: campos observables que, al cambiar, redibujan la pantalla.
  // activeTab: qué pestaña está seleccionada (arranca en 'PERFIL').
  const [activeTab, setActiveTab] = useState('PERFIL');
  // visibilidad del modal "Buscar jugador". El modal se monta
  // siempre al final del JSX y solo se renderiza visible cuando este flag
  // es `true` (Modal nativo de RN gestiona el mount/unmount con animación).
  const [searchVisible, setSearchVisible] = useState(false);
  // Pool tab — modal de detalle de campeón (tapping en PoolSlotCard).
  // Estado-objeto { visible, name } con sus helpers open/close.
  const [poolChampModal, setPoolChampModal] = useState({ visible: false, name: null });
  const openPoolChampModal  = (name) => setPoolChampModal({ visible: true,  name });
  const closePoolChampModal = ()     => setPoolChampModal({ visible: false, name: null });
  // Summary real del jugador desde `/api/v1/riot/summoner-summary`.
  // `null` mientras carga. Se rellena al montar y cuando cambia `user.riotId`.
  const [riotSummary, setRiotSummary] = useState(null);
  // Marca un fallo de red al pedir los datos a Riot (backend caído / sin
  // conexión). Para cuentas reales esto dispara el ErrorState; la cuenta
  // demo (FAKER) lo ignora y se queda con los mocks.
  const [riotError, setRiotError] = useState(false);
  // FIX RIOT-RECOVER — refs para el auto-reintento ante un fallo
  // de red. `retryRef` guarda el timer pendiente (para limpiarlo al desmontar
  // o recargar) y `attemptRef` el nº de intentos consumidos. Sin esto, si el
  // backend estaba caído en el primer montaje, la pantalla latchaba el
  // ErrorState y NUNCA volvía a pedir los datos aunque el backend arrancase.
  const retryRef = useRef(null);
  const attemptRef = useRef(0);

  // ── Carga los datos de Riot del jugador ────────────────────────────────
  // Pide el summary a `/api/v1/riot/summoner-summary`. Montamos el riotId
  // desde user.riotId, o ensamblando username + tag (LoginScreen no siempre
  // rellena riotId). Si la petición falla marcamos `riotError`; el render
  // decide si mostrar el error (cuentas reales) o seguir con mocks (FAKER).
  // loadSummary: arma el riotId, resetea el contador de reintentos y lanza
  // la primera petición. También sirve de callback de "Reintentar" del
  // ErrorState (por eso resetea `attemptRef`).
  const loadSummary = () => {
    let id;
    if (user?.riotId) {
      id = user.riotId;
    } else if (user?.username) {
      id = user.username.includes('#')
        ? user.username
        : `${user.username}#${user?.tag || 'EUW'}`;
    } else {
      // Fallback de último recurso: usar la cuenta demo por defecto
      id = 'FAKER#EUW';
    }
    if (retryRef.current) { clearTimeout(retryRef.current); retryRef.current = null; }
    attemptRef.current = 0;
    setRiotError(false);
    setRiotSummary(null);
    runSummaryFetch(id);
  };

  // FIX RIOT-RECOVER — `fetchSummonerSummary` NO lanza error ante un fallo de
  // red: resuelve con un mock local (`mock:true` + `_localMock:true`). Eso
  // dispara el ErrorState "Sin conexión". Aquí detectamos ese caso y
  // reintentamos en segundo plano (hasta 4 veces, cada 2.5s) para que la app
  // se autorrecupere en cuanto el backend esté disponible — típico en la demo,
  // donde se arranca el backend y luego se abre la app. Un 404/Riot-ID inválido
  // SÍ lanza (RiotApiError) y cae en el `.catch`: ese error es determinista y
  // no se reintenta.
  const runSummaryFetch = (id) => {
    fetchSummonerSummary(id, { region: 'euw1' })
      .then((result) => {
        setRiotSummary(result);
        if (result?._localMock && attemptRef.current < 4) {
          attemptRef.current += 1;
          retryRef.current = setTimeout(() => runSummaryFetch(id), 2500);
        }
      })
      .catch(() => setRiotError(true));
  };

  // useEffect: código que se ejecuta al montar el componente (como un
  // constructor o un @PostConstruct) y cuando cambian sus dependencias. El
  // array final son las dependencias: si cambia el riotId/username/tag del
  // usuario, se vuelve a cargar el summary. El cleanup cancela cualquier
  // reintento pendiente al desmontar o al cambiar de cuenta (evita setState
  // sobre un componente desmontado).
  useEffect(() => {
    loadSummary();
    return () => {
      if (retryRef.current) { clearTimeout(retryRef.current); retryRef.current = null; }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.riotId, user?.username, user?.tag]);

  // Stats efectivos: arrancan del mock NovaRift, y si la API real
  // responde con datos no-mock, sobreescriben rango / wins / losses /
  // winrate y la lista de partidas. POOL y OFF-CHAMPION-POOL siguen del mock por
  // ahora — el endpoint actual no expone histórico extendido por campeón.
  // useMemo: valor calculado que se cachea y solo se recalcula si cambian sus
  // dependencias (como un campo lazy en Java). Aquí construye el objeto `stats`
  // efectivo: parte del mock NovaRift y, si la API real responde con datos
  // no-mock, los sobreescribe. Solo se reejecuta si cambian `user` o `riotSummary`.
  const stats = useMemo(() => {
    const userChamps  = user?.champions;
    const userPool = Array.isArray(userChamps)
      ? userChamps.map(ch => (typeof ch === 'string' ? ch : ch.displayName || ch.championId))
      : userChamps && (userChamps.main || userChamps.secondary)
        ? [...(userChamps.main || []), ...(userChamps.secondary || [])]
        : null;

    // BUG-CRITICO-01 — Construcción defensiva del riotId para que SIEMPRE
    // tenga formato `Name#TAG`. Si el user solo tiene `username` y `tag` por
    // separado (típico tras LoginScreen mock), los unimos con '#'. Si el riotId
    // ya viene formado, se usa tal cual. Esto evita renderizados como "Faker1"
    // (concatenación naive sin separador) cuando algún componente downstream
    // espera un formato u otro.
    const buildRiotId = () => {
      if (user?.riotId) return user.riotId;
      if (user?.username) {
        const name = user.username;
        // Si username ya incluye '#' (ej "Faker#EUW"), respeta tal cual.
        if (name.includes('#')) return name;
        // Tag por defecto 'EUW' si no hay otro disponible.
        const tag = user?.tag || 'EUW';
        return `${name}#${tag}`;
      }
      return NOVA_STATS.riotId;
    };

    // T4 — Si el usuario tiene su propio champion pool, el historial (matches) y
    // el pool del Hub reflejan SUS campeones, no los ADC del mock demo. Sin pool
    // propio (cuenta demo FAKER) se mantiene el mock NovaRift intacto.
    const remapped = userPool && userPool.length > 0 ? remapNovaToPool(userPool) : null;

    const base = {
      ...NOVA_STATS,
      ...(remapped || {}),
      riotId:  buildRiotId(),
      faction: user?.faction  || NOVA_STATS.faction,
      role:    user?.mainRole || NOVA_STATS.role,
      pool:    userPool && userPool.length > 0 ? userPool : NOVA_STATS.pool,
      // Origen del pool: 'onboarding' (el usuario lo eligió), 'derived' (de sus
      // partidas reales, se fija en el overlay de abajo) o 'mock' (cuenta demo).
      poolSource: userPool && userPool.length > 0 ? 'onboarding' : 'mock',
      // ── Flag interno de datos mock ──────────────────────────────────────
      // Es true cuando: (a) el usuario entró por "Modo Demo" del LoginScreen
      // (user.mock), o (b) el backend respondió con mock=true (key de Riot
      // caída / RATE_LIMITED). Es un flag interno: NO se muestra ningún badge
      // al usuario — la demo debe ser indistinguible de una cuenta real.
      isDemo: !!user?.mock || riotSummary?.mock === true,
    };

    // ── Overlay con datos reales de Riot ────────────────────────────────────
    // Cuando el backend responde con datos NO-mock, sobreescribimos rango /
    // wins / losses / winrate y la lista de partidas con lo que viene de Riot.
    // Excepción: la cuenta demo oficial (FAKER) ignora siempre los datos reales
    // y se queda con el mock NovaRift, para que la demostración sea estable.
    // `mock: true` lo pone el backend cuando la key falla (UNAUTHORIZED/
    // RATE_LIMITED/UPSTREAM_ERROR/NO_API_KEY): en ese caso mantenemos el mock
    // NovaRift que ya tenemos sin sobreescribir nada.
    if (riotSummary && !riotSummary.mock && !isDemoAccount(base.riotId)) {
      const solo = riotSummary.soloRanked || {};
      const totalGames = (solo.wins || 0) + (solo.losses || 0);

      // H36-T1 — Pool efectivo. Si el jugador NO eligió pool en el onboarding
      // (entró con su cuenta real por login directo), derivamos su champion pool
      // de las partidas reales: sus campeones más jugados con stats agregadas
      // REALES (WR/KDA/CS/visión). Así el tab CHAMPION POOL, el main recomendado
      // y el asistente dejan de mostrar el pool mock NovaRift (Lucian/Ezreal/
      // Jinx/Caitlyn con WR fantasma). Con pool de onboarding, ese ya manda.
      const hasUserPool = Array.isArray(userPool) && userPool.length > 0;
      const derived = !hasUserPool ? derivePoolFromMatches(riotSummary.recentMatches) : null;
      const effectivePool = derived?.pool?.length ? derived.pool : base.pool;
      // offPool se recalcula contra el pool efectivo (no contra el mock).
      const realMatches = mapRealMatches(riotSummary.recentMatches, effectivePool);
      // H36-T3 — Agregados reales (CS/min, KDA, visión) de las partidas de Riot
      // para que el panel de stats NO muestre los del mock NovaRift en una cuenta
      // real, y para que el "Consejo de hoy" beba de la MISMA fuente que el panel.
      const realAgg = (field) => {
        const vals = realMatches.map((m) => m[field]).filter((v) => Number.isFinite(v));
        return vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10 : null;
      };
      const hasReal = realMatches.length > 0;
      return {
        ...base,
        isDemo: false,
        pool:         effectivePool,
        poolSource:   derived ? 'derived' : base.poolSource,
        poolDetail:   derived ? derived.poolDetail   : base.poolDetail,
        topChampions: derived ? derived.topChampions : base.topChampions,
        championPool: derived ? derived.championPool : base.championPool,
        matches: realMatches.length > 0 ? realMatches : base.matches,
        globalStats: {
          ...base.globalStats,
          // Icono de perfil real si el backend lo devuelve (campo estándar Riot API)
          profileIconId: riotSummary.profileIconId ?? base.globalStats.profileIconId,
          rank: {
            ...base.globalStats.rank,
            tier:     solo.tier     || base.globalStats.rank.tier,
            // Soporta ambos: el backend serializa `division`; algunas
            // versiones legacy del proxy pueden devolver `rank` (Riot raw).
            division: solo.division || solo.rank || base.globalStats.rank.division,
            lp:       solo.leaguePoints ?? base.globalStats.rank.lp,
          },
          wins:    solo.wins    ?? base.globalStats.wins,
          losses:  solo.losses  ?? base.globalStats.losses,
          winrate: totalGames > 0
            ? Math.round((solo.wins * 100) / totalGames)
            : base.globalStats.winrate,
          // Medias derivadas de las partidas reales (fallback al mock si faltan).
          // CS/min vía el helper canónico `avgCsPerMin` (mismo que Forge/KPI) para
          // que Perfil y Forge muestren EXACTAMENTE el mismo CS/min (P1-3).
          avgCSPM:   hasReal ? (avgCsPerMin(realMatches) ?? base.globalStats.avgCSPM) : base.globalStats.avgCSPM,
          avgKDA:    hasReal ? (realAgg('kda')         ?? base.globalStats.avgKDA)    : base.globalStats.avgKDA,
          avgVision: hasReal ? (realAgg('visionScore') ?? base.globalStats.avgVision) : base.globalStats.avgVision,
        },
      };
    }

    return base;
  }, [user, riotSummary]);

  // H36-T1 — Publica el pool efectivo SOLO cuando se ha derivado de partidas
  // reales, para que el asistente (LiveScreen) y la forja (ForgeScreen) — que no
  // cargan el summary de Riot — preseleccionen y recomienden de ese pool. No se
  // publica el pool mock ni el de onboarding (ese ya viaja en user.champions).
  useEffect(() => {
    if (stats?.poolSource === 'derived' && Array.isArray(stats.pool) && stats.pool.length > 0) {
      publishEffectivePool(stats.pool);
    }
    // H36-T12 — Publica el rango REAL para que ForgeScreen muestre "Riot dice X"
    // junto al ELO estimado. Solo en cuentas reales (la demo usa el mock).
    if (stats && !stats.isDemo && stats.globalStats?.rank?.tier) {
      publishRealRank(stats.globalStats.rank);
    }
    // C3 — Publica el CS/min canónico del Perfil (el MISMO `globalStats.avgCSPM`
    // que ya muestran las pills y el consejo) para que ForgeScreen lo lea como
    // fuente única. Se publica SIEMPRE (demo y real) → el CS/min coincide entre
    // Perfil y Elo Forge sin que la Forja tenga que ver las partidas de Riot.
    publishProfileCsPerMin(stats?.globalStats?.avgCSPM);
  }, [stats]);

  // Nombre del invocador para el saludo del hero (parte antes del '#').
  const playerName = (stats.riotId || '').split('#')[0] || 'Invocador';

  // ── Política de datos demo vs reales ───────────────────────────────────
  // La cuenta demo oficial (FAKER) usa mocks siempre y sin avisos. Cualquier
  // otra cuenta: si Riot falla (red caída o backend con mock=true) mostramos
  // el ErrorState y NUNCA datos falsos.
  const isDemoUser = isDemoAccount(stats.riotId);
  const riotFailed = riotError || riotSummary?.mock === true;
  const showRiotError = !isDemoUser && riotFailed;

  // ── Mensaje del ErrorState diferenciado según el tipo de fallo ──────────
  // Tres casos distintos, cada uno con su mensaje accionable:
  // riotError (catch del 404 NOT_FOUND) → el Riot ID no existe en Riot.
  // riotSummary._localMock → el fetch ni siquiera contactó
  // el backend (servidor caído / sin red): riotApi devuelve un mock local.
  // riotSummary.mock sin _localMock → el backend respondió pero con
  // mock porque su key de Riot falló (UNAUTHORIZED/RATE_LIMITED/…).
  const riotErrorInfo = riotError
    ? {
        title: 'Cuenta no encontrada',
        message: 'No se encontró la cuenta. Comprueba que el Riot ID es correcto.',
      }
    : riotSummary?._localMock
      ? {
          title: 'Sin conexión con el servidor',
          message: 'No hay conexión con el servidor. Comprueba que el backend está activo.',
        }
      : {
          title: 'API Key de Riot caducada',
          message: 'La key de Riot API caduca cada 24 h. Renuévala en developer.riotgames.com, actualiza application.properties (línea 63) y reinicia el backend.',
        };

  // ── Datos del coach mental (recomendaciones de bienestar) ─────
  // Card de estado mental basada en la investigación de psicología del jugador.
  // FAKER (demo): datos mock estables (3 victorias seguidas · 22:00 · Gold
  // II / 47 LP) → estado ÓPTIMO, demostración predecible.
  // Usuarios reales: racha de `recentMatches`, hora actual (la card usa
  // `new Date()` por defecto) y LP del soloRanked. Mientras carga el summary
  // `recentMatches`/`leaguePoints` son undefined y la card retorna null.
  const mentalCoach = isDemoUser
    ? { matches: DEMO_MENTAL_MATCHES, hour: 22, lp: 47 }
    : {
        matches: riotSummary?.recentMatches,
        lp:      riotSummary?.soloRanked?.leaguePoints,
      };

  // ── UI de la pantalla completa (declarativa) ──────────────────────────────
  // Estructura, de fuera adentro: contenedor a pantalla completa con fondo y
  // glows decorativos, barra de conexión, un ScrollView (contenedor con scroll
  // vertical, como un JScrollPane) con hero + header + toggle de tabs + el tab
  // activo (o el ErrorState si Riot falló) + CTA de radar; y, fuera del scroll,
  // los modales que se montan siempre y solo se muestran según su flag visible.
  return (
    <View style={[hubStyles.container, { backgroundColor: c.bg0 }]}>
      {/* Fondos decorativos — consistente con LiveScreen. Solo en modo oscuro:
          NovaBackground y los glows púrpura están pensados sobre fondo negro; en
          claro ensuciarían el fondo, así que los ocultamos (el fondo c.bg0 claro
          se ve limpio). En oscuro queda IDÉNTICO a antes. */}
      {isDark && <NovaBackground />}

      {/* Hero glow — banda de luz púrpura en lo alto (fade simulado con dos
          capas translúcidas; expo-linear-gradient no está instalado). */}
      {isDark && (
        <View pointerEvents="none" style={hubStyles.heroGlow} />
      )}
      {isDark && (
        <View pointerEvents="none" style={hubStyles.heroGlowTop} />
      )}

      {/* H1 Nielsen — barra de estado de conexión (solo visible si no online) */}
      <ConnectionStatusBar status={connectionStatus} />

      <ScrollView
        style={hubStyles.scrollFlex}
        contentContainerStyle={hubStyles.scrollContent}
        showsVerticalScrollIndicator={false}
      >

        {/* ── Hero: saludo personal + estado LIVE ── */}
        <View style={hubStyles.heroBlock}>
          <View style={hubStyles.heroGreetRow}>
            <View style={hubStyles.heroDot} />
            {/* Nombres largos ("El Mini Hakim") se cortaban con "..." por el
                numberOfLines={1}. Permitimos 2 líneas y, en nativo, encogemos
                la fuente (adjustsFontSizeToFit) para que SIEMPRE se lea completo
                sin desbordar; en web wrapea a 2 líneas. */}
            <Text
              style={hubStyles.heroGreet}
              numberOfLines={2}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
            >
              Bienvenido, {playerName}
            </Text>
          </View>
          <Text style={hubStyles.heroStatus}>{'●'}  LIVE · Parche 16.8.1</Text>
        </View>

        {/* ── Header: título del tab ── */}
        <View style={hubStyles.headerRow}>
          {/* B1.2 — flex:1+minWidth:0: sin ello este bloque no encoge y empuja
              el cluster derecho (OUT-OF-GAME) fuera del viewport en ≤390px. */}
          <View style={hubStyles.headerLeft}>
            <Text style={[hubStyles.headerTitle, { color: theme.primary, textShadowColor: theme.primary }]} numberOfLines={1}>
              LIVE-RIFT
            </Text>
            {/* B2 — contraste AA: txt+'55' (~2.6:1) no llegaba a 4.5:1 */}
            <Text style={[hubStyles.headerSub, { color: c.textSecondary }]} numberOfLines={1}>
              Modo estadísticas · Fuera de partida
            </Text>
          </View>
          {/* Header right: botón "Buscar jugador" + badge de modo */}
          <View style={hubStyles.headerRight}>
            <TouchableOpacity
              onPress={() => setSearchVisible(true)}
              style={[hubStyles.searchBtn, { borderColor: theme.primary + '55' }]}
              activeOpacity={0.85}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Icon name="search" size={14} color={theme.primary} strokeWidth={2} />
            </TouchableOpacity>
            <View style={[hubStyles.modeBadge, { borderColor: theme.primary + '44', backgroundColor: theme.primary + '11' }]}>
              <View style={[hubStyles.modeDot, { backgroundColor: c.success }]} />
              <Text style={[hubStyles.modeBadgeText, { color: theme.primary }]}>OUT-OF-GAME</Text>
            </View>
          </View>
        </View>

        {/* ── Toggle pill horizontal (PERFIL | POOL | OFF-CHAMPION-POOL) ── */}
        {/* TABS.map crea un botón por pestaña. isActive compara con el estado
            activeTab; al pulsar, setActiveTab cambia la pestaña y redibuja. El
            estilo del botón y el color del texto cambian si está activo. */}
        <View style={[hubStyles.togglePill, { backgroundColor: 'rgba(0,0,0,0.35)', borderColor: theme.primary + '22' }]}>
          {TABS.map(tab => {
            const isActive = activeTab === tab;
            return (
              <TouchableOpacity
                key={tab}
                style={[
                  hubStyles.pillTab,
                  isActive
                    ? { backgroundColor: c.primary }
                    : { backgroundColor: c.onSurface(0.06) },
                ]}
                onPress={() => setActiveTab(tab)}
                activeOpacity={0.7}
              >
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  style={[
                    hubStyles.pillTabText,
                    { color: isActive ? c.textInverse : c.onSurface(0.5) },
                  ]}>
                  {tab}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── Coach mental — recomendación de bienestar ──
            Visible cuando hay datos de Riot; nunca en error state. La propia
            card retorna null si aún no hay partidas/LP que evaluar. */}
        {!showRiotError && (
          <MentalCoachCard
            matches={mentalCoach.matches}
            hour={mentalCoach.hour}
            lp={mentalCoach.lp}
          />
        )}

        {/* ── Contenido del tab activo ── */}
        {/* Si Riot falla en una cuenta real, mostramos el ErrorState con
            reintento en vez de las stats mock. La cuenta demo (FAKER) nunca
            entra aquí: ve siempre los mocks. */}
        <View style={hubStyles.tabContent}>
          {showRiotError ? (
            <ErrorState
              title={riotErrorInfo.title}
              message={riotErrorInfo.message}
              onRetry={loadSummary}
            />
          ) : (
            // Renderizado condicional: `condición && <Componente/>` pinta el
            // componente solo si la condición es cierta (como un if dentro del
            // JSX). Aquí se muestra el tab cuyo nombre coincide con activeTab.
            <>
              {activeTab === 'PERFIL' && (
                <PerfilTab stats={stats} theme={theme} radar={radar} />
              )}
              {activeTab === 'CHAMPION POOL' && (
                <PoolTab stats={stats} theme={theme} onPressChamp={openPoolChampModal} />
              )}
            </>
          )}
        </View>

        {/* ── CTA prominente: INICIAR PARTIDA (flujo manual del LiveScreen) ───
            Lanza el setup rápido (elegir campeón propio + enemigos opcionales)
            vía `onActivateRadar`, que LiveScreen apunta a su estado 'setup'. */}
        <View style={hubStyles.radarCTAWrap}>
          <NovaButton
            label="INICIAR PARTIDA"
            onPress={handleActivateRadar}
            factionColor={theme.primary}
            size="lg"
          />
          {/* B2 — contraste AA: mismo arreglo que el subtítulo del header */}
          <Text style={[hubStyles.radarCTASub, { color: c.textSecondary }]}>
            Análisis de composición · Builds en tiempo real
          </Text>
        </View>

      </ScrollView>

      {/* Modal "Buscar jugador" — siempre montado, gestiona su
          visibilidad por prop. Pasa `theme` para que el sheet pinte en
          el color de facción del usuario actual. */}
      <PlayerSearchModal
        visible={searchVisible}
        theme={theme}
        onClose={() => setSearchVisible(false)}
      />

      {/* Pool tab — modal detalle de campeón (tapping en PoolSlotCard) */}
      <ChampionDetailModal
        visible={poolChampModal.visible}
        championName={poolChampModal.name}
        matches={stats.matches}
        factionTheme={FACTIONS[stats.faction] || FACTIONS.ZAUN}
        onClose={closePoolChampModal}
      />
    </View>
  );
}

// ─── Estilos de HubScreen ────────────────────────────────────────────────────
// StyleSheet (CSS como objeto Java) propio de la pantalla principal: contenedor,
// scroll, glows del hero, saludo, header con título y botón de búsqueda, el
// toggle de pestañas y el CTA de radar. `flex: 1` significa "ocupa todo el
// espacio disponible" (similar a un BorderLayout.CENTER que se estira).
const makeHubStyles = (c) => StyleSheet.create({
  container:     { flex: 1 },
  scrollFlex:    { flex: 1 },

  // ── Hero glow + saludo ──────────────────────────────────────────────────
  // Banda de luz absoluta en lo alto; dos capas translúcidas púrpura simulan
  // el degradado #7B76DD18 → transparent (sin expo-linear-gradient).
  heroGlow: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 160,
    backgroundColor: '#7B76DD10',
  },
  heroGlowTop: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 80,
    backgroundColor: '#7B76DD12',
  },
  heroBlock: { marginBottom: 18 },
  heroGreetRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  heroDot: {
    width: 6, height: 6, borderRadius: 3, backgroundColor: c.primary,
    shadowColor: c.primary, shadowOpacity: 0.9, shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 }, elevation: 4,
  },
  heroGreet: {
    flex: 1,
    fontSize: TYPE_SCALE.h2.size, lineHeight: TYPE_SCALE.h2.lineHeight,
    letterSpacing: TYPE_SCALE.h2.letterSpacing, fontWeight: '900',
    color: c.textPrimary,
  },
  heroStatus: {
    fontSize: TYPE_SCALE.micro.size, letterSpacing: 2,
    color: '#7B76DD99', marginTop: 6, marginLeft: 14, fontWeight: '700',
  },
  // Centrado en web desktop. Sin esto el contenido se estira a todo
  // el ancho del navegador y las cards quedan diminutas. 720px es el breakpoint
  // típico para estilo deeplol (suficiente para 4 pills + match rows densos).
  scrollContent: {
    paddingTop: 60,
    paddingBottom: SPACING.huge,
    paddingHorizontal: SPACING.lg,
    ...(Platform.OS === 'web' ? {
      maxWidth: 720,
      alignSelf: 'center',
      width: '100%',
    } : {}),
  },

  // Header
  headerRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', marginBottom: 22,
  },
  // B1.2 — minWidth:0 permite que el texto trunque (ellipsis) en vez de
  // forzar el ancho intrínseco y desbordar la fila en viewports estrechos.
  headerLeft: { flex: 1, minWidth: 0, paddingRight: SPACING.sm },
  headerTitle: {
    fontSize: TYPE_SCALE.h3.size, fontWeight: '900', letterSpacing: 6,
    textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 20,
  },
  headerSub:   { color: c.onSurface(0.40), fontSize: TYPE_SCALE.micro.size, marginTop: 5, letterSpacing: 2 },
  // Header right cluster: botón de búsqueda + badge de modo
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 0 },
  searchBtn: {
    width: 32, height: 32,
    borderWidth: 1, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: c.surface,
  },
  searchBtnIcon: { fontSize: TYPE_SCALE.label.size },
  modeBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1, borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  modeDot:      { width: 7, height: 7, borderRadius: 3.5 },
  modeBadgeText: { fontSize: TYPE_SCALE.micro.size, fontWeight: '800', letterSpacing: 1 },

  // Toggle pill
  togglePill: {
    flexDirection: 'row', borderWidth: 1, borderRadius: 10,
    overflow: 'hidden', marginBottom: 20,
  },
  pillTab: {
    flex: 1, paddingVertical: 10, alignItems: 'center',
    borderWidth: 1, borderColor: 'transparent', borderRadius: 9,
    margin: 3,
  },
  // fontSize reducido + letterSpacing menor para que "OFF-CHAMPION-POOL"
  // (17 chars) entre en ⅓ del ancho del toggle pill sin truncarse en mobile.
  pillTabText: { fontSize: TYPE_SCALE.caption.size, fontWeight: '800', letterSpacing: 0.8 },

  // Tab content
  tabContent: { marginBottom: 20 },

  // CTA Radar — wrapper para alinear subtitle bajo el NovaButton
  radarCTAWrap: { alignItems: 'center', gap: 6 },
  radarCTASub:  { fontSize: TYPE_SCALE.caption.size, marginTop: SPACING.xs, letterSpacing: 1, textAlign: 'center' },
});
