// ============================================================================
// ThemeContext — modo claro / oscuro de la app (aditivo, no invasivo)
// ----------------------------------------------------------------------------
// accesibilidad y preferencia de usuario. Añade un toggle
// claro/oscuro SIN tocar la identidad de marca: el acento púrpura (#7B76DD) y
// los colores de rol/tier se conservan en ambos modos. Lo único que cambia son
// las SUPERFICIES neutras (fondo, tarjetas, texto, bordes).
//
// Por qué un contexto APARTE de RiotContext:
// RiotContext.theme lo consume CASI TODA la app, incluido el HUD de partida
// (LiveScreen/InGameHUD) y el modal de campeón, que por decisión de diseño se
// mantienen SIEMPRE en oscuro (legibilidad junto al cliente de LoL en plena
// partida). Si tematizáramos RiotContext.theme, el HUD también cambiaría. En
// su lugar, las pantalla que SÍ se tematizan (Hub, Profile, tab bar, fondo
// global) leen los tokens `colors` de ESTE contexto. Así el cambio es local
// y reversible, y el HUD queda intacto.
//
// API expuesta:
// mode → 'dark' | 'light' (default 'dark')
// isDark → boolean de conveniencia
// colors → tokens de superficie del modo activo (ver TOKENS abajo)
// toggleTheme()→ alterna dark<->light y persiste en AsyncStorage
// setMode(m) → fija un modo concreto
//
// Persistencia: AsyncStorage key `novarift_theme`. Mismo patrón que
// UserContext (carga en arranque, escritura silenciosa que no rompe si falla).
// ============================================================================
import React, {
  createContext, useCallback, useContext, useEffect, useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Clave de persistencia (consistente con el resto: `novarift_*`).
export const THEME_STORAGE_KEY = 'novarift_theme';

// ── Interruptor de disponibilidad del modo claro ────────────────────────────
// El modo claro SOLO es coherente cuando TODAS las pantallas out-of-game
// (Hub, Forge, Perfil) consumen `colors` del tema. Hasta entonces dejamos la
// app fija en OSCURO para evitar el efecto "barra inferior clara sobre app
// oscura". Cuando las pantallas estén migradas a la paleta, poner en `true` y
// el toggle + la persistencia vuelven a funcionar sin tocar nada más.
//
// DECISIÓN v4 (entrega 12-jun): el modo claro se DESCARTA para la entrega. Las
// pantallas de login/registro/onboarding y la animación de carga no son legibles
// en claro (texto blanco/gris sobre fondo claro) y rehacerlas a pocos días de la
// entrega añade riesgo sin sumar valor. Forzamos OSCURO coherente (flag en false)
// y ocultamos el toggle en Perfil. Para reactivar el claro: volver a poner true.
export const LIGHT_MODE_READY = false;

// El acento de identidad NO cambia entre modos (es la marca NOVA RIFT).
// Se expone dentro de `colors.accent` para que las pantallas tengan el púrpura
// disponible desde el mismo objeto de tokens.
const BRAND_ACCENT       = '#7B76DD';
const BRAND_ACCENT_LIGHT = '#9C98F0';

// ── Tokens de superficie por modo ───────────────────────────────────────────
// DARK reproduce los valores que la app ya usaba (theme.js NEUTRAL_THEME +
// colors.ts): fondo #07070d, texto #E8E4FF, surface translúcida clara sobre
// oscuro, etc. LIGHT es la paleta clara coherente pedida en el brief.
// Colores de MARCA — IDÉNTICOS en ambos modos (identidad NOVA RIFT). Solo las
// superficies/textos neutros cambian entre claro y oscuro ("cada color con su
// equivalente según el tema": los neutros tienen variante; los de marca no).
const BRAND = {
  primary:      BRAND_ACCENT,
  primaryLight: BRAND_ACCENT_LIGHT,
  primaryDark:  '#5B57B0',
  accent:       BRAND_ACCENT,
  accentLight:  BRAND_ACCENT_LIGHT,
  gold:      '#FFD700',
  goldLight: '#FDD835',
  goldDark:  '#D4AF37',
  cyan:      '#00C8E0',
  info:      '#00C8E0',
  infoLight: 'rgba(0,200,224,0.15)',
  success:      '#4CAF50',
  successLight: 'rgba(76,175,80,0.15)',
  warning:      '#FFB300',
  warningLight: 'rgba(255,179,0,0.15)',
  error:      '#FF5252',
  errorLight: 'rgba(255,82,82,0.15)',
  textInverse: '#07070d', // texto sobre superficies de marca (oro/cian): oscuro en ambos modos
};

// ── Tokens de superficie por modo ───────────────────────────────────────────
// Claves alineadas 1:1 con theme/colors.ts, para que cualquier pantalla que hoy
// use COLORS.<clave> pueda leer colors.<clave> del tema sin renombrar nada.
// DARK = valores actuales de la app. LIGHT = el equivalente claro de cada neutro.
const TOKENS = {
  dark: {
    ...BRAND,
    // backgrounds (de más oscuro a más claro)
    bg0: '#07070d', bg1: '#0a0a14', bg2: '#0d1117', bg3: '#111827',
    // surfaces (glassmorphism translúcido sobre oscuro)
    surface:         'rgba(255,255,255,0.04)',
    surfaceElevated: 'rgba(255,255,255,0.07)',
    surfaceBorder:   'rgba(123,118,221,0.20)',
    // texto
    textPrimary:   '#E8E4FF',
    textSecondary: 'rgba(232,228,255,0.70)',
    textMuted:     'rgba(232,228,255,0.45)',
    textDisabled:  'rgba(232,228,255,0.30)',
    // transparencias
    overlay: 'rgba(7,7,13,0.72)',
    scrim:   'rgba(0,0,0,0.55)',
    // neutro-sobre-superficie: las pantallas usan muchos literales blancos
    // translúcidos (texto/bordes secundarios). En OSCURO esto devuelve el MISMO
    // blanco translúcido → idéntico pixel a pixel a los literales actuales; en
    // CLARO devuelve navy translúcido (mismo base que textPrimary claro). Permite
    // tematizar esos literales sin alterar el modo oscuro.
    onSurface: (a) => `rgba(255,255,255,${a})`,
    // alias de compatibilidad (claves genéricas que ya consumía la barra de tabs)
    bg: '#07070d', surfaceAlt: 'rgba(255,255,255,0.07)',
    text: '#E8E4FF', border: 'rgba(123,118,221,0.20)',
  },
  light: {
    ...BRAND,
    // gold/amber LEGIBLE como texto sobre fondo claro: el dorado #FFD700 brilla
    // sobre oscuro pero se "lava" sobre claro (contraste ~1.4:1). Lo oscurecemos
    // a un ámbar legible SOLO en modo claro; en oscuro se mantiene BRAND (#FFD700).
    gold: '#8a6a00', goldLight: '#a07d00', goldDark: '#6e5500',
    // backgrounds — equivalentes claros
    bg0: '#F4F5FB', bg1: '#ECEDF6', bg2: '#FFFFFF', bg3: '#F0F1F8',
    // surfaces — sólidas claras
    surface:         '#FFFFFF',
    surfaceElevated: '#ECEDF6',
    surfaceBorder:   'rgba(91,87,176,0.28)',
    // texto — navy sobre claro
    textPrimary:   '#1A1830',
    textSecondary: 'rgba(26,24,48,0.72)',
    textMuted:     'rgba(26,24,48,0.50)',
    textDisabled:  'rgba(26,24,48,0.32)',
    // transparencias
    overlay: 'rgba(244,245,251,0.82)',
    scrim:   'rgba(0,0,0,0.30)',
    // neutro-sobre-superficie (equivalente claro): navy translúcido sobre fondo
    // claro, mismo base RGB que textPrimary (#1A1830 → 26,24,48). Espeja en claro
    // lo que en oscuro eran los literales rgba(255,255,255,a).
    onSurface: (a) => `rgba(26,24,48,${a})`,
    // alias de compatibilidad
    bg: '#F4F5FB', surfaceAlt: '#ECEDF6',
    text: '#1A1830', border: '#E2E2EC',
  },
};

export const ThemeContext = createContext({
  mode:        'dark',
  isDark:      true,
  colors:      TOKENS.dark,
  toggleTheme: () => {},
  setMode:     () => {},
});

export function ThemeProvider({ children }) {
  // Default 'dark' — la app nace oscura; solo cambia si el usuario lo decide o
  // si había una preferencia guardada.
  const [mode, setModeState] = useState('dark');

  // Carga la preferencia persistida al arrancar. Si no hay nada o falla la
  // lectura, nos quedamos en 'dark' sin romper el arranque.
  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (stored === 'light' || stored === 'dark') {
          // Mientras LIGHT_MODE_READY sea false forzamos oscuro: así la barra de
          // tabs y todo lo que lee el tema quedan coherentes con la app oscura.
          setModeState(LIGHT_MODE_READY ? stored : 'dark');
        }
      } catch (_) {
        // AsyncStorage no disponible — modo por defecto.
      }
    })();
  }, []);

  // Persiste el modo (escritura silenciosa: si falla, la app sigue funcionando
  // con el estado en memoria).
  const persist = useCallback(async (next) => {
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, next);
    } catch (_) {
      // best-effort, igual que el resto de escrituras de la app.
    }
  }, []);

  const setMode = useCallback((next) => {
    const value = (LIGHT_MODE_READY && next === 'light') ? 'light' : 'dark';
    setModeState(value);
    persist(value);
  }, [persist]);

  const toggleTheme = useCallback(() => {
    setModeState((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      const value = LIGHT_MODE_READY ? next : 'dark';
      persist(value);
      return value;
    });
  }, [persist]);

  const isDark = mode === 'dark';
  const colors = TOKENS[mode] || TOKENS.dark;

  return (
    <ThemeContext.Provider value={{ mode, isDark, colors, toggleTheme, setMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

/** Hook rápido. Uso: const { colors, mode, toggleTheme } = useTheme(); */
export const useTheme = () => useContext(ThemeContext);

// Export de los tokens crudos por si algún StyleSheet estático necesita el set
// (p. ej. para valores por defecto). El runtime debe preferir useTheme().colors.
export const THEME_TOKENS = TOKENS;
