// ============================================================================
// HoverCard — Wrapper con hover en web, neutro en móvil.
// ----------------------------------------------------------------------------
// Detecta cursor con onMouseEnter/onMouseLeave (sólo Web). En móvil pasa
// children directos sin overhead.
//
// Props:
// style — pasa al View raíz.
// onHoverChange — callback (boolean) — útil para cambios de tono externos.
// liftY — desplazamiento Y al hacer hover (default -10).
// scaleTo — escala objetivo (default 1.03).
// shadowColor — color del glow (típicamente f.primary).
// disabled — desactiva el hover (útil cuando ya está seleccionada).
//
// Uso:
// <HoverCard shadowColor={f.primary} onHoverChange={setHovered}>
// {children}
// </HoverCard>
// ============================================================================
import React, { useRef } from 'react';
import { Animated, Platform, View } from 'react-native';

export default function HoverCard({
  children,
  style,
  onHoverChange,
  liftY = -10,
  scaleTo = 1.03,
  shadowColor = '#ffffff',
  disabled = false,
}) {
  const translateY = useRef(new Animated.Value(0)).current;
  const scale      = useRef(new Animated.Value(1)).current;
  const shadow     = useRef(new Animated.Value(0)).current;

  const animIn = () => {
    if (disabled) return;
    onHoverChange?.(true);
    Animated.parallel([
      Animated.spring(translateY, { toValue: liftY,   friction: 6, tension: 120, useNativeDriver: true }),
      Animated.spring(scale,      { toValue: scaleTo, friction: 6, tension: 120, useNativeDriver: true }),
      Animated.timing(shadow,     { toValue: 1, duration: 200, useNativeDriver: false }),
    ]).start();
  };

  const animOut = () => {
    onHoverChange?.(false);
    Animated.parallel([
      Animated.spring(translateY, { toValue: 0, friction: 6, tension: 120, useNativeDriver: true }),
      Animated.spring(scale,      { toValue: 1, friction: 6, tension: 120, useNativeDriver: true }),
      Animated.timing(shadow,     { toValue: 0, duration: 200, useNativeDriver: false }),
    ]).start();
  };

  const shadowOpacity = shadow.interpolate({ inputRange: [0, 1], outputRange: [0, 0.85] });
  const shadowRadius  = shadow.interpolate({ inputRange: [0, 1], outputRange: [0, 28] });

  // En móvil: noop — sin hover
  if (Platform.OS !== 'web') return <View style={style}>{children}</View>;

  return (
    <Animated.View
      style={[
        style,
        {
          transform: [{ translateY }, { scale }],
          shadowOpacity,
          shadowRadius,
          shadowColor,
          shadowOffset: { width: 0, height: 8 },
          cursor: 'pointer',
        },
      ]}
      // @ts-ignore — eventos DOM válidos en RN Web
      onMouseEnter={animIn}
      onMouseLeave={animOut}
    >
      {children}
    </Animated.View>
  );
}
