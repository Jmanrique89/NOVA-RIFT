// ============================================================================
// colors.ts — Tokens semánticos de color de NOVA RIFT.
// ----------------------------------------------------------------------------
// Paleta base: navy/púrpura/cian/oro sobre fondo oscuro. Derivada de los
// valores reales usados en la app (theme.js NEUTRAL_THEME + hex repetidos en
// pantallas): #07070d (fondo), #7B76DD (acento púrpura, el más usado),
// #E8E4FF (texto), #FFD700 (oro), #4CAF50 (éxito), #00C8E0 (cian/info).
//
// Las facciones (theme.js) siguen siendo el TINTE de acento por usuario; estos
// tokens son la capa SEMÁNTICA neutra y estable que no cambia entre facciones.
//
// ── Contraste WCAG 2.1 (sobre bg0 #07070d salvo nota) ───────────────────────
// AA exige 4.5:1 (texto normal) / 3:1 (texto grande ≥18px o ≥14px bold).
// textPrimary #E8E4FF / bg0 ≈ 16.2 : 1 AAA
// textSecondary 70% lavanda ≈ 7.5 : 1 AA (normal) / AAA (grande)
// textMuted 45% lavanda ≈ 3.6 : 1 AA solo texto grande
// textDisabled 30% lavanda ≈ 2.3 : 1 decorativo / estados inactivos
// primary #7B76DD / bg0 ≈ 5.2 : 1 AA (normal)
// success #4CAF50 / bg0 ≈ 6.4 : 1 AA
// error #FF5252 / bg0 ≈ 5.1 : 1 AA
// warning #FFB300 / bg0 ≈ 9.8 : 1 AAA
// gold #FFD700 / bg0 ≈ 13.4 : 1 AAA
// textInverse (#07070d) se usa SOBRE superficies claras (oro/cian), no sobre bg.
// ============================================================================

// Re-export de la capa BASE de tokens (tokens.js) para que quien importe desde
// colors.ts tenga acceso a la paleta primitiva (#0a0a14, etc.) sin tener que
// alcanzar tokens.js directamente. Los tokens semánticos de abajo la EXTIENDEN.
export { COLORS as TOKEN_COLORS } from './tokens';

export const COLORS = {
  // ── Backgrounds (de más oscuro a más claro) ───────────────────────────────
  bg0: '#07070d', // fondo base de la app (NovaBackground) — el más oscuro
  bg1: '#0a0a14', // contenedores a nivel raíz
  bg2: '#0d1117', // cards / secciones
  bg3: '#111827', // celdas internas / filas alternas

  // ── Surfaces (capas de glassmorphism translúcidas) ────────────────────────
  surface:         'rgba(255,255,255,0.04)', // panel base sobre el fondo
  surfaceElevated: 'rgba(255,255,255,0.07)', // modales, popovers, estados hover
  surfaceBorder:   'rgba(123,118,221,0.20)', // borde sutil púrpura

  // ── Primary (púrpura de marca) ─────────────────────────────────────────────
  primary:      '#7B76DD',
  primaryLight: '#9C98F0',
  primaryDark:  '#5B57B0',

  // ── Gold (acento secundario — rangos, premium, destacados) ─────────────────
  gold:      '#FFD700',
  goldLight: '#FDD835',
  goldDark:  '#D4AF37',

  // ── Cian (acento terciario — datos en vivo, links, info) ───────────────────
  cyan: '#00C8E0',

  // ── Texto ──────────────────────────────────────────────────────────────────
  textPrimary:   '#E8E4FF',                 // titulares y cuerpo principal
  textSecondary: 'rgba(232,228,255,0.70)',  // texto de apoyo
  textMuted:     'rgba(232,228,255,0.45)',  // metadatos, hints (solo grande)
  textDisabled:  'rgba(232,228,255,0.30)',  // estados inactivos / placeholder
  textInverse:   '#07070d',                 // texto sobre superficies claras

  // ── Estado (semáforo + variante light para fondos translúcidos) ────────────
  success:      '#4CAF50',
  successLight: 'rgba(76,175,80,0.15)',
  warning:      '#FFB300',
  warningLight: 'rgba(255,179,0,0.15)',
  error:        '#FF5252',
  errorLight:   'rgba(255,82,82,0.15)',
  info:         '#00C8E0',
  infoLight:    'rgba(0,200,224,0.15)',

  // ── Transparencias ─────────────────────────────────────────────────────────
  overlay: 'rgba(7,7,13,0.72)',  // backdrop de modales (tinte del fondo base)
  scrim:   'rgba(0,0,0,0.55)',   // degradado de legibilidad sobre imágenes

  // ── Colores de rol (la grieta) ─────────────────────────────────────────────
  // `text` = color de marca del rol; `bg` = chip/badge translúcido a juego.
  // BOT === ADC (carry a distancia). Se mantiene `ADC` como alias.
  role: {
    TOP:     { text: '#E5544E', bg: 'rgba(229,84,78,0.14)'  }, // duelista — carmesí
    JUNGLE:  { text: '#4CAF50', bg: 'rgba(76,175,80,0.14)'  }, // caza — verde
    MID:     { text: '#9C98F0', bg: 'rgba(156,152,240,0.14)'}, // mago — púrpura
    BOT:     { text: '#FFB300', bg: 'rgba(255,179,0,0.14)'  }, // carry — ámbar
    ADC:     { text: '#FFB300', bg: 'rgba(255,179,0,0.14)'  }, // alias de BOT
    SUPPORT: { text: '#00C8E0', bg: 'rgba(0,200,224,0.14)'  }, // guardián — cian
  },

  // ── Colores de tier (rangos de LoL) ────────────────────────────────────────
  // `main` espejea tierColor() en HubScreen; `bg` es el chip translúcido.
  tier: {
    IRON:        { main: '#8B8B8B', bg: 'rgba(139,139,139,0.14)' },
    BRONZE:      { main: '#CD7F32', bg: 'rgba(205,127,50,0.14)'  },
    SILVER:      { main: '#A8A9AD', bg: 'rgba(168,169,173,0.14)' },
    GOLD:        { main: '#FFD700', bg: 'rgba(255,215,0,0.14)'   },
    PLATINUM:    { main: '#00E1CB', bg: 'rgba(0,225,203,0.14)'   },
    EMERALD:     { main: '#00D45F', bg: 'rgba(0,212,95,0.14)'    },
    DIAMOND:     { main: '#00C6FF', bg: 'rgba(0,198,255,0.14)'   },
    MASTER:      { main: '#7B76DD', bg: 'rgba(123,118,221,0.14)' },
    GRANDMASTER: { main: '#FF4E50', bg: 'rgba(255,78,80,0.14)'   },
    CHALLENGER:  { main: '#E8C64B', bg: 'rgba(232,198,75,0.14)'  },
  },
};

