#!/usr/bin/env node
// File-level mutation runner: create / delete files, plus content edits.
// spec: [{id, expect, creates:[{file,content}], deletes:[file], edits:[{file,anchor,repl}]}]
// Restores everything (recreating deleted files byte-exactly, unlinking created
// ones) in a finally block, then verifies the git worktree is clean.
import { readFileSync, writeFileSync, unlinkSync, existsSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const specs = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const summary = [];
for (const s of specs) {
  const originals = new Map();
  const created = [];
  let abort = null, status = null, out = '';
  try {
    for (const c of s.creates || []) {
      if (existsSync(c.file)) { abort = `create target already exists: ${c.file}`; break; }
    }
    for (const d of s.deletes || []) {
      if (!existsSync(d)) { abort = `delete target missing: ${d}`; break; }
      originals.set(d, readFileSync(d, 'utf8'));
    }
    for (const e of s.edits || []) {
      if (!originals.has(e.file)) originals.set(e.file, readFileSync(e.file, 'utf8'));
    }
    if (!abort) {
      const staged = new Map();
      for (const e of s.edits || []) {
        const cur = staged.get(e.file) ?? originals.get(e.file);
        const i = cur.indexOf(e.anchor);
        if (i === -1) { abort = `anchor not found in ${e.file}`; break; }
        if (cur.indexOf(e.anchor, i + 1) !== -1) { abort = `anchor NOT UNIQUE in ${e.file}`; break; }
        const next = cur.slice(0, i) + e.repl + cur.slice(i + e.anchor.length);
        if (next === cur) { abort = `no-op edit in ${e.file}`; break; }
        staged.set(e.file, next);
      }
      if (!abort) {
        for (const [f, c] of staged) writeFileSync(f, c);
        for (const d of s.deletes || []) unlinkSync(d);
        for (const c of s.creates || []) {
          mkdirSync(c.file.split('/').slice(0, -1).join('/') || '.', { recursive: true });
          writeFileSync(c.file, c.content);
          created.push(c.file);
        }
        const r = spawnSync('npm', ['test'], { encoding: 'utf8' });
        if (r.error) abort = `spawn failed: ${r.error.message}`;
        else { status = r.status; out = (r.stdout || '') + (r.stderr || ''); }
      }
    }
  } finally {
    for (const f of created) if (existsSync(f)) unlinkSync(f);
    for (const [f, c] of originals) writeFileSync(f, c);
  }
  const g = spawnSync('git', ['status', '--porcelain'], { encoding: 'utf8' });
  if ((g.stdout || '').trim() !== '') {
    console.error(`FATAL: worktree dirty after ${s.id}:\n${g.stdout}`);
    process.exit(3);
  }
  if (abort || status === null) {
    console.log(`=== ${s.id} : ABORT — ${abort}`);
    summary.push(`${s.id}\tABORT\texpected=${s.expect}`);
    continue;
  }
  const outcome = status === 0 ? 'GREEN' : /error TS\d+/.test(out) ? 'RED-TSC' : 'RED';
  console.log(`=== ${s.id} : ${outcome} (child exit=${status})`);
  const shown = out.split('\n').filter((l) => /^\s+- /.test(l) || /checks failed/.test(l) || /error TS/.test(l) || /checks passed/.test(l));
  for (const l of shown.slice(0, 8)) console.log(`    ${l.trim().slice(0, 250)}`);
  const flag = s.expect && !outcome.startsWith(s.expect) ? '   <<< UNEXPECTED' : '';
  summary.push(`${s.id}\t${outcome}\texpected=${s.expect}${flag}`);
}
console.log('\n--- SUMMARY ---');
for (const l of summary) console.log(l);
