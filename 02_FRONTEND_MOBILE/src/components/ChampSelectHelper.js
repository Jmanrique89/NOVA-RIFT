// ============================================================================
// ChampSelectHelper — pantalla del asistente de champion select
// ----------------------------------------------------------------------------
// Paso de la demo "Iniciar partida": tras activar el radar en LiveScreen, el
// usuario llega aquí para registrar los picks de la partida y recibir una
// recomendación de campeón. Compone:
//
// Selector de rol con RoleSelectionMap (minimapa de la Grieta). El rol
// elegido filtra el catálogo y se pasa a recommendPick para priorizar
// picks del pool que comparten ese rol.
// Toggle ALIADO / ENEMIGO + las dos listas de picks (chips).
// Catálogo de todos los campeones, filtrable por rol y por buscador.
// Card de recomendación: invoca recommendPick(enemyPicks, pool, opts) y
// muestra el campeón sugerido, su confianza y el `detail` estructurado en
// chips ("buen vs", "cuidado con", "comp counter").
//
// Sin estado externo propio de los picks: recibe `enemyPicks`/`allyPicks` y sus
// setters por prop, para que el padre los conserve al navegar y volver.
// ============================================================================
import React, { useContext, useMemo, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Image,
  StyleSheet, TextInput, Platform, Animated,
} from 'react-native';
import NovaBackground from './NovaBackground';
import RoleSelectionMap from './RoleSelectionMap';
import Icon from './Icon';
import { RiotContext } from '../context/RiotContext';
import { useUser } from '../context/UserContext';
import { useTheme } from '../context/ThemeContext';
import { CHAMPIONS } from '../data/championsCatalog';
import { recommendPick, recommendFromPool, MATCHUP_TABLE } from '../utils/recommendPick';
import { readEffectivePool } from '../utils/effectivePool';
import { getRuneImageUrl } from '../utils/dataDragon';
import { getRuneRecommendation } from '../mocks/runeRecommendations';
// B4 (DIN2-UD5) — explicabilidad + feedback loop de la recomendación de pick.
import AIInsightTooltip from './ai/AIInsightTooltip';
import AIFeedbackButtons from './ai/AIFeedbackButtons';
// B4.4 — micro-feedback del CTA CONFIRMAR CON… (mismo spring que NovaButton).
import { usePressScale } from '../hooks/usePressScale';

const MAX_ENEMY_PICKS = 5;
// Picks aliados: máximo 4 (el 5º slot del equipo es el propio jugador, que se
// decide al CONFIRMAR PICK). El motor recibe este array como contexto para
// futuras heurísticas de sinergia.
const MAX_ALLY_PICKS = 4;

// Semáforo de confianza — colores semánticos (NO de facción). #4CAF50 es
// verde estándar Material para evitar confusión con el primary de ZAUN.
const CONFIDENCE_COLOR = {
  HIGH:   '#4CAF50',
  MEDIUM: '#FFB300',
  LOW:    'rgba(255,255,255,0.45)',
};

// ─── semáforo de FUERZA DEL POOL ───────────────────────────────
// Mapea poolStrength (de recommendFromPool) a color + etiqueta legible. Reusa
// la misma paleta semántica que la confianza para coherencia visual.
const POOL_STRENGTH_META = {
  STRONG: { color: '#4CAF50', label: 'FUERTE' },
  OK:     { color: '#FFB300', label: 'ACEPTABLE' },
  GAP:    { color: '#FF5252', label: 'DÉBIL' },
};

// Mapa rol-tab (ROLE_TABS / selectedRole del minimapa) → rol canónico del
// catálogo. El minimapa y las pestañas ya usan los nombres canónicos
// (TOP/JUNGLE/MID/ADC/SUPPORT), así que esto es mayormente identidad; se deja
// explícito por si en el futuro divergen las etiquetas de UI.
function toCanonicalRole(role) {
  return role || null;
}

// P0-3 — Pool por defecto cuando la cuenta NO tiene pool real (ni onboarding ni
// derivado de partidas). Es el MISMO set neutro y role-diverso que usa
// LiveScreen.resolvePlayerPool (DEFAULT_PLAYER_POOL): cubre las 5 lanes y NO
// encabeza con un ADC concreto. Sustituye al antiguo cuarteto mock
// ['Jinx','Caitlyn','Lucian','Ezreal'], que falseaba el pool del usuario
// presentándole campeones que no son suyos. Solo se usa como 3er fallback y
// SIEMPRE de forma honesta (isFallback:true → la UI pinta el aviso "POOL DEMO").
const DEFAULT_PLAYER_POOL = ['Ahri', 'LeeSin', 'Garen', 'Thresh', 'Caitlyn', 'Zed'];

const ROLE_TABS = [
  { id: 'ALL',     label: 'TODOS' },
  { id: 'TOP',     label: 'TOP' },
  { id: 'JUNGLE',  label: 'JG' },
  { id: 'MID',     label: 'MID' },
  { id: 'ADC',     label: 'ADC' },
  { id: 'SUPPORT', label: 'SUP' },
];

// P0-3 — Resolución del pool PROPIO del usuario. Replica EXACTAMENTE la
// prioridad de LiveScreen.resolvePlayerPool (que no podemos importar: vive en un
// archivo que edita otro agente, así que se copia la lógica aquí):
//   1º  Pool del onboarding (user.champions, en cualquiera de sus formatos).
//   2º  Pool efectivo derivado de las PARTIDAS REALES del jugador, que el Hub
//       publica en la caché de sesión (readEffectivePool).
//   3º  Set neutro role-diverso (DEFAULT_PLAYER_POOL) — y de forma HONESTA:
//       isFallback:true para que la UI avise de que es un POOL DEMO.
// Nunca devuelve el antiguo cuarteto mock ['Jinx','Caitlyn','Lucian','Ezreal'].
let warnedPoolFallback = false;
function resolvePlayerPool(user) {
  const ch = user?.champions;
  let ids = [];
  if (Array.isArray(ch)) {
    ids = ch.map(c => (typeof c === 'string' ? c : c?.championId || c?.displayName)).filter(Boolean);
  } else if (ch && typeof ch === 'object') {
    ids = [...(ch.main || []), ...(ch.secondary || ch.sec || [])]
      .map(c => (typeof c === 'string' ? c : c?.championId || c?.displayName))
      .filter(Boolean);
  }
  if (ids.length > 0) return { ids, isFallback: false };

  // 2º — pool efectivo derivado de partidas reales (publicado por el Hub).
  const derived = readEffectivePool();
  if (Array.isArray(derived) && derived.length > 0) {
    return { ids: derived, isFallback: false };
  }

  // 3º — set neutro, marcado como fallback HONESTO (nunca el cuarteto mock).
  if (!warnedPoolFallback) {
    warnedPoolFallback = true;
    // console.log (NO console.warn): el aviso "POOL DEMO" ya lo pinta la UI a
    // partir de isFallback. Dejamos solo una traza informativa para el dev sin
    // disparar el toast amarillo de LogBox durante la demo.
    console.log(
      '[ChampSelectHelper] Usuario sin champion pool real — usando DEFAULT_PLAYER_POOL (demo). '
      + 'Configúralo en el onboarding (ChampionPickScreen).'
    );
  }
  return { ids: DEFAULT_PLAYER_POOL, isFallback: true };
}

