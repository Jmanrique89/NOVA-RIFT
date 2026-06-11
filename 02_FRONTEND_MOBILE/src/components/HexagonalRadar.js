// ============================================================================
// HexagonalRadar — Trend 2026 #5 (HUD Sci-Fi)
// ----------------------------------------------------------------------------
// Radar real con SVG: 3 anillos hexagonales concéntricos, sweep que rota,
// puntos para enemigos posicionados según threat individual, datapoint
// central para el jugador, líneas radiales tipo HUD militar.
//
// Props:
// threatScore (0-100) — pinta el sweep + radio del centro
// enemyDots ([{angle, distance, color, label}]) — opcional, datapoints
// color — color principal (theme.primary)
// size — diámetro del radar (default 220)
// ============================================================================

/**
 * @module HexagonalRadar
 *
 * HUD de radar hexagonal animado con estética sci-fi militar, dibujado con SVG.
 * Compone varias capas:
 * 3 anillos hexagonales concéntricos (regulares, con el vértice arriba).
 * Una cruz de líneas radiales tipo retícula de HUD.
 * Un "sweep" (barrido) que rota 360° de forma continua (4 s/vuelta) con un
 * cono de desvanecimiento detrás.
 * Puntos de enemigos posicionados por ángulo/distancia respecto al centro.
 * Un datapoint central pulsante que representa al jugador.
 * Un contador numérico del `threatScore` (0→valor) sobreimpreso.
 *
 * El color del sweep y del centro deriva del nivel de amenaza:
 * verde (<40) → amarillo (40–59) → naranja (60–79) → rojo (≥80).
 *
 * Estados (DIN1-UD3):
 * Reposo:        `threatScore=0` → contador a 0, sweep en color de calma.
 * Amenaza:       el umbral del score escala el color (4 tramos de arriba).
 * Vacío (válido): `enemyDots=[]` → solo retícula + datapoint del jugador;
 *                no es un error: significa "sin enemigos detectados".
 * Loading/error: los gestiona el contenedor (TacticalIntelligenceHUD decide
 *                cuándo montar el radar). Componente presentacional puro:
 *                recibe todo por props, no hace fetch ni efectos de datos.
 *
 * Dónde se usa: TacticalIntelligenceHUD (radar táctico en vivo) y
 * ComponentShowcaseScreen (catálogo vivo, una instancia por rol).
 *
 * @example
 * <HexagonalRadar
 * threatScore={72}
 * enemyDots={[{ angle: 30, distance: 70, color: '#E53935', label: 'Jinx' }]}
 * color={theme.primary}
 * label="THREAT"
 * />
 */

/**
 * @typedef {Object} EnemyDot
 * @property {number} [angle] Ángulo en grados (0 = arriba, sentido horario)
 * donde se sitúa el punto. Si falta, se reparte por índice (i·72°).
 * @property {number} [distance] Distancia radial desde el centro, en px. Por
 * defecto el radio del anillo intermedio.
 * @property {string} [color] Color del punto (default rojo `#E53935`).
 * @property {string} [label] Etiqueta opcional del enemigo (p. ej. campeón).
 */

/**
 * @typedef {Object} HexagonalRadarProps
 * @property {number} [threatScore=0] Puntuación de amenaza 0–100. Define el
 * color del sweep/centro y el valor final del contador.
 * @property {EnemyDot[]} [enemyDots=[]] Puntos de enemigos a pintar en el radar.
 * @property {string} [color='#39ff94'] Color principal de la retícula
 * (típicamente `theme.primary`).
 * @property {number} [size=220] Diámetro del radar, en px.
 * @property {string} [label='THREAT'] Etiqueta de texto bajo el radar.
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import Svg, { Polygon, Circle, Line, G, Defs, LinearGradient, Stop } from 'react-native-svg';
import { useResponsive } from '../hooks/useResponsive';

const AnimatedG = Animated.createAnimatedComponent(G);

/**
 * Calcula los puntos de un polígono hexagonal regular (vértice arriba) inscrito
 * en un círculo de radio `r` centrado en `(cx, cy)`.
 *
 * @param {number} cx Coordenada X del centro.
 * @param {number} cy Coordenada Y del centro.
 * @param {number} r Radio del círculo circunscrito.
 * @returns {string} Cadena `"x1,y1 x2,y2 …"` apta para el atributo `points` de
 * un `<Polygon>` SVG.
 */
