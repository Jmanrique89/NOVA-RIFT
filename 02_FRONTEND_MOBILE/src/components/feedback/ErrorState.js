// ============================================================================
// ErrorState — bloque de error reutilizable con reintento opcional.
// ----------------------------------------------------------------------------
// Principio DIN de feedback: cuando una carga falla, comunicamos el problema de
// forma clara y ofrecemos una acción de recuperación en vez de dejar la UI
// rota o en blanco.
//
// Indicador visual: un badge circular con '!' (sin emojis) en rojo de peligro.
// El botón "Reintentar" usa un TouchableOpacity simple (estilo histórico de la
// app), no el sistema Button.js, para mantener este componente autónomo.
// ============================================================================
import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';

const DANGER = '#ff4444';
const FONT_BOLD = 'Rajdhani_700Bold';
const FONT_REGULAR = 'Rajdhani_400Regular';

/**
 * Estado de error centrado, con título, mensaje y botón de reintento opcional.
 *
 * @param {object} props
 * @param {string} props.message Descripción del error (texto atenuado).
 * @param {() => void} [props.onRetry] Si se pasa, muestra el botón "Reintentar".
 * @param {string} [props.title='Algo salió mal'] Título destacado del error.
 * @param {import('react-native').StyleProp<import('react-native').ViewStyle>} [props.style]
 * Estilo adicional para el contenedor.
 * @returns {JSX.Element}
 */
export default function ErrorState({
  message,
  onRetry,
  title = 'Algo salió mal',
  style,
}) {
  const { colors: c } = useTheme();
  const styles = useMemo(() => makeErrorStateStyles(c), [c]);
  return (
    <View style={[styles.container, style]}>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>!</Text>
      </View>

      <Text style={styles.title}>{title}</Text>

      {!!message && <Text style={styles.message}>{message}</Text>}

      {typeof onRetry === 'function' && (
        <TouchableOpacity
          style={styles.retryButton}
          onPress={onRetry}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Reintentar"
        >
          <Text style={styles.retryLabel}>REINTENTAR</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const makeErrorStateStyles = (c) => StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    paddingHorizontal: 20,
    backgroundColor: c.onSurface(0.04),
    borderColor: DANGER + '44',
    borderWidth: 1,
    borderRadius: 12,
  },
  badge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: DANGER,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  badgeText: {
    color: DANGER,
    fontSize: 24,
    fontFamily: FONT_BOLD,
    lineHeight: 28,
    includeFontPadding: false,
  },
  title: {
    color: c.textPrimary,
    fontSize: 16,
    fontFamily: FONT_BOLD,
    letterSpacing: 0.5,
    textAlign: 'center',
    marginBottom: 6,
  },
  message: {
    color: c.onSurface(0.55),
    fontSize: 13,
    fontFamily: FONT_REGULAR,
    textAlign: 'center',
    lineHeight: 18,
  },
  retryButton: {
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 22,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: DANGER,
    backgroundColor: DANGER + '1A',
  },
  retryLabel: {
    color: DANGER,
    fontSize: 12,
    fontFamily: FONT_BOLD,
    letterSpacing: 2,
  },
});
