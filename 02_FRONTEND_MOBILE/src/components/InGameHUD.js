// ============================================================================
// InGameHUD — HUD de la "partida manual" del LiveScreen
// ----------------------------------------------------------------------------
// IMPORTANTE: esta pantalla NO se conecta a Riot en tiempo real. Es el propio
// jugador quien introduce los datos (su oro, los hechizos que ve gastar al
// rival, los campeones enemigos…) y la app le devuelve coaching.
//
// Recibe un objeto `session` (con la forma de `MOCK_GAME_SESSION`) y dibuja,
// de arriba a abajo:
//
// 1. Header: punto verde "PARTIDA EN CURSO" + reloj de partida + botón salir.
// 2. Champion bar: icono del campeón + KDA (K verde / D rojo / A naranja) +
// ratio KDA + CS por minuto + fase de la partida.
// 3. Item tracker: 6 huecos de ítems (comprados vs. vacíos) + siguiente ítem
// recomendado + acceso a la TIENDA.
// 4. Acciones de partida: recall/muerte (declaran oro generado) + tienda con
// recomendación de compra según el oro actual.
// 5. Spell tracker: cuentas atrás de los hechizos de invocador enemigos.
// 6. Ulti tracker: cuentas atrás de las ultis enemigas trackeables.
// 7. Alertas tácticas: avisos con barra lateral de color según la urgencia.
// 8. Coaching card: consejo personalizado según la facción del usuario.
//
// El componente SÍ mantiene estado propio (las cuentas atrás de spells/ultis,
// el toast del coach, la tienda y el registro de recalls). La lógica de "cuándo
// entrar al HUD" vive en LiveScreen (ver el punto de entrada más abajo).
// ============================================================================

/**
 * @module InGameHUD
 *
 * HUD completo de partida en vivo (LiveScreen cuando hay sesión activa). Recibe
 * un objeto `session` con el shape de `MOCK_GAME_SESSION` y compone, de arriba
 * a abajo:
 *
 * 1. Header con dot pulsante + "PARTIDA EN CURSO" + reloj de partida.
 * 2. Champion bar: icono del campeón con glow + KDA + CS/min + fase.
 * 3. Item tracker: 6 slots (comprados vs. vacíos) + siguiente ítem con glow.
 * 4. Acciones de partida: recall/muerte (declaran oro generado) + tienda con
 *    recomendación de compra según el oro actual.
 * 5. Spell tracker: cooldowns de summoners enemigos (badge "FLASH DOWN").
 * 6. Ulti tracker: cooldowns de ultis trackeables.
 * 7. Alertas tácticas con barra lateral de color (peligro/estrategia).
 * 8. Coaching card según la facción del usuario (backend con fallback mock).
 *
 * Aunque el shape de entrada es presentacional, el componente mantiene estado
 * propio para los timers de spells/ultis, el toast de coaching, la tienda y el
 * logger de recalls.
 *
 * @example
 * <InGameHUD session={MOCK_GAME_SESSION} onExit={() => navigation.goBack()} />
 */

/**
 * @typedef {Object} InGameHUDProps
 * @property {Object} session Sesión de partida con el shape de
 * `MOCK_GAME_SESSION` (jugador, KDA, oro, ítems, alertas, fase, reloj…).
 * @property {() => void} [onExit] Callback al salir del HUD. Si no se pasa, cae
 * en `radar.close()`.
 */

// ── Imports ────────────────────────────────────────────────────────
// Equivale a los `import` de Java: traemos React (la librería de UI), los
// componentes visuales de React Native (View=contenedor, Text=texto,
// Image=imagen, TouchableOpacity=botón táctil, ScrollView=lista con scroll…)
// y utilidades propias del proyecto (contextos globales, mocks, helpers).
import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, Image,
  StyleSheet, Platform, Animated,
} from 'react-native';
import NovaBackground from './NovaBackground';
import {
  getBuildsForChampion, getBuildCoreCost,
  getStartersForRole, getItemComponents, BOOTS_STARTER,
  getCompleteBootsForRole, ITEM_COMPONENTS,
  tryCombine, getCombineCost,
} from '../mocks/itemBuilds';
import LiveCoachToast from './LiveCoachToast';
import { RiotContext } from '../context/RiotContext';
import { useTheme } from '../context/ThemeContext';
import { useUser } from '../context/UserContext';
import { useRadar } from '../context/RadarContext';
import { API_BASE_URL } from '../config/apiConfig';
import { getGameCoaching, formatGameTime } from '../mocks/mockGameSession';
import {
  getPhaseFromGameTime,
  getCoachingTipIndex,
  getCoachingTipCount,
} from '../data/coachingTips';
import { getItemImageUrl, getItemIdByName, getChampionImageUrl } from '../utils/dataDragon';
// B4 (DIN2-UD5) — explicabilidad + feedback loop de la recomendación de compra.
import AIInsightTooltip from './ai/AIInsightTooltip';
import AIFeedbackButtons from './ai/AIFeedbackButtons';

// ── Iconos de hechizos de invocador (Data Dragon) ──────────────────
// Data Dragon usa IDs internos distintos al nombre visible. Este mapa
// convierte el nombre legible al ID del sprite en DD.
const SPELL_DD_ID = {
  Flash:     'SummonerFlash',
  Ignite:    'SummonerDot',
  Teleport:  'SummonerTeleport',
  Ghost:     'SummonerHaste',
  Exhaust:   'SummonerExhaust',
  Heal:      'SummonerHeal',
  Barrier:   'SummonerBarrier',
  Cleanse:   'SummonerBoost',
  Smite:     'SummonerSmite',
};

const DD_SPELL_BASE = 'https://ddragon.leagueoflegends.com/cdn/16.8.1/img/spell';

const getSpellImageUrl = (spellName) => {
  const id = SPELL_DD_ID[spellName];
  if (!id) return null;
  return `${DD_SPELL_BASE}/${id}.png`;
};

// ── Mapa de facción NOVA RIFT → facción que entiende el backend ────
// El backend de coaching sólo tiene plantillas para NOXUS y DEMACIA. Las
// facciones ZAUN e IONIA no las tienen, así que se traducen a 'ANY' (consejo
// genérico). Es un simple diccionario clave→valor, como un Map<String,String>.
const FACTION_TO_BACKEND = {
  NOXUS:   'NOXUS',
  DEMACIA: 'DEMACIA',
  ZAUN:    'ANY',
  IONIA:   'ANY',
};

// ── Tiempos de recarga de cada hechizo invocador en segundos ───────
// Cuando el jugador marca que un enemigo gastó un hechizo, el contador arranca
// desde estos valores (p. ej. el Flash de LoL tarda 300 s en recargarse).
const SUMMONER_CDS = {
  Flash: 300, Ignite: 180, Teleport: 300, Ghost:  210,
  Exhaust: 210, Heal:    240, Barrier:   180, Cleanse: 210, Smite: 90,
};

// Abreviatura de 1-2 letras que se pinta dentro del botón de cada hechizo.
const SPELL_SHORT = {
  Flash: 'F',  Ignite: 'IG', Teleport: 'TP', Ghost:  'GH',
  Exhaust:'EX', Heal:   'HL', Barrier:  'BA', Cleanse:'CL', Smite: 'SM',
};

// Equipo enemigo de ejemplo: se usa como respaldo cuando la sesión no trae
// enemigos reales (modo demo).
const DEMO_ENEMIES = [
  { champion: 'Jinx',    summoners: ['Flash', 'Ignite']  },
  { champion: 'Thresh',  summoners: ['Flash', 'Exhaust'] },
  { champion: 'Graves',  summoners: ['Flash', 'Smite']   },
  { champion: 'Yasuo',   summoners: ['Flash', 'Ignite']  },
  { champion: 'Orianna', summoners: ['Flash', 'Exhaust'] },
];

// ── Ultis de campeones que el jugador puede trackear manualmente ───
// Sólo las ultis con cooldown largo y alto impacto merecen un contador propio.
// `cd` = segundos de recarga base (sin tener en cuenta niveles ni reducción
// de enfriamiento); `short` = la letra que se muestra ("R" en LoL).
const CHAMPION_ULTIS = {
  Karthus:     { name: 'Requiem',                cd: 200, short: 'R' },
  Zilean:      { name: 'Chronoshift',            cd: 180, short: 'R' },
  Kindred:     { name: "Lamb's Respite",         cd: 180, short: 'R' },
  Tryndamere:  { name: 'Undying Rage',           cd: 110, short: 'R' },
  TwistedFate: { name: 'Destiny',                cd: 180, short: 'R' },
  Pantheon:    { name: 'Grand Starfall',         cd: 180, short: 'R' },
  Malphite:    { name: 'Unstoppable Force',      cd: 130, short: 'R' },
  Amumu:       { name: 'Curse of the Sad Mummy', cd: 150, short: 'R' },
  MasterYi:    { name: 'Highlander',             cd:  75, short: 'R' },
  Shen:        { name: 'Stand United',           cd: 200, short: 'R' },
  Galio:       { name: 'Hero\'s Entrance',       cd: 200, short: 'R' },
  Yi:          { name: 'Highlander',             cd:  75, short: 'R' },
  Nocturne:    { name: 'Paranoia',               cd: 150, short: 'R' },
  Twitch:      { name: 'Spray and Pray',         cd: 100, short: 'R' },
};

// ── F1 — Oro pasivo en tiempo real (regla de LoL) ──────────────────
// En Summoner's Rift el oro pasivo empieza a las 1:05 (segundo 65) y renta
// ~20.4 de oro cada 10 s ≈ 2.04 oro/seg (además de los 500 de inicio). Lo
// modelamos como +2 oro/seg a partir del segundo 65, de modo que el monedero
// del jugador sube SOLO con el tiempo, no únicamente al declarar un recall.
const PASSIVE_GOLD_START_SEC = 65;
const PASSIVE_GOLD_PER_SEC   = 2;

// ── H6 — Consumibles (no ocupan slot del ITEM TRACKER) ─────────────
// Pociones, centinelas y elixires se compran y gastan oro, pero NO ocupan uno de
// los 6 huecos del inventario. Se marcan como comprados (para que la
// recomendación AVANCE y no se quede en la poción) y se filtran del tracker. Los
// starters tipo Doran's SÍ ocupan slot y se pueden vender (ver SELL_REFUND_RATE).
const CONSUMABLE_NAMES = new Set([
  'Health Potion', 'Refillable Potion', 'Control Ward', 'Stealth Ward (Trinket)',
  'Elixir of Iron', 'Elixir of Sorcery', 'Elixir of Wrath',
]);

// ── H5 — Reembolso al vender ───────────────────────────────────────
// Al vender un ítem se devuelve ~60% de su coste (como en LoL para objetos no
// recién comprados). Suficiente para vender los starters (Doran's) en mid/late.
const SELL_REFUND_RATE = 0.6;

// ─── SectionHeader — barra de acento cyan + título ──────────────────────────
// Reutilizado en ITEM TRACKER, SPELL TRACKER, ULTI TRACKER, ALERTAS, etc.
/**
 * Cabecera de sección con barra de acento y título en mayúsculas.
 *
 * @param {Object} props
 * @param {string} props.title Texto del título de la sección.
 * @param {React.ReactNode} [props.right] Contenido opcional alineado a la derecha.
 * @returns {React.ReactElement} La fila de cabecera.
 */
function SectionHeader({ title, right }) {
  return (
    <View style={sharedStyles.sectionHeaderRow}>
      <View style={sharedStyles.sectionHeaderBar} />
      <Text style={sharedStyles.sectionHeaderText}>{title}</Text>
      {right ? <View style={{ marginLeft: 'auto' }}>{right}</View> : null}
    </View>
  );
}

const sharedStyles = StyleSheet.create({
  sectionHeaderRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12,
  },
  sectionHeaderBar: {
    width: 3, height: 16, borderRadius: 2, backgroundColor: '#7B76DD',
  },
  sectionHeaderText: {
    color: '#7B76DD', fontSize: 10, fontWeight: '900', letterSpacing: 2,
  },
});

// ─── InGameHUD ───────────────────────────────────────────────────────────────
/**
 * HUD completo de partida en vivo (champion bar, trackers, alertas, coaching).
 *
 * @param {InGameHUDProps} props Propiedades del componente.
 * @returns {React.ReactElement} La pantalla del HUD en vivo.
 */
