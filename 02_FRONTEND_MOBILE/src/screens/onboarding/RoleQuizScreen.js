// ============================================================================
// RoleQuizScreen — Paso 2/4 — Test de personalidad + mapa interactivo
// ----------------------------------------------------------------------------
// 3 fases (state screenPhase):
// 'test' → 4 preguntas de personalidad (LoL-Research §15) → scoring por rol
// 'result' → carta con el rol recomendado · CONFIRMAR | ELEGIR MANUALMENTE
// 'map' → mapa interactivo Summoner's Rift (modo manual main+secondary)
//
// El test asigna SOLO el rol main. Si el usuario quiere también un secundario
// concreto, va por el flujo manual ('map') que mantiene el comportamiento
// previo (pickPhase main → secondary).
// ============================================================================
// ── React y sus hooks ─────────────────────────────────────────────────────────
// React + los "hooks" del framework: useContext (lee un contexto/estado global),
// useState (estado observable que redibuja al cambiar), useEffect (ciclo de vida)
// y useRef (referencia mutable que NO provoca redibujado). Son las herramientas
// de React para estado, ciclo de vida y datos persistentes entre renders.
import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
// ── Componentes UI de React Native ─────────────────────────────────────────────
// Bloques visuales nativos: View (contenedor, como un JPanel), Text (texto),
// Image/ImageBackground (imágenes), TouchableOpacity (botón táctil con efecto de
// opacidad, como un JButton con listener), StyleSheet (estilos como objeto),
// Animated (valores animados), Dimensions (tamaño de pantalla), ScrollView
// (contenedor con scroll, como un JScrollPane) y Platform (detecta web/iOS/Android).
import {
  View, Text, Image, ImageBackground, TouchableOpacity, StyleSheet,
  Animated, Dimensions, ScrollView, Platform,
} from 'react-native';
// ── SVG — dibujo vectorial del mapa de Summoner's Rift ──────────────────────────
// Primitivas de dibujo vectorial (Path, Circle, Rect, Line, gradientes) usadas
// para pintar el mapa interactivo de carriles del modo manual.
import Svg, {
  Path, Circle, Rect, Line, Defs, LinearGradient, RadialGradient, Stop,
} from 'react-native-svg';
// ── Contexto / estado global compartido ─────────────────────────────────────────
// OnboardingContext es el estado del flujo de onboarding (como inyección de
// dependencias / un singleton accesible): expone setMainRole, setSecondaryRole
// y la facción elegida, sin pasarlos por props desde arriba.
import { OnboardingContext } from './OnboardingContext';
// ── Tema y assets de facción / rol ──────────────────────────────────────────────
// FACTIONS: temas por facción de LoL. factionAssets: imagen compuesta de roles y
// helpers para recortar el icono de cada rol (PNG individual o crop del sprite).
import { FACTIONS } from '../../theme/theme';
import {
  COMPOSITE_ROLES_IMG,
  COMPOSITE_W as COMPOSITE_ROLES_W,
  COMPOSITE_H as COMPOSITE_ROLES_H,
  getRoleLogo,
  getRoleCrop,
} from '../../data/factionAssets';
// ── Componentes propios reutilizables ───────────────────────────────────────────
// Piezas de UI ya construidas por el proyecto: fondo animado, botón de marca y la
// "escotilla" de desarrollo para saltarse pasos del flujo en modo debug.
import NovaBackground from '../../components/NovaBackground';
import NovaButton     from '../../components/NovaButton';
import DevEscapeHatch from '../../components/DevEscapeHatch';
// B4.6 — puntos de progreso unificados de los 4 pasos del onboarding.
import ProgressDots   from '../../components/ProgressDots';
// ── Tokens de diseño ────────────────────────────────────────────────────────────
// Escala tipográfica y paleta de color centralizadas (los "tokens" de diseño,
// como un fichero de constantes/recursos compartido por toda la app).
import { TYPE_SCALE } from '../../theme/typography';
import { useTheme } from '../../context/ThemeContext';

const { width: SW } = Dimensions.get('window');
const MAP_SIZE = Math.min(SW - 32, 360);

// ── Test de personalidad (LoL-Research §15) ─────────────────────────────────
const ROLE_TEST_QUESTIONS = [
  {
    text: '¿Cómo prefieres impactar en una partida?',
    options: [
      { label: 'Siendo el primero en entrar al combate',       scores: { TOP: 2, JUNGLE: 1 } },
      { label: 'Haciendo el mayor daño desde posición segura', scores: { ADC: 2, MID: 1 } },
      { label: 'Asegurando que mis compañeros sobrevivan',     scores: { SUPPORT: 2 } },
    ],
  },
  {
    text: '¿Qué aspecto del juego disfrutas más?',
    options: [
      { label: 'Controlar mi línea y crecer con el tiempo',          scores: { TOP: 2, ADC: 1 } },
      { label: 'Moverme por el mapa y aparecer donde no me esperan', scores: { JUNGLE: 2, MID: 1 } },
      { label: 'Crear jugadas para el equipo más que para mí mismo', scores: { SUPPORT: 2, JUNGLE: 1 } },
    ],
  },
  {
    text: 'Cuando la partida se complica, ¿qué prefieres hacer?',
    options: [
      { label: 'Aguantar el daño y ser lo más difícil de matar posible', scores: { TOP: 2, SUPPORT: 1 } },
      { label: 'Buscar el outplay individual para cambiar la situación', scores: { MID: 2, ADC: 1 } },
      { label: 'Leer el mapa y buscar el objetivo más importante',       scores: { JUNGLE: 2, MID: 1 } },
    ],
  },
  {
    text: '¿Qué tipo de victoria te da más satisfacción?',
    options: [
      { label: 'Haber controlado el ritmo de la partida desde el principio', scores: { JUNGLE: 2, MID: 1 } },
      { label: 'Haber farmeado perfecto y cerrado la partida como carry',     scores: { ADC: 2, TOP: 1 } },
      { label: 'Que el equipo haya ganado gracias a tu visión y protección',  scores: { SUPPORT: 2 } },
    ],
  },
];

// Splash de un campeón icónico por rol — para la carta de resultado
const ROLE_PORTRAIT_CHAMPION = {
  TOP:     'Garen',
  JUNGLE:  'LeeSin',
  MID:     'Ahri',
  ADC:     'Jinx',
  SUPPORT: 'Thresh',
};
// Campeón representativo por rol para el splash en SingleRoleCard del modal.
const ROLE_CHAMPS = {
  TOP:     'Darius',
  JUNGLE:  'Vi',
  MID:     'Ahri',
  ADC:     'Jinx',
  SUPPORT: 'Thresh',
};
// Arte CENTRADO de CommunityDragon en vez del splash crudo de DataDragon: el
// splash recortaba la cabeza del campeón en contenedores anchos y bajos. El
// endpoint /splash-art/centered devuelve la imagen ya encuadrada.
const splashUrl = (name) =>
  `https://cdn.communitydragon.org/latest/champion/${name}/splash-art/centered`;

// Devuelve la(s) role(s) con mayor score de una opción del test. Se usa
// para pintar la línea de contexto bajo cada respuesta ("Afín a: TOP").
function topScoredRoles(scores) {
  if (!scores) return [];
  const entries = Object.entries(scores);
  if (entries.length === 0) return [];
  const max = Math.max(...entries.map(([, v]) => v));
  return entries.filter(([, v]) => v === max).map(([k]) => k);
}

const ROLE_LABEL_SHORT = {
  TOP:     'TOP',
  JUNGLE:  'JUNGLE',
  MID:     'MID',
  ADC:     'BOT / ADC',
  SUPPORT: 'SUPPORT',
};

function calculateRole(answers) {
  const scores = { TOP: 0, JUNGLE: 0, MID: 0, ADC: 0, SUPPORT: 0 };
  answers.forEach((optionIndex, questionIndex) => {
    const q = ROLE_TEST_QUESTIONS[questionIndex];
    const chosen = q && q.options && q.options[optionIndex];
    if (!chosen || !chosen.scores) return;
    Object.entries(chosen.scores).forEach(([role, pts]) => {
      scores[role] += pts;
    });
  });
  const max = Math.max(...Object.values(scores));
  const winners = Object.keys(scores).filter(r => scores[r] === max);
  // Si winners está vacío (todos los scores a 0 por input vacío o mal formado)
  // devolvemos 'MID' como rol por defecto: el más versátil y menos sesgado que null.
  if (winners.length === 0) return 'MID';
  return winners.length === 1 ? winners[0] : winners.slice(0, 2);
}

// Tooltips que aparecen al hover sobre cada zona del mapa
const ROLE_TOOLTIPS = {
  TOP:    'El Guerrero Solitario · Farm, duelos 1v1, absorber presión del mapa',
  JUNGLE: 'El Cazador · Ganks, objetivos, presión de mapa · Decide el ritmo del juego',
  MID:    'El Mago/Asesino · Roam, poke, presión mid · El rol más versátil',
  ADC:    'El Cañón · Daño sostenido late game · Proteger a toda costa en early',
  SUPPORT:'El Guardián · Visión, peeling, engage · El rol más impactante del meta',
};

