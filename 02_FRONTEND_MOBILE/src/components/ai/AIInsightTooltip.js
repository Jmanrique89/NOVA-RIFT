// ============================================================================
// AIInsightTooltip — Interfaces Naturales con IA (explicabilidad).
// ----------------------------------------------------------------------------
// Modal de explicación que responde a "¿por qué la IA me dice esto?". Hace
// transparente el razonamiento detrás de un consejo o estimación: un título,
// una explicación en lenguaje natural y, opcionalmente, los datos concretos
// que sustentan la recomendación.
//
// Solo texto, sin emojis ni iconos decorativos — coherente con el feedback de
// la app.
// ============================================================================
import React, { useMemo } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';

const ACCENT = '#7B76DD';
const FONT_SEMIBOLD = 'Rajdhani_600SemiBold';
const FONT_BOLD = 'Rajdhani_700Bold';
const FONT_REGULAR = 'Rajdhani_400Regular';

/**
 * @typedef {Object} InsightDataPoint
 * @property {string} label Etiqueta de la fila.
 * @property {string|number} value Valor mostrado a la derecha.
 */

/**
 * Modal de explicabilidad de IA: por qué se da un consejo o estimación.
 *
 * @param {object} props
 * @param {boolean} props.visible Controla la visibilidad del modal.
 * @param {() => void} props.onClose Callback al cerrar (X o tocar el fondo).
 * @param {string} props.title Título de la tarjeta (h5 ~20px).
 * @param {string} props.explanation Explicación en lenguaje natural.
 * @param {InsightDataPoint[]} [props.dataPoints] Datos que sustentan el consejo.
 * @returns {JSX.Element} El modal de explicación.
 */
export default function AIInsightTooltip({
  visible,
  onClose,
  title,
  explanation,
  dataPoints,
}) {
  const { colors: c } = useTheme();
  const styles = useMemo(() => makeTooltipStyles(c), [c]);

  return (
    <Modal
      visible={!!visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        {/* Card no propaga el press al fondo */}
        <TouchableOpacity style={styles.card} activeOpacity={1}>
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={onClose}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Cerrar"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>

          <Text style={styles.title}>{title}</Text>

          {!!explanation && (
            <Text style={styles.explanation}>{explanation}</Text>
          )}

          {Array.isArray(dataPoints) && dataPoints.length > 0 && (
            <View style={styles.dataTable}>
              {dataPoints.map((dp, i) => (
                <View key={`${dp.label}-${i}`} style={styles.dataRow}>
                  <Text style={styles.dataLabel}>{dp.label}</Text>
                  <Text style={styles.dataValue}>{dp.value}</Text>
                </View>
              ))}
            </View>
          )}
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const makeTooltipStyles = (c) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: c.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: c.bg2,
    borderColor: ACCENT,
    borderWidth: 1,
    borderRadius: 14,
    padding: 20,
  },
  closeBtn: {
    position: 'absolute',
    top: 10,
    right: 12,
    zIndex: 2,
  },
  closeText: {
    color: c.onSurface(0.55),
    fontSize: 16,
    fontFamily: FONT_BOLD,
  },
  title: {
    color: c.textPrimary,
    fontSize: 20,
    fontFamily: FONT_SEMIBOLD,
    letterSpacing: 0.3,
    marginBottom: 10,
    paddingRight: 24,
  },
  explanation: {
    color: c.onSurface(0.7),
    fontSize: 16,
    fontFamily: FONT_REGULAR,
    lineHeight: 22,
  },
  dataTable: {
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: c.onSurface(0.08),
    paddingTop: 12,
    gap: 6,
  },
  dataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dataLabel: {
    color: c.onSurface(0.5),
    fontSize: 11,
    fontFamily: FONT_REGULAR,
    letterSpacing: 0.5,
  },
  dataValue: {
    color: ACCENT,
    fontSize: 11,
    fontFamily: FONT_BOLD,
    letterSpacing: 0.5,
  },
});
