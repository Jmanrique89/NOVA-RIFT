// ============================================================================
// FactionScreen — Onboarding PASO 1/4 — Redesign v3
// ----------------------------------------------------------------------------
// Diseño: splash art Data Dragon como fondo · emblemas SVG propios · glow selection
// Fix routing: botón "← Salir" limpia sesión para volver a Login
// ============================================================================
import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated,
  Image, Platform, Dimensions,
} from 'react-native';
import Svg, { Path, Circle, Polygon, Line, G } from 'react-native-svg';
import { FACTIONS } from '../../theme/theme';
import { RiotContext } from '../../context/RiotContext';
import { OnboardingContext } from './OnboardingContext';
import { useUser } from '../../context/UserContext';
import {
  COMPOSITE_FACTIONS_IMG,
  getFactionLogo,
  getFactionCrop,
} from '../../data/factionAssets';
import NovaButton from '../../components/NovaButton';
import NovaBackground from '../../components/NovaBackground';
import { TYPE_SCALE } from '../../theme/typography';
import { useTheme } from '../../context/ThemeContext';

// Tamaño nominal de la imagen compuesta faciones.png (ver factionAssets.js)
const COMPOSITE_W = 500;
const COMPOSITE_H = 650;

const { width: SW, height: SH } = Dimensions.get('window');
const IS_WEB    = Platform.OS === 'web';
const CONTENT_W = IS_WEB ? Math.min(SW, 500) : SW;
const CARD_H    = IS_WEB ? 220 : 190;

// ── Taglines por facción (ya no se usa splash de campeón detrás) ─────────────
const FACTION_META = {
  ZAUN:    { tagline: 'Caos químico · Innovación sin límites' },
  DEMACIA: { tagline: 'Justicia inquebrantable · Honor del rey' },
  NOXUS:   { tagline: 'La fuerza decide · Conquista sin tregua' },
  IONIA:   { tagline: 'Equilibrio espiritual · Filo del viento' },
};

// ── Emblemas SVG propios por facción ─────────────────────────────────────────

function ZaunEmblem({ color, size = 48 }) {
  const C = size / 2, R = size * 0.4;
  const pts = Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i - Math.PI / 6;
    return `${C + R * Math.cos(a)},${C + R * Math.sin(a)}`;
  }).join(' ');
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Polygon points={pts} fill="none" stroke={color} strokeWidth="1.8" opacity="0.95" />
      {Array.from({ length: 6 }, (_, i) => {
        const a = (Math.PI / 3) * i;
        return (
          <Line
            key={i}
            x1={C + R * 0.48 * Math.cos(a)} y1={C + R * 0.48 * Math.sin(a)}
            x2={C + R * 0.88 * Math.cos(a)} y2={C + R * 0.88 * Math.sin(a)}
            stroke={color} strokeWidth="1.5"
          />
        );
      })}
      <Circle cx={C} cy={C} r={R * 0.22} fill={color} />
      <Circle cx={C} cy={C} r={R * 0.42} fill="none" stroke={color} strokeWidth="0.9" opacity="0.5" />
    </Svg>
  );
}

function DemaciaEmblem({ color, size = 48 }) {
  const C = size / 2;
  const shield = `M${C},${size * 0.1} L${C + size * 0.33},${size * 0.26} L${C + size * 0.33},${size * 0.56} L${C},${size * 0.9} L${C - size * 0.33},${size * 0.56} L${C - size * 0.33},${size * 0.26} Z`;
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Path d={shield} fill={color} fillOpacity="0.15" stroke={color} strokeWidth="1.8" />
      {/* Cruz interior */}
      <Line x1={C} y1={size * 0.22} x2={C} y2={size * 0.78} stroke={color} strokeWidth="1.6" />
      <Line x1={C - size * 0.2} y1={C} x2={C + size * 0.2} y2={C} stroke={color} strokeWidth="1.6" />
      {/* Punto central */}
      <Circle cx={C} cy={C} r={size * 0.055} fill={color} />
    </Svg>
  );
}

