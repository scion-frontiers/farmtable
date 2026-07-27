#!/usr/bin/env node
/**
 * Runner for the plain-Node test scripts under `src/**\/*.test.ts`.
 *
 * These predate the component harness: each file is a standalone script that
 * throws on failure and prints a summary. They are compiled with
 * `tsconfig.test.json` into `.tmp-test/` and then executed one per process.
 *
 * The file list is a glob, not a hardcoded list, so a new `*.test.ts` under
 * `src/` is picked up automatically — including files that arrive from other
 * branches at merge time.
 *
 * Component tests live in `web/test/` and are run by Vitest instead; the two
 * globs deliberately do not overlap.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, rmSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(webRoot, '.tmp-test');

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

const sources = walk(join(webRoot, 'src'), (file) => file.endsWith('.test.ts')).sort();

if (sources.length === 0) {
  console.log('No src/**/*.test.ts scripts found — nothing to compile.');
  process.exit(0);
}

// A stale .tmp-test would otherwise keep running tests that no longer exist.
rmSync(outDir, { recursive: true, force: true });

console.log(`Compiling ${sources.length} Node test script(s) with tsconfig.test.json…`);
run(process.execPath, [join(webRoot, 'node_modules', 'typescript', 'bin', 'tsc'), '-p', 'tsconfig.test.json']);

const compiled = walk(outDir, (file) => file.endsWith('.test.js')).sort();

if (compiled.length !== sources.length) {
  console.error(
    `Expected ${sources.length} compiled test script(s), found ${compiled.length}:\n` +
      `  sources:  ${sources.map((file) => relative(webRoot, file)).join(', ')}\n` +
      `  compiled: ${compiled.map((file) => relative(webRoot, file)).join(', ')}\n` +
      'Check the "include" list in tsconfig.test.json.',
  );
  process.exit(1);
}

for (const file of compiled) {
  console.log(`\n▶ ${relative(webRoot, file)}`);
  run(process.execPath, [file]);
}

console.log(`\n${compiled.length} Node test script(s) passed.`);
