// ============================================================================
// PromotionTrack — track visual de progreso hacia la próxima promoción
// ----------------------------------------------------------------------------
// 5 dots conectados por líneas:
// Divisiones ya superadas → dot tenue blanco
// División actual → dot grande púrpura con glow (color de marca)
// Divisiones futuras → dot tenue
// Promo al siguiente tier → dot dorado con flecha ▲
//
// Debajo: LP progress en la división actual (ej. "67 LP · 33 LP para promo").
//
// El componente es puramente presentacional — no fetchea nada. Recibe
// {tier, division, lp, lpToPromo} y resuelve el resto. Inspirado en deeplol
// pero con identidad NOVA RIFT (acentos púrpura / dorado).
// ============================================================================
import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';

// Mapas de tier auxiliares — letra mostrada en el dot + tier siguiente
const TIER_LABEL = {
  IRON: 'I',  BRONZE: 'B', SILVER: 'S', GOLD: 'G',
  PLATINUM: 'P', EMERALD: 'E', DIAMOND: 'D',
  MASTER: 'M', GRANDMASTER: 'GM', CHALLENGER: 'C',
};

const NEXT_TIER = {
  IRON: 'BRONZE', BRONZE: 'SILVER', SILVER: 'GOLD',
  GOLD: 'PLATINUM', PLATINUM: 'EMERALD', EMERALD: 'DIAMOND',
  DIAMOND: 'MASTER', MASTER: 'GRANDMASTER', GRANDMASTER: 'CHALLENGER',
};

const DIV_ORDER = ['IV', 'III', 'II', 'I']; // de menor a mayor

function generateSteps(tier, division) {
  const tierKey    = String(tier || '').toUpperCase();
  const tierShort  = TIER_LABEL[tierKey] || tierKey.charAt(0);
  const nextKey    = NEXT_TIER[tierKey];
  const nextShort  = nextKey ? (TIER_LABEL[nextKey] || nextKey.charAt(0)) : '★';
  const currentIdx = DIV_ORDER.indexOf(String(division || 'IV').toUpperCase());

  const steps = [];
  // 4 divisiones del tier actual (IV → I)
  for (let i = 0; i < 4; i++) {
    steps.push({
      label:    `${tierShort}${DIV_ORDER[i]}`,
      achieved: i < currentIdx,
      current:  i === currentIdx,
      isPromo:  false,
    });
  }
  // 5º dot — promo al siguiente tier
  steps.push({
    label:    nextShort,
    achieved: false,
    current:  false,
    isPromo:  true,
  });
  return steps;
}

export default function PromotionTrack({ tier, division, lp = 0, lpToPromo = 100 }) {
  const { colors: c } = useTheme();
  const styles = useMemo(() => makePromotionTrackStyles(c), [c]);
  const steps = generateSteps(tier, division);
  const lpRemaining = Math.max(0, (lpToPromo || 100) - (lp || 0));

  return (
    <View style={styles.container}>
      <View style={styles.track}>
        {steps.map((step, i) => (
          <React.Fragment key={i}>
            {i > 0 && (
              <View
                style={[
                  styles.line,
                  // La línea es "alcanzada" si el step previo o el actual lo son
                  (steps[i - 1].achieved || steps[i - 1].current) && styles.lineActive,
                ]}
              />
            )}
            <View
              style={[
                styles.dot,
                step.achieved && styles.dotAchieved,
                step.current  && styles.dotCurrent,
                step.isPromo  && styles.dotPromo,
              ]}
            >
              {step.isPromo && <Text style={styles.promoArrow}>▲</Text>}
            </View>
          </React.Fragment>
        ))}
      </View>

      <View style={styles.labels}>
        {steps.map((step, i) => (
          <Text
            key={i}
            style={[
              styles.label,
              step.achieved && styles.labelAchieved,
              step.current  && styles.labelCurrent,
              step.isPromo  && styles.labelPromo,
            ]}
          >
            {step.label}
          </Text>
        ))}
      </View>

      {/* LP progress en la división actual */}
      <View style={styles.lpRow}>
        <Text style={styles.lpText}>{lp} LP</Text>
        <Text style={styles.lpSep}>·</Text>
        <Text style={styles.lpNeeded}>
          {lpRemaining > 0
            ? `${lpRemaining} LP para promo`
            : 'Promo lista — gana 2 partidas'}
        </Text>
      </View>
    </View>
  );
}

const makePromotionTrackStyles = (c) => StyleSheet.create({
  container:    { paddingVertical: 12 },
  track: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 8,
  },

  dot: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: c.onSurface(0.10),
    borderWidth: 1, borderColor: c.onSurface(0.18),
    alignItems: 'center', justifyContent: 'center',
  },
  dotAchieved: {
    backgroundColor: c.onSurface(0.35),
    borderColor:     c.onSurface(0.50),
  },
  dotCurrent: {
    width: 14, height: 14, borderRadius: 7,
    backgroundColor: '#7B76DD',
    borderColor:     '#7B76DD',
    shadowColor:     '#7B76DD',
    shadowOpacity:   0.85,
    shadowRadius:    8,
    shadowOffset:    { width: 0, height: 0 },
    elevation:       4,
  },
  dotPromo: {
    width: 14, height: 14, borderRadius: 7,
    backgroundColor: 'rgba(212,175,55,0.20)',
    borderColor:     '#D4AF37',
    shadowColor:     '#D4AF37',
    shadowOpacity:   0.6,
    shadowRadius:    6,
    shadowOffset:    { width: 0, height: 0 },
  },
  promoArrow: { fontSize: 7, color: '#D4AF37', fontWeight: '900', lineHeight: 8 },

  line: {
    flex: 1, height: 1,
    backgroundColor: 'rgba(123,118,221,0.12)',
  },
  lineActive: {
    backgroundColor: 'rgba(123,118,221,0.45)',
  },

  labels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginTop: 8,
  },
  label: {
    fontSize: 9,
    color: c.onSurface(0.30),
    letterSpacing: 1,
    fontWeight: '700',
    width: 28, textAlign: 'center',
  },
  labelAchieved: { color: c.onSurface(0.55) },
  labelCurrent:  { color: '#7B76DD', fontWeight: '900' },
  labelPromo:    { color: '#D4AF37', fontWeight: '900' },

  lpRow: {
    flexDirection: 'row', alignItems: 'center',
    marginTop: 10, paddingHorizontal: 4, gap: 6,
  },
  lpText:   { color: c.textPrimary, fontSize: 13, fontWeight: '900', letterSpacing: 0.5 },
  lpSep:    { color: c.onSurface(0.25), fontSize: 13 },
  lpNeeded: { color: c.onSurface(0.50), fontSize: 12, fontWeight: '600' },
});