function NoxusEmblem({ color, size = 48 }) {
  const C = size / 2, R = size * 0.42;
  const star = Array.from({ length: 10 }, (_, i) => {
    const a = (Math.PI / 5) * i - Math.PI / 2;
    const r = i % 2 === 0 ? R : R * 0.4;
    return `${C + r * Math.cos(a)},${C + r * Math.sin(a)}`;
  }).join(' ');
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Polygon points={star} fill={color} fillOpacity="0.22" stroke={color} strokeWidth="1.8" />
      <Circle cx={C} cy={C} r={size * 0.09} fill={color} />
    </Svg>
  );
}

function IoniaEmblem({ color, size = 48 }) {
  const C = size / 2, R = size * 0.38;
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {/* Pétalos de loto */}
      {Array.from({ length: 6 }, (_, i) => {
        const a  = (Math.PI / 3) * i;
        const px = C + R * 0.58 * Math.cos(a);
        const py = C + R * 0.58 * Math.sin(a);
        const c1x = C + R * 1.05 * Math.cos(a - 0.45);
        const c1y = C + R * 1.05 * Math.sin(a - 0.45);
        const c2x = C + R * 1.05 * Math.cos(a + 0.45);
        const c2y = C + R * 1.05 * Math.sin(a + 0.45);
        return (
          <Path
            key={i}
            d={`M${C},${C} Q${c1x},${c1y} ${px},${py} Q${c2x},${c2y} ${C},${C}`}
            fill={color} fillOpacity="0.2" stroke={color} strokeWidth="0.9"
          />
        );
      })}
      <Circle cx={C} cy={C} r={R * 0.82} fill="none" stroke={color} strokeWidth="1.6" opacity="0.8" />
      <Circle cx={C} cy={C} r={size * 0.07} fill={color} />
    </Svg>
  );
}

const EMBLEMS = { ZAUN: ZaunEmblem, DEMACIA: DemaciaEmblem, NOXUS: NoxusEmblem, IONIA: IoniaEmblem };

// ── FactionLogo ──────────────────────────────────────────────────────────────
// 3-tier render strategy:
// 1) Individual PNG logo (FACTION_LOGOS[key]) — solo si existen los archivos
// cropeados (después de ejecutar `node scripts/crop-assets.js`).
// 2) Composite image crop — recorta el cuadrante correcto de faciones.png
// con overflow:hidden + Image posicionada con offsets negativos.
// Funciona inmediatamente sin scripts previos.
// 3) SVG Emblem fallback — si no hay imagen disponible.
//
// El componente hace todo automático: el llamador solo le pasa factionKey.
function FactionLogo({ factionKey, color, size = 64 }) {
  const logo = getFactionLogo(factionKey);
  const crop = getFactionCrop(factionKey);
  const Emblem = EMBLEMS[factionKey];

  // Tier 1: PNG individual ya recortado
  if (logo) {
    return (
      <Image
        source={logo}
        style={{ width: size, height: size }}
        resizeMode="contain"
      />
    );
  }

  // Tier 2: cropear in-place desde la imagen compuesta
  if (crop && COMPOSITE_FACTIONS_IMG) {
    const scale = size / crop.width;
    return (
      <View
        style={{
          width: size,
          height: size,
          overflow: 'hidden',
          borderRadius: 4,
        }}
      >
        <Image
          source={COMPOSITE_FACTIONS_IMG}
          style={{
            position: 'absolute',
            width: COMPOSITE_W * scale,
            height: COMPOSITE_H * scale,
            left: -crop.left * scale,
            top: -crop.top * scale,
          }}
          resizeMode="cover"
        />
      </View>
    );
  }

  // Tier 3: SVG fallback (nunca debería llegar aquí, pero por defensividad)
  return Emblem ? <Emblem color={color} size={size * 0.72} /> : null;
}

