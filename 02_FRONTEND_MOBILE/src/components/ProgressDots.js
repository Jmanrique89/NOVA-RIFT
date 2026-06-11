// ============================================================================
// ProgressDots — indicador de progreso unificado del onboarding (B4.6, DIN2)
// ----------------------------------------------------------------------------
// Fila de puntos bajo el header "PASO X DE 4" de los 4 pasos del onboarding:
//   activo     → 10px, primary, con glow suave
//   completado → 8px, primaryLight
//   pendiente  → 8px, bg2 con borde tenue
// El MISMO componente en los 4 pasos (RoleQuiz, Playstyle, ChampionQuiz,
// ChampionPick) para que el patrón de progreso sea consistente.
// ============================================================================
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';

/**
 * Puntos de progreso del onboarding.
 *
 * @param {object} props
 * @param {number} props.current Paso actual (1-indexado).
 * @param {number} [props.total=4] Número total de pasos.
 * @param {object} [props.style] Estilo extra del contenedor.
 */
export default function ProgressDots({ current, total = 4, style }) {
  const { colors: c } = useTheme();
  return (
    <View style={[styles.row, style]} accessibilityLabel={`Paso ${current} de ${total}`}>
      {Array.from({ length: total }, (_, i) => {
        const step = i + 1;
        const isActive = step === current;
        const isDone = step < current;
        return (
          <View
            key={step}
            style={[
              styles.dot,
              isActive
                ? { width: 10, height: 10, borderRadius: 5, backgroundColor: c.primary,
                    shadowColor: c.primary, shadowOpacity: 0.8, shadowRadius: 6,
                    shadowOffset: { width: 0, height: 0 }, elevation: 4 }
                : isDone
                  ? { backgroundColor: c.primaryLight }
                  : { backgroundColor: c.bg2, borderWidth: 1, borderColor: c.onSurface(0.15) },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginTop: 4, marginBottom: 8,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
