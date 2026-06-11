// ============================================================================
// TacticalIntelligenceHUD — visualización del Motor de Recomendación
// ----------------------------------------------------------------------------
// Pinta de forma rica el output del motor táctico del backend. Consume:
// items (recommendationItems) : ítems rankeados con sub-scores
// (threatMitigation, matchupValue, timingFit, synergyScore) y confianza.
// reasons : motivos legibles del razonamiento.
// totalScore / confidence : score del ítem top y confianza global 0-1.
// threat : threatScore, damageProfile, ccTags,
// triggeredRules (perfil de amenaza enemiga).
//
// Es puramente presentacional + animado (radar sweep, partículas en el TOP
// PICK, barras con shimmer, entrada en cascada). Si no llegan items, no
// renderiza nada. Sin dependencias extra (solo react-native core).
// ============================================================================
import React, { useEffect, useRef, useMemo } from 'react';
import {
  View, Text, StyleSheet, Animated, Image, Easing,
} from 'react-native';
import { getItemImageUrl, getItemIdByName } from '../utils/dataDragon';
import { useTheme } from '../context/ThemeContext';
import HexagonalRadar from './HexagonalRadar';

// ─── Helpers ────────────────────────────────────────────────────────────────
const profileColor = (profile) => {
  switch ((profile || '').toUpperCase()) {
    case 'AD':    return '#FF7043';
    case 'AP':    return '#7E57C2';
    case 'MIXED': return '#FFB300';
    case 'TRUE':  return '#26C6DA';
    default:      return '#9E9E9E';
  }
};

const threatColor = (score) => {
  if (score >= 80) return '#E53935';
  if (score >= 60) return '#FB8C00';
  if (score >= 40) return '#FDD835';
  return '#43A047';
};

const confidenceColor = (c) => {
  if (c >= 0.7) return '#43A047';
  if (c >= 0.4) return '#FDD835';
  return '#E53935';
};

// ─── Componente: barra de score con shimmer animado ───────────────────────
function ScoreBar({ label, value, color, max = 100, delay = 0 }) {
  const { colors: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const widthAnim = useRef(new Animated.Value(0)).current;
  const shimmerAnim = useRef(new Animated.Value(-1)).current;

  useEffect(() => {
    let shimmerLoop = null;
    const fillSeq = Animated.sequence([
      Animated.delay(delay),
      Animated.timing(widthAnim, {
        toValue: Math.min(1, (value || 0) / max),
        duration: 800,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
    ]);
    fillSeq.start(({ finished }) => {
      if (!finished) return;
      // Tras el fill, shimmer pasa de izq a der
      shimmerLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(shimmerAnim, { toValue: 1,  duration: 1800, useNativeDriver: false }),
          Animated.delay(2200),
          Animated.timing(shimmerAnim, { toValue: -1, duration: 0,    useNativeDriver: false }),
        ])
      );
      shimmerLoop.start();
    });
    // Cleanup — sin esto cada cambio de `value` (y el desmontaje) dejaba un
    // loop de shimmer huérfano corriendo → fuga de animaciones.
    return () => {
      fillSeq.stop();
      if (shimmerLoop) shimmerLoop.stop();
    };
  }, [value]);

  const width = widthAnim.interpolate({
    inputRange: [0, 1], outputRange: ['0%', '100%'],
  });
  const shimmerLeft = shimmerAnim.interpolate({
    inputRange: [-1, 1], outputRange: ['-30%', '110%'],
  });

  return (
    <View style={styles.scoreBarRow}>
      <Text style={styles.scoreBarLabel}>{label}</Text>
      <View style={styles.scoreBarTrack}>
        <Animated.View style={[styles.scoreBarFill, { width, backgroundColor: color }]}>
          {/* Shimmer overlay */}
          <Animated.View
            style={[styles.shimmerOverlay, { left: shimmerLeft, backgroundColor: '#FFFFFF44' }]}
          />
        </Animated.View>
      </View>
      <Text style={[styles.scoreBarValue, { color }]}>{Math.round(value || 0)}</Text>
    </View>
  );
}

