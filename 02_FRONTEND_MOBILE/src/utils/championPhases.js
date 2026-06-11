// ============================================================================
// championPhases.js — curva de poder por campeón + ranking estimado
// ----------------------------------------------------------------------------
// Alimenta el modal de campeón (ChampionDetailModal) con dos cosas:
//
// 1) CURVA EARLY/MID/LATE: consejos de fase ESPECÍFICOS del campeón (no los
// genéricos). Fuente: tabla curada CURVE_OVERRIDES para los picks canónicos
// + heurística por playstyle del catálogo para el resto. Si el campeón
// escala mal o bien se avisa EXPLÍCITAMENTE en la fase correspondiente.
// 2) RANKING ESTIMADO (mock honesto): "Eres el {champ} nº{N} de EUW", con N
// derivado determinísticamente de las stats (hash de WR+games) y un badge
// "ESTIMADO" en el UI. Cuando haya ladder real de Riot, se sustituye por la
// posición real.
//
// Todo es lógica pura (sin React) — testeable sin mocks.
// ============================================================================

import { CHAMPIONS } from '../data/championsCatalog';
import { CHAMPION_TO_ROLE } from './championImage';

/**
 * Fuerza por fase: 'strong' | 'ok' | 'weak'.
 * Tabla curada de curvas de poder para los campeones más comunes del pool.
 * (Conocimiento LoL estándar — ej. Lucian fuerte early-mid que cae en late,
 * hyper-carries tipo Jinx/Vayne/Yi débiles early que escalan al infinito.)
 */
export const CURVE_OVERRIDES = {
  // ADC
  Lucian:   { early: 'strong', mid: 'strong', late: 'weak' },
  Draven:   { early: 'strong', mid: 'strong', late: 'weak' },
  Jinx:     { early: 'weak',   mid: 'ok',     late: 'strong' },
  Vayne:    { early: 'weak',   mid: 'ok',     late: 'strong' },
  Caitlyn:  { early: 'strong', mid: 'weak',   late: 'strong' },
  Ashe:     { early: 'ok',     mid: 'strong', late: 'strong' },
  Jhin:     { early: 'ok',     mid: 'strong', late: 'ok' },
  MissFortune: { early: 'ok',  mid: 'strong', late: 'ok' },
  Ezreal:   { early: 'weak',   mid: 'strong', late: 'strong' },
  // TOP
  Garen:    { early: 'ok',     mid: 'strong', late: 'ok' },
  Darius:   { early: 'strong', mid: 'strong', late: 'weak' },
  Fiora:    { early: 'ok',     mid: 'strong', late: 'strong' },
  Jax:      { early: 'weak',   mid: 'ok',     late: 'strong' },
  Riven:    { early: 'strong', mid: 'strong', late: 'ok' },
  Tryndamere: { early: 'weak', mid: 'ok',     late: 'strong' },
  Malphite: { early: 'weak',   mid: 'ok',     late: 'strong' },
  // JUNGLE
  LeeSin:   { early: 'strong', mid: 'ok',     late: 'weak' },
  MasterYi: { early: 'weak',   mid: 'ok',     late: 'strong' },
  Vi:       { early: 'ok',     mid: 'strong', late: 'ok' },
  Amumu:    { early: 'weak',   mid: 'strong', late: 'strong' },
  // MID
  Zed:      { early: 'ok',     mid: 'strong', late: 'ok' },
  Yasuo:    { early: 'weak',   mid: 'ok',     late: 'strong' },
  Ahri:     { early: 'ok',     mid: 'strong', late: 'ok' },
  Lux:      { early: 'ok',     mid: 'strong', late: 'ok' },
  Orianna:  { early: 'weak',   mid: 'ok',     late: 'strong' },
  Katarina: { early: 'weak',   mid: 'strong', late: 'strong' },
  // SUPPORT
  Thresh:   { early: 'strong', mid: 'strong', late: 'ok' },
  Leona:    { early: 'strong', mid: 'strong', late: 'weak' },
  Morgana:  { early: 'ok',     mid: 'ok',     late: 'ok' },
  Nautilus: { early: 'strong', mid: 'ok',     late: 'ok' },
  Janna:    { early: 'weak',   mid: 'ok',     late: 'strong' },
};

