// ============================================================================
// TrophyBadge — medallón circular reutilizable (estándar de trofeos por tier)
// ----------------------------------------------------------------------------
// Estandariza el "medallón dorado" que ya existía inline en BadgeUnlockModal
// (insignia circular con la cara del campeón) en UN componente reutilizable con
// color por TIER. Lo consumen:
//   · ChampionDetailModal  → INSIGNIAS · DOMINIO (medallones de maestría)
//   · ForgeScreen          → VITRINA DE LOGROS (carrusel de trofeos)
//   · (y, como referencia, el medallón de celebración de BadgeUnlockModal)
//
// Es PURO y SIN dependencia del tema: los colores de tier son fijos, así que el
// medallón se ve idéntico en claro y oscuro (no rompe la paridad de modo).
//
// API:
//   <TrophyBadge tier="oro" glyph="6.5" size={48} />
//   <TrophyBadge tier="master" portraitUrl={url} size={56} />
//   <TrophyBadge tier="plata" glyph="WH" locked />
// ============================================================================
import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';

// ── Mapa de colores por tier (estándar de trofeos NOVA RIFT) ─────────────────
// Cinco escalones de medallón: bronce < plata < oro < diamante < master.
export const TIER_COLORS = {
  bronce:   '#cd7f32',
  plata:    '#9fa8b2',
  oro:      '#ffd700',
  diamante: '#3fd0d4',
  master:   '#9d4dc4',
};

// Orden del escalón (por si algún caller quiere comparar/ordenar tiers).
export const TIER_ORDER = ['bronce', 'plata', 'oro', 'diamante', 'master'];

// Etiqueta corta humana por tier (para mostrar bajo/junto al medallón).
export const TIER_LABEL = {
  bronce:   'BRONCE',
  plata:    'PLATA',
  oro:      'ORO',
  diamante: 'DIAMANTE',
  master:   'MASTER',
};

// ── Normalizador de tier ─────────────────────────────────────────────────────
// Acepta tanto las claves canónicas (bronce/plata/oro/diamante/master) como los
// tiers de rendimiento que ya usan ChampionDetailModal (tierForCSPM/tierForKDA:
// silver/gold/platinum/diamond/challenger) y los rangos de LoL en inglés. Mapea
// todo al escalón de 5 medallones (platino y diamante comparten el cian).
const TIER_ALIASES = {
  bronce: 'bronce', bronze: 'bronce', iron: 'bronce', hierro: 'bronce',
  plata: 'plata', silver: 'plata',
  oro: 'oro', gold: 'oro',
  diamante: 'diamante', diamond: 'diamante', platinum: 'diamante', platino: 'diamante', emerald: 'diamante', esmeralda: 'diamante',
  master: 'master', maestro: 'master', grandmaster: 'master', challenger: 'master', chall: 'master',
};

export function resolveTier(input) {
  if (!input) return 'oro';
  const key = String(input).trim().toLowerCase();
  return TIER_ALIASES[key] || (TIER_COLORS[key] ? key : 'oro');
}

export function tierColor(input) {
  return TIER_COLORS[resolveTier(input)];
}

/**
 * Medallón circular tematizado por tier.
 *
 * @param {Object} props
 * @param {string} [props.tier='oro'] Tier (canónico o alias — ver resolveTier).
 * @param {number} [props.size=48] Diámetro del medallón en px.
 * @param {string|number} [props.glyph] Texto/valor centrado (si no hay portrait).
 * @param {string} [props.portraitUrl] URL de retrato de campeón (estilo skin).
 * @param {boolean} [props.locked=false] Estado bloqueado → desaturado/atenuado.
 * @param {object} [props.style] Estilo extra del contenedor.
 */
export default function TrophyBadge({
  tier = 'oro',
  size = 48,
  glyph,
  portraitUrl,
  locked = false,
  style,
}) {
  const key   = resolveTier(tier);
  const color = TIER_COLORS[key];
  const ringW = Math.max(2, Math.round(size * 0.06));
  // Glifo proporcional al tamaño (cabe sin recortarse).
  const glyphSize = Math.max(9, Math.round(size * (String(glyph ?? '').length >= 4 ? 0.26 : 0.34)));

  return (
    <View
      style={[
        styles.wrap,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: ringW,
          borderColor: locked ? 'rgba(255,255,255,0.18)' : color,
          backgroundColor: locked ? 'rgba(255,255,255,0.04)' : color + '22',
          opacity: locked ? 0.55 : 1,
        },
        style,
      ]}
      accessibilityRole="image"
      accessibilityLabel={`Medallón ${TIER_LABEL[key]}${glyph != null ? ` · ${glyph}` : ''}`}
    >
      {portraitUrl ? (
        <>
          <Image source={{ uri: portraitUrl }} style={styles.portrait} resizeMode="cover" />
          {/* Tinte del tier sobre el retrato → evoca "skin alternativa". */}
          <View style={[StyleSheet.absoluteFillObject, { backgroundColor: color + (locked ? '00' : '40') }]} />
          {locked && <View style={[StyleSheet.absoluteFillObject, styles.lockTint]} />}
        </>
      ) : (
        <Text
          style={[styles.glyph, { color: locked ? 'rgba(255,255,255,0.55)' : color, fontSize: glyphSize }]}
          numberOfLines={1}
        >
          {glyph ?? '★'}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  portrait: { width: '100%', height: '100%' },
  lockTint: { backgroundColor: 'rgba(7,7,13,0.7)' },
  glyph: {
    fontWeight: '900',
    letterSpacing: 0.3,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
});
