#!/usr/bin/env node
/**
 * The one runner for this package's Node test scripts.
 *
 * Test files are the four `TEST_SUFFIXES` below, under `src/`. They are
 * DISCOVERED, not listed: adding a new one requires no edit to this file, to
 * package.json, to the membership checker or to ci.yml. That is the whole point
 * of it existing.
 *
 * WHY A SCRIPT AND NOT `node --test <something>`
 * ----------------------------------------------
 * Because there is no spelling of that command which works on both versions of
 * node this project runs. Measured on 2026-07-29 against node 20.20.2 (every
 * agent container) and node 22.23.1 (`ci.yml` NODE_VERSION, and the runner):
 *
 *   node --test .tmp-test          20: walks it   22: loads it as a module, FAILS
 *   node --test '.tmp-test/**\/*.js'  20: ENOENT     22: glob-expands, passes
 *   node --test                    20: finds the compiled .js
 *                                  22: finds the .ts SOURCE and fails it
 *   node --test <explicit files>   20: passes     22: passes
 *
 * The last row is the only agreement, and CI run 30458935255 is what the first
 * row costs. So discovery happens HERE, in JavaScript, where it means the same
 * thing on every version, and node is handed explicit paths and nothing else.
 *
 * ZERO TEST FILES IS A FAILURE, NOT A QUIET SUCCESS. An empty run that exits 0
 * is the precise shape of every defect this project spent 2026-07-29 removing:
 * a check that cannot see is not a check that passes.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, rmSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(webRoot, '.tmp-test');
const listOnly = process.argv.includes('--list');

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

// THESE FOUR MUST STAY IDENTICAL TO `include` IN tsconfig.test.json. The two
// lists are one object written in two files: this one decides what is looked
// for, that one decides what is compiled, and a file in one but not the other
// is a test that silently does not run. scripts/ci-suite-manifest.mjs compares
// the resolved sets on every build and fails on any difference, so the coupling
// is enforced rather than merely documented here.
const TEST_SUFFIXES = ['.test.ts', '.test.tsx', '.spec.ts'];

const sources = walk(join(webRoot, 'src'), (file) =>
  TEST_SUFFIXES.some((suffix) => file.endsWith(suffix)),
).sort();
const relSources = sources.map((file) => relative(webRoot, file).split('\\').join('/'));

// `--list` reports what WOULD run, without compiling or running anything, so
// scripts/ci-suite-manifest.mjs can reconcile this runner's own account of
// itself against its independent scan of the tree. The list is not evidence on
// its own -- a runner that under-reports is exactly the failure being guarded
// against -- which is why the checker compares it and fails on any residue in
// either direction rather than believing it.
if (listOnly) {
  if (relSources.length === 0) {
    console.error(
      `No src/**/*{${TEST_SUFFIXES.join(',')}} files found. ` +
        'Refusing to report an empty suite.',
    );
    process.exit(1);
  }
  console.log(relSources.join('\n'));
  process.exit(0);
}

if (sources.length === 0) {
  console.error(
    `No src/**/*{${TEST_SUFFIXES.join(',')}} files found.\n` +
      'This is a FAILURE, not an empty pass: a suite that discovers nothing and\n' +
      'exits 0 is indistinguishable from one that was silently deleted. If the\n' +
      'tests really are gone, remove this runner in the same commit.',
  );
  process.exit(1);
}

// A compiler does not delete. Without this, output compiled from a since-deleted
// test file stays in .tmp-test and keeps being executed and keeps passing.
rmSync(outDir, { recursive: true, force: true });

console.log(`Compiling ${sources.length} Node test script(s) with tsconfig.test.json…`);
run(process.execPath, [
  join(webRoot, 'node_modules', 'typescript', 'bin', 'tsc'),
  '-p',
  'tsconfig.test.json',
]);

// Derived, not restated: `.test.tsx` and `.spec.tsx` emit `.test.js`/`.spec.js`,
// so the emitted suffixes are TEST_SUFFIXES with the TypeScript extension
// replaced. Restating them by hand is how the two lists drift apart.
const EMITTED_SUFFIXES = [
  ...new Set(TEST_SUFFIXES.map((suffix) => suffix.replace(/\.tsx?$/, '.js'))),
];

const compiled = walk(outDir, (file) =>
  EMITTED_SUFFIXES.some((suffix) => file.endsWith(suffix)),
).sort();

// Discovery and compilation must agree. If tsconfig.test.json's `include` stops
// matching a file this runner found, that file silently stops being tested.
if (compiled.length !== sources.length) {
  console.error(
    `Expected ${sources.length} compiled test script(s), found ${compiled.length}:\n` +
      `  sources:  ${relSources.join(', ')}\n` +
      `  compiled: ${compiled.map((file) => relative(webRoot, file)).join(', ')}\n` +
      'Check the "include" list in tsconfig.test.json.',
  );
  process.exit(1);
}

// Explicit paths, per the matrix above. Never a directory, never a glob.
console.log(`Running ${compiled.length} test file(s) under node ${process.version}.`);
run(process.execPath, ['--test', ...compiled.map((file) => relative(webRoot, file))]);
