// ============================================================================
// App.js — raíz de la app y gate de navegación (Auth · Onboarding · App)
// ----------------------------------------------------------------------------
// Esta es la clase que decide QUÉ pantalla ve el usuario. Usa el patrón
// "Authentication Flow" de React Navigation (pantallas condicionales): el
// navigator cambia solo cuando el usuario de UserContext cambia, sin necesidad
// de navigation.reset() manual desde las pantallas de auth.
//
// Reglas del gate (en GateNavigator, según el objeto user del contexto):
//   user == null                      → stack de Auth (Login + Register)
//   user.mock == true                 → AppTabs   (cuenta demo, salta onboarding)
//   user.setup_complete == false      → stack de Onboarding (los 5 pasos)
//   user.setup_complete == true       → AppTabs   (Live · Forge · Profile · Admin)
// ============================================================================
import React, { useContext, useEffect, useState } from 'react';
import { Text, View, StyleSheet, Platform, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import {
  useFonts,
  Rajdhani_400Regular,
  Rajdhani_500Medium,
  Rajdhani_600SemiBold,
  Rajdhani_700Bold,
} from '@expo-google-fonts/rajdhani';

// Contextos
import { RiotContext, RiotProvider } from './src/context/RiotContext';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { UserProvider, useUser }    from './src/context/UserContext';
import { DEV_AUTO_LOGIN_MOCK, DEV_MOCK_USER } from './src/config/devConfig';

// Auth screens
import LoginScreen    from './src/screens/auth/LoginScreen';
import RegisterScreen from './src/screens/auth/RegisterScreen';

// Splash post-login (P6)
import SplashScreen   from './src/screens/SplashScreen';
import WelcomeScreen  from './src/screens/onboarding/WelcomeScreen';

// Onboarding screens (5 pasos del flow)
import RoleQuizScreen          from './src/screens/onboarding/RoleQuizScreen';
import RoleConstellationScreen from './src/screens/onboarding/RoleConstellationScreen';
import PlaystyleTestScreen     from './src/screens/onboarding/PlaystyleTestScreen';
import ChampionQuizScreen      from './src/screens/onboarding/ChampionQuizScreen';
import ChampionPickScreen      from './src/screens/onboarding/ChampionPickScreen';
import { OnboardingProvider }  from './src/screens/onboarding/OnboardingContext';

// App principal
import LiveScreen    from './src/screens/LiveScreen';
import ForgeScreen   from './src/screens/ForgeScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import AdminScreen   from './src/screens/AdminScreen';
import { isAdminUser } from './src/config/adminConfig';
// El gate de admin usa el claim 'role' del JWT (via user context)
// con fallback a la lista hardcoded de adminConfig para demos sin backend.

// Solo desarrollo — catálogo vivo de componentes. La ruta se registra
// abajo únicamente bajo __DEV__.
import ComponentShowcaseScreen from './src/screens/dev/ComponentShowcaseScreen';

// Radar flotante global — persiste minimizado al cambiar de tab.
// F0 — El widget flotante (FloatingRadarWidget) se RETIRÓ del árbol: en partida
// duplicaba el HUD ("<campeón> · ADC · EN VIVO · FLASH DOWN · SIGUIENTE ÍTEM").
// Se conserva el RadarProvider porque LiveScreen sigue leyendo/escribiendo la
// gameSession del contexto; sólo dejamos de renderizar el widget.
import { RadarProvider } from './src/context/RadarContext';

const RootStack = createStackNavigator();
const Tab       = createBottomTabNavigator();

// Tema del NavigationContainer: sin él, React Navigation pinta el contenedor
// con su DefaultTheme BLANCO y cualquier cross-fade de cards lo deja asomar
// (flash blanco en las transiciones del onboarding — B1.1). bg0 siempre.
const NAV_THEME = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: '#07070d',
    card:       '#07070d',
  },
};

// ─── Tab bar ─────────────────────────────────────────────────────────────────
function TabBarItem({ glyph, label, color, focused, theme }) {
  return (
    <View style={styles.tabItem}>
      <View
        style={[
          styles.tabIconWrap,
          focused && {
            backgroundColor: theme.primary + '22',
            borderColor:     theme.primary,
            shadowColor:     theme.primary,
            shadowOpacity:   0.6,
            shadowRadius:    8,
            elevation:       6,
          },
        ]}
      >
        <Text style={[styles.tabGlyph, { color }]}>{glyph}</Text>
      </View>
      <Text style={[styles.tabLabel, { color, fontWeight: focused ? '900' : '600' }]}>
        {label}
      </Text>
      {focused && (
        <View
          style={[
            styles.tabActiveBar,
            { backgroundColor: theme.primary, shadowColor: theme.primary },
          ]}
        />
      )}
    </View>
  );
}

// ─── Tabs de la app principal ────────────────────────────────────────────────
// El widget flotante de radar vive como hermano del Tab.Navigator dentro de un
// View flex:1 + RadarProvider, así persiste minimizado al navegar entre tabs.
function AppTabs() {
  return (
    <RadarProvider>
      <View style={{ flex: 1 }}>
        <AppTabsInner />
        {/* F0 — sin <FloatingRadarWidget />: el HUD de partida es la única
            superficie en vivo; el widget flotante residual ya no se monta. */}
      </View>
    </RadarProvider>
  );
}