// ─── Componente: gauge circular del threat con radar sweep ────────────────
function ThreatGauge({ score, theme }) {
  const { colors: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const sweepAnim = useRef(new Animated.Value(0)).current;
  const numberAnim = useRef(new Animated.Value(0)).current;
  const color = threatColor(score);

  useEffect(() => {
    // Pulso
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.05, duration: 1100, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,    duration: 1100, useNativeDriver: true }),
      ])
    );
    pulseLoop.start();
    // Sweep continuo (rotación 360 cada 3s)
    const sweepLoop = Animated.loop(
      Animated.timing(sweepAnim, { toValue: 1, duration: 3000, easing: Easing.linear, useNativeDriver: true })
    );
    sweepLoop.start();
    // Número que cuenta de 0 hasta el score
    Animated.timing(numberAnim, {
      toValue: score,
      duration: 1400,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    // Cleanup — cada cambio de `score` relanzaba pulse+sweep sin parar los
    // anteriores, y al desmontar seguían corriendo → fuga de animaciones.
    return () => {
      pulseLoop.stop();
      sweepLoop.stop();
      numberAnim.stopAnimation();
    };
  }, [score]);

  const sweepRotate = sweepAnim.interpolate({
    inputRange: [0, 1], outputRange: ['0deg', '360deg'],
  });

  // Convertimos numberAnim → integer para mostrarlo
  const [displayScore, setDisplayScore] = React.useState(0);
  useEffect(() => {
    const id = numberAnim.addListener(({ value }) => setDisplayScore(Math.round(value)));
    return () => numberAnim.removeListener(id);
  }, [score]);

  return (
    <Animated.View style={[styles.gaugeContainer, { transform: [{ scale: pulseAnim }] }]}>
      <View style={[styles.gaugeOuter, { borderColor: color, shadowColor: color }]}>

        {/* Sweep rotando — un sector triangular fino */}
        <Animated.View
          style={[
            styles.sweepWrap,
            { transform: [{ rotate: sweepRotate }] },
          ]}
          pointerEvents="none"
        >
          <View style={[styles.sweepLine, { backgroundColor: color, shadowColor: color }]} />
          <View style={[styles.sweepFade, { backgroundColor: color + '33' }]} />
        </Animated.View>

        <View style={[styles.gaugeInner, { backgroundColor: '#000A', borderColor: color + '88' }]}>
          <Text style={[styles.gaugeValue, { color }]}>{displayScore}</Text>
          <Text style={styles.gaugeMax}>/100</Text>
        </View>
      </View>
      <Text style={[styles.gaugeLabel, { color: c.textPrimary + 'CC' }]}>NIVEL DE AMENAZA</Text>
    </Animated.View>
  );
}