// ── RoleLogo ─────────────────────────────────────────────────────────────────
// 3-tier render strategy idéntica a FactionLogo.
// 1) PNG individual (después de `node scripts/crop-assets.js`)
// 2) Crop in-place desde roles.png compuesto
// 3) Unicode glyph (siempre fallback)
function RoleLogo({ roleKey, glyph, color, size = 44 }) {
  const logo = getRoleLogo(roleKey);
  const crop = getRoleCrop(roleKey);

  if (logo) {
    // Tier 1: PNGs de roles son blancos puros → tintColor pinta el icono con
    // el color del rol (o de facción cuando lo pase el consumer).
    return (
      <Image
        source={logo}
        style={[{ width: size, height: size }, color ? { tintColor: color } : null]}
        resizeMode="contain"
      />
    );
  }

  if (crop && COMPOSITE_ROLES_IMG) {
    const scale = size / crop.width;
    return (
      <View
        style={{
          width: size,
          height: Math.round(size * (crop.height / crop.width)),
          overflow: 'hidden',
          borderRadius: 4,
        }}
      >
        <Image
          source={COMPOSITE_ROLES_IMG}
          style={{
            position: 'absolute',
            width: COMPOSITE_ROLES_W * scale,
            height: COMPOSITE_ROLES_H * scale,
            left: -crop.left * scale,
            top: -crop.top * scale,
          }}
          resizeMode="cover"
        />
      </View>
    );
  }

  // Fallback unicode
  return <Text style={{ fontSize: size * 0.78, fontWeight: '900', color }}>{glyph}</Text>;
}

const ROLES = {
  TOP: {
    color: '#e74c3c', label: 'TOP LANE', glyph: '⬡',
    desc: 'El guerrero solitario. 1v1, splitpush, duelos prolongados.',
    traits: ['Duelista', 'Tanque', 'Splitpusher'],
  },
  JUNGLE: {
    color: '#2ecc71', label: 'JUNGLA', glyph: '◈',
    desc: 'El maestro del mapa. Ganks, objetivos, control de visión.',
    traits: ['Movilidad', 'Objetivos', 'Ganks'],
  },
  MID: {
    color: '#22D3EE', label: 'MID LANE', glyph: '✦',
    desc: 'El núcleo estratégico. Roams, presión central, influencia global.',
    traits: ['Roam', 'Presión', 'Influencia central'],
  },
  ADC: {
    color: '#f39c12', label: 'ADC', glyph: '◎',
    desc: 'El carry del late game. Daño sostenido, posicionamiento.',
    traits: ['Daño sostenido', 'Late game', 'Posicionamiento'],
  },
  SUPPORT: {
    color: '#00c8e0', label: 'SUPPORT', glyph: '◉',
    desc: 'El guardián del equipo. Visión, peel, engage o encanto.',
    traits: ['Visión', 'Peel', 'Utility'],
  },
};

