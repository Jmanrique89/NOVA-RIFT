// ============================================================================
// RoleConstellationScreen — Mapa interactivo de roles
// ----------------------------------------------------------------------------
// Rediseño completo: mapa Summoner's Rift estilizado con carriles SVG,
// nodos de rol posicionados en sus zonas reales, hoja de detalle animada
// con descripción completa + referencia a pro player.
//
// Cambios vs versión H2:
// Mapa SVG con carriles iluminados + río + bases en esquinas
// Nodos posicionados en coordenadas reales del mapa (TOP=top-left, etc.)
// onMouseEnter/onMouseLeave para hover en web con cursor pointer
// RoleDetailSheet: panel inferior animado (≥50% pantalla) con:
// Champion splash art
// Descripción larga del rol
// Stats (CC%, DMG type, impacto)
// Referencia pro player (nombre, equipo, región)
// Etiqueta de rol dentro del nodo + icono
// ELEGIR ROL button solid sólo activo cuando hay selección
// ============================================================================
import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Animated, Dimensions, Platform, ScrollView,
} from 'react-native';
import Svg, {
  Circle as SvgCircle,
  Line as SvgLine,
  Path as SvgPath,
  Rect as SvgRect,
  Defs,
  RadialGradient,
  Stop,
  LinearGradient as SvgLinearGradient,
} from 'react-native-svg';
import { OnboardingContext } from './OnboardingContext';
import { useUser }           from '../../context/UserContext';
import { useTheme }          from '../../context/ThemeContext';
import { FACTIONS }          from '../../theme/theme';
import { ROLE_STAR_CHAMPION, ROLE_TAGLINE, ROLE_STATS } from '../../data/roleAssets';
import RoleIcon              from '../../components/RoleIcon';
import NovaBackground        from '../../components/NovaBackground';
import NovaButton            from '../../components/NovaButton';
import DevEscapeHatch        from '../../components/DevEscapeHatch';
import ChampionImage         from '../../components/ChampionImage';
import { TYPE_SCALE }         from '../../theme/typography';

const { width: SW, height: SH } = Dimensions.get('window');
const MAP_SIZE  = Math.min(SW - 24, 340);
const NODE_SIZE = 50;

// ─── Posiciones de rol en el mapa (fracción de MAP_SIZE) ───────────────────
// Basadas en el mapa real de Summoner's Rift vista aérea (base azul abajo-izq)
const ROLE_POS = {
  TOP:     { rx: 0.17, ry: 0.19 },
  JUNGLE:  { rx: 0.30, ry: 0.52 },
  MID:     { rx: 0.50, ry: 0.50 },
  ADC:     { rx: 0.73, ry: 0.78 },
  SUPPORT: { rx: 0.85, ry: 0.67 },
};

// ─── Descripción larga por rol ──────────────────────────────────────────────
const ROLE_DESC = {
  TOP:
    'El guerrero solitario del top. Domina el 1v1 en línea, splitpushea en el mid-game y se convierte en el tanque o carry que desequilibra teamfights tardíos.',
  JUNGLE:
    'El cazador invisible que dicta el ritmo de la partida. Controla objetivos (Dragón, Barón), gankea carriles en el momento justo y niega el jungla rival.',
  MID:
    'El eje del mapa. Su movilidad le permite influenciar todas las líneas con roams. Burst de daño para eliminar carries o apoyo con CC masivo en teamfights.',
  ADC:
    'El cañón a distancia. Escala con objetos para convertirse en la principal fuente de daño sostenido del equipo. Posicionamiento y paciencia son su ley.',
  SUPPORT:
    'El guardián del bot y del mapa. Crea visión, protege a su ADC en lane y es el primero en abrir teamfights. Engage, peel o healer — tú eliges el estilo.',
};

// ─── Referencia pro player por rol ─────────────────────────────────────────
const ROLE_PRO = {
  TOP:     { name: 'Zeus',      team: 'T1',    region: 'LCK' },
  JUNGLE:  { name: 'Oner',      team: 'T1',    region: 'LCK' },
  MID:     { name: 'Chovy',     team: 'GEN.G', region: 'LCK' },
  ADC:     { name: 'Gumayusi', team: 'T1',    region: 'LCK' },
  SUPPORT: { name: 'Keria',     team: 'T1',    region: 'LCK' },
};

