// ============================================================================
// ForgeScreen — Bento Grid + Trends
// ----------------------------------------------------------------------------
// Cambios sobre la versión anterior:
// [CRIT] Bento Grid 2026 — celda grande CS/min, secundarias Vision/KDA/KP.
// [CRIT] Eliminados inputs manuales tipo Excel — ahora barras animadas + valor grande.
// [CRIT] Auto-load on mount + skeleton state — sin botón "CARGAR MÉTRICAS" agresivo.
// [MED] Selector de rango con contraste claro y pills tipo navbar.
// [MED] Cards de retos con progress bar animada y borde solo en activo/hover.
// [MED] Sin borde verde por defecto en cards de info — verde solo en estados activos.
// [PLUS] Aurora background + animated tactical background reutilizados.
// ============================================================================
// ── Imports de React / React Native ─────────────────────────────────────────
// React aporta los "hooks" (useState, useEffect…) que dan estado y ciclo de
// vida a un componente-función. El segundo bloque son los componentes base del
// framework: View (contenedor tipo JPanel), Text (texto), ScrollView (scroll
// como JScrollPane), TouchableOpacity/Pressable (botones táctiles), TextInput
// (campo de texto), Animated/Easing (animaciones), Platform (detectar web vs
// móvil), ActivityIndicator (spinner de carga) y StyleSheet (estilos).
import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
// ── Almacenamiento persistente ──────────────────────────────────────────────
// AsyncStorage = clave-valor en disco del dispositivo (como Preferences/un
// pequeño key-value store). Se usa para recordar config de LP e historial.
import AsyncStorage from '@react-native-async-storage/async-storage';
// ── Config de red / API ─────────────────────────────────────────────────────
// URL base del backend y textos de error reutilizables (sin red, servicio caído).
import {
  API_BASE_URL,
  getServiceUnavailableMessage,
} from '../config/apiConfig';
// ── Contextos (estado global compartido) ────────────────────────────────────
// useContext/RiotContext y useUser leen un contexto/estado global compartido
// (como inyección de dependencias / un singleton accesible): riotId, tema, user.
import { RiotContext } from '../context/RiotContext';
import { useUser } from '../context/UserContext';
import { isDemoAccount } from '../config/demoConfig';
// ── Tema (colores y escalas tipográficas) ───────────────────────────────────
import { COLORS, TYPE_SCALE, SPACING, TIER_COLORS } from '../theme';
import { useTheme } from '../context/ThemeContext';
// FACTIONS solo para resolver el alias `identity` (sin nombres visibles)
import { FACTIONS } from '../theme/theme';
// ── Componentes propios y SVG ───────────────────────────────────────────────
// Svg/Path dibujan vectores (arcos del medidor de ELO). El resto son piezas de
// UI reutilizables de la app: fondos animados, estado de error, anillos de
// progreso, iconos, salas de trofeos, radar, etc.
import Svg, { Path } from 'react-native-svg';
import AnimatedTacticalBackground from '../components/AnimatedTacticalBackground';
import NovaBackground from '../components/NovaBackground';
import ErrorState from '../components/feedback/ErrorState';
// B4.3 — estado vacío honesto ("Juega N partidas…") para cuentas sin datos.
import EmptyState from '../components/feedback/EmptyState';
import CircularProgressRing from '../components/CircularProgressRing';
import Icon from '../components/Icon';
import { Image } from 'react-native';
// ── Mocks / utils / lógica de dominio ───────────────────────────────────────
// Datos simulados (championHistory, novaStats) y funciones de cálculo: campeón
// principal, foco prioritario, acciones de mejora, benchmarks por división,
// alertas de KPI y generación de retos. Sustituibles por backend real.
import {
  calculateMainChampion,
  calculatePriorityFocus,
  generateClimbActions,
  topChampions,
  historyForPool,
} from '../mocks/championHistory';
import { NOVA_MATCHES, NOVA_GLOBAL_STATS, remapNovaToPool, avgCsPerMin, readProfileCsPerMin } from '../mocks/novaStats';
// Pool efectivo derivado de las partidas reales (lo publica el Hub). Sirve de
// fallback cuando la cuenta entró sin onboarding, para que "TU MAIN RECOMENDADO"
// salga de los campeones que el jugador juega de verdad.
import { readEffectivePool, readRealRank } from '../utils/effectivePool';
// Fallback adicional: si el Hub aún no publicó el pool efectivo (p.ej. se abre
// la Forja antes de pasar por el Hub), lo derivamos aquí mismo de las partidas
// reales del usuario para no caer nunca al mock ADC (Lucian) en cuentas reales.
import { derivePoolFromMatches } from '../utils/derivePoolFromMatches';
import { getChampionImageUrl } from '../utils/dataDragon';
import { CHAMPION_TO_ROLE } from '../utils/championImage';
// pool 2+2 — desbloqueo por progresión y modelo de datos del pool.
// applyUnlocks: marca locked:false los slots cuyo umbral de partidas se alcanzó.
// describeLockedProgress: estado de las barras "X/N partidas para desbloquear".
// resolveGamesPlayed: nº de partidas con Nova Rift tolerando varios shapes.
import {
  applyUnlocks,
  describeLockedProgress,
  resolveGamesPlayed,
  slotIndexOf,
  isEntryLocked,
  SLOT_UNLOCK_GAMES,
  ACTIVE_SLOTS,
} from '../utils/championPool';
import TrophyCabinet from '../components/TrophyCabinet';
// Vitrina de logros (H36-T11): los mismos trofeos de la SALA DE TROFEOS.
import { computeAllTrophies } from '../utils/trophies';
import { ALL_TROPHIES } from '../data/trophies';
// Medallón estándar de trofeos (color por tier) — el mismo del modal de campeón.
import TrophyBadge from '../components/TrophyBadge';
import FactionRadarChart from '../components/FactionRadarChart';
import { computeRadarStats } from '../utils/computeRadarStats';
import { benchmarkForTier, benchmarkForRoleAndTier, topGap } from '../utils/divisionBenchmarks';
import { buildKpiCards, getHardstuckDiagnosis } from '../utils/kpiAlerts';
import { generateChallenges as generateRichChallenges } from '../utils/generateChallenges';
import TierPicker from '../components/TierPicker';
// explicabilidad de IA: el enlace "¿Cómo se calcula?" abre este modal
// con la lógica detrás del ELO estimado.
import AIInsightTooltip from '../components/ai/AIInsightTooltip';

// ── Constantes de módulo ────────────────────────────────────────────────────
// Constantes vivas a nivel de fichero (equivalentes a `static final` en Java):
// se definen una vez al cargar el módulo y se reutilizan en todo el componente.

// Fallback de campeones para los thumbnails del historial cuando la cuenta no
// tiene champion pool guardado. El render usa el pool real del usuario si existe
// (historyChamps) y solo recurre a esta lista como último recurso.
const HISTORY_CHAMPS = ['Lucian', 'Jinx', 'Ezreal', 'Lucian', 'Lucian'];

// Tier del medallón (TrophyBadge) por trofeo de la VITRINA DE LOGROS. Escalera
// bronce → master según prestigio/dificultad, para que el estándar de trofeos
// (color por tier) sea visible también en la Forge, no solo en el modal.
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

// ─── Targets por división ───────────────────────────────────────────────────
// Objetivos de métricas (CS/min, visión, KP%, KDA) que se consideran "buenos"
// en cada rango. Es el listón contra el que se mide el progreso del jugador.
const RANK_TARGETS = {
  Hierro:    { csMin: 4.0, visionScore: 10, killParticipation: 45, kda: 1.5 },
  Bronce:    { csMin: 5.0, visionScore: 15, killParticipation: 50, kda: 2.0 },
  Plata:     { csMin: 6.0, visionScore: 20, killParticipation: 55, kda: 2.5 },
  Oro:       { csMin: 7.0, visionScore: 25, killParticipation: 60, kda: 3.0 },
  Platino:   { csMin: 7.5, visionScore: 30, killParticipation: 65, kda: 3.5 },
  Esmeralda: { csMin: 8.0, visionScore: 35, killParticipation: 70, kda: 4.0 },
  Diamante:  { csMin: 9.0, visionScore: 40, killParticipation: 75, kda: 5.0 },
};

// Mapping nombre ES → nombre Data Dragon (Emblem_Gold.png, Emblem_Iron.png …)
const TIER_EMBLEM_SLUG = {
  Hierro:    'Iron',
  Bronce:    'Bronze',
  Plata:     'Silver',
  Oro:       'Gold',
  Platino:   'Platinum',
  Esmeralda: 'Emerald',
  Diamante:  'Diamond',
};

// Colores canónicos LoL por rango (audit v2 IMP 5)
const RANK_COLORS = {
  Hierro:    '#8a8a9a',
  Bronce:    '#cd7f32',
  Plata:     '#c0c0c0',
  Oro:       '#ffd700',
  Platino:   COLORS.primary,
  Esmeralda: COLORS.primary,
  Diamante:  '#5599ff',
};

// Valores demo de arranque (jugador NovaRift). Evitan que el Bento aparezca
// "todo a 0" antes de cargar. Si el fetch al backend tiene éxito,
// `setCurrentStats(...)` los sobreescribe con datos reales. Si falla: la
// cuenta demo (FAKER) se queda con estos valores; las cuentas reales ven el
// ErrorState (ver `showForgeError`) en lugar de stats falsas.
const DEFAULT_STATS = {
  csMin:             NOVA_GLOBAL_STATS.avgCSPM     ?? 0,
  visionScore:       NOVA_GLOBAL_STATS.avgVision   ?? 0,
  killParticipation: NOVA_GLOBAL_STATS.avgKP       ?? 0,
  kda:               NOVA_GLOBAL_STATS.avgKDA      ?? 0,
};

// ─── Helpers de cálculo ELO/progreso y datos pro: ver comentarios por bloque ──

// ─── Métrica prioritaria por facción ────────────────────────────
// La métrica destacada del bento (la celda grande, fila completa) varía por
// facción. Cada entrada apunta a una key de `currentStats` y aporta su propio
// label/icon/sufijo/tip para que el resto del Bento siga reusando MetricCell.
//
// Mapping (alineado con FACTION_HERO_METRIC del HubScreen):
// DEMACIA / IONIA → CS/min (control, escalado, fundamentales)
// NOXUS → KDA (agresividad, eficiencia en peleas)
// ZAUN → KP% (caos coordinado, presencia en mapa)
const PRIORITY_METRIC = {
  DEMACIA: { key: 'csMin',             label: 'CS POR MINUTO — MÉTRICA PRIORITARIA', icon: 'coin',   suffix: '',  targetKey: 'csMin',             tip: 'Practica last-hit en modo entrenamiento 15 min al día.' },
  IONIA:   { key: 'csMin',             label: 'CS POR MINUTO — MÉTRICA PRIORITARIA', icon: 'coin',   suffix: '',  targetKey: 'csMin',             tip: 'Control de onda > kills tempranas. Mantén tu wave cerca de torre.' },
  NOXUS:   { key: 'kda',               label: 'KDA — MÉTRICA PRIORITARIA',           icon: 'kda',    suffix: '',  targetKey: 'kda',               tip: 'Cada muerte cuesta. Prioriza intercambios ganados, no kills forzadas.' },
  ZAUN:    { key: 'killParticipation', label: 'KILL PART. — MÉTRICA PRIORITARIA',    icon: 'swords', suffix: '%', targetKey: 'killParticipation', tip: 'Rota a tus laners cuando empujes. 60%+ marca la diferencia.' },
};
const FALLBACK_PRIORITY_METRIC = PRIORITY_METRIC.DEMACIA;

// ─── Helpers de módulo ──────────────────────────────────────────────────────
// Funciones puras a nivel de fichero (como métodos estáticos de utilidad):
// no dependen del estado del componente, solo de sus argumentos.

// extractFirstNumber: saca el primer número de un valor que puede venir como
// número o como string ("7.2 CS/min" → 7.2). Devuelve null si no hay número.
const extractFirstNumber = (rawValue) => {
  if (typeof rawValue === 'number') return rawValue;
  if (typeof rawValue !== 'string') return null;
  const match = rawValue.match(/[\d.]+/);
  if (!match) return null;
  const parsed = Number.parseFloat(match[0]);
  return Number.isNaN(parsed) ? null : parsed;
};

// messageForStatus: traduce un código HTTP a un mensaje de error en español
// (400 = petición inválida, 404 = sin datos, 429 = rate limit, etc.). Si el
// backend ya manda un mensaje propio, ese gana.
const messageForStatus = (statusCode, backendError) => {
  if (backendError) return backendError;
  if (statusCode === 400) return 'Solicitud inválida. Revisa el Riot ID.';
  if (statusCode === 404) return 'No se encontró la cuenta. Comprueba que el Riot ID es correcto.';
  if (statusCode === 429) return 'Demasiadas solicitudes. Espera unos segundos.';
  if (statusCode === 502) return 'Error de conexión con Riot API. Verifica tu API Key.';
  if (statusCode === 503) return getServiceUnavailableMessage();
  return `Error inesperado del servidor (${statusCode}).`;
};

// progressColor: semáforo del progreso → verde si ≥90% del objetivo,
// ámbar si ≥70%, rojo en otro caso. Pinta barras y porcentajes.
const progressColor = (ratio) => {
  if (ratio >= 0.9) return COLORS.primary;
  if (ratio >= 0.7) return '#E9A93B';
  return '#E3342F';
};

// clampProgress: ratio actual/objetivo recortado al rango [0, 1] (nunca pasa
// del 100% ni baja de 0). Si no hay objetivo o el valor es NaN, devuelve 0.
const clampProgress = (current, target) => {
  if (!target || Number.isNaN(current)) return 0;
  return Math.max(0, Math.min(current / target, 1));
};

// generateChallenges: fallback local de retos. Compara las stats actuales con
// el target del rango y propone hasta 3 retos sobre las métricas más flojas;
// rellena con "Disciplina Macro" si faltan. (El sistema rico lo sustituye.)
const generateChallenges = (rank, currentStats) => {
  const target = RANK_TARGETS[rank];
  const challenges = [];

  if (currentStats.csMin < target.csMin) {
    challenges.push({
      icon: 'coin', title: 'Maestro del Farmeo',
      description: `Consigue ${target.csMin.toFixed(1)} CS/min en tu próxima partida`,
      progress: currentStats.csMin / target.csMin,
      tip: 'Enfócate solo en last-hits los primeros 10 minutos.',
    });
  }
  if (currentStats.visionScore < target.visionScore) {
    challenges.push({
      icon: 'eye', title: 'Control de Mapa',
      description: `Alcanza ${target.visionScore} de Vision Score`,
      progress: currentStats.visionScore / target.visionScore,
      tip: 'Coloca ward en río al minuto 1:30.',
    });
  }
  if (currentStats.killParticipation < target.killParticipation) {
    challenges.push({
      icon: 'swords', title: 'Kill Participation',
      description: `Sube tu KP al ${target.killParticipation}%`,
      progress: currentStats.killParticipation / target.killParticipation,
      tip: 'Rota al mid cuando empujes tu línea.',
    });
  }
  if (challenges.length < 3 && currentStats.kda < target.kda) {
    challenges.push({
      icon: 'kda', title: 'KDA Sostenido',
      description: `KDA ${target.kda.toFixed(1)} o superior`,
      progress: currentStats.kda / target.kda,
      tip: 'Evita picks sin visión.',
    });
  }
  while (challenges.length < 3) {
    challenges.push({
      icon: 'brain', title: 'Disciplina Macro',
      description: `Aplica objetivos de ${rank} en 2 partidas`,
      progress: 0.5,
      tip: 'Juega por oleadas y objetivos neutrales.',
    });
  }
  return challenges.slice(0, 3);
};