// ─── Componente: Damage Profile bar (AD/AP/MIXED proporcional) ─────────────
function DamageProfileBar({ profile, theme, items = [] }) {
  const { colors: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  // Inferimos proporción de AD/AP/MIXED a partir del damage profile dominante.
  // En v3 podríamos consumir los CC tags y los matchups reales.
  const proportions = useMemo(() => {
    const p = (profile || '').toUpperCase();
    if (p === 'AD')    return { AD: 70, AP: 20, MIXED: 10 };
    if (p === 'AP')    return { AD: 15, AP: 70, MIXED: 15 };
    if (p === 'MIXED') return { AD: 35, AP: 35, MIXED: 30 };
    return { AD: 33, AP: 33, MIXED: 34 };
  }, [profile]);

  const adAnim    = useRef(new Animated.Value(0)).current;
  const apAnim    = useRef(new Animated.Value(0)).current;
  const mixedAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(adAnim,    { toValue: proportions.AD,    duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
      Animated.timing(apAnim,    { toValue: proportions.AP,    duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
      Animated.timing(mixedAnim, { toValue: proportions.MIXED, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
    ]).start();
  }, [profile]);

  const adWidth    = adAnim.interpolate({    inputRange: [0, 100], outputRange: ['0%', '100%'] });
  const apWidth    = apAnim.interpolate({    inputRange: [0, 100], outputRange: ['0%', '100%'] });
  const mixedWidth = mixedAnim.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] });

  return (
    <View>
      <Text style={[styles.miniLabel, { color: c.textPrimary + '77', marginBottom: 6 }]}>DISTRIBUCIÓN DE DAÑO</Text>
      <View style={styles.dmgStackTrack}>
        <Animated.View style={[styles.dmgStackSeg, { width: adWidth,    backgroundColor: '#FF7043' }]} />
        <Animated.View style={[styles.dmgStackSeg, { width: apWidth,    backgroundColor: '#7E57C2' }]} />
        <Animated.View style={[styles.dmgStackSeg, { width: mixedWidth, backgroundColor: '#FFB300' }]} />
      </View>
      <View style={styles.dmgLegendRow}>
        <View style={styles.dmgLegendItem}>
          <View style={[styles.dmgLegendDot, { backgroundColor: '#FF7043' }]} />
          <Text style={styles.dmgLegendText}>AD {proportions.AD}%</Text>
        </View>
        <View style={styles.dmgLegendItem}>
          <View style={[styles.dmgLegendDot, { backgroundColor: '#7E57C2' }]} />
          <Text style={styles.dmgLegendText}>AP {proportions.AP}%</Text>
        </View>
        <View style={styles.dmgLegendItem}>
          <View style={[styles.dmgLegendDot, { backgroundColor: '#FFB300' }]} />
          <Text style={styles.dmgLegendText}>MIXED {proportions.MIXED}%</Text>
        </View>
      </View>
    </View>
  );
}

// ─── Componente: Sparkle particles (TOP PICK shimmer) ──────────────────────
function SparkleField({ count = 8, color = '#FFB300' }) {
  const particles = useRef(
    Array.from({ length: count }).map(() => ({
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: 2 + Math.random() * 3,
      delay: Math.random() * 1500,
      duration: 1000 + Math.random() * 1200,
      opacity: new Animated.Value(0),
    }))
  ).current;

  useEffect(() => {
    const loops = particles.map(p =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(p.delay),
          Animated.timing(p.opacity, { toValue: 1, duration: p.duration / 2, useNativeDriver: true }),
          Animated.timing(p.opacity, { toValue: 0, duration: p.duration / 2, useNativeDriver: true }),
        ])
      )
    );
    loops.forEach(l => l.start());
    // Cleanup — parar los loops de cada sparkle al desmontar (fuga de
    // animaciones / pending callbacks en NativeAnimatedModule).
    return () => loops.forEach(l => l.stop());
  }, []);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {particles.map((p, i) => (
        <Animated.View
          key={i}
          style={{
            position: 'absolute',
            top: `${p.y}%`,
            left: `${p.x}%`,
            width: p.size,
            height: p.size,
            borderRadius: p.size / 2,
            backgroundColor: color,
            opacity: p.opacity,
            shadowColor: color,
            shadowOpacity: 1,
            shadowRadius: 4,
            shadowOffset: { width: 0, height: 0 },
          }}
        />
      ))}
    </View>
  );
}

// ─── Componente: chip ───────────────────────────────────────────────────────
function Chip({ text, color, dim = false }) {
  const { colors: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
    <View style={[
      styles.chip,
      { borderColor: color, backgroundColor: color + (dim ? '11' : '22') },
    ]}>
      <Text style={[styles.chipText, { color }]}>{text}</Text>
    </View>
  );
}

