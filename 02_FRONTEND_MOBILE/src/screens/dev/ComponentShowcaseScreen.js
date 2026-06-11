// ============================================================================
// ComponentShowcaseScreen — catálogo vivo del sistema de diseño NOVA RIFT.
// ----------------------------------------------------------------------------
// Pantalla SOLO de desarrollo (la ruta se registra bajo __DEV__ en App.js).
// Reúne cada componente visual del design system en todos sus estados para:
// 1. Servir de documentación viva.
// 2. Generar material de captura uniforme para la documentación.
//
// No recibe props: cada sección instancia los componentes con datos de ejemplo
// y los componentes que dependen de datos (KPICoachingWidget) son mock-friendly.
// ============================================================================
import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';

import ScreenWrapper from '../../components/layout/ScreenWrapper';
import CircularProgressRing from '../../components/CircularProgressRing';
import HexagonalRadar from '../../components/HexagonalRadar';
import KPICoachingWidget from '../../components/KPICoachingWidget';
import Button from '../../components/ui/Button';
import { SkeletonCard } from '../../components/feedback/LoadingSkeleton';
import ErrorState from '../../components/feedback/ErrorState';
import EmptyState from '../../components/feedback/EmptyState';
import ConnectionStatusBar from '../../components/feedback/ConnectionStatusBar';

import { TYPE_SCALE, FONT_FAMILY } from '../../theme/typography';
import { COLORS, ROLE_COLORS, TIER_COLORS } from '../../theme/colors';

const SCREEN_BG = '#07070d';

// ── Helpers de layout ────────────────────────────────────────────────────────

/** Encabezado de sección con el estilo "SECTION LABEL" del design system. */
function SectionLabel({ children }) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

/** Sub-etiqueta más tenue para agrupar dentro de una sección. */
function SubLabel({ children }) {
  return <Text style={styles.subLabel}>{children}</Text>;
}

/** Separador de 1px entre secciones. */
function Divider() {
  return <View style={styles.divider} />;
}

/** Ficha de color: bloque + nombre + hex. */
function Swatch({ name, hex }) {
  return (
    <View style={styles.swatch}>
      <View style={[styles.swatchBlock, { backgroundColor: hex }]} />
      <Text style={styles.swatchName} numberOfLines={1}>{name}</Text>
      <Text style={styles.swatchHex} numberOfLines={1}>{hex}</Text>
    </View>
  );
}

// ── Datos de ejemplo (estáticos) ─────────────────────────────────────────────

const CORE_SWATCHES = [
  { name: 'PRIMARY', hex: '#7B76DD' },
  { name: 'DANGER',  hex: '#E53935' },
  { name: 'WARNING', hex: '#FDD835' },
  { name: 'SUCCESS', hex: '#43A047' },
  { name: 'bg0', hex: COLORS.bg0 },
  { name: 'bg1', hex: COLORS.bg1 },
  { name: 'bg2', hex: COLORS.bg2 },
  { name: 'bg3', hex: COLORS.bg3 },
];

const ROLE_SWATCHES = Object.entries(ROLE_COLORS).map(([name, hex]) => ({ name, hex }));
const TIER_SWATCHES = Object.entries(TIER_COLORS).map(([name, hex]) => ({ name, hex }));

const RING_STEPS = [0, 0.25, 0.5, 0.75, 1];

// B3 — estados semánticos del anillo: el color comunica el estado de la métrica.
const RING_SEMANTIC = [
  { name: 'crítico', progress: 0.22, color: '#E53935' },
  { name: 'aviso',   progress: 0.55, color: '#FDD835' },
  { name: 'óptimo',  progress: 0.86, color: '#43A047' },
];

// threatScore → color natural (verde/amarillo/naranja/rojo); reticle = color de rol.
const RADAR_INSTANCES = [
  { role: 'TOP',    threatScore: 20, color: ROLE_COLORS.TOP },
  { role: 'JUNGLE', threatScore: 45, color: ROLE_COLORS.JUNGLE },
  { role: 'MID',    threatScore: 70, color: ROLE_COLORS.MID },
  { role: 'BOT',    threatScore: 90, color: ROLE_COLORS.BOT },
];

const SAMPLE_ENEMY_DOTS = [
  { angle: 30,  distance: 56, color: '#E53935', label: 'top' },
  { angle: 160, distance: 40, color: '#FB8C00', label: 'mid' },
  { angle: 270, distance: 62, color: '#FDD835', label: 'jgl' },
];

const KPI_INSTANCES = [
  { user: { mainRole: 'ADC',     tier: 'GOLD' },     appWeek: 1 },
  { user: { mainRole: 'SUPPORT', tier: 'PLATINUM' }, appWeek: 2 },
  { user: { mainRole: 'MID',     tier: 'DIAMOND' },  appWeek: 3 },
];

const BUTTON_VARIANTS = ['primary', 'secondary', 'ghost', 'destructive'];

// ── Pantalla ─────────────────────────────────────────────────────────────────

