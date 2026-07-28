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
 *
 * TWO FURTHER GAPS, closed below, because "discovered and executed" is not the
 * same as "run":
 *
 *   3. THE NAMING GAP. Discovery keys on the literal suffix `.test.ts`. A file
 *      called `safe-url.spec.ts`, or `util/__tests__/safe-url.ts`, is not
 *      discovered, not compiled and not run -- silently, exactly like the two
 *      failure modes above. The fix is a CHOKEPOINT rather than a checklist:
 *      scanTestShaped() sweeps src/ with a deliberately BROAD test-shaped
 *      pattern and fails loudly on anything the narrow glob would have missed.
 *      A new naming convention does not get to be quietly skipped; it gets to
 *      be a build error that names the file and says what to rename it to.
 *
 *      What this does not cover: a test file outside src/ entirely. That is
 *      bounded by requireTestConfigGlob(), which pins tsconfig.test.json's
 *      include to `src/**\/*.test.ts` -- so "only src/ is compiled" is a
 *      checked fact rather than an assumption, and widening it forces a look
 *      at this runner.
 *
 *   4. THE CONSUMPTION GAP. A discovered, compiled, executed file that asserts
 *      nothing exits 0 and is counted as passing. Comment out the body of
 *      run() in any test file and the suite stays green. Every file now routes
 *      its assertions through src/util/assertions.ts, which prints a
 *      `#assertions N` receipt on exit; a file with no receipt (it never
 *      imported the module) or a zero receipt (it imported it and never used
 *      it) fails here. See assertions.ts for what a count does and does not
 *      prove.
 */
import { spawnSync } from 'node:child_process';
import { readdirSync, existsSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const webRoot = fileURLToPath(new URL('..', import.meta.url));
const srcDir = join(webRoot, 'src');
const outDir = join(webRoot, '.tmp-test');

/** Must match RECEIPT_PREFIX in src/util/assertions.ts. */
const RECEIPT_PREFIX = '#assertions ';

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

/**
 * Every file under `dir`, as a src-relative POSIX path. Used by the naming
 * chokepoint, which has to see files the narrow discovery glob does not.
 */
function walkAll(dir) {
  const found = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...walkAll(full));
    else found.push(relative(srcDir, full).split(sep).join('/'));
  }
  return found.sort();
}

/**
 * A whole word-segment of `test`/`tests`/`spec`/`specs` in the basename, or a
 * directory named for tests. Whole segments, not substrings, so `testing.ts`
 * and `latest.ts` are not test-shaped while `safe-url.spec.ts`,
 * `safe-url_test.ts` and `__tests__/safe-url.ts` all are.
 *
 * Erring broad is the point. A false positive costs one rename; a false
 * negative is a test nobody runs.
 */
const TEST_WORD = /(^|[.\-_])(tests?|specs?)([.\-_]|$)/i;
const TEST_DIR = /^_{0,2}(tests?|specs?)_{0,2}$/i;

function isTestShaped(rel) {
  const parts = rel.split('/');
  const base = parts.pop().replace(/\.[cm]?[jt]sx?$/, '');
  return parts.some((d) => TEST_DIR.test(d)) || TEST_WORD.test(base);
}

/**
 * Fails on any test-shaped file under src/ that the `.test.ts` discovery glob
 * would not pick up. This is the chokepoint: an unrecognised naming convention
 * becomes a loud error instead of a silent skip.
 */
function requireCanonicalTestNames(all) {
  const misnamed = all.filter((rel) => isTestShaped(rel) && !rel.endsWith('.test.ts'));
  if (misnamed.length === 0) return;
  console.error(
    'FAIL: these files under src/ look like tests but are not named `*.test.ts`, so ' +
      'tsconfig.test.json would not compile them and this runner would not run them:\n  ' +
      misnamed.map((m) => `src/${m}`).join('\n  ') +
      '\nRename to `<name>.test.ts` (or, if the file is not a test, rename it so it ' +
      'does not read as one).',
  );
  process.exit(1);
}

/**
 * Pins the premise that scanning src/ is enough: tsconfig.test.json compiles
 * src/ and nothing else. Widening that include without widening this runner
 * would reopen the naming gap outside src/.
 */
function requireTestConfigGlob() {
  const path = join(webRoot, 'tsconfig.test.json');
  const text = readFileSync(path, 'utf8');
  // Strip // comments; tsconfig allows them and JSON.parse does not.
  const cfg = JSON.parse(text.replace(/^\s*\/\/.*$/gm, ''));
  const want = ['src/**/*.test.ts'];
  const got = cfg.include ?? [];
  if (got.length !== want.length || got.some((g, i) => g !== want[i])) {
    console.error(
      `FAIL: tsconfig.test.json "include" is ${JSON.stringify(got)}, expected ` +
        `${JSON.stringify(want)}. This runner's naming chokepoint only scans src/, and ` +
        'its cross-check assumes every compiled test came from there. Change both together.',
    );
    process.exit(1);
  }
}

if (!existsSync(outDir)) {
  console.error(
    `FAIL: ${relative(webRoot, outDir)} does not exist. ` +
      'The tsc -p tsconfig.test.json step did not emit anything.',
  );
  process.exit(1);
}

requireTestConfigGlob();
requireCanonicalTestNames(walkAll(srcDir));

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
let totalAssertions = 0;