// ─── Componente: tarjeta de item rankeado ──────────────────────────────────
function RankedItemCard({ item, rank, theme }) {
  const { colors: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const scaleAnim = useRef(new Animated.Value(0.96)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 600, delay: rank * 140, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, friction: 7, tension: 60, delay: rank * 140, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, friction: 6, tension: 80, delay: rank * 140, useNativeDriver: true }),
    ]).start();
  }, []);

  const itemId = getItemIdByName(item.itemName) || item.itemId;
  const isTop = rank === 0;
  const accent = isTop ? '#FFB300' : theme.primary;
  const confColor = confidenceColor(item.confidence);

  return (
    <Animated.View style={{
      opacity: fadeAnim,
      transform: [{ translateY: slideAnim }, { scale: scaleAnim }],
    }}>
      <View style={[
        styles.itemCard,
        {
          borderColor: accent + '88',
          backgroundColor: c.surface,
          shadowColor: accent,
          shadowOpacity: isTop ? 0.55 : 0.25,
          shadowRadius: isTop ? 14 : 6,
          elevation: isTop ? 10 : 3,
        },
      ]}>
        {/* Sparkles si es top pick */}
        {isTop && <SparkleField count={10} color="#FFB300" />}

        {isTop && <View style={styles.topBadge}><Text style={styles.topBadgeText}>TOP PICK</Text></View>}

        <View style={styles.itemCardHeader}>
          {itemId && (
            <Image
              source={{ uri: getItemImageUrl(itemId) }}
              style={[styles.itemImage, { borderColor: accent }]}
            />
          )}
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={[styles.itemRank, { color: accent + 'BB' }]}>#{rank + 1}</Text>
            <Text style={[styles.itemName, { color: c.textPrimary }]} numberOfLines={2}>
              {item.itemName}
            </Text>
            <View style={styles.itemMetricsRow}>
              <Text style={[styles.itemTotalScore, { color: accent }]}>
                {(item.scoreTotal || 0).toFixed(1)}
              </Text>
              <Text style={[styles.itemTotalLabel, { color: c.textPrimary + '77' }]}>SCORE</Text>
              <View style={styles.itemDivider} />
              <Text style={[styles.itemConfidence, { color: confColor }]}>
                {Math.round((item.confidence || 0) * 100)}%
              </Text>
              <Text style={[styles.itemTotalLabel, { color: c.textPrimary + '77' }]}>CONF.</Text>
            </View>
          </View>
        </View>

        {/* Sub-scores */}
        <View style={styles.subScores}>
          <ScoreBar label="THREAT"  value={item.threatMitigation} color="#E53935" delay={rank * 140 + 200} />
          <ScoreBar label="MATCHUP" value={item.matchupValue}     color="#FB8C00" delay={rank * 140 + 280} />
          <ScoreBar label="TIMING"  value={item.timingFit}        color="#1E88E5" delay={rank * 140 + 360} />
          <ScoreBar label="SYNERGY" value={item.synergyScore}     color="#7CB342" delay={rank * 140 + 440} />
        </View>

        {item.explanation && (
          <Text style={[styles.itemExplanation, { color: c.textPrimary + 'BB', borderLeftColor: accent }]}>
            {item.explanation}
          </Text>
        )}
      </View>
    </Animated.View>
  );
}

// ─── Generador de dots para el radar hexagonal ─────────────────────────────
// Pinta 5 puntos rojos (1 por cada enemigo) distribuidos a 72° entre sí.
// La distancia al centro es proporcional al threat score (más cerca = más peligro).
function generateEnemyDots(threat, items) {
  const baseDistance = 50;
  const variance = (threat?.threatScore || 50) / 100;
  return Array.from({ length: 5 }).map((_, i) => ({
    angle: i * 72 + (i % 2 === 0 ? 8 : -12),
    distance: baseDistance + 25 * variance + (i % 3) * 4,
    color: i === 0 ? '#FFB300' : i % 2 === 0 ? '#E53935' : '#7E57C2',
  }));
}

