// ============================================================================
// run-tests.js — Test runner ligero sin Jest para los motores puros del FE
// ----------------------------------------------------------------------------
// El proyecto no tiene Jest configurado y meterlo es invasivo (preset, mocks
// de RN, transformer SVG). Como los motores que queremos testear son
// puramente JS (sin React, sin AsyncStorage), basta con un runner Node muy
// fino que:
//
//   1. Carga los `.test.js` de `src/__tests__/` (CommonJS).
//   2. Cada test puede importar módulos ESM del proyecto vía
//      `loadEsm(path)` — helper que transforma ESM→CJS con Babel.
//   3. Define `describe`/`it` globales acumulando casos.
//   4. Al final, ejecuta todos secuencialmente, imprime resumen y exit
//      code 0/1.
//
// Útil para CI ligero. NO sustituye a Jest para componentes React; solo
// cubre las utilidades puras (`utils/`, `services/`).
// ============================================================================
const fs   = require('fs');
const path = require('path');
const Module = require('module');
const babel = require('@babel/core');

const ROOT = path.resolve(__dirname, '..');
const SRC  = path.join(ROOT, 'src');

// ─── Helper: transforma ESM → CJS y devuelve el module.exports ─────────────
function loadEsm(absPath) {
  const src = fs.readFileSync(absPath, 'utf-8');
  const out = babel.transformSync(src, {
    plugins: ['@babel/plugin-transform-modules-commonjs'],
    babelrc: false, configFile: false,
    filename: absPath,
  });
  const m = { exports: {} };
  // Resolver relative paths in require:
  const fakeRequire = (req) => {
    if (req.startsWith('.')) {
      // Resuelve relativo al fichero que lo está pidiendo.
      const dir = path.dirname(absPath);
      let resolved = path.resolve(dir, req);
      if (!fs.existsSync(resolved)) {
        // Probar añadiendo .js
        if (fs.existsSync(resolved + '.js')) resolved += '.js';
        else if (fs.existsSync(resolved + '/index.js')) resolved += '/index.js';
      }
      return loadEsm(resolved);
    }
    return require(req);
  };
  new Function('module', 'exports', 'require', out.code)(m, m.exports, fakeRequire);
  return m.exports;
}

// ─── DSL de tests ───────────────────────────────────────────────────────────
const suites = [];
let currentSuite = null;

global.describe = (name, fn) => {
  currentSuite = { name, tests: [] };
  suites.push(currentSuite);
  fn();
  currentSuite = null;
};

global.it = (name, fn) => {
  if (!currentSuite) throw new Error(`it('${name}') fuera de describe()`);
  currentSuite.tests.push({ name, fn });
};

global.loadEsm = (relPath) => loadEsm(path.join(ROOT, relPath));

// Aserciones mínimas — usamos `assert` nativo y añadimos `assertEqual` por
// claridad en los reportes.
const assert = require('assert');
global.assert = assert;
global.assertEqual = (actual, expected, msg) =>
  assert.strictEqual(actual, expected, msg || `expected ${expected}, got ${actual}`);
global.assertDeep  = (actual, expected, msg) =>
  assert.deepStrictEqual(actual, expected, msg);
global.assertTrue  = (cond, msg) => assert.ok(cond, msg || 'expected true');
global.assertFalse = (cond, msg) => assert.ok(!cond, msg || 'expected false');

// ─── Runner ─────────────────────────────────────────────────────────────────
function findTests(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...findTests(p));
    else if (entry.isFile() && p.endsWith('.test.js')) out.push(p);
  }
  return out;
}

const testFiles = findTests(path.join(SRC, '__tests__'));
if (testFiles.length === 0) {
  console.log('[run-tests] No hay archivos *.test.js en src/__tests__/');
  process.exit(0);
}

console.log(`[run-tests] ${testFiles.length} archivo(s) de tests encontrados`);
for (const f of testFiles) {
  console.log(`  · ${path.relative(ROOT, f)}`);
  // Cargar el test file (CJS, no necesita transform).
  require(f);
}

let totalPassed = 0;
let totalFailed = 0;
const failures = [];

for (const suite of suites) {
  console.log(`\n  ${suite.name}`);
  for (const test of suite.tests) {
    try {
      test.fn();
      console.log(`    \x1b[32m✓\x1b[0m ${test.name}`);
      totalPassed++;
    } catch (e) {
      console.log(`    \x1b[31m✗\x1b[0m ${test.name}`);
      console.log(`      ${e.message}`);
      totalFailed++;
      failures.push({ suite: suite.name, test: test.name, error: e.message });
    }
  }
}

console.log('');
const total = totalPassed + totalFailed;
if (totalFailed === 0) {
  console.log(`\x1b[32m[run-tests] ${total} tests · 0 failures · OK\x1b[0m`);
  process.exit(0);
} else {
  console.log(`\x1b[31m[run-tests] ${total} tests · ${totalFailed} failures\x1b[0m`);
  for (const f of failures) {
    console.log(`  ${f.suite} → ${f.test}: ${f.error}`);
  }
  process.exit(1);
}
