// ============================================================================
// ProfileScreen / Identity tab — perfil del usuario autenticado
// ----------------------------------------------------------------------------
// Antes esto mostraba el formulario de "buscar invocador de Riot" — confuso
// porque el usuario YA está autenticado al llegar aquí.
//
// Ahora lee del UserContext y muestra:
// Avatar inicial + username + email + facción
// Stats del onboarding (rol main/secundario, playstyle)
// Champion pool (los 5 elegidos)
// Botón cerrar sesión
//
// Las stats se piden a Riot (fetchSummonerSummary); si no hay respuesta o es
// una cuenta mock, caemos a NOVA_GLOBAL_STATS como fallback visual silencioso.
// ============================================================================
// ── Imports de React y React Native ──────────────────────────────────────
// React + hooks: useContext (lee un estado global), useEffect (código al
// montar / al cambiar deps) y useState (estado que redibuja). De react-native:
// View (contenedor), Text (texto), ScrollView (scroll vertical, como un
// JScrollPane), TouchableOpacity (botón táctil), StyleSheet (estilos como
// objeto Java), Image y Platform (detección de SO para estilos específicos).
import React, { useContext, useEffect, useState, useRef, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Image, Platform,
} from 'react-native';

// ── Contextos globales y configuración ───────────────────────────────────
// useUser / RiotContext / useRadar: estado global compartido (como singletons
// inyectados, accesibles sin pasarlos por parámetros). adminConfig/demoConfig:
// helpers para distinguir cuentas de administrador y la cuenta demo (FAKER).
import { useUser } from '../context/UserContext';
import { RiotContext } from '../context/RiotContext';
import { isAdminUser } from '../config/adminConfig';
import { isDemoAccount } from '../config/demoConfig';
import { useRadar } from '../context/RadarContext';

// ── Tema (facciones, colores, tipografía) ────────────────────────────────
// Constantes de diseño centralizadas (como un fichero de estilos compartido).
import { TYPE_SCALE, SPACING, TIER_COLORS } from '../theme';
import { useTheme } from '../context/ThemeContext';

// ── Componentes propios ──────────────────────────────────────────────────
import Icon from '../components/Icon';
import NovaBackground, { NovaRiftLogo } from '../components/NovaBackground';
// HUD coherente con LiveScreen/ForgeScreen.
// AnimatedTacticalBackground añade el grid táctico sutil que unifica
// visualmente las pantallas principales del proyecto.
import AnimatedTacticalBackground from '../components/AnimatedTacticalBackground';
import ErrorState from '../components/feedback/ErrorState';
import ThemeToggle from '../components/ThemeToggle';

// ── Servicios, mocks y datos ─────────────────────────────────────────────
// fetchSummonerSummary: petición a la API de Riot (vía backend). Los mocks
// (NOVA_GLOBAL_STATS) son el fallback de la cuenta demo.
// buildSessionForUser personaliza la sesión de demo con el main real del
// usuario — el HUD ya no enseña al Jinx hardcodeado del mock.
import { buildSessionForUser } from '../utils/buildSessionForUser';
import { fetchSummonerSummary } from '../services/riotApi';
import { NOVA_GLOBAL_STATS } from '../mocks/novaStats';
// FactionRadarChart movido a HubScreen → tab PERFIL.
// Trophy cabinet movido a ELO Forge (src/components/TrophyCabinet.js).


// Emblema oficial de tier de CommunityDragon. Reutilizado
// el patrón de (HubScreen). Devuelve null para tier null/unranked
// y el caller debe pintar fallback. Si la imagen falla (sin red), <Image>
// no pinta nada — el texto del rango sigue visible.
function tierEmblemUrl(tier) {
  const T = (tier || '').trim();
  if (!T || T.toUpperCase() === 'UNRANKED') return null;
  // OP.GG CDN — funciona sin CORS ni restricciones de acceso
  return `https://opgg-static.akamaized.net/images/medals_new/${T.toLowerCase()}.png`;
}

// Censura un email por privacidad para no exponerlo en pantalla.
// `jorge2@gmail.com` → `●●●●●@gmail.com`. Si el email no es válido,
// devuelve string vacío (el caller decide no renderizar la línea).
function maskEmail(email) {
  if (!email || !email.includes('@')) return '';
  const [, domain] = email.split('@');
  return `●●●●●@${domain}`;
}

const ROLE_ICONS = {
  TOP:     'shield', JUNGLE: 'target', MID: 'spark',
  ADC:     'kda',    SUPPORT: 'brain',
};

const PLAYSTYLE_TITLES = {
  AGRESIVO:   'El Cazador',
  TACTICO:    'El Escalador',
  SUPPORTIVE: 'El Guardián',
  DOMINANTE:  'El Presionador',
};

// Nombres de línea por rol
const ROLE_LANE = {
  TOP:     'Solo Lane',
  JUNGLE:  'River',
  MID:     'Mid Lane',
  ADC:     'Bot Lane',
  SUPPORT: 'Bot Lane',
};