// ── Componente principal: RoleQuizScreen ────────────────────────────────────
// Pantalla del Paso 2/4. `navigation` llega como prop (≈ parámetro del
// constructor) y permite saltar a otra pantalla con navigation.navigate(...),
// el equivalente a un startActivity(Intent) en Android nativo.
export default function RoleQuizScreen({ navigation }) {
  // useContext: lee el estado global del onboarding (≈ inyección de dependencias
  // / singleton). De ahí saca los setters del rol main/secundario y la facción.
  const { setMainRole, setSecondaryRole, faction } = useContext(OnboardingContext);
  const { colors: c, isDark } = useTheme();
  const styles = useMemo(() => makeRoleQuizStyles(c), [c]);
  // CTA en púrpura neutro (#7B76DD) — la facción se respeta solo en su pantalla.
  const factionColor = c.primary;

  // ── Estado local (useState ≈ campos de instancia con getter/setter) ──────────
  // Cada par [valor, setValor] es un campo observable: al llamar al setter React
  // vuelve a renderizar la pantalla con el nuevo valor.
  const [activeZone,  setActiveZone]  = useState(null); // 'TOP'|'JUNGLE'|'MID'|'BOT'
  const [hoveredZone, setHoveredZone] = useState(null); // zona bajo el cursor (web)
  const [botChoice,   setBotChoice]   = useState(null); // 'ADC'|'SUPPORT'
  const [pickedMain,  setPickedMain]  = useState(null);
  const [pickedSec,   setPickedSec]   = useState(null);
  // pickPhase = control del flujo manual del mapa (main → secondary)
  // screenPhase = qué pantalla mostrar (test → result → map)
  const [pickPhase,   setPickPhase]   = useState('main');     // 'main' | 'secondary'
  const [screenPhase, setScreenPhase] = useState('test');     // 'test' | 'result' | 'map'
  const [testAnswers,     setTestAnswers]     = useState([]); // índices de respuesta por pregunta
  const [recommendedRole, setRecommendedRole] = useState(null); // 'TOP' | ... | array si empate

  // ── Refs de animación (useRef) ───────────────────────────────────────────────
  // useRef guarda un valor mutable que persiste entre renders SIN provocar
  // redibujado (a diferencia de useState). Aquí son los valores animados de la
  // carta modal (posición vertical y opacidad).
  const cardY       = useRef(new Animated.Value(400)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;

  // Flash de pantalla con el color del rol al seleccionarlo
  const roleFlash = useRef(new Animated.Value(0)).current;
  const [roleFlashColor, setRoleFlashColor] = useState('transparent');

  // ── Handlers / callbacks del modo manual (≈ métodos de evento) ───────────────
  // Funciones que responden a la interacción del usuario sobre el mapa:
  // showCard/hideCard animan la carta modal de un rol; selectRole guarda el rol
  // tocado (main o secundario según la fase) y dispara el flash de color.
  const showCard = (zone) => {
    setActiveZone(zone);
    setBotChoice(null);
    setHoveredZone(null); // ocultar tooltip al abrir el bottom sheet
    Animated.parallel([
      Animated.spring(cardY,       { toValue: 0, friction: 8, tension: 80, useNativeDriver: true }),
      Animated.timing(cardOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
  };

  const hideCard = (cb) => {
    Animated.parallel([
      Animated.timing(cardY,       { toValue: 400, duration: 220, useNativeDriver: true }),
      Animated.timing(cardOpacity, { toValue: 0,   duration: 160, useNativeDriver: true }),
    ]).start(() => { setActiveZone(null); cb && cb(); });
  };

  const selectRole = (roleId) => {
    // Flash con el color del rol seleccionado
    const color = ROLES[roleId]?.color || c.textPrimary;
    setRoleFlashColor(color + '25');
    roleFlash.setValue(0.6);
    Animated.timing(roleFlash, { toValue: 0, duration: 700, useNativeDriver: false }).start();

    if (pickPhase === 'main') {
      setPickedMain(roleId);
      hideCard(() => setPickPhase('secondary'));
    } else {
      setPickedSec(roleId);
      hideCard();
    }
  };

  const handleConfirm = () => {
    // Modo manual: necesita main y secondary
    setMainRole(pickedMain);
    setSecondaryRole(pickedSec);
    // navigation.navigate(...) ≈ startActivity(Intent): avanza a la pantalla Playstyle.
    navigation.navigate('Playstyle');
  };

  const canConfirm = pickedMain && pickedSec && pickedMain !== pickedSec;

  // ── Handlers del test de personalidad ─────────────────────────────────────
  // Animación entre preguntas: opacity + translateX
  const questionOp = useRef(new Animated.Value(1)).current;
  const questionX  = useRef(new Animated.Value(0)).current;

  const animateNextQuestion = () => {
    // Salida actual: fade out + slide left
    questionOp.setValue(1);
    questionX.setValue(0);
    Animated.parallel([
      Animated.timing(questionOp, { toValue: 0, duration: 180, useNativeDriver: true }),
      Animated.timing(questionX,  { toValue: -30, duration: 180, useNativeDriver: true }),
    ]).start(() => {
      // Entrada nueva: arranca desplazada a la derecha
      questionX.setValue(40);
      Animated.parallel([
        Animated.timing(questionOp, { toValue: 1, duration: 250, useNativeDriver: true }),
        Animated.timing(questionX,  { toValue: 0, duration: 250, useNativeDriver: true }),
      ]).start();
    });
  };

  // Ref para limpiar el timeout pendiente en el cleanup y evitar el race
  // condition cuando el usuario navega antes de los 350 ms.
  const resultTimerRef = useRef(null);
  // ── useEffect (ciclo de vida ≈ constructor / @PostConstruct + dispose) ───────
  // useEffect ejecuta código al montar el componente y cuando cambian sus
  // dependencias (el array final). El `return` interno es la función de limpieza
  // (≈ un dispose / @PreDestroy): aquí cancela el timeout pendiente si el usuario
  // abandona la pantalla antes de los 350 ms y evita un race condition.
  useEffect(() => () => {
    if (resultTimerRef.current) clearTimeout(resultTimerRef.current);
  }, []);

  const handleTestAnswer = (optionIndex) => {
    const next = [...testAnswers, optionIndex];
    setTestAnswers(next);

    if (next.length < ROLE_TEST_QUESTIONS.length) {
      // Aún quedan preguntas — anima transición
      animateNextQuestion();
      return;
    }
    // Última pregunta respondida → calcular rol y pasar a result
    const role = calculateRole(next);

    // Validamos que el resultado es usable antes de cambiar de fase. Si `role`
    // no es un string ni un array no vacío, caemos al modo manual ('map') en
    // lugar de renderizar una fase de resultado rota.
    const isValidString = typeof role === 'string' && ROLES[role];
    const isValidArray  = Array.isArray(role) && role.length > 0
                          && role.every(r => ROLES[r]);
    if (!isValidString && !isValidArray) {
      setScreenPhase('map');
      return;
    }

    setRecommendedRole(role);
    if (resultTimerRef.current) clearTimeout(resultTimerRef.current);
    resultTimerRef.current = setTimeout(() => setScreenPhase('result'), 350);
  };

  // Confirmar el rol recomendado por el test (solo main, sin secondary).
  const handleConfirmRecommended = (roleId) => {
    const color = ROLES[roleId]?.color || c.textPrimary;
    setRoleFlashColor(color + '25');
    roleFlash.setValue(0.6);
    Animated.timing(roleFlash, { toValue: 0, duration: 700, useNativeDriver: false }).start();

    setMainRole(roleId);
    setSecondaryRole(null);
    navigation.navigate('Playstyle');
  };

  const goToManualMap = () => {
    setScreenPhase('map');
  };

  // Barra de progreso del test
  const progressAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: testAnswers.length / ROLE_TEST_QUESTIONS.length,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [testAnswers.length]);

  // Spring de entrada para la carta resultado
  const resultScale = useRef(new Animated.Value(0.85)).current;
  const resultOp    = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (screenPhase !== 'result') return;
    resultScale.setValue(0.85);
    resultOp.setValue(0);
    Animated.parallel([
      Animated.spring(resultScale, { toValue: 1, friction: 7, tension: 80, useNativeDriver: true }),
      Animated.timing(resultOp,    { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();
  }, [screenPhase]);

  // ── Render / return (≈ el XML de layout en Android) ──────────────────────────
  // El JSX que devuelve cada rama es la descripción declarativa de la UI, como un
  // res/layout/*.xml: describe QUÉ pintar, no CÓMO. Router por screenPhase — cada
  // fase ('test' | 'result' | 'map') devuelve su propio árbol de vistas.
  if (screenPhase === 'test') {
    const qIdx = testAnswers.length; // pregunta actual (0..3)
    const question = ROLE_TEST_QUESTIONS[qIdx];
    const progressW = progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

    // GUARD: cuando se responde la última pregunta, durante los 350ms antes
    // de cambiar a screenPhase='result', qIdx=4 y question=undefined.
    // Mostrar loading en ese intervalo para no crashear el render.
    if (!question) {
      return (
        <View style={[styles.container, { alignItems: 'center', justifyContent: 'center' }]}>
          {isDark && <NovaBackground />}
          <DevEscapeHatch />
          <Text style={{ color: c.onSurface(0.6), fontSize: TYPE_SCALE.label.size, letterSpacing: 2 }}>
            CALCULANDO TU ROL…
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.container}>
        {isDark && <NovaBackground />}
        <DevEscapeHatch />

        {/* Barra progreso (top, fuera del scroll) */}
        <View style={styles.progressBarWrap}>
          <Animated.View style={[styles.progressBarFill, { width: progressW }]} />
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.testScroll}>
          {/* B4.6 — indicador de paso unificado (mismo componente en los 4 pasos) */}
          <View style={styles.onboardingStepRow}>
            <ProgressDots current={2} style={{ marginTop: 0, marginBottom: 0 }} />
            <Text style={styles.onboardingStepLabel}>PASO 2 DE 4</Text>
          </View>

          {/* Question progress — 4 puntos */}
          <View style={styles.dotProgressRow}>
            {ROLE_TEST_QUESTIONS.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.dotProgress,
                  i < qIdx
                    ? { backgroundColor: c.primary }
                    : i === qIdx
                      ? { backgroundColor: c.primary, transform: [{ scale: 1.3 }] }
                      : { backgroundColor: c.onSurface(0.15) },
                ]}
              />
            ))}
          </View>

          <Text style={styles.progressTag}>
            PREGUNTA {qIdx + 1} DE {ROLE_TEST_QUESTIONS.length}
          </Text>

          <Animated.View
            style={{
              opacity: questionOp,
              transform: [{ translateX: questionX }],
            }}
          >
            <Text style={styles.testQuestionText}>{question.text}</Text>

            <View style={styles.testOptionsWrap}>
              {/* Sin hint "Afín a: ROL": mostrar el rol asociado a cada
                  respuesta condicionaba la elección. El test debe ser ciego. */}
              {question.options.map((opt, i) => (
                <TestOptionButton
                  key={i}
                  letter={String.fromCharCode(65 + i)}
                  label={opt.label}
                  hint={null}
                  onPress={() => handleTestAnswer(i)}
                />
              ))}
            </View>
          </Animated.View>
        </ScrollView>
      </View>
    );
  }

  if (screenPhase === 'result') {
    // try/catch defensivo: si el render falla (rol indefinido, imagen que no
    // carga, etc.) caemos al modo manual sin dejar pantalla negra.
    try {
    // recommendedRole puede ser string o array (empate)
    const isTie = Array.isArray(recommendedRole);

    // Validación final — si llegamos aquí con un valor inservible,
    // saltamos al modo manual en el siguiente tick.
    if (!recommendedRole ||
        (isTie && recommendedRole.length === 0) ||
        (!isTie && !ROLES[recommendedRole])) {
      // setScreenPhase('map') dentro del render rompería React;
      // usamos un microtask para no violar la regla.
      Promise.resolve().then(() => setScreenPhase('map'));
      return (
        <View style={[styles.container, { alignItems: 'center', justifyContent: 'center' }]}>
          {isDark && <NovaBackground />}
          <Text style={{ color: c.onSurface(0.6), fontSize: TYPE_SCALE.label.size, letterSpacing: 2 }}>
            CARGANDO MODO MANUAL…
          </Text>
        </View>
      );
    }

    if (isTie) {
      return (
        <View style={styles.container}>
          {isDark && <NovaBackground />}
          <DevEscapeHatch />
          <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.resultScroll}>
            <Text style={styles.progressTag}>TU PERFIL ENCAJA CON DOS ROLES</Text>
            <Text style={styles.resultSubLine}>Elige uno para continuar:</Text>
            {/* Empate: DOS cards con splashart (como la recomendación individual),
                una junto a otra, cada una con su CTA. Sin botones planos ni
                animación de fusión entre ellas — el empate es una elección clara
                entre dos roles igual de afines a tu perfil. */}
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 24, alignItems: 'flex-start' }}>
              {recommendedRole.map(r => (
                ROLES[r] ? (
                  <View key={r} style={{ flex: 1 }}>
                    <SingleRoleCard
                      role={ROLES[r]}
                      zone={r}
                      phase="main"
                      pickedMain={null}
                      onSelect={handleConfirmRecommended}
                    />
                  </View>
                ) : null
              ))}
            </View>
            <View style={{ marginTop: 16 }}>
              <NovaButton
                label="ELEGIR MANUALMENTE"
                variant="ghost"
                factionColor={factionColor}
                onPress={goToManualMap}
              />
            </View>
          </ScrollView>
        </View>
      );
    }

    const role  = ROLES[recommendedRole];
    const champ = ROLE_PORTRAIT_CHAMPION[recommendedRole];
    return (
      <View style={styles.container}>
        {isDark && <NovaBackground />}
        <DevEscapeHatch />
        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.resultScroll}>
          <Text style={styles.progressTag}>TU ROL IDEAL</Text>

          <Animated.View
            style={{
              opacity: resultOp,
              transform: [{ scale: resultScale }],
              marginTop: 12,
              borderWidth: 1.5,
              borderColor: '#FFD700',
              borderRadius: 18,
              // Padding 16 (no 4): el pulso de NovaButton escalaba el botón por
              // encima del borde dorado; con padding real queda dentro.
              padding: 16,
              ...(Platform.OS === 'web'
                ? { boxShadow: '0 0 30px rgba(255,215,0,0.25), 0 0 60px rgba(255,215,0,0.10)' }
                : {
                    shadowColor: '#FFD700', shadowOpacity: 0.35,
                    shadowRadius: 20, shadowOffset: { width: 0, height: 0 },
                  }),
            }}
          >
            {/* Badge "ROL RECOMENDADO" */}
            <View style={[styles.resultRecommendedBadge, { alignSelf: 'center', marginBottom: 8 }]}>
              <Text style={styles.resultRecommendedBadgeText}>ROL RECOMENDADO</Text>
            </View>
            <View style={styles.resultPortrait}>
              <Image
                source={{ uri: splashUrl(champ) }}
                style={[
                  StyleSheet.absoluteFillObject,
                  { borderRadius: 16 },
                  Platform.OS === 'web'
                    ? { objectFit: 'cover', objectPosition: '50% 25%' }
                    : {},
                ]}
                resizeMode="cover"
              />
              <View style={styles.resultPortraitGradient} />
              {/* Role glyph + name layered over splash */}
              <View style={styles.resultRoleOverlay}>
                <Text style={styles.resultRoleGlyph}>{role.glyph}</Text>
                <Text
                  style={[
                    styles.resultRoleName,
                    {
                      color: '#FFD700',
                      textShadowColor: '#FFD700',
                      textShadowOffset: { width: 0, height: 0 },
                      textShadowRadius: 18,
                    },
                  ]}
                >
                  {role.label}
                </Text>
              </View>
            </View>

            <Text style={styles.resultDesc}>{role.desc}</Text>
            <View style={styles.resultTraitsRow}>
              {role.traits.map(t => (
                <View key={t} style={styles.resultTraitChip}>
                  <Text style={styles.resultTraitText}>{t}</Text>
                </View>
              ))}
            </View>
            <Text style={styles.resultHint}>Recomendado para tu perfil de juego</Text>

            <View style={{ marginTop: 28 }}>
              <NovaButton
                label="CONFIRMAR ESTE ROL →"
                size="lg"
                factionColor={factionColor}
                onPress={() => handleConfirmRecommended(recommendedRole)}
              />
            </View>
            <View style={{ marginTop: 12 }}>
              <NovaButton
                label="ELEGIR MANUALMENTE"
                variant="ghost"
                factionColor={factionColor}
                onPress={goToManualMap}
              />
            </View>
          </Animated.View>
        </ScrollView>

        {/* Flash de confirmación */}
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFillObject,
            { backgroundColor: roleFlashColor, opacity: roleFlash, zIndex: 50 },
          ]}
        />
      </View>
    );
    } catch (renderErr) {
      // Si el render del resultado falla, lo registramos y caemos al modo
      // manual sin dejar al usuario en pantalla negra.
      // eslint-disable-next-line no-console
      console.warn('[RoleQuiz] render result falló:', renderErr?.message || renderErr);
      Promise.resolve().then(() => setScreenPhase('map'));
      return (
        <View style={[styles.container, { alignItems: 'center', justifyContent: 'center' }]}>
          {isDark && <NovaBackground />}
          <Text style={{ color: c.onSurface(0.6), fontSize: TYPE_SCALE.label.size, letterSpacing: 2, textAlign: 'center', paddingHorizontal: 24 }}>
            No hemos podido calcular tu rol — sigue en modo manual…
          </Text>
        </View>
      );
    }
  }

  // ── screenPhase === 'map' (modo manual original) ──────────────────────────
  return (
    <View style={styles.container}>
      {isDark && <NovaBackground />}
      <DevEscapeHatch />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.mapScrollContent}
        keyboardShouldPersistTaps="handled"
      >
      {/* Header */}
      <View style={styles.mapPhaseHeader}>
        {/* B4.6 — indicador de paso unificado (mismo componente en los 4 pasos) */}
        <View style={styles.onboardingStepRow}>
          <ProgressDots current={2} style={{ marginTop: 0, marginBottom: 0 }} />
          <Text style={styles.onboardingStepLabel}>PASO 2 DE 4</Text>
        </View>
        <Text style={styles.title}>
          {pickPhase === 'main' ? 'Tu línea principal' : 'Tu línea secundaria'}
        </Text>
        <Text style={styles.subtitle}>
          {pickPhase === 'main'
            ? 'Toca tu zona en el mapa para ver el rol.'
            : `Main: ${ROLES[pickedMain]?.label}  ·  Ahora elige el secundario.`}
        </Text>
      </View>

      {/* Mapa */}
      <View style={[styles.mapWrap, { width: MAP_SIZE, height: MAP_SIZE }]}>
        <Svg width={MAP_SIZE} height={MAP_SIZE} viewBox="0 0 320 320">
          {/* Mapa SVG moderno — portado de RoleConstellationScreen.
              Coordenadas convertidas de fracción [0..1] a viewBox 0-320:
              frac × 320. Mantenemos viewBox para no romper las zonas
              tocables que ya usan coords absolutas 0-320. */}
          <Defs>
            <RadialGradient id="mapBg" cx="50%" cy="50%" r="70%">
              <Stop offset="0%"   stopColor="#0d1a14" stopOpacity="1" />
              <Stop offset="100%" stopColor="#07070d" stopOpacity="1" />
            </RadialGradient>
          </Defs>

          {/* Fondo del mapa */}
          <Rect x="0" y="0" width="320" height="320" fill="url(#mapBg)" rx="12" />
          <Rect x="0" y="0" width="320" height="320" fill="none"
            stroke="rgba(255,255,255,0.06)" strokeWidth="1.5" rx="12" />

          {/* Carril Top — base inferior-izq → sube → derecha */}
          <Path d="M 38.4,281.6 L 38.4,44.8 L 281.6,44.8"
            fill="none" stroke="#1e4030" strokeWidth="22"
            strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M 38.4,281.6 L 38.4,44.8 L 281.6,44.8"
            fill="none" stroke="#26543e" strokeWidth="10"
            strokeLinecap="round" strokeLinejoin="round" strokeOpacity="0.6" />
          <Path d="M 38.4,281.6 L 38.4,44.8 L 281.6,44.8"
            fill="none" stroke="#3dff9044" strokeWidth="3"
            strokeLinecap="round" strokeLinejoin="round" />

          {/* Carril Mid — diagonal */}
          <Line x1="38.4" y1="281.6" x2="281.6" y2="44.8"
            stroke="#1e4030" strokeWidth="22" />
          <Line x1="38.4" y1="281.6" x2="281.6" y2="44.8"
            stroke="#26543e" strokeWidth="10" strokeOpacity="0.6" />
          <Line x1="38.4" y1="281.6" x2="281.6" y2="44.8"
            stroke="#3dff9044" strokeWidth="3" />

          {/* Carril Bot — base inferior-izq → derecha → sube */}
          <Path d="M 38.4,281.6 L 281.6,281.6 L 281.6,44.8"
            fill="none" stroke="#1e4030" strokeWidth="22"
            strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M 38.4,281.6 L 281.6,281.6 L 281.6,44.8"
            fill="none" stroke="#26543e" strokeWidth="10"
            strokeLinecap="round" strokeLinejoin="round" strokeOpacity="0.6" />
          <Path d="M 38.4,281.6 L 281.6,281.6 L 281.6,44.8"
            fill="none" stroke="#3dff9044" strokeWidth="3"
            strokeLinecap="round" strokeLinejoin="round" />

          {/* Río — dos diagonales transversales */}
          <Path d="M 0,176 L 144,0" stroke="#0d2a40" strokeWidth="32" strokeLinecap="round" />
          <Path d="M 176,320 L 320,144" stroke="#0d2a40" strokeWidth="32" strokeLinecap="round" />
          <Path d="M 0,176 L 144,0" stroke="#1a4a6588" strokeWidth="14" strokeLinecap="round" />
          <Path d="M 176,320 L 320,144" stroke="#1a4a6588" strokeWidth="14" strokeLinecap="round" />

          {/* Base azul (esquina inferior-izquierda) */}
          <Circle cx="32" cy="288" r="22.4"
            fill="#0d1f4a" stroke="#2255cc66" strokeWidth="2" />
          <Circle cx="32" cy="288" r="11.2" fill="#3366ff55" />

          {/* Base roja (esquina superior-derecha) */}
          <Circle cx="288" cy="32" r="22.4"
            fill="#4a0d0d" stroke="#cc222266" strokeWidth="2" />
          <Circle cx="288" cy="32" r="11.2" fill="#ff333355" />

          {/* Zonas tocables — fill/stroke/strokeWidth dinámicos según hover/active */}

          {/* TOP — esquina sup-izq */}
          <Path
            d="M0,0 L155,0 L155,42 L42,42 L42,155 L0,155 Z"
            fill={activeZone==='TOP' ? 'rgba(231,76,60,0.28)' : hoveredZone==='TOP' ? 'rgba(231,76,60,0.15)' : 'rgba(231,76,60,0.04)'}
            stroke={activeZone==='TOP' ? 'rgba(231,76,60,0.90)' : hoveredZone==='TOP' ? 'rgba(231,76,60,0.55)' : 'rgba(231,76,60,0.18)'}
            strokeWidth={hoveredZone==='TOP' || activeZone==='TOP' ? 2.5 : 1.5}
            // En web react-native-svg NO dispara `onPress` sobre <Path>, así que
            // el toque no abría la tarjeta del rol → usamos onClick (DOM) en web
            // y onPress en nativo, igual que RoleSelectionMap.js (P2-7).
            {...(Platform.OS === 'web'
              ? { onClick: () => showCard('TOP'), style: { cursor: 'pointer' } }
              : { onPress: () => showCard('TOP') })}
            onMouseEnter={() => setHoveredZone('TOP')}
            onMouseLeave={() => setHoveredZone(null)}
          />

          {/* JUNGLE — dos cuadrantes */}
          <Path
            d="M42,42 L155,42 L155,155 L42,155 Z"
            fill={activeZone==='JUNGLE' ? 'rgba(46,204,113,0.28)' : hoveredZone==='JUNGLE' ? 'rgba(46,204,113,0.15)' : 'rgba(46,204,113,0.04)'}
            stroke={activeZone==='JUNGLE' ? 'rgba(46,204,113,0.90)' : hoveredZone==='JUNGLE' ? 'rgba(46,204,113,0.55)' : 'rgba(46,204,113,0.18)'}
            strokeWidth={hoveredZone==='JUNGLE' || activeZone==='JUNGLE' ? 2.5 : 1.5}
            {...(Platform.OS === 'web'
              ? { onClick: () => showCard('JUNGLE'), style: { cursor: 'pointer' } }
              : { onPress: () => showCard('JUNGLE') })}
            onMouseEnter={() => setHoveredZone('JUNGLE')}
            onMouseLeave={() => setHoveredZone(null)}
          />
          <Path
            d="M165,165 L278,165 L278,278 L165,278 Z"
            fill={activeZone==='JUNGLE' ? 'rgba(46,204,113,0.28)' : hoveredZone==='JUNGLE' ? 'rgba(46,204,113,0.15)' : 'rgba(46,204,113,0.04)'}
            stroke={activeZone==='JUNGLE' ? 'rgba(46,204,113,0.90)' : hoveredZone==='JUNGLE' ? 'rgba(46,204,113,0.55)' : 'rgba(46,204,113,0.18)'}
            strokeWidth={hoveredZone==='JUNGLE' || activeZone==='JUNGLE' ? 2.5 : 1.5}
            {...(Platform.OS === 'web'
              ? { onClick: () => showCard('JUNGLE'), style: { cursor: 'pointer' } }
              : { onPress: () => showCard('JUNGLE') })}
            onMouseEnter={() => setHoveredZone('JUNGLE')}
            onMouseLeave={() => setHoveredZone(null)}
          />

          {/* MID — rombo central */}
          <Path
            d="M160,110 L210,160 L160,210 L110,160 Z"
            fill={activeZone==='MID' ? 'rgba(34,211,238,0.28)' : hoveredZone==='MID' ? 'rgba(34,211,238,0.14)' : 'rgba(34,211,238,0.05)'}
            stroke={activeZone==='MID' ? 'rgba(34,211,238,0.90)' : hoveredZone==='MID' ? 'rgba(34,211,238,0.55)' : 'rgba(34,211,238,0.18)'}
            strokeWidth={hoveredZone==='MID' || activeZone==='MID' ? 2.5 : 1.5}
            {...(Platform.OS === 'web'
              ? { onClick: () => showCard('MID'), style: { cursor: 'pointer' } }
              : { onPress: () => showCard('MID') })}
            onMouseEnter={() => setHoveredZone('MID')}
            onMouseLeave={() => setHoveredZone(null)}
          />

          {/* BOT — esquina inf-der (ADC + SUPPORT) */}
          <Path
            d="M165,165 L320,165 L320,320 L165,320 Z"
            fill={activeZone==='BOT' ? 'rgba(243,156,18,0.22)' : hoveredZone==='BOT' ? 'rgba(243,156,18,0.12)' : 'rgba(243,156,18,0.04)'}
            stroke={activeZone==='BOT' ? 'rgba(243,156,18,0.80)' : hoveredZone==='BOT' ? 'rgba(243,156,18,0.50)' : 'rgba(243,156,18,0.14)'}
            strokeWidth={hoveredZone==='BOT' || activeZone==='BOT' ? 2.5 : 1.5}
            {...(Platform.OS === 'web'
              ? { onClick: () => showCard('BOT'), style: { cursor: 'pointer' } }
              : { onPress: () => showCard('BOT') })}
            onMouseEnter={() => setHoveredZone('BOT')}
            onMouseLeave={() => setHoveredZone(null)}
          />
        </Svg>

        {/* Etiquetas — glow en activa, opacity en inactivas */}
        <ZoneLabel label="TOP" color="#e74c3c" style={{ top: '8%',  left: '6%'  }}
          active={activeZone === 'TOP'}
          dimmed={!!activeZone && activeZone !== 'TOP'}
        />
        <ZoneLabel label="JG"  color="#2ecc71" style={{ top: '28%', left: '20%' }}
          active={activeZone === 'JUNGLE'}
          dimmed={!!activeZone && activeZone !== 'JUNGLE'}
        />
        <ZoneLabel label="JG"  color="#2ecc71" style={{ top: '63%', left: '63%' }}
          active={activeZone === 'JUNGLE'}
          dimmed={!!activeZone && activeZone !== 'JUNGLE'}
        />
        <ZoneLabel label="MID" color={ROLES.MID.color} style={{ top: '44%', left: '44%' }}
          active={activeZone === 'MID'}
          dimmed={!!activeZone && activeZone !== 'MID'}
        />
        <ZoneLabel label="BOT" color="#f39c12" style={{ top: '72%', left: '72%' }}
          active={activeZone === 'BOT'}
          dimmed={!!activeZone && activeZone !== 'BOT'}
        />
      </View>

      {/* Tooltip al hover (web) — renderizado fuera del mapa para evitar overflow */}
      <View style={{ width: MAP_SIZE }}>
        <ZoneTooltip zone={hoveredZone} visible={!!hoveredZone && !activeZone} />
      </View>

      {/* Selecciones */}
      {(pickedMain || pickedSec) && (
        <View style={[styles.selectionsRow, { width: MAP_SIZE }]}>
          {pickedMain && <SelectionBadge role={ROLES[pickedMain]} label="MAIN" />}
          {pickedSec  && <SelectionBadge role={ROLES[pickedSec]}  label="SECUNDARIO" />}
        </View>
      )}

      {/* CTA — NovaButton con color del rol main */}
      {canConfirm && (
        <View style={{ width: MAP_SIZE, marginTop: 12 }}>
          <NovaButton
            label="CONFIRMAR ROLES →"
            onPress={handleConfirm}
            factionColor={factionColor}
            size="lg"
          />
        </View>
      )}

      </ScrollView>

      {/* Carta CENTRAL (no bottom sheet) — animación spring + imagen del rol */}
      {activeZone && (
        <>
          <TouchableOpacity style={styles.backdrop} onPress={() => hideCard()} activeOpacity={1} />
          <View pointerEvents="box-none" style={styles.centralCardWrap}>
            <Animated.View
              style={[styles.centralCard, {
                transform: [{ scale: cardOpacity.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) }],
                opacity: cardOpacity,
                borderColor: activeZone
                  ? (ROLES[activeZone === 'BOT' ? 'ADC' : activeZone]?.color ?? c.primary) + '90'
                  : c.onSurface(0.15),
              }]}
            >
              {/* Scroll interno: el detalle del rol (T7) puede no caber en
                  pantallas bajas (~600px) — el CTA "ELEGIR…" siempre alcanzable. */}
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: 4 }}>
                {activeZone === 'BOT'
                  ? <BotCard
                      botChoice={botChoice}
                      setBotChoice={setBotChoice}
                      onSelect={selectRole}
                      phase={pickPhase}
                      pickedMain={pickedMain}
                    />
                  : <SingleRoleCard
                      role={ROLES[activeZone]}
                      zone={activeZone}
                      phase={pickPhase}
                      pickedMain={pickedMain}
                      onSelect={selectRole}
                      detail={ROLE_DETAIL[activeZone]}
                    />
                }
              </ScrollView>
              {/* Botón cerrar X */}
              <TouchableOpacity
                style={styles.centralCardClose}
                onPress={() => hideCard()}
                activeOpacity={0.7}
              >
                <Text style={styles.centralCardCloseText}>×</Text>
              </TouchableOpacity>
            </Animated.View>
          </View>
        </>
      )}

      {/* Flash de pantalla con el color del rol al confirmarlo */}
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFillObject,
          { backgroundColor: roleFlashColor, opacity: roleFlash, zIndex: 50 },
        ]}
      />
    </View>
  );
}

