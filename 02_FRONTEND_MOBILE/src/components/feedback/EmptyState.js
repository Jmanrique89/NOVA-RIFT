// ============================================================================
// EmptyState — bloque para listas/secciones sin datos.
// ----------------------------------------------------------------------------
// Principio DIN de feedback: una sección vacía debe explicar por qué está
// vacía y, cuando aplique, ofrecer una acción para llenarla — nunca dejar un
// hueco silencioso que parezca un fallo.
//
// Layout centrado: zona de icono opcional, título (h5 ~20px), subtítulo
// atenuado (caption ~12px) y un CTA opcional ({ label, onPress }).
// ============================================================================
import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';

const ACCENT = '#7B76DD';
const FONT_SEMIBOLD = 'Rajdhani_600SemiBold';
const FONT_BOLD = 'Rajdhani_700Bold';
const FONT_REGULAR = 'Rajdhani_400Regular';

/**
 * Estado vacío centrado con icono, título, subtítulo y CTA opcionales.
 *
 * @param {object} props
 * @param {string} props.title Título principal (h5 ~20px).
 * @param {string} [props.subtitle] Texto secundario atenuado (~12px).
 * @param {React.ReactNode} [props.icon] Nodo de icono mostrado sobre el título.
 * @param {{ label: string, onPress: () => void }} [props.action]
 * CTA opcional. Si se pasa, renderiza un botón con `label` que llama a `onPress`.
 * @param {import('react-native').StyleProp<import('react-native').ViewStyle>} [props.style]
 * Estilo adicional para el contenedor.
 * @returns {JSX.Element}
 */
export default function EmptyState({ title, subtitle, icon, action, style }) {
  const { colors: c } = useTheme();
  const styles = useMemo(() => makeEmptyStateStyles(c), [c]);
  return (
    <View style={[styles.container, style]}>
      {!!icon && <View style={styles.iconArea}>{icon}</View>}

      <Text style={styles.title}>{title}</Text>

      {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}

      {action && typeof action.onPress === 'function' && (
        <TouchableOpacity
          style={styles.cta}
          onPress={action.onPress}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={action.label}
        >
          <Text style={styles.ctaLabel}>
            {action.label?.toUpperCase?.() ?? action.label}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const makeEmptyStateStyles = (c) => StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    paddingHorizontal: 24,
  },
  iconArea: {
    marginBottom: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: c.textPrimary,
    fontSize: 20,
    fontFamily: FONT_SEMIBOLD,
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  subtitle: {
    color: c.onSurface(0.5),
    fontSize: 12,
    fontFamily: FONT_REGULAR,
    textAlign: 'center',
    lineHeight: 17,
    marginTop: 6,
  },
  cta: {
    marginTop: 18,
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 8,
    backgroundColor: ACCENT,
  },
  ctaLabel: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: FONT_BOLD,
    letterSpacing: 2,
  },
});
