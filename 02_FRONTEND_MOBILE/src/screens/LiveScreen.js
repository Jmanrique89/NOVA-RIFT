// ============================================================================
// LiveScreen — Tab LIVE-RIFT (primer tab de la app principal)
// ----------------------------------------------------------------------------
// Es la pantalla raíz del tab y actúa como router de la experiencia en partida.
// Decide qué mostrar según el estado del flujo (state liveState + la sesión del
// Riot Live Client en RadarContext):
//
// 'hub' → HubScreen (modo OUT-OF-GAME: rango, KDA, pool, historial).
// 'setup' → mini-pantalla para elegir tu campeón y enemigos a mano.
// 'champSelect' → ChampSelectHelper: recomienda tu pick según el draft rival.
// 'active' → InGameHUD con el análisis en vivo de la partida.
// El modo REAL del Live Client (radar.gameSession.active) tiene precedencia.
//
// Funciones clave: escaneo de un Riot ID que pide el análisis de draft/build al
// backend (/api/v1/...), el motor recommendPick para sugerir campeón, y el aviso
// honesto "POOL DEMO" cuando la cuenta no tiene champion pool guardado.
// Si no hay sesión activa, delega el render en HubScreen.
// ============================================================================
// ── Imports de React y React Native ─────────────────────────────────────────
// React expone los "hooks" (useState, useEffect, etc.); react-native trae los
// componentes básicos de UI: View (contenedor tipo JPanel), Text (texto),
// StyleSheet (estilos como CSS pero en objeto), TouchableOpacity (botón táctil
// con efecto de opacidad, como un JButton con listener), ScrollView (scroll
// vertical tipo JScrollPane), Animated (animaciones), FlatList (lista
// virtualizada que sólo renderiza lo visible, como un JList con renderer
// reciclado), Dimensions (tamaño de pantalla) y Platform (iOS/Android/web).
import React, { useState, useContext, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  ScrollView, Animated, TextInput, Image, Platform,
  FlatList, Dimensions,
} from 'react-native';
// ── Configuración / API ─────────────────────────────────────────────────────
// Constantes de entorno y helpers de mensajes de red. API_BASE_URL es la URL
// del backend; APP_RUNTIME_MODE indica si la app corre en modo REAL o MOCK.
import {
  API_BASE_URL,
  getNetworkUnavailableMessage,
  getRuntimeModeBadge,
  getServiceUnavailableMessage,
  APP_RUNTIME_MODE,
} from '../config/apiConfig';
// ── Contextos (estado global compartido) ─────────────────────────────────────
// useContext lee un contexto/estado global compartido (como inyección de
// dependencias o un singleton accesible). RiotContext aporta riotId y theme;
// UserContext el usuario logado; RadarContext la sesión de partida en vivo.
import { RiotContext } from '../context/RiotContext';
import { useUser } from '../context/UserContext';
import { isDemoAccount } from '../config/demoConfig';
// ── Utils / datos de Riot (Data Dragon) ──────────────────────────────────────
// Helpers para construir URLs de imágenes de campeones/ítems y mapear IDs a
// nombres a partir del dataset oficial "Data Dragon" de Riot.
import {
  getChampionImageUrl,
  getItemImageUrl,
  getItemIdByName,
  CHAMPION_ID_TO_NAME,
  fetchChampionMap,
} from '../utils/dataDragon';
// ── Componentes propios ──────────────────────────────────────────────────────
// Sub-pantallas y widgets reutilizables de NOVA RIFT.
import TacticalIntelligenceHUD from '../components/TacticalIntelligenceHUD';
import AnimatedTacticalBackground from '../components/AnimatedTacticalBackground';
// AuroraBackground retirado del flujo de LiveScreen para evitar el
// tinte verde saturado. Se conserva el archivo y se puede volver a importar
// puntualmente si en el futuro se quiere un wash de fondo en una sub-vista.
// import AuroraBackground from '../components/AuroraBackground';
// ── Mocks / datos de demostración ────────────────────────────────────────────
// Sesiones falsas para el modo DEMO (sin backend).
import { isDemoSummoner, buildDemoLiveSession } from '../mocks/demoSession';
// ── Más componentes propios (sub-pantallas y botones) ────────────────────────
import HubScreen from './HubScreen';
import NovaButton from '../components/NovaButton';
import ChampionImage from '../components/ChampionImage';
import InGameHUD from '../components/InGameHUD';
import ChampSelectHelper from '../components/ChampSelectHelper';
// B4 (DIN2-UD5) — feedback loop bajo la recomendación de pick del setup rápido.
import AIFeedbackButtons from '../components/ai/AIFeedbackButtons';
import { useRadar } from '../context/RadarContext';
import { MOCK_GAME_SESSION } from '../mocks/mockGameSession';
// Catálogo curado de campeones (id + displayName + rol). Lo usamos para
// resolver el nombre legible de cada campeón en el setup de "Iniciar Partida".
import { CHAMPIONS } from '../data/championsCatalog';
import { recommendPick } from '../utils/recommendPick';
// Pool efectivo derivado de las partidas reales (lo publica el Hub). Se usa como
// fallback del pool del asistente antes del pool demo hardcodeado.
import { readEffectivePool } from '../utils/effectivePool';
// ── Theme (tokens de diseño) ─────────────────────────────────────────────────
// TYPE_SCALE: escala tipográfica (tamaños de fuente).
import { TYPE_SCALE } from '../theme/typography';
import { useTheme } from '../context/ThemeContext';

// ─── Constantes ──────────────────────────────────────────────────────────────
// Constante de módulo (equivale a una constante static final en Java): cada
// cuántos ms se sincroniza el inventario contra el Live Client en modo REAL.
const POLL_INTERVAL_MS = 10000; // polling REAL mode cada 10s

// ── Anchos responsive (constantes de módulo) ────────────────────────────────
// Ancho de ventana responsive. Calculamos un slot dinámico para que la fila
// de campeones rivales no se solape en pantallas pequeñas (~360dp) ni quede
// dispersa en tablets. La FlatList de enemigos también lo usa para layout.
const WINDOW_WIDTH = Dimensions.get('window').width;
const CHAMP_SLOT_WIDTH = Math.max(54, Math.min(72, Math.floor((WINDOW_WIDTH - 64) / 6)));

// Padding superior safe-area sin SafeAreaView (evita doble inset cuando el
// LiveScreen se monta dentro de un padre que ya aplica safe area).
const SAFE_TOP_PADDING = Platform.OS === 'ios' ? 44 : 24;

// ─── Helper: oscurece un color hex (gradient simulation sin libs) ────────────
// Función pura de módulo (como un static helper de Java): recibe un color hex
// "#RRGGBB" y devuelve un rgb() más oscuro multiplicando cada canal por factor.
// Se usa para simular un gradiente en el botón del radar sin librerías extra.
function darkenHex(hex, factor = 0.6) {
  if (!hex || !hex.startsWith('#') || hex.length !== 7) return hex;
  const r = Math.round(parseInt(hex.slice(1, 3), 16) * factor);
  const g = Math.round(parseInt(hex.slice(3, 5), 16) * factor);
  const b = Math.round(parseInt(hex.slice(5, 7), 16) * factor);
  return `rgb(${r}, ${g}, ${b})`;
}

// ─── Flujo "Iniciar Partida" — utilidades del setup rápido manual ────────────
// El jugador puede arrancar una partida de demostración eligiendo su campeón y,
// opcionalmente, 1-3 enemigos. Estas funciones de módulo (puras, sin estado)
// alimentan ese setup y construyen la sesión que recibe InGameHUD.

// Mapa id→nombre legible a partir del catálogo curado. Si un id no figura en el
// catálogo (p. ej. un enemigo demo no usado por el motor) caemos al propio id
// como etiqueta — suficiente para un botón de texto.
const CHAMP_NAME_BY_ID = CHAMPIONS.reduce((acc, c) => {
  acc[c.id] = c.displayName;
  return acc;
}, {});
const champLabel = (id) => CHAMP_NAME_BY_ID[id] || id;

// Tope de enemigos seleccionables en el setup rápido.
const MAX_QUICK_ENEMIES = 3;

// Pool de enemigos sugeridos (equipo del mock de referencia + un par de extras).
const QUICK_ENEMY_POOL = ['Garen', 'LeeSin', 'Zed', 'Lucian', 'Morgana', 'Yasuo', 'Thresh', 'Darius'];

// Pool por defecto del jugador cuando su cuenta no tiene campeones guardados.
// Cubre las 5 lanes (TOP/JUNGLE/MID/SUPPORT/ADC) para que la demo siempre tenga
// material. Orden role-diverso y neutral: NO encabeza con Jinx para no
// preseleccionar un ADC concreto cuando el usuario no tiene pool propio.
const DEFAULT_PLAYER_POOL = ['Ahri', 'LeeSin', 'Garen', 'Thresh', 'Caitlyn', 'Zed'];

// Aplana el pool del usuario (acepta string[], {championId}[] o {main,secondary})
// a un array de ids. Si no hay datos, devuelve el pool demo — pero de forma
// HONESTA (Tarea 4): `isFallback: true` + console.log una sola vez, y la
// UI pinta el aviso "POOL DEMO". Con el onboarding actual no debería verse
// nunca; si aparece en la defensa, que sea explícito y no un bug silencioso.
let warnedPoolFallback = false;
function resolvePlayerPool(user) {
  const ch = user?.champions;
  let ids = [];
  if (Array.isArray(ch)) {
    ids = ch.map((c) => (typeof c === 'string' ? c : c?.championId || c?.displayName)).filter(Boolean);
  } else if (ch && typeof ch === 'object') {
    ids = [...(ch.main || []), ...(ch.secondary || ch.sec || [])]
      .map((c) => (typeof c === 'string' ? c : c?.championId || c?.displayName))
      .filter(Boolean);
  }
  if (ids.length > 0) return { ids, isFallback: false };
  // H36-T1 — Antes del pool demo, intentamos el pool efectivo derivado de las
  // partidas reales del jugador (lo publica el Hub al cargar su cuenta). Así la
  // preselección del asistente sale de SUS campeones más jugados (MAIN 1), no
  // del Jinx hardcodeado.
  const derived = readEffectivePool();
  if (Array.isArray(derived) && derived.length > 0) {
    return { ids: derived, isFallback: false };
  }
  if (!warnedPoolFallback) {
    warnedPoolFallback = true;
    // console.log (NO console.warn): la UI ya pinta el aviso "POOL DEMO" desde
    // isFallback; esta traza es solo para el dev y no debe disparar el toast de
    // LogBox en la demo.
    console.log(
      '[LiveScreen] Usuario sin champion pool guardado — usando DEFAULT_PLAYER_POOL (demo). '
      + 'Configura el pool en el onboarding (ChampionPickScreen).'
    );
  }
  return { ids: DEFAULT_PLAYER_POOL, isFallback: true };
}

// Construye la sesión que recibe InGameHUD a partir de las selecciones del
// setup. Usa MOCK_GAME_SESSION como base para la estructura (alertas, coaching,
// mapa…), pero H36-T14: una partida NUEVA arranca DESDE CERO (0/0/0, 500 de oro,
// 0 ítems, minuto 0). El mock midgame (Jinx 3/1/7, 7340 oro) se reserva para el
// modo demo explícito ("SIMULAR PARTIDA"), que usa MOCK_GAME_SESSION directo.
function buildManualSession(playerChampId, enemyChampIds) {
  const ROLES = ['TOP', 'JUNGLE', 'MID', 'ADC', 'SUPPORT'];
  const enemies =
    enemyChampIds && enemyChampIds.length > 0
      ? enemyChampIds.map((id, i) => ({
          champion: id,
          role: ROLES[i % ROLES.length],
          flashUp: true,
          summoners: ['Flash', 'Ignite'],
        }))
      : MOCK_GAME_SESSION.enemies;
  return {
    ...MOCK_GAME_SESSION,
    // P2-6 — Una partida nueva arranca el reloj en 0; el HUD lo hace avanzar en
    // vivo (tick de 1 s) y nos lo devuelve por onTick para mantenerlo aquí.
    gameTime: 0,
    phase: 'EARLY',
    player: {
      ...MOCK_GAME_SESSION.player,
      champion: playerChampId || MOCK_GAME_SESSION.player.champion,
      level:    1,
      kda:      { kills: 0, deaths: 0, assists: 0 },
      cs:       0,
      csPerMin: 0,
      gold:     500,
      items:    [null, null, null, null, null, null],
    },
    enemies,
  };
}