// ─── pool "rico" (con slot/locked) para recommendFromPool ──────
// recommendFromPool aprovecha la info de slot (main/secondary) y locked que
// ChampionPickScreen guarda en user.champions ({championId, slot, priority}).
// Conservamos esa info cuando existe; si no hay pool real, degradamos al MISMO
// fallback que resolvePlayerPool (derivado → set neutro), nunca al cuarteto mock.
function richPoolFromContext(user) {
  const champs = user?.champions;

  // Objeto agrupado { main, secondary } con contenido → lo pasamos tal cual;
  // recommendFromPool ya sabe leer esa forma conservando el slot.
  if (champs && !Array.isArray(champs) && typeof champs === 'object') {
    const flatLen = [...(champs.main || []), ...(champs.secondary || champs.sec || [])].length;
    if (flatLen > 0) return champs;
  }

  // Array (strings y/o objetos "ricos" de ChampionPickScreen) con contenido.
  if (Array.isArray(champs) && champs.length > 0) {
    const rich = champs
      .map(c => {
        if (typeof c === 'string') return { championId: c, slot: null, locked: false };
        const id = c?.championId || c?.id || c?.displayName;
        if (!id) return null;
        return {
          championId: id,
          slot:       c.slot || (c.priority === 1 ? 'main' : 'secondary'),
          // `locked` no viene del submit actual (solo se guardan slots elegidos),
          // pero lo respetamos si algún día se persiste el estado del 2+2.
          locked:     Boolean(c.locked),
        };
      })
      .filter(Boolean);
    if (rich.length > 0) return rich;
  }

  // Sin pool real → mismo fallback honesto que resolvePlayerPool (strings).
  return resolvePlayerPool(user).ids;
}

// H36-T13 — Consejo de 1 línea para un counter, según su tipo de daño (dato
// real del catálogo). Genérico pero accionable; no inventa matchups concretos.
function counterTip(name) {
  const champ = CHAMPIONS.find(c => c.id === name || c.displayName === name);
  const dmg = champ?.damageType;
  if (dmg === 'AP')    return 'Daño mágico: respeta su burst y plantéate resistencia mágica temprana.';
  if (dmg === 'MIXED') return 'Daño mixto: difícil de blindar con una sola resistencia; juega seguro y escala.';
  return 'Matchup desfavorable: farmea a salvo, no regales kills y busca tu power spike.';
}

