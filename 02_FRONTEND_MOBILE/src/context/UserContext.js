// ============================================================================
// UserContext — estado global de autenticación + auto-reset onboarding parcial
// ----------------------------------------------------------------------------
// Provee: { user, setUser, loading, hasStaleOnboarding } y persiste el usuario
// en AsyncStorage. Puntos clave del diseño:
// Cada setUser() sella `lastSeenAt: Date.now()`.
// Al arrancar, si el usuario cacheado tiene `setup_complete=false` y han
// pasado >24h desde `lastSeenAt`, se borra en silencio junto con las claves
// de onboarding: una sesión a medias no debe bloquear el siguiente arranque.
// hasStaleOnboarding indica si hay onboarding parcial reciente (≤24h) para
// que LoginScreen ofrezca el link "¿Sesión atascada? Reinicia onboarding".
// Los usuarios `mock` NO se persisten (viven solo en memoria), para que la
// demo no deje al usuario logueado tras recargar.
//
// Sigue el patrón "React Navigation Authentication Flow":
// https://reactnavigation.org/docs/auth-flow/
// ============================================================================
import React, {
  createContext, useCallback, useContext, useEffect, useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24h

// Claves de AsyncStorage que pertenecen al onboarding y se limpian al reset.
const ONBOARDING_KEYS = [
  'novarift_onboarding_faction',
  'novarift_onboarding_roles',
  'novarift_onboarding_playstyle',
  'novarift_onboarding_champions',
];

/**
 * Validación mínima del shape del usuario cacheado. Si AsyncStorage devuelve
 * algo que NO parece un objeto válido (sin id ni username, un string suelto o
 * un array), se considera corrupto y se limpia en silencio, evitando que el
 * navigator se quede colgado en "loading" o entre con datos basura.
 */
function isValidStoredUser(stored) {
  if (!stored || typeof stored !== 'object' || Array.isArray(stored)) return false;
  // Mínimo aceptable: tener id O username O riotId (es lo que diferencia un
  // user real de mock antiguo o de un objeto vacío `{}`).
  return Boolean(stored.id || stored.username || stored.riotId);
}

export const UserContext = createContext({
  user:                null,
  setUser:             async () => {},
  loading:             true,
  hasStaleOnboarding:  false,
});

export function UserProvider({ children }) {
  const [user,    setUserState]      = useState(null);
  const [loading, setLoading]        = useState(true);
  const [hasStaleOnboarding, setHasStale] = useState(false);

  // Leer AsyncStorage en arranque + decidir si reset silencioso aplica
  useEffect(() => {
    (async () => {
      try {
        const json = await AsyncStorage.getItem('novarift_user');
        if (!json) { setLoading(false); return; }
        const stored = JSON.parse(json);

        // Usuario corrupto (shape inválido) → limpiar silenciosamente. Cubre:
        // JSON.parse OK pero el resultado es null/string/array
        // Objeto vacío `{}` cacheado por un bug previo
        // Mock filtrado sin id/username/riotId
        if (!isValidStoredUser(stored)) {
          await AsyncStorage.multiRemove([
            'novarift_user',
            'novarift_jwt',
            'novarift_just_logged_in',
            ...ONBOARDING_KEYS,
          ]).catch(() => {});
          setUserState(null);
          setHasStale(false);
          return;
        }

        const now = Date.now();
        const age = stored?.lastSeenAt ? (now - stored.lastSeenAt) : Infinity;

        // Onboarding parcial caducado (>24h) → reset silencioso.
        if (stored && stored.setup_complete === false && age > STALE_THRESHOLD_MS) {
          await AsyncStorage.multiRemove([
            'novarift_user',
            'novarift_jwt',
            'novarift_just_logged_in',
            ...ONBOARDING_KEYS,
          ]).catch(() => {});
          setUserState(null);
          setHasStale(false);
        } else {
          setUserState(stored);
          // Hay onboarding reciente sin terminar → exponer flag para
          // que LoginScreen pueda ofrecer el link de reinicio.
          setHasStale(stored && stored.setup_complete === false);
        }
      } catch (_) {
        // AsyncStorage corrupto (JSON.parse falló) — mejor empezar limpio.
        await AsyncStorage.multiRemove(['novarift_user']).catch(() => {});
        setUserState(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  /**
   * Actualiza el usuario tanto en memoria como en AsyncStorage.
   * Pasar null para hacer logout completo.
   * Cada escritura sella `lastSeenAt` con Date.now() (lo usa el auto-reset
   * de onboarding parcial).
   */
  const setUser = useCallback(async (userData) => {
    if (userData === null) {
      await AsyncStorage.multiRemove([
        'novarift_user',
        'novarift_jwt',
        'novarift_just_logged_in',
        ...ONBOARDING_KEYS,
      ]).catch(() => {});
      setUserState(null);
      setHasStale(false);
      return;
    }

    const sealed = { ...userData, lastSeenAt: Date.now() };

    // Los usuarios `mock` NO se persisten en AsyncStorage: viven solo en
    // memoria. Así, tras una sesión demo, al recargar la app se vuelve a Login
    // en vez de saltar directo a AppTabs con el mock cacheado.
    if (!sealed.mock) {
      try {
        await AsyncStorage.setItem('novarift_user', JSON.stringify(sealed));
      } catch (e) {
        // Si AsyncStorage falla, dejamos evidencia para diagnóstico.
        try {
          await AsyncStorage.setItem(
            'onboarding_persistence_error',
            JSON.stringify({ ts: Date.now(), msg: e?.message || String(e) })
          );
        } catch (_) {}
      }
    }

    setUserState({ ...sealed });
    setHasStale(sealed.setup_complete === false);
  }, []);

  return (
    <UserContext.Provider value={{ user, setUser, loading, hasStaleOnboarding }}>
      {children}
    </UserContext.Provider>
  );
}

/** Hook rápido. Uso: const { user, setUser, hasStaleOnboarding } = useUser(); */
export const useUser = () => useContext(UserContext);
