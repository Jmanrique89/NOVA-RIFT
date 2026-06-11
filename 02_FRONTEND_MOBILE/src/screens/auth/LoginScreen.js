// ============================================================================
// LoginScreen — Auth Step 1
// ----------------------------------------------------------------------------
// Fondo: #07070d + ParticleField ascendente
// Logo: NovaRiftLogo (hexágono + estrella diamante)
// Form: glassmorphism inputs + botón sólido #7b76dd
// Lógica: useUser().setUser → App.js cambia automáticamente al gate correcto
// ============================================================================
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Animated, Platform, KeyboardAvoidingView, ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../../config/apiConfig';
import { useUser } from '../../context/UserContext';
import { useTheme } from '../../context/ThemeContext';
import NovaBackground, { NovaRiftLogo } from '../../components/NovaBackground';
import { TYPE_SCALE } from '../../theme/typography';
import { sealOnboardingPool } from '../../utils/championPool';
// B4.4 — micro-feedback de pulsación del CTA ENTRAR (mismo spring que NovaButton).
import { usePressScale } from '../../hooks/usePressScale';
import { CHAMPIONS } from '../../data/championsCatalog';

// id Data Dragon → nombre legible, para reconstruir el pool que devuelve
// /user/profile (solo trae championId+priority).
const CATALOG_DISPLAY = Object.fromEntries(
  CHAMPIONS.map(ch => [ch.id, ch.displayName])
);

/**
 * P2 — Reconstruye el formato LOCAL del pool a partir del profile del backend
 * (entradas {championId, priority}): añade displayName, slot textual
 * ('main' = priority 1) y sella slot numérico + locked con sealOnboardingPool
 * (mismo sellado que hace el onboarding). Si el profile no trae champions,
 * conserva el pool local cacheado SOLO si pertenece a ESTA misma cuenta
 * (mismo userId) — nunca se hereda el pool de otra cuenta (aislamiento E1).
 */
async function restoreChampionPool(profile, loginUserId) {
  const fromBackend = Array.isArray(profile?.champions) ? profile.champions : [];
  if (fromBackend.length > 0) {
    const ordered = [...fromBackend]
      .sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99));
    return sealOnboardingPool(ordered.map((ch, i) => {
      const priority = ch.priority ?? (i + 1);
      return {
        championId:  ch.championId,
        priority,
        displayName: CATALOG_DISPLAY[ch.championId] || ch.championId,
        slot:        priority === 1 ? 'main' : 'secondary',
      };
    }));
  }
  try {
    const raw = await AsyncStorage.getItem('novarift_user');
    const stored = raw ? JSON.parse(raw) : null;
    if (
      stored && loginUserId && stored.id === loginUserId &&
      Array.isArray(stored.champions) && stored.champions.length > 0
    ) {
      return stored.champions;
    }
  } catch (_) {}
  return [];
}

