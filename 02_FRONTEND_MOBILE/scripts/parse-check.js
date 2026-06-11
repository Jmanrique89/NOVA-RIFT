#!/usr/bin/env node
// Babel-parse a specific list of files passed as argv. Used to validate edited
// files without walking the whole src tree (e.g. while another file is mid-edit).
const fs = require('fs');
const parser = require('@babel/parser');
const files = process.argv.slice(2);
let failed = 0;
for (const f of files) {
  try {
    parser.parse(fs.readFileSync(f, 'utf-8'), { sourceType: 'module', plugins: ['jsx'] });
    console.log(`  OK   ${f}`);
  } catch (e) {
    console.log(`  FAIL ${f} :: ${e.message}`);
    failed++;
  }
}
console.log(failed === 0 ? `\nALL ${files.length} OK` : `\n${failed} FAILED`);
process.exit(failed ? 1 : 0);
