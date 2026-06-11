// ============================================================================
// FloatingRadarWidget — widget flotante
// ----------------------------------------------------------------------------
// Reemplaza al ScanModal anterior. Vive a nivel global (envuelto por RadarContext
// en App.js) para que persista al navegar entre tabs. Estados:
//
// HIDDEN → no se renderiza (visible=false)
// EXPANDED → 340×480px en bottom-right con contenido del radar
// MINIMIZED → FAB circular 60×60px con imagen del campeón activo
//
// Sub-estados de scan (sustituye al placeholder antiguo):
// idle → input Riot ID + botón ACTIVAR
// scanning → "Escaneando GameName#TAG…" 1.8s mock
// active → SESIÓN ACTIVA con Riot ID + zona donde montará el HUD real
//
// Cuando hay partida activa (inGame=true) el FAB minimizado:
// Muestra la cara del campeón activo
// Borde en theme.primary
// Al tapearlo navega al tab "Live"
//
// Sin partida activa:
// FAB con imagen del campeón seleccionado (o fallback)
// Borde gris
// Al tapearlo expande el widget completo
//
// Spring animations: height + width + borderRadius + bottom. El usuario alterna
// entre EXPANDED y MINIMIZED desde los botones del header. Cerrar desmonta
// el widget reseteando el RadarContext (visible=false, minimized=false).
// ============================================================================

/**
 * @module FloatingRadarWidget
 *
 * Widget flotante global del radar en vivo. Vive a nivel de App (envuelto por
 * `RadarContext`) para persistir al navegar entre tabs. Alterna entre dos
 * formas visuales animadas por spring (tamaño + forma + posición):
 *
 * **MINIMIZED** → FAB circular 60×60 con la cara del campeón activo.
 * **EXPANDED** → panel 340×480 anclado abajo-derecha con el contenido del
 * radar.
 * **HIDDEN** → no se renderiza (`visible === false`).
 *
 * Sub-estados internos del scan (estado `scanState`):
 * `idle` → formulario con input de Riot ID y botón ACTIVAR.
 * `scanning` → "Escaneando GameName#TAG…" (mock de 1.8 s).
 * `active` → sesión activa; muestra métricas en vivo si hay partida
 * (`gameSession.active`) o un resumen mock + consejo por facción si no.
 *
 * No recibe props: lee todo su estado de `RadarContext` (visibilidad/sesión),
 * `RiotContext` (tema) y `UserContext` (Riot ID y facción del usuario). Cuando
 * hay partida en vivo, el FAB navega al tab "Live"; si no, expande el widget.
 *
 * @example
 * // Montado una sola vez, a nivel global:
 * <RadarProvider>
 * <AppNavigator />
 * <FloatingRadarWidget />
 * </RadarProvider>
 */

/**
 * @typedef {Object} FloatingRadarWidgetProps
 * @description El componente no recibe props; toda su entrada proviene de los
 * contextos `RadarContext`, `RiotContext` y `UserContext`.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Animated, StyleSheet, Platform,
  ScrollView, Image,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useRadar } from '../context/RadarContext';
import { RiotContext } from '../context/RiotContext';
import { useUser } from '../context/UserContext';
import { useTheme } from '../context/ThemeContext';
import { getDailyTip } from '../utils/coaching';
import { formatGameTime } from '../mocks/mockGameSession';
import { getChampionImageUrl } from '../utils/dataDragon';

const EXPANDED_W = 340;
const EXPANDED_H = 480;
const PILL_H     = 48;   // altura del header en modo expandido
const FAB_SIZE   = 60;   // diámetro del FAB minimizado

// El FAB minimizado debe sentarse SOBRE la bottom tab bar (72px alto) y NO
// taparla — antes vivía a `bottom: 20` y solapaba la pestaña Identity, lo
// que además impedía el tap en el propio FAB porque competía por el toque.
const FAB_BOTTOM = Platform.OS === 'ios' ? 95 : 80;

/**
 * Widget flotante global del radar en vivo (FAB ↔ panel expandido).
 *
 * @param {FloatingRadarWidgetProps} [props] Sin props — lee de los contextos.
 * @returns {React.ReactElement|null} El widget animado, o `null` si está oculto.
 */