// ─── Sub-componentes ────────────────────────────────────────────────────────

// Botón de opción del test de personalidad. Spring scale 1→1.02 al pulsar
// y borde activo más vivo durante el press.
// T7 — `letter` (A/B/C…) unifica el estilo con el resto de cuestionarios
// (Playstyle/ChampionQuiz): badge con la letra a la izquierda del texto.
function TestOptionButton({ label, hint, letter, onPress }) {
  const { colors: c } = useTheme();
  const styles = useMemo(() => makeRoleQuizStyles(c), [c]);
  const scale     = useRef(new Animated.Value(1)).current;
  const [pressed, setPressed] = useState(false);

  const handlePressIn = () => {
    setPressed(true);
    Animated.spring(scale, { toValue: 1.02, friction: 6, tension: 120, useNativeDriver: true }).start();
  };
  const handlePressOut = () => {
    setPressed(false);
    Animated.spring(scale, { toValue: 1, friction: 6, tension: 120, useNativeDriver: true }).start();
  };

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        activeOpacity={1}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[
          styles.testOptionBtn,
          pressed && {
            backgroundColor: 'rgba(123,118,221,0.12)',
            borderColor:     c.primary,
            borderWidth:     1.5,
            ...(Platform.OS === 'web'
              ? { boxShadow: 'inset 0 0 20px rgba(123,118,221,0.08), 0 0 12px rgba(123,118,221,0.15)' }
              : { shadowColor: c.primary, shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 0 } }),
          },
        ]}
      >
        <View style={styles.testOptionRow}>
          {!!letter && <Text style={styles.testOptionLetter}>{letter}</Text>}
          <View style={{ flex: 1 }}>
            <Text style={styles.testOptionText}>{label}</Text>
            {!!hint && <Text style={styles.testOptionHint}>{hint}</Text>}
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// Tooltip que aparece al hacer hover sobre una zona del mapa (solo Web).
// Si la zona es BOT, muestra info de ADC + SUPPORT (es la única zona con
// dos roles posibles).
function ZoneTooltip({ zone, visible }) {
  const { colors: c, isDark } = useTheme();
  const opacity    = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(8)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity,    { toValue: visible ? 1 : 0, duration: 180, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: visible ? 0 : 8, duration: 180, useNativeDriver: true }),
    ]).start();
  }, [visible]);

  const effectiveZone = zone === 'BOT' ? 'ADC' : zone;
  const role    = effectiveZone ? ROLES[effectiveZone] : null;
  const tooltip = zone ? ROLE_TOOLTIPS[effectiveZone] : '';

  if (!role) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          backgroundColor: isDark ? 'rgba(10,10,20,0.96)' : c.bg2,
          borderWidth: 1,
          borderColor: role.color + '80',
          borderRadius: 8,
          padding: 10,
          marginTop: 8,
        },
        { opacity, transform: [{ translateY }] },
      ]}
    >
      <Text style={{ color: role.color, fontSize: TYPE_SCALE.micro.size, fontWeight: '900', letterSpacing: 2, marginBottom: 3 }}>
        {zone === 'BOT' ? 'BOT LANE (ADC / SUPPORT)' : role.label}
      </Text>
      <Text style={{ color: c.onSurface(0.78), fontSize: TYPE_SCALE.caption.size, lineHeight: 15 }}>{tooltip}</Text>
      {zone === 'BOT' && (
        <Text style={{ color: ROLES.SUPPORT.color, fontSize: TYPE_SCALE.micro.size, marginTop: 4, lineHeight: 14 }}>
          Support: {ROLE_TOOLTIPS.SUPPORT}
        </Text>
      )}
    </Animated.View>
  );
}

