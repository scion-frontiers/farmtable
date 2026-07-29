#!/usr/bin/env node
/**
 * MEMBERSHIP GUARD FOR THE web TEST SUITE.
 *
 * WHAT THIS EXISTS TO CATCH, stated as the concrete incident rather than as a
 * principle: `#195` (markdown-sanitize-r10) and the XSS branch
 * (url-scheme-validation-r5) carry mutually exclusive `npm test` wiring. The
 * #195 side names its suites literally, in two places:
 *
 *     package.json  "test": "... && node .tmp-test/utils/task-ready.test.js
 *                             && node .tmp-test/util/markdown.test.js"
 *     tsconfig.test.json  "include": ["src/utils/task-ready.test.ts",
 *                                     "src/util/markdown.test.ts"]
 *
 * The XSS side globs `src/**\/*.test.ts` and delegates execution to
 * scripts/run-tests.mjs, which discovers what it runs.
 *
 * Adopt the #195 `test` script on a MERGED tree and three suites --
 * assertions.test.ts, safe-url.test.ts, url-binding-scan.test.ts -- are still
 * on disk, still compiled if the glob won, and NEVER EXECUTED. `npm test`
 * exits 0 with fewer suites than it had before and prints no smaller number,
 * because a suite that vanishes from an execution list leaves no trace in an
 * exit code. There is no CI in this repository and no second observer.
 *
 * ── WHY THIS GUARD READS THE WIRING AND NOT THE TREE ────────────────────────
 *
 * The obvious guard globs `src/**\/*.test.ts` and counts. That guard would
 * have been GREEN through the entire incident above, because every deleted
 * suite is still present as a FILE. "What exists" and "what executes" are
 * different populations, and the whole defect lives in the gap between them.
 * So this guard derives the EXECUTED set from package.json + tsconfig.test.json
 * -- the two files that actually decide -- and never from the file listing.
 *
 * ── WHY IT PINS NAMES AND NOT A NUMBER ──────────────────────────────────────
 *
 * A floor is absorbed by margin: drop a suite while adding a trivial one and a
 * `>= 4` floor stays green. An exact count is defeated by compensating
 * substitution for the same reason. A NAMED SET resists both -- you cannot
 * satisfy it by supplying a different suite, only by supplying the named one.
 * Identity is also lossless with respect to count: this guard can always report
 * how many, and a count could never have reported which.
 *
 * ── WHY IT FAILS CLOSED ON ANYTHING IT DOES NOT RECOGNISE ───────────────────
 *
 * The set of ways a `test` script could invoke suites is OPEN. Enumerating the
 * forms this guard understands and passing everything else would be the same
 * unsound move as widening a regex until the known counterexample fits -- there
 * is always another form, and the failure is silent. So the form space is
 * bounded from the other end: a step this guard cannot classify is a hard
 * ERROR that names the step. Adding a new invocation style is then a loud
 * build break that forces someone to teach this file about it, which is the
 * outcome we want. UNRECOGNISED IS NEVER TREATED AS EMPTY.
 *
 * Usage:  node check-test-membership.mjs [webRoot] [--pin <file>] [--write-pin]
 * Exit:   0 = every pinned suite executes.  1 = a pinned suite does not.
 *         2 = the guard could not determine the answer (fail closed).
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(name);
const valueOf = (name, dflt) => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : dflt;
};
const positional = argv.filter((a, i) => !a.startsWith('--') && argv[i - 1] !== '--pin');
const webRoot = positional[0] ?? process.cwd();
const pinPath = valueOf('--pin', join(webRoot, 'test-suites.pin'));

/** Fail closed: the guard could not answer. Never conflate with "nothing missing". */
function undetermined(msg) {
  console.error(`GUARD-UNDETERMINED: ${msg}`);
  console.error('  Refusing to report a membership result. This is not a pass.');
  process.exit(2);
}

function readJsonAllowingComments(path) {
  if (!existsSync(path)) undetermined(`${relative(webRoot, path) || path} does not exist`);
  const text = readFileSync(path, 'utf8');
  try {
    // tsconfig permits // line comments; JSON.parse does not.
    return JSON.parse(text.replace(/^\s*\/\/.*$/gm, ''));
  } catch (e) {
    undetermined(`${relative(webRoot, path) || path} is not parseable: ${e.message}`);
  }
}

/** Every `*.test.ts` under src/, as stems like 'util/safe-url'. */
function walkTestStems(dir, root, found = []) {
  if (!existsSync(dir)) return found;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walkTestStems(full, root, found);
    else if (entry.name.endsWith('.test.ts')) {
      found.push(relative(root, full).slice(0, -'.test.ts'.length).split(sep).join('/'));
    }
  }
  return found.sort();
}