export default function ComponentShowcaseScreen() {
  return (
    <ScreenWrapper scrollable style={styles.content}>
      <Text style={styles.screenTitle}>COMPONENT SHOWCASE</Text>
      <Text style={styles.screenSub}>Catálogo vivo · NOVA RIFT design system</Text>

      {/* ── 1. Typography ──────────────────────────────────────────────────── */}
      <SectionLabel>01 · TYPOGRAPHY SCALE</SectionLabel>
      {Object.entries(TYPE_SCALE).map(([name, t]) => (
        <View key={name} style={styles.typeRow}>
          <Text
            style={{
              fontSize: t.size,
              lineHeight: t.lineHeight,
              letterSpacing: t.letterSpacing,
              fontFamily: t.fontFamily,
              color: COLORS.textPrimary,
            }}
          >
            {name} · Rajdhani
          </Text>
          <Text style={styles.typeMeta}>
            {name} · {t.size}px · {fontAlias(t.fontFamily)}
          </Text>
        </View>
      ))}

      <Divider />

      {/* ── 2. Color palette ───────────────────────────────────────────────── */}
      <SectionLabel>02 · COLOR PALETTE</SectionLabel>
      <SubLabel>Core + elevación</SubLabel>
      <View style={styles.grid}>
        {CORE_SWATCHES.map((s) => <Swatch key={s.name} {...s} />)}
      </View>
      <SubLabel>Roles (ROLE_COLORS)</SubLabel>
      <View style={styles.grid}>
        {ROLE_SWATCHES.map((s) => <Swatch key={s.name} {...s} />)}
      </View>
      <SubLabel>Tiers (TIER_COLORS)</SubLabel>
      <View style={styles.grid}>
        {TIER_SWATCHES.map((s) => <Swatch key={s.name} {...s} />)}
      </View>

      <Divider />

      {/* ── 3. CircularProgressRing ────────────────────────────────────────── */}
      <SectionLabel>03 · CIRCULAR PROGRESS RING</SectionLabel>
      <SubLabel>Progresión (vacío → completo)</SubLabel>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.ringRow}
      >
        {RING_STEPS.map((p) => (
          <View key={p} style={styles.ringCell}>
            <CircularProgressRing
              progress={p}
              size={92}
              strokeWidth={8}
              color={COLORS.primary}
            >
              <Text style={styles.ringValue}>{Math.round(p * 100)}</Text>
            </CircularProgressRing>
            <Text style={styles.ringLabel}>{Math.round(p * 100)}%</Text>
          </View>
        ))}
      </ScrollView>
      {/* B3 — estados semánticos: el color comunica el estado de la métrica
          (crítico/aviso/óptimo). El estado loading/error lo gestiona el
          contenedor (ver JSDoc del componente). */}
      <SubLabel>Estados semánticos (crítico · aviso · óptimo)</SubLabel>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.ringRow}
      >
        {RING_SEMANTIC.map((s) => (
          <View key={s.name} style={styles.ringCell}>
            <CircularProgressRing
              progress={s.progress}
              size={92}
              strokeWidth={8}
              color={s.color}
            >
              <Text style={[styles.ringValue, { color: s.color }]}>
                {Math.round(s.progress * 100)}
              </Text>
            </CircularProgressRing>
            <Text style={styles.ringLabel}>{s.name}</Text>
          </View>
        ))}
      </ScrollView>

      <Divider />

      {/* ── 4. HexagonalRadar ──────────────────────────────────────────────── */}
      <SectionLabel>04 · HEXAGONAL RADAR · POR ROL</SectionLabel>
      <View style={styles.radarGrid}>
        {RADAR_INSTANCES.map((r) => (
          <View key={r.role} style={styles.radarCell}>
            <HexagonalRadar
              threatScore={r.threatScore}
              color={r.color}
              size={148}
              label={r.role}
              enemyDots={SAMPLE_ENEMY_DOTS}
            />
          </View>
        ))}
      </View>
      {/* B3 — estado vacío válido: sin enemigos detectados (enemyDots=[]),
          el radar pinta solo retícula + jugador. No es un error. */}
      <SubLabel>Estado vacío (sin enemigos detectados)</SubLabel>
      <View style={styles.radarGrid}>
        <View style={styles.radarCell}>
          <HexagonalRadar
            threatScore={0}
            color={COLORS.primary}
            size={148}
            label="SIN ENEMIGOS"
            enemyDots={[]}
          />
        </View>
      </View>

      <Divider />

      {/* ── 5. KPICoachingWidget ───────────────────────────────────────────── */}
      <SectionLabel>05 · KPI COACHING WIDGET</SectionLabel>
      <SubLabel>Normal (semanas 1-3, por rol)</SubLabel>
      {KPI_INSTANCES.map((k) => (
        <KPICoachingWidget
          key={`${k.user.mainRole}-${k.appWeek}`}
          user={k.user}
          appWeek={k.appWeek}
        />
      ))}
      {/* B3 — estados loading y error del widget (props loading/error/onRetry,
          documentadas en su JSDoc): la "documentación viva" de DIN1-UD3. */}
      <SubLabel>Loading (skeleton)</SubLabel>
      <KPICoachingWidget user={KPI_INSTANCES[0].user} appWeek={1} loading />
      <SubLabel>Error (con reintento)</SubLabel>
      <KPICoachingWidget
        user={KPI_INSTANCES[0].user}
        appWeek={1}
        error="No se pudo calcular tu KPI semanal."
        onRetry={() => {}}
      />

      <Divider />

      {/* ── 6. Button variants ─────────────────────────────────────────────── */}
      <SectionLabel>06 · BUTTON VARIANTS</SectionLabel>
      <View style={styles.buttonCol}>
        {BUTTON_VARIANTS.map((v) => (
          <Button
            key={v}
            label={v}
            variant={v}
            onPress={() => {}}
            style={styles.buttonItem}
          />
        ))}
      </View>

      <Divider />

      {/* ── 7. Feedback states ─────────────────────────────────────────────── */}
      <SectionLabel>07 · FEEDBACK STATES</SectionLabel>
      <SubLabel>SkeletonCard (loading)</SubLabel>
      <SkeletonCard />
      <SkeletonCard style={styles.gap} />
      <SkeletonCard style={styles.gap} />

      <SubLabel>ErrorState</SubLabel>
      <ErrorState
        message="No se pudieron cargar tus estadísticas. Revisa tu conexión."
        onRetry={() => {}}
      />

      <SubLabel>EmptyState</SubLabel>
      <EmptyState
        title="Sin partidas todavía"
        subtitle="Juega tu primera partida clasificatoria para ver tus métricas aquí."
      />

      <Divider />

      {/* ── 8. ConnectionStatusBar ─────────────────────────────────────────── */}
      <SectionLabel>08 · CONNECTION STATUS BAR</SectionLabel>
      <SubLabel>online (oculto · no renderiza nada)</SubLabel>
      <ConnectionStatusBar status="online" />
      <View style={styles.barHiddenNote}>
        <Text style={styles.barHiddenText}>— sin barra —</Text>
      </View>

      <SubLabel>offline</SubLabel>
      <ConnectionStatusBar status="offline" />

      <SubLabel>syncing</SubLabel>
      <View style={styles.gap}>
        <ConnectionStatusBar status="syncing" />
      </View>
    </ScreenWrapper>
  );
}

