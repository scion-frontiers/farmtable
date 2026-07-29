#!/usr/bin/env node
/**
 * Runner for the plain-Node test scripts under `src/`.
 *
 * These predate the component harness: each file is a standalone script that
 * throws on failure and prints a summary. They are compiled with
 * `tsconfig.test.json` into `.tmp-test/` and then executed one per process.
 *
 * The file list is a glob, not a hardcoded list, so a new test script under
 * `src/` is picked up automatically — including files that arrive from other
 * branches at merge time.
 *
 * Component tests live in `web/test/` and are run by Vitest instead; the two
 * globs deliberately do not overlap, because this one only ever looks at `src/`.
 *
 * ---------------------------------------------------------------------------
 * COUPLING — read this before changing any pattern below.
 *
 * Three pattern sets have to describe the same population, and nothing checks
 * that for you at author time:
 *
 *   1. `include` in `web/tsconfig.test.json`  — decides what gets COMPILED.
 *   2. `SOURCE_RE` here                       — decides what gets COUNTED.
 *   3. `OUTPUT_RE` here                       — decides what gets RUN.
 *
 * If (1) is wider than (2)+(3), a test file is compiled, never executed, and
 * never missed — a silent skip, which is the failure mode this runner exists to
 * prevent. If (2) is wider than (1), the count check below fails closed and the
 * suite goes red pointing at the tsconfig. Both are one-line mistakes, so when
 * you widen one, widen all three in the same commit.
 *
 * The sets are deliberately kept a subset of the CI manifest's own predicate in
 * `scripts/ci-suite-manifest.mjs` (`TEST_FILE_RE`), which matches
 * `test|spec` across `ts|tsx|mts|cts|js|mjs|cjs`. Moving toward that predicate
 * is safe; moving away from it makes the membership gate and this runner
 * disagree about what a test file is.
 * ---------------------------------------------------------------------------
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, rmSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(webRoot, '.tmp-test');

/**
 * TypeScript sources that `tsconfig.test.json` is expected to compile.
 * Mirrors its four `include` globs: {test,spec}.{ts,tsx}.
 */
const SOURCE_RE = /\.(test|spec)\.tsx?$/;

/**
 * The JavaScript those sources compile to. Both `.ts` and `.tsx` emit `.js`,
 * so this is the same two stems with one extension — NOT a copy of SOURCE_RE.
 * `.d.ts` and `.js.map` siblings do not match, which is intended.
 */
const OUTPUT_RE = /\.(test|spec)\.js$/;

/** Recursively collect files matching a predicate. */
function walk(dir, match, found = []) {
  if (!existsSync(dir)) return found;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, match, found);
    else if (match(full)) found.push(full);
  }
  return found;
}

function run(command, args) {
  execFileSync(command, args, { cwd: webRoot, stdio: 'inherit' });
}

const sources = walk(join(webRoot, 'src'), (file) => SOURCE_RE.test(file)).sort();

if (sources.length === 0) {
  console.log('No src test scripts found — nothing to compile.');
  process.exit(0);
}

// A stale .tmp-test would otherwise keep running tests that no longer exist.
rmSync(outDir, { recursive: true, force: true });

console.log(`Compiling ${sources.length} Node test script(s) with tsconfig.test.json…`);
run(process.execPath, [join(webRoot, 'node_modules', 'typescript', 'bin', 'tsc'), '-p', 'tsconfig.test.json']);

const compiled = walk(outDir, (file) => OUTPUT_RE.test(file)).sort();

// Fail closed. A mismatch means the tsconfig `include` and the patterns above
// have drifted apart: either something was compiled that we will not run, or
// something we counted was never emitted. Do not "fix" this by relaxing the
// check — reconcile the three pattern sets named in the header comment.
if (compiled.length !== sources.length) {
  console.error(
    `Expected ${sources.length} compiled test script(s), found ${compiled.length}:\n` +
      `  sources:  ${sources.map((file) => relative(webRoot, file)).join(', ')}\n` +
      `  compiled: ${compiled.map((file) => relative(webRoot, file)).join(', ')}\n` +
      'Check the "include" list in tsconfig.test.json against SOURCE_RE/OUTPUT_RE\n' +
      'in this script — all three must describe the same set of files.',
  );
  process.exit(1);
}

for (const file of compiled) {
  console.log(`\n▶ ${relative(webRoot, file)}`);
  run(process.execPath, [file]);
}

console.log(`\n${compiled.length} Node test script(s) passed.`);