// ─── EnemyChampionItem — slot táctil de campeón enemigo (LazyList FlatList) ──
// Sub-componente: una celda de la lista de campeones rivales. Recibe props
// (parámetros del componente, equivalentes a los parámetros del constructor):
// champ (datos del campeón), selected (si está resaltado), theme (colores),
// slotWidth (ancho calculado) y onSelect (callback al pulsar).
// React.memo evita re-renderizar el componente si sus props no cambiaron (como
// cachear el resultado para args iguales): así la FlatList sólo redibuja los
// dos slots afectados (el anterior y el nuevo) al cambiar la selección.
const EnemyChampionItem = React.memo(function EnemyChampionItem({
  champ, selected, theme, slotWidth, onSelect,
}) {
  const { colors: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  // El return (...) con JSX describe la UI de forma declarativa (como construir
  // el árbol de Swing pero describiendo el QUÉ, no el CÓMO): un botón táctil
  // con la imagen del campeón y su nombre debajo.
  return (
    <TouchableOpacity
      style={[
        styles.champSlot,
        slotWidth ? { width: slotWidth } : null,
        selected && {
          borderColor: c.primary,
          backgroundColor: 'rgba(123,118,221,0.15)',
          borderWidth: 1.5,
          borderRadius: 6,
        },
      ]}
      activeOpacity={0.75}
      onPress={() => onSelect(champ)}
      accessibilityLabel={`Seleccionar enemigo ${champ.displayName || champ.name}`}
      accessibilityState={{ selected }}
    >
      <Image
        source={{ uri: champ.imageUrl }}
        style={[
          styles.champImage,
          { borderColor: selected ? c.primary : theme.primary + '99' },
        ]}
        resizeMode="cover"
      />
      <Text
        style={[
          styles.champName,
          { color: selected ? c.primary : c.textPrimary },
        ]}
        numberOfLines={1}
      >
        {champ.displayName || champ.name}
      </Text>
    </TouchableOpacity>
  );
});

// ─── Componente: ItemTrackerSlot ─────────────────────────────────────────────
// Slot individual de un ítem dentro del ItemTracker. Props: nombre e id del
// ítem, si está comprado (purchased), callback onBuy, theme e index. Muestra
// la imagen del ítem y un botón COMPRAR / badge COMPRADO, con animaciones.
function ItemTrackerSlot({ itemName, itemId, purchased, onBuy, theme, index }) {
  const { colors: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  // useRef: referencia mutable que persiste entre renders sin redibujar (como
  // un campo no observable); con Animated guarda los valores de animación
  // (escala, glow, check y pulso) sin disparar re-renders al cambiarlos.
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const checkAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Pulso en ítems no comprados
  // useEffect: código que se ejecuta al montar el componente (como un
  // constructor / @PostConstruct) o cuando cambian sus dependencias [purchased].
  // Mientras el ítem no esté comprado, anima un pulso en bucle y lo detiene en
  // la función de limpieza (cleanup) al desmontar o al cambiar la dependencia.
  useEffect(() => {
    if (!purchased) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.04, duration: 900, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [purchased]);

  // Animación de compra
  // Otro useEffect que reacciona a [purchased]: al pasar a comprado lanza en
  // paralelo las animaciones de escala, glow verde y check.
  useEffect(() => {
    if (purchased) {
      Animated.parallel([
        Animated.spring(scaleAnim, { toValue: 1, friction: 3, tension: 180, useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 1, duration: 400, useNativeDriver: false }),
        Animated.spring(checkAnim, { toValue: 1, friction: 4, tension: 120, useNativeDriver: true }),
      ]).start();
    }
  }, [purchased]);

  // Handler del botón COMPRAR: anima un "rebote" de escala y avisa al padre
  // (ItemTracker) vía la prop onBuy para que marque el ítem como comprado.
  const handleBuy = () => {
    Animated.sequence([
      Animated.spring(scaleAnim, { toValue: 1.15, friction: 3, tension: 200, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, friction: 4, tension: 150, useNativeDriver: true }),
    ]).start();
    onBuy(itemName);
  };

  // interpolate mapea el valor de animación 0→1 a un rango de salida: aquí el
  // color de borde y de fondo transicionan al verde "comprado" según el glow.
  const borderColor = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [theme.primary + '55', '#4CAF50'],
  });
  const bgColor = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(0,0,0,0.3)', 'rgba(76,175,80,0.15)'],
  });

  // JSX del slot: contenedor animado con imagen del ítem (o placeholder con su
  // nombre), check overlay si está comprado, y botón COMPRAR / badge COMPRADO.
  return (
    <Animated.View
      style={[
        styles.itemSlot,
        {
          transform: [{ scale: purchased ? scaleAnim : pulseAnim }],
          borderColor: purchased ? '#4CAF50' : theme.primary + '66',
          backgroundColor: purchased ? 'rgba(76,175,80,0.12)' : 'rgba(0,0,0,0.3)',
          shadowColor: purchased ? '#4CAF50' : theme.primary,
          shadowOpacity: purchased ? 0.5 : 0.2,
          shadowRadius: purchased ? 10 : 4,
          elevation: purchased ? 6 : 2,
        },
      ]}
    >
      <View style={styles.itemSlotImageWrap}>
        {itemId ? (
          <Image
            source={{ uri: getItemImageUrl(itemId) }}
            style={[
              styles.itemSlotImage,
              { borderColor: purchased ? '#4CAF50' : theme.primary + '88' },
            ]}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.itemSlotImagePlaceholder, { borderColor: theme.primary + '55' }]}>
            <Text style={{ color: theme.primary, fontSize: TYPE_SCALE.micro.size, textAlign: 'center' }}>{itemName}</Text>
          </View>
        )}

        {purchased && (
          <Animated.View
            style={[styles.checkOverlay, { transform: [{ scale: checkAnim }] }]}
          >
            <Text style={styles.checkIcon}>✓</Text>
          </Animated.View>
        )}
      </View>

      <Text
        style={[styles.itemSlotName, { color: purchased ? '#4CAF50' : c.textPrimary }]}
        numberOfLines={2}
      >
        {itemName}
      </Text>

      {!purchased ? (
        <TouchableOpacity
          style={[styles.buyButton, { borderColor: theme.primary, backgroundColor: theme.primary + '22' }]}
          onPress={handleBuy}
          activeOpacity={0.7}
        >
          <Text style={[styles.buyButtonText, { color: theme.primary }]}>COMPRAR</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.purchasedBadge}>
          <Text style={styles.purchasedBadgeText}>COMPRADO</Text>
        </View>
      )}
    </Animated.View>
  );
}

