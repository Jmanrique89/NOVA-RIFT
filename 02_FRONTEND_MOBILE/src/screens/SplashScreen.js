// ============================================================================
// SplashScreen — intro animado post-login (estilo AAA · ~2.9s) — P1 BACKLOG
// ----------------------------------------------------------------------------
// Cinematica de bienvenida que sustituye al splash minimal anterior. Cinco
// fases en cascada para impacto visual:
//
// Fase 1 (0-400ms) · Energy sweep horizontal — línea de luz que cruza
// la pantalla de izquierda a derecha y se concentra
// en el centro. Idea: "el sistema arranca".
// Fase 2 (400-900ms) · Logo reveal — spring scale 0.5→1.0 + flash blanco
// radial que se desvanece (estilo "pulse" de Riot).
// Fase 3 (900-1500ms) · Título "NOVA RIFT" letra a letra (staggered fade).
// Fase 4 (1500-1900ms)· Subtítulo "coaching competitivo" con typing effect
// simulado (letras visibles incrementalmente).
// Fase 5 (1900-2500ms)· Hold — el logo pulsa con glow ligero.
// Fase 6 (2500-2900ms)· Outro — fade-out del screen completo.
//
// Decisiones de diseño:
// useNativeDriver: true en todas las animaciones de transform/opacity para
// que corran en el thread del compositor (60fps consistentes). El energy
// sweep usa scaleX (con anchor) en vez de width, por la misma razón.
// ScanLines decorativos (tinte HUD militar) compatibles con la estética
// del resto de la app. 4 líneas horizontales finas, opacidad 0.04-0.08.
// El componente respeta `onFinish` para que el caller (App.js) continúe
// el flujo sin saber nada de las fases internas.
// 2.9s total — suficiente para impacto, no tanto como para impacientar.
// ============================================================================
import React, { useEffect, useRef } from 'react';
import { Animated, Dimensions, Easing, StyleSheet, View } from 'react-native';
import { ParticleField, NovaRiftLogo } from '../components/NovaBackground';
import { TYPE_SCALE } from '../theme/typography';
import { COLORS } from '../theme/tokens';

const { width: SCREEN_W } = Dimensions.get('window');

// "NOVA RIFT" → array de chars para staggered fade (espacio se renderiza tal cual).
const TITLE_CHARS = 'NOVA RIFT'.split('');
const SUB_TEXT    = 'coaching competitivo';

