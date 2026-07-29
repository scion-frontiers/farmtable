#!/usr/bin/env node
// Multi-edit, content-addressed mutation runner.
// spec: [{ id, expect: 'RED'|'GREEN', edits: [{file, anchor, repl}] }]
// Prerequisites (each an ABORT, exit-scored separately, never PASS/FAIL):
//   * every anchor occurs EXACTLY once in its file
//   * every edit changes bytes
//   * restore verified byte-exact
// The suite verdict comes from spawnSync().status of the child, never a pipe.
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const specs = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const summary = [];

for (const s of specs) {
  const originals = new Map();
  let abort = null;
  // Phase 1: validate every anchor against the pristine file before writing anything.
  for (const e of s.edits) {
    if (!originals.has(e.file)) originals.set(e.file, readFileSync(e.file, 'utf8'));
  }
  const staged = new Map(originals);
  for (const e of s.edits) {
    const cur = staged.get(e.file);
    const i = cur.indexOf(e.anchor);
    if (i === -1) { abort = `anchor not found in ${e.file}: ${JSON.stringify(e.anchor.slice(0, 60))}`; break; }
    if (cur.indexOf(e.anchor, i + 1) !== -1) { abort = `anchor NOT UNIQUE in ${e.file}: ${JSON.stringify(e.anchor.slice(0, 60))}`; break; }
    const next = cur.slice(0, i) + e.repl + cur.slice(i + e.anchor.length);
    if (next === cur) { abort = `no-op edit in ${e.file}`; break; }
    staged.set(e.file, next);
  }
  if (abort) {
    console.log(`=== ${s.id} : ABORT — ${abort}`);
    summary.push(`${s.id}\tABORT\texpected=${s.expect}`);
    continue;
  }

  let status = null, out = '';
  try {
    for (const [f, c] of staged) writeFileSync(f, c);
    const r = spawnSync('npm', ['test'], { encoding: 'utf8' });
    if (r.error) { abort = `spawn failed: ${r.error.message}`; }
    else { status = r.status; out = (r.stdout || '') + (r.stderr || ''); }
  } finally {
    for (const [f, c] of originals) writeFileSync(f, c);
    for (const [f, c] of originals) {
      if (readFileSync(f, 'utf8') !== c) {
        console.error(`FATAL: restore failed for ${f}`);
        process.exit(3);
      }
    }
  }
  if (abort || status === null) {
    console.log(`=== ${s.id} : ABORT — ${abort}`);
    summary.push(`${s.id}\tABORT\texpected=${s.expect}`);
    continue;
  }

  const tsFail = /error TS\d+/.test(out);
  const outcome = status === 0 ? 'GREEN' : tsFail ? 'RED-TSC' : 'RED';
  console.log(`=== ${s.id} : ${outcome} (child exit=${status})`);
  const lines = out.split('\n');
  const shown = lines.filter((l) => /^\s+- /.test(l) || /checks failed/.test(l) || /error TS/.test(l) || /checks passed/.test(l));
  for (const l of shown.slice(0, 10)) console.log(`    ${l.trim().slice(0, 260)}`);
  if (!shown.length) for (const l of lines.filter((l) => l.trim()).slice(-6)) console.log(`    ${l.trim().slice(0, 260)}`);
  const flag = s.expect && !outcome.startsWith(s.expect) ? '   <<< UNEXPECTED' : '';
  summary.push(`${s.id}\t${outcome}\texpected=${s.expect}${flag}`);
}
console.log('\n--- SUMMARY ---');
for (const l of summary) console.log(l);