export default function ChampSelectHelper({
  enemyPicks,
  setEnemyPicks,
  // Props del equipo aliado. Defaults defensivos para que el componente siga
  // funcionando si el padre (LiveScreen) no los pasa.
  allyPicks = [],
  setAllyPicks,
  onConfirm,
  onBack,
}) {
  const { theme } = useContext(RiotContext);
  const { user }  = useUser();
  const { colors: c, isDark } = useTheme();
  const styles = useMemo(() => makeChampSelectStyles(c), [c]);
  const [selectedRole, setSelectedRole] = useState(null);
  const [activeRoleTab, setActiveRoleTab] = useState('ALL');
  // Toggle ALIADO/ENEMIGO. Arranca en 'enemy' (cada tap añade al equipo enemigo).
  const [pickTarget, setPickTarget] = useState('enemy'); // 'enemy' | 'ally'
  const [searchQuery, setSearchQuery] = useState('');
  // H36-T13 — Toggle "Champion pool". ON = el catálogo muestra solo tu pool
  // efectivo; OFF = catálogo completo. Arranca en CATÁLOGO (OFF) porque TU PICK
  // ya se elige en la barra superior desde tu pool: la rejilla de abajo sirve
  // para registrar aliados/enemigos, que pueden ser cualquier campeón.
  const [poolMode, setPoolMode] = useState(false);
  // B1/B2 — TU PICK: campeón que el USUARIO elige a mano desde su pool. Cuando
  // está fijado, las runas, los counters y CONFIRMAR siguen ESTE campeón (no solo
  // el recomendado por el motor). Si es null, se sigue el recomendado.
  const [myPick, setMyPick] = useState(null);
  const selectMyPick = useCallback((champId) => {
    setMyPick(prev => (prev === champId ? null : champId)); // re-tocar lo deselecciona
  }, []);

  // P0-3 — pool propio resuelto (onboarding → derivado → set neutro). `isFallback`
  // marca el caso "sin pool real" para pintar el aviso honesto de POOL DEMO.
  const { ids: userPool, isFallback: poolIsFallback } = useMemo(
    () => resolvePlayerPool(user),
    [user]
  );
  // pool "rico" (conserva slot/locked) para recommendFromPool.
  const richPool = useMemo(() => richPoolFromContext(user), [user]);

  // Catálogo filtrado por la pestaña de rol (no por `selectedRole` del mapa,
  // que es una preferencia distinta — el mapa sirve al motor, las pestañas
  // sirven a la UI de "elegir pick enemigo"). Sin embargo, si el usuario
  // toca el mapa y no ha cambiado las pestañas, las pestañas siguen al mapa.
  const effectiveTab = activeRoleTab === 'ALL' && selectedRole
    ? selectedRole
    : activeRoleTab;

  const filteredCatalog = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    // La búsqueda manda sobre todo (incluido el filtro de pool): si buscas un
    // campeón concreto, lo encuentras aunque no esté en tu pool.
    if (q) {
      return CHAMPIONS.filter(c =>
        c.id.toLowerCase().includes(q) ||
        c.displayName.toLowerCase().includes(q)
      );
    }
    let base = effectiveTab === 'ALL' ? CHAMPIONS : CHAMPIONS.filter(c => c.role === effectiveTab);
    // H36-T13 — Con el toggle "Champion pool" en ON, el catálogo se limita a tu
    // pool efectivo. Si el filtro deja la rejilla vacía (p.ej. el rol elegido no
    // está en tu pool), caemos al catálogo del rol para no mostrarla vacía.
    if (poolMode && Array.isArray(userPool) && userPool.length > 0) {
      const poolSet = new Set(userPool.map(p => String(p).toLowerCase()));
      const onlyPool = base.filter(c =>
        poolSet.has(c.id.toLowerCase()) || poolSet.has(String(c.displayName).toLowerCase())
      );
      if (onlyPool.length > 0) return onlyPool;
    }
    return base;
  }, [effectiveTab, searchQuery, poolMode, userPool]);

  // `allyPicks` se pasa al motor como contexto, pero el scoring depende aún solo
  // de los picks enemigos. La recomendación se recalcula (useMemo) cuando cambian
  // los picks, el pool o el rol.
  const recommendation = useMemo(
    () => recommendPick(enemyPicks, userPool, { selectedRole, allyPicks }),
    [enemyPicks, allyPicks, userPool, selectedRole]
  );

  const confidenceColor = CONFIDENCE_COLOR[recommendation.confidence] || CONFIDENCE_COLOR.LOW;

  // B4.2 — modal "¿Por qué esta recomendación?" (mismo patrón que el KPI widget).
  const [showWhyPick, setShowWhyPick] = useState(false);

  // B4.4 — micro-feedback del CTA de confirmación.
  const confirmPress = usePressScale();

  // B1 — Campeón EN FOCO para runas/counters/confirmar: el pick que el usuario
  // elige a mano (TU PICK) manda; si no ha elegido, se usa el recomendado por el
  // motor. Es lo que hace que las runas cambien al tocar campeones distintos.
  const focusChampion = myPick || recommendation.champion;

  // Lista de campeones de TU POOL para el selector "TU PICK" (resuelve nombre
  // legible desde el catálogo; si no está, cae al propio id).
  const myPickPool = useMemo(
    () => (Array.isArray(userPool) ? userPool : []).map((id) => {
      const found = CHAMPIONS.find((ch) => ch.id === id || ch.displayName === id);
      return found || { id, displayName: id };
    }),
    [userPool]
  );

  // P2-1 — Página de runas del campeón EN FOCO (TU PICK o, si no, el recomendado).
  // Compone el motor testeado `recommendRunes` (vía mocks/runeRecommendations) con
  // los tags de la comp enemiga, que activan los overrides por matchup. Se
  // recalcula al cambiar el campeón en foco o la comp.
  const runePage = useMemo(
    () => getRuneRecommendation(focusChampion, {
      enemyTags: recommendation.detail?.enemyTags,
    }),
    [focusChampion, recommendation.detail]
  );

  // ── recomendación CONSCIENTE DEL POOL ─────────────────────────
  // Complementa a recommendPick: clasifica si el pool del usuario RESPONDE a la
  // comp (STRONG/OK) o tiene un HUECO (GAP) y, en ese caso, sugiere el counter
  // del catálogo. Solo tiene sentido con un rol elegido (el "hueco" es por
  // posición) y con al menos un pick enemigo que valorar. Se recalcula (useMemo)
  // cuando cambian picks, pool o rol.
  const poolAdvice = useMemo(() => {
    if (!selectedRole) return null;            // sin rol no hay noción de "hueco"
    if (!enemyPicks || enemyPicks.length === 0) return null;
    return recommendFromPool(
      richPool,
      toCanonicalRole(selectedRole),
      { enemyPicks },
      {}
    );
  }, [richPool, selectedRole, enemyPicks]);

  // Metadata visual del nivel de fuerza del pool (color + etiqueta).
  const poolStrengthMeta = poolAdvice
    ? (POOL_STRENGTH_META[poolAdvice.poolStrength] || POOL_STRENGTH_META.GAP)
    : null;
  // El badge "DE TU POOL" se pinta cuando el pick recomendado por el motor
  // principal coincide con el mejor del pool por rol (es decir: la sugerencia
  // que ve el usuario ES suya). En GAP sin pick utilizable, no aplica.
  const recoIsFromPool = Boolean(
    poolAdvice?.pick && poolAdvice.pick.champion === recommendation.champion
  );

  const addPick = useCallback((champId) => {
    if (enemyPicks.includes(champId)) return;
    if (enemyPicks.length >= MAX_ENEMY_PICKS) return;
    setEnemyPicks(prev => [...prev, champId]);
  }, [enemyPicks, setEnemyPicks]);

  const removePick = useCallback((idx) => {
    setEnemyPicks(prev => prev.filter((_, i) => i !== idx));
  }, [setEnemyPicks]);

  // Handlers del lado aliado. `setAllyPicks` puede llegar `undefined` si el
  // padre no monta la feature; en ese caso los handlers son no-op.
  const addAllyPick = useCallback((champId) => {
    if (!setAllyPicks) return;
    if (allyPicks.includes(champId)) return;
    if (allyPicks.length >= MAX_ALLY_PICKS) return;
    // Bloqueamos también si el campeón ya está en el equipo enemigo
    // (mismo champ no puede estar en ambos lados de la partida real).
    if (enemyPicks.includes(champId)) return;
    setAllyPicks(prev => [...prev, champId]);
  }, [allyPicks, setAllyPicks, enemyPicks]);

  const removeAllyPick = useCallback((idx) => {
    if (!setAllyPicks) return;
    setAllyPicks(prev => prev.filter((_, i) => i !== idx));
  }, [setAllyPicks]);

  // Tap unificado: enruta a enemy o ally según `pickTarget`.
  const handleChampTap = useCallback((champId) => {
    if (pickTarget === 'ally') addAllyPick(champId);
    else addPick(champId);
  }, [pickTarget, addAllyPick, addPick]);

  // Renderer del item horizontal (memoizado). El estado visual del cell
  // depende del `pickTarget` activo: si estamos pickeando ally, los que ya
  // están en allyPicks pintan como "tomados" y los enemyPicks se atenúan
  // como "no disponibles" (y viceversa).
  const renderChampionItem = useCallback(({ item }) => {
    const isInEnemy = enemyPicks.includes(item.id);
    const isInAlly  = allyPicks.includes(item.id);
    const isSelected = pickTarget === 'enemy' ? isInEnemy : isInAlly;
    // "Lleno" depende del lado activo
    const isFull = pickTarget === 'enemy'
      ? enemyPicks.length >= MAX_ENEMY_PICKS && !isInEnemy
      : allyPicks.length  >= MAX_ALLY_PICKS  && !isInAlly;
    // Bloqueado por estar en el OTRO equipo (mismo champ no puede ir en ambos).
    const isInOther = pickTarget === 'enemy' ? isInAlly : isInEnemy;
    const disabled = isSelected || isFull || isInOther;
    // Color del borde de "ya tomado" depende del side
    const takenBorder = isInEnemy ? '#FF5252' : (isInAlly ? '#4CAF50' : null);
    return (
      <TouchableOpacity
        onPress={() => handleChampTap(item.id)}
        disabled={disabled}
        style={[
          styles.champCell,
          (isInEnemy || isInAlly) && takenBorder && { borderColor: takenBorder, opacity: 0.50 },
          !isSelected && (isFull || isInOther) && { opacity: 0.30 },
        ]}
        activeOpacity={0.85}
      >
        <Image
          source={{ uri: getChampionTileUrl(item.id) }}
          style={styles.champCellImg}
          resizeMode="cover"
        />
        <Text style={styles.champCellName} numberOfLines={1}>{item.displayName}</Text>
      </TouchableOpacity>
    );
  }, [enemyPicks, allyPicks, pickTarget, handleChampTap]);

  const keyExtractor = useCallback((item) => item.id, []);

  return (
    <View style={styles.container}>
      {isDark && <NovaBackground />}
      <ScrollView
        style={styles.scrollHost}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.backLink}>← VOLVER</Text>
        </TouchableOpacity>

        <Text style={styles.title}>CHAMPION SELECT</Text>
        <Text style={styles.subtitle}>ASISTENTE DE PICK</Text>

        {/* P0-3 — Aviso HONESTO de pool demo. Cuando la cuenta no tiene pool real
            (ni onboarding ni derivado de partidas) usamos un set neutro y lo
            decimos claramente, en lugar de hacer pasar campeones ajenos por
            "tu pool". Con onboarding configurado nunca debería verse. */}
        {poolIsFallback && (
          <View style={styles.poolDemoBanner}>
            <Text style={styles.poolDemoText}>
              ⚠ POOL DEMO · no tienes un champion pool configurado. Mostramos un set
              neutro de ejemplo; configura el tuyo en el onboarding para una
              recomendación basada en TUS campeones.
            </Text>
          </View>
        )}

        {/* ── 1. Mapa de selección de rol ───────────────────────────────── */}
        <RoleSelectionMap
          selectedRole={selectedRole}
          onSelectRole={(role) => {
            // Toggle: tocar el mismo rol lo deselecciona.
            setSelectedRole(prev => (prev === role ? null : role));
          }}
          theme={theme}
        />

        {/* ══ SELECTOR 1 · TU PICK — tu campeón, desde tu pool ════════════
            B2: zona propia y claramente distinta de la de enemigos. De TU pick
            salen las runas y los counters de abajo (B1). */}
        <View style={[styles.zoneCard, { borderColor: theme.primary + '40', backgroundColor: theme.primary + '0A' }]}>
          <View style={styles.zoneHeaderRow}>
            <View style={[styles.zoneBar, { backgroundColor: theme.primary }]} />
            <Text style={[styles.zoneTitle, { color: theme.primary }]}>TU PICK</Text>
            {myPick ? (
              <View style={[styles.zonePickPill, { borderColor: theme.primary + '66', backgroundColor: theme.primary + '1A' }]}>
                <Text style={[styles.zonePickPillText, { color: theme.primary }]} numberOfLines={1}>{myPick}</Text>
              </View>
            ) : (
              <Text style={styles.zoneCount}>ELIGE TU CAMPEÓN</Text>
            )}
          </View>
          <Text style={styles.zoneHint}>
            Toca tu campeón de tu pool: de TU pick salen las runas y los counters de abajo.
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.flatListContent}
          >
            {myPickPool.map((item) => {
              const selected = myPick === item.id;
              return (
                <TouchableOpacity
                  key={`mypick-${item.id}`}
                  onPress={() => selectMyPick(item.id)}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  style={[
                    styles.champCell,
                    selected && { borderColor: theme.primary, backgroundColor: theme.primary + '22' },
                  ]}
                >
                  <Image
                    source={{ uri: getChampionTileUrl(item.id) }}
                    style={styles.champCellImg}
                    resizeMode="cover"
                  />
                  <Text
                    style={[styles.champCellName, selected && { color: theme.primary, fontWeight: '900' }]}
                    numberOfLines={1}
                  >
                    {item.displayName}
                  </Text>
                  {selected && (
                    <View style={[styles.myPickCheck, { backgroundColor: theme.primary }]}>
                      <Text style={styles.myPickCheckText}>✓</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          <View style={styles.myPickActions}>
            {recommendation?.champion && myPick !== recommendation.champion && (
              <TouchableOpacity
                onPress={() => setMyPick(recommendation.champion)}
                activeOpacity={0.85}
                style={styles.useRecoBtn}
              >
                <Text style={styles.useRecoText}>★ Usar recomendado</Text>
              </TouchableOpacity>
            )}
            {myPick && (
              <TouchableOpacity
                onPress={() => setMyPick(null)}
                activeOpacity={0.85}
                style={styles.useRecoBtn}
              >
                <Text style={styles.useRecoText}>Quitar mi pick</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* ══ SELECTOR 2 · PICKS ENEMIGOS — el resto de la partida ════════
            Zona separada para registrar el equipo rival (y, opcional, aliados).
            No se mezcla con TU PICK: aquí cada tap AÑADE un pick a un equipo. */}
        <View style={styles.enemyZoneHeader}>
          <View style={styles.enemyZoneBar} />
          <Text style={styles.enemyZoneTitle}>PICKS ENEMIGOS</Text>
        </View>
        <Text style={styles.enemyZoneHint}>
          Añade aquí los campeones del equipo RIVAL. Cambia a ALIADO para registrar también a tus aliados.
        </Text>

        {/* ── 2. Toggle ALIADO / ENEMIGO ────────────────────────────────── */}
        <View style={styles.targetToggleRow}>
          {[
            { key: 'enemy', label: 'ENEMIGO', accent: '#FF5252' },
            { key: 'ally',  label: 'ALIADO',  accent: '#4CAF50' },
          ].map(({ key, label, accent }) => {
            const isActive = pickTarget === key;
            return (
              <TouchableOpacity
                key={key}
                onPress={() => setPickTarget(key)}
                style={[
                  styles.targetToggle,
                  isActive && {
                    backgroundColor: accent + '22',
                    borderColor: accent,
                  },
                ]}
                activeOpacity={0.85}
              >
                <Text style={[
                  styles.targetToggleText,
                  isActive && { color: accent },
                ]}>
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── 3. Picks aliados ──────────────────────────────────────────── */}
        <Text style={styles.sectionLabel}>
          ALIADOS ({allyPicks.length}/{MAX_ALLY_PICKS})
        </Text>

        <View style={styles.chipRow}>
          {allyPicks.length === 0 && (
            <Text style={styles.emptyHint}>
              {pickTarget === 'ally'
                ? 'Toca un campeón abajo para añadirlo a tu equipo.'
                : 'Cambia a ALIADO arriba para añadir picks de tu equipo.'}
            </Text>
          )}
          {allyPicks.map((champ, i) => (
            <TouchableOpacity
              key={`ally-${champ}-${i}`}
              onPress={() => removeAllyPick(i)}
              style={[
                styles.chip,
                {
                  borderColor: 'rgba(76,175,80,0.45)',
                  backgroundColor: 'rgba(76,175,80,0.10)',
                },
              ]}
              activeOpacity={0.85}
            >
              <Image
                source={{ uri: getChampionTileUrl(champ) }}
                style={styles.chipThumb}
              />
              <Text style={[styles.chipName, { color: '#4CAF50' }]} numberOfLines={1}>{champ}</Text>
              <Text style={[styles.chipClose, { color: 'rgba(76,175,80,0.7)' }]}>✕</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── 4. Picks enemigos ─────────────────────────────────────────── */}
        <Text style={[styles.sectionLabel, { marginTop: 12 }]}>
          ENEMIGOS ({enemyPicks.length}/{MAX_ENEMY_PICKS})
        </Text>

        <View style={styles.chipRow}>
          {enemyPicks.length === 0 && (
            <Text style={styles.emptyHint}>
              {pickTarget === 'enemy'
                ? 'Toca un campeón abajo para añadirlo al equipo enemigo.'
                : 'Cambia a ENEMIGO arriba para añadir picks rivales.'}
            </Text>
          )}
          {enemyPicks.map((champ, i) => (
            <TouchableOpacity
              key={`${champ}-${i}`}
              onPress={() => removePick(i)}
              style={styles.chip}
              activeOpacity={0.85}
            >
              <Image
                source={{ uri: getChampionTileUrl(champ) }}
                style={styles.chipThumb}
              />
              <Text style={styles.chipName} numberOfLines={1}>{champ}</Text>
              <Text style={styles.chipClose}>✕</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── 3. Catálogo de campeones ──────────────────────────────────── */}
        {/* Buscador por nombre */}
        <View style={styles.searchRow}>
          <Icon name="search" size={14} color={c.onSurface(0.5)} strokeWidth={2} />
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Buscar campeón…"
            placeholderTextColor={c.onSurface(0.28)}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {!!searchQuery && (
            <TouchableOpacity
              onPress={() => setSearchQuery('')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.searchClear}>×</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.catalogHeader}>
          <View style={styles.catalogHeaderTop}>
            <Text style={styles.sectionLabel}>
              {searchQuery
                ? `RESULTADOS · ${filteredCatalog.length}`
                : poolMode
                  ? `TU POOL · ${filteredCatalog.length}`
                  : `CATÁLOGO · ${filteredCatalog.length} campeones`}
            </Text>
            {/* H36-T13 — Toggle Champion pool ON/OFF */}
            <View style={styles.poolToggleRow}>
              {[{ on: true, label: 'POOL' }, { on: false, label: 'CATÁLOGO' }].map(opt => {
                const active = poolMode === opt.on;
                return (
                  <TouchableOpacity
                    key={opt.label}
                    onPress={() => setPoolMode(opt.on)}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    style={[
                      styles.poolToggleBtn,
                      active && { borderColor: theme.primary + '99', backgroundColor: theme.primary + '22' },
                    ]}
                  >
                    <Text style={[styles.poolToggleText, active && { color: theme.primary }]}>{opt.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
          <View style={styles.tabRow}>
            {ROLE_TABS.map(tab => {
              const isActive = activeRoleTab === tab.id || (activeRoleTab === 'ALL' && selectedRole === tab.id);
              return (
                <TouchableOpacity
                  key={tab.id}
                  onPress={() => setActiveRoleTab(tab.id)}
                  style={[
                    styles.tab,
                    isActive && { borderColor: theme.primary + '99', backgroundColor: theme.primary + '22' },
                  ]}
                  activeOpacity={0.85}
                >
                  <Text style={[
                    styles.tabText,
                    isActive && { color: theme.primary },
                  ]}>
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* P2-7 (ajustado) — Con CATÁLOGO como vista por defecto de la rejilla
            (aquí se registran aliados/enemigos), el aviso solo tiene sentido al
            revés: cuando el toggle está en POOL, la rejilla queda limitada a tu
            pool y conviene avisarlo para no "perder" campeones rivales. */}
        {poolMode && !searchQuery && (
          <View style={styles.catalogWarn}>
            <Text style={styles.catalogWarnText}>
              Filtro POOL activo: la rejilla solo muestra tu pool.
            </Text>
          </View>
        )}

        {/* Si hay búsqueda: grid vertical envuelto. Si no: scroll horizontal. */}
        {searchQuery ? (
          <View style={styles.searchGrid}>
            {filteredCatalog.length === 0 ? (
              <Text style={styles.emptyHint}>Sin resultados para "{searchQuery}".</Text>
            ) : (
              filteredCatalog.map((item) => (
                <View key={`${item.id}-${item.role}`}>
                  {renderChampionItem({ item })}
                </View>
              ))
            )}
          </View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.flatListContent}
          >
            {filteredCatalog.map((item) => (
              <View key={`${item.id}-${item.role}`}>
                {renderChampionItem({ item })}
              </View>
            ))}
          </ScrollView>
        )}

        {/* ── 4. Recomendación ──────────────────────────────────────────── */}
        <Text style={[styles.sectionLabel, { marginTop: 24 }]}>MI RECOMENDACIÓN</Text>

        {/* Comp enemiga: visible cuando hay ≥2 picks. Es la información más
            útil para entender por qué se sugiere lo que se sugiere — antes
            estaba enterrada en chips pequeños. */}
        {enemyPicks.length >= 2 && recommendation.detail?.enemyTags?.length > 0 && (
          <View style={styles.compTagsRow}>
            <Text style={styles.compTagsLabel}>COMP ENEMIGA:</Text>
            {recommendation.detail.enemyTags.map(tag => (
              <View key={`tag-${tag}`} style={[styles.compTag, { borderColor: theme.primary + '55' }]}>
                <Text style={[styles.compTagText, { color: theme.primary }]}>{tag.replace(/_/g, ' ')}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={[styles.recoCard, { borderColor: theme.primary + '33' }]}>
          <Image
            source={{ uri: getChampionTileUrl(recommendation.champion) }}
            style={[styles.recoImg, { borderColor: theme.primary + '66' }]}
            resizeMode="cover"
          />
          <View style={styles.recoBody}>
            <View style={styles.recoTitleRow}>
              <Text style={styles.recoChamp}>{recommendation.champion}</Text>
              <View style={[
                styles.confidenceBadge,
                { backgroundColor: confidenceColor + '22', borderColor: confidenceColor + '55' },
              ]}>
                <Text style={[styles.confidenceText, { color: confidenceColor }]}>
                  {recommendation.confidence}
                </Text>
              </View>

              {/* Badge "DE TU POOL" + indicador de fuerza.
                  Se pinta solo cuando el campeón recomendado por el motor ES
                  el mejor del pool del usuario para el rol (recoIsFromPool):
                  así el usuario VE que la sugerencia sale de su propio pool. */}
              {recoIsFromPool && poolStrengthMeta && (
                <View style={[
                  styles.poolBadge,
                  { backgroundColor: poolStrengthMeta.color + '22', borderColor: poolStrengthMeta.color + '66' },
                ]}>
                  <Text style={[styles.poolBadgeText, { color: poolStrengthMeta.color }]}>
                    DE TU POOL · {poolStrengthMeta.label}
                  </Text>
                </View>
              )}
            </View>
            <Text style={styles.recoReason}>
              {recommendation.confidence === 'LOW' && enemyPicks.length <= 1
                ? 'Añade más picks enemigos para una recomendación precisa.'
                : recommendation.reason}
            </Text>

            {/* hint de desbloqueo si el pick recomendado de tu
                pool está en un hueco bloqueado del modelo 2+2. */}
            {recoIsFromPool && poolAdvice?.pick?.unlockHint && (
              <Text style={styles.unlockHintText}>
                🔒 {poolAdvice.pick.unlockHint}
              </Text>
            )}

            {/* Chips de detalle estructurado (good/bad matchups + comp counter) */}
            {recommendation.detail && (
              <View style={styles.recoChips}>
                {recommendation.detail.goodMatchups.map(m => (
                  <View key={`good-${m}`} style={[styles.miniChip, { borderColor: 'rgba(76,175,80,0.45)' }]}>
                    <Text style={[styles.miniChipText, { color: '#4CAF50' }]}>{m}</Text>
                  </View>
                ))}
                {recommendation.detail.badMatchups.map(m => (
                  <View key={`bad-${m}`} style={[styles.miniChip, { borderColor: 'rgba(255,82,82,0.45)' }]}>
                    <Text style={[styles.miniChipText, { color: '#FF5252' }]}>{m}</Text>
                  </View>
                ))}
                {recommendation.detail.compReasons.slice(0, 1).map(r => (
                  <View key={`comp-${r}`} style={[styles.miniChip, { borderColor: theme.primary + '66' }]}>
                    <Text style={[styles.miniChipText, { color: theme.primary }]}>{r}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* B4 (DIN2-UD5) — transparencia + feedback loop: por qué se
                recomienda esto y si le sirvió al usuario. */}
            <View style={styles.recoFooterRow}>
              <AIFeedbackButtons
                tipo="champ_pick"
                id={recommendation.champion}
                accentColor={theme.primary}
              />
              <TouchableOpacity
                onPress={() => setShowWhyPick(true)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="¿Por qué esta recomendación?"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={[styles.whyPickLink, { color: theme.primary + 'BB' }]}>
                  ¿Por qué?
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* B4.2 — explicabilidad de la recomendación de pick */}
        <AIInsightTooltip
          visible={showWhyPick}
          onClose={() => setShowWhyPick(false)}
          title="¿Por qué esta recomendación?"
          explanation="Se calcula con tu WR histórico, tu champion pool y los counters del matchup: el motor puntúa cada campeón de tu pool contra los picks enemigos registrados y prioriza el rol que elegiste."
          dataPoints={[
            { label: 'Confianza', value: recommendation.confidence },
            { label: 'Picks enemigos analizados', value: enemyPicks.length },
            { label: 'Campeones en tu pool', value: Array.isArray(userPool) ? userPool.length : 0 },
            { label: 'Rol priorizado', value: selectedRole || 'Sin rol fijado' },
          ]}
        />

        {/* H36-T13 — Counters duros de TU campeón (los 2-3 matchups más difíciles,
            estilo op.gg) con un consejo de 1 línea por counter. Se muestran los
            counters GENERALES del campeón (de MATCHUP_TABLE.badAgainst), y se
            marca con "· EN LA COMP" cualquiera que esté entre los picks enemigos. */}
        {(() => {
          const champ = focusChampion;
          const hard = (MATCHUP_TABLE[champ]?.badAgainst || []).slice(0, 3);
          if (hard.length === 0) return null;
          const enemySet = new Set((enemyPicks || []).map(String));
          return (
            <View style={[styles.countersCard, { borderColor: '#FF525233' }]}>
              <Text style={styles.countersTitle}>
                CUIDADO CON · COUNTERS DE {String(champ).toUpperCase()}
              </Text>
              {hard.map((c) => {
                const inComp = enemySet.has(c);
                return (
                  <View key={`ctr-${c}`} style={styles.counterRow}>
                    <View style={[styles.counterDot, inComp && { backgroundColor: '#FFB300' }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.counterName}>
                        {c}
                        {inComp ? <Text style={{ color: '#FFB300', fontWeight: '900' }}>  · EN LA COMP</Text> : null}
                      </Text>
                      <Text style={styles.counterTip}>{counterTip(c)}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          );
        })()}

        {/* ── P2-1 · Página de RUNAS (estilo op.gg) ─────────────────────
            Para el campeón recomendado: keystone + 3 runas del árbol primario,
            2 del secundario y los 3 fragmentos. Iconos de keystone vía
            getRuneImageUrl; si una keystone no tiene icono mapeado, se cae a un
            placeholder de texto (sin icono roto). */}
        {runePage && (
          <>
            <Text style={[styles.sectionLabel, { marginTop: 24 }]}>
              RUNAS · {focusChampion.toUpperCase()}
            </Text>
            <View style={styles.runesCard}>
              {/* Cabecera: arquetipo + origen (curado / default por daño) */}
              <View style={styles.runesHeaderRow}>
                <View style={[styles.runesArchPill, { borderColor: runePage.primary.color + '66', backgroundColor: runePage.primary.color + '18' }]}>
                  <Text style={[styles.runesArchText, { color: runePage.primary.color }]}>
                    {runePage.archetypeLabel}
                  </Text>
                </View>
                {runePage.overridden && (
                  <View style={styles.runeAdaptPill}>
                    <Text style={styles.runeAdaptText}>ADAPTADO AL RIVAL</Text>
                  </View>
                )}
              </View>

              {/* Árbol PRIMARIO: keystone + 3 runas menores */}
              <View style={styles.runeTreeBlock}>
                <View style={styles.runeTreeHeader}>
                  <View style={[styles.runeTreeDot, { backgroundColor: runePage.primary.color }]} />
                  <Text style={[styles.runeTreeName, { color: runePage.primary.color }]}>
                    {runePage.primary.treeLabel}
                  </Text>
                  <Text style={styles.runeTreeKind}>PRIMARIO</Text>
                </View>
                <View style={styles.keystoneRow}>
                  <RuneIcon
                    iconKey={runePage.primary.keystoneIconKey}
                    color={runePage.primary.color}
                    size={44}
                    fallbackLabel={runePage.primary.keystone}
                    styles={styles}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.keystoneName}>{runePage.primary.keystone}</Text>
                    <Text style={styles.keystoneSub}>Runa clave</Text>
                  </View>
                </View>
                <View style={styles.runeMinorRow}>
                  {runePage.primary.runes.map((r, i) => (
                    <View key={`pri-${i}-${r}`} style={[styles.runeChip, { borderColor: runePage.primary.color + '44' }]}>
                      <Text style={styles.runeChipText}>{r}</Text>
                    </View>
                  ))}
                </View>
              </View>

              {/* Árbol SECUNDARIO: 2 runas */}
              <View style={styles.runeTreeBlock}>
                <View style={styles.runeTreeHeader}>
                  <View style={[styles.runeTreeDot, { backgroundColor: runePage.secondary.color }]} />
                  <Text style={[styles.runeTreeName, { color: runePage.secondary.color }]}>
                    {runePage.secondary.treeLabel}
                  </Text>
                  <Text style={styles.runeTreeKind}>SECUNDARIO</Text>
                </View>
                <View style={styles.runeMinorRow}>
                  {runePage.secondary.runes.map((r, i) => (
                    <View key={`sec-${i}-${r}`} style={[styles.runeChip, { borderColor: runePage.secondary.color + '44' }]}>
                      <Text style={styles.runeChipText}>{r}</Text>
                    </View>
                  ))}
                </View>
              </View>

              {/* FRAGMENTOS (3 shards) */}
              <View style={styles.runeTreeBlock}>
                <Text style={styles.fragmentsLabel}>FRAGMENTOS</Text>
                <View style={styles.fragmentsRow}>
                  {[
                    { k: 'OFENSIVO',  v: runePage.fragments.offense },
                    { k: 'FLEXIBLE',  v: runePage.fragments.flex },
                    { k: 'DEFENSIVO', v: runePage.fragments.defense },
                  ].map(f => (
                    <View key={f.k} style={styles.fragmentCell}>
                      <Text style={styles.fragmentKind}>{f.k}</Text>
                      <Text style={styles.fragmentVal} numberOfLines={2}>{f.v}</Text>
                    </View>
                  ))}
                </View>
              </View>

              {/* Razón humana de la build de runas */}
              {!!runePage.notes && (
                <Text style={styles.runeNotes}>{runePage.notes}</Text>
              )}
            </View>
          </>
        )}

        {/* ── Tarjeta "HUECO EN TU POOL" ───────────────────────
            Se muestra cuando recommendFromPool clasifica el pool como GAP para
            el rol elegido: ningún campeón del pool responde a la comp enemiga.
            Sugiere el mejor counter del catálogo (que el usuario NO tiene) y le
            invita a aprenderlo/añadirlo. Tarjeta visualmente distinta (rojo)
            para que se note que es un AVISO, no una recomendación normal. */}
        {poolAdvice?.poolStrength === 'GAP' && poolAdvice?.counter && (
          <View style={[styles.gapCard, { borderColor: '#FF525255' }]}>
            <View style={styles.gapHeaderRow}>
              <Text style={styles.gapTitle}>HUECO EN TU POOL</Text>
              <View style={styles.gapPill}>
                <Text style={styles.gapPillText}>{selectedRole}</Text>
              </View>
            </View>
            <Text style={styles.gapSubtitle}>
              Tu pool no cubre bien esta comp en {selectedRole}. El counter del
              catálogo sería:
            </Text>
            <View style={styles.gapCounterRow}>
              <Image
                source={{ uri: getChampionTileUrl(poolAdvice.counter.champion) }}
                style={styles.gapCounterImg}
                resizeMode="cover"
              />
              <View style={styles.gapCounterBody}>
                <Text style={styles.gapCounterName}>{poolAdvice.counter.champion}</Text>
                <Text style={styles.gapCounterReason} numberOfLines={3}>
                  {poolAdvice.counter.reason}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* CTA — sólido, visible, contraste claro. Confirma con TU PICK si lo
            elegiste, o con el recomendado en su defecto (focusChampion). */}
        <TouchableOpacity
          onPress={() => onConfirm(focusChampion)}
          activeOpacity={0.85}
          onPressIn={confirmPress.onPressIn}
          onPressOut={confirmPress.onPressOut}
        >
          {/* B4.4 — spring de pulsación en un Animated.View interior */}
          <Animated.View
            style={[
              styles.confirmBtn,
              { backgroundColor: theme.primary, borderColor: theme.primary },
              { transform: [{ scale: confirmPress.scale }] },
            ]}
          >
            <Text style={[styles.confirmBtnText, { color: c.textInverse }]}>
              CONFIRMAR CON {focusChampion.toUpperCase()}
            </Text>
          </Animated.View>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

// ─── DataDragon helpers ─────────────────────────────────────────────────────
// Tile cuadrado 120×120 — la cara que recorta Riot. Usado en chips, cells del
// FlatList y la card de recomendación (64×64): en contenedores pequeños el
// square icon encuadra la cara sin recortarla, a diferencia del loading art
// 308×560 que con cover centrado dejaba la cintura en cuadro.
function getChampionTileUrl(name) {
  return `https://ddragon.leagueoflegends.com/cdn/16.8.1/img/champion/${name}.png`;
}

// P2-1 — Icono de keystone. Resuelve la URL de Data Dragon vía getRuneImageUrl;
// si la keystone no tiene icono mapeado (devuelve null), pinta un placeholder
// con la inicial — honesto, sin imagen rota.
function RuneIcon({ iconKey, color, size = 40, fallbackLabel, styles }) {
  const uri = iconKey ? getRuneImageUrl(iconKey) : null;
  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={[styles.keystoneImg, { width: size, height: size, borderColor: color + '88' }]}
        resizeMode="contain"
      />
    );
  }
  return (
    <View style={[
      styles.keystoneImg, styles.keystoneImgFallback,
      { width: size, height: size, borderColor: color + '88' },
    ]}>
      <Text style={[styles.keystoneFallbackText, { color }]}>
        {String(fallbackLabel || '?').charAt(0)}
      </Text>
    </View>
  );
}

const CELL_W = 80;

const makeChampSelectStyles = (c) => StyleSheet.create({
  container:  { flex: 1, backgroundColor: c.bg0 },
  scrollHost: { flex: 1 },
  scroll: {
    flexGrow: 1,
    padding: 20, paddingTop: 56, paddingBottom: 60,
  },

  backLink: {
    color: c.onSurface(0.35),
    fontSize: 11, letterSpacing: 1, marginBottom: 16, fontWeight: '700',
  },
  title: {
    color: c.textPrimary,
    fontSize: 18, fontWeight: '900', letterSpacing: 3, marginBottom: 4,
  },
  subtitle: {
    color: c.onSurface(0.35),
    fontSize: 10, letterSpacing: 1, marginBottom: 16,
  },

  sectionLabel: {
    color: c.onSurface(0.35),
    fontSize: 9, fontWeight: '900', letterSpacing: 2, marginBottom: 10,
  },

  // Toggle ALIADO/ENEMIGO arriba de las dos secciones de chips.
  targetToggleRow: {
    flexDirection: 'row', gap: 8,
    marginTop: 4, marginBottom: 14,
  },
  targetToggle: {
    flex: 1, paddingVertical: 9, borderRadius: 6,
    borderWidth: 1, borderColor: c.onSurface(0.12),
    backgroundColor: c.surface,
    alignItems: 'center',
  },
  targetToggleText: {
    color: c.onSurface(0.50),
    fontSize: 10, fontWeight: '900', letterSpacing: 1.5,
  },

  // ── B2 · Selectores separados (TU PICK vs PICKS ENEMIGOS) ───────────
  zoneCard: {
    borderWidth: 1, borderRadius: 12, padding: 12,
    marginTop: 4, marginBottom: 14,
  },
  zoneHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  zoneBar: { width: 4, height: 14, borderRadius: 2 },
  zoneTitle: { fontSize: 12, fontWeight: '900', letterSpacing: 1.5 },
  zoneCount: {
    marginLeft: 'auto',
    color: c.onSurface(0.40), fontSize: 9, fontWeight: '800', letterSpacing: 1,
  },
  zonePickPill: {
    marginLeft: 'auto', maxWidth: 150,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12, borderWidth: 1,
  },
  zonePickPillText: { fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
  zoneHint: { color: c.onSurface(0.45), fontSize: 10, lineHeight: 14, marginBottom: 8 },
  // Check ✓ sobre la celda seleccionada de TU PICK (color de fondo inline = primary).
  myPickCheck: {
    position: 'absolute', top: 4, right: 4,
    width: 16, height: 16, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  myPickCheckText: { color: c.textInverse, fontSize: 10, fontWeight: '900' },
  myPickActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  useRecoBtn: {
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6,
    borderWidth: 1, borderColor: c.onSurface(0.18), backgroundColor: c.onSurface(0.04),
  },
  useRecoText: { color: c.onSurface(0.62), fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },
  // Cabecera de la zona ENEMIGOS — sin card, para no recortar el scroll horizontal.
  enemyZoneHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2, marginBottom: 6 },
  enemyZoneBar: { width: 4, height: 14, borderRadius: 2, backgroundColor: '#FF5252' },
  enemyZoneTitle: { color: '#FF5252', fontSize: 12, fontWeight: '900', letterSpacing: 1.5 },
  enemyZoneHint: { color: c.onSurface(0.45), fontSize: 10, lineHeight: 14, marginBottom: 10 },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12, minHeight: 40 },
  emptyHint: {
    color: c.onSurface(0.35),
    fontSize: 11, fontStyle: 'italic',
  },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(231,76,60,0.10)',
    borderWidth: 1, borderColor: 'rgba(231,76,60,0.30)',
    borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6,
    maxWidth: 140,
  },
  chipThumb: {
    width: 24, height: 24, borderRadius: 3,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  chipName:  { color: c.textPrimary, fontSize: 11, fontWeight: '700', flexShrink: 1 },
  chipClose: { color: 'rgba(231,76,60,0.7)', fontSize: 12, marginLeft: 2 },

  // Buscador
  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: c.surface,
    borderWidth: 1, borderColor: c.onSurface(0.10),
    borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 8,
    marginTop: 16, marginBottom: 4,
  },
  searchIcon: { fontSize: 13, opacity: 0.5 },
  searchInput: {
    flex: 1,
    color: c.textPrimary, fontSize: 13,
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' } : {}),
  },
  searchClear: {
    color: c.onSurface(0.50), fontSize: 18, paddingHorizontal: 2,
  },
  searchGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8,
    marginBottom: 6, paddingVertical: 6,
  },

  catalogHeader: {
    marginTop: 8, marginBottom: 4, gap: 8,
  },
  catalogHeaderTop: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  // H36-T13 — Toggle Champion pool ON/OFF.
  poolToggleRow: { flexDirection: 'row', gap: 4 },
  poolToggleBtn: {
    paddingHorizontal: 9, paddingVertical: 4,
    borderWidth: 1, borderColor: c.onSurface(0.12), borderRadius: 4,
    backgroundColor: c.onSurface(0.03),
  },
  poolToggleText: { color: c.onSurface(0.5), fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  // H36-T13 — Tarjeta de counters duros.
  countersCard: {
    borderWidth: 1, borderRadius: 10, padding: 12, marginTop: 10,
    backgroundColor: 'rgba(255,82,82,0.05)', gap: 8,
  },
  countersTitle: { color: '#FF8A8A', fontSize: 9, fontWeight: '900', letterSpacing: 1.5 },
  counterRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  counterDot: { width: 7, height: 7, borderRadius: 4, marginTop: 4, backgroundColor: '#FF5252' },
  counterName: { color: c.textPrimary, fontSize: 12, fontWeight: '900', letterSpacing: 0.5 },
  counterTip: { color: c.onSurface(0.6), fontSize: 11, lineHeight: 15, marginTop: 1 },
  tabRow: { flexDirection: 'row', gap: 4, flexWrap: 'wrap' },
  tab: {
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 4, borderWidth: 1, borderColor: c.onSurface(0.12),
  },
  tabText: {
    color: c.onSurface(0.50), fontSize: 10, fontWeight: '900', letterSpacing: 1.2,
  },

  flatListContent: { paddingVertical: 6, paddingRight: 12 },
  champCell: {
    width: CELL_W, alignItems: 'center', marginRight: 8,
    borderWidth: 1, borderColor: c.onSurface(0.10),
    borderRadius: 6, padding: 6,
    backgroundColor: c.onSurface(0.02),
  },
  champCellImg: {
    width: CELL_W - 12, height: CELL_W - 12,
    borderRadius: 4, backgroundColor: 'rgba(0,0,0,0.4)',
  },
  champCellName: {
    color: c.textPrimary, fontSize: 9, marginTop: 4, textAlign: 'center',
  },

  // Banner de tags de comp enemiga sobre la recomendación. Visible cuando
  // hay ≥2 picks enemigos — convierte el `analyzeEnemyComposition` en algo
  // legible para el usuario en lugar de quedarse en debug.
  compTagsRow: {
    flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6,
    marginBottom: 10,
  },
  compTagsLabel: {
    color: c.onSurface(0.45),
    fontSize: 9, fontWeight: '900', letterSpacing: 1.5, marginRight: 4,
  },
  compTag: {
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 4, borderWidth: 1,
    backgroundColor: c.surface,
  },
  compTagText: {
    fontSize: 9, fontWeight: '900', letterSpacing: 1,
  },

  recoCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: c.surface,
    borderRadius: 12, padding: 16, marginBottom: 20,
    borderWidth: 1,
  },
  recoImg: {
    width: 64, height: 64, borderRadius: 6, borderWidth: 1.5,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  recoBody: { flex: 1 },
  recoTitleRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4,
  },
  recoChamp: {
    color: c.textPrimary, fontSize: 16, fontWeight: '900', letterSpacing: 0.5,
  },
  confidenceBadge: {
    paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: 4, borderWidth: 1,
  },
  confidenceText: {
    fontSize: 9, fontWeight: '900', letterSpacing: 1,
  },

  // ── badge "DE TU POOL" + indicador de fuerza ────────────────
  // Mismo patrón visual que confidenceBadge (pill pequeña con borde tintado),
  // para que se integre en la fila de título sin romper el layout.
  poolBadge: {
    paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: 4, borderWidth: 1,
  },
  poolBadgeText: {
    fontSize: 8, fontWeight: '900', letterSpacing: 0.8,
  },
  // Hint de desbloqueo (hueco bloqueado del 2+2) bajo la razón del pick.
  unlockHintText: {
    color: 'rgba(255,179,0,0.85)',
    fontSize: 10, lineHeight: 14, marginTop: 6, fontStyle: 'italic',
  },

  recoReason: {
    color: c.onSurface(0.55),
    fontSize: 11, lineHeight: 16,
  },
  recoChips: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 8,
  },
  // B4 — fila inferior de la card de recomendación: feedback 👍/👎 + "¿Por qué?"
  recoFooterRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: 2,
  },
  whyPickLink: {
    fontSize: 11, fontWeight: '700', letterSpacing: 0.5,
    textDecorationLine: 'underline', marginTop: 8,
  },
  miniChip: {
    paddingHorizontal: 6, paddingVertical: 2,
    borderWidth: 1, borderRadius: 3,
    backgroundColor: c.surface,
  },
  miniChipText: { fontSize: 9, fontWeight: '700', letterSpacing: 0.5 },

  // ── Tarjeta "HUECO EN TU POOL" (caso GAP) ───────────────────
  // Reusa el layout de recoCard pero en clave de AVISO (rojo) para diferenciar
  // visualmente "esto es un hueco" de "esta es tu recomendación".
  gapCard: {
    backgroundColor: 'rgba(255,82,82,0.06)',
    borderRadius: 12, padding: 16, marginBottom: 20,
    borderWidth: 1,
  },
  gapHeaderRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 6,
  },
  gapTitle: {
    color: '#FF5252', fontSize: 11, fontWeight: '900', letterSpacing: 1.5,
  },
  gapPill: {
    paddingHorizontal: 8, paddingVertical: 2,
    borderRadius: 4, borderWidth: 1, borderColor: 'rgba(255,82,82,0.45)',
    backgroundColor: 'rgba(255,82,82,0.10)',
  },
  gapPillText: {
    color: '#FF5252', fontSize: 9, fontWeight: '900', letterSpacing: 1,
  },
  gapSubtitle: {
    color: c.onSurface(0.60), fontSize: 11, lineHeight: 16, marginBottom: 12,
  },
  gapCounterRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  gapCounterImg: {
    width: 52, height: 52, borderRadius: 6, borderWidth: 1.5,
    borderColor: 'rgba(255,82,82,0.5)', backgroundColor: 'rgba(0,0,0,0.4)',
  },
  gapCounterBody: { flex: 1 },
  gapCounterName: {
    color: '#E8E4FF', fontSize: 14, fontWeight: '900', letterSpacing: 0.5, marginBottom: 2,
  },
  gapCounterReason: {
    color: 'rgba(255,255,255,0.55)', fontSize: 10, lineHeight: 14,
  },

  confirmBtn: {
    borderWidth: 1, borderRadius: 10,
    paddingVertical: 16, alignItems: 'center',
  },
  confirmBtnText: {
    fontSize: 12, fontWeight: '900', letterSpacing: 2,
  },

  // ── P0-3 · Aviso de POOL DEMO ───────────────────────────────
  poolDemoBanner: {
    borderWidth: 1, borderColor: 'rgba(255,179,0,0.45)',
    backgroundColor: 'rgba(255,179,0,0.08)',
    borderRadius: 8, padding: 10, marginTop: 4, marginBottom: 12,
  },
  poolDemoText: {
    color: 'rgba(255,193,7,0.92)',
    fontSize: 11, lineHeight: 16, fontWeight: '600',
  },

  // ── P2-7 · Aviso de catálogo (fuera del pool) ───────────────
  catalogWarn: {
    borderWidth: 1, borderColor: c.onSurface(0.14),
    backgroundColor: c.onSurface(0.04),
    borderRadius: 6, paddingVertical: 7, paddingHorizontal: 10,
    marginBottom: 8,
  },
  catalogWarnText: {
    color: c.onSurface(0.62),
    fontSize: 11, fontStyle: 'italic', letterSpacing: 0.3,
  },

  // ── P2-1 · Página de runas (op.gg) ──────────────────────────
  runesCard: {
    backgroundColor: c.surface,
    borderWidth: 1, borderColor: c.onSurface(0.10),
    borderRadius: 12, padding: 16, marginBottom: 20, gap: 14,
  },
  runesHeaderRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap',
  },
  runesArchPill: {
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 4, borderWidth: 1,
  },
  runesArchText: { fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  runeAdaptPill: {
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 4, borderWidth: 1, borderColor: 'rgba(255,179,0,0.5)',
    backgroundColor: 'rgba(255,179,0,0.12)',
  },
  runeAdaptText: {
    color: 'rgba(255,193,7,0.95)', fontSize: 8, fontWeight: '900', letterSpacing: 0.8,
  },

  runeTreeBlock: { gap: 8 },
  runeTreeHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  runeTreeDot: { width: 8, height: 8, borderRadius: 4 },
  runeTreeName: { fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  runeTreeKind: {
    color: c.onSurface(0.35), fontSize: 8, fontWeight: '900', letterSpacing: 1.2,
    marginLeft: 'auto',
  },

  keystoneRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  keystoneImg: {
    borderRadius: 22, borderWidth: 1.5,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  keystoneImgFallback: { alignItems: 'center', justifyContent: 'center' },
  keystoneFallbackText: { fontSize: 18, fontWeight: '900' },
  keystoneName: { color: c.textPrimary, fontSize: 14, fontWeight: '900', letterSpacing: 0.5 },
  keystoneSub: { color: c.onSurface(0.40), fontSize: 9, letterSpacing: 1, marginTop: 1 },

  runeMinorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  runeChip: {
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 4, borderWidth: 1,
    backgroundColor: c.onSurface(0.03),
  },
  runeChipText: { color: c.onSurface(0.75), fontSize: 10, fontWeight: '700' },

  fragmentsLabel: {
    color: c.onSurface(0.35), fontSize: 9, fontWeight: '900', letterSpacing: 1.5,
  },
  fragmentsRow: { flexDirection: 'row', gap: 8 },
  fragmentCell: {
    flex: 1, alignItems: 'center',
    borderWidth: 1, borderColor: c.onSurface(0.10), borderRadius: 6,
    paddingVertical: 8, paddingHorizontal: 4,
    backgroundColor: c.onSurface(0.02),
  },
  fragmentKind: {
    color: c.onSurface(0.40), fontSize: 8, fontWeight: '900', letterSpacing: 1, marginBottom: 3,
  },
  fragmentVal: { color: c.textPrimary, fontSize: 10, fontWeight: '700', textAlign: 'center' },

  runeNotes: {
    color: c.onSurface(0.55), fontSize: 11, lineHeight: 16, fontStyle: 'italic',
  },
});
