// ============================================================================
// NovaBackground — Fondo animado NOVA RIFT
// ----------------------------------------------------------------------------
// Tormenta de líneas + partículas ascendentes
//
// Exports:
// default → <NovaBackground /> BeamField + ParticleField combinados
// named → <ParticleField /> solo partículas (Login, Register, Splash)
// named → <BeamField /> solo rayos diagonales
// named → <NovaRiftLogo /> logo SVG hexágono + estrella
// ============================================================================
import React, { useEffect, useRef, useMemo } from 'react';
import { Animated, Dimensions, Easing, StyleSheet, View } from 'react-native';
import Svg, { G, Path, Circle } from 'react-native-svg';

const { width: SW, height: SH } = Dimensions.get('window');
const DIAG = Math.sqrt(SW * SW + SH * SH) + 100;

// ─── Seeded RNG — configs estables entre re-renders ─────────────────────────
let _s = 31;
const rnd = () => { _s = (_s * 16807) % 2147483647; return (_s - 1) / 2147483646; };

// ─── Configs de rayos (calculadas una vez al cargar el módulo) ───────────────
const BEAM_CFGS = Array.from({ length: 14 }, (_, i) => ({
  id:      i,
  offsetX: (rnd() - 0.5) * SW * 1.4,
  angle:   `${7 + rnd() * 18}deg`,
  width:   0.6 + rnd() * 1.6,
  dur:     7000 + rnd() * 10000,
  delay:   i * 420 + rnd() * 600,
  dir:     i % 2 === 0 ? 1 : -1,
  cyan:    rnd() > 0.55,
  opacity: 0.07 + rnd() * 0.11,
}));

// ─── Configs de partículas (calculadas una vez al cargar el módulo) ──────────
const HEAVY_PTCL = Array.from({ length: 72 }, (_, i) => ({
  id:     i,
  x:      rnd() * SW,
  startY: SH * 0.04 + rnd() * SH * 0.96,
  size:   rnd() * 2.4 + 0.5,
  dur:    2600 + rnd() * 3600,
  delay:  rnd() * 5500,
  cyan:   rnd() > 0.44,
}));

// ─── Beam — rayo diagonal que barre la pantalla ──────────────────────────────
function Beam({ c }) {
  const tx = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const half = (SW + DIAG) * 0.5;

    function run() {
      tx.setValue(-half * c.dir);
      Animated.timing(tx, {
        toValue:        half * c.dir,
        duration:       c.dur,
        useNativeDriver: true,
        easing:         Easing.linear,
      }).start(({ finished }) => { if (finished) run(); });
    }

    const t = setTimeout(run, c.delay);
    return () => { clearTimeout(t); tx.stopAnimation(); };
  }, []);

  // Tonos púrpura neutral — coherente con paleta general (LoginScreen).
  const col = c.cyan ? 'rgba(156,152,240,' : 'rgba(123,118,221,';

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position:        'absolute',
        width:           c.width,
        height:          DIAG,
        left:            SW / 2 + c.offsetX,
        top:             (SH - DIAG) / 2,
        backgroundColor: `${col}${c.opacity})`,
        transform:       [{ translateX: tx }, { rotate: c.angle }],
      }}
    />
  );
}

// ─── BeamField — conjunto de rayos ──────────────────────────────────────────
export function BeamField() {
  return (
    <>
      {BEAM_CFGS.map(c => <Beam key={c.id} c={c} />)}
    </>
  );
}

// ─── Particle — punto de luz que asciende ───────────────────────────────────
function Particle({ config, purpleColor = 'rgba(123,118,221,0.55)', cyanColor = 'rgba(156,152,240,0.82)' }) {
  const ty = useRef(new Animated.Value(0)).current;
  const op = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const travel = config.startY * 0.78 + 50;
    const loop = () => {
      ty.setValue(0);
      op.setValue(0);
      Animated.sequence([
        Animated.delay(config.delay % 1000),
        Animated.parallel([
          Animated.timing(op, { toValue: 0.68, duration: 480, useNativeDriver: true }),
          Animated.timing(ty, { toValue: -travel, duration: config.dur || config.duration, useNativeDriver: true }),
        ]),
        Animated.timing(op, { toValue: 0, duration: 380, useNativeDriver: true }),
      ]).start(({ finished }) => { if (finished) loop(); });
    };
    const t = setTimeout(loop, config.delay);
    return () => { clearTimeout(t); ty.stopAnimation(); op.stopAnimation(); };
  }, []);

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position:        'absolute',
        left:            config.x,
        top:             config.startY,
        width:           config.size,
        height:          config.size,
        borderRadius:    config.size / 2,
        backgroundColor: config.cyan ? cyanColor : purpleColor,
        opacity:         op,
        transform:       [{ translateY: ty }],
      }}
    />
  );
}