function ZoneLabel({ label, color, style, active = false, dimmed = false }) {
  const { colors: c } = useTheme();
  const styles = useMemo(() => makeRoleQuizStyles(c), [c]);
  return (
    // pointerEvents="none": las etiquetas son decorativas y se superponen a las
    // zonas <Path>. En web capturarían el click en la zona que cubren e impedirían
    // abrir la tarjeta; las dejamos pasar el evento al Path de debajo (D1).
    <View pointerEvents="none" style={[
      styles.zoneLabelWrap,
      style,
      { borderColor: color + '60', borderWidth: 1 },
      dimmed && { opacity: 0.5 },
      active && {
        shadowColor: c.primary,
        shadowRadius: 10,
        shadowOpacity: 0.85,
        shadowOffset: { width: 0, height: 0 },
        elevation: 6,
      },
    ]}>
      <Text style={[
        styles.zoneLabelText,
        {
          color,
          textShadowColor: color,
          textShadowOffset: { width: 0, height: 0 },
          textShadowRadius: active ? 10 : 6,
        },
      ]}>
        {label}
      </Text>
    </View>
  );
}

function SelectionBadge({ role, label }) {
  const { colors: c } = useTheme();
  const styles = useMemo(() => makeRoleQuizStyles(c), [c]);
  return (
    <View style={[styles.selectionBadge, { borderColor: role.color + '70' }]}>
      <Text style={styles.selectionMeta}>{label}</Text>
      <Text style={[styles.selectionName, { color: role.color }]}>{role.label}</Text>
    </View>
  );
}

