#!/usr/bin/env node
/**
 * Test runner for the web package.
 *
 * WHY THIS EXISTS. The previous runner was a hand-maintained `&&` chain in
 * package.json plus a hand-maintained `include` array in tsconfig.test.json.
 * That has two silent-skip failure modes, both of which make a new test file
 * look like it passed:
 *
 *   1. Add `foo.test.ts` and forget the tsconfig entry -> never compiled.
 *   2. Add the tsconfig entry and forget the package.json entry -> compiled but
 *      never executed.
 *
 * Neither produces any output. A test suite that can silently not run a test is
 * the same class of defect as the one this branch exists to fix (a declared
 * constraint that nothing invoked, with a green suite).
 *
 * So: tsconfig.test.json now globs `src/**\/*.test.ts`, and this runner
 * discovers the compiled output rather than being told about it. It then
 * CROSS-CHECKS the two: every `*.test.ts` under src must have produced exactly
 * one `*.test.js` under .tmp-test. A source file that failed to compile into
 * the tree is a hard error, not a skip.
 *
 * The `&&` chain also stopped at the first failing file, so one break hid every
 * later result. This runs all of them and reports each.
 */
import { spawnSync } from 'node:child_process';
import { readdirSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const webRoot = fileURLToPath(new URL('..', import.meta.url));
const srcDir = join(webRoot, 'src');
const outDir = join(webRoot, '.tmp-test');

/** Recursively collect files under `dir` whose name ends with `suffix`. */
function walk(dir, suffix) {
  const found = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...walk(full, suffix));
    else if (entry.name.endsWith(suffix)) found.push(full);
  }
  return found.sort();
}

/** 'util/safe-url.test' — the identity a source file and its output share. */
function stem(file, root, suffix) {
  return relative(root, file).slice(0, -suffix.length).split(sep).join('/');
}

if (!existsSync(outDir)) {
  console.error(
    `FAIL: ${relative(webRoot, outDir)} does not exist. ` +
      'The tsc -p tsconfig.test.json step did not emit anything.',
  );
  process.exit(1);
}

const sources = walk(srcDir, '.test.ts').map((f) => stem(f, srcDir, '.test.ts'));
const compiled = walk(outDir, '.test.js').map((f) => stem(f, outDir, '.test.js'));

// Anti-vacuity. Without this the runner reports success on an empty tree.
if (sources.length === 0) {
  console.error('FAIL: no *.test.ts files found under src/. Discovery is broken.');
  process.exit(1);
}

const missing = sources.filter((s) => !compiled.includes(s));
if (missing.length > 0) {
  console.error(
    'FAIL: these test sources produced no compiled output, so they would have ' +
      'been silently skipped:\n  ' +
      missing.map((m) => `src/${m}.test.ts`).join('\n  '),
  );
  process.exit(1);
}

const orphans = compiled.filter((c) => !sources.includes(c));
if (orphans.length > 0) {
  console.error(
    'FAIL: these compiled tests have no source, so .tmp-test is stale:\n  ' +
      orphans.map((o) => `.tmp-test/${o}.test.js`).join('\n  ') +
      '\nRemove .tmp-test and re-run.',
  );
  process.exit(1);
}

console.log(`Discovered ${sources.length} test file(s).\n`);

// Run every file, even after one fails: the `&&` chain hid later results.
const failed = [];
for (const s of sources) {
  const file = join(outDir, `${s}.test.js`);
  console.log(`--- src/${s}.test.ts`);
  // Exit code straight off the child, not through a pipe.
  const result = spawnSync(process.execPath, [file], { stdio: 'inherit' });
  if (result.status !== 0 || result.error) {
    failed.push(`src/${s}.test.ts (exit ${result.status}${result.error ? `, ${result.error.message}` : ''})`);
  }
  console.log('');
}

if (failed.length > 0) {
  console.error(`FAIL: ${failed.length} of ${sources.length} test file(s) failed:\n  ${failed.join('\n  ')}`);
  process.exit(1);
}

console.log(`PASS: ${sources.length} test file(s).`);