for (const s of sources) {
  const file = join(outDir, `${s}.test.js`);
  console.log(`--- src/${s}.test.ts`);

  // stdout is captured rather than inherited so the consumption receipt can be
  // read. The exit code still comes straight off the child -- spawnSync reports
  // result.status from waitpid, not from anything it read on the pipe -- and
  // stderr is inherited so failures still stream live and in order.
  const result = spawnSync(process.execPath, [file], {
    stdio: ['ignore', 'pipe', 'inherit'],
    encoding: 'utf8',
    timeout: 120_000,
  });
  const stdout = result.stdout ?? '';
  process.stdout.write(stdout);

  if (result.status !== 0 || result.error) {
    const why = result.error ? `, ${result.error.message}` : '';
    failed.push(`src/${s}.test.ts (exit ${result.status}${why})`);
    console.log('');
    continue;
  }

  // Consumption gate. Only meaningful on a file that exited 0: a file that
  // threw has already failed, and its receipt would undercount anyway.
  const receipts = stdout
    .split('\n')
    .filter((l) => l.startsWith(RECEIPT_PREFIX))
    .map((l) => Number.parseInt(l.slice(RECEIPT_PREFIX.length), 10));

  if (receipts.length === 0) {
    failed.push(
      `src/${s}.test.ts (exited 0 but emitted no "${RECEIPT_PREFIX.trim()}" receipt: ` +
        'it does not import src/util/assertions.ts, so nothing can tell whether it ' +
        'checked anything)',
    );
  } else if (receipts.some((n) => !Number.isInteger(n))) {
    failed.push(`src/${s}.test.ts (emitted an unparseable assertion receipt)`);
  } else {
    const n = Math.max(...receipts);
    if (n === 0) {
      failed.push(
        `src/${s}.test.ts (exited 0 having evaluated 0 assertions: it ran, and it ` +
          'checked nothing)',
      );
    } else {
      totalAssertions += n;
    }
  }
  console.log('');
}

if (failed.length > 0) {
  console.error(`FAIL: ${failed.length} of ${sources.length} test file(s) failed:\n  ${failed.join('\n  ')}`);
  process.exit(1);
}

// Suite-level anti-vacuity, as distinct from the per-file gate above: this is
// the number that would collapse if the shared harness were stubbed out.
if (totalAssertions === 0) {
  console.error('FAIL: the whole suite evaluated 0 assertions.');
  process.exit(1);
}

// ── the absolute pin ─────────────────────────────────────────────────────────
//
// `> 0` is a floor, and a floor cannot see a DELETION. Every gate above this
// line is relative: per-file receipts catch a file that checked nothing, and the
// suite floor catches a harness that was stubbed out, but removing one assertion
// from a file that still evaluates two hundred is invisible to both.
//
// That is not hypothetical. Mutation testing of the URL-binding scanner found
// three assertions that could be replaced with `true` -- the arm-2 guard-defeat
// check, arm 1's block scope, and the directory-reached check -- with the suite
// staying green and exit 0, because each of them is silent on a clean tree by
// construction. An assertion that only speaks when something is wrong cannot be
// proven present by a suite run over code that is right. Its COUNT can.
//
// WHAT THIS KILLS AND WHAT IT DOES NOT, stated plainly, because a pin whose
// reach is overstated is worse than no pin:
//
//   KILLS   deleting an assertion; deleting a fixture row; deleting a whole
//           test function; short-circuiting a loop that asserts per item.
//
//   MISSES  every count-neutral corruption -- and those are the majority of
//           interesting mutants. Weakening a predicate in place
//           (`x === 0` -> `x >= 0`), inverting a comparison, widening a regex,
//           replacing an assertion's condition with `true`: all of these
//           execute exactly one assertion, as before, and this check sees
//           nothing. Measured on this suite: of the five mutants that survived
//           the suite's own fixtures, this pin kills the two outright deletions and is
//           blind to the two that hold the count fixed.
//
// So it is a coarse net under a fine one, not a replacement for it. Add
// fixtures; this only stops them being quietly removed again.
//
// This is the OUTERMOST level. There is no gate above it that checks this
// number is maintained, and there cannot be one inside the same suite -- the
// regress has to stop somewhere, and it stops here because this is the last
// level that exists, not because the level is complete. Above it there is only
// review of the diff to this file.
//
// UPDATING IT IS EXPECTED. Adding tests changes this number; that is the point.
// Raise it in the same commit that adds them and the diff shows what you added.
// If you are LOWERING it, say in the commit message which assertions went away
// and why.
const EXPECTED_ASSERTIONS = 380;
if (totalAssertions !== EXPECTED_ASSERTIONS) {
  const delta = totalAssertions - EXPECTED_ASSERTIONS;
  console.error(
    `FAIL: the suite evaluated ${totalAssertions} assertions, expected exactly ` +
      `${EXPECTED_ASSERTIONS} (${delta > 0 ? '+' : ''}${delta}).\n` +
      (delta < 0
        ? '  Assertions have DISAPPEARED. Something that used to be checked is not being\n' +
          '  checked any more. Find out what before touching this number.\n'
        : '  You added assertions. Update EXPECTED_ASSERTIONS in web/scripts/run-tests.mjs\n' +
          '  in the same commit, so the diff records the change.\n') +
      '  Per-file counts are in the "#assertions" receipts above.',
  );
  process.exit(1);
}

console.log(`PASS: ${sources.length} test file(s), ${totalAssertions} assertions.`);
