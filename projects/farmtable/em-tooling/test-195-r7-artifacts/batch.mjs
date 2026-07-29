#!/usr/bin/env node
// Batch driver: reads a JSON array of {id,file,anchor,repl,expect} from argv[2]
// and shells out to mutate.mjs for each. Scores ABORT separately from PASS/FAIL.
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const specs = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const results = [];
for (const s of specs) {
  writeFileSync('/tmp/mut/.a', s.anchor);
  writeFileSync('/tmp/mut/.r', s.repl);
  const r = spawnSync('node', ['/tmp/mut/mutate.mjs', s.file, '/tmp/mut/.a', '/tmp/mut/.r', s.id], {
    cwd: process.cwd(), encoding: 'utf8', stdio: 'pipe',
  });
  const code = r.status;
  const outcome = code === 3 ? 'ABORT' : code === 0 ? 'GREEN' : 'RED';
  process.stdout.write((r.stdout || '') + (r.stderr || ''));
  const flag = s.expect && s.expect !== outcome ? '   <<< UNEXPECTED' : '';
  results.push(`${s.id}\t${outcome}\texpected=${s.expect || '?'}${flag}`);
}
console.log('\n--- SUMMARY ---');
for (const l of results) console.log(l);
