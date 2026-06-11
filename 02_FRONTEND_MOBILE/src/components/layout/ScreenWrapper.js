// ============================================================================
// ScreenWrapper — contenedor base de pantalla con safe-area + scroll opcional.
// ----------------------------------------------------------------------------
// Todas las pantallas de NOVA RIFT deberían envolverse aquí para (principio DIN
// de consistencia de layout):
// 1. Respetar los insets del sistema (notch, barra de estado, home bar).
// 2. Aplicar el fondo oscuro unificado de la app (#07070d, ref. LoginScreen).
// 3. Decidir entre layout estático (View) o desplazable (ScrollView).
//
// Usa el SafeAreaView de `react-native-safe-area-context` (aplica padding desde
// el lado nativo y soporta el prop `edges`). Si ese paquete no estuviera
// presente, cae al SafeAreaView del core de React Native sin romper el render.
// ============================================================================
import React, { useMemo } from 'react';
import {
  ScrollView,
  StyleSheet,
  View,
  SafeAreaView as RNSafeAreaView,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';

// Resolución del SafeAreaView: preferimos el de safe-area-context (soporta el
// prop `edges`). Fallback al del core de RN si el paquete no está disponible.
let SafeAreaView = RNSafeAreaView;
try {
  // eslint-disable-next-line global-require
  const safeAreaContext = require('react-native-safe-area-context');
  if (safeAreaContext?.SafeAreaView) {
    SafeAreaView = safeAreaContext.SafeAreaView;
  }
} catch (_) {
  // Paquete no disponible — nos quedamos con el SafeAreaView del core.
}

/**
 * Envoltorio estándar de pantalla. Aplica safe-area + fondo oscuro de la app
 * y, opcionalmente, scroll vertical.
 *
 * @param {object} props
 * @param {React.ReactNode} props.children Contenido de la pantalla.
 * @param {import('react-native').StyleProp<import('react-native').ViewStyle>} [props.style]
 * Estilo del contenedor interno (View) o del contentContainer del ScrollView.
 * @param {ReadonlyArray<'top'|'right'|'bottom'|'left'>} [props.edges=['top','bottom']]
 * Lados que respetan el safe-area inset (solo con safe-area-context).
 * @param {boolean} [props.scrollable=false] Si `true`, envuelve en ScrollView vertical.
 * @param {import('react-native').StyleProp<import('react-native').ViewStyle>} [props.contentContainerStyle]
 * Estilo extra del contentContainer cuando `scrollable` es `true`.
 * @returns {JSX.Element}
 *
 * @example
 * <ScreenWrapper scrollable>
 * <Header />
 * <Content />
 * </ScreenWrapper>
 */
export default function ScreenWrapper({
  children,
  style,
  edges = ['top', 'bottom'],
  scrollable = false,
  contentContainerStyle,
}) {
  const { colors: c } = useTheme();
  const styles = useMemo(() => makeScreenWrapperStyles(c), [c]);
  return (
    <SafeAreaView style={styles.safeArea} edges={edges}>
      {scrollable ? (
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[styles.scrollContent, style, contentContainerStyle]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.flex, style]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

const makeScreenWrapperStyles = (c) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: c.bg0,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
});
