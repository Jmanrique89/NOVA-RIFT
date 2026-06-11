// ============================================================================
// BadgeUnlockModal — overlay de celebración al desbloquear una insignia.
// ----------------------------------------------------------------------------
// Recibe la lista de trofeos recién desbloqueados y los muestra uno a uno con
// animación de scale (0 → 1.2 → 1) y glow pulsante. El portrait del campeón
// main del jugador se usa como base, con un overlay translúcido del color
// declarado en el trofeo (`badge.overlay`) para evocar una "skin alternativa"
// dorada/cyan/púrpura/etc. Si no se pasa `championName` cae al icono del
// trofeo en un círculo grande.
// ============================================================================
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Animated, TouchableOpacity, Image, Platform,
} from 'react-native';
import { getChampionImageUrl } from '../utils/dataDragon';
import { useTheme } from '../context/ThemeContext';

export default function BadgeUnlockModal({
  badges = [],
  championName,
  onClose,
}) {
  const { colors: c, isDark } = useTheme();
  const styles = useMemo(() => makeBadgeModalStyles(c, isDark), [c, isDark]);

  const [index, setIndex] = useState(0);

  const scaleAnim = useRef(new Animated.Value(0)).current;
  const glowAnim  = useRef(new Animated.Value(0)).current;
  const fadeAnim  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!badges || badges.length === 0) return;
    scaleAnim.setValue(0);
    fadeAnim.setValue(0);

    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 240, useNativeDriver: true }),
      Animated.sequence([
        Animated.spring(scaleAnim, {
          toValue: 1.2, friction: 4, tension: 90, useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1, friction: 5, tension: 120, useNativeDriver: true,
        }),
      ]),
    ]).start();

    const glowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 900, useNativeDriver: false }),
        Animated.timing(glowAnim, { toValue: 0, duration: 900, useNativeDriver: false }),
      ])
    );
    glowLoop.start();
    return () => glowLoop.stop();
  }, [index, badges]);

  if (!badges || badges.length === 0) return null;
  const badge = badges[index];
  if (!badge) return null;

  const accent  = badge.color   || '#FFD700';
  const overlay = badge.overlay || 'rgba(255,215,0,0.45)';
  const portraitUrl = championName
    ? getChampionImageUrl(championName)
    : null;

  const glowOpacity = glowAnim.interpolate({
    inputRange:  [0, 1],
    outputRange: [0.35, 0.9],
  });

  const advance = () => {
    if (index + 1 < badges.length) setIndex(index + 1);
    else onClose?.();
  };

  return (
    <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
      <TouchableOpacity
        style={StyleSheet.absoluteFillObject}
        activeOpacity={1}
        onPress={advance}
      />

      <View
        style={[
          styles.card,
          {
            borderColor: accent + 'AA',
            shadowColor: accent,
            ...(Platform.OS === 'web'
              ? { backdropFilter: 'blur(22px)', WebkitBackdropFilter: 'blur(22px)' }
              : {}),
          },
        ]}
      >
        <Text style={[styles.kicker, { color: accent }]}>¡INSIGNIA DESBLOQUEADA!</Text>

        {/* Halo pulsante detrás del portrait */}
        <View style={styles.portraitWrap}>
          <Animated.View
            style={[
              styles.haloOuter,
              {
                backgroundColor: accent,
                opacity: glowOpacity,
                shadowColor: accent,
              },
            ]}
          />
          <Animated.View
            style={[
              styles.portraitRing,
              {
                borderColor: accent,
                transform: [{ scale: scaleAnim }],
                shadowColor: accent,
              },
            ]}
          >
            {portraitUrl ? (
              <>
                <Image
                  source={{ uri: portraitUrl }}
                  style={styles.portraitImg}
                  resizeMode="cover"
                />
                {/* Overlay de color → "skin alternativa" */}
                <View style={[styles.portraitTint, { backgroundColor: overlay }]} />
              </>
            ) : (
              <View style={[styles.iconFallback, { backgroundColor: overlay }]}>
                <Text style={styles.iconFallbackText}>{badge.icon || '★'}</Text>
              </View>
            )}
            {/* Glyph del trofeo flotando sobre el portrait */}
            <View style={styles.glyphChip}>
              <Text style={styles.glyphText}>{badge.icon || '★'}</Text>
            </View>
          </Animated.View>
        </View>

        <Text style={styles.badgeName}>{badge.name}</Text>
        <Text style={styles.badgeDesc} numberOfLines={3}>
          {badge.description}
        </Text>

        {!!badge.reward && (
          <View style={[styles.rewardBox, { borderColor: accent + '66', backgroundColor: accent + '14' }]}>
            <Text style={[styles.rewardLabel, { color: accent }]}>RECOMPENSA</Text>
            <Text style={styles.rewardText}>{badge.reward}</Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.cta, { borderColor: accent, backgroundColor: accent + '22' }]}
          onPress={advance}
          activeOpacity={0.85}
        >
          <Text style={[styles.ctaText, { color: accent }]}>
            {index + 1 < badges.length ? `SIGUIENTE (${index + 1}/${badges.length})` : 'ACEPTAR'}
          </Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const makeBadgeModalStyles = (c, isDark) => StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: isDark ? 'rgba(7,7,13,0.86)' : c.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: isDark ? 'rgba(15,12,30,0.92)' : c.bg2,
    borderWidth: 1.5,
    borderRadius: 18,
    padding: 22,
    alignItems: 'center',
    shadowOpacity: 0.75,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 0 },
    elevation: 24,
  },
  kicker: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 3,
    marginBottom: 18,
    fontFamily: 'Rajdhani_700Bold',
  },
  portraitWrap: {
    width: 160,
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  haloOuter: {
    position: 'absolute',
    width: 180, height: 180, borderRadius: 90,
    shadowOpacity: 0.9, shadowRadius: 30,
  },
  portraitRing: {
    width: 140, height: 140, borderRadius: 70,
    borderWidth: 3,
    overflow: 'hidden',
    shadowOpacity: 0.8,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
    elevation: 14,
    backgroundColor: c.bg0,
  },
  portraitImg: { width: '100%', height: '100%' },
  portraitTint: { ...StyleSheet.absoluteFillObject, mixBlendMode: 'overlay' },
  iconFallback: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
  },
  iconFallbackText: { fontSize: 64 },
  glyphChip: {
    position: 'absolute',
    bottom: -2, right: -2,
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: 'rgba(7,7,13,0.92)',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center', justifyContent: 'center',
  },
  glyphText: { fontSize: 20 },
  badgeName: {
    color: c.textPrimary,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 2,
    textAlign: 'center',
    marginBottom: 6,
    fontFamily: 'Rajdhani_700Bold',
  },
  badgeDesc: {
    color: c.onSurface(0.65),
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    marginBottom: 14,
  },
  rewardBox: {
    width: '100%',
    borderWidth: 1, borderRadius: 8,
    paddingVertical: 10, paddingHorizontal: 12,
    marginBottom: 18,
  },
  rewardLabel: {
    fontSize: 9, fontWeight: '900', letterSpacing: 2, marginBottom: 4,
    fontFamily: 'Rajdhani_700Bold',
  },
  rewardText: { color: c.textPrimary, fontSize: 12, lineHeight: 16 },
  cta: {
    borderWidth: 1.5, borderRadius: 8,
    paddingVertical: 12, paddingHorizontal: 24,
    minWidth: 160, alignItems: 'center',
  },
  ctaText: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 2,
    fontFamily: 'Rajdhani_700Bold',
  },
});
