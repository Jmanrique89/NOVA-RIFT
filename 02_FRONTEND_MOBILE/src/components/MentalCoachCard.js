// ============================================================================
// MentalCoachCard — Coach mental · recomendaciones de bienestar
// ----------------------------------------------------------------------------
// Card compacta que le dice al jugador si es buen momento para jugar ranked,
// basada en investigación de psicología del rendimiento en LoL.
//
// Indicador semáforo (punto de color + estado en mayúsculas):
// ÓPTIMO (verde) → buen momento para competir.
// PRECAUCIÓN (amarillo) → jugar con cautela.
// NO JUEGUES (rojo) → parar; riesgo de tilt / bajo rendimiento.
//
// La LÓGICA de las reglas vive en el motor puro `src/utils/mentalCoach.js`
// (`evaluateMentalState`), con cobertura de tests en src/__tests__/. Este
// componente solo evalúa con esa función pura y mapea el estado → color.
//
// Datos (los que ya tenemos): racha de `recentMatches` (soporta result
// 'W'/'WIN' y 'L'/'LOSS', orden descendente — la más reciente primero), hora
// del día (`new Date()`) y LP del perfil ranked. Sin datos suficientes (ni
// partidas ni LP) la card no se renderiza (retorna null).
//
// Estilo: glassmorphism consistente con el resto de la app (surface
// rgba(255,255,255,0.04), borde rgba(255,255,255,0.08)) usando los tokens
// semánticos COLORS / TYPE_SCALE. Compacta (~80-90px de alto).
//
// Nota de import: COLORS/TYPE_SCALE se toman del barrel `../theme` (capa
// semántica colors.ts) igual que HubScreen — es ahí donde vive el verde de
// `success` (#4CAF50). El primitivo `tokens.js` define `success` en púrpura,
// que rompería el indicador verde de ÓPTIMO, por eso no se usa aquí.
// ============================================================================

/**
 * @module MentalCoachCard
 *
 * Tarjeta de coaching mental que evalúa el estado del jugador y recomienda si
 * es buen momento para jugar ranked. Pensada para HubScreen (modo OUT-OF-GAME),
 * visible cuando hay datos de Riot y nunca en estado de error.
 *
 * @see module:utils/mentalCoach — motor puro `evaluateMentalState` (la lógica).
 *
 * @example
 * <MentalCoachCard matches={summary.recentMatches} lp={summary.soloRanked.leaguePoints} />
 *
 * @example
 * // Demo FAKER (datos mock estables): 3 victorias seguidas · 22:00 · Gold II
 * <MentalCoachCard matches={[{result:'W'},{result:'W'},{result:'W'}]} hour={22} lp={47} />
 */

/**
 * @typedef {Object} MentalCoachCardProps
 * @property {import('../utils/mentalCoach').MentalCoachMatch[]} [matches]
 * Partidas recientes en orden descendente (la más reciente en el índice 0).
 * Origen de la racha de victorias/derrotas.
 * @property {number} [hour] Hora del día (0-23). Si se omite se usa
 * `new Date().getHours()`. Se pasa explícita para la demo (FAKER → 22).
 * @property {number} [lp] Puntos de Liga (LP) en la división actual. `< 20`
 * se interpreta como ascenso reciente (pico de motivación).
 */

import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, Modal, ScrollView } from 'react-native';

import { COLORS, TYPE_SCALE } from '../theme';
import { useTheme } from '../context/ThemeContext';
import {
  evaluateMentalState,
  evaluateMentalFactors,
  STATUS_LABELS,
  STATUS_VERDICTS,
} from '../utils/mentalCoach';