/** Heurística por playstyle del catálogo cuando no hay curva curada. */
function heuristicCurve(championName) {
  const entry = CHAMPIONS.find((c) => c.id === championName);
  const style = entry?.playstyles?.[0];
  switch (style) {
    case 'AGRESIVO':   return { early: 'strong', mid: 'ok', late: 'weak' };
    case 'DOMINANTE':  return { early: 'ok', mid: 'strong', late: 'ok' };
    case 'SUPPORTIVE': return { early: 'ok', mid: 'ok', late: 'strong' };
    case 'TACTICO':
    default:           return { early: 'ok', mid: 'ok', late: 'ok' };
  }
}

/** Curva de poder del campeón: curada si existe, heurística si no. */
export function championCurve(championName) {
  return CURVE_OVERRIDES[championName] || heuristicCurve(championName);
}

// Plantillas de consejo por fase × fuerza. La idea de "curva de poder" es que
// cada campeón es fuerte (strong), normal (ok) o débil (weak) en cada momento
// de la partida; aquí hay una frase para cada combinación. phaseTipsFor mira la
// fuerza del campeón en esa fase (championCurve) y elige la frase correcta.
// {n} se sustituye por el nombre legible del campeón.
const TIPS = {
  early: {
    strong: '{n} domina el early: busca trades desde nivel 2 y castiga cada last-hit del rival.',
    ok:     'Early estable con {n}: gana la lane a base de CS y trades solo con ventaja clara.',
    weak:   '{n} es débil en early: cede terreno, farmea seguro y NO peles antes de tus picos.',
  },
  laning: {
    strong: 'Convierte tu presión: con la lane ganada, pide gank o rota — {n} castiga al que llega tarde.',
    ok:     'Cierra la fase de líneas con prio: empuja la wave antes del primer objetivo.',
    weak:   'Sobrevive la fase de líneas: a {n} le basta llegar entero a sus ítems clave.',
  },
  mid: {
    strong: 'Pico de poder de {n}: fuerza peleas alrededor de Dragón/Heraldo AHORA.',
    ok:     'Mid game de {n} correcto: juega con tu equipo y no peles sin visión del jungla.',
    weak:   'Mid flojo para {n}: evita el 5v5 directo, busca side y escala hacia tu late.',
  },
  late: {
    strong: '{n} escala de maravilla: si llegas al min 30 con farm, el late es tuyo. Juega a no perder antes.',
    ok:     'Late competente: con {n} gana quien menos falle — posición > daño.',
    weak:   '{n} CAE en late → cierra la partida antes del min 30. Cada minuto extra juega en tu contra.',
  },
  end: {
    strong: 'En partidas largas {n} es el win condition: agrupa, protege tu vida y decide con Baron/Elder.',
    ok:     'Final de partida: un solo teamfight decide. Con {n}, espera el error rival y ejecuta.',
    weak:   'Si llegaste aquí con {n}, juega a picks y evita el 5v5: tu ventana ya pasó.',
  },
};

const fill = (tpl, name) => tpl.split('{n}').join(name);