// ─── ELO Estimator helpers ────────────────────────────────────────────────
// Convierten rango/división/LP en un número de ELO y estiman partidas para
// ascender. TIER_BASE_ELO y DIV_OFFSET son las tablas de equivalencia base.
const TIER_BASE_ELO = {
  IRON: 0, BRONZE: 400, SILVER: 800, GOLD: 1200,
  PLATINUM: 1600, EMERALD: 2000, DIAMOND: 2400,
  MASTER: 2800, GRANDMASTER: 3200, CHALLENGER: 3600,
};
const DIV_OFFSET = { IV: 0, III: 100, II: 200, I: 300 };

// computeElo: ELO numérico = base del tier + offset de la división + LP.
// Ej.: GOLD II con 50 LP → 1200 + 200 + 50.
function computeElo(tier, division, lp) {
  const base  = TIER_BASE_ELO[(tier || '').toUpperCase()] ?? 0;
  const div   = DIV_OFFSET[division] ?? 0;
  const frac  = ((lp || 0) / 100) * 100;
  return Math.round(base + div + frac);
}

// Games to next division given WR (0–1), lpWin, lpLoss, currentLP
function gamesToPromote(currentLP, lpWin, lpLoss, wr = 0.52) {
  const lpNeeded = 100 - currentLP;
  const avgLpPerGame = wr * lpWin - (1 - wr) * lpLoss;
  if (avgLpPerGame <= 0) return null; // impossible if losing more than gaining
  return Math.ceil(lpNeeded / avgLpPerGame);
}