// ── classify the test script ────────────────────────────────────────────────

const pkgPath = join(webRoot, 'package.json');
const pkg = readJsonAllowingComments(pkgPath);
const script = pkg?.scripts?.test;
if (typeof script !== 'string' || script.trim() === '') {
  undetermined('package.json has no "scripts.test" string');
}
for (const hook of ['pretest', 'posttest']) {
  if (typeof pkg.scripts?.[hook] === 'string') {
    undetermined(
      `package.json defines "${hook}", which npm runs around "test" and this guard ` +
        'does not model. Teach this guard about it before relying on the result.',
    );
  }
}

const tsconfigTestPath = join(webRoot, 'tsconfig.test.json');
const tsconfigTest = readJsonAllowingComments(tsconfigTestPath);
const include = tsconfigTest?.include;
if (!Array.isArray(include)) undetermined('tsconfig.test.json has no "include" array');

const GLOB_INCLUDE = 'src/**/*.test.ts';
const includeIsGlob = include.length === 1 && include[0] === GLOB_INCLUDE;

// Steps are `&&`-separated. `;` and `||` are deliberately NOT accepted as
// separators: they change failure semantics, and a guard that silently treated
// them as equivalent would be modelling a script that does not exist.
if (/[;|](?!\|)/.test(script.replace(/\|\|/g, '||')) || script.includes('||')) {
  undetermined(`the test script uses ';' or '||', which this guard does not model: ${script}`);
}
const steps = script.split('&&').map((s) => s.trim()).filter(Boolean);

const EXPLICIT_NODE = /^node\s+\.tmp-test\/(.+)\.test\.js$/;
const RUNNER = /^node\s+scripts\/run-tests\.mjs$/;
const BENIGN = [/^rm\s+-rf\s+\.tmp-test$/, /^tsc\s+-p\s+tsconfig\.test\.json$/];

let delegated = false;
const explicit = [];
for (const step of steps) {
  if (BENIGN.some((re) => re.test(step))) continue;
  const m = EXPLICIT_NODE.exec(step);
  if (m) { explicit.push(m[1]); continue; }
  if (RUNNER.test(step)) { delegated = true; continue; }
  undetermined(
    `unrecognised step in the test script: "${step}"\n` +
      '  This guard cannot tell which suites that step runs, so it will not report a\n' +
      '  membership result. Add the step to this guard, or express it in a form the\n' +
      '  guard already understands.',
  );
}

if (delegated && explicit.length > 0) {
  undetermined(
    'the test script BOTH delegates to scripts/run-tests.mjs AND names suites ' +
      'explicitly. That combination is ambiguous and this guard will not guess.',
  );
}

// ── compute the executed set ────────────────────────────────────────────────

const srcDir = join(webRoot, 'src');
let executed;
let mode;

if (delegated) {
  // run-tests.mjs hard-fails unless tsconfig.test.json's include is exactly the
  // glob (its requireTestConfigGlob). If it is not, `npm test` ABORTS -- loudly,
  // exit 1, no suites run. That is a broken build, not a silent deletion, and it
  // is NOT this guard's failure to report as missing membership.
  if (!includeIsGlob) {
    undetermined(
      `the test script delegates to scripts/run-tests.mjs, but tsconfig.test.json ` +
        `"include" is ${JSON.stringify(include)}, not ${JSON.stringify([GLOB_INCLUDE])}.\n` +
        '  run-tests.mjs aborts on exactly this mismatch, so `npm test` fails closed and\n' +
        '  runs nothing. Fix the wiring; there is no membership answer to give.',
    );
  }
  if (!existsSync(join(webRoot, 'scripts', 'run-tests.mjs'))) {
    undetermined('the test script delegates to scripts/run-tests.mjs, which does not exist');
  }
  mode = 'delegated discovery (scripts/run-tests.mjs globs src/**/*.test.ts)';
  executed = walkTestStems(srcDir, srcDir);
} else {
  mode = 'explicit invocation list in package.json "test"';
  executed = [...explicit].sort();
  // A suite named in package.json but absent from tsconfig include is compiled
  // by nothing, so `node .tmp-test/<x>.test.js` fails on a missing file. Loud.
  if (!includeIsGlob) {
    const missingFromInclude = executed.filter((s) => !include.includes(`src/${s}.test.ts`));
    if (missingFromInclude.length > 0) {
      undetermined(
        'these suites are executed by package.json but not compiled by ' +
          `tsconfig.test.json "include": ${missingFromInclude.join(', ')}`,
      );
    }
  }
}

// ── compare against the pin ─────────────────────────────────────────────────

