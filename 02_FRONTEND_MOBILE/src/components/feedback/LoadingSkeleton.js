// ============================================================================
// LoadingSkeleton — placeholders animados "shimmer" para estados de carga.
// ----------------------------------------------------------------------------
// Principio DIN de feedback: mientras los datos llegan, mostramos la silueta de
// lo que vendrá en vez de una pantalla vacía o un spinner suelto.
//
// Exporta:
// <LoadingSkeleton width height borderRadius style /> — ladrillo base
// <SkeletonRow style /> — línea de texto (100% × 16, radio 4)
// <SkeletonCard style /> — tarjeta (100% × 80, radio 8)
//
// La animación recorre la opacidad entre 0.3 y 0.7 en bucle (800 ms por tramo)
// con useNativeDriver para no bloquear el hilo JS. Compatible Web + nativo.
// ============================================================================
import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, StyleSheet, Easing } from 'react-native';
import { useTheme } from '../../context/ThemeContext';

const SHIMMER_DURATION = 800;

/**
 * Bloque rectangular con pulso de opacidad. Sirve de base para skeletons
 * compuestos o como placeholder suelto.
 *
 * @param {object} props
 * @param {number|string} [props.width='100%'] Ancho del bloque.
 * @param {number} [props.height=16] Alto del bloque.
 * @param {number} [props.borderRadius=4] Radio de las esquinas.
 * @param {import('react-native').StyleProp<import('react-native').ViewStyle>} [props.style]
 * Estilo adicional (p. ej. márgenes para separar varios skeletons).
 * @returns {JSX.Element}
 */
export default function LoadingSkeleton({
  width = '100%',
  height = 16,
  borderRadius = 4,
  style,
}) {
  const { colors: c } = useTheme();
  const styles = useMemo(() => makeLoadingSkeletonStyles(c), [c]);
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.7,
          duration: SHIMMER_DURATION,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: SHIMMER_DURATION,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[styles.block, { width, height, borderRadius, opacity }, style]}
    />
  );
}

/**
 * Placeholder de una línea de texto (100% × 16, radio 4).
 *
 * @param {object} props
 * @param {import('react-native').StyleProp<import('react-native').ViewStyle>} [props.style]
 * @returns {JSX.Element}
 */
export function SkeletonRow({ style }) {
  return (
    <LoadingSkeleton width="100%" height={16} borderRadius={4} style={style} />
  );
}

/**
 * Placeholder de una tarjeta (100% × 80, radio 8). Útil para listas de cards
 * o widgets que cargan datos remotos.
 *
 * @param {object} props
 * @param {import('react-native').StyleProp<import('react-native').ViewStyle>} [props.style]
 * @returns {JSX.Element}
 */
export function SkeletonCard({ style }) {
  return (
    <LoadingSkeleton width="100%" height={80} borderRadius={8} style={style} />
  );
}

const makeLoadingSkeletonStyles = (c) => StyleSheet.create({
  block: {
    backgroundColor: c.onSurface(0.06),
  },
});