function TraitBadge({ text, color }) {
  const { colors: c } = useTheme();
  const styles = useMemo(() => makeRoleQuizStyles(c), [c]);
  return (
    <View style={[styles.traitBadge, { borderColor: color + '55' }]}>
      <Text style={[styles.traitText, { color }]}>{text}</Text>
    </View>
  );
}

// H36-T7 — Detalle por rol: qué es, obligaciones para ganar y estilos con
// campeones de ejemplo. Textos cerrados (no dependen de meta ni de red). Se
// muestran en el bottom-sheet/card del mapa al tocar un rol; en el empate (T6)
// las cards se renderizan compactas (sin pasar `detail`).
const ROLE_DETAIL = {
  TOP: {
    what: 'La isla del 1v1. Ganas tu línea y decides cuándo convertir esa ventaja en presión para el equipo.',
    obligations: 'Gestionar oleadas (congelar/empujar), usar el TP para impactar el mapa y dar frontline o flanco en las teamfights.',
    styles: [
      { name: 'Splitpusher',        champs: 'Fiora · Tryndamere', note: 'Presión lateral constante: fuerzas al rival a elegir.' },
      { name: 'Rotador/teamfight',  champs: 'Shen · Malphite',    note: 'Apareces donde está la pelea con ult global o engage.' },
      { name: 'Lane bully',         champs: 'Darius · Renekton',  note: 'Dominas el early y cierras antes del minuto 25.' },
    ],
  },
  JUNGLE: {
    what: 'El director de orquesta. No tienes línea: tu línea es el mapa entero.',
    obligations: 'Ruta de camps eficiente, control de objetivos (dragones/heraldo/barón), gankear líneas ganables y leer dónde estará el jungla rival.',
    styles: [
      { name: 'Powerfarmer',     champs: 'Karthus · Graves',  note: 'Escalas más rápido que el rival y dominas mid-late.' },
      { name: 'Ganker temprano', champs: 'Elise · Jarvan IV', note: 'Conviertes líneas en bolas de nieve antes del 10.' },
      { name: 'Control/utility', champs: 'Sejuani · Maokai',  note: 'Engage y visión para tu equipo.' },
    ],
  },
  MID: {
    what: 'El centro del tablero. La línea más corta: máximo tempo para influir en todo el mapa.',
    obligations: 'Prioridad de oleada para rotar antes que el rival, acompañar a tu jungla a los objetivos y gestionar la visión del río.',
    styles: [
      { name: 'Roamer',          champs: 'Twisted Fate · Galio', note: 'Conviertes tu prioridad en ventajas para otras líneas.' },
      { name: 'Mago de control', champs: 'Orianna · Viktor',     note: 'Escalas y mandas en las teamfights.' },
      { name: 'Asesino',         champs: 'Zed · Talon',          note: 'Eliminas al carry rival y abres la partida.' },
    ],
  },
  ADC: {
    what: 'El daño que decide el late. Frágil pero letal: tu trabajo es llegar vivo al minuto 30 haciendo daño constante.',
    obligations: 'Farmear casi perfecto (el oro es tu escalado), posicionarte detrás del frontline y tocar torres/objetivos cuando hay ventana.',
    styles: [
      { name: 'Hypercarry', champs: "Jinx · Kog'Maw",   note: 'Débil al inicio, imparable si llegas.' },
      { name: 'Lane bully', champs: 'Draven · Lucian',  note: 'Dominas la fase de líneas y cierras pronto.' },
      { name: 'Utility',    champs: 'Ashe · Jhin',      note: 'Control y visión además de daño.' },
    ],
  },
  SUPPORT: {
    what: 'El cerebro del bot lane y los ojos del equipo. El rol con más impacto por minuto sin necesitar oro.',
    obligations: 'Control de visión (poner Y quitar wards), proteger o iniciar según tu campeón y rotar a mid tras la fase de líneas.',
    styles: [
      { name: 'Engage',     champs: 'Leona · Nautilus', note: 'Inicias las peleas y marcas el tempo.' },
      { name: 'Enchanter',  champs: 'Lulu · Janna',     note: 'Mantienes vivo a tu carry y reviertes engages.' },
      { name: 'Poke/mage',  champs: 'Brand · Xerath',   note: 'Conviertes la línea en una zona de castigo.' },
    ],
  },
};

// D1b — Descripción ENRIQUECIDA por rol: «título» + QUÉ IMPLICA / FUNCIÓN /
// OBLIGACIONES. Estos textos estaban por error en RoleConstellationScreen.js
// (que NO es la pantalla activa del onboarding); se replican aquí para que
// aparezcan en la TARJETA de rol al tocar cada zona del mapa. Textos cerrados
// (no dependen de red ni de meta).
const ROLE_IMPLICATIONS = {
  TOP: {
    title: 'La Isla Solitaria',
    implies:
      'Jugar aislado los primeros 15 minutos: paciencia, duelos 1v1 y sobrevivir sin ayuda de la jungla.',
    role:
      'Línea de frente (frontline): el escudo o la fuerza bruta que absorbe daño por el equipo.',
    duties:
      'Controlar el empuje (split push), iniciar peleas con control de masas y usar el teleport de forma estratégica hacia bot u objetivos.',
  },
  JUNGLE: {
    title: 'El Motor del Equipo',
    implies:
      'No tener línea fija: mapa mental constante, rastrear al jungla rival y gestionar tus campamentos.',
    role:
      'Director de orquesta: marcas el ritmo, creas superioridad con ganks y aseguras a los monstruos épicos.',
    duties:
      'Asegurar objetivos con Smite (dragones, larvas, Barón), dar ventaja a la línea con más potencial y avisar la posición del jungla enemigo.',
  },
  MID: {
    title: 'El Núcleo del Mapa',
    implies:
      'La línea más corta y peligrosa, gankeable por ambos lados: exige reflejos mecánicos.',
    role:
      'Daño explosivo y control de mapa: conectas el top con el bot.',
    duties:
      'Rotar/roamear tras limpiar la oleada, borrar objetivos prioritarios (ADC/Mid rival) y mantener la torre central.',
  },
  ADC: {
    title: 'El Seguro de Vida',
    implies:
      'Dependes del support en el early y de un posicionamiento perfecto en cada pelea.',
    role:
      'Daño constante y derribo de estructuras: la ametralladora del late game.',
    duties:
      'Farmear a la perfección, priorizar la supervivencia y liderar el asedio a torres y objetivos.',
  },
  SUPPORT: {
    title: 'El Cerebro Táctico',
    implies:
      'Sacrificar economía (no farmeas) para potenciar a tu ADC: visión y generosidad.',
    role:
      'Utilidad, protección y control de mapa: el guardaespaldas del equipo.',
    duties:
      'Guerra de visión (wards), peel/protección activa al carry y control del mapa temprano junto al jungla.',
  },
};

