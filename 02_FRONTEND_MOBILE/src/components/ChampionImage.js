// ============================================================================
// ChampionImage — orquesta carga de splash con fallback en 3 niveles.
// ----------------------------------------------------------------------------
// Sustituye al `<Image source={splashUrl}>` plano
// que dejaba cuadrados en blanco cuando Data Dragon fallaba.
//
// Estrategia (los 3 niveles se intentan en cascada con onError):
// 1. <Image source=splash CDN /> — calidad alta (~1215×717)
// 2. <Image source=loading CDN /> — más pequeño, mejor latencia
// 3. SVG placeholder por rol — silueta + color de rol + nombre
//
// Props:
// name (string) — nombre canónico del campeón ('Garen', 'LeeSin'...)
// style (object|array) — pasa al View raíz
// resizeMode (string) — 'cover' | 'contain' | ... (default 'cover')
// onTier (fn opcional) — callback cuando cambia de tier (1/2/3)
// aspect (string) — 'portrait' arranca directo en loading (308×560
// vertical) para slots 3:4 sin recortar la cara.
// 'landscape' o undefined → splash 1215×717 default.
// focus (string) — 'face' ancla la imagen ARRIBA en vez de hacer
// el cover centrado. La cara del loading art vive
// en el tercio superior (≈y 0-200 de 560); con
// cover centrado en contenedores cuadrados/altos
// se recortaba dejando la cintura en cuadro. Con
// focus='face' la imagen se ancla a top:0 (nativo,
// vía aspectRatio) u objectPosition:'top center'
// (web), mostrando la cara. Pensado para usarse
// junto a aspect="portrait".
//
// Uso:
// <ChampionImage name="Jinx" style={styles.splash} resizeMode="cover" />
// <ChampionImage name="Jinx" aspect="portrait" style={cardStyle} /> // slots 3:4
// <ChampionImage name="Jinx" aspect="portrait" focus="face" style={hexStyle} />
// ============================================================================
import React, { useState, useMemo } from 'react';
import { View, Image, StyleSheet, Text, Platform } from 'react-native';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import {
  getChampionSplash,
  getChampionCenteredSplash,
  getChampionLoading,
  getChampionLocalFallback,
} from '../utils/championImage';
import RoleIcon from './RoleIcon';
import { useTheme } from '../context/ThemeContext';

export default function ChampionImage({
  name, style, resizeMode = 'cover', onTier, aspect, focus, centered,
}) {
  const { colors: c } = useTheme();
  const styles = useMemo(() => makeChampionImageStyles(c), [c]);
  // tier: 0 = splash CENTRADO (CommunityDragon), 1 = splash CDN (Data Dragon),
  // 2 = loading CDN, 3 = placeholder SVG.
  // `centered` arranca en tier 0 — el arte centrado encuadra al campeón para
  // fondos a pantalla completa en vertical (cover normal, sin objectPosition).
  // en aspect="portrait" empezamos directo en tier 2 — el loading
  // (308×560 vertical) encaja en slots 3:4 sin recortar la cara, frente al
  // splash 1215×717 que es horizontal y deja la cara fuera de cuadro al
  // hacer cover en cards verticales.
  const initialTier = centered ? 0 : aspect === 'portrait' ? 2 : 1;
  const [tier, setTier] = useState(initialTier);

  const advance = (next) => {
    setTier(next);
    if (typeof onTier === 'function') onTier(next);
  };

  // Tier 0 + 1 + 2 — Image con onError que sube el tier
  if (tier < 3) {
    const source =
      tier === 0 ? getChampionCenteredSplash(name)
      : tier === 1 ? getChampionSplash(name)
      : getChampionLoading(name);

    // focus='face': en vez del cover centrado (que en contenedores cuadrados o
    // verticales recorta la cabeza y deja la cintura en cuadro), anclamos la
    // imagen arriba. En nativo lo hacemos dándole el aspectRatio nativo de la
    // fuente y top:0 — la imagen queda más alta que el wrap y `overflow:hidden`
    // recorta los pies, dejando la cara visible. En web basta objectPosition.
    let imgStyle = StyleSheet.absoluteFillObject;
    if (focus === 'face') {
      const srcAspect = tier === 1 ? 1215 / 717 : 308 / 560;
      imgStyle = Platform.OS === 'web'
        ? [StyleSheet.absoluteFillObject, { objectPosition: 'top center' }]
        : { position: 'absolute', top: 0, left: 0, width: '100%', aspectRatio: srcAspect };
    }

    return (
      <View style={[styles.wrap, style]}>
        <Image
          source={source}
          style={imgStyle}
          resizeMode={resizeMode}
          onError={() => advance(tier + 1)}
        />
      </View>
    );
  }

  // Tier 3 — placeholder SVG: silueta + tinte + label "Imágenes en modo offline"
  const { role, color, label } = getChampionLocalFallback(name);
  return (
    <View style={[styles.wrap, { backgroundColor: c.bg2 }, style]}>
      <Svg
        style={StyleSheet.absoluteFillObject}
        viewBox="0 0 100 140"
        preserveAspectRatio="xMidYMid slice"
      >
        {/* Fondo con tinte del rol */}
        <Rect x="0" y="0" width="100" height="140" fill={color} fillOpacity="0.08" />
        {/* Silueta humana genérica */}
        <Circle cx="50" cy="42" r="14" fill={color} fillOpacity="0.35" />
        <Path
          d="M50,58 Q24,60 18,108 L18,140 L82,140 L82,108 Q76,60 50,58 Z"
          fill={color} fillOpacity="0.32"
        />
      </Svg>

      {/* Icono de rol abajo a la izquierda + label */}
      <View style={styles.placeholderLabel}>
        <RoleIcon role={role} size={16} color={color} />
        <Text style={[styles.placeholderName, { color }]} numberOfLines={1}>
          {label || '—'}
        </Text>
      </View>
      <Text style={styles.placeholderHint}>Modo offline</Text>
    </View>
  );
}

const makeChampionImageStyles = (c) => StyleSheet.create({
  wrap: { overflow: 'hidden' },
  placeholderLabel: {
    position: 'absolute', bottom: 6, left: 6, right: 6,
    flexDirection: 'row', alignItems: 'center', gap: 6,
  },
  placeholderName: {
    fontSize: 11, fontWeight: '900', letterSpacing: 1,
    flex: 1,
  },
  placeholderHint: {
    position: 'absolute', top: 4, right: 6,
    color: c.onSurface(0.32), fontSize: 8,
    letterSpacing: 1, textTransform: 'uppercase',
  },
});
