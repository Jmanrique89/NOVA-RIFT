// ============================================================================
// RoleSelectionMap — minimapa de la Grieta con zonas pulsables
// ----------------------------------------------------------------------------
// Componente visual + interactivo: un cuadrado 280×280 con la geometría
// estilizada de Summoner's Rift (3 lanes + jungla), 5 zonas pulsables
// (TOP / JUNGLE / MID / ADC / SUPPORT) usando react-native-svg.
//
// Decisiones de diseño:
// SVG nativo: queremos formas custom (rombos para nexus/torres,
// polígonos para lanes) y eventos `onPress` por zona, lo que con SVG
// es 100% multiplataforma (web/iOS/Android) sin layout hacks.
// Zonas: cada rol es un <Path> con `onPress`. La zona seleccionada
// se llena con `theme.primary + '55'` y borde luminoso; las demás
// quedan en `rgba(255,255,255,0.08)`.
// Sin animaciones complejas: un fade-in al primer mount via Animated
// opacity para que no aparezca de golpe.
// Coords inspiradas en el minimapa real (ADC abajo-derecha, SUP misma
// lane bot, MID diagonal central, JG entre lanes, TOP arriba-izq).
//
// API:
// <RoleSelectionMap
// selectedRole="MID"
// onSelectRole={(role) => ...}
// theme={{ primary, accent, text }} // opcional, defaults Nova
// />
// ============================================================================
import React, { useEffect, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, Animated, Platform } from 'react-native';
import Svg, { Path, Circle, Line, Rect, G, Text as SvgText } from 'react-native-svg';
import { useTheme } from '../context/ThemeContext';

const SIZE = 280;
const ROLE_LABELS = {
  TOP:     'TOP',
  JUNGLE:  'JG',
  MID:     'MID',
  ADC:     'ADC',
  SUPPORT: 'SUP',
};

// Coordenadas de cada zona (centro del label) — coordenadas relativas a SIZE.
const ROLE_ZONES = [
  // TOP: lane izquierda-superior (la diagonal va de arriba-izq a centro)
  {
    role: 'TOP',
    // Path en forma de banda diagonal por la parte superior-izquierda
    path: 'M 12 80 L 80 12 L 110 12 L 12 110 Z',
    labelXY: [42, 50],
  },
  // MID: diagonal central
  {
    role: 'MID',
    path: 'M 110 110 L 170 110 L 170 170 L 110 170 Z',
    labelXY: [140, 142],
  },
  // ADC: lane inferior-derecha (banda diagonal por la parte inferior-derecha)
  {
    role: 'ADC',
    path: 'M 170 170 L 268 170 L 268 200 L 200 268 L 170 268 Z',
    labelXY: [220, 220],
  },
  // SUPPORT: zona base inferior-derecha (junto al nexus)
  {
    role: 'SUPPORT',
    path: 'M 200 220 L 268 220 L 268 268 L 240 268 Z',
    labelXY: [240, 248],
  },
  // JUNGLE: zona central (selvas) — polígono con hueco que cubre los bordes
  // de las zonas anteriores. Para no superponer eventos con TOP/MID/ADC,
  // dibujamos jungla como dos parches (top-right y bot-left) que quedan
  // entre lanes.
  {
    role: 'JUNGLE',
    path: 'M 130 30 L 248 30 L 248 100 L 200 145 L 145 100 Z',
    labelXY: [200, 75],
  },
  {
    role: 'JUNGLE',
    path: 'M 30 130 L 100 145 L 145 200 L 100 248 L 30 248 Z',
    labelXY: [78, 200],
    isAlias: true, // misma key, no duplica botón visualmente; se renderiza pero no muestra label
  },
];

