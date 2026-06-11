// ============================================================================
// TrophyCabinet — sala de trofeos reutilizable
// ----------------------------------------------------------------------------
// Encapsula toda la lógica de la "Sala de Trofeos" para que cualquier pantalla
// pueda montarla. Antes vivía inline en ProfileScreen; la mueve a ELO
// Forge donde encaja mejor con la narrativa "qué te falta para mejorar".
//
// Internamente:
// `computeAllTrophies(ALL_TROPHIES, matches)` → `[{ trophy, state, ... }]`
// AsyncStorage `novarift:trophies:snapshot` → diff false→true =
// `newlyEarnedIds` que dispara la reveal animation .
// `<TrophyCard>` interno con 3 estados visuales + barra de progreso +
// spring rebote + glow del borde cuando `isNew`.
//
// Props:
// matches — array de partidas (shape novaStats.js)
// theme — `factionTheme` para el color de progreso
// title — opcional, default "SALA DE TROFEOS"
// ============================================================================
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Animated, Image,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ALL_TROPHIES } from '../data/trophies';
import { computeAllTrophies } from '../utils/trophies';
import { getChampionImageUrl } from '../utils/dataDragon';
import { useTheme } from '../context/ThemeContext';
import BadgeUnlockModal from './BadgeUnlockModal';

const TROPHY_SNAPSHOT_KEY = 'novarift:trophies:snapshot';

export default function TrophyCabinet({
  matches,
  theme,
  title = 'SALA DE TROFEOS',
  mainChampionName,
}) {
  const { colors: c } = useTheme();
  const styles = useMemo(() => makeTrophyStyles(c), [c]);

  const trophyStates = useMemo(
    () => computeAllTrophies(ALL_TROPHIES, matches),
    [matches]
  );

  // Diff false→true contra el snapshot persistente para detectar nuevos
  // earned y disparar la animación de reveal una sola vez.
  const [newlyEarnedIds, setNewlyEarnedIds] = useState([]);
  // modal de celebración (BadgeUnlockModal). Se llena con los trofeos
  // recién desbloqueados detectados aquí, y se vacía cuando el usuario cierra.
  const [celebrationQueue, setCelebrationQueue] = useState([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw  = await AsyncStorage.getItem(TROPHY_SNAPSHOT_KEY);
        const prev = raw ? JSON.parse(raw) : {};
        if (cancelled) return;

        const newlyEarned = trophyStates
          .filter(t => t.state === 'earned' && !prev[t.trophy.id])
          .map(t => t.trophy);

        if (newlyEarned.length > 0) {
          // eslint-disable-next-line no-console
          console.log(
            '[NOVA RIFT] Trofeos desbloqueados:',
            newlyEarned.map(t => t.name)
          );
          setNewlyEarnedIds(newlyEarned.map(t => t.id));
          setCelebrationQueue(newlyEarned);
        }

        const snapshot = Object.fromEntries(
          trophyStates.map(t => [t.trophy.id, t.state === 'earned'])
        );
        await AsyncStorage.setItem(TROPHY_SNAPSHOT_KEY, JSON.stringify(snapshot));
      } catch (_) {
        // AsyncStorage puede fallar en entornos sin storage — silenciar.
      }
    })();
    return () => { cancelled = true; };
  }, [trophyStates]);

  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{title}</Text>
      <View style={styles.grid}>
        {trophyStates.map(({ trophy, state, progress, label }) => (
          <TrophyCard
            key={trophy.id}
            trophy={trophy}
            state={state}
            progress={progress}
            label={label}
            theme={theme}
            isNew={newlyEarnedIds.includes(trophy.id)}
            championName={mainChampionName}
          />
        ))}
      </View>

      {celebrationQueue.length > 0 && (
        <BadgeUnlockModal
          badges={celebrationQueue}
          championName={mainChampionName}
          onClose={() => setCelebrationQueue([])}
        />
      )}
    </View>
  );
}

