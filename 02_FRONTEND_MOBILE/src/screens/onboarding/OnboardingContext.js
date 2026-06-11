// ============================================================================
// OnboardingContext — state compartido entre las 5 pantallas del onboarding
// ----------------------------------------------------------------------------
// Patrón: React Navigation Auth Flow.
// submitOnboarding() llama a UserContext.setUser({ ...user, setup_complete: true })
// → App.js detecta el cambio del state user y monta automáticamente AppTabs.
// NO hace falta navigation.reset.
//
// Mantiene:
// faction, mainRole, secondaryRole, playstyle, champions, quizAnswers
// submitting, submitError
// ============================================================================
import React, { createContext, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../../config/apiConfig';
import { useUser } from '../../context/UserContext';

export const OnboardingContext = createContext({});

export function OnboardingProvider({ children }) {
  const { user, setUser } = useUser();

  const [faction,        setFaction]        = useState(null);
  const [mainRole,       setMainRole]       = useState(null);
  const [secondaryRole,  setSecondaryRole]  = useState(null);
  const [playstyle,      setPlaystyle]      = useState(null);
  const [champions,      setChampions]      = useState([]);
  const [quizAnswers,    setQuizAnswers]    = useState({});
  const [submitting,     setSubmitting]     = useState(false);
  const [submitError,    setSubmitError]    = useState(null);

  const reset = useCallback(() => {
    setFaction(null);
    setMainRole(null);
    setSecondaryRole(null);
    setPlaystyle(null);
    setChampions([]);
    setQuizAnswers({});
    setSubmitError(null);
  }, []);

  /**
   * Cierra el onboarding.
   * 1. Si hay JWT → POST /api/v1/user/setup (best-effort, NO bloquea).
   * 2. Pase lo que pase con el backend → setUser({ ...user,
   * setup_complete: true }) con flag `localOnly: true` si el backend no
   * respondió.
   * 3. App.js detecta el cambio del user y monta AppTabs automáticamente.
   *
   * Clave para no dejar al usuario atascado en el onboarding: el setUser está
   * en su propio try/catch y se ejecuta SIEMPRE, aunque el fetch al backend o
   * la lectura del token fallen.
   *
   * P2 — overrides: el caller puede pasar los valores RECIÉN elegidos
   * (`{ champions, faction, mainRole, secondaryRole, playstyle }`). Sin esto,
   * un `setChampions(x)` seguido de `submitOnboarding()` en el mismo tick
   * manda al backend el closure ANTERIOR (en cuenta nueva: `[]`) — el pool
   * se persistía vacío en USER_CHAMPIONS aunque en local se viera bien.
   *
   * @returns {Promise<boolean>} true si OK, false si ni siquiera setUser pudo.
   */
  const submitOnboarding = useCallback(async (overrides = {}) => {
    setSubmitting(true);
    setSubmitError(null);

    const effChampions = overrides.champions ?? champions;
    const payload = {
      faction:       overrides.faction       ?? faction,
      mainRole:      overrides.mainRole      ?? mainRole,
      secondaryRole: overrides.secondaryRole ?? secondaryRole,
      playstyle:     overrides.playstyle     ?? playstyle,
      champions: effChampions.map(c => ({
        championId: c.championId,
        priority:   c.priority,
      })),
    };

    // ── Best-effort POST al backend (NUNCA bloquea el flujo) ──────────────
    // Timeout duro de 5 s con AbortController: si el backend tarda más,
    // abortamos y seguimos en local. Evita que un fetch colgado deje al
    // usuario esperando indefinidamente.
    let backendOk = false;
    try {
      const token = await AsyncStorage.getItem('novarift_jwt').catch(() => null);
      if (token) {
        const ac = (typeof AbortController !== 'undefined') ? new AbortController() : null;
        const timeoutId = setTimeout(() => ac && ac.abort(), 5000);
        try {
          const res = await fetch(`${API_BASE_URL}/user/setup`, {
            method:  'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body:   JSON.stringify(payload),
            signal: ac ? ac.signal : undefined,
          });
          backendOk = !!res.ok;
          if (!res.ok) {
            console.warn('[OnboardingContext] /user/setup respondió no-OK:', res.status);
            try {
              await AsyncStorage.setItem(
                'onboarding_persistence_error',
                JSON.stringify({ ts: Date.now(), reason: 'http_' + res.status })
              );
            } catch (_) {}
          }
        } finally {
          clearTimeout(timeoutId);
        }
      } else {
        console.info('[OnboardingContext] sin JWT — onboarding local only');
      }
    } catch (netErr) {
      const reason = netErr?.name === 'AbortError'
        ? 'timeout_5s'
        : (netErr?.message || String(netErr));
      console.warn('[OnboardingContext] /user/setup fetch falló:', reason);
      try {
        await AsyncStorage.setItem(
          'onboarding_persistence_error',
          JSON.stringify({ ts: Date.now(), reason })
        );
      } catch (_) {}
    }

    // ── setUser SIEMPRE — la app no puede quedar pillada en onboarding ─────
    try {
      const nextUser = {
        ...(user || {}),
        ...payload,
        setup_complete: true,
        localOnly:      !backendOk, // marca el modo offline para badges
      };
      // Flag para que el navigator muestre el WelcomeScreen UNA vez tras
      // completar el onboarding. Best-effort: si AsyncStorage falla,
      // simplemente no se muestra la bienvenida (no es crítico).
      try { await AsyncStorage.setItem('novarift_show_welcome', 'true'); } catch (_) {}
      await setUser(nextUser);
      setSubmitting(false);
      return true;
    } catch (e) {
      // Si ni siquiera setUser funciona (estado React corrupto) — registramos
      // el error pero NO devolvemos false sin loguear; el caller puede aplicar
      // su propio fallback.
      console.error('[OnboardingContext] setUser falló:', e?.message || e);
      setSubmitError(e?.message || 'Error inesperado al cerrar el onboarding');
      setSubmitting(false);
      return false;
    }
  }, [faction, mainRole, secondaryRole, playstyle, champions, user, setUser]);

  return (
    <OnboardingContext.Provider value={{
      faction, setFaction,
      mainRole, setMainRole,
      secondaryRole, setSecondaryRole,
      playstyle, setPlaystyle,
      champions, setChampions,
      quizAnswers, setQuizAnswers,
      submitting, submitError,
      reset, submitOnboarding,
    }}>
      {children}
    </OnboardingContext.Provider>
  );
}
