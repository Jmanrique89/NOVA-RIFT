// ============================================================================
// NOVA RIFT Design Tokens — fuente única de verdad para colores, espaciados,
// radios y tamaños tipográficos. Importar desde aquí en lugar de usar valores
// literales dispersos por los componentes.
// ============================================================================

export const COLORS = {
  // ── Backgrounds ────────────────────────────────────────────────────────────
  bg_primary:    '#0a0a14',
  bg_card:       '#0d1117',
  bg_card_alt:   '#111827',

  // ── Accents ────────────────────────────────────────────────────────────────
  accent_cyan:   '#7B76DD',
  accent_cyan_2: '#7B76DD',
  accent_gold:   '#FFD700',

  // ── Semánticos ─────────────────────────────────────────────────────────────
  danger:        '#ff4444',
  warning:       '#ff9900',
  success:       '#7B76DD',

  // ── Texto ──────────────────────────────────────────────────────────────────
  text_primary:   '#ffffff',
  text_secondary: 'rgba(255,255,255,0.65)',
  text_muted:     'rgba(255,255,255,0.35)',

  // ── Bordes ─────────────────────────────────────────────────────────────────
  border_cyan_subtle: 'rgba(123,118,221,0.2)',
  border_cyan_active: 'rgba(123,118,221,0.5)',
  border_gold:        'rgba(255,215,0,0.3)',
};

export const SPACING = {
  xs:   4,
  sm:   8,
  md:   12,
  lg:   16,
  xl:   20,
  xxl:  24,
  xxxl: 32,
};

export const RADIUS = {
  sm:   4,
  md:   8,
  lg:   12,
  pill: 20,
};

export const FONT_SIZE = {
  xs:   9,
  sm:   11,
  base: 13,
  md:   15,
  lg:   18,
  xl:   22,
  xxl:  28,
  hero: 36,
};