// ─── Componente: ItemTracker ──────────────────────────────────────────────────
// Rastreador de la build: recibe la lista de nombres de ítems recomendados
// (items), el theme y el mode (MOCK/REAL). Pinta una barra de progreso y un
// slot por ítem; en modo REAL sincroniza el inventario contra el Live Client.
function ItemTracker({ items, theme, mode }) {
  const { colors: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  // useState: variable de instancia que, al cambiar, redibuja la pantalla (como
  // un campo Java con notifyObservers). Aquí: conjunto de ítems ya comprados,
  // flag de sincronización en curso y mensaje de estado de la sincronización.
  const [purchasedItems, setPurchasedItems] = useState(new Set());
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState('');
  // useRef: valores que persisten entre renders sin redibujar. progressAnim es
  // el valor de animación de la barra; pollRef guarda el id del setInterval del
  // polling para poder cancelarlo (como un Timer almacenado en un campo).
  const progressAnim = useRef(new Animated.Value(0)).current;
  const pollRef = useRef(null);

  // Fracción 0..1 de progreso: ítems comprados / total.
  const progress = items.length > 0 ? purchasedItems.size / items.length : 0;

  // Animar barra de progreso cuando cambia
  // useEffect que reacciona a [progress]: anima la anchura de la barra hacia el
  // nuevo porcentaje cada vez que se compra (o resetea) un ítem.
  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: progress,
      duration: 600,
      useNativeDriver: false,
    }).start();
  }, [progress]);

  // Polling automático en modo REAL
  // useEffect que se ejecuta al montar y cuando cambian [mode, items]: en modo
  // REAL arranca un setInterval que sincroniza cada POLL_INTERVAL_MS. La función
  // de limpieza (return) cancela el intervalo al desmontar o re-ejecutar.
  useEffect(() => {
    if (mode === 'REAL') {
      pollRef.current = setInterval(syncInventory, POLL_INTERVAL_MS);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [mode, items]);

  // useCallback: función memoizada para no recrearla en cada render (como un
  // método de instancia estable). Añade el ítem pulsado al Set de comprados.
  const handleBuy = useCallback((itemName) => {
    setPurchasedItems(prev => new Set([...prev, itemName]));
  }, []);

  // Sincroniza contra el endpoint del Live Client: pide el inventario real,
  // marca como comprados los ítems de la build que ya aparezcan en él y
  // actualiza el mensaje de estado. Si falla, sugiere abrir el cliente o MOCK.
  const syncInventory = async () => {
    setSyncing(true);
    setSyncStatus('');
    try {
      const res = await fetch(`${API_BASE_URL}/live/client/items`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();

      if (json.items && Array.isArray(json.items)) {
        const serverItemNames = json.items.map(i => i.displayName?.toLowerCase());
        const newPurchased = new Set(purchasedItems);
        items.forEach(itemName => {
          if (serverItemNames.some(n => n.includes(itemName.toLowerCase()))) {
            newPurchased.add(itemName);
          }
        });
        setPurchasedItems(newPurchased);
        setSyncStatus(`Sincronizado · ${json.mode || 'REAL'} · ${json.items.length} ítems en inventario`);
      }
    } catch (e) {
      setSyncStatus('Sin conexión al Live Client. Usa el modo MOCK o abre el cliente de LoL.');
    } finally {
      setSyncing(false);
    }
  };

  // Botón RESET: vacía los ítems comprados y reinicia la barra y el estado.
  const resetTracker = () => {
    setPurchasedItems(new Set());
    progressAnim.setValue(0);
    setSyncStatus('');
  };

  // Mapea el progreso 0..1 a un porcentaje de anchura CSS para la barra.
  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  // Color de la barra según avance: verde al 100%, ámbar >50%, primario si no.
  const progressColor = progress === 1 ? '#4CAF50' : progress > 0.5 ? '#FFC107' : theme.primary;

  // Render guard: si no hay ítems, no se pinta nada (devolver null = no UI).
  if (!items || items.length === 0) return null;

  // JSX: tarjeta con cabecera (título + contador + RESET), barra de progreso,
  // la fila de ItemTrackerSlot, el botón de sincronizar (modo REAL) y el hint.
  return (
    <View style={[styles.trackerContainer, { borderColor: theme.primary + '44' }]}>
      {/* Header */}
      <View style={styles.trackerHeader}>
        <Text style={[styles.trackerTitle, { color: theme.primary }]}>
          ITEM TRACKER
        </Text>
        <View style={styles.trackerHeaderRight}>
          <Text style={[styles.trackerCount, { color: c.textPrimary }]}>
            {purchasedItems.size}/{items.length}
          </Text>
          <TouchableOpacity onPress={resetTracker} style={styles.resetBtn}>
            <Text style={{ color: '#888', fontSize: TYPE_SCALE.caption.size }}>RESET</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Barra de progreso */}
      <View style={styles.progressTrackFull}>
        <Animated.View
          style={[styles.progressFillFull, { width: progressWidth, backgroundColor: progressColor }]}
        />
      </View>
      {progress === 1 && (
        <Text style={styles.completedText}>BUILD COMPLETA · DOMINA EL NEXO</Text>
      )}

      {/* Slots de ítems */}
      <View style={styles.itemSlotsRow}>
        {items.map((itemName, i) => (
          <ItemTrackerSlot
            key={`${itemName}-${i}`}
            itemName={itemName}
            itemId={getItemIdByName(itemName)}
            purchased={purchasedItems.has(itemName)}
            onBuy={handleBuy}
            theme={theme}
            index={i}
          />
        ))}
      </View>

      {/* Modo REAL: sync */}
      {mode === 'REAL' && (
        <TouchableOpacity
          style={[styles.syncButton, { borderColor: theme.primary }]}
          onPress={syncInventory}
          disabled={syncing}
        >
          {syncing
            ? <ActivityIndicator size="small" color={theme.primary} />
            : <Text style={[styles.syncButtonText, { color: theme.primary }]}>
                SINCRONIZAR INVENTARIO
              </Text>
          }
        </TouchableOpacity>
      )}

      {!!syncStatus && (
        <Text style={[styles.syncStatus, { color: syncStatus.includes('Sin') ? '#FFA726' : '#81C784' }]}>
          {syncStatus}
        </Text>
      )}

      <Text style={[styles.trackerModeHint, { color: theme.primary + '88' }]}>
        {mode === 'MOCK'
          ? 'MOCK · Toca COMPRAR al conseguir cada ítem'
          : 'REAL · Sincronización automática cada 10s'}
      </Text>
    </View>
  );
}

// ─── ScanModal — modal de búsqueda de invocador ──────────────────────
// Sustituye al `searchContainer` que vivía dentro del LiveScreen out-of-game.
// Se abre desde el CTA "ACTIVAR RADAR — MODO ASISTENTE" del HubScreen.
// Componente de presentación puro: recibe por props el Riot ID y sus setters,
// los callbacks de cierre/envío y los textos de error. No tiene estado propio.
function ScanModal({
  visible, theme, riotId, setRiotId, onClose, onSubmit,
  inputError, serverError, buttonPulse,
}) {
  const { colors: c } = useTheme();
  // Render guard: si visible es false no se monta nada (modal oculto).
  if (!visible) return null;

  // JSX: overlay oscuro a pantalla completa (toque fuera = cerrar) con una
  // glass card centrada que contiene el input de Riot ID y el botón ACTIVAR.
  return (
    <View style={modalStyles.overlay}>
      <TouchableOpacity
        style={StyleSheet.absoluteFillObject}
        activeOpacity={1}
        onPress={onClose}
      />
      <View
        style={[
          modalStyles.card,
          {
            backgroundColor: 'rgba(7,7,13,0.85)',
            borderColor: theme.primary + '66',
            shadowColor: theme.primary,
            ...(Platform.OS === 'web'
              ? { backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)' }
              : {}),
          },
        ]}
      >
        {/* Cierre */}
        <TouchableOpacity style={modalStyles.closeBtn} onPress={onClose} activeOpacity={0.7}>
          <Text style={[modalStyles.closeText, { color: c.textPrimary + '88' }]}>×</Text>
        </TouchableOpacity>

        <Text style={[modalStyles.glyph, { color: theme.primary + 'CC' }]}>◉</Text>
        <Text style={[modalStyles.title, { color: theme.primary, textShadowColor: theme.primary }]}>
          ACTIVAR RADAR
        </Text>
        <Text style={[modalStyles.subtitle, { color: c.textPrimary + '88' }]}>
          Introduce tu Riot ID para iniciar el análisis
        </Text>

        <Text style={[modalStyles.inputLabel, { color: theme.primary + 'AA' }]}>INVOCADOR</Text>
        <TextInput
          style={[
            modalStyles.input,
            {
              color: theme.text,
              borderColor: inputError ? '#FF5252' : theme.primary + '55',
              backgroundColor: 'rgba(0,0,0,0.4)',
            },
          ]}
          placeholder="GameName-TAG (ej: NovaRift-EUW)"
          placeholderTextColor={theme.text + '44'}
          value={riotId}
          onChangeText={setRiotId}
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus
          onSubmitEditing={onSubmit}
        />
        {!!inputError && <Text style={modalStyles.error}>{inputError}</Text>}
        {!!serverError && <Text style={modalStyles.warn}>{serverError}</Text>}

        <Animated.View style={{ transform: [{ scale: buttonPulse }], marginTop: 14 }}>
          <NovaButton
            label="◉ ACTIVAR RADAR"
            onPress={onSubmit}
            factionColor={theme.primary}
            size="lg"
          />
        </Animated.View>

        <Text style={[modalStyles.hint, { color: theme.text + '55' }]}>
          Usa tu cuenta de Riot para activar el radar
        </Text>
      </View>
    </View>
  );
}

// ── Estilos del ScanModal ────────────────────────────────────────────────────
// StyleSheet.create() define los estilos (equivalente a CSS pero como objeto
// Java): claves reutilizables que luego se aplican vía la prop `style`.
const modalStyles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 440,
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 24,
    shadowOpacity: 0.55,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 0 },
    elevation: 18,
  },
  closeBtn: {
    position: 'absolute', top: 8, right: 12,
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  closeText: { fontSize: TYPE_SCALE.h3.size, fontWeight: '300', lineHeight: 28 },
  glyph: { fontSize: TYPE_SCALE.h1.size, textAlign: 'center', marginBottom: 4 },
  title: {
    fontSize: TYPE_SCALE.h4.size, fontWeight: '900', letterSpacing: 4,
    textAlign: 'center',
    textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 14,
  },
  subtitle: {
    fontSize: TYPE_SCALE.caption.size, textAlign: 'center',
    marginTop: 6, marginBottom: 20, letterSpacing: 0.5,
  },
  inputLabel: {
    fontSize: TYPE_SCALE.micro.size, fontWeight: '900', letterSpacing: 2.5,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1, borderRadius: 8, padding: 14,
    fontSize: TYPE_SCALE.body.size,
  },
  error: { color: '#FF5252', fontSize: TYPE_SCALE.caption.size, marginTop: 6 },
  warn:  { color: '#FFA726', fontSize: TYPE_SCALE.caption.size, marginTop: 6 },
  hint: {
    fontSize: TYPE_SCALE.caption.size, textAlign: 'center', marginTop: 14, letterSpacing: 0.5,
  },
});