// ─── Hook: animación de entrada en cascada ─────────────────────────────────
function useStaggeredEntry(delay = 0) {
  const fade = useRef(new Animated.Value(0)).current;
  const translate = useRef(new Animated.Value(20)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade,      { toValue: 1, duration: 600, delay, useNativeDriver: true }),
      Animated.spring(translate, { toValue: 0, friction: 7, delay, useNativeDriver: true }),
    ]).start();
  }, []);
  return { opacity: fade, transform: [{ translateY: translate }] };
}

// ─── Componente principal ──────────────────────────────────────────────────
export default function TacticalIntelligenceHUD({
  totalScore,
  confidence,
  reasons = [],
  items = [],
  threat,
  policyVersion,
  tradeoff,
  theme,
}) {
  const { colors: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  if (!items || items.length === 0) return null;

  const confColor = confidenceColor(confidence);

  // Animaciones de entrada para los bloques principales
  const headerStyle    = useStaggeredEntry(0);
  const threatStyle    = useStaggeredEntry(150);
  const dmgStyle       = useStaggeredEntry(300);
  const itemsStyle     = useStaggeredEntry(450);
  const reasonsStyle   = useStaggeredEntry(600);

  return (
    <View style={[styles.hudContainer, { borderColor: theme.primary + '66', backgroundColor: c.surface + 'EE' }]}>

      {/* ─── Header con badges ─────────────────────────────── */}
      <Animated.View style={[styles.hudHeader, headerStyle]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.hudTitle, { color: theme.primary }]}>MOTOR TÁCTICO</Text>
          <Text style={[styles.hudSubtitle, { color: c.textPrimary + '88' }]}>
            v{policyVersion || '1.0.0'} · análisis determinista · KB JPA
          </Text>
        </View>
        <View style={[styles.statBox, { borderColor: confColor }]}>
          <Text style={[styles.statBoxValue, { color: confColor }]}>
            {Math.round((confidence || 0) * 100)}%
          </Text>
          <Text style={styles.statBoxLabel}>CONF.</Text>
        </View>
      </Animated.View>

      {/* ─── Bloque amenaza (radar hexagonal SVG + chips) ──── */}
      {threat && (
        <Animated.View style={[styles.threatBlock, threatStyle]}>
          {/* Hexagonal radar real con SVG — sustituye al gauge circular antiguo */}
          <HexagonalRadar
            threatScore={threat.threatScore || 0}
            color={theme.primary}
            size={180}
            label="NIVEL DE AMENAZA"
            enemyDots={generateEnemyDots(threat, items)}
          />

          <View style={styles.threatRight}>
            <Text style={[styles.miniLabel, { color: c.textPrimary + '77' }]}>REGLAS DISPARADAS</Text>
            <Text style={[styles.rulesCount, { color: theme.primary }]}>
              {threat.triggeredRules || 0}
            </Text>

            <Text style={[styles.miniLabel, { color: c.textPrimary + '77', marginTop: 8 }]}>
              CC DETECTADO
            </Text>
            <View style={styles.chipsRow}>
              {(threat.ccTags || []).slice(0, 6).map((tag, i) => (
                <Chip key={i} text={tag} color="#E53935" />
              ))}
              {(!threat.ccTags || threat.ccTags.length === 0) && (
                <Text style={[styles.miniLabel, { color: c.textPrimary + '55' }]}>—</Text>
              )}
            </View>
          </View>
        </Animated.View>
      )}

      {/* ─── Distribución de daño ─────────────────────────── */}
      {threat && (
        <Animated.View style={[{ marginBottom: 16 }, dmgStyle]}>
          <DamageProfileBar profile={threat.damageProfile} theme={theme} items={items} />
        </Animated.View>
      )}

      {/* ─── Items rankeados ────────────────────────────────── */}
      <Animated.View style={itemsStyle}>
        <Text style={[styles.sectionTitle, { color: theme.primary }]}>
          ITEMS RANKEADOS POR SCORING
        </Text>
        {items.slice(0, 5).map((item, i) => (
          <RankedItemCard key={i} item={item} rank={i} theme={theme} />
        ))}
      </Animated.View>

      {/* ─── Reasons ────────────────────────────────────────── */}
      {reasons.length > 0 && (
        <Animated.View style={[styles.reasonsBlock, reasonsStyle]}>
          <Text style={[styles.sectionTitle, { color: theme.primary, marginBottom: 8 }]}>
            RAZONAMIENTO DEL MOTOR
          </Text>
          {reasons.map((reason, i) => (
            <View key={i} style={styles.reasonRow}>
              <Text style={[styles.reasonBullet, { color: theme.primary }]}>▸</Text>
              <Text style={[styles.reasonText, { color: c.textPrimary }]}>{reason}</Text>
            </View>
          ))}
        </Animated.View>
      )}

      {/* ─── Tradeoff ───────────────────────────────────────── */}
      {tradeoff && (
        <Animated.View style={[styles.tradeoffBlock, reasonsStyle, { borderLeftColor: '#FFB300', backgroundColor: '#FFB30011' }]}>
          <Text style={[styles.miniLabel, { color: '#FFB300', marginBottom: 4 }]}>
            TRADE-OFF PRINCIPAL
          </Text>
          <Text style={[styles.tradeoffText, { color: c.textPrimary }]}>{tradeoff}</Text>
        </Animated.View>
      )}
    </View>
  );
}