// ============================================================================
// Exports PLANOS del design system (rol / tier / estados semánticos).
// ----------------------------------------------------------------------------
// ROLE_COLORS y TIER_COLORS exponen UN hex canónico por entrada — la paleta
// documentada del sistema de diseño (base Tailwind 500). Conviven con los mapas
// `COLORS.role` / `COLORS.tier` (objetos {main,bg}) que el runtime ya consume
// (p. ej. HubScreen.tierColor()); estos son la capa estable y plana de tokens.
// ============================================================================

// ── Colores de rol (la grieta) ───────────────────────────────────────────────
// BOT es alias de ADC (carry a distancia) para compatibilidad con el runtime.
export const ROLE_COLORS = {
  TOP:     '#8B5CF6', // violeta
  JUNGLE:  '#22C55E', // verde
  MID:     '#EAB308', // ámbar
  ADC:     '#EF4444', // rojo
  BOT:     '#EF4444', // alias de ADC
  SUPPORT: '#3B82F6', // azul
} as const;

// ── Colores de tier (rangos de LoL) ──────────────────────────────────────────
export const TIER_COLORS = {
  IRON:        '#94A3B8',
  BRONZE:      '#B45309',
  SILVER:      '#94A3B8',
  GOLD:        '#EAB308',
  PLATINUM:    '#22D3EE',
  EMERALD:     '#10B981',
  DIAMOND:     '#818CF8',
  MASTER:      '#C084FC',
  GRANDMASTER: '#F97316',
  CHALLENGER:  '#E2E8F0',
} as const;

// ── Estados semánticos (par fg + bg) ─────────────────────────────────────────
// `fg` cumple WCAG 2.1 AA (≥4.5:1 texto normal) sobre bg_primary '#0a0a14';
// `bg` es el relleno translúcido a juego para chips/badges/banners.
// success #22C55E ≈ 8.6:1 warning #EAB308 ≈ 9.9:1
// error #EF4444 ≈ 5.1:1 info #3B82F6 ≈ 5.3:1 neutral #E2E8F0 AAA
export const SEMANTIC = {
  success: { fg: '#22C55E', bg: 'rgba(34,197,94,0.15)'   },
  warning: { fg: '#EAB308', bg: 'rgba(234,179,8,0.15)'   },
  error:   { fg: '#EF4444', bg: 'rgba(239,68,68,0.15)'   },
  info:    { fg: '#3B82F6', bg: 'rgba(59,130,246,0.15)'  },
  neutral: { fg: '#E2E8F0', bg: 'rgba(226,232,240,0.10)' },
} as const;