export default function SplashScreen({ onFinish }) {
  // ─── Refs animados ────────────────────────────────────────────────────────
  // sweepProgress: 0 → 1 (cruza pantalla). Usado en translateX + scaleX.
  const sweepProgress = useRef(new Animated.Value(0)).current;
  const sweepOpacity  = useRef(new Animated.Value(0)).current;
  // Logo: scale entrada + opacity + flash radial separado.
  const logoScale   = useRef(new Animated.Value(0.5)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const flashOpacity = useRef(new Animated.Value(0)).current;
  // Pulso del logo durante el hold (loop suave).
  const logoPulse = useRef(new Animated.Value(1)).current;
  // Título — un Animated.Value por letra para el staggered fade.
  const titleAnims = useRef(TITLE_CHARS.map(() => new Animated.Value(0))).current;
  // Subtítulo — `subVisibleChars` controla cuántos chars son visibles
  // (typing effect simulado vía interpolación width-clamp en JS-side).
  const subProgress = useRef(new Animated.Value(0)).current;
  // Outro: fade-out global.
  const screenOpacity = useRef(new Animated.Value(1)).current;
  // Scanlines decorativos — pulso lento independiente del resto.
  const scanlinesPulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Scanlines en bucle suave durante todo el splash (no bloquea la
    // sequence principal, corre en paralelo).
    const scanlinesLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(scanlinesPulse, {
          toValue: 1, duration: 2200, easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(scanlinesPulse, {
          toValue: 0, duration: 2200, easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    scanlinesLoop.start();

    // Pulso del logo en el hold — empieza tras la fase 2.
    const logoPulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(logoPulse, {
          toValue: 1.05, duration: 600, easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(logoPulse, {
          toValue: 1.0, duration: 600, easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );

    Animated.sequence([
      // ─── Fase 1 · Energy sweep ─────────────────────────────────────────
      Animated.parallel([
        Animated.timing(sweepOpacity, {
          toValue: 1, duration: 80, useNativeDriver: true,
        }),
        Animated.timing(sweepProgress, {
          toValue: 1, duration: 400,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(sweepOpacity, {
        toValue: 0, duration: 200, useNativeDriver: true,
      }),

      // ─── Fase 2 · Logo + flash ─────────────────────────────────────────
      Animated.parallel([
        Animated.spring(logoScale, {
          toValue: 1, friction: 6, tension: 80, useNativeDriver: true,
        }),
        Animated.timing(logoOpacity, {
          toValue: 1, duration: 250, useNativeDriver: true,
        }),
        // Flash blanco radial — sube rápido y baja en 500ms.
        Animated.sequence([
          Animated.timing(flashOpacity, {
            toValue: 0.55, duration: 120, useNativeDriver: true,
          }),
          Animated.timing(flashOpacity, {
            toValue: 0, duration: 380,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
      ]),

      // ─── Fase 3 · Título letra a letra (staggered) ─────────────────────
      Animated.stagger(60, titleAnims.map(av =>
        Animated.timing(av, {
          toValue: 1, duration: 200,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        })
      )),

      // ─── Fase 4 · Subtítulo typing effect ──────────────────────────────
      Animated.timing(subProgress, {
        toValue: 1, duration: 400,
        easing: Easing.linear,
        useNativeDriver: false, // interpolamos a número entero (chars), no a transform
      }),

      // ─── Fase 5 · Hold con pulso ──────────────────────────────────────
      Animated.delay(600),

      // ─── Fase 6 · Outro fade-out ──────────────────────────────────────
      Animated.timing(screenOpacity, {
        toValue: 0, duration: 400,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(() => {
      logoPulseLoop.stop();
      scanlinesLoop.stop();
      onFinish && onFinish();
    });

    // Activar el pulso del logo cuando entra (en paralelo con la sequence).
    const pulseTimer = setTimeout(() => logoPulseLoop.start(), 900);

    // Cleanup — parar loops y timer pendiente al desmontar (evita loops
    // huérfanos y "Excessive number of pending callbacks").
    return () => {
      clearTimeout(pulseTimer);
      logoPulseLoop.stop();
      scanlinesLoop.stop();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Interpolaciones derivadas ────────────────────────────────────────────
  // Energy sweep: parte del centro-izquierda y se mueve hacia el centro,
  // estirándose en X. translateX 0→0 (queda centrado), scaleX 0→1.5→0
  // simulando "expansión y absorción" en el centro.
  const sweepTranslateX = sweepProgress.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [-SCREEN_W * 0.6, 0, SCREEN_W * 0.6],
  });
  const sweepScaleX = sweepProgress.interpolate({
    inputRange: [0, 0.3, 0.7, 1],
    outputRange: [0.2, 1.4, 1.4, 0.2],
  });

  // Logo combina dos transforms: la entrada (logoScale) y el pulso del hold
  // (logoPulse). Multiplicación con Animated.multiply.
  const logoCombinedScale = Animated.multiply(logoScale, logoPulse);

  // Subtítulo: convertimos progress 0-1 a número entero de chars visibles.
  // Como Animated no expone valor directo en JSX, usamos el listener para
  // setear el state. Pero como state cambia → re-render, evitamos nativeDriver
  // (declarado false arriba).
  const [subVisibleChars, setSubVisibleChars] = React.useState(0);
  useEffect(() => {
    const id = subProgress.addListener(({ value }) => {
      setSubVisibleChars(Math.floor(value * SUB_TEXT.length));
    });
    return () => subProgress.removeListener(id);
  }, [subProgress]);
  const subRendered = SUB_TEXT.slice(0, subVisibleChars);

  // Scanlines — opacity oscila 0.04 → 0.10 con el pulse.
  const scanlinesOpacity = scanlinesPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.04, 0.10],
  });

  return (
    <Animated.View
      style={[styles.screen, { opacity: screenOpacity }]}
      pointerEvents="none"
    >
      {/* Capa decorativa: scanlines (4 líneas horizontales finas). Tipo HUD. */}
      <Animated.View style={[styles.scanlines, { opacity: scanlinesOpacity }]}>
        {[0.18, 0.40, 0.62, 0.84].map(top => (
          <View
            key={top}
            style={[styles.scanline, { top: `${top * 100}%` }]}
          />
        ))}
      </Animated.View>

      {/* Partículas ascendentes — fondo */}
      <ParticleField count={32} />

      {/* Energy sweep — barra horizontal blanca translúcida */}
      <Animated.View
        style={[
          styles.sweep,
          {
            opacity: sweepOpacity,
            transform: [
              { translateX: sweepTranslateX },
              { scaleX: sweepScaleX },
            ],
          },
        ]}
      />

      {/* Centro: logo + título + subtítulo */}
      <View style={styles.center}>
        <View style={styles.logoWrap}>
          {/* Flash radial blanco detrás del logo (Phase 2 · destello) */}
          <Animated.View
            style={[
              styles.flash,
              { opacity: flashOpacity },
            ]}
          />
          <Animated.View
            style={{
              opacity: logoOpacity,
              transform: [{ scale: logoCombinedScale }],
            }}
          >
            <NovaRiftLogo size={130} variant="splash" />
          </Animated.View>
        </View>

        {/* Título letra a letra */}
        <View style={styles.titleRow}>
          {TITLE_CHARS.map((ch, i) => (
            <Animated.Text
              key={`${ch}-${i}`}
              style={[
                styles.titleChar,
                {
                  opacity: titleAnims[i],
                  transform: [{
                    translateY: titleAnims[i].interpolate({
                      inputRange: [0, 1], outputRange: [12, 0],
                    }),
                  }],
                },
              ]}
            >
              {ch}
            </Animated.Text>
          ))}
        </View>

        {/* Subtítulo con typing effect — incluye un cursor parpadeante simulado
            mediante un "▎" añadido cuando el typing aún no ha terminado. */}
        <View style={styles.subRow}>
          <Animated.Text style={styles.sub}>
            {subRendered}
            {subVisibleChars < SUB_TEXT.length && (
              <Animated.Text style={styles.subCursor}>▎</Animated.Text>
            )}
          </Animated.Text>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.bg_primary,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 99,
  },

  // Scanlines decorativos tipo HUD militar (CRT-style)
  scanlines: { ...StyleSheet.absoluteFillObject },
  scanline: {
    position: 'absolute',
    left: 0, right: 0, height: 1,
    backgroundColor: 'rgba(192, 188, 255, 0.40)',
  },

  // Energy sweep — barra horizontal con gradiente vertical implícito por
  // shadow + borderRadius en bordes superior/inferior.
  sweep: {
    position: 'absolute',
    left: '50%', top: '50%',
    width: SCREEN_W * 0.7,
    height: 2,
    marginLeft: -(SCREEN_W * 0.35),
    marginTop: -1,
    backgroundColor: 'rgba(192, 188, 255, 0.85)',
    borderRadius: 1,
    // Shadow para glow en native (web ignora shadow but renders OK)
    shadowColor: 'rgba(192, 188, 255, 1)',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 12,
  },

  center: { alignItems: 'center', gap: 14 },

  logoWrap: {
    width: 130, height: 130,
    alignItems: 'center', justifyContent: 'center',
    position: 'relative',
  },
  flash: {
    position: 'absolute',
    width: 180, height: 180, borderRadius: 90,
    backgroundColor: 'rgba(232, 228, 255, 1)',
  },

  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 28,
  },
  titleChar: {
    color: '#e8e4ff',
    fontSize: TYPE_SCALE.h4.size, fontWeight: '700', letterSpacing: 5,
  },

  subRow: { minHeight: 14 },
  sub: {
    color: 'rgba(192,188,255,0.55)',
    fontSize: TYPE_SCALE.micro.size, letterSpacing: 3, textTransform: 'uppercase',
    fontWeight: '600',
  },
  subCursor: {
    color: 'rgba(192,188,255,0.85)',
    fontSize: TYPE_SCALE.micro.size,
  },
});
