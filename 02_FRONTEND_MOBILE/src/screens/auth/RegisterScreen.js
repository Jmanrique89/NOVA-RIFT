// ============================================================================
// RegisterScreen — Auth Step 2
// ----------------------------------------------------------------------------
// Mismo fondo + logo que LoginScreen (componentes compartidos NovaBackground).
// 4 campos validados inline (errors visibles bajo campo en rojo).
// Fallback offline: si el backend no responde, crea usuario local.
// Tras éxito: setea novarift_just_logged_in para que App.js muestre Splash.
// ============================================================================
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Animated, Platform, KeyboardAvoidingView, ScrollView, ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../../config/apiConfig';
import { useUser } from '../../context/UserContext';
import { useTheme } from '../../context/ThemeContext';
import NovaBackground, { ParticleField, NovaRiftLogo } from '../../components/NovaBackground';
import { TYPE_SCALE } from '../../theme/typography';

export default function RegisterScreen({ navigation }) {
  const { setUser } = useUser();
  const { colors: c, isDark } = useTheme();
  const s = useMemo(() => makeStyles(c), [c]);

  const [username, setUsername] = useState('');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [success,  setSuccess]  = useState(false);
  const [serverOk, setServerOk] = useState(false);

  // Validaciones reactivas (solo cuando el campo no está vacío)
  const usernameErr = username.length > 0 && username.length < 3
    ? 'Mínimo 3 caracteres' : '';
  const emailErr = email.length > 0 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ? 'Email inválido' : '';
  const passwordErr = password.length > 0 && password.length < 8
    ? 'Mínimo 8 caracteres' : '';
  const confirmErr = confirm.length > 0 && confirm !== password
    ? 'No coinciden' : '';
  const canSubmit = username.length >= 3 && email && password.length >= 8
                  && confirm === password && !loading;

  const formOp    = useRef(new Animated.Value(0)).current;
  const logoPulse = useRef(new Animated.Value(1)).current;
  const accentAnim = useRef(new Animated.Value(0)).current;
  const [dotStr, setDotStr] = useState('');

  useEffect(() => {
    Animated.timing(formOp, { toValue: 1, duration: 600, delay: 200, useNativeDriver: true }).start();
    // Accent bar pulse
    Animated.loop(
      Animated.sequence([
        Animated.timing(accentAnim, { toValue: 1, duration: 2000, useNativeDriver: false }),
        Animated.timing(accentAnim, { toValue: 0.4, duration: 2000, useNativeDriver: false }),
      ])
    ).start();
  }, []);

  useEffect(() => {
    if (!success) return;
    Animated.loop(
      Animated.sequence([
        Animated.timing(logoPulse, { toValue: 1.10, duration: 800, useNativeDriver: true }),
        Animated.timing(logoPulse, { toValue: 1.0,  duration: 800, useNativeDriver: true }),
      ])
    ).start();
    const iv = setInterval(() => setDotStr(d => d.length >= 3 ? '' : d + '.'), 500);
    return () => { clearInterval(iv); };
  }, [success]);

  // mapeo de códigos HTTP a mensajes amigables. El backend devuelve
  // errores técnicos a veces (`Validation failed: ...`) — los traducimos para
  // que el usuario sepa exactamente qué corregir.
  const friendlyError = (status, raw) => {
    const r = (raw || '').toLowerCase();
    if (status === 409 || r.includes('email') && r.includes('exist')) return 'Ese email ya está registrado.';
    if (status === 409 && r.includes('username'))                     return 'Ese nombre de invocador ya está cogido.';
    if (status === 400 && r.includes('password'))                     return 'La contraseña debe tener al menos 8 caracteres.';
    if (status === 400 && r.includes('email'))                        return 'Email no válido.';
    if (status === 400)                                                return 'Datos no válidos. Revisa el formulario.';
    if (status === 503)                                                return 'Servidor no disponible. Inténtalo en unos segundos.';
    if (status >= 500)                                                 return 'Error del servidor. Inténtalo en unos segundos.';
    return raw || 'No se pudo crear la cuenta.';
  };

  const handleRegister = async () => {
    if (!canSubmit) return;
    setLoading(true);
    setError('');

    // E1 — AISLAMIENTO POR CUENTA. Antes de crear una cuenta nueva resetea
    // cualquier usuario/onboarding anterior cacheado: setUser(null) limpia
    // 'novarift_user' + 'novarift_jwt' + las ONBOARDING_KEYS (facción/roles/
    // playstyle/champions). Así la cuenta B NO parte de los datos de la cuenta A.
    await setUser(null).catch(() => {});

    try {
      const res = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim(),
          email:    email.trim().toLowerCase(),
          password,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.token) {
          await AsyncStorage.setItem('novarift_jwt', data.token).catch(() => {});
        }
        await AsyncStorage.setItem('novarift_just_logged_in', 'true').catch(() => {});
        setServerOk(true);
        setSuccess(true);
        await new Promise(r => setTimeout(r, 1200));
        await setUser({
          username:       data.username || username.trim(),
          email:          email.trim().toLowerCase(),
          setup_complete: false,
          role:           data.role || 'USER',
          mock:           false,
        });
        return;
      }

      // Backend respondió error — mostrar mensaje amigable.
      let raw = '';
      try { const j = await res.json(); raw = j?.error || j?.message || ''; } catch (_) {}
      setError(friendlyError(res.status, raw));

    } catch (e) {
      // Backend caído / sin red → fallback modo local.
      // el flag `localOnly` se conserva en el user para que
      // ProfileScreen muestre el badge "OFFLINE" hasta sincronizar con backend.
      console.warn('[RegisterScreen] Backend no disponible — usando modo local:', e.message);
      await AsyncStorage.setItem('novarift_just_logged_in', 'true').catch(() => {});
      setSuccess(true);
      await new Promise(r => setTimeout(r, 800));
      await setUser({
        username:       username.trim(),
        email:          email.trim().toLowerCase(),
        setup_complete: false,
        mock:           false,
        localOnly:      true,
      });
    } finally {
      setLoading(false);
    }
  };

  // ─── Vista de éxito ──────────────────────────────────────────────────────
  if (success) {
    return (
      <View style={[s.successWrap, { backgroundColor: c.bg0 }]}>
        {isDark && <NovaBackground />}
        {/* Accent glow top */}
        <View style={s.successAccentLine} />
        <View style={s.successCenter}>
          {/* Pulsing logo with glow ring */}
          <View style={s.successLogoWrap}>
            <View style={s.successLogoRing} />
            <Animated.View style={{ transform: [{ scale: logoPulse }] }}>
              <NovaRiftLogo size={80} />
            </Animated.View>
          </View>

          <Text style={s.successBrand}>NOVA RIFT</Text>
          <Text style={s.successTitle}>CUENTA CREADA</Text>
          <Text style={s.successSub}>Bienvenido, {username.trim()}</Text>

          {/* Storage badge */}
          <View style={[s.storeBadge, serverOk ? s.storeBadgeOk : s.storeBadgeLocal]}>
            <Text style={s.storeBadgeText}>
              {serverOk
                ? 'Cuenta guardada en servidor'
                : 'Guardado local · Se sincronizará al conectar'}
            </Text>
          </View>

          {/* Animated preparing text */}
          <Text style={s.preparingText}>PREPARANDO TU EXPERIENCIA{dotStr}</Text>
          <View style={s.preparingBar} />
        </View>
      </View>
    );
  }

  // ─── Form ────────────────────────────────────────────────────────────────
  return (
    <View style={[s.root, { backgroundColor: c.bg0 }]}>
      {isDark && <NovaBackground />}

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView style={{ flex: 1 }} contentContainerStyle={s.inner} keyboardShouldPersistTaps="handled">

          {/* Accent line */}
          <View style={s.topAccent} />

          {/* Step indicator dots */}
          <View style={s.stepDotsRow}>
            <View style={s.stepDotActive} /><View style={s.stepDotInactive} />
            <View style={s.stepDotInactive} /><View style={s.stepDotInactive} />
            <Text style={s.stepLabel}>PASO 1 DE 4</Text>
          </View>

          {/* Logo */}
          <View style={s.logoArea}>
            <View style={s.logoGlowRing}>
              <NovaRiftLogo size={72} />
            </View>
            <Text style={s.logoTitle}>NOVA RIFT</Text>
          </View>

          {/* Hero block */}
          <View style={s.heroBlock}>
            <Text style={s.heroTitle}>CREA TU CUENTA</Text>
            <Text style={s.heroSub}>Empieza tu camino en el Rift</Text>
          </View>

          {/* Form card */}
          <Animated.View style={[s.formCard, { opacity: formOp }]}>
            <Field
              label="NOMBRE DE INVOCADOR" value={username} onChange={setUsername}
              placeholder="mínimo 3 caracteres" error={usernameErr} editable={!loading}
            />
            <Field
              label="EMAIL" value={email} onChange={setEmail}
              placeholder="tu@email.com" keyboard="email-address"
              error={emailErr} editable={!loading}
            />
            <Field
              label="CONTRASEÑA" value={password} onChange={setPassword}
              placeholder="mínimo 8 caracteres" secure
              error={passwordErr} editable={!loading}
            />
            <Field
              label="CONFIRMAR CONTRASEÑA" value={confirm} onChange={setConfirm}
              placeholder="repite la contraseña" secure
              error={confirmErr} editable={!loading}
            />

            {!!error && <Text style={s.errorText}>{error}</Text>}

            <TouchableOpacity
              style={[s.ctaBtn, !canSubmit && s.ctaBtnOff, canSubmit && s.ctaBtnGlow]}
              onPress={handleRegister}
              disabled={!canSubmit}
              activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator color={c.textInverse} />
                : <Text style={s.ctaBtnText}>CREAR CUENTA</Text>
              }
            </TouchableOpacity>

            <TouchableOpacity
              style={s.linkBtn}
              onPress={() => navigation.navigate('Login')}
              activeOpacity={0.7}
            >
              <Text style={s.linkText}>¿Ya tienes cuenta? Iniciar sesión →</Text>
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