// ─── Main Champion Card ────────────────────────────────────────────────────
// Sub-componente: tarjeta "TU MAIN RECOMENDADO". `{ theme }` son las props
// (parámetros que recibe el componente, equivalentes a los del constructor).
// Calcula el campeón principal del mock y muestra su winrate, partidas y KDA.
// El return (...) con JSX describe la UI de forma declarativa (como construir
// el árbol de Swing pero describiendo el QUÉ, no el CÓMO).
function MainChampionCard({ theme, mainChamp }) {
  const { colors: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const main = mainChamp || calculateMainChampion();
  const winPct = Math.round(main.winRate * 100);
  return (
    <View style={[styles.bentoCell, styles.mainChampCard, {
      borderColor: '#FFB30066',
      backgroundColor: 'rgba(255,179,0,0.06)',
    }]}>
      <View style={styles.cellLabelRow}>
        <Icon name="crown" size={14} color={c.warning} />
        <Text style={[styles.cellLabel, { color: c.warning }]}>TU MAIN RECOMENDADO</Text>
      </View>
      <View style={styles.mainChampBody}>
        <View style={styles.mainChampPortrait}>
          <Image
            source={{ uri: getChampionImageUrl(main.championName) }}
            style={[styles.mainChampImg, { borderColor: c.warning }]}
          />
          <Text style={[styles.mainChampName, { color: theme.text }]}>{main.championName}</Text>
          <Text style={styles.mainChampRole}>{main.role}{main.role === 'ADC' ? ' · Bot Lane' : ''}</Text>
        </View>
        <View style={styles.mainChampStats}>
          <View style={styles.mainStatRow}>
            <Text style={styles.mainStatLabel}>Winrate</Text>
            <Text style={[styles.mainStatValue, { color: winPct >= 60 ? c.primary : winPct >= 50 ? '#E9A93B' : '#E3342F' }]}>
              {winPct}%
            </Text>
          </View>
          <View style={styles.mainStatRow}>
            <Text style={styles.mainStatLabel}>Partidas</Text>
            <Text style={[styles.mainStatValue, { color: theme.text }]}>{main.games}</Text>
          </View>
          <View style={styles.mainStatRow}>
            <Text style={styles.mainStatLabel}>KDA medio</Text>
            <Text style={[styles.mainStatValue, { color: theme.text }]}>{main.avgKda.toFixed(1)}</Text>
          </View>
          <View style={styles.mainStatRow}>
            <Text style={styles.mainStatLabel}>CS/min</Text>
            <Text style={[styles.mainStatValue, { color: theme.text }]}>{main.avgCs.toFixed(1)}</Text>
          </View>
        </View>
      </View>
      <View style={[styles.tipBox, { borderLeftColor: c.warning, backgroundColor: '#FFB30011' }]}>
        <View style={styles.tipIconWrap}>
          <Icon name="bolt" size={13} color={c.warning} />
        </View>
        <Text style={[styles.tipText, { color: '#FFB300DD' }]}>
          Sigue especializándote en {main.championName}. Con 3 partidas más alcanzarás
          la consistencia para subir de división.
        </Text>
      </View>
    </View>
  );
}

// ─── Climb Roadmap Panel ───────────────────────────────────────────────────
// Sub-componente "CÓMO SUBIR A X": muestra el foco prioritario (la métrica con
// mayor brecha) y 3 acciones concretas para mejorarla. Recibe stats actuales,
// benchmark objetivo, nombre del rango destino y el main champion como props.
function ClimbRoadmapCard({ theme, currentStats, targetBenchmark, targetRankName, mainChamp }) {
  const { colors: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  // useMemo: valor calculado que se cachea y solo se recalcula si cambian sus
  // dependencias (como un campo lazy en Java). `focus` recalcula la métrica
  // prioritaria solo si cambian las stats o el benchmark.
  const focus = useMemo(
    () => calculatePriorityFocus(currentStats, targetBenchmark),
    [currentStats, targetBenchmark]
  );
  // useMemo: las 3 acciones derivadas del foco se cachean hasta que cambie el
  // foco o el campeón principal.
  const actions = useMemo(
    () => generateClimbActions(focus, mainChamp),
    [focus, mainChamp]
  );
  const gapPctRounded = Math.max(0, Math.round(focus.gapPct * 100));

  return (
    <View style={[styles.bentoCell, { borderColor: theme.primary + '33', marginTop: 0 }]}>
      <View style={styles.cellLabelRow}>
        <Icon name="target" size={14} color={theme.primary} />
        <Text style={[styles.cellLabel, { color: theme.primary }]}>
          CÓMO SUBIR A {targetRankName.toUpperCase()}
        </Text>
      </View>

      {/* Foco prioritario */}
      <View style={[styles.focusBlock, { borderColor: theme.primary + '44' }]}>
        <Text style={styles.focusTag}>FOCO PRIORITARIO</Text>
        <Text style={[styles.focusMetric, { color: theme.primary }]}>{focus.label}</Text>
        <View style={styles.focusGapRow}>
          <Text style={[styles.focusGapText, { color: theme.text + 'CC' }]}>
            Tú: {focus.currentValue.toFixed(1)} · Objetivo: {focus.targetValue.toFixed(1)}
          </Text>
          {gapPctRounded > 0 && (
            <View style={styles.gapBadge}>
              <Text style={styles.gapBadgeText}>−{gapPctRounded}%</Text>
            </View>
          )}
        </View>
      </View>

      {/* 3 acciones específicas */}
      {actions.map((a, i) => (
        <View key={i} style={styles.actionRow}>
          <View style={[styles.actionNum, { backgroundColor: theme.primary + '22', borderColor: theme.primary }]}>
            <Text style={[styles.actionNumText, { color: theme.primary }]}>{i + 1}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.actionTitle, { color: theme.text }]}>{a.title}</Text>
            <Text style={[styles.actionBody, { color: theme.text + '99' }]}>{a.body}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

// ─── ForgeRadarBlock ────────────────────
// Radar comparativo interactivo con:
// Selector de división (Iron → Challenger) para cambiar el benchmark
// Selector de rol (ADC/MID/JGL/TOP/SUP) para elegir el pool de pros
// Chips toggle de jugadores pro reales (2-3 por rol, activables en paralelo)
// Cada pro activo añade su polígono superpuesto con color propio
//
// Ejes: WINRATE · CS/MIN · ORO · DAÑO · VISIÓN (0-100 por eje del radar).
// PRO_DATABASE: tabla de jugadores profesionales por rol con sus stats y color.
// Datos estáticos de referencia para comparar (perfiles aproximados de pros).
const PRO_DATABASE = {
  ADC: [
    { name: 'Ruler',    team: 'JDG',     stats: [56, 94, 92, 90, 72], color: '#E74C3C' },
    { name: 'Uzi',      team: 'RNG',     stats: [54, 88, 92, 95, 70], color: '#F39C12' },
    { name: 'Rekkles',  team: 'Karmine', stats: [57, 96, 89, 82, 76], color: COLORS.primary },
  ],
  MID: [
    { name: 'Faker',    team: 'T1',      stats: [58, 89, 90, 91, 82], color: '#9B59B6' },
    { name: 'Caps',     team: 'G2',      stats: [55, 85, 89, 93, 78], color: '#3498DB' },
    { name: 'Chovy',    team: 'GEN.G',   stats: [57, 95, 92, 89, 80], color: COLORS.primary },
  ],
  JGL: [
    { name: 'Peanut',   team: 'KT',      stats: [55, 82, 83, 84, 90], color: '#E67E22' },
    { name: 'Clid',     team: 'KT',      stats: [53, 79, 84, 88, 88], color: '#E74C3C' },
    { name: 'Inspired', team: 'EG',      stats: [52, 80, 83, 86, 86], color: COLORS.primary },
  ],
  TOP: [
    { name: 'Zeus',     team: 'T1',      stats: [56, 90, 89, 87, 74], color: '#E74C3C' },
    { name: 'Bin',      team: 'BLG',     stats: [55, 88, 89, 90, 72], color: '#F39C12' },
    { name: 'Odoamne',  team: 'NRG',     stats: [54, 86, 84, 82, 80], color: '#3498DB' },
  ],
  SUP: [
    { name: 'Keria',    team: 'T1',      stats: [57, 82, 80, 78, 95], color: '#9B59B6' },
    { name: 'BeryL',    team: 'DRX',     stats: [56, 80, 78, 76, 93], color: COLORS.primary },
    { name: 'CoreJJ',   team: 'TL',      stats: [58, 79, 77, 74, 96], color: '#F39C12' },
  ],
};

// Lista ordenada de divisiones para el selector de benchmark.
const TIERS = ['IRON', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'EMERALD', 'DIAMOND', 'MASTER', 'CHALLENGER'];

// Sub-componente del radar comparativo interactivo. Recibe el tema y las
// partidas del usuario; calcula sus stats de radar y permite cambiar división,
// rol y superponer polígonos de pros seleccionados.
function ForgeRadarBlock({ theme, matches }) {
  const { colors: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const kpiStyles = useMemo(() => makeKpiStyles(c), [c]);
  const userStats = computeRadarStats(matches);
  const defaultTier = String(NOVA_GLOBAL_STATS?.rank?.tier || 'GOLD').toUpperCase();

  // useState: variable de instancia que, al cambiar, redibuja la pantalla (como
  // un campo Java con notifyObservers). Cada par [valor, setValor] guarda la
  // división elegida, el rol del usuario y la lista de pros activos.
  const [selectedTier, setSelectedTier] = useState(defaultTier);
  const [userRole, setUserRole]         = useState('ADC');
  const [activePros, setActivePros]     = useState([]);

  // Valores derivados del estado (se recalculan en cada render): benchmark de la
  // división, eje con mayor brecha y el nombre del tier ya formateado.
  const benchmark = benchmarkForTier(selectedTier);
  const gap       = topGap(userStats, selectedTier);
  const tierFmt   = selectedTier.charAt(0) + selectedTier.slice(1).toLowerCase();

  // togglePro: añade/quita un pro de la lista de activos (toggle de selección).
  const togglePro = (name) => {
    setActivePros(prev =>
      prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
    );
  };

  // Pros del rol activo y polígonos extra (uno por pro seleccionado) que el
  // radar dibuja superpuestos al del usuario.
  const allPros = PRO_DATABASE[userRole] || [];
  const extraPolygons = allPros
    .filter(p => activePros.includes(p.name))
    .map(p => ({ stats: p.stats, color: p.color, label: `${p.name} · ${p.team}` }));

  // ── KPI cards reales por rol+rango ────────────────────────────────────────
  // Usamos los KPIs absolutos de NOVA_GLOBAL_STATS directamente (no la
  // proyección 0..100 del radar). Cuando haya backend real, esto vendrá del
  // último resumen del jugador.
  const realKpiStats = {
    // C3 — CS/min de la FUENTE ÚNICA: el valor canónico que el Perfil (Hub)
    // publicó (readProfileCsPerMin). Solo si aún no se publicó (p.ej. se abrió la
    // Forja sin pasar por el Perfil) caemos al promedio local con el mismo helper
    // (avgCsPerMin). Garantiza que el CS/min coincide con la pantalla de Perfil.
    csMin:             readProfileCsPerMin() ?? avgCsPerMin(matches, NOVA_GLOBAL_STATS?.avgCSPM ?? 0),
    kda:               NOVA_GLOBAL_STATS?.avgKDA    ?? 0,
    visionScore:       NOVA_GLOBAL_STATS?.avgVision ?? 0,
    killParticipation: NOVA_GLOBAL_STATS?.avgKP     ?? 0,
    winrate:           NOVA_GLOBAL_STATS?.winrate   ?? 50,
  };
  const kpiCards = buildKpiCards(realKpiStats, userRole, selectedTier);
  const diagnosis = getHardstuckDiagnosis(realKpiStats, userRole, selectedTier);

  // UI declarativa del bloque radar, de arriba a abajo: tarjetas KPI +
  // diagnóstico, selector de rol (scroll horizontal), selector de división con
  // emblemas, el radar en sí, los chips para comparar con pros y un hint final.
  return (
    <View style={{ marginBottom: 14 }}>
      {/* ── KPI vs benchmark de rol+rango ─────────────────────────────── */}
      <View style={kpiStyles.block}>
        <Text style={kpiStyles.blockLabel}>
          MÉTRICAS · {userRole} · {tierFmt}
        </Text>
        <View style={kpiStyles.row}>
          {kpiCards.map(card => <KpiCard key={card.key} card={card} />)}
        </View>
        {diagnosis?.label && (
          <View
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
            style={[
              kpiStyles.diagnosis,
              {
                borderColor:     diagnosisColor(diagnosis) + '55',
                backgroundColor: diagnosisColor(diagnosis) + '12',
              },
            ]}
          >
            <Text style={[kpiStyles.diagnosisText, { color: diagnosisColor(diagnosis) }]}>
              {diagnosis.label}
            </Text>
          </View>
        )}
      </View>

      {/* ── Selector de rol ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginBottom: 8 }}
        contentContainerStyle={{ gap: 6, paddingHorizontal: 4 }}
      >
        {Object.keys(PRO_DATABASE).map(rol => (
          <TouchableOpacity
            key={rol}
            onPress={() => { setUserRole(rol); setActivePros([]); }}
            style={{
              paddingHorizontal: 12, paddingVertical: 5, borderRadius: 4,
              backgroundColor: userRole === rol ? theme.primary : c.onSurface(0.06),
              borderWidth: 1,
              borderColor: userRole === rol ? theme.primary : c.onSurface(0.12),
            }}
          >
            <Text style={{
              color: userRole === rol ? '#000' : c.onSurface(0.55),
              fontSize: TYPE_SCALE.micro.size, fontWeight: '700', letterSpacing: 0.5,
            }}>
              {rol}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* ── Selector de división — emblemas Data Dragon ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{
          marginBottom: 10,
          borderBottomWidth: 1,
          borderBottomColor: c.onSurface(0.06),
        }}
        contentContainerStyle={{ gap: 6, paddingHorizontal: SPACING.xs, alignItems: 'center', paddingBottom: 6 }}
      >
        {TIERS.map(t => {
          const active = selectedTier === t;
          // OP.GG CDN — funciona sin CORS ni restricciones
          const emblemUri = `https://opgg-static.akamaized.net/images/medals_new/${t.toLowerCase()}.png`;
          return (
            <TouchableOpacity
              key={t}
              onPress={() => setSelectedTier(t)}
              accessibilityRole="radio"
              accessibilityState={{ checked: active }}
              accessibilityLabel={`División ${t}`}
              style={{
                alignItems: 'center',
                paddingVertical: 10,
                paddingHorizontal: SPACING.sm,
                borderRadius: 6,
                backgroundColor: active ? 'rgba(255,215,0,0.12)' : 'transparent',
                borderWidth: active ? 1 : 0,
                borderColor: active ? c.gold : 'transparent',
                minWidth: 48,
                minHeight: 44,
              }}
            >
              <Image
                source={{ uri: emblemUri }}
                style={{ width: 40, height: 44, resizeMode: 'contain', opacity: active ? 1 : 0.45 }}
                accessibilityLabel={`Emblema de ${t}`}
              />
              <Text style={{
                color: active ? c.gold : c.onSurface(0.65),
                fontSize: active ? 8 : 7,
                fontWeight: active ? '900' : '700',
                letterSpacing: 0.3,
                marginTop: 2, textAlign: 'center',
              }}>
                {t.charAt(0) + t.slice(1).toLowerCase()}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* ── Radar ── */}
      <View style={{ alignItems: 'center' }}>
        <FactionRadarChart
          stats={userStats}
          primaryColor={theme.primary}
          size={280}
          label={`TÚ vs ${tierFmt.toUpperCase()} vs PROS`}
          benchmarkStats={benchmark}
          benchmarkLabel={tierFmt}
          extraPolygons={extraPolygons}
        />
      </View>

      {/* ── Chips de pros ── */}
      <Text style={{
        color: c.onSurface(0.65), fontSize: TYPE_SCALE.micro.size, letterSpacing: 0.8,
        marginTop: 10, marginBottom: 6, paddingHorizontal: SPACING.xs,
      }}>
        COMPARAR CON PROS ({userRole})
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 4 }}>
        {allPros.map(p => {
          const active = activePros.includes(p.name);
          return (
            <TouchableOpacity
              key={p.name}
              onPress={() => togglePro(p.name)}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 6,
                paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16,
                borderWidth: 1,
                borderColor: active ? 'rgba(123,118,221,0.7)' : 'rgba(123,118,221,0.4)',
                backgroundColor: active ? 'rgba(123,118,221,0.15)' : 'rgba(123,118,221,0.08)',
              }}
            >
              <View style={{
                width: 6, height: 6, borderRadius: 3,
                backgroundColor: active ? c.primary : 'rgba(123,118,221,0.35)',
              }} />
              <Text style={{
                color: c.primary,
                fontSize: TYPE_SCALE.caption.size, fontWeight: active ? '900' : '700',
                opacity: active ? 1 : 0.7,
              }}>
                {p.name}
              </Text>
              <Text style={{ color: 'rgba(123,118,221,0.45)', fontSize: TYPE_SCALE.micro.size }}>
                {p.team}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── Hint FOCO DE LA SEMANA ── */}
      {gap.label && (
        <View style={[styles.bentoCell, { borderColor: theme.primary + '33', marginTop: 10 }]}>
          <Text style={[styles.cellLabel, { color: theme.primary, marginBottom: 4 }]}>
            FOCO DE LA SEMANA
          </Text>
          <Text style={{ color: c.onSurface(0.70), fontSize: TYPE_SCALE.caption.size, lineHeight: 17 }}>
            {gap.label}
          </Text>
        </View>
      )}
    </View>
  );
}

// ─── Bento Cell ────────────────────────────────────────────────────────────
// Sub-componente reutilizable: una celda de métrica del grid. Recibe por props
// el icono, etiqueta, valor, objetivo, progreso y color, y se anima al montar.
// Featured: barra horizontal grande (es la métrica principal — más espacio).
// Secondary: progress ring circular (compacto y visualmente impactante).
function MetricCell({ icon, label, value, target, suffix, progress, color, tip, featured = false, theme }) {
  const { colors: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  // useRef: referencia mutable que persiste entre renders sin redibujar (como
  // un campo no observable). Aquí guardan los valores animados (ancho de barra
  // y número) sin provocar re-render al mutarse.
  const widthAnim = useRef(new Animated.Value(0)).current;
  const numAnim = useRef(new Animated.Value(0)).current;
  // useState: número mostrado en pantalla; cambiarlo redibuja la celda.
  const [displayNum, setDisplayNum] = useState(0);

  // useEffect: código que se ejecuta al montar el componente (como un
  // constructor o un @PostConstruct) o cuando cambian sus dependencias. Lanza
  // las animaciones de barra y número cuando cambian `value`/`progress`.
  useEffect(() => {
    Animated.timing(widthAnim, {
      toValue: progress, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: false,
    }).start();
    Animated.timing(numAnim, {
      toValue: value, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: false,
    }).start();
  }, [value, progress]);

  // useEffect: suscribe un listener al valor animado para ir reflejando el
  // número intermedio en `displayNum`. El return es la limpieza (como un
  // @PreDestroy / finally): quita el listener al desmontar o re-ejecutar.
  useEffect(() => {
    const id = numAnim.addListener(({ value: v }) => {
      const isFloat = featured || label === 'KDA';
      setDisplayNum(isFloat ? v.toFixed(1) : Math.round(v));
    });
    return () => numAnim.removeListener(id);
  }, [value]);

  // Interpola el valor animado 0..1 a ancho CSS '0%'..'100%' y calcula el % entero.
  const progressWidth = widthAnim.interpolate({
    inputRange: [0, 1], outputRange: ['0%', '100%'],
  });
  const pctValue = Math.round(progress * 100);

  // ─── Vista FEATURED (CS/min) — número grande + barra horizontal ────────
  // Borde + fondo coloreados según la métrica (no siempre blanco).
  // El color viene de PRIORITY_METRIC y permite ver de un vistazo a qué
  // métrica pertenece cada celda.
  if (featured) {
    return (
      // Pressable con `hovered` (web) añade glow del color de la métrica
      // al pasar el ratón. Móvil ignora hover (Pressable lo desactiva nativo).
      <Pressable
        style={({ hovered }) => [
          styles.bentoCell,
          styles.bentoCellFeatured,
          {
            borderColor: color + '44',
            backgroundColor: color + '08',
          },
          hovered && Platform.OS === 'web' && {
            borderColor: color + '88',
            backgroundColor: color + '10',
            shadowColor: color,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.4,
            shadowRadius: 12,
          },
        ]}
      >
        <View style={styles.cellLabelRow}>
          <Icon name={icon} size={14} color={color} />
          <Text style={styles.cellLabel}>{label}</Text>
        </View>

        <View style={styles.cellValueRow}>
          <Text style={[styles.cellBigNum, { color, fontSize: TYPE_SCALE.h1.size }]}>
            {displayNum}{suffix}
          </Text>
          <View style={styles.cellTargetWrap}>
            <Text style={styles.cellTargetSmall}>OBJ</Text>
            <Text style={[styles.cellTargetBig, { color: theme.text + 'AA' }]}>
              {typeof target === 'number' && Number.isInteger(target) ? target : target?.toFixed?.(1) ?? target}{suffix}
            </Text>
          </View>
        </View>

        <View style={styles.cellProgressTrack}>
          <Animated.View style={[styles.cellProgressFill, { width: progressWidth, backgroundColor: color }]} />
        </View>
        <View style={styles.cellProgressMeta}>
          <Text style={[styles.cellPct, { color }]}>{pctValue}%</Text>
          <Text style={styles.cellPctLabel}>del objetivo</Text>
        </View>

        {tip && (
          <View style={[styles.tipBox, { borderLeftColor: theme.primary, backgroundColor: theme.primary + '0D' }]}>
            <View style={styles.tipIconWrap}>
              <Icon name="bolt" size={13} color={theme.primary} />
            </View>
            <Text style={[styles.tipText, { color: theme.primary + 'DD' }]}>{tip}</Text>
          </View>
        )}
      </Pressable>
    );
  }

  // ─── Vista SECONDARY — progress ring circular SVG ──────────────────────
  // Mismo patrón Pressable + hovered. Glow más sutil que la featured
  // (radius 8 vs 12, opacity 0.3 vs 0.4) — la cell secundaria es más pequeña.
  return (
    <Pressable
      style={({ hovered }) => [
        styles.bentoCell,
        { borderColor: color + '33', alignItems: 'center' },
        hovered && Platform.OS === 'web' && {
          borderColor: color + '66',
          shadowColor: color,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
        },
      ]}
    >
      <View style={[styles.cellLabelRow, { justifyContent: 'center', marginBottom: 10 }]}>
        <Icon name={icon} size={13} color={color} />
        <Text style={styles.cellLabel}>{label}</Text>
      </View>

      <CircularProgressRing
        progress={progress}
        size={72}
        strokeWidth={5}
        color={color}
      >
        <Text style={[styles.ringNum, { color }]}>{displayNum}{suffix}</Text>
        <Text style={styles.ringPct}>{pctValue}%</Text>
      </CircularProgressRing>

      <View style={styles.ringTargetRow}>
        <Text style={styles.cellTargetSmall}>OBJ</Text>
        <Text style={[styles.cellTargetBig, { color: theme.text + 'AA', fontSize: TYPE_SCALE.caption.size }]}>
          {typeof target === 'number' && Number.isInteger(target) ? target : target?.toFixed?.(1) ?? target}{suffix}
        </Text>
      </View>
    </Pressable>
  );
}

// ─── Challenge Card ────────────────────────────────────────────────────────
// Sub-componente: tarjeta de un reto activo. Recibe el reto, el tema y su
// índice (para escalonar la animación de entrada). Muestra título, descripción,
// barra de progreso, tip y recompensa opcional.
function ChallengeCard({ challenge, theme, index }) {
  const { colors: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  // useRef: valores animados persistentes (opacidad de entrada y ancho de la
  // barra) que no provocan re-render al mutarse.
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const widthAnim = useRef(new Animated.Value(0)).current;

  // useEffect con deps vacías []: se ejecuta una sola vez al montar (como un
  // constructor). Hace aparecer la card con fade y anima la barra de progreso,
  // con retardo según el índice para un efecto en cascada.
  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 500, delay: index * 120, useNativeDriver: true }).start();
    Animated.timing(widthAnim, {
      toValue: Math.max(0, Math.min(challenge.progress, 1)),
      duration: 800, delay: index * 120 + 100, easing: Easing.out(Easing.cubic), useNativeDriver: false,
    }).start();
  }, []);

  const widthInterp = widthAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  const color = progressColor(challenge.progress);

  // Mapeo emoji→SVG icon (compat con el backend legacy que aún manda emojis).
  // Local los retos ya vienen con el nombre SVG directo — el `||` deja pasar
  // strings limpios como 'coin', 'eye', 'swords', 'kda', 'brain'.
  const challengeIconMap = {
    '🌾': 'coin', '👁': 'eye', '⚔': 'swords', '🔥': 'kda', '🧠': 'brain',
  };
  const iconName = challengeIconMap[challenge.icon] || challenge.icon || 'spark';

  return (
    <Animated.View style={[styles.challengeCard, { opacity: fadeAnim }]}>
      <View style={styles.challengeHeader}>
        <View style={styles.challengeIconWrap}>
          <Icon name={iconName} size={18} color={color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.challengeTitle, { color: theme.text }]}>{challenge.title}</Text>
          <Text style={[styles.challengeDescription, { color: theme.text + '99' }]}>
            {challenge.description}
          </Text>
        </View>
        <Text style={[styles.challengePct, { color }]}>
          {Math.round(challenge.progress * 100)}%
        </Text>
      </View>

      <View style={styles.challengeProgressTrack}>
        <Animated.View style={[styles.challengeProgressFill, { width: widthInterp, backgroundColor: color }]} />
      </View>

      {/* Audit v2 IMP 6 + v3 P2: tip-box sin emoji, con icono SVG bolt */}
      <View style={[styles.tipBox, { borderLeftColor: theme.primary, backgroundColor: theme.primary + '0D' }]}>
        <View style={styles.tipIconWrap}>
          <Icon name="bolt" size={13} color={theme.primary} />
        </View>
        <Text style={[styles.tipText, { color: theme.primary + 'DD' }]}>
          {challenge.tip}
        </Text>
      </View>

      {/* recompensa explícita del reto (emblema/título) */}
      {!!challenge.reward && (
        <View style={[styles.rewardRow, { borderColor: '#D4AF3733' }]}>
          <View style={styles.rewardDot} />
          <Text style={styles.rewardText}>RECOMPENSA · {challenge.reward}</Text>
        </View>
      )}
    </Animated.View>
  );
}

// ─── Sparkline de ELO estimado (H36-T12) ─────────────────────────────────────
// Mini-gráfico de líneas con la trayectoria del ELO estimado por partida.
// Presentacional puro: recibe una serie de números y un color.
function EloSparkline({ series, color }) {
  const W = 230, H = 44, pad = 5;
  const min = Math.min(...series);
  const max = Math.max(...series);
  const range = max - min || 1;
  const coords = series.map((v, i) => {
    const x = pad + (i * (W - 2 * pad)) / Math.max(1, series.length - 1);
    const y = H - pad - ((v - min) / range) * (H - 2 * pad);
    return { x, y };
  });
  const d = 'M ' + coords.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' L ');
  const last = coords[coords.length - 1];
  return (
    <Svg width={W} height={H}>
      <Path d={d} stroke={color} strokeWidth={2} fill="none" strokeLinejoin="round" strokeLinecap="round" />
      {last && <Path d={`M ${last.x.toFixed(1)} ${last.y.toFixed(1)} l 0 0`} stroke={color} strokeWidth={5} strokeLinecap="round" />}
    </Svg>
  );
}

// ─── Pantalla principal ──────────────────────────────────────────────────────
// Componente exportado por defecto: la pantalla ELO-FORGE completa. No recibe
// props; toma todo lo que necesita de los contextos globales.
export default function ForgeScreen() {
  const { colors: c, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const eloStyles = useMemo(() => makeEloStyles(c), [c]);
  // useContext: lee un contexto/estado global compartido (como inyección de
  // dependencias / un singleton accesible). RiotContext aporta riotId + tema;
  // useUser el perfil del usuario logueado.
  const { riotId, setRiotId, theme } = useContext(RiotContext);
  // Tema-aware: el texto de cuerpo de las sub-cards usa el `theme.text` de la
  // facción (near-white → invisible en claro). En claro lo sustituimos por el
  // navy neutro; en oscuro `themed` ES `theme` (mismo objeto → pixel idéntico).
  const themed = isDark ? theme : { ...theme, text: c.textPrimary };
  // `setUser` se usa para PERSISTIR los desbloqueos del champion pool 2+2 cuando
  // el usuario alcanza el umbral de partidas (recompensa de progresión, #5).
  const { user, setUser } = useUser();

  // ── Estado local del componente ───────────────────────────────────────────
  // useState: variable de instancia que, al cambiar, redibuja la pantalla (como
  // un campo Java con notifyObservers).
  // loading: si está esperando datos del backend (muestra el pill de carga)
  // serverError: mensaje de error de la última carga (vacío = sin error)
  // sessionHistory: búsquedas previas de Riot ID
  // selectedRank: rango objetivo elegido en "QUIERO LLEGAR A"
  // currentStats: métricas actuales del jugador (arranca con DEFAULT_STATS)
  // backendChallenges: retos que llegan del backend (si los hay)
  // hasLoadedOnce: evita re-disparar la auto-carga inicial
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState('');
  // B4.3 — true cuando el analytics devolvió 404: la cuenta existe en NOVA RIFT
  // pero Riot no tiene datos suyos (cuenta nueva sin partidas). Se distingue del
  // error de red para mostrar un estado vacío honesto en vez de "Sin conexión".
  const [noDataAccount, setNoDataAccount] = useState(false);
  const [sessionHistory, setSessionHistory] = useState([]);
  const [selectedRank, setSelectedRank] = useState('Oro');
  const [currentStats, setCurrentStats] = useState(DEFAULT_STATS);
  const [backendChallenges, setBackendChallenges] = useState([]);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

  // ── ELO estimator — LP gain/loss editables por el usuario ──────────────────
  // useState: LP que el jugador gana/pierde por partida (strings por venir de
  // un TextInput) y flag del modal de explicabilidad.
  const [lpWin,  setLpWin]  = useState('20');
  const [lpLoss, setLpLoss] = useState('18');
  // modal de explicabilidad "¿Cómo se calcula?" del ELO estimado.
  const [showEloInsight, setShowEloInsight] = useState(false);

  // useEffect (deps []): al montar, lee la config de LP guardada en disco
  // (AsyncStorage) y rehidrata los inputs. Como un @PostConstruct que carga
  // preferencias persistidas.
  useEffect(() => {
    AsyncStorage.getItem('novarift_lp_config').then((raw) => {
      if (!raw) return;
      try {
        const cfg = JSON.parse(raw);
        if (cfg.lpWin)  setLpWin(String(cfg.lpWin));
        if (cfg.lpLoss) setLpLoss(String(cfg.lpLoss));
      } catch (_) {}
    });
  }, []);

  // saveLpConfig: persiste la config de LP en disco (fire-and-forget, ignora errores).
  const saveLpConfig = (win, loss) => {
    AsyncStorage.setItem('novarift_lp_config', JSON.stringify({ lpWin: win, lpLoss: loss })).catch(() => {});
  };

  // normalizeChallenge: rellena con valores por defecto los huecos de un reto
  // venido del backend, para que el render nunca encuentre campos undefined.
  const normalizeChallenge = (c) => ({
    icon: c?.icon || 'brain',
    title: c?.title || 'Desafío personalizado',
    description: c?.description || 'Mejora tu consistencia.',
    progress: Number(c?.progress ?? 0),
    tip: c?.tip || 'Aplica foco en una sola métrica.',
  });

  // useEffect (deps []): al montar, carga el historial de búsquedas guardado.
  useEffect(() => {
    AsyncStorage.getItem('session_history').then((data) => {
      if (data) setSessionHistory(JSON.parse(data));
    });
  }, []);

  // saveToHistory: añade el Riot ID al historial persistido (sin duplicados,
  // máximo 5 entradas, el más reciente primero) y actualiza el estado.
  const saveToHistory = async (id) => {
    try {
      const existing = await AsyncStorage.getItem('session_history');
      const history = existing ? JSON.parse(existing) : [];
      const entry = {
        riotId: id,
        timestamp: new Date().toLocaleString('es-ES'),
        date: new Date().toLocaleDateString('es-ES'),
      };
      const updated = [entry, ...history.filter((h) => h.riotId !== id)].slice(0, 5);
      await AsyncStorage.setItem('session_history', JSON.stringify(updated));
      setSessionHistory(updated);
    } catch (e) {
      console.warn('History save failed:', e);
    }
  };

  // ── Carga las analíticas del jugador desde el backend ──────────────────
  // Pide a `/forge/analytics/{riotId}` las métricas reales (CS/min, visión,
  // KDA, participación en kills...) y las vuelca en `currentStats`. Si el
  // backend falla o tarda más de 8s, marca `serverError`: la cuenta demo
  // (FAKER) sigue con DEFAULT_STATS y las reales muestran el ErrorState.
  const loadAnalytics = async (overrideRiotId = null) => {
    const id = ((overrideRiotId ?? riotId) || '').trim();
    if (!id) {
      setServerError('No hay Riot ID. Configúralo en LIVE-RIFT primero.');
      return;
    }

    setServerError('');
    setNoDataAccount(false); // B4.3 — se reevalúa en cada carga
    setLoading(true);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
      const encoded = encodeURIComponent(id);
      const response = await fetch(`${API_BASE_URL}/forge/analytics/${encoded}`, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!response.ok) {
        let backendMessage = '';
        try {
          const errorJson = await response.json();
          backendMessage = errorJson?.error || '';
        } catch (_) {}
        const mapped = messageForStatus(response.status, backendMessage);
        setServerError(mapped);
        // B4.3 — 404 = cuenta sin datos analizables (no es un fallo de red).
        if (response.status === 404) setNoDataAccount(true);
        const httpError = new Error(mapped);
        httpError.isHttpError = true;
        throw httpError;
      }

      const json = await response.json();
      const csMin = extractFirstNumber(json.csPerMin) ?? extractFirstNumber(json.csComparison);
      const visionScore = extractFirstNumber(json.visionScore);
      const killParticipation = extractFirstNumber(json.killParticipation);
      const kda = extractFirstNumber(json.kda);

      setCurrentStats({
        csMin: csMin ?? currentStats.csMin,
        visionScore: visionScore ?? currentStats.visionScore,
        killParticipation: killParticipation ?? currentStats.killParticipation,
        kda: kda ?? currentStats.kda,
      });

      if (Array.isArray(json.challenges) && json.challenges.length > 0) {
        setBackendChallenges(json.challenges.map(normalizeChallenge));
      } else {
        setBackendChallenges([]);
      }

      await saveToHistory(id);
      setHasLoadedOnce(true);
      setServerError('');
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') setServerError('No hay conexión con el servidor. Comprueba que el backend está activo.');
      else if (!error.isHttpError) setServerError('No hay conexión con el servidor. Comprueba que el backend está activo.');
      setBackendChallenges([]);
    } finally {
      setLoading(false);
    }
  };

  // Fix 3 — Sincroniza el riotId del RiotContext desde el usuario logueado.
  // LoginScreen guarda username + tag en UserContext, pero NO toca RiotContext
  // (su login() nunca se llama en el flujo de auth real), así que aquí el
  // riotId llega vacío y el auto-load de abajo nunca dispararía. Cuando el
  // riotId está vacío y el user tiene datos, lo reconstruimos a "Name#TAG".
  // Esto hace que el auto-load (useEffect [riotId]) arranque solo.
  useEffect(() => {
    if ((riotId || '').trim()) return;
    // El demo (FAKER) conserva su comportamiento previo: sin riotId en el
    // RiotContext, ForgeScreen se queda con sus DEFAULT_STATS mock y NO llama
    // al backend (que devolvería defaults genéricos peores que la demo curada).
    if (isDemoAccount(user?.username) || isDemoAccount(user?.riotId)) return;
    if (!user?.username && !user?.riotId) return;
    const built = user.riotId
      || (user.username.includes('#')
        ? user.username
        : `${user.username}#${user.tag || 'EUW'}`);
    if (built) setRiotId(built);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [riotId, user?.riotId, user?.username, user?.tag]);

  // useEffect (dep [riotId]): se ejecuta al montar y cada vez que cambia el
  // riotId. Dispara la carga automática la primera vez (sin botón manual).
  // Auto-load la primera vez si hay riotId disponible
  useEffect(() => {
    if (riotId && !hasLoadedOnce && !loading) {
      loadAnalytics(riotId);
    }
  }, [riotId]);

  // Objetivos del rango seleccionado (tabla RANK_TARGETS) para esta pantalla.
  const target = RANK_TARGETS[selectedRank];
  // Sistema de retos enriquecido con `generateRichChallenges`: plantillas con
  // champion del pool + recompensa explícita, ordenadas por mayor brecha (las
  // más accionables primero). El backend gana si llega; si no, se computan en
  // cliente con las stats + el main del pool del usuario.
  // useMemo: valor cacheado que solo se recalcula si cambia `user`.
  // Extrae el campeón principal del pool del usuario, tolerando varios formatos
  // (array plano legacy, objeto {main,...}, strings u objetos).
  const userMainChampion = useMemo(() => {
    const c = user?.champions;
    if (!c) return null;
    if (Array.isArray(c)) {
      const first = c[0];
      return typeof first === 'string' ? first : (first?.displayName || first?.championId || null);
    }
    if (Array.isArray(c.main) && c.main.length > 0) {
      const first = c.main[0];
      return typeof first === 'string' ? first : (first?.displayName || first?.championId || null);
    }
    return null;
  }, [user]);

  // useMemo: lista final de retos, cacheada hasta que cambie alguna dependencia.
  // Prioriza los retos del backend; si no hay, los genera en cliente a partir de
  // stats + rango + main champion del usuario.
  const challenges = useMemo(() => {
    if (backendChallenges.length > 0) return backendChallenges;
    return generateRichChallenges({
      rank:         selectedRank,
      stats:        {
        csMin:              currentStats.csMin,
        visionScore:        currentStats.visionScore,
        killParticipation:  currentStats.killParticipation,
        kda:                currentStats.kda,
        winrate:            user?.winrate ?? NOVA_GLOBAL_STATS?.winrate,
        winStreak:          user?.winStreak ?? 0,
      },
      mainChampion: userMainChampion,
      isOTP:        !!user?.isOTP,
    });
  }, [backendChallenges, selectedRank, currentStats, userMainChampion, user]);

  // ── Valores derivados del render (recalculados en cada pintado) ────────────
  // Como no usan useMemo, se recomputan en cada render; son cálculos baratos:
  // identidad del usuario, métrica prioritaria y campeón recomendado.
  const userFaction    = String(user?.faction || 'ZAUN').toUpperCase();
  const priorityMetric = PRIORITY_METRIC[userFaction] || FALLBACK_PRIORITY_METRIC;

  // ELO estimado — calcula en cada render con los LP actuales.
  // H36-T12 — Rango REAL de Riot si lo publicó el Hub (cuenta real); si no
  // (cuenta demo), el mock NovaRift (GOLD II · 47 LP).
  const rank     = readRealRank() || NOVA_GLOBAL_STATS?.rank || {};
  const eloValue = computeElo(rank.tier, rank.division, rank.lp);
  const lpWinNum  = Math.max(1, parseInt(lpWin,  10) || 20);
  const lpLossNum = Math.max(1, parseInt(lpLoss, 10) || 18);
  // La proyección de subida usa el winrate REAL del usuario (user.winrate, con
  // fallback a las stats globales), no un porcentaje fijo inventado.
  const projWrPct = Math.round(
    Number(user?.winrate ?? NOVA_GLOBAL_STATS?.winrate ?? 52)
  );
  const projWr = Math.min(0.99, Math.max(0.01, projWrPct / 100));
  const gamesNeeded = gamesToPromote(rank.lp || 0, lpWinNum, lpLossNum, projWr);
  const divProgress = (rank.lp || 0) / 100; // 0..1

  // ── H36-T12 — Siguiente división, "qué te separa" y sparkline de ELO ───────
  const TIER_ORDER = ['IRON', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'EMERALD', 'DIAMOND', 'MASTER', 'GRANDMASTER', 'CHALLENGER'];
  const DIV_ORDER  = ['IV', 'III', 'II', 'I'];
  const curTier   = String(rank.tier || 'GOLD').toUpperCase();
  const curDivIdx = DIV_ORDER.indexOf(String(rank.division || 'IV').toUpperCase());
  const tierIdx   = TIER_ORDER.indexOf(curTier);
  const nextTier  = tierIdx >= 0 && tierIdx < TIER_ORDER.length - 1 ? TIER_ORDER[tierIdx + 1] : curTier;
  // Siguiente paso: sube de división dentro del tier, o de tier si ya está en I.
  const nextStepLabel = (curDivIdx >= 0 && curDivIdx < DIV_ORDER.length - 1)
    ? `${curTier} ${DIV_ORDER[curDivIdx + 1]}`
    : `${nextTier} IV`;
  const lpToNext = Math.max(0, 100 - (rank.lp || 0));
  // "Qué te separa" (sepGaps) y el CS/min unificado se calculan MÁS ABAJO, ya
  // con `trophyMatches`, para que el CS/min beba del MISMO set de partidas que el
  // Hub/KPI (P1-3 — una métrica = un valor). Aquí solo dejamos listo el benchmark.
  const sepRole  = String(user?.mainRole || 'ADC').toUpperCase();
  const nextBench = benchmarkForRoleAndTier(sepRole, nextTier) || {};
  // (eloSeries y sepGaps se calculan más abajo, cuando ya existe trophyMatches.)

  // Fuente de partidas para la Sala de Trofeos.
  // T4 — refleja el champion pool REAL del usuario, no los ADC del mock demo:
  // aplanamos su pool (acepta array u objeto {main,secondary}) y remapeamos
  // NOVA_MATCHES con remapNovaToPool (mismo motor que el Hub). Si el backend
  // ya expone user.recentMatches se usa tal cual; sin pool propio (demo) cae al
  // mock NovaRift intacto.
  // H36-T1 — Champion pool efectivo. Si el jugador eligió pool en el onboarding,
  // manda ese (user.champions). Si entró con su cuenta real sin onboarding,
  // usamos el pool derivado de sus partidas reales que publicó el Hub (nombres
  // ordenados del más jugado al menos), para que el main recomendado, la sala de
  // trofeos y el radar reflejen a SUS campeones y no a los ADC del mock demo.
  const hasOnboardingPool = (() => {
    const ch = user?.champions;
    if (Array.isArray(ch)) return ch.length > 0;
    if (ch && typeof ch === 'object') {
      return ((ch.main || []).length + (ch.secondary || ch.sec || []).length) > 0;
    }
    return false;
  })();
  // Cadena de fallbacks: pool de onboarding → pool publicado por el Hub →
  // pool derivado AQUÍ de las partidas reales (cubre el caso de abrir la Forja
  // antes de que el Hub publique) → user.champions → null. Así una cuenta real
  // con partidas nunca cae al mock ADC (Lucian/Jinx/Ezreal).
  const effectiveChampions = hasOnboardingPool
    ? user.champions
    : (readEffectivePool()
        || derivePoolFromMatches(user?.recentMatches)?.pool
        || user?.champions
        || null);

  const trophyPoolNames = (() => {
    const champs = effectiveChampions;
    if (!champs) return [];
    const flat = (arr) => (Array.isArray(arr) ? arr : [])
      .map((it) => (typeof it === 'string' ? it : (it?.displayName || it?.championId || null)))
      .filter(Boolean);
    return Array.isArray(champs) ? flat(champs) : [...flat(champs.main), ...flat(champs.secondary)];
  })();
  const trophyMatches = (Array.isArray(user?.recentMatches) && user.recentMatches.length > 0)
    ? user.recentMatches
    : (trophyPoolNames.length ? (remapNovaToPool(trophyPoolNames)?.matches || NOVA_MATCHES) : NOVA_MATCHES);

  // C3 — CS/min UNIFICADO: fuente única = el valor que publicó el Perfil
  // (readProfileCsPerMin); fallback al promedio local con el MISMO helper
  // (avgCsPerMin) si la Forja se abrió sin pasar por el Perfil. Así el roadmap
  // "CÓMO SUBIR" y "QUÉ TE SEPARA" muestran exactamente el mismo CS/min que Perfil.
  const unifiedStats = {
    ...currentStats,
    csMin: readProfileCsPerMin() ?? avgCsPerMin(trophyMatches, currentStats.csMin),
  };
  // "Qué te separa": 2 métricas con mayor brecha relativa vs el benchmark del
  // tier siguiente. CS/min del valor unificado; solo se muestran las que van por
  // debajo del objetivo.
  const sepGaps = [
    { label: 'CS/min', cur: Number(unifiedStats.csMin) || 0,       target: Number(nextBench.csMin) || 0,       fmt: (v) => v.toFixed(1) },
    { label: 'KDA',    cur: Number(unifiedStats.kda) || 0,         target: Number(nextBench.kda) || 0,         fmt: (v) => v.toFixed(1) },
    { label: 'Visión', cur: Number(unifiedStats.visionScore) || 0, target: Number(nextBench.visionScore) || 0, fmt: (v) => String(Math.round(v)) },
  ]
    .map((g) => ({ ...g, gap: g.target - g.cur }))
    .filter((g) => g.gap > 0.05 && g.target > 0)
    .sort((a, b) => (b.gap / b.target) - (a.gap / a.target))
    .slice(0, 2);
  // H36-T12 — Sparkline de ELO estimado por partida (últimas N): proxy del
  // rendimiento alrededor del ELO base — sube con victorias y KDA alto. Es una
  // estimación (el ELO oficial no se expone por partida), coherente con el
  // texto de "¿Cómo se calcula?". Se calcula aquí, ya con trophyMatches.
  const eloSeries = (trophyMatches || []).slice(0, 8).reverse().map((m) => {
    const win = m.result === 'W' || m.result === 'WIN';
    const kda = Number(m.kda) || ((Number(m.kills) || 0) + (Number(m.assists) || 0)) / Math.max(1, Number(m.deaths) || 1);
    const delta = (win ? 28 : -28) + Math.max(-25, Math.min(25, (kda - 3) * 12));
    return Math.round(eloValue + delta);
  });
  // Main champion para los retratos de las insignias. Si no hay pool de usuario,
  // cae al main calculado del mock NovaRift.
  const trophyMainChamp =
    (Array.isArray(effectiveChampions) && (effectiveChampions[0]?.name || effectiveChampions[0])) ||
    effectiveChampions?.main ||
    calculateMainChampion()?.championName ||
    null;
  // C3 — si la métrica destacada de la facción ES el CS/min (DEMACIA/IONIA),
  // usa el valor unificado (mismo que Perfil), no el literal de currentStats.
  const priorityValue  = priorityMetric.key === 'csMin'
    ? (Number(unifiedStats.csMin) || 0)
    : (currentStats[priorityMetric.key] ?? 0);
  const priorityTarget = target[priorityMetric.targetKey] ?? 1;
  const priorityProg   = clampProgress(priorityValue, priorityTarget);

  // Campeón recomendado desde el pool 2+2 del usuario.
  // Acepta array plano (legacy) o {main, secondary} (objetos o strings).
  // Sin pool configurado, la tarjeta "TU MAIN RECOMENDADO" NO se renderiza en
  // cuentas reales (el mock Lucian queda solo para la demo FAKER).
  // Pool efectivo: onboarding o, sin él, el derivado de las partidas reales.
  const userPool = effectiveChampions;

  // ── DESBLOQUEO del champion pool 2+2 por progresión ─────────────────
  // gamesPlayed: partidas con Nova Rift. En cuentas reales sale de
  // user.gamesPlayed o de recentMatches; en la demo cae al mock global.
  const gamesPlayed = resolveGamesPlayed(user, NOVA_GLOBAL_STATS?.gamesPlayed ?? 0);
  // T8 — aviso in-app cuando se desbloquea un hueco del champion pool.
  const [unlockNotice, setUnlockNotice] = useState(null);

  // Al montar (o cuando cambian las partidas / el pool), APLICAMOS los
  // desbloqueos: si algún slot bloqueado ya alcanzó su umbral de partidas, se
  // marca locked:false y se PERSISTE en el usuario. Solo escribimos si algo
  // cambió (applyUnlocks.changed) para no provocar bucles de render. Es
  // conservador: nunca re-bloquea ni toca entradas sin slot numérico.
  useEffect(() => {
    if (!Array.isArray(userPool) || userPool.length === 0) return;
    const { pool: nextPool, changed, unlockedSlots } = applyUnlocks(userPool, gamesPlayed);
    if (changed) {
      // Persistimos el pool con los nuevos desbloqueos. setUser sella lastSeenAt
      // y reescribe AsyncStorage (salvo cuentas mock, que viven en memoria).
      setUser({ ...user, champions: nextPool }).catch(() => {});
      // T8 — AVISO IN-APP al desbloquear un hueco (10/25 partidas): en vez de
      // desbloquear en silencio, mostramos una tarjeta que invita a elegir el
      // campeón del nuevo hueco. slot índice (0-based) → ordinal humano.
      const slotOrdinal = (unlockedSlots[0] ?? 0) + 1;
      setUnlockNotice({ slot: slotOrdinal, games: gamesPlayed });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gamesPlayed, Array.isArray(userPool) ? userPool.length : 0]);

  // Función anónima auto-invocada (IIFE): se ejecuta al vuelo para resolver el
  // main del pool en sus distintos formatos y asignar el resultado en una sola
  // expresión (como un bloque de inicialización inline).
  const userPoolMain = (() => {
    if (!userPool) return null;
    if (Array.isArray(userPool)) {
      const first = userPool[0];
      return typeof first === 'string' ? first : (first?.displayName || first?.championId || null);
    }
    if (Array.isArray(userPool.main) && userPool.main.length > 0) {
      const first = userPool.main[0];
      return typeof first === 'string' ? first : (first?.displayName || first?.championId || null);
    }
    return null;
  })();

  // 4-2 — Eliminado `recommendedChamp = userPoolMain || 'Lucian'` (código muerto:
  // no se renderizaba). El main mostrado sale de `poolMainChamp` = pool REAL.

  // Pool real del usuario aplanado a array de nombres, reutilizando la misma
  // normalización que userPoolMain (acepta array plano, {main, secondary} u
  // objetos). Alimenta los thumbnails del historial; si la cuenta no tiene
  // campeones guardados (p.ej. demo), cae al fallback HISTORY_CHAMPS.
  const userPoolList = (() => {
    if (!userPool) return [];
    const flatten = (arr) => (Array.isArray(arr) ? arr : [])
      .map((it) => (typeof it === 'string' ? it : (it?.displayName || it?.championId || null)))
      .filter(Boolean);
    if (Array.isArray(userPool)) return flatten(userPool);
    return [...flatten(userPool.main), ...flatten(userPool.secondary)];
  })();
  const historyChamps = userPoolList.length ? userPoolList : HISTORY_CHAMPS;

  // T4 — "TU MAIN RECOMENDADO" y el roadmap "CÓMO SUBIR" se calculan sobre el
  // champion pool REAL del usuario (no los ADC fijos del mock demo). Si la
  // cuenta no tiene pool propio (demo AN00), cae al main del mock NovaRift.
  const poolMainChamp = calculateMainChampion(
    userPoolList.length ? historyForPool(userPoolList) : undefined
  );

  // ── Vista del champion pool 2+2 para la UI ──────────────────────────
  // Construye SIEMPRE 4 huecos (rol-slot 0..3) para pintar "2 activos + 2
  // bloqueados". Dos caminos:
  // 1. Pool nuevo (array de objetos con `slot` numérico): usamos sus flags
  // `locked` reales (ya pasados por applyUnlocks vía persistencia).
  // 2. Pool legacy/demo ({main,secondary} o strings sin slot): sintetizamos
  // la vista 2+2 a partir de los nombres (idx 0,1 activos; 2,3 bloqueables)
  // y calculamos su locked según las partidas jugadas. NO se persiste:
  // es solo presentación para que la demo enseñe la mecánica.
  const poolSlotsView = useMemo(() => {
    const SLOTS = ACTIVE_SLOTS + Object.keys(SLOT_UNLOCK_GAMES).length; // 2 + 2 = 4
    const slots = Array.from({ length: SLOTS }, (_, i) => ({
      slot: i,
      championId: null,
      locked: i >= ACTIVE_SLOTS,           // 0,1 activos · 2,3 bloqueables
      required: SLOT_UNLOCK_GAMES[i] || 0, // partidas necesarias (0 si activo)
    }));

    // Camino 1: pool "rico" con slot numérico.
    const richEntries = Array.isArray(userPool)
      ? userPool.filter((e) => e && typeof e === 'object' && slotIndexOf(e) !== null)
      : [];

    if (richEntries.length > 0) {
      for (const e of richEntries) {
        const idx = slotIndexOf(e);
        if (idx === null || idx >= SLOTS) continue;
        slots[idx] = {
          slot: idx,
          championId: e.championId || e.id || e.displayName || null,
          // locked real del dato (ya desbloqueado por applyUnlocks si tocaba).
          locked: isEntryLocked(e),
          required: SLOT_UNLOCK_GAMES[idx] || 0,
        };
      }
      return slots;
    }

    // Camino 2: legacy/demo — rellenar por nombres y calcular locked por juego.
    const names = userPoolList.length ? userPoolList : HISTORY_CHAMPS;
    for (let i = 0; i < SLOTS; i++) {
      const required = SLOT_UNLOCK_GAMES[i] || 0;
      const lockedByRule = i >= ACTIVE_SLOTS;
      slots[i] = {
        slot: i,
        championId: names[i] || null,
        // En la demo, "desbloqueado" si es activo o si ya hay partidas suficientes.
        locked: lockedByRule && gamesPlayed < required,
        required,
      };
    }
    return slots;
  }, [userPool, userPoolList, gamesPlayed]);

  // Estado de las barras de progreso de los huecos bloqueados pendientes.
  // Para el pool rico usamos describeLockedProgress; para el sintético lo
  // derivamos del propio poolSlotsView (mismos umbrales).
  const lockedProgress = useMemo(() => {
    const richEntries = Array.isArray(userPool)
      ? userPool.filter((e) => e && typeof e === 'object' && slotIndexOf(e) !== null)
      : [];
    if (richEntries.length > 0) return describeLockedProgress(richEntries, gamesPlayed);
    // Sintético: una barra por slot bloqueado pendiente.
    return poolSlotsView
      .filter((s) => s.locked && s.required > 0)
      .map((s) => ({
        slot: s.slot,
        championId: s.championId,
        required: s.required,
        gamesPlayed,
        remaining: Math.max(0, s.required - gamesPlayed),
        progress: s.required > 0 ? Math.max(0, Math.min(1, gamesPlayed / s.required)) : 1,
      }));
  }, [userPool, poolSlotsView, gamesPlayed]);

  // ── Política de datos demo vs reales ───────────────────────────────────
  // La cuenta demo (FAKER) usa los mocks de DEFAULT_STATS siempre y sin
  // avisos. Para cualquier otra cuenta, si la analítica falla (`serverError`)
  // ocultamos el Bento/radar/roadmap (que mostrarían stats mock) y dejamos
  // visible el aviso de error con reintento — nunca datos falsos.
  const isDemoUser =
    isDemoAccount(riotId) || isDemoAccount(user?.riotId) || isDemoAccount(user?.username);
  // B4.3 — el 404 (cuenta sin partidas) tiene prioridad sobre el error genérico:
  // muestra el patrón honesto "Juega N partidas…" en vez de "Sin conexión".
  const showAnalysisLocked = !isDemoUser && noDataAccount;
  const showForgeError = !isDemoUser && !showAnalysisLocked && !!serverError;

  // ── return con JSX: describe la UI de forma declarativa (como construir el
  // árbol de Swing pero describiendo el QUÉ, no el CÓMO) ──────────────────────
  // Layout general (de fuera hacia dentro): View raíz con dos fondos animados
  // superpuestos + un ScrollView (contenedor con scroll vertical, como un
  // JScrollPane) que apila, en orden: cabecera, tarjeta de ELO estimado,
  // selector de rango objetivo, tarjeta del main, bloque radar / roadmap /
  // bento (o ErrorState si falla en cuenta real), pill de carga, retos activos,
  // sala de trofeos e historial de búsquedas.
  return (
    <View style={[styles.container, { backgroundColor: c.bg0 }]}>
      {/* NovaBackground V3 (rayos + partículas) — capa más profunda */}
      {isDark && <NovaBackground />}
      {isDark && <AnimatedTacticalBackground theme={theme} intensity="normal" />}

      <ScrollView style={styles.scrollFlex} contentContainerStyle={styles.contentContainer}>

        {/* T8 — AVISO de hueco desbloqueado (10/25 partidas). Aparece cuando
            applyUnlocks abre un slot; invita a elegir el campeón del nuevo hueco. */}
        {unlockNotice && (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => setUnlockNotice(null)}
            style={[styles.unlockNoticeBox, { borderColor: theme.primary + '88' }]}
            accessibilityRole="button"
            accessibilityLabel="Cerrar aviso de hueco desbloqueado"
          >
            <Text style={styles.unlockNoticeIcon}>🔓</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.unlockNoticeTitle, { color: theme.primary }]}>
                ¡{unlockNotice.slot}º hueco de tu champion pool desbloqueado!
              </Text>
              <Text style={styles.unlockNoticeText}>
                Has alcanzado {unlockNotice.games} partidas con Nova Rift. Revisa tu champion
                pool más abajo para elegir el campeón que entra en este hueco.
              </Text>
            </View>
            <Text style={styles.unlockNoticeClose}>✕</Text>
          </TouchableOpacity>
        )}

        {/* Header — HUD coherente con LiveScreen (3 accents + título glow) */}
        <View style={styles.header}>
          {/* Barra superior decorativa con 3 segmentos de color (estilo
              HUD militar / pantalla de comando). Mismo patrón que LiveScreen. */}
          <View style={styles.headerTopBar}>
            <View style={[styles.headerAccent, { backgroundColor: theme.primary }]} />
            <View style={[styles.headerAccent, { backgroundColor: theme.accent }]} />
            <View style={[styles.headerAccent, { backgroundColor: theme.primary }]} />
          </View>
          <View style={styles.titleRow}>
            <Icon name="trophy" size={26} color={theme.primary} />
            <Text style={[styles.title, { color: theme.primary, textShadowColor: theme.primary }]}>
              ELO-FORGE
            </Text>
          </View>
          <Text style={styles.subtitle}>Tu hoja de ruta al siguiente rango</Text>
          {(user?.username || (riotId || '').trim()) ? (
            <Text style={[styles.riotIdText, { color: themed.text + '99' }]}>
              {user?.username ? `${user.username}` : ''}{user?.username && (riotId || '').trim() ? ' · ' : ''}{(riotId || '').trim()}
            </Text>
          ) : null}
          {/* identity badge alineado con el resto de pantallas.
              alias neutro de la identidad, nunca el nombre de facción. */}
          <View style={[styles.factionBadge, { borderColor: theme.primary + '66' }]}>
            <Text style={[styles.factionText, { color: theme.primary }]}>
              {(FACTIONS[userFaction]?.identity || 'Nova').toUpperCase()}
            </Text>
          </View>
        </View>

        {/* ── ELO Estimador ────────────────────────────────────────────── */}
        <View style={eloStyles.card}>
          <Text style={eloStyles.cardTitle}>ELO ESTIMADO</Text>

          {/* Valor grande centrado + rank actual debajo */}
          <View style={eloStyles.eloBlock}>
            {/* Número de ELO con glow + dos arcos SVG decorativos (HUD reticle) */}
            <View style={eloStyles.eloNumWrap}>
              <Svg width={160} height={160} style={eloStyles.eloArcs} pointerEvents="none">
                <Path d="M 10 80 A 70 70 0 0 0 150 80" stroke="#7B76DD33" strokeWidth={1} fill="none" />
                <Path d="M 10 80 A 70 70 0 0 1 150 80" stroke="#7B76DD33" strokeWidth={1} fill="none" />
              </Svg>
              <Text style={eloStyles.eloNum}>{eloValue}</Text>
            </View>
            <View style={eloStyles.rankBadge}>
              <Text style={[eloStyles.rankBadgeText, { color: TIER_COLORS[(rank.tier || 'GOLD').toUpperCase()] || c.gold }]}>
                {rank.tier || 'GOLD'} {rank.division || 'IV'} · {rank.lp || 0} LP
              </Text>
            </View>
            {/* H36-T12 — contraste liga REAL (Riot) vs estimación del motor */}
            <Text style={[eloStyles.realVsEst, { color: c.onSurface(0.55) }]}>
              Riot te coloca aquí · el motor estima{' '}
              <Text style={{ color: theme.primary, fontWeight: '900' }}>{eloValue}</Text> de habilidad individual
            </Text>

            {/* explicabilidad: cómo se estima el ELO */}
            <TouchableOpacity
              onPress={() => setShowEloInsight(true)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="¿Cómo se calcula?"
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Text style={[eloStyles.whyLink, { color: theme.primary }]}>
                ¿Cómo se calcula?
              </Text>
            </TouchableOpacity>
          </View>

          {/* Barra de LP en la división actual */}
          <View style={eloStyles.lpBarWrap}>
            <View style={[eloStyles.lpBarTrack, { backgroundColor: c.onSurface(0.08) }]}>
              <View style={[eloStyles.lpBarFill, {
                width: `${Math.round(divProgress * 100)}%`,
                backgroundColor: theme.primary,
              }]} />
            </View>
            <Text style={[eloStyles.lpBarLabel, { color: theme.primary + '88' }]}>
              {rank.lp || 0} / 100 LP · te faltan {lpToNext} LP para {nextStepLabel}
            </Text>
          </View>

          {/* Inputs LP ganados/perdidos */}
          <Text style={[eloStyles.inputsTitle, { color: c.onSurface(0.65) }]}>
            TUS LP HABITUALES
          </Text>
          <View style={eloStyles.inputsRow}>
            <View style={eloStyles.inputGroup}>
              <Text style={[eloStyles.inputLabel, { color: '#7B76DDAA' }]}>LP POR VICTORIA</Text>
              <TextInput
                style={[eloStyles.lpInput, { borderColor: '#7B76DD66', color: c.primary }]}
                value={lpWin}
                onChangeText={(v) => {
                  setLpWin(v);
                  saveLpConfig(v, lpLoss);
                }}
                keyboardType="numeric"
                maxLength={3}
                placeholderTextColor={c.onSurface(0.2)}
                placeholder="20"
              />
            </View>
            <View style={eloStyles.inputDivider} />
            <View style={eloStyles.inputGroup}>
              <Text style={[eloStyles.inputLabel, { color: '#FF525266' }]}>LP POR DERROTA</Text>
              <TextInput
                style={[eloStyles.lpInput, { borderColor: '#FF525266', color: c.error }]}
                value={lpLoss}
                onChangeText={(v) => {
                  setLpLoss(v);
                  saveLpConfig(lpWin, v);
                }}
                keyboardType="numeric"
                maxLength={3}
                placeholderTextColor={c.onSurface(0.2)}
                placeholder="18"
              />
            </View>
          </View>

          {/* Proyección: partidas necesarias para ascender */}
          {gamesNeeded !== null && (
            <View style={[eloStyles.projBox, { borderColor: theme.primary + '22', backgroundColor: theme.primary + '0A' }]}>
              <Text style={[eloStyles.projText, { color: c.onSurface(0.7) }]}>
                Con tu WR del {projWrPct}% necesitas aprox.{' '}
                <Text style={{ color: theme.primary, fontWeight: '900' }}>{gamesNeeded} partida{gamesNeeded !== 1 ? 's' : ''}</Text>{' '}
                para ascender de división
              </Text>
            </View>
          )}
          {gamesNeeded === null && (
            <View style={[eloStyles.projBox, { borderColor: '#FF525233', backgroundColor: '#FF52520A' }]}>
              <Text style={[eloStyles.projText, { color: '#FF5252AA' }]}>
                Con LP +{lpWinNum}/−{lpLossNum} pierdes más de lo que ganas. Ajusta los valores.
              </Text>
            </View>
          )}

          {/* H36-T12 — Sparkline de ELO estimado por partida (últimas N) */}
          {eloSeries.length >= 3 && (
            <View style={eloStyles.sparkWrap}>
              <Text style={[eloStyles.sparkTitle, { color: theme.primary + 'AA' }]}>
                ELO ESTIMADO · ÚLTIMAS {eloSeries.length} PARTIDAS
              </Text>
              <EloSparkline series={eloSeries} color={theme.primary} />
            </View>
          )}

          {/* H36-T12 — Qué te separa del siguiente nivel (métricas vs benchmark) */}
          {sepGaps.length > 0 && (
            <View style={[eloStyles.gapBox, { borderColor: theme.primary + '22', backgroundColor: theme.primary + '0A' }]}>
              <Text style={[eloStyles.gapTitle, { color: theme.primary + 'AA' }]}>QUÉ TE SEPARA DE {nextTier}</Text>
              {sepGaps.map((g) => (
                <Text key={g.label} style={[eloStyles.gapLine, { color: c.onSurface(0.7) }]}>
                  <Text style={{ color: theme.primary, fontWeight: '900' }}>{g.label}</Text>: vas {g.fmt(g.cur)} · el nivel pide {g.fmt(g.target)} (<Text style={{ color: c.error, fontWeight: '900' }}>+{g.fmt(g.gap)}</Text>)
                </Text>
              ))}
            </View>
          )}

          <AIInsightTooltip
            visible={showEloInsight}
            onClose={() => setShowEloInsight(false)}
            title="¿Cómo se calcula el ELO estimado?"
            explanation="El ELO estimado analiza tus últimas N partidas y compara cada dimensión (farming, KDA, visión) con la media de tu rango en la región. No es tu ELO oficial — refleja solo tu habilidad individual, sin contar el factor equipo."
            dataPoints={[
              { label: 'Rango actual', value: `${rank.tier || 'GOLD'} ${rank.division || 'IV'}` },
              { label: 'ELO estimado', value: String(eloValue) },
              { label: 'LP en división', value: `${rank.lp || 0} / 100` },
            ]}
          />
        </View>

        {/* ── Sección divider ── */}
        <View style={{ height: 1, backgroundColor: 'rgba(123,118,221,0.12)', marginBottom: 16 }} />

        {/* Selector de rango QUIERO LLEGAR A — usa TierPicker unificado */}
        <View style={styles.rankSelectorWrap}>
          <Text style={[styles.rankLabel, { color: themed.text + '77' }]}>QUIERO LLEGAR A</Text>
          <TierPicker
            tiers={Object.keys(RANK_TARGETS)}
            selectedTier={selectedRank}
            onSelect={setSelectedRank}
          />
        </View>

        {/* ── Sección divider ── */}
        <View style={{ height: 1, backgroundColor: 'rgba(123,118,221,0.12)', marginBottom: 16 }} />

        {/* TU MAIN — recomendado por el motor de coaching (audit v3 P2 #5).
            Solo se pinta si hay pool REAL del usuario (onboarding, Hub o
            derivado de partidas) o si es la cuenta demo. Sin pool en cuenta
            real, calculateMainChampion caería al mock HISTORY y mostraría
            Lucian "de la nada" — preferimos ocultar la tarjeta. */}
        {(userPoolList.length > 0 || isDemoUser) && (
          <MainChampionCard theme={themed} mainChamp={poolMainChamp} />
        )}

        {/* En cuentas reales, si la analítica de Riot falla mostramos el
            ErrorState con reintento en vez del radar/roadmap/Bento (que
            mostrarían stats mock). La cuenta demo (FAKER) nunca entra aquí. */}
        {showAnalysisLocked ? (
          /* B4.3 (DIN2-UD5) — límite honesto del sistema: sin partidas reales no
             hay análisis. Nunca radar/roadmap con datos de ejemplo en una cuenta
             real, y nunca un "error" cuando lo que falta son datos. */
          <EmptyState
            title="Juega 5 partidas para activar este análisis"
            subtitle="El radar TÚ vs tu división y el roadmap de mejora se calculan con tus partidas reales. En cuanto Riot registre tus primeras partidas, este análisis se activará solo."
            icon={<Icon name="brain" size={28} color={theme.primary} />}
            style={{ marginBottom: 16 }}
          />
        ) : showForgeError ? (
          <ErrorState
            title="Sin conexión con Riot"
            message={serverError}
            onRetry={() => loadAnalytics()}
            style={{ marginBottom: 16 }}
          />
        ) : (
        <>
        {/* FactionRadarChart movido aquí desde HubScreen.
            Stats reales del usuario computados a partir de su historial,
            con hint del eje peor respecto al benchmark de la división. */}
        <ForgeRadarBlock theme={themed} matches={trophyMatches} />

        {/* CÓMO SUBIR — roadmap específico por rango (audit v3 P2 #6) */}
        <View style={{ marginBottom: 14 }}>
          <ClimbRoadmapCard
            theme={themed}
            currentStats={unifiedStats}
            targetBenchmark={target}
            targetRankName={selectedRank}
            mainChamp={poolMainChamp}
          />
        </View>

        {/* H36-T10 (§4.5) — Suprimidos por repetidos / no aportar (decisión de
            Jorge en el análisis v3):
            · la caja "MÉTRICA PRIORITARIA" (destacar el WR/una métrica no aporta
              en una pantalla de medición — coherente con §3.1),
            · la fila de 3 anillos sueltos (su gráfico de círculo ahora vive
              integrado en cada tarjeta de "MÉTRICAS · {rol} · {tier}" arriba),
            · el "CAMPEÓN RECOMENDADO" duplicado (ya está "TU MAIN RECOMENDADO"),
            · el "CHAMPION POOL 2+2" (repetido con el tab CHAMPION POOL del Hub).
            El EloForge queda sin secciones repetidas. */}

        </>
        )}

        {/* Estado de carga / error */}
        {loading && (
          <View style={[styles.loadingPill, { backgroundColor: theme.primary + '10', borderColor: theme.primary + '30' }]}>
            <ActivityIndicator color={theme.primary} size="small" />
            <Text style={[styles.loadingText, { color: theme.primary }]}>
              Cargando métricas del backend…
            </Text>
          </View>
        )}
        {/* El error de Riot en cuentas reales ya se muestra arriba con el
            ErrorState; la cuenta demo (FAKER) no muestra aviso (usa mocks). */}

        {/* Retos activos */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <Icon name="target" size={14} color={theme.primary} />
              <Text style={[styles.sectionTitle, { color: theme.primary }]}>RETOS ACTIVOS</Text>
            </View>
            <Text style={styles.sectionCount}>{challenges.length}</Text>
          </View>
          {challenges.map((c, i) => (
            <ChallengeCard key={`${c.title}-${i}`} challenge={c} theme={themed} index={i} />
          ))}
        </View>

        {/* ── Sección divider ── */}
        <View style={{ height: 1, backgroundColor: 'rgba(123,118,221,0.12)', marginBottom: 16 }} />

        {/* Sala de Trofeos. Movida desde ProfileScreen porque
            encaja mejor con la narrativa de progreso/coaching de ELO Forge.
            El motor + AsyncStorage snapshot + reveal animation viven en el
            propio componente — esta pantalla sólo le pasa `matches` y theme. */}
        <View style={{ paddingHorizontal: 4 }}>
          <TrophyCabinet
            matches={trophyMatches}
            theme={themed}
            title="SALA DE TROFEOS"
            mainChampionName={trophyMainChamp}
          />
        </View>

        {/* ── Vitrina de logros (H36-T11) ─────────────────────────────────
            Sustituye al HISTORIAL anterior, que mostraba W/L, KDA y CS/min
            FALSOS (derivados de un hash del riotId) y duplicaba el historial
            del Hub. Carrusel horizontal de los mismos logros de la SALA DE
            TROFEOS, con los conseguidos destacados y el progreso del resto.
            El historial completo de partidas vive SOLO en el tab PERFIL del
            Hub. Las insignias por campeón se ven además en el modal de campeón
            (H36-T8). */}
        {(() => {
          const showcase = computeAllTrophies(ALL_TROPHIES, trophyMatches);
          const earned = showcase.filter((t) => t.state === 'earned');
          const rest = showcase
            .filter((t) => t.state !== 'earned')
            .sort((a, b) => (b.progress || 0) - (a.progress || 0));
          const ordered = [...earned, ...rest];
          return (
            <View style={styles.section}>
              <View style={[styles.sectionTitleRow, { marginBottom: 8 }]}>
                <Icon name="trophy" size={14} color={theme.primary} />
                <Text style={[styles.sectionTitle, { color: theme.primary }]}>VITRINA DE LOGROS</Text>
                <Text style={[styles.sectionCount, { marginLeft: 'auto' }]}>{earned.length}/{showcase.length}</Text>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 10, paddingVertical: 2, paddingHorizontal: 2 }}
              >
                {ordered.map(({ trophy, state, progress }) => {
                  const isEarned = state === 'earned';
                  return (
                    <View
                      key={trophy.id}
                      style={[
                        styles.showcaseCard,
                        { borderColor: isEarned ? theme.primary + '88' : c.onSurface(0.08), opacity: isEarned ? 1 : 0.6 },
                      ]}
                    >
                      <View style={styles.showcaseIconWrap}>
                        {/* C1 — Medallón con el RETRATO del campeón main y aro por
                            tier (estándar "Estilo Ruler", igual que la SALA DE
                            TROFEOS). `glyph` queda de fallback si no hay campeón.
                            No pasamos `locked`: la card ya atenúa los no
                            conseguidos con su opacity. */}
                        <TrophyBadge
                          tier={TROPHY_TIER[trophy.id] || 'oro'}
                          portraitUrl={trophyMainChamp ? getChampionImageUrl(trophyMainChamp) : undefined}
                          glyph={trophy.icon}
                          size={40}
                        />
                      </View>
                      <Text style={[styles.showcaseName, { color: themed.text }]} numberOfLines={2}>{trophy.name}</Text>
                      <Text
                        style={[styles.showcaseState, { color: isEarned ? c.success : c.onSurface(0.4) }]}
                        numberOfLines={1}
                      >
                        {isEarned ? 'CONSEGUIDO' : `${Math.round((progress || 0) * 100)}%`}
                      </Text>
                    </View>
                  );
                })}
              </ScrollView>
            </View>
          );
        })()}
      </ScrollView>
    </View>
  );
}

