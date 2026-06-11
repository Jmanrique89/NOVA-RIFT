// Configuración centralizada de la API para NOVA RIFT
// El host del backend se resuelve por plataforma para que funcione SIN tocar
// nada en web, emulador Android y móvil físico (Expo Go) por igual.

import { Platform } from 'react-native';
import Constants from 'expo-constants';

const NETWORK_CONFIG = {
  // Host de último recurso para el emulador Android (alias del loopback del PC).
  emulatorHost: '10.0.2.2',
  port: '8080',
  mode: 'REAL',
};

// ─── Resolución del host del backend ────────────────────────────────────────
// El host correcto depende de la plataforma y no se puede asumir uno solo:
// En web NO se puede reescribir localhost→10.0.2.2 (rompería el navegador).
// El móvil FÍSICO no puede usar 10.0.2.2 (ese alias solo vale para el
// emulador Android). Fiar la IP de LAN al .env es frágil: al cambiar por
// DHCP, la app dejaba de contactar el backend, caía al mock y mostraba
// "Datos de Riot no disponibles" aunque el backend respondiera bien.
//
// Estrategia de resolución (de mayor a menor prioridad):
// Web → hostname del navegador (localhost / 127.0.0.1 / IP). Es el
// más fiable: la página y el backend comparten host en dev y
// además mantiene el Origin alineado con CORS.
// EXPO_PUBLIC_API_HOST (.env) → override explícito para nativo (útil si la
// autodetección no está disponible o se quiere forzar una IP).
// Nativo → IP de LAN del servidor de Metro (Expo), autodetectada con
// expo-constants. Sirve tanto para móvil físico (Expo Go) como
// para el emulador, que también alcanza la IP de LAN del PC.
// Fallback → 10.0.2.2 en Android (emulador), localhost en el resto.

/**
 * Extrae la IP del servidor de desarrollo (Metro) desde expo-constants.
 * `hostUri` / `debuggerHost` vienen como "192.168.1.38:8081"; nos quedamos con
 * la parte del host. Devuelve '' si no hay un host de LAN utilizable.
 */
const getDevServerHost = () => {
  const hostUri =
    Constants?.expoConfig?.hostUri ||
    Constants?.expoGoConfig?.debuggerHost ||
    Constants?.manifest2?.extra?.expoClient?.hostUri ||
    Constants?.manifest?.debuggerHost ||
    '';
  const host = String(hostUri).split(':')[0].trim();
  if (!host || host === 'localhost' || host === '127.0.0.1') return '';
  return host;
};

const getApiHost = () => {
  // Web: el navegador siempre habla con el host desde el que se sirvió la
  // página. Robusto frente a cambios de IP y limpio para CORS.
  if (Platform.OS === 'web'
      && typeof window !== 'undefined'
      && window.location && window.location.hostname) {
    return window.location.hostname;
  }

  // Override explícito por .env (sólo aplica a nativo; en web ya retornamos).
  const envHost = (typeof process !== 'undefined' && process.env && process.env.EXPO_PUBLIC_API_HOST)
    ? process.env.EXPO_PUBLIC_API_HOST.trim()
    : '';
  if (envHost) return envHost;

  // Nativo: IP de LAN del servidor de Metro (móvil físico y emulador).
  const devHost = getDevServerHost();
  if (devHost) return devHost;

  // Sin IP de dev server (build de producción o debuggerHost no disponible).
  return Platform.OS === 'android' ? NETWORK_CONFIG.emulatorHost : 'localhost';
};

export const API_BASE_URL = `http://${getApiHost()}:${NETWORK_CONFIG.port}/api/v1`;
export const APP_RUNTIME_MODE = NETWORK_CONFIG.mode;

export const getRuntimeModeBadge = () => {
  if (APP_RUNTIME_MODE === 'MOCK') {
    return 'Modo operativo: MOCK (fallback estable)';
  }
  return 'Modo operativo: REAL';
};

export const getServiceUnavailableMessage = () => {
  if (APP_RUNTIME_MODE === 'MOCK') {
    return 'Servicio no disponible temporalmente. El modo MOCK mantiene la demo operativa.';
  }
  return 'Servicio no disponible temporalmente. Reintenta cuando el backend REAL este activo.';
};

export const getNetworkUnavailableMessage = () => {
  if (APP_RUNTIME_MODE === 'MOCK') {
    return 'No se pudo contactar con el backend. Verifica red local; el flujo MOCK debe mantener continuidad.';
  }
  return 'No se pudo contactar con el backend REAL. Comprueba red local y servidor.';
};