/**
 * Reduce any reasonable spelling of a suite name to the one internal stem.
 *
 * WHY THIS EXISTS, as the concrete bug rather than a principle. The guard's
 * internal stem is bare -- `util/markdown`. The first HAND-WRITTEN pin used the
 * spelling `util/markdown.test`, which is at least as natural. Nothing
 * normalised, so `'util/markdown.test' !== 'util/markdown'` and the guard
 * reported the suite as NOT EXECUTED while it was executing, printing the
 * filename `src/util/markdown.test.test.ts`, which exists nowhere on disk.
 *
 * It exited 1. RED was the expected result for that tree, so the exit code
 * looked like the guard working. IT WAS RED FOR THE WRONG REASON, and every
 * name in the report was wrong, including the two that were fine.
 *
 * The six fixture arms did not catch it because every one of those pins was
 * generated with --write-pin, so the writer and the reader shared a private
 * convention and always agreed. The only untested path was the hand-written
 * pin -- which is the only kind a human ever maintains. A GUARD TESTED ONLY
 * AGAINST ITS OWN GENERATED INPUT HAS TESTED ITS AGREEMENT WITH ITSELF.
 */
function canonicalStem(raw) {
  let s = raw.replace(/^\.\//, '').replace(/^src\//, '');
  const suffix = ['.test.ts', '.test.js', '.test'].find((x) => s.endsWith(x));
  if (suffix) s = s.slice(0, -suffix.length);
  return s;
}

if (flag('--write-pin')) {
  // Emit the same spelling the guard PRINTS, so a name read out of a failure
  // report can be pasted straight into the pin without a second convention.
  const body = executed.map((s) => `src/${s}.test.ts`).join('\n');
  writeFileSync(pinPath, `${body}\n`, 'utf8');
  console.log(`Wrote ${executed.length} suite name(s) to ${pinPath}:`);
  for (const s of executed) console.log(`  src/${s}.test.ts`);
  process.exit(0);
}

if (!existsSync(pinPath)) {
  undetermined(
    `no pin file at ${pinPath}. Create it with --write-pin, and review the contents ` +
      'in the same commit -- an unreviewed pin records whatever is broken today.',
  );
}

const pinnedRaw = readFileSync(pinPath, 'utf8')
  .split('\n')
  .map((l) => l.replace(/#.*$/, '').trim())
  .filter(Boolean);

if (pinnedRaw.length === 0) {
  undetermined(`the pin file ${pinPath} lists no suites. An empty pin cannot fail.`);
}

// A pin entry this guard cannot parse must never be reported as "a suite that
// stopped running" -- that is a false accusation against a suite that may be
// running perfectly well, and it is indistinguishable in the output from the
// real defect. Unparseable input is UNDETERMINED, like every other thing this
// guard does not understand.
for (const raw of pinnedRaw) {
  const c = canonicalStem(raw);
  if (c === '' || c.includes('..') || c.startsWith('/') || /\.test\b/.test(c) || /\s/.test(c)) {
    undetermined(
      `the pin file ${pinPath} contains an entry this guard cannot parse: "${raw}"\n` +
        '  Accepted spellings are "src/util/foo.test.ts", "util/foo.test" or "util/foo".\n' +
        '  Refusing to report it as a missing suite: an unparseable pin entry and a deleted\n' +
        '  suite would look identical in the output, and only one of them is a real defect.',
    );
  }
}

const pinned = [...new Set(pinnedRaw.map(canonicalStem))].sort();
executed = [...new Set(executed.map(canonicalStem))].sort();

const missing = pinned.filter((p) => !executed.includes(p));
const added = executed.filter((e) => !pinned.includes(e));

console.log(`Execution mode: ${mode}`);
console.log(`Executed suites (${executed.length}):`);
for (const s of executed) console.log(`  src/${s}.test.ts`);

if (missing.length > 0) {
  console.error(
    `\nFAIL: ${missing.length} pinned suite(s) are NOT executed by \`npm test\`:\n  ` +
      missing.map((m) => `src/${m}.test.ts`).join('\n  ') +
      '\n\n  These files may still exist on disk and may still compile. They are not\n' +
      '  being run. `npm test` will exit 0 without them and report no smaller number.\n' +
      '  If the removal is deliberate, remove the name from the pin file in the same\n' +
      '  commit, so the diff records which suite stopped running and why.',
  );
  process.exit(1);
}

if (added.length > 0) {
  console.log(
    `\nNOTE: ${added.length} executed suite(s) are not in the pin:\n  ` +
      added.map((a) => `src/${a}.test.ts`).join('\n  ') +
      '\n  Add them with --write-pin so a later deletion is caught.',
  );
}

console.log(`\nPASS: all ${pinned.length} pinned suite(s) execute.`);
