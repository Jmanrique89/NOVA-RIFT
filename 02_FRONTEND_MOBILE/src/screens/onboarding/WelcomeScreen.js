// ============================================================================
// WelcomeScreen — pantalla de bienvenida post-onboarding
// ----------------------------------------------------------------------------
// Aparece UNA sola vez tras completar el setup (ChampionPickScreen confirma).
// Saluda al usuario, presenta su facción en texto neutro y resume las 3
// grandes ventajas de la app antes de soltarlo en AppTabs.
//
// Rediseño FIX2 (16-jun-2026): se ELIMINA el color de facción del badge,
// feature cards y CTA. Toda la pantalla adopta la paleta púrpura NEUTRAL
// (#7B76DD) para que el momento "acabo de entrar" se sienta consistente
// con la promesa visual de NOVA RIFT y no del bando elegido.
//
// Activación: GateNavigator monta este overlay cuando AsyncStorage tiene la
// clave `novarift_show_welcome`. Al pulsar el CTA o auto-dismissear, llama
// `onFinish` que limpia la flag.
// ============================================================================
// ── Imports de React y React Native ──────────────────────────────────────
// React + los hooks que usa esta pantalla: useEffect (código al montar) y
// useRef (referencia mutable). De react-native: View (contenedor), Text
// (texto), TouchableOpacity (botón táctil, como un JButton con listener),
// StyleSheet (estilos como objeto Java) y Animated/Easing (motor de animación).
import React, { useEffect, useRef, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated, Easing,
} from 'react-native';

// ── Componentes propios y contexto global ────────────────────────────────
// NovaBackground/NovaRiftLogo: fondo y logo de marca reutilizables.
// useUser: lee el usuario autenticado del contexto global (como un singleton
// inyectado, accesible desde cualquier pantalla sin pasarlo por parámetros).
import NovaBackground, { NovaRiftLogo } from '../../components/NovaBackground';
import { useUser } from '../../context/UserContext';
import { useTheme } from '../../context/ThemeContext';

// ── Tema: colores, facciones y tipografía ────────────────────────────────
// Constantes de diseño centralizadas (como un fichero de estilos compartido).
import { FACTIONS } from '../../theme/theme';
import { TYPE_SCALE } from '../../theme/typography';
// B4.4 — micro-feedback del CTA de entrada (mismo spring que NovaButton).
import { usePressScale } from '../../hooks/usePressScale';

// ── Datos estáticos de la pantalla ───────────────────────────────────────
// Las 3 propuestas de valor que se listan al recién llegado. Array constante
// que no cambia en ejecución (como un `static final List` en Java).
const VALUE_PROPS = [
  {
    index: '01',
    title: 'ASISTENTE EN PARTIDA',
    body:  'Analiza picks enemigos en tiempo real y te dice exactamente qué construir y cuándo rotar.',
  },
  {
    index: '02',
    title: 'ELO FORGE',
    body:  'Te dice exactamente qué mejorar esta semana — KDA, farm, visión, KP — con metas medibles.',
  },
  {
    index: '03',
    title: 'IDENTIDAD QUE EVOLUCIONA',
    body:  'Tu perfil acumula logros, rachas y ELO real conforme escalas. Cada partida cuenta.',
  },
];

