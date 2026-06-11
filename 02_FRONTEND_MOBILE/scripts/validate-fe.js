#!/usr/bin/env node
// ============================================================================
// validate-fe.js — Green gate SOLO frontend (sin mvn / sin backend)
// ----------------------------------------------------------------------------
// Igual que los pasos 1 y 2 de pre-commit.js (Babel parse de src/ + npm test),
// pero SIN el paso 3 (mvn test-compile), para validar trabajo frontend-only
// sin tocar el backend. Uso: node scripts/validate-fe.js
// ============================================================================
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const FRONT = path.resolve(__dirname, '..');
const ROOT  = path.resolve(__dirname, '..', '..');
const C = { reset: '\x1b[0m', red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', cyan: '\x1b[36m', bold: '\x1b[1m' };
function step(l) { console.log(`\n${C.cyan}▸${C.reset} ${C.bold}${l}${C.reset}`); }
function ok(m) { console.log(`  ${C.green}✓${C.reset} ${m}`); }
function fail(m) { console.log(`  ${C.red}✗${C.reset} ${m}`); }

let exitCode = 0;
const startedAt = Date.now();

step('1/2 · Babel parse (frontend src/)');
try {
  const parser = require('@babel/parser');
  let total = 0, failed = 0;
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) { if (entry.name === 'node_modules') continue; walk(p); }
      else if (entry.isFile() && p.endsWith('.js')) {
        total++;
        try { parser.parse(fs.readFileSync(p, 'utf-8'), { sourceType: 'module', plugins: ['jsx'] }); }
        catch (e) { fail(`${path.relative(ROOT, p)} :: ${e.message}`); failed++; }
      }
    }
  }
  walk(path.join(FRONT, 'src'));
  if (failed === 0) ok(`${total} archivos parseados, 0 errores`);
  else exitCode = 1;
} catch (e) { fail(`Babel parse falló: ${e.message}`); exitCode = 1; }

step('2/2 · Frontend tests (npm test)');
try {
  const out = execSync('npm test --silent', { cwd: FRONT, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf-8' });
  const last = out.toString().trim().split('\n').slice(-1)[0];
  ok(`Frontend tests OK — ${last}`);
} catch (e) {
  fail('Frontend tests fallaron:');
  if (e.stdout) console.log(e.stdout.toString().split('\n').slice(-20).join('\n'));
  exitCode = 1;
}

const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
console.log('');
console.log(exitCode === 0
  ? `${C.green}${C.bold}✓ validate-fe OK${C.reset} · ${elapsed}s`
  : `${C.red}${C.bold}✗ validate-fe FAILED${C.reset} · ${elapsed}s`);
process.exit(exitCode);
