// useResponsive.js — hook de responsive design para React Native
// adaptación a múltiples tamaños de pantalla

import { useWindowDimensions } from 'react-native';

export const BREAKPOINTS = {
  sm: 360,   // Teléfonos pequeños (SE, A01)
  md: 390,   // Teléfonos estándar (iPhone 14, Pixel 7) — diseño base
  lg: 430,   // Teléfonos grandes (iPhone 14 Pro Max, S24+)
  xl: 768,   // Tablets
};

export function useResponsive() {
  const { width, height } = useWindowDimensions();
  const isSmall = width < BREAKPOINTS.md;
  const isLarge = width >= BREAKPOINTS.lg;
  const isTablet = width >= BREAKPOINTS.xl;
  const isLandscape = width > height;

  // Escala proporcional al diseño base (390px)
  // Ej: scale(60) → 55px en iPhone SE, 60px en iPhone 14, 66px en iPhone 14 Pro Max
  const scale = (size) => Math.round((width / BREAKPOINTS.md) * size);

  // Escala que solo aplica si el teléfono es pequeño (no escala en arriba)
  const scaleDown = (size) => isSmall ? scale(size) : size;

  return { width, height, isSmall, isLarge, isTablet, isLandscape, scale, scaleDown };
}
