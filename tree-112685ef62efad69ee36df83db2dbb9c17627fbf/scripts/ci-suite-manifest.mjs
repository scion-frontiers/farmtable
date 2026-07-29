#!/usr/bin/env node
// Reports, BY NAME, which JavaScript/TypeScript test files the wired `npm test`
// script will actually execute -- and fails if a test file exists in the tree
// but is never executed by anything.
//
// WHY THIS EXISTS
// ---------------
// On this tree the JS test wiring names the files it runs explicitly, so adding
// a test file, or losing one in a merge resolution, changes WHAT RUNS without
// changing the exit code. `npm test` exits 0 either way. An exit code is
// therefore not evidence that a suite ran; only membership is.
//
// This check turns "a suite silently stopped running" from an invisible event
// into a build failure.
//
// It is deliberately FAIL-CLOSED: if it encounters a runner configuration it
// cannot analyse, it fails and says so rather than reporting a reassuring
// empty result. A check that cannot see is not a check that passes.

import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';

const repoRoot = execFileSync('git', ['rev-parse', '--show-toplevel'], {
  encoding: 'utf8',
}).trim();
process.chdir(repoRoot);

const TEST_FILE_RE = /\.(test|spec)\.(ts|tsx|mts|cts|js|mjs|cjs)$/;

// Tracked files, plus files that are new and not gitignored. In CI the second
// set is always empty; locally it means a test file you just created is counted
// as present the moment it exists, not only once it is committed.
function candidateFiles(pathspec) {
  const tracked = execFileSync('git', ['ls-files', pathspec], {
    encoding: 'utf8',
  });
  const untracked = execFileSync(
    'git',
    ['ls-files', '--others', '--exclude-standard', pathspec],
    { encoding: 'utf8' },
  );
  return [...new Set(`${tracked}\n${untracked}`.split('\n').filter(Boolean))];
}

// ---------------------------------------------------------------- present ---
const present = candidateFiles('web')
  .filter(
    (f) =>
      TEST_FILE_RE.test(f) &&
      !f.startsWith('web/dist/') &&
      !f.includes('/node_modules/'),
  )
  .sort();

// --------------------------------------------------------------- executed ---
const pkgPath = 'web/package.json';
if (!existsSync(pkgPath)) {
  console.error(`FAIL: ${pkgPath} not found`);
  process.exit(1);
}
const scripts = JSON.parse(readFileSync(pkgPath, 'utf8')).scripts || {};

// Flatten `npm run x && npm run y` chains down to leaf shell commands.
function leafCommands(name, seen = new Set()) {
  if (seen.has(name)) return [];
  seen.add(name);
  const body = scripts[name];
  if (body === undefined) return [{ kind: 'missing', text: name }];
  const out = [];
  for (const seg of body
    .split(/&&|\|\||;/)
    .map((s) => s.trim())
    .filter(Boolean)) {
    const ref = seg.match(/^npm\s+(?:run|run-script)\s+([A-Za-z0-9:_.-]+)/);
    if (ref) out.push(...leafCommands(ref[1], seen));
    else out.push({ kind: 'cmd', text: seg });
  }
  return out;
}

// Map a compiled artefact such as `.tmp-test/utils/x.test.js` back to the
// TypeScript source that produced it. Matching on path suffix avoids having to
// reproduce tsc's rootDir inference.
function mapArtefactToSource(artefact) {
  const stripped = artefact.replace(/^\.?\/?/, '').replace(/^[^/]*\//, '');
  const asTs = stripped.replace(/\.js$/, '.ts');
  const hit = present.filter((p) => p.endsWith(`/${asTs}`) || p === asTs);
  return hit.length === 1 ? hit[0] : null;
}

const executed = new Set();
const unanalysable = [];
let discoveryRunner = null;

for (const leaf of leafCommands('test')) {
  const t = leaf.text;

  if (leaf.kind === 'missing') {
    unanalysable.push(`npm run ${t} -> no such script in web/package.json`);
    continue;
  }
  // Pure compile/typecheck steps execute no tests.
  if (/^(tsc|rimraf|rm|mkdir|cpy|cp)\b/.test(t)) continue;

  if (/^node\b/.test(t)) {
    const args = t
      .split(/\s+/)
      .slice(1)
      .filter((a) => !a.startsWith('-'));
    if (args.length === 0) {
      unanalysable.push(`${t} -> node invocation with no script argument`);
      continue;
    }
    for (const a of args) {
      const src = mapArtefactToSource(a);
      if (src) executed.add(src);
      else unanalysable.push(`${t} -> cannot map '${a}' to a tracked test file`);
    }
    continue;
  }

  if (/\bvitest\b/.test(t)) {
    const args = t
      .split(/\s+/)
      .filter((a) => !a.startsWith('-') && !/vitest|^run$|^npx$/.test(a));
    if (args.length === 0) {
      // No path filter: vitest auto-discovers every matching test file.
      discoveryRunner = t;
      present.forEach((p) => executed.add(p));
    } else {
      for (const a of args) {
        const hits = present.filter((p) => p.includes(a));
        if (hits.length) hits.forEach((h) => executed.add(h));
        else
          unanalysable.push(
            `${t} -> path filter '${a}' matched no tracked test file`,
          );
      }
    }
    continue;
  }

  unanalysable.push(
    `${t} -> unrecognised test runner; teach scripts/ci-suite-manifest.mjs about it`,
  );
}

// ----------------------------------------------------------------- report ---
const missing = present.filter((p) => !executed.has(p));

console.log('=== JS/TS TEST SUITE MEMBERSHIP ===');
console.log(`web/package.json "test" = ${JSON.stringify(scripts.test ?? null)}`);
console.log('');

console.log(`TEST FILES PRESENT IN TREE (${present.length}):`);
if (present.length === 0) console.log('  (none)');
present.forEach((p) => console.log(`  ${p}`));
console.log('');

const executedList = [...executed].sort();
console.log(`TEST FILES ACTUALLY EXECUTED BY \`npm test\` (${executedList.length}):`);
if (executedList.length === 0) console.log('  (none)');
executedList.forEach((p) => console.log(`  ${p}`));
if (discoveryRunner) {
  console.log(`  ^ via auto-discovery by: ${discoveryRunner}`);
}
console.log('');

if (missing.length) {
  console.log(`NOT EXECUTED BY ANYTHING (${missing.length}):`);
  missing.forEach((p) => console.log(`  ${p}`));
  console.log('');
}
if (unanalysable.length) {
  console.log(`COULD NOT ANALYSE (${unanalysable.length}):`);
  unanalysable.forEach((u) => console.log(`  ${u}`));
  console.log('');
}

if (missing.length || unanalysable.length) {
  console.error(
    'FAIL: the set of test files that exist and the set that run do not match.\n' +
      '      This is the exact condition under which a suite disappears and the\n' +
      '      build still reports success. Wire the files above into\n' +
      '      web/package.json "test", or teach this script the new runner.',
  );
  process.exit(1);
}

console.log('OK: every tracked JS/TS test file is executed by `npm test`.');