// ─── Estilos ────────────────────────────────────────────────────────────────
const makeStyles = (c) => StyleSheet.create({
  // Glassmorphism del contenedor del HUD (consistente con el resto de la app).
  hudContainer: {
    borderWidth: 1, borderRadius: 16, padding: 16, marginBottom: 16,
    borderTopWidth: 1, borderTopColor: c.onSurface(0.10),
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 32,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  hudHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingBottom: 12, marginBottom: 12,
    borderBottomWidth: 1, borderBottomColor: c.onSurface(0.08),
  },
  hudTitle: { fontSize: 16, fontWeight: '900', letterSpacing: 3 },
  hudSubtitle: { fontSize: 10, marginTop: 2, letterSpacing: 1 },

  statBox: {
    borderWidth: 1.5, borderRadius: 8, paddingVertical: 6, paddingHorizontal: 12,
    alignItems: 'center', minWidth: 64,
  },
  statBoxValue: { fontSize: 18, fontWeight: '900' },
  statBoxLabel: { fontSize: 9, color: '#888', letterSpacing: 1, marginTop: 1 },

  // Bloque amenaza
  threatBlock: {
    flexDirection: 'row', alignItems: 'center',
    marginBottom: 16, paddingVertical: 8,
  },
  threatRight: { flex: 1, marginLeft: 16 },

  // Threat gauge
  gaugeContainer: { alignItems: 'center' },
  gaugeOuter: {
    width: 120, height: 120, borderRadius: 60,
    borderWidth: 4, justifyContent: 'center', alignItems: 'center',
    shadowOpacity: 0.6, shadowRadius: 14, elevation: 6,
    overflow: 'hidden',
  },
  // Sweep — círculo invisible que rota; dentro hay un sector "puntero"
  sweepWrap: {
    position: 'absolute',
    width: '100%', height: '100%',
    justifyContent: 'flex-start', alignItems: 'center',
  },
  sweepLine: {
    width: 2, height: '50%',
    shadowOpacity: 1, shadowRadius: 6, shadowOffset: { width: 0, height: 0 },
  },
  sweepFade: {
    position: 'absolute', top: 0,
    width: 30, height: '50%',
    borderTopLeftRadius: 30, borderTopRightRadius: 30,
    transform: [{ skewX: '-15deg' }],
  },
  gaugeInner: {
    width: 92, height: 92, borderRadius: 46,
    borderWidth: 1.5, justifyContent: 'center', alignItems: 'center',
  },
  gaugeValue: { fontSize: 32, fontWeight: '900' },
  gaugeMax:   { fontSize: 11, color: '#888', marginTop: -2 },
  gaugeLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 2, marginTop: 6 },

  miniLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5 },

  rulesCount: { fontSize: 22, fontWeight: '900', marginTop: 2 },

  // CC chips
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  chip: {
    borderWidth: 1, borderRadius: 12,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  chipText: { fontSize: 10, fontWeight: '800', letterSpacing: 1 },

  // Damage stack bar
  dmgStackTrack: {
    flexDirection: 'row', height: 12, borderRadius: 6, overflow: 'hidden',
    backgroundColor: c.onSurface(0.06),
  },
  dmgStackSeg: { height: 12 },
  dmgLegendRow: {
    flexDirection: 'row', justifyContent: 'space-between', marginTop: 6,
  },
  dmgLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dmgLegendDot: { width: 8, height: 8, borderRadius: 4 },
  dmgLegendText: { fontSize: 10, color: '#bbb', fontWeight: '800', letterSpacing: 0.5 },

  // Section titles
  sectionTitle: {
    fontSize: 13, fontWeight: '900', letterSpacing: 2,
    marginTop: 6, marginBottom: 10,
  },

  // Item card
  itemCard: {
    borderWidth: 1.5, borderRadius: 12,
    padding: 12, marginBottom: 12,
    overflow: 'hidden',
  },
  topBadge: {
    position: 'absolute', top: 8, right: 8,
    backgroundColor: '#FFB300', paddingHorizontal: 8, paddingVertical: 2,
    borderRadius: 4, zIndex: 10,
  },
  topBadgeText: { fontSize: 9, fontWeight: '900', color: '#000', letterSpacing: 1 },
  itemCardHeader: { flexDirection: 'row', alignItems: 'center' },
  itemImage: { width: 56, height: 56, borderRadius: 6, borderWidth: 2 },
  itemRank: { fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  itemName: { fontSize: 14, fontWeight: '800', marginTop: 2 },
  itemMetricsRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 4, flexWrap: 'wrap' },
  itemTotalScore: { fontSize: 18, fontWeight: '900', marginRight: 4 },
  itemTotalLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 1, marginRight: 8 },
  itemDivider: { width: 1, height: 12, backgroundColor: '#444', marginRight: 8 },
  itemConfidence: { fontSize: 14, fontWeight: '900', marginRight: 4 },

  subScores: { marginTop: 12 },
  scoreBarRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  scoreBarLabel: {
    width: 64, fontSize: 9, fontWeight: '800', letterSpacing: 1, color: '#999',
  },
  scoreBarTrack: {
    flex: 1, height: 8, borderRadius: 4,
    backgroundColor: c.onSurface(0.08), overflow: 'hidden', marginHorizontal: 6,
  },
  scoreBarFill: { height: 8, borderRadius: 4, position: 'relative', overflow: 'hidden' },
  shimmerOverlay: {
    position: 'absolute', top: 0, bottom: 0,
    width: '40%',
    transform: [{ skewX: '-25deg' }],
  },
  scoreBarValue: { width: 28, fontSize: 11, fontWeight: '900', textAlign: 'right' },

  itemExplanation: {
    fontSize: 11, fontStyle: 'italic', lineHeight: 16,
    paddingLeft: 10, borderLeftWidth: 2, marginTop: 10,
  },

  // Reasons
  reasonsBlock: { marginTop: 12 },
  reasonRow: { flexDirection: 'row', marginBottom: 5, alignItems: 'flex-start' },
  reasonBullet: { fontSize: 12, marginRight: 8, fontWeight: '900' },
  reasonText: { flex: 1, fontSize: 12, lineHeight: 18 },

  // Tradeoff
  tradeoffBlock: {
    marginTop: 14, padding: 12, borderRadius: 8, borderLeftWidth: 3,
  },
  tradeoffText: { fontSize: 12, lineHeight: 17, fontStyle: 'italic' },
});
