// ============================================================================
// coaching.js — "consejo del día" local (subset frontend de los templates)
// ----------------------------------------------------------------------------
// El backend tiene `CoachingTemplateService` con la matriz completa
// (role × playStyle × faction × context). Para el "consejo del día" de
// HubScreen y FloatingRadarWidget no hace falta toda la matriz: basta con 5
// frases por facción que rotan según el día de la semana.
//
// Por qué se resuelve en local y no se llama al backend:
// El consejo del día se renderiza muchas veces (cada entrada al tab PERFIL
// o cada vez que se expande el widget). Una llamada HTTP por render no aporta.
// La rotación es determinista por día → no necesita servidor.
// Es parte del flujo de demo end-to-end: un fetch que falle aquí lo rompería.
//
// Más adelante, los mensajes CONTEXTUALES en partida (early/mid/late ·
// ganando/perdiendo) sí consumirán el backend; el "consejo del día" sigue local.
// ============================================================================

// Catálogo de consejos por facción extraído del subconjunto competitivo de §17.
// Tono coherente con la psicología de cada facción (NOXUS agresivo, DEMACIA
// disciplinado, ZAUN adaptativo, IONIA control de tempo). Se rota un consejo por
// día de la semana en getDailyTip; arrays más largos = mayor variedad sin tocar
// la firma. Mezcla macro, visión, gestión de oleadas, tempo, mental, objetivos,
// intercambios e itemización.
const DAILY_TIPS = {
  NOXUS: [
    'Gana el nivel 2. Fuerza el intercambio antes de que escale. Domina o pierde.',
    'Nivel 2 es tu pico. Gankea el lane más débil antes de que escalen. First blood = ventaja doble.',
    'Domina tu lane 0-6. Lvl 6 con ulti: rota antes de que el enemy se entere.',
    'Cada intercambio ganado es un reset de poke. No sueltes la presión cuando vas por delante.',
    'Engancha al primero que veas fuera de posición. Pillado solo = kill regalado.',
    'Slow push antes del primer drake: una oleada acumulada te da prio para el objetivo.',
    'Si dominas la lane, traduce el oro en presión: empuja, recall y compra antes que el rival.',
    'Freezea cerca de tu torre cuando ganas el matchup: lo congelas sin farmear y lo gankeas gratis.',
    'No persigas kills hasta la torre enemiga sin visión. Una muerte tirando ventaja la regala entera.',
    'Trackea los cooldowns del rival: tras gastar su escape, su Flash o su skill clave, ese es tu pico.',
    'Tempo > kills. Convierte cada pico de nivel en daño de torre, no en una pelea innecesaria.',
    'Coloca un ward en el río antes de hacer all-in: un gank cancela tu agresión y la voltea.',
    'Compra el primer componente ofensivo agresivo: un espadón temprano gana todos los intercambios cortos.',
    'Mentalidad de cazador, no de matón: agresión con visión y plan, no por tilt.',
    'Tras un kill, decide ya: empujar para oro o resetear para presión. Quedarse parado desperdicia la ventaja.',
  ],
  DEMACIA: [
    'Escala tranquilo. No te expongas. Cada muerte es una torre y 30 CS de desventaja.',
    'Prioridad: counter-jungle seguro. Las wards son tu mejor amigo.',
    'No overextiendas. Si no tienes visión, asume el peligro. Pierde CS antes que vida.',
    'Farmea seguro: 5 CS/min vale más que una muerte temprana. El late game 1v5 lo ganas con oro.',
    'Tu trabajo es defender al carry: niega el engage y reposiciona, no busques héroe.',
    'Coloca ward defensivo en tu entrada de jungla cuando empujas: ves al jungla antes de que llegue.',
    'Gestiona la oleada: si vas perdido, congela cerca de torre y farmea seguro hasta tu spike de ítem.',
    'No tradees sin razón: solo intercambia cuando ganas el cambio de recursos, no por costumbre.',
    'Respeta el minimapa: con dos enemigos sin visión, retrasa el push y juega para no morir.',
    'Compra control wards en cada recall. La visión barata previene el gank que te cuesta la partida.',
    'Antes del objetivo, asegura prio limpiando tu oleada: llegar primero vale más que un par de CS.',
    'Paciencia mental: ir empatado en oro al minuto 20 con buen escalado ya es ventaja. No fuerces.',
    'Ante un dive, no malgastes hechizos pronto: cede la torre antes que dar dos kills.',
    'Termina ítems completos antes que apilar componentes: un spike limpio gana la siguiente pelea.',
    'Resetea con la oleada empujada hacia ellos: vuelves con ítem sin perder ni CS ni torre.',
  ],
  ZAUN: [
    'Adapta tu build. El enemy no sabe lo que vas a hacer — aprovéchalo.',
    'No farmees sin objetivo. Cada clear debe preparar un gank o un objetivo.',
    'Empuja cuando el enemy esté en low HP. Cuando dejas limpio, rotas. La sincronización es oro.',
    'Coloca wards en las entradas de jungla: la visión convierte un 2v2 incierto en un 3v2 ganado.',
    'Lee el matchup en select y ajusta runas y primer ítem: flexibilidad es tu ventaja real.',
    'Sincroniza recall con tu oleada empujada: vuelves con ítem mientras el rival pierde CS bajo torre.',
    'Cambia el objetivo según el estado del mapa: si el drake está disputado, roba el Heraldo lejano.',
    'No te cases con una ruta de build: ítem defensivo si te revientan, ofensivo si dominas.',
    'Tradea cuando el rival va a por CS: golpéalo mientras él golpea minions y ganas el cambio.',
    'Trackea el jungla enemigo por el spawn de campamentos: si apareció top, empuja y crashea libre abajo.',
    'Un ward bien puesto vale más que un kill: previene el gank y te deja jugar agresivo con info.',
    'Resetea el estado mental tras una muerte: vuelve al plan, no al revancha. El tilt cuesta dobles.',
    'Antes de un objetivo, limpia tu oleada para tener prio y llegar con todo el equipo, no escalonado.',
    'Compra component que potencie tu pico de poder concreto, no el ítem genérico de la guía.',
    'Invade solo con visión y timing del jungla: counter-jungle ciego es regalar tu propia ventaja.',
  ],
  IONIA: [
    'Control de onda es todo. Mantén la wave cerca de tu torre. A nivel 9 con ítems, ganamos.',
    'El oro es compartido: ayuda a escalar a quien tiene el mejor matchup del equipo.',
    'El teamfight gira en torno a la oleada. Juega macro si no hay setup para pelear.',
    'Aburrido = seguro = elo. Empuja lento, espera el setup, ejecuta sin prisa.',
    'Teamfight es posicionamiento: el espacio que abres para tu carry vale más que tu propio daño.',
    'Domina el control de oleadas: slow push para crashear justo cuando llega tu jungla a objetivo.',
    'No pelees sin visión del objetivo: warda 30 segundos antes del spawn de drake o barón.',
    'Tempo sobre kills: si tu pico de nivel es ahora, fuerza el objetivo, no una pelea aleatoria.',
    'Resetea con la oleada empujada: el reset perfecto no te cuesta CS ni cede placas de torre.',
    'Mantén la calma tras perder un intercambio: reposiciona y espera tu ventana, no la fuerces.',
    'Wave management para canjear: si pierdes la lane, empuja y rota a otra para no quedar inútil.',
    'Visión profunda antes del barón: sin control de la jungla enemiga el objetivo es una trampa.',
    'Compra el ítem que habilita tu rol en la pelea: utilidad para el peel, no daño que no usarás.',
    'No reveles tu engage sin setup: una iniciación sin seguimiento del equipo es un kill regalado.',
    'Cuenta los cooldowns clave del rival antes de pelear: sin su engage o su peel, la pelea es tuya.',
  ],
};

const FALLBACK_FACTION = 'DEMACIA';

/** Devuelve el consejo del día rotando determinísticamente por día de la semana. */
export function getDailyTip(faction) {
  const key = String(faction || '').toUpperCase();
  const tips = DAILY_TIPS[key] || DAILY_TIPS[FALLBACK_FACTION];
  const dayIdx = new Date().getDay(); // 0..6
  return tips[dayIdx % tips.length];
}

/** Lista completa de tips para una facción (útil para tests / rotaciones manuales). */
export function getAllTipsForFaction(faction) {
  const key = String(faction || '').toUpperCase();
  return DAILY_TIPS[key] || DAILY_TIPS[FALLBACK_FACTION];
}

export { DAILY_TIPS };