function FloatingRadarWidget() {
  const { visible, minimized, gameSession, selectedChampion, close, minimize, expand } = useRadar();
  const { theme } = React.useContext(RiotContext);
  const { user }  = useUser();
  const { colors: c, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const navigation = useNavigation();

  // facción para el consejo del día (fallback DEMACIA si no hay user)
  const userFaction = String(user?.faction || 'DEMACIA').toUpperCase();
  // flag derivado: hay partida en vivo activa.
  const inGame = !!gameSession?.active;

  // Imagen del campeón activo: prioriza selectedChampion, luego gameSession, fallback Jinx.
  // El FAB es un círculo 60×60 → el square icon (que ya es la cara) encaja perfecto.
  // Usamos getChampionImageUrl (patch 16.8.1) en vez de hardcodear 14.10.1, que estaba
  // obsoleto y podía dar 404 en campeones añadidos tras ese parche.
  const champName   = selectedChampion?.name || gameSession?.champion?.name || gameSession?.player?.champion || 'Jinx';
  const champImgUrl = getChampionImageUrl(champName);

  // Sub-estado del scan dentro del widget expandido.
  /** @type {'idle'|'scanning'|'active'} fase del flujo de activación del radar */
  const [scanState,   setScanState]   = useState('idle');
  /** @type {string} Riot ID tecleado en el formulario (GameName#TAG) */
  const [riotIdInput, setRiotIdInput] = useState('');

  // cuando arranca una gameSession, salta directamente a 'active' y
  // pre-rellena el input con el Riot ID del usuario para coherencia visual.
  useEffect(() => {
    if (gameSession?.active) {
      setScanState('active');
      if (!riotIdInput && user?.riotId) setRiotIdInput(user.riotId);
    }
  }, [gameSession?.active]);

  // Animaciones — height/width/borderRadius/bottom interpolados por estado
  /** @type {React.MutableRefObject<Animated.Value>} ancho animado FAB↔expandido */
  const widthAnim        = useRef(new Animated.Value(minimized ? FAB_SIZE   : EXPANDED_W)).current;
  /** @type {React.MutableRefObject<Animated.Value>} alto animado FAB↔expandido */
  const heightAnim       = useRef(new Animated.Value(minimized ? FAB_SIZE   : EXPANDED_H)).current;
  /** @type {React.MutableRefObject<Animated.Value>} radio de borde (círculo↔panel) */
  const borderRadiusAnim = useRef(new Animated.Value(minimized ? FAB_SIZE/2 : 14)).current;
  /** @type {React.MutableRefObject<Animated.Value>} offset inferior animado */
  const bottomAnim       = useRef(new Animated.Value(minimized ? FAB_BOTTOM : 88)).current;
  /** @type {React.MutableRefObject<Animated.Value>} opacidad de aparición/ocultado */
  const opacityAnim      = useRef(new Animated.Value(0)).current;
  /** @type {React.MutableRefObject<Animated.Value>} opacidad pulsante del dot de sesión activa */
  const pulseAnim        = useRef(new Animated.Value(1)).current;

  // Animación al cambiar visible
  useEffect(() => {
    Animated.timing(opacityAnim, {
      toValue:  visible ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [visible]);

  // Animación al cambiar minimized — anima tamaño, forma y posición
  useEffect(() => {
    Animated.parallel([
      Animated.spring(widthAnim,        { toValue: minimized ? FAB_SIZE   : EXPANDED_W,  useNativeDriver: false, friction: 9, tension: 70 }),
      Animated.spring(heightAnim,       { toValue: minimized ? FAB_SIZE   : EXPANDED_H,  useNativeDriver: false, friction: 9, tension: 70 }),
      Animated.spring(borderRadiusAnim, { toValue: minimized ? FAB_SIZE/2 : 14,          useNativeDriver: false, friction: 9, tension: 70 }),
      Animated.spring(bottomAnim,       { toValue: minimized ? FAB_BOTTOM : 88,          useNativeDriver: false, friction: 9, tension: 70 }),
    ]).start();
  }, [minimized]);

  // Pulso del dot verde mientras scanState==='active'
  useEffect(() => {
    if (scanState !== 'active') return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.35, duration: 700, useNativeDriver: false }),
        Animated.timing(pulseAnim, { toValue: 1,    duration: 700, useNativeDriver: false }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [scanState]);

  // Handler de activación (mock — conectará al backend real)
  const handleActivate = () => {
    if (!riotIdInput) return;
    setScanState('scanning');
    setTimeout(() => setScanState('active'), 1800);
  };

  // Reset al cerrar el widget — la próxima apertura empieza en idle limpio.
  const handleClose = () => {
    setScanState('idle');
    setRiotIdInput('');
    close();
  };

  if (!visible) return null;

  const dotColor    = '#7B76DD';
  const accentColor = theme?.primary || '#7B76DD';

  // Texto del header (solo visible en modo expandido). Prioridad:
  // 1. partida en curso → "◉ {champion} · {role}"
  // 2. scan activo → "◉ {riotId}"
  // 3. idle/scanning → "◉ NOVA RADAR"
  const headerLabel = (() => {
    if (inGame) return `◉ ${gameSession.player.champion} · ${gameSession.player.role}`;
    if (scanState === 'active' && riotIdInput) return `◉ ${riotIdInput}`;
    return '◉ NOVA RADAR';
  })();

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.container,
        {
          width:           widthAnim,
          height:          heightAnim,
          opacity:         opacityAnim,
          bottom:          bottomAnim,
          borderRadius:    borderRadiusAnim,
          // En FAB el fondo y borde los maneja el propio TouchableOpacity
          backgroundColor: minimized ? 'transparent' : c.bg1,
          borderWidth:     minimized ? 0 : 1,
        },
      ]}
    >
      {minimized ? (
        /* ── Estado MINIMIZADO: FAB circular con cara del campeón ─────────── */
        <TouchableOpacity
          onPress={() => { inGame ? navigation.navigate('Live') : expand(); }}
          activeOpacity={0.85}
          style={[
            styles.fab,
            { borderColor: inGame ? accentColor : c.onSurface(0.2) },
          ]}
        >
          <Image
            source={{ uri: champImgUrl }}
            style={styles.fabImg}
          />
          {inGame && (
            <View style={[styles.fabDot, { backgroundColor: accentColor }]} />
          )}
        </TouchableOpacity>
      ) : (
        /* ── Estado EXPANDIDO: widget completo 340×480 ─────────────────────── */
        <View style={styles.inner}>
          {/* Header siempre visible cuando expandido */}
          <View style={[styles.header, styles.headerExpanded]}>
            <View style={styles.headerLeft}>
              <View style={[styles.radarDot, { backgroundColor: dotColor, shadowColor: dotColor }]} />
              <Text style={styles.headerTitle} numberOfLines={1}>
                {headerLabel}
              </Text>
              {scanState === 'active' && (
                <Animated.View style={[styles.activeDot, { opacity: pulseAnim }]} />
              )}
              {scanState !== 'active' && user?.riotId && (
                <Text style={styles.headerSub} numberOfLines={1}>· {user.riotId}</Text>
              )}
            </View>
            <View style={styles.headerActions}>
              <TouchableOpacity onPress={minimize} style={styles.actionBtn} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                <Text style={styles.actionIcon}>–</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleClose} style={styles.actionBtn} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                <Text style={styles.actionIcon}>×</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Contenido */}
          <View style={styles.content}>
            {scanState === 'idle' && (
              <View style={styles.scanForm}>
                <Text style={styles.scanLabel}>RIOT ID</Text>
                <TextInput
                  style={styles.scanInput}
                  placeholder="GameName#TAG"
                  placeholderTextColor={c.onSurface(0.25)}
                  value={riotIdInput}
                  onChangeText={setRiotIdInput}
                  autoCapitalize="none"
                  autoCorrect={false}
                  onSubmitEditing={handleActivate}
                />
                <TouchableOpacity
                  style={[
                    styles.scanBtn,
                    { backgroundColor: accentColor },
                    !riotIdInput && styles.scanBtnDisabled,
                  ]}
                  onPress={handleActivate}
                  disabled={!riotIdInput}
                  activeOpacity={0.85}
                >
                  <Text style={styles.scanBtnText}>ACTIVAR RADAR</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setRiotIdInput('NovaRift#EUW')}>
                  <Text style={styles.demoHint}>Probar con NovaRift#EUW</Text>
                </TouchableOpacity>

                <Text style={styles.scanFooterHint}>
                  Cuando entres en una partida real (Riot Live Client) el radar se llenará automáticamente con composición, builds y consejos en tiempo real.
                </Text>
              </View>
            )}

            {scanState === 'scanning' && (
              <View style={styles.scanningRow}>
                <View style={[styles.scanningDot, { backgroundColor: accentColor, shadowColor: accentColor }]} />
                <Text style={styles.scanningText}>Escaneando {riotIdInput}…</Text>
                <Text style={styles.scanningHint}>
                  Comprobando partida en curso vía Riot Live Client
                </Text>
              </View>
            )}

            {scanState === 'active' && (
              <ScrollView
                style={styles.activeScroll}
                contentContainerStyle={styles.activeScrollContent}
                showsVerticalScrollIndicator={false}
              >
                {inGame ? (
                  // ─── modo partida en vivo (datos reales de gameSession) ──
                  <>
                    {/* Identidad — campeón + rol + reloj */}
                    <View style={styles.activeHeaderRow}>
                      <Animated.View style={[styles.activeDotLg, { opacity: pulseAnim }]} />
                      <Text style={styles.activeRiotId} numberOfLines={1}>
                        {gameSession.player.champion} · {gameSession.player.role}
                      </Text>
                      <Text style={styles.activeStatusInline}>
                        {formatGameTime(gameSession.gameTime)}
                      </Text>
                    </View>

                    {/* Alerta más prioritaria */}
                    {gameSession.alerts?.[0] && (
                      <View
                        style={[
                          styles.activeTipCard,
                          { borderColor: gameSession.alerts[0].color + '55' },
                        ]}
                      >
                        <Text
                          style={[
                            styles.activeTipLabel,
                            { color: gameSession.alerts[0].color + 'CC' },
                          ]}
                        >
                          {String(gameSession.alerts[0].type || '').replace(/_/g, ' ')}
                        </Text>
                        <Text style={styles.activeTipText}>
                          {gameSession.alerts[0].text}
                        </Text>
                      </View>
                    )}

                    {/* Métricas reales */}
                    <View style={styles.activeMetrics}>
                      <Text style={styles.activeMetricsLabel}>EN VIVO</Text>
                      <View style={styles.metricsRow}>
                        <View style={styles.metricPill}>
                          <Text style={styles.metricVal}>
                            {gameSession.player.csPerMin.toFixed(1)}
                          </Text>
                          <Text style={styles.metricKey}>CS/min</Text>
                        </View>
                        <View style={styles.metricPill}>
                          <Text style={styles.metricVal}>
                            {gameSession.player.kda.kills}/
                            {gameSession.player.kda.deaths}/
                            {gameSession.player.kda.assists}
                          </Text>
                          <Text style={styles.metricKey}>KDA</Text>
                        </View>
                        <View style={styles.metricPill}>
                          <Text style={styles.metricVal}>
                            {gameSession.player.gold.toLocaleString()}
                          </Text>
                          <Text style={styles.metricKey}>Oro</Text>
                        </View>
                      </View>
                    </View>

                    {/* Siguiente ítem */}
                    {gameSession.player.nextItem && (
                      <View style={[styles.activeTipCard, { borderColor: accentColor + '33' }]}>
                        <Text style={[styles.activeTipLabel, { color: accentColor + 'AA' }]}>
                          SIGUIENTE ÍTEM
                        </Text>
                        <Text style={[styles.activeRiotId, { fontSize: 14, marginVertical: 2 }]}>
                          {gameSession.player.nextItem.name}
                        </Text>
                        {!!gameSession.player.nextItem.reason && (
                          <Text style={styles.activeTipText}>
                            {gameSession.player.nextItem.reason}
                          </Text>
                        )}
                      </View>
                    )}
                  </>
                ) : (
                  // ─── modo "sesión activa" sin partida (consejo + mock) ──
                  <>
                    <View style={styles.activeHeaderRow}>
                      <Animated.View style={[styles.activeDotLg, { opacity: pulseAnim }]} />
                      <Text style={styles.activeRiotId} numberOfLines={1}>
                        {riotIdInput}
                      </Text>
                      <Text style={styles.activeStatusInline}>Radar activo</Text>
                    </View>

                    <View style={[styles.activeTipCard, { borderColor: accentColor + '33' }]}>
                      {/* sin nombre de facción — el tip sigue variando
                          por el estilo elegido, pero la etiqueta es neutra. */}
                      <Text style={[styles.activeTipLabel, { color: accentColor + 'AA' }]}>
                        CONSEJO DEL DÍA
                      </Text>
                      <Text style={styles.activeTipText}>{getDailyTip(userFaction)}</Text>
                    </View>

                    <View style={styles.activeMetrics}>
                      <Text style={styles.activeMetricsLabel}>ÚLTIMA PARTIDA</Text>
                      <View style={styles.metricsRow}>
                        <View style={styles.metricPill}>
                          <Text style={styles.metricVal}>7.2</Text>
                          <Text style={styles.metricKey}>CS/min</Text>
                        </View>
                        <View style={styles.metricPill}>
                          <Text style={styles.metricVal}>3/1/7</Text>
                          <Text style={styles.metricKey}>KDA</Text>
                        </View>
                        <View style={styles.metricPill}>
                          <Text style={styles.metricVal}>62%</Text>
                          <Text style={styles.metricKey}>KP</Text>
                        </View>
                      </View>
                    </View>

                    <View style={styles.buildSection}>
                      <Text style={styles.buildLabel}>BUILD RECOMENDADA</Text>
                      <View style={styles.buildSlots}>
                        {[0, 1, 2, 3, 4, 5].map(i => (
                          <View key={i} style={styles.buildSlot}>
                            <Text style={styles.buildSlotIcon}>?</Text>
                          </View>
                        ))}
                      </View>
                      <Text style={styles.buildHint}>
                        Disponible cuando conectes en partida.
                      </Text>
                    </View>
                  </>
                )}
              </ScrollView>
            )}
          </View>
        </View>
      )}
    </Animated.View>
  );
}

