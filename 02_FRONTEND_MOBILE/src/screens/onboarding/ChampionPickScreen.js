// ============================================================================
// ChampionPickScreen — Paso 4/4 — Champion Pool 2+2 (punto #5
// ----------------------------------------------------------------------------
// 1 MAIN + 3 huecos de pool = 4 huecos POR ROL. Modelo "2+2":
//
// ┌──────────────────────┐
// │ MAIN (120×140) │ ← rol-slot 0 · ACTIVO
// └──────────────────────┘
// ┌─────┐ ┌─────┐ ┌─────┐
// │ 1 │ │ 2 │ │ 3 │ ← rol-slot 1 ACTIVO · rol-slot 2 y 3 BLOQUEABLES
// └─────┘ └─────┘ └─────┘
//
// 2 huecos ACTIVOS (MAIN + pool[0]).
// 2 huecos BLOQUEABLES (pool[1] y pool[2]) que se DESBLOQUEAN JUGANDO
// partidas con Nova Rift (recompensa de progresión). Umbrales en
// utils/championPool.SLOT_UNLOCK_GAMES (3º a las 10 partidas, 4º a las 25).
//
// Lógica de selección:
// El primer pick siempre va a MAIN.
// A partir del segundo, los picks llenan los slots POOL en orden.
// El usuario PUEDE elegir los 4 huecos ya en el onboarding (forma su pool
// 2+2 completo). Los 2 últimos se marcan con candado y se persisten con
// `locked:true`; el desbloqueo real ocurre después, jugando.
// Tap en un slot lleno → modo "swap". Si MAIN queda vacío → auto-promoción.
//
// Pool recomendado por rol (LoL-Research §16):
// TOP: Garen, Malphite | Darius, Shen
// JUNGLE: Warwick, Amumu | Lee Sin, Graves
// MID: Ahri, Malzahar | Katarina, Yasuo
// ADC: Jinx, Ashe | Caitlyn, Miss Fortune
// SUPPORT: Janna, Lulu | Thresh, Leona
//
// Persistencia (sellada con utils/championPool.sealOnboardingPool):
// Cada entrada lleva `slot` (orden 0..3 dentro del rol) + `locked` (bool).
// `slotKind:'main'|'secondary'` se conserva por compat con HubScreen.
// recommendPick.recommendFromPool YA consume `locked` → produce unlockHint.
// ============================================================================
import React, { useContext, useMemo, useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, Image, ActivityIndicator, Dimensions,
  Modal, Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { OnboardingContext } from './OnboardingContext';
import { useUser } from '../../context/UserContext';
import { useTheme } from '../../context/ThemeContext';
import NovaButton from '../../components/NovaButton';
import NovaBackground from '../../components/NovaBackground';
import DevEscapeHatch from '../../components/DevEscapeHatch';
// B4.6 — puntos de progreso unificados de los 4 pasos del onboarding.
import ProgressDots from '../../components/ProgressDots';
import ChampionImage from '../../components/ChampionImage';
// Normalización de ids Data Dragon (apóstrofos, espacios y excepciones tipo
// Cho'Gath→Chogath o Wukong→MonkeyKing) — evita 404 → foto en negro.
import { normalizeChampionName } from '../../utils/championImage';
import Icon from '../../components/Icon';
import { CHAMPIONS } from '../../data/championsCatalog';
import { TYPE_SCALE } from '../../theme/typography';
import { COLORS } from '../../theme/tokens';
// pool 2+2 (punto #5 — modelo de datos y umbrales de
// desbloqueo por progresión. Se usa al SELLAR el pool en submit (slot+locked).
import {
  sealOnboardingPool,
  SLOT_UNLOCK_GAMES,
  ACTIVE_SLOTS,
} from '../../utils/championPool';

const PATCH = '16.8.1';
const { width: SW } = Dimensions.get('window');

// Pool recomendado por rol (LoL-Research §16)
const CHAMPION_POOL_BY_ROLE = {
  TOP:     { main: ['Garen',   'Malphite'], secondary: ['Darius',   'Shen']         },
  JUNGLE:  { main: ['Warwick', 'Amumu'],    secondary: ['LeeSin',   'Graves']       },
  MID:     { main: ['Ahri',    'Malzahar'], secondary: ['Katarina', 'Yasuo']        },
  ADC:     { main: ['Jinx',    'Ashe'],     secondary: ['Caitlyn',  'MissFortune']  },
  SUPPORT: { main: ['Janna',   'Lulu'],     secondary: ['Thresh',   'Leona']        },
};

const DISPLAY_NAME = {
  Garen: 'Garen', Malphite: 'Malphite', Darius: 'Darius', Shen: 'Shen',
  Warwick: 'Warwick', Amumu: 'Amumu', LeeSin: 'Lee Sin', Graves: 'Graves',
  Ahri: 'Ahri', Malzahar: 'Malzahar', Katarina: 'Katarina', Yasuo: 'Yasuo',
  Jinx: 'Jinx', Ashe: 'Ashe', Caitlyn: 'Caitlyn', MissFortune: 'Miss Fortune',
  Janna: 'Janna', Lulu: 'Lulu', Thresh: 'Thresh', Leona: 'Leona',
};

// (El antiguo helper local `splashUrl` se retiró: el modal cinemático usa
// ahora <ChampionImage/>, que normaliza el id y cae en cascada
// splash → loading → placeholder cuando el CDN falla.)

// Display names del catálogo completo (KogMaw → "Kog'Maw", etc.) — el mapa
// DISPLAY_NAME de arriba solo cubre los 20 curados.
const CATALOG_DISPLAY = Object.fromEntries(
  CHAMPIONS.map(c => [c.id, c.displayName])
);

// ── Constantes del layout del champion pool (modelo 2+2 · punto #5) ──────────
// El usuario tiene 4 huecos POR ROL: MAIN + 3 slots de pool.
// MAIN + pool[0] → 2 huecos ACTIVOS (rol-slot 0 y 1).
// pool[1] + pool[2] → 2 huecos BLOQUEADOS (rol-slot 2 y 3) que se
// desbloquean JUGANDO partidas con Nova Rift (recompensa de progresión).
// Antes el 3er/4º slot se gateaban por NIVEL de cuenta; ahora se desbloquean por
// PARTIDAS JUGADAS (ver SLOT_UNLOCK_GAMES en utils/championPool.js), que es la
// recompensa de uso que pedía el análisis. Durante el ONBOARDING el usuario SÍ
// elige los 4 (puede formar su pool 2+2 completo); los 2 últimos quedan marcados
// como bloqueados y se persisten con `locked:true`.
const POOL_TOTAL_SLOTS = 3;              // Slots CHAMPION POOL visibles (sin contar MAIN). MAIN + 3 = 4 huecos/rol.

// Índice GLOBAL de rol-slot de cada hueco del pool (el MAIN es el rol-slot 0):
// pool[0] → rol-slot 1, pool[1] → rol-slot 2, pool[2] → rol-slot 3.
// Un hueco del pool es ACTIVO si su rol-slot < ACTIVE_SLOTS; si no, BLOQUEADO.
const poolSlotRoleIndex = (poolIdx) => poolIdx + 1; // +1 porque el MAIN ocupa el rol-slot 0
const isPoolSlotInitiallyLocked = (poolIdx) => poolSlotRoleIndex(poolIdx) >= ACTIVE_SLOTS;
// Partidas necesarias para desbloquear el hueco de pool `poolIdx` (0 si activo).
const poolSlotUnlockGames = (poolIdx) => SLOT_UNLOCK_GAMES[poolSlotRoleIndex(poolIdx)] || 0;

// Paleta (#7B76DD = púrpura neutral pre-facción)
const COLOR_PURPLE      = COLORS.accent_cyan;
const COLOR_PURPLE_RGBA = 'rgba(123,118,221,';

export default function ChampionPickScreen({ navigation }) {
  const {
    faction, mainRole, secondaryRole, playstyle,
    setChampions,
    submitOnboarding,
  } = useContext(OnboardingContext);
  const { user, setUser } = useUser();
  const { colors: c, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  // En el ONBOARDING el usuario puede ELEGIR los 4 huecos de su pool 2+2 (formar
  // el pool completo de una vez). Los 2 últimos quedarán marcados como bloqueados
  // y se persistirán con `locked:true`; el desbloqueo real ocurre después,
  // jugando partidas (ver ForgeScreen + utils/championPool.applyUnlocks).
  // `slotInitiallyLocked` indica si ese hueco NACERÁ bloqueado (solo es señal
  // visual aquí; no impide elegirlo durante el onboarding).
  const slotInitiallyLocked = (idx) => isPoolSlotInitiallyLocked(idx);

  // Estado de picks:
  // main: campeón principal (string|null)
  // pool: array de POOL_TOTAL_SLOTS (3) posiciones; con el MAIN suman los 4
  // huecos del pool 2+2 por rol (rol-slot 0..3).
  const [main, setMain] = useState(null);
  const [pool, setPool] = useState(Array(POOL_TOTAL_SLOTS).fill(null));

  // Selección activa para reordenar — { zone: 'main'|'pool', index?: number }
  const [activeSlot, setActiveSlot] = useState(null);

  // Modal cinematic
  const [detailChamp, setDetailChamp] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  // ── Recomendados según rol main ────────────────────────────────────────
  const poolByRole = CHAMPION_POOL_BY_ROLE[mainRole] || CHAMPION_POOL_BY_ROLE.ADC;
  // punto 7 : mostrar TODOS los campeones del rol del
  // usuario, no solo los 4 curados. Primero los curados (LoL-Research §16),
  // después el resto del catálogo de ese rol (incl. secondaryRoles).
  const roleForList = CHAMPION_POOL_BY_ROLE[mainRole] ? mainRole : 'ADC';
  const curated = [...poolByRole.main, ...poolByRole.secondary];
  const recommended = [
    ...curated,
    ...CHAMPIONS
      .filter(c =>
        (c.role === roleForList || (c.secondaryRoles || []).includes(roleForList)) &&
        !curated.includes(c.id))
      .map(c => c.id),
  ];

  const visibleList = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return recommended;
    return CHAMPIONS
      .filter(c =>
        c.id.toLowerCase().includes(q) ||
        c.displayName.toLowerCase().includes(q)
      )
      .slice(0, 12)
      .map(c => c.id);
  }, [searchQuery, recommended]);

  // ── Helpers ────────────────────────────────────────────────────────────
  const allPicked = useCallback(
    () => [main, ...pool].filter(Boolean),
    [main, pool],
  );

  const isAlreadyPicked = (name) => allPicked().includes(name);

  // Durante el onboarding TODOS los huecos del pool son rellenables: el usuario
  // forma su pool 2+2 completo de una vez. Que un hueco nazca bloqueado es solo
  // una marca visual + de persistencia (se desbloquea jugando, no aquí).
  const isPoolSlotUsable = () => true;

  // Primer pick → MAIN. Resto → primer slot POOL libre (saltando el bloqueado).
  const addChampion = (name) => {
    if (isAlreadyPicked(name)) return;
    if (!main) { setMain(name); return; }
    setPool(prev => {
      const next = [...prev];
      for (let i = 0; i < POOL_TOTAL_SLOTS; i++) {
        if (!isPoolSlotUsable(i)) continue;
        if (!next[i]) { next[i] = name; return next; }
      }
      return prev; // pool lleno
    });
  };

  // Auto-promoción: si MAIN queda vacío, sube el primer pool no-vacío a MAIN.
  const promoteIfMainEmpty = (mainVal, poolArr) => {
    if (mainVal) return { main: mainVal, pool: poolArr };
    const firstIdx = poolArr.findIndex(Boolean);
    if (firstIdx === -1) return { main: mainVal, pool: poolArr };
    const newPool = [...poolArr];
    const promoted = newPool[firstIdx];
    newPool[firstIdx] = null;
    return { main: promoted, pool: newPool };
  };

  const removeFromMain = () => {
    const { main: m, pool: p } = promoteIfMainEmpty(null, pool);
    setMain(m); setPool(p);
    setActiveSlot(null);
  };

  const removeFromPool = (idx) => {
    const next = [...pool]; next[idx] = null;
    setPool(next);
    setActiveSlot(null);
  };

  // ── Swap entre slots ───────────────────────────────────────────────────
  // (En el modelo 2+2 todos los huecos del pool son seleccionables durante el
  // onboarding; el bloqueo es solo de persistencia, así que no hay guard aquí.)
  const handleSlotTap = (zone, idx) => {
    const isEmpty = zone === 'main' ? !main : !pool[idx];

    // Sin selección activa
    if (!activeSlot) {
      if (isEmpty) return; // nada que seleccionar en slot vacío
      setActiveSlot({ zone, index: idx });
      return;
    }

    // Volver a tocar el slot ya activo → deseleccionar
    if (activeSlot.zone === zone && activeSlot.index === idx) {
      setActiveSlot(null);
      return;
    }

    // Hacer swap entre activeSlot y (zone, idx)
    const srcZone = activeSlot.zone;
    const srcIdx  = activeSlot.index;
    const srcVal  = srcZone === 'main' ? main : pool[srcIdx];
    const dstVal  = zone === 'main' ? main : pool[idx];

    let newMain = main;
    let newPool = [...pool];

    // Asignar dst → src
    if (srcZone === 'main') newMain = dstVal;
    else newPool[srcIdx] = dstVal;
    // Asignar src → dst
    if (zone === 'main') newMain = srcVal;
    else newPool[idx] = srcVal;

    // Si tras el swap MAIN queda vacío, auto-promueve
    const promoted = promoteIfMainEmpty(newMain, newPool);
    setMain(promoted.main);
    setPool(promoted.pool);
    setActiveSlot(null);
  };

  // ── Submit ─────────────────────────────────────────────────────────────
  const [localBusy, setLocalBusy] = useState(false);
  const totalPicks = allPicked().length;
  const isOtpCandidate = !!main && pool.every(p => !p);
  const [otpModalVisible, setOtpModalVisible] = useState(false);

  // buildFlat — MAIN priority 1, pool slots no-vacíos priority 2..N.
  // slot 'main'|'secondary' preservado para compat con HubScreen (queda como
  // `slotKind` tras sellar). Tras construir el array plano, lo SELLAMOS con el
  // modelo 2+2 (utils/championPool.sealOnboardingPool): cada entrada recibe un
  // `slot` numérico (orden 0..3 dentro del rol) y `locked` (los 2 primeros
  // activos, el 3º y 4º bloqueados). Como todo este pool es del MISMO rol
  // (mainRole), el orden global coincide con el orden por rol.
  const buildFlat = () => {
    const flat = [];
    if (main) {
      flat.push({
        championId:  main,
        priority:    1,
        displayName: DISPLAY_NAME[main] || main,
        slot:        'main',
      });
    }
    pool.forEach((n) => {
      if (!n) return;
      flat.push({
        championId:  n,
        priority:    flat.length + 1,
        displayName: DISPLAY_NAME[n] || n,
        slot:        'secondary',
      });
    });
    // Sella slot(orden 0-based por rol) + locked sobre el array plano.
    return sealOnboardingPool(flat);
  };

  const forceLocalSetup = async (flat, { isOTP = false } = {}) => {
    try { await AsyncStorage.setItem('novarift_show_welcome', 'true'); } catch (_) {}
    await setUser({
      ...(user || {}),
      faction:        faction        || (user && user.faction)        || null,
      mainRole:       mainRole       || (user && user.mainRole)       || null,
      secondaryRole:  secondaryRole  || (user && user.secondaryRole)  || null,
      playstyle:      playstyle      || (user && user.playstyle)      || null,
      champions:      flat,
      level:          1,
      isOTP,
      setup_complete: true,
      localOnly:      true,
    }).catch(() => {});
  };

  const submitPool = async ({ isOTP = false } = {}) => {
    setLocalBusy(true);
    const flat = buildFlat();
    setChampions(flat);

    const timeoutPromise = new Promise((resolve) =>
      setTimeout(() => resolve('timeout'), 3000));
    let result;
    try {
      // P2 — el setChampions(flat) de arriba aún no se ha aplicado cuando
      // submitOnboarding lee su closure: sin overrides el POST /user/setup
      // salía con el pool ANTERIOR (vacío en cuenta nueva). Pasamos los
      // valores de ESTE onboarding explícitamente.
      result = await Promise.race([
        submitOnboarding({
          champions: flat, faction, mainRole, secondaryRole, playstyle,
        }).catch(() => false),
        timeoutPromise,
      ]);
    } catch (e) {
      result = false;
    }

    if (result === 'timeout' || result === false) {
      console.warn('[ChampionPick] submitOnboarding tardó >3s o falló — fallback local');
      await forceLocalSetup(flat, { isOTP });
    } else {
      // E1 — AISLAMIENTO POR CUENTA (pool compartida entre cuentas).
      // submitOnboarding YA hizo setUser, pero su payload de champions proviene
      // de un closure de OnboardingContext que, en cuentas creadas en la misma
      // sesión, puede arrastrar el pool de la cuenta ANTERIOR (setChampions(flat)
      // se programó justo antes y aún no había re-renderizado). La rama OTP previa
      // además solo añadía `isOTP:true`, conservando esos champions cacheados.
      // Por eso re-afirmamos SIEMPRE el pool/facción/roles recién elegidos en
      // ESTE onboarding (el mismo `flat` de buildFlat()), para AMBAS ramas
      // (normal y OTP). Así la cuenta B guarda SU pool, nunca el de A.
      try {
        const raw = await AsyncStorage.getItem('novarift_user');
        const stored = raw ? JSON.parse(raw) : null;
        if (stored) {
          await setUser({
            ...stored,
            champions:      flat,
            faction,
            mainRole,
            secondaryRole,
            playstyle,
            level:          stored.level || 1,
            isOTP,
            setup_complete: true,
          });
        }
      } catch (_) {}
    }
  };

  const handleConfirm = async () => {
    if (!main || localBusy) return;
    if (isOtpCandidate) { setOtpModalVisible(true); return; }
    await submitPool({ isOTP: false });
    setLocalBusy(false);
  };

  // 1 MAIN + tantos slots de champion pool como estén desbloqueados
  const maxTotalPicks =
    1 + pool.map((_, i) => i).filter(isPoolSlotUsable).length;
  const canAddMore = totalPicks < maxTotalPicks;

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <View style={[styles.container, { backgroundColor: c.bg0 }]}>
      {isDark && <NovaBackground />}
      <DevEscapeHatch />

      {/* E2 — Scroll en web. El wrapper de pantalla de react-navigation (web)
          es `flex:0 0 auto; min-height:100%`, así que CRECE hasta el alto del
          CONTENIDO en vez de quedar acotado al viewport. Resultado: el elemento
          desplazable del ScrollView (style) heredaba esa altura completa
          (scrollHeight === clientHeight), NO había overflow y el arrastre no
          desplazaba — "COMPLETAR VÍNCULO" quedaba bajo el viewport, solo
          alcanzable con Tab. Solución: acotar la altura del ScrollView al
          viewport SOLO en web (styles.scrollView con maxHeight:'100vh'); así el
          contenido (más alto) genera overflow interno y el scroll nativo
          funciona. En nativo se mantiene flex:1 (sin cambios). El fondo
          (NovaBackground) y los degradados de slots ya son pointerEvents="none". */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scroll}
        scrollEnabled
        showsVerticalScrollIndicator
        keyboardShouldPersistTaps="handled"
      >
        {/* B4.6 — indicador de paso unificado (mismo componente en los 4 pasos) */}
        <View style={styles.stepRow}>
          <ProgressDots current={4} style={{ marginTop: 0, marginBottom: 0 }} />
          <Text style={styles.stepTag}>PASO 4 DE 4</Text>
        </View>

        <Text style={styles.title}>FORJAR EL VÍNCULO CON TU CAMPEÓN</Text>
        <Text style={styles.subtitle}>
          Elige a tu main · Construye tu champion pool
        </Text>

        {/* ── TU MAIN ──────────────────────────────────────────────────── */}
        <Text style={[styles.sectionLabel, { color: COLOR_PURPLE }]}>
          TU MAIN
        </Text>
        <View style={styles.mainRow}>
          <MainSlotCard
            champion={main}
            isActive={activeSlot?.zone === 'main'}
            onTap={() => handleSlotTap('main', null)}
            onRemove={removeFromMain}
          />
        </View>

        {/* ── CHAMPION POOL ────────────────────────────────────────────── */}
        <Text style={[styles.sectionLabel, { color: c.onSurface(0.45), marginTop: 26 }]}>
          CHAMPION POOL
        </Text>
        <View style={styles.poolGrid}>
          {pool.map((champ, idx) => {
            // willLock: este hueco NACERÁ bloqueado (rol-slot >= 2). Se puede
            // elegir igualmente; solo se marca con candado + "se desbloquea
            // jugando" y se persistirá con locked:true.
            const willLock = slotInitiallyLocked(idx);
            return (
              <PoolSlotCard
                key={`pool-${idx}`}
                champion={champ}
                willLock={willLock}
                unlockGames={poolSlotUnlockGames(idx)}
                isActive={
                  activeSlot?.zone === 'pool' && activeSlot?.index === idx
                }
                onTap={() => handleSlotTap('pool', idx)}
                onRemove={() => removeFromPool(idx)}
              />
            );
          })}
        </View>

        {/* Explicador permanente del modelo 2+2: los 2 últimos huecos se
            desbloquean JUGANDO partidas (no por nivel). Umbrales reales tomados
            de SLOT_UNLOCK_GAMES (rol-slot 2 y 3). */}
        <View style={styles.lockedHintBox}>
          <Text style={styles.lockedHintText}>
            🔒 Ahora eliges tus 2 campeones principales. Los 2 últimos huecos se
            desbloquean jugando con Nova Rift: el 3º a las {SLOT_UNLOCK_GAMES[2]} partidas
            y el 4º a las {SLOT_UNLOCK_GAMES[3]}. Cuando los alcances te avisaremos para que
            elijas el campeón que entra en tu pool.
          </Text>
        </View>

        <Text style={styles.progressionInfo}>
          Forma tu pool 2+2 completo. Los huecos bloqueados se irán abriendo con tu progreso.
        </Text>

        {/* ── Buscador ─────────────────────────────────────────────────── */}
        <View style={styles.searchRow}>
          <Icon name="search" size={14} color={c.onSurface(0.55)} strokeWidth={2} />
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Buscar campeón…"
            placeholderTextColor={c.onSurface(0.30)}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {!!searchQuery && (
            <TouchableOpacity
              onPress={() => setSearchQuery('')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.searchClear}>×</Text>
            </TouchableOpacity>
          )}
        </View>

        <Text style={styles.sectionLabel}>
          {searchQuery
            ? `RESULTADOS · ${visibleList.length}`
            : 'RECOMENDADOS PARA TI'}
        </Text>

        <View style={styles.faceGrid}>
          {visibleList.length === 0 ? (
            <Text style={styles.searchEmpty}>
              Sin resultados para "{searchQuery}". Prueba con otro nombre.
            </Text>
          ) : (
            visibleList.map((name) => (
              <ChampionFaceIcon
                key={name}
                name={name}
                isMain={poolByRole.main.includes(name)}
                alreadyPicked={isAlreadyPicked(name)}
                onPress={() => setDetailChamp(name)}
              />
            ))
          )}
        </View>

        {/* CTA */}
        <View style={{ marginTop: 24 }}>
          <NovaButton
            label={localBusy ? 'FORJANDO VÍNCULO…' : 'COMPLETAR VÍNCULO →'}
            onPress={handleConfirm}
            disabled={!main || localBusy}
            loading={localBusy}
            factionColor={COLOR_PURPLE}
            size="lg"
          />
        </View>

        {localBusy && (
          <View style={{ marginTop: 12, alignItems: 'center' }}>
            <TouchableOpacity
              onPress={() => forceLocalSetup(buildFlat())}
              activeOpacity={0.7}
              style={{ paddingVertical: 8, paddingHorizontal: 16 }}
            >
              <Text style={{ color: c.onSurface(0.4), fontSize: TYPE_SCALE.caption.size, letterSpacing: 1 }}>
                ¿Tarda demasiado? Continuar sin sincronizar
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* OTP detection modal */}
      <Modal
        visible={otpModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setOtpModalVisible(false)}
      >
        <View style={styles.otpBackdrop}>
          <View style={styles.otpCard}>
            <View style={styles.otpAccent} />
            <Text style={styles.otpTitle}>¿ERES OTP?</Text>
            <Text style={styles.otpBody}>
              Has elegido {DISPLAY_NAME[main] || main} sin completar tu champion
              pool. Los OTP (One Trick Pony) dominan un solo campeón al máximo nivel.
            </Text>
            <View style={styles.otpBullets}>
              <Text style={styles.otpBullet}>· Logros y trofeos exclusivos OTP.</Text>
              <Text style={styles.otpBullet}>· Retos especializados de un único campeón.</Text>
              <Text style={styles.otpBullet}>· Stats detalladas con análisis profundo.</Text>
            </View>
            <View style={styles.otpBtnRow}>
              <TouchableOpacity
                onPress={() => setOtpModalVisible(false)}
                style={[styles.otpBtn, styles.otpBtnSecondary]}
                activeOpacity={0.85}
              >
                <Text style={[styles.otpBtnText, styles.otpBtnTextSecondary]}>
                  COMPLETAR POOL
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={async () => {
                  setOtpModalVisible(false);
                  await submitPool({ isOTP: true });
                }}
                style={[styles.otpBtn, styles.otpBtnPrimary]}
                activeOpacity={0.85}
              >
                <Text style={[styles.otpBtnText, styles.otpBtnTextPrimary]}>
                  SÍ, SOY OTP
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <CinematicBondModal
        name={detailChamp}
        onClose={() => setDetailChamp(null)}
        alreadyPicked={detailChamp ? isAlreadyPicked(detailChamp) : false}
        targetIsMain={!main}
        canAdd={canAddMore}
        onForja={() => {
          if (detailChamp) addChampion(detailChamp);
          setDetailChamp(null);
        }}
      />
    </View>
  );
}