// toda la lógica de la Sala de Trofeos vive ahora en
// `src/components/TrophyCabinet.js` y se monta en ELO Forge.

export default function ProfileScreen() {
  // useUser(): usuario autenticado + su setter, leídos del contexto global
  // (como una dependencia inyectada accesible desde cualquier pantalla).
  const { user, setUser } = useUser();
  // useContext(RiotContext): lee el tema visual activo del contexto de Riot.
  const { theme } = useContext(RiotContext);
  const { colors: c, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  // Riot ID del jugador (directo o ensamblado desde username + tag).
  const riotId = user?.riotId || (user?.username ? `${user.username}#${user?.tag || 'EUW'}` : null);

  // ── Estado local del componente ────────────────────────────────────────
  // useState crea variables de instancia que, al cambiar con su setter,
  // redibujan la pantalla (como un campo Java con notifyObservers).
  // Carga stats reales desde el backend (misma fuente que HubScreen).
  // `riotError` marca un fallo de red: para cuentas reales muestra el
  // ErrorState; la cuenta demo (FAKER) lo ignora y usa los mocks.
  const [riotSummary, setRiotSummary] = useState(null);
  const [riotError, setRiotError] = useState(false);
  // Aviso inline cuando se pulsa "Iniciar configuración →" en la cuenta demo:
  // el GateNavigator (App.js) excluye a `user.mock` del stack de onboarding
  // (needsSetup = !user.mock && !user.setup_complete), así que en demo no se
  // puede montar la configuración guiada — se explica en vez de no hacer nada.
  const [demoSetupNotice, setDemoSetupNotice] = useState(false);
  // Refs para el auto-reintento ante fallo de red. Sin esto, si el backend
  // estaba caído al montar la pantalla, el ErrorState quedaba bloqueado y nunca
  // se volvía a pedir el summary.
  const retryRef = useRef(null);
  const attemptRef = useRef(0);
  // loadSummary: resetea el contador de reintentos y lanza la primera
  // petición. También es el callback de "Reintentar" del ErrorState.
  const loadSummary = () => {
    if (!riotId) return;
    if (retryRef.current) { clearTimeout(retryRef.current); retryRef.current = null; }
    attemptRef.current = 0;
    setRiotError(false);
    setRiotSummary(null);
    runSummaryFetch();
  };
  // `fetchSummonerSummary` resuelve con un mock local (`_localMock:true`,
  // `mock:true`) ante un fallo de red en vez de lanzar. Detectamos ese caso y
  // reintentamos en segundo plano (hasta 4 veces, cada 2.5s) para
  // autorrecuperarnos cuando el backend arranca. Un 404 / Riot-ID inválido sí
  // lanza (RiotApiError) → `.catch` → error determinista, sin reintento.
  const runSummaryFetch = () => {
    fetchSummonerSummary(riotId, { region: 'euw1' })
      .then((result) => {
        setRiotSummary(result);
        if (result?._localMock && attemptRef.current < 4) {
          attemptRef.current += 1;
          retryRef.current = setTimeout(runSummaryFetch, 2500);
        }
      })
      .catch(() => setRiotError(true));
  };
  // useEffect: se ejecuta al montar la pantalla y CADA vez que cambian sus
  // dependencias [riotId, username] (como un @PostConstruct combinado con un
  // observador). Recarga el resumen cuando el usuario cambia de cuenta. El
  // cleanup cancela cualquier reintento pendiente al desmontar/cambiar cuenta.
  useEffect(() => {
    loadSummary();
    return () => {
      if (retryRef.current) { clearTimeout(retryRef.current); retryRef.current = null; }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.riotId, user?.username]);

  // ── Política de datos demo vs reales ───────────────────────────────────
  // FAKER usa siempre los mocks sin avisos. Cualquier otra cuenta: si Riot
  // falla (red caída o backend con mock=true) mostramos el ErrorState en el
  // resumen competitivo en vez de stats falsas.
  const isDemoUser = isDemoAccount(riotId);
  const riotFailed = riotError || riotSummary?.mock === true;
  const showRiotError = !isDemoUser && riotFailed;

  // ── Mensaje del ErrorState diferenciado según el tipo de fallo ──────────
  // Mismo criterio que HubScreen: 404 (cuenta inexistente) vs. fallback local
  // (backend caído) vs. mock server-side (key de Riot caída).
  const riotErrorInfo = riotError
    ? {
        title: 'Cuenta no encontrada',
        message: 'No se encontró la cuenta. Comprueba que el Riot ID es correcto.',
      }
    : riotSummary?._localMock
      ? {
          title: 'Sin conexión con el servidor',
          message: 'No hay conexión con el servidor. Comprueba que el backend está activo.',
        }
      : {
          title: 'API Key de Riot caducada',
          message: 'La key de Riot API caduca cada 24 h. Renuévala en developer.riotgames.com, actualiza application.properties (línea 63) y reinicia el backend.',
        };

  // Stats a mostrar: reales si el backend respondió, NovaRift como fallback visual.
  const solo = riotSummary && !riotSummary.mock ? (riotSummary.soloRanked || {}) : null;
  const totalGames = solo ? (solo.wins || 0) + (solo.losses || 0) : 0;
  const profileStats = solo && totalGames > 0 ? {
    winrate: Math.round((solo.wins * 100) / totalGames) + '%',
    winrateSub: `${solo.wins}V · ${solo.losses}D`,
    kda: NOVA_GLOBAL_STATS.avgKDA?.toFixed(1) || '4.2',
    kdaSub: 'media últimas',
    rank: `${solo.tier?.charAt(0) + solo.tier?.slice(1).toLowerCase()} ${solo.division || ''}`.trim(),
    rankSub: `${solo.leaguePoints ?? 0} LP`,
  } : {
    winrate: '60%',
    winrateSub: '6V · 4D',
    kda: NOVA_GLOBAL_STATS.avgKDA?.toFixed(1) || '4.2',
    kdaSub: 'media',
    rank: 'Gold II',
    rankSub: '47 LP',
  };

  // Color oficial del tier para el rango (TIER_COLORS), con fallback a oro.
  const rankTierName = (user?.tier || profileStats.rank.split(' ')[0] || '').toUpperCase();
  const rankColor = TIER_COLORS[rankTierName] || c.gold;

  // La lógica de la Sala de Trofeos vive en `src/components/TrophyCabinet.js`
  // y se monta en el tab ELO Forge. ProfileScreen ya no la necesita.

  // Por seguridad — no debería pasar (App.js gate lo evita) pero defensivo
  if (!user) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: c.onSurface(0.5) }}>Sin sesión activa</Text>
      </View>
    );
  }

  const handleLogout = async () => {
    await setUser(null);
  };

  // ── Botón "SIMULAR PARTIDA" ─────────────────────────────────────────────
  // Abre la sesión de demo en el RadarContext, que LiveScreen intercepta vía
  // `radar.gameSession?.active` para mostrar el InGameHUD.
  // la sesión se construye con buildSessionForUser(user) — el campeón
  // jugado es el MAIN del usuario (onboarding), no el Jinx del mock crudo.
  // Sólo aparece para cuentas mock (user.mock); las cuentas reales siguen el
  // flujo natural Live → ChampSelect → Active.
  const radar = useRadar(); // useRadar(): contexto global del radar (singleton inyectado)
  const handleSimulateMatch = () => {
    radar?.openWithSession?.(buildSessionForUser(user));
  };

  // ── Render: layout de la pantalla ──────────────────────────────────────
  // El JSX describe la UI de forma declarativa (como montar el árbol de Swing,
  // pero describiendo el QUÉ y no el CÓMO). De fondo a frente y de arriba a
  // abajo: fondos animados + un ScrollView con el banner de facción, la
  // tarjeta de perfil, el perfil táctico, los botones (simular/cerrar sesión)
  // y el resumen competitivo.
  return (
    <View style={[styles.container, { backgroundColor: c.bg0 }]}>
      {/* NovaBackground V3 (rayos + partículas) — capa más profunda */}
      {isDark && <NovaBackground />}
      {/* P1 — Grid táctico animado coherente con LiveScreen/ForgeScreen.
          intensity="normal" porque ProfileScreen es vista estática (no real-time). */}
      {isDark && <AnimatedTacticalBackground theme={theme} intensity="normal" />}
      <ScrollView contentContainerStyle={styles.scroll}>

        {/* Faction Header Banner — bloque visual de facción */}
        <View style={[styles.factionBanner, { backgroundColor: c.bg2 }]}>
          {/* Barra superior de acento */}
          <View style={[styles.factionBannerAccentBar, { backgroundColor: c.primary }]} />
          {/* Contenido del header */}
          <View style={styles.factionBannerContent}>
            <View>
              <Text style={styles.brandTitle}>NOVA RIFT</Text>
              <Text style={styles.brandSub}>COACHING COMPETITIVO</Text>
            </View>
            {/* Logo de marca (mismo asset SVG que LoginScreen). El badge de
                identidad de facción se retiró del perfil: las identidades siguen
                existiendo internamente, solo desaparece este distintivo. */}
            <NovaRiftLogo size={46} />
          </View>
          {/* Línea inferior decorativa */}
          <View style={[styles.factionBannerBottomLine, { backgroundColor: c.primary + '44' }]} />
        </View>

        {/* Card de perfil */}
        <View style={styles.profileCard}>
          {/* Emblema de tier Data Dragon centrado sobre el nombre */}
          {!!user.tier && !!tierEmblemUrl(user.tier) && (
            <Image
              source={{ uri: tierEmblemUrl(user.tier) }}
              style={styles.tierEmblemHero}
              resizeMode="contain"
            />
          )}
          <View style={styles.profileHeader}>
            {/* Avatar: emblem de rango si disponible, sino gold por defecto */}
            <View style={[styles.avatar, { borderColor: c.primary, backgroundColor: c.primary + '18' }]}>
              <Image
                source={{ uri: tierEmblemUrl(user.tier) || 'https://opgg-static.akamaized.net/images/medals_new/gold.png' }}
                style={styles.avatarEmblem}
                resizeMode="contain"
              />
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.novaRiftIdBadge}>NOVA RIFT ID</Text>
              <Text style={styles.profileLabel}>INVOCADOR</Text>
              <Text style={styles.profileUsername}>{user.username || '—'}</Text>
              {/* Email censurado por privacidad: mostramos solo el dominio,
                  p.ej. `●●●●●@gmail.com`. */}
              {!!user.email && (
                <Text style={styles.profileEmail}>{maskEmail(user.email)}</Text>
              )}
              {/* Badge ADMIN — visible si user.riotId/username está en
                  ADMIN_RIOT_IDS (adminConfig). Mismo color que el tab Admin. */}
              {isAdminUser(user?.riotId || user?.username) && (
                <View style={styles.adminBadge}>
                  <Text style={styles.adminBadgeText}>ADMINISTRADOR</Text>
                </View>
              )}
            </View>
          </View>

          {/* Badges de estado. El badge de identidad de facción (ESMERALDA…) se
              retiró del perfil por decisión de producto ("lo de la facción
              sobra"): la identidad sigue viva internamente, solo desaparece este
              distintivo decorativo. Se mantiene el badge OFFLINE. */}
          <View style={styles.badgeRow}>
            {/* Badge OFFLINE para cuentas locales sin backend. La cuenta demo
                (FAKER / user.mock) NO muestra ningún distintivo — es
                indistinguible de una cuenta real. */}
            {user.localOnly && <Tag text="OFFLINE" color="#f39c12" />}
          </View>
        </View>

        {/* FactionRadarChart movido a HubScreen tab PERFIL (decisión
            BRAIN: el radar pertenece al panel competitivo, no al perfil de
            usuario). Aquí queda hueco para nuevas tarjetas de identidad. */}

        {/* Sección PERFIL TÁCTICO */}
        {(user.mainRole || user.playstyle) && (
          <View style={styles.tacticCard}>
            <Text style={styles.tacticCardTitle}>PERFIL TÁCTICO</Text>

            {/* Roles */}
            <View style={styles.setupRow}>
              {user.mainRole && (
                <SetupCell
                  label="MAIN"
                  value={`${user.mainRole}${ROLE_LANE[user.mainRole] ? ' — ' + ROLE_LANE[user.mainRole] : ''}`}
                  iconName={ROLE_ICONS[user.mainRole]}
                  color="#7B76DD"
                />
              )}
              {user.secondaryRole && (
                <SetupCell
                  label="SECUNDARIO"
                  value={`${user.secondaryRole}${ROLE_LANE[user.secondaryRole] ? ' — ' + ROLE_LANE[user.secondaryRole] : ''}`}
                  iconName={ROLE_ICONS[user.secondaryRole]}
                  color={c.cyan}
                />
              )}
            </View>

            {/* Pills de identidad */}
            <View style={styles.tacticPillRow}>
              {user.playstyle && (
                <View style={styles.tacticPill}>
                  <Text style={styles.tacticPillText}>
                    {PLAYSTYLE_TITLES[user.playstyle] || user.playstyle}
                  </Text>
                </View>
              )}
              {user.isOTP && (
                <View style={styles.otpPill}>
                  <Text style={styles.otpPillText}>OTP</Text>
                </View>
              )}
            </View>
          </View>
        )}


        {/* CTA si no hay datos de onboarding */}
        {!user.mainRole && !user.playstyle && (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Perfil táctico incompleto</Text>
            <Text style={styles.emptyText}>
              Completa el setup para ver tu rol, identidad y estilo de juego.
            </Text>
            <TouchableOpacity
              style={styles.setupCtaBtn}
              activeOpacity={0.8}
              // Cuentas reales: bajar setup_complete remonta el stack de
              // onboarding en GateNavigator (App.js) → arranca en RoleQuiz.
              // Cuenta demo (user.mock): el gate la excluye del onboarding por
              // diseño ("cuenta demo, salta onboarding"), así que mostramos un
              // aviso explicativo en vez de un botón muerto.
              onPress={() => {
                if (user?.mock) { setDemoSetupNotice(true); return; }
                setUser({ ...user, setup_complete: false });
              }}
            >
              <Text style={styles.setupCtaText}>Iniciar configuración →</Text>
            </TouchableOpacity>
            {demoSetupNotice && (
              <Text style={styles.demoSetupNotice}>
                La configuración guiada no está disponible en modo demo. Crea tu
                propia cuenta para forjar tu identidad táctica.
              </Text>
            )}
          </View>
        )}

        {/* Sala de Trofeos movida a ELO Forge. Aquí no se renderiza:
            ProfileScreen es la pantalla de identidad, los logros pertenecen
            al panel de progreso/coaching (Forge). */}

        {/* Botón "SIMULAR PARTIDA": abre directamente el InGameHUD con la
            sesión mock. Sólo en cuentas mock (`user.mock`) — las cuentas
            reales tienen el flujo natural Live → ChampSelect. */}
        {user.mock && (
          <TouchableOpacity
            style={[
              styles.simulateBtn,
              { borderColor: c.primary + '88', backgroundColor: c.primary + '18' },
            ]}
            onPress={handleSimulateMatch}
            activeOpacity={0.85}
          >
            <Text style={[styles.simulateText, { color: c.primary }]}>
              SIMULAR PARTIDA
            </Text>
            <Text style={styles.simulateSub}>
              Jinx ADC vs Lucian + Morgana
            </Text>
          </TouchableOpacity>
        )}

        {/* Toggle de tema claro/oscuro OCULTO (decisión v4, entrega 12-jun): el
            modo claro se descarta porque login/registro/onboarding no son legibles
            en claro. La app queda en oscuro coherente (LIGHT_MODE_READY=false).
            Para reactivar: poner el flag a true y descomentar <ThemeToggle/>. */}
        {/* <ThemeToggle /> */}

        {/* Cerrar sesión */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.85}>
          <Text style={styles.logoutText}>CERRAR SESIÓN</Text>
        </TouchableOpacity>

        {/* Resumen competitivo: winrate, KDA y rango. Datos reales de Riot
            cuando hay respuesta. En cuentas reales, si Riot falla mostramos
            el ErrorState; sólo la cuenta demo (FAKER) usa el fallback mock. */}
        <View style={{ marginTop: 20 }}>
          <View style={{
            borderLeftWidth: 3, borderLeftColor: c.primary,
            paddingLeft: 10, marginBottom: 14,
          }}>
            <Text style={{ color: c.onSurface(0.6), fontSize: TYPE_SCALE.micro.size, letterSpacing: 2.5, fontWeight: '900' }}>
              RESUMEN COMPETITIVO
            </Text>
          </View>
          {showRiotError ? (
            <ErrorState
              title={riotErrorInfo.title}
              message={riotErrorInfo.message}
              onRetry={loadSummary}
            />
          ) : (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {[
                { label: 'WINRATE', value: profileStats.winrate, sub: profileStats.winrateSub, color: c.primary, accent: 'rgba(123,118,221,0.12)' },
                { label: 'KDA', value: profileStats.kda, sub: profileStats.kdaSub, color: c.primary, accent: 'rgba(123,118,221,0.10)' },
                // RANGO usa el color oficial del tier (TIER_COLORS) — coherente con
                // el emblema. Gold→dorado, Platinum→cian, Diamond→azul, etc.
                { label: 'RANGO', value: profileStats.rank, sub: profileStats.rankSub, color: rankColor, accent: rankColor + '1A' },
              ].map(s => (
                <View key={s.label} style={{
                  flex: 1,
                  backgroundColor: s.accent,
                  borderRadius: 12, paddingVertical: 18, paddingHorizontal: SPACING.sm,
                  borderWidth: 1, borderColor: s.color + '44',
                  borderBottomWidth: 3, borderBottomColor: s.color + '88',
                  alignItems: 'center', minHeight: 100,
                  justifyContent: 'center',
                }}>
                  <Text style={{ color: s.color, fontSize: TYPE_SCALE.h3.size, fontWeight: '900', letterSpacing: 0.5, lineHeight: 32 }}>{s.value}</Text>
                  <Text style={{ color: '#7B76DD99', fontSize: TYPE_SCALE.micro.size, letterSpacing: 2, fontWeight: '900', marginTop: 5, textTransform: 'uppercase' }}>{s.label}</Text>
                  <Text style={{ color: c.onSurface(0.35), fontSize: TYPE_SCALE.micro.size, marginTop: 3 }}>{s.sub}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Watermark emblema + tagline */}
        <View style={{ alignItems: 'center', marginTop: 36, paddingBottom: 24 }}>
          {/* Thin divider */}
          <View style={{ width: '60%', height: 1, backgroundColor: 'rgba(123,118,221,0.12)', marginBottom: 28 }} />
          <Image
            source={{ uri: 'https://opgg-static.akamaized.net/images/medals_new/gold.png' }}
            style={{ width: 88, height: 88, resizeMode: 'contain', opacity: 0.12 }}
          />
          <Text style={{ color: c.onSurface(0.18), fontSize: TYPE_SCALE.caption.size, letterSpacing: 4, marginTop: 12, fontWeight: '900' }}>
            NOVA RIFT
          </Text>
          <Text style={{ color: c.onSurface(0.10), fontSize: TYPE_SCALE.micro.size, letterSpacing: 2.5, marginTop: 4 }}>
            COACHING COMPETITIVO
          </Text>
        </View>
      </ScrollView>

    </View>
  );
}

// ─── Sub-componentes ────────────────────────────────────────────────────────
// Componentes pequeños y reutilizables sólo dentro de esta pantalla. Reciben
// sus datos por props (parámetros de entrada, como los del constructor).

// Tag: pastilla de estado con color configurable (p.ej. el badge OFFLINE).
function Tag({ text, color }) {
  const { colors: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
    <View style={[styles.tag, { borderColor: color + '55', backgroundColor: color + '22' }]}>
      <Text style={[styles.tagText, { color }]}>{text}</Text>
    </View>
  );
}

// SetupCell: celda del perfil táctico que muestra un rol con su icono
// (MAIN / SECUNDARIO) dentro de un recuadro coloreado.
function SetupCell({ label, value, iconName, color }) {
  const { colors: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
    <View style={[styles.setupCell, { borderColor: color + '55', backgroundColor: color + '18' }]}>
      <Icon name={iconName} size={20} color={color} />
      <Text style={styles.setupLabel}>{label}</Text>
      <Text style={[styles.setupValue, { color }]} numberOfLines={1}>{value}</Text>
    </View>
  );
}

// `TrophyCard` y la lógica del cabinet movidos a
// `src/components/TrophyCabinet.js`. Allí viven el motor de cálculo, la
// snapshot AsyncStorage y la reveal animation. ProfileScreen ya no necesita
// nada de eso porque la Sala de Trofeos ahora se renderiza en ELO Forge.

// ── Estilos ──────────────────────────────────────────────────────────────
// StyleSheet.create() define los estilos (como CSS, pero como objeto Java).
// Agrupados por zona: contenedor/scroll, HUD header, tarjeta de perfil,
// badges, secciones, banner de facción, perfil táctico y botones (CTA).
const makeStyles = (c) => StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingTop: 60, paddingBottom: 90 },

  // P1 — HUD coherente con LiveScreen/ForgeScreen (5 accents + título glow)
  hudHeader: { alignItems: 'center', marginBottom: 28 },
  headerTopBar: {
    flexDirection: 'row',
    width: '60%',
    height: 3,
    marginBottom: 12,
    borderRadius: 2,
    overflow: 'hidden',
  },
  headerAccent: {
    flex: 1,
    height: 3,
    marginHorizontal: 2,
    borderRadius: 2,
    opacity: 0.8,
  },
  brandTitle: {
    color: c.textPrimary, fontSize: TYPE_SCALE.h4.size, fontWeight: '900', letterSpacing: 5,
    ...(Platform.OS === 'web' ? {
      textShadow: '0 0 20px rgba(232,228,255,0.4)',
    } : {}),
  },
  brandSub: {
    color: c.onSurface(0.55), fontSize: TYPE_SCALE.caption.size,
    letterSpacing: 3, marginTop: SPACING.xs, fontWeight: '700',
  },

  // Profile card
  profileCard: {
    backgroundColor: 'rgba(123,118,221,0.05)',
    borderWidth: 1, borderColor: '#7B76DD33',
    borderRadius: 16, padding: 20, marginBottom: 20,
    shadowColor: '#7B76DD', shadowOpacity: 0.15, shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 }, elevation: 4,
    ...(Platform.OS === 'web' ? {
      backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
      boxShadow: '0 0 32px rgba(123,118,221,0.06), inset 0 1px 0 rgba(255,255,255,0.07)',
    } : {}),
  },
  novaRiftIdBadge: {
    color: '#7B76DD88', fontSize: 8, letterSpacing: 2,
    fontWeight: '900', marginBottom: 2,
  },
  profileHeader: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  avatar: {
    width: 70, height: 70, borderRadius: 35, borderWidth: 2.5,
    alignItems: 'center', justifyContent: 'center',
    ...(Platform.OS === 'web' ? {
      boxShadow: '0 0 18px rgba(123,118,221,0.45), 0 0 36px rgba(123,118,221,0.15)',
    } : {}),
  },
  avatarText: { fontSize: TYPE_SCALE.h4.size, fontWeight: '900' },
  profileLabel: { color: c.onSurface(0.45), fontSize: TYPE_SCALE.micro.size, letterSpacing: 2.5, fontWeight: '900', textTransform: 'uppercase' },
  profileUsername: { color: c.textPrimary, fontSize: TYPE_SCALE.h5.size, fontWeight: '900', marginTop: 5, letterSpacing: 1.5 },
  profileEmail: { color: c.onSurface(0.40), fontSize: TYPE_SCALE.caption.size, marginTop: 3 },
  adminBadge: {
    backgroundColor: '#ff4444', borderRadius: 4,
    paddingHorizontal: SPACING.sm, paddingVertical: 2,
    alignSelf: 'flex-start', marginTop: 6,
  },
  adminBadgeText: {
    color: c.textPrimary, fontSize: TYPE_SCALE.micro.size, fontWeight: '900', letterSpacing: 1.5,
  },

  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginTop: 16 },
  factionBadge: {
    borderWidth: 1.5, borderRadius: 20,
    paddingHorizontal: SPACING.lg, paddingVertical: 7,
  },
  factionBadgeText: { fontSize: TYPE_SCALE.caption.size, fontWeight: '900', letterSpacing: 2.5 },
  tag: {
    borderWidth: 1, borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  tagText: { fontSize: TYPE_SCALE.micro.size, fontWeight: '900', letterSpacing: 1.5 },

  // Sections
  section: { marginBottom: 18 },
  sectionLabel: {
    color: c.onSurface(0.35), fontSize: TYPE_SCALE.micro.size,
    fontWeight: '900', letterSpacing: 2, marginBottom: 10,
  },

  setupRow: { flexDirection: 'row', gap: 8 },
  setupCell: {
    flex: 1, borderWidth: 1, borderRadius: 6,
    padding: 12, alignItems: 'center', gap: 6,
  },
  setupLabel: { color: c.onSurface(0.4), fontSize: TYPE_SCALE.micro.size, letterSpacing: 1, fontWeight: '700' },
  setupValue: { fontSize: TYPE_SCALE.caption.size, fontWeight: '900', letterSpacing: 1 },

  sectionHint: {
    color: c.onSurface(0.40),
    fontSize: TYPE_SCALE.caption.size, fontStyle: 'italic',
    marginTop: -4, marginBottom: SPACING.sm,
  },
  championsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  championSlot: { width: 64, alignItems: 'center', position: 'relative' },
  championImg: { width: 56, height: 56, borderRadius: 4, borderWidth: 1.5 },
  championName: { color: c.textPrimary, fontSize: TYPE_SCALE.micro.size, fontWeight: '700', marginTop: 4 },
  championPriority: {
    position: 'absolute', top: -4, right: 4,
    backgroundColor: c.primary, color: c.textInverse,
    fontSize: TYPE_SCALE.micro.size, fontWeight: '900',
    paddingHorizontal: SPACING.xs, paddingVertical: 1, borderRadius: 3,
  },

  emptyCard: {
    backgroundColor: c.surface,
    borderWidth: 1, borderColor: c.onSurface(0.08),
    borderRadius: 8, padding: 18, marginBottom: 18,
  },
  emptyTitle: { color: c.textPrimary, fontSize: TYPE_SCALE.label.size, fontWeight: '900', letterSpacing: 1 },
  emptyText: { color: c.onSurface(0.5), fontSize: TYPE_SCALE.caption.size, marginTop: 6, lineHeight: 17 },

  logoutBtn: {
    marginTop: SPACING.lg,
    borderWidth: 1.5, borderColor: '#ff4444',
    backgroundColor: 'rgba(255,68,68,0.06)',
    borderRadius: 10, paddingVertical: SPACING.lg, alignItems: 'center',
  },
  logoutText: { color: '#ff4444', fontSize: TYPE_SCALE.caption.size, fontWeight: '900', letterSpacing: 3 },

  // ELO estimado: bloque centrado dentro de la profileCard
  eloBlock: {
    marginTop: SPACING.lg,
    borderTopWidth: 1, borderRadius: 8,
    paddingVertical: 12, paddingHorizontal: 14,
    alignItems: 'center',
    backgroundColor: c.onSurface(0.02),
  },
  eloLabel: {
    fontSize: TYPE_SCALE.micro.size, fontWeight: '900', letterSpacing: 2,
  },
  eloValue: {
    fontSize: TYPE_SCALE.h2.size, fontWeight: '900', letterSpacing: 2,
    marginTop: 2, fontVariant: ['tabular-nums'],
  },
  eloDivision: {
    color: c.onSurface(0.55),
    fontSize: TYPE_SCALE.caption.size, fontWeight: '700', letterSpacing: 1,
    marginTop: SPACING.xs,
  },
  otpTag: {
    marginTop: SPACING.sm,
    backgroundColor: 'rgba(123,118,221,0.15)',
    borderWidth: 1, borderColor: 'rgba(123,118,221,0.45)',
    borderRadius: 4, paddingHorizontal: SPACING.sm, paddingVertical: 3,
  },
  otpTagText: {
    color: 'rgba(192,188,255,0.95)',
    fontSize: TYPE_SCALE.micro.size, fontWeight: '900', letterSpacing: 1.5,
  },

  // Emblema de tier oficial centrado en eloBlock
  rankEmblemLarge: {
    width: 80, height: 80,
    alignSelf: 'center',
    marginVertical: SPACING.sm,
  },

  // Stats de temporada (3 pills compactas)
  seasonStatsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: 14,
  },
  statPill: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    backgroundColor: c.onSurface(0.03),
    paddingVertical: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
  },
  statValue: {
    color: c.textPrimary,
    fontSize: TYPE_SCALE.label.size, fontWeight: '900',
    letterSpacing: 0.5,
  },
  statLabel: {
    color: c.onSurface(0.40),
    fontSize: TYPE_SCALE.micro.size, fontWeight: '700',
    letterSpacing: 1.5,
    marginTop: SPACING.xs,
  },

  // Sección "MI POOL" con top 3 champions
  poolSection: { marginTop: 18 },
  poolSectionTitle: {
    fontSize: TYPE_SCALE.caption.size, fontWeight: '900',
    letterSpacing: 2,
    marginBottom: 10,
  },
  poolRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10, marginBottom: SPACING.sm,
    paddingVertical: SPACING.xs,
  },
  poolRank: {
    width: 24,
    fontSize: TYPE_SCALE.caption.size,
    color: c.onSurface(0.40),
    fontWeight: '900',
    textAlign: 'center',
  },
  poolChampImg: {
    width: 32, height: 32,
    borderRadius: 4,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  poolChampName: {
    flex: 1,
    fontSize: TYPE_SCALE.label.size,
    color: c.textPrimary,
    fontWeight: '700',
  },
  poolChampStats: {
    fontSize: TYPE_SCALE.caption.size,
    color: c.onSurface(0.55),
    fontVariant: ['tabular-nums'],
  },

  // CTA "SIMULAR PARTIDA"
  simulateBtn: {
    marginTop: 20,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 14, paddingHorizontal: 14,
    alignItems: 'center', gap: SPACING.xs,
  },
  simulateText: {
    fontSize: TYPE_SCALE.caption.size, fontWeight: '900', letterSpacing: 2.5,
  },
  simulateSub: {
    color: c.onSurface(0.45),
    fontSize: TYPE_SCALE.micro.size, fontWeight: '700', letterSpacing: 0.5,
  },

  // estilos del trophy cabinet movidos a `src/components/TrophyCabinet.js`.

  // ─── Faction Header Banner ───────────────────────────────────────────────
  factionBanner: {
    borderRadius: 16,
    marginBottom: 20,
    overflow: 'hidden',
    minHeight: 190,
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: c.onSurface(0.08),
    ...(Platform.OS === 'web' ? {
      boxShadow: '0 8px 40px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.08)',
    } : {}),
  },
  factionBannerAccentBar: {
    height: 4,
    width: '100%',
    opacity: 1,
  },
  factionBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    paddingVertical: 20,
    flex: 1,
  },
  factionBannerBadge: {
    borderWidth: 1.5,
    borderRadius: 8,
    paddingHorizontal: SPACING.lg,
    paddingVertical: 9,
  },
  factionBannerBadgeText: {
    fontSize: TYPE_SCALE.caption.size, fontWeight: '900', letterSpacing: 3,
  },
  factionBannerBottomLine: {
    height: 1,
    width: '100%',
    opacity: 0.6,
  },

  // ─── Avatar emblem ───────────────────────────────────────────────────────
  avatarEmblem: {
    width: 58, height: 58,
  },
  // Emblema de tier grande centrado sobre el perfil
  tierEmblemHero: {
    width: 96, height: 104,
    alignSelf: 'center',
    marginBottom: 12,
    ...(Platform.OS === 'web' ? {
      filter: 'drop-shadow(0 0 16px rgba(255,215,0,0.45))',
    } : {}),
  },

  // ─── Sección Perfil Táctico ──────────────────────────────────────────────
  tacticCard: {
    backgroundColor: c.surface,
    borderWidth: 1, borderColor: c.onSurface(0.10),
    borderLeftWidth: 3, borderLeftColor: c.primary,
    borderRadius: 12, padding: 18, marginBottom: 20,
    gap: 14,
  },
  tacticCardTitle: {
    color: c.primary, fontSize: TYPE_SCALE.micro.size,
    fontWeight: '900', letterSpacing: 2.5, textTransform: 'uppercase',
  },
  tacticPillRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginTop: SPACING.xs,
  },
  tacticPill: {
    borderWidth: 1,
    borderColor: c.onSurface(0.25),
    backgroundColor: c.surfaceElevated,
    borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  tacticPillText: {
    color: c.onSurface(0.80),
    fontSize: TYPE_SCALE.caption.size, fontWeight: '700', letterSpacing: 0.5,
  },
  otpPill: {
    borderWidth: 1,
    borderColor: 'rgba(123,118,221,0.55)',
    backgroundColor: 'rgba(123,118,221,0.15)',
    borderRadius: 16,
    paddingHorizontal: 12, paddingVertical: 5,
  },
  otpPillText: {
    color: c.primary,
    fontSize: TYPE_SCALE.caption.size, fontWeight: '900', letterSpacing: 1.5,
  },

  // ─── CTA Completar Setup ─────────────────────────────────────────────────
  setupCtaBtn: {
    marginTop: 14,
    borderWidth: 1, borderColor: c.primary,
    backgroundColor: 'rgba(123,118,221,0.12)',
    borderRadius: 8, paddingVertical: 13, alignItems: 'center',
  },
  setupCtaText: {
    color: c.primary, fontSize: TYPE_SCALE.label.size, fontWeight: '900', letterSpacing: 1,
  },
  // Aviso inline bajo el CTA de setup cuando la cuenta es demo (user.mock).
  demoSetupNotice: {
    color: '#f39c12',
    fontSize: TYPE_SCALE.caption.size,
    lineHeight: 16,
    marginTop: 10,
    textAlign: 'center',
  },
});