// ─── ParticleField — lluvia de partículas ascendentes ───────────────────────
// count — cuántas partículas (default 24)
// purpleColor — color base púrpura
// cyanColor — color base cyan
// heavy — si true, usa el pool de 72 partículas pre-calculadas (NovaBackground)
export function ParticleField({
  count       = 24,
  purpleColor = 'rgba(123,118,221,0.82)',
  cyanColor   = 'rgba(156,152,240,0.82)',
  heavy       = false,
}) {
  const particles = useMemo(
    () => heavy
      ? HEAVY_PTCL
      : Array.from({ length: count }, (_, i) => ({
          id:     i,
          x:      Math.random() * SW,
          startY: SH * 0.1 + Math.random() * SH * 0.9,
          size:   Math.random() * 2.5 + 1,
          dur:    2200 + Math.random() * 2000,
          duration: 2200 + Math.random() * 2000,
          delay:  Math.random() * 2200,
          cyan:   Math.random() > 0.58,
        })),
    [count, heavy]
  );

  return (
    <>
      {particles.map(p => (
        <Particle
          key={p.id}
          config={p}
          purpleColor={purpleColor}
          cyanColor={cyanColor}
        />
      ))}
    </>
  );
}

// ─── NovaBackground — solo partículas ascendentes ────────────────────────────
// BeamField (rayos diagonales) desactivado — demasiado ruido visual.
// Mantenemos únicamente las partículas que ascienden (el efecto más limpio).
export default function NovaBackground({ purpleColor, cyanColor }) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* <BeamField /> — desactivado, demasiada animación de fondo */}
      <ParticleField
        heavy
        purpleColor={purpleColor}
        cyanColor={cyanColor}
      />
    </View>
  );
}

// ─── NovaRiftLogo ────────────────────────────────────────────────────────────
// variant='default' → hexágono doble + estrella (Login, Register)
// variant='splash' → solo estrella diamante grande (SplashScreen)
export function NovaRiftLogo({ size = 80, variant = 'default' }) {
  if (variant === 'splash') return <SplashStar size={size} />;
  return (
    <Svg width={size} height={size} viewBox="-50 -50 100 100">
      <Path
        d="M0,-38 L33,-19 L33,19 L0,38 L-33,19 L-33,-19 Z"
        fill="none" stroke="rgba(123,118,221,0.55)" strokeWidth="1.5"
      />
      <Path
        d="M0,-27 L23,-13 L23,13 L0,27 L-23,13 L-23,-13 Z"
        fill="rgba(123,118,221,0.08)" stroke="rgba(123,118,221,0.32)" strokeWidth="1"
      />
      <G transform="rotate(45)">
        <Path d="M-21,0 L0,-1.5 L21,0 L0,1.5 Z" fill="rgba(156,152,240,0.6)" />
      </G>
      <G transform="rotate(-45)">
        <Path d="M-21,0 L0,-1.5 L21,0 L0,1.5 Z" fill="rgba(156,152,240,0.6)" />
      </G>
      <Path d="M0,-34 L2,0 L0,34 L-2,0 Z"   fill="rgba(232,228,255,0.93)" />
      <Path d="M-46,0 L0,-2.5 L46,0 L0,2.5 Z" fill="rgba(232,228,255,0.93)" />
      <Circle cx="0" cy="0" r="4" fill="rgba(255,255,255,0.96)" />
    </Svg>
  );
}

function SplashStar({ size = 130 }) {
  return (
    <Svg width={size} height={size} viewBox="-65 -65 130 130">
      <G transform="rotate(45)">
        <Path d="M-30,0 L0,-2 L30,0 L0,2 Z" fill="rgba(156,152,240,0.7)" />
      </G>
      <G transform="rotate(-45)">
        <Path d="M-30,0 L0,-2 L30,0 L0,2 Z" fill="rgba(156,152,240,0.7)" />
      </G>
      <Path d="M0,-46 L3,0 L0,46 L-3,0 Z"  fill="rgba(232,228,255,0.95)" />
      <Path d="M-62,0 L0,-3 L62,0 L0,3 Z"  fill="rgba(232,228,255,0.95)" />
      <Circle cx="0" cy="0" r="13" fill="rgba(232,228,255,0.10)" />
      <Circle cx="0" cy="0" r="5"  fill="rgba(255,255,255,0.95)" />
    </Svg>
  );
}
