// ============================================================================
// MatchExpandedPanel — desglose de partida estilo op.gg (3 pestañas)
// ----------------------------------------------------------------------------
// Se monta debajo de la fila de MatchRow cuando el usuario pulsa una partida en
// el tab PERFIL (HubScreen). Tres pestañas:
//   · GENERAL  — los 10 jugadores por equipo: thumb · KDA · CS · daño (+barra)
//                · oro · 6 ítems. NovaRift destacado en púrpura.
//   · ANÁLISIS — comparativa de equipo: oro / daño / kills en barras enfrentadas,
//                objetivos por equipo y la línea temporal de objetivos (orden).
//   · BUILD    — build de cada jugador (ítems grandes + hechizos + runa).
//
// Componente presentacional puro. Los datos vienen en `match.matchDetails`
// (generado en src/mocks/novaStats.js). Cuando exista el backend match-v5 real,
// basta con poblar el mismo shape: esta UI no cambia. Si `matchDetails` falta
// (partidas reales sin desglose), degradamos a un resumen con lo que SÍ tenemos.
// ============================================================================
import React, { useMemo, useState } from 'react';
import { View, Text, Image, StyleSheet, Platform, ScrollView, Pressable } from 'react-native';
import { getChampionImageUrl, getItemImageUrl, getSpellImageUrl, getRuneImageUrl } from '../utils/dataDragon';
import { useTheme } from '../context/ThemeContext';

// Tamaño responsive del slot de ítem: 24px en web (legible en desktop) y 18px
// en móvil (compacto). El build usa una variante más grande (legibilidad).
const ITEM_SIZE = Platform.OS === 'web' ? 24 : 18;
const BUILD_ITEM_SIZE = Platform.OS === 'web' ? 30 : 24;

// Colores de equipo (mismos que ya usaba la cabecera de equipo).
const BLUE = '#7B76DD';
const RED  = '#E74C3C';

const fmtK = (v) => (Number.isFinite(v) ? `${(v / 1000).toFixed(1)}k` : '—');
// Kills de un jugador desde su string "k/d/a".
const killsOf = (p) => parseInt(String(p?.kda || '').split('/')[0], 10) || 0;
const sumBy = (team, fn) => (team || []).reduce((s, p) => s + (fn(p) || 0), 0);

