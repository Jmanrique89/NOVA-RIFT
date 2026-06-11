// Reversión de doble-encoding UTF-8→CP1252→UTF-8 (mojibake) producido por un
// Get-Content/Set-Content de PowerShell 5.1 sin -Encoding en la lectura.
// Estrategia: leer el fichero como UTF-8 (da la cadena mojibake), volver a
// codificarla a bytes CP1252 (mapa inverso explícito para 0x80-0x9F) y
// decodificar esos bytes como UTF-8 → texto original. Valida que no queden
// U+FFFD antes de escribir. Uso: node scripts/fix-mojibake.js <file...>
const fs = require('fs');

// Mapa inverso CP1252 para los puntos de código fuera de latin1 (0x80-0x9F).
const CP1252_REVERSE = {
  0x20AC: 0x80, 0x201A: 0x82, 0x0192: 0x83, 0x201E: 0x84, 0x2026: 0x85,
  0x2020: 0x86, 0x2021: 0x87, 0x02C6: 0x88, 0x2030: 0x89, 0x0160: 0x8A,
  0x2039: 0x8B, 0x0152: 0x8C, 0x017D: 0x8E, 0x2018: 0x91, 0x2019: 0x92,
  0x201C: 0x93, 0x201D: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97,
  0x02DC: 0x98, 0x2122: 0x99, 0x0161: 0x9A, 0x203A: 0x9B, 0x0153: 0x9C,
  0x017E: 0x9E, 0x0178: 0x9F,
};

for (const file of process.argv.slice(2)) {
  let s = fs.readFileSync(file, 'utf8');
  if (s.charCodeAt(0) === 0xFEFF) s = s.slice(1); // BOM fuera

  const bytes = [];
  let ok = true;
  for (const ch of s) {
    const code = ch.codePointAt(0);
    if (code <= 0xFF) bytes.push(code);
    else if (CP1252_REVERSE[code] !== undefined) bytes.push(CP1252_REVERSE[code]);
    else { console.error(`${file}: char U+${code.toString(16)} no es CP1252 — fichero NO uniformemente corrupto, lo salto`); ok = false; break; }
  }
  if (!ok) continue;

  const fixed = Buffer.from(bytes).toString('utf8');
  if (fixed.includes('�')) { console.error(`${file}: la reversión produce U+FFFD, lo salto`); continue; }
  fs.writeFileSync(file, fixed, 'utf8'); // UTF-8 sin BOM
  console.log(`${file}: OK (${s.length} → ${fixed.length} chars)`);
}
