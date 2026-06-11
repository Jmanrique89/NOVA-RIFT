// ============================================================================
// factionAssets.js — Mapeo de logos PNG
// ----------------------------------------------------------------------------
// DOS MODOS DE FUNCIONAMIENTO:
//
// A) MODO CROP-EN-VIVO (default — funciona ya, sin scripts):
// Usa las imágenes compuestas faciones.png y roles.png directamente,
// mostrando solo el cuadrante correspondiente con overflow:hidden.
// Pro: cero pasos previos, funciona inmediatamente.
// Contra: cada card carga una imagen 500×650; ligero coste de memoria.
//
// B) MODO LOGOS INDIVIDUALES (recomendado para producción):
// Tras ejecutar `node scripts/crop-assets.js`, descomenta los require()
// del bloque FACTION_LOGOS / ROLE_LOGOS. Los componentes detectan
// automáticamente que hay logos individuales y los usan en su lugar.
// Pro: PNGs pequeños, mejor rendimiento.
// Contra: requiere `npm install sharp` + ejecutar el script una vez.
//
// ----------------------------------------------------------------------------
// Ajuste del recorte de facciones:
// Coordenadas ajustadas con +14px de padding interior por lado para
// hacer zoom-in al logo y cortar el marco/borde decorativo del card
// que aparecía en el recorte anterior.
// Exportadas COMPOSITE_W / COMPOSITE_H para que ningún consumer las
// duplique; cualquier resize del PNG sólo requiere actualizar UN sitio.
// Si se cambia el PNG por uno de OTRO tamaño, edita COMPOSITE_W/H
// y revisa que las coords sigan apuntando al cuadrante correcto.
// ============================================================================

// ─── A) Imágenes compuestas (siempre disponibles) ─────────────────────────
export const COMPOSITE_FACTIONS_IMG = require('../../assets/faciones.png');
export const COMPOSITE_ROLES_IMG    = require('../../assets/roles.png');

// Dimensiones canónicas del PNG compuesto. Si se sube uno con otro
// tamaño, edita aquí y los crops se reescalan automáticamente porque están
// expresados en píxeles RELATIVOS a estas constantes.
export const COMPOSITE_W = 500;
export const COMPOSITE_H = 650;

// Padding interior aplicado a cada crop: cuanto más alto, más zoom al logo
// (y más probable que se corten bordes feos del card).
//
// bajado de 14 → 4. El inset anterior recortaba
// 28px por logo (14 cada lado) y dejaba los emblemas con bordes cortados
// y mal centrados. Si algún logo todavía se ve recortado, bajar a 2.
const FACTION_INSET = 4;
const ROLE_INSET    = 4;

// Coordenadas del crop visual en la imagen ORIGINAL (px).
// Layout faciones.png: 2x2 grid en la mitad inferior, branding NOVA RIFT arriba.
// ┌────────────────────────────────┐
// │ NOVA RIFT (branding) │ ~125px
// ├──────────────┬─────────────────┤
// │ DEMACIA │ NOXUS │ ~238px
// ├──────────────┼─────────────────┤
// │ ZAUN │ IONIA │ ~238px
// └──────────────┴─────────────────┘
export const FACTION_CROPS = {
  DEMACIA: {
    left:   10 + FACTION_INSET,
    top:    125 + FACTION_INSET,
    width:  238 - FACTION_INSET * 2,
    height: 238 - FACTION_INSET * 2,
  },
  NOXUS: {
    left:   255 + FACTION_INSET,
    top:    125 + FACTION_INSET,
    width:  238 - FACTION_INSET * 2,
    height: 238 - FACTION_INSET * 2,
  },
  ZAUN: {
    left:   10 + FACTION_INSET,
    top:    370 + FACTION_INSET,
    width:  238 - FACTION_INSET * 2,
    height: 238 - FACTION_INSET * 2,
  },
  IONIA: {
    left:   255 + FACTION_INSET,
    top:    370 + FACTION_INSET,
    width:  238 - FACTION_INSET * 2,
    height: 238 - FACTION_INSET * 2,
  },
};

// Layout roles.png: 2 cards arriba (TOP/JUNGLE), 3 cards abajo (MID/ADC/SUP).
// ┌──────────────────────────────────┐
// │ NOVA RIFT (branding) │ ~125px
// ├──────────────┬───────────────────┤
// │ JUNGLE │ TOP │ ~238px
// ├──────┬───────┼───────────────────┤
// │ MID │ ADC │ SUPPORT │ ~230px
// └──────┴───────┴───────────────────┘
export const ROLE_CROPS = {
  JUNGLE: {
    left:   10 + ROLE_INSET,
    top:    125 + ROLE_INSET,
    width:  238 - ROLE_INSET * 2,
    height: 238 - ROLE_INSET * 2,
  },
  TOP: {
    left:   255 + ROLE_INSET,
    top:    125 + ROLE_INSET,
    width:  238 - ROLE_INSET * 2,
    height: 238 - ROLE_INSET * 2,
  },
  MID: {
    left:   5 + ROLE_INSET,
    top:    375 + ROLE_INSET,
    width:  158 - ROLE_INSET * 2,
    height: 230 - ROLE_INSET * 2,
  },
  ADC: {
    left:   170 + ROLE_INSET,
    top:    375 + ROLE_INSET,
    width:  158 - ROLE_INSET * 2,
    height: 230 - ROLE_INSET * 2,
  },
  SUPPORT: {
    left:   335 + ROLE_INSET,
    top:    375 + ROLE_INSET,
    width:  158 - ROLE_INSET * 2,
    height: 230 - ROLE_INSET * 2,
  },
};

// ─── B) Logos individuales (descomentar tras ejecutar el script) ───────────
// PROCESO:
// cd 02_FRONTEND_MOBILE
// npm install sharp
// node scripts/crop-assets.js
//
// Y entonces descomenta las líneas de abajo. Si lo haces antes, Metro romperá
// el bundle porque los archivos no existen.
// generados con `node scripts/crop-assets.js`.
// FactionLogo y RoleIcon detectan automáticamente que existen y suben a Tier 1
// (PNG individual) en lugar del crop-en-vivo del composite 500×650.
export const FACTION_LOGOS = {
  DEMACIA: require('../../assets/factions/demacia_logo.png'),
  NOXUS:   require('../../assets/factions/noxus_logo.png'),
  ZAUN:    require('../../assets/factions/zaun_logo.png'),
  IONIA:   require('../../assets/factions/ionia_logo.png'),
};

export const ROLE_LOGOS = {
  TOP:     require('../../assets/roles/top_logo.png'),
  JUNGLE:  require('../../assets/roles/jungle_logo.png'),
  MID:     require('../../assets/roles/mid_logo.png'),
  ADC:     require('../../assets/roles/adc_logo.png'),
  SUPPORT: require('../../assets/roles/support_logo.png'),
};

// ─── Helpers ───────────────────────────────────────────────────────────────
export function getFactionLogo(factionKey) {
  return FACTION_LOGOS[factionKey] ?? null;
}

export function getRoleLogo(roleKey) {
  return ROLE_LOGOS[roleKey] ?? null;
}

export function getFactionCrop(factionKey) {
  return FACTION_CROPS[factionKey] ?? null;
}

export function getRoleCrop(roleKey) {
  return ROLE_CROPS[roleKey] ?? null;
}