function hexPoints(cx, cy, r) {
  const pts = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 2;
    pts.push(`${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`);
  }
  return pts.join(' ');
}

/**
 * Radar hexagonal animado con sweep, puntos de enemigos y contador de amenaza.
 *
 * @param {HexagonalRadarProps} props Propiedades del componente.
 * @returns {React.ReactElement} El radar SVG con su etiqueta.
 */
function HexagonalRadar({
  threatScore = 0,
  enemyDots = [],
  color = '#39ff94',
  size = 220,
  label = 'THREAT',
}) {
  // useResponsive: tamaño adaptativo para pantallas pequeñas
  // Solo escalamos el tamaño por defecto (220); si el caller fija un tamaño
  // explícito lo respetamos tal cual.
  const { scaleDown } = useResponsive();
  const effectiveSize = size === 220 ? scaleDown(220) : size;

  /** @type {React.MutableRefObject<Animated.Value>} progreso 0–1 del barrido rotatorio */
  const sweepAnim = useRef(new Animated.Value(0)).current;
  /** @type {React.MutableRefObject<Animated.Value>} opacidad pulsante del datapoint central */
  const dotPulse  = useRef(new Animated.Value(0.6)).current;
  /** @type {React.MutableRefObject<Animated.Value>} valor animado 0→threatScore del contador */
  const numAnim   = useRef(new Animated.Value(0)).current;
  /** @type {number} valor entero ya redondeado que se pinta en pantalla */
  const [displayScore, setDisplayScore] = React.useState(0);

  // Threat → color
  const threatColor =
    threatScore >= 80 ? '#E53935' :
    threatScore >= 60 ? '#FB8C00' :
    threatScore >= 40 ? '#FDD835' : '#43A047';

  useEffect(() => {
    // Sweep continuo (4s/vuelta)
    Animated.loop(
      Animated.timing(sweepAnim, { toValue: 1, duration: 4000, easing: Easing.linear, useNativeDriver: true })
    ).start();
    // Pulso del datapoint central
    Animated.loop(
      Animated.sequence([
        Animated.timing(dotPulse, { toValue: 1,   duration: 900, useNativeDriver: false }),
        Animated.timing(dotPulse, { toValue: 0.6, duration: 900, useNativeDriver: false }),
      ])
    ).start();
    // Número que cuenta
    Animated.timing(numAnim, {
      toValue: threatScore, duration: 1400, easing: Easing.out(Easing.cubic), useNativeDriver: false,
    }).start();
    return () => {
      sweepAnim.stopAnimation();
      dotPulse.stopAnimation();
      numAnim.stopAnimation();
    };
  }, [threatScore]);

  useEffect(() => {
    const id = numAnim.addListener(({ value }) => setDisplayScore(Math.round(value)));
    return () => numAnim.removeListener(id);
  }, [threatScore]);

  const cx = effectiveSize / 2;
  const cy = effectiveSize / 2;
  const r1 = effectiveSize * 0.46;
  const r2 = effectiveSize * 0.32;
  const r3 = effectiveSize * 0.18;
  const sweepLength = r1;

  const sweepRotate = sweepAnim.interpolate({
    inputRange: [0, 1], outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={[styles.container, { width: effectiveSize, height: effectiveSize + 30 }]}>
      <View style={{ width: effectiveSize, height: effectiveSize }}>
        <Svg width={effectiveSize} height={effectiveSize} viewBox={`0 0 ${effectiveSize} ${effectiveSize}`}>
          <Defs>
            {/* Gradient para el sweep (línea + cono) */}
            <LinearGradient id="sweepGrad" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor={threatColor} stopOpacity="0.7" />
              <Stop offset="1" stopColor={threatColor} stopOpacity="0" />
            </LinearGradient>
          </Defs>

          {/* Anillos hexagonales concéntricos */}
          <Polygon
            points={hexPoints(cx, cy, r1)}
            stroke={color + '55'} strokeWidth="1.5" fill="transparent"
          />
          <Polygon
            points={hexPoints(cx, cy, r2)}
            stroke={color + '33'} strokeWidth="1" fill="transparent"
          />
          <Polygon
            points={hexPoints(cx, cy, r3)}
            stroke={color + '22'} strokeWidth="1" fill={color + '08'}
          />

          {/* Líneas radiales (cruz HUD) */}
          <Line x1={cx - r1} y1={cy} x2={cx + r1} y2={cy} stroke={color + '22'} strokeWidth="0.5" />
          <Line x1={cx} y1={cy - r1} x2={cx} y2={cy + r1} stroke={color + '22'} strokeWidth="0.5" />
          <Line
            x1={cx - r1 * 0.866} y1={cy - r1 * 0.5}
            x2={cx + r1 * 0.866} y2={cy + r1 * 0.5}
            stroke={color + '15'} strokeWidth="0.5"
          />
          <Line
            x1={cx - r1 * 0.866} y1={cy + r1 * 0.5}
            x2={cx + r1 * 0.866} y2={cy - r1 * 0.5}
            stroke={color + '15'} strokeWidth="0.5"
          />

          {/* Enemy dots (posicionados según angle/distance) */}
          {enemyDots.map((dot, i) => {
            const a = (dot.angle ?? (i * 72)) * (Math.PI / 180); // grados → rad
            const d = dot.distance ?? r2;
            const x = cx + d * Math.cos(a - Math.PI / 2);
            const y = cy + d * Math.sin(a - Math.PI / 2);
            return (
              <G key={i}>
                <Circle cx={x} cy={y} r={6}  fill={(dot.color || '#E53935') + '33'} />
                <Circle cx={x} cy={y} r={3.5} fill={dot.color || '#E53935'} />
              </G>
            );
          })}

          {/* Sweep — línea rotando con cono de fade */}
          <AnimatedG
            style={{ transform: [{ rotate: sweepRotate }] }}
            originX={cx} originY={cy}
          >
            <Line
              x1={cx} y1={cy}
              x2={cx + sweepLength} y2={cy}
              stroke={threatColor} strokeWidth="1.5" strokeLinecap="round"
            />
            {/* Cono de fade detrás del sweep */}
            <Polygon
              points={`${cx},${cy} ${cx + sweepLength},${cy - 12} ${cx + sweepLength},${cy + 12}`}
              fill="url(#sweepGrad)"
            />
          </AnimatedG>

          {/* Datapoint central pulsante */}
          <Circle cx={cx} cy={cy} r={5} fill={threatColor} opacity="0.4" />
          <Circle cx={cx} cy={cy} r={3} fill={threatColor} />
        </Svg>

        {/* Número del threat sobreimpreso */}
        <View pointerEvents="none" style={[styles.scoreOverlay, { width: effectiveSize, height: effectiveSize }]}>
          <View style={styles.scoreInner}>
            <Text style={[styles.scoreNum, { color: threatColor }]}>{displayScore}</Text>
            <Text style={styles.scoreMax}>/100</Text>
          </View>
        </View>
      </View>

      <Text style={[styles.label, { color: color + 'CC' }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center' },
  scoreOverlay: {
    position: 'absolute', top: 0, left: 0,
    justifyContent: 'center', alignItems: 'center',
  },
  scoreInner: { alignItems: 'center', justifyContent: 'center' },
  scoreNum: { fontSize: 32, fontWeight: '900', lineHeight: 34 },
  scoreMax: { fontSize: 10, color: '#666', marginTop: -2 },
  label: {
    fontSize: 9, fontWeight: '900', letterSpacing: 2,
    marginTop: 8, textAlign: 'center',
  },
});

/**
 * Memoizado con comparador a medida: el radar dibuja varias capas SVG y arranca
 * `Animated.loop` (sweep + pulso). Evitamos re-renders del padre cuando lo
 * visible no cambia. Solo re-renderiza si cambia `threatScore`, el número de
 * enemigos (`enemyDots.length`), `color` o `size`. Comparamos `length` y no la
 * identidad del array porque el caller suele recrearlo en cada render
 * (p. ej. `generateEnemyDots(...)`). Usamos `?.` por si llega sin `enemyDots`.
 */
export default React.memo(
  HexagonalRadar,
  (prev, next) =>
    prev.threatScore === next.threatScore &&
    prev.enemyDots?.length === next.enemyDots?.length &&
    prev.color === next.color &&
    prev.size === next.size
);