function AppTabsInner() {
  const { theme } = useContext(RiotContext);
  const { colors, isDark } = useTheme();
  const { user }  = useUser();
  // Gate de admin: primero comprueba el rol del JWT, fallback a lista hardcoded
  const showAdmin = user?.role === 'ADMIN' || isAdminUser(user?.riotId || user?.username);
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown:       false,
        tabBarShowLabel:   false,
        tabBarStyle: {
          backgroundColor: isDark ? 'rgba(4,10,6,0.92)' : 'rgba(255,255,255,0.96)',
          borderTopColor:  isDark ? theme.primary + '22' : colors.border,
          borderTopWidth:  1,
          height:          72,
          paddingBottom:   10,
          paddingTop:      8,
          ...(Platform.OS === 'web'
            ? { backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }
            : {}),
          shadowColor:     theme.primary,
          shadowOpacity:   0.15,
          shadowRadius:    14,
          shadowOffset:    { width: 0, height: -4 },
          elevation:       16,
        },
        tabBarActiveTintColor:   theme.primary,
        tabBarInactiveTintColor: isDark ? '#5b6b62' : '#9a96b8',
      }}
    >
      <Tab.Screen
        name="Live"
        component={LiveScreen}
        options={{
          tabBarIcon: ({ focused, color }) => (
            <TabBarItem glyph="◉" label="LIVE-RIFT" color={color} focused={focused} theme={theme} />
          ),
        }}
      />
      <Tab.Screen
        name="Forge"
        component={ForgeScreen}
        options={{
          tabBarIcon: ({ focused, color }) => (
            <TabBarItem glyph="⚒" label="ELO-FORGE" color={color} focused={focused} theme={theme} />
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarIcon: ({ focused, color }) => (
            <TabBarItem glyph="⬡" label="IDENTITY" color={color} focused={focused} theme={theme} />
          ),
        }}
      />
      {showAdmin && (
        <Tab.Screen
          name="Admin"
          component={AdminScreen}
          options={{
            tabBarIcon: ({ focused, color }) => (
              <TabBarItem
                glyph="⚙"
                label="ADMIN"
                color={focused ? '#ff4444' : color}
                focused={focused}
                theme={{ ...theme, primary: '#ff4444' }}
              />
            ),
            tabBarActiveTintColor: '#ff4444',
          }}
        />
      )}
    </Tab.Navigator>
  );
}

// ─── Pantalla de carga ───────────────────────────────────────────────────────
function LoadingScreen() {
  const { theme } = useContext(RiotContext);
  return (
    <View style={[styles.loaderWrap, { backgroundColor: theme.background }]}>
      <ActivityIndicator color={theme.primary} size="large" />
      <Text style={{ color: theme.primary + '88', marginTop: 12, letterSpacing: 2, fontSize: 11 }}>
        NOVA RIFT
      </Text>
    </View>
  );
}