// Sección de detalle del rol. Muestra la descripción enriquecida (D1b):
// «título» + QUÉ IMPLICA / FUNCIÓN / OBLIGACIONES, y debajo los ESTILOS con
// campeones de ejemplo (H36-T7). Las antiguas "QUÉ ES" y "OBLIGACIONES PARA
// GANAR" quedan cubiertas por las secciones enriquecidas, así que no se
// duplican. Presentacional.
function RoleDetailSection({ detail, impl, color }) {
  const { colors: c } = useTheme();
  const styles = useMemo(() => makeRoleQuizStyles(c), [c]);
  if (!detail && !impl) return null;
  return (
    <View style={{ marginTop: 4, marginBottom: 14, gap: 12 }}>
      {impl && (
        <>
          <Text style={[styles.detailImplTitle, { color }]}>«{impl.title}»</Text>
          <View>
            <Text style={[styles.detailHeading, { color: color + 'CC' }]}>QUÉ IMPLICA</Text>
            <Text style={styles.detailBody}>{impl.implies}</Text>
          </View>
          <View>
            <Text style={[styles.detailHeading, { color: color + 'CC' }]}>FUNCIÓN</Text>
            <Text style={styles.detailBody}>{impl.role}</Text>
          </View>
          <View>
            <Text style={[styles.detailHeading, { color: color + 'CC' }]}>OBLIGACIONES</Text>
            <Text style={styles.detailBody}>{impl.duties}</Text>
          </View>
        </>
      )}
      {detail && (
        <View>
          <Text style={[styles.detailHeading, { color: color + 'CC' }]}>ESTILOS</Text>
          {detail.styles.map((s) => (
            <View key={s.name} style={{ marginTop: 6 }}>
              <Text style={styles.detailStyleName}>
                <Text style={{ color, fontWeight: '900' }}>{s.name}</Text>
                <Text style={{ color: c.onSurface(0.45), fontWeight: '700' }}>  ·  {s.champs}</Text>
              </Text>
              <Text style={styles.detailStyleNote}>{s.note}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function SingleRoleCard({ role, zone, phase, pickedMain, onSelect, detail }) {
  const { colors: c } = useTheme();
  const styles = useMemo(() => makeRoleQuizStyles(c), [c]);
  const isSameAsMain = phase === 'secondary' && pickedMain === zone;
  const champName = ROLE_CHAMPS[zone] || 'Jinx';
  return (
    <View>
      {/* Splash del campeón representativo del rol con degradado inferior
          y nombre del rol superpuesto. Sustituye al RoleLogo plano. */}
      <View style={{ width: '100%', height: 160, borderRadius: 10, overflow: 'hidden', marginBottom: 12 }}>
        <Image
          source={{ uri: splashUrl(champName) }}
          style={[
            { width: '100%', height: '100%' },
            // T10 — encuadre alto en web: en contenedores anchos/bajos el splash
            // recortaba la cabeza (Garen). objectPosition sesga hacia la parte
            // superior para que la cara quede siempre visible.
            Platform.OS === 'web' ? { objectFit: 'cover', objectPosition: '50% 22%' } : null,
          ]}
          resizeMode="cover"
        />
        {/* Degradado inferior simulado con 3 Views apiladas (no hay
            expo-linear-gradient en el bundle). Cubren los últimos 80px
            con opacidades crecientes para legibilidad del nombre. */}
        <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 80, backgroundColor: 'rgba(7,7,13,0.4)' }} />
        <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 50, backgroundColor: 'rgba(7,7,13,0.7)' }} />
        <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 25, backgroundColor: 'rgba(7,7,13,0.95)' }} />
        <Text style={{
          position: 'absolute', bottom: 10, left: 12,
          color: role.color, fontSize: TYPE_SCALE.h6.size, fontWeight: '900', letterSpacing: 1,
          textShadowColor: 'rgba(0,0,0,0.85)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4,
        }}>
          {role.label}
        </Text>
      </View>
      <Text style={[styles.cardRoleDesc, { textAlign: 'center', marginBottom: 16 }]}>
        {role.desc}
      </Text>
      <View style={styles.traitsRow}>
        {role.traits.map(t => <TraitBadge key={t} text={t} color={role.color} />)}
      </View>

      {/* Detalle del rol: descripción enriquecida (D1b) + estilos (H36-T7).
          Solo en el sheet del mapa; en el empate no se pasa `detail`/`zone`. */}
      <RoleDetailSection detail={detail} impl={ROLE_IMPLICATIONS[zone]} color={role.color} />

      <TouchableOpacity
        style={[
          styles.cardSelectBtn,
          { backgroundColor: role.color + '22', borderColor: role.color + '75' },
          isSameAsMain && styles.cardSelectBtnDisabled,
        ]}
        onPress={() => { if (!isSameAsMain) onSelect(zone); }}
        activeOpacity={0.85}
        disabled={isSameAsMain}
      >
        <Text style={[styles.cardSelectText, { color: role.color }]}>
          {isSameAsMain
            ? 'Ya es tu rol principal'
            : phase === 'main'
              ? `ELEGIR ${role.label} COMO MAIN`
              : `ELEGIR COMO SECUNDARIO`}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

function BotCard({ botChoice, setBotChoice, onSelect, phase, pickedMain }) {
  const { colors: c } = useTheme();
  const styles = useMemo(() => makeRoleQuizStyles(c), [c]);
  return (
    <View>
      <Text style={styles.cardBotTitle}>BOT LANE</Text>
      <Text style={styles.cardBotSubtitle}>¿Cuál es tu posición en bot?</Text>
      <View style={styles.botRow}>
        {['ADC', 'SUPPORT'].map(roleId => {
          const r = ROLES[roleId];
          const chosen = botChoice === roleId;
          const isSameAsMain = phase === 'secondary' && pickedMain === roleId;
          return (
            <TouchableOpacity
              key={roleId}
              style={[
                styles.botCard,
                { borderColor: chosen ? r.color : c.onSurface(0.1) },
                chosen && { backgroundColor: r.color + '14' },
                isSameAsMain && { opacity: 0.35 },
              ]}
              onPress={() => { if (!isSameAsMain) setBotChoice(roleId); }}
              activeOpacity={0.85}
              disabled={isSameAsMain}
            >
              {/* punto 4 : splash del campeón
                  representativo en vez de RoleLogo — el PNG tintado renderizaba
                  un rectángulo sólido naranja/cian. Estandariza con el resto
                  de cards de rol. */}
              <View style={{ width: '100%', height: 92, borderRadius: 8, overflow: 'hidden', marginBottom: 8 }}>
                <Image
                  source={{ uri: splashUrl(ROLE_CHAMPS[roleId] || 'Jinx') }}
                  style={{ width: '100%', height: '100%' }}
                  resizeMode="cover"
                />
                <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 30, backgroundColor: 'rgba(7,7,13,0.55)' }} />
              </View>
              <Text style={[styles.botName,  { color: chosen ? r.color : c.textPrimary }]}>{r.label}</Text>
              <Text style={styles.botDesc}>{r.desc}</Text>
              <View style={styles.botTraits}>
                {r.traits.map(t => <TraitBadge key={t} text={t} color={r.color} />)}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
      {/* Al elegir ADC o SUPPORT, su detalle: descripción enriquecida (D1b) + estilos */}
      {botChoice && (
        <RoleDetailSection
          detail={ROLE_DETAIL[botChoice]}
          impl={ROLE_IMPLICATIONS[botChoice]}
          color={ROLES[botChoice].color}
        />
      )}

      {botChoice && (
        <TouchableOpacity
          style={[
            styles.cardSelectBtn,
            { backgroundColor: ROLES[botChoice].color + '22', borderColor: ROLES[botChoice].color + '75' },
          ]}
          onPress={() => onSelect(botChoice)}
          activeOpacity={0.85}
        >
          <Text style={[styles.cardSelectText, { color: ROLES[botChoice].color }]}>
            {phase === 'main'
              ? `ELEGIR ${ROLES[botChoice].label} COMO MAIN`
              : `ELEGIR COMO SECUNDARIO`}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Estilos (StyleSheet ≈ CSS / res/values styles.xml de Android) ────────────
// StyleSheet.create agrupa los estilos como objetos reutilizables, igual que una
// hoja CSS o los recursos de estilo de Android. Se referencian por nombre desde
// el JSX (p. ej. style={styles.container}).
const makeRoleQuizStyles = (c) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg0 },
  header: { padding: 20, paddingTop: 56, paddingBottom: 12 },
  progressTag: { color: 'rgba(123,118,221,0.55)', fontSize: TYPE_SCALE.micro.size, letterSpacing: 3, fontWeight: '900', marginBottom: 10, marginLeft: 6 },
  title: {
    color: c.textPrimary, fontSize: TYPE_SCALE.h3.size, fontWeight: '900', letterSpacing: 2,
    textShadowColor: c.onSurface(0.15), textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 8,
  },
  subtitle: { color: c.onSurface(0.45), fontSize: TYPE_SCALE.caption.size, lineHeight: 17, marginTop: 6 },

  // ─── Onboarding step indicator ●●●○ ──────────────────────────────────
  onboardingStepRow: {
    flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 14,
  },
  onboardingStepFilled: {
    width: 22, height: 6, borderRadius: 3, backgroundColor: c.primary,
    ...(Platform.OS === 'web'
      ? {}
      : { shadowColor: c.primary, shadowOpacity: 0.7, shadowRadius: 5, shadowOffset: { width: 0, height: 0 } }),
  },
  onboardingStepEmpty: {
    width: 6, height: 6, borderRadius: 3, backgroundColor: c.onSurface(0.15),
  },
  onboardingStepLabel: {
    color: 'rgba(123,118,221,0.55)', fontSize: TYPE_SCALE.micro.size, fontWeight: '900', letterSpacing: 3, marginLeft: 4,
  },

  // ─── Question progress dots ───────────────────────────────────────────
  dotProgressRow: {
    flexDirection: 'row', gap: 8, justifyContent: 'center',
    marginBottom: 12,
  },
  dotProgress: {
    width: 10, height: 10, borderRadius: 5,
  },

  // ─── Fase 'result' — badge "ROL RECOMENDADO" ──────────────────────────
  resultRecommendedBadge: {
    backgroundColor: 'rgba(123,118,221,0.12)',
    borderWidth: 1, borderColor: 'rgba(123,118,221,0.5)',
    borderRadius: 4, paddingHorizontal: 10, paddingVertical: 4,
  },
  resultRecommendedBadgeText: {
    color: c.primary, fontSize: TYPE_SCALE.micro.size, fontWeight: '900', letterSpacing: 2,
  },

  // ─── Fase 'test' ────────────────────────────────────────────────────────
  progressBarWrap: {
    height: 3, marginTop: 60, marginHorizontal: 20,
    backgroundColor: 'rgba(123,118,221,0.10)', borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: 3, backgroundColor: c.primary,
  },
  testScroll: {
    flexGrow: 1,
    paddingHorizontal: 24, paddingTop: 28, paddingBottom: 60,
  },
  testQuestionText: {
    fontSize: TYPE_SCALE.h4.size, fontWeight: '900', color: c.textPrimary,
    textAlign: 'center', marginBottom: 36, lineHeight: 32, marginTop: 16,
    textShadowColor: c.onSurface(0.1),
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  testOptionsWrap: { gap: 12 },
  testOptionBtn: {
    backgroundColor: 'rgba(123,118,221,0.03)',
    borderWidth: 1, borderColor: 'rgba(123,118,221,0.18)',
    borderRadius: 14,
    paddingVertical: 20, paddingHorizontal: 22,
  },
  testOptionRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  testOptionLetter: {
    color: c.primary, fontSize: TYPE_SCALE.label.size, fontWeight: '900',
    width: 28, height: 28, textAlign: 'center', lineHeight: 28,
    backgroundColor: 'rgba(123,118,221,0.15)', borderRadius: 6,
  },
  testOptionText: {
    fontSize: TYPE_SCALE.body.size, color: c.onSurface(0.88), lineHeight: 22,
    fontWeight: '500',
  },
  testOptionHint: {
    fontSize: TYPE_SCALE.micro.size, color: c.onSurface(0.4),
    fontStyle: 'italic', marginTop: 6, letterSpacing: 0.5,
  },

  // ─── Fase 'result' ──────────────────────────────────────────────────────
  resultScroll: {
    flexGrow: 1,
    paddingHorizontal: 24, paddingTop: 56, paddingBottom: 60,
  },
  resultPortrait: {
    width: '100%', height: 220, borderRadius: 14, overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  resultPortraitGradient: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(7,7,13,0.45)',
  },
  resultRoleOverlay: {
    padding: 16,
    flexDirection: 'row', alignItems: 'flex-end', gap: 10,
  },
  resultRoleGlyph: {
    fontSize: TYPE_SCALE.h1.size, color: '#FFD700',
    textShadowColor: '#FFD700', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 16,
  },
  resultRoleName: {
    fontSize: TYPE_SCALE.h1.size, fontWeight: '900', letterSpacing: 2,
  },
  resultDesc: {
    fontSize: TYPE_SCALE.label.size, color: c.onSurface(0.65),
    textAlign: 'center', marginTop: 16, lineHeight: 22, paddingHorizontal: 8,
  },
  resultTraitsRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 6,
    justifyContent: 'center', marginTop: 12,
  },
  resultTraitChip: {
    borderWidth: 1, borderColor: 'rgba(255,215,0,0.35)',
    backgroundColor: 'rgba(255,215,0,0.06)',
    borderRadius: 4, paddingHorizontal: 10, paddingVertical: 4,
  },
  resultTraitText: {
    color: '#FFD700', fontSize: TYPE_SCALE.micro.size, fontWeight: '700', letterSpacing: 1.5,
  },
  resultHint: {
    fontSize: TYPE_SCALE.caption.size, color: c.onSurface(0.3),
    letterSpacing: 1.5, marginTop: 10, textAlign: 'center',
  },
  resultSubLine: {
    fontSize: TYPE_SCALE.label.size, color: c.onSurface(0.7),
    marginTop: 8, textAlign: 'center',
  },

  // ─── Fase 'map' — layout centrado ────────────────────────────────────────
  mapScrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    paddingBottom: 40,
  },
  mapPhaseHeader: {
    width: '100%',
    maxWidth: 440,
    paddingHorizontal: 24,
    paddingTop: 56,
    paddingBottom: 12,
  },

  mapWrap: { alignSelf: 'center', position: 'relative' },

  zoneLabelWrap: {
    position: 'absolute',
    backgroundColor: 'rgba(7,7,13,0.82)',
    borderRadius: 4,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  zoneLabelText: { fontSize: TYPE_SCALE.caption.size, fontWeight: '900', letterSpacing: 2 },

  selectionsRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, marginTop: 14 },
  selectionBadge: {
    flex: 1, borderWidth: 1, borderRadius: 8, padding: 10,
    backgroundColor: c.onSurface(0.03),
  },
  selectionMeta: { color: c.onSurface(0.35), fontSize: TYPE_SCALE.micro.size, letterSpacing: 2, fontWeight: '900' },
  selectionName: { fontSize: TYPE_SCALE.label.size, fontWeight: '900', letterSpacing: 1.5, marginTop: 3 },

  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 10 },

  // Carta CENTRAL (no bottom sheet) — modal flotante con animación spring
  centralCardWrap: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
    alignItems: 'center', justifyContent: 'center',
    padding: 20,
  },
  centralCard: {
    width: '100%', maxWidth: 480,
    maxHeight: '88%',
    // B4.5 — elevación dark-mode by design: la tarjeta de rol usa bg2 sólido
    // (no surface translúcida) para "surgir" del fondo del mapa.
    backgroundColor: c.bg2,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: c.onSurface(0.12),
    padding: 24, paddingTop: 28,
    shadowColor: '#000', shadowOpacity: 0.5,
    shadowRadius: 20, shadowOffset: { width: 0, height: 8 },
    elevation: 12,
    ...(Platform.OS === 'web'
      ? { backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }
      : {}),
  },
  centralCardClose: {
    position: 'absolute', top: 8, right: 12,
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: c.onSurface(0.05),
  },
  centralCardCloseText: {
    color: c.onSurface(0.7), fontSize: TYPE_SCALE.h4.size, fontWeight: '300',
    lineHeight: 24,
  },

  // Legacy bottom-sheet (ya no se usa, pero deja los styles por si algo lo referencia)
  card: {
    position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 20,
    backgroundColor: c.bg1,
    borderTopWidth: 1, borderTopColor: c.onSurface(0.1),
    borderTopLeftRadius: 18, borderTopRightRadius: 18,
    padding: 20, paddingBottom: 36,
  },

  cardHeader:   { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 12 },
  cardGlyph:    { fontSize: TYPE_SCALE.h2.size, fontWeight: '900' },
  cardRoleName: { fontSize: TYPE_SCALE.h6.size, fontWeight: '900', letterSpacing: 2 },
  cardRoleDesc: { color: c.onSurface(0.52), fontSize: TYPE_SCALE.caption.size, marginTop: 3, lineHeight: 17 },

  // H36-T7 — estilos del detalle de rol (qué es / obligaciones / estilos).
  // D1b — título enriquecido del rol («La Isla Solitaria», etc.).
  detailImplTitle: { fontSize: TYPE_SCALE.label.size, fontWeight: '900', letterSpacing: 0.5, fontStyle: 'italic' },
  detailHeading: { fontSize: TYPE_SCALE.micro.size, fontWeight: '900', letterSpacing: 1.5, marginBottom: 3 },
  detailBody: { color: c.onSurface(0.7), fontSize: TYPE_SCALE.caption.size, lineHeight: 18 },
  detailStyleName: { fontSize: TYPE_SCALE.caption.size, letterSpacing: 0.3 },
  detailStyleNote: { color: c.onSurface(0.5), fontSize: TYPE_SCALE.micro.size, lineHeight: 15, marginTop: 1 },

  traitsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 16 },
  traitBadge: {
    borderWidth: 1, borderRadius: 4,
    paddingHorizontal: 8, paddingVertical: 3,
    backgroundColor: c.onSurface(0.03),
  },
  traitText: { fontSize: TYPE_SCALE.micro.size, fontWeight: '700', letterSpacing: 1 },

  cardSelectBtn: {
    borderWidth: 1.5, borderRadius: 8,
    paddingVertical: 13, alignItems: 'center', marginTop: 4,
  },
  cardSelectBtnDisabled: { opacity: 0.32 },
  cardSelectText: { fontSize: TYPE_SCALE.caption.size, fontWeight: '900', letterSpacing: 2 },

  cardBotTitle:    { color: c.textPrimary, fontSize: TYPE_SCALE.h6.size, fontWeight: '900', letterSpacing: 2, marginBottom: 4 },
  cardBotSubtitle: { color: c.onSurface(0.42), fontSize: TYPE_SCALE.caption.size, marginBottom: 14 },

  botRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  botCard: {
    flex: 1, borderWidth: 1.5, borderRadius: 10, padding: 12,
    backgroundColor: c.onSurface(0.03),
  },
  botGlyph:  { fontSize: TYPE_SCALE.h4.size, marginBottom: 6 },
  botName:   { fontSize: TYPE_SCALE.label.size, fontWeight: '900', letterSpacing: 1.5, marginBottom: 5 },
  botDesc:   { color: c.onSurface(0.48), fontSize: TYPE_SCALE.caption.size, lineHeight: 15, marginBottom: 8 },
  botTraits: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
});
