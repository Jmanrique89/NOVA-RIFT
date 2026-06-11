// ============================================================================
// ErrorToast — Nielsen H9: Ayudar a reconocer y recuperarse de errores.
// ----------------------------------------------------------------------------
// Toast deslizante desde la parte superior que comunica un error de forma
// clara y momentánea. Si no se ofrece una acción de recuperación, se auto-oculta
// a los 4 segundos; si hay acción, permanece hasta que el usuario decide.
//
// Solo texto, sin emojis ni iconos — coherente con el resto de feedback de la app.
// ============================================================================
import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';

const ERROR_BG = 'rgba(248,113,113,0.15)';
const ERROR_BORDER = '#F87171';
const ACCENT = '#9C98F0';
const FONT_BOLD = 'Rajdhani_700Bold';
const FONT_REGULAR = 'Rajdhani_400Regular';

const AUTO_DISMISS_MS = 4000;

/**
 * @typedef {Object} ErrorToastAction
 * @property {string} label Texto del botón de acción.
 * @property {() => void} onPress Callback al pulsar la acción.
 */

/**
 * Toast de error con animación de entrada desde arriba y auto-cierre opcional.
 *
 * @param {object} props
 * @param {boolean} props.visible Si `true`, el toast se desliza dentro.
 * @param {string} props.message Mensaje de error mostrado.
 * @param {ErrorToastAction} [props.action] Acción de recuperación opcional. Si se
 * pasa, se muestra un botón a la derecha y se desactiva el auto-cierre.
 * @param {() => void} props.onDismiss Callback al ocultarse (auto o manual).
 * @returns {JSX.Element} El toast animado.
 */
export default function ErrorToast({ visible, message, action, onDismiss }) {
  const { colors: c } = useTheme();
  const styles = useMemo(() => makeErrorToastStyles(c), [c]);
  const slide = useRef(new Animated.Value(-80)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slide, { toValue: 0, friction: 7, tension: 80, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();

      // Auto-cierre solo cuando NO hay acción de recuperación.
      if (!action) {
        const timer = setTimeout(() => onDismiss?.(), AUTO_DISMISS_MS);
        return () => clearTimeout(timer);
      }
    } else {
      Animated.parallel([
        Animated.timing(slide, { toValue: -80, duration: 200, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }),
      ]).start();
    }
  }, [visible, action, slide, opacity, onDismiss]);

  return (
    <Animated.View
      style={[
        styles.toast,
        { opacity, transform: [{ translateY: slide }] },
      ]}
      pointerEvents={visible ? 'auto' : 'none'}
      accessibilityRole="alert"
      accessibilityLabel={message}
    >
      <Text style={styles.message} numberOfLines={3}>
        {message}
      </Text>

      {action && typeof action.onPress === 'function' && (
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={action.onPress}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={action.label}
        >
          <Text style={styles.actionLabel}>
            {action.label?.toUpperCase?.() ?? action.label}
          </Text>
        </TouchableOpacity>
      )}
    </Animated.View>
  );
}

const makeErrorToastStyles = (c) => StyleSheet.create({
  toast: {
    position: 'absolute',
    top: 50,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ERROR_BG,
    borderColor: ERROR_BORDER,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    zIndex: 1000,
  },
  message: {
    flex: 1,
    color: c.textPrimary,
    fontSize: 13,
    fontFamily: FONT_REGULAR,
    lineHeight: 18,
  },
  actionBtn: {
    marginLeft: 12,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  actionLabel: {
    color: ACCENT,
    fontSize: 12,
    fontFamily: FONT_BOLD,
    letterSpacing: 1,
  },
});
