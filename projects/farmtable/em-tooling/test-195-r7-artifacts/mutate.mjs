#!/usr/bin/env node
// Mutation harness for #195 round 7.
//
// Contract, in order of importance:
//  * Anchors are CONTENT-addressed. If the anchor does not occur EXACTLY once in
//    the target file, the run ABORTS with exit 3 and touches nothing.
//  * The suite's exit code is taken from the CHILD PROCESS status, never from a
//    pipe or from parsing stdout.
//  * The file is restored from a byte-exact in-memory copy in a finally block,
//    and the restore is verified by re-reading and comparing.
//  * Any prerequisite failure is an ABORT (exit 3), which is NEVER scored as
//    either PASS or FAIL by the caller.
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const [, , file, anchorPath, replPath, label] = process.argv;
if (!file || !anchorPath || !replPath) {
  console.error('ABORT: usage: mutate.mjs <file> <anchorFile> <replFile> [label]');
  process.exit(3);
}

const anchor = readFileSync(anchorPath, 'utf8');
const repl = readFileSync(replPath, 'utf8');
const original = readFileSync(file, 'utf8');

// Prerequisite 1: anchor uniqueness.
let idx = original.indexOf(anchor);
if (idx === -1) {
  console.error(`ABORT[${label}]: anchor not found in ${file}`);
  process.exit(3);
}
if (original.indexOf(anchor, idx + 1) !== -1) {
  console.error(`ABORT[${label}]: anchor is NOT unique in ${file}`);
  process.exit(3);
}
// Prerequisite 2: the mutation must actually change the file.
const mutated = original.slice(0, idx) + repl + original.slice(idx + anchor.length);
if (mutated === original) {
  console.error(`ABORT[${label}]: replacement is byte-identical to the anchor (no-op mutation)`);
  process.exit(3);
}

let status = null;
let out = '';
try {
  writeFileSync(file, mutated);
  const r = spawnSync('npm', ['test'], { cwd: process.cwd(), encoding: 'utf8' });
  if (r.error) {
    console.error(`ABORT[${label}]: could not spawn npm: ${r.error.message}`);
    process.exit(3);
  }
  status = r.status; // <- child exit status, not a pipe
  out = (r.stdout || '') + (r.stderr || '');
} finally {
  writeFileSync(file, original);
  const check = readFileSync(file, 'utf8');
  if (check !== original) {
    console.error(`ABORT[${label}]: RESTORE FAILED for ${file} — repository is dirty`);
    process.exit(3);
  }
}

if (status === null) {
  console.error(`ABORT[${label}]: no child exit status`);
  process.exit(3);
}

const verdict = status === 0 ? 'GREEN' : 'RED';
console.log(`=== ${label || file} : ${verdict} (child exit=${status})`);
// Name the rule that fired, not just the colour.
const lines = out.split('\n');
if (status !== 0) {
  const interesting = lines.filter(
    (l) => /^\s+- /.test(l) || /checks failed/.test(l) || /error TS/.test(l),
  );
  for (const l of interesting.slice(0, 14)) console.log(`    ${l.trim().slice(0, 300)}`);
  if (interesting.length === 0) {
    for (const l of lines.filter((l) => l.trim()).slice(-8)) console.log(`    ${l.trim().slice(0, 300)}`);
  }
} else {
  for (const l of lines.filter((l) => /checks passed/.test(l))) console.log(`    ${l.trim()}`);
}
process.exit(status === 0 ? 0 : 1);
