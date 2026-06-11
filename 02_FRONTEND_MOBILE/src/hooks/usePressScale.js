// ============================================================================
// usePressScale — micro-feedback táctil de los CTAs (B4.4, DIN2)
// ----------------------------------------------------------------------------
// Réplica del press-feedback de NovaButton (spring a scale 0.96) como hook,
// para los CTAs que NO usan NovaButton (ENTRAR del login, CONFIRMAR CON… del
// champ select, ENTRAR A NOVA RIFT del welcome). Sutil, no circense: ~120 ms
// de entrada y ~180 ms de salida con springs nativos.
//
// Uso:
//   const press = usePressScale();
//   <TouchableOpacity onPressIn={press.onPressIn} onPressOut={press.onPressOut} ...>
//     <Animated.View style={{ transform: [{ scale: press.scale }] }}>…</Animated.View>
//   </TouchableOpacity>
// ============================================================================
import { useRef } from 'react';
import { Animated } from 'react-native';

/**
 * Hook de micro-feedback de pulsación: spring de escala 1 → pressScale → 1.
 *
 * @param {object} [opts]
 * @param {number} [opts.pressScale=0.96] Escala al presionar.
 * @returns {{ scale: Animated.Value, onPressIn: () => void, onPressOut: () => void }}
 */
export function usePressScale({ pressScale = 0.96 } = {}) {
  const scale = useRef(new Animated.Value(1)).current;
  const onPressIn = () => {
    Animated.spring(scale, {
      toValue: pressScale, tension: 220, friction: 14, useNativeDriver: true,
    }).start();
  };
  const onPressOut = () => {
    Animated.spring(scale, {
      toValue: 1, tension: 130, friction: 9, useNativeDriver: true,
    }).start();
  };
  return { scale, onPressIn, onPressOut };
}

export default usePressScale;
