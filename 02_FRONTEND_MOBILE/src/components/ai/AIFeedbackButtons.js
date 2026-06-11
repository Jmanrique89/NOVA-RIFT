// ============================================================================
// AIFeedbackButtons — Interfaces Naturales con IA (feedback loop, DIN2-UD5)
// ----------------------------------------------------------------------------
// Par de botones 👍/👎 (iconos Lucide thumbsUp/thumbsDown) que acompaña a cada
// recomendación de la IA: pick de campeón (ChampSelectHelper / setup rápido),
// insight del KPICoachingWidget y "QUÉ COMPRAR" del HUD.
//
// Al pulsar:
//   1. Micro-animación de spring (scale 1 → 1.25 → 1) en el icono votado.
//   2. Persistencia local en AsyncStorage `novarift:ai_feedback` como ARRAY de
//      eventos { tipo, id, voto, ts } (se conserva el histórico; el último
//      evento de un (tipo, id) define el estado visual al remontar).
//
// No hay POST a backend: no existe endpoint de analytics y DIN2 valora el
// feedback loop en sí, no el transporte. El array local es exportable.
// ============================================================================
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Animated, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from '../Icon';
import { useTheme } from '../../context/ThemeContext';

const STORAGE_KEY = 'novarift:ai_feedback';

/**
 * Lee el histórico de votos y devuelve el último voto para (tipo, id), o null.
 * Tolerante a JSON corrupto/inexistente (devuelve null sin lanzar).
 */
async function readLastVote(tipo, id) {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const events = JSON.parse(raw);
    if (!Array.isArray(events)) return null;
    for (let i = events.length - 1; i >= 0; i--) {
      if (events[i]?.tipo === tipo && events[i]?.id === id) return events[i].voto;
    }
    return null;
  } catch (_) {
    return null;
  }
}

/** Añade un evento {tipo,id,voto,ts} al array persistido (best-effort). */
async function appendVote(tipo, id, voto) {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    let events = [];
    try { events = JSON.parse(raw) || []; } catch (_) { events = []; }
    if (!Array.isArray(events)) events = [];
    events.push({ tipo, id, voto, ts: Date.now() });
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(events));
  } catch (_) { /* el feedback es best-effort: nunca rompe la UI */ }
}

/**
 * Botones de feedback 👍/👎 para una recomendación de IA.
 *
 * @param {object} props
 * @param {string} props.tipo Categoría de la recomendación
 *   ('champ_pick' | 'kpi_insight' | 'item_reco' | ...).
 * @param {string} props.id Identificador de ESTA recomendación (campeón,
 *   clave del KPI, nombre del ítem...). Cambiarlo resetea el estado visual.
 * @param {string} [props.accentColor] Color del voto activo (default primary).
 * @param {string} [props.label='¿Te sirvió?'] Microcopy a la izquierda; '' lo oculta.
 * @param {object} [props.style] Estilo extra del contenedor.
 */
export default function AIFeedbackButtons({ tipo, id, accentColor, label = '¿Te sirvió?', style }) {
  const { colors: c } = useTheme();
  const accent = accentColor || c.primary;
  const [vote, setVote] = useState(null);
  const upScale   = useRef(new Animated.Value(1)).current;
  const downScale = useRef(new Animated.Value(1)).current;

  // Restaurar el último voto de ESTA recomendación al montar / cambiar de id.
  useEffect(() => {
    let cancelled = false;
    setVote(null);
    readLastVote(tipo, id).then(v => { if (!cancelled) setVote(v); });
    return () => { cancelled = true; };
  }, [tipo, id]);

  const press = (voto) => {
    setVote(voto);
    appendVote(tipo, id, voto);
    const anim = voto === 'up' ? upScale : downScale;
    Animated.sequence([
      Animated.spring(anim, { toValue: 1.25, friction: 4, tension: 220, useNativeDriver: true }),
      Animated.spring(anim, { toValue: 1,    friction: 5, tension: 180, useNativeDriver: true }),
    ]).start();
  };

  return (
    <View style={[styles.row, style]}>
      {label ? <Text style={[styles.label, { color: c.textSecondary }]}>{label}</Text> : null}
      <TouchableOpacity
        onPress={() => press('up')}
        activeOpacity={0.7}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        accessibilityRole="button"
        accessibilityLabel="Recomendación útil"
        accessibilityState={{ selected: vote === 'up' }}
      >
        <Animated.View style={[
          styles.btn,
          { transform: [{ scale: upScale }] },
          vote === 'up' && { backgroundColor: accent + '22', borderColor: accent },
        ]}>
          <Icon name="thumbsUp" size={13} color={vote === 'up' ? accent : c.textSecondary} strokeWidth={2} />
        </Animated.View>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => press('down')}
        activeOpacity={0.7}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        accessibilityRole="button"
        accessibilityLabel="Recomendación no útil"
        accessibilityState={{ selected: vote === 'down' }}
      >
        <Animated.View style={[
          styles.btn,
          { transform: [{ scale: downScale }] },
          vote === 'down' && { backgroundColor: '#E5393522', borderColor: '#E53935' },
        ]}>
          <Icon name="thumbsDown" size={13} color={vote === 'down' ? '#E53935' : c.textSecondary} strokeWidth={2} />
        </Animated.View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginTop: 8,
  },
  label: { fontSize: 10, letterSpacing: 0.8, fontWeight: '600', marginRight: 2 },
  btn: {
    width: 26, height: 26, borderRadius: 13,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center', justifyContent: 'center',
  },
});
