// ============================================================================
// ThemeToggle — selector de tema claro / oscuro (tarjeta de Apariencia)
// ----------------------------------------------------------------------------
// Componente autónomo que lee ThemeContext y deja elegir modo oscuro/claro.
// Se temata a sí mismo con los tokens `colors`, así que se ve bien en ambos
// modos. Se monta en ProfileScreen (pestaña IDENTITY). El cambio persiste en
// AsyncStorage (lo gestiona ThemeContext) y afecta a las superficies neutras
// (barra de navegación, tarjeta de ajustes); el HUD de partida se mantiene
// oscuro por decisión de diseño.
// ============================================================================
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';

export default function ThemeToggle() {
  const { mode, colors, setMode } = useTheme();

  const Option = ({ value, glyph, label }) => {
    const active = mode === value;
    return (
      <TouchableOpacity
        onPress={() => setMode(value)}
        activeOpacity={0.85}
        style={[
          styles.option,
          {
            borderColor: active ? colors.accent : colors.border,
            backgroundColor: active ? colors.accent + '22' : 'transparent',
          },
        ]}
      >
        <Text style={[styles.glyph, { color: active ? colors.accent : colors.textMuted }]}>{glyph}</Text>
        <Text style={[styles.optionLabel, { color: active ? colors.text : colors.textMuted }]}>{label}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.title, { color: colors.text }]}>APARIENCIA</Text>
      <Text style={[styles.subtitle, { color: colors.textMuted }]}>Tema de la aplicación</Text>
      <View style={styles.row}>
        <Option value="dark"  glyph={'☾'} label="Oscuro" />
        <Option value="light" glyph={'☀'} label="Claro" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1, borderRadius: 12, padding: 16,
    marginHorizontal: 0, marginTop: 16, marginBottom: 4,
  },
  title: { fontSize: 13, fontWeight: '900', letterSpacing: 2, marginBottom: 2 },
  subtitle: { fontSize: 12, marginBottom: 12 },
  row: { flexDirection: 'row' },
  option: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 12, borderWidth: 1, borderRadius: 8, marginHorizontal: 5,
  },
  glyph: { fontSize: 16, marginRight: 8 },
  optionLabel: { fontSize: 13, fontWeight: '700' },
});
