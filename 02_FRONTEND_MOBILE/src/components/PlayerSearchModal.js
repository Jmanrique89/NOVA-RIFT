// ============================================================================
// PlayerSearchModal — buscar jugador por riotId
// ----------------------------------------------------------------------------
// versión inicial con 5 estados (idle/loading/notFound/error/result).
// histórico persistente:
// Al lanzar una búsqueda exitosa, el riotId+region se guarda en
// AsyncStorage (`@novarift:player_search_history`) — máximo 5
// entradas, deduplicadas por riotId+region, más reciente primero.
// Al abrir el modal, se hidrata el historial. Cada entrada se
// muestra como chip clicable bajo el input — tap rellena los
// campos y dispara la búsqueda automáticamente.
// Tap largo en un chip lo elimina del historial (×).
//
// Cuando el SummonerSummary tiene `mock: true` (key falló o backend caído),
// el header pinta un badge dorado "DEMO" para que quede claro que los
// datos no son reales.
// ============================================================================
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal, View, Text, TouchableOpacity, TextInput, Image,
  ActivityIndicator, ScrollView, Animated, Easing, StyleSheet, Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchSummonerSummary, RiotApiError, rankedLabel, rankedWinrate } from '../services/riotApi';
import { getChampionImageUrl } from '../utils/dataDragon';
import { useTheme } from '../context/ThemeContext';

const REGIONS = [
  { id: 'euw1', label: 'EUW' },
  { id: 'eun1', label: 'EUNE' },
  { id: 'na1',  label: 'NA' },
  { id: 'kr',   label: 'KR' },
  { id: 'br1',  label: 'BR' },
  { id: 'jp1',  label: 'JP' },
];

// clave de AsyncStorage para el histórico (5 entradas máx).
const HISTORY_KEY = '@novarift:player_search_history';
const HISTORY_MAX = 5;

