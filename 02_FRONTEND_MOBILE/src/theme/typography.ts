// ============================================================================
// typography.ts — Escala tipográfica de NOVA RIFT.
// ----------------------------------------------------------------------------
// Fuente: Rajdhani (condensada/futurista, gaming/tech). Los alias coinciden
// con los nombres que registra `useFonts` en App.js vía
// @expo-google-fonts/rajdhani — usar estos strings tal cual en `fontFamily`.
//
// TYPE_SCALE empareja size + lineHeight + letterSpacing por nivel para
// garantizar ritmo vertical consistente. Los títulos usan tracking negativo
// (más densos); los textos pequeños, tracking positivo para legibilidad.
//
// Nota: cada nivel expone `size` (no `fontSize`). Al aplicarlo en un
// StyleSheet usar `fontSize: TYPE_SCALE.body.size` o el helper textStyle().
// ============================================================================

export const FONT_FAMILY = {
  regular: 'Rajdhani_400Regular',
  medium: 'Rajdhani_500Medium',
  semiBold: 'Rajdhani_600SemiBold',
  bold: 'Rajdhani_700Bold',
};

export const TYPE_SCALE = {
  micro:   { size: 10, lineHeight: 14, fontFamily: FONT_FAMILY.regular,  letterSpacing: 0.8 },
  caption: { size: 12, lineHeight: 16, fontFamily: FONT_FAMILY.regular,  letterSpacing: 0.4 },
  label:   { size: 14, lineHeight: 20, fontFamily: FONT_FAMILY.medium,   letterSpacing: 0.2 },
  body:    { size: 16, lineHeight: 24, fontFamily: FONT_FAMILY.regular,  letterSpacing: 0   },
  h6:      { size: 18, lineHeight: 24, fontFamily: FONT_FAMILY.medium,   letterSpacing: -0.2},
  h5:      { size: 20, lineHeight: 28, fontFamily: FONT_FAMILY.semiBold, letterSpacing: -0.3},
  h4:      { size: 24, lineHeight: 32, fontFamily: FONT_FAMILY.semiBold, letterSpacing: -0.4},
  h3:      { size: 28, lineHeight: 36, fontFamily: FONT_FAMILY.bold,     letterSpacing: -0.5},
  h2:      { size: 32, lineHeight: 40, fontFamily: FONT_FAMILY.bold,     letterSpacing: -0.6},
  h1:      { size: 40, lineHeight: 48, fontFamily: FONT_FAMILY.bold,     letterSpacing: -1.0},
};

// Helper to get a flat StyleSheet-compatible text style
export function textStyle(level: keyof typeof TYPE_SCALE) {
  return TYPE_SCALE[level];
}