// ── Metadatos visuales por estado (semáforo) ─────────────────────────────────
// Cada estado mapea a su etiqueta (motor puro) + color del punto/texto + fondo
// translúcido para la caja del icono. Verde/ámbar/rojo de la capa semántica
// (colors.ts), documentados con contraste WCAG 2.1 AA sobre el fondo oscuro.
// `symbol` añade la señal redundante al color (✓/!/✕): accesible para personas
// con daltonismo, que no distinguirían solo por el verde/ámbar/rojo.
const STATUS_META = {
  OPTIMAL: { label: STATUS_LABELS.OPTIMAL, color: COLORS.success, bg: COLORS.successLight, symbol: '✓' },
  CAUTION: { label: STATUS_LABELS.CAUTION, color: COLORS.warning, bg: COLORS.warningLight, symbol: '!' },
  AVOID:   { label: STATUS_LABELS.AVOID,   color: COLORS.error,   bg: COLORS.errorLight,   symbol: '✕' },
};

// El color del semáforo por señal (vista de detalle) se construye DENTRO del
// modal a partir del tema activo (`useTheme`): los estados son marca constante
// (verde/ámbar/rojo) y NEUTRAL usa el gris neutro `textMuted`, que SÍ cambia
// entre claro y oscuro. Ver `MentalCoachModal`.

// Símbolo redundante por señal (mismo criterio de accesibilidad que el badge).
const FACTOR_SYMBOL = {
  OPTIMAL: '✓', // ✓
  CAUTION: '!',
  AVOID:   '✕', // ✕
  NEUTRAL: '–', // –
};

/**
 * Card compacta de coach mental. Evalúa el estado con `evaluateMentalState` y
 * pinta el indicador semáforo + la recomendación. Retorna `null` si no hay
 * datos suficientes (ni partidas ni LP) para evaluar nada.
 *
 * @param {MentalCoachCardProps} props
 * @returns {React.ReactElement|null}
 */
