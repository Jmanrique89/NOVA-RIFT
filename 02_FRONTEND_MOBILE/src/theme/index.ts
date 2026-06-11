// ============================================================================
// theme/index.ts — Barrel de la capa de design tokens de NOVA RIFT.
// ----------------------------------------------------------------------------
// Punto de entrada único. Importar siempre desde aquí:
// import { COLORS, TYPE_SCALE, SPACING, RADIUS, BORDER, SHADOW } from '../theme';
//
// Capa SEMÁNTICA (canónica, la que consumen las pantallas):
// typography.ts → FONT_FAMILY, TYPE_SCALE, textStyle
// colors.ts → COLORS, ROLE_COLORS, TIER_COLORS, SEMANTIC
// spacing.ts → SPACING, RADIUS, BORDER, SHADOW
//
// Capa BASE (tokens.js, primitivos): se re-exporta con alias para que la capa
// semántica gane en COLORS/SPACING/RADIUS y no haya colisión de nombres.
// tokens.js → TOKEN_COLORS, TOKEN_SPACING, TOKEN_RADIUS, FONT_SIZE
// ============================================================================

export { FONT_FAMILY, TYPE_SCALE, textStyle } from './typography';
export { COLORS, TOKEN_COLORS, ROLE_COLORS, TIER_COLORS, SEMANTIC } from './colors';
export { SPACING, RADIUS, BORDER, SHADOW } from './spacing';

// Capa base de tokens.js (alias para evitar colisión con la capa semántica).
export {
  SPACING as TOKEN_SPACING,
  RADIUS as TOKEN_RADIUS,
  FONT_SIZE,
} from './tokens';
