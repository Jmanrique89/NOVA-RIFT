// ============================================================================
// NovaButton.js — Botón reutilizable del sistema de diseño NOVA RIFT
// ----------------------------------------------------------------------------
// Estilo del botón: glassmorphism + pulso animado.
//
// Capas del render (de fuera hacia dentro):
// 1. Halo exterior animado (Animated.View con shadow + scale 1↔1.04 a 2.5s)
// sólo en variant="solid" cuando !disabled !loading.
// 2. Glass background: tinte facción 22-30% + backdrop-blur en web.
// 3. Borde luminoso 1.5px factionColor + sombra interior.
// 4. Línea de "shimmer" superior 1px (highlight de cristal).
// 5. Texto + spinner.
//
// API (se mantiene 100% compatible con la versión anterior):
// <NovaButton
// label="ENTRAR" string — UPPERCASE automático
// onPress={fn} función
// variant="solid" "solid" | "ghost" (default "solid")
// factionColor="#7B76DD" hex — fallback al primary NEUTRAL si se omite
// disabled={false} bool
// loading={false} bool
// size="md" "sm" | "md" | "lg"
// style={{}} override del contenedor
// icon={null} ReactNode opcional ANTES del label
// />
//
// Notas de implementación:
// El pulso usa Animated.loop nativo (useNativeDriver: true en transform y
// useNativeDriver: false en shadowOpacity por limitación RN Web).
// En móvil nativo el backdrop-blur no aplica; el glass se simula con un
// fondo más opaco para mantener legibilidad.
// El borde luminoso se sintetiza con shadowColor = factionColor + radio
// 12px y sombra inset simulada por una capa interior con borde más fino.
// ============================================================================
import React, { useEffect, useRef } from 'react';
import {
  Animated,
  TouchableWithoutFeedback,
  ActivityIndicator,
  Text,
  View,
  StyleSheet,
  Platform,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';

const SIZE_STYLES = {
  sm: { paddingVertical: 8,  paddingHorizontal: 18, fontSize: 11, letterSpacing: 2   },
  md: { paddingVertical: 14, paddingHorizontal: 28, fontSize: 13, letterSpacing: 2.5 },
  lg: { paddingVertical: 16, paddingHorizontal: 36, fontSize: 15, letterSpacing: 1.5 },
};

const FALLBACK_FACTION = '#7B76DD';
let _warnedFallback = false;

export default function NovaButton({
  label,
  onPress,
  variant      = 'solid',
  factionColor,
  disabled     = false,
  loading      = false,
  size         = 'md',
  style,
  icon         = null,
}) {
  const { isDark } = useTheme();
  // Resolución de color con warn dev (mismo guard que la versión anterior)
  let resolvedColor = factionColor;
  if (!resolvedColor) {
    resolvedColor = FALLBACK_FACTION;
    if (typeof __DEV__ !== 'undefined' && __DEV__ && !_warnedFallback) {
      _warnedFallback = true;
      // console.debug (NO console.warn): el fallback NEUTRAL es el comportamiento
      // esperado en pantallas pre-facción (login/register/onboarding) y el warn
      // disparaba el toast amarillo de Expo en cada arranque. Se conserva la
      // traza en debug para auditar pantallas post-facción que lo omitan.
      // eslint-disable-next-line no-console
      console.debug(
        '[NovaButton] factionColor no recibido — usando fallback NEUTRAL #7B76DD. ' +
        'Si esta pantalla es pre-facción (login/register/onboarding), es correcto. ' +
        'Si es post-facción, pasa FACTIONS[selected].primary explícitamente.'
      );
    }
  }

  const scaleAnim = useRef(new Animated.Value(1)).current;
  const haloAnim  = useRef(new Animated.Value(0)).current;
  const sz        = SIZE_STYLES[size] || SIZE_STYLES.md;
  const isActive  = !disabled && !loading;

  // Pulso del halo exterior — sólo cuando el botón está activo y es solid
  useEffect(() => {
    if (!isActive || variant !== 'solid') {
      haloAnim.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(haloAnim, { toValue: 1, duration: 1300, useNativeDriver: false }),
        Animated.timing(haloAnim, { toValue: 0, duration: 1300, useNativeDriver: false }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [isActive, variant, haloAnim]);

  const handlePressIn = () => {
    if (!isActive) return;
    Animated.spring(scaleAnim, {
      toValue:  variant === 'solid' ? 0.96 : 0.97,
      tension:  220,
      friction: 14,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    if (!isActive) return;
    Animated.spring(scaleAnim, {
      toValue: 1, tension: 130, friction: 9,
      useNativeDriver: true,
    }).start();
  };

  const handlePress = () => {
    if (!isActive || !onPress) return;
    onPress();
  };

  const isSolid = variant === 'solid';

  // Glass background (variant="solid"): tinte facción translúcido + blur en web
  const glassBg = isSolid
    ? (isDark ? resolvedColor + '38' : resolvedColor) // oscuro: glass translúcido 22%; claro: relleno sólido (el texto blanco se lee)
    : 'transparent';
  const borderColor = isSolid
    ? resolvedColor                              // borde sólido facción
    : resolvedColor + '66';                      // ghost: borde más débil
  const textColor   = isSolid ? '#ffffff' : resolvedColor;
  const textWeight  = '800';

  // Halo animado: opacity 0.25 → 0.7 + scale 1 → 1.04
  const haloOpacity = haloAnim.interpolate({
    inputRange: [0, 1], outputRange: [0.25, 0.7],
  });
  const haloScale = haloAnim.interpolate({
    inputRange: [0, 1], outputRange: [1, 1.04],
  });
  const shadowRadius = haloAnim.interpolate({
    inputRange: [0, 1], outputRange: [10, 22],
  });

  const showHalo = isSolid && isActive;

  return (
    <TouchableWithoutFeedback
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      disabled={!isActive}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Animated.View style={[styles.wrap, { transform: [{ scale: scaleAnim }] }]}>
        {/* Capa 1 — halo exterior animado */}
        {showHalo && (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.halo,
              {
                shadowColor: resolvedColor,
                shadowOpacity: haloOpacity,
                shadowRadius,
                borderColor: resolvedColor + 'AA',
                opacity: haloOpacity,
                transform: [{ scale: haloScale }],
              },
            ]}
          />
        )}

        {/* Capa 2-3 — glass card con borde luminoso */}
        <View
          style={[
            styles.base,
            {
              paddingVertical:   sz.paddingVertical,
              paddingHorizontal: sz.paddingHorizontal,
              backgroundColor:   glassBg,
              borderColor,
              borderWidth:       1.5,
              shadowColor:       resolvedColor,
              opacity:           disabled ? 0.35 : 1,
              ...(Platform.OS === 'web' && isSolid
                ? { backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)' }
                : {}),
            },
            style,
          ]}
        >
          {/* Capa 4 — highlight superior tipo "luz reflejada en cristal" */}
          {isSolid && (
            <View
              pointerEvents="none"
              style={[
                styles.shimmer,
                { backgroundColor: 'rgba(255,255,255,0.18)' },
              ]}
            />
          )}

          {/* Capa 5 — contenido */}
          {loading ? (
            <ActivityIndicator size="small" color={textColor} />
          ) : (
            <>
              {icon}
              <Text
                style={[
                  styles.label,
                  {
                    color:         textColor,
                    fontWeight:    textWeight,
                    fontSize:      sz.fontSize,
                    letterSpacing: sz.letterSpacing,
                    marginLeft:    icon ? 8 : 0,
                    textShadowColor: isSolid ? resolvedColor + '99' : 'transparent',
                    textShadowRadius: isSolid ? 8 : 0,
                  },
                ]}
              >
                {label?.toUpperCase?.() ?? label}
              </Text>
            </>
          )}
        </View>
      </Animated.View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'stretch',
    position: 'relative',
  },
  halo: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 14,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 0 },
    elevation: 12,
  },
  base: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    borderRadius:   14,
    overflow:       'hidden',
    shadowOffset:   { width: 0, height: 0 },
    shadowOpacity:  0.45,
    shadowRadius:   12,
    elevation:      8,
    position:       'relative',
  },
  shimmer: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: 1,
    opacity: 0.7,
  },
  label: {
    includeFontPadding: false,
    textAlign:          'center',
  },
});
