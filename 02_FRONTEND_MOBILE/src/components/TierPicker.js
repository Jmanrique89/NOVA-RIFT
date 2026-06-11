// ============================================================================
// TierPicker — selector de tier unificado con emblemas CommunityDragon.
// Reemplaza las dos implementaciones inline en ForgeScreen (benchmark y
// selector QUIERO LLEGAR A). Cumple WCAG 2.1 AA: touch targets ≥44px,
// accessibilityRole radio, accessibilityLabel descriptivo.
// ============================================================================
import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, Image, ScrollView, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';

// Mapeo ES → slug OP.GG CDN (medals_new/gold.png, medals_new/iron.png …)
const TIER_SLUGS = {
  'Hierro':    'iron',
  'Bronce':    'bronze',
  'Plata':     'silver',
  'Oro':       'gold',
  'Platino':   'platinum',
  'Esmeralda': 'emerald',
  'Diamante':  'diamond',
  'Master':    'master',
  'Challenger':'challenger',
};

const TIERS = Object.keys(TIER_SLUGS);

/**
 * @param {string} selectedTier Nombre del tier seleccionado (ej. 'Oro')
 * @param {Function} onSelect Callback (tier: string) => void
 * @param {string[]} [tiers] Lista de tiers a mostrar. Por defecto todos.
 * @param {object} [style] Estilos extra para el contentContainerStyle del ScrollView
 */
export default function TierPicker({ selectedTier, onSelect, tiers: tiersProp, style }) {
  const { colors: c } = useTheme();
  const styles = useMemo(() => makeTierPickerStyles(c), [c]);
  const tierList = tiersProp || TIERS;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[styles.container, style]}
    >
      {tierList.map(tier => {
        const active = selectedTier === tier;
        const slug   = TIER_SLUGS[tier];
        const uri    = `https://opgg-static.akamaized.net/images/medals_new/${slug}.png`;

        return (
          <TouchableOpacity
            key={tier}
            onPress={() => onSelect(tier)}
            accessibilityRole="radio"
            accessibilityState={{ checked: active }}
            accessibilityLabel={`División ${tier}`}
            style={[
              styles.item,
              active && styles.itemActive,
            ]}
          >
            <Image
              source={{ uri }}
              style={styles.emblem}
              accessibilityLabel={`Emblema ${tier}`}
            />
            <Text style={[styles.label, active && styles.labelActive]}>
              {tier}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const makeTierPickerStyles = (c) => StyleSheet.create({
  container: {
    flexDirection: 'row',
    paddingHorizontal: 4,
    gap: 4,
  },
  item: {
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderRadius: 8,
    minHeight: 44,
    minWidth: 44,
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: 'transparent',
  },
  itemActive: {
    backgroundColor: 'rgba(255,215,0,0.12)',
    borderColor: '#FFD700',
  },
  emblem: {
    width: 40,
    height: 44,
    resizeMode: 'contain',
    opacity: 1,
  },
  label: {
    fontSize: 9,
    fontWeight: '700',
    color: c.onSurface(0.65),
    marginTop: 2,
    textAlign: 'center',
  },
  labelActive: {
    color: '#FFD700',
  },
});