// ── StyleSheet principal ────────────────────────────────────────────────────
// StyleSheet.create(): definición de estilos, equivalente a CSS pero como
// objeto Java. Cada clave es una "clase" de estilo que el JSX referencia con
// `styles.x`. Agrupado por zona de la pantalla: contenedor, cabecera, selector
// de rango, bento grid + celdas de métrica, pill de carga, secciones, retos,
// tarjeta de main champion, roadmap de subida, historial, badge de facción y
// tarjeta de campeón recomendado.
const makeStyles = (c) => StyleSheet.create({
  container: { flex: 1 },
  scrollFlex: { flex: 1 },
  // Centrado en web desktop (mismo patrón que HubScreen).
  // Sin esto, el contenido se estira a full width en pantallas anchas y las
  // cards quedan demasiado pequeñas.
  contentContainer: {
    paddingTop: 56,
    paddingHorizontal: 14,
    paddingBottom: 100,
    ...(Platform.OS === 'web' ? {
      maxWidth: 720,
      alignSelf: 'center',
      width: '100%',
    } : {}),
  },

  // T8 — aviso de hueco desbloqueado (champion pool 10/25 partidas).
  unlockNoticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1.5,
    borderRadius: 12,
    backgroundColor: 'rgba(123,118,221,0.10)',
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 16,
  },
  unlockNoticeIcon: { fontSize: 22 },
  unlockNoticeTitle: { fontSize: 14, fontWeight: '900', letterSpacing: 0.5, marginBottom: 3 },
  unlockNoticeText: { color: c.onSurface(0.75), fontSize: 12, lineHeight: 17 },
  unlockNoticeClose: { color: c.onSurface(0.5), fontSize: 16, fontWeight: '900', paddingHorizontal: 2 },

  // Header
  header: { alignItems: 'center', marginBottom: 22 },
  // P1 — HUD coherente con LiveScreen: 3 accents horizontales sobre el título.
  headerTopBar: {
    flexDirection: 'row',
    width: '70%',
    height: 4,
    marginBottom: SPACING.lg,
    borderRadius: 2,
    overflow: 'hidden',
  },
  headerAccent: {
    flex: 1,
    height: 4,
    marginHorizontal: 3,
    borderRadius: 2,
    opacity: 0.9,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: {
    fontSize: TYPE_SCALE.h4.size, fontWeight: '900', letterSpacing: 6,
    textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 18,
  },
  subtitle: {
    color: c.onSurface(0.40), fontSize: TYPE_SCALE.caption.size, letterSpacing: 3,
    marginTop: 6, fontWeight: '700', textTransform: 'uppercase',
  },
  riotIdText: { fontSize: TYPE_SCALE.caption.size, marginTop: SPACING.sm, letterSpacing: 1.5 },

  // Rank selector
  rankSelectorWrap: {
    marginBottom: 18,
    borderWidth: 1,
    borderColor: 'rgba(123,118,221,0.12)',
    borderRadius: 12,
    padding: 14,
    backgroundColor: 'rgba(123,118,221,0.03)',
  },
  rankLabel: {
    fontSize: TYPE_SCALE.caption.size, fontWeight: '900', letterSpacing: 3,
    marginBottom: 10, marginLeft: 2,
    borderLeftWidth: 3, borderLeftColor: c.primary, paddingLeft: 10,
  },
  rankScrollContent: { paddingHorizontal: SPACING.xs, gap: 6 },
  // Audit v3 P2: rank pills sharper (4px) en lugar de pill completa
  rankChip: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderWidth: 1, borderRadius: 6,
  },
  rankChipText: { fontSize: TYPE_SCALE.caption.size, letterSpacing: 1, fontWeight: '800' },

  // Bento Grid
  bentoGrid: { gap: 10, marginBottom: 16 },
  bentoFullRow: {},
  bentoTripleRow: {
    flexDirection: 'row',
    gap: 10,
  },
  // Audit v2 VAN 9: Glassmorphism universal — borderTop bright + doble sombra
  bentoCell: {
    flex: 1,
    backgroundColor: c.onSurface(0.05),
    borderWidth: 1,
    borderColor: c.onSurface(0.09),
    borderTopColor: c.onSurface(0.14),
    borderTopWidth: 1,
    borderRadius: 12,
    padding: 15,
    shadowColor: '#000',
    shadowOpacity: 0.55,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
    ...(Platform.OS === 'web' ? {
      boxShadow: '0 4px 24px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.06)',
    } : {}),
  },
  bentoCellFeatured: {
    backgroundColor: c.onSurface(0.06),
    padding: 20,
  },

  cellLabel: {
    fontSize: TYPE_SCALE.micro.size, fontWeight: '800', letterSpacing: 1.5,
    color: c.onSurface(0.35), textTransform: 'uppercase',
  },
  cellLabelRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: SPACING.sm,
  },
  cellValueRow: {
    flexDirection: 'row', alignItems: 'flex-end',
    justifyContent: 'space-between', marginBottom: 10,
  },
  cellBigNum: {
    fontWeight: '900', lineHeight: 50,
    fontVariant: ['tabular-nums'],
  },
  cellTargetWrap: { alignItems: 'flex-end' },
  cellTargetSmall: {
    fontSize: TYPE_SCALE.micro.size, fontWeight: '800', color: c.onSurface(0.25),
    letterSpacing: 1,
  },
  cellTargetBig: { fontSize: TYPE_SCALE.label.size, fontWeight: '700' },

  cellProgressTrack: {
    height: 6, borderRadius: 4,
    backgroundColor: c.onSurface(0.06),
    overflow: 'hidden',
  },
  cellProgressFill: { height: 6, borderRadius: 4 },
  cellProgressMeta: {
    flexDirection: 'row', alignItems: 'baseline',
    gap: 6, marginTop: 6,
  },
  cellPct: { fontSize: TYPE_SCALE.caption.size, fontWeight: '900' },
  cellPctLabel: { fontSize: TYPE_SCALE.micro.size, color: c.onSurface(0.35), letterSpacing: 0.5 },

  cellTip: {
    fontSize: TYPE_SCALE.caption.size, marginTop: 12, fontStyle: 'italic',
    lineHeight: 16,
  },
  // Progress ring (celdas secundarias)
  ringNum: {
    fontSize: TYPE_SCALE.h6.size, fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  ringPct: {
    fontSize: TYPE_SCALE.micro.size, color: c.onSurface(0.35), fontWeight: '700',
    letterSpacing: 0.5, marginTop: -2,
  },
  ringTargetRow: {
    flexDirection: 'row', alignItems: 'baseline',
    gap: SPACING.xs, marginTop: SPACING.sm,
  },

  // Loading/error pills
  // Color de fondo/borde se aplica inline en el JSX usando theme.primary
  loadingPill: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    borderWidth: 1, borderRadius: 99,
    paddingHorizontal: 14, paddingVertical: SPACING.sm,
    alignSelf: 'center', marginBottom: 12,
  },
  loadingText: { fontSize: TYPE_SCALE.caption.size, fontWeight: '700', letterSpacing: 1 },

  // Sections
  section: { marginBottom: 18 },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 12,
    borderLeftWidth: 3, borderLeftColor: c.primary,
    paddingLeft: 10,
  },
  sectionTitle: {
    fontSize: TYPE_SCALE.label.size, fontWeight: '900', letterSpacing: 2.5,
    color: c.onSurface(0.85),
  },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionCount: {
    fontSize: TYPE_SCALE.body.size, fontWeight: '900', color: c.primary,
    opacity: 0.7,
  },

  // Challenges
  challengeCard: {
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.onSurface(0.09),
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    ...(Platform.OS === 'web' ? {
      boxShadow: '0 2px 16px rgba(0,0,0,0.3)',
    } : {}),
  },
  challengeHeader: {
    flexDirection: 'row', alignItems: 'center',
    gap: 12, marginBottom: 10,
  },
  challengeIconWrap: {
    width: 38, height: 38, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: c.onSurface(0.06),
    borderWidth: 1, borderColor: c.onSurface(0.10),
  },
  challengeTitle: { fontSize: TYPE_SCALE.label.size, fontWeight: '900', letterSpacing: 0.5 },
  challengeDescription: { fontSize: TYPE_SCALE.caption.size, marginTop: 3, lineHeight: 15 },
  challengePct: { fontSize: TYPE_SCALE.h6.size, fontWeight: '900' },
  challengeProgressTrack: {
    // CRIT 3 audit v2: la barra de 5px parecia error de render. Subir a 8px,
    // dar background visible y rounding completo.
    height: 8, borderRadius: 6,
    backgroundColor: c.onSurface(0.08),
    overflow: 'hidden',
    maxWidth: 600,
    marginVertical: SPACING.xs,
  },
  challengeProgressFill: { height: 8, borderRadius: 6 },
  challengeTip: {
    fontSize: TYPE_SCALE.micro.size, marginTop: SPACING.sm, fontStyle: 'italic',
    lineHeight: 14,
  },
  // Audit v2 IMP 6: tip box con border-left destacado
  tipBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    marginTop: 10,
    paddingVertical: SPACING.sm,
    paddingHorizontal: 12,
    borderLeftWidth: 3,
    borderRadius: 6,
  },
  tipIconWrap: { paddingTop: 2 },
  tipText: { flex: 1, fontSize: TYPE_SCALE.caption.size, lineHeight: 17, fontStyle: 'normal' },

  // Reward badge bajo el tip del reto
  rewardRow: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    marginTop: 10,
    paddingHorizontal: 10, paddingVertical: SPACING.sm,
    borderWidth: 1, borderRadius: 6,
    backgroundColor: 'rgba(212,175,55,0.08)',
  },
  rewardIcon: { fontSize: TYPE_SCALE.label.size },
  rewardDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: c.goldDark,
  },
  rewardText: {
    color: 'rgba(212,175,55,0.95)',
    fontSize: TYPE_SCALE.micro.size, fontWeight: '900', letterSpacing: 1.2, flex: 1,
  },

  // ─── Main Champion card ──────────────────────────────────────────────
  mainChampCard: { marginBottom: 14 },
  mainChampBody: {
    flexDirection: 'row', gap: 14, marginTop: SPACING.xs, marginBottom: SPACING.sm,
  },
  mainChampPortrait: { alignItems: 'center', width: 88 },
  mainChampImg: {
    width: 80, height: 80, borderRadius: 8,
    borderWidth: 2.5,
    ...(Platform.OS === 'web' ? {
      boxShadow: '0 0 12px rgba(255,179,0,0.35)',
    } : {}),
  },
  mainChampName: {
    fontSize: TYPE_SCALE.label.size, fontWeight: '900', marginTop: SPACING.sm, letterSpacing: 1,
  },
  mainChampRole: { fontSize: TYPE_SCALE.micro.size, color: c.onSurface(0.40), letterSpacing: 1.5, marginTop: 3 },
  mainChampStats: {
    flex: 1, justifyContent: 'space-around', paddingVertical: SPACING.xs,
  },
  mainStatRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline',
  },
  mainStatLabel: { fontSize: TYPE_SCALE.caption.size, color: c.onSurface(0.35) },
  mainStatValue: { fontSize: TYPE_SCALE.label.size, fontWeight: '900', fontVariant: ['tabular-nums'] },

  // ─── Climb Roadmap card ──────────────────────────────────────────────
  focusBlock: {
    borderWidth: 1, borderRadius: 12, padding: 14,
    marginVertical: 10,
    backgroundColor: c.surface,
    borderLeftWidth: 3,
  },
  focusTag: {
    fontSize: TYPE_SCALE.micro.size, fontWeight: '900', letterSpacing: 2,
    color: c.onSurface(0.40), textTransform: 'uppercase',
    marginBottom: 6,
  },
  focusMetric: { fontSize: TYPE_SCALE.body.size, fontWeight: '900', letterSpacing: 0.5 },
  focusGapRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginTop: 6,
  },
  focusGapText: { fontSize: TYPE_SCALE.caption.size, fontVariant: ['tabular-nums'] },
  gapBadge: {
    backgroundColor: '#E3342F22', borderColor: '#E3342F66',
    borderWidth: 1, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2,
  },
  gapBadgeText: { color: '#E3342F', fontSize: TYPE_SCALE.micro.size, fontWeight: '900' },

  actionRow: {
    flexDirection: 'row', gap: 10,
    marginTop: 10, alignItems: 'flex-start',
  },
  actionNum: {
    width: 24, height: 24, borderRadius: 4, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  actionNumText: { fontSize: TYPE_SCALE.caption.size, fontWeight: '900' },
  actionTitle: { fontSize: TYPE_SCALE.caption.size, fontWeight: '900', lineHeight: 16 },
  actionBody: { fontSize: TYPE_SCALE.caption.size, marginTop: 3, lineHeight: 15 },

  // Historial
  historyRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10, paddingHorizontal: 12,
    borderWidth: 1, borderColor: c.onSurface(0.05),
    borderRadius: 4, marginBottom: 6,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  // Vitrina de logros (H36-T11) — tarjeta del carrusel horizontal.
  showcaseCard: {
    width: 96, borderWidth: 1, borderRadius: 10,
    paddingVertical: 12, paddingHorizontal: 8, alignItems: 'center',
    backgroundColor: c.onSurface(0.03),
  },
  showcaseIconWrap: { marginBottom: 8 },
  showcaseName: { fontSize: TYPE_SCALE.micro.size, fontWeight: '800', letterSpacing: 0.3, textAlign: 'center', minHeight: 26 },
  showcaseState: { fontSize: 9, fontWeight: '900', letterSpacing: 1, marginTop: 4 },
  historyArrow: { fontSize: TYPE_SCALE.caption.size, fontWeight: '900' },
  historyChampImg: { width: 28, height: 28, borderRadius: 4, borderWidth: 1.5 },
  historyInfo: { flex: 1, marginLeft: 4 },
  historyRiotId: { fontSize: TYPE_SCALE.caption.size, fontWeight: '700' },
  historyChampLabel: { fontSize: TYPE_SCALE.micro.size, color: c.onSurface(0.35), marginTop: 1 },
  historyStatsCol: { alignItems: 'flex-end', marginRight: 10 },
  historyStatVal: { fontSize: TYPE_SCALE.caption.size, fontWeight: '900', fontVariant: ['tabular-nums'] },
  historyStatSub: { fontSize: TYPE_SCALE.micro.size, color: c.onSurface(0.35), fontVariant: ['tabular-nums'] },
  historyDate: { fontSize: TYPE_SCALE.micro.size, color: c.onSurface(0.35) },
  // Audit v2 IMP 7: dot W/L con glow
  historyDot: {
    width: 9, height: 9, borderRadius: 5,
    shadowOpacity: 0.7, shadowRadius: 4, shadowOffset: { width: 0, height: 0 },
    elevation: 3,
  },

  // Faction badge en header
  factionBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: SPACING.sm, paddingVertical: 3,
    borderRadius: 4, borderWidth: 1, marginTop: 6,
    backgroundColor: c.surface,
  },
  factionText: { fontSize: TYPE_SCALE.micro.size, fontWeight: '900', letterSpacing: 2 },

  // Card de campeón recomendado dentro del bento
  recommendedCell: {
    marginTop: 10,
    backgroundColor: c.onSurface(0.03),
  },
  recommendedBody: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginTop: 10,
  },
  recommendedSplash: {
    width: 90, height: 64, borderRadius: 6,
    borderWidth: 1.5,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  recommendedInfo: { flex: 1, gap: 2 },
  recommendedName: { fontSize: TYPE_SCALE.body.size, fontWeight: '900', letterSpacing: 0.5 },
  recommendedSub:  { fontSize: TYPE_SCALE.caption.size, fontWeight: '700' },
  recommendedHint: {
    fontSize: TYPE_SCALE.caption.size, lineHeight: 15, fontStyle: 'italic',
    marginTop: SPACING.xs,
  },
});

