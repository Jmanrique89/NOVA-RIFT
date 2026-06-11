// ============================================================================
// CircularProgressRing — Trend 2026 #6 (Gamification 3.0)
// ----------------------------------------------------------------------------
// Anillo circular animado con SVG. Stroke-dasharray técnica clásica:
// circumference = 2πr
// strokeDashoffset interpolado de circumference (vacío) → 0 (lleno)
//
// Props:
// progress (0-1)
// size — diámetro total (default 120)
// strokeWidth — grosor del trazo (default 8)
// color — color del trazo (default verde)
// trackColor — color del fondo (default gris muy oscuro)
// children — contenido centrado (suele ser el número)
// rotation — desde qué grado empieza (default -90 = top)
// ============================================================================

/**
 * @module CircularProgressRing
 *
 * Anillo de progreso circular animado, dibujado con SVG mediante la técnica
 * clásica de `strokeDashoffset`:
 * `circumference = 2·π·r` define el perímetro del círculo de progreso.
 * `strokeDashoffset` se interpola de `circumference` (anillo vacío) hasta
 * `0` (anillo lleno), produciendo el efecto de "llenado" animado.
 *
 * El relleno se anima con `Animated.timing` y easing cúbico de salida. Acepta
 * `children` para centrar contenido arbitrario (típicamente el valor numérico)
 * dentro del anillo. Usado por {@link module:KPICoachingWidget}.
 *
 * Estados (DIN1-UD3):
 * Vacío:    `progress=0` → solo se pinta el track de fondo (anillo apagado).
 * Normal:   `0 < progress < 1` → arco animado en `color`.
 * Completo: `progress=1` → anillo cerrado (el valor se recorta a [0,1], así
 *           que valores fuera de rango nunca rompen la geometría).
 * Loading/error/disabled: los gestiona el CONTENEDOR (p. ej.
 *           KPICoachingWidget muestra SkeletonCard/ErrorState y no monta el
 *           anillo). Este componente es presentacional puro: no fetchea datos
 *           ni conoce estado global — separación visual/lógica.
 *
 * Dónde se usa: KPICoachingWidget (anillo del KPI semanal), ForgeScreen
 * (ELO estimado y especialización) y ComponentShowcaseScreen (catálogo vivo).
 *
 * @example
 * <CircularProgressRing progress={0.72} size={108} color="#7B76DD">
 * <Text>7.2</Text>
 * </CircularProgressRing>
 */

/**
 * @typedef {Object} CircularProgressRingProps
 * @property {number} [progress=0] Progreso normalizado en el rango 0–1. Se
 * recorta automáticamente a [0, 1].
 * @property {number} [size=120] Diámetro total del componente, en px.
 * @property {number} [strokeWidth=8] Grosor del trazo del anillo, en px.
 * @property {string} [color='#39ff94'] Color del trazo de progreso.
 * @property {string} [trackColor='rgba(255,255,255,0.08)'] Color del anillo de
 * fondo (track) bajo el progreso.
 * @property {React.ReactNode} [children] Contenido centrado dentro del anillo
 * (suele ser el número/etiqueta del valor actual).
 * @property {number} [rotation=-90] Grados de rotación del punto de inicio del
 * trazo. `-90` arranca arriba (12 en punto).
 * @property {number} [duration=900] Duración de la animación de relleno, en ms.
 */

import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useResponsive } from '../hooks/useResponsive';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/**
 * Anillo de progreso circular animado con SVG.
 *
 * @param {CircularProgressRingProps} props Propiedades del componente.
 * @returns {React.ReactElement} El anillo SVG con el contenido centrado.
 */
function CircularProgressRing({
  progress = 0,
  size = 120,
  strokeWidth = 8,
  color = '#39ff94',
  trackColor = 'rgba(255,255,255,0.08)',
  children,
  rotation = -90,
  duration = 900,
}) {
  // useResponsive: tamaño adaptativo para pantallas pequeñas
  // Solo escalamos el tamaño por defecto (120); si el caller fija un tamaño
  // explícito lo respetamos tal cual.
  const { scaleDown } = useResponsive();
  const effectiveSize = size === 120 ? scaleDown(120) : size;

  const r = (effectiveSize - strokeWidth) / 2;
  const cx = effectiveSize / 2;
  const cy = effectiveSize / 2;
  const circumference = 2 * Math.PI * r;

  /** @type {React.MutableRefObject<Animated.Value>} valor 0–1 que dirige el relleno */
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: Math.max(0, Math.min(progress, 1)),
      duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false, // strokeDashoffset no soporta native driver
    }).start();
    return () => progressAnim.stopAnimation();
  }, [progress]);

  const strokeDashoffset = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [circumference, 0],
  });

  return (
    <View style={[styles.container, { width: effectiveSize, height: effectiveSize }]}>
      <Svg width={effectiveSize} height={effectiveSize} viewBox={`0 0 ${effectiveSize} ${effectiveSize}`}>
        {/* Track de fondo */}
        <Circle
          cx={cx} cy={cy} r={r}
          stroke={trackColor}
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        {/* Progress */}
        <AnimatedCircle
          cx={cx} cy={cy} r={r}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          transform={`rotate(${rotation} ${cx} ${cy})`}
        />
      </Svg>

      {/* Contenido centrado (número, etiqueta...) */}
      <View style={[styles.contentLayer, { width: effectiveSize, height: effectiveSize }]}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentLayer: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

/**
 * Memoizado con comparador a medida: cada render recalcula geometría SVG
 * (circumference, dashoffset) y dispara `Animated.timing`, así que evitamos
 * re-renders cuando el padre cambia pero las props visibles del anillo no.
 * Solo re-renderiza si cambia `progress`, `size` o `color` — el resto de props
 * (strokeWidth, trackColor, rotation, duration) son estables en la práctica.
 * Los cambios de dimensión de ventana (useResponsive) re-renderizan igualmente,
 * porque el hook está suscrito dentro del componente y memo no bloquea eso.
 */
export default React.memo(
  CircularProgressRing,
  (prev, next) =>
    prev.progress === next.progress &&
    prev.size === next.size &&
    prev.color === next.color &&
    // trackColor cambia con el tema (claro/oscuro) y children lleva el valor +
    // sus estilos tematizados: hay que comparar ambos o el anillo se queda con
    // los estilos del tema anterior al togglear (texto del valor ilegible).
    prev.trackColor === next.trackColor &&
    prev.children === next.children
);