// ─── ChampionImg ──────────────────────────────────────────────────────────
// Contenedor para la imagen del campeón dentro de cualquier slot. Usa loading
// art (aspect="portrait") + focus="face": ancla la imagen arriba para que la
// cara (tercio superior del loading 308×560) quede en cuadro. Antes hacía cover
// centrado, que dejaba la cintura visible y cortaba la cabeza en slots cuadrados.
function ChampionImg({ name, borderRadius = 10 }) {
  return (
    <View
      style={[
        StyleSheet.absoluteFillObject,
        { alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderRadius },
      ]}
    >
      <ChampionImage
        name={name}
        aspect="portrait"
        focus="face"
        resizeMode="cover"
        style={[StyleSheet.absoluteFillObject, { borderRadius }]}
      />
    </View>
  );
}

// ─── MainSlotCard ──────────────────────────────────────────────────────────
function MainSlotCard({ champion, isActive, onTap, onRemove }) {
  const { colors: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  // Vacío
  if (!champion) {
    return (
      <TouchableOpacity activeOpacity={0.85} onPress={onTap} style={styles.mainSlotWrap}>
        <Text style={styles.mainBadgeAbove}>MAIN</Text>
        <View
          style={[
            styles.mainSlot,
            {
              borderColor: COLOR_PURPLE_RGBA + '0.4)',
              borderStyle: 'dashed',
              borderWidth: 2,
              backgroundColor: 'rgba(123,118,221,0.04)',
              alignItems: 'center',
              justifyContent: 'center',
            },
          ]}
        >
          <Text style={styles.mainEmptyText}>✦ MAIN</Text>
          <Text style={styles.mainEmptyHint}>Toca un campeón</Text>
        </View>
      </TouchableOpacity>
    );
  }

  // Lleno
  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onTap} style={styles.mainSlotWrap}>
      <Text style={styles.mainBadgeAbove}>MAIN</Text>
      <View
        style={[
          styles.mainSlot,
          {
            backgroundColor: c.bg2,
            borderWidth: 2,
            borderColor: isActive ? c.textPrimary : COLOR_PURPLE,
            shadowColor: COLOR_PURPLE,
            shadowOpacity: isActive ? 0.55 : 0.35,
            shadowRadius: isActive ? 14 : 9,
            shadowOffset: { width: 0, height: 0 },
            elevation: 8,
          },
        ]}
      >
        <ChampionImg name={champion} borderRadius={10} />
        <View pointerEvents="none" style={styles.mainGradient} />

        <TouchableOpacity
          style={styles.slotCloseBtn}
          onPress={(e) => { e.stopPropagation?.(); onRemove(); }}
          activeOpacity={0.7}
        >
          <Text style={styles.slotCloseText}>×</Text>
        </TouchableOpacity>

        <Text style={styles.mainChampName}>
          {DISPLAY_NAME[champion] || champion}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── PoolSlotCard ──────────────────────────────────────────────────────────
// Modelo 2+2: `willLock` indica que este hueco NACERÁ bloqueado (rol-slot >= 2).
// El usuario puede elegirlo igualmente durante el onboarding; solo se marca con
// candado y la pista "se desbloquea a las N partidas". `unlockGames` es ese
// umbral (de SLOT_UNLOCK_GAMES). El desbloqueo real ocurre luego, jugando.
function PoolSlotCard({ champion, willLock, unlockGames, isActive, onTap, onRemove }) {
  const { colors: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  // Etiqueta superior: "BLOQUEABLE" para los huecos que persisten locked.
  const badgeText = willLock ? 'BLOQUEABLE' : (champion ? 'POOL' : 'SLOT');

  // Vacío
  if (!champion) {
    return (
      <TouchableOpacity activeOpacity={0.85} onPress={onTap} style={styles.poolSlotWrap}>
        <Text style={styles.poolBadgeAbove}>{badgeText}</Text>
        <View
          style={[
            styles.poolSlot,
            {
              borderColor: willLock ? c.onSurface(0.14) : 'rgba(123,118,221,0.25)',
              borderStyle: 'dashed',
              borderWidth: 1.5,
              backgroundColor: willLock ? 'rgba(0,0,0,0.22)' : c.onSurface(0.025),
              alignItems: 'center',
              justifyContent: 'center',
            },
          ]}
        >
          {willLock ? (
            <>
              <Text style={styles.lockGlyph}>🔒</Text>
              <Text style={styles.lockSubText}>{unlockGames || '?'}p</Text>
            </>
          ) : (
            <Text style={styles.poolPlus}>+</Text>
          )}
        </View>
      </TouchableOpacity>
    );
  }

  // Lleno (puede estar marcado willLock: se ve el campeón + un candado pequeño)
  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onTap} style={styles.poolSlotWrap}>
      <Text style={styles.poolBadgeAbove}>{badgeText}</Text>
      <View
        style={[
          styles.poolSlot,
          {
            backgroundColor: c.bg2,
            borderWidth: 1.5,
            borderColor: isActive
              ? c.textPrimary
              : willLock ? c.onSurface(0.22) : COLOR_PURPLE_RGBA + '0.5)',
            shadowColor: COLOR_PURPLE,
            shadowOpacity: isActive ? 0.45 : 0.18,
            shadowRadius: isActive ? 10 : 5,
            shadowOffset: { width: 0, height: 0 },
            elevation: 5,
          },
        ]}
      >
        <ChampionImg name={champion} borderRadius={8} />
        <View pointerEvents="none" style={styles.poolGradient} />

        {/* Candado pequeño en huecos que nacerán bloqueados */}
        {willLock && (
          <View style={styles.poolLockChip}>
            <Text style={styles.poolLockChipText}>🔒 {unlockGames || '?'}p</Text>
          </View>
        )}

        <TouchableOpacity
          style={styles.slotCloseBtnSm}
          onPress={(e) => { e.stopPropagation?.(); onRemove(); }}
          activeOpacity={0.7}
        >
          <Text style={styles.slotCloseTextSm}>×</Text>
        </TouchableOpacity>

        <Text style={styles.poolChampName} numberOfLines={1}>
          {DISPLAY_NAME[champion] || champion}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── ChampionFaceIcon ─────────────────────────────────────────────────────
const ICON_SIZE = Platform.OS === 'web' ? 68 : 60;

function ChampionFaceIcon({ name, isMain, alreadyPicked, onPress }) {
  const { colors: c } = useTheme();
  const faceStyles = useMemo(() => makeFaceStyles(c), [c]);
  // Si el icono del CDN falla (id con apóstrofo, sin red, 404…), pintamos un
  // placeholder visible con la inicial del campeón en vez de un círculo negro.
  const [imgFailed, setImgFailed] = useState(false);
  const displayLabel = CATALOG_DISPLAY[name] || DISPLAY_NAME[name] || name;
  const borderColor = alreadyPicked
    ? COLOR_PURPLE
    : isMain
      ? COLOR_PURPLE_RGBA + '0.4)'
      : c.onSurface(0.18);

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      disabled={alreadyPicked}
      style={[faceStyles.wrapper, { opacity: alreadyPicked ? 0.5 : 1 }]}
    >
      <View style={[faceStyles.avatar, {
        borderColor,
        borderWidth: alreadyPicked ? 2.5 : 1.5,
      }]}>
        {/* punto 7-bis: CommunityDragon /square (sin patch fijo) — el icono
            de DataDragon ${PATCH} fallaba sin fallback y dejaba círculos vacíos
            (Ashe/Caitlyn en el análisis del 03-06). El id va normalizado
            (Cho'Gath→Chogath, Wukong→MonkeyKing…) y con onError → placeholder. */}
        {imgFailed ? (
          <View style={faceStyles.avatarFallback}>
            <Text style={faceStyles.avatarFallbackInitial}>
              {displayLabel.charAt(0).toUpperCase()}
            </Text>
          </View>
        ) : (
          <Image
            source={{
              uri: `https://cdn.communitydragon.org/latest/champion/${normalizeChampionName(name)}/square`,
            }}
            style={faceStyles.avatarImg}
            resizeMode="cover"
            onError={() => setImgFailed(true)}
          />
        )}
        {alreadyPicked && (
          <View style={[faceStyles.pickedOverlay, {
            backgroundColor: COLOR_PURPLE_RGBA + '0.55)',
          }]}>
            <Text style={faceStyles.pickedTick}>✓</Text>
          </View>
        )}
      </View>

      <Text style={faceStyles.name} numberOfLines={1}>
        {CATALOG_DISPLAY[name] || DISPLAY_NAME[name] || name}
      </Text>

      {isMain && !alreadyPicked && (
        <Text style={faceStyles.mainBadge}>★</Text>
      )}
    </TouchableOpacity>
  );
}

const makeFaceStyles = (c) => StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    width: ICON_SIZE + 12,
    marginBottom: 4,
  },
  avatar: {
    width: ICON_SIZE, height: ICON_SIZE,
    borderRadius: ICON_SIZE / 2,
    overflow: 'hidden',
    backgroundColor: c.onSurface(0.06),
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImg: { width: '100%', height: '100%' },
  // Placeholder visible cuando el icono del CDN falla (onError): círculo
  // tintado con la inicial del campeón — nunca un hueco negro.
  avatarFallback: {
    width: '100%', height: '100%',
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(123,118,221,0.12)',
  },
  avatarFallbackInitial: {
    color: COLOR_PURPLE,
    fontSize: TYPE_SCALE.h4.size,
    fontWeight: '900',
  },
  pickedOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center', justifyContent: 'center',
    borderRadius: ICON_SIZE / 2,
  },
  pickedTick: { color: c.textPrimary, fontSize: TYPE_SCALE.h4.size, fontWeight: '900' },
  name: {
    color: c.onSurface(0.65),
    fontSize: TYPE_SCALE.micro.size, fontWeight: '700', letterSpacing: 0.5,
    marginTop: 5, textAlign: 'center',
    maxWidth: ICON_SIZE + 12,
  },
  mainBadge: { color: COLOR_PURPLE, fontSize: TYPE_SCALE.micro.size, lineHeight: 12 },
});

