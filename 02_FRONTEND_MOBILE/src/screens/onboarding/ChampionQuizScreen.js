// ============================================================================
// ChampionQuizScreen — Paso 4a/4 del onboarding
// ----------------------------------------------------------------------------
// 5 preguntas para filtrar el catálogo. Las respuestas se pasan al
// OnboardingContext como quizAnswers y luego a recommendChampions().
// ============================================================================
import React, { useContext, useState, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Animated, Easing,
} from 'react-native';
import { OnboardingContext } from './OnboardingContext';
import DevEscapeHatch from '../../components/DevEscapeHatch';
// B4.6 — puntos de progreso unificados de los 4 pasos del onboarding.
import ProgressDots from '../../components/ProgressDots';
import { TYPE_SCALE } from '../../theme/typography';
import { useTheme } from '../../context/ThemeContext';

const QUESTIONS = [
  {
    key: 'killStyle',
    q: '¿Prefieres matar rápido o sobrevivir mucho?',
    options: [
      { value: 'BURST', label: 'Matar rápido (burst)' },
      { value: 'TANK',  label: 'Sobrevivir (tanque)' },
    ],
  },
  {
    key: 'teamFit',
    q: '¿Juegas mejor solo o en equipo?',
    options: [
      { value: 'SOLO', label: 'Solo, dependiendo de mí mismo' },
      { value: 'TEAM', label: 'En equipo, coordinando con aliados' },
    ],
  },
  {
    key: 'complexity',
    q: '¿Prefieres habilidades sencillas o combos complejos?',
    options: [
      { value: 'SIMPLE',  label: 'Sencillo — me centro en decisiones' },
      { value: 'COMPLEX', label: 'Complejo — quiero dominar mecánicas' },
    ],
  },
  {
    key: 'damage',
    q: '¿Te gusta más el daño mágico o físico?',
    options: [
      { value: 'AP',   label: 'Mágico (AP)' },
      { value: 'AD',   label: 'Físico (AD)' },
      { value: 'ANY',  label: 'No me importa' },
    ],
  },
  {
    key: 'range',
    q: '¿Prefieres jugar cerca o lejos del enemigo?',
    options: [
      { value: 'MELEE',  label: 'Cerca (melee, body-to-body)' },
      { value: 'RANGED', label: 'Lejos (ranged, a distancia)' },
      { value: 'ANY',    label: 'Indistinto' },
    ],
  },
];

