// ============================================================================
// FactionRadarChart — radar hexagonal de atributos por facción
// ----------------------------------------------------------------------------
// Inspirado en el GPI de Mobalytics. 5 ejes que resumen el perfil del jugador:
//
// WINRATE · CS/MIN · ORO · DAÑO · VISIÓN
//
// Render:
// 3 anillos de referencia (33% · 66% · 100%) tenues.
// 6 líneas de eje radiales muy tenues.
// Polígono del jugador con stroke + fill semi-transparente del color de
// facción (`primaryColor` que el padre pasa).
// Punto en cada vértice + label `EJE` arriba del punto y valor numérico.
//
// El componente es presentacional puro — recibe `stats: number[6]` (0..100)
// y `primaryColor: string` (hex). El cálculo del perfil real (de las
// partidas del usuario) se hace fuera; aquí pintamos.
// ============================================================================
import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Polygon, Circle, Line, Text as SvgText } from 'react-native-svg';
import { useTheme } from '../context/ThemeContext';

const AXIS_LABELS = [
  'WINRATE',
  'CS/MIN',
  'ORO',
  'DAÑO',
  'VISIÓN',
];

const NUM_AXES   = 5;
const REF_RINGS  = [1 / 3, 2 / 3, 1];
const SIZE       = 260;
const CENTER     = SIZE / 2;
const MAX_RADIUS = 90;
const LABEL_OFFSET_R = (MAX_RADIUS + 22) / MAX_RADIUS; // distancia label/eje

/** Coordenada cartesiana de un eje + ratio (0..1). Eje 0 apunta arriba. */
function getCoord(axisIndex, ratio) {
  const angle = (Math.PI * 2 * axisIndex) / NUM_AXES - Math.PI / 2;
  return {
    x: CENTER + MAX_RADIUS * ratio * Math.cos(angle),
    y: CENTER + MAX_RADIUS * ratio * Math.sin(angle),
  };
}

