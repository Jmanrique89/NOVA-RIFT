// ============================================================================
// generateMatchInsights — narrativa breve por partida (E2 · Mobalytics-like)
// ----------------------------------------------------------------------------
// Devuelve un array de hasta 3 badges con `text` (3-15 chars) y `color`
// semántico para pintarse bajo la fila de la partida en el historial.
//
// Reglas:
// Verde (#7B76DD): fortalezas elite (KDA ≥ 5, asistencias ≥ 15).
// Dorado (#C8AA6E): logros/calidad (CS ≥ 200, partida completa).
// Rojo (#E53935): impacto agresivo (≥10 kills) o muchas muertes.
// Púrpura (#7B76DD): hito singular (sin morir).
// Cyan (#00C8E0): soporte épico.
// Naranja (#F39C12): aviso (off-pool).
// Carbón: partida rápida.
//
// El motor es puro y defensivo — acepta tanto el shape del mock (`durationMin`,
// `kills`, ...) como variantes con prefijos diferentes. Devuelve top 3 por
// orden de aparición (ya viene priorizado).
// ============================================================================

const COLOR = {
  GREEN:  '#7B76DD',
  GOLD:   '#C8AA6E',
  RED:    '#E53935',
  PURPLE: '#7B76DD',
  CYAN:   '#00C8E0',
  ORANGE: '#F39C12',
  RED2:   '#E74C3C',
  GREY:   '#888899',
};

export function generateMatchInsights(match) {
  if (!match) return [];

  const kda     = match.kda      ?? 0;
  const cs      = match.cs       ?? 0;
  const kills   = match.kills    ?? 0;
  const deaths  = match.deaths   ?? 0;
  const assists = match.assists  ?? 0;
  const vision  = match.visionScore ?? 0;
  const dur     = match.durationMin ?? match.duration ?? 30;
  const isWin   = match.result === 'W' || match.result === 'WIN';
  const offPool = !!(match.offPool || match.isOffPool);

  const insights = [];

  // ── Fortalezas (verde / dorado / rojo / púrpura / cyan) ────────────────────
  if (kda >= 5)        insights.push({ text: 'KDA ÉLITE',      color: COLOR.GREEN  });
  if (cs >= 200)       insights.push({ text: 'FARM PERFECTO',  color: COLOR.GOLD   });
  if (kills >= 10)     insights.push({ text: 'DOMINADO',       color: COLOR.RED    });
  if (deaths === 0)    insights.push({ text: 'INMORTAL',       color: COLOR.PURPLE });
  if (assists >= 15)   insights.push({ text: 'SOPORTE ÉPICO',  color: COLOR.CYAN   });

  // ── Logros neutrales ───────────────────────────────────────────────────────
  if (dur < 25 && isWin) {
    insights.push({ text: 'PARTIDA RÁPIDA', color: COLOR.GREY });
  }
  if (isWin && kda >= 3 && cs >= 150) {
    insights.push({ text: 'DOMINIO COMPLETO', color: COLOR.GOLD });
  }

  // ── Avisos ─────────────────────────────────────────────────────────────────
  if (offPool)               insights.push({ text: 'FUERA DEL POOL', color: COLOR.ORANGE });
  if (vision < 10 && dur > 20) insights.push({ text: 'SIN VISIÓN',   color: COLOR.RED2   });
  if (deaths >= 8)           insights.push({ text: 'MUCHAS MUERTES', color: COLOR.RED2   });

  return insights.slice(0, 3);
}