export default function MatchExpandedPanel({ match }) {
  const { colors: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const fbStyles = useMemo(() => makeFbStyles(c), [c]);

  // Pestaña activa del desglose (vive por panel; se reinicia al desmontar).
  const [tab, setTab] = useState('general');

  if (!match) return null;

  const details = match.matchDetails;

  // Las partidas del backend real (mapRealMatches) llegan con matchDetails:null.
  // En ese caso, en lugar de no pintar nada (desplegable aparentemente roto),
  // degradamos a un resumen con las stats que SÍ tenemos de la partida.
  if (!details) {
    return (
      <View style={styles.panel}>
        <View style={fbStyles.row}>
          <FbStat label="KDA" value={`${match.kills ?? '—'}/${match.deaths ?? '—'}/${match.assists ?? '—'}`} />
          <FbStat label="CS" value={`${match.cs ?? '—'} · ${match.cspm ?? '—'}/min`} />
          <FbStat label="VISIÓN" value={String(match.visionScore ?? '—')} />
          <FbStat label="DAÑO" value={match.damageToChamps ? fmtK(match.damageToChamps) : '—'} />
          {Number.isFinite(match.gold) && <FbStat label="ORO" value={fmtK(match.gold)} />}
          <FbStat label="DURACIÓN" value={`${match.durationMin ?? '—'} min`} />
        </View>
        <Text style={fbStyles.note}>
          Desglose por equipos disponible cuando el historial incluya el detalle completo de la partida.
        </Text>
      </View>
    );
  }

  // blueObjectives/redObjectives/blueGold/redGold/objectiveOrder son claves nuevas:
  // las partidas antiguas pueden no traerlas, así que pueden venir undefined y las
  // pestañas las omiten con guardas.
  const {
    blueTeam, redTeam,
    blueObjectives, redObjectives,
    blueGold, redGold,
    objectiveOrder,
  } = details;
  const userWon = match.result === 'W' || match.result === 'WIN';

  // Daño máximo de la partida → normaliza las barras de daño por jugador.
  const allPlayers = [...(blueTeam || []), ...(redTeam || [])];
  const maxDamage = Math.max(1, ...allPlayers.map((p) => p.damage || 0));

  const TABS = [
    { id: 'general', label: 'GENERAL' },
    { id: 'team',    label: 'ANÁLISIS' },
    { id: 'build',   label: 'BUILD' },
  ];

  return (
    <View style={styles.panel}>
      {/* ── Barra de pestañas ─────────────────────────────────────────── */}
      <View style={styles.tabBar}>
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <Pressable
              key={t.id}
              onPress={() => setTab(t.id)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              style={[styles.tabBtn, active && styles.tabBtnActive]}
            >
              <Text style={[styles.tabBtnText, active && styles.tabBtnTextActive]}>{t.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {tab === 'general' && (() => {
        const content = (
          <>
            <TeamSection team={blueTeam} objectives={blueObjectives} gold={blueGold} label="EQUIPO AZUL" won={userWon} maxDamage={maxDamage} />
            <View style={styles.divider} />
            <TeamSection team={redTeam} objectives={redObjectives} gold={redGold} label="EQUIPO ROJO" won={!userWon} maxDamage={maxDamage} />
          </>
        );
        // En móvil cada fila de jugador (thumb + hechizos + nombre + CS + daño +
        // oro + 6 ítems) suma más ancho del que cabe en pantalla y se cortaba por
        // la derecha. La envolvemos en un scroll HORIZONTAL con ancho mínimo: el
        // usuario desliza para ver oro/ítems. En web (desktop) cabe entera.
        if (Platform.OS === 'web') return content;
        return (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator
            contentContainerStyle={styles.generalScroll}
          >
            <View style={styles.generalInner}>{content}</View>
          </ScrollView>
        );
      })()}

      {tab === 'team' && (
        <TeamAnalysis
          blueTeam={blueTeam} redTeam={redTeam}
          blueObjectives={blueObjectives} redObjectives={redObjectives}
          blueGold={blueGold} redGold={redGold}
          objectiveOrder={objectiveOrder}
          userWon={userWon}
        />
      )}

      {tab === 'build' && (
        <BuildTab blueTeam={blueTeam} redTeam={redTeam} />
      )}
    </View>
  );
}

// Celda de stat del resumen de respaldo (cuando no hay matchDetails).
function FbStat({ label, value }) {
  const { colors: c } = useTheme();
  const fbStyles = useMemo(() => makeFbStyles(c), [c]);
  return (
    <View style={fbStyles.stat}>
      <Text style={fbStyles.statValue}>{value}</Text>
      <Text style={fbStyles.statLabel}>{label}</Text>
    </View>
  );
}

const makeFbStyles = (c) => StyleSheet.create({
  row: {
    flexDirection: 'row', flexWrap: 'wrap',
    justifyContent: 'space-between', gap: 8,
  },
  stat: { alignItems: 'center', minWidth: 64, paddingVertical: 4 },
  statValue: { color: c.onSurface(0.92), fontSize: 14, fontWeight: '800' },
  statLabel: {
    color: c.onSurface(0.40), fontSize: 9,
    fontWeight: '900', letterSpacing: 1.5, marginTop: 2,
  },
  note: {
    color: c.onSurface(0.35), fontSize: 10,
    fontStyle: 'italic', marginTop: 8, textAlign: 'center',
  },
});

// ─── PESTAÑA GENERAL — equipos con 10 jugadores ──────────────────────────────
function TeamSection({ team, label, won, objectives, gold, maxDamage }) {
  const { colors: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
    <View>
      <View style={styles.teamHeader}>
        <Text style={styles.teamLabel}>{label}</Text>
        {objectives ? (
          <View style={styles.objectivesRow}>
            <Text style={styles.objItem}>🐉 {objectives.dragons ?? 0}</Text>
            <Text style={styles.objItem}>👁 {objectives.herald ?? 0}</Text>
            <Text style={styles.objItem}>🟣 {objectives.baron ?? 0}</Text>
            <Text style={styles.objItem}>🗼 {objectives.towers ?? 0}</Text>
          </View>
        ) : null}
        {Number.isFinite(gold) ? (
          <Text style={styles.teamGold}>{(gold / 1000).toFixed(1)}k oro</Text>
        ) : null}
        <Text style={[styles.teamResult, { color: won ? BLUE : RED }]}>
          {won ? 'VICTORIA' : 'DERROTA'}
        </Text>
      </View>
      {(team || []).map((player, i) => (
        <PlayerRow key={i} player={player} maxDamage={maxDamage} />
      ))}
    </View>
  );
}

function PlayerRow({ player, maxDamage }) {
  const { colors: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  // Los items son IDs numéricos de DataDragon; 0/null representa un slot vacío.
  const items = Array.from({ length: 6 }, (_, j) => {
    const v = (player.items || [])[j];
    return Number.isFinite(v) && v > 0 ? v : 0;
  });
  // Hechizos de invocador (máx 2) + keystone. Claves nuevas: pueden faltar en
  // partidas antiguas, así que guardamos contra undefined y URLs nulas.
  const spells = (player.summonerSpells || []).slice(0, 2);
  const spellUrls = spells.map((s) => getSpellImageUrl(s)).filter(Boolean);
  const runeUrl = player.primaryRune ? getRuneImageUrl(player.primaryRune) : null;
  const dmgPct = Math.max(0.04, Math.min(1, (player.damage || 0) / (maxDamage || 1)));
  return (
    <View style={[styles.playerRow, player.isUser && styles.playerRowHighlight]}>
      <Image
        source={{ uri: getChampionImageUrl(player.champion) }}
        style={styles.champThumb}
      />
      <View style={styles.spellRuneCol}>
        {spellUrls.map((uri, k) => (
          <Image key={k} source={{ uri }} style={styles.spellImg} />
        ))}
        {runeUrl ? (
          <Image source={{ uri: runeUrl }} style={styles.runeImg} />
        ) : null}
      </View>
      <View style={styles.playerInfo}>
        <Text
          style={[styles.playerName, player.isUser && styles.playerNameUser]}
          numberOfLines={1}
        >
          {player.summonerName}
        </Text>
        <Text style={styles.playerKda}>{player.kda}</Text>
      </View>
      <Text style={styles.playerCs}>{player.cs} CS</Text>
      {/* Daño con mini-barra normalizada (estilo op.gg). */}
      <View style={styles.dmgCol}>
        <Text style={styles.playerDmg}>{(player.damage / 1000).toFixed(1)}k</Text>
        <View style={styles.dmgBarTrack}>
          <View style={[styles.dmgBarFill, { width: `${Math.round(dmgPct * 100)}%`, backgroundColor: player.isUser ? BLUE : c.onSurface(0.35) }]} />
        </View>
      </View>
      {/* Oro por jugador. */}
      <Text style={styles.playerGold}>{Number.isFinite(player.gold) ? `${(player.gold / 1000).toFixed(1)}k` : '—'}</Text>
      <View style={styles.itemsRow}>
        {items.map((id, j) => (
          <View
            key={j}
            style={[styles.itemDot, id !== 0 && styles.itemDotFilled]}
          >
            {id !== 0 ? (
              <Image
                source={{ uri: getItemImageUrl(id) }}
                style={styles.itemImg}
                resizeMode="cover"
              />
            ) : null}
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── PESTAÑA ANÁLISIS — comparativa de equipo + orden de objetivos ───────────
function TeamAnalysis({ blueTeam, redTeam, blueObjectives, redObjectives, blueGold, redGold, objectiveOrder, userWon }) {
  const { colors: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  const blueKills = sumBy(blueTeam, killsOf);
  const redKills  = sumBy(redTeam, killsOf);
  const blueDmg   = sumBy(blueTeam, (p) => p.damage);
  const redDmg    = sumBy(redTeam, (p) => p.damage);
  const bGold = Number.isFinite(blueGold) ? blueGold : sumBy(blueTeam, (p) => p.gold);
  const rGold = Number.isFinite(redGold) ? redGold : sumBy(redTeam, (p) => p.gold);

  return (
    <View style={styles.analysis}>
      {/* Resultado por equipo */}
      <View style={styles.analysisResultRow}>
        <Text style={[styles.analysisTeam, { color: BLUE }]}>AZUL · {userWon ? 'VICTORIA' : 'DERROTA'}</Text>
        <Text style={[styles.analysisTeam, { color: RED, textAlign: 'right' }]}>{userWon ? 'DERROTA' : 'VICTORIA'} · ROJO</Text>
      </View>

      {/* Barras enfrentadas: kills / oro / daño */}
      <CompareRow label="KILLS" blue={blueKills} red={redKills} fmt={(v) => String(v)} />
      <CompareRow label="ORO"   blue={bGold}     red={rGold}    fmt={fmtK} />
      <CompareRow label="DAÑO"  blue={blueDmg}   red={redDmg}   fmt={fmtK} />

      {/* Objetivos por equipo */}
      {(blueObjectives || redObjectives) && (
        <View style={styles.objCompareRow}>
          <ObjectivesBlock obj={blueObjectives} color={BLUE} align="flex-start" />
          <Text style={styles.objCompareLabel}>OBJETIVOS</Text>
          <ObjectivesBlock obj={redObjectives} color={RED} align="flex-end" />
        </View>
      )}

      {/* Línea temporal de objetivos (orden) */}
      {Array.isArray(objectiveOrder) && objectiveOrder.length > 0 && (
        <View style={{ marginTop: 12 }}>
          <Text style={styles.analysisHeading}>ORDEN DE OBJETIVOS</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.timelineRow}>
            {objectiveOrder.map((e, i) => (
              <View key={i} style={[styles.timelineChip, { borderColor: (e.team === 'blue' ? BLUE : RED) + '88' }]}>
                <Text style={styles.timelineGlyph}>{e.glyph}</Text>
                <Text style={[styles.timelineMin, { color: e.team === 'blue' ? BLUE : RED }]}>{e.minute}'</Text>
              </View>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

// Barra de comparación enfrentada azul vs rojo (proporcional al valor).
function CompareRow({ label, blue, red, fmt }) {
  const { colors: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const bFlex = Math.max(0, blue) || 0;
  const rFlex = Math.max(0, red) || 0;
  const empty = bFlex + rFlex === 0;
  return (
    <View style={styles.cmpRow}>
      <View style={styles.cmpHead}>
        <Text style={[styles.cmpVal, { color: BLUE }]}>{fmt(blue)}</Text>
        <Text style={styles.cmpLabel}>{label}</Text>
        <Text style={[styles.cmpVal, { color: RED }]}>{fmt(red)}</Text>
      </View>
      <View style={styles.cmpBar}>
        <View style={{ flex: empty ? 1 : bFlex, backgroundColor: BLUE }} />
        <View style={{ flex: empty ? 1 : rFlex, backgroundColor: RED }} />
      </View>
    </View>
  );
}

function ObjectivesBlock({ obj, color, align }) {
  const { colors: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  if (!obj) return <View style={{ flex: 1 }} />;
  return (
    <View style={[styles.objBlock, { alignItems: align }]}>
      <Text style={[styles.objBlockItem, { color }]}>🐉 {obj.dragons ?? 0}   👁 {obj.herald ?? 0}</Text>
      <Text style={[styles.objBlockItem, { color }]}>🟣 {obj.baron ?? 0}   🗼 {obj.towers ?? 0}</Text>
    </View>
  );
}

// ─── PESTAÑA BUILD — build de cada jugador ───────────────────────────────────
function BuildTab({ blueTeam, redTeam }) {
  const { colors: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
    <View>
      <Text style={styles.analysisHeading}>BUILDS · EQUIPO AZUL</Text>
      {(blueTeam || []).map((p, i) => <BuildRow key={`b${i}`} player={p} />)}
      <View style={styles.divider} />
      <Text style={styles.analysisHeading}>BUILDS · EQUIPO ROJO</Text>
      {(redTeam || []).map((p, i) => <BuildRow key={`r${i}`} player={p} />)}
    </View>
  );
}

function BuildRow({ player }) {
  const { colors: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const items = Array.from({ length: 6 }, (_, j) => {
    const v = (player.items || [])[j];
    return Number.isFinite(v) && v > 0 ? v : 0;
  });
  const spells = (player.summonerSpells || []).slice(0, 2);
  const spellUrls = spells.map((s) => getSpellImageUrl(s)).filter(Boolean);
  const runeUrl = player.primaryRune ? getRuneImageUrl(player.primaryRune) : null;
  return (
    <View style={[styles.buildRow, player.isUser && styles.playerRowHighlight]}>
      <Image source={{ uri: getChampionImageUrl(player.champion) }} style={styles.buildThumb} />
      <View style={styles.buildInfo}>
        <Text style={[styles.buildName, player.isUser && styles.playerNameUser]} numberOfLines={1}>
          {player.summonerName}
        </Text>
        <View style={styles.buildSpellsRow}>
          {spellUrls.map((uri, k) => (
            <Image key={k} source={{ uri }} style={styles.buildSpellImg} />
          ))}
          {runeUrl ? <Image source={{ uri: runeUrl }} style={styles.buildRuneImg} /> : null}
        </View>
      </View>
      <View style={styles.buildItemsRow}>
        {items.map((id, j) => (
          <View key={j} style={[styles.buildItemDot, id !== 0 && styles.itemDotFilled]}>
            {id !== 0 ? (
              <Image source={{ uri: getItemImageUrl(id) }} style={styles.buildItemImg} resizeMode="cover" />
            ) : null}
          </View>
        ))}
      </View>
    </View>
  );
}

const makeStyles = (c) => StyleSheet.create({
  panel: {
    backgroundColor: c.onSurface(0.03),
    borderRadius: 8,
    // Más padding en web para que el panel respire en desktop
    padding: Platform.OS === 'web' ? 14 : 10,
    marginTop: 4,
    marginBottom: 8,
    borderWidth: 1, borderColor: c.onSurface(0.06),
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(123,118,221,0.12)',
    marginVertical: 8,
  },

  // Scroll horizontal de la pestaña GENERAL en móvil. `generalInner` fija un
  // ancho mínimo para que las filas de jugador NO se compriman ni recorten:
  // el contenido excede el viewport y se desliza. ~430px cubre thumb+hechizos+
  // nombre+CS+daño+oro+6 ítems con sus gaps.
  generalScroll: { paddingBottom: 4 },
  generalInner: { minWidth: 430 },

  // ── Barra de pestañas ──────────────────────────────────────────────────────
  tabBar: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 10,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: c.onSurface(0.10),
    backgroundColor: c.onSurface(0.04),
    alignItems: 'center',
  },
  tabBtnActive: {
    borderColor: BLUE,
    backgroundColor: 'rgba(123,118,221,0.16)',
  },
  tabBtnText: {
    color: c.onSurface(0.45),
    fontSize: 9, fontWeight: '900', letterSpacing: 1.5,
  },
  tabBtnTextActive: { color: BLUE },

  teamHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  teamLabel: {
    color: c.onSurface(0.35),
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 2,
  },
  teamResult: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
  },

  // Tira de objetivos de equipo (dragones · herald · barón · torres) y oro total.
  objectivesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    justifyContent: 'center',
  },
  objItem: {
    color: c.onSurface(0.55),
    fontSize: 9,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  teamGold: {
    color: c.onSurface(0.45),
    fontSize: 9,
    fontWeight: '700',
    marginRight: 8,
    fontVariant: ['tabular-nums'],
  },

  // Más altura/gap en web para que los items grandes (24px) no se amontonen;
  // móvil mantiene una densidad más compacta.
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Platform.OS === 'web' ? 5 : 4,
    paddingHorizontal: 4,
    gap: Platform.OS === 'web' ? 8 : 5,
    borderRadius: 4,
    minHeight: Platform.OS === 'web' ? 34 : 28,
  },
  playerRowHighlight: {
    backgroundColor: 'rgba(123,118,221,0.12)',
  },

  champThumb: {
    width: 28, height: 28,
    borderRadius: 3,
    backgroundColor: c.surface,
  },

  // Columna compacta: 2 hechizos de invocador apilados + keystone al lado.
  spellRuneCol: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: 26,
    gap: 1,
  },
  spellImg: {
    width: 12, height: 12,
    borderRadius: 2,
    backgroundColor: c.onSurface(0.06),
  },
  runeImg: {
    width: 12, height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(123,118,221,0.18)',
  },

  playerInfo: { width: 74 },
  playerName: {
    color: c.textPrimary,
    fontSize: 10,
    fontWeight: '700',
  },
  playerNameUser: { color: BLUE },
  playerKda: {
    color: c.onSurface(0.45),
    fontSize: 9,
    marginTop: 1,
  },

  playerCs: {
    color: c.onSurface(0.40),
    fontSize: 9,
    width: 32,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  // Columna de daño: número + mini-barra normalizada.
  dmgCol: { width: 44, alignItems: 'flex-end', gap: 2 },
  playerDmg: {
    color: c.onSurface(0.45),
    fontSize: 9,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  dmgBarTrack: {
    width: '100%', height: 3, borderRadius: 2,
    backgroundColor: c.onSurface(0.08), overflow: 'hidden',
  },
  dmgBarFill: { height: 3, borderRadius: 2 },
  playerGold: {
    color: c.onSurface(0.40),
    fontSize: 9,
    width: 36,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },

  // Items legibles en web (24px) y compactos en móvil (18px).
  itemsRow: { flexDirection: 'row', gap: 3, flexWrap: 'wrap' },
  itemDot: {
    width: ITEM_SIZE, height: ITEM_SIZE,
    borderRadius: 3,
    backgroundColor: c.onSurface(0.06),
    borderWidth: 1, borderColor: c.onSurface(0.10),
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  itemDotFilled: {
    backgroundColor: c.onSurface(0.10),
    borderColor: c.onSurface(0.25),
  },
  itemImg: {
    width: ITEM_SIZE, height: ITEM_SIZE, borderRadius: 3,
  },

  // ── Pestaña ANÁLISIS ───────────────────────────────────────────────────────
  analysis: { gap: 4 },
  analysisResultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  analysisTeam: { flex: 1, fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  analysisHeading: {
    color: c.onSurface(0.45),
    fontSize: 9, fontWeight: '900', letterSpacing: 1.5,
    marginBottom: 6,
  },
  cmpRow: { marginBottom: 10 },
  cmpHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  cmpVal: { fontSize: 11, fontWeight: '900', fontVariant: ['tabular-nums'], width: 56 },
  cmpLabel: {
    flex: 1, textAlign: 'center',
    color: c.onSurface(0.45), fontSize: 9, fontWeight: '800', letterSpacing: 1.5,
  },
  cmpBar: {
    flexDirection: 'row',
    height: 6, borderRadius: 3, overflow: 'hidden',
    backgroundColor: c.onSurface(0.06),
  },
  objCompareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4, marginBottom: 4,
    gap: 8,
  },
  objCompareLabel: {
    color: c.onSurface(0.40), fontSize: 9, fontWeight: '900', letterSpacing: 1.5,
  },
  objBlock: { flex: 1, gap: 3 },
  objBlockItem: { fontSize: 10, fontWeight: '700', fontVariant: ['tabular-nums'] },
  timelineRow: { gap: 6, paddingVertical: 2, paddingRight: 6 },
  timelineChip: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    borderWidth: 1, borderRadius: 12,
    paddingHorizontal: 8, paddingVertical: 4,
    backgroundColor: c.onSurface(0.04),
  },
  timelineGlyph: { fontSize: 11 },
  timelineMin: { fontSize: 9, fontWeight: '900', fontVariant: ['tabular-nums'] },

  // ── Pestaña BUILD ──────────────────────────────────────────────────────────
  buildRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderRadius: 6,
    marginBottom: 4,
  },
  buildThumb: {
    width: 34, height: 34, borderRadius: 4,
    backgroundColor: c.surface,
  },
  buildInfo: { width: 96 },
  buildName: { color: c.textPrimary, fontSize: 11, fontWeight: '800' },
  buildSpellsRow: { flexDirection: 'row', gap: 3, marginTop: 4 },
  buildSpellImg: {
    width: 15, height: 15, borderRadius: 3,
    backgroundColor: c.onSurface(0.06),
  },
  buildRuneImg: {
    width: 15, height: 15, borderRadius: 8,
    backgroundColor: 'rgba(123,118,221,0.18)',
  },
  buildItemsRow: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 4, justifyContent: 'flex-end' },
  buildItemDot: {
    width: BUILD_ITEM_SIZE, height: BUILD_ITEM_SIZE,
    borderRadius: 4,
    backgroundColor: c.onSurface(0.06),
    borderWidth: 1, borderColor: c.onSurface(0.10),
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  buildItemImg: { width: BUILD_ITEM_SIZE, height: BUILD_ITEM_SIZE, borderRadius: 4 },
});
