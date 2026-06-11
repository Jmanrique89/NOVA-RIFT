// useConnectionStatus — Nielsen H1: Visibilidad del estado del sistema
// Sin dependencias nativas: @react-native-community/netinfo NO está instalado
// y un require() de un módulo no resoluble revienta en Hermes ANTES de que el
// try/catch pueda capturarlo (Metro lo transforma en un id de dependencia
// inexistente → "Requiring unknown module undefined"). Estrategia por plataforma:
//   Web    → navigator.onLine + eventos online/offline del navegador.
//   Nativo → asumimos 'online' (mismo fallback graceful que ya teníamos
//            cuando NetInfo no estaba disponible).
import { useState, useEffect } from 'react';
import { Platform } from 'react-native';

export function useConnectionStatus() {
  const [status, setStatus] = useState('online'); // 'online' | 'syncing' | 'offline'

  useEffect(() => {
    // Solo web tiene una señal de conectividad sin dependencias nativas.
    if (Platform.OS !== 'web' || typeof window === 'undefined' || !window.addEventListener) {
      return;
    }
    const update = () => {
      const online = typeof navigator !== 'undefined' && 'onLine' in navigator
        ? navigator.onLine
        : true;
      setStatus(online ? 'online' : 'offline');
    };
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  return status;
}
