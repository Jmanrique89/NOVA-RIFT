// ============================================================================
// LiveCoachToast — toast flotante con audio wave (E4 · Statup-like)
// ----------------------------------------------------------------------------
// Aparece en el top del InGameHUD cuando llega un nuevo coaching tip:
//
// [● LIVE] | ▒▒▒▒ ←→ ←→ ←→ | "El enemy jungler está bot, defiende top"
// tres barras de audio en loop tip del coach
//
// El padre controla la visibilidad con `visible: bool` y resetea `message`
// cuando quiere mostrar uno nuevo. El componente no tiene timer interno —
// el padre decide cuándo ocultarlo (típicamente con un `setTimeout(4000)`).
//
// Las animaciones usan `useNativeDriver: true` (`opacity` + `transform.scaleY`)
// para mantener fluidez incluso con el InGameHUD pintando contenido pesado.
// ============================================================================
import React, { useEffect, useRef, useMemo } from 'react';
import {
  View, Text, StyleSheet, Animated, Easing, Platform,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';

// ─── Sub: barra de audio que pulsa con un loop scaleY ──────────────────────
function AudioBar({ delay = 0, color }) {
  const { colors: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const scaleY = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scaleY, {
          toValue: 1,
          duration: 400,
          delay,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(scaleY, {
          toValue: 0.3,
          duration: 400,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [delay, scaleY]);

  return (
    <Animated.View
      style={[
        styles.audioBar,
        { backgroundColor: color, transform: [{ scaleY }] },
      ]}
    />
  );
}

// ─── Sub: dot pulsante del badge LIVE ──────────────────────────────────────
function LiveDot({ color }) {
  const { colors: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const opacity = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1,   duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.6, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[styles.liveDot, { backgroundColor: color, opacity }]}
    />
  );
}

/**
 * @param {string} message — texto del coaching tip (1-2 líneas)
 * @param {boolean} visible — true muestra (fade-in 280ms), false oculta
 * @param {string} primaryColor — color de facción para los acentos
 */
export default function LiveCoachToast({
  message,
  visible,
  primaryColor = '#7B76DD',
}) {
  const { colors: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: visible ? 1 : 0,
      duration: 280,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [visible, fadeAnim]);

  if (!message) return null;

  return (
    <Animated.View
      style={[styles.wrapper, { opacity: fadeAnim }]}
      pointerEvents="none"
    >
      <View
        style={[
          styles.toast,
          { borderColor: primaryColor + '44' },
          Platform.OS === 'web'
            ? { backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }
            : null,
        ]}
      >
        {/* Badge LIVE */}
        <View style={styles.liveBadge}>
          <LiveDot color={primaryColor} />
          <Text style={[styles.liveText, { color: primaryColor }]}>LIVE</Text>
        </View>

        {/* Separador vertical */}
        <View style={styles.separator} />

        {/* Audio waves — 3 barras desfasadas */}
        <View style={styles.audioWaves}>
          <AudioBar delay={0}   color={primaryColor} />
          <AudioBar delay={150} color={primaryColor + 'BB'} />
          <AudioBar delay={300} color={primaryColor + '77'} />
        </View>

        {/* Mensaje del coach */}
        <Text style={styles.message} numberOfLines={2}>
          {message}
        </Text>
      </View>
    </Animated.View>
  );
}

const makeStyles = (c) => StyleSheet.create({
  wrapper: {
    position: 'absolute',
    top: 12, left: 16, right: 16,
    zIndex: 9999,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(7,7,13,0.92)',
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 10, paddingHorizontal: 14,
    gap: 10,
    // Sombra
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 12,
  },
  liveBadge: {
    flexDirection: 'row', alignItems: 'center',
    gap: 4,
    minWidth: 42,
  },
  liveDot: {
    width: 7, height: 7, borderRadius: 3.5,
  },
  liveText: {
    fontSize: 9, fontWeight: '900', letterSpacing: 1.5,
  },
  separator: {
    width: 1, height: 28,
    backgroundColor: c.onSurface(0.10),
  },
  audioWaves: {
    flexDirection: 'row', alignItems: 'center',
    gap: 2, height: 22,
  },
  audioBar: {
    width: 3, height: 16, borderRadius: 2,
  },
  message: {
    flex: 1,
    color: c.onSurface(0.85),
    fontSize: 12, lineHeight: 17,
    fontStyle: 'italic',
  },
});
