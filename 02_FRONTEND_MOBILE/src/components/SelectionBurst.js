// ============================================================================
// SelectionBurst — Explosión de partículas radial al seleccionar una card.
// ----------------------------------------------------------------------------
// Funciona en RN Web y móvil (todas las animaciones useNativeDriver: true).
//
// Props:
// active (bool) — toggle a true para disparar; el padre debe re-toggle
// (false→true) en cada press para reproducir la animación.
// color (string) — hex color de las partículas (típicamente f.primary).
// size (number) — diámetro útil del efecto en px. Las partículas viajan
// entre 35% y 60% del size desde el centro.
//
// Uso típico (en FactionCard):
// <SelectionBurst active={burst} color={f.primary} size={240} />
//
// Patrón para retriggear:
// const handlePress = () => {
// setBurst(false);
// requestAnimationFrame(() => setBurst(true));
// onPick(...);
// };
// ============================================================================
import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';

const PARTICLE_COUNT = 16;

export default function SelectionBurst({ active, color = '#ffffff', size = 300 }) {
  const particles = useRef(
    Array.from({ length: PARTICLE_COUNT }, () => ({
      x:       new Animated.Value(0),
      y:       new Animated.Value(0),
      opacity: new Animated.Value(0),
      scale:   new Animated.Value(0),
    }))
  ).current;

  useEffect(() => {
    if (!active) return;

    const animations = particles.map((p, i) => {
      const angle    = (2 * Math.PI * i) / PARTICLE_COUNT;
      const distance = size * (0.35 + Math.random() * 0.25); // 35–60% del size
      const duration = 600 + Math.random() * 300;            // 600–900ms
      const pSize    = 2 + Math.random() * 4;                // 2–6px

      p.x.setValue(0);
      p.y.setValue(0);
      p.opacity.setValue(0);
      p.scale.setValue(pSize / 6);

      return Animated.parallel([
        Animated.timing(p.x, {
          toValue: Math.cos(angle) * distance,
          duration, useNativeDriver: true,
        }),
        Animated.timing(p.y, {
          toValue: Math.sin(angle) * distance,
          duration, useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.timing(p.opacity, { toValue: 1, duration: 80,             useNativeDriver: true }),
          Animated.timing(p.opacity, { toValue: 0, duration: duration - 80,  useNativeDriver: true }),
        ]),
      ]);
    });

    const burst = Animated.parallel(animations);
    burst.start();
    // Cleanup — parar la ráfaga si el componente se desmonta o se re-dispara
    // a mitad (evita callbacks pendientes en NativeAnimatedModule).
    return () => burst.stop();
  }, [active]);

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFillObject, styles.center]}>
      {particles.map((p, i) => (
        <Animated.View
          key={i}
          style={[
            styles.particle,
            {
              backgroundColor: color,
              opacity: p.opacity,
              transform: [
                { translateX: p.x },
                { translateY: p.y },
                { scale:      p.scale },
              ],
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  center:   { alignItems: 'center', justifyContent: 'center' },
  particle: { position: 'absolute', width: 6, height: 6, borderRadius: 3 },
});