// ── Componente principal del HUD en vivo ───────────────────────────
// En React un "componente" es una función que devuelve la UI (similar a un
// método render()). Recibe `props` —aquí la sesión de partida y el callback de
// salida— igual que un constructor recibe parámetros:
// session → datos de la partida (jugador, KDA, oro, ítems, alertas…).
// onExit → función que se ejecuta al cerrar el HUD.
// useContext lee datos globales compartidos (tema de color, usuario, radar)
// sin tener que pasarlos por props nivel a nivel.
//
// ¿Cómo se inicia la partida? (flujo "Iniciar Partida"). El jugador NO llega
// aquí solo: en LiveScreen pulsa "ACTIVAR RADAR" → elige su campeón en
// ChampSelectHelper → al confirmar el pick, LiveScreen pasa a su estado
// 'active' y monta este InGameHUD con la sesión (MOCK_GAME_SESSION mientras no
// haya datos reales). También se entra con el botón demo " SIMULAR PARTIDA
// EN VIVO". El botón del header llama a `onExit`, que devuelve al hub.
export default function InGameHUD({ session, onExit, onTick }) {
  const { theme } = React.useContext(RiotContext);
  const { colors: c, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const gtStyles = useMemo(() => makeGtStyles(c), [c]);
  const spellStyles = useMemo(() => makeSpellStyles(c), [c]);
  const ultiStyles = useMemo(() => makeUltiStyles(c), [c]);
  const { user }  = useUser();
  const radar     = useRadar();

  // Facción NOVA RIFT del usuario en mayúsculas (por defecto ZAUN).
  const faction = String(user?.faction || 'ZAUN').toUpperCase();

  // ── Salida del HUD ─────────────────────────────────────────────────
  // Si quien usa el componente pasó un `onExit`, lo invocamos; si no, cerramos
  // el radar por defecto. El `?.` evita un fallo si `radar` viniera nulo.
  const handleExit = () => {
    if (typeof onExit === 'function') onExit();
    else radar?.close?.();
  };

  // ── Estado local del componente (useState) ─────────────────────────
  // useState crea una variable que, al cambiar con su "setter", hace que React
  // vuelva a dibujar la pantalla. Es como un campo de la clase que al
  // reasignarse refresca la vista automáticamente. Formato:
  // const [valor, setValor] = useState(valorInicial);
  /** @type {boolean} si el toast (aviso flotante) del coach está visible */
  const [toastVisible, setToastVisible] = useState(false);
  /** @type {string|null} texto del toast de coaching */
  const [toastMessage, setToastMessage] = useState(null);
  /** @type {boolean} si el modal de la tienda está abierto */
  const [shopVisible, setShopVisible] = useState(false);
  /** @type {Set<string>} nombres de ítems marcados como comprados (para pintarlos) */
  const [purchasedItems, setPurchasedItems] = useState(new Set());
  // A3 — Build PRIORIZADA elevada al HUD (antes vivía dentro de ItemShop). Así el
  // panel "ORO ACTUAL · QUÉ COMPRAR" recomienda según la MISMA build que el
  // jugador fija en la tienda. `null` = usar la de mayor winrate por defecto.
  /** @type {string|null} id de la build priorizada en la tienda */
  const [priorityBuildId, setPriorityBuildId] = useState(null);

  // F4 — Selector de build AL INICIO de la partida. Se abre una sola vez cuando
  // arranca la sesión para que el jugador elija el plan que va a seguir; las
  // recomendaciones de "QUÉ COMPRAR" siguen esa build. `buildPromptedRef` evita
  // reabrirlo en re-renders.
  /** @type {boolean} visibilidad del selector de build de inicio */
  const [buildPickerVisible, setBuildPickerVisible] = useState(false);
  const buildPromptedRef = useRef(false);

  // P2-5 — Doble-tap en la card "SIGUIENTE ITEM" = compra directa del recomendado.
  const nextItemTapRef = useRef(0);

  // H1/H4/H5 — Espejos en ref del ORO, los COMPRADOS y el COSTE-por-nombre. Los
  // usan buyItem/sellItem para decidir de forma SÍNCRONA (gate de oro, reembolso,
  // retirada de componentes) sin tener que recrearse cada segundo (el oro pasivo
  // cambia `live` 1×/s). Se re-sincronizan en cada render desde `lk`/los índices.
  const goldRef        = useRef(0);
  const purchasedRef   = useRef(purchasedItems);
  const costByNameRef  = useRef({});
  // I1 — Espejo de la build ACTIVA para que buyItem/tick combinen las piezas en
  // su ítem completo según activeBuild (se re-sincroniza en render, más abajo).
  const activeBuildRef = useRef(null);

  // H1 — Feedback breve "te falta oro" cuando se intenta comprar sin oro.
  /** @type {boolean} flash rojo "te falta oro" bajo el panel de compra */
  const [lowGoldFlash, setLowGoldFlash] = useState(false);
  const lowGoldTimerRef = useRef(null);
  const flashLowGold = useCallback(() => {
    setLowGoldFlash(true);
    if (lowGoldTimerRef.current) clearTimeout(lowGoldTimerRef.current);
    lowGoldTimerRef.current = setTimeout(() => setLowGoldFlash(false), 1700);
  }, []);
  useEffect(() => () => { if (lowGoldTimerRef.current) clearTimeout(lowGoldTimerRef.current); }, []);

  // H1+H4 — Comprar un objeto: GATEA por oro (no se compra sin oro suficiente),
  // lo DESCUENTA del oro en vivo y lo AÑADE al inventario, RETIRANDO de paso sus
  // componentes ya poseídos (las botas completas reemplazan a las básicas; un
  // ítem final libera sus piezas). Los consumibles (pociones) se marcan como
  // comprados para que la guía avance, pero NO ocuparán slot (se filtran en el
  // tracker, H6). Es la ÚNICA vía de compra: recomendación, doble-tap del
  // "siguiente ítem", tienda y BuildCard pasan todos por aquí.
  const buyItem = useCallback((name, cost) => {
    if (!name) return;
    const isConsumable = CONSUMABLE_NAMES.has(name);
    // No recomprar un ítem permanente ya en el inventario (evita doble cobro al
    // tocar un objeto ya comprado en la tienda). Los consumibles sí se recompran.
    if (!isConsumable && purchasedRef.current.has(name)) return;
    const spend = Number(cost) || 0;
    // H1 — GATE: sin oro suficiente NO se compra (ni se añade el ítem).
    if (spend > goldRef.current) { flashLowGold(); return; }

    let next = new Set(purchasedRef.current);
    next.add(name);
    // Si compras un ítem COMPLETO directo, funde sus componentes ya poseídos.
    (ITEM_COMPONENTS[name] || []).forEach(comp => { if (comp && comp.name) next.delete(comp.name); });

    // I1 — COMBINAR: tras añadir la compra, funde cualquier ítem de la build cuyas
    // piezas estén completas, cobrando su coste de combinación del oro restante.
    const goldAfterSpend = goldRef.current - spend;
    const combined = tryCombine(next, activeBuildRef.current, goldAfterSpend);
    next = combined.set;
    const totalDelta = goldRef.current - combined.gold; // gasto de compra + fusiones

    if (totalDelta > 0) {
      goldRef.current -= totalDelta; // sincronía inmediata para compras consecutivas
      setLive(l => (l ? { ...l, gold: Math.max(0, l.gold - totalDelta) } : l));
    }
    purchasedRef.current = next; // sincronía inmediata (anti doble-tap del mismo ítem)
    setPurchasedItems(next);
  }, [flashLowGold]);

  // H5 — Vender un ítem del tracker: lo quita del inventario y reembolsa ~60% de
  // su coste al oro en vivo. Pensado sobre todo para starters (Doran's) que se
  // venden en mid/late para liberar el slot.
  const sellItem = useCallback((name) => {
    if (!name || !purchasedRef.current.has(name)) return;
    const refund = Math.round((Number(costByNameRef.current[name]) || 0) * SELL_REFUND_RATE);
    const next = new Set(purchasedRef.current);
    next.delete(name);
    purchasedRef.current = next; // sincronía inmediata
    setPurchasedItems(next);
    if (refund > 0) {
      goldRef.current += refund;
      setLive(l => (l ? { ...l, gold: l.gold + refund } : l));
    }
  }, []);
  // G2 — el doble-tap compra el SIGUIENTE ITEM: lo añade a purchasedItems Y
  // descuenta su coste (antes se compraba sin coste para no duplicar el gasto;
  // ahora el oro es la fuente de verdad, así que el doble-tap también lo resta).
  const handleNextItemTap = useCallback((name, cost) => {
    const now = Date.now();
    if (now - nextItemTapRef.current < 320) {
      buyItem(name, cost);
      nextItemTapRef.current = 0;
    } else {
      nextItemTapRef.current = now;
    }
  }, [buyItem]);

  // ── Temporizador de cooldowns (hechizos enemigos + ultis) ──────────
  // Un ÚNICO objeto guarda todos los contadores activos, indexados por una
  // clave única ("0_Flash", "0_R"…). Antes había dos estados separados —uno
  // para spells y otro para ultis— con el mismo código duplicado; se unificaron
  // porque sus claves nunca colisionan. Cada entrada es:
  // remaining → segundos que faltan para que vuelva a estar disponible.
  // total → segundos iniciales (para dibujar la barra de progreso).
  // active → si el contador sigue corriendo.
  /** @type {Object<string,{remaining:number,total:number,active:boolean}>} */
  const [cooldowns, setCooldowns] = useState({});

  // Registro de recalls (disponible a partir del minuto 7). `recallHistory`
  // queda en memoria local; cuando el backend exponga /coaching/recall se
  // enviará ahí en vez de mantenerlo sólo en cliente.
  /** @type {boolean} si el wizard de recall está visible */
  const [recallPopupVisible, setRecallPopupVisible] = useState(false);
  /** @type {Array<{minute:number,profitable:boolean}>} historial local de recalls */
  const [recallHistory, setRecallHistory] = useState([]);

  // H36-T14 — Estado EN VIVO del jugador (KDA + oro). El wizard de recall y el
  // botón de muerte lo actualizan; arranca del valor de la sesión (0/0/0 + 500
  // de oro en una partida nueva, o el mock midgame en modo demo).
  const [live, setLive] = useState(null);
  /** @type {boolean} modal de muerte (calavera) */
  const [deathOpen, setDeathOpen] = useState(false);
  /** @type {boolean} B4.2 — modal "¿por qué esta compra?" (explicabilidad) */
  const [showWhyBuy, setShowWhyBuy] = useState(false);

  // P2-6 — Reloj de partida EN VIVO. El reloj real lo lleva ESTE componente:
  // se siembra una vez desde `session.gameTime` (0 en una partida nueva, el
  // valor midgame en demo) y el tick de 1 s (más abajo) lo incrementa. Antes el
  // reloj mostraba `session.gameTime` directo, que nunca cambiaba → parecía
  // congelado. `null` mientras no se ha sembrado.
  /** @type {number|null} segundos de partida transcurridos (fuente del reloj) */
  const [gameClock, setGameClock] = useState(null);

  // ── Registro de recalls (volver a base) ────────────────────────────
  // Guarda en el historial si el recall fue rentable, junto al minuto de
  // partida. De momento sólo vive en memoria y se imprime por consola.
  const logRecall = useCallback((profitable) => {
    setRecallHistory(prev => {
      const entry = { minute: Math.floor((gameClock ?? session?.gameTime ?? 0) / 60), profitable };
      const next  = [...prev, entry];
      // eslint-disable-next-line no-console
      console.log('[NOVA RIFT] Recall registrado:', entry, '| historial:', next);
      return next;
    });
    setRecallPopupVisible(false);
  }, [gameClock, session?.gameTime]);

  // H36-T14 — Inicializa el estado en vivo desde la sesión (una vez por montaje
  // del HUD; el HUD se remonta al entrar a 'active', así que cada partida arranca
  // fresca con los valores de buildManualSession).
  useEffect(() => {
    if (session?.player && live === null) {
      setLive({
        kills:   session.player.kda?.kills ?? 0,
        deaths:  session.player.kda?.deaths ?? 0,
        assists: session.player.kda?.assists ?? 0,
        gold:    session.player.gold ?? 0,
        // B1.3 — CS acumulados de la sesión manual (los aproximamos del oro de
        // farmeo declarado en cada recall/muerte: ~21 oro por súbdito medio).
        cs:      session.player.cs ?? 0,
      });
    }
  }, [session, live]);

  // F4 — Al arrancar la partida, ofrece elegir build UNA vez (selector de inicio).
  useEffect(() => {
    if (session?.player && !buildPromptedRef.current) {
      buildPromptedRef.current = true;
      setBuildPickerVisible(true);
    }
  }, [session]);

  // P2-6 / A1 — Siembra del reloj de partida desde la sesión (una sola vez). A
  // partir de aquí manda `gameClock`; `session.gameTime` solo aporta el punto de
  // partida. IMPORTANTE: una partida MANUAL nueva no siempre trae un gameTime
  // numérico, así que sembramos SIEMPRE a 0 cuando no es finito — de lo contrario
  // `gameClock` se quedaba en `null`, el tick (`prev === null ? prev : prev + 1`)
  // nunca arrancaba y el reloj parecía congelado en 0:00.
  useEffect(() => {
    if (gameClock === null && session) {
      setGameClock(Number.isFinite(session?.gameTime) ? session.gameTime : 0);
    }
  }, [session, gameClock]);

  // P2-6 — Espejo hacia el padre: cada vez que avanza el reloj, avisamos con
  // `onTick(segundos)` para que LiveScreen mantenga el gameTime de la sesión
  // ACTIVA sincronizado (lo usa, p. ej., el registro de recalls). Es un valor
  // ABSOLUTO (no incremento), así que es idempotente y no acumula de más.
  useEffect(() => {
    if (gameClock !== null && typeof onTick === 'function') onTick(gameClock);
    // onTick es un callback del padre estable en intención; lo omitimos de las
    // deps a propósito para no re-disparar en cada render del padre.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameClock]);

  // Recall: suma las kills/asistencias declaradas y el oro generado.
  // A2 — Las kills/asistencias generan oro como en LoL: +300 por kill y +100 por
  // asistencia, SUMADAS AUTOMÁTICAMENTE al oro de farmeo declarado (`g`). Antes el
  // oro iba aparte y matar no aportaba nada al monedero.
  const handleRecall = useCallback((k, a, g) => {
    const combatGold = COMBAT_GOLD(k, a);
    setLive(l => {
      const b = l || { kills: 0, deaths: 0, assists: 0, gold: 0, cs: 0 };
      return {
        kills: b.kills + k, deaths: b.deaths, assists: b.assists + a,
        gold: b.gold + g + combatGold,
        // B1.3 — el oro de farmeo declarado se convierte en CS (~21 oro/súbdito)
        cs: (b.cs ?? 0) + (Number(g) || 0) / FARM_GOLD_PER_CS,
      };
    });
    setRecallPopupVisible(false);
  }, []);

  // Muerte (calavera): +1 muerte y el oro generado desde la última vez.
  const handleDeath = useCallback((g) => {
    setLive(l => {
      const b = l || { kills: 0, deaths: 0, assists: 0, gold: 0, cs: 0 };
      return {
        kills: b.kills, deaths: b.deaths + 1, assists: b.assists,
        gold: b.gold + g,
        cs: (b.cs ?? 0) + (Number(g) || 0) / FARM_GOLD_PER_CS, // B1.3
      };
    });
    setDeathOpen(false);
  }, []);

  // ── Toast del coach: mostrar la primera alerta 4 segundos ──────────
  // useEffect ejecuta código DESPUÉS de pintar la pantalla. El array final
  // ([session?.alerts]) son sus "dependencias": el bloque se vuelve a ejecutar
  // sólo cuando ese valor cambia. Aquí: al llegar nuevas alertas mostramos el
  // toast y, con setTimeout, lo ocultamos a los 4 s. La función `return` es la
  // limpieza: cancela el temporizador si el efecto se relanza o el componente
  // se destruye (evita timers huérfanos).
  useEffect(() => {
    const tip = session?.alerts?.[0]?.text;
    if (!tip) return;
    setToastMessage(tip);
    setToastVisible(true);
    const t = setTimeout(() => setToastVisible(false), 4000);
    return () => clearTimeout(t);
  }, [session?.alerts]);

  /** @type {string|null} mensaje de coaching (backend o fallback mock) */
  const [coachingMsg, setCoachingMsg] = useState(null);

  // TIP DEL COACH — índice del tip mostrado (rotativo con botón ↻).
  // El bucket de tips depende de (phase, role); cuando cualquiera de los dos
  // cambia se resetea a 0 para empezar por el primer tip de la nueva fase.
  /** @type {number} índice del tip del coach mostrado (rotativo) */
  const [coachTipIndex, setCoachTipIndex] = useState(0);

  // ── Coaching card ──────────────────────────────────────────────────
  // Consejo personalizado según facción NOVA RIFT del usuario.
  // Primero intenta el backend; si falla (error, timeout de 4 s), usa el
  // consejo mock local con getGameCoaching(faction).
  // `cancelled` y AbortController evitan actualizar el estado si el componente
  // se desmonta o las dependencias cambian antes de que llegue la respuesta.
  useEffect(() => {
    const backendFaction = FACTION_TO_BACKEND[faction] || 'ANY';
    const role           = String(session?.player?.role || user?.mainRole || 'ADC').toUpperCase();
    const playStyle      = String(user?.playStyle || 'AGGRESSIVE').toUpperCase();
    // NOTA (P2-6): el coaching del BACKEND usa la fase ESTÁTICA de la sesión
    // (session.phase), no el reloj en vivo. El enum del backend es EARLY/
    // MID_GAME/LATE, distinto del bucket de getPhaseFromGameTime que mueve los
    // tips locales; por eso NO lo derivamos del reloj (evita enviar una fase que
    // el backend no entiende). Los tips locales sí siguen el reloj en vivo.
    const context        = String(session?.phase || 'MID_GAME').toUpperCase();

    const params = new URLSearchParams({ role, playStyle, faction: backendFaction, context }).toString();
    const url = `${API_BASE_URL}/coaching/message?${params}`;

    let cancelled = false;
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 4000);

    fetch(url, { signal: ctrl.signal })
      .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
      .then(data => {
        if (cancelled) return;
        if (data?.message) setCoachingMsg(data.message);
      })
      .catch(() => {
        if (cancelled) return;
        setCoachingMsg(getGameCoaching(faction));
      })
      .finally(() => clearTimeout(timeout));

    return () => { cancelled = true; ctrl.abort(); clearTimeout(timeout); };
  }, [faction, session?.phase, session?.player?.role, user?.mainRole, user?.playStyle]);

  // ── Tip del coach: volver al primer consejo al cambiar de fase/rol ─
  // El conjunto de tips depende de (fase, rol). Cuando cualquiera cambia,
  // reseteamos el índice a 0 para empezar por el tip más representativo.
  const tipPhaseKey = getPhaseFromGameTime(gameClock ?? session?.gameTime);
  const tipRoleKey  = String(session?.player?.role || user?.mainRole || 'ADC').toUpperCase();
  useEffect(() => {
    setCoachTipIndex(0);
  }, [tipPhaseKey, tipRoleKey]);

  // ── Temporizador: tick global de 1 segundo ─────────────────────────
  // Con el array de dependencias vacío [], este useEffect se ejecuta una sola
  // vez al montar el componente (como un constructor). setInterval llama a la
  // función cada 1000 ms y devuelve un id; la función `return` hace
  // clearInterval al destruir el componente para no dejar el timer corriendo.
  // Cada segundo recorremos todos los cooldowns activos y les restamos 1; al
  // llegar a 0 el hechizo/ulti vuelve a estar disponible (active = false).
  useEffect(() => {
    const id = setInterval(() => {
      // P2-6 — Avance del reloj de partida: +1 s cada tick. Una vez sembrado
      // (gameClock !== null) sube en tiempo real y `formatGameTime` lo refleja.
      setGameClock(prev => (prev === null ? prev : prev + 1));

      setCooldowns(prev => {
        let dirty = false;             // ¿ha cambiado algo en este tick?
        const next = { ...prev };      // copia: nunca se muta el estado directamente
        for (const k of Object.keys(next)) {
          const t = next[k];
          if (!t.active || t.remaining <= 0) continue;
          const remaining = t.remaining - 1;
          next[k] = remaining <= 0
            ? { ...t, remaining: 0, active: false }
            : { ...t, remaining };
          dirty = true;
        }
        return dirty ? next : prev;    // si nada cambió, devolvemos el mismo objeto
      });
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // ── F1 — Oro pasivo en tiempo real ─────────────────────────────────
  // Cada vez que el reloj avanza un segundo (a partir del 1:05) sumamos ~2 de
  // oro al monedero EN VIVO. El efecto depende SOLO de `gameClock` —que sube
  // exactamente una vez por tick— así que añade una sola vez por segundo. El
  // `setLive` funcional evita tener `live` en las deps (no re-dispara el efecto).
  useEffect(() => {
    if (gameClock === null || gameClock < PASSIVE_GOLD_START_SEC) return;
    setLive(l => (l ? { ...l, gold: l.gold + PASSIVE_GOLD_PER_SEC } : l));
  }, [gameClock]);

  // ── I1 — Fusión diferida cuando el oro pasivo crece ────────────────
  // Si ya tienes TODAS las piezas de un ítem pero te faltaba el oro de
  // combinación, este tick lo reintenta: en cuanto el oro alcanza el coste de
  // fusión, las piezas se funden en el ítem completo y el plan avanza (sin tener
  // que hacer otra compra). Lee/actualiza los espejos en ref (sincronizados en
  // render) y sólo toca estado si de verdad fundió algo.
  useEffect(() => {
    if (gameClock === null) return;
    const combined = tryCombine(purchasedRef.current, activeBuildRef.current, goldRef.current);
    if (combined.combined.length === 0) return;
    const spent = goldRef.current - combined.gold;
    goldRef.current = combined.gold;
    purchasedRef.current = combined.set;
    setPurchasedItems(combined.set);
    if (spent > 0) setLive(l => (l ? { ...l, gold: Math.max(0, l.gold - spent) } : l));
  }, [gameClock]);

  // ── Temporizador: iniciar / reiniciar un cooldown ──────────────────
  // Función reutilizable para hechizos Y ultis (antes había una copia para
  // cada uno). El jugador pulsa el botón y arranca el contador desde `seconds`.
  // useCallback memoiza la función para no recrearla en cada render.
  // name → clave única del cooldown ("0_Flash", "0_R"…).
  const startCooldown = useCallback((name, seconds) => {
    setCooldowns(prev => ({
      ...prev,
      [name]: { remaining: seconds, total: seconds, active: true },
    }));
  }, []);

  // Ajuste manual (+30 / −30 s): corrige la runa Cosmic Insight o un error
  // de conteo. Reutilizable igual que startCooldown.
  const adjustCooldown = useCallback((name, delta) => {
    setCooldowns(prev => {
      const t = prev[name];
      if (!t) return prev;
      const remaining = Math.max(0, t.remaining + delta);
      return { ...prev, [name]: { ...t, remaining, active: remaining > 0 } };
    });
  }, []);

  // ── Datos derivados de la sesión (se recalculan en cada render) ────
  // Sin sesión no hay nada que pintar: devolvemos null (no se dibuja UI).
  if (!session) return null;
  // Desestructuración: extrae campos del objeto session a variables sueltas,
  // con valores por defecto (alerts = [] si no viene).
  const { player, alerts = [], phase, gameTime } = session;

  // P2-6 — `clock` es el tiempo de partida que manda en pantalla: el reloj en
  // vivo (gameClock) si ya está sembrado, o el de la sesión como respaldo. Todo
  // lo que dependa del minuto de partida (reloj, fase, escala de oro del recall)
  // usa `clock`, no el `gameTime` congelado de la sesión.
  const clock = gameClock ?? gameTime ?? 0;

  // Equipo enemigo: usa el real de la sesión y, si no hay, los enemigos demo.
  const enemyTeam = (Array.isArray(session?.enemies) && session.enemies.length > 0)
    ? session.enemies
    : DEMO_ENEMIES;

  // H36-T14 — Stats EN VIVO (override del estado de la sesión por recall/muerte).
  const lk = live || {
    kills:   player.kda?.kills ?? 0,
    deaths:  player.kda?.deaths ?? 0,
    assists: player.kda?.assists ?? 0,
    gold:    player.gold ?? 0,
    cs:      player.cs ?? 0,
  };
  // A3 — Recomendación de compra a partir de las BUILDS REALES del campeón/rol
  // (mocks/itemBuilds, con id de Data Dragon + coste reales), respetando la build
  // PRIORIZADA en la tienda. Antes usaba una guía estática parcial cuyos nombres
  // no resolvían a icono y decía "no alcanza ningún ítem" aun teniendo oro.
  const builds      = getBuildsForChampion(player.champion, player.role);
  const activeBuild = builds.find(b => b.id === priorityBuildId) || builds[0];
  // G1+G4 — Recomendación dinámica desde la build elegida + oro + comprados, con
  // rol y nivel para ofrecer starters a nivel bajo y componentes con oro medio.
  const goldPlan    = recommendFromBuild(lk.gold, activeBuild, purchasedItems, player.role, player.level);

  // G2/G3 — Mapa nombre→id de icono construido desde TODAS las builds del
  // campeón (núcleo + alternativas + sus componentes) + starters del rol + botas.
  // Permite que el ITEM TRACKER y el SIGUIENTE ITEM resuelvan el icono de
  // cualquier objeto comprado (ítem final, componente o starter), sin depender de
  // que getItemIdByName conozca el nombre. Es barato: se recalcula por render.
  const itemIdByName = {};
  const itemCostByName = {};
  const indexItem = (it) => {
    if (!it || !it.name) return;
    if (it.id != null)   itemIdByName[it.name]   = it.id;
    if (it.cost != null) itemCostByName[it.name] = it.cost;
  };
  builds.forEach(b => {
    (b.core || []).forEach(it => { indexItem(it); getItemComponents(it).forEach(indexItem); });
    (b.alternatives || []).forEach(it => { indexItem(it); getItemComponents(it).forEach(indexItem); });
    if (b.boots) { indexItem(b.boots); getItemComponents(b.boots).forEach(indexItem); }
  });
  getStartersForRole(player.role).forEach(indexItem);
  indexItem(BOOTS_STARTER);
  const resolveItemId = (name) =>
    (name ? (itemIdByName[name] || getItemIdByName(name) || null) : null);

  // H1/H5 — Re-sincroniza los espejos en ref con el estado de ESTE render para
  // que buyItem/sellItem (callbacks estables) lean siempre el oro, los comprados
  // y los costes actuales. Idempotente: derivado del estado, sin efectos.
  goldRef.current       = lk.gold;
  purchasedRef.current  = purchasedItems;
  costByNameRef.current = itemCostByName;
  activeBuildRef.current = activeBuild;

  // G3 — SIGUIENTE ITEM dinámico: el primer ítem del NÚCLEO de la build elegida
  // que aún NO se ha comprado. Avanza solo al comprarlo. Antes leía
  // player.nextItem (estático = siempre Infinity Edge). Su nombre/coste/icono y
  // su "razón" salen de la build, no de un mock fijo.
  const coreItems = activeBuild?.core || [];
  const nextCore  = coreItems.find(it => !purchasedItems.has(it.name)) || null;
  const coreDone  = coreItems.length > 0 && !nextCore;
  const nextIndex = nextCore ? coreItems.findIndex(it => it.name === nextCore.name) : -1;
  const nextItem  = nextCore
    ? {
        name:   nextCore.name,
        id:     nextCore.id,
        cost:   nextCore.cost,
        reason: `Núcleo de ${activeBuild?.name} · ${nextIndex + 1}.º de ${coreItems.length} (${nextCore.cost}g).`,
      }
    : null;

  // Ratio KDA = (asesinatos + asistencias) / muertes. Con 0 muertes es ∞ solo
  // si hay participación (estándar op.gg); con 0/0/0 mostramos "—" (sin datos).
  const kdaRatio = lk.deaths > 0
    ? ((lk.kills + lk.assists) / lk.deaths).toFixed(1)
    : (lk.kills + lk.assists > 0 ? '∞' : '—');

  // B1.3 — CS/min EN VIVO: CS acumulados (derivados del farmeo declarado)
  // entre minutos del reloj del HUD. Sin reloj o sin CS válidos → 0.0 (nunca
  // NaN/∞). Se recalcula en cada tick porque `clock` avanza cada segundo.
  const liveMinutes  = clock / 60;
  const liveCsPerMin = (liveMinutes > 0 && Number.isFinite(lk.cs)) ? (lk.cs / liveMinutes) : 0;

  // Tip del coach: fase derivada del tiempo de partida y rol del jugador.
  const coachPhase = getPhaseFromGameTime(clock);
  const coachRole  = String(player?.role || user?.mainRole || 'ADC').toUpperCase();
  const coachTipCount = getCoachingTipCount(coachPhase, coachRole);
  const coachTip = getCoachingTipIndex(coachPhase, coachRole, coachTipIndex);

  // ── UI: el `return` describe el árbol visual (JSX) ─────────────────
  // JSX mezcla marcas tipo HTML con JS entre llaves {}. Cada <View> es un
  // contenedor (como un <div>) y <Text> pinta texto. Los estilos se aplican
  // con `style={...}` y se definen abajo en los StyleSheet.
  return (
    <View style={styles.container}>
      {isDark && <NovaBackground />}

      {/* Toast flotante con la primera alerta de la sesión */}
      <LiveCoachToast
        message={toastMessage}
        visible={toastVisible}
        primaryColor={theme.primary}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Cabecera: punto "en vivo" + reloj + recall + salir ─────
            El reloj usa formatGameTime(gameTime). El botón de recall sólo
            aparece a partir del minuto 7 (gameTime >= 7*60). La "×" llama a
            handleExit. En JSX, `condición && <Componente/>` pinta el
            componente sólo si la condición es verdadera. */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.liveDot} />
            <Text style={styles.liveLabel}>◉ PARTIDA EN CURSO</Text>
          </View>
          <View style={styles.headerRight}>
            <View style={styles.timerBadge}>
              <Text style={styles.timerText}>{formatGameTime(clock)}</Text>
            </View>

            {/* H36-T15.4 — El botón RECALL se recolocó a la zona inferior, junto
                al item tracker (antes estaba aquí arriba, lejos del pulgar). */}

            <TouchableOpacity
              onPress={handleExit}
              style={styles.exitBtn}
              // B2 — target táctil ≥44px: 30px de caja + 12+12 de hitSlop = 54px
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityLabel="Salir del HUD"
            >
              <Text style={styles.exitIcon}>×</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.divider} />

        {/* ── Barra del campeón: icono + KDA + CS/min + fase ─────────
            Muestra los datos del jugador: retrato con anillo de facción,
            nombre, rol/nivel, los bloques KDA (K verde / D rojo / A naranja),
            el ratio KDA y los CS por minuto. Es sólo lectura, no hay timers. */}
        <View style={styles.champBar}>
          {/* Icono 56px con anillo de facción */}
          <View style={[styles.champIconRing, { borderColor: theme.primary, shadowColor: theme.primary }]}>
            <Image
              source={{ uri: getChampionImageUrl(player.champion) }}
              style={styles.champIcon}
              resizeMode="cover"
            />
          </View>

          <View style={styles.champDetails}>
            {/* Nombre + phase pill */}
            <View style={styles.champNameRow}>
              <Text style={styles.champName}>{player.champion}</Text>
              <View style={[styles.phasePill, { borderColor: theme.primary + '66' }]}>
                <Text style={[styles.phaseText, { color: theme.primary }]}>
                  {String(phase || '').replace('_', ' ')}
                </Text>
              </View>
            </View>

            <Text style={styles.champRole}>{player.role} · Nv.{player.level}</Text>

            {/* KDA blocks: K verde / D rojo / A naranja */}
            <View style={styles.kdaRow}>
              <View style={[styles.kdaBlock, styles.kdaBlockK]}>
                <Text style={styles.kdaKills}>{lk.kills}</Text>
                <Text style={styles.kdaLabel}>K</Text>
              </View>
              <Text style={styles.kdaDiv}>/</Text>
              <View style={[styles.kdaBlock, styles.kdaBlockD]}>
                <Text style={styles.kdaDeaths}>{lk.deaths}</Text>
                <Text style={styles.kdaLabel}>D</Text>
              </View>
              <Text style={styles.kdaDiv}>/</Text>
              <View style={[styles.kdaBlock, styles.kdaBlockA]}>
                <Text style={styles.kdaAssists}>{lk.assists}</Text>
                <Text style={styles.kdaLabel}>A</Text>
              </View>
            </View>

            {/* Ratio gold + CS badge gold */}
            <View style={styles.statsRow}>
              <View style={styles.ratioBadge}>
                <Text style={styles.ratioBadgeText}>{kdaRatio} KDA</Text>
              </View>
              <View style={styles.csBadge}>
                <Text style={styles.csText}>CS/min: {liveCsPerMin.toFixed(1)}</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.divider} />

        {/* ── Tracker de ítems: 6 huecos + tienda + siguiente ítem ───
            Pinta los 6 slots del inventario (comprado = borde dorado,
            vacío = borde discontinuo). El botón TIENDA abre el modal ItemShop;
            al comprar, el ítem se añade a purchasedItems y se resalta. Debajo,
            el "siguiente ítem" recomendado por la sesión. */}
        <View style={styles.section}>
          <SectionHeader
            title="ITEM TRACKER"
            right={
              <TouchableOpacity
                onPress={() => setShopVisible(true)}
                style={[styles.shopBtn, { borderColor: theme.primary + '66', backgroundColor: theme.primary + '14' }]}
                activeOpacity={0.8}
              >
                <Text style={[styles.shopBtnText, { color: theme.primary }]}>TIENDA</Text>
              </TouchableOpacity>
            }
          />

          {/* Item slots 56px — G2: se rellenan desde purchasedItems (lo que el
              jugador compra de verdad), en orden de compra. Cada comprado ocupa
              un hueco con su icono; los restantes quedan vacíos. */}
          <View style={styles.itemsRow}>
            {(() => {
              // H6 — los CONSUMIBLES (pociones, centinelas, elixires) no ocupan
              // hueco: se filtran del tracker aunque consten como comprados.
              const purchasedList = Array.from(purchasedItems).filter(n => !CONSUMABLE_NAMES.has(n));
              return Array.from({ length: 6 }).map((_, i) => {
                const name   = purchasedList[i] || null;
                const itemId = resolveItemId(name);
                return (
                  <View
                    key={i}
                    style={[
                      styles.itemSlot,
                      name ? styles.itemSlotBought : styles.itemSlotEmpty,
                    ]}
                  >
                    {itemId ? (
                      <Image
                        source={{ uri: getItemImageUrl(itemId) }}
                        style={styles.itemSlotImage}
                        resizeMode="cover"
                      />
                    ) : name ? (
                      <View style={[styles.itemPlaceholderDot, { backgroundColor: theme.primary }]} />
                    ) : null}
                    {name && (
                      <View style={[styles.itemBoughtOverlay, { borderColor: '#4CAF50' }]} />
                    )}
                    {/* H5 — Botón VENDER (×): quita el ítem y reembolsa ~60% del
                        coste. Va por encima del overlay (zIndex en el estilo). */}
                    {name && (
                      <TouchableOpacity
                        style={styles.sellBtn}
                        onPress={() => sellItem(name)}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                        accessibilityRole="button"
                        accessibilityLabel={`Vender ${name}`}
                      >
                        <Text style={styles.sellBtnText}>×</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              });
            })()}
          </View>

          {/* Siguiente ítem — card con glow cyan. G3: sale de activeBuild.core
              (primer ítem del núcleo sin comprar) y avanza solo al comprarlo.
              P2-5: doble-tap = comprar (añade a tracker y descuenta su coste). */}
          {nextItem ? (() => {
            const nItemId = nextItem.id || getItemIdByName(nextItem.name);
            return (
              <TouchableOpacity
                style={styles.nextItemCard}
                activeOpacity={0.85}
                onPress={() => handleNextItemTap(nextItem.name, nextItem.cost)}
                accessibilityLabel={`Comprar ${nextItem.name} por ${nextItem.cost} de oro (doble toque)`}
              >
                <View style={styles.nextItemHeader}>
                  <View style={styles.nextItemBar} />
                  <Text style={styles.nextItemLabel}>SIGUIENTE ITEM</Text>
                  <Text style={styles.nextItemTapHint}>2× COMPRAR · {nextItem.cost}g</Text>
                </View>
                <View style={styles.nextItemContent}>
                  {nItemId ? (
                    <View style={[styles.nextItemThumbWrap, { borderColor: theme.primary, shadowColor: theme.primary }]}>
                      <Image
                        source={{ uri: getItemImageUrl(nItemId) }}
                        style={styles.nextItemThumb}
                        resizeMode="cover"
                      />
                    </View>
                  ) : null}
                  <Text style={styles.nextItemName}>{nextItem.name}</Text>
                </View>
                {!!nextItem.reason && (
                  <Text style={styles.nextItemReason}>{nextItem.reason}</Text>
                )}
              </TouchableOpacity>
            );
          })() : coreDone ? (
            <View style={[styles.nextItemCard, { borderColor: '#4CAF5066' }]}>
              <View style={styles.nextItemHeader}>
                <View style={[styles.nextItemBar, { backgroundColor: '#4CAF50' }]} />
                <Text style={styles.nextItemLabel}>SIGUIENTE ITEM</Text>
                <Text style={[styles.nextItemTapHint, { color: '#4CAF50' }]}>✓ NÚCLEO COMPLETO</Text>
              </View>
              <Text style={styles.nextItemReason}>
                Núcleo de {activeBuild?.name} completado. Compra alternativas en la TIENDA.
              </Text>
            </View>
          ) : null}
        </View>

        {/* ── H36-T14 — Acciones de partida (junto al item tracker) ──────
            RECALL abre el wizard (kills → asistencias → oro) y MUERTE el modal
            de la calavera. Sustituyen al modal "¿rentable?" y a la entrada de
            oro por texto. */}
        <View style={styles.section}>
          <View style={gtStyles.actionsRow}>
            <TouchableOpacity
              onPress={() => setRecallPopupVisible(true)}
              style={[gtStyles.actionBtn, { borderColor: theme.primary + '88', backgroundColor: theme.primary + '18' }]}
              activeOpacity={0.85}
              accessibilityLabel="Registrar recall"
            >
              <Text style={[gtStyles.actionIcon, { color: theme.primary }]}>⟲</Text>
              <Text style={[gtStyles.actionLabel, { color: theme.primary }]}>RECALL</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setDeathOpen(true)}
              style={[gtStyles.actionBtn, { borderColor: '#FF525288', backgroundColor: '#FF52521A' }]}
              activeOpacity={0.85}
              accessibilityLabel="Registrar muerte"
            >
              <Text style={[gtStyles.actionIcon, { color: '#FF5252' }]}>☠</Text>
              <Text style={[gtStyles.actionLabel, { color: '#FF5252' }]}>MUERTE</Text>
            </TouchableOpacity>
          </View>

          {/* Oro actual (declarado vía recall/muerte) + QUÉ COMPRAR estilo LoL.
              A3 — Las cards salen de la build PRIORIZADA (activeBuild): icono real
              por id de Data Dragon, nombre y coste de los ítems COMPRABLES con el
              oro actual. */}
          <View style={gtStyles.goldPanel}>
            <View style={gtStyles.goldRow}>
              <Text style={gtStyles.goldLabel}>ORO ACTUAL · TOCA PARA COMPRAR</Text>
              <Text style={[gtStyles.goldValue, { color: '#FFD700' }]}>{lk.gold.toLocaleString('es-ES')}</Text>
            </View>
            {!!activeBuild && (
              <Text style={gtStyles.goldBuildName} numberOfLines={1}>
                Build: {activeBuild.name}
              </Text>
            )}
            {/* H1 — Feedback breve al intentar comprar sin oro suficiente. */}
            {lowGoldFlash && (
              <Text style={gtStyles.lowGoldText}>✕ Te falta oro para comprar eso.</Text>
            )}
            {goldPlan && goldPlan.options && goldPlan.options.length > 0 ? (
              <View style={gtStyles.shopCardsRow}>
                {goldPlan.options.map((it, i) => {
                  // Los ítems de build traen `id` de Data Dragon directo; el
                  // getItemIdByName(nombre) queda como red de seguridad.
                  const itemId = it.id || getItemIdByName(it.name);
                  return (
                    // F4 — Tocar la card AÑADE el objeto a la build y descuenta su
                    // coste del oro; la lista se recompone y muestra el siguiente.
                    <TouchableOpacity
                      key={`${it.name}-${i}`}
                      style={[gtStyles.shopCard, i === 0 && { borderColor: theme.primary + '88' }]}
                      activeOpacity={0.8}
                      onPress={() => buyItem(it.name, it.cost)}
                      accessibilityRole="button"
                      accessibilityLabel={`Comprar ${it.name} por ${it.cost} de oro`}
                    >
                      {itemId ? (
                        <Image source={{ uri: getItemImageUrl(itemId) }} style={gtStyles.shopCardIcon} resizeMode="cover" />
                      ) : (
                        <View style={[gtStyles.shopCardIcon, { backgroundColor: c.onSurface(0.06) }]} />
                      )}
                      <Text style={gtStyles.shopCardName} numberOfLines={1}>{it.name}</Text>
                      <Text style={[gtStyles.shopCardCost, { color: '#FFD700' }]}>{it.cost}g</Text>
                      {!!it.tag && (
                        <View style={[gtStyles.shopCardTag, { borderColor: theme.primary + '66' }]}>
                          <Text style={[gtStyles.shopCardTagText, { color: theme.primary }]} numberOfLines={1}>{it.tag}</Text>
                        </View>
                      )}
                      <View style={[gtStyles.shopCardBuy, { borderColor: theme.primary + '55', backgroundColor: theme.primary + '14' }]}>
                        <Text style={[gtStyles.shopCardBuyText, { color: theme.primary }]}>+ AÑADIR</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : (
              <Text style={gtStyles.goldPlanMuted}>
                {goldPlan?.note || 'Introduce tu oro al hacer recall para ver qué comprar.'}
              </Text>
            )}

            {/* B4 (DIN2-UD5) — transparencia + feedback loop de la recomendación
                de compra. Solo cuando HAY recomendación que valorar. */}
            {goldPlan && goldPlan.options && goldPlan.options.length > 0 && (
              <View style={gtStyles.whyBuyRow}>
                <AIFeedbackButtons
                  tipo="item_reco"
                  id={goldPlan.options[0].name}
                  accentColor={theme.primary}
                />
                <TouchableOpacity
                  onPress={() => setShowWhyBuy(true)}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel="¿Por qué esta compra?"
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={[gtStyles.whyBuyLink, { color: theme.primary + 'BB' }]}>
                    ¿Por qué?
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>

        {/* B4.2 — explicabilidad de la recomendación de compra */}
        <AIInsightTooltip
          visible={showWhyBuy}
          onClose={() => setShowWhyBuy(false)}
          title="¿Por qué esta compra?"
          explanation="Basado en tu build elegida, tu oro actual y el orden óptimo de componentes: el asistente ofrece primero el ítem completo si te lo puedes permitir y, si no, la pieza más barata que te acerque a él."
          dataPoints={[
            { label: 'Build activa', value: activeBuild?.name || 'Sin build' },
            { label: 'Oro disponible', value: `${lk.gold.toLocaleString('es-ES')}g` },
            { label: 'Siguiente objetivo', value: goldPlan?.options?.[0]?.name || '—' },
          ]}
        />

        {/* ── Temporizador de cooldowns de hechizos enemigos ─────────
            Una card por enemigo con un botón por cada hechizo invocador.
            Al tocar el botón (lo usó el rival) arranca un contador regresivo
            con startCooldown; al llegar a 0 vuelve a estar disponible. Si el
            Flash está en cooldown se muestra el badge rojo "FLASH DOWN". */}
        <View style={styles.section}>
          <SectionHeader title="SPELL TRACKER" />
          {enemyTeam.map((enemy, eIdx) => (
            <View key={`${enemy.champion}-${eIdx}`} style={spellStyles.enemyCard}>

              {/* Cabecera de la card: icono círculo + nombre + badge FLASH DOWN */}
              <View style={spellStyles.enemyCardHeader}>
                <View style={spellStyles.portraitCircleWrap}>
                  <Image
                    source={{ uri: getChampionImageUrl(enemy.champion) }}
                    style={spellStyles.portrait}
                  />
                </View>
                <Text style={spellStyles.enemyName} numberOfLines={1}>
                  {enemy.champion}
                </Text>

                {/* Badge FLASH DOWN cuando flash está en CD */}
                {(enemy.summoners || []).map(spell => {
                  const key = `${eIdx}_${spell}`;
                  const timer = cooldowns[key];
                  if (spell === 'Flash' && timer?.active) {
                    return (
                      <View key="flashdown" style={spellStyles.flashDownBadge}>
                        <Text style={spellStyles.flashDownText}>FLASH DOWN</Text>
                      </View>
                    );
                  }
                  return null;
                })}
              </View>

              {/* Spells en fila */}
              <View style={spellStyles.spellsGrid}>
                {(enemy.summoners || []).map((spell) => {
                  const key      = `${eIdx}_${spell}`;
                  const timer    = cooldowns[key];
                  const isActive = timer?.active;
                  const isReady  = timer && !timer.active && timer.remaining === 0;
                  const progress = isActive ? timer.remaining / timer.total : 1;
                  const cdSecs   = SUMMONER_CDS[spell] || 300;

                  // Texto del cooldown bajo el nombre: tiempo restante,
                  // LISTO cuando acaba de salir, o el CD base si nunca se ha
                  // pulsado. Centra el contenido y se renderiza por debajo
                  // del nombre del spell.
                  const cdText = isActive
                    ? `${timer.remaining}s`
                    : isReady
                      ? 'LISTO'
                      : `${cdSecs}s`;

                  const spellImgUrl = getSpellImageUrl(spell);
                  return (
                    <View key={spell} style={spellStyles.spellItem}>
                      <TouchableOpacity
                        onPress={() => startCooldown(key, cdSecs)}
                        style={[
                          spellStyles.spellBtn,
                          isActive && spellStyles.spellBtnActive,
                          isReady  && spellStyles.spellBtnReady,
                        ]}
                        activeOpacity={0.8}
                      >
                        {spellImgUrl ? (
                          <Image
                            source={{ uri: spellImgUrl }}
                            style={[
                              spellStyles.spellIcon,
                              isActive && { opacity: 0.45 },
                              isReady  && { opacity: 1, tintColor: undefined },
                            ]}
                            resizeMode="cover"
                          />
                        ) : (
                          <Text style={[
                            spellStyles.spellAbbr,
                            isReady && { color: '#4CAF50' },
                          ]}>
                            {SPELL_SHORT[spell] || spell.slice(0, 2).toUpperCase()}
                          </Text>
                        )}
                        {isActive && (
                          <View style={spellStyles.cdTrack}>
                            <View
                              style={[spellStyles.cdFill, { width: `${progress * 100}%` }]}
                            />
                          </View>
                        )}
                      </TouchableOpacity>
                      <Text style={spellStyles.spellFullName} numberOfLines={1}>{spell}</Text>
                      <Text style={spellStyles.spellTimer}>{cdText}</Text>
                      {isActive && (
                        <View style={spellStyles.adjustRow}>
                          <TouchableOpacity
                            onPress={() => adjustCooldown(key, -30)}
                            style={spellStyles.adjustBtn}
                            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                          >
                            <Text style={spellStyles.adjustText}>−30</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => adjustCooldown(key, +30)}
                            style={spellStyles.adjustBtn}
                            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                          >
                            <Text style={spellStyles.adjustText}>+30</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            </View>
          ))}
          <Text style={spellStyles.hint}>
            Toca un spell al usarlo · ±30 para ajustar runa o error
          </Text>
        </View>

        {/* ── Temporizador de ultis enemigas ─────────────────────────
            Misma idea que el spell tracker, pero sólo para los campeones cuya
            ulti está en CHAMPION_ULTIS. Reutiliza startCooldown/adjustCooldown.
            Esta función flecha que se invoca a sí misma ( ()=>{...} )() permite
            preparar la lista `trackedEnemies` y no pintar nada si está vacía. */}
        {(() => {
          // Cruza el equipo enemigo con CHAMPION_ULTIS y descarta los que no
          // tienen ulti trackeable.
          const trackedEnemies = enemyTeam
            .map((enemy, idx) => ({ enemy, idx, ulti: CHAMPION_ULTIS[enemy.champion] }))
            .filter(x => x.ulti);
          if (trackedEnemies.length === 0) return null;
          return (
            <View style={styles.section}>
              <SectionHeader title="ULTI TRACKER" />
              {trackedEnemies.map(({ enemy, idx, ulti }) => {
                const key      = `${idx}_R`;
                const timer    = cooldowns[key];
                const isActive = timer?.active;
                const isReady  = timer && !timer.active && timer.remaining === 0;
                const progress = isActive ? timer.remaining / timer.total : 1;

                return (
                  <View key={`ulti-${idx}`} style={ultiStyles.row}>
                    <View style={ultiStyles.portraitCircleWrap}>
                      <Image
                        source={{ uri: getChampionImageUrl(enemy.champion) }}
                        style={ultiStyles.portrait}
                      />
                    </View>
                    <View style={ultiStyles.info}>
                      <Text style={ultiStyles.champName} numberOfLines={1}>
                        {enemy.champion}
                      </Text>
                      <Text style={ultiStyles.ultiName} numberOfLines={1}>
                        {ulti.name}
                      </Text>
                      {isActive && (
                        <View style={ultiStyles.cdTrack}>
                          <View
                            style={[ultiStyles.cdFill, { width: `${progress * 100}%` }]}
                          />
                        </View>
                      )}
                    </View>
                    <View style={ultiStyles.actions}>
                      <TouchableOpacity
                        onPress={() => startCooldown(key, ulti.cd)}
                        style={[
                          ultiStyles.cdBtn,
                          isActive && ultiStyles.cdBtnActive,
                          isReady  && ultiStyles.cdBtnReady,
                        ]}
                        activeOpacity={0.8}
                      >
                        <Text style={[
                          ultiStyles.cdBtnText,
                          isActive && { color: '#ff4444' },
                          isReady  && { color: '#4CAF50' },
                        ]}>
                          {isActive
                            ? `${timer.remaining}s`
                            : isReady ? 'LISTO' : `${ulti.cd}s`}
                        </Text>
                      </TouchableOpacity>
                      {isActive && (
                        <View style={ultiStyles.adjustRow}>
                          <TouchableOpacity
                            onPress={() => adjustCooldown(key, -30)}
                            style={ultiStyles.adjustBtn}
                            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                          >
                            <Text style={ultiStyles.adjustText}>−30</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => adjustCooldown(key, +30)}
                            style={ultiStyles.adjustBtn}
                            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                          >
                            <Text style={ultiStyles.adjustText}>+30</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  </View>
                );
              })}
              <Text style={ultiStyles.hint}>
                Toca al ver la R rival · CD base sin ranks/CDR · ±30 para ajustar
              </Text>
            </View>
          );
        })()}

        <View style={styles.divider} />

        {/* H36-T15.1 — Cards genéricas suprimidas: ALERTAS TÁCTICAS (fijas),
            "amenaza" (ThreatIndicator), TIP DEL COACH (redundante) y COACH
            TÁCTICO. El HUD se queda con lo accionable: item tracker + acciones
            de partida, SPELL TRACKER y ULTI TRACKER (contadores que se
            mantienen, arriba). */}

        {/* ── FINALIZAR PARTIDA ──────────────────────────────────────
            Botón explícito al pie del HUD para terminar la sesión manual.
            Llama a `handleExit`, que invoca el `onExit` que pasó LiveScreen
            (o cierra el radar como fallback) y devuelve al jugador a la
            pantalla LiveScreen. Duplica la acción del icono "×" del header
            con una etiqueta clara y visible. */}
        <TouchableOpacity
          onPress={handleExit}
          style={styles.endGameBtn}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Finalizar partida"
        >
          <Text style={styles.endGameBtnText}>FINALIZAR PARTIDA</Text>
        </TouchableOpacity>

      </ScrollView>

      {/* ── Modal de la tienda ─────────────────────────────────────
          Se monta siempre, pero sólo se muestra cuando shopVisible es true.
          Al comprar, añade el ítem al Set purchasedItems (creando un Set nuevo
          para que React detecte el cambio y vuelva a pintar). */}
      <ItemShop
        visible={shopVisible}
        onClose={() => setShopVisible(false)}
        theme={theme}
        purchasedItems={purchasedItems}
        gold={lk.gold}
        champion={player.champion}
        role={player.role}
        onBuy={buyItem}
        priorityBuildId={priorityBuildId}
        setPriorityBuildId={setPriorityBuildId}
      />

      {/* H36-T14 — Wizard de recall (kills → asistencias → oro) y modal de
          muerte (calavera). Sustituyen al antiguo modal "¿Te fue rentable?". */}
      <RecallWizard
        visible={recallPopupVisible}
        onClose={() => setRecallPopupVisible(false)}
        onSubmit={handleRecall}
        theme={theme}
        gameTime={clock}
      />
      <DeathModal
        visible={deathOpen}
        onClose={() => setDeathOpen(false)}
        onSubmit={handleDeath}
        enemies={enemyTeam}
        theme={theme}
        gameTime={clock}
      />

      {/* F4 — Selector de build al INICIO de la partida (elige UNA build a seguir). */}
      <BuildChooserModal
        visible={buildPickerVisible}
        onClose={() => setBuildPickerVisible(false)}
        onChoose={(id) => { setPriorityBuildId(id); setBuildPickerVisible(false); }}
        champion={player.champion}
        role={player.role}
        theme={theme}
        priorityBuildId={priorityBuildId}
      />
    </View>
  );
}

// ─── A2 — Modelo de oro realista (reglas de LoL) ────────────────────────────
// El oro generado en un recall se compone de DOS partes:
//   1. Oro de FARMEO (el que elige el jugador en el selector de abajo).
//   2. Oro de COMBATE: +300 por kill y +100 por asistencia, sumado AUTOMÁTICAMENTE
//      (no lo teclea el jugador; lo deriva el wizard de las kills/asist. declaradas).
// `COMBAT_GOLD` centraliza esa segunda parte para que handleRecall y el wizard
// usen exactamente la misma fórmula.
const GOLD_PER_KILL   = 300;
const GOLD_PER_ASSIST = 150;
const COMBAT_GOLD = (kills, assists) =>
  GOLD_PER_KILL * (Number(kills) || 0) + GOLD_PER_ASSIST * (Number(assists) || 0);

// B1.3 — oro medio por súbdito (~21g): convierte el oro de farmeo declarado en
// el recall/muerte a CS aproximados para derivar el CS/min en vivo del HUD.
const FARM_GOLD_PER_CS = 21;

// Frontera early/late: 15 minutos (en SEGUNDOS). `gameTime` llega en segundos.
const EARLY_CUTOFF_SECONDS = 15 * 60;
const isEarlyGame = (gameTime) => (Number(gameTime) || 0) < EARLY_CUTOFF_SECONDS;

// Paso del selector de oro de FARMEO según la fase:
//   • Early (< 15 min): incrementos de 200 (granularidad fina sobre 400-2000).
//   • Late (>= 15 min): incrementos de 300, como pide la regla del back tardío.
function goldStep(gameTime) {
  return isEarlyGame(gameTime) ? 200 : 300;
}

// Chips de oro de FARMEO ofrecidos por defecto. El jugador puede salirse de la
// lista hacia ARRIBA con el botón "+" del selector (sin tope rígido).
//   • Early: 400 → 2000 (step 200).
//   • Late:  300 → 3000 (step 300).
function getGoldOptions(gameTime) {
  const options = [];
  if (isEarlyGame(gameTime)) {
    for (let g = 400; g <= 2000; g += 200) options.push(g);
  } else {
    for (let g = 300; g <= 3000; g += 300) options.push(g);
  }
  return options;
}

// Estimación por defecto del oro de FARMEO al abrir el selector (dentro de la
// lista de chips de la fase actual).
function getSuggestedGold(gameTime) {
  return isEarlyGame(gameTime) ? 800 : 1500;
}

// F2 — El antiguo "DragToConfirm" (deslizar para confirmar) se eliminó: era
// difícil de pulsar. Tanto el recall como la muerte se confirman ahora con un
// botón de TOQUE simple (ver RecallWizard / DeathModal).

// A2 — Selector de oro de FARMEO. Ofrece los chips de la fase (early 400-2000 /
// late 300-en-300) y, además, un stepper "− / +" que permite SUBIR LIBREMENTE por
// encima del último chip sin tope rígido (paso = el de la fase). El valor actual
// se muestra siempre destacado aunque no coincida con ningún chip.
function GoldSelector({ value, onChange, theme, gameTime }) {
  const { colors: c } = useTheme();
  const wizStyles = useMemo(() => makeWizStyles(c), [c]);
  const options = getGoldOptions(gameTime);
  const step = goldStep(gameTime);
  return (
    <View style={wizStyles.goldSelector}>
      {/* Stepper: − / valor actual / + (sube libremente, sin tope) */}
      <View style={wizStyles.goldStepRow}>
        <TouchableOpacity
          onPress={() => onChange(Math.max(0, (Number(value) || 0) - step))}
          activeOpacity={0.85}
          style={wizStyles.goldStepBtn}
          accessibilityLabel={`Restar ${step} de oro`}
        >
          <Text style={wizStyles.goldStepBtnText}>−</Text>
        </TouchableOpacity>
        <View style={[wizStyles.goldValueChip, { borderColor: theme.primary }]}>
          <Text style={[wizStyles.goldValueChipText, { color: theme.primary }]}>+{Number(value) || 0}</Text>
          <Text style={wizStyles.goldValueChipUnit}>oro farmeo</Text>
        </View>
        <TouchableOpacity
          onPress={() => onChange((Number(value) || 0) + step)}
          activeOpacity={0.85}
          style={[wizStyles.goldStepBtn, { borderColor: theme.primary }]}
          accessibilityLabel={`Sumar ${step} de oro`}
        >
          <Text style={[wizStyles.goldStepBtnText, { color: theme.primary }]}>+</Text>
        </TouchableOpacity>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={wizStyles.goldChips}>
        {options.map((g) => {
          const active = value === g;
          return (
            <TouchableOpacity
              key={g}
              onPress={() => onChange(g)}
              activeOpacity={0.85}
              style={[wizStyles.goldChip, active && { borderColor: theme.primary, backgroundColor: theme.primary + '22' }]}
            >
              <Text style={[wizStyles.goldChipText, active && { color: theme.primary }]}>+{g}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

// Selector de un entero 0..max (kills / asistencias) con botones.
function StepSelector({ value, onChange, max, color }) {
  const { colors: c } = useTheme();
  const wizStyles = useMemo(() => makeWizStyles(c), [c]);
  return (
    <View style={wizStyles.stepRow}>
      {Array.from({ length: max + 1 }, (_, n) => {
        const active = value === n;
        return (
          <TouchableOpacity
            key={n}
            onPress={() => onChange(n)}
            activeOpacity={0.85}
            style={[wizStyles.stepBtn, active && { borderColor: color, backgroundColor: color + '22' }]}
          >
            <Text style={[wizStyles.stepText, active && { color }]}>+{n}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// F2 — Wizard de recall SIMPLE: una sola pantalla (kills + asistencias + oro de
// CS/farmeo) y un botón de TOQUE "CONFIRMAR". Antes eran 3 pasos con "deslizar
// para confirmar" (difícil de pulsar); ahora todo se ve de un vistazo y se
// confirma con un toque. El oro resultante = farmeo + kills×300 + asist×150,
// coherente con lo declarado.
function RecallWizard({ visible, onClose, onSubmit, theme, gameTime }) {
  const { colors: c } = useTheme();
  const recallStyles = useMemo(() => makeRecallStyles(c), [c]);
  const wizStyles = useMemo(() => makeWizStyles(c), [c]);
  const [kills, setKills] = useState(0);
  const [assists, setAssists] = useState(0);
  const [gold, setGold] = useState(() => getSuggestedGold(gameTime));
  // Sólo reseteamos al ABRIR (transición de `visible`). Dependiendo también de
  // `gameTime` (que avanza cada segundo por F1) el efecto se relanzaría 1×/s y
  // borraría lo elegido. La estimación de oro se "fotografía" al abrir.
  useEffect(() => {
    if (visible) { setKills(0); setAssists(0); setGold(getSuggestedGold(gameTime)); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);
  if (!visible) return null;
  // El oro de combate (kills/asist.) se SUMA automáticamente al de farmeo. Aquí
  // sólo lo mostramos; handleRecall vuelve a calcularlo desde (kills, assists).
  const combatGold = COMBAT_GOLD(kills, assists);
  const farmGold   = Number(gold) || 0;
  const totalGold  = farmGold + combatGold;
  return (
    <View style={recallStyles.overlay}>
      <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={onClose} />
      <View style={[recallStyles.card, { borderColor: theme.primary + 'AA', shadowColor: theme.primary }]}>
        <TouchableOpacity style={recallStyles.close} onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={recallStyles.closeText}>×</Text>
        </TouchableOpacity>
        <Text style={[recallStyles.glyph, { color: theme.primary }]}>⟲</Text>
        <Text style={recallStyles.title}>Recall — ¿qué generaste?</Text>

        <Text style={wizStyles.subLabelCenter}>Kills desde la última vez</Text>
        <View style={wizStyles.bodyTight}>
          <StepSelector value={kills} onChange={setKills} max={5} color={theme.primary} />
        </View>

        <Text style={wizStyles.subLabelCenter}>Asistencias</Text>
        <View style={wizStyles.bodyTight}>
          <StepSelector value={assists} onChange={setAssists} max={5} color={theme.primary} />
        </View>

        <Text style={wizStyles.subLabelCenter}>Oro de CS / farmeo</Text>
        <View style={wizStyles.bodyTight}>
          <GoldSelector value={gold} onChange={setGold} theme={theme} gameTime={gameTime} />
        </View>

        {/* Desglose farmeo + combate = total */}
        <View style={wizStyles.goldBreakdown}>
          <View style={wizStyles.goldBreakdownRow}>
            <Text style={wizStyles.goldBreakdownLabel}>Farmeo (CS)</Text>
            <Text style={wizStyles.goldBreakdownVal}>+{farmGold}</Text>
          </View>
          <View style={wizStyles.goldBreakdownRow}>
            <Text style={wizStyles.goldBreakdownLabel}>{kills} kill{kills === 1 ? '' : 's'} × {GOLD_PER_KILL}</Text>
            <Text style={wizStyles.goldBreakdownVal}>+{GOLD_PER_KILL * kills}</Text>
          </View>
          <View style={wizStyles.goldBreakdownRow}>
            <Text style={wizStyles.goldBreakdownLabel}>{assists} asist. × {GOLD_PER_ASSIST}</Text>
            <Text style={wizStyles.goldBreakdownVal}>+{GOLD_PER_ASSIST * assists}</Text>
          </View>
          <View style={[wizStyles.goldBreakdownRow, wizStyles.goldBreakdownTotalRow]}>
            <Text style={[wizStyles.goldBreakdownTotalLabel, { color: theme.primary }]}>TOTAL</Text>
            <Text style={[wizStyles.goldBreakdownTotalVal, { color: theme.primary }]}>+{totalGold} oro</Text>
          </View>
        </View>

        {/* F2 — Confirmar con un TOQUE simple (sin deslizar). */}
        <TouchableOpacity
          style={[wizStyles.confirmBtn, { backgroundColor: theme.primary, borderColor: theme.primary }]}
          onPress={() => onSubmit(kills, assists, farmGold)}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={`Confirmar recall, +${totalGold} oro`}
        >
          <Text style={[wizStyles.confirmBtnText, { color: c.textInverse }]}>CONFIRMAR · +{totalGold} ORO</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// Modal de muerte (calavera): +1 muerte, quién (opcional) y oro generado.
function DeathModal({ visible, onClose, onSubmit, enemies, theme, gameTime }) {
  const { colors: c } = useTheme();
  const recallStyles = useMemo(() => makeRecallStyles(c), [c]);
  const wizStyles = useMemo(() => makeWizStyles(c), [c]);
  // P2-4 — Oro por defecto realista (muere a media partida = más oro generado).
  const [gold, setGold] = useState(() => getSuggestedGold(gameTime));
  const [killer, setKiller] = useState(null);
  // Solo al ABRIR: si dependiera de `gameTime` (que avanza cada segundo por
  // P2-6) borraría el campeón elegido y re-fijaría el oro 1×/s. Snapshot al abrir.
  useEffect(() => {
    if (visible) { setGold(getSuggestedGold(gameTime)); setKiller(null); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);
  if (!visible) return null;
  return (
    <View style={recallStyles.overlay}>
      <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={onClose} />
      <View style={[recallStyles.card, { borderColor: '#FF5252AA', shadowColor: '#FF5252' }]}>
        <TouchableOpacity style={recallStyles.close} onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={recallStyles.closeText}>×</Text>
        </TouchableOpacity>
        <Text style={[recallStyles.glyph, { color: '#FF5252' }]}>☠</Text>
        <Text style={recallStyles.title}>Has muerto (+1)</Text>
        <Text style={wizStyles.subLabel}>¿Quién? (opcional)</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={wizStyles.goldChips}>
          {(enemies || []).map((e, i) => {
            const active = killer === e.champion;
            return (
              <TouchableOpacity
                key={`${e.champion}-${i}`}
                onPress={() => setKiller(active ? null : e.champion)}
                activeOpacity={0.85}
                style={[wizStyles.goldChip, active && { borderColor: '#FF5252', backgroundColor: '#FF52521A' }]}
              >
                <Text style={[wizStyles.goldChipText, active && { color: '#FF8A8A' }]}>{e.champion}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        <Text style={wizStyles.subLabel}>Oro generado desde la última vez</Text>
        <View style={wizStyles.body}><GoldSelector value={gold} onChange={setGold} theme={theme} gameTime={gameTime} /></View>
        {/* F2 — Confirmar con un TOQUE simple (sin deslizar). */}
        <TouchableOpacity
          style={[wizStyles.confirmBtn, { backgroundColor: '#FF5252', borderColor: '#FF5252' }]}
          onPress={() => onSubmit(Number(gold) || 0)}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={`Confirmar muerte, +${Number(gold) || 0} oro`}
        >
          <Text style={[wizStyles.confirmBtnText, { color: '#fff' }]}>CONFIRMAR · +{Number(gold) || 0} ORO</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// Estilos de las acciones de partida (RECALL/MUERTE + panel de oro).
const makeGtStyles = (c) => StyleSheet.create({
  actionsRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1.5, borderRadius: 10, paddingVertical: 12,
  },
  actionIcon: { fontSize: 18, fontWeight: '900' },
  actionLabel: { fontSize: 13, fontWeight: '900', letterSpacing: 2 },
  goldPanel: {
    borderWidth: 1, borderColor: c.onSurface(0.08), borderRadius: 10,
    padding: 12, backgroundColor: c.onSurface(0.03), gap: 6,
  },
  goldRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  goldLabel: { color: c.onSurface(0.5), fontSize: 10, fontWeight: '900', letterSpacing: 1.5 },
  goldValue: { fontSize: 20, fontWeight: '900' },
  goldBuildName: { color: c.onSurface(0.45), fontSize: 10, fontWeight: '800', letterSpacing: 0.5, marginTop: -2 },
  // H1 — aviso "te falta oro" (rojo) bajo el nombre de la build.
  lowGoldText: { color: '#FF5252', fontSize: 11, fontWeight: '900', letterSpacing: 0.3 },
  goldPlan: { color: c.onSurface(0.7), fontSize: 12, lineHeight: 17 },
  goldPlanMuted: { color: c.onSurface(0.4), fontSize: 11, lineHeight: 16 },
  // B4 — fila feedback 👍/👎 + enlace "¿Por qué?" bajo las cards de compra.
  whyBuyRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  whyBuyLink: {
    fontSize: 11, fontWeight: '700', letterSpacing: 0.5,
    textDecorationLine: 'underline', marginTop: 8,
  },
  // H36-T15.3 — cards de recomendación de compra estilo LoL.
  shopCardsRow: { flexDirection: 'row', gap: 8 },
  shopCard: {
    flex: 1, borderWidth: 1, borderColor: c.onSurface(0.1), borderRadius: 8,
    padding: 8, alignItems: 'center', backgroundColor: c.onSurface(0.03),
  },
  shopCardIcon: { width: 40, height: 40, borderRadius: 6, marginBottom: 6 },
  shopCardName: { color: c.textPrimary, fontSize: 11, fontWeight: '800', textAlign: 'center' },
  shopCardCost: { fontSize: 12, fontWeight: '900', marginTop: 2 },
  shopCardTag: {
    marginTop: 5, borderWidth: 1, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1,
  },
  shopCardTagText: { fontSize: 8, fontWeight: '900', letterSpacing: 0.5 },
  shopCardNote: { color: c.onSurface(0.5), fontSize: 9, lineHeight: 12, marginTop: 4, textAlign: 'center' },
  // F4 — Badge "+ AÑADIR" al pie de cada card comprable (toca = añadir a build).
  shopCardBuy: {
    marginTop: 6, borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3,
    alignSelf: 'stretch', alignItems: 'center',
  },
  shopCardBuyText: { fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
});

// Estilos compartidos de los wizards (selectores + navegación).
const makeWizStyles = (c) => StyleSheet.create({
  stepTag: { color: c.onSurface(0.4), fontSize: 9, fontWeight: '900', letterSpacing: 2, marginBottom: 4 },
  body: { marginTop: 14, marginBottom: 16, width: '100%' },
  // F2 — variante compacta para la pantalla única del recall (3 selectores).
  bodyTight: { marginTop: 8, marginBottom: 10, width: '100%' },
  subLabel: { color: c.onSurface(0.5), fontSize: 10, fontWeight: '800', letterSpacing: 1, marginTop: 10, alignSelf: 'flex-start' },
  subLabelCenter: { color: c.onSurface(0.55), fontSize: 11, fontWeight: '800', letterSpacing: 1, marginTop: 8, alignSelf: 'center' },
  // F2 — botón de confirmación por TOQUE (sustituye al "deslizar para confirmar").
  confirmBtn: {
    width: '100%', marginTop: 6, paddingVertical: 14, borderRadius: 12, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
  },
  confirmBtnText: { fontSize: 14, fontWeight: '900', letterSpacing: 1.5 },
  stepRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, flexWrap: 'wrap' },
  stepBtn: {
    width: 44, height: 44, borderRadius: 10, borderWidth: 1.5, borderColor: c.onSurface(0.12),
    alignItems: 'center', justifyContent: 'center', backgroundColor: c.onSurface(0.03),
  },
  stepText: { color: c.onSurface(0.6), fontSize: 16, fontWeight: '900' },
  goldChips: { gap: 8, paddingVertical: 2 },
  goldChip: {
    paddingHorizontal: 12, paddingVertical: 9, borderRadius: 8, borderWidth: 1.5,
    borderColor: c.onSurface(0.12), backgroundColor: c.onSurface(0.03),
  },
  goldChipText: { color: c.onSurface(0.6), fontSize: 13, fontWeight: '900' },
  // A2 — Stepper "− valor +" del selector de oro (subir libremente sin tope).
  goldSelector: { width: '100%', gap: 10 },
  goldStepRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 },
  goldStepBtn: {
    width: 44, height: 44, borderRadius: 22, borderWidth: 1.5, borderColor: c.onSurface(0.18),
    alignItems: 'center', justifyContent: 'center', backgroundColor: c.onSurface(0.04),
  },
  goldStepBtnText: { color: c.onSurface(0.7), fontSize: 22, fontWeight: '900', lineHeight: 24 },
  goldValueChip: {
    minWidth: 120, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10, borderWidth: 1.5,
    alignItems: 'center', backgroundColor: c.onSurface(0.04),
  },
  goldValueChipText: { fontSize: 20, fontWeight: '900', letterSpacing: 0.5 },
  goldValueChipUnit: { color: c.onSurface(0.4), fontSize: 9, fontWeight: '800', letterSpacing: 1, marginTop: 1 },
  // A2 — Desglose farmeo + combate = total dentro del paso de oro del recall.
  goldBreakdown: {
    marginTop: 12, borderWidth: 1, borderColor: c.onSurface(0.1), borderRadius: 10,
    padding: 10, gap: 4, backgroundColor: c.onSurface(0.025),
  },
  goldBreakdownRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  goldBreakdownLabel: { color: c.onSurface(0.55), fontSize: 12, fontWeight: '600' },
  goldBreakdownVal: { color: c.onSurface(0.7), fontSize: 12, fontWeight: '800' },
  goldBreakdownTotalRow: {
    marginTop: 4, paddingTop: 6, borderTopWidth: 1, borderTopColor: c.onSurface(0.1),
  },
  goldBreakdownTotalLabel: { fontSize: 11, fontWeight: '900', letterSpacing: 1.5 },
  goldBreakdownTotalVal: { fontSize: 15, fontWeight: '900' },
  navRow: { flexDirection: 'row', gap: 10, width: '100%', marginTop: 4 },
  navBtn: { flex: 1, borderWidth: 1.5, borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  navBack: { borderColor: c.onSurface(0.15), backgroundColor: c.onSurface(0.04) },
  navBackText: { color: c.onSurface(0.6), fontSize: 12, fontWeight: '900', letterSpacing: 1.5 },
  navNextText: { fontSize: 12, fontWeight: '900', letterSpacing: 1.5 },
});

const makeRecallStyles = (c) => StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: c.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    zIndex: 500,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: c.bg2,
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 22,
    alignItems: 'center',
    shadowOpacity: 0.6,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 0 },
    elevation: 18,
  },
  close: {
    position: 'absolute', top: 6, right: 10,
    width: 32, height: 32, alignItems: 'center', justifyContent: 'center',
  },
  closeText: { color: c.onSurface(0.6), fontSize: 24, fontWeight: '300' },
  glyph: { fontSize: 40, marginBottom: 6 },
  title: {
    color: c.textPrimary,
    fontSize: 16, fontWeight: '900',
    letterSpacing: 1.5, textAlign: 'center',
    marginBottom: 14,
    fontFamily: 'Rajdhani_700Bold',
  },
  goldLine: {
    fontSize: 14, fontWeight: '700',
    marginBottom: 18, textAlign: 'center',
    fontFamily: 'Rajdhani_600SemiBold',
  },
  goldValue: { color: '#FFD700', fontSize: 18, fontWeight: '900' },
  hint: {
    color: c.onSurface(0.55), fontSize: 12,
    textAlign: 'center', marginBottom: 18, fontStyle: 'italic',
  },
  actions: {
    flexDirection: 'row', gap: 10, width: '100%',
  },
  btn: {
    flex: 1, paddingVertical: 14, borderRadius: 8,
    borderWidth: 1.5, alignItems: 'center', justifyContent: 'center',
  },
  btnYes: {
    backgroundColor: 'rgba(46,204,113,0.18)',
    borderColor: '#2ecc71',
  },
  btnYesText: {
    color: '#2ecc71', fontSize: 13, fontWeight: '900',
    letterSpacing: 2, fontFamily: 'Rajdhani_700Bold',
  },
  btnNo: {
    backgroundColor: 'rgba(231,76,60,0.18)',
    borderColor: '#e74c3c',
  },
  btnNoText: {
    color: '#e74c3c', fontSize: 13, fontWeight: '900',
    letterSpacing: 2, fontFamily: 'Rajdhani_700Bold',
  },
});

// ── Guía de build por campeón ──────────────────────────────────────
// Lista de ítems ordenada por prioridad (1 = lo primero que se compra) con su
// coste. Si el campeón no está aquí se usa la guía genérica de abajo.
// H36-T15 (§6.3) — cada ítem lleva `tag` (propósito) y `note` (cuándo) para
// pintar la recomendación con cards estilo LoL (icono + coste + etiqueta + 1 línea).
const ITEM_BUILD_GUIDE = {
  Jinx: [
    { name: 'Infinity Edge',      cost: 3400, priority: 1, tag: 'Crítico',     note: 'Tu pico de daño llega con 2 ítems.' },
    { name: 'Kraken Slayer',      cost: 2900, priority: 2, tag: 'Antitanques', note: 'Daño verdadero al tercer ataque.' },
    { name: "Runaan's Hurricane", cost: 2600, priority: 3, tag: 'Teamfight',   note: 'Pega a varios y limpia oleadas.' },
    { name: 'Berserker Greaves',  cost: 1100, priority: 4, tag: 'Velocidad',   note: 'Velocidad de ataque temprana.' },
    { name: 'Long Sword + Dagger',cost: 500,  priority: 5, tag: 'Componentes', note: 'Piezas baratas para tu primer ítem.' },
  ],
  Caitlyn: [
    { name: 'Galeforce',          cost: 3300, priority: 1, tag: 'Movilidad',   note: 'Dash para reposicionar y rematar.' },
    { name: 'Infinity Edge',      cost: 3400, priority: 2, tag: 'Crítico',     note: 'Multiplica tu daño de crítico.' },
    { name: 'Rapid Firecannon',   cost: 2500, priority: 3, tag: 'Rango',       note: 'Más rango para abusar en línea.' },
    { name: 'Berserker Greaves',  cost: 1100, priority: 4, tag: 'Velocidad',   note: 'Velocidad de ataque temprana.' },
    { name: 'Long Sword',         cost: 350,  priority: 5, tag: 'Componente',  note: 'Daño de ataque barato.' },
  ],
  Ahri: [
    { name: "Luden's Tempest",    cost: 3200, priority: 1, tag: 'Burst',       note: 'Daño de ráfaga y maná.' },
    { name: 'Shadowflame',        cost: 3000, priority: 2, tag: 'Penetración', note: 'Penetra escudos y objetivos a baja vida.' },
    { name: "Rabadon's Deathcap", cost: 3600, priority: 3, tag: 'Escalado',    note: 'Amplifica todo tu poder de habilidad.' },
    { name: "Sorcerer's Shoes",   cost: 1100, priority: 4, tag: 'Penetración', note: 'Penetración mágica temprana.' },
    { name: 'Amplifying Tome',    cost: 435,  priority: 5, tag: 'Componente',  note: 'Poder de habilidad barato.' },
  ],
  Zed: [
    { name: 'Duskblade',          cost: 3100, priority: 1, tag: 'Asesino',     note: 'Penetración letal para reventar al carry.' },
    { name: 'Edge of Night',      cost: 2900, priority: 2, tag: 'Supervivencia', note: 'Escudo anti-CC antes de tu all-in.' },
    { name: "Serpent's Fang",     cost: 2600, priority: 3, tag: 'Antiescudos', note: 'Reduce los escudos enemigos.' },
    { name: 'Ionian Boots',       cost: 950,  priority: 4, tag: 'Cooldown',    note: 'Menos enfriamiento de habilidades.' },
    { name: 'Long Sword',         cost: 350,  priority: 5, tag: 'Componente',  note: 'Daño de ataque barato.' },
  ],
  Garen: [
    { name: 'Trinity Force',      cost: 3333, priority: 1, tag: 'Bruiser',     note: 'Daño, velocidad y resistencia.' },
    { name: 'Stridebreaker',      cost: 3300, priority: 2, tag: 'Enganche',    note: 'Ralentiza y pega en área.' },
    { name: "Dead Man's Plate",   cost: 2900, priority: 3, tag: 'Movilidad',   note: 'Velocidad de movimiento + golpe cargado.' },
    { name: 'Plated Steelcaps',   cost: 1100, priority: 4, tag: 'Defensa',     note: 'Armadura contra ataques básicos.' },
    { name: 'Ruby Crystal',       cost: 400,  priority: 5, tag: 'Componente',  note: 'Vida temprana.' },
  ],
};

const GENERIC_BUILD_GUIDE = [
  { name: 'Ítem situacional',   cost: 3000, priority: 1, tag: 'Adaptable',   note: 'Elige según la composición enemiga.' },
  { name: 'Botas',              cost: 1100, priority: 2, tag: 'Movilidad',   note: 'Velocidad de movimiento.' },
  { name: 'Componente de ítem', cost: 800,  priority: 3, tag: 'Componente', note: 'Pieza hacia tu primer ítem.' },
];

// Dado el oro y el campeón, decide qué comprar: filtra los ítems asequibles,
// los ordena por prioridad y devuelve el principal (`main`), lo que sobra
// (`remainder`), un ítem extra y `options` (las 2-3 mejores recomendaciones para
// pintar como cards estilo LoL). Devuelve null si el oro no es válido. Pura.
export function calculateGoldPurchase(gold, champion) {
  const guide = ITEM_BUILD_GUIDE[champion] || GENERIC_BUILD_GUIDE;
  if (!Number.isFinite(gold) || gold <= 0) return null;

  const affordable = guide
    .filter(item => item.cost <= gold)
    .sort((a, b) => a.priority - b.priority);

  if (affordable.length === 0) {
    return { main: null, remainder: gold, options: [], note: 'No alcanza ningún ítem todavía. Sigue farmando.' };
  }

  const main = affordable[0];
  const remainder = gold - main.cost;
  const extra = guide.find(item => item !== main && item.cost <= remainder);
  return { main, remainder, extra, options: affordable.slice(0, 3) };
}

// Hasta este nivel ofrecemos los STARTERS de inicio (Doran's + poción + botas)
// antes que los ítems del núcleo. En la partida manual el nivel se queda en 1
// (no hay UI de subir de nivel), así que el inicio se ofrece hasta que se compran.
const STARTER_LEVEL_MAX = 3;

// G1+G4 — Recomendación de compra a partir de la BUILD elegida + el ORO + los
// OBJETOS COMPRADOS. Devuelve SIEMPRE algo comprable si el oro da para ello, en
// este orden:
//   (a) STARTERS del rol a nivel bajo (Doran's + poción / botas) asequibles;
//   (b) el siguiente ítem del núcleo si es asequible completo (+ otros pendientes);
//   (c) si NO es asequible → sus COMPONENTES asequibles (del más caro al barato, máx 3);
//   (d) botas si aún no las tienes y caben;
//   (e) red de seguridad: cualquier starter asequible.
// Sólo cae a "sigue farmando" cuando NADA (starter/componente/botas) cabe con el
// oro actual. Todos los ítems traen `id` (icono) y `cost` reales. Función pura.
export function recommendFromBuild(gold, build, purchased, role, level) {
  if (!build || !Array.isArray(build.core)) {
    return { options: [], note: 'Sin build disponible para este campeón.' };
  }
  const purchasedSet = purchased instanceof Set ? purchased : new Set();
  const safeGold = Number.isFinite(gold) ? gold : 0;
  const has = (name) => purchasedSet.has(name);
  const costOf = (it) => Number(it && it.cost) || 0;
  // Comprable AHORA: tiene coste positivo, cabe en el oro y no se ha comprado.
  const affordable = (it) => !!it && costOf(it) > 0 && costOf(it) <= safeGold && !has(it.name);

  // Starters del rol (Doran's + poción). Las BOTAS ya NO van aquí: se gestionan
  // en el plan (abajo) para poder MEJORARLAS de básicas a completas (H4).
  const starterPool = getStartersForRole(role).map(it => ({ ...it, tag: it.tag || 'INICIO' }));

  // (a) STARTERS a nivel bajo: ofrécelos mientras queden pendientes y asequibles.
  const lvl = Number(level);
  const lowLevel = !Number.isFinite(lvl) || lvl <= STARTER_LEVEL_MAX;
  if (lowLevel) {
    const startersBuyable = starterPool.filter(affordable);
    if (startersBuyable.length > 0) return { options: startersBuyable.slice(0, 3) };
  }

  // Plan ordenado: BOTAS COMPLETAS → núcleo (en orden) → alternativas. Las botas
  // van primero (compra temprana, baratas) para que la guía suba de básicas a
  // completas desde pronto; el card "SIGUIENTE ITEM" sigue mostrando el núcleo
  // aparte. Sólo lo PENDIENTE (sin comprar) y SIN duplicados por nombre (p. ej.
  // un soporte cuyas botas completas coinciden con un ítem del núcleo).
  const completeBoots = { ...(build.boots || getCompleteBootsForRole(role)), tag: 'BOTAS' };
  const core = build.core.map(it => ({ ...it, tag: 'NÚCLEO' }));
  const alts = Array.isArray(build.alternatives) ? build.alternatives.map(it => ({ ...it, tag: 'ALT' })) : [];
  const rawPlan = [completeBoots, ...core, ...alts].filter(Boolean);
  const seen = new Set();
  const plan = rawPlan.filter(it => it.name && !seen.has(it.name) && seen.add(it.name));
  const pending = plan.filter(it => !has(it.name));
  const nextPlanItem = pending[0] || null;

  // Núcleo + botas + alternativas completados.
  if (!nextPlanItem) return { options: [], note: 'Build completada. Domina el Nexo.' };

  // ── I1 — Estado de construcción del siguiente ítem del plan ───────────────
  const nextComps    = getItemComponents(nextPlanItem);
  const ownedComps   = nextComps.filter(c => c && c.name && has(c.name));
  const haveAllComps = nextComps.length > 0 && ownedComps.length === nextComps.length;
  const startedBuild = ownedComps.length > 0;

  // (b') Ya tienes TODAS las piezas → falta el ORO DE COMBINACIÓN para fundirlo.
  //      El oro pasivo lo completará (ver efecto de fusión diferida); indica cuánto
  //      falta para que se forme el ítem completo y el plan avance.
  if (haveAllComps) {
    const missing = Math.max(0, getCombineCost(nextPlanItem) - safeGold);
    return {
      options: [],
      note: missing > 0
        ? `Tienes las piezas de ${nextPlanItem.name}: junta ${missing}g para fundirlo.`
        : `Fundiendo ${nextPlanItem.name}…`,
    };
  }

  // (b) Sin empezar a construirlo y con oro para el COMPLETO → ofrece el ítem
  //     completo (y otros pendientes asequibles sin empezar, en orden, máx 3).
  if (!startedBuild && affordable(nextPlanItem)) {
    return { options: pending.filter(affordable).slice(0, 3) };
  }

  // (c) Ofrece las PIEZAS que FALTAN (asequibles), de la más cara a la más barata.
  //     Al completar la última, tryCombine las funde en el ítem (no se repiten las
  //     ya compradas: se filtran con !has). Para las botas completas la pieza es
  //     'Boots' (básicas) → primero básicas y luego se funden en las completas.
  const comps = nextComps
    .filter(c => c && c.name && !has(c.name))
    .map(comp => ({ ...comp, tag: 'PIEZA' }))
    .filter(affordable)
    .sort((a, b) => costOf(b) - costOf(a))
    .slice(0, 3);
  if (comps.length > 0) return { options: comps };

  // (d) Red de seguridad: cualquier starter asequible (aunque no sea nivel bajo).
  const startersBuyable = starterPool.filter(affordable);
  if (startersBuyable.length > 0) return { options: startersBuyable.slice(0, 3) };

  // (e) Nada cabe. Si YA empezaste a construir el ítem (tienes alguna pieza),
  //     apunta a la PIEZA que falta más barata (descontando lo ya comprado); si
  //     no, al ítem completo. Así el "faltan" no ignora las piezas ya en mano.
  if (startedBuild) {
    const unowned = nextComps.filter(c => c && c.name && !has(c.name));
    const cheapest = unowned.reduce((m, c) => (m && costOf(m) <= costOf(c) ? m : c), unowned[0] || null);
    if (cheapest) {
      const missPiece = Math.max(0, costOf(cheapest) - safeGold);
      return { options: [], note: `Sigue farmando: faltan ${missPiece}g para ${cheapest.name} (pieza de ${nextPlanItem.name}).` };
    }
  }

  // Nada cabe y sin piezas empezadas: cuánto falta para el siguiente ítem completo.
  const missing = Math.max(0, costOf(nextPlanItem) - safeGold);
  return {
    options: [],
    note: safeGold <= 0
      ? `Introduce tu oro al hacer recall para ver qué comprar (próximo: ${nextPlanItem.name}).`
      : `Sigue farmando: faltan ${missing}g para ${nextPlanItem.name} (o una pieza más barata).`,
  };
}

// ─── Main StyleSheet ─────────────────────────────────────────────────────────
const makeStyles = (c) => StyleSheet.create({
  container: {
    flex: 1, backgroundColor: c.bg0,
  },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 100 },

  // ── Divider cyan ──────────────────────────────────────────────────────────
  divider: {
    height: 1,
    backgroundColor: 'rgba(123,118,221,0.12)',
    marginHorizontal: 16,
    marginVertical: 6,
  },

  // ── Section wrapper ───────────────────────────────────────────────────────
  section: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: c.onSurface(0.025),
    borderWidth: 1,
    borderColor: 'rgba(123,118,221,0.15)',
    borderRadius: 12,
    padding: 14,
  },

  // ── Header ────────────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 10,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  liveDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: '#4CAF50',
    shadowColor: '#4CAF50', shadowOpacity: 0.9,
    shadowRadius: 6, shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  liveLabel: {
    color: c.textPrimary, fontSize: 12, fontWeight: '900', letterSpacing: 2,
  },
  timerBadge: {
    paddingHorizontal: 12, paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: 'rgba(123,118,221,0.08)',
    borderWidth: 1, borderColor: 'rgba(123,118,221,0.35)',
    shadowColor: '#7B76DD', shadowOpacity: 0.3,
    shadowRadius: 8, shadowOffset: { width: 0, height: 0 },
  },
  timerText: {
    color: '#7B76DD', fontSize: 20, fontWeight: '900',
    fontVariant: ['tabular-nums'], letterSpacing: 1,
  },
  exitBtn: {
    width: 30, height: 30, borderRadius: 6,
    backgroundColor: c.onSurface(0.06),
    borderWidth: 1, borderColor: c.onSurface(0.10),
    alignItems: 'center', justifyContent: 'center',
  },
  exitIcon: {
    color: c.onSurface(0.75), fontSize: 18, lineHeight: 18, fontWeight: '600',
  },
  // Botón "FINALIZAR PARTIDA" al pie del HUD (flujo manual "Iniciar Partida").
  // Estilo destructivo discreto (rojo translúcido) para diferenciarlo de las
  // acciones tácticas y dejar claro que cierra la sesión.
  endGameBtn: {
    marginHorizontal: 16, marginTop: 4, marginBottom: 28,
    paddingVertical: 15, borderRadius: 10,
    backgroundColor: 'rgba(255,68,68,0.12)',
    borderWidth: 1, borderColor: 'rgba(255,68,68,0.50)',
    alignItems: 'center',
  },
  endGameBtnText: {
    color: '#ff5a5a', fontSize: 13, fontWeight: '900', letterSpacing: 2,
  },
  // Botón recall (header).
  recallBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 5,
    borderRadius: 6, borderWidth: 1,
    backgroundColor: 'rgba(123,118,221,0.10)',
  },
  recallIcon: { fontSize: 16, fontWeight: '900', lineHeight: 18 },
  recallLabel: {
    fontSize: 9, fontWeight: '900', letterSpacing: 1.5,
    fontFamily: 'Rajdhani_700Bold',
  },

  // ── Champion Bar ──────────────────────────────────────────────────────────
  champBar: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, marginBottom: 0, marginTop: 4,
    backgroundColor: c.onSurface(0.025),
    borderWidth: 1, borderColor: 'rgba(123,118,221,0.15)',
    borderRadius: 12, padding: 14, gap: 14,
  },
  champIconRing: {
    width: 62, height: 62, borderRadius: 31,
    borderWidth: 2.5, overflow: 'hidden',
    shadowOpacity: 0.55, shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 }, elevation: 6,
  },
  champIcon: { width: 58, height: 58, borderRadius: 29 },
  champDetails: { flex: 1, gap: 3 },
  champNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  champName: { color: c.textPrimary, fontSize: 17, fontWeight: '900', letterSpacing: 0.5 },
  phasePill: {
    paddingHorizontal: 7, paddingVertical: 3,
    borderRadius: 5, borderWidth: 1,
    backgroundColor: c.onSurface(0.04),
  },
  phaseText: { fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  champRole: { color: c.onSurface(0.45), fontSize: 11, fontWeight: '700' },

  // KDA blocks
  kdaRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  kdaBlock: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 5, alignItems: 'center', minWidth: 30 },
  kdaBlockK: { backgroundColor: 'rgba(76,175,80,0.15)' },
  kdaBlockD: { backgroundColor: 'rgba(255,68,68,0.15)' },
  kdaBlockA: { backgroundColor: 'rgba(255,152,0,0.15)' },
  kdaKills:   { color: '#4CAF50', fontSize: 17, fontWeight: '900' },
  kdaDeaths:  { color: '#ff4444', fontSize: 17, fontWeight: '900' },
  kdaAssists: { color: '#FF9800', fontSize: 17, fontWeight: '900' },
  kdaLabel:   { color: c.onSurface(0.35), fontSize: 8, fontWeight: '900', letterSpacing: 0.5 },
  kdaDiv:     { color: c.onSurface(0.20), fontSize: 14, fontWeight: '700' },

  // Stats row (ratio + CS badge)
  statsRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ratioBadge: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 5,
    backgroundColor: 'rgba(255,215,0,0.10)',
    borderWidth: 1, borderColor: 'rgba(255,215,0,0.30)',
  },
  ratioBadgeText: { color: '#FFD700', fontSize: 10, fontWeight: '900' },
  csBadge: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 5,
    backgroundColor: 'rgba(255,215,0,0.10)',
    borderWidth: 1, borderColor: 'rgba(255,215,0,0.30)',
  },
  csText: { color: '#FFD700', fontSize: 10, fontWeight: '900' },

  // ── Item Tracker ──────────────────────────────────────────────────────────
  shopBtn: {
    borderWidth: 1, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4,
  },
  shopBtnText: { fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  itemsRow: { flexDirection: 'row', gap: 7, flexWrap: 'wrap', marginBottom: 10 },
  itemSlot: {
    width: 56, height: 56, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  itemSlotFilled: {
    backgroundColor: c.onSurface(0.06),
    borderWidth: 1.5, borderColor: 'rgba(123,118,221,0.40)',
  },
  itemSlotBought: {
    backgroundColor: 'rgba(255,215,0,0.08)',
    borderWidth: 2, borderColor: '#FFD700',
  },
  itemSlotEmpty: {
    backgroundColor: c.onSurface(0.02),
    borderWidth: 1.5, borderStyle: 'dashed',
    borderColor: 'rgba(123,118,221,0.28)',
  },
  itemSlotImage: { width: 56, height: 56, borderRadius: 8 },
  itemPlaceholderDot: {
    width: 8, height: 8, borderRadius: 4, opacity: 0.6,
  },
  itemBoughtOverlay: {
    position: 'absolute',
    top: 0, right: 0, bottom: 0, left: 0,
    borderRadius: 8,
    borderWidth: 2,
    backgroundColor: 'rgba(76,175,80,0.10)',
  },
  // H5 — Botón VENDER (×) en la esquina del slot comprado. zIndex para quedar
  // por encima del overlay verde de "comprado".
  sellBtn: {
    position: 'absolute', top: 1, right: 1,
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: 'rgba(255,68,68,0.92)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.45)',
    alignItems: 'center', justifyContent: 'center', zIndex: 5,
  },
  sellBtnText: { color: '#ffffff', fontSize: 12, lineHeight: 13, fontWeight: '900' },

  // Next item card
  nextItemCard: {
    borderRadius: 8, padding: 10,
    backgroundColor: 'rgba(123,118,221,0.04)',
    borderWidth: 1, borderColor: 'rgba(123,118,221,0.22)',
    shadowColor: '#7B76DD', shadowOpacity: 0.12,
    shadowRadius: 8, shadowOffset: { width: 0, height: 0 },
  },
  nextItemHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 7 },
  nextItemBar:    { width: 3, height: 12, borderRadius: 2, backgroundColor: '#7B76DD' },
  nextItemLabel:  { color: '#7B76DD', fontSize: 10, fontWeight: '900', letterSpacing: 2 },
  nextItemTapHint:{ marginLeft: 'auto', color: c.onSurface(0.4), fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  nextItemContent:{ flexDirection: 'row', alignItems: 'center', gap: 10 },
  nextItemThumbWrap: {
    width: 42, height: 42, borderRadius: 8, overflow: 'hidden',
    borderWidth: 2,
    shadowOpacity: 0.45, shadowRadius: 7, shadowOffset: { width: 0, height: 0 },
  },
  nextItemThumb: { width: 42, height: 42 },
  nextItemName: { color: c.textPrimary, fontSize: 15, fontWeight: '900', flex: 1 },
  nextItemReason: {
    color: c.onSurface(0.50), fontSize: 11, lineHeight: 16, marginTop: 6,
  },

  // ── Alerts ────────────────────────────────────────────────────────────────
  alertCard: {
    flexDirection: 'row', alignItems: 'flex-start',
    marginBottom: 8, padding: 12,
    borderRadius: 8, borderLeftWidth: 3,
    borderWidth: 1, borderColor: c.onSurface(0.05),
  },
  alertBody:  { flex: 1, gap: 4 },
  alertTitle: {
    fontSize: 11, fontWeight: '900', letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  alertText:  {
    color: c.onSurface(0.65),
    fontSize: 13, lineHeight: 19, fontWeight: '500',
  },

  // ── Coaching ──────────────────────────────────────────────────────────────
  coachingText: {
    color: c.onSurface(0.65),
    fontSize: 13, lineHeight: 19, fontStyle: 'italic',
  },

  // ── TIP DEL COACH (dinámico fase + rol) ──────────────────────────────────
  coachTipCard: {
    backgroundColor: 'rgba(123,118,221,0.06)',
    borderLeftWidth: 2,
    borderLeftColor: '#7B76DD',
    padding: 10,
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 4,
  },
  coachTipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  coachTipLabel: {
    color: '#7B76DD',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.5,
    flex: 1,
  },
  coachTipRotate: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(123,118,221,0.4)',
  },
  coachTipRotateIcon: {
    color: '#7B76DD',
    fontSize: 14,
    fontWeight: '900',
    lineHeight: 16,
  },
  coachTipText: {
    color: c.onSurface(0.7),
    fontSize: 12,
    lineHeight: 17,
  },
});

// ─── ItemShop ─────────────────────────────────────────────────────────────────
const DD_VERSION_SHOP = '16.8.1';
const SHOP_IMG = (id) =>
  `https://ddragon.leagueoflegends.com/cdn/${DD_VERSION_SHOP}/img/item/${id}.png`;

const SHOP_CATALOG = {
  Consumibles: [
    { id: 2003, name: 'Health Potion',         cost: 50,   desc: 'Restaura 120 de vida en 15s' },
    { id: 2031, name: 'Refillable Potion',     cost: 150,  desc: 'Cargas recargables en base' },
    { id: 2055, name: 'Control Ward',          cost: 75,   desc: 'Visión y revela trampas' },
    { id: 3340, name: 'Stealth Ward (Trinket)', cost: 0,   desc: 'Centinela gratis de visión' },
    { id: 2138, name: 'Elixir of Iron',        cost: 500,  desc: '+Vida y tenacidad temporal' },
    { id: 2139, name: 'Elixir of Sorcery',     cost: 500,  desc: '+AP y daño verdadero temporal' },
    { id: 2140, name: 'Elixir of Wrath',       cost: 500,  desc: '+AD y robo de vida temporal' },
  ],
  Componentes: [
    { id: 1038, name: 'BF Sword',             cost: 1300, desc: '+40 Daño de Ataque' },
    { id: 1058, name: 'Needlessly Large Rod',  cost: 1250, desc: '+45 Poder de Habilidad' },
    { id: 1036, name: 'Long Sword',            cost: 350,  desc: '+10 Daño de Ataque' },
    { id: 1052, name: 'Amplifying Tome',       cost: 435,  desc: '+20 Poder de Habilidad' },
    { id: 1042, name: 'Dagger',                cost: 300,  desc: '+12% Velocidad de Ataque' },
    { id: 1028, name: 'Ruby Crystal',          cost: 400,  desc: '+150 Vida Máxima' },
    { id: 1029, name: 'Cloth Armor',           cost: 300,  desc: '+15 Armadura' },
    { id: 1033, name: 'Null-Magic Mantle',     cost: 450,  desc: '+25 Resistencia Mágica' },
    { id: 3057, name: 'Sheen',                 cost: 700,  desc: '+Pasivo: Potencia de golpe' },
  ],
  Botas: [
    { id: 1001, name: 'Boots',                 cost: 300,  desc: '+25 Velocidad de Movimiento' },
    { id: 3006, name: "Berserker's Greaves",   cost: 1100, desc: '+35% Velocidad de Ataque' },
    { id: 3020, name: "Sorcerer's Shoes",      cost: 1100, desc: '+18 Penetración Mágica' },
    { id: 3047, name: 'Plated Steelcaps',      cost: 1100, desc: '+15 Armadura · -ataques básicos' },
    { id: 3111, name: "Mercury's Treads",      cost: 1100, desc: '+25 MR · +30% Tenacidad' },
    { id: 3158, name: 'Ionian Boots',          cost: 950,  desc: '+20 Haste de Habilidad' },
    { id: 3009, name: 'Boots of Swiftness',    cost: 1000, desc: '+Velocidad · -ralentizaciones' },
  ],
  Épicos: [
    { id: 3085, name: "Runaan's Hurricane",    cost: 2600, desc: '+45% AS · Multi-objetivo' },
    { id: 3046, name: 'Phantom Dancer',        cost: 2600, desc: '+45% AS +25% Crit' },
    { id: 3094, name: 'Rapid Firecannon',      cost: 2500, desc: '+30% AS +Rango' },
  ],
  Míticos: [
    { id: 6672, name: 'Kraken Slayer',         cost: 3100, desc: '+AD/AS · Daño verdadero pasivo' },
    { id: 6671, name: 'Galeforce',             cost: 3400, desc: '+AD/Crit · Dash activo' },
    { id: 6673, name: 'Immortal Shieldbow',    cost: 3400, desc: '+AD/Crit · Escudo a baja vida' },
    { id: 6692, name: 'Eclipse',               cost: 2900, desc: '+AD · Escudo y % vida' },
    { id: 6653, name: "Liandry's Anguish",     cost: 3200, desc: '+AP · Quemadura % vida' },
    { id: 6655, name: "Luden's Tempest",       cost: 3200, desc: '+90 AP · Pasivo de poke' },
  ],
  Legendarios: [
    { id: 3031, name: 'Infinity Edge',         cost: 3400, desc: '+70 AD · Daño crítico brutal' },
    { id: 3026, name: 'Guardian Angel',        cost: 2800, desc: '+40 AD · Revive en combate' },
    { id: 3157, name: "Zhonya's Hourglass",    cost: 2600, desc: '+65 AP · Estasis activo' },
    { id: 3089, name: "Rabadon's Deathcap",    cost: 3600, desc: '+120 AP · +35% AP total' },
    { id: 3036, name: "Lord Dominik's Regards", cost: 3000, desc: '+AD · Penetración de armadura' },
    { id: 3135, name: 'Void Staff',            cost: 3000, desc: '+AP · Penetración mágica' },
    { id: 3072, name: 'Bloodthirster',         cost: 3400, desc: '+80 AD · Robo de vida y escudo' },
    { id: 3075, name: 'Thornmail',             cost: 2700, desc: '+80 Armadura · Corte Herida' },
    { id: 3065, name: 'Spirit Visage',         cost: 2900, desc: '+450 HP +60 MR' },
  ],
};

// F4 — Conjunto vacío reutilizable (al elegir build de inicio no hay nada
// comprado todavía; evita recrear un Set en cada render).
const EMPTY_SET = new Set();

// F3/F4 — BuildCard: una build (núcleo + alternativas) con WR/PR. Cada ítem es
// TOCABLE para comprarlo (lo añade a la build y descuenta su coste) y un botón
// permite ELEGIR/priorizar esta build. Se reutiliza en la tienda simplificada y
// en el selector de build de inicio de partida.
function BuildCard({ build, isActive, gold, purchasedItems, onChoose, onBuyItem, theme, c, s }) {
  if (!build) return null;
  const coreCost = getBuildCoreCost(build);
  const bought = purchasedItems || EMPTY_SET;
  const renderItem = (it) => {
    const isBought   = bought.has(it.name);
    const affordable = (Number(it.cost) || 0) <= gold;
    return (
      <TouchableOpacity
        key={`${build.id}-${it.id}-${it.name}`}
        style={[
          s.buildItem,
          isBought && { borderColor: '#4CAF5088' },
          !isBought && affordable && { borderColor: theme.primary + '88' },
        ]}
        onPress={() => onBuyItem(it.name, it.cost)}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={`Comprar ${it.name} por ${it.cost} de oro`}
      >
        <Image source={{ uri: SHOP_IMG(it.id) }} style={[s.buildItemImg, isBought && { opacity: 0.45 }]} resizeMode="cover" />
        <Text style={[s.buildItemCost, { color: isBought ? '#4CAF50' : (affordable ? '#FFD700' : c.onSurface(0.4)) }]} numberOfLines={1}>
          {isBought ? '✓' : `${it.cost}g`}
        </Text>
      </TouchableOpacity>
    );
  };
  return (
    <View style={[s.buildCard, isActive && { borderColor: theme.primary, backgroundColor: theme.primary + '0E' }]}>
      <View style={s.buildCardHeader}>
        <View style={s.buildTitleWrap}>
          {isActive && <Text style={[s.buildPin, { color: theme.primary }]}>★ </Text>}
          <Text style={s.buildName} numberOfLines={1}>{build.name}</Text>
        </View>
        <View style={s.buildMetrics}>
          <View style={[s.metricBadge, { borderColor: '#4CAF5066', backgroundColor: 'rgba(76,175,80,0.10)' }]}>
            <Text style={[s.metricText, { color: '#4CAF50' }]}>{build.winrate}% WR</Text>
          </View>
          <View style={[s.metricBadge, { borderColor: theme.primary + '55', backgroundColor: theme.primary + '14' }]}>
            <Text style={[s.metricText, { color: theme.primary }]}>{build.pickrate}% PR</Text>
          </View>
        </View>
      </View>

      <Text style={s.buildSub}>NÚCLEO · {coreCost.toLocaleString('es-ES')}g</Text>
      <View style={s.buildItemsRow}>{build.core.map(renderItem)}</View>

      {/* H4 — Botas COMPLETAS de la build (mismo slot que las básicas). */}
      {build.boots && (
        <>
          <Text style={s.buildSub}>BOTAS</Text>
          <View style={s.buildItemsRow}>{renderItem(build.boots)}</View>
        </>
      )}

      {Array.isArray(build.alternatives) && build.alternatives.length > 0 && (
        <>
          <Text style={s.buildSub}>ALTERNATIVAS</Text>
          <View style={s.buildItemsRow}>{build.alternatives.map(renderItem)}</View>
        </>
      )}

      <TouchableOpacity
        style={[
          s.priorityBtn,
          isActive ? { backgroundColor: theme.primary, borderColor: theme.primary } : { borderColor: theme.primary + '88' },
        ]}
        onPress={() => onChoose(build.id)}
        activeOpacity={0.85}
      >
        <Text style={[s.priorityBtnText, { color: isActive ? c.textInverse : theme.primary }]}>
          {isActive ? '★ BUILD ELEGIDA' : 'ELEGIR ESTA BUILD'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

// F3 — TIENDA SIMPLIFICADA. Antes tenía 7 pestañas (Builds/Consumibles/.../
// Legendarios) + buscador + grid + detalle: demasiado para una partida rápida.
// Ahora muestra de un vistazo: (1) la BUILD elegida (con opción a cambiarla),
// (2) lo COMPRABLE AHORA con el oro actual (1-3 sugerencias) y (3) la build al
// completo con sus ítems tocables para comprar. Sin catálogo ni categorías.
function ItemShop({ visible, onClose, theme, purchasedItems, gold = 0, onBuy, champion, role, priorityBuildId, setPriorityBuildId }) {
  const { colors: c } = useTheme();
  const shopS = useMemo(() => makeShopS(c), [c]);
  const builds = useMemo(() => getBuildsForChampion(champion, role), [champion, role]);
  // CAMBIAR BUILD despliega las otras builds disponibles para reelegir.
  const [showAllBuilds, setShowAllBuilds] = useState(false);

  if (!visible) return null;

  const safeGold = Number.isFinite(gold) ? gold : 0;
  const activeBuild = builds.find(b => b.id === priorityBuildId) || builds[0];
  // H4 — las BOTAS COMPLETAS entran en el pool comprable (tras el núcleo).
  const pool = [
    ...(activeBuild?.core || []),
    ...(activeBuild?.boots ? [activeBuild.boots] : []),
    ...(activeBuild?.alternatives || []),
  ];
  // Comprable AHORA: ítems de la build no comprados y asequibles, en orden de
  // prioridad (núcleo antes que alternativas), máximo 3.
  const affordableNow = pool
    .filter(it => !purchasedItems.has(it.name) && (Number(it.cost) || 0) <= safeGold)
    .slice(0, 3);
  const buildComplete = pool.length > 0 && pool.every(it => purchasedItems.has(it.name));

  // Elegir/priorizar una build: tocar la activa la deselecciona (vuelve a la de
  // mayor winrate); tocar otra la fija.
  const chooseBuild = (id) => setPriorityBuildId(id === priorityBuildId ? null : id);

  return (
    <View style={shopS.overlay}>
      <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={onClose} activeOpacity={1} />
      <View style={[shopS.sheet, { borderColor: theme.primary + '66' }]}>
        {/* Header */}
        <View style={shopS.header}>
          <View style={shopS.headerLeft}>
            <Text style={[shopS.title, { color: theme.primary }]}>TIENDA</Text>
            <View style={shopS.goldPill}>
              <Text style={shopS.goldPillText}>{safeGold}g</Text>
            </View>
          </View>
          <TouchableOpacity onPress={onClose} style={shopS.closeBtn}>
            <Text style={shopS.closeX}>×</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={shopS.scroll} contentContainerStyle={shopS.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Build elegida + cambiar */}
          <View style={shopS.buildPickedRow}>
            <View style={{ flex: 1 }}>
              <Text style={shopS.sectionLabel}>BUILD ELEGIDA</Text>
              <Text style={shopS.buildPickedName} numberOfLines={1}>
                {activeBuild?.name} · {activeBuild?.winrate}% WR
              </Text>
              {!!champion && (
                <Text style={shopS.buildPickedSub} numberOfLines={1}>
                  {champion} · {String(role || '').toUpperCase() || 'FLEX'}
                </Text>
              )}
            </View>
            {builds.length > 1 && (
              <TouchableOpacity
                style={[shopS.changeBtn, { borderColor: theme.primary + '88' }]}
                onPress={() => setShowAllBuilds(v => !v)}
                activeOpacity={0.85}
              >
                <Text style={[shopS.changeBtnText, { color: theme.primary }]}>
                  {showAllBuilds ? 'CERRAR' : 'CAMBIAR BUILD'}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Comprable ahora */}
          <Text style={shopS.sectionLabel}>COMPRABLE AHORA · {safeGold}g</Text>
          {affordableNow.length > 0 ? (
            <View style={shopS.affordRow}>
              {affordableNow.map((it, i) => (
                <TouchableOpacity
                  key={`afford-${it.id}-${i}`}
                  style={[shopS.affordCard, i === 0 && { borderColor: theme.primary + '88' }]}
                  onPress={() => onBuy(it.name, it.cost)}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel={`Comprar ${it.name} por ${it.cost} de oro`}
                >
                  <Image source={{ uri: SHOP_IMG(it.id) }} style={shopS.affordImg} resizeMode="cover" />
                  <Text style={shopS.affordName} numberOfLines={1}>{it.name}</Text>
                  <Text style={[shopS.affordCost, { color: '#FFD700' }]}>{it.cost}g</Text>
                  <View style={[shopS.affordBuy, { borderColor: theme.primary + '55', backgroundColor: theme.primary + '14' }]}>
                    <Text style={[shopS.affordBuyText, { color: theme.primary }]}>+ COMPRAR</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <Text style={shopS.emptyNote}>
              {buildComplete
                ? 'Build completada. Domina el Nexo.'
                : 'Sigue farmando: aún no llegas al siguiente objeto de la build.'}
            </Text>
          )}

          {/* Build al completo (tocar un ítem = comprarlo) */}
          <Text style={shopS.sectionLabel}>TU BUILD · toca un objeto para comprarlo</Text>
          <BuildCard
            build={activeBuild}
            isActive
            gold={safeGold}
            purchasedItems={purchasedItems}
            onChoose={chooseBuild}
            onBuyItem={onBuy}
            theme={theme}
            c={c}
            s={shopS}
          />

          {/* Otras builds (al pulsar CAMBIAR BUILD) */}
          {showAllBuilds && builds.filter(b => b.id !== activeBuild?.id).map(b => (
            <BuildCard
              key={b.id}
              build={b}
              isActive={false}
              gold={safeGold}
              purchasedItems={purchasedItems}
              onChoose={(id) => { setPriorityBuildId(id); setShowAllBuilds(false); }}
              onBuyItem={onBuy}
              theme={theme}
              c={c}
              s={shopS}
            />
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

// F4 — Selector de build AL INICIO de la partida. Ofrece las builds completas
// del campeón/rol y el jugador ELIGE UNA (fija priorityBuildId). Puede decidir
// luego (se usa la de mayor winrate por defecto). Reutiliza BuildCard.
function BuildChooserModal({ visible, onClose, onChoose, champion, role, theme, priorityBuildId }) {
  const { colors: c } = useTheme();
  const shopS = useMemo(() => makeShopS(c), [c]);
  const builds = useMemo(() => getBuildsForChampion(champion, role), [champion, role]);
  if (!visible) return null;
  const activeId = priorityBuildId || builds[0]?.id;
  return (
    <View style={shopS.overlay}>
      <View style={[shopS.sheet, { borderColor: theme.primary + '66' }]}>
        <View style={shopS.header}>
          <View style={shopS.headerLeft}>
            <Text style={[shopS.title, { color: theme.primary }]}>ELIGE TU BUILD</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={shopS.closeBtn}>
            <Text style={shopS.closeX}>×</Text>
          </TouchableOpacity>
        </View>
        <Text style={shopS.chooserHint}>
          {champion ? `${champion} · ${String(role || '').toUpperCase() || 'FLEX'}` : 'BUILDS'} · elige el plan que vas a seguir
        </Text>
        <ScrollView style={shopS.scroll} contentContainerStyle={shopS.scrollContent} showsVerticalScrollIndicator={false}>
          {builds.map(b => (
            <BuildCard
              key={b.id}
              build={b}
              isActive={b.id === activeId}
              gold={0}
              purchasedItems={EMPTY_SET}
              onChoose={(id) => onChoose(id)}
              onBuyItem={() => {}}
              theme={theme}
              c={c}
              s={shopS}
            />
          ))}
        </ScrollView>
        {/* H3 — "DECIDIR LUEGO" igualmente FIJA la primera build (mayor winrate)
            como activa, para que la guía (siguiente ítem / qué comprar) no quede
            vacía y siga un núcleo concreto desde el primer segundo. */}
        <TouchableOpacity style={[shopS.laterBtn, { borderColor: c.onSurface(0.18) }]} onPress={() => onChoose(activeId)} activeOpacity={0.85}>
          <Text style={[shopS.laterBtnText, { color: c.onSurface(0.6) }]}>DECIDIR LUEGO</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const makeShopS = (c) => StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
    zIndex: 200,
  },
  sheet: {
    backgroundColor: c.bg2,
    borderTopLeftRadius: 18, borderTopRightRadius: 18,
    borderWidth: 1.5, maxHeight: '82%',
    ...(Platform.OS === 'web' ? { backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' } : {}),
  },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 18, paddingTop: 18, paddingBottom: 10,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  goldPill: {
    paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10,
    borderWidth: 1, borderColor: 'rgba(255,215,0,0.45)',
    backgroundColor: 'rgba(255,215,0,0.10)',
  },
  goldPillText: { color: '#FFD700', fontSize: 12, fontWeight: '900', letterSpacing: 0.5 },
  title: { fontSize: 16, fontWeight: '900', letterSpacing: 3 },
  closeBtn: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: c.onSurface(0.06),
    alignItems: 'center', justifyContent: 'center',
  },
  closeX: { color: c.onSurface(0.70), fontSize: 22, lineHeight: 24, fontWeight: '300' },
  search: {
    marginHorizontal: 16, marginBottom: 10,
    backgroundColor: c.onSurface(0.05),
    borderWidth: 1, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 8, fontSize: 13,
  },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1, borderBottomColor: c.onSurface(0.08),
    marginHorizontal: 16,
  },
  tab: {
    flex: 1, paddingVertical: 8, alignItems: 'center',
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabText: { fontSize: 9, fontWeight: '900', letterSpacing: 1.5 },
  // B3 — Tira de recomendación según el oro actual.
  recoStrip: {
    marginHorizontal: 16, marginTop: 10,
    paddingTop: 8, paddingBottom: 4,
  },
  recoLabel: { fontSize: 9, fontWeight: '900', letterSpacing: 2, marginBottom: 6 },
  recoRow: { gap: 8, paddingRight: 8 },
  recoChip: {
    alignItems: 'center', borderWidth: 1, borderRadius: 8,
    backgroundColor: c.onSurface(0.04), padding: 4,
  },
  recoImg: { width: 36, height: 36, borderRadius: 4 },
  recoCost: { color: '#FFD700', fontSize: 9, fontWeight: '900', marginTop: 2 },

  // ── P2-2 — Pestaña BUILDS (estilo op.gg) ───────────────────────────────────
  buildsScroll: { flex: 1, marginTop: 8 },
  buildsContent: { paddingHorizontal: 16, paddingBottom: 24 },
  buildsHint: { fontSize: 9, fontWeight: '800', letterSpacing: 1, marginBottom: 10, textAlign: 'center' },
  buildCard: {
    borderWidth: 1, borderColor: c.onSurface(0.10), borderRadius: 12,
    backgroundColor: c.onSurface(0.03), padding: 12, marginBottom: 10,
  },
  buildCardHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 8, gap: 8,
  },
  buildTitleWrap: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  buildPin: { fontSize: 13, fontWeight: '900' },
  buildName: { color: c.textPrimary, fontSize: 14, fontWeight: '900', letterSpacing: 0.3, flexShrink: 1 },
  buildMetrics: { flexDirection: 'row', gap: 6 },
  metricBadge: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  metricText: { fontSize: 10, fontWeight: '900', letterSpacing: 0.3 },
  buildSub: {
    color: c.onSurface(0.45), fontSize: 9, fontWeight: '900', letterSpacing: 1.5,
    marginTop: 8, marginBottom: 6,
  },
  buildItemsRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  buildItem: {
    alignItems: 'center', borderWidth: 1, borderColor: c.onSurface(0.10),
    borderRadius: 8, backgroundColor: c.onSurface(0.04), padding: 4, width: 50,
  },
  buildItemImg: { width: 40, height: 40, borderRadius: 5 },
  buildItemCost: { fontSize: 9, fontWeight: '900', marginTop: 2 },
  priorityBtn: {
    marginTop: 12, borderWidth: 1.5, borderRadius: 9, paddingVertical: 10,
    alignItems: 'center',
  },
  priorityBtnText: { fontSize: 11, fontWeight: '900', letterSpacing: 1.5 },

  // ── F3/F4 — Tienda simplificada + selector de build ───────────────────────
  // flexGrow:0 + flexShrink:1 (NO flex:1): el sheet padre solo tiene maxHeight,
  // así que su altura la dictan los hijos; con flex:1 el ScrollView pedía base 0
  // y en ANDROID se quedaba con altura 0 → "ELIGE TU BUILD" y la TIENDA salían
  // sin tarjetas (en web el layout CSS lo disimulaba). Con grow:0/shrink:1 mide
  // su contenido y solo encoge cuando el sheet toca el tope del 82%.
  scroll: { flexGrow: 0, flexShrink: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 28 },
  sectionLabel: {
    color: c.onSurface(0.45), fontSize: 9, fontWeight: '900', letterSpacing: 1.5,
    marginTop: 14, marginBottom: 8,
  },
  buildPickedRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1, borderColor: c.onSurface(0.10), borderRadius: 12,
    backgroundColor: c.onSurface(0.03), padding: 12, marginTop: 6,
  },
  buildPickedName: { color: c.textPrimary, fontSize: 15, fontWeight: '900', letterSpacing: 0.3 },
  buildPickedSub: { color: c.onSurface(0.45), fontSize: 10, fontWeight: '700', marginTop: 2 },
  changeBtn: { borderWidth: 1.5, borderRadius: 9, paddingHorizontal: 12, paddingVertical: 9 },
  changeBtnText: { fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  affordRow: { flexDirection: 'row', gap: 8 },
  affordCard: {
    flex: 1, borderWidth: 1, borderColor: c.onSurface(0.10), borderRadius: 10,
    backgroundColor: c.onSurface(0.03), padding: 8, alignItems: 'center',
  },
  affordImg: { width: 44, height: 44, borderRadius: 6, marginBottom: 6 },
  affordName: { color: c.textPrimary, fontSize: 11, fontWeight: '800', textAlign: 'center' },
  affordCost: { fontSize: 12, fontWeight: '900', marginTop: 2 },
  affordBuy: {
    marginTop: 7, borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3,
    alignSelf: 'stretch', alignItems: 'center',
  },
  affordBuyText: { fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  emptyNote: {
    color: c.onSurface(0.45), fontSize: 12, lineHeight: 17, fontStyle: 'italic',
    paddingVertical: 6,
  },
  chooserHint: {
    color: c.onSurface(0.45), fontSize: 11, fontWeight: '700', textAlign: 'center',
    paddingHorizontal: 16, marginTop: 2, marginBottom: 8,
  },
  laterBtn: {
    margin: 16, marginTop: 6, borderWidth: 1.5, borderRadius: 10, paddingVertical: 12,
    alignItems: 'center',
  },
  laterBtnText: { fontSize: 11, fontWeight: '900', letterSpacing: 1.5 },

  body: { flexDirection: 'row', flex: 1, marginTop: 12 },
  grid: { flex: 1 },
  gridContent: { paddingHorizontal: 12, paddingBottom: 20 },
  gridRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cell: {
    width: 62, alignItems: 'center',
    backgroundColor: c.onSurface(0.04),
    borderWidth: 1, borderColor: c.onSurface(0.10),
    borderRadius: 8, padding: 4, position: 'relative',
  },
  cellLocked: { borderColor: c.onSurface(0.05), backgroundColor: c.onSurface(0.015) },
  cellImg: { width: 48, height: 48, borderRadius: 4 },
  boughtBadge: {
    ...StyleSheet.absoluteFillObject, borderRadius: 8,
    backgroundColor: 'rgba(76,175,80,0.25)',
    alignItems: 'center', justifyContent: 'center',
  },
  boughtCheck: { color: '#4CAF50', fontSize: 20, fontWeight: '900' },
  cellCost: { fontSize: 9, fontWeight: '900', marginTop: 3 },
  detail: {
    width: 128, paddingHorizontal: 10, paddingVertical: 10,
    borderLeftWidth: 1, alignItems: 'center',
  },
  detailImg: { width: 56, height: 56, borderRadius: 8, marginBottom: 8 },
  detailName: { fontSize: 11, fontWeight: '900', textAlign: 'center', letterSpacing: 0.5 },
  detailDesc: {
    color: c.onSurface(0.50), fontSize: 9,
    textAlign: 'center', marginTop: 4, lineHeight: 13,
  },
  detailCost: { fontSize: 13, fontWeight: '900', marginTop: 6, marginBottom: 10 },
  buyBtn: {
    width: '100%', paddingVertical: 8,
    borderRadius: 8, borderWidth: 1, alignItems: 'center',
  },
  buyBtnText: { fontSize: 10, fontWeight: '900', letterSpacing: 1 },
});

// ─── spellStyles (tracker de hechizos de invocador) ──────────────────────────
// Diseño pro-esports: card por enemigo, ícono círculo, timer rojo grande,
// badge FLASH DOWN en rojo neón.
const makeSpellStyles = (c) => StyleSheet.create({

  enemyCard: {
    backgroundColor: c.onSurface(0.03),
    borderWidth: 1, borderColor: c.onSurface(0.08),
    borderRadius: 10, padding: 10, marginBottom: 8,
  },
  enemyCardHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10,
  },
  portraitCircleWrap: {
    width: 36, height: 36, borderRadius: 18, overflow: 'hidden',
    borderWidth: 1.5, borderColor: c.onSurface(0.20),
  },
  portrait: { width: 36, height: 36 },
  enemyName: {
    color: c.textPrimary, fontSize: 12, fontWeight: '900', flex: 1,
  },

  // Badge FLASH DOWN — rojo neón con glow
  flashDownBadge: {
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
    backgroundColor: 'rgba(255,68,68,0.9)',
    shadowColor: '#ff4444', shadowOpacity: 0.55,
    shadowRadius: 8, shadowOffset: { width: 0, height: 0 },
  },
  flashDownText: {
    color: '#ffffff', fontSize: 9, fontWeight: '900', letterSpacing: 0.5,
  },

  // Grid de spells
  spellsGrid: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  spellItem:  {
    width: 56,
    alignItems: 'center', justifyContent: 'center', gap: 3,
  },
  spellBtn: {
    width: 56, height: 44,
    paddingHorizontal: 4, paddingVertical: 6,
    borderRadius: 7, borderWidth: 1,
    borderColor: c.onSurface(0.14),
    backgroundColor: c.onSurface(0.04),
    alignItems: 'center', justifyContent: 'center', gap: 2,
  },
  spellBtnActive: {
    borderColor: 'rgba(123,118,221,0.60)',
    backgroundColor: 'rgba(123,118,221,0.10)',
  },
  spellBtnReady: {
    borderColor: 'rgba(76,175,80,0.55)',
    backgroundColor: 'rgba(76,175,80,0.08)',
  },
  spellAbbr: {
    color: c.onSurface(0.85), fontSize: 14, fontWeight: '900', letterSpacing: 0.5,
  },
  spellIcon: {
    width: 36, height: 36, borderRadius: 5,
  },
  // Cooldown debajo del nombre — color y tipografía según spec
  spellTimer: {
    color: '#7B76DD', fontSize: 12, fontWeight: '700', textAlign: 'center',
  },
  spellFullName: {
    color: c.onSurface(0.55), fontSize: 10, fontWeight: '600',
    textAlign: 'center',
  },
  cdTrack: {
    width: '100%', height: 3, borderRadius: 2,
    backgroundColor: c.onSurface(0.10), overflow: 'hidden',
  },
  cdFill: {
    height: 3, borderRadius: 2,
    backgroundColor: '#7B76DD',
  },

  adjustRow: { flexDirection: 'row', gap: 3, marginTop: 1 },
  adjustBtn: {
    paddingHorizontal: 4, paddingVertical: 2, borderRadius: 3,
    backgroundColor: c.onSurface(0.06),
  },
  // B2 — contraste AA: 0.40 quedaba <4.5:1 sobre bg0 en un control interactivo.
  adjustText: {
    color: c.textSecondary, fontSize: 8, fontWeight: '700',
  },
  // B2 — contraste AA: 0.22 era ilegible (≈1.8:1); textSecondary da ~7:1.
  hint: {
    color: c.textSecondary, fontSize: 9, fontStyle: 'italic',
    textAlign: 'center', marginTop: 6,
  },
});

// ─── ultiStyles (tracker de ultis enemigas) ──────────────────────────────────
const makeUltiStyles = (c) => StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 9, gap: 10,
    borderBottomWidth: 1, borderBottomColor: c.onSurface(0.05),
  },
  portraitCircleWrap: {
    width: 38, height: 38, borderRadius: 19, overflow: 'hidden',
    borderWidth: 1.5, borderColor: c.onSurface(0.18),
  },
  portrait: { width: 38, height: 38 },
  info: { flex: 1 },
  champName: { color: c.textPrimary, fontSize: 12, fontWeight: '800' },
  ultiName:  { color: c.onSurface(0.45), fontSize: 9, fontWeight: '600', marginTop: 1 },
  cdTrack: {
    width: '100%', height: 3, borderRadius: 2,
    backgroundColor: c.onSurface(0.10),
    marginTop: 4, overflow: 'hidden',
  },
  cdFill: { height: 3, borderRadius: 2, backgroundColor: '#7B76DD' },

  actions: { alignItems: 'flex-end', gap: 4 },
  cdBtn: {
    minWidth: 60, paddingHorizontal: 8, paddingVertical: 6,
    borderRadius: 6, borderWidth: 1,
    borderColor: c.onSurface(0.14),
    backgroundColor: c.onSurface(0.04),
    alignItems: 'center',
  },
  cdBtnActive: {
    borderColor: 'rgba(255,68,68,0.55)',
    backgroundColor: 'rgba(255,68,68,0.10)',
  },
  cdBtnReady: {
    borderColor: 'rgba(76,175,80,0.55)',
    backgroundColor: 'rgba(76,175,80,0.08)',
  },
  cdBtnText: { color: c.onSurface(0.65), fontSize: 12, fontWeight: '900', letterSpacing: 0.5 },

  adjustRow: { flexDirection: 'row', gap: 3 },
  adjustBtn: {
    paddingHorizontal: 5, paddingVertical: 2, borderRadius: 3,
    backgroundColor: c.onSurface(0.06),
  },
  // B2 — contraste AA (ver spellStyles): labels grises subidos a textSecondary.
  adjustText: { color: c.textSecondary, fontSize: 8, fontWeight: '700' },

  hint: {
    color: c.textSecondary, fontSize: 9, fontStyle: 'italic',
    textAlign: 'center', marginTop: 8,
  },
});
