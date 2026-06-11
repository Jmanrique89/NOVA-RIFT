// ============================================================================
// Skeleton — Loader animado tipo "shimmer" para estados de carga.
// ----------------------------------------------------------------------------
// Proporciona interfaces de carga (Skeleton Loaders) para evitar pantallas
// vacías o saltos bruscos mientras los datos llegan.
//
// Tres componentes exportados:
// <Skeleton width height borderRadius /> — bloque rectangular animado
// <SkeletonText lines width /> — N líneas de texto fake
// <SkeletonCard height /> — tarjeta completa con header,
// líneas y un footer
//
// La animación usa Animated.loop con opacity + sutil scale para parecer un
// shimmer suave. Compatible con Web y nativo (useNativeDriver: true).
// ============================================================================
import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, View, StyleSheet, Easing } from 'react-native';
import { useTheme } from '../context/ThemeContext';

/**
 * Bloque rectangular animado. Usar como ladrillo base de skeletons compuestos.
 */
export default function Skeleton({
  width = '100%',
  height = 16,
  borderRadius = 4,
  style,
}) {
  const { colors: c } = useTheme();
  const styles = useMemo(() => makeSkeletonStyles(c), [c]);
  const opacity = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.45,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  return (
    <Animated.View
      style={[
        styles.block,
        { width, height, borderRadius, opacity },
        style,
      ]}
    />
  );
}

/**
 * N líneas de texto skeleton. La última línea es más corta para parecer
 * un párrafo real.
 */
export function SkeletonText({ lines = 3, width = '100%', spacing = 8 }) {
  return (
    <View style={{ width }}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          width={i === lines - 1 ? '60%' : '100%'}
          height={12}
          borderRadius={3}
          style={{ marginBottom: i === lines - 1 ? 0 : spacing }}
        />
      ))}
    </View>
  );
}

/**
 * Card completa de skeleton — útil como placeholder de cualquier card real
 * (Live session, Forge challenges, Profile data, etc.).
 */
export function SkeletonCard({ height = 140 }) {
  const { colors: c } = useTheme();
  const styles = useMemo(() => makeSkeletonStyles(c), [c]);
  return (
    <View style={[styles.card, { height }]}>
      <View style={styles.cardHeader}>
        <Skeleton width={40} height={40} borderRadius={20} />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Skeleton width="70%" height={14} borderRadius={3} />
          <Skeleton width="40%" height={10} borderRadius={3} style={{ marginTop: 6 }} />
        </View>
      </View>
      <View style={{ marginTop: 14 }}>
        <SkeletonText lines={3} />
      </View>
    </View>
  );
}

const makeSkeletonStyles = (c) => StyleSheet.create({
  block: {
    backgroundColor: 'rgba(123,118,221,0.18)', // cyan NOVA RIFT en bajo
  },
  card: {
    backgroundColor: c.onSurface(0.04),
    borderWidth: 1,
    borderColor: c.onSurface(0.08),
    borderRadius: 8,
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