// ─── Sub-componente Field con validación inline ─────────────────────────────
function Field({ label, value, onChange, placeholder, secure, keyboard, error, editable }) {
  const { colors: c } = useTheme();
  const s = useMemo(() => makeStyles(c), [c]);
  const hasContent = value && value.length > 0;
  return (
    <View style={s.inputGroup}>
      <Text style={s.inputLabel}>{label}</Text>
      <TextInput
        style={[s.input, error ? s.inputErr : hasContent ? s.inputFilled : null]}
        placeholder={placeholder}
        placeholderTextColor={c.onSurface(0.2)}
        value={value}
        onChangeText={onChange}
        secureTextEntry={!!secure}
        keyboardType={keyboard || 'default'}
        autoCapitalize="none"
        autoCorrect={false}
        editable={editable !== false}
      />
      {!!error && <Text style={s.fieldErr}>{error}</Text>}
    </View>
  );
}

const makeStyles = (c) => StyleSheet.create({
  root: { flex: 1, backgroundColor: c.bg0 },
  inner: {
    // flexGrow:1 (no flex:1) para que el contenido pueda crecer y deslizarse;
    // paddingBottom amplio deja el botón "CREAR CUENTA" alcanzable sobre el
    // teclado en móvil (P0-2).
    flexGrow: 1,
    alignItems: 'center', padding: 24, paddingTop: 52, paddingBottom: 96,
    maxWidth: 420, alignSelf: 'center', width: '100%',
  },

  // Top accent bar (púrpura neutral)
  topAccent: {
    width: 48, height: 3, borderRadius: 2,
    backgroundColor: c.primary,
    alignSelf: 'flex-start', marginBottom: 20,
    shadowColor: c.primary, shadowOpacity: 0.7, shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },

  // Step dots
  stepDotsRow: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    alignSelf: 'flex-start', marginBottom: 20,
  },
  stepDotActive: {
    width: 22, height: 6, borderRadius: 3,
    backgroundColor: c.primary,
    shadowColor: c.primary, shadowOpacity: 0.7, shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  stepDotInactive: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: c.onSurface(0.15),
  },
  stepLabel: {
    color: c.onSurface(0.55), fontSize: TYPE_SCALE.micro.size, fontWeight: '500',
    letterSpacing: 2, marginLeft: 6,
    fontFamily: 'Rajdhani_600SemiBold',
  },

  // Logo
  logoArea:  { alignItems: 'center', marginBottom: 16, gap: 8 },
  logoGlowRing: {
    padding: 8,
    borderRadius: 50,
    borderWidth: 1,
    borderColor: 'rgba(123,118,221,0.18)',
    backgroundColor: 'rgba(123,118,221,0.08)',
  },
  logoTitle: {
    color: c.textPrimary, fontSize: TYPE_SCALE.h4.size, fontWeight: '900', letterSpacing: 7,
    textShadowColor: 'rgba(123,118,221,0.3)', textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },

  // Hero block
  heroBlock: { alignItems: 'center', marginBottom: 32 },
  heroTitle: {
    color: c.textPrimary, fontSize: TYPE_SCALE.h3.size, fontWeight: '700', letterSpacing: 4,
    textShadowColor: c.onSurface(0.15), textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
    fontFamily: 'Rajdhani_700Bold',
  },
  heroSub: { color: c.onSurface(0.5), fontSize: TYPE_SCALE.label.size, marginTop: 8, letterSpacing: 1 },

  // Form card — glass morphism
  formCard: {
    width: '100%',
    backgroundColor: c.surface,
    borderWidth: 1, borderColor: 'rgba(123,118,221,0.18)', borderRadius: 16,
    padding: 22, gap: 16,
    ...(Platform.OS === 'web'
      ? { backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
          boxShadow: `0 8px 40px rgba(0,0,0,0.5), inset 0 1px 0 ${c.onSurface(0.06)}` }
      : {}),
  },
  inputGroup: { gap: 6 },
  inputLabel: { color: c.onSurface(0.6), fontSize: TYPE_SCALE.micro.size, fontWeight: '600', letterSpacing: 1.5 },
  input: {
    backgroundColor: c.onSurface(0.05),
    borderWidth: 1, borderColor: 'rgba(123,118,221,0.25)',
    borderRadius: 10, padding: 14, color: c.textPrimary, fontSize: TYPE_SCALE.label.size,
  },
  inputFilled: {
    borderColor: 'rgba(123,118,221,0.6)',
    backgroundColor: 'rgba(123,118,221,0.08)',
  },
  inputErr:    { borderColor: 'rgba(255,68,68,0.6)', backgroundColor: 'rgba(255,68,68,0.04)' },
  fieldErr:    { color: '#ff4444', fontSize: TYPE_SCALE.caption.size, marginTop: 2, letterSpacing: 0.5 },
  errorText:   { color: '#ff4444', fontSize: TYPE_SCALE.caption.size, textAlign: 'center', letterSpacing: 0.5 },

  // CTA button
  ctaBtn: {
    backgroundColor: c.primary, borderRadius: 10,
    height: 56, justifyContent: 'center', alignItems: 'center', marginTop: 6,
    shadowColor: c.primary, shadowOpacity: 0.25, shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } : {}),
  },
  ctaBtnGlow: {
    shadowOpacity: 0.7, shadowRadius: 20, elevation: 12,
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 0 28px rgba(123,118,221,0.65), 0 4px 16px rgba(123,118,221,0.3)' }
      : {}),
  },
  ctaBtnOff:  { opacity: 0.35 },
  ctaBtnText: { color: c.textInverse, fontSize: TYPE_SCALE.label.size, fontWeight: '700', letterSpacing: 3, fontFamily: 'Rajdhani_700Bold' },

  linkBtn:  { alignItems: 'center', paddingVertical: 8 },
  linkText: { color: c.onSurface(0.45), fontSize: TYPE_SCALE.label.size },

  // ─── Vista de éxito ───────────────────────────────────────────────────────
  successWrap: {
    flex: 1, backgroundColor: c.bg0,
    alignItems: 'center', justifyContent: 'center',
  },
  successAccentLine: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 2,
    backgroundColor: c.primary,
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 0 20px rgba(123,118,221,0.7)' }
      : {}),
  },
  successCenter: { alignItems: 'center', gap: 0, padding: 32 },
  successLogoWrap: {
    position: 'relative', alignItems: 'center', justifyContent: 'center',
    marginBottom: 24,
  },
  successLogoRing: {
    position: 'absolute',
    width: 120, height: 120, borderRadius: 60,
    borderWidth: 1, borderColor: 'rgba(123,118,221,0.25)',
    backgroundColor: 'rgba(123,118,221,0.08)',
  },
  successBrand: {
    color: c.onSurface(0.5), fontSize: TYPE_SCALE.caption.size, fontWeight: '600',
    letterSpacing: 6, marginBottom: 4,
  },
  successTitle: {
    color: c.textPrimary, fontSize: TYPE_SCALE.h3.size, fontWeight: '700', letterSpacing: 4,
    marginBottom: 8,
    textShadowColor: c.onSurface(0.2), textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  successSub: {
    color: c.onSurface(0.5), fontSize: TYPE_SCALE.label.size, textAlign: 'center',
    marginBottom: 20,
  },
  preparingText: {
    color: '#9C98F0', fontSize: TYPE_SCALE.caption.size, letterSpacing: 3, fontWeight: '600',
    marginTop: 20, textAlign: 'center', opacity: 0.85,
  },
  preparingBar: {
    width: 60, height: 2, borderRadius: 1, backgroundColor: 'rgba(123,118,221,0.4)',
    marginTop: 10,
  },
  storeBadge: {
    marginTop: 4, paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: 10, borderWidth: 1,
  },
  storeBadgeOk: {
    backgroundColor: 'rgba(76,175,80,0.10)',
    borderColor: 'rgba(76,175,80,0.40)',
  },
  storeBadgeLocal: {
    backgroundColor: 'rgba(255,167,38,0.08)',
    borderColor: 'rgba(255,167,38,0.35)',
  },
  storeBadgeText: {
    color: c.onSurface(0.7), fontSize: TYPE_SCALE.caption.size, textAlign: 'center',
  },
});