// ─── ELO block styles ────────────────────────────────────────────────────────
// StyleSheet.create() propio de la tarjeta de ELO estimado (CSS como objeto):
// estilos de la tarjeta, número grande con glow + arcos, badge de rango, barra
// de LP, inputs de LP ganados/perdidos y caja de proyección de partidas.
const makeEloStyles = (c) => StyleSheet.create({
  card: {
    borderWidth: 1, borderRadius: 12,
    padding: 20, marginBottom: SPACING.lg,
    backgroundColor: 'rgba(123,118,221,0.08)',
    borderColor: 'rgba(123,118,221,0.3)',
    gap: 14,
    ...(Platform.OS === 'web' ? {
      boxShadow: '0 4px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)',
    } : {}),
  },
  cardTitle: {
    color: c.onSurface(0.4),
    fontSize: TYPE_SCALE.micro.size, fontWeight: '700', letterSpacing: 3,
    textTransform: 'uppercase',
    textAlign: 'center',
    fontFamily: 'Rajdhani_600SemiBold',
  },

  // Bloque ELO — número grande centrado + rank badge debajo
  eloBlock: {
    alignItems: 'center', gap: 12,
  },
  // Wrapper relativo del número ELO — aloja los arcos SVG centrados detrás.
  eloNumWrap: {
    width: 160, height: 160,
    alignItems: 'center', justifyContent: 'center',
  },
  eloArcs: { position: 'absolute', top: 0, left: 0 },
  eloNum: {
    color: c.textPrimary,
    fontSize: TYPE_SCALE.h1.size, fontWeight: '900', letterSpacing: 0,
    lineHeight: 56,
    fontFamily: 'Rajdhani_700Bold',
    textAlign: 'center',
    textShadowColor: '#7B76DD',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
  },
  rankBadge: {
    paddingHorizontal: 14, paddingVertical: 6,
    backgroundColor: 'rgba(255,215,0,0.08)',
    borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,215,0,0.25)',
    alignItems: 'center',
  },
  rankBadgeText: {
    fontSize: TYPE_SCALE.caption.size, fontWeight: '900', letterSpacing: 1.5,
  },
  whyLink: {
    fontSize: 11, fontWeight: '700', letterSpacing: 1,
    fontFamily: 'Rajdhani_700Bold',
  },

  // Barra de LP
  lpBarWrap: { gap: 5 },
  lpBarTrack: {
    height: 8, borderRadius: 4, overflow: 'hidden',
  },
  lpBarFill: {
    height: 8, borderRadius: 4,
  },
  lpBarLabel: {
    fontSize: TYPE_SCALE.micro.size, fontWeight: '700', letterSpacing: 1,
    textAlign: 'right',
  },

  // Inputs de LP
  inputsTitle: {
    fontSize: TYPE_SCALE.micro.size, fontWeight: '900', letterSpacing: 2,
    marginBottom: -4,
  },
  inputsRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  inputGroup: { flex: 1, gap: 6 },
  inputLabel: {
    fontSize: TYPE_SCALE.micro.size, fontWeight: '900', letterSpacing: 1.5,
  },
  lpInput: {
    borderWidth: 1, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 10,
    fontSize: TYPE_SCALE.h5.size, fontWeight: '900',
    textAlign: 'center',
    backgroundColor: c.surface,
  },
  inputDivider: {
    width: 1, height: 40,
    backgroundColor: c.onSurface(0.08),
  },

  // Proyección
  projBox: {
    borderWidth: 1, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 10,
  },
  projText: {
    fontSize: TYPE_SCALE.caption.size, lineHeight: 18,
  },
  // H36-T12 — liga real vs estimado, sparkline y "qué te separa".
  realVsEst: {
    fontSize: TYPE_SCALE.micro.size, lineHeight: 15, textAlign: 'center', marginTop: 2,
  },
  sparkWrap: { alignItems: 'center', gap: 6 },
  sparkTitle: {
    fontSize: 9, fontWeight: '900', letterSpacing: 1.5, alignSelf: 'flex-start',
  },
  gapBox: {
    borderWidth: 1, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 10, gap: 4,
  },
  gapTitle: {
    fontSize: 9, fontWeight: '900', letterSpacing: 1.5, marginBottom: 2,
  },
  gapLine: {
    fontSize: TYPE_SCALE.caption.size, lineHeight: 18,
  },
});

