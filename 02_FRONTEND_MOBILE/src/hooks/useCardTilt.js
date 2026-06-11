// ============================================================================
// useCardTilt — Rotación 3D basada en posición del cursor (estilo Valorant /
// LoL Universe card selector). Solo Web; en móvil es no-op.
// ----------------------------------------------------------------------------
// Uso:
// const { ref, onMouseMove, onMouseLeave } = useCardTilt(7);
// <Animated.View
// ref={ref}
// onMouseMove={onMouseMove}
// onMouseLeave={onMouseLeave}
// >...</Animated.View>
//
// El ref debe ser una referencia DOM nativa (no Animated). En RN Web los
// componentes Animated.View y View aceptan refs DOM directamente.
// ============================================================================
import { useRef, useCallback } from 'react';
import { Platform } from 'react-native';

export function useCardTilt(intensity = 12) {
  const ref = useRef(null);

  const onMouseMove = useCallback((e) => {
    if (Platform.OS !== 'web' || !ref.current) return;
    const node = ref.current;
    // En RN Web, el ref puede apuntar a un wrapper. Si tiene getBoundingClientRect
    // úsalo; si no, intenta el primer hijo DOM.
    const dom = typeof node.getBoundingClientRect === 'function' ? node : null;
    if (!dom) return;
    const rect = dom.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width  - 0.5) * intensity;
    const y = ((e.clientY - rect.top)  / rect.height - 0.5) * intensity;
    dom.style.transform =
      `perspective(600px) rotateY(${x}deg) rotateX(${-y}deg) scale(1.02)`;
    dom.style.transition = 'transform 0.1s ease-out';
  }, [intensity]);

  const onMouseLeave = useCallback(() => {
    if (Platform.OS !== 'web' || !ref.current) return;
    const node = ref.current;
    const dom = typeof node.getBoundingClientRect === 'function' ? node : null;
    if (!dom) return;
    dom.style.transform =
      'perspective(600px) rotateY(0deg) rotateX(0deg) scale(1)';
    dom.style.transition = 'transform 0.4s ease-out';
  }, []);

  return { ref, onMouseMove, onMouseLeave };
}
