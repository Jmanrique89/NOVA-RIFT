// ============================================================================
// PlaystyleTestScreen — Paso 3/4 del onboarding
// ----------------------------------------------------------------------------
// 5 escenarios reales de partida con 4 respuestas (A/B/C/D).
// Mapeo: A → AGRESIVO, B → TÁCTICO, C → SUPPORTIVE, D → DOMINANTE.
// La 5ª pregunta sirve como desempate si A/B/C/D quedan a la par.
// Resultado: perfil con título + descripción ("El Cazador", "El Escalador", ...).
// ============================================================================
import React, { useContext, useState, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Animated, Easing,
} from 'react-native';
import Icon from '../../components/Icon';
import DevEscapeHatch from '../../components/DevEscapeHatch';
// B4.6 — puntos de progreso unificados de los 4 pasos del onboarding.
import ProgressDots from '../../components/ProgressDots';
import { OnboardingContext } from './OnboardingContext';
import { detectPlaystyle, PLAYSTYLE_PROFILES } from '../../data/championsCatalog';
import NovaButton from '../../components/NovaButton';
import NovaBackground from '../../components/NovaBackground';
import { FACTIONS } from '../../theme/theme';
import { TYPE_SCALE } from '../../theme/typography';
import { useTheme } from '../../context/ThemeContext';

const QUESTIONS = [
  {
    q: 'Llevas 8 minutos de partida y tienes ventaja sobre tu oponente…',
    options: [
      { letter: 'A', text: 'Busco el all-in' },
      { letter: 'B', text: 'Sigo farmeando con control' },
      { letter: 'C', text: 'Roto al mid o bot' },
      { letter: 'D', text: 'Empujo la oleada y presiono' },
    ],
  },
  {
    q: 'Tu equipo inicia un teamfight 5v5 en el barón…',
    options: [
      { letter: 'A', text: 'Salto sobre el ADC o Mid' },
      { letter: 'B', text: 'Me posiciono en retaguardia' },
      { letter: 'C', text: 'Pongo shields/heals/CC' },
      { letter: 'D', text: 'Inicio yo el teamfight' },
    ],
  },
  {
    q: 'Vuestra Nexus tiene las dos torres inhibidoras destruidas…',
    options: [
      { letter: 'A', text: 'Busco al carry enemigo aislado' },
      { letter: 'B', text: 'Evitamos peleas, farmeamos' },
      { letter: 'C', text: 'Me quedo cerca de mis carries' },
      { letter: 'D', text: 'Me voy a splitpushear al otro lado' },
    ],
  },
  {
    q: 'Estás en champ select. El equipo enemigo tiene mucho burst…',
    options: [
      { letter: 'A', text: 'Yo también voy a tope de daño' },
      { letter: 'B', text: 'Necesito escalar y sobrevivir el early' },
      { letter: 'C', text: 'Tengo que estar encima de mis carries' },
      { letter: 'D', text: 'No me preocupa, presionaré el mapa' },
    ],
  },
  {
    q: '¿Qué tipo de victoria te satisface más? (DESEMPATE)',
    options: [
      { letter: 'A', text: 'Carry enemigo eliminado 3+ veces' },
      { letter: 'B', text: 'CS perfecto, mejores ítems, daño sostenido' },
      { letter: 'C', text: 'Carries terminan con 0 muertes' },
      { letter: 'D', text: '3 torres destruidas yo solo' },
    ],
  },
];

