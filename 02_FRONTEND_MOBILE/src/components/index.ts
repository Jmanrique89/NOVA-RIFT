// ============================================================================
// components/index.ts — barrel export de los componentes de NOVA RIFT
// ----------------------------------------------------------------------------
// Punto único de importación para los componentes reutilizables de la app.
// Permite `import { InGameHUD, CircularProgressRing } from '../components';`
// en vez de rutas relativas por archivo.
//
// Cada entrada re-exporta el `export default` del módulo con un nombre claro.
// No se reorganiza ni renombra ningún archivo: este índice solo agrega exports.
// ============================================================================

// ── Visual / UI documentado (anillos, radares, HUD) ─────────────────────────
export { default as CircularProgressRing } from './CircularProgressRing';
export { default as HexagonalRadar } from './HexagonalRadar';
export { default as KPICoachingWidget } from './KPICoachingWidget';
export { default as FloatingRadarWidget } from './FloatingRadarWidget';
export { default as InGameHUD } from './InGameHUD';
export { default as ChampionDetailModal } from './ChampionDetailModal';

// ── Fondos y efectos ────────────────────────────────────────────────────────
export { default as AuroraBackground } from './AuroraBackground';
export { default as AnimatedTacticalBackground } from './AnimatedTacticalBackground';
export { default as NovaBackground } from './NovaBackground';
export { default as SelectionBurst } from './SelectionBurst';

// ── HUD / coaching ──────────────────────────────────────────────────────────
export { default as TacticalIntelligenceHUD } from './TacticalIntelligenceHUD';
export { default as LiveCoachToast } from './LiveCoachToast';
export { default as FactionRadarChart } from './FactionRadarChart';

// ── Historial de partidas ───────────────────────────────────────────────────
export { default as MatchSessionHeader } from './MatchSessionHeader';
export { default as MatchExpandedPanel } from './MatchExpandedPanel';

// ── Campeones / champ select ─────────────────────────────────────────────────
export { default as ChampionImage } from './ChampionImage';
export { default as ChampSelectHelper } from './ChampSelectHelper';
export { default as PlayerSearchModal } from './PlayerSearchModal';

// ── Rango y progresión ───────────────────────────────────────────────────────
export { default as GradeProgressBar } from './GradeProgressBar';
export { default as PromotionTrack } from './PromotionTrack';
export { default as TierPicker } from './TierPicker';
export { default as TrophyCabinet } from './TrophyCabinet';
export { default as BadgeUnlockModal } from './BadgeUnlockModal';

// ── Roles ──
export { default as RoleIcon } from './RoleIcon';
export { default as RoleSelectionMap } from './RoleSelectionMap';

// ── Primitivos de UI ──
export { default as Icon } from './Icon';
export { default as NovaButton } from './NovaButton';
export { default as HoverCard } from './HoverCard';
export { default as Skeleton } from './Skeleton';
export { default as DevEscapeHatch } from './DevEscapeHatch';

// ── Subdirectorios (ui / layout / feedback / ai) ────────────────────────────
export { default as Button } from './ui/Button';
export { default as ScreenWrapper } from './layout/ScreenWrapper';
export { default as LoadingSkeleton } from './feedback/LoadingSkeleton';
export { default as ErrorState } from './feedback/ErrorState';
export { default as EmptyState } from './feedback/EmptyState';
export { default as ConnectionStatusBar } from './feedback/ConnectionStatusBar';
export { default as ErrorToast } from './feedback/ErrorToast';
export { default as AIInsightTooltip } from './ai/AIInsightTooltip';
