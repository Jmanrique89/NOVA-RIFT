// ============================================================================
// GradeProgressBar — barra segmentada C → S+ (E3 · Statup-like)
// ----------------------------------------------------------------------------
// 8 segmentos con divisores verticales sobre un track con `overflow: hidden`.
// El fill se pinta encima del track con el color de facción y la posición se
// calcula como porcentaje sobre la barra completa.
//
// Sin LinearGradient — sólo Views absolutos. Compatible con web + nativo.
//
// Props:
// progress 0..1 — fracción de la barra (clampado defensivamente).
// color hex — color del fill (ej. theme.primary).
// label opt — texto encima de la barra (ej. "MAESTRÍA").
// showGrades bool — pinta los labels C/C+/B/B+/A/A+/S/S+ sobre la barra.
// ============================================================================
import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { useTheme } from '../context/ThemeContext';

const GRADES = ['C', 'C+', 'B', 'B+', 'A', 'A+', 'S', 'S+'];
const SEGMENT_COUNT = GRADES.length; // 8

function clamp01(v) {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(1, v));
}

export default function GradeProgressBar({
  progress = 0.5,
  color = '#7B76DD',
  label,
  showGrades = true,
}) {
  const { colors: c } = useTheme();
  const styles = useMemo(() => makeGradeProgressBarStyles(c), [c]);
  const p = clamp01(progress);
  // Índice del segmento actual: floor(p * 8) clamped a 7.
  const currentIdx = Math.min(Math.floor(p * SEGMENT_COUNT), SEGMENT_COUNT - 1);
  const currentGrade = GRADES[currentIdx];

  return (
    <View style={styles.container}>
      {!!label && <Text style={styles.topLabel}>{label}</Text>}

      {showGrades && (
        <View style={styles.gradeRow}>
          {GRADES.map((g, i) => (
            <Text
              key={g}
              style={[
                styles.gradeLabel,
                i === currentIdx && { color, fontWeight: '900' },
              ]}
            >
              {g}
            </Text>
          ))}
        </View>
      )}

      {/* Track + fill + 7 divisores. en web, fill usa CSS `linear-
          gradient` para dar un degradado de izquierda (50% opacidad) a
          derecha (color sólido). En nativo el gradient CSS no aplica y se
          ve como `backgroundColor: color` sólido (suficiente sin lib extra). */}
      <View style={styles.track}>
        <View
          style={[
            styles.fill,
            { width: `${(p * 100).toFixed(1)}%`, backgroundColor: color },
            Platform.OS === 'web'
              ? { backgroundImage: `linear-gradient(to right, ${color}80, ${color})` }
              : null,
          ]}
        />
        {Array.from({ length: SEGMENT_COUNT - 1 }, (_, i) => (
          <View
            key={i}
            style={[
              styles.divider,
              { left: `${((i + 1) / SEGMENT_COUNT) * 100}%` },
            ]}
          />
        ))}
      </View>

      {/* Footer: grado actual + % */}
      <View style={styles.statusRow}>
        <Text style={[styles.currentGrade, { color }]}>{currentGrade}</Text>
        <Text style={styles.progressValue}>{Math.round(p * 100)}%</Text>
      </View>
    </View>
  );
}

const makeGradeProgressBarStyles = (c) => StyleSheet.create({
  container: { width: '100%', marginTop: 8 },

  topLabel: {
    color: c.onSurface(0.35),
    fontSize: 8, fontWeight: '900', letterSpacing: 1.5,
    marginBottom: 4,
  },

  gradeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 1,
    marginBottom: 4,
  },
  gradeLabel: {
    fontSize: 8,
    color: c.onSurface(0.25),
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  track: {
    height: 8,
    minHeight: 4,
    backgroundColor: c.onSurface(0.08),
    borderRadius: 4,
    overflow: 'hidden',
    position: 'relative',
  },
  fill: {
    position: 'absolute',
    left: 0, top: 0, bottom: 0,
    minHeight: 4,
    borderRadius: 4,
  },
  divider: {
    position: 'absolute',
    top: 0, bottom: 0,
    width: 1,
    backgroundColor: c.onSurface(0.15),
    zIndex: 1,
  },

  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  currentGrade: {
    fontSize: 10, fontWeight: '900', letterSpacing: 1,
  },
  progressValue: {
    color: c.onSurface(0.35),
    fontSize: 9, fontWeight: '700',
  },
});
