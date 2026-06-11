// ============================================================================
// championImage.js — URLs canónicas + fallback offline para imágenes de
// campeones de League of Legends.
// ----------------------------------------------------------------------------
// El antiguo `splashUrl()` hardcodeado en
// ChampionPickScreen no tenía fallback → con CORS bloqueado o sin red
// los splash arts quedaban en blanco.
//
// Strategy de carga (en orden):
// 1. Splash CDN (`/img/champion/splash/{name}_0.jpg`)
// 2. Loading CDN (`/img/champion/loading/{name}_0.jpg`) — más pequeño
// 3. Placeholder SVG por rol (silueta + color de rol)
//
// El componente <ChampionImage/> orquesta los 3 niveles. Las funciones
// puras se exportan para poder testearlas y también para que otros
// componentes que solo necesitan la URL (no el render) las usen.
//
// TODO: cuando el backend exponga `/api/v1/champions/catalog` con metadatos
// (rol, splashUri firmada, etc.), reemplazar las URLs hardcodeadas por
// llamada a ese endpoint.
// ============================================================================

// Mapa name → role para resolver el placeholder sin pedir contexto al
// llamador. Cubre los 20 campeones del pool inicial (LoL-Research §16) y
// se puede extender. Si un campeón no está mapeado, fallback a SUPPORT.
export const CHAMPION_TO_ROLE = {
  // TOP
  Garen:   'TOP', Malphite: 'TOP', Darius:  'TOP', Shen:    'TOP',
  Fiora:   'TOP', Ornn:     'TOP',
  // JUNGLE
  Warwick: 'JUNGLE', Amumu:  'JUNGLE', LeeSin: 'JUNGLE', Graves: 'JUNGLE',
  Vi:      'JUNGLE',
  // MID
  Ahri:    'MID', Malzahar: 'MID', Katarina: 'MID', Yasuo: 'MID',
  Zed:     'MID', Ryze:     'MID',
  // ADC
  Jinx:    'ADC', Ashe:     'ADC', Caitlyn:  'ADC', MissFortune: 'ADC',
  Lucian:  'ADC',
  // SUPPORT
  Janna:   'SUPPORT', Lulu:    'SUPPORT', Thresh: 'SUPPORT', Leona: 'SUPPORT',
  Morgana: 'SUPPORT',
};

const CDN_BASE = 'https://ddragon.leagueoflegends.com/cdn';

// Excepciones donde el id canónico de Data Dragon NO coincide con el display
// name "sin espacios/apóstrofos" (las rutas del CDN son case-sensitive):
//   "Cho'Gath"  → strip da "ChoGath",  pero DD usa "Chogath"
//   "Kha'Zix"   → strip da "KhaZix",   pero DD usa "Khazix"
//   "Kai'Sa"    → strip da "KaiSa",    pero DD usa "Kaisa"
//   "Vel'Koz"   → strip da "VelKoz",   pero DD usa "Velkoz"
//   "Bel'Veth"  → strip da "BelVeth",  pero DD usa "Belveth"
//   "LeBlanc"   → DD usa "Leblanc"
//   "Wukong"    → DD usa "MonkeyKing" (id interno de Riot)
//   "Renata Glasc" / "RenataGlasc" → DD usa "Renata"
//   "Nunu & Willump" → DD usa "Nunu"
//   "Dr. Mundo" → strip da "DrMundo" (correcto, se incluye por claridad)
// Clave en minúsculas (lookup case-insensitive tras el strip).
const DDRAGON_ID_EXCEPTIONS = {
  chogath:      'Chogath',
  khazix:       'Khazix',
  kaisa:        'Kaisa',
  velkoz:       'Velkoz',
  belveth:      'Belveth',
  leblanc:      'Leblanc',
  wukong:       'MonkeyKing',
  renataglasc:  'Renata',
  nunuwillump:  'Nunu',
  nunu:         'Nunu',
  drmundo:      'DrMundo',
  fiddlesticks: 'Fiddlesticks',
  ksante:       'KSante',
};

/**
 * Normaliza un nombre al id que usa Data Dragon en sus rutas de imagen.
 * 1) Quita espacios, apóstrofos, puntos y '&' ("Miss Fortune" → "MissFortune").
 * 2) Aplica las excepciones donde el id de DD no es el strip directo
 *    ("Cho'Gath" → "Chogath", "Wukong" → "MonkeyKing", etc.), porque las
 *    rutas del CDN son case-sensitive y devolvían 403/404 → imagen en negro.
 */
export function normalizeChampionName(name) {
  if (!name) return '';
  const stripped = String(name).replace(/[\s.'’&]/g, '');
  return DDRAGON_ID_EXCEPTIONS[stripped.toLowerCase()] || stripped;
}

/** URL del splash art a tamaño completo (~1215×717). */
export function getChampionSplash(name) {
  return { uri: `${CDN_BASE}/img/champion/splash/${normalizeChampionName(name)}_0.jpg` };
}

// Base de CommunityDragon — su endpoint `/splash-art/centered` recompone el
// splash con el campeón CENTRADO en cuadro (a diferencia del splash crudo de
// Data Dragon, donde el personaje suele ir descentrado). Para un splash a
// pantalla completa en vertical, el cover centrado del arte centrado muestra al
// campeón bien encuadrado en web Y en nativo, sin necesitar objectPosition.
const CDRAGON_BASE = 'https://cdn.communitydragon.org/latest/champion';

/**
 * URL del splash CENTRADO (CommunityDragon). Pensado para fondos a pantalla
 * completa donde el splash crudo de Data Dragon quedaría descentrado al recortar
 * en formato vertical. Si CommunityDragon fallara, <ChampionImage/> cae al
 * splash normal de Data Dragon (getChampionSplash) y luego al loading.
 */
export function getChampionCenteredSplash(name) {
  return { uri: `${CDRAGON_BASE}/${normalizeChampionName(name)}/splash-art/centered` };
}

/** URL del loading screen (~308×560). Más pequeña, mejor fallback. */
export function getChampionLoading(name) {
  return { uri: `${CDN_BASE}/img/champion/loading/${normalizeChampionName(name)}_0.jpg` };
}

/**
 * Devuelve la información necesaria para renderizar el placeholder SVG
 * cuando ambos CDN fallan. Se usa con `<ChampionImage/>` o se puede
 * dibujar a mano con react-native-svg.
 *
 * Forma: { role, color, label }
 */
export function getChampionLocalFallback(name) {
  const role = CHAMPION_TO_ROLE[name] || 'SUPPORT';
  const color = ROLE_COLOR[role];
  return { role, color, label: name };
}

// Color de tinte por rol — coherente con la paleta usada en RoleQuizScreen.
const ROLE_COLOR = {
  TOP:     '#e74c3c',
  JUNGLE:  '#2ecc71',
  MID:     '#7B76DD',
  ADC:     '#f39c12',
  SUPPORT: '#00c8e0',
};
export { ROLE_COLOR };
