// ============================================================================
// roleAssets.js — Iconos SVG inline para los 5 roles de la grieta
// ----------------------------------------------------------------------------
// los roles aparecían como texto plano en RoleQuiz,
// ChampionPick, Profile, Hub. Ahora cada rol tiene su SVG inline propio.
//
// Cada entrada exporta un componente funcional que recibe `{ size, color }`
// y devuelve un <Svg> con `stroke={color}` para que se tiña con el color
// de facción del usuario activo.
//
// Diseño:
// TOP → espadas cruzadas (duelista 1v1)
// JUNGLE → garra (caza)
// MID → báculo de maga rodeado de glifos (mago/asesino)
// ADC → arco tensado (cañón a distancia)
// SUPPORT → escudo con cruz (guardián)
//
// Todos los iconos están centrados en un viewBox 32×32, con stroke-width 2
// para legibilidad a 24-48px. Si Designer pide mayor detalle, se reemplazan
// los paths sin tocar el componente RoleIcon.
// ============================================================================
import React from 'react';
import Svg, { Path, Circle, Line, G } from 'react-native-svg';

const VB = '0 0 32 32';

function TopIcon({ size = 32, color = '#fff' }) {
  return (
    <Svg width={size} height={size} viewBox={VB}>
      {/* Espadas cruzadas en X — guardamano + hojas */}
      <Line x1="6"  y1="6"  x2="26" y2="26" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
      <Line x1="26" y1="6"  x2="6"  y2="26" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
      {/* Pomos */}
      <Circle cx="6"  cy="6"  r="1.6" fill={color} />
      <Circle cx="26" cy="6"  r="1.6" fill={color} />
      {/* Cuerdas guardamano */}
      <Line x1="13" y1="13" x2="19" y2="19" stroke={color} strokeWidth="3" strokeLinecap="round" opacity="0.75" />
      <Line x1="19" y1="13" x2="13" y2="19" stroke={color} strokeWidth="3" strokeLinecap="round" opacity="0.75" />
    </Svg>
  );
}

function JungleIcon({ size = 32, color = '#fff' }) {
  return (
    <Svg width={size} height={size} viewBox={VB}>
      {/* Garra — 3 zarpas curvadas saliendo desde la base */}
      <Path d="M8 26 Q9 14 13 6"  fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" />
      <Path d="M16 28 Q16 14 16 4" fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" />
      <Path d="M24 26 Q23 14 19 6" fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" />
      {/* Punta de cada zarpa */}
      <Circle cx="13" cy="6" r="1.4" fill={color} />
      <Circle cx="16" cy="4" r="1.4" fill={color} />
      <Circle cx="19" cy="6" r="1.4" fill={color} />
    </Svg>
  );
}

function MidIcon({ size = 32, color = '#fff' }) {
  return (
    <Svg width={size} height={size} viewBox={VB}>
      {/* Báculo vertical */}
      <Line x1="16" y1="6" x2="16" y2="28" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
      {/* Cabeza orbital del báculo */}
      <Circle cx="16" cy="8" r="4" fill="none" stroke={color} strokeWidth="2" />
      <Circle cx="16" cy="8" r="1.5" fill={color} />
      {/* Glifos arcanos */}
      <Line x1="9"  y1="14" x2="11" y2="14" stroke={color} strokeWidth="1.6" strokeLinecap="round" opacity="0.7" />
      <Line x1="21" y1="14" x2="23" y2="14" stroke={color} strokeWidth="1.6" strokeLinecap="round" opacity="0.7" />
      {/* Empuñadura */}
      <Line x1="13" y1="28" x2="19" y2="28" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
    </Svg>
  );
}

function AdcIcon({ size = 32, color = '#fff' }) {
  return (
    <Svg width={size} height={size} viewBox={VB}>
      {/* Arco — semi-luna izquierda */}
      <Path d="M10 4 Q4 16 10 28" fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" />
      {/* Cuerda tensada */}
      <Line x1="10" y1="4"  x2="10" y2="28" stroke={color} strokeWidth="1.4" opacity="0.65" />
      {/* Flecha en el centro */}
      <Line x1="10" y1="16" x2="26" y2="16" stroke={color} strokeWidth="2" strokeLinecap="round" />
      {/* Punta de la flecha */}
      <Path d="M22 12 L26 16 L22 20" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {/* Plumas de la flecha */}
      <Line x1="11" y1="14" x2="13" y2="16" stroke={color} strokeWidth="1.4" opacity="0.7" />
      <Line x1="11" y1="18" x2="13" y2="16" stroke={color} strokeWidth="1.4" opacity="0.7" />
    </Svg>
  );
}

function SupportIcon({ size = 32, color = '#fff' }) {
  return (
    <Svg width={size} height={size} viewBox={VB}>
      {/* Escudo heráldico */}
      <Path
        d="M16 4 L26 8 L25 18 Q25 24 16 28 Q7 24 7 18 L6 8 Z"
        fill="none" stroke={color} strokeWidth="2.2" strokeLinejoin="round"
      />
      {/* Cruz interior */}
      <Line x1="16" y1="11" x2="16" y2="22" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
      <Line x1="11" y1="16" x2="21" y2="16" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
      {/* Punto central */}
      <Circle cx="16" cy="16" r="1.4" fill={color} />
    </Svg>
  );
}

export const ROLE_ICONS = {
  TOP:     TopIcon,
  JUNGLE:  JungleIcon,
  MID:     MidIcon,
  ADC:     AdcIcon,
  SUPPORT: SupportIcon,
};

// Star champion por rol (referencia para RoleConstellationScreen H2).
// TODO migrar a championsCatalog cuando Designer confirme el casting.
export const ROLE_STAR_CHAMPION = {
  TOP:     'Fiora',
  JUNGLE:  'LeeSin',
  MID:     'Ahri',
  ADC:     'Jinx',
  SUPPORT: 'Thresh',
};

// Tagline corto por rol — texto pequeño bajo el título en RoleDetailCard.
export const ROLE_TAGLINE = {
  TOP:     'Splitpush · Carry tardío',
  JUNGLE:  'Tempo · Objetivos · Ganks',
  MID:     'Roam · Burst · Influencia',
  ADC:     'DPS sostenido · Late game',
  SUPPORT: 'Visión · Peel · Engage',
};

// 3 mini stats hardcodeados para mostrar en la carta del rol.
// Forma: [{ label, value, color }]. El color es opcional para destacar
// stats clave (ej. CC% del support en verde positivo).
export const ROLE_STATS = {
  TOP: [
    { label: 'CC%',           value: '32%' },
    { label: 'DMG type',      value: 'AD/AP' },
    { label: 'Time-to-impact',value: '6:00' },
  ],
  JUNGLE: [
    { label: 'CC%',           value: '28%' },
    { label: 'DMG type',      value: 'Mixto' },
    { label: 'Time-to-impact',value: '3:30' },
  ],
  MID: [
    { label: 'CC%',           value: '22%' },
    { label: 'DMG type',      value: 'AP burst' },
    { label: 'Time-to-impact',value: '4:00' },
  ],
  ADC: [
    { label: 'CC%',           value: '8%' },
    { label: 'DMG type',      value: 'AD sost.' },
    { label: 'Time-to-impact',value: '12:00' },
  ],
  SUPPORT: [
    { label: 'CC%',           value: '54%' },
    { label: 'DMG type',      value: 'Utility' },
    { label: 'Time-to-impact',value: '2:00' },
  ],
};