/** Devuelve el alias legible (regular/medium/...) de una fontFamily Rajdhani. */
function fontAlias(family) {
  const entry = Object.entries(FONT_FAMILY).find(([, v]) => v === family);
  return entry ? entry[0] : family;
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 64,
    backgroundColor: SCREEN_BG,
  },
  screenTitle: {
    color: COLORS.textPrimary,
    fontSize: 22,
    fontFamily: FONT_FAMILY.bold,
    letterSpacing: 2,
  },
  screenSub: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontFamily: FONT_FAMILY.regular,
    letterSpacing: 0.5,
    marginTop: 2,
    marginBottom: 8,
  },

  sectionLabel: {
    fontSize: 10,
    letterSpacing: 2,
    color: '#7B76DD99',
    fontWeight: '900',
    marginTop: 20,
    marginBottom: 12,
  },
  subLabel: {
    fontSize: 9,
    letterSpacing: 1.5,
    color: COLORS.textMuted,
    fontFamily: FONT_FAMILY.semiBold,
    marginTop: 14,
    marginBottom: 8,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginTop: 24,
  },

  // Typography
  typeRow: {
    marginBottom: 10,
  },
  typeMeta: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontFamily: FONT_FAMILY.regular,
    letterSpacing: 0.5,
    marginTop: 1,
  },

  // Color grid (3 columnas)
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
  },
  swatch: {
    width: '31.5%',
    marginRight: '2.75%',
    marginBottom: 12,
  },
  swatchBlock: {
    width: '100%',
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  swatchName: {
    color: COLORS.textPrimary,
    fontSize: 11,
    fontFamily: FONT_FAMILY.semiBold,
    letterSpacing: 0.5,
    marginTop: 4,
  },
  swatchHex: {
    color: COLORS.textMuted,
    fontSize: 9,
    fontFamily: FONT_FAMILY.regular,
  },

  // CircularProgressRing
  ringRow: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  ringCell: {
    alignItems: 'center',
    marginRight: 18,
  },
  ringValue: {
    color: COLORS.textPrimary,
    fontSize: 20,
    fontFamily: FONT_FAMILY.bold,
  },
  ringLabel: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontFamily: FONT_FAMILY.semiBold,
    letterSpacing: 1,
    marginTop: 8,
  },

  // HexagonalRadar
  radarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  radarCell: {
    width: '48%',
    alignItems: 'center',
    marginBottom: 16,
  },

  // Button
  buttonCol: {
    alignItems: 'stretch',
  },
  buttonItem: {
    marginBottom: 10,
  },

  // Feedback
  gap: {
    marginTop: 12,
  },
  barHiddenNote: {
    height: 28,
    borderRadius: 6,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  barHiddenText: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontFamily: FONT_FAMILY.regular,
    letterSpacing: 1,
  },
});
