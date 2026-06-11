import axios from 'axios';
import { API_BASE_URL } from '../config/apiConfig';

// Se utiliza la URL dinámica gestionada en apiConfig
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para logs y manejo de errores global
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const msg = error.response?.data?.message || error.message || 'Error de red';
    console.error('[NOVA RIFT API ERROR]', msg);
    return Promise.reject(new Error(msg));
  }
);

/**
 * POST /api/v1/live/start
 * Inicia sesión live con el summonerName e imageHash (screenshot del juego)
 */
export const startLiveSession = async (summonerName, imageHash = 'dummy-hash') => {
  const response = await apiClient.post('/api/v1/live/start', {
    summonerName,
    imageHash,
  });
  return response.data;
};

/**
 * GET /api/v1/forge/analytics/{riotId}
 * Obtiene análisis de progresión para un riotId dado
 */
export const getForgeAnalytics = async (riotId) => {
  const response = await apiClient.get(`/api/v1/forge/analytics/${encodeURIComponent(riotId)}`);
  return response.data;
};

/**
 * GET /api/v1/identity/summoner/{summonerName}
 * Busca datos del invocador (perfil)
 */
export const getSummonerProfile = async (summonerName) => {
  const response = await apiClient.get(`/api/v1/identity/summoner/${encodeURIComponent(summonerName)}`);
  return response.data;
};

export default apiClient;