export default function RoleSelectionMap({
  selectedRole,
  onSelectRole,
  theme,
}) {
  const { colors: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const t = theme || { primary: '#7B61FF', accent: '#7B76DD', text: c.textPrimary };
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: 1,
      duration: 280,
      useNativeDriver: true,
    }).start();
  }, [opacity]);

  return (
    <Animated.View style={[styles.wrap, { opacity }]}>
      <Text style={styles.title}>ELIGE TU ROL</Text>
      <Text style={styles.subtitle}>Toca tu lane para afinar la recomendación</Text>

      <View style={styles.mapWrap}>
        <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
          {/* Fondo del mapa */}
          <Rect
            x={0} y={0} width={SIZE} height={SIZE}
            fill="rgba(123,97,255,0.04)"
            stroke="rgba(123,97,255,0.18)"
            strokeWidth={1}
            rx={8} ry={8}
          />

          {/* Río diagonal — línea decorativa */}
          <Line
            x1={20} y1={SIZE - 20}
            x2={SIZE - 20} y2={20}
            stroke="rgba(123,180,255,0.18)"
            strokeWidth={3}
            strokeDasharray="6 4"
          />

          {/* Nexus — rombos en las esquinas */}
          <Rect
            x={20} y={SIZE - 50} width={30} height={30}
            fill="rgba(0,180,255,0.20)"
            stroke="rgba(0,180,255,0.45)"
            strokeWidth={1.5}
            rx={3} ry={3}
            transform={`rotate(45 35 ${SIZE - 35})`}
          />
          <Rect
            x={SIZE - 50} y={20} width={30} height={30}
            fill="rgba(255,82,82,0.20)"
            stroke="rgba(255,82,82,0.45)"
            strokeWidth={1.5}
            rx={3} ry={3}
            transform={`rotate(45 ${SIZE - 35} 35)`}
          />

          {/* Zonas de rol (pulsables) */}
          {ROLE_ZONES.map((zone, idx) => {
            const isSel = selectedRole === zone.role;
            const fill = isSel
              ? t.primary + '55'
              : c.onSurface(0.06);
            const stroke = isSel
              ? t.primary
              : c.onSurface(0.20);
            return (
              <G key={`${zone.role}-${idx}`}>
                <Path
                  d={zone.path}
                  fill={fill}
                  stroke={stroke}
                  strokeWidth={isSel ? 2.5 : 1}
                  // P2-7 — En web, react-native-svg NO dispara `onPress` de forma
                  // fiable sobre los <Path>, por eso el rol quedaba sin elegir. Se
                  // usa `onClick` (DOM) en web y `onPress` en nativo. Se elige UNO
                  // u otro según plataforma para evitar doble disparo (que con el
                  // toggle de selección se anularía a sí mismo).
                  {...(Platform.OS === 'web'
                    ? { onClick: () => onSelectRole?.(zone.role), style: { cursor: 'pointer' } }
                    : { onPress: () => onSelectRole?.(zone.role) })}
                />
                {!zone.isAlias && (
                  <ZoneLabel
                    x={zone.labelXY[0]}
                    y={zone.labelXY[1]}
                    label={ROLE_LABELS[zone.role]}
                    selected={isSel}
                    color={t.text}
                    selectedColor={t.primary}
                  />
                )}
              </G>
            );
          })}

          {/* Torres — círculos puntuales */}
          <Tower x={75}  y={75}        team="ally"   />
          <Tower x={SIZE - 75} y={SIZE - 75} team="ally"   />
          <Tower x={75}  y={SIZE - 75} team="ally"   />
          <Tower x={SIZE - 75} y={75}        team="enemy"  />
        </Svg>
      </View>

      {/* Pill con el rol elegido */}
      <View style={styles.statusRow}>
        {selectedRole ? (
          <View style={[styles.pill, { borderColor: t.primary + '88', backgroundColor: t.primary + '22' }]}>
            <Text style={[styles.pillText, { color: t.primary }]}>
              ROL: {selectedRole}
            </Text>
          </View>
        ) : (
          <View style={[styles.pill, { borderColor: c.onSurface(0.15) }]}>
            <Text style={styles.pillTextMuted}>ROL · sin elegir</Text>
          </View>
        )}
      </View>
    </Animated.View>
  );
}

// Sub-componente que renderiza un texto SVG (evita problemas de Text fuera
// del Svg en algunos navegadores). `SvgText` viene importado en el bloque
// superior junto con el resto de primitivas de react-native-svg.
function ZoneLabel({ x, y, label, selected, color, selectedColor }) {
  return (
    <SvgText
      x={x}
      y={y}
      textAnchor="middle"
      alignmentBaseline="middle"
      fill={selected ? selectedColor : color}
      fontSize={selected ? 13 : 12}
      fontWeight="900"
      letterSpacing={selected ? 1.5 : 1}
      // En native el `pointerEvents` del Text dentro del Svg ya bloquea
      // los taps si lo dejamos en `auto`; lo desactivamos para que el
      // press caiga sobre el Path debajo.
      {...(Platform.OS === 'web' ? { style: { pointerEvents: 'none' } } : {})}
    >
      {label}
    </SvgText>
  );
}

function Tower({ x, y, team }) {
  const fill = team === 'ally' ? 'rgba(0,180,255,0.40)' : 'rgba(255,82,82,0.40)';
  const stroke = team === 'ally' ? 'rgba(0,180,255,0.70)' : 'rgba(255,82,82,0.70)';
  return (
    <Circle cx={x} cy={y} r={3.5} fill={fill} stroke={stroke} strokeWidth={1} />
  );
}

const makeStyles = (c) => StyleSheet.create({
  wrap: { alignItems: 'center', marginVertical: 16 },
  title: {
    color: c.textPrimary,
    fontSize: 12, fontWeight: '900', letterSpacing: 2.5, marginBottom: 4,
  },
  subtitle: {
    color: c.onSurface(0.40),
    fontSize: 10, letterSpacing: 0.8, marginBottom: 12,
  },
  mapWrap: {
    width: SIZE, height: SIZE,
    borderRadius: 8, overflow: 'hidden',
    backgroundColor: c.bg1,
  },
  statusRow: { marginTop: 12 },
  pill: {
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 6, borderWidth: 1,
  },
  pillText:      { fontSize: 11, fontWeight: '900', letterSpacing: 2 },
  pillTextMuted: { color: c.onSurface(0.40), fontSize: 11, letterSpacing: 1.5 },
});