// ── FactionCard ───────────────────────────────────────────────────────────────
function FactionCard({ factionKey, selected, onPick }) {
  const { colors: c, isDark } = useTheme();
  const styles = useMemo(() => makeFactionStyles(c), [c]);
  const f      = FACTIONS[factionKey];
  const meta   = FACTION_META[factionKey];

  const scaleAnim  = useRef(new Animated.Value(1)).current;
  const borderAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: selected ? 1.03 : 1,
        friction: 5, tension: 80, useNativeDriver: true,
      }),
      Animated.timing(borderAnim, {
        toValue: selected ? 1 : 0, duration: 250, useNativeDriver: false,
      }),
    ]).start();
  }, [selected]);

  const borderColor = borderAnim.interpolate({
    inputRange: [0, 1], outputRange: [c.onSurface(0.10), f.primary],
  });
  const borderWidth = borderAnim.interpolate({
    inputRange: [0, 1], outputRange: [1.5, 2],
  });

  // Gradiente radial simulado con capas de color
  const glowBg = selected ? f.primary + '28' : f.primary + '0D';

  // Sombra sutil de color de facción cuando está seleccionada (iOS + web).
  // Android usa elevation; ambos se ignoran en plataformas que no los soportan.
  const shadowStyle = selected
    ? {
        shadowColor: f.primary,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.7,
        shadowRadius: 20,
        elevation: 10,
        ...(Platform.OS === 'web'
          ? { filter: `drop-shadow(0 0 18px ${f.primary}99)` }
          : {}),
      }
    : null;

  return (
    <Animated.View style={[styles.cardWrap, shadowStyle, { transform: [{ scale: scaleAnim }] }]}>
      <Animated.View style={[styles.cardBorder, { borderColor, borderWidth }]}>
        <TouchableOpacity
          activeOpacity={0.88}
          onPress={() => onPick(factionKey)}
          style={{ flex: 1 }}
        >
          {/* Fondo limpio con color de facción — sin campeón aleatorio */}
          <View style={[styles.cardBg, { backgroundColor: isDark ? c.bg1 : c.surface }]}>
            {/* Halo de color de facción centrado */}
            <View
              style={[
                styles.factionGlow,
                {
                  backgroundColor: glowBg,
                  borderColor: f.primary + (selected ? '44' : '18'),
                },
              ]}
            />

            {/* Contenido centrado: emblema + nombre + tagline */}
            <View style={styles.cardContent}>
              <View style={styles.emblemWrap}>
                <FactionLogo factionKey={factionKey} color={f.primary} size={72} />
              </View>
              <Text style={[
                styles.factionName,
                {
                  color: f.primary,
                  textShadowColor: selected ? f.primary : 'transparent',
                },
              ]}>
                {/* alias de identidad, no el nombre de la facción */}
                {(f.identity || 'Nova').toUpperCase()}
              </Text>
              <Text style={[styles.factionTagline, { color: f.primary + 'AA' }]} numberOfLines={2}>
                {meta.tagline}
              </Text>
            </View>

            {/* Badge seleccionado */}
            {selected && (
              <View style={[styles.badge, { backgroundColor: f.primary }]}>
                <Text style={[styles.badgeText, { color: c.textInverse }]}>ELEGIDA</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      </Animated.View>
    </Animated.View>
  );
}

// ── FactionScreen ─────────────────────────────────────────────────────────────
export default function FactionScreen({ navigation, onContinue }) {
  const { colors: c, isDark } = useTheme();
  const styles = useMemo(() => makeFactionStyles(c), [c]);
  const { setFaction }         = useContext(RiotContext);
  const { setUser }            = useUser();
  const onboardingCtx          = useContext(OnboardingContext);
  const setOnboardingFaction   = onboardingCtx?.setFaction;
  const [selected, setSelected] = useState(onboardingCtx?.faction || null);

  const handleContinue = () => {
    if (!selected) return;
    setFaction(selected);
    if (typeof setOnboardingFaction === 'function') setOnboardingFaction(selected);
    if (typeof onContinue === 'function') { onContinue(selected); return; }
    navigation.navigate('RoleQuiz');
  };

  // Limpia sesión → vuelve a Login
  const handleLogout = async () => {
    await setUser(null);
  };

  const factionKeys = Object.keys(FACTIONS);

  return (
    <View style={[styles.screen, { backgroundColor: isDark ? c.bg1 : c.bg0 }]}>
      {isDark && <NovaBackground />}

      {/* Botón salir (fix routing: limpia sesión cacheada) */}
      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Text style={styles.logoutText}>← Salir</Text>
      </TouchableOpacity>

      {/* Contenedor centrado (máx 500px en web) */}
      <View style={styles.container}>

        {/* Header */}
        <View style={styles.header}>
          {/* Onboarding step dots ●○○○ */}
          <View style={styles.stepDotsRow}>
            <View style={styles.stepDotFilled} />
            <View style={styles.stepDotEmpty} />
            <View style={styles.stepDotEmpty} />
            <View style={styles.stepDotEmpty} />
            <Text style={styles.progressTag}>PASO 1 DE 4</Text>
          </View>
          {/* sin facciones visibles — se elige una IDENTIDAD (alias de color) */}
          <Text style={styles.title}>ELIGE TU IDENTIDAD</Text>
          <Text style={styles.subtitle}>Tu estilo en el Rift</Text>
        </View>

        {/* Grid 2x2 */}
        <View style={styles.grid}>
          {factionKeys.map(key => (
            <FactionCard
              key={key}
              factionKey={key}
              selected={selected === key}
              onPick={setSelected}
            />
          ))}
        </View>

        {/* CTA — NovaButton glass + pulso, color de facción seleccionada */}
        <View style={styles.footer}>
          <NovaButton
            label={selected
              ? `UNIRME A ${(FACTIONS[selected].identity || 'Nova').toUpperCase()} →`
              : 'SELECCIONA UNA IDENTIDAD'}
            onPress={handleContinue}
            disabled={!selected}
            factionColor={selected ? FACTIONS[selected].primary : c.primary}
            size="lg"
          />
        </View>

      </View>
    </View>
  );
}

// ── Estilos ───────────────────────────────────────────────────────────────────
const makeFactionStyles = (c) => StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: c.bg1,
    alignItems: 'center',
  },

  // Botón logout (esquina superior izquierda)
  logoutBtn: {
    position: 'absolute',
    top: IS_WEB ? 16 : 52,
    left: 16,
    zIndex: 10,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  logoutText: {
    color: c.onSurface(0.45),
    fontSize: TYPE_SCALE.caption.size,
    letterSpacing: 1,
  },

  container: {
    flex: 1,
    width: CONTENT_W,
    paddingHorizontal: 24,
    paddingTop: 56,
  },

  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  // Step dots row ●●○○
  stepDotsRow: {
    flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 12,
  },
  stepDotFilled: {
    width: 22, height: 6, borderRadius: 3,
    backgroundColor: c.primary,
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 0 8px rgba(123,118,221,0.8)' }
      : { shadowColor: c.primary, shadowOpacity: 0.8, shadowRadius: 6, shadowOffset: { width: 0, height: 0 } }),
  },
  stepDotEmpty: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: c.onSurface(0.15),
  },
  progressTag: {
    fontSize: TYPE_SCALE.caption.size,
    fontWeight: '700',
    letterSpacing: 2,
    color: 'rgba(123,118,221,0.55)',
    marginLeft: 6,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: TYPE_SCALE.h3.size,
    fontWeight: '900',
    letterSpacing: 3,
    color: c.textPrimary,
    textAlign: 'center',
    textShadowColor: c.onSurface(0.15),
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  subtitle: {
    fontSize: TYPE_SCALE.label.size,
    color: c.onSurface(0.55),
    textAlign: 'center',
    marginTop: 6,
    letterSpacing: 1,
  },

  // Grid 2x2
  grid: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignContent: 'center',
    gap: 10,
  },
  cardWrap: {
    width: '48.5%',
    height: CARD_H,
    maxHeight: 240,
    aspectRatio: undefined,
  },
  cardBorder: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  cardBg: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  // Halo/glow de color de facción centrado en la card
  factionGlow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 12,
    borderWidth: 1,
  },
  cardContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    gap: 6,
  },
  emblemWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  factionName: {
    fontSize: TYPE_SCALE.h6.size,
    fontWeight: '900',
    letterSpacing: 3,
    textAlign: 'center',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  factionTagline: {
    fontSize: TYPE_SCALE.caption.size,
    textAlign: 'center',
    letterSpacing: 0.8,
    lineHeight: 15,
    opacity: 0.75,
  },
  badge: {
    position: 'absolute',
    top: 8,
    right: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
  },
  badgeText: {
    fontSize: TYPE_SCALE.micro.size,
    fontWeight: '900',
    letterSpacing: 1,
  },

  // Footer CTA
  footer: {
    paddingVertical: 16,
  },
  cta: {
    height: 52,
    borderRadius: 8,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ctaText: {
    fontSize: TYPE_SCALE.label.size,
    fontWeight: '900',
    letterSpacing: 3,
  },
});
