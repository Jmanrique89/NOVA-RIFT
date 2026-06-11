// ============================================================================
// MatchSessionHeader — agrupador de partidas por sesión / día
// ----------------------------------------------------------------------------
// Cabecera fina sobre un grupo de partidas. Muestra:
//
// HOY 6V · 4D · NS 71 · 210min
//
// Comportamiento:
// matches: array de partidas del grupo (espera result, novaScore,
// durationMin/durationMinutes).
// date: string opcional — "HOY", "AYER", "27 ABR" — si no se
// provee, se intenta deducir desde matches[0].date.
// El cálculo es defensivo: tolera que falten campos numéricos.
//
// Compatibilidad de campos (los mocks usan `result: 'W'|'L'` y `durationMin`
// pero el spec original menciona `'WIN'|'LOSS'` y `durationMinutes`. Aceptamos
// ambos para no romper ni con el mock actual ni con el shape que llegará
// del backend en H7).
// ============================================================================
import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';

const isWin  = (m) => m.result === 'W' || m.result === 'WIN';
const isLoss = (m) => m.result === 'L' || m.result === 'LOSS';
const dur    = (m) => m.durationMinutes ?? m.durationMin ?? 30;

export default function MatchSessionHeader({ matches = [], date = 'HOY' }) {
  const { colors: c } = useTheme();
  const styles = useMemo(() => makeMatchSessionHeaderStyles(c), [c]);
  if (!matches.length) return null;

  const wins   = matches.filter(isWin).length;
  const losses = matches.filter(isLoss).length;

  const scores = matches
    .map(m => m.novaScore)
    .filter(s => typeof s === 'number');
  const avgScore = scores.length
    ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
    : null;

  const totalMin = Math.round(matches.reduce((sum, m) => sum + dur(m), 0));

  // Color del NOVA-Score medio por bucket aproximado (sin importar el módulo
  // novaScore para que el componente sea autocontenido).
  const nsColor = avgScore == null
    ? c.onSurface(0.50)
    : avgScore >= 75 ? '#FFD700'
    : avgScore >= 60 ? '#7B76DD'
    : avgScore >= 45 ? c.onSurface(0.65)
                     : '#FF7043';

  return (
    <View style={styles.container}>
      <Text style={styles.date}>{date}</Text>
      <View style={styles.right}>
        <Text style={styles.wl}>
          <Text style={styles.win}>{wins}V</Text>
          <Text style={styles.sep}> · </Text>
          <Text style={styles.loss}>{losses}D</Text>
        </Text>
        {avgScore != null && (
          <>
            <Text style={styles.dot}>·</Text>
            <Text style={[styles.score, { color: nsColor }]}>NS {avgScore}</Text>
          </>
        )}
        <Text style={styles.dot}>·</Text>
        <Text style={styles.time}>{totalMin}min</Text>
      </View>
    </View>
  );
}

const makeMatchSessionHeaderStyles = (c) => StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8, paddingVertical: 8,
    marginTop: 6, marginBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: c.onSurface(0.06),
  },
  date: {
    color: c.onSurface(0.55),
    fontSize: 11, fontWeight: '900', letterSpacing: 2,
    textTransform: 'uppercase',
  },
  right:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  wl:     { fontSize: 12, fontWeight: '700' },
  win:    { color: '#4CAF50', fontWeight: '900' },
  loss:   { color: '#FF5252', fontWeight: '900' },
  sep:    { color: c.onSurface(0.35) },
  dot:    { color: c.onSurface(0.20), fontSize: 12 },
  score:  { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  time:   { color: c.onSurface(0.45), fontSize: 11, fontWeight: '700' },
});