// ─── Pantalla principal: LiveScreen ──────────────────────────────────────────
// Componente-pantalla raíz del tab LIVE-RIFT. Orquesta varios "estados" de
// flujo (hub → champSelect → active, más la sesión REAL del Live Client) y, en
// el modo de escaneo clásico, muestra el análisis de draft y build del rival.
export default function LiveScreen() {
  // ── Estado local del componente ────────────────────────────────────────────
  // useState declara variables de instancia que, al cambiar, redibujan la
  // pantalla (como un campo Java con notifyObservers).
  // loading: hay un escaneo en curso (muestra spinner / "ESCANEANDO…").
  // data: payload procesado de la sesión (draft + build); null = sin datos.
  // buildOptions: variantes de build disponibles; selectedBuildIndex: cuál se ve.
  // championMap: diccionario id→info de campeón descargado de Data Dragon.
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [buildOptions, setBuildOptions] = useState([]);
  const [selectedBuildIndex, setSelectedBuildIndex] = useState(0);
  const [championMap, setChampionMap] = useState(null);
  // useContext lee un contexto/estado global compartido (como inyección de
  // dependencias o un singleton): aquí el Riot ID actual, su setter y el theme.
  const { riotId, setRiotId, theme } = useContext(RiotContext);
  // Tema claro/oscuro (superficies neutras). En oscuro `c` reproduce los
  // valores actuales pixel a pixel; sólo cambian en modo claro. `isDark` gobierna
  // la visibilidad de las decoraciones de fondo oscuras (grid táctico).
  const { colors: c, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const setupStyles = useMemo(() => makeSetupStyles(c), [c]);
  // Usuario autenticado (UserContext). Lo usamos sólo para sugerir su propio
  // Riot ID en el hint del radar — NO afecta a la lógica de escaneo.
  // useUser() es un hook de contexto (lee el estado global del usuario logado).
  const { user } = useUser();
  // Riot ID real del jugador logado: directo si viene formado, o ensamblado
  // desde username + tag (mismo criterio que Hub/Profile). Null si no hay dato.
  const userRiotId = user?.riotId
    || (user?.username
      ? (user.username.includes('#') ? user.username : `${user.username}#${user?.tag || 'EUW'}`)
      : null);
  // Texto de ayuda del radar: si conocemos el Riot ID del usuario lo sugerimos;
  // si no, mensaje genérico. Antes mostraba "Faker#EUW" (cuenta demo) de forma
  // fija, lo que delataba el modo demostración.
  const radarHint = userRiotId
    ? `Usa ${userRiotId} para activar el radar`
    : 'Usa tu cuenta de Riot para activar el radar';
  // Más useState (variables observables que redibujan al cambiar):
  // inputError: error de validación del input; serverError: error del backend.
  const [inputError, setInputError] = useState('');
  const [serverError, setServerError] = useState('');
  // modal de scan que se abre desde el CTA del HubScreen out-of-game
  const [scanModalVisible, setScanModalVisible] = useState(false);
  // P6: vista detalle formal del campeón rival al hacer click sobre su slot
  const [championDetail, setChampionDetail] = useState(null);
  // Selección visual del campeón rival (borde + fondo). Independiente del
  // modal de detalle: el tap aplica selección instantánea y abre la ficha.
  const [selectedEnemyKey, setSelectedEnemyKey] = useState(null);
  // acceso al RadarContext para leer gameSession (partida en vivo).
  // useRadar() es un hook de contexto: lee/escribe el estado global del radar
  // (la partida en curso, el campeón seleccionado, etc.) como un singleton.
  const radar = useRadar();
  // flujo `hub → champSelect → active` (sustituye al scan modal).
  // 'hub' → HubScreen (out-of-game).
  // 'champSelect' → ChampSelectHelper (asistente de pick).
  // 'active' → InGameHUD controlado por flujo manual; el botón del
  // HUD llama `onExit()` que vuelve a 'hub'.
  // El branch `radar.gameSession?.active` (modo REAL del Riot Live Client)
  // sigue teniendo precedencia sobre todos.
  const [liveState, setLiveState] = useState('hub'); // 'hub' | 'setup' | 'champSelect' | 'active'
  const [enemyPicks, setEnemyPicks] = useState([]);
  // picks aliados (max 4 — el 5º slot es el propio jugador). Por ahora
  // sólo se persisten para que el motor `recommendPick` los reciba como
  // contexto futuro de sinergias (composición propia).
  const [allyPicks, setAllyPicks] = useState([]);

  // ── Flujo "Iniciar Partida" (setup rápido manual) ──────────────────────────
  // 'setup' es un estado de `liveState`: una mini-pantalla donde el jugador
  // elige su campeón (obligatorio) y de 1 a 3 enemigos (opcional) antes de
  // lanzar el HUD. La sesión construida se guarda en `manualSession` y se pasa
  // DIRECTAMENTE a InGameHUD; NO usamos radar.openWithSession aquí, para no
  // disparar el branch de precedencia `radar.gameSession?.active` (que monta el
  // HUD sin `onExit`). Así "FINALIZAR PARTIDA" siempre vuelve limpio al hub.
  const [setupChampion, setSetupChampion] = useState(null); // id del campeón propio
  const [setupEnemies, setSetupEnemies] = useState([]);     // ids enemigos (máx 3)
  const [manualSession, setManualSession] = useState(null); // sesión construida

  // P2-6 / A1 — El HUD avisa cada segundo (onTick) del tiempo de partida
  // transcurrido; sincronizamos el gameTime de la sesión manual ACTIVA con ese
  // valor (absoluto, idempotente). ADEMÁS lo empujamos a `radar.gameSession`
  // para que el FloatingRadarWidget ("… · EN VIVO") muestre ESE MISMO reloj en
  // vivo en lugar de quedarse fijo en 0:00 (el widget lee gameSession.gameTime).
  // useCallback con setGameSession (setter estable) → identidad estable.
  const handleHudTick = useCallback(
    (secs) => {
      setManualSession((s) => (s ? { ...s, gameTime: secs } : s));
      radar.setGameSession?.((g) => (g ? { ...g, gameTime: secs } : g));
    },
    [radar.setGameSession],
  );

  // H36-T13 — Preselección: al entrar al setup, el campeón propio arranca en el
  // MAIN 1 del pool efectivo (resolvePlayerPool ya prioriza onboarding → pool
  // derivado de partidas reales → demo), nunca en vacío ni en Jinx hardcodeado.
  // El usuario puede cambiarlo tocando otro chip del pool.
  useEffect(() => {
    if (liveState === 'setup' && !setupChampion) {
      const { ids } = resolvePlayerPool(user);
      if (Array.isArray(ids) && ids.length > 0) setSetupChampion(ids[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveState]);

  // Animaciones
  // useRef con Animated.Value: referencias mutables que persisten entre renders
  // sin redibujar y guardan el progreso de cada animación (fade de resultados,
  // línea de escaneo, pulso del botón y glow del header).
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scanLineAnim = useRef(new Animated.Value(-1)).current;
  const buttonPulse = useRef(new Animated.Value(1)).current;
  const headerGlow = useRef(new Animated.Value(0)).current;

  // Pulso del botón cuando no hay datos
  // useEffect que reacciona a [data, loading]: si aún no hay resultados ni
  // carga, anima un pulso del botón en bucle (cleanup lo detiene); si los hay,
  // fija la escala a 1.
  useEffect(() => {
    if (!data && !loading) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(buttonPulse, { toValue: 1.03, duration: 1200, useNativeDriver: true }),
          Animated.timing(buttonPulse, { toValue: 1, duration: 1200, useNativeDriver: true }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
    buttonPulse.setValue(1);
  }, [data, loading]);

  // Efecto de escaneo (scanline) durante loading
  // useEffect ligado a [loading]: mientras carga, reproduce en bucle la línea de
  // escaneo que cruza la pantalla; al terminar, la reinicia fuera de vista.
  useEffect(() => {
    if (loading) {
      scanLineAnim.setValue(-1);
      Animated.loop(
        Animated.timing(scanLineAnim, { toValue: 1, duration: 1400, useNativeDriver: true })
      ).start();
    } else {
      scanLineAnim.setValue(-1);
    }
  }, [loading]);

  // Glow del header animado
  // useEffect con deps [] (vacías): se ejecuta una sola vez al montar (como un
  // constructor / @PostConstruct) y arranca el bucle de resplandor del header.
  useEffect(() => {
    const glow = Animated.loop(
      Animated.sequence([
        Animated.timing(headerGlow, { toValue: 1, duration: 2000, useNativeDriver: false }),
        Animated.timing(headerGlow, { toValue: 0, duration: 2000, useNativeDriver: false }),
      ])
    );
    glow.start();
    return () => glow.stop();
  }, []);

  // useEffect de montaje (deps []): descarga el mapa de campeones de Data Dragon
  // de forma asíncrona y lo guarda en el estado cuando llega.
  useEffect(() => {
    fetchChampionMap().then(map => { if (map) setChampionMap(map); });
  }, []);

  // Normaliza el objeto de build del backend a un array uniforme de variantes
  // (cada una con label, primaryTarget, items y tactics). Si no hay variantes,
  // construye una única "Build Base" a partir de los campos sueltos.
  const normalizeBuildOptions = (parsedBuild) => {
    if (Array.isArray(parsedBuild.variants) && parsedBuild.variants.length > 0) {
      return parsedBuild.variants.map((variant, index) => ({
        label: variant.name || `Build ${index + 1}`,
        primaryTarget: variant.primaryTarget || parsedBuild.primaryTarget || 'Sin objetivo',
        items: Array.isArray(variant.items) ? variant.items : [],
        tactics: variant.tactics || parsedBuild.tactics || '',
      }));
    }
    return [{
      label: 'Build Base',
      primaryTarget: parsedBuild.primaryTarget || 'Sin objetivo',
      items: Array.isArray(parsedBuild.items) ? parsedBuild.items : [],
      tactics: parsedBuild.tactics || '',
    }];
  };

  // Traduce un código HTTP de error a un mensaje legible en español (prioriza
  // el mensaje que venga del backend si existe). Es un simple switch de strings.
  const messageForStatus = (statusCode, backendError) => {
    if (backendError) return backendError;
    if (statusCode === 400) return 'Solicitud inválida. Revisa el nombre del invocador.';
    if (statusCode === 405) return 'Método no permitido por el servidor.';
    if (statusCode === 429) return 'Demasiadas solicitudes a Riot API. Espera unos segundos.';
    if (statusCode === 502) return 'Error de conexión con Riot API. Verifica la API Key.';
    if (statusCode === 503) return getServiceUnavailableMessage();
    return `Error inesperado del servidor (${statusCode}).`;
  };

  // Parsea el patrón de draft enemigo (JSON de Riot/backend) y lo transforma en
  // un objeto con la composición rival: filtra el equipo 100, resuelve nombre e
  // imagen de cada campeón vía championMap y arma un resumen. Si falla, devuelve
  // un objeto MOCK de fallback en lugar de lanzar (no rompe la pantalla).
  const parseRiotData = (rawJson) => {
    try {
      const data = typeof rawJson === 'string' ? JSON.parse(rawJson) : rawJson;
      const getChampInfo = (championId) => {
        if (championMap && championMap[championId]) return championMap[championId];
        const name = CHAMPION_ID_TO_NAME[championId];
        return name ? { name, displayName: name, tags: [] } : null;
      };
      const team100 = (data.participants || []).filter(p => p.teamId === 100);
      const champions = team100
        .map(p => {
          const champInfo = getChampInfo(p.championId);
          return champInfo ? {
            id: p.championId,
            name: champInfo.name,
            displayName: champInfo.displayName,
            tags: champInfo.tags || [],
            imageUrl: getChampionImageUrl(champInfo.name),
          } : null;
        })
        .filter(Boolean);
      const gameMode = data.gameMode === 'CLASSIC' ? 'Partida Ranked' : (data.gameMode || 'Partida');
      return {
        threatLevel: 'Detectada',
        composition: `${gameMode} — ${champions.length} campeones rivales`,
        champions,
        team: champions.map(c => c.displayName || c.name).join(', '),
      };
    } catch (e) {
      return {
        threatLevel: 'MOCK',
        composition: String(rawJson).substring(0, 120),
        champions: [],
        team: '',
      };
    }
  };

  // Transforma el JSON (real o mock) en el shape del state.
  // Punto único de "ingesta": parsea draft y build, vuelca todo en `data` (vía
  // setData), prepara las variantes de build y dispara el fade-in de resultados.
  const ingestSessionJson = (json) => {
    let parsedDraft = {};
    let parsedBuild = {};
    try { parsedDraft = parseRiotData(json.enemyDraftPattern); }
    catch (_) { parsedDraft = { composition: String(json.enemyDraftPattern).substring(0, 120), threatLevel: 'Desconocida', champions: [] }; }
    try { parsedBuild = JSON.parse(json.recommendedFirstBuy); }
    catch (_) { parsedBuild = { primaryTarget: String(json.recommendedFirstBuy) }; }

    setData({
      summoner: json.summonerName,
      draft: parsedDraft,
      build: parsedBuild,
      recommendationVersion: json.recommendationVersion,
      recommendationScore: json.recommendationScore,
      recommendationTotalScore: json.recommendationTotalScore ?? json.recommendationScore,
      recommendationBreakdown: json.recommendationBreakdown ? JSON.parse(json.recommendationBreakdown) : null,
      recommendationConfidence: json.recommendationConfidence,
      recommendationItems:    Array.isArray(json.recommendationItems)    ? json.recommendationItems    : [],
      recommendationReasons:  Array.isArray(json.recommendationReasons)  ? json.recommendationReasons  : [],
      threatAssessment:       json.threatAssessment || null,
      isMockClientSide:       json.isMockClientSide === true,
    });
    setBuildOptions(normalizeBuildOptions(parsedBuild));
    setSelectedBuildIndex(0);
    Animated.timing(fadeAnim, { toValue: 1, duration: 900, useNativeDriver: true }).start();
  };

  // ── Activa el radar para el Riot ID introducido ────────────────────────
  // Flujo: (1) cuentas demo (NovaRift/DEMO/MOCK) → sesión mock client-side sin
  // tocar el backend; (2) resto → health-check y POST /live/start a Riot vía
  // backend; (3) si el backend no responde, mostramos un error y ofrecemos el
  // modo offline. Así nunca dejamos la pantalla en blanco.
  // Función async (devuelve una Promise, como un método que retorna Future): usa
  // fetch() para llamar al backend y await para esperar la respuesta.
  const startLiveSession = async () => {
    const normalizedRiotId = (riotId || '').trim();
    if (!normalizedRiotId) {
      setInputError('Introduce un Riot ID válido antes de activar el radar.');
      setServerError('');
      return;
    }
    setInputError('');
    setServerError('');
    setLoading(true);
    setData(null);
    setBuildOptions([]);
    setSelectedBuildIndex(0);
    fadeAnim.setValue(0);

    // ─── Cuentas demo: servir el mock client-side sin tocar el backend ──────
    // Incluye los summoners de prueba (NovaRift/DEMO/MOCK) y la cuenta demo
    // oficial FAKER. El resto de cuentas van al backend y, si Riot falla, ven
    // el error real — nunca mocks silenciosos.
    if (isDemoSummoner(normalizedRiotId) || isDemoAccount(normalizedRiotId)) {
      setTimeout(() => {
        ingestSessionJson(buildDemoLiveSession(normalizedRiotId));
        setLoading(false);
      }, 600);
      return;
    }

    // ─── Health-check rápido (Bloque 1.2) — evita timeout de 8s si no hay backend
    try {
      const health = await fetch(`${API_BASE_URL.replace('/api/v1', '')}/api/health`, {
        signal: AbortSignal.timeout ? AbortSignal.timeout(2500) : undefined,
      });
      if (!health.ok) throw new Error('health-not-ok');
    } catch (_) {
      setServerError(`Backend no disponible. Usa NovaRift para modo DEMO offline (escribe NovaRift y vuelve a pulsar).`);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
      const response = await fetch(`${API_BASE_URL}/live/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ summonerName: normalizedRiotId, imageHash: 'live-session-v1' }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        let backendMessage = '';
        try { const errorJson = await response.json(); backendMessage = errorJson?.error || ''; } catch (_) {}
        const mappedMessage = messageForStatus(response.status, backendMessage);
        setServerError(mappedMessage);
        const httpError = new Error(mappedMessage);
        httpError.isHttpError = true;
        throw httpError;
      }

      const json = await response.json();
      ingestSessionJson(json);
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        setServerError(`Tiempo de espera agotado. Verifica que el backend está en ${API_BASE_URL}`);
      } else if (!error.isHttpError) {
        // Fallback de seguridad: si no hay backend, ofrecer modo demo
        setServerError(`${getNetworkUnavailableMessage()}  (Tip: escribe NovaRift y vuelve a pulsar para usar modo DEMO sin backend)`);
      }
    } finally {
      setLoading(false);
    }
  };

  // Mapea el valor animado del header (0..1) a un color con opacidad creciente,
  // produciendo el efecto de resplandor pulsante del borde inferior.
  const glowColor = headerGlow.interpolate({
    inputRange: [0, 1],
    outputRange: [theme.primary + '33', theme.primary + 'AA'],
  });

  // Variante de build actualmente seleccionada (la que se muestra en pantalla).
  const currentBuild = buildOptions[selectedBuildIndex];

  // Cuando no hay sesión activa, el tab
  // LIVE-RIFT renderiza HubScreen como modo OUT-OF-GAME. El input de Riot ID
  // se abre en un modal flotante al pulsar ACTIVAR RADAR.
  // Handler de envío del ScanModal: cierra el modal y lanza el escaneo.
  const handleScanSubmit = () => {
    setScanModalVisible(false);
    startLiveSession();
  };

  // Tercer estado: partida en curso. La sesión vive en RadarContext y se
  // activa desde el botón " SIMULAR PARTIDA EN VIVO" del HubScreen (modo
  // demo) o, en producción, cuando el detector de Riot Live Client la informe.
  // Este branch tiene precedencia sobre todos los demás.
  // ── Branch 1 (máxima precedencia): partida REAL en curso ───────────────────
  // Si el Riot Live Client reporta una partida activa, renderizamos el HUD de
  // partida a pantalla completa y nada más. Es un "return temprano" del render:
  // los demás branches de abajo ni se evalúan.
  if (radar.gameSession?.active) {
    return (
      <View style={[styles.container, { backgroundColor: c.bg1 }]}>
        {/* Pasamos al HUD únicamente la sesión activa del RadarContext. A1 —
            onTick mantiene el reloj del widget flotante en vivo también en el
            modo demo (radar.gameSession), igual que en el flujo manual. */}
        <InGameHUD
          session={radar.gameSession}
          onTick={handleHudTick}
        />
      </View>
    );
  }

  // Estado `active`: InGameHUD controlado por flujo manual. Se llega
  // desde champSelect al confirmar pick. El del HUD ejecuta `onExit` que
  // vuelve al hub. Nota: cuando llegue una sesión REAL del Riot Live Client
  // (`radar.gameSession?.active`), ese branch tiene precedencia más arriba.
  //
  // fallback defensivo a `MOCK_GAME_SESSION`: el ChampSelect
  // ya dispara `radar.openWithSession(MOCK_GAME_SESSION)` antes de cambiar
  // a este estado, pero si por algún edge case `radar.gameSession` llega
  // null aquí (race condition al inicializar) usamos el mock directo en
  // lugar de pasar `null` al HUD (que renderiza pantalla en negro).
  // ── Branch 2: estado `active` por flujo manual (champSelect → active) ───────
  // Mismo HUD de partida, pero alimentado por el flujo manual. session usa el
  // fallback a MOCK_GAME_SESSION si radar.gameSession llegara null.
  // onExit es el callback del botón que devuelve al estado 'hub'.
  if (liveState === 'active') {
    return (
      <View style={[styles.container, { backgroundColor: c.bg1 }]}>
        <InGameHUD
          // Prioridad de la sesión: flujo manual (setup rápido) → RadarContext
          // (champSelect/demo) → mock como último fallback defensivo.
          session={manualSession || radar.gameSession || MOCK_GAME_SESSION}
          // P2-6 — El HUD lleva el reloj en vivo y, cada segundo, nos avisa con
          // onTick(segundos). Sincronizamos el gameTime de la sesión manual ACTIVA
          // con ese valor. Si la sesión no es la manual (demo/real), handleHudTick
          // no toca nada y el HUD avanza igualmente con su reloj interno.
          onTick={handleHudTick}
          onExit={() => {
            // FINALIZAR PARTIDA → limpiamos la sesión manual y las selecciones,
            // cerramos el widget de radar (por si la sesión venía de champSelect)
            // y volvemos al hub.
            setManualSession(null);
            setSetupChampion(null);
            setSetupEnemies([]);
            radar.close?.();
            setLiveState('hub');
          }}
        />
      </View>
    );
  }

  // ── Branch 2.5: estado `setup` (flujo "Iniciar Partida" — setup rápido) ─────
  // Mini-pantalla de pre-partida. El jugador elige su campeón del pool
  // (obligatorio) y, opcionalmente, hasta 3 enemigos. "LANZAR PARTIDA" construye
  // la sesión desde esas selecciones (sobre MOCK_GAME_SESSION) y entra al HUD.
  if (liveState === 'setup') {
    const { ids: playerPool, isFallback: poolIsFallback } = resolvePlayerPool(user);
    // Añade/quita un enemigo respetando el tope de 3.
    const toggleEnemy = (id) => {
      setSetupEnemies((prev) => {
        if (prev.includes(id)) return prev.filter((e) => e !== id);
        if (prev.length >= MAX_QUICK_ENEMIES) return prev;
        return [...prev, id];
      });
    };
    // Construye la sesión y entra al HUD.
    const launchManualGame = () => {
      if (!setupChampion) return;
      setManualSession(buildManualSession(setupChampion, setupEnemies));
      setLiveState('active');
    };

    // Recomendación en vivo: se recalcula cada vez que cambian enemigos o pool.
    const userPool = playerPool;
    const rec = setupEnemies.length > 0
      ? recommendPick(setupEnemies, userPool, {})
      : null;

    // Helper: render de un chip de campeón con imagen de Data Dragon.
    const ChampChip = ({ id, selected, onPress, disabled, accentColor }) => (
      <TouchableOpacity
        onPress={onPress}
        disabled={disabled}
        activeOpacity={0.85}
        style={[
          setupStyles.champChip,
          selected && { borderColor: accentColor, borderWidth: 2 },
          disabled && !selected && { opacity: 0.3 },
        ]}
      >
        <Image
          source={{ uri: getChampionImageUrl(id) }}
          style={[
            setupStyles.champChipImg,
            selected && { opacity: 1 },
            !selected && { opacity: 0.75 },
          ]}
          resizeMode="cover"
        />
        {selected && (
          <View style={[setupStyles.champChipBadge, { backgroundColor: accentColor }]} />
        )}
        <Text style={[
          setupStyles.champChipName,
          selected && { color: accentColor, fontWeight: '700' },
        ]} numberOfLines={1}>
          {champLabel(id)}
        </Text>
      </TouchableOpacity>
    );

    return (
      <View style={[styles.container, { backgroundColor: c.bg1 }]}>
        {isDark && <AnimatedTacticalBackground theme={theme} intensity="normal" />}
        <ScrollView
          contentContainerStyle={setupStyles.scroll}
          showsVerticalScrollIndicator={false}
        >
          <TouchableOpacity
            onPress={() => setLiveState('hub')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={setupStyles.backLink}>← VOLVER</Text>
          </TouchableOpacity>

          <Text style={[setupStyles.title, { color: theme.primary }]}>INICIAR PARTIDA</Text>
          <Text style={setupStyles.subtitle}>Elige tu campeón y marca los rivales</Text>

          {/* ── 1. Campeón propio ──────────────────────────────────────────── */}
          <Text style={setupStyles.sectionLabel}>TU CAMPEÓN</Text>
          {/* Aviso honesto cuando el pool mostrado es el de demo y no el del
              usuario. No debería verse con el onboarding completo. */}
          {poolIsFallback && (
            <Text style={setupStyles.poolFallbackNotice}>
              ⚠ CHAMPION POOL DEMO — tu cuenta no tiene campeones guardados.
              Configura tu champion pool desde el onboarding para ver el tuyo aquí.
            </Text>
          )}
          <View style={setupStyles.chipGrid}>
            {playerPool.map((id) => (
              <ChampChip
                key={`me-${id}`}
                id={id}
                selected={setupChampion === id}
                onPress={() => setSetupChampion(id)}
                accentColor={theme.primary}
              />
            ))}
          </View>

          {/* ── 2. Enemigos ───────────────────────────────────────────────── */}
          <Text style={[setupStyles.sectionLabel, { marginTop: 20 }]}>
            ENEMIGOS · OPCIONAL ({setupEnemies.length}/{MAX_QUICK_ENEMIES})
          </Text>
          <View style={setupStyles.chipGrid}>
            {QUICK_ENEMY_POOL.map((id) => {
              const selected = setupEnemies.includes(id);
              const full = !selected && setupEnemies.length >= MAX_QUICK_ENEMIES;
              return (
                <ChampChip
                  key={`vs-${id}`}
                  id={id}
                  selected={selected}
                  onPress={() => toggleEnemy(id)}
                  disabled={full}
                  accentColor="#FF5252"
                />
              );
            })}
          </View>

          {/* ── 3. Card de recomendación (aparece cuando hay enemigos) ────── */}
          {rec && (
            <View style={[setupStyles.recCard, { borderColor: theme.primary + '55' }]}>
              <Text style={[setupStyles.recHeader, { color: theme.primary }]}>
                ⚡ RECOMENDACIÓN
              </Text>
              <View style={setupStyles.recChampRow}>
                <Image
                  source={{ uri: getChampionImageUrl(rec.champion) }}
                  style={setupStyles.recChampImg}
                  resizeMode="cover"
                />
                <View style={{ flex: 1 }}>
                  <Text style={[setupStyles.recChampName, { color: theme.primary }]}>
                    {rec.champion}
                  </Text>
                  <View style={[
                    setupStyles.recConfBadge,
                    {
                      backgroundColor:
                        rec.confidence === 'HIGH'   ? 'rgba(76,175,80,0.2)'  :
                        rec.confidence === 'MEDIUM' ? 'rgba(255,179,0,0.2)'  :
                                                      c.onSurface(0.08),
                    },
                  ]}>
                    <Text style={[
                      setupStyles.recConfText,
                      {
                        color:
                          rec.confidence === 'HIGH'   ? '#4CAF50' :
                          rec.confidence === 'MEDIUM' ? '#FFB300'  :
                                                        c.onSurface(0.5),
                      },
                    ]}>
                      {rec.confidence === 'HIGH' ? '● ALTA CONFIANZA' :
                       rec.confidence === 'MEDIUM' ? '● CONFIANZA MEDIA' :
                       '● CONFIANZA BAJA'}
                    </Text>
                  </View>
                </View>
              </View>
              {rec.reason ? (
                <Text style={setupStyles.recReason}>{rec.reason}</Text>
              ) : null}
              {rec.detail?.goodMatchups?.length > 0 && (
                <Text style={setupStyles.recDetail}>
                  ✓ Fuerte contra: {rec.detail.goodMatchups.join(', ')}
                </Text>
              )}
              {rec.detail?.badMatchups?.length > 0 && (
                <Text style={[setupStyles.recDetail, { color: '#FF8A65' }]}>
                  ⚠ Cuidado con: {rec.detail.badMatchups.join(', ')}
                </Text>
              )}
              {/* B4 (DIN2-UD5) — feedback loop de la recomendación */}
              <AIFeedbackButtons
                tipo="champ_pick"
                id={rec.champion}
                accentColor={theme.primary}
              />
            </View>
          )}

          {/* ── 4. Lanzar ─────────────────────────────────────────────────── */}
          <View style={setupStyles.launchWrap}>
            <NovaButton
              label={setupChampion ? `LANZAR CON ${champLabel(setupChampion).toUpperCase()}` : 'ELIGE TU CAMPEÓN'}
              onPress={launchManualGame}
              factionColor={theme.primary}
              size="lg"
              disabled={!setupChampion}
            />
          </View>

          <TouchableOpacity
            onPress={() => setLiveState('champSelect')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={setupStyles.advancedLink}>
              ¿Dudas con el pick? Abrir asistente avanzado →
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // Champion Select Helper. Se llega desde el CTA "ACTIVAR RADAR" del
  // HubScreen. confirmar pick va DIRECTO a 'active' (el ScanModal queda
  // descontinuado en el flujo principal).
  //
  // al confirmar, además de `setLiveState('active')`, también
  // disparamos `radar.openWithSession(MOCK_GAME_SESSION)` para que el HUD
  // tenga datos reales en `radar.gameSession`. Sin esto el HUD recibía null
  // y se quedaba en negro hasta que el usuario tocaba "SIMULAR PARTIDA".
  // ── Branch 3: estado `champSelect` (asistente de selección de campeón) ──────
  // Pantalla de pre-partida: el usuario registra picks enemigos/aliados. onBack
  // resetea ambos lados y vuelve al hub; onConfirm fija el campeón elegido, abre
  // la sesión mock en el RadarContext y salta al estado 'active' (branch 2).
  if (liveState === 'champSelect') {
    return (
      <View style={[styles.container, { backgroundColor: c.bg1 }]}>
        <ChampSelectHelper
          enemyPicks={enemyPicks}
          setEnemyPicks={setEnemyPicks}
          allyPicks={allyPicks}
          setAllyPicks={setAllyPicks}
          onBack={() => {
            // al volver al hub, reseteamos AMBOS lados del champ select
            // para que la siguiente partida no arrastre los picks anteriores.
            setEnemyPicks([]);
            setAllyPicks([]);
            setLiveState('hub');
          }}
          onConfirm={(champ) => {
            // Construye sesión real con el campeón elegido y los enemigos
            // registrados en el champ select. Así el HUD tiene los datos
            // correctos desde el primer frame en lugar del mock genérico.
            const session = buildManualSession(champ, enemyPicks);
            setManualSession(session);
            radar.setSelectedChampion?.(champ);
            radar.openWithSession?.(session);
            setLiveState('active');
          }}
        />
      </View>
    );
  }

  // ── Branch 4: estado `hub` (out-of-game, sin escaneo en curso) ──────────────
  // Sin datos y sin carga: mostramos el HubScreen. Su CTA "ACTIVAR RADAR" salta
  // a champSelect (branch 3). navigate equivalente: cambiar el estado de flujo
  // hace de "router" interno entre estas vistas.
  if (!data && !loading) {
    return (
      <View style={[styles.container, { backgroundColor: c.bg1 }]}>
        {/* La CTA "INICIAR PARTIDA" del HubScreen va directamente al asistente
            avanzado de pick: grid completo por roles, recomendación en tiempo
            real y selección de aliados/enemigos ilimitada. */}
        <HubScreen onActivateRadar={() => setLiveState('champSelect')} />
        {/* ScanModal eliminado en — flujo directo hub→champSelect→active.
            El estado `scanModalVisible` y handlers asociados se mantienen
            como código legado por si vuelven a hacer falta cuando se conecte
            el endpoint real `/api/v1/scan/{riotId}`. */}
      </View>
    );
  }

  // ── Branch 5 (return final): vista de escaneo con resultados ────────────────
  // Layout general (el JSX describe la UI de forma declarativa, como construir
  // el árbol de Swing pero diciendo el QUÉ): fondo táctico animado + ScrollView
  // con header, input de invocador, empty state o, si hay `data`, las tarjetas
  // de draft enemigo, build, HUD de inteligencia y tracker. Al final, el modal
  // de detalle de campeón superpuesto.
  return (
    <View style={[styles.container, { backgroundColor: c.bg1 }]}>
      {/* AuroraBackground eliminado: producía un tinte verde saturado
          en LiveScreen que chocaba con el palette de NOVA RIFT. Mantenemos
          solo el grid táctico animado (consistente con el resto de tabs). */}
      {isDark && <AnimatedTacticalBackground theme={theme} intensity={data ? 'high' : 'normal'} />}

      <ScrollView style={styles.scrollFlex} contentContainerStyle={styles.scrollContent}>

      {/* Header animado con barra superior decorativa */}
      <Animated.View style={[styles.header, { borderBottomColor: glowColor }]}>
        <View style={styles.headerTopBar}>
          <Animated.View style={[styles.headerAccent, { backgroundColor: glowColor }]} />
          <Animated.View style={[styles.headerAccent, { backgroundColor: theme.accent }]} />
          <Animated.View style={[styles.headerAccent, { backgroundColor: glowColor }]} />
        </View>
        <Text style={[styles.title, { color: theme.primary, textShadowColor: theme.primary }]}>
          LIVE-RIFT RADAR
        </Text>
        <Text style={styles.subtitle}>Tu copiloto táctico en tiempo real</Text>
      </Animated.View>

      {/* MOCK badge discreto (esquina sup. derecha) — solo para devs */}
      <View style={styles.devBadgeWrap}>
        <View style={[styles.devBadgeDot, { backgroundColor: theme.primary + '88' }]} />
        <Text style={styles.devBadgeText}>{getRuntimeModeBadge()}</Text>
      </View>

      {/* Input de invocador */}
      <View style={[styles.searchContainer, { borderColor: theme.primary + '66', backgroundColor: theme.surface + 'CC' }]}>
        <Text style={[styles.inputLabel, { color: theme.primary }]}>INVOCADOR</Text>
        <TextInput
          style={[styles.input, { color: theme.text, borderColor: inputError ? '#FF5252' : theme.primary + '55' }]}
          placeholder="GameName-TAG (ej: NovaRift-EUW)"
          placeholderTextColor={theme.text + '44'}
          value={riotId}
          onChangeText={(value) => {
            setRiotId(value);
            if (inputError) setInputError('');
            if (serverError) setServerError('');
          }}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {!!inputError && <Text style={styles.inputError}>{inputError}</Text>}
        {!!serverError && <Text style={styles.serverError}>{serverError}</Text>}

        <Animated.View style={{ transform: [{ scale: buttonPulse }], alignSelf: 'center', maxWidth: 480, width: '100%' }}>
          <TouchableOpacity
            style={[
              styles.radarButton,
              {
                backgroundColor: darkenHex(theme.primary, 0.40),
                borderColor: theme.primary,
                shadowColor: theme.primary,
              },
            ]}
            activeOpacity={0.85}
            onPress={startLiveSession}
            disabled={loading}
          >
            {/* Inner glow para "fake gradient" 135deg sin libs */}
            <View
              style={[styles.radarButtonInnerGlow, { backgroundColor: theme.primary + '22' }]}
              pointerEvents="none"
            />
            {loading ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator color={theme.primary} size="small" />
                <Text style={[styles.buttonText, { color: theme.primary, marginLeft: 8 }]}>
                  ESCANEANDO…
                </Text>
              </View>
            ) : (
              <Text style={[styles.buttonText, { color: theme.primary }]}>
                {data ? '⟳ RE-ESCANEAR' : '◉ ACTIVAR RADAR'}
              </Text>
            )}
          </TouchableOpacity>
        </Animated.View>
      </View>

      {/* Empty State — RADAR INACTIVO (UI-Analysis 27/04 P7 fix #2) */}
      {!data && !loading && (
        <View style={[styles.emptyStateContainer, { borderColor: theme.primary + '33', backgroundColor: theme.surface + '66' }]}>
          <Text style={[styles.emptyStateGlyph, { color: theme.primary + '99' }]}>◉</Text>
          <Text style={[styles.emptyStateTitle, { color: theme.primary }]}>RADAR INACTIVO</Text>
          <Text style={[styles.emptyStateText, { color: theme.text + '88' }]}>
            Introduce tu Riot ID y activa el radar para recibir{'\n'}
            análisis de composición y build en tiempo real.
          </Text>
          {/* Hint del radar: sugiere el Riot ID del propio jugador (o un texto
              genérico) en lugar de la antigua cuenta demo fija. */}
          <Text style={[styles.emptyStateHint, { color: theme.text + '55' }]}>
            {radarHint}
          </Text>
        </View>
      )}

      {/* Resultados con fade-in */}
      {data && (
        <Animated.View style={{ opacity: fadeAnim }}>

          {/* Draft enemigo */}
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.primary + '66' }]}>
            <Text style={styles.cardLabel}>AMENAZA DETECTADA</Text>
            <Text style={[styles.cardTitle, { color: theme.primary }]}>{data.summoner}</Text>
            {data.draft.team !== '' && (
              <Text style={[styles.cardSub, { color: theme.text + 'AA' }]}>{data.draft.team}</Text>
            )}
            <Text style={[styles.cardBody, { color: theme.text }]}>{data.draft.composition}</Text>

            {data.draft.champions?.length > 0 && (
              <View style={{ marginTop: 14 }}>
                <Text style={styles.sectionLabel}>CAMPEONES RIVALES</Text>
                <FlatList
                  horizontal
                  data={data.draft.champions}
                  keyExtractor={(champ, i) => `${champ.id ?? champ.name ?? 'champ'}-${i}`}
                  showsHorizontalScrollIndicator={false}
                  windowSize={3}
                  maxToRenderPerBatch={3}
                  initialNumToRender={5}
                  removeClippedSubviews={Platform.OS !== 'web'}
                  contentContainerStyle={styles.championsListContent}
                  renderItem={({ item: champ, index }) => {
                    const itemKey = `${champ.id ?? champ.name ?? 'champ'}-${index}`;
                    return (
                      <EnemyChampionItem
                        champ={champ}
                        selected={selectedEnemyKey === itemKey}
                        theme={theme}
                        slotWidth={CHAMP_SLOT_WIDTH}
                        onSelect={(c) => {
                          setSelectedEnemyKey(itemKey);
                          setChampionDetail(c);
                        }}
                      />
                    );
                  }}
                />
              </View>
            )}
          </View>

          {/* Build optimizada */}
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.accent + '88' }]}>
            <Text style={styles.cardLabel}>BUILD CRÍTICA OPTIMIZADA</Text>

            {buildOptions.length > 1 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
                {buildOptions.map((option, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.buildChip,
                      {
                        borderColor: selectedBuildIndex === index ? theme.primary : theme.primary + '33',
                        backgroundColor: selectedBuildIndex === index ? theme.primary + '33' : 'transparent',
                      },
                    ]}
                    onPress={() => setSelectedBuildIndex(index)}
                  >
                    <Text style={[styles.buildChipText, { color: selectedBuildIndex === index ? theme.primary : theme.text + '88' }]}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            {currentBuild && (
              <>
                <Text style={[styles.cardBody, { color: theme.text }]}>{currentBuild.primaryTarget}</Text>
                {currentBuild.items?.length > 0 && (
                  <View style={{ marginTop: 12 }}>
                    <Text style={styles.sectionLabel}>ÍTEMS RECOMENDADOS</Text>
                    <View style={styles.itemsRow}>
                      {currentBuild.items.map((itemName, i) => {
                        const itemId = getItemIdByName(itemName);
                        return (
                          <View key={i} style={styles.itemPreviewSlot}>
                            {itemId ? (
                              <Image
                                source={{ uri: getItemImageUrl(itemId) }}
                                style={[styles.itemPreviewImage, { borderColor: theme.accent + '99' }]}
                                resizeMode="cover"
                              />
                            ) : (
                              <View style={[styles.itemPreviewPlaceholder, { borderColor: theme.accent + '55' }]}>
                                <Text style={{ color: theme.text + '88', fontSize: TYPE_SCALE.micro.size }}>{itemName}</Text>
                              </View>
                            )}
                            <Text style={[styles.itemPreviewName, { color: theme.text + 'CC' }]} numberOfLines={2}>
                              {itemName}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                )}
                {!!currentBuild.tactics && (
                  <Text style={[styles.tacticsText, { color: theme.primary, borderLeftColor: theme.primary }]}>
                    "{currentBuild.tactics}"
                  </Text>
                )}
              </>
            )}
          </View>

          {/* ══════════════════════════════════════════════════════
              MOTOR TÁCTICO HUD
              Visualiza el output completo del motor de recomendación:
              threat gauge, items rankeados con sub-scores, razones, tradeoff.
          ══════════════════════════════════════════════════════ */}
          {(data.recommendationItems?.length > 0 || data.threatAssessment) && (
            <TacticalIntelligenceHUD
              totalScore={data.recommendationTotalScore}
              confidence={data.recommendationConfidence}
              reasons={data.recommendationReasons}
              items={data.recommendationItems}
              threat={data.threatAssessment}
              policyVersion={data.recommendationVersion}
              tradeoff={data.recommendationBreakdown?.tradeoff}
              theme={theme}
            />
          )}

          {/* ══════════════════════════════════════════
              ITEM TRACKER - La pieza principal nueva
          ══════════════════════════════════════════ */}
          {currentBuild?.items?.length > 0 && (
            <ItemTracker
              items={currentBuild.items}
              theme={theme}
              mode={APP_RUNTIME_MODE}
            />
          )}

          {/* Breakdown de la recomendación IA (legacy — mantener compat) */}
          {data.recommendationBreakdown && (
            <View style={[styles.card, { backgroundColor: theme.surface, borderColor: '#4CAF5088' }]}>
              <View style={styles.breakdownHeader}>
                <Text style={styles.cardLabel}>INTELIGENCIA DE RECOMENDACIÓN</Text>
                <Text style={[styles.versionBadge, { color: theme.primary }]}>
                  Motor {data.recommendationVersion}
                </Text>
              </View>

              {/* Confianza */}
              <View style={{ marginBottom: 14 }}>
                <View style={styles.confidenceRow}>
                  <Text style={[styles.cardBody, { color: theme.text }]}>Nivel de confianza</Text>
                  <Text style={[styles.confidenceValue, {
                    color: data.recommendationConfidence >= 0.7 ? '#4CAF50'
                      : data.recommendationConfidence >= 0.4 ? '#FFC107' : '#F44336',
                  }]}>
                    {((data.recommendationConfidence || 0) * 100).toFixed(0)}%
                  </Text>
                </View>
                <View style={styles.progressTrackThin}>
                  <View style={[styles.progressFillThin, {
                    width: `${Math.min(100, (data.recommendationConfidence || 0) * 100)}%`,
                    backgroundColor: data.recommendationConfidence >= 0.7 ? '#4CAF50'
                      : data.recommendationConfidence >= 0.4 ? '#FFC107' : '#F44336',
                  }]} />
                </View>
              </View>

              <Text style={[styles.sectionLabel, { marginBottom: 8 }]}>FACTORES CLAVE</Text>
              {data.recommendationBreakdown.topFactors?.map((factor, i) => (
                <View key={i} style={styles.factorRow}>
                  <Text style={[styles.factorBullet, { color: theme.primary }]}>◆</Text>
                  <Text style={[styles.factorText, { color: theme.text }]}>{factor}</Text>
                </View>
              ))}

              {data.recommendationBreakdown.tradeoff && (
                <View style={[styles.tradeoffBox, { borderLeftColor: theme.primary, backgroundColor: theme.primary + '11' }]}>
                  <Text style={[styles.tradeoffText, { color: theme.text }]}>
                    {data.recommendationBreakdown.tradeoff}
                  </Text>
                </View>
              )}
            </View>
          )}

        </Animated.View>
      )}
      </ScrollView>

      {/* P6 — vista detalle formal del campeón rival */}
      <ChampionDetailModal
        champion={championDetail}
        theme={theme}
        onClose={() => setChampionDetail(null)}
      />
    </View>
  );
}

// ─── ChampionDetailModal — vista detalle formal del campeón (P6) ─────────────
// Se abre al pulsar un slot de campeón rival. Muestra splash 1215×717
// completo + ficha (nombre, tags, rol, daño primario) en glass card.
// Componente de presentación: recibe el campeón a mostrar (champion), el theme
// y onClose. Si champion es null no renderiza nada (modal cerrado).
function ChampionDetailModal({ champion, theme, onClose }) {
  // Render guard: sin campeón seleccionado, modal oculto.
  if (!champion) return null;
  const tags = champion.tags || [];
  const championName = champion.name || champion.displayName;
  // JSX: overlay (toque fuera = cerrar) + card con splash del campeón arriba
  // (nombre y tags superpuestos) y una ficha técnica con sus datos debajo.
  return (
    <View style={detailStyles.overlay}>
      <TouchableOpacity
        style={StyleSheet.absoluteFillObject}
        activeOpacity={1}
        onPress={onClose}
      />
      <View
        style={[
          detailStyles.card,
          {
            borderColor: theme.primary + '88',
            shadowColor: theme.primary,
            ...(Platform.OS === 'web'
              ? { backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)' }
              : {}),
          },
        ]}
      >
        {/* Splash hero — ChampionImage en aspect landscape (default) con 16:9 */}
        <View style={detailStyles.heroWrap}>
          <ChampionImage
            name={championName}
            style={StyleSheet.absoluteFillObject}
            resizeMode="cover"
          />
          {/* Gradiente inferior para legibilidad del nombre */}
          <View style={detailStyles.heroGradient} />
          {/* Cierre */}
          <TouchableOpacity style={detailStyles.closeBtn} onPress={onClose} activeOpacity={0.7}>
            <Text style={detailStyles.closeText}>×</Text>
          </TouchableOpacity>
          {/* Tags overlay */}
          <View style={detailStyles.heroOverlay}>
            <Text style={[detailStyles.heroLabel, { color: theme.primary }]}>AMENAZA · CAMPEÓN RIVAL</Text>
            <Text style={detailStyles.heroName}>{champion.displayName || championName}</Text>
            {tags.length > 0 && (
              <View style={detailStyles.tagsRow}>
                {tags.map((t, i) => (
                  <View
                    key={i}
                    style={[
                      detailStyles.tagPill,
                      { borderColor: theme.primary + '88', backgroundColor: theme.primary + '22' },
                    ]}
                  >
                    <Text style={[detailStyles.tagText, { color: theme.primary }]}>
                      {t.toUpperCase()}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>

        {/* Ficha técnica */}
        <View style={detailStyles.body}>
          <View style={detailStyles.row}>
            <Text style={[detailStyles.rowLabel, { color: theme.text + '66' }]}>NOMBRE INTERNO</Text>
            <Text style={[detailStyles.rowValue, { color: theme.text }]}>{championName}</Text>
          </View>
          <View style={detailStyles.divider} />
          <View style={detailStyles.row}>
            <Text style={[detailStyles.rowLabel, { color: theme.text + '66' }]}>ARQUETIPO</Text>
            <Text style={[detailStyles.rowValue, { color: theme.text }]}>
              {tags.length > 0 ? tags.join(' · ') : 'Sin clasificar'}
            </Text>
          </View>
          <View style={detailStyles.divider} />
          <View style={detailStyles.row}>
            <Text style={[detailStyles.rowLabel, { color: theme.text + '66' }]}>ID</Text>
            <Text style={[detailStyles.rowValue, { color: theme.text + 'AA' }]}>
              {champion.id ?? '—'}
            </Text>
          </View>
        </View>

        <View style={{ padding: 16, paddingTop: 4 }}>
          <NovaButton
            label="CERRAR FICHA"
            variant="ghost"
            onPress={onClose}
            factionColor={theme.primary}
            size="md"
          />
        </View>
      </View>
    </View>
  );
}

// ── Estilos del ChampionDetailModal ──────────────────────────────────────────
// StyleSheet.create(): estilos (CSS como objeto Java) propios de esta ficha.
const detailStyles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.78)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 200,
    padding: 16,
  },
  card: {
    width: '100%',
    maxWidth: 520,
    backgroundColor: 'rgba(7,7,13,0.92)',
    borderWidth: 1.5,
    borderRadius: 16,
    overflow: 'hidden',
    shadowOpacity: 0.55,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 0 },
    elevation: 22,
  },
  heroWrap: {
    width: '100%', aspectRatio: 16 / 9,
    position: 'relative', overflow: 'hidden',
  },
  heroGradient: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(7,7,13,0.55)',
  },
  closeBtn: {
    position: 'absolute', top: 8, right: 12,
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(7,7,13,0.6)',
  },
  closeText: { color: '#ffffff', fontSize: TYPE_SCALE.h4.size, fontWeight: '300', lineHeight: 22 },
  heroOverlay: {
    position: 'absolute', left: 16, right: 16, bottom: 12,
  },
  heroLabel: {
    fontSize: TYPE_SCALE.micro.size, fontWeight: '900', letterSpacing: 2.5, marginBottom: 4,
  },
  heroName: {
    color: '#ffffff', fontSize: TYPE_SCALE.h3.size, fontWeight: '900', letterSpacing: 2,
    textShadowColor: 'rgba(0,0,0,0.8)', textShadowRadius: 6,
  },
  tagsRow: {
    flexDirection: 'row', gap: 6, marginTop: 8, flexWrap: 'wrap',
  },
  tagPill: {
    borderWidth: 1, borderRadius: 4,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  tagText: { fontSize: TYPE_SCALE.micro.size, fontWeight: '900', letterSpacing: 1.5 },
  body: { padding: 16, gap: 0 },
  row: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 10,
  },
  rowLabel: { fontSize: TYPE_SCALE.micro.size, fontWeight: '900', letterSpacing: 2 },
  rowValue: { fontSize: TYPE_SCALE.label.size, fontWeight: '700' },
  divider: {
    height: 1,
    backgroundColor: 'rgba(123,118,221,0.12)',
  },
});

// ─── Estilos ──────────────────────────────────────────────────────────────────
// StyleSheet.create() del componente principal: hoja de estilos (equivalente a
// CSS pero como objeto Java) con todas las clases reutilizables de LiveScreen
// (contenedor, header, input, tarjetas, slots de campeón/ítem, tracker, etc.).
// Factory tematizada: en modo oscuro `c` reproduce los valores neutros previos
// pixel a pixel; sólo cambian en modo claro. Cada componente que consume estos
// estilos los memoiza con useMemo(() => makeStyles(c), [c]).
const makeStyles = (c) => StyleSheet.create({
  container: { flex: 1 },
  scrollFlex: { flex: 1 },
  scrollContent: {
    paddingTop: Platform.OS === 'ios' ? 60 : SAFE_TOP_PADDING + 20,
    paddingBottom: 40,
    paddingHorizontal: 16,
  },
  championsListContent: {
    gap: 8,
    paddingVertical: 4,
    paddingHorizontal: 2,
  },

  // Header
  header: {
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  headerTopBar: {
    flexDirection: 'row',
    width: '60%',
    height: 3,
    marginBottom: 12,
    borderRadius: 2,
    overflow: 'hidden',
  },
  headerAccent: {
    flex: 1,
    height: 3,
    marginHorizontal: 2,
    borderRadius: 2,
    opacity: 0.8,
  },
  title: {
    fontSize: TYPE_SCALE.h3.size,
    fontWeight: '900',
    letterSpacing: 5,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 16,
    fontFamily: 'Rajdhani_700Bold',
  },
  subtitle: { color: '#666', fontSize: TYPE_SCALE.caption.size, marginTop: 4, letterSpacing: 2 },
  // MOCK badge ahora discreto en esquina (no decoración principal)
  devBadgeWrap: {
    position: 'absolute',
    top: 16, right: 16,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 99,
    backgroundColor: 'rgba(0,0,0,0.4)',
    zIndex: 10,
  },
  devBadgeDot: {
    width: 6, height: 6, borderRadius: 3,
  },
  devBadgeText: {
    fontSize: TYPE_SCALE.micro.size, color: '#888', letterSpacing: 1, fontWeight: '700',
  },

  // Input
  searchContainer: {
    borderWidth: 1, borderRadius: 10, padding: 16, marginBottom: 16,
  },
  inputLabel: { fontSize: TYPE_SCALE.micro.size, fontWeight: '800', letterSpacing: 2, marginBottom: 8 },
  input: {
    borderWidth: 1, borderRadius: 6, padding: 12,
    fontSize: TYPE_SCALE.body.size, marginBottom: 10, backgroundColor: 'rgba(0,0,0,0.3)',
  },
  inputError: { color: '#FF5252', fontSize: TYPE_SCALE.caption.size, marginBottom: 8 },
  serverError: { color: '#FFA726', fontSize: TYPE_SCALE.caption.size, marginBottom: 8 },
  loadingRow: { flexDirection: 'row', alignItems: 'center' },
  radarButton: {
    paddingVertical: 14, borderRadius: 8, alignItems: 'center',
    borderWidth: 1.5,
    overflow: 'hidden', position: 'relative',
    shadowOpacity: 0.7, shadowRadius: 14, shadowOffset: { width: 0, height: 0 },
    elevation: 10,
  },
  radarButtonInnerGlow: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.7,
  },
  buttonText: { fontWeight: '900', fontSize: TYPE_SCALE.body.size, letterSpacing: 2 },

  // Cards (audit v3 P2: radio reducido para look gaming sharp)
  card: {
    borderWidth: 1, borderRadius: 6, padding: 14, marginBottom: 14,
  },
  cardLabel: {
    color: '#666', fontSize: TYPE_SCALE.micro.size, fontWeight: '800',
    letterSpacing: 2, marginBottom: 6, textTransform: 'uppercase',
  },
  cardTitle: { fontSize: TYPE_SCALE.h6.size, fontWeight: '900', letterSpacing: 2, marginBottom: 4 },
  cardSub: { fontSize: TYPE_SCALE.caption.size, marginBottom: 6 },
  cardBody: { fontSize: TYPE_SCALE.label.size, lineHeight: 20 },
  sectionLabel: {
    color: '#666', fontSize: TYPE_SCALE.micro.size, fontWeight: '800',
    letterSpacing: 2, marginBottom: 8, textTransform: 'uppercase',
  },

  // Campeones
  championsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  champSlot: { alignItems: 'center', width: 54 },
  champImage: { width: 48, height: 48, borderRadius: 4, borderWidth: 1.5 },
  champName: { fontSize: TYPE_SCALE.micro.size, marginTop: 3, textAlign: 'center' },

  // Build chips
  buildChip: {
    borderWidth: 1, borderRadius: 20, paddingVertical: 6,
    paddingHorizontal: 12, marginRight: 8,
  },
  buildChipText: { fontSize: TYPE_SCALE.caption.size, fontWeight: '700' },

  // Ítems preview
  itemsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  itemPreviewSlot: { alignItems: 'center', width: 54 },
  itemPreviewImage: { width: 48, height: 48, borderRadius: 4, borderWidth: 1.5 },
  itemPreviewPlaceholder: {
    width: 48, height: 48, borderRadius: 4, borderWidth: 1,
    justifyContent: 'center', alignItems: 'center', backgroundColor: '#111',
  },
  itemPreviewName: { fontSize: TYPE_SCALE.micro.size, marginTop: 3, textAlign: 'center' },

  // Tactics
  tacticsText: {
    fontSize: TYPE_SCALE.label.size, fontStyle: 'italic', marginTop: 12,
    paddingLeft: 10, borderLeftWidth: 2, lineHeight: 18,
  },

  // ─── Item Tracker ─────────────────────────────────────────────────────────
  trackerContainer: {
    borderWidth: 1, borderRadius: 6, padding: 14,
    marginBottom: 14, backgroundColor: 'rgba(0,0,0,0.4)',
  },
  trackerHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 10,
  },
  trackerTitle: { fontSize: TYPE_SCALE.label.size, fontWeight: '900', letterSpacing: 2 },
  trackerHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  trackerCount: { fontSize: TYPE_SCALE.h6.size, fontWeight: '900' },
  resetBtn: {
    borderWidth: 1, borderColor: '#444', borderRadius: 4,
    paddingHorizontal: 8, paddingVertical: 3,
  },

  // Progress bar tracker
  progressTrackFull: {
    height: 8, borderRadius: 4, backgroundColor: c.onSurface(0.08),
    marginBottom: 6, overflow: 'hidden',
  },
  progressFillFull: { height: 8, borderRadius: 4 },
  completedText: {
    color: '#4CAF50', fontSize: TYPE_SCALE.caption.size, fontWeight: '900',
    letterSpacing: 2, textAlign: 'center', marginBottom: 10,
  },

  // Slots de ítems tracker
  itemSlotsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 10, marginBottom: 10 },
  itemSlot: {
    width: 90, borderRadius: 10, borderWidth: 1.5,
    alignItems: 'center', padding: 8,
  },
  itemSlotImageWrap: { position: 'relative', marginBottom: 6 },
  itemSlotImage: { width: 56, height: 56, borderRadius: 6, borderWidth: 1.5 },
  itemSlotImagePlaceholder: {
    width: 56, height: 56, borderRadius: 6, borderWidth: 1,
    justifyContent: 'center', alignItems: 'center', backgroundColor: '#111',
    padding: 4,
  },
  checkOverlay: {
    position: 'absolute', top: -4, right: -4,
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: '#4CAF50', justifyContent: 'center', alignItems: 'center',
  },
  checkIcon: { color: '#ffffff', fontSize: TYPE_SCALE.caption.size, fontWeight: '900' },
  itemSlotName: { fontSize: TYPE_SCALE.micro.size, textAlign: 'center', marginBottom: 6, fontWeight: '700' },
  buyButton: {
    borderWidth: 1, borderRadius: 4, paddingVertical: 4,
    paddingHorizontal: 6, alignItems: 'center', width: '100%',
  },
  buyButtonText: { fontSize: TYPE_SCALE.micro.size, fontWeight: '900', letterSpacing: 1 },
  purchasedBadge: {
    backgroundColor: 'rgba(76,175,80,0.2)', borderRadius: 4,
    paddingVertical: 4, paddingHorizontal: 6, alignItems: 'center', width: '100%',
  },
  purchasedBadgeText: { color: '#4CAF50', fontSize: TYPE_SCALE.micro.size, fontWeight: '900' },

  // Sync
  syncButton: {
    borderWidth: 1, borderRadius: 6, paddingVertical: 10,
    alignItems: 'center', marginTop: 4, marginBottom: 4,
  },
  syncButtonText: { fontSize: TYPE_SCALE.caption.size, fontWeight: '800', letterSpacing: 1 },
  syncStatus: { fontSize: TYPE_SCALE.caption.size, textAlign: 'center', marginTop: 4 },
  trackerModeHint: { fontSize: TYPE_SCALE.caption.size, textAlign: 'center', marginTop: 8, fontStyle: 'italic' },

  // ─── Breakdown ───────────────────────────────────────────────────────────
  breakdownHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 12,
  },
  versionBadge: { fontSize: TYPE_SCALE.micro.size, fontWeight: '700' },
  confidenceRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 6,
  },
  confidenceValue: { fontSize: TYPE_SCALE.h6.size, fontWeight: '900' },
  progressTrackThin: {
    height: 6, borderRadius: 3,
    backgroundColor: c.onSurface(0.08), overflow: 'hidden',
  },
  progressFillThin: { height: 6, borderRadius: 3 },
  factorRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 6 },
  factorBullet: { fontSize: TYPE_SCALE.micro.size, marginRight: 8, marginTop: 4 },
  factorText: { fontSize: TYPE_SCALE.label.size, flex: 1, lineHeight: 18 },
  tradeoffBox: {
    marginTop: 12, padding: 10, borderRadius: 6, borderLeftWidth: 3,
  },
  tradeoffText: { fontSize: TYPE_SCALE.caption.size, lineHeight: 18, fontStyle: 'italic' },
  emptyStateContainer: {
    margin: 16,
    padding: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateGlyph: {
    fontSize: TYPE_SCALE.h1.size,
    marginBottom: 12,
    fontWeight: '900',
  },
  emptyStateTitle: {
    fontSize: TYPE_SCALE.body.size,
    fontWeight: '900',
    letterSpacing: 3,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: TYPE_SCALE.label.size,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 14,
  },
  emptyStateHint: {
    fontSize: TYPE_SCALE.caption.size,
    letterSpacing: 1,
    fontStyle: 'italic',
  },
});

// ─── Estilos del setup rápido "Iniciar Partida" ──────────────────────────────
// Hoja de estilos propia del estado `liveState === 'setup'`: una pantalla de
// configuración limpia con dos grids de botones de texto (campeón propio y
// enemigos) y la CTA de lanzamiento.
// Factory tematizada (mismo patrón que makeStyles): en oscuro reproduce los
// neutros previos pixel a pixel; el componente la memoiza con useMemo.
const makeSetupStyles = (c) => StyleSheet.create({
  scroll: {
    flexGrow: 1,
    paddingTop: Platform.OS === 'ios' ? 64 : SAFE_TOP_PADDING + 24,
    paddingHorizontal: 20,
    paddingBottom: 48,
  },
  // aviso de pool fallback (estética tip-box con border-left de alerta)
  poolFallbackNotice: {
    color: '#FFB300',
    fontSize: 11,
    lineHeight: 16,
    backgroundColor: 'rgba(255,179,0,0.08)',
    borderLeftWidth: 3,
    borderLeftColor: '#FFB300',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 4,
    marginBottom: 10,
  },
  backLink: {
    color: c.onSurface(0.40),
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 18,
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 3,
    marginBottom: 4,
  },
  subtitle: {
    color: c.onSurface(0.55),
    fontSize: 13,
    marginBottom: 24,
  },
  sectionLabel: {
    color: c.onSurface(0.40),
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 2,
    marginBottom: 12,
  },
  // Grid de botones de texto (sin imágenes): flex-wrap para que se acomode a
  // cualquier ancho de pantalla.
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  champBtn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: c.onSurface(0.12),
    backgroundColor: c.onSurface(0.04),
    minWidth: 92,
    alignItems: 'center',
  },
  champBtnText: {
    color: c.textPrimary,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  launchWrap: {
    marginTop: 32,
  },
  advancedLink: {
    color: 'rgba(123,118,221,0.85)',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 20,
    letterSpacing: 0.3,
  },
  // ── Chip de campeón con imagen ──────────────────────────────────────
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  champChip: {
    alignItems: 'center',
    width: 72,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: c.onSurface(0.10),
    backgroundColor: c.onSurface(0.04),
    overflow: 'hidden',
    paddingBottom: 6,
  },
  champChipImg: {
    width: 72,
    height: 72,
    borderRadius: 9,
  },
  champChipBadge: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  champChipName: {
    color: c.onSurface(0.75),
    fontSize: 10,
    fontWeight: '700',
    marginTop: 5,
    paddingHorizontal: 4,
    textAlign: 'center',
  },
  // ── Card de recomendación ────────────────────────────────────────────
  recCard: {
    marginTop: 20,
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: c.onSurface(0.04),
    padding: 14,
    gap: 8,
  },
  recHeader: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 2,
    marginBottom: 2,
  },
  recChampRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  recChampImg: {
    width: 56,
    height: 56,
    borderRadius: 8,
  },
  recChampName: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 1,
  },
  recConfBadge: {
    alignSelf: 'flex-start',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 4,
  },
  recConfText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  recReason: {
    color: c.onSurface(0.75),
    fontSize: 13,
    lineHeight: 18,
  },
  recDetail: {
    color: '#4CAF50',
    fontSize: 12,
    fontWeight: '600',
  },
});