// ─── CinematicBondModal ───────────────────────────────────────────────────
function CinematicBondModal({
  name, onClose,
  alreadyPicked, targetIsMain, canAdd,
  onForja,
}) {
  const { colors: c } = useTheme();
  const cinematicStyles = useMemo(() => makeCinematicStyles(c), [c]);
  const [champData, setChampData] = useState(null);
  const [loading,   setLoading]   = useState(false);
  const [bondFlash, setBondFlash] = useState(false);

  useEffect(() => {
    if (!name) { setChampData(null); setBondFlash(false); return; }
    setLoading(true);
    // El JSON de Data Dragon se indexa por el id canónico (Chogath, Khazix,
    // MonkeyKing…), no por el display name — normalizamos URL y key.
    const ddId = normalizeChampionName(name);
    fetch(
      `https://ddragon.leagueoflegends.com/cdn/${PATCH}/data/es_ES/champion/${ddId}.json`
    )
      .then(r => r.json())
      .then(d => setChampData(d.data[ddId]))
      .catch(() => setChampData(null))
      .finally(() => setLoading(false));
  }, [name]);

  const handleBond = () => {
    setBondFlash(true);
    setTimeout(() => { setBondFlash(false); onForja(); }, 700);
  };

  const displayName = champData
    ? champData.name.toUpperCase()
    : (DISPLAY_NAME[name] || name || '').toUpperCase();

  return (
    <Modal
      visible={!!name}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={cinematicStyles.backdrop}>
        {/* ChampionImage en vez de <Image> plano: cascada splash → loading →
            placeholder SVG con nombre. Antes un splash 404 dejaba el fondo
            del modal completamente negro sin feedback. */}
        {name && (
          <ChampionImage
            name={name}
            // centered: el splash a pantalla completa en vertical recortaba al
            // campeón descentrado (el splash crudo de Data Dragon lo coloca a un
            // lado). El arte CENTRADO de CommunityDragon lo encuadra con un cover
            // normal, sin objectPosition, en web y en nativo.
            centered
            style={StyleSheet.absoluteFillObject}
            resizeMode="cover"
          />
        )}

        <View style={cinematicStyles.overlayBase} />
        <View style={cinematicStyles.overlayBottom} />
        <View style={cinematicStyles.overlayTop} />

        <TouchableOpacity
          style={cinematicStyles.closeBtn}
          onPress={onClose}
          activeOpacity={0.75}
        >
          <Text style={cinematicStyles.closeTxt}>✕</Text>
        </TouchableOpacity>

        <View style={cinematicStyles.contentArea}>
          <Text style={cinematicStyles.champName}>{displayName}</Text>

          {champData?.title ? (
            <Text style={cinematicStyles.tagline}>{champData.title}</Text>
          ) : null}

          {champData?.tags && champData.tags.length > 0 && (
            <View style={cinematicStyles.tagsRow}>
              {champData.tags.map(t => (
                <View key={t} style={cinematicStyles.tag}>
                  <Text style={cinematicStyles.tagTxt}>{t.toUpperCase()}</Text>
                </View>
              ))}
            </View>
          )}

          <View style={cinematicStyles.bondDivider}>
            <View style={cinematicStyles.bondLine} />
            <Text style={cinematicStyles.bondSymbol}>◈</Text>
            <View style={cinematicStyles.bondLine} />
          </View>

          {loading && (
            <ActivityIndicator
              color={COLOR_PURPLE_RGBA + '0.6)'}
              style={{ marginBottom: 12 }}
            />
          )}

          {champData?.blurb ? (
            <Text style={cinematicStyles.blurb} numberOfLines={3}>
              {champData.blurb}
            </Text>
          ) : null}

          <View style={cinematicStyles.btnStack}>
            {alreadyPicked ? (
              <View style={[cinematicStyles.bigBtn, cinematicStyles.bigBtnBonded]}>
                <Text style={cinematicStyles.bigBtnBondedTxt}>
                  ✦ VÍNCULO YA ESTABLECIDO
                </Text>
              </View>
            ) : (
              <TouchableOpacity
                style={[
                  cinematicStyles.bigBtn,
                  cinematicStyles.bigBtnForja,
                  !canAdd && cinematicStyles.bigBtnDisabled,
                ]}
                onPress={canAdd ? handleBond : undefined}
                activeOpacity={canAdd ? 0.82 : 1}
              >
                <Text
                  style={[
                    cinematicStyles.bigBtnTxt,
                    {
                      color: canAdd
                        ? COLOR_PURPLE
                        : 'rgba(255,255,255,0.25)',
                    },
                  ]}
                >
                  {canAdd
                    ? (targetIsMain ? '✦  FORJAR MAIN' : '✦  AÑADIR AL CHAMPION POOL')
                    : 'POOL COMPLETO'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {bondFlash && (
          <View style={cinematicStyles.flashOverlay}>
            <View style={cinematicStyles.flashGlow} />
            <Text style={cinematicStyles.flashSymbol}>✦</Text>
            <Text style={cinematicStyles.flashSub}>
              {targetIsMain ? 'MAIN FORJADO' : 'AÑADIDO AL CHAMPION POOL'}
            </Text>
          </View>
        )}
      </View>
    </Modal>
  );
}

const makeCinematicStyles = (c) => StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: c.bg1 },

  overlayBase: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(7,7,13,0.42)',
  },
  overlayBottom: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    height: '55%',
    backgroundColor: 'rgba(7,7,13,0.62)',
  },
  overlayTop: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: '20%',
    backgroundColor: 'rgba(7,7,13,0.50)',
  },

  closeBtn: {
    position: 'absolute',
    top: Platform.OS === 'web' ? 18 : 52,
    right: 22,
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(7,7,13,0.60)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
    zIndex: 20,
  },
  closeTxt: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: TYPE_SCALE.body.size, fontWeight: '700',
  },

  contentArea: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === 'web' ? 36 : 52,
    maxWidth: 560,
    alignSelf: 'center',
    width: '100%',
  },

  champName: {
    color: '#E8E4FF', // texto sobre la splash image del campeón: SIEMPRE claro (no se tematiza)
    fontSize: Platform.OS === 'web' ? 52 : 42,
    fontWeight: '900',
    letterSpacing: 4,
    lineHeight: Platform.OS === 'web' ? 58 : 48,
    textShadowColor: 'rgba(0,0,0,0.95)',
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 12,
    marginBottom: 6,
  },

  tagline: {
    color: COLOR_PURPLE,
    fontSize: TYPE_SCALE.body.size,
    fontStyle: 'italic',
    fontWeight: '500',
    letterSpacing: 0.5,
    marginBottom: 12,
    textShadowColor: 'rgba(123,118,221,0.35)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },

  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 },
  tag: {
    backgroundColor: 'rgba(123,118,221,0.08)',
    borderWidth: 1,
    borderColor: COLOR_PURPLE_RGBA + '0.28)',
    borderRadius: 4,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  tagTxt: {
    color: COLOR_PURPLE_RGBA + '0.80)',
    fontSize: TYPE_SCALE.micro.size, fontWeight: '900', letterSpacing: 1.5,
  },

  bondDivider: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12,
  },
  bondLine: { flex: 1, height: 1, backgroundColor: COLOR_PURPLE_RGBA + '0.30)' },
  bondSymbol: { color: COLOR_PURPLE_RGBA + '0.65)', fontSize: TYPE_SCALE.label.size, lineHeight: 16 },

  blurb: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: TYPE_SCALE.label.size, lineHeight: 20,
    fontStyle: 'italic',
    marginBottom: 18,
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },

  btnStack: { gap: 10 },
  bigBtn: {
    height: 60,
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  bigBtnForja: {
    backgroundColor: COLOR_PURPLE_RGBA + '0.12)',
    borderColor: COLOR_PURPLE,
  },
  bigBtnDisabled: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderColor: 'rgba(255,255,255,0.10)',
  },
  bigBtnBonded: {
    backgroundColor: COLOR_PURPLE_RGBA + '0.08)',
    borderColor: COLOR_PURPLE_RGBA + '0.30)',
  },
  bigBtnTxt: { fontSize: TYPE_SCALE.label.size, fontWeight: '900', letterSpacing: 2 },
  bigBtnBondedTxt: {
    color: COLOR_PURPLE_RGBA + '0.70)',
    fontSize: TYPE_SCALE.caption.size, fontWeight: '900', letterSpacing: 2,
  },

  flashOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(7,7,13,0.88)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  flashGlow: {
    position: 'absolute',
    width: 260, height: 260,
    borderRadius: 130,
    backgroundColor: COLOR_PURPLE_RGBA + '0.06)',
    borderWidth: 1,
    borderColor: COLOR_PURPLE_RGBA + '0.12)',
  },
  flashSymbol: {
    color: COLOR_PURPLE,
    fontSize: TYPE_SCALE.h1.size,
    marginTop: 4,
    textShadowColor: COLOR_PURPLE,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
    textAlign: 'center',
  },
  flashSub: {
    color: COLOR_PURPLE_RGBA + '0.70)',
    fontSize: TYPE_SCALE.caption.size,
    fontWeight: '900',
    letterSpacing: 3,
    marginTop: 10,
    textAlign: 'center',
  },
});

