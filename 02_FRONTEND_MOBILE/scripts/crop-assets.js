// ============================================================================
// crop-assets.js — Recorta faciones.png y roles.png en logos individuales
// ----------------------------------------------------------------------------
// Ejecutar UNA VEZ desde la raíz de 02_FRONTEND_MOBILE:
//   npm install sharp
//   node scripts/crop-assets.js
//
// FIX 2026-04-29: las coordenadas anteriores asumían imagen 500x650 pero las
// imágenes reales son 1824x2358 (PNG entregadas por Jorge). Las nuevas
// coordenadas se calcularon midiendo cada cuadrante en la imagen real.
// El crop ahora coge el LOGO (no el texto del card debajo) para que el
// archivo final sea cuadrado y centrado en el emblema.
// ============================================================================
const sharp = require('sharp');
const fs    = require('fs');
const path  = require('path');

const ROOT   = path.join(__dirname, '..');
const SRC_F  = path.join(ROOT, 'assets', 'faciones.png');
const SRC_R  = path.join(ROOT, 'assets', 'roles.png');
const OUT_F  = path.join(ROOT, 'assets', 'factions');
const OUT_R  = path.join(ROOT, 'assets', 'roles');

fs.mkdirSync(OUT_F, { recursive: true });
fs.mkdirSync(OUT_R, { recursive: true });

// ─── Faciones (1824 × 2358) ──────────────────────────────────────────────────
// Layout: branding "NOVA RIFT" arriba (0-600px) + grid 2x2 abajo.
//   ┌─────────────────────────────┐
//   │  NOVA RIFT (branding)       │  ~640px
//   ├──────────────┬──────────────┤
//   │  DEMACIA     │  NOXUS       │  ~640-1410
//   ├──────────────┼──────────────┤
//   │  ZAUN        │  IONIA       │  ~1515-2285
//   └──────────────┴──────────────┘
// Cada card mide aprox 600x770. El logo ocupa los primeros ~600px verticales
// del card (los últimos ~170px son el texto). Crop = primeros 600x600.
const FACTIONS = [
  { name: 'demacia', left:  280, top:  640, width: 590, height: 590 },
  { name: 'noxus',   left:  955, top:  640, width: 590, height: 590 },
  { name: 'zaun',    left:  280, top: 1520, width: 590, height: 590 },
  { name: 'ionia',   left:  955, top: 1520, width: 590, height: 590 },
];

// ─── Roles (1824 × 2358) ─────────────────────────────────────────────────────
// Layout: branding arriba + 2 cards grandes (JUNGLE, TOP) + 3 cards pequeñas
// (MID, ADC, SUPPORT).
//   ┌──────────────────────────────────────┐
//   │  NOVA RIFT (branding)                │  ~640px
//   ├────────────────┬─────────────────────┤
//   │  JUNGLE        │  TOP                │  ~640-1410
//   ├──────┬─────────┼─────────────────────┤
//   │ MID  │  ADC    │  SUPPORT            │  ~1490-2280
//   └──────┴─────────┴─────────────────────┘
// Las 3 cards inferiores son más estrechas (~410 cada una vs ~600 de las
// superiores). Y MID y ADC visualmente comparten estructura similar.
const ROLES = [
  // Fila superior — 2 cards grandes
  { name: 'jungle',  left:  280, top:  640, width: 590, height: 590 },
  { name: 'top',     left:  955, top:  640, width: 590, height: 590 },
  // Fila inferior — 3 cards más estrechas
  { name: 'mid',     left:   90, top: 1500, width: 410, height: 540 },
  { name: 'adc',     left:  720, top: 1500, width: 410, height: 540 },
  { name: 'support', left: 1325, top: 1500, width: 410, height: 540 },
];

(async () => {
  console.log('✂️  Recortando logos de facciones (1824×2358)...');
  for (const f of FACTIONS) {
    const out = path.join(OUT_F, `${f.name}_logo.png`);
    await sharp(SRC_F)
      .extract({ left: f.left, top: f.top, width: f.width, height: f.height })
      .toFile(out);
    console.log(`  ✅ factions/${f.name}_logo.png  (${f.width}×${f.height})`);
  }

  console.log('\n✂️  Recortando logos de roles (1824×2358)...');
  for (const r of ROLES) {
    const out = path.join(OUT_R, `${r.name}_logo.png`);
    await sharp(SRC_R)
      .extract({ left: r.left, top: r.top, width: r.width, height: r.height })
      .toFile(out);
    console.log(`  ✅ roles/${r.name}_logo.png  (${r.width}×${r.height})`);
  }

  console.log('\n🎉 Todos los assets recortados. Si los recortes están descentrados, ajustar las coordenadas en este script y re-ejecutar.');
})().catch(err => {
  console.error('❌ Error:', err.message);
  console.log('Asegúrate de haber ejecutado: npm install sharp');
});
