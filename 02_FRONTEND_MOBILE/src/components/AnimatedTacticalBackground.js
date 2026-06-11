// ============================================================================
// AnimatedTacticalBackground
// ----------------------------------------------------------------------------
// Background animado tipo "pantalla de comando militar":
// Grid de puntos sutiles tipo HUD
// Línea horizontal de escaneo que recorre la pantalla en bucle
// Línea vertical de escaneo (radar pass)
// Pulso de glow desde el centro
//
// Sin dependencias extra (solo react-native core). Diseñado para ir POR DEBAJO
// del contenido — usar position: absolute o como hijo absoluto en un contenedor.
// ============================================================================
import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Dimensions } from 'react-native';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

const GRID_COLS = 12;
const GRID_ROWS = 18;

export default function AnimatedTacticalBackground({ theme, intensity = 'normal' }) {
  const horizontalScan = useRef(new Animated.Value(0)).current;
  const verticalScan = useRef(new Animated.Value(0)).current;
  const centerPulse = useRef(new Animated.Value(0)).current;
  const gridFade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Escaneo horizontal — barre la pantalla de arriba a abajo cada 4s
    const hLoop = Animated.loop(
      Animated.timing(horizontalScan, {
        toValue: 1,
        duration: 4000,
        useNativeDriver: true,
      })
    );
    hLoop.start();

    // Escaneo vertical — barre de izquierda a derecha cada 6s, fuera de fase
    const vLoop = Animated.loop(
      Animated.timing(verticalScan, {
        toValue: 1,
        duration: 6000,
        useNativeDriver: true,
      })
    );
    vLoop.start();

    // Pulso de glow central
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(centerPulse, { toValue: 1, duration: 2200, useNativeDriver: false }),
        Animated.timing(centerPulse, { toValue: 0, duration: 2200, useNativeDriver: false }),
      ])
    );
    pulseLoop.start();

    // Fade-in inicial del grid (entra suavemente)
    Animated.timing(gridFade, {
      toValue: 1,
      duration: 1500,
      useNativeDriver: true,
    }).start();

    // Cleanup — parar los loops al desmontar para no acumular callbacks
    // pendientes en NativeAnimatedModule (fuga de animaciones).
    return () => {
      hLoop.stop();
      vLoop.stop();
      pulseLoop.stop();
      gridFade.stopAnimation();
    };
  }, []);

  const horizontalY = horizontalScan.interpolate({
    inputRange: [0, 1],
    outputRange: [-40, SCREEN_HEIGHT + 40],
  });

  const verticalX = verticalScan.interpolate({
    inputRange: [0, 1],
    outputRange: [-40, SCREEN_WIDTH + 40],
  });

  const pulseOpacity = centerPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.05, 0.18],
  });

  const baseDot = intensity === 'high' ? 0.18 : 0.10;

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.container]}>

      {/* ─── Grid de puntos ─────────────────────────────── */}
      <Animated.View style={{ opacity: gridFade, ...StyleSheet.absoluteFillObject }}>
        {Array.from({ length: GRID_ROWS }).map((_, row) => (
          <View key={row} style={styles.gridRow}>
            {Array.from({ length: GRID_COLS }).map((__, col) => {
              const isAccent = (row + col) % 7 === 0;
              return (
                <View
                  key={col}
                  style={[
                    styles.gridDot,
                    {
                      backgroundColor: isAccent
                        ? theme.primary + '55'
                        : theme.primary + Math.floor(baseDot * 255).toString(16).padStart(2, '0'),
                      width: isAccent ? 3 : 2,
                      height: isAccent ? 3 : 2,
                    },
                  ]}
                />
              );
            })}
          </View>
        ))}
      </Animated.View>

      {/* Glow, scan lines y esquinas desactivados — solo grid de puntos */}
      {/* <Animated.View centerGlow /> desactivado */}
      {/* <Animated.View horizontalScanLine /> desactivado */}
      {/* <Animated.View verticalScanLine /> desactivado */}
      {/* corners desactivados */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { overflow: 'hidden' },

  // Grid
  gridRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    flex: 1,
    paddingHorizontal: 12,
  },
  gridDot: {
    borderRadius: 1.5,
  },

  // Glow central — pequeño, en la zona inferior, no interfiere con cards
  centerGlow: {
    position: 'absolute',
    top: '70%',
    left: '35%',
    width: '30%',
    height: '8%',
    borderRadius: 200,
  },

  // Líneas de escaneo
  horizontalScanLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    opacity: 0.6,
    shadowOpacity: 0.8,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  horizontalScanGlow: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 60,
    opacity: 0.4,
  },
  verticalScanLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    opacity: 0.35,
    shadowOpacity: 0.6,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 0 },
  },

  // Corner brackets
  corner: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderWidth: 1.5,
    opacity: 0.6,
  },
  cornerTL: { top: 60, left: 8, borderRightWidth: 0, borderBottomWidth: 0 },
  cornerTR: { top: 60, right: 8, borderLeftWidth: 0, borderBottomWidth: 0 },
  cornerBL: { bottom: 8, left: 8, borderRightWidth: 0, borderTopWidth: 0 },
  cornerBR: { bottom: 8, right: 8, borderLeftWidth: 0, borderTopWidth: 0 },
});