// ─── KPI Cards (vs benchmark de rol+rango) ─────────────────────────────────
// Sistema rojo/amarillo/verde — pinta cada métrica del jugador comparada con
// la media esperada para su rol y división. Si la card está en rojo, muestra
// además el quick-fix accionable de divisionBenchmarks.ROLE_QUICK_FIXES.
const KPI_COLOR = {
  green:   COLORS.primary,
  yellow:  '#f39c12',
  red:     '#e74c3c',
  neutral: 'rgba(255,255,255,0.65)',
};

// diagnosisColor: elige el color del bloque de diagnóstico según los problemas
// detectados (sin issues = verde; pool/visión/macro = rojo; resto = amarillo).
function diagnosisColor(diagnosis) {
  if (!diagnosis?.issues || diagnosis.issues.length === 0) return KPI_COLOR.green;
  // Cualquier issue presente = al menos amarillo. WR<50 / KP bajo / vision baja
  // los pintamos en rojo; "farm bajo" lo dejamos en amarillo (no es crítico).
  const types = diagnosis.issues.map(i => i.type);
  if (types.includes('pool') || types.includes('vision') || types.includes('macro')) {
    return KPI_COLOR.red;
  }
  return KPI_COLOR.yellow;
}

// fmtKpiValue / fmtBench: formateadores de presentación. KDA y CS/min con un
// decimal; el resto, redondeado a entero (idéntico para valor y benchmark).
function fmtKpiValue(value, key) {
  if (key === 'kda' || key === 'csMin') return Number(value).toFixed(1);
  if (key === 'kp')                     return Math.round(value);
  return Math.round(value);
}

