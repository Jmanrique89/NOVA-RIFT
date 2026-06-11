// ============================================================================
// riotApi — wrapper sobre el endpoint /api/v1/riot/summoner-summary
// ----------------------------------------------------------------------------
// El backend expone un proxy unificado a Riot que combina Account V1 +
// Summoner V4 + League V4 + Match V5 en un solo SummonerSummary. Este
// módulo centraliza la llamada para que cualquier pantalla que necesite
// "buscar jugador" la use de forma consistente.
//
// Estrategia de fallback:
// Por defecto pasamos `allowMock=true` → el backend devuelve un
// SummonerSummary mock si la key falla, y el frontend lo pinta con
// un badge DEMO.
// Si el endpoint devuelve 404 (summoner no existe), elevamos un error
// para que la UI muestre "No hemos encontrado a {riotId}".
// Si hay error de red (timeout / sin servidor), devolvemos un mock
// local construido en cliente para no romper la UI.
// ============================================================================
import { API_BASE_URL } from '../config/apiConfig';

const DEFAULT_REGION = 'euw1';
const DEFAULT_TIMEOUT_MS = 8000;

/**
 * Busca el resumen de un summoner por riotId ("Faker#KR1").
 *
 * @param {string} riotId
 * @param {Object} [opts]
 * @param {string} [opts.region='euw1']
 * @param {boolean} [opts.allowMock=true] pasar al backend para activar fallback server-side
 * @param {number} [opts.timeoutMs=8000]
 * @returns {Promise<SummonerSummary>}
 *
 * @typedef {Object} SummonerSummary
 * @property {string} riotId
 * @property {string} gameName
 * @property {string} tagLine
 * @property {string} region
 * @property {string} puuid
 * @property {string} summonerName
 * @property {number} summonerLevel
 * @property {number} profileIconId
 * @property {RankedEntry} soloRanked
 * @property {RankedEntry} flexRanked
 * @property {MatchSummary[]} recentMatches
 * @property {boolean} mock
 */
export async function fetchSummonerSummary(riotId, opts = {}) {
  const {
    region = DEFAULT_REGION,
    allowMock = true,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  } = opts;

  if (!riotId || !riotId.includes('#')) {
    throw new RiotApiError('INVALID_RIOT_ID', "Esperado formato 'GameName#TAG'.");
  }

  const url = `${API_BASE_URL}/riot/summoner-summary`
    + `?riotId=${encodeURIComponent(riotId)}`
    + `&region=${encodeURIComponent(region)}`
    + `&allowMock=${allowMock}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, { signal: controller.signal });

    if (res.status === 404) {
      const body = await safeJson(res);
      throw new RiotApiError(
        'NOT_FOUND',
        body?.message || `Summoner '${riotId}' no encontrado.`
      );
    }
    if (!res.ok) {
      const body = await safeJson(res);
      throw new RiotApiError(
        body?.error || 'UPSTREAM_ERROR',
        body?.message || `Backend devolvió ${res.status}`
      );
    }

    return await res.json();
  } catch (err) {
    if (err instanceof RiotApiError) throw err;
    // Network timeout / fallo de red (servidor caído, sin internet, CORS,
    // host inalcanzable desde el móvil) → fallback local para no bloquear UI.
    // Dejamos rastro del motivo real: sin esto, el fallback mock disfraza el
    // problema y la UI muestra "Datos de Riot no disponibles" sin pista alguna.
    const reason = err?.name === 'AbortError' ? `timeout tras ${timeoutMs}ms` : (err?.message || 'error de red');
    console.warn(`[riotApi] fetch a ${url} falló (${reason}) → usando mock local. Comprueba que el backend es alcanzable desde este dispositivo.`);
    return buildLocalMock(riotId, region);
  } finally {
    clearTimeout(timer);
  }
}

/** Error tipado para que la UI distinga 404 de network issues. */
export class RiotApiError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'RiotApiError';
    this.code = code; // INVALID_RIOT_ID | NOT_FOUND | UNAUTHORIZED | ...
  }
}

async function safeJson(res) {
  try { return await res.json(); }
  catch { return null; }
}

/**
 * Construye un SummonerSummary mock cuando el backend está caído / sin red.
 * Igual shape que el server-side `SummonerSummary.mockFallback`.
 */
function buildLocalMock(riotId, region) {
  const [gameName, tagLine = ''] = riotId.split('#', 2);
  return {
    riotId,
    gameName,
    tagLine,
    region: (region || 'euw1').toUpperCase(),
    puuid: `LOCAL_MOCK_${gameName}`,
    summonerName: gameName,
    summonerLevel: 30,
    profileIconId: 4644,
    soloRanked: unranked(),
    flexRanked: unranked(),
    recentMatches: [],
    mock: true,
    _localMock: true, // marca extra para UI: "no se pudo contactar el server"
  };
}

function unranked() {
  return {
    queueType: 'UNRANKED', tier: 'UNRANKED', division: '',
    leaguePoints: 0, wins: 0, losses: 0,
  };
}

/**
 * Helper para etiquetar tier+division+LP como hace el backend.
 * { tier: 'GOLD', division: 'II', leaguePoints: 47 } → "Gold II · 47 LP"
 */
export function rankedLabel(entry) {
  if (!entry || entry.tier === 'UNRANKED') return 'Unranked';
  const tierCap = entry.tier.charAt(0) + entry.tier.slice(1).toLowerCase();
  if (!entry.division) return `${tierCap} · ${entry.leaguePoints} LP`;
  return `${tierCap} ${entry.division} · ${entry.leaguePoints} LP`;
}

/** Winrate como porcentaje 0-100 desde wins/losses. */
export function rankedWinrate(entry) {
  if (!entry) return 0;
  const total = (entry.wins || 0) + (entry.losses || 0);
  if (total === 0) return 0;
  return Math.round((entry.wins * 100) / total);
}
