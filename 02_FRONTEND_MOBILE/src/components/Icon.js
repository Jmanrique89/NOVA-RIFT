// ============================================================================
// Icon — set de iconos SVG inline tipo Lucide
// ----------------------------------------------------------------------------
// Sustituye los iconos del SO que rompían la estética gaming pro.
// Cada icono es un componente <Svg> de react-native-svg con stroke vectorial,
// consistente entre Windows/Mac/Linux/web. Color hereda del prop `color`.
//
// Uso:
// <Icon name="bolt" size={14} color="#39ff94" />
// <Icon name="kda" size={18} color={theme.primary} />
// ============================================================================
import React from 'react';
import Svg, { Path, Circle, Polyline, Polygon, Line } from 'react-native-svg';

const ICONS = {
  // ─── Métricas ─────────────────────────────────────────────────────────
  // KDA — espadas cruzadas
  kda: (color, w) => (
    <>
      <Path d="M14.5 17.5L3 6V3h3l11.5 11.5" stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Line x1="13" y1="19" x2="19" y2="13" stroke={color} strokeWidth={w} strokeLinecap="round" />
      <Line x1="16" y1="16" x2="20" y2="20" stroke={color} strokeWidth={w} strokeLinecap="round" />
      <Line x1="19" y1="21" x2="21" y2="19" stroke={color} strokeWidth={w} strokeLinecap="round" />
    </>
  ),
  // Vision Score — ojo
  eye: (color, w) => (
    <>
      <Path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z" stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Circle cx={12} cy={12} r={3} stroke={color} strokeWidth={w} fill="none" />
    </>
  ),
  // CS/Farm — moneda
  coin: (color, w) => (
    <>
      <Circle cx={12} cy={12} r={9} stroke={color} strokeWidth={w} fill="none" />
      <Path d="M9 9h6M9 12h6M9 15h6" stroke={color} strokeWidth={w} strokeLinecap="round" />
    </>
  ),
  // KP — espadas cruzadas
  swords: (color, w) => (
    <>
      <Polyline points="14.5,17.5 3,6 3,3 6,3 17.5,14.5" stroke={color} strokeWidth={w} fill="none" strokeLinejoin="round" />
      <Line x1="13" y1="19" x2="19" y2="13" stroke={color} strokeWidth={w} strokeLinecap="round" />
      <Line x1="16" y1="16" x2="20" y2="20" stroke={color} strokeWidth={w} strokeLinecap="round" />
      <Line x1="19" y1="21" x2="21" y2="19" stroke={color} strokeWidth={w} strokeLinecap="round" />
      <Polyline points="14.5,6.5 18,3 21,3 21,6 17.5,9.5" stroke={color} strokeWidth={w} fill="none" strokeLinejoin="round" />
      <Line x1="5" y1="14" x2="9" y2="18" stroke={color} strokeWidth={w} strokeLinecap="round" />
      <Line x1="7" y1="17" x2="4" y2="20" stroke={color} strokeWidth={w} strokeLinecap="round" />
      <Line x1="3" y1="19" x2="5" y2="21" stroke={color} strokeWidth={w} strokeLinecap="round" />
    </>
  ),
  // ─── UI ───────────────────────────────────────────────────────────────
  // Bolt — tip / rayo
  bolt: (color, w) => (
    <Polygon points="13,2 3,14 12,14 11,22 21,10 12,10" stroke={color} strokeWidth={w} fill="none" strokeLinejoin="round" />
  ),
  // Shield — defensa
  shield: (color, w) => (
    <Path d="M12 2L4 5v6.5c0 4.5 3.5 8.5 8 9.5 4.5-1 8-5 8-9.5V5L12 2z" stroke={color} strokeWidth={w} strokeLinejoin="round" fill="none" />
  ),
  // Target — objetivo
  target: (color, w) => (
    <>
      <Circle cx={12} cy={12} r={9} stroke={color} strokeWidth={w} fill="none" />
      <Circle cx={12} cy={12} r={5} stroke={color} strokeWidth={w} fill="none" />
      <Circle cx={12} cy={12} r={1.5} fill={color} />
    </>
  ),
  // Brain — IA / razonamiento
  brain: (color, w) => (
    <>
      <Path d="M9 4a3 3 0 00-3 3v1a3 3 0 00-3 3v2a3 3 0 002 2.8V18a3 3 0 003 3 3 3 0 003-3v-1" stroke={color} strokeWidth={w} fill="none" strokeLinecap="round" />
      <Path d="M15 4a3 3 0 013 3v1a3 3 0 013 3v2a3 3 0 01-2 2.8V18a3 3 0 01-3 3 3 3 0 01-3-3v-1" stroke={color} strokeWidth={w} fill="none" strokeLinecap="round" />
      <Line x1="12" y1="4" x2="12" y2="20" stroke={color} strokeWidth={w} strokeLinecap="round" />
    </>
  ),
  // Trophy — rango / win
  trophy: (color, w) => (
    <>
      <Path d="M7 4h10v3a5 5 0 11-10 0V4z" stroke={color} strokeWidth={w} fill="none" strokeLinejoin="round" />
      <Path d="M7 7H4a2 2 0 002 2h1M17 7h3a2 2 0 01-2 2h-1" stroke={color} strokeWidth={w} fill="none" />
      <Line x1="9" y1="20" x2="15" y2="20" stroke={color} strokeWidth={w} strokeLinecap="round" />
      <Line x1="12" y1="15" x2="12" y2="20" stroke={color} strokeWidth={w} strokeLinecap="round" />
    </>
  ),
  // Crown — top pick
  crown: (color, w) => (
    <Polygon points="3,18 5,8 9,12 12,4 15,12 19,8 21,18" stroke={color} strokeWidth={w} fill="none" strokeLinejoin="round" />
  ),
  // Spark — destacado
  spark: (color, w) => (
    <Polygon points="12,2 14,10 22,12 14,14 12,22 10,14 2,12 10,10" stroke={color} strokeWidth={w} fill="none" strokeLinejoin="round" />
  ),
  // Faction — emblema hexagonal genérico
  faction: (color, w) => (
    <Polygon points="12,3 21,7.5 21,16.5 12,21 3,16.5 3,7.5" stroke={color} strokeWidth={w} fill="none" strokeLinejoin="round" />
  ),
  // Search — lupa para inputs de búsqueda
  search: (color, w) => (
    <>
      <Circle cx={11} cy={11} r={7} stroke={color} strokeWidth={w} fill="none" />
      <Line x1={16.5} y1={16.5} x2={21} y2={21} stroke={color} strokeWidth={w} strokeLinecap="round" />
    </>
  ),
  // Warning — triángulo de aviso
  warn: (color, w) => (
    <>
      <Polygon points="12,3 22,20 2,20" stroke={color} strokeWidth={w} fill="none" strokeLinejoin="round" />
      <Line x1={12} y1={9} x2={12} y2={14} stroke={color} strokeWidth={w} strokeLinecap="round" />
      <Circle cx={12} cy={17} r={0.9} fill={color} />
    </>
  ),
  // Flash — versión rayo limpia
  flash: (color, w) => (
    <Polygon points="13,2 4,14 11,14 10,22 20,9 13,9" stroke={color} strokeWidth={w} fill="none" strokeLinejoin="round" />
  ),
  // Thumbs up/down — feedback de recomendaciones de IA (DIN2-UD5)
  thumbsUp: (color, w) => (
    <>
      <Path d="M7 10v11" stroke={color} strokeWidth={w} strokeLinecap="round" />
      <Path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z"
            stroke={color} strokeWidth={w} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  thumbsDown: (color, w) => (
    <>
      <Path d="M17 14V3" stroke={color} strokeWidth={w} strokeLinecap="round" />
      <Path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88Z"
            stroke={color} strokeWidth={w} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  // ─── Emblemas heráldicos por facción ────────────────────────────────────
  // Zaun — biohazard estilizado (3 hojas + núcleo, símbolo químico)
  factionZaun: (color, w) => (
    <>
      <Circle cx={12} cy={12} r={10} stroke={color} strokeWidth={w} fill="none" />
      <Circle cx={12} cy={12} r={2.2} fill={color} />
      <Path d="M12 2.5 a3.5 3.5 0 0 1 3 5.2 L12 10 Z" fill={color} opacity="0.85" />
      <Path d="M21 14 a3.5 3.5 0 0 1 -5.7 1.6 L13.5 12.7 Z" fill={color} opacity="0.85" />
      <Path d="M3 14 a3.5 3.5 0 0 0 5.7 1.6 L10.5 12.7 Z" fill={color} opacity="0.85" />
    </>
  ),
  // Demacia — alas + corona (justicia, ascensión)
  factionDemacia: (color, w) => (
    <>
      <Path d="M12 4 L8 8 L4 7 L7 12 L4 14 L9 14 L12 19 L15 14 L20 14 L17 12 L20 7 L16 8 Z"
            stroke={color} strokeWidth={w} fill="none" strokeLinejoin="round" />
      <Circle cx={12} cy={12} r={1.5} fill={color} />
    </>
  ),
  // Noxus — espadas cruzadas con halo (conquista, fuerza)
  factionNoxus: (color, w) => (
    <>
      <Polygon points="12,2 13,7 18,8 13,9 12,14 11,9 6,8 11,7" fill={color} opacity="0.4" />
      <Line x1={5} y1={5} x2={19} y2={19} stroke={color} strokeWidth={w + 0.6} strokeLinecap="round" />
      <Line x1={19} y1={5} x2={5} y2={19} stroke={color} strokeWidth={w + 0.6} strokeLinecap="round" />
      <Circle cx={12} cy={12} r={2.5} fill={color} />
    </>
  ),
  // Ionia — enso zen (círculo abierto, equilibrio espiritual)
  factionIonia: (color, w) => (
    <>
      <Path d="M19.5 12 a7.5 7.5 0 1 1 -3 -6"
            stroke={color} strokeWidth={w + 0.8} fill="none" strokeLinecap="round" />
      <Circle cx={17.5} cy={6.5} r={1.5} fill={color} />
      <Circle cx={12} cy={12} r={1.2} fill={color} opacity="0.6" />
    </>
  ),
};

export default function Icon({ name, size = 16, color = '#39ff94', strokeWidth = 1.8, style }) {
  const renderer = ICONS[name];
  if (!renderer) {
    // Fallback: un círculo neutro si el nombre es desconocido
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
        <Circle cx={12} cy={12} r={4} fill={color} />
      </Svg>
    );
  }
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
      {renderer(color, strokeWidth)}
    </Svg>
  );
}
