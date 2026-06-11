// ============================================================================
// metro.config.js — config base de Expo + react-native-svg-transformer
// ----------------------------------------------------------------------------
// Permite importar archivos .svg como componentes React directamente:
//   import LogoSvg from '../assets/logo.svg';
//   <LogoSvg width={48} height={48} fill={color} />
//
// Para SVGs en código (programático) se usan los componentes de react-native-svg
// (Svg, Circle, Path, ...) directamente sin pasar por este transformer.
// ============================================================================
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// ─── react-native-svg-transformer ──────────────────────────────────────────
config.transformer = {
  ...config.transformer,
  babelTransformerPath: require.resolve('react-native-svg-transformer'),
};

config.resolver = {
  ...config.resolver,
  // .svg ya no se trata como asset — se transforma a componente React
  assetExts: config.resolver.assetExts.filter((ext) => ext !== 'svg'),
  sourceExts: [...config.resolver.sourceExts, 'svg'],
};

module.exports = config;