// H36-T8.4 (§3.3) — obligación ACCIONABLE por CLASE (rol) × fase, con timings y
// números. Se combina con la frase de la curva de poder para que el consejo deje
// de ser genérico: dice qué hacer con ese rol en ese momento de la partida.
const ROLE_PHASE_FOCUS = {
  TOP: {
    early:  'Gestiona la oleada (congela si dominas) y guarda el TP para impactar otra línea.',
    laning: 'Convierte tu prio en un TP a dragón o un recall con ventaja de oleada.',
    mid:    'Decide: splitpush si presionas, o agrúpate para dar frontline en el 5v5.',
    late:   'Da frontline o flanco; no seas el primero en morir en la pelea.',
    end:    'Con Baron/Elder, parte el mapa o aguanta el frontline para forzar el error rival.',
  },
  JUNGLE: {
    early:  'Ruta eficiente, pelea el scuttle ~3:15 y gankea la línea con CC más adelantada.',
    laning: 'Controla el 1er dragón/heraldo: pon visión 40s antes del spawn.',
    mid:    'Agrupa para objetivos y lee dónde está el jungla rival antes de comprometerte.',
    late:   'Engage o peel según tu campeón; asegura el Baron con visión previa.',
    end:    'Caza picks con visión y fuerza Elder/Baron cuando falte un rival.',
  },
  MID: {
    early:  'Consigue prioridad de oleada para roamear; ward los lados del río antes de empujar.',
    laning: 'Rota tras empujar: un roam exitoso vale más que 20 CS.',
    mid:    'Acompaña a tu jungla a los objetivos; tu tempo manda en el mapa.',
    late:   'Posiciónate para tu combo: elimina al carry rival o controla la pelea.',
    end:    'Guarda tu ultimate para el momento decisivo del teamfight final.',
  },
  ADC: {
    early:  'Farmea casi perfecto (el oro es tu escalado) y no mueras por buscar una kill.',
    laning: 'Si te superan, mantén CS bajo torre; tu pico real llega con 2 ítems.',
    mid:    'Pégate al frontline y no te adelantes: tu daño constante gana la pelea.',
    late:   'Posicionamiento > daño: pega desde la última fila y que no te asesinen.',
    end:    'Eres el win condition: protege tu vida y toca objetivos/torres en cada ventana.',
  },
  SUPPORT: {
    early:  'Control de visión (poner Y quitar wards) y protege o inicia según tu campeón.',
    laning: 'Rota a mid tras la fase de líneas y ayuda a coger el primer dragón.',
    mid:    'Wardea los objetivos 40s antes; tu visión decide las peleas.',
    late:   'Inicia o peelea en el instante exacto — un error y es GG.',
    end:    'Visión del Baron/Elder y el engage perfecto cierran la partida.',
  },
};

/**
 * Consejos de fase específicos del campeón para el modal (5 fases del UI). Cada
 * fase combina la frase de la curva de poder (fuerte/normal/débil) con la
 * obligación accionable del ROL en esa fase (ROLE_PHASE_FOCUS).
 *
 * @param {string} championName id DataDragon ('Lucian')
 * @param {string} [displayName] nombre legible (default = championName)
 * @returns {{early:string, laning:string, mid:string, late:string, end:string}}
 */
export function phaseTipsFor(championName, displayName) {
  const name = displayName || championName;
  const curve = championCurve(championName);
  const role = CHAMPION_TO_ROLE[championName] || 'MID';
  const focus = ROLE_PHASE_FOCUS[role] || ROLE_PHASE_FOCUS.MID;
  const combine = (curveTip, phaseKey) => `${fill(curveTip, name)} ${focus[phaseKey]}`;
  return {
    early:  combine(TIPS.early[curve.early],   'early'),
    laning: combine(TIPS.laning[curve.early],  'laning'),
    mid:    combine(TIPS.mid[curve.mid],       'mid'),
    late:   combine(TIPS.late[curve.late],     'late'),
    end:    combine(TIPS.end[curve.late],      'end'),
  };
}

// ─── Ranking estimado (mock honesto) ────────────────────────────────────────

/** Hash determinístico simple (djb2-ish) — estable entre sesiones. */
function hashStr(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/**
 * Posición estimada en el ladder EUW del campeón, derivada SOLO de las stats
 * (determinística: misma entrada → mismo número). Mejor WR y más partidas →
 * mejor puesto. Rango plausible ~[500, 45000]. Es una ESTIMACIÓN (el badge
 * del UI lo deja claro) — sustituir por ladder real cuando haya API.
 *
 * @param {string} championName
 * @param {{winrate:number, games:number}} stats de statsForChampion
 * @returns {number|null} posición estimada, o null sin partidas
 */
export function estimatedLadderRank(championName, stats) {
  if (!stats || !Number.isFinite(stats.games) || stats.games <= 0) return null;
  const wr = Math.max(0, Math.min(100, Number(stats.winrate) || 0));
  const games = Math.min(50, Math.max(1, Number(stats.games) || 1));
  const jitter = hashStr(`${championName}:${stats.winrate}:${stats.games}`) % 1500;
  const base = 30000 - wr * 250 - games * 120;
  return Math.max(517, Math.min(45000, Math.round(base + jitter)));
}