export default function PlayerSearchModal({ visible, theme, onClose }) {
  const { colors: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [riotId, setRiotId]       = useState('');
  const [region, setRegion]       = useState('euw1');
  const [state, setState]         = useState('idle'); // idle|loading|notFound|error|result
  const [summary, setSummary]     = useState(null);
  const [errMessage, setErrMsg]   = useState('');
  // historial persistido. Lista de { riotId, region, ts }.
  const [history, setHistory]     = useState([]);

  // Animación slide-up del sheet
  const slideY  = useRef(new Animated.Value(80)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  // ─── Persistencia del histórico ──────────────────────────────────────────
  // Cargar al abrir.
  useEffect(() => {
    if (!visible) return;
    AsyncStorage.getItem(HISTORY_KEY)
      .then(raw => {
        if (!raw) return;
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) setHistory(parsed.slice(0, HISTORY_MAX));
        } catch {
          /* JSON corrupto → ignoramos y dejamos historial vacío */
        }
      })
      .catch(() => { /* AsyncStorage no disponible (web SSR) → ignorar */ });
  }, [visible]);

  /**
   * Añade `{ riotId, region }` al historial:
   * Deduplica por `riotId+region` (case-insensitive).
   * La nueva entrada va arriba (más reciente).
   * Trunca a HISTORY_MAX.
   * Persiste en AsyncStorage (best effort).
   */
  const pushHistory = useCallback(async (id, reg) => {
    const norm = id.trim();
    if (!norm) return;
    setHistory(prev => {
      const dedup = prev.filter(
        e => !(e.riotId.toLowerCase() === norm.toLowerCase() && e.region === reg)
      );
      const next = [{ riotId: norm, region: reg, ts: Date.now() }, ...dedup].slice(0, HISTORY_MAX);
      AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(next)).catch(() => { /* ignore */ });
      return next;
    });
  }, []);

  const removeHistoryEntry = useCallback(async (riotIdEntry, regionEntry) => {
    setHistory(prev => {
      const next = prev.filter(
        e => !(e.riotId === riotIdEntry && e.region === regionEntry)
      );
      AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(next)).catch(() => { /* ignore */ });
      return next;
    });
  }, []);

  // ─── Animación + reset al abrir ──────────────────────────────────────────
  useEffect(() => {
    if (!visible) return;
    setState('idle');
    setSummary(null);
    setErrMsg('');
    opacity.setValue(0);
    slideY.setValue(80);
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.timing(slideY,  { toValue: 0, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, [visible, opacity, slideY]);

  const t = theme || { primary: '#7B61FF', accent: '#7B76DD', text: '#E8E4FF' };

  // ─── Búsqueda ────────────────────────────────────────────────────────────
  // `overrideId` y `overrideRegion` permiten que un tap en el chip de
  // historial dispare la búsqueda con esos valores sin esperar al render
  // (los setState son asíncronos).
  const runSearch = useCallback(async (overrideId, overrideRegion) => {
    const idToUse  = (overrideId  ?? riotId).trim();
    const regToUse =  overrideRegion ?? region;

    if (!idToUse || !idToUse.includes('#')) {
      setState('error');
      setErrMsg("Formato inválido. Esperado 'GameName#TAG'.");
      return;
    }
    setState('loading');
    setErrMsg('');
    try {
      const out = await fetchSummonerSummary(idToUse, { region: regToUse });
      setSummary(out);
      setState('result');
      // al obtener un resultado (real o mock), guardamos en historial.
      pushHistory(idToUse, regToUse);
    } catch (err) {
      if (err instanceof RiotApiError && err.code === 'NOT_FOUND') {
        setState('notFound');
      } else {
        setState('error');
        setErrMsg(err?.message || 'Error inesperado');
      }
    }
  }, [riotId, region, pushHistory]);

  const onHistoryChipPress = useCallback((entry) => {
    setRiotId(entry.riotId);
    setRegion(entry.region);
    runSearch(entry.riotId, entry.region);
  }, [runSearch]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[styles.backdrop, { opacity }]}>
        <TouchableOpacity style={styles.backdropTouch} activeOpacity={1} onPress={onClose} />
      </Animated.View>

      <Animated.View
        style={[
          styles.sheet,
          { borderColor: t.primary + '55', transform: [{ translateY: slideY }], opacity },
        ]}
      >
        <View style={styles.handle} />

        <View style={styles.header}>
          <Text style={[styles.title, { color: t.primary }]}>BUSCAR JUGADOR</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.closeBtn}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scrollHost}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Input + región ───────────────────────────────────────── */}
          <Text style={styles.sectionLabel}>RIOT ID</Text>
          <TextInput
            style={[styles.input, { color: c.textPrimary, borderColor: t.primary + '33' }]}
            value={riotId}
            onChangeText={setRiotId}
            placeholder="Faker#KR1"
            placeholderTextColor={c.onSurface(0.30)}
            autoCapitalize="none"
            autoCorrect={false}
            onSubmitEditing={() => runSearch()}
          />

          <Text style={[styles.sectionLabel, { marginTop: 14 }]}>REGIÓN</Text>
          <View style={styles.regionRow}>
            {REGIONS.map(r => {
              const active = region === r.id;
              return (
                <TouchableOpacity
                  key={r.id}
                  onPress={() => setRegion(r.id)}
                  style={[
                    styles.regionPill,
                    active && { backgroundColor: t.primary + '22', borderColor: t.primary + '99' },
                  ]}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.regionPillText, active && { color: t.primary }]}>{r.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Histórico de búsquedas (chips clicables) */}
          {history.length > 0 && (
            <View style={styles.historyWrap}>
              <Text style={[styles.sectionLabel, { marginTop: 14 }]}>RECIENTES</Text>
              <View style={styles.historyRow}>
                {history.map(entry => (
                  <View key={`${entry.riotId}-${entry.region}`} style={styles.historyChipWrap}>
                    <TouchableOpacity
                      onPress={() => onHistoryChipPress(entry)}
                      style={[styles.historyChip, { borderColor: t.primary + '44' }]}
                      activeOpacity={0.85}
                    >
                      <Text style={[styles.historyChipText, { color: c.textPrimary }]} numberOfLines={1}>
                        {entry.riotId}
                      </Text>
                      <Text style={[styles.historyChipRegion, { color: t.primary }]}>
                        · {entry.region.toUpperCase()}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => removeHistoryEntry(entry.riotId, entry.region)}
                      style={styles.historyChipClose}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    >
                      <Text style={styles.historyChipCloseText}>×</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* ── CTA ──────────────────────────────────────────────────── */}
          <TouchableOpacity
            onPress={() => runSearch()}
            disabled={state === 'loading'}
            style={[
              styles.searchBtn,
              { backgroundColor: t.primary + '22', borderColor: t.primary + '88' },
              state === 'loading' && { opacity: 0.5 },
            ]}
            activeOpacity={0.85}
          >
            <Text style={[styles.searchBtnText, { color: t.primary }]}>
              {state === 'loading' ? 'CONSULTANDO RIOT…' : 'BUSCAR'}
            </Text>
          </TouchableOpacity>

          {/* ── Estados ──────────────────────────────────────────────── */}
          {state === 'loading' && (
            <View style={styles.loadingWrap}>
              <ActivityIndicator color={t.primary} size="large" />
            </View>
          )}

          {state === 'notFound' && (
            <View style={[styles.errorBox, { borderColor: 'rgba(255,82,82,0.45)' }]}>
              <Text style={styles.errorTitle}>SIN RESULTADOS</Text>
              <Text style={styles.errorBody}>
                No hemos encontrado a "{riotId}" en la región {region.toUpperCase()}.
              </Text>
            </View>
          )}

          {state === 'error' && (
            <View style={[styles.errorBox, { borderColor: 'rgba(255,82,82,0.45)' }]}>
              <Text style={styles.errorTitle}>ERROR</Text>
              <Text style={styles.errorBody}>{errMessage || 'No se pudo completar la búsqueda.'}</Text>
            </View>
          )}

          {state === 'result' && summary && (
            <SummaryView summary={summary} theme={t} />
          )}
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

// ─── Sub-componente del resultado ──────────────────────────────────────────
function SummaryView({ summary, theme }) {
  const { colors: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const solo = summary.soloRanked;
  const flex = summary.flexRanked;

  const iconUrl = summary.profileIconId
    ? `https://ddragon.leagueoflegends.com/cdn/14.1.1/img/profileicon/${summary.profileIconId}.png`
    : null;

  return (
    <View style={styles.resultWrap}>
      <View style={[styles.resultHeader, { borderColor: theme.primary + '33' }]}>
        {iconUrl && (
          <Image
            source={{ uri: iconUrl }}
            style={[styles.resultIcon, { borderColor: theme.primary + '88' }]}
          />
        )}
        <View style={{ flex: 1 }}>
          <View style={styles.nameRow}>
            <Text style={styles.resultName} numberOfLines={1}>{summary.gameName}</Text>
            <Text style={styles.resultTag}>#{summary.tagLine}</Text>
            {summary.mock && (
              <View style={styles.demoBadge}>
                <Text style={styles.demoBadgeText}>DEMO</Text>
              </View>
            )}
          </View>
          <Text style={styles.resultSub}>
            Nivel {summary.summonerLevel} · {summary.region}
          </Text>
        </View>
      </View>

      {/* ── Ranked solo + flex ── */}
      <View style={styles.rankRow}>
        <RankCard label="SOLO/DUO" entry={solo} theme={theme} />
        <RankCard label="FLEX"     entry={flex} theme={theme} />
      </View>

      {/* ── Últimas partidas ── */}
      <Text style={[styles.sectionLabel, { marginTop: 16 }]}>
        ÚLTIMAS {summary.recentMatches?.length || 0} PARTIDAS
      </Text>

      {(!summary.recentMatches || summary.recentMatches.length === 0) ? (
        <Text style={styles.emptyMatches}>
          Sin partidas recientes disponibles.
        </Text>
      ) : (
        summary.recentMatches.map((m, idx) => (
          <MatchRow key={m.matchId || idx} match={m} theme={theme} />
        ))
      )}
    </View>
  );
}

function RankCard({ label, entry, theme }) {
  const { colors: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const wr = rankedWinrate(entry);
  const lbl = rankedLabel(entry);
  return (
    <View style={[styles.rankCard, { borderColor: theme.primary + '22' }]}>
      <Text style={styles.rankLabel}>{label}</Text>
      <Text style={[styles.rankValue, { color: theme.primary }]}>{lbl}</Text>
      <Text style={styles.rankSub}>
        {entry?.wins ?? 0}V {entry?.losses ?? 0}D · {wr}% WR
      </Text>
    </View>
  );
}

function MatchRow({ match, theme }) {
  const { colors: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const isWin = match.result === 'WIN';
  const accent = isWin ? '#7B76DD' : '#FF5252';
  const champUrl = getChampionImageUrl(match.championName);
  // El backend envía kills/deaths/assists pero NO un campo `kda` precalculado,
  // así que lo derivamos aquí: (K + A) / max(1, D). Antes se mostraba "KDA 0.0"
  // para todas las partidas reales porque match.kda era undefined.
  const kdaValue = typeof match.kda === 'number'
    ? match.kda
    : (match.kills + match.assists) / Math.max(1, match.deaths);
  return (
    <View style={[styles.matchRow, { borderLeftColor: accent }]}>
      <Image source={{ uri: champUrl }} style={styles.matchImg} />
      <View style={{ flex: 1 }}>
        <Text style={styles.matchChamp}>{match.championName}</Text>
        <Text style={styles.matchSub}>
          {match.kills}/{match.deaths}/{match.assists} · KDA {kdaValue.toFixed(1)} · {match.role || '-'}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={[styles.matchResult, { color: accent }]}>{isWin ? 'V' : 'D'}</Text>
        <Text style={styles.matchDuration}>{match.durationMinutes}min</Text>
      </View>
    </View>
  );
}

const makeStyles = (c) => StyleSheet.create({
  backdrop: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  backdropTouch: { flex: 1 },
  sheet: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    backgroundColor: c.bg1,
    borderTopLeftRadius: 18, borderTopRightRadius: 18,
    borderTopWidth: 1, borderLeftWidth: 1, borderRightWidth: 1,
    maxHeight: '92%',
    paddingBottom: Platform.OS === 'ios' ? 32 : 16,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: c.onSurface(0.20),
    alignSelf: 'center', marginTop: 8, marginBottom: 4,
  },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4,
  },
  title: {
    fontSize: 13, fontWeight: '900', letterSpacing: 3,
  },
  closeBtn: {
    color: c.onSurface(0.55), fontSize: 18, fontWeight: '700',
  },

  scrollHost: { flex: 0 },
  scroll: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24 },

  sectionLabel: {
    color: c.onSurface(0.45),
    fontSize: 9, fontWeight: '900', letterSpacing: 2, marginBottom: 6,
  },
  input: {
    borderWidth: 1, borderRadius: 8, padding: 12, fontSize: 14,
    backgroundColor: c.surface,
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' } : {}),
  },

  regionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  regionPill: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 6, borderWidth: 1, borderColor: c.onSurface(0.12),
    backgroundColor: c.onSurface(0.03),
  },
  regionPillText: {
    color: c.onSurface(0.55), fontSize: 11, fontWeight: '700', letterSpacing: 1,
  },

  searchBtn: {
    marginTop: 18, borderWidth: 1, borderRadius: 10,
    paddingVertical: 14, alignItems: 'center',
  },
  searchBtnText: { fontSize: 12, fontWeight: '900', letterSpacing: 2 },

  loadingWrap: { marginTop: 18, alignItems: 'center' },

  // historial persistido
  historyWrap: { marginTop: 4 },
  historyRow:  { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  historyChipWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: c.surface,
    borderRadius: 6, borderWidth: 1, borderColor: c.onSurface(0.08),
    paddingLeft: 10, paddingRight: 4, paddingVertical: 5,
  },
  historyChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingRight: 6, maxWidth: 180,
  },
  historyChipText:   { fontSize: 11, fontWeight: '700' },
  historyChipRegion: { fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
  historyChipClose:  {
    paddingHorizontal: 6, paddingVertical: 2,
    marginLeft: 2,
  },
  historyChipCloseText: {
    color: c.onSurface(0.40), fontSize: 14, fontWeight: '900',
  },

  errorBox: {
    marginTop: 18, padding: 14,
    borderWidth: 1, borderRadius: 8,
    backgroundColor: 'rgba(255,82,82,0.06)',
  },
  errorTitle: {
    color: '#FF5252', fontSize: 11, fontWeight: '900', letterSpacing: 2, marginBottom: 4,
  },
  errorBody: { color: c.onSurface(0.65), fontSize: 12, lineHeight: 18 },

  resultWrap: { marginTop: 18 },
  resultHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 12, borderRadius: 10, borderWidth: 1,
    backgroundColor: c.surface,
  },
  resultIcon: {
    width: 56, height: 56, borderRadius: 28, borderWidth: 2,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
  resultName: { color: c.textPrimary, fontSize: 16, fontWeight: '900', letterSpacing: 0.5 },
  resultTag:  { color: c.onSurface(0.45), fontSize: 12, fontWeight: '700' },
  demoBadge: {
    marginLeft: 4,
    paddingHorizontal: 6, paddingVertical: 2,
    backgroundColor: 'rgba(255,179,0,0.18)',
    borderColor: 'rgba(255,179,0,0.55)',
    borderWidth: 1, borderRadius: 3,
  },
  demoBadgeText: { color: '#FFB300', fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  resultSub:  { color: c.onSurface(0.45), fontSize: 11, marginTop: 2 },

  rankRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  rankCard: {
    flex: 1, borderWidth: 1, borderRadius: 8, padding: 10,
    backgroundColor: c.onSurface(0.03),
  },
  rankLabel: {
    color: c.onSurface(0.40), fontSize: 9, fontWeight: '900',
    letterSpacing: 1.5, marginBottom: 4,
  },
  rankValue: { fontSize: 14, fontWeight: '900', letterSpacing: 0.5 },
  rankSub:   { color: c.onSurface(0.50), fontSize: 10, marginTop: 2 },

  emptyMatches: {
    color: c.onSurface(0.40),
    fontSize: 11, fontStyle: 'italic',
    marginTop: 6,
  },
  matchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 8, paddingHorizontal: 10,
    borderLeftWidth: 3,
    borderRadius: 4, marginBottom: 4,
    backgroundColor: c.onSurface(0.03),
  },
  matchImg: {
    width: 36, height: 36, borderRadius: 4,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  matchChamp: { color: c.textPrimary, fontSize: 12, fontWeight: '700' },
  matchSub:   { color: c.onSurface(0.50), fontSize: 10, marginTop: 2 },
  matchResult:   { fontSize: 16, fontWeight: '900' },
  matchDuration: { color: c.onSurface(0.40), fontSize: 9, marginTop: 1 },
});
