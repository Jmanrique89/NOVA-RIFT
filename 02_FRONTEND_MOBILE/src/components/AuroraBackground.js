// ============================================================================
// AuroraBackground v2 — Audit v2 VAN 8 (Aurora multi-color animada)
// ----------------------------------------------------------------------------
// Trend 2026 #3 — fondo aurora con 3 blobs de colores distintos (verde,
// púrpura, azul profundo) flotando con animaciones desfasadas. Look "vanguardia
// 2026" recomendado por el auditor: paleta multi-color en lugar de monocromo.
//
// React Native no soporta CSS radial-gradient ni filter:blur. Simulamos con
// Views borderRadius 999 + opacidad muy baja (0.06–0.10) + tamaños grandes
// para sensación de blur perceptivo. Las animaciones de translate/scale dan
// el efecto "aurora boreal" sin necesidad de blur real.
// ============================================================================
import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';

// Paleta vanguardia: verde primary del theme + púrpura + azul profundo
const PURPLE = '#6400c8';
const DEEP_BLUE = '#0050c8';

export default function AuroraBackground({ theme, accentColor, position = 'top', intensity = 'normal' }) {
  // Tres blobs con animaciones desfasadas
  const float1 = useRef(new Animated.Value(0)).current;
  const float2 = useRef(new Animated.Value(0)).current;
  const float3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Cada blob flota en bucle con duraciones distintas (12s, 16s, 20s) →
    // nunca quedan sincronizados, siempre hay movimiento orgánico.
    const loop = (val, dur) => Animated.loop(
      Animated.sequence([
        Animated.timing(val, { toValue: 1, duration: dur,     easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(val, { toValue: 0, duration: dur,     easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    const l1 = loop(float1, 12000);
    const l2 = loop(float2, 16000);
    const l3 = loop(float3, 20000);
    l1.start();
    l2.start();
    l3.start();

    // Cleanup — parar los loops al desmontar (evita fuga de animaciones /
    // "Excessive number of pending callbacks" en NativeAnimatedModule).
    return () => {
      l1.stop();
      l2.stop();
      l3.stop();
    };
  }, []);

  const greenColor = accentColor || theme.primary;
  const baseOpacity = intensity === 'high' ? 0.10 : 0.07;

  // Animaciones de translate y scale para cada blob
  const t1x = float1.interpolate({ inputRange: [0, 1], outputRange: [0,  40] });
  const t1y = float1.interpolate({ inputRange: [0, 1], outputRange: [0, -30] });
  const s1  = float1.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });

  const t2x = float2.interpolate({ inputRange: [0, 1], outputRange: [0, -50] });
  const t2y = float2.interpolate({ inputRange: [0, 1], outputRange: [0,  20] });
  const s2  = float2.interpolate({ inputRange: [0, 1], outputRange: [1.05, 0.95] });

  const t3x = float3.interpolate({ inputRange: [0, 1], outputRange: [0,  20] });
  const t3y = float3.interpolate({ inputRange: [0, 1], outputRange: [0,  40] });
  const s3  = float3.interpolate({ inputRange: [0, 1], outputRange: [1, 1.10] });

  return (
    <View pointerEvents="none" style={[styles.layer, position === 'top' ? styles.topAlign : styles.centerAlign]}>
      {/* Blob 1 — verde (primario) */}
      <Animated.View
        style={[
          styles.blob,
          styles.blobGreen,
          {
            backgroundColor: greenColor,
            opacity: baseOpacity * 1.4,
            transform: [{ translateX: t1x }, { translateY: t1y }, { scale: s1 }],
          },
        ]}
      />
      {/* Blob 2 — púrpura (depth) */}
      <Animated.View
        style={[
          styles.blob,
          styles.blobPurple,
          {
            backgroundColor: PURPLE,
            opacity: baseOpacity * 1.0,
            transform: [{ translateX: t2x }, { translateY: t2y }, { scale: s2 }],
          },
        ]}
      />
      {/* Blob 3 — azul profundo (background depth) */}
      <Animated.View
        style={[
          styles.blob,
          styles.blobBlue,
          {
            backgroundColor: DEEP_BLUE,
            opacity: baseOpacity * 0.85,
            transform: [{ translateX: t3x }, { translateY: t3y }, { scale: s3 }],
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  topAlign: { justifyContent: 'flex-start', alignItems: 'center' },
  centerAlign: { justifyContent: 'center', alignItems: 'center' },

  blob: {
    position: 'absolute',
    borderRadius: 999,
  },
  // Verde — top center, el más grande y prominente
  blobGreen: {
    width: 600, height: 320,
    top: -100,
    left: -50,
  },
  // Púrpura — top right, depth
  blobPurple: {
    width: 380, height: 280,
    top: 30,
    right: -120,
  },
  // Azul — bottom left, ambient
  blobBlue: {
    width: 480, height: 320,
    top: 220,
    left: -160,
  },
});