function MentalCoachCard({ matches, hour, lp }) {
  // Estado del modal de detalle. Vive DENTRO del componente memoizado: no cambia
  // la API ni las props (HubScreen sigue pasando solo matches/hour/lp).
  const [detailOpen, setDetailOpen] = useState(false);

  // Tema activo (claro/oscuro). En oscuro `c` === COLORS (idéntico pixel a
  // pixel); en claro las superficies neutras cambian a su equivalente. La marca
  // del semáforo (success/warning/error) es constante en ambos modos.
  const { colors: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  // Hora efectiva: la pasada (demo) o, si se omite, la real del dispositivo.
  const effectiveHour = typeof hour === 'number' ? hour : new Date().getHours();

  // Defensivo: sin partidas y sin LP no hay nada que evaluar → no renderizamos.
  // (HubScreen además ya nos oculta en error state y mientras carga el summary.)
  const hasMatches = Array.isArray(matches) && matches.length > 0;
  if (!hasMatches && typeof lp !== 'number') return null;

  const evalInput = { matches, hour: effectiveHour, lp };
  const { status, message } = evaluateMentalState(evalInput);
  const meta = STATUS_META[status];
  // El desglose por señal solo se necesita al abrir el modal, pero calcularlo es
  // barato y puro → lo dejamos en render para que el modal lo tenga listo.
  const factors = evaluateMentalFactors(evalInput);

  return (
    <>
      {/* Card entera pulsable: el badge ✓/!/✕ señala "pulsa para ver el detalle". */}
      <Pressable
        style={styles.card}
        onPress={() => setDetailOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="Coach mental: ver evaluación completa"
      >
        {/* Caja del icono — fondo tintado con el color del estado (refuerza el
            semáforo). Glifo neutro de producto: un mini-anillo de estado (aro +
            núcleo en meta.color), sin el cerebro IA. Mantiene la señal de color. */}
        <View style={[styles.iconBox, { backgroundColor: meta.bg, borderColor: meta.color + '55' }]}>
          <View style={[styles.iconRing, { borderColor: meta.color }]}>
            <View style={[styles.iconCore, { backgroundColor: meta.color }]} />
          </View>
        </View>

        {/* Columna de texto: estado (punto + mayúsculas) + recomendación */}
        <View style={styles.body}>
          <View style={styles.statusRow}>
            <View style={[styles.dot, { backgroundColor: meta.color }]} />
            <Text style={[styles.statusLabel, { color: meta.color }]}>{meta.label}</Text>
            <Text style={styles.eyebrow}>COACH MENTAL</Text>
          </View>
          <Text style={styles.message} numberOfLines={2}>
            {message}
          </Text>
        </View>

        {/* Badge semáforo pulsable: símbolo + color del estado global. */}
        <View style={[styles.badge, { backgroundColor: meta.bg, borderColor: meta.color + '55' }]}>
          <Text style={[styles.badgeSymbol, { color: meta.color }]}>{meta.symbol}</Text>
        </View>
      </Pressable>

      <MentalCoachModal
        visible={detailOpen}
        onClose={() => setDetailOpen(false)}
        status={status}
        meta={meta}
        message={message}
        factors={factors}
      />
    </>
  );
}

/**
 * Modal "¿Listo para otra ranked?" — explica cómo la app llega a su veredicto
 * (transparencia del algoritmo de bienestar). Sin animaciones centrales
 * llamativas (criterio de producto): solo fade del overlay.
 *
 * @param {{ visible: boolean, onClose: () => void,
 *   status: import('../utils/mentalCoach').MentalStatus,
 *   meta: { color: string, bg: string, symbol: string },
 *   message: string,
 *   factors: import('../utils/mentalCoach').MentalFactor[] }} props
 */
function MentalCoachModal({ visible, onClose, status, meta, message, factors }) {
  const { colors: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  // Color del semáforo por señal: marca (verde/ámbar/rojo) constante; NEUTRAL en
  // gris neutro que SÍ cambia con el tema (textMuted claro/oscuro).
  const factorColor = {
    OPTIMAL: c.success,
    CAUTION: c.warning,
    AVOID:   c.error,
    NEUTRAL: c.textMuted,
  };
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      {/* Tap en el overlay cierra; el panel interior detiene la propagación. */}
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.modalPanel} onPress={() => {}}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalContent}>
            <Text style={styles.modalEyebrow}>COACH MENTAL</Text>

            {/* Veredicto en lenguaje natural + badge semáforo a juego. */}
            <View style={styles.verdictRow}>
              <View style={[styles.badge, styles.badgeLg, { backgroundColor: meta.bg, borderColor: meta.color + '55' }]}>
                <Text style={[styles.badgeSymbolLg, { color: meta.color }]}>{meta.symbol}</Text>
              </View>
              <Text style={[styles.verdictTitle, { color: meta.color }]}>{STATUS_VERDICTS[status]}</Text>
            </View>

            {/* La recomendación contextual que ya se ve en la card. */}
            <Text style={styles.modalMessage}>{message}</Text>

            {/* Desglose por señal: cada una con su semáforo individual. */}
            <Text style={styles.factorsHeading}>QUÉ HE EVALUADO</Text>
            <View style={styles.factorsList}>
              {factors.map((f) => {
                const color = factorColor[f.status];
                return (
                  <View key={f.id} style={styles.factorRow}>
                    <Text style={[styles.factorSymbol, { color }]}>{FACTOR_SYMBOL[f.status]}</Text>
                    <View style={styles.factorText}>
                      <Text style={[styles.factorLabel, { color }]}>{f.label.toUpperCase()}</Text>
                      <Text style={styles.factorDetail}>{f.detail}</Text>
                    </View>
                  </View>
                );
              })}
            </View>

            <Text style={styles.modalFooter}>
              Basado en tus últimas partidas, la hora actual y tus LP.
            </Text>

            <Pressable
              style={styles.closeBtn}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Cerrar evaluación del coach mental"
            >
              <Text style={styles.closeBtnText}>CERRAR</Text>
            </Pressable>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ── Estilos (glassmorphism consistente con la app) ───────────────────────────
// Factory tematizable: recibe los tokens neutros `c` del tema activo. En oscuro
// `c` === COLORS (idéntico); en claro las superficies/textos neutros cambian.
const makeStyles = (c) => StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    // Glassmorphism estándar de la app (spec): surface + borde blanco sutil.
    backgroundColor: c.surface,
    borderColor: c.onSurface(0.08),
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 20,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Mini-anillo de estado (glifo neutro de producto). El aro toma el color del
  // estado (meta.color) y el núcleo lo refuerza — semáforo sin iconografía IA.
  iconRing: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCore: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  body: {
    flex: 1,
    gap: 4,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusLabel: {
    fontSize: TYPE_SCALE.label.size,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  // Etiqueta-eyebrow a la derecha del estado: contextualiza la card sin robar
  // protagonismo al indicador semáforo. Empujada al extremo con marginLeft auto.
  eyebrow: {
    marginLeft: 'auto',
    fontSize: TYPE_SCALE.micro.size,
    fontWeight: '800',
    letterSpacing: 1.5,
    color: c.textMuted,
  },
  message: {
    fontSize: TYPE_SCALE.caption.size,
    lineHeight: TYPE_SCALE.caption.lineHeight,
    color: c.textSecondary,
  },

  // ── Badge semáforo (señal de "pulsa aquí") ─────────────────────────────────
  // Mismo patrón visual que iconBox: fondo tintado + borde del color del estado.
  badge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeSymbol: {
    fontSize: 15,
    fontWeight: '900',
    lineHeight: 18,
  },
  // Variante grande para el titular del modal.
  badgeLg: {
    width: 38,
    height: 38,
    borderRadius: 19,
  },
  badgeSymbolLg: {
    fontSize: 19,
    fontWeight: '900',
    lineHeight: 22,
  },

  // ── Modal de detalle ───────────────────────────────────────────────────────
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modalPanel: {
    width: '100%',
    maxWidth: 440,
    maxHeight: '80%',
    backgroundColor: c.bg2,
    borderColor: c.onSurface(0.08),
    borderWidth: 1,
    borderRadius: 20,
  },
  modalContent: {
    padding: 22,
    gap: 14,
  },
  modalEyebrow: {
    fontSize: TYPE_SCALE.micro.size,
    fontWeight: '800',
    letterSpacing: 1.5,
    color: c.textMuted,
  },
  verdictRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  verdictTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  modalMessage: {
    fontSize: TYPE_SCALE.body.size,
    lineHeight: TYPE_SCALE.body.lineHeight,
    color: c.textSecondary,
  },
  factorsHeading: {
    marginTop: 4,
    fontSize: TYPE_SCALE.label.size,
    fontWeight: '900',
    letterSpacing: 1.2,
    color: c.textPrimary,
  },
  factorsList: {
    gap: 12,
  },
  factorRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  // Símbolo redundante (✓/!/✕/–) con el color del status de la señal.
  factorSymbol: {
    width: 18,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '900',
    lineHeight: 20,
  },
  factorText: {
    flex: 1,
    gap: 2,
  },
  factorLabel: {
    fontSize: TYPE_SCALE.label.size,
    fontWeight: '800',
    letterSpacing: 1,
  },
  factorDetail: {
    fontSize: TYPE_SCALE.caption.size,
    lineHeight: TYPE_SCALE.caption.lineHeight,
    color: c.textSecondary,
  },
  modalFooter: {
    fontSize: TYPE_SCALE.micro.size,
    lineHeight: TYPE_SCALE.micro.lineHeight,
    color: c.textMuted,
  },
  // Botón secundario: superficie translúcida + borde sutil (patrón de la app).
  closeBtn: {
    marginTop: 4,
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: c.onSurface(0.12),
    backgroundColor: c.surface,
    alignItems: 'center',
  },
  closeBtnText: {
    fontSize: TYPE_SCALE.label.size,
    fontWeight: '900',
    letterSpacing: 1.5,
    color: c.textPrimary,
  },
});

/**
 * Memoizado (comparación shallow): la card es estable salvo que cambien las
 * partidas / hora / LP, así que evitamos recomputar la evaluación en cada
 * re-render del HubScreen (cambios de tab, modales, etc.).
 */
export default React.memo(MentalCoachCard);