// ─── Estilos principales ──────────────────────────────────────────────────
const POOL_SLOT_W = 80;
const POOL_SLOT_H = 90;
const MAIN_SLOT_W = 120;
const MAIN_SLOT_H = 140;

const makeStyles = (c) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg1 },
  // E2 — Elemento desplazable del ScrollView. En web lo acotamos al alto del
  // viewport (maxHeight:'100vh') para que su contenido, más alto, genere overflow
  // INTERNO y el scroll nativo funcione (el wrapper de react-navigation no lo
  // acota — ver comentario junto al <ScrollView>). En nativo basta con flex:1.
  scrollView: {
    flex: 1,
    ...(Platform.OS === 'web' ? { maxHeight: '100vh' } : null),
  },
  // E2 — Contenido del scroll. SIN flexGrow:1 (tomaba el alto del viewport): se
  // deja que el contenido use su altura NATURAL, con un paddingBottom amplio de
  // 160 para que "COMPLETAR VÍNCULO" quede holgado al final del scroll.
  scroll: { padding: 24, paddingTop: 60, paddingBottom: 160 },

  // Step indicator
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 14 },
  stepDotFilled: { width: 22, height: 6, borderRadius: 3, backgroundColor: COLOR_PURPLE },
  stepTag: {
    color: COLOR_PURPLE_RGBA + '0.6)',
    fontSize: TYPE_SCALE.micro.size, fontWeight: '500', letterSpacing: 2, marginLeft: 4,
  },

  title: {
    color: c.textPrimary, fontSize: TYPE_SCALE.h3.size, fontWeight: '700',
    marginTop: 6, letterSpacing: 2,
  },
  subtitle: {
    color: c.onSurface(0.45), fontSize: TYPE_SCALE.label.size,
    marginTop: 4, marginBottom: 18,
  },

  sectionLabel: {
    color: c.onSurface(0.45),
    fontSize: TYPE_SCALE.caption.size, letterSpacing: 3, fontWeight: '900',
    marginBottom: 14, marginTop: 14,
  },

  // ── MAIN slot ─────────────────────────────────────────────────────────
  mainRow: { alignItems: 'center' },
  mainSlotWrap: { alignItems: 'center' },
  mainBadgeAbove: {
    color: COLOR_PURPLE,
    fontSize: TYPE_SCALE.micro.size,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 6,
  },
  mainSlot: {
    width: MAIN_SLOT_W,
    height: MAIN_SLOT_H,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  mainGradient: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(7,7,13,0.35)',
  },
  mainEmptyText: {
    color: COLOR_PURPLE_RGBA + '0.5)',
    fontSize: TYPE_SCALE.label.size,
    fontWeight: '900',
    letterSpacing: 2,
  },
  mainEmptyHint: {
    color: COLOR_PURPLE_RGBA + '0.3)',
    fontSize: TYPE_SCALE.micro.size,
    letterSpacing: 1.5,
    marginTop: 6,
  },
  mainChampName: {
    position: 'absolute',
    bottom: 8, left: 0, right: 0,
    color: '#E8E4FF', // nombre sobre el retrato del campeón en el slot: SIEMPRE claro
    fontSize: TYPE_SCALE.micro.size,
    fontWeight: '700',
    letterSpacing: 0.5,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.85)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },

  // ── POOL slots ────────────────────────────────────────────────────────
  poolGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
  },
  poolSlotWrap: { alignItems: 'center' },
  poolBadgeAbove: {
    color: c.onSurface(0.3),
    fontSize: TYPE_SCALE.micro.size,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  poolSlot: {
    width: POOL_SLOT_W,
    height: POOL_SLOT_H,
    borderRadius: 10,
    overflow: 'hidden',
    position: 'relative',
  },
  poolGradient: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(7,7,13,0.40)',
  },
  poolPlus: {
    color: c.onSurface(0.35),
    fontSize: TYPE_SCALE.h4.size,
    fontWeight: '300',
  },
  poolChampName: {
    position: 'absolute',
    bottom: 4, left: 2, right: 2,
    color: '#E8E4FF', // nombre sobre el retrato del campeón en el slot: SIEMPRE claro
    fontSize: TYPE_SCALE.micro.size,
    fontWeight: '700',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.85)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  lockText: {
    color: c.onSurface(0.4),
    fontSize: TYPE_SCALE.caption.size,
    fontWeight: '900',
    letterSpacing: 2,
    textAlign: 'center',
  },
  // Candado grande del hueco vacío bloqueable + nº de partidas debajo.
  lockGlyph: {
    fontSize: TYPE_SCALE.h6.size,
    textAlign: 'center',
    opacity: 0.6,
  },
  lockSubText: {
    color: c.onSurface(0.45),
    fontSize: TYPE_SCALE.micro.size,
    fontWeight: '900',
    letterSpacing: 1,
    textAlign: 'center',
    marginTop: 2,
  },
  // Chip de candado en la esquina de un hueco bloqueable YA relleno.
  poolLockChip: {
    position: 'absolute', top: 3, right: 3,
    paddingHorizontal: 5, paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(7,7,13,0.78)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  poolLockChipText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: TYPE_SCALE.micro.size,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  lockedHintBox: {
    marginTop: 14,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: 'rgba(123,118,221,0.08)',
    borderWidth: 1,
    borderColor: COLOR_PURPLE_RGBA + '0.3)',
    borderRadius: 8,
    alignSelf: 'center',
    maxWidth: 320,
  },
  lockedHintText: {
    color: c.onSurface(0.65),
    fontSize: TYPE_SCALE.caption.size,
    textAlign: 'center',
    letterSpacing: 0.5,
  },

  // ── Close buttons (×) ─────────────────────────────────────────────────
  slotCloseBtn: {
    position: 'absolute', top: 6, left: 6,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: 'rgba(7,7,13,0.75)',
    alignItems: 'center', justifyContent: 'center',
  },
  slotCloseText: {
    color: 'rgba(255,255,255,0.7)', fontSize: TYPE_SCALE.label.size, fontWeight: '700',
    lineHeight: 16,
  },
  slotCloseBtnSm: {
    position: 'absolute', top: 3, left: 3,
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: 'rgba(7,7,13,0.75)',
    alignItems: 'center', justifyContent: 'center',
  },
  slotCloseTextSm: {
    color: 'rgba(255,255,255,0.7)', fontSize: TYPE_SCALE.caption.size, fontWeight: '700',
    lineHeight: 13,
  },

  progressionInfo: {
    color: c.onSurface(0.3),
    fontSize: TYPE_SCALE.caption.size,
    textAlign: 'center',
    marginTop: 18,
    marginBottom: 8,
    paddingHorizontal: 12,
  },

  // ── Buscador y grid ───────────────────────────────────────────────────
  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: c.onSurface(0.04),
    borderWidth: 1, borderColor: c.onSurface(0.10),
    borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 8,
    marginTop: 24,
  },
  searchIcon: { fontSize: TYPE_SCALE.label.size, opacity: 0.5 },
  searchInput: {
    flex: 1,
    color: c.textPrimary, fontSize: TYPE_SCALE.label.size,
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' } : {}),
  },
  searchClear: {
    color: c.onSurface(0.55), fontSize: TYPE_SCALE.h6.size,
    paddingHorizontal: 4,
  },
  searchEmpty: {
    width: '100%',
    color: c.onSurface(0.45), fontSize: TYPE_SCALE.caption.size, fontStyle: 'italic',
    textAlign: 'center', paddingVertical: 24,
  },
  faceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    justifyContent: 'flex-start',
    paddingHorizontal: 2,
    marginTop: 4,
  },

  // ── OTP modal ─────────────────────────────────────────────────────────
  otpBackdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.88)',
    justifyContent: 'center', alignItems: 'center',
    padding: 24,
  },
  otpCard: {
    width: '100%', maxWidth: 380,
    backgroundColor: c.bg1,
    borderWidth: 1, borderColor: COLOR_PURPLE_RGBA + '0.55)',
    borderRadius: 14,
    padding: 20,
  },
  otpAccent: {
    width: 38, height: 3, borderRadius: 2,
    backgroundColor: COLOR_PURPLE,
    alignSelf: 'center', marginBottom: 14,
    shadowColor: COLOR_PURPLE, shadowOpacity: 0.6, shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  otpTitle: {
    color: c.textPrimary, fontSize: TYPE_SCALE.body.size, fontWeight: '900',
    textAlign: 'center', letterSpacing: 2,
  },
  otpBody: {
    color: c.onSurface(0.70),
    fontSize: TYPE_SCALE.label.size, lineHeight: 19,
    textAlign: 'center', marginTop: 10, marginBottom: 16,
  },
  otpBullets: { gap: 6, marginBottom: 14 },
  otpBullet: {
    color: c.onSurface(0.55), fontSize: TYPE_SCALE.caption.size, lineHeight: 16,
  },
  otpBtnRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  otpBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
  },
  otpBtnPrimary: {
    backgroundColor: COLOR_PURPLE_RGBA + '0.15)',
    borderColor: COLOR_PURPLE_RGBA + '0.65)',
  },
  otpBtnSecondary: {
    backgroundColor: c.onSurface(0.04),
    borderColor: c.onSurface(0.18),
  },
  otpBtnText: { fontSize: TYPE_SCALE.caption.size, fontWeight: '900', letterSpacing: 1.5 },
  otpBtnTextPrimary:   { color: c.textPrimary },
  otpBtnTextSecondary: { color: c.onSurface(0.65) },
});