export default function ChampionQuizScreen({ navigation }) {
  const { setQuizAnswers } = useContext(OnboardingContext);
  const { colors: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  const [step, setStep]         = useState(0);
  const [answers, setAnswers]   = useState({});
  const fadeAnim = React.useRef(new Animated.Value(1)).current;

  const handlePick = (option) => {
    const next = { ...answers, [QUESTIONS[step].key]: option.value };
    Animated.timing(fadeAnim, { toValue: 0, duration: 180, useNativeDriver: true }).start(() => {
      setAnswers(next);
      if (step < QUESTIONS.length - 1) {
        setStep(step + 1);
      } else {
        // Última → guardar y navegar al pick
        // Convertir 'ANY' en undefined para que el filtro lo ignore
        const cleaned = { ...next };
        if (cleaned.damage === 'ANY') delete cleaned.damage;
        if (cleaned.range  === 'ANY') delete cleaned.range;
        setQuizAnswers(cleaned);
        navigation.navigate('ChampionPick');
      }
      Animated.timing(fadeAnim, { toValue: 1, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    });
  };

  const handleSkip = () => {
    setQuizAnswers({});
    navigation.navigate('ChampionPick');
  };

  return (
    <View style={{ flex: 1 }}>
      <DevEscapeHatch />
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
      {/* B4.6 — indicador de paso unificado (mismo componente en los 4 pasos) */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <ProgressDots current={4} style={{ marginTop: 0, marginBottom: 6 }} />
        <Text style={styles.progressTag}>PASO 4 / 4 · CAMPEONES</Text>
      </View>
      <Text style={styles.title}>Afinemos tu champion pool</Text>
      <Text style={styles.subtitle}>5 preguntas rápidas para filtrar los mejores campeones para ti.</Text>

      <View style={styles.progressBar}>
        {QUESTIONS.map((_, i) => (
          <View
            key={i}
            style={[
              styles.progressDot,
              { backgroundColor: i < step + 1 ? c.primary : c.onSurface(0.15) },
            ]}
          />
        ))}
      </View>

      <Animated.View style={{ opacity: fadeAnim }}>
        <Text style={styles.quizStep}>Pregunta {step + 1} de {QUESTIONS.length}</Text>
        <Text style={styles.quizQuestion}>{QUESTIONS[step].q}</Text>

        {QUESTIONS[step].options.map((opt, i) => (
          <TouchableOpacity
            key={opt.value}
            style={styles.optionBtn}
            onPress={() => handlePick(opt)}
            activeOpacity={0.8}
          >
            {/* T7 — badge con letra A/B/C, unificado con Playstyle/RoleQuiz */}
            <Text style={styles.optionLetter}>{String.fromCharCode(65 + i)}</Text>
            <Text style={styles.optionText}>{opt.label}</Text>
            <Text style={styles.optionArrow}>→</Text>
          </TouchableOpacity>
        ))}
      </Animated.View>

      <TouchableOpacity onPress={handleSkip} style={styles.skipLink}>
        <Text style={styles.skipText}>Saltar preguntas — usar solo rol y playstyle</Text>
      </TouchableOpacity>
    </ScrollView>
    </View>
  );
}

const makeStyles = (c) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg1 },
  scroll: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 56, paddingBottom: 80 },
  progressTag: { color: 'rgba(123,118,221,0.6)', fontSize: TYPE_SCALE.caption.size, letterSpacing: 1.5, fontWeight: '600', marginBottom: 6, textTransform: 'uppercase' },
  title: { color: c.textPrimary, fontSize: TYPE_SCALE.h3.size, fontWeight: '700', letterSpacing: 2 },
  subtitle: { color: c.onSurface(0.55), fontSize: TYPE_SCALE.label.size, fontWeight: '400', lineHeight: 18, marginTop: 8, marginBottom: 18 },

  progressBar: { flexDirection: 'row', gap: 6, marginBottom: 24 },
  progressDot: { flex: 1, height: 3, borderRadius: 2 },

  quizStep: { color: c.primary, fontSize: TYPE_SCALE.caption.size, fontWeight: '600', letterSpacing: 2 },
  quizQuestion: { color: c.textPrimary, fontSize: TYPE_SCALE.h6.size, fontWeight: '700', marginTop: 8, marginBottom: 18, lineHeight: 23 },
  optionBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: c.onSurface(0.04),
    borderWidth: 1, borderColor: 'rgba(123,118,221,0.15)',
    borderRadius: 12, padding: 16, marginBottom: 10,
    shadowColor: c.primary, shadowOpacity: 0.08, shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 }, elevation: 3,
  },
  optionLetter: {
    color: c.primary, fontSize: TYPE_SCALE.caption.size, fontWeight: '900',
    width: 24, height: 24, textAlign: 'center', lineHeight: 24,
    backgroundColor: 'rgba(123,118,221,0.15)', borderRadius: 5, marginRight: 12,
  },
  optionText: { color: c.onSurface(0.75), fontSize: TYPE_SCALE.label.size, flex: 1, lineHeight: 19 },
  optionArrow: { color: c.primary, fontSize: TYPE_SCALE.h6.size, fontWeight: '900', marginLeft: 10 },

  skipLink: { alignItems: 'center', marginTop: 20, padding: 8 },
  skipText: { color: c.onSurface(0.45), fontSize: TYPE_SCALE.caption.size },
});