// ── Componente WelcomeScreen ─────────────────────────────────────────────
// `onFinish` es una prop (parámetro de entrada del componente, equivalente a
// un parámetro del constructor): el callback que el padre ejecuta cuando el
// usuario pulsa el CTA, para limpiar la flag y entrar a la app.
export default function WelcomeScreen({ onFinish }) {
  // useUser(): lee el usuario del contexto global (como una dependencia inyectada).
  const { user } = useUser();
  const { colors: c, isDark } = useTheme();
  // B4.4 — micro-feedback del CTA
  const ctaPress = usePressScale();
  const styles = useMemo(() => makeStyles(c), [c]);

  // Valores derivados del usuario, con defaults defensivos por si vienen null.
  const factionKey   = String(user?.faction || 'ZAUN').toUpperCase();
  const factionTheme = FACTIONS[factionKey] || FACTIONS.ZAUN;
  const username     = user?.username || 'Invocador';

  // ── Animación de entrada (fade-in) ─────────────────────────────────────
  // useRef guarda el valor animado de opacidad y persiste entre renders SIN
  // provocar redibujados (como un campo de instancia no observable).
  const fadeAnim = useRef(new Animated.Value(0)).current;
  // useEffect con dependencias [] = se ejecuta UNA sola vez al montar la
  // pantalla (como un constructor / @PostConstruct). Lanza el fade-in de 600ms.
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue:  1,
      duration: 600,
      easing:   Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, []);

  // ── Render: layout de la pantalla ──────────────────────────────────────
  // El JSX describe la UI de forma declarativa (como construir el árbol de
  // Swing, pero describiendo el QUÉ y no el CÓMO). De fondo a frente: fondo
  // NovaBackground + bloque central animado (logo, saludo, badge de facción,
  // las 3 propuestas de valor y el botón CTA que dispara `onFinish`).
  return (
    <View style={styles.container}>
      {isDark && <NovaBackground />}

      <Animated.View style={[styles.center, { opacity: fadeAnim }]}>
        {/* Logo */}
        <NovaRiftLogo size={68} />
        <Text style={styles.brand}>NOVA RIFT</Text>

        {/* Tagline motivacional sobre el saludo */}
        <Text style={styles.tagline}>Tu camino hacia el ranking empieza aquí</Text>

        {/* Saludo */}
        <Text style={styles.greetingHi}>BIENVENIDO,</Text>
        <Text style={styles.greetingName} numberOfLines={1}>{username}</Text>

        {/* Identity badge */}
        <View style={styles.factionBadge}>
          <Text style={styles.factionLabel}>IDENTIDAD</Text>
          <Text style={styles.factionName}>
            {(factionTheme.identity || 'Nova').toUpperCase()}
          </Text>
        </View>

        {/* Value props */}
        <View style={styles.valueProps}>
          {VALUE_PROPS.map((vp) => (
            <View key={vp.title} style={styles.vpRow}>
              <View style={styles.vpAccent}>
                <Text style={styles.vpIndex}>{vp.index}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.vpTitle}>{vp.title}</Text>
                <Text style={styles.vpBody}>{vp.body}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* CTA — B4.4: spring de pulsación en un Animated.View interior */}
        <TouchableOpacity
          onPress={onFinish}
          activeOpacity={0.85}
          onPressIn={ctaPress.onPressIn}
          onPressOut={ctaPress.onPressOut}
        >
          <Animated.View style={[styles.cta, { transform: [{ scale: ctaPress.scale }] }]}>
            <Text style={styles.ctaText}>ENTRAR A NOVA RIFT →</Text>
          </Animated.View>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

// ── Estilos ────────────────────────────────────────────────────────────────
// StyleSheet.create() define los estilos (equivalente a CSS, pero como objeto
// Java). Agrupados por zona: contenedor/centro, marca (brand/tagline), saludo,
// badge de facción, tarjetas de propuestas de valor (vp*) y botón CTA.
const makeStyles = (c) => StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: c.bg0,
    zIndex: 9998,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingVertical: 40,
  },

  brand: {
    color: c.textPrimary,
    fontSize: TYPE_SCALE.h6.size, fontWeight: '900', letterSpacing: 4,
    marginTop: 10, marginBottom: 18,
  },

  tagline: {
    color: c.onSurface(0.5),
    fontSize: TYPE_SCALE.caption.size, letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 14,
    textAlign: 'center',
  },

  greetingHi: {
    color: c.primary,
    fontSize: TYPE_SCALE.caption.size, fontWeight: '900', letterSpacing: 3,
  },
  greetingName: {
    color: c.textPrimary,
    fontSize: TYPE_SCALE.h3.size, fontWeight: '900', letterSpacing: 1.5,
    marginTop: 4, marginBottom: 14,
  },

  factionBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1, borderRadius: 24,
    borderColor: 'rgba(123,118,221,0.3)',
    backgroundColor: 'rgba(123,118,221,0.15)',
    paddingHorizontal: 16, paddingVertical: 8,
    marginBottom: 28,
  },
  factionLabel: {
    color: c.textPrimary,
    fontSize: TYPE_SCALE.micro.size, fontWeight: '900', letterSpacing: 2, opacity: 0.75,
  },
  factionName: {
    color: c.textPrimary,
    fontSize: TYPE_SCALE.label.size, fontWeight: '900', letterSpacing: 2,
  },

  valueProps: { width: '100%', maxWidth: 380, gap: 12, marginBottom: 32 },
  vpRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 14,
    backgroundColor: c.onSurface(0.03),
    borderWidth: 1, borderRadius: 10,
    borderColor: 'rgba(123,118,221,0.18)',
    padding: 14,
  },
  vpAccent: {
    width: 30, height: 30, borderRadius: 6,
    borderWidth: 1, borderColor: 'rgba(123,118,221,0.5)',
    backgroundColor: 'rgba(123,118,221,0.10)',
    alignItems: 'center', justifyContent: 'center',
  },
  vpIndex: {
    color: c.primary, fontSize: TYPE_SCALE.caption.size, fontWeight: '900', letterSpacing: 1,
  },
  vpTitle: {
    color: c.textPrimary,
    fontSize: TYPE_SCALE.label.size, fontWeight: '700', letterSpacing: 1.5, marginBottom: 4,
  },
  vpBody:  {
    color: c.onSurface(0.55),
    fontSize: TYPE_SCALE.caption.size, lineHeight: 17,
  },

  cta: {
    backgroundColor: c.primary,
    paddingVertical: 16, paddingHorizontal: 32,
    borderRadius: 12,
    shadowColor: c.primary,
    shadowOpacity: 0.5, shadowRadius: 12, shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: TYPE_SCALE.label.size, fontWeight: '900', letterSpacing: 2.5,
  },
});
