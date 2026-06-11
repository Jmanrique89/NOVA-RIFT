#!/usr/bin/env node
// ============================================================================
// pre-commit.js — Validación rápida pre-commit (P2 backlog · DevEx)
// ----------------------------------------------------------------------------
// Script cross-platform (Windows + Linux + macOS) que el dev puede correr
// antes de un `git commit` para detectar regresiones triviales sin esperar
// al CI (~3-5 min en GitHub Actions).
//
// Lo que verifica:
//   1. Babel parse de TODOS los .js del frontend (detecta errores de sintaxis
//      sin necesidad de transpiler completo). ~2 segundos.
//   2. `npm test` (motores puros, sin Jest). ~3 segundos.
//   3. `mvn -B test-compile` del backend (compila pero NO ejecuta tests para
//      no alargar el ciclo). ~15 segundos.
//
// Tiempo total típico: ~20 segundos. Si todo pasa, exit 0 → el commit puede
// proceder. Si algo falla, exit 1 → el commit se aborta (cuando se enganche
// a un hook git real con husky/simple-git-hooks).
//
// Uso:
//   npm run pre-commit              # desde 02_FRONTEND_MOBILE
//   node scripts/pre-commit.js
//
// Engancharlo como hook git (opcional):
//   1. Inicializar repo: cd <root>/.. && git init
//   2. Crear .git/hooks/pre-commit:
//        #!/bin/sh
//        cd 02_FRONTEND_MOBILE && node scripts/pre-commit.js
//   3. chmod +x .git/hooks/pre-commit
//
// O usar `husky` desde npm si se prefiere config en package.json.
// ============================================================================
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const FRONT = path.resolve(__dirname, '..');
const BACK  = path.resolve(__dirname, '..', '..', '01_BACKEND_JAVA');
const ROOT  = path.resolve(__dirname, '..', '..');

// Códigos ANSI para output legible en terminal.
const C = {
  reset: '\x1b[0m', red: '\x1b[31m', green: '\x1b[32m',
  yellow: '\x1b[33m', cyan: '\x1b[36m', bold: '\x1b[1m',
};

function step(label) {
  console.log(`\n${C.cyan}▸${C.reset} ${C.bold}${label}${C.reset}`);
}

function ok(msg) { console.log(`  ${C.green}✓${C.reset} ${msg}`); }
function fail(msg) { console.log(`  ${C.red}✗${C.reset} ${msg}`); }

let exitCode = 0;
const startedAt = Date.now();

// ─── 1. Babel parse de todos los .js del frontend ──────────────────────────
step('1/3 · Babel parse (frontend src/)');
try {
  const parser = require('@babel/parser');
  let total = 0, failed = 0;
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules') continue;
        walk(p);
      } else if (entry.isFile() && p.endsWith('.js')) {
        total++;
        try {
          parser.parse(fs.readFileSync(p, 'utf-8'), {
            sourceType: 'module', plugins: ['jsx'],
          });
        } catch (e) {
          fail(`${path.relative(ROOT, p)} :: ${e.message}`);
          failed++;
        }
      }
    }
  }
  walk(path.join(FRONT, 'src'));
  if (failed === 0) ok(`${total} archivos parseados, 0 errores`);
  else { exitCode = 1; }
} catch (e) {
  fail(`Babel parse falló inesperadamente: ${e.message}`);
  exitCode = 1;
}

// ─── 2. npm test (motores puros) ────────────────────────────────────────────
step('2/3 · Frontend tests (npm test)');
try {
  execSync('npm test --silent', {
    cwd: FRONT,
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf-8',
  });
  ok('Frontend tests OK');
} catch (e) {
  fail(`Frontend tests fallaron: revisa stdout/stderr arriba`);
  if (e.stdout) console.log(e.stdout.toString().split('\n').slice(-15).join('\n'));
  exitCode = 1;
}

// ─── 3. mvn test-compile del backend ────────────────────────────────────────
step('3/3 · Backend test-compile (mvn)');
try {
  // -B (batch mode) suprime barras de progreso. Usamos -o (offline) si
  // hay caché local; si no, fall back a online.
  execSync('mvn -B test-compile', {
    cwd: BACK,
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf-8',
  });
  ok('Backend test-compile OK');
} catch (e) {
  fail(`Backend test-compile falló`);
  if (e.stdout) {
    // Solo las últimas 20 líneas para no inundar la consola.
    console.log(e.stdout.toString().split('\n').slice(-20).join('\n'));
  }
  exitCode = 1;
}

// ─── Resumen ────────────────────────────────────────────────────────────────
const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
console.log('');
if (exitCode === 0) {
  console.log(`${C.green}${C.bold}✓ pre-commit OK${C.reset} · ${elapsed}s`);
  console.log(`${C.yellow}↪${C.reset} El commit puede proceder.`);
} else {
  console.log(`${C.red}${C.bold}✗ pre-commit FAILED${C.reset} · ${elapsed}s`);
  console.log(`${C.yellow}↪${C.reset} Arregla los errores antes de commitear.`);
}
process.exit(exitCode);