function fmtBench(value, key) {
  if (key === 'kda' || key === 'csMin') return Number(value).toFixed(1);
  return Math.round(value);
}

// KpiCard: sub-componente de una tarjeta KPI. Recibe `card` (label, valor,
// benchmark, estado y fix) y pinta valor/objetivo coloreados por el semáforo,
// más una nota de tendencia y el quick-fix accionable si está en rojo.
function KpiCard({ card }) {
  const { colors: c } = useTheme();
  const kpiStyles = useMemo(() => makeKpiStyles(c), [c]);
  const color = KPI_COLOR[card.status] || KPI_COLOR.neutral;
  // H36-T10 (§4.5) — el valor de cada métrica se muestra DENTRO de un anillo de
  // progreso (valor vs objetivo). Así el gráfico del círculo vive aquí, donde se
  // da el valor, en vez de repetirse en una sección aparte del EloForge.
  const prog = Number(card.benchmark) > 0
    ? Math.max(0, Math.min(1, Number(card.value) / Number(card.benchmark)))
    : 0;
  return (
    <View style={[
      kpiStyles.card,
      { borderColor: color + '55', backgroundColor: color + '10' },
    ]}>
      <Text style={kpiStyles.cardLabel}>{card.label}</Text>
      <CircularProgressRing
        progress={prog}
        size={66}
        strokeWidth={6}
        color={color}
        trackColor={c.onSurface(0.08)}
      >
        <Text style={[kpiStyles.cardValueRing, { color }]}>
          {fmtKpiValue(card.value, card.key)}{card.unit}
        </Text>
      </CircularProgressRing>
      <Text style={kpiStyles.cardBench}>
        / {fmtBench(card.benchmark, card.key)}{card.unit}
      </Text>
      {card.status === 'red' && (
        <Text style={{ color: '#ff4444', fontSize: TYPE_SCALE.micro.size, marginTop: 2 }}>↓ bajo objetivo</Text>
      )}
      {card.status === 'green' && (
        <Text style={{ color: c.primary, fontSize: TYPE_SCALE.micro.size, marginTop: 2 }}>↑ sobre objetivo</Text>
      )}
      {card.status === 'yellow' && (
        <Text style={{ color: '#ff9900', fontSize: TYPE_SCALE.micro.size, marginTop: 2 }}>→ cerca del objetivo</Text>
      )}
      {card.status === 'red' && card.fix && (
        <Text style={kpiStyles.cardFix} numberOfLines={3}>
          {card.fix}
        </Text>
      )}
    </View>
  );
}