// ─── Mini stat extras ───────────────────────────────────────────────────────
const ROLE_EXTRA = {
  TOP:     { diff: 'ALTA',   farmPriority: '★★★★☆', carry: '★★★★☆' },
  JUNGLE:  { diff: 'MUY ALTA', farmPriority: '★★★☆☆', carry: '★★★★★' },
  MID:     { diff: 'ALTA',   farmPriority: '★★★★☆', carry: '★★★★★' },
  ADC:     { diff: 'MEDIA',  farmPriority: '★★★★★', carry: '★★★★☆' },
  SUPPORT: { diff: 'MEDIA',  farmPriority: '★☆☆☆☆', carry: '★★☆☆☆' },
};

// ─── Quick info panel — visible debajo del mapa al hover/seleccionar ───────
const ROLE_QUICK_INFO = {
  TOP: {
    label:  'TOP',
    desc:   'Duelista solitario. Control de split push y 1vs1.',
    champs: 'Darius, Garen, Fiora',
  },
  JUNGLE: {
    label:  'JUNGLE',
    desc:   'Control del mapa. Tú decides qué objetivos toma tu equipo.',
    champs: 'Lee Sin, Vi, Hecarim',
  },
  MID: {
    label:  'MID',
    desc:   'Playmaker del equipo. Máximo impacto global.',
    champs: 'Ahri, Zed, Syndra',
  },
  ADC: {
    label:  'BOT / ADC',
    desc:   'Carry tardío. Tu misión es farmear y escalar.',
    champs: 'Jinx, Caitlyn, Ezreal',
  },
  SUPPORT: {
    label:  'SUPPORT',
    desc:   'Guardas la vida del ADC. La visión es tu herramienta.',
    champs: 'Thresh, Lulu, Nautilus',
  },
};

// ─── Descripción enriquecida por rol (P2-8) ─────────────────────────────────
// Tres secciones cerradas (no dependen de red ni de meta): QUÉ IMPLICA,
// FUNCIÓN y OBLIGACIONES. Se renderizan en la hoja de detalle (RoleDetailSheet)
// al tocar un rol del mapa.
const ROLE_IMPLICATIONS = {
  TOP: {
    title: 'La Isla Solitaria',
    implies:
      'Jugar aislado los primeros 15 minutos: paciencia, duelos 1v1 y sobrevivir sin ayuda de la jungla.',
    role:
      'Línea de frente (frontline): el escudo o la fuerza bruta que absorbe daño por el equipo.',
    duties:
      'Controlar el empuje (split push), iniciar peleas con control de masas y usar el teleport de forma estratégica hacia bot u objetivos.',
  },
  JUNGLE: {
    title: 'El Motor del Equipo',
    implies:
      'No tener línea fija: mapa mental constante, rastrear al jungla rival y gestionar tus campamentos.',
    role:
      'Director de orquesta: marcas el ritmo, creas superioridad con ganks y aseguras a los monstruos épicos.',
    duties:
      'Asegurar objetivos con Smite (dragones, larvas, Barón), dar ventaja a la línea con más potencial y avisar la posición del jungla enemigo.',
  },
  MID: {
    title: 'El Núcleo del Mapa',
    implies:
      'La línea más corta y peligrosa, gankeable por ambos lados: exige reflejos mecánicos.',
    role:
      'Daño explosivo y control de mapa: conectas el top con el bot.',
    duties:
      'Rotar/roamear tras limpiar la oleada, borrar objetivos prioritarios (ADC/Mid rival) y mantener la torre central.',
  },
  ADC: {
    title: 'El Seguro de Vida',
    implies:
      'Dependes del support en el early y de un posicionamiento perfecto en cada pelea.',
    role:
      'Daño constante y derribo de estructuras: la ametralladora del late game.',
    duties:
      'Farmear a la perfección, priorizar la supervivencia y liderar el asedio a torres y objetivos.',
  },
  SUPPORT: {
    title: 'El Cerebro Táctico',
    implies:
      'Sacrificar economía (no farmeas) para potenciar a tu ADC: visión y generosidad.',
    role:
      'Utilidad, protección y control de mapa: el guardaespaldas del equipo.',
    duties:
      'Guerra de visión (wards), peel/protección activa al carry y control del mapa temprano junto al jungla.',
  },
};

// ─── Helpers ────────────────────────────────────────────────────────────────
const px = (frac) => frac * MAP_SIZE;