export default function LoginScreen({ navigation }) {
  const { setUser, hasStaleOnboarding } = useUser();
  const { colors: c, isDark } = useTheme();
  const s = useMemo(() => makeStyles(c), [c]);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  const formOp = useRef(new Animated.Value(0)).current;
  const formY  = useRef(new Animated.Value(24)).current;
  // B4.4 — micro-feedback del CTA ENTRAR
  const ctaPress = usePressScale();

  useEffect(() => {
    Animated.parallel([
      Animated.timing(formOp, { toValue: 1, duration: 600, delay: 250, useNativeDriver: true }),
      Animated.timing(formY,  { toValue: 0, duration: 500, delay: 250, useNativeDriver: true }),
    ]).start();
  }, []);

  const handleLogin = async () => {
    if (!username.trim() || !password) {
      setError('Introduce usuario y contraseña');
      return;
    }
    setLoading(true);
    setError('');

    // El campo INVOCADOR acepta el formato "GameName#TAG" (ej. "minihakim#EUW").
    // Separamos el nombre de invocador del tag de región: si el usuario no
    // escribe '#', asumimos el tag por defecto 'EUW'. Al backend le mandamos
    // SOLO el gameName (así están registradas las cuentas en /auth/login) y
    // guardamos el tag aparte en el user object para construir el Riot ID
    // ("minihakim#EUW") aguas abajo (Hub/Profile/Forge).
    const rawInput = username.trim();
    const hashIndex = rawInput.indexOf('#');
    const gameName = (hashIndex >= 0 ? rawInput.slice(0, hashIndex) : rawInput).trim();
    const tag = (hashIndex >= 0 ? rawInput.slice(hashIndex + 1).trim() : '') || 'EUW';

    try {
      const res = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: gameName, password }),
      });
      if (!res.ok) {
        let msg = 'Credenciales incorrectas';
        try { const j = await res.json(); msg = j?.error || j?.message || msg; } catch (_) {}
        setError(msg);
        return;
      }
      const data = await res.json();
      const token = data.token;
      if (token) {
        await AsyncStorage.setItem('novarift_jwt', token).catch(() => {});
      }

      // Cargar perfil completo (champions, roles, playstyle) del backend.
      // Best-effort: si falla, usamos los datos básicos del login response.
      let profile = null;
      if (token) {
        try {
          const profileRes = await fetch(`${API_BASE_URL}/user/profile`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (profileRes.ok) profile = await profileRes.json();
        } catch (_) {}
      }

      // P2 — pool en formato local (displayName+slot+locked) desde el profile;
      // si el backend no trae champions, conserva el local de ESTA cuenta.
      const loginUserId = profile?.userId || data.userId || null;
      const champions = await restoreChampionPool(profile, loginUserId);

      // Flag para que App.js muestre la SplashScreen UNA vez
      await AsyncStorage.setItem('novarift_just_logged_in', 'true').catch(() => {});
      // setUser con perfil completo — si /user/profile falló usamos el login response
      await setUser({
        id:             loginUserId,
        username:       profile?.username || data.username || gameName,
        tag,
        setup_complete: profile?.setupComplete ?? data.setupComplete ?? false,
        faction:        profile?.faction  || data.faction  || null,
        mainRole:       profile?.mainRole || null,
        secondaryRole:  profile?.secondaryRole || null,
        playstyle:      profile?.playstyle || null,
        champions,
        role:           profile?.role     || data.role     || 'USER',
        mock:           false,
      });
    } catch (e) {
      setError('No se pudo conectar al servidor');
    } finally {
      setLoading(false);
    }
  };

  // Modo demo: usa username 'FAKER' para que isDemoAccount() lo detecte
  // y todas las pantallas carguen mocks en vez de llamar a Riot API
  const handleMockMode = async () => {
    await AsyncStorage.setItem('novarift_just_logged_in', 'true').catch(() => {});
    await setUser({
      id: 'mock-001',
      username: 'FAKER',
      tag: 'EUW',
      mock: true,
      setup_complete: true,
      faction: 'ZAUN',
    });
  };

  // el botón [DEV] LIMPIAR SESIÓN se sustituye por un link
  // discreto que SÓLO aparece si hay onboarding parcial reciente (≤24h)
  // el reset >24h ya ocurre automático en UserContext.
  const handleResetOnboarding = async () => {
    setLoading(true);
    setError('');
    try {
      await setUser(null);
      setUsername('');
      setPassword('');
    } finally {
      setLoading(false);
    }
  };

  const canSubmit = !!username.trim() && !!password && !loading;

  return (
    <View style={s.root}>
      {/* Fondo animado — tormenta de líneas + partículas ascendentes */}
      {isDark && <NovaBackground />}

      <KeyboardAvoidingView
        style={s.inner}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Logo */}
        <View style={s.logoArea}>
          <NovaRiftLogo size={82} />
          <Text style={s.logoTitle}>NOVA RIFT</Text>
          <Text style={s.logoSub}>coaching competitivo</Text>
        </View>

        {/* Form */}
        <Animated.View
          style={[
            s.formCard,
            { opacity: formOp, transform: [{ translateY: formY }] },
          ]}
        >
          <View style={s.inputGroup}>
            <Text style={s.inputLabel}>INVOCADOR</Text>
            <TextInput
              style={s.input}
              placeholder="GameName#TAG"
              placeholderTextColor={c.onSurface(0.2)}
              value={username}
              onChangeText={t => { setUsername(t); if (error) setError(''); }}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
            />
          </View>

          <View style={s.inputGroup}>
            <Text style={s.inputLabel}>CONTRASEÑA</Text>
            <TextInput
              style={s.input}
              placeholder="••••••••"
              placeholderTextColor={c.onSurface(0.2)}
              value={password}
              onChangeText={t => { setPassword(t); if (error) setError(''); }}
              secureTextEntry
              editable={!loading}
            />
          </View>

          {!!error && <Text style={s.errorText}>{error}</Text>}

          <TouchableOpacity
            style={!canSubmit ? s.ctaBtnOff : null}
            onPress={handleLogin}
            disabled={!canSubmit}
            activeOpacity={0.85}
            onPressIn={ctaPress.onPressIn}
            onPressOut={ctaPress.onPressOut}
          >
            {/* B4.4 — el spring vive en un Animated.View interior para no
                pelear con el style del TouchableOpacity */}
            <Animated.View style={[s.ctaBtn, { transform: [{ scale: ctaPress.scale }] }]}>
              {loading
                ? <ActivityIndicator color={c.textPrimary} />
                : <Text style={s.ctaBtnText}>ENTRAR</Text>
              }
            </Animated.View>
          </TouchableOpacity>

          <TouchableOpacity
            style={s.linkBtn}
            onPress={() => navigation.navigate('Register')}
            activeOpacity={0.7}
          >
            <Text style={s.linkText}>
              ¿No tienes cuenta? <Text style={s.linkAccent}>Regístrate</Text>
            </Text>
          </TouchableOpacity>
        </Animated.View>

        {/* Demo discreto */}
        <TouchableOpacity style={s.demoBtn} onPress={handleMockMode} activeOpacity={0.7}>
          <Text style={s.demoText}>Modo Demo · FAKER#EUW</Text>
        </TouchableOpacity>

        {/* link de reinicio onboarding sólo si hay sesión parcial
            reciente. El reset automático (>24h) ya se aplica en UserContext. */}
        {hasStaleOnboarding && (
          <TouchableOpacity style={s.resetLink} onPress={handleResetOnboarding} activeOpacity={0.7}>
            <Text style={s.resetLinkText}>¿Sesión atascada? Reinicia onboarding</Text>
          </TouchableOpacity>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}

const makeStyles = (c) => StyleSheet.create({
  root: { flex: 1, backgroundColor: c.bg1 },
  inner: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    padding: 24, maxWidth: 400, alignSelf: 'center', width: '100%',
  },

  logoArea: { alignItems: 'center', marginBottom: 36, gap: 8 },
  logoTitle: { color: c.textPrimary, fontSize: TYPE_SCALE.h3.size, fontWeight: '900', letterSpacing: 6 },
  logoSub:   { color: 'rgba(192,188,255,0.4)', fontSize: TYPE_SCALE.micro.size, fontWeight: '400', letterSpacing: 3 },

  formCard: {
    width: '100%',
    backgroundColor: c.onSurface(0.04),
    borderWidth: 1, borderColor: c.onSurface(0.08), borderRadius: 14,
    padding: 20, gap: 14,
    ...(Platform.OS === 'web'
      ? { backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }
      : {}),
  },
  inputGroup: { gap: 6 },
  inputLabel: {
    color: c.onSurface(0.45), fontSize: TYPE_SCALE.micro.size,
    fontWeight: '600', letterSpacing: 1.5,
  },
  input: {
    backgroundColor: c.onSurface(0.05),
    borderWidth: 1, borderColor: c.onSurface(0.1),
    borderRadius: 8, padding: 13,
    color: c.textPrimary, fontSize: TYPE_SCALE.label.size,
  },
  errorText: { color: '#e74c3c', fontSize: TYPE_SCALE.caption.size, textAlign: 'center' },

  // CTA — sólido púrpura, NO transparente con borde
  ctaBtn: {
    backgroundColor: c.primary, borderRadius: 8,
    paddingVertical: 14, alignItems: 'center', marginTop: 4,
  },
  ctaBtnOff:  { opacity: 0.45 },
  ctaBtnText: { color: '#FFFFFF', fontSize: TYPE_SCALE.label.size, fontWeight: '700', letterSpacing: 3, fontFamily: 'Rajdhani_700Bold' },

  linkBtn:    { alignItems: 'center', paddingVertical: 4 },
  linkText:   { color: c.onSurface(0.38), fontSize: TYPE_SCALE.label.size },
  linkAccent: { color: '#c0bcff', fontWeight: '700' },

  demoBtn: {
    marginTop: 24,
    paddingVertical: 10, paddingHorizontal: 20,
    borderRadius: 20, borderWidth: 1, borderColor: c.onSurface(0.1),
  },
  demoText: { color: c.onSurface(0.3), fontSize: TYPE_SCALE.caption.size, letterSpacing: 1 },

  // link discreto de reinicio onboarding (sustituye al [DEV])
  resetLink: {
    marginTop: 16,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  resetLinkText: {
    color: c.onSurface(0.45),
    fontSize: TYPE_SCALE.caption.size,
    letterSpacing: 0.5,
    textDecorationLine: 'underline',
  },
});
