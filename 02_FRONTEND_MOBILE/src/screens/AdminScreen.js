// ============================================================================
// AdminScreen — Panel de administración NOVA RIFT (conectado al backend real)
// ----------------------------------------------------------------------------
// Endpoints consumidos:
// GET /api/v1/admin/stats → KPIs del sistema
// GET /api/v1/admin/users → lista de usuarios
// DELETE /api/v1/admin/users/{id} → eliminar usuario
// PATCH /api/v1/admin/users/{id}/ban → toggle ban
// ============================================================================
import React, { useContext, useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Dimensions, ActivityIndicator, Alert, RefreshControl, TextInput, Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { RiotContext } from '../context/RiotContext';
import { useTheme } from '../context/ThemeContext';
import { useUser } from '../context/UserContext';
import { API_BASE_URL } from '../config/apiConfig';
import NovaBackground from '../components/NovaBackground';
// T3 — mostrar la identidad neutra (Esmeralda/Dorada/…) y nunca la clave interna.
import { FACTIONS } from '../theme/theme';

const { width: SW } = Dimensions.get('window');

const FACTION_COLOR = {
  ZAUN: '#7B76DD', NOXUS: '#c0392b', IONIA: '#FFD700', DEMACIA: '#3b82f6',
};

// ─── Helpers de API ─────────────────────────────────────────────────────────
async function getToken() {
  return AsyncStorage.getItem('novarift_jwt');
}

async function adminFetch(path, options = {}) {
  const token = await getToken();
  if (!token) throw new Error('No autenticado');
  const res = await fetch(`${API_BASE_URL}/admin${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });
  if (!res.ok) {
    let msg = `Error ${res.status}`;
    try { const j = await res.json(); msg = j?.message || j?.error || msg; } catch (_) {}
    throw new Error(msg);
  }
  if (res.status === 204) return null;
  return res.json();
}

// Confirmación CROSS-PLATFORM. `Alert.alert` con botones NO dispara los
// callbacks `onPress` en React Native Web (la web no renderiza esos botones),
// así que en el navegador el botón ELIMINAR/BAN no hacía NADA. Unificamos a una
// promesa<boolean>: en web usamos window.confirm (bloqueante, devuelve el sí/no)
// y en nativo el Alert.alert de siempre con Cancelar/confirmar.
function confirmAction({ title, message, confirmLabel = 'OK', destructive = false }) {
  if (Platform.OS === 'web') {
    const ok = (typeof window !== 'undefined' && typeof window.confirm === 'function')
      ? window.confirm(`${title}\n\n${message}`)
      : true;
    return Promise.resolve(ok);
  }
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
      { text: confirmLabel, style: destructive ? 'destructive' : 'default', onPress: () => resolve(true) },
    ]);
  });
}

// ─── Componente principal ───────────────────────────────────────────────────
export default function AdminScreen() {
  const { theme } = useContext(RiotContext);
  const { colors: c, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { user }  = useUser();

  const [selectedTab, setSelectedTab] = useState('usuarios');
  const [stats, setStats]             = useState(null);
  const [users, setUsers]             = useState([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState('');
  const [refreshing, setRefreshing]   = useState(false);

  // ─── Riot API Key ─────────────────────────────────────────────────────
  const [riotKeyInput, setRiotKeyInput]   = useState('');
  const [riotKeyStatus, setRiotKeyStatus] = useState(null);  // { valid, key, source, mode }
  const [riotKeyLoading, setRiotKeyLoading] = useState(false);
  // Resultado de POST /test (validación REAL contra Riot platform-data).
  // Shape: { valid:boolean, httpStatus:number, error?:string, mode?:string, source?:string }
  const [riotKeyTest, setRiotKeyTest]     = useState(null);
  const [riotKeyTesting, setRiotKeyTesting] = useState(false);
  const [healthStatus, setHealthStatus]   = useState(null);  // datos reales de /actuator/health

  // Dispara la verificación real contra Riot (POST /test). Se llama desde:
  // el botón "PROBAR CLAVE" del panel.
  // automáticamente tras un PATCH exitoso, para dar feedback honesto.
  const runRiotKeyTest = useCallback(async () => {
    setRiotKeyTesting(true);
    try {
      const result = await adminFetch('/config/riot-key/test', { method: 'POST' });
      setRiotKeyTest(result);
      return result;
    } catch (e) {
      const fallback = { valid: false, httpStatus: 0, error: e.message || 'Error desconocido' };
      setRiotKeyTest(fallback);
      return fallback;
    } finally {
      setRiotKeyTesting(false);
    }
  }, []);

  // ─── Carga de datos ───────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    try {
      setError('');
      const [statsData, usersData] = await Promise.all([
        adminFetch('/stats'),
        adminFetch('/users'),
      ]);
      setStats(statsData);
      setUsers(usersData || []);
    } catch (e) {
      setError(e.message || 'Error al cargar datos');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    adminFetch('/config/riot-key').then(setRiotKeyStatus).catch(() => {});
    // Health real del backend — muestra estado real de BD y componentes
    fetch(`${API_BASE_URL.replace('/api/v1', '')}/actuator/health`)
      .then(r => r.json())
      .then(setHealthStatus)
      .catch(() => setHealthStatus({ status: 'UNKNOWN' }));
  }, [loadData]);

  const onRefresh = () => { setRefreshing(true); loadData(); };

  // ─── Acciones sobre usuarios ──────────────────────────────────────────
  const handleToggleBan = async (userId, username, isBanned) => {
    const action = isBanned ? 'desbanear' : 'banear';
    const ok = await confirmAction({
      title: `¿${action.charAt(0).toUpperCase() + action.slice(1)} usuario?`,
      message: `¿Seguro que quieres ${action} a ${username}?`,
      confirmLabel: action.toUpperCase(),
      destructive: !isBanned,
    });
    if (!ok) return;
    try {
      const updated = await adminFetch(`/users/${userId}/ban`, { method: 'PATCH' });
      setUsers(prev => prev.map(u => u.id === userId ? updated : u));
    } catch (e) {
      Alert.alert('Error', e.message);
    }
  };

  const handleDelete = async (userId, username) => {
    const ok = await confirmAction({
      title: 'Eliminar usuario',
      message: `¿Eliminar definitivamente a ${username}? Esta acción no se puede deshacer.`,
      confirmLabel: 'ELIMINAR',
      destructive: true,
    });
    if (!ok) return;
    try {
      await adminFetch(`/users/${userId}`, { method: 'DELETE' });
      setUsers(prev => prev.filter(u => u.id !== userId));
      // Recargar stats
      const newStats = await adminFetch('/stats');
      setStats(newStats);
    } catch (e) {
      Alert.alert('Error', e.message);
    }
  };

  // ─── KPIs ─────────────────────────────────────────────────────────────
  const kpis = stats ? [
    { label: 'USUARIOS',     value: stats.totalUsers,      color: theme.primary },
    { label: 'ACTIVOS',      value: stats.activeUsers,     color: '#7B76DD' },
    { label: 'ADMINS',       value: stats.adminCount,      color: '#FFD700' },
    { label: 'NUEVOS (7D)',  value: stats.newUsersLast7Days, color: '#7B76DD' },
  ] : [];

  // ─── Loading / Error ──────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.container}>
        {isDark && <NovaBackground />}
        <View style={styles.centered}>
          <ActivityIndicator color="#ff4444" size="large" />
          <Text style={styles.loadingText}>Cargando panel de administración...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {isDark && <NovaBackground />}
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#ff4444" />
        }
      >
        {/* ─── Header ──────────────────────────────────────────────────── */}
        <View style={[styles.header, { borderBottomColor: '#ff444444' }]}>
          <View style={styles.headerLeft}>
            <View style={styles.adminBadge}>
              <Text style={styles.adminBadgeText}>ADMIN</Text>
            </View>
            <Text style={styles.title}>PANEL DE CONTROL</Text>
          </View>
          <Text style={styles.subtitle}>NOVA RIFT · {user?.username || 'Sistema'}</Text>
        </View>

        {/* ─── Error banner ────────────────────────────────────────────── */}
        {error ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity onPress={loadData} style={styles.retryBtn}>
              <Text style={styles.retryText}>REINTENTAR</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* ─── KPIs ────────────────────────────────────────────────────── */}
        {stats && (
          <View style={styles.kpiRow}>
            {kpis.map(kpi => (
              <View key={kpi.label} style={[styles.kpiCard, { borderColor: kpi.color + '44' }]}>
                <Text style={[styles.kpiValue, { color: kpi.color }]}>{kpi.value}</Text>
                <Text style={styles.kpiLabel}>{kpi.label}</Text>
              </View>
            ))}
          </View>
        )}

        {/* ─── Tabs ────────────────────────────────────────────────────── */}
        <View style={styles.tabRow}>
          {['usuarios', 'sistema', 'config'].map(tab => (
            <TouchableOpacity
              key={tab}
              onPress={() => setSelectedTab(tab)}
              style={[
                styles.tab,
                selectedTab === tab && { borderBottomColor: '#ff4444', borderBottomWidth: 2 },
              ]}
            >
              <Text style={[
                styles.tabText,
                selectedTab === tab && { color: '#ff4444' },
              ]}>
                {tab.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ─── TAB · USUARIOS ──────────────────────────────────────────── */}
        {selectedTab === 'usuarios' && (
          <View>
            <Text style={styles.sectionLabel}>USUARIOS REGISTRADOS ({users.length})</Text>
            {users.length === 0 && !error ? (
              <Text style={styles.emptyText}>No hay usuarios registrados</Text>
            ) : null}
            {users.map(u => (
              <View
                key={u.id}
                style={[
                  styles.userRow,
                  { borderLeftColor: FACTION_COLOR[u.faction] || '#444' },
                  u.banned && styles.userRowBanned,
                ]}
              >
                <View style={[styles.statusDot, { backgroundColor: u.banned ? '#ff4444' : '#7B76DD' }]} />
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={styles.userUsername}>{u.username}</Text>
                    {u.role === 'ADMIN' && (
                      <View style={styles.roleBadge}>
                        <Text style={styles.roleBadgeText}>ADMIN</Text>
                      </View>
                    )}
                    {u.banned && (
                      <View style={[styles.roleBadge, { backgroundColor: '#ff4444' }]}>
                        <Text style={styles.roleBadgeText}>BAN</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.userMeta}>
                    {u.email}
                    {u.faction ? ` · ${FACTIONS[u.faction]?.identity || u.faction}` : ''}
                    {u.setupComplete ? '' : ' · Sin onboarding'}
                  </Text>
                  <Text style={styles.userDates}>
                    Registro: {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}
                    {u.lastLoginAt ? ` · Último login: ${formatRelativeDate(u.lastLoginAt)}` : ''}
                  </Text>
                </View>

                {/* Acciones */}
                <View style={styles.actionCol}>
                  <TouchableOpacity
                    style={[styles.actionBtn, u.banned ? styles.unbanBtn : styles.banBtn]}
                    onPress={() => handleToggleBan(u.id, u.username, u.banned)}
                  >
                    <Text style={styles.actionBtnText}>{u.banned ? 'UNBAN' : 'BAN'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.deleteBtn]}
                    onPress={() => handleDelete(u.id, u.username)}
                  >
                    <Text style={styles.actionBtnText}>DEL</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* ─── TAB · SISTEMA ───────────────────────────────────────────── */}
        {selectedTab === 'sistema' && stats && (
          <View>
            <Text style={styles.sectionLabel}>ESTADO DEL SISTEMA</Text>

            <View style={[styles.infoBox, { borderColor: theme.primary + '44' }]}>
              <Text style={[styles.infoLabel, { color: theme.primary }]}>RESUMEN</Text>
              <Text style={styles.infoRow}>
                Total usuarios: <Text style={{ color: '#7B76DD' }}>{stats.totalUsers}</Text>
              </Text>
              <Text style={styles.infoRow}>
                Usuarios activos (no baneados): <Text style={{ color: '#7B76DD' }}>{stats.activeUsers}</Text>
              </Text>
              <Text style={styles.infoRow}>
                Administradores: <Text style={{ color: '#FFD700' }}>{stats.adminCount}</Text>
              </Text>
              <Text style={styles.infoRow}>
                Nuevos últimos 7 días: <Text style={{ color: '#7B76DD' }}>{stats.newUsersLast7Days}</Text>
              </Text>
            </View>

            <View style={[styles.infoBox, { borderColor: '#7B76DD44', marginTop: 12 }]}>
              <Text style={[styles.infoLabel, { color: '#7B76DD' }]}>CONEXIÓN</Text>
              <Text style={styles.infoRow}>
                Backend:{' '}
                <Text style={{ color: healthStatus?.status === 'UP' ? '#4CAF50' : '#FF5252' }}>
                  {healthStatus?.status ?? 'CARGANDO...'}
                </Text>
              </Text>
              <Text style={styles.infoRow}>
                API Base: <Text style={{ color: c.onSurface(0.5) }}>{API_BASE_URL}</Text>
              </Text>
              <Text style={styles.infoRow}>
                Base de datos:{' '}
                <Text style={{
                  color: healthStatus?.components?.db?.status === 'UP' ? '#4CAF50' : '#FFB300'
                }}>
                  {healthStatus?.components?.db?.status === 'UP'
                    ? `CONECTADA (${healthStatus?.components?.db?.details?.database ?? 'H2'})`
                    : healthStatus?.components?.db?.status ?? '—'}
                </Text>
              </Text>
              <Text style={styles.infoRow}>
                Riot API:{' '}
                <Text style={{ color: riotKeyStatus?.valid ? '#4CAF50' : '#FF5252' }}>
                  {riotKeyStatus?.valid ? `ACTIVA · ${riotKeyStatus.key}` : 'SIN CLAVE VÁLIDA'}
                </Text>
              </Text>
            </View>
          </View>
        )}

        {/* ─── TAB · CONFIG ────────────────────────────────────────────── */}
        {selectedTab === 'config' && (
          <View>
            <Text style={styles.sectionLabel}>CONFIGURACIÓN DEL SISTEMA</Text>

            {/* ── Riot API Key ── */}
            <View style={[styles.infoBox, { borderColor: '#FFD70044' }]}>
              <Text style={[styles.infoLabel, { color: '#FFD700' }]}>🔑 RIOT API KEY</Text>

              {riotKeyStatus && (() => {
                // Estado honesto. Si tenemos resultado del /test (validación
                // contra Riot real), gana sobre el simple isValid() del formato.
                // Verde solo si Riot devuelve 200 (o si estamos en modo MOCK).
                const verified  = riotKeyTest != null;
                const ok        = verified ? riotKeyTest.valid : riotKeyStatus.valid;
                const mode      = riotKeyTest?.mode || riotKeyStatus.mode;
                const isMock    = mode === 'MOCK';
                const httpStatus = riotKeyTest?.httpStatus;
                const errorTxt   = riotKeyTest?.error;

                let statusText;
                if (isMock) {
                  statusText = 'MODO MOCK · la clave no se valida';
                } else if (verified && ok) {
                  statusText = 'ACTIVA · verificada contra Riot';
                } else if (verified && !ok) {
                  statusText = `CADUCADA O INVÁLIDA (HTTP ${httpStatus ?? '?'}) — regenera en developer.riotgames.com`;
                } else {
                  statusText = ok ? 'Formato válido (sin verificar)' : 'Inválida / Expirada';
                }

                return (
                  <View style={{ marginBottom: 10 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                      <View style={{
                        width: 8, height: 8, borderRadius: 4,
                        backgroundColor: ok ? '#22c55e' : '#ef4444',
                        marginRight: 6,
                      }} />
                      <Text style={[styles.infoRow, { marginBottom: 0, flexShrink: 1 }]}>
                        {statusText}
                      </Text>
                    </View>
                    <Text style={{ color: c.onSurface(0.40), fontSize: 11, marginLeft: 14 }}>
                      {riotKeyStatus.key}
                      {riotKeyStatus.source ? `  ·  origen: ${riotKeyStatus.source}` : ''}
                    </Text>
                    {!isMock && verified && !ok && errorTxt && (
                      <Text style={{ color: '#ef4444', fontSize: 10, marginLeft: 14, marginTop: 4 }}>
                        {errorTxt}
                      </Text>
                    )}
                  </View>
                );
              })()}

              {/* Botón PROBAR CLAVE: dispara la verificación real on-demand */}
              <TouchableOpacity
                style={{
                  backgroundColor: riotKeyTesting ? '#555' : 'rgba(255,215,0,0.18)',
                  borderRadius: 6,
                  padding: 8,
                  alignItems: 'center',
                  marginBottom: 10,
                  borderWidth: 1,
                  borderColor: 'rgba(255,215,0,0.4)',
                  opacity: riotKeyTesting ? 0.6 : 1,
                }}
                disabled={riotKeyTesting}
                onPress={runRiotKeyTest}
              >
                <Text style={{ color: '#FFD700', fontSize: 11, fontWeight: '900', letterSpacing: 1 }}>
                  {riotKeyTesting ? 'PROBANDO...' : 'PROBAR CLAVE'}
                </Text>
              </TouchableOpacity>

              <Text style={[styles.infoRow, { marginBottom: 6, fontSize: 11 }]}>
                Las claves de desarrollo expiran cada 24h.{'\n'}
                Pégala aquí y pulsa ACTUALIZAR — sin reiniciar el servidor.
              </Text>

              <TextInput
                style={{
                  backgroundColor: c.onSurface(0.06),
                  borderRadius: 6,
                  borderWidth: 1,
                  borderColor: 'rgba(255,215,0,0.3)',
                  color: c.textPrimary,
                  padding: 10,
                  fontFamily: 'monospace',
                  fontSize: 12,
                  marginBottom: 10,
                }}
                placeholder="RGAPI-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                placeholderTextColor={c.onSurface(0.25)}
                value={riotKeyInput}
                onChangeText={setRiotKeyInput}
                // BUG-CRITICO — Riot keys son case-sensitive. autoCapitalize="characters"
                // convertía los chars hex en minúscula (a-f) a mayúscula (A-F) y el resultado
                // era una clave distinta que Riot rechaza con 401/403. Forzamos "none".
                autoCapitalize="none"
                autoCorrect={false}
                spellCheck={false}
              />

              <TouchableOpacity
                style={{
                  backgroundColor: riotKeyLoading ? '#555' : '#FFD700',
                  borderRadius: 6,
                  padding: 10,
                  alignItems: 'center',
                  opacity: riotKeyLoading ? 0.6 : 1,
                }}
                disabled={riotKeyLoading || !riotKeyInput.trim().startsWith('RGAPI-')}
                onPress={async () => {
                  setRiotKeyLoading(true);
                  try {
                    await adminFetch('/config/riot-key', {
                      method: 'PATCH',
                      body: JSON.stringify({ key: riotKeyInput.trim() }),
                    });
                    // Re-leer status (incluye source actualizado a "panel(BD)")
                    const fresh = await adminFetch('/config/riot-key');
                    setRiotKeyStatus(fresh);
                    setRiotKeyInput('');
                    // Validar automáticamente contra Riot tras el PATCH.
                    // El feedback al usuario refleja si Riot acepta la clave real,
                    // no solo si el formato es RGAPI-*.
                    const verify = await runRiotKeyTest();
                    if (verify?.mode === 'MOCK') {
                      Alert.alert('✅ Clave guardada', 'Modo MOCK activo: la clave se almacena pero no se valida contra Riot.');
                    } else if (verify?.valid) {
                      Alert.alert('✅ Clave verificada', 'Riot acepta la clave (HTTP 200). La búsqueda de jugadores funcionará sin reiniciar.');
                    } else {
                      Alert.alert(
                        '⚠ Clave guardada pero no válida',
                        `Riot devolvió HTTP ${verify?.httpStatus ?? '?'}.\n${verify?.error ?? 'Regenera la clave en developer.riotgames.com'}`
                      );
                    }
                  } catch (e) {
                    Alert.alert('Error', e.message);
                  } finally {
                    setRiotKeyLoading(false);
                  }
                }}
              >
                <Text style={{ color: '#000', fontWeight: 'bold', fontSize: 13 }}>
                  {riotKeyLoading ? 'Actualizando...' : 'ACTUALIZAR CLAVE RIOT'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

// ─── Utilidades ─────────────────────────────────────────────────────────────
function formatRelativeDate(isoString) {
  if (!isoString) return '—';
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now - date;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Ahora';
  if (diffMin < 60) return `Hace ${diffMin}m`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `Hace ${diffH}h`;
  const diffD = Math.floor(diffH / 24);
  if (diffD === 1) return 'Ayer';
  return `Hace ${diffD}d`;
}

// ─── Estilos ────────────────────────────────────────────────────────────────
const makeStyles = (c) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg0 },
  scroll:    { padding: 16, paddingTop: 56 },
  centered:  { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: c.onSurface(0.4), fontSize: 12, marginTop: 12, letterSpacing: 1 },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end',
    paddingBottom: 14, marginBottom: 16, borderBottomWidth: 1,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  adminBadge: {
    backgroundColor: '#ff4444', borderRadius: 4,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  // Texto claro sobre relleno rojo brillante del badge → fijo (no se invierte).
  adminBadgeText: { color: '#E8E4FF', fontSize: 10, fontWeight: '900', letterSpacing: 1.5 },
  title:    { color: c.textPrimary, fontSize: 18, fontWeight: '900', letterSpacing: 1 },
  subtitle: { color: c.onSurface(0.3), fontSize: 10, letterSpacing: 0.8 },

  errorBanner: {
    backgroundColor: 'rgba(255,68,68,0.15)', borderWidth: 1, borderColor: '#ff444466',
    borderRadius: 8, padding: 14, marginBottom: 16, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'space-between',
  },
  errorText: { color: '#ff6666', fontSize: 12, flex: 1 },
  retryBtn: {
    backgroundColor: '#ff4444', borderRadius: 4, paddingHorizontal: 12, paddingVertical: 6, marginLeft: 10,
  },
  // Texto blanco sobre relleno rojo brillante → fijo.
  retryText: { color: '#fff', fontSize: 10, fontWeight: '900', letterSpacing: 1 },

  kpiRow: {
    flexDirection: 'row', gap: 8, marginBottom: 18, flexWrap: 'wrap',
  },
  kpiCard: {
    flex: 1, minWidth: (SW - 56) / 4,
    backgroundColor: c.surface,
    borderWidth: 1, borderRadius: 8,
    padding: 10, alignItems: 'center',
  },
  kpiValue: { fontSize: 22, fontWeight: '900' },
  kpiLabel: { color: c.onSurface(0.4), fontSize: 8, letterSpacing: 0.8, marginTop: 2 },

  tabRow: {
    flexDirection: 'row',
    borderBottomWidth: 1, borderBottomColor: c.onSurface(0.08),
    marginBottom: 16,
  },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center' },
  tabText: { color: c.onSurface(0.35), fontSize: 11, fontWeight: '700', letterSpacing: 1 },

  sectionLabel: {
    color: c.onSurface(0.4),
    fontSize: 10, letterSpacing: 1.2,
    marginBottom: 10, fontWeight: '700',
  },
  emptyText: { color: c.onSurface(0.3), fontSize: 12, textAlign: 'center', marginTop: 20 },

  userRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: c.surface,
    borderRadius: 8, padding: 12,
    marginBottom: 6, borderLeftWidth: 3,
  },
  userRowBanned: {
    backgroundColor: 'rgba(255,68,68,0.06)',
    borderLeftColor: '#ff4444',
  },
  statusDot:    { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  userUsername:  { color: c.textPrimary, fontSize: 13, fontWeight: '700' },
  userMeta:     { color: c.onSurface(0.4), fontSize: 10, marginTop: 2 },
  userDates:    { color: c.onSurface(0.25), fontSize: 9, marginTop: 2 },

  roleBadge: {
    backgroundColor: '#FFD700', borderRadius: 3,
    paddingHorizontal: 5, paddingVertical: 1,
  },
  // Texto oscuro sobre relleno oro brillante → fijo.
  roleBadgeText: { color: '#000', fontSize: 8, fontWeight: '900', letterSpacing: 0.5 },

  actionCol: { flexDirection: 'column', gap: 4, alignItems: 'flex-end' },
  actionBtn: {
    borderRadius: 4, paddingHorizontal: 8, paddingVertical: 4, minWidth: 42, alignItems: 'center',
  },
  banBtn:    { backgroundColor: 'rgba(255,68,68,0.2)', borderWidth: 1, borderColor: '#ff444466' },
  unbanBtn:  { backgroundColor: 'rgba(123,118,221,0.2)', borderWidth: 1, borderColor: '#7B76DD66' },
  deleteBtn: { backgroundColor: 'rgba(255,68,68,0.1)', borderWidth: 1, borderColor: '#ff444433' },
  actionBtnText: { color: c.textPrimary, fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },

  infoBox: {
    borderWidth: 1, borderRadius: 8, padding: 14,
  },
  infoLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1, marginBottom: 8 },
  infoRow:   { color: c.onSurface(0.5), fontSize: 12, marginBottom: 4 },
});
