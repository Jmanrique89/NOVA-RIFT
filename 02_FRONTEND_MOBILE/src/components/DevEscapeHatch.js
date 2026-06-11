// ============================================================================
// DevEscapeHatch — botón flotante de emergencia visible en TODAS las
// pantallas (Login, Faction, RoleQuiz, etc.).
// ----------------------------------------------------------------------------
// Cuando la app se queda colgada en una pantalla intermedia del onboarding
// (user con setup_complete:false cacheado), el usuario no puede llegar al Login
// para pulsar el [DEV] LIMPIAR SESIÓN normal. Este componente está siempre
// disponible en la esquina superior derecha — un toque vacía AsyncStorage
// y devuelve la app al Login.
//
// Uso (en cualquier screen):
// import DevEscapeHatch from '../../components/DevEscapeHatch';
// <View style={...}>
// <DevEscapeHatch />
// ... resto del contenido ...
// </View>
// ============================================================================
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useUser } from '../context/UserContext';

export default function DevEscapeHatch() {
  const { setUser } = useUser();
  const [busy, setBusy] = useState(false);

  const handleEscape = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await AsyncStorage.clear().catch(async () => {
        await Promise.all([
          AsyncStorage.removeItem('novarift_user'),
          AsyncStorage.removeItem('novarift_jwt'),
          AsyncStorage.removeItem('novarift_just_logged_in'),
        ]).catch(() => {});
      });
      await setUser(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <TouchableOpacity
      style={styles.btn}
      onPress={handleEscape}
      activeOpacity={0.7}
    >
      <Text style={styles.text}>{busy ? '…' : '⤺ RESET'}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    position: 'absolute',
    top: Platform.OS === 'web' ? 12 : 44,
    right: 12,
    zIndex: 9999,
    paddingVertical: 5, paddingHorizontal: 10,
    borderRadius: 4,
    borderWidth: 1, borderColor: 'rgba(231,76,60,0.45)',
    backgroundColor: 'rgba(7,7,13,0.85)',
  },
  text: {
    color: 'rgba(231,76,60,0.85)',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
});