// ─── Componente principal ───────────────────────────────────────────────────
export default function RoleConstellationScreen({ navigation }) {
  const { setMainRole, setSecondaryRole } = useContext(OnboardingContext);
  const { user } = useUser();
  const { colors: c, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  const factionKey   = user?.faction || 'ZAUN';
  const factionTheme = FACTIONS[factionKey] || FACTIONS.ZAUN;
  const fc           = factionTheme.primary; // faction color

  const [hovered,  setHovered]  = useState(null);
  const [selected, setSelected] = useState(null);
  // sheetRole: rol cuya hoja de detalle está ABIERTA. Se desacopla de `selected`
  // a propósito (P0-1): así cerrar la hoja con ✕ cierra SOLO la hoja y NO
  // deshace la selección — el botón ELEGIR (dentro de la hoja y en la barra
  // inferior) permanece disponible y se rompe el bucle "abrir → cerrar → perder
  // selección → no poder confirmar".
  const [sheetRole, setSheetRole] = useState(null);
  // shownRole mantiene el último rol durante la animación de salida
  // para que el contenido no desaparezca antes del slide-down.
  const [shownRole, setShownRole] = useState(null);

  // Animación slide-up del sheet inferior
  const sheetY = useRef(new Animated.Value(500)).current;
  const sheetO = useRef(new Animated.Value(0)).current;

  // Fade-in del panel informativo debajo del mapa cuando cambia el rol activo
  const infoOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (sheetRole) {
      setShownRole(sheetRole); // contenido listo ANTES de animar entrada
      Animated.parallel([
        Animated.spring(sheetY, { toValue: 0, tension: 90, friction: 11, useNativeDriver: true }),
        Animated.timing(sheetO, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      // animar salida primero, luego limpiar contenido
      Animated.parallel([
        Animated.timing(sheetY, { toValue: 500, duration: 220, useNativeDriver: true }),
        Animated.timing(sheetO, { toValue: 0,   duration: 150, useNativeDriver: true }),
      ]).start(({ finished }) => { if (finished) setShownRole(null); });
    }
  }, [sheetRole]);

  // Animación de pulso para cada nodo (loops desincronizados)
  const pulseAnims = useRef(
    Object.keys(ROLE_POS).reduce((acc, role, i) => {
      acc[role] = new Animated.Value(0);
      return acc;
    }, {})
  ).current;

  useEffect(() => {
    const loops = {};
    Object.entries(pulseAnims).forEach(([role, anim], i) => {
      const delay = i * 320;
      const loop  = Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, { toValue: 1, duration: 1300, useNativeDriver: false }),
          Animated.timing(anim, { toValue: 0, duration: 1300, useNativeDriver: false }),
        ])
      );
      loop.start();
      loops[role] = loop;
    });
    return () => Object.values(loops).forEach(l => l.stop());
  }, []);

  const handleConfirm = () => {
    if (!selected) return;
    setMainRole(selected);
    setSecondaryRole(null);
    navigation.navigate('Playstyle');
  };

  const activeRole = hovered || selected;

  // Animar fade-in del panel informativo cuando cambia el rol activo
  useEffect(() => {
    infoOpacity.setValue(0);
    Animated.timing(infoOpacity, {
      toValue: 1, duration: 200, useNativeDriver: true,
    }).start();
  }, [activeRole]);

  const quickInfo = activeRole ? ROLE_QUICK_INFO[activeRole] : null;

  return (
    <View style={styles.root}>
      {isDark && <NovaBackground />}
      <DevEscapeHatch />

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <Text style={styles.progressTag}>PASO 2 / 4 · MAPA DE ROLES</Text>
        <Text style={styles.title}>¿Cuál es tu rol?</Text>
        <Text style={styles.subtitle}>Toca tu posición en el mapa</Text>
      </View>

      {/* ── Mapa + nodos ───────────────────────────────────────────────── */}
      <View style={[styles.mapWrap, { width: MAP_SIZE, height: MAP_SIZE }]}>

        {/* SVG — mapa Summoner's Rift simplificado */}
        <Svg
          width={MAP_SIZE}
          height={MAP_SIZE}
          style={StyleSheet.absoluteFillObject}
        >
          <Defs>
            {/* Gradiente fondo del mapa */}
            <RadialGradient id="mapBg" cx="50%" cy="50%" r="70%">
              <Stop offset="0%"   stopColor="#0d1a14" stopOpacity="1" />
              <Stop offset="100%" stopColor="#07070d" stopOpacity="1" />
            </RadialGradient>

            {/* Glow lane */}
            <RadialGradient id="laneGlow" cx="50%" cy="50%" r="50%">
              <Stop offset="0%"   stopColor="#1a3a28" stopOpacity="0.9" />
              <Stop offset="100%" stopColor="#0d2018" stopOpacity="0"   />
            </RadialGradient>
          </Defs>

          {/* Fondo del mapa */}
          <SvgRect width={MAP_SIZE} height={MAP_SIZE} fill="url(#mapBg)" rx="12" />

          {/* Borde del mapa */}
          <SvgRect
            width={MAP_SIZE} height={MAP_SIZE}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth="1.5" rx="12"
          />

          {/* ── Lanes (carriles) ─────────────────────────────────────── */}
          {/* Carril Top: desde base (izq-abajo) sube, luego gira a la derecha */}
          <SvgPath
            d={`M ${px(0.12)},${px(0.88)} L ${px(0.12)},${px(0.14)} L ${px(0.88)},${px(0.14)}`}
            fill="none" stroke="#1e4030" strokeWidth="22"
            strokeLinecap="round" strokeLinejoin="round"
          />
          <SvgPath
            d={`M ${px(0.12)},${px(0.88)} L ${px(0.12)},${px(0.14)} L ${px(0.88)},${px(0.14)}`}
            fill="none" stroke="#26543e" strokeWidth="10"
            strokeLinecap="round" strokeLinejoin="round" strokeOpacity="0.6"
          />
          <SvgPath
            d={`M ${px(0.12)},${px(0.88)} L ${px(0.12)},${px(0.14)} L ${px(0.88)},${px(0.14)}`}
            fill="none" stroke="#3dff9044" strokeWidth="3"
            strokeLinecap="round" strokeLinejoin="round"
          />

          {/* Carril Mid: diagonal */}
          <SvgLine
            x1={px(0.12)} y1={px(0.88)} x2={px(0.88)} y2={px(0.14)}
            stroke="#1e4030" strokeWidth="22"
          />
          <SvgLine
            x1={px(0.12)} y1={px(0.88)} x2={px(0.88)} y2={px(0.14)}
            stroke="#26543e" strokeWidth="10" strokeOpacity="0.6"
          />
          <SvgLine
            x1={px(0.12)} y1={px(0.88)} x2={px(0.88)} y2={px(0.14)}
            stroke="#3dff9044" strokeWidth="3"
          />

          {/* Carril Bot: desde base va a la derecha, luego sube */}
          <SvgPath
            d={`M ${px(0.12)},${px(0.88)} L ${px(0.88)},${px(0.88)} L ${px(0.88)},${px(0.14)}`}
            fill="none" stroke="#1e4030" strokeWidth="22"
            strokeLinecap="round" strokeLinejoin="round"
          />
          <SvgPath
            d={`M ${px(0.12)},${px(0.88)} L ${px(0.88)},${px(0.88)} L ${px(0.88)},${px(0.14)}`}
            fill="none" stroke="#26543e" strokeWidth="10"
            strokeLinecap="round" strokeLinejoin="round" strokeOpacity="0.6"
          />
          <SvgPath
            d={`M ${px(0.12)},${px(0.88)} L ${px(0.88)},${px(0.88)} L ${px(0.88)},${px(0.14)}`}
            fill="none" stroke="#3dff9044" strokeWidth="3"
            strokeLinecap="round" strokeLinejoin="round"
          />

          {/* Río — franja diagonal transversal */}
          <SvgPath
            d={`M ${px(0.0)},${px(0.55)} L ${px(0.45)},${px(0.0)}`}
            stroke="#0d2a40" strokeWidth="32" strokeLinecap="round"
          />
          <SvgPath
            d={`M ${px(0.55)},${px(1.0)} L ${px(1.0)},${px(0.45)}`}
            stroke="#0d2a40" strokeWidth="32" strokeLinecap="round"
          />
          <SvgPath
            d={`M ${px(0.0)},${px(0.55)} L ${px(0.45)},${px(0.0)}`}
            stroke="#1a4a6588" strokeWidth="14" strokeLinecap="round"
          />
          <SvgPath
            d={`M ${px(0.55)},${px(1.0)} L ${px(1.0)},${px(0.45)}`}
            stroke="#1a4a6588" strokeWidth="14" strokeLinecap="round"
          />

          {/* Base azul (esquina inferior-izquierda) */}
          <SvgCircle cx={px(0.10)} cy={px(0.90)} r={px(0.07)}
            fill="#0d1f4a" stroke="#2255cc66" strokeWidth="2" />
          <SvgCircle cx={px(0.10)} cy={px(0.90)} r={px(0.035)}
            fill="#3366ff55" />

          {/* Base roja (esquina superior-derecha) */}
          <SvgCircle cx={px(0.90)} cy={px(0.10)} r={px(0.07)}
            fill="#4a0d0d" stroke="#cc222266" strokeWidth="2" />
          <SvgCircle cx={px(0.90)} cy={px(0.10)} r={px(0.035)}
            fill="#ff333355" />

          {/* ── Glow de nodos seleccionados (pulsa bajo el TouchableOpacity) ── */}
          {Object.entries(ROLE_POS).map(([role, pos]) => {
            const isActive = selected === role || hovered === role;
            if (!isActive) return null;
            return (
              <SvgCircle
                key={`glow-${role}`}
                cx={px(pos.rx)} cy={px(pos.ry)}
                r={NODE_SIZE * 0.75}
                fill={fc}
                fillOpacity="0.15"
              />
            );
          })}
        </Svg>

        {/* ── Nodos de rol (encima del SVG) ─────────────────────────── */}
        {Object.entries(ROLE_POS).map(([role, pos]) => {
          const x         = px(pos.rx);
          const y         = px(pos.ry);
          const isSelected = selected === role;
          const isHovered  = hovered  === role;
          const isActive   = isSelected || isHovered;
          const isFaded    = !!activeRole && !isActive;

          return (
            <TouchableOpacity
              key={role}
              activeOpacity={0.85}
              // Tocar un nodo selecciona el rol Y abre su hoja de detalle. Cerrar
              // la hoja (✕) no deshace la selección (P0-1); volver a tocar el
              // nodo reabre la hoja para releer la info.
              onPress={() => { setSelected(role); setSheetRole(role); }}
              // @ts-ignore — eventos DOM en RN Web
              onMouseEnter={() => setHovered(role)}
              onMouseLeave={() => setHovered(null)}
              style={[
                styles.node,
                {
                  left:       x - NODE_SIZE / 2,
                  top:        y - NODE_SIZE / 2,
                  opacity:    isFaded ? 0.28 : 1,
                  transform:  [{ scale: isActive ? 1.22 : 1 }],
                  borderColor: isSelected
                    ? fc
                    : isHovered
                    ? fc + 'AA'
                    : c.onSurface(0.20),
                  backgroundColor: isSelected
                    ? fc + '22'
                    : c.bg2,
                  shadowColor:   fc,
                  shadowOpacity: isSelected ? 0.9 : isHovered ? 0.5 : 0,
                  shadowRadius:  isSelected ? 18  : 10,
                  ...(Platform.OS === 'web' ? { cursor: 'pointer' } : {}),
                },
              ]}
            >
              <RoleIcon role={role} size={20} color={isActive ? fc : c.onSurface(0.45)} />
              <Text style={[
                styles.nodeLabel,
                { color: isActive ? fc : c.onSurface(0.4) },
              ]}>
                {role === 'SUPPORT' ? 'SUP' : role}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── Panel informativo rápido (hover/seleccionado) ─────────────── */}
      <Animated.View style={[styles.quickInfo, { opacity: infoOpacity }]}>
        {quickInfo ? (
          <>
            <Text style={styles.quickInfoLabel}>{quickInfo.label}</Text>
            <Text style={styles.quickInfoDesc}>{quickInfo.desc}</Text>
            <Text style={styles.quickInfoChamps}>Campeones: {quickInfo.champs}</Text>
          </>
        ) : (
          <Text style={styles.quickInfoHint}>
            Toca una línea del mapa para ver su descripción
          </Text>
        )}
      </Animated.View>

      {/* ── Role detail sheet ──────────────────────────────────────────── */}
      <Animated.View
        style={[
          styles.sheet,
          {
            opacity:   sheetO,
            transform: [{ translateY: sheetY }],
          },
        ]}
        pointerEvents={shownRole ? 'auto' : 'none'}
      >
        {shownRole && (
          <RoleDetailSheet
            role={shownRole}
            factionColor={fc}
            // ✕ cierra SOLO la hoja; mantiene `selected` para que ELEGIR siga activo.
            onClose={() => setSheetRole(null)}
            // Botón grande "ELEGIR ESTE ROL →" dentro de la hoja (P0-1): confirma
            // sin depender de la barra inferior, que la hoja tapa en móvil.
            onConfirm={handleConfirm}
          />
        )}
      </Animated.View>

      {/* ── Confirm bar ────────────────────────────────────────────────── */}
      <View style={[styles.confirmBar, selected && styles.confirmBarRaised]}>
        {!selected && (
          <TouchableOpacity
            style={styles.quizBtn}
            onPress={() => navigation.navigate('RoleQuiz')}
            activeOpacity={0.75}
          >
            <Text style={styles.quizBtnText}>¿NO SABES? HAZ EL TEST →</Text>
          </TouchableOpacity>
        )}
        <NovaButton
          label={selected ? `ELEGIR ${selected} →` : 'TOCA UN ROL'}
          factionColor={c.primary}
          size="lg"
          disabled={!selected}
          onPress={handleConfirm}
        />
      </View>
    </View>
  );
}

// ─── RoleDetailSheet — panel inferior con toda la info del rol ─────────────
function RoleDetailSheet({ role, factionColor, onClose, onConfirm }) {
  const { colors: c } = useTheme();
  const sheet = useMemo(() => makeSheet(c), [c]);
  const champ   = ROLE_STAR_CHAMPION[role] || 'Ahri';
  const tagline = ROLE_TAGLINE[role]       || '';
  const stats   = ROLE_STATS[role]         || [];
  const desc    = ROLE_DESC[role]          || '';
  const pro     = ROLE_PRO[role]           || {};
  const extra   = ROLE_EXTRA[role]         || {};
  const impl    = ROLE_IMPLICATIONS[role]  || null; // P2-8

  return (
    <View style={sheet.container}>
      {/* Drag handle */}
      <View style={sheet.handle} />

      {/* Champion splash + overlay */}
      <View style={sheet.splashWrap}>
        <ChampionImage name={champ} style={sheet.splash} resizeMode="cover" />
        <View style={sheet.splashOverlay} />

        {/* Role badge sobre la splash */}
        <View style={[sheet.roleBadge, { borderColor: factionColor + '55', backgroundColor: factionColor + '18' }]}>
          <Text style={[sheet.roleBadgeText, { color: factionColor }]}>{role}</Text>
        </View>

        {/* Botón cerrar */}
        <TouchableOpacity style={sheet.closeBtn} onPress={onClose} activeOpacity={0.7}>
          <Text style={sheet.closeBtnText}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView
        style={sheet.scroll}
        contentContainerStyle={sheet.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Tagline */}
        <Text style={sheet.tagline}>{tagline}</Text>

        {/* Descripción */}
        <Text style={sheet.desc}>{desc}</Text>

        {/* Descripción enriquecida (P2-8): QUÉ IMPLICA / FUNCIÓN / OBLIGACIONES */}
        {impl && (
          <View style={sheet.implWrap}>
            <Text style={[sheet.implRoleTitle, { color: factionColor }]}>
              «{impl.title}»
            </Text>
            <View style={sheet.implSection}>
              <Text style={[sheet.implHeading, { color: factionColor + 'CC' }]}>QUÉ IMPLICA</Text>
              <Text style={sheet.implBody}>{impl.implies}</Text>
            </View>
            <View style={sheet.implSection}>
              <Text style={[sheet.implHeading, { color: factionColor + 'CC' }]}>FUNCIÓN</Text>
              <Text style={sheet.implBody}>{impl.role}</Text>
            </View>
            <View style={sheet.implSection}>
              <Text style={[sheet.implHeading, { color: factionColor + 'CC' }]}>OBLIGACIONES</Text>
              <Text style={sheet.implBody}>{impl.duties}</Text>
            </View>
          </View>
        )}

        {/* Stats row */}
        <View style={sheet.statsRow}>
          {stats.map((s) => (
            <View key={s.label} style={sheet.statCell}>
              <Text style={sheet.statLabel}>{s.label}</Text>
              <Text style={[sheet.statValue, { color: s.color || factionColor }]}>{s.value}</Text>
            </View>
          ))}
        </View>

        {/* Extra stats */}
        <View style={sheet.extraRow}>
          <View style={sheet.extraCell}>
            <Text style={sheet.extraLabel}>DIFICULTAD</Text>
            <Text style={[sheet.extraValue, { color: '#ff7744' }]}>{extra.diff}</Text>
          </View>
          <View style={sheet.extraCell}>
            <Text style={sheet.extraLabel}>FARMEO</Text>
            <Text style={[sheet.extraValue, { color: '#ffd700' }]}>{extra.farmPriority}</Text>
          </View>
          <View style={sheet.extraCell}>
            <Text style={sheet.extraLabel}>CARRY POT.</Text>
            <Text style={[sheet.extraValue, { color: factionColor }]}>{extra.carry}</Text>
          </View>
        </View>

        {/* Pro player reference */}
        <View style={[sheet.proBox, { borderColor: factionColor + '33' }]}>
          <Text style={sheet.proTitle}>REFERENCIA PRO</Text>
          <View style={sheet.proRow}>
            <View style={[sheet.proIcon, { backgroundColor: factionColor + '22', borderColor: factionColor + '55' }]}>
              <Text style={[sheet.proIconText, { color: factionColor }]}>
                {pro.name?.[0] || '?'}
              </Text>
            </View>
            <View>
              <Text style={sheet.proName}>{pro.name}</Text>
              <Text style={sheet.proTeam}>{pro.team} · {pro.region}</Text>
            </View>
            <View style={[sheet.proBadge, { backgroundColor: factionColor + '22', borderColor: factionColor + '44' }]}>
              <Text style={[sheet.proBadgeText, { color: factionColor }]}>{role}</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* CTA grande SIEMPRE visible dentro de la hoja (P0-1): confirma el rol
          sin depender de la barra inferior, que la hoja tapa en móvil. Queda
          fuera del ScrollView para no perderse al hacer scroll del detalle. */}
      <View style={sheet.ctaWrap}>
        <NovaButton
          label="ELEGIR ESTE ROL →"
          factionColor={c.primary}
          size="lg"
          onPress={() => onConfirm && onConfirm()}
        />
      </View>
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────
const makeStyles = (c) => StyleSheet.create({
  root: { flex: 1, backgroundColor: c.bg0 },

  header: { paddingHorizontal: 20, paddingTop: 56, paddingBottom: 10 },
  progressTag: {
    color: c.onSurface(0.4), fontSize: TYPE_SCALE.micro.size,
    letterSpacing: 3, fontWeight: '900',
  },
  title:    { color: c.textPrimary, fontSize: TYPE_SCALE.h4.size, fontWeight: '900', letterSpacing: 1.5, marginTop: 4 },
  subtitle: { color: c.onSurface(0.4), fontSize: TYPE_SCALE.caption.size, marginTop: 3 },

  mapWrap: {
    alignSelf: 'center',
    position: 'relative',
    marginTop: 8,
    borderRadius: 12,
    overflow: 'hidden',
  },

  node: {
    position: 'absolute',
    width:    NODE_SIZE,
    height:   NODE_SIZE,
    borderRadius: NODE_SIZE / 2,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
    gap: 3,
  },
  nodeLabel: {
    fontSize: TYPE_SCALE.micro.size,
    fontWeight: '900',
    letterSpacing: 1,
  },

  // Panel informativo bajo el mapa
  quickInfo: {
    alignSelf: 'center',
    width: MAP_SIZE,
    marginTop: 12,
    backgroundColor: 'rgba(123,118,221,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(123,118,221,0.2)',
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  quickInfoLabel: {
    color: c.primary,
    fontSize: TYPE_SCALE.label.size,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  quickInfoDesc: {
    color: c.onSurface(0.65),
    fontSize: TYPE_SCALE.caption.size,
    lineHeight: 16,
  },
  quickInfoChamps: {
    color: c.onSurface(0.5),
    fontSize: TYPE_SCALE.caption.size,
  },
  quickInfoHint: {
    color: c.onSurface(0.4),
    fontSize: TYPE_SCALE.caption.size,
    fontStyle: 'italic',
    textAlign: 'center',
  },

  // Sheet inferior
  sheet: {
    position: 'absolute',
    left:   0,
    right:  0,
    bottom: 80, // encima del confirm bar
    maxHeight: SH * 0.55,
    zIndex: 10,
  },

  // Confirm bar
  confirmBar: {
    position: 'absolute',
    bottom:   0,
    left:     0,
    right:    0,
    padding:  16,
    paddingBottom: Platform.OS === 'ios' ? 32 : 20,
    backgroundColor: c.bg2,
    borderTopWidth:  1,
    borderTopColor:  c.onSurface(0.06),
    gap: 8,
    ...(Platform.OS === 'web'
      ? { backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }
      : {}),
  },
  confirmBarRaised: {},

  quizBtn: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  quizBtnText: {
    color: c.onSurface(0.4),
    fontSize: TYPE_SCALE.caption.size,
    fontWeight: '700',
    letterSpacing: 2,
  },
});

const SHEET_SPLASH_H = 130;

const makeSheet = (c) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: c.bg2,
    borderTopLeftRadius:  18,
    borderTopRightRadius: 18,
    borderWidth: 1,
    borderColor: c.onSurface(0.08),
    overflow: 'hidden',
    ...(Platform.OS === 'web'
      ? { backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)' }
      : {}),
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: c.onSurface(0.2),
    marginTop: 8,
    marginBottom: 4,
  },

  // Splash art
  splashWrap: {
    height: SHEET_SPLASH_H,
    overflow: 'hidden',
    position: 'relative',
  },
  splash: {
    ...StyleSheet.absoluteFillObject,
    width:  '100%',
    height: SHEET_SPLASH_H,
  },
  splashOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(7,7,13,0.5)',
  },
  roleBadge: {
    position:  'absolute',
    bottom:    10,
    left:      14,
    paddingHorizontal: 10,
    paddingVertical:   4,
    borderRadius: 6,
    borderWidth: 1,
  },
  roleBadgeText: {
    fontSize: TYPE_SCALE.caption.size, fontWeight: '900', letterSpacing: 3,
  },
  closeBtn: {
    position: 'absolute',
    top:   10,
    right: 12,
    width:  28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: { color: 'rgba(255,255,255,0.7)', fontSize: TYPE_SCALE.label.size },

  // Content
  scroll: { flex: 1 },
  scrollContent: { flexGrow: 1, padding: 14, gap: 10, paddingBottom: 20 },

  tagline: {
    color: c.onSurface(0.55),
    fontSize: TYPE_SCALE.caption.size, fontStyle: 'italic', letterSpacing: 0.5,
  },
  desc: {
    color: c.onSurface(0.8),
    fontSize: TYPE_SCALE.label.size, lineHeight: 19,
  },

  // Descripción enriquecida (P2-8)
  implWrap: { gap: 12, marginTop: 2 },
  implRoleTitle: {
    fontSize: TYPE_SCALE.label.size, fontWeight: '900',
    letterSpacing: 0.5, fontStyle: 'italic',
  },
  implSection: { gap: 3 },
  implHeading: {
    fontSize: TYPE_SCALE.micro.size, fontWeight: '900', letterSpacing: 2,
  },
  implBody: {
    color: c.onSurface(0.8),
    fontSize: TYPE_SCALE.caption.size, lineHeight: 17,
  },

  // CTA grande pinned al fondo de la hoja
  ctaWrap: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 14,
    borderTopWidth: 1,
    borderTopColor: c.onSurface(0.08),
  },

  // Stats
  statsRow: { flexDirection: 'row', gap: 8 },
  statCell: {
    flex: 1,
    backgroundColor: c.onSurface(0.05),
    borderRadius: 8,
    padding: 8,
    alignItems: 'center',
  },
  statLabel: {
    color: c.onSurface(0.35),
    fontSize: TYPE_SCALE.micro.size, fontWeight: '900', letterSpacing: 1.5,
  },
  statValue: {
    fontSize: TYPE_SCALE.label.size, fontWeight: '900', marginTop: 3,
  },

  // Extra stats
  extraRow: {
    flexDirection: 'row', gap: 8,
  },
  extraCell: {
    flex: 1,
    backgroundColor: c.onSurface(0.04),
    borderRadius: 8,
    padding: 8,
    alignItems: 'center',
  },
  extraLabel: {
    color: c.onSurface(0.3),
    fontSize: TYPE_SCALE.micro.size, fontWeight: '900', letterSpacing: 1.5,
  },
  extraValue: {
    fontSize: TYPE_SCALE.caption.size, fontWeight: '700', marginTop: 3, letterSpacing: 0.5,
  },

  // Pro player
  proBox: {
    borderWidth: 1, borderRadius: 10,
    padding: 12, gap: 8,
  },
  proTitle: {
    color: c.onSurface(0.35),
    fontSize: TYPE_SCALE.micro.size, fontWeight: '900', letterSpacing: 2,
  },
  proRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  proIcon: {
    width: 36, height: 36, borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  proIconText: { fontSize: TYPE_SCALE.body.size, fontWeight: '900' },
  proName:     { color: c.textPrimary, fontSize: TYPE_SCALE.body.size, fontWeight: '900' },
  proTeam:     { color: c.onSurface(0.45), fontSize: TYPE_SCALE.caption.size },
  proBadge: {
    marginLeft: 'auto',
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 6, borderWidth: 1,
  },
  proBadgeText: { fontSize: TYPE_SCALE.micro.size, fontWeight: '900', letterSpacing: 1.5 },
});
