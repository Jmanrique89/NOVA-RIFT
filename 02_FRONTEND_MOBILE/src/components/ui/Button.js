// ============================================================================
// Button — botón base del sistema de diseño NOVA RIFT.
// ----------------------------------------------------------------------------
// Sistema de botones unificado y reutilizable (principio DIN de consistencia):
// una sola API con 4 variantes y 3 tamaños para toda la app.
//
// Variantes:
// primary relleno púrpura (#7B76DD), texto blanco — acción principal.
// secondary borde púrpura, fondo transparente, texto púrpura.
// ghost sin borde ni fondo, texto claro atenuado — acción terciaria.
// destructive relleno rojo (#ff4444), texto blanco — acciones peligrosas.
//
// Estados: `disabled` (opacidad 0.35) y `loading` (spinner en lugar del label).
// Iconos opcionales a izquierda/derecha del label.
// ============================================================================
import React, { useMemo } from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';

const ACCENT = '#7B76DD';
const DANGER = '#ff4444';
const FONT_BOLD = 'Rajdhani_700Bold';

const SIZE_STYLES = {
  sm: { paddingVertical: 8,  paddingHorizontal: 14, fontSize: 11, letterSpacing: 2 },
  md: { paddingVertical: 12, paddingHorizontal: 20, fontSize: 12, letterSpacing: 2 },
  lg: { paddingVertical: 16, paddingHorizontal: 28, fontSize: 14, letterSpacing: 2 },
};

// Resuelve color de fondo, borde y texto por variante.
// `c` = tokens del tema activo; solo el texto del ghost (neutro atenuado) se
// tematiza, el resto son colores de marca/semánticos fijos.
function variantColors(variant, c) {
  switch (variant) {
    case 'secondary':
      return { backgroundColor: 'transparent', borderColor: ACCENT, borderWidth: 1, color: ACCENT };
    case 'ghost':
      return { backgroundColor: 'transparent', borderColor: 'transparent', borderWidth: 0, color: c.textSecondary };
    case 'destructive':
      return { backgroundColor: DANGER, borderColor: DANGER, borderWidth: 0, color: '#FFFFFF' };
    case 'primary':
    default:
      return { backgroundColor: ACCENT, borderColor: ACCENT, borderWidth: 0, color: '#FFFFFF' };
  }
}

/**
 * Botón reutilizable con 4 variantes y 3 tamaños.
 *
 * @param {object} props
 * @param {string} props.label Texto del botón (se muestra en mayúsculas).
 * @param {() => void} [props.onPress] Handler de pulsación.
 * @param {'primary'|'secondary'|'ghost'|'destructive'} [props.variant='primary'] Estilo visual.
 * @param {'sm'|'md'|'lg'} [props.size='md'] Tamaño (padding + tipografía).
 * @param {boolean} [props.disabled=false] Deshabilitado (opacidad 0.35, sin pulsación).
 * @param {boolean} [props.loading=false] Muestra un spinner en lugar del label.
 * @param {React.ReactNode} [props.leftIcon] Icono antes del label.
 * @param {React.ReactNode} [props.rightIcon] Icono después del label.
 * @param {import('react-native').StyleProp<import('react-native').ViewStyle>} [props.style]
 * Estilo adicional para el contenedor.
 * @param {import('react-native').Insets|number} [props.hitSlop]
 * Área extra de toque alrededor del botón.
 * @returns {JSX.Element}
 */
export default function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  leftIcon,
  rightIcon,
  style,
  hitSlop,
}) {
  const { colors: c } = useTheme();
  const styles = useMemo(() => makeButtonStyles(c), [c]);
  const sz = SIZE_STYLES[size] || SIZE_STYLES.md;
  const colors = variantColors(variant, c);
  const isInactive = disabled || loading;

  // Spinner: blanco en variantes con relleno, color de acento/texto en el resto.
  const spinnerColor =
    variant === 'primary' || variant === 'destructive' ? '#FFFFFF' : colors.color;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isInactive}
      activeOpacity={0.8}
      hitSlop={hitSlop}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isInactive, busy: loading }}
      style={[
        styles.base,
        {
          paddingVertical: sz.paddingVertical,
          paddingHorizontal: sz.paddingHorizontal,
          backgroundColor: colors.backgroundColor,
          borderColor: colors.borderColor,
          borderWidth: colors.borderWidth,
          opacity: disabled ? 0.35 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={spinnerColor} />
      ) : (
        <>
          {leftIcon}
          <Text
            style={[
              styles.label,
              {
                color: colors.color,
                fontSize: sz.fontSize,
                letterSpacing: sz.letterSpacing,
                marginLeft: leftIcon ? 8 : 0,
                marginRight: rightIcon ? 8 : 0,
              },
            ]}
          >
            {label?.toUpperCase?.() ?? label}
          </Text>
          {rightIcon}
        </>
      )}
    </TouchableOpacity>
  );
}

const makeButtonStyles = (c) => StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  label: {
    fontFamily: FONT_BOLD,
    textAlign: 'center',
    includeFontPadding: false,
  },
});