const makeStyles = (c) => StyleSheet.create({
  container: {
    position: 'absolute',
    right: 20,
    // bottom es animado — valor inicial en código (88 expandido / 20 FAB)
    backgroundColor: c.bg1,
    borderWidth: 1,
    borderColor: c.onSurface(0.12),
    borderRadius: 14,
    overflow: 'hidden',
    zIndex: 9999,
    elevation: 24,
    shadowColor: '#000',
    shadowOpacity: 0.55,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    ...(Platform.OS === 'web'
      ? {
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
        }
      : {}),
  },
  inner: { flex: 1 },

  // ─── FAB circular (estado minimizado) ─────────────────────────────────────
  fab: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    borderWidth: 2,
    overflow: 'hidden',
    backgroundColor: c.bg1,
  },
  fabImg: {
    width: '100%',
    height: '100%',
  },
  fabDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#000',
  },

  // ─── Header (solo visible en modo expandido) ───────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    height: PILL_H,
  },
  headerExpanded: {
    borderBottomWidth: 1,
    borderBottomColor: c.onSurface(0.06),
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  radarDot: {
    width: 8, height: 8, borderRadius: 4,
    shadowOpacity: 0.7, shadowRadius: 4, shadowOffset: { width: 0, height: 0 },
  },
  // Punto verde pulsante en el header expandido cuando hay sesión activa.
  activeDot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: '#7B76DD',
    marginLeft: 6,
    shadowColor: '#7B76DD',
    shadowOpacity: 0.9, shadowRadius: 6, shadowOffset: { width: 0, height: 0 },
  },
  headerTitle: {
    color: c.textPrimary,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 2,
    flexShrink: 1,
  },
  headerSub: {
    color: c.onSurface(0.45),
    fontSize: 11,
    flexShrink: 1,
  },
  headerActions: { flexDirection: 'row', gap: 4 },
  actionBtn: {
    width: 26, height: 26, borderRadius: 6,
    backgroundColor: c.onSurface(0.06),
    borderWidth: 1, borderColor: c.onSurface(0.08),
    alignItems: 'center', justifyContent: 'center',
  },
  actionIcon: {
    color: c.onSurface(0.7),
    fontSize: 16,
    lineHeight: 16,
    fontWeight: '600',
  },
  content: { flex: 1, padding: 14 },

  // ─── Estado IDLE — formulario de scan ──────────────────────────────────────
  scanForm: { gap: 10 },
  scanLabel: {
    color: c.onSurface(0.45),
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 2,
  },
  scanInput: {
    backgroundColor: c.onSurface(0.06),
    borderWidth: 1, borderColor: c.onSurface(0.12),
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10,
    color: c.textPrimary, fontSize: 14,
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' } : {}),
  },
  scanBtn: {
    borderRadius: 8, paddingVertical: 12,
    alignItems: 'center', marginTop: 4,
  },
  scanBtnDisabled: { opacity: 0.35 },
  scanBtnText: {
    color: '#fff', fontSize: 12, fontWeight: '900', letterSpacing: 2,
  },
  demoHint: {
    color: c.onSurface(0.35),
    fontSize: 11, textAlign: 'center', marginTop: 4,
  },
  scanFooterHint: {
    color: c.onSurface(0.35),
    fontSize: 10, lineHeight: 14, fontStyle: 'italic',
    marginTop: 12,
  },

  // ─── Estado SCANNING ───────────────────────────────────────────────────────
  scanningRow: {
    paddingVertical: 30, alignItems: 'center', gap: 10,
  },
  scanningDot: {
    width: 10, height: 10, borderRadius: 5,
    shadowOpacity: 0.9, shadowRadius: 8, shadowOffset: { width: 0, height: 0 },
  },
  scanningText: {
    color: c.textPrimary, fontSize: 13, fontWeight: '700',
  },
  scanningHint: {
    color: c.onSurface(0.40),
    fontSize: 11, textAlign: 'center', paddingHorizontal: 12,
  },

  // ─── Estado ACTIVE — sesión confirmada ─────────────────────────
  activeScroll:        { flex: 1, marginHorizontal: -14, marginVertical: -14 },
  activeScrollContent: { paddingHorizontal: 14, paddingVertical: 14, gap: 12 },

  activeHeaderRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  activeDotLg: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: '#7B76DD',
    shadowColor: '#7B76DD',
    shadowOpacity: 0.9, shadowRadius: 6, shadowOffset: { width: 0, height: 0 },
  },
  activeRiotId: {
    color: c.textPrimary, fontSize: 14, fontWeight: '700', flex: 1,
  },
  activeStatusInline: {
    color: 'rgba(123,118,221,0.7)', fontSize: 10, fontWeight: '700', letterSpacing: 1,
  },

  // Tip por facción
  activeTipCard: {
    backgroundColor: c.onSurface(0.04),
    borderWidth: 1,
    borderRadius: 8, padding: 12,
  },
  activeTipLabel: {
    fontSize: 9, fontWeight: '900', letterSpacing: 2, marginBottom: 6,
  },
  activeTipText: {
    color: c.onSurface(0.70),
    fontSize: 12, lineHeight: 17, fontStyle: 'italic',
  },

  // Métricas mock de la última partida
  activeMetrics: {},
  activeMetricsLabel: {
    color: c.onSurface(0.30),
    fontSize: 9, fontWeight: '900', letterSpacing: 2, marginBottom: 8,
  },
  metricsRow: { flexDirection: 'row', gap: 8 },
  metricPill: {
    flex: 1,
    backgroundColor: c.onSurface(0.04),
    borderRadius: 6, padding: 8,
    alignItems: 'center',
  },
  metricVal: { color: c.textPrimary, fontSize: 15, fontWeight: '800' },
  metricKey: { color: c.onSurface(0.35), fontSize: 9, marginTop: 2, letterSpacing: 0.5 },

  // Build recomendada (slots placeholder)
  buildSection: { gap: 8 },
  buildLabel: {
    color: c.onSurface(0.30),
    fontSize: 9, fontWeight: '900', letterSpacing: 2,
  },
  buildSlots: { flexDirection: 'row', gap: 6 },
  buildSlot: {
    width: 40, height: 40, borderRadius: 6,
    backgroundColor: c.onSurface(0.04),
    borderWidth: 1, borderColor: c.onSurface(0.08),
    alignItems: 'center', justifyContent: 'center',
  },
  buildSlotIcon: { color: c.onSurface(0.20), fontSize: 16, fontWeight: '700' },
  buildHint: {
    color: c.onSurface(0.20),
    fontSize: 10, textAlign: 'center', marginTop: 2, fontStyle: 'italic',
  },
});

/**
 * Memoizado: el widget vive a nivel global (montado en App junto a la nav), así
 * que cualquier re-render de la app lo arrastraría. memo lo blinda frente a esos
 * re-renders del padre; su propio estado (visible/minimized/sesión, vía
 * RadarContext) sigue re-renderizándolo porque el contexto no lo bloquea memo.
 * El comparador refleja las señales que importan (visible, minimized, partida
 * activa, campeón seleccionado).
 */
export default React.memo(
  FloatingRadarWidget,
  (prev, next) =>
    prev.visible === next.visible &&
    prev.minimized === next.minimized &&
    prev.gameSession?.active === next.gameSession?.active &&
    prev.selectedChampion?.name === next.selectedChampion?.name
);