// ─── Gate Navigator (corazón del patrón Auth Flow) ───────────────────────────
// Cuando user cambia, React Navigation automáticamente transiciona al stack correcto.
// No hace falta navigation.reset() en ninguna pantalla de auth o onboarding.
//
// Splash post-login: si Login/Register/Demo guardaron el flag
// novarift_just_logged_in, mostramos SplashScreen 2.2s sobre el navigator.
function GateNavigator() {
  const { user, setUser, loading } = useUser();
  const [showSplash,  setShowSplash]  = useState(false);
  // Overlay de bienvenida post-onboarding. Se muestra una sola vez cuando
  // AsyncStorage tiene la flag `novarift_show_welcome`. El CTA de la pantalla
  // limpia la flag y deja AppTabs por debajo.
  const [showWelcome, setShowWelcome] = useState(false);

  // Detectar el flag cada vez que `user` cambia (login/register/demo)
  useEffect(() => {
    if (!user) return;
    (async () => {
      const flag = await AsyncStorage.getItem('novarift_just_logged_in').catch(() => null);
      if (flag) {
        await AsyncStorage.removeItem('novarift_just_logged_in').catch(() => {});
        // B1.1 — la cinemática solo sobre AppTabs: si el usuario va al
        // onboarding (needsSetup), la estrella quedaba ~3s superpuesta a
        // RoleQuiz (ya interactiva). Se consume el flag sin reproducirla.
        if (user.mock || user.setup_complete) setShowSplash(true);
      }
      // Sólo mostrar Welcome cuando el setup está completo (evita que aparezca
      // durante el flujo de onboarding antes de cerrarlo).
      if (user.setup_complete) {
        const wflag = await AsyncStorage.getItem('novarift_show_welcome').catch(() => null);
        if (wflag) setShowWelcome(true);
      }
    })();
  }, [user]);

  // Auto-login mock para iteración interna. Cuando `DEV_AUTO_LOGIN_MOCK === true`
  // (devConfig) y no hay sesión, inyecta el usuario mock saltándose el Login. Por
  // defecto el flag es false → flujo normal. No activar en producción.
  useEffect(() => {
    if (loading) return;
    if (user) return;
    if (!DEV_AUTO_LOGIN_MOCK) return;
    setUser({ ...DEV_MOCK_USER });
  }, [loading, user, setUser]);

  if (loading) return <LoadingScreen />;

  const isLoggedIn = !!user;
  const needsSetup = isLoggedIn && !user.mock && !user.setup_complete;

  const navigatorScreenOptions = {
    headerShown: false,
    // B1.1 — cardStyle fija el fondo de CADA card a bg0 y detachPreviousScreen
    // mantiene montada la pantalla saliente durante el cross-fade: sin ambos,
    // el fade de opacidad destapa el fondo del navigator (blanco por defecto).
    cardStyle: { backgroundColor: '#07070d' },
    detachPreviousScreen: false,
    cardStyleInterpolator: ({ current }) => ({
      cardStyle: { opacity: current.progress },
    }),
  };

  return (
    <React.Fragment>
      <RootStack.Navigator screenOptions={navigatorScreenOptions}>
        {!isLoggedIn ? (
          <React.Fragment>
            <RootStack.Screen name="Login"    component={LoginScreen} />
            <RootStack.Screen name="Register" component={RegisterScreen} />
          </React.Fragment>
        ) : needsSetup ? (
          <React.Fragment>
            <RootStack.Screen name="RoleQuiz"           component={RoleQuizScreen}           />
            {/* Selector orbital de rol, accesible vía deep link / fallback */}
            <RootStack.Screen name="RoleConstellation"  component={RoleConstellationScreen}  />
            <RootStack.Screen name="Playstyle"          component={PlaystyleTestScreen}      />
            <RootStack.Screen name="ChampionQuiz"       component={ChampionQuizScreen}       />
            <RootStack.Screen name="ChampionPick"       component={ChampionPickScreen}       />
          </React.Fragment>
        ) : (
          <React.Fragment>
            <RootStack.Screen name="AppTabs" component={AppTabs} />
            {/* Dev-only — navegar con navigation.navigate('ComponentShowcase') */}
            {__DEV__ && (
              <RootStack.Screen
                name="ComponentShowcase"
                component={ComponentShowcaseScreen}
              />
            )}
          </React.Fragment>
        )}
      </RootStack.Navigator>
      {showSplash ? (
        <SplashScreen onFinish={() => setShowSplash(false)} />
      ) : null}
      {showWelcome ? (
        <WelcomeScreen
          onFinish={async () => {
            try { await AsyncStorage.removeItem('novarift_show_welcome'); } catch (_) {}
            setShowWelcome(false);
          }}
        />
      ) : null}
    </React.Fragment>
  );
}

// ─── Root ────────────────────────────────────────────────────────────────────
export default function App() {
  // Rajdhani como fuente global gaming/tech. Carga no bloqueante: si las
  // fuentes tardan o fallan, la app arranca igualmente con fuente del sistema.
  // Se usa un timeout de 3s como fallback para evitar pantalla negra infinita.
  const [fontsLoaded, fontError] = useFonts({
    Rajdhani_400Regular,
    Rajdhani_500Medium,
    Rajdhani_600SemiBold,
    Rajdhani_700Bold,
  });
  const [fontTimeout, setFontTimeout] = React.useState(false);

  React.useEffect(() => {
    const t = setTimeout(() => setFontTimeout(true), 3000);
    return () => clearTimeout(t);
  }, []);

  // Bloqueamos solo hasta que carguen O hasta 3s de timeout O hasta error
  if (!fontsLoaded && !fontTimeout && !fontError) {
    return (
      <View style={[styles.loaderWrap, { backgroundColor: '#07070d' }]}>
        <ActivityIndicator color="#7B76DD" size="large" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#07070d' }}>
      <ThemeProvider>
      <StatusBar style="light" />
      <UserProvider>
        <RiotProvider>
          {/* OnboardingProvider envuelve todo el árbol para que el state
              (faction/role/playstyle/champions) sobreviva entre pantallas
              del stack onboarding sin perderse al navegar. */}
          <OnboardingProvider>
            <NavigationContainer theme={NAV_THEME}>
              <GateNavigator />
            </NavigationContainer>
          </OnboardingProvider>
        </RiotProvider>
      </UserProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

// ─── Estilos ─────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  loaderWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  tabItem: {
    alignItems: 'center', justifyContent: 'center', width: 80, height: 56,
  },
  tabIconWrap: {
    width: 36, height: 36, borderRadius: 8,
    borderWidth: 1, borderColor: 'transparent',
    justifyContent: 'center', alignItems: 'center', marginBottom: 4,
  },
  tabGlyph: { fontSize: 18, fontWeight: '900' },
  tabLabel: { fontSize: 9, letterSpacing: 1.3, fontFamily: 'Rajdhani_700Bold' },
  tabActiveBar: {
    position: 'absolute', bottom: -10, width: 28, height: 2, borderRadius: 1,
    shadowOpacity: 0.8, shadowRadius: 4, shadowOffset: { width: 0, height: 0 },
  },
});