/** Construye el string `x,y x,y …` para un polígono al ratio dado. */
function buildPolygonPoints(ratio) {
  return Array.from({ length: NUM_AXES }, (_, i) => {
    const { x, y } = getCoord(i, ratio);
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(' ');
}

/** Hex `#RRGGBB` → `rgba(r,g,b,alpha)`. */
function hexToRgba(hex, alpha) {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/** Devuelve `start | middle | end` según la X relativa del label. */
function pickTextAnchor(axisIndex) {
  const angle = (Math.PI * 2 * axisIndex) / NUM_AXES - Math.PI / 2;
  const dx = Math.cos(angle);
  if (dx > 0.4)  return 'start';
  if (dx < -0.4) return 'end';
  return 'middle';
}

/**
 * @param {number[]} stats — polígono del jugador (6 valores 0..100)
 * @param {string} primaryColor — color hex de la facción (`theme.primary`)
 * @param {number} size — ancho/alto del SVG (default 260)
 * @param {string} label — encabezado opcional sobre el chart
 * @param {number[]} [benchmarkStats] referencia comparativa (Gold avg, etc.)
 * @param {string} [benchmarkColor='#FFD700'] — color del polígono benchmark (dorado)
 * @param {string} [benchmarkLabel] — etiqueta para la leyenda (ej "Gold avg")
 * @param {number[]} [proStats] referencia profesional (Faker/Caps)
 * @param {string} [proColor='#9B59B6'] — color del polígono PRO (púrpura)
 * @param {string} [proLabel='PRO'] — etiqueta para la leyenda
 * @param {Array} [extraPolygons=[]] — polígonos adicionales de pros activos
 * Cada elemento: { stats: number[6], color: string, label: string }
 */
export default function FactionRadarChart({
  stats = [60, 70, 65, 72, 45],
  primaryColor = '#7B76DD',
  size = 280,
  label = 'PERFIL TÁCTICO', // etiqueta neutra (sin facciones visibles)
  benchmarkStats,
  benchmarkColor = '#FFD700',
  benchmarkLabel = 'Media',
  proStats,
  proColor = '#9B59B6',
  proLabel = 'PRO',
  extraPolygons = [],
}) {
  const { colors: c } = useTheme();
  const styles = useMemo(() => makeRadarStyles(c), [c]);

  // Sanitizar y normalizar a 0..1 (helper interno reutilizado para 3 datasets).
  const sanitize = (arr) => Array.from({ length: NUM_AXES }, (_, i) => {
    const v = Number(arr?.[i]);
    return Number.isFinite(v) ? Math.max(0, Math.min(100, v)) : 0;
  });

  const safeStats   = sanitize(stats);
  const safeBench   = benchmarkStats ? sanitize(benchmarkStats) : null;
  const safePro     = proStats       ? sanitize(proStats)       : null;
  const normalized  = safeStats.map(v => v / 100);

  // Helper: array `[{x,y}, ...]` → string SVG points
  const pointsFromStats = (arr01) => arr01
    .map((ratio, i) => {
      const { x, y } = getCoord(i, ratio);
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');

  const playerPoints = pointsFromStats(normalized);
  const benchPoints  = safeBench ? pointsFromStats(safeBench.map(v => v / 100)) : null;
  const proPoints    = safePro   ? pointsFromStats(safePro.map(v => v / 100))   : null;

  const fillColor = hexToRgba(primaryColor, 0.18);
  const showLegend = !!(benchmarkStats || proStats || extraPolygons.length > 0);

  return (
    <View style={styles.container}>
      <Text style={styles.sectionLabel}>{label}</Text>

      <Svg
        width={size}
        height={size}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        // overflow visible para que los labels no se corten en los extremos
        style={{ overflow: 'visible' }}
      >
        {/* ── Anillos de referencia ── */}
        {REF_RINGS.map((ratio, i) => (
          <Polygon
            key={`ring-${i}`}
            points={buildPolygonPoints(ratio)}
            fill="none"
            stroke={c.onSurface(0.07)}
            strokeWidth={i === REF_RINGS.length - 1 ? 1.5 : 1}
          />
        ))}

        {/* ── Líneas de eje radiales ── */}
        {Array.from({ length: NUM_AXES }, (_, i) => {
          const outer = getCoord(i, 1);
          return (
            <Line
              key={`axis-${i}`}
              x1={CENTER}
              y1={CENTER}
              x2={outer.x.toFixed(2)}
              y2={outer.y.toFixed(2)}
              stroke={c.onSurface(0.06)}
              strokeWidth={1}
            />
          );
        })}

        {/* ── · Polígono BENCHMARK (Gold avg) — sin fill, stroke punteado
              para diferenciarlo del jugador. Se renderiza ANTES que el del
              jugador para que éste quede por encima. ── */}
        {benchPoints && (
          <Polygon
            points={benchPoints}
            fill="none"
            stroke={benchmarkColor}
            strokeWidth={1.5}
            strokeDasharray="4 3"
            strokeLinejoin="round"
            opacity={0.85}
          />
        )}

        {/* ── · Polígono PRO (Faker/Caps reference) — stroke continuo
              y opacidad media. Color púrpura para distinguir del benchmark
              dorado. Va por debajo del player para no taparlo. ── */}
        {proPoints && (
          <Polygon
            points={proPoints}
            fill="none"
            stroke={proColor}
            strokeWidth={1.5}
            strokeLinejoin="round"
            opacity={0.75}
          />
        )}

        {/* ── Polígonos extra — pros activos seleccionados por el usuario.
              Trazo punteado + fill muy tenue para distinguir cada uno. ── */}
        {extraPolygons.map((ep, idx) => {
          const safeEP = Array.from({ length: NUM_AXES }, (_, i) => {
            const v = Number(ep.stats?.[i]);
            return Number.isFinite(v) ? Math.max(0, Math.min(100, v)) : 0;
          });
          const epPoints = pointsFromStats(safeEP.map(v => v / 100));
          return (
            <Polygon
              key={`extra-${idx}`}
              points={epPoints}
              fill={hexToRgba(ep.color, 0.10)}
              stroke={ep.color}
              strokeWidth={1.2}
              strokeDasharray="4,3"
              strokeLinejoin="round"
            />
          );
        })}

        {/* ── Shape del jugador ── */}
        <Polygon
          points={playerPoints}
          fill={fillColor}
          stroke={primaryColor}
          strokeWidth={2}
          strokeLinejoin="round"
        />

        {/* ── Vértices ── */}
        {normalized.map((ratio, i) => {
          const { x, y } = getCoord(i, ratio);
          return (
            <Circle
              key={`dot-${i}`}
              cx={x.toFixed(2)}
              cy={y.toFixed(2)}
              r={4}
              fill={primaryColor}
            />
          );
        })}

        {/* ── Labels + valores numéricos ── */}
        {AXIS_LABELS.map((axisLabel, i) => {
          const { x, y } = getCoord(i, LABEL_OFFSET_R);
          const anchor   = pickTextAnchor(i);
          return (
            <React.Fragment key={`label-${i}`}>
              <SvgText
                x={x.toFixed(2)}
                y={(y - 7).toFixed(2)}
                textAnchor={anchor}
                fontSize={11}
                fontWeight="900"
                fill={c.onSurface(0.7)}
              >
                {axisLabel}
              </SvgText>
              <SvgText
                x={x.toFixed(2)}
                y={(y + 7).toFixed(2)}
                textAnchor={anchor}
                fontSize={11}
                fontWeight="900"
                fill={primaryColor}
              >
                {safeStats[i]}
              </SvgText>
            </React.Fragment>
          );
        })}
      </Svg>

      {/* Leyenda de los datasets (solo si hay benchmark/pro). El
          dataset del jugador siempre va primero con el color de facción. */}
      {showLegend && (
        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: primaryColor }]} />
            <Text style={styles.legendLabel}>TÚ</Text>
          </View>
          {benchmarkStats && (
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: benchmarkColor }]} />
              <Text style={styles.legendLabel}>{benchmarkLabel.toUpperCase()}</Text>
            </View>
          )}
          {proStats && (
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: proColor }]} />
              <Text style={styles.legendLabel}>{proLabel.toUpperCase()}</Text>
            </View>
          )}
          {extraPolygons.map((ep, idx) => (
            <View key={`leg-extra-${idx}`} style={styles.legendItem}>
              <View style={[styles.legendDot, {
                backgroundColor: ep.color,
                borderRadius: 2,
              }]} />
              <Text style={[styles.legendLabel, { color: ep.color }]}>
                {ep.label.toUpperCase()}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const makeRadarStyles = (c) => StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: c.onSurface(0.03),
    borderWidth: 1, borderColor: c.onSurface(0.07),
    borderRadius: 14,
    padding: 16,
    marginBottom: 18,
  },
  sectionLabel: {
    color: c.onSurface(0.35),
    fontSize: 9, fontWeight: '900', letterSpacing: 2,
    marginBottom: 12,
    alignSelf: 'flex-start',
  },
  // Leyenda de los 3 datasets (TÚ / GOLD / PRO)
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 14,
    marginTop: 10,
    flexWrap: 'wrap',
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendLabel: {
    color: c.onSurface(0.55),
    fontSize: 11, fontWeight: '900', letterSpacing: 1.5,
  },
});
