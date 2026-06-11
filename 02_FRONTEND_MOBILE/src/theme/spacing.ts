// ============================================================================
// spacing.ts — Grid de 4px, radios, bordes y elevaciones de NOVA RIFT.
// ----------------------------------------------------------------------------
// SPACING sigue una rejilla base de 4px (cada paso es múltiplo de 4 salvo el
// medio-paso xxs=2). Usar estos tokens para padding, margin y gap garantiza
// ritmo espacial consistente en toda la app.
// RADIUS define los redondeos; `full` (9999) produce píldoras/círculos.
// BORDER define los grosores de línea (thin = hairline dependiente del DPR).
// SHADOW combina sombra iOS (shadowColor/Offset/Opacity/Radius) + elevation
// (Android) para que la profundidad sea consistente en ambas plataformas.
// ============================================================================
import { StyleSheet } from 'react-native';

// ── Escala de espaciado (rejilla de 4px) ─────────────────────────────────────
export const SPACING = {
  none:   0,
  xxs:    2,
  xs:     4,
  sm:     8,
  md:     12,
  lg:     16,
  xl:     20,
  xxl:    24,
  xxxl:   32,
  xxxxl:  40,
  huge:   48,
  giant:  64,
} as const;

// ── Radios de borde ───────────────────────────────────────────────────────────
export const RADIUS = {
  sm:   4,
  md:   8,
  lg:   12,
  xl:   16,
  full: 9999,
} as const;

// ── Grosores de borde ─────────────────────────────────────────────────────────
export const BORDER = {
  thin:   StyleSheet.hairlineWidth, // ~0.5px según densidad de pantalla
  normal: 1,
  thick:  2,
} as const;

// ── Elevaciones (sombra iOS + elevation Android) ──────────────────────────────
export const SHADOW = {
  sm: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.18, shadowRadius: 2, elevation: 2 },
  md: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.22, shadowRadius: 4, elevation: 4 },
  lg: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.28, shadowRadius: 8, elevation: 8 },
};