// ── StyleSheet de las tarjetas KPI ──────────────────────────────────────────
// StyleSheet.create() (CSS como objeto) para el bloque de KPIs: contenedor,
// etiqueta de sección, fila de tarjetas, la tarjeta en sí y el bloque de
// diagnóstico de hardstuck.
const makeKpiStyles = (c) => StyleSheet.create({
  block: {
    marginBottom: SPACING.lg,
    paddingHorizontal: 0,
  },
  blockLabel: {
    color: c.onSurface(0.55),
    fontSize: TYPE_SCALE.micro.size, fontWeight: '900', letterSpacing: 2.5,
    marginBottom: 10,
    borderLeftWidth: 3, borderLeftColor: c.primary, paddingLeft: 10,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  card: {
    flex: 1,
    minWidth: 110,
    borderWidth: 1, borderRadius: 12,
    paddingVertical: 14, paddingHorizontal: 12,
    borderBottomWidth: 3,
    alignItems: 'center',
    shadowColor: c.primary, shadowOpacity: 0.08, shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 }, elevation: 3,
  },
  cardLabel: {
    color: c.textMuted,
    fontSize: TYPE_SCALE.micro.size, fontWeight: '800', letterSpacing: 1.5, textTransform: 'uppercase',
    marginBottom: 8, textAlign: 'center',
  },
  cardValue: {
    fontSize: TYPE_SCALE.h3.size, fontWeight: '900',
    marginTop: 6, letterSpacing: 0.5,
  },
  // H36-T10 — valor centrado dentro del anillo de progreso.
  cardValueRing: {
    fontSize: TYPE_SCALE.h6.size, fontWeight: '900', letterSpacing: 0.3,
  },
  cardBench: {
    color: c.onSurface(0.55),
    fontSize: TYPE_SCALE.micro.size, marginTop: SPACING.xs,
  },
  cardFix: {
    color: c.onSurface(0.7),
    fontSize: TYPE_SCALE.micro.size, lineHeight: 14,
    marginTop: 6, fontStyle: 'italic',
  },
  diagnosis: {
    marginTop: 10,
    borderWidth: 1, borderRadius: 6,
    paddingHorizontal: 10, paddingVertical: SPACING.sm,
  },
  diagnosisText: {
    fontSize: TYPE_SCALE.caption.size, lineHeight: 16, fontWeight: '700',
  },
});
