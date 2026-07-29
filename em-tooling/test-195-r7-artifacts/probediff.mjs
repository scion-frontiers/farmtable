// Applies a content-addressed mutation, recompiles, runs the behaviour probe,
// restores, and reports whether OBSERVABLE BEHAVIOUR changed. Aborts (exit 3) on
// any prerequisite failure. Exit codes come from child processes only.
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const [, , file, anchorPath, replPath, label] = process.argv;
const anchor = readFileSync(anchorPath, 'utf8');
const repl = readFileSync(replPath, 'utf8');
const original = readFileSync(file, 'utf8');
const i = original.indexOf(anchor);
if (i === -1) { console.error(`ABORT[${label}]: anchor not found`); process.exit(3); }
if (original.indexOf(anchor, i + 1) !== -1) { console.error(`ABORT[${label}]: anchor not unique`); process.exit(3); }
const mutated = original.slice(0, i) + repl + original.slice(i + anchor.length);
if (mutated === original) { console.error(`ABORT[${label}]: no-op`); process.exit(3); }

let probe = null, tscOk = false;
try {
  writeFileSync(file, mutated);
  const t = spawnSync('./node_modules/.bin/tsc', ['-p', 'tsconfig.test.json'], { encoding: 'utf8' });
  tscOk = t.status === 0;
  if (!tscOk) { console.log(`[${label}] tsc REJECTED the mutation (status=${t.status})`); console.log((t.stdout||'').trim().split('\n').slice(0,4).join('\n')); }
  else {
    const p = spawnSync('node', ['/tmp/mut/probe.mjs'], { encoding: 'utf8' });
    if (p.status !== 0) { console.error(`ABORT[${label}]: probe failed: ${p.stderr}`); }
    else probe = p.stdout;
  }
} finally {
  writeFileSync(file, original);
  if (readFileSync(file, 'utf8') !== original) { console.error('ABORT: RESTORE FAILED'); process.exit(3); }
  spawnSync('./node_modules/.bin/tsc', ['-p', 'tsconfig.test.json'], { encoding: 'utf8' });
}
if (!tscOk) process.exit(4);
if (probe === null) process.exit(3);
const base = readFileSync('/tmp/mut/probe.base.txt', 'utf8');
if (probe === base) { console.log(`[${label}] BEHAVIOUR UNCHANGED over the probe corpus`); process.exit(0); }
const b = base.split('\n'), m = probe.split('\n');
console.log(`[${label}] BEHAVIOUR CHANGED:`);
for (let k = 0; k < Math.max(b.length, m.length); k++) {
  if (b[k] !== m[k]) console.log(`    base[${k}] ${b[k]}\n    mut [${k}] ${m[k]}`);
}
process.exit(0);
