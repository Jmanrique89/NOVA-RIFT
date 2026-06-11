// ============================================================================
// ConnectionStatusBar — Nielsen H1: Visibilidad del estado del sistema.
// ----------------------------------------------------------------------------
// Barra fina y no intrusiva anclada en la parte superior de la pantalla. Solo
// aparece cuando hay algo que comunicar (offline / syncing); cuando la conexión
// es 'online' devuelve null para no añadir ruido visual.
//
// Pensada para alimentarse del hook `useConnectionStatus`.
// ============================================================================
import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';

const FONT_BOLD = 'Rajdhani_700Bold';

// Tintes base de la barra. En OSCURO conservamos los rellenos sólidos
// originales (#2A0E0E rojizo / #161229 índigo). En CLARO usamos un tinte
// translúcido del mismo color semántico (rojo de error / púrpura de marca)
// sobre fondo claro, para que la barra siga leyéndose como alerta sin un
// bloque oscuro fuera de lugar.
const OFFLINE_BG_DARK = '#2A0E0E';
const OFFLINE_BG_LIGHT = 'rgba(255,107,107,0.14)';
const OFFLINE_TEXT = '#FF6B6B';
const SYNCING_BG_DARK = '#161229';
const SYNCING_BG_LIGHT = 'rgba(156,152,240,0.16)';
const SYNCING_TEXT = '#9C98F0';

/**
 * Barra de estado de conexión. No renderiza nada cuando `status === 'online'`.
 *
 * @param {object} props
 * @param {'online'|'syncing'|'offline'} props.status Estado de conectividad.
 * @returns {JSX.Element|null} La barra, o `null` si está online.
 */
export default function ConnectionStatusBar({ status }) {
  const { isDark } = useTheme();
  const styles = useMemo(() => makeConnectionStatusBarStyles(), []);

  if (status === 'online') return null;

  const isOffline = status === 'offline';
  const offlineBg = isDark ? OFFLINE_BG_DARK : OFFLINE_BG_LIGHT;
  const syncingBg = isDark ? SYNCING_BG_DARK : SYNCING_BG_LIGHT;
  const bg = isOffline ? offlineBg : syncingBg;
  const color = isOffline ? OFFLINE_TEXT : SYNCING_TEXT;
  const label = isOffline
    ? 'SIN CONEXIÓN · MOSTRANDO DATOS DEL CACHÉ'
    : 'SINCRONIZANDO...';

  return (
    <View
      style={[styles.bar, { backgroundColor: bg }]}
      accessibilityRole="alert"
      accessibilityLabel={label}
    >
      <Text style={[styles.text, { color }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const makeConnectionStatusBarStyles = () => StyleSheet.create({
  bar: {
    width: '100%',
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  text: {
    fontSize: 10,
    fontFamily: FONT_BOLD,
    letterSpacing: 1.5,
    textAlign: 'center',
  },
});