// ─── TrophyCard interno (3 estados + reveal animation ) ────────────────
function TrophyCard({
  trophy, state = 'locked', progress = 0, label, theme, isNew = false,
  championName,
}) {
  const { colors: c } = useTheme();
  const styles = useMemo(() => makeTrophyStyles(c), [c]);

  const isEarned   = state === 'earned';
  const isLocked   = state === 'locked';
  const isProgress = state === 'progress';

  const accent       = theme?.primary || '#7B76DD';
  // Color de marca del trofeo (declarado en `trophies.js`), con fallback al
  // dorado clásico usado por los 4 trofeos originales.
  const trophyAccent = trophy.color   || '#D4AF37';
  const overlayTint  = trophy.overlay || 'rgba(212,175,55,0.40)';

  const scaleAnim = useRef(new Animated.Value(isNew ? 0.82 : 1)).current;
  const glowAnim  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!isNew) return;
    // useNativeDriver:false — este Animated.View también anima borderColor
    // (glowAnim, no soportado por el native driver). Mezclar drivers en el
    // mismo nodo lanza "Attempting to run JS driven animation on animated
    // node that has been moved to 'native'".
    Animated.spring(scaleAnim, {
      toValue: 1, friction: 4, tension: 160, useNativeDriver: false,
    }).start();
    Animated.sequence([
      Animated.timing(glowAnim, { toValue: 1, duration: 350,  useNativeDriver: false }),
      Animated.timing(glowAnim, { toValue: 0, duration: 1200, useNativeDriver: false }),
    ]).start();
  }, [isNew, scaleAnim, glowAnim]);

  const earnedBorder = glowAnim.interpolate({
    inputRange:  [0, 1],
    outputRange: [trophyAccent + '88', trophyAccent],
  });
  const borderColor = isEarned
    ? earnedBorder
    : isProgress ? accent + '44' : c.onSurface(0.10);
  const bgColor = isEarned
    ? trophyAccent + '1A'
    : isProgress ? accent + '0A' : c.onSurface(0.03);
  const labelColor = isEarned
    ? trophyAccent
    : isProgress ? accent : c.onSurface(0.40);
  const barColor = isEarned ? trophyAccent : accent;
  const pctWidth = `${Math.round((progress || 0) * 100)}%`;

  const portraitUrl = championName ? getChampionImageUrl(championName) : null;

  return (
    <Animated.View
      style={[
        styles.card,
        { borderColor, backgroundColor: bgColor, transform: [{ scale: scaleAnim }] },
      ]}
    >
      {/* Header con portrait + glyph del trofeo */}
      <View style={styles.cardHeader}>
        <View style={[styles.portraitMini, { borderColor: isEarned ? trophyAccent : c.onSurface(0.15) }]}>
          {portraitUrl ? (
            <>
              <Image source={{ uri: portraitUrl }} style={styles.portraitMiniImg} resizeMode="cover" />
              {isEarned && <View style={[styles.portraitMiniTint, { backgroundColor: overlayTint }]} />}
              {isLocked && <View style={styles.portraitMiniGray} />}
            </>
          ) : (
            <Text style={[styles.icon, isLocked && { opacity: 0.45 }]}>{trophy.icon}</Text>
          )}
          {isLocked && (
            <View style={styles.lockChip}><Text style={styles.lockChipText}>L</Text></View>
          )}
        </View>
        <Text style={[styles.glyph, isLocked && { opacity: 0.4 }]}>{trophy.icon}</Text>
      </View>

      <Text
        style={[styles.name, isEarned && { color: trophyAccent }]}
        numberOfLines={1}
      >
        {trophy.name}
      </Text>
      <Text style={styles.desc} numberOfLines={2}>{trophy.description}</Text>

      <View style={styles.progressTrack}>
        <View
          style={[
            styles.progressFill,
            { width: pctWidth, backgroundColor: barColor, opacity: isLocked ? 0.4 : 1 },
          ]}
        />
      </View>

      <Text style={[styles.status, { color: labelColor }]} numberOfLines={1}>
        {label || (isLocked ? 'BLOQUEADO' : isEarned ? 'CONSEGUIDO' : 'EN PROGRESO')}
      </Text>
    </Animated.View>
  );
}

const makeTrophyStyles = (c) => StyleSheet.create({
  section: { marginBottom: 18 },
  sectionLabel: {
    color: c.onSurface(0.35),
    fontSize: 9, fontWeight: '900', letterSpacing: 2,
    marginBottom: 10,
  },
  grid: {
    flexDirection: 'row', flexWrap: 'wrap',
    justifyContent: 'space-between', rowGap: 10,
  },
  card: {
    width: '48.5%',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  portraitMini: {
    width: 42, height: 42, borderRadius: 21,
    borderWidth: 1.5, overflow: 'hidden',
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  portraitMiniImg: { width: '100%', height: '100%' },
  portraitMiniTint: { ...StyleSheet.absoluteFillObject, mixBlendMode: 'overlay' },
  portraitMiniGray: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(7,7,13,0.75)',
  },
  lockChip: {
    position: 'absolute',
    bottom: -2, right: -2,
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: 'rgba(7,7,13,0.92)',
    alignItems: 'center', justifyContent: 'center',
  },
  lockChipText: {
    fontSize: 8, fontWeight: '900', letterSpacing: 1,
    color: 'rgba(255,255,255,0.7)',
  },
  glyph: {
    fontSize: 13, fontWeight: '900', letterSpacing: 1.5,
    color: c.onSurface(0.85),
    fontFamily: 'Rajdhani_700Bold',
  },
  icon: {
    fontSize: 13, fontWeight: '900', letterSpacing: 1.5,
    color: c.onSurface(0.85),
    fontFamily: 'Rajdhani_700Bold',
    marginBottom: 6,
  },
  name: {
    color: c.textPrimary, fontSize: 12, fontWeight: '900',
    letterSpacing: 0.5, marginBottom: 4,
    fontFamily: 'Rajdhani_700Bold',
  },
  nameEarned: { color: 'rgba(212,175,55,0.95)' },
  desc: {
    color: c.onSurface(0.45), fontSize: 10, lineHeight: 14,
  },
  progressTrack: {
    height: 4, borderRadius: 2,
    backgroundColor: c.onSurface(0.08),
    marginTop: 8, marginBottom: 4,
    overflow: 'hidden',
  },
  progressFill: { height: 4, borderRadius: 2 },
  status: {
    fontSize: 10, marginTop: 4, fontWeight: '800', letterSpacing: 0.3,
  },
});