export default function PlaystyleTestScreen({ navigation }) {
  const { setPlaystyle, faction } = useContext(OnboardingContext);
  const factionColor = faction && FACTIONS[faction]?.primary;
  const { colors: c, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  const [step, setStep]       = useState(0);
  const [answers, setAnswers] = useState([]); // ['A','C','B','D','A']
  const [profile, setProfile] = useState(null);
  const [picked, setPicked]   = useState(null); // visual highlight breve
  const fadeAnim = React.useRef(new Animated.Value(1)).current;

  const handleAnswer = (letter) => {
    if (picked) return; // evita doble-click durante la transición
    const next = [...answers, letter];
    setPicked(letter);
    setAnswers(next);

    // Fade out + avanza
    Animated.timing(fadeAnim, { toValue: 0, duration: 180, useNativeDriver: true }).start(() => {
      if (step < QUESTIONS.length - 1) {
        setStep(step + 1);
      } else {
        const result = detectPlaystyle(next);
        setProfile(result);
      }
      setPicked(null);
      Animated.timing(fadeAnim, { toValue: 1, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    });
  };

  const handleConfirm = () => {
    if (!profile) return;
    setPlaystyle(profile.code);
    navigation.navigate('ChampionQuiz');
  };

  const handleRetry = () => {
    setStep(0);
    setAnswers([]);
    setProfile(null);
  };

  // ─── Render ─────────────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: c.bg0 }}>
      {isDark && <NovaBackground />}
      <DevEscapeHatch />
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
      {/* B4.6 — indicador de paso unificado (mismo componente en los 4 pasos) */}
      <View style={{flexDirection:'row', alignItems:'center', gap:7, marginBottom:14}}>
        <ProgressDots current={3} style={{ marginTop: 0, marginBottom: 0 }} />
        <Text style={{color:'rgba(123,118,221,0.6)',fontSize:TYPE_SCALE.micro.size,fontWeight:'500',letterSpacing:2,marginLeft:4}}>PASO 3 DE 4</Text>
      </View>
      <Text style={styles.title}>Tu estilo de juego</Text>
      <Text style={styles.subtitle}>5 escenarios reales. No hay respuestas correctas — solo TU manera de jugar.</Text>

      {/* Barra de progreso del quiz */}
      <View style={styles.progressBar}>
        {QUESTIONS.map((_, i) => (
          <View
            key={i}
            style={[
              styles.progressDot,
              { backgroundColor: i < (profile ? QUESTIONS.length : step + 1) ? c.primary : 'rgba(123,118,221,0.10)' },
            ]}
          />
        ))}
      </View>

      {/* Quiz en curso */}
      {!profile && (
        <Animated.View style={{ opacity: fadeAnim }}>
          <Text style={styles.quizStep}>Pregunta {step + 1} de {QUESTIONS.length}</Text>
          <Text style={styles.quizQuestion}>{QUESTIONS[step].q}</Text>

          {QUESTIONS[step].options.map(opt => {
            const isPicked = picked === opt.letter;
            return (
              <TouchableOpacity
                key={opt.letter}
                style={[styles.optionBtn, isPicked && styles.optionBtnPicked]}
                onPress={() => handleAnswer(opt.letter)}
                activeOpacity={0.8}
              >
                <Text style={[styles.optionLetter, isPicked && styles.optionLetterPicked]}>{opt.letter}</Text>
                <Text style={styles.optionText}>{opt.text}</Text>
              </TouchableOpacity>
            );
          })}
        </Animated.View>
      )}

      {/* Resultado */}
      {profile && (
        <Animated.View style={[styles.resultBlock, { opacity: fadeAnim }]}>
          <Text style={styles.resultTag}>TU PERFIL</Text>
          <View style={styles.resultCard}>
            <Icon
              name={iconForProfile(profile.code)}
              size={36}
              color={c.primary}
            />
            <Text style={styles.resultTitle}>{profile.title}</Text>
            <Text style={styles.resultCode}>{profile.code}</Text>
            <Text style={styles.resultDesc}>{profile.desc}</Text>
          </View>

          {/* Distribución de respuestas */}
          <Text style={styles.distLabel}>DISTRIBUCIÓN DE TUS RESPUESTAS</Text>
          <View style={styles.distRow}>
            {Object.values(PLAYSTYLE_PROFILES).map(p => {
              const count = answersByProfile(answers, p.code);
              const pct = (count / QUESTIONS.length) * 100;
              return (
                <View key={p.code} style={styles.distCell}>
                  <View style={styles.distBarTrack}>
                    <View style={[styles.distBarFill, {
                      height: `${pct}%`,
                      backgroundColor: p.code === profile.code ? c.primary : c.onSurface(0.15),
                    }]} />
                  </View>
                  <Text style={[
                    styles.distLabel2,
                    { color: p.code === profile.code ? c.primary : c.onSurface(0.4) },
                  ]}>{p.code.slice(0, 4)}</Text>
                  <Text style={styles.distCount}>{count}</Text>
                </View>
              );
            })}
          </View>

          {/* CTA en púrpura neutro — la facción no tiñe este botón */}
          <View style={{ marginTop: 28 }}>
            <NovaButton
              label="CONTINUAR →"
              onPress={handleConfirm}
              factionColor={c.primary}
              size="lg"
            />
          </View>
          <TouchableOpacity onPress={handleRetry} style={styles.backLink}>
            <Text style={styles.backText}>← Repetir el test</Text>
          </TouchableOpacity>
        </Animated.View>
      )}
    </ScrollView>
    </View>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────
function answersByProfile(answers, code) {
  const map = { A: 'AGRESIVO', B: 'TACTICO', C: 'SUPPORTIVE', D: 'DOMINANTE' };
  return answers.filter(l => map[l] === code).length;
}

function iconForProfile(code) {
  switch (code) {
    case 'AGRESIVO':   return 'kda';
    case 'TACTICO':    return 'target';
    case 'SUPPORTIVE': return 'shield';
    case 'DOMINANTE':  return 'crown';
    default:           return 'spark';
  }
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
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: c.onSurface(0.04),
    borderWidth: 1, borderColor: 'rgba(123,118,221,0.15)',
    borderRadius: 12, padding: 14, marginBottom: 10,
    shadowColor: c.primary, shadowOpacity: 0.08, shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 }, elevation: 3,
  },
  optionBtnPicked: {
    borderWidth: 2, borderColor: c.primary,
    backgroundColor: 'rgba(123,118,221,0.12)',
  },
  optionLetter: {
    color: c.primary, fontSize: TYPE_SCALE.caption.size, fontWeight: '900',
    width: 22, height: 22, textAlign: 'center', lineHeight: 22,
    backgroundColor: 'rgba(123,118,221,0.15)', borderRadius: 4,
  },
  optionLetterPicked: {
    color: c.textInverse, backgroundColor: c.primary,
  },
  optionText: { color: c.onSurface(0.75), fontSize: TYPE_SCALE.label.size, flex: 1, lineHeight: 19 },

  // Resultado
  resultBlock: {},
  resultTag: { color: 'rgba(123,118,221,0.7)', fontSize: TYPE_SCALE.micro.size, fontWeight: '900', letterSpacing: 2 },
  resultCard: {
    marginTop: 10,
    backgroundColor: 'rgba(123,118,221,0.08)',
    borderWidth: 1.5, borderColor: 'rgba(123,118,221,0.4)',
    borderRadius: 8, padding: 22, alignItems: 'center', gap: 6,
  },
  resultTitle: { color: c.primary, fontSize: TYPE_SCALE.h4.size, fontWeight: '900', letterSpacing: 2, marginTop: 8 },
  resultCode: { color: 'rgba(123,118,221,0.7)', fontSize: TYPE_SCALE.caption.size, letterSpacing: 3, fontWeight: '900' },
  resultDesc: { color: c.onSurface(0.65), fontSize: TYPE_SCALE.label.size, textAlign: 'center', marginTop: 6, lineHeight: 18 },

  distLabel: { color: c.onSurface(0.35), fontSize: TYPE_SCALE.micro.size, fontWeight: '900', letterSpacing: 2, marginTop: 24, marginBottom: 8 },
  distRow: { flexDirection: 'row', gap: 8, height: 100 },
  distCell: { flex: 1, alignItems: 'center', gap: 4 },
  distBarTrack: {
    width: '100%', flex: 1, justifyContent: 'flex-end',
    backgroundColor: c.onSurface(0.04), borderRadius: 4, overflow: 'hidden',
  },
  distBarFill: { width: '100%', borderRadius: 4 },
  distLabel2: { fontSize: TYPE_SCALE.micro.size, fontWeight: '900', letterSpacing: 1 },
  distCount: { fontSize: TYPE_SCALE.micro.size, color: c.onSurface(0.4) },

  cta: {
    marginTop: 28,
    backgroundColor: 'rgba(123,118,221,0.15)',
    borderWidth: 1.5, borderColor: 'rgba(123,118,221,0.5)',
    borderRadius: 8, paddingVertical: 14, alignItems: 'center',
  },
  ctaText: { color: c.primary, fontSize: TYPE_SCALE.caption.size, fontWeight: '900', letterSpacing: 3 },
  backLink: { alignItems: 'center', marginTop: 14, padding: 8 },
  backText: { color: c.onSurface(0.45), fontSize: TYPE_SCALE.caption.size },
});
