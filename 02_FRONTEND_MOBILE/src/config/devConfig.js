// ============================================================================
// devConfig — flags de desarrollo (NO PRODUCCIÓN)
// ----------------------------------------------------------------------------
// Centraliza los toggles que sólo deben usarse durante desarrollo / demos
// internas. NUNCA encender en build de producción ni commitear con `true` por
// defecto: todos los flags están en `false` salvo activación manual puntual.
//
// Uso típico:
// import { DEV_AUTO_LOGIN_MOCK } from '../config/devConfig';
// if (DEV_AUTO_LOGIN_MOCK && !user) { setUser({ ...mockUser }); }
//
// El control se mantiene en código (no en .env) para que cualquier cambio
// pase por revisión de PR antes de llegar a main.
// ============================================================================

/**
 * Si está en `true`, el `GateNavigator` hará auto-login con un usuario mock
 * NovaRift#EUW al arrancar la app cuando no haya sesión activa, saltándose la
 * pantalla de Login. Útil sólo para grabar demos internas o iterar UI sin
 * teclear el formulario de login cada recarga. Para uso en demos públicas
 * mejor usar el botón " Modo Demo · NovaRift#EUW" del LoginScreen.
 *
 * Por defecto `false` — la app respeta el flujo normal Login → AppTabs.
 */
export const DEV_AUTO_LOGIN_MOCK = false;

/**
 * Usuario mock que se inyecta cuando `DEV_AUTO_LOGIN_MOCK === true`. Coincide
 * con el shape que produce `handleMockMode` en LoginScreen.
 */
export const DEV_MOCK_USER = {
  id:             'mock-001',
  username:       'NovaRift',
  tag:            'EUW',
  mock:           true,
  setup_complete: true,
  faction:        'ZAUN',
};
