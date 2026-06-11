// ============================================================================
// theme.js — facciones LoL como TONO de acento, no como fondo base.
// ----------------------------------------------------------------------------
// El campo `background` está unificado a '#07070d' en las 4 facciones porque
// el fondo base de la app es siempre el mismo (LoginScreen es la referencia).
// El color de facción se usa como `primary`/`accent`/`glow` para acentos
// puntuales — nunca como tinte de pantalla completa.
//
// NEUTRAL_THEME — tema púrpura sin facción, para pantallas previas a la
// elección de facción (Login, Register, Welcome, RoleConstellation,
// PlaystyleTest, ChampionPick, ChampionQuiz, ChampSelectHelper). Las
// facciones SOLO deben pintar FactionScreen, HubScreen (perfil) y el
// RoleSelectionMap del onboarding.
// ============================================================================
// Rajdhani — fuente condensada/futurista para gaming/tech (cargada en App.js
// vía @expo-google-fonts/rajdhani + useFonts). El nombre 'Rajdhani_600SemiBold'
// es el alias canónico que registra useFonts; usarlo tal cual en fontFamily.
export const NEUTRAL_THEME = {
  name: 'Neutral',
  background: '#07070d',
  surface: 'rgba(255,255,255,0.04)',
  primary: '#7B76DD',
  text: '#E8E4FF',
  accent: '#9C98F0',
  glow: 'rgba(123,118,221,0.25)',
  fontFamily: 'Rajdhani_600SemiBold',
  fontFamilyBold: 'Rajdhani_700Bold',
  fontFamilyRegular: 'Rajdhani_400Regular',
};

// NO hay facciones de cara al
// usuario — diseño uniforme. Cada tema conserva su paleta (estética) pero lo
// que la UI muestra es `identity` (alias neutro por color), nunca `name`.
// `name` se conserva solo como clave interna/compat — NO renderizar.
export const FACTIONS = {
  ZAUN: {
    name: 'Zaun',
    identity: 'Esmeralda',
    background: '#07070d',
    surface: '#17332A',
    primary: '#00FF88',
    text: '#E0FFFA',
    accent: '#4CAF50',
    glow: 'rgba(0,255,136,0.3)',
  },
  DEMACIA: {
    name: 'Demacia',
    identity: 'Dorada',
    background: '#07070d',
    surface: '#0A323C',
    primary: '#C8AA6E',
    text: '#F0E6D2',
    accent: '#0AC8B9',
    glow: 'rgba(200,170,110,0.3)',
  },
  NOXUS: {
    name: 'Noxus',
    identity: 'Carmesí',
    background: '#07070d',
    surface: '#220000',
    primary: '#E53935',
    text: '#FFFFFF',
    accent: '#FF0000',
    glow: 'rgba(229,57,53,0.3)',
  },
  IONIA: {
    name: 'Ionia',
    identity: 'Aurora',
    background: '#07070d',
    surface: '#2D1B4E',
    primary: '#D81B60',
    text: '#FFD7F4',
    accent: '#9C27B0',
    glow: 'rgba(216,27,96,0.3)',
  }
};

export const currentTheme = NEUTRAL_THEME;
