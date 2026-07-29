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

// COMMITTED FLOOR. The number of JS/TS test files this repository is known to
// have. If enumeration returns fewer than this, the population itself is the
// defect and no membership comparison is meaningful: with an empty `present`
// set, "every present file is executed" is vacuously true and this script
// would print OK and exit 0.
//
// WHAT ONE UNIT OF MIN_TEST_FILES IS. Exactly one file path that is
//
//   - under the `web` pathspec,
//   - visible to git: tracked, or untracked and not ignored,
//   - matching TEST_FILE_RE,
//   - not under `web/dist/` and not under any `node_modules/`.
//
// It is RUNNER-BLIND: it counts files on disk, and nothing else. It is not a
// count of manifest entries, not a count of executed suites, not a count of
// `test()` or `describe()` calls, and not affected by whether anything runs
// those files. That independence is the point -- `present` is the yardstick the
// runners are measured against, so it must never be derived from them.
//
// IT IS SET TO THE POPULATION ON MAIN, NOT BELOW IT. A floor below the
// population is a licence to delete: it certifies that some files may vanish
// without anyone being told.
//
// THE POPULATION IS A PATH SET, AND THE PATH SET IS THE AUDITABLE ARTEFACT --
// the integer below is only its cardinality. A bare count cannot be diffed by
// the next reader and cannot tell real growth from a leak (compiled output
// wandering into `present`, say). So the set is written out. First derived at
// main 439b309, where it was these six:
//
//   web/src/capabilities.test.ts
//   web/src/components/inspector/render-sink-xss.test.ts
//   web/src/util/assertions.test.ts
//   web/src/util/safe-url.test.ts
//   web/src/util/url-binding-scan.test.ts
//   web/src/utils/task-ready.test.ts
//
// Reconciled at 439b309 against the runner's own `--list`: both sets are those
// six paths, `A - B` and `B - A` are both empty. So the floor was 6 at 439b309
// because the population at 439b309 was those six files -- not because 6 felt
// safe, and not from any branch's population.
//
// RE-DERIVED ON hardening/markdown-href, WHICH ADDS ONE SUITE. The population
// is now these seven, the sixth line being the new one:
//
//   web/src/capabilities.test.ts
//   web/src/components/inspector/render-sink-xss.test.ts
//   web/src/util/assertions.test.ts
//   web/src/util/markdown-href.test.ts
//   web/src/util/safe-url.test.ts
//   web/src/util/url-binding-scan.test.ts
//   web/src/utils/task-ready.test.ts
//
// Reconciled the same way -- this script's enumeration against the runner's own
// `--list` -- and both sets are those seven paths with no residue in either
// direction. The floor moves to 7 in the same commit as the file it counts,
// because a floor that lags the population is a licence to delete the newest
// suite in silence.
//
// TO RE-DERIVE THIS RATHER THAN TRUST IT, from a clean checkout:
//   node scripts/ci-suite-manifest.mjs          # prints the set it enumerated
//   (cd web && node scripts/run-node-tests.mjs --list)
// If those two disagree, that is a defect report and not a new floor.
//
// This number is correct FOR the population above and is expected to move: it
// must be re-derived, set-wise, at any commit that changes the population, and
// raised in the commit that adds a suite.
//
// WHAT IT DETECTS DEPENDS ON WHERE IT IS SET, AND THAT IS EASY TO GET WRONG.
// While the floor sat at 1 against a population of 6 it could only catch a
// collapse toward zero, and losing one file out of six was invisible to it.
// Set EQUAL to the population, as it now is, it catches any NET REDUCTION --
// seven becomes six and this fails.
//
// WHAT IT STILL CANNOT DETECT, AT ANY SETTING, IS A SUBSTITUTION: delete one
// test file and add another in the same commit and the cardinality is
// unchanged, so this passes while a suite has in fact been lost. A count cannot
// see that; only a committed expected-SET can, which is why the path set above
// is written out and why the expected-set upgrade is filed rather than
// hand-waved. The enumerated/executed/missing reconciliation below is a
// different check again, and this floor is not a substitute for either.
//
// This is a MINIMUM, which is what the brief asks for. The stronger form is a
// committed expected-SET for JS/TS mirroring .github/expected-go-tests.txt,
// with the same asymmetry -- removals block, additions merely notice. Filed as
// a backlog item; not built here.
//
// Adding a suite is what raises this number.
const MIN_TEST_FILES = 7;

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
// The population, per the MIN_TEST_FILES predicate above.
//
// Note what TEST_FILE_RE does NOT exclude: compiled test output. `x.test.js`
// emitted by tsc is a test file by name, and if it is git-visible it is counted
// alongside the `x.test.ts` it came from. Nothing here prevents that; the
// invariant is asserted where the outDir is actually known, in
// expandRunnerScript, so that it cannot be quietly lost to a rename.
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

// Split a script body on `&&`, `||` and `;` that are OUTSIDE quotes.
//
// A plain `body.split(/&&|\|\||;/)` also splits on those characters when they
// appear INSIDE a quoted argument, turning one command into two fragments that
// are then classified independently -- so a runner can be misidentified, or
// vanish, because of punctuation in one of its arguments. Returns null on an
// unterminated quote, which the caller treats as unanalysable rather than
// guessing.
function splitTopLevel(body) {
  const out = [];
  let cur = '';
  let quote = null;
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (quote) {
      cur += c;
      if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'") {
      quote = c;
      cur += c;
      continue;
    }
    if (c === ';') {
      out.push(cur);
      cur = '';
      continue;
    }
    if ((c === '&' || c === '|') && body[i + 1] === c) {
      out.push(cur);
      cur = '';
      i++;
      continue;
    }
    cur += c;
  }
  if (quote !== null) return null;
  out.push(cur);
  return out.map((s) => s.trim()).filter(Boolean);
}

// Flatten `npm run x && npm run y` chains down to leaf shell commands.
function leafCommands(name, seen = new Set()) {
  if (seen.has(name)) return [];
  seen.add(name);
  const body = scripts[name];
  if (body === undefined) return [{ kind: 'missing', text: name }];
  const segments = splitTopLevel(body);
  if (segments === null) {
    return [{ kind: 'unquotable', text: body }];
  }
  const out = [];
  for (const seg of segments) {
    const ref = seg.match(/^npm\s+(?:run|run-script)\s+([A-Za-z0-9:_.-]+)/);
    if (ref) out.push(...leafCommands(ref[1], seen));
    else out.push({ kind: 'cmd', text: seg });
  }
  return out;
}

// Split a single command into arguments, respecting quotes and removing them.
// Splitting on /\s+/ alone would turn `vitest "a b"` into three tokens, two of
// them carrying stray quote characters.
function tokenise(cmd) {
  const out = [];
  let cur = '';
  let quote = null;
  let started = false;
  for (const c of cmd) {
    if (quote) {
      if (c === quote) quote = null;
      else cur += c;
      continue;
    }
    if (c === '"' || c === "'") {
      quote = c;
      started = true;
      continue;
    }
    if (/\s/.test(c)) {
      if (started) out.push(cur);
      cur = '';
      started = false;
      continue;
    }
    cur += c;
    started = true;
  }
  if (started) out.push(cur);
  return out;
}

// Wrappers that run some OTHER program: the runner is the token after them.
const LAUNCHERS = new Set(['npx', 'pnpx', 'bunx', 'dlx', 'pnpm', 'yarn', 'bun']);

// The program a command actually invokes.
//
// Classifying by a regex over the WHOLE command string is unsafe: the runner's
// name can appear in a flag value, a config filename or a path and be read as
// the runner. `npx jest --config vitest.config.ts` is a jest run. Only the
// leading token decides, after skipping env assignments, launcher flags and
// launchers themselves.
function runnerToken(cmd) {
  const toks = tokenise(cmd);
  for (const tok of toks) {
    if (tok.startsWith('-')) continue; // launcher flag, e.g. npx --yes
    if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(tok)) continue; // FOO=bar prefix
    const base = tok.replace(/^.*\//, ''); // ./node_modules/.bin/vitest
    if (LAUNCHERS.has(base)) continue;
    return base;
  }
  return null;
}

// Positional arguments to a runner: everything after the leading token that is
// not a flag, an env assignment, a launcher, or the runner itself.
function runnerArgs(cmd) {
  const toks = tokenise(cmd);
  const out = [];
  let seenRunner = false;
  for (const tok of toks) {
    if (tok.startsWith('-')) continue;
    if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(tok)) continue;
    const base = tok.replace(/^.*\//, '');
    if (!seenRunner) {
      if (LAUNCHERS.has(base)) continue;
      seenRunner = true;
      continue;
    }
    if (base === 'run') continue; // `vitest run <filter>`
    out.push(tok);
  }
  return out;
}

// ------------------------------------------------------------ interrogation ---
// ASK THE RUNNER, DO NOT MODEL IT.
//
// Earlier revisions of this script reimplemented other people's glob semantics
// -- a tsconfig `include` matcher, a JSONC comment stripper, a vitest path
// filter. Every one of them was a guess about somebody else's resolver, and two
// of the three were wrong in a way that only showed up when fired. The tools
// can each be asked directly, and their answer is the ground truth this script
// is trying to approximate, so it asks.
//
// Every helper here returns null on ANY failure and every caller treats null as
// unanalysable. A tool that cannot be asked is not a tool that agreed.
function ask(binRelToRepo, args) {
  if (!existsSync(binRelToRepo)) return null;
  try {
    return execFileSync(process.execPath, [`${repoRoot}/${binRelToRepo}`, ...args], {
      cwd: `${repoRoot}/web`,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 32 * 1024 * 1024,
      timeout: 120_000,
    });
  } catch {
    return null;
  }
}

const TSC_BIN = 'web/node_modules/typescript/bin/tsc';
const VITEST_BIN = 'web/node_modules/vitest/vitest.mjs';

function toRepoPath(p) {
  const s = p.replace(/^\.\//, '');
  if (s.startsWith('/')) return s.startsWith(`${repoRoot}/`) ? s.slice(repoRoot.length + 1) : s;
  return `web/${s}`;
}

// TypeScript's own expansion of a tsconfig's include/files globs, as concrete
// paths, plus where it puts the output. `--showConfig` resolves the globs
// against the real tree, so this is what tsc will actually compile -- not what
// this script thinks those globs mean.
function tsconfigInfo(cfgRelToWeb) {
  const out = ask(TSC_BIN, ['-p', cfgRelToWeb, '--showConfig']);
  if (out === null) return null;
  try {
    const cfg = JSON.parse(out);
    if (!Array.isArray(cfg.files)) return null;
    const outDir = cfg.compilerOptions && cfg.compilerOptions.outDir;
    return {
      files: cfg.files.map(toRepoPath).sort(),
      outDir: typeof outDir === 'string' ? toRepoPath(outDir).replace(/\/$/, '') : null,
    };
  } catch {
    return null;
  }
}

// Vitest's own answer to "which files would this invocation run", including the
// effect of its config `include`/`exclude` and of any positional filters.
function vitestFiles(filters) {
  const out = ask(VITEST_BIN, ['list', '--filesOnly', ...filters]);
  if (out === null) return null;
  return out
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('['))
    .map(toRepoPath)
    .sort();
}

// A runner script such as `node scripts/run-node-tests.mjs` walks the tree for
// test files instead of naming them. Expanding it means working out WHICH files
// that walk yields -- an allowlist that merely waves the runner through would
// re-create the exact hole this script exists to close, because a runner whose
// glob silently stops matching a directory is indistinguishable from one that
// never ran.
//
// Whatever the runner is asked or read, the answer is CHECKED against the
// tsconfig that same script compiles with, and against `present`. Independent
// statements of one file set must agree; if they do not, the runner is reported
// unanalysable rather than believed. Anything this function cannot establish
// returns an error string, never a set.
//
// WALK_RE is the fallback path only, for a runner that offers no `--list`. It
// deliberately recognises one narrow shape: a regex chasing arbitrary discovery
// logic would eventually match something it does not understand, and a wrong
// answer here is worse than a refusal.
const WALK_RE =
  /walk\(\s*join\(\s*webRoot\s*,\s*(['"])([^'"]+)\1\s*\)\s*,\s*\(?\s*(\w+)\s*\)?\s*=>\s*\3\.endsWith\(\s*(['"])([^'"]+)\4\s*\)/g;

function expandRunnerScript(scriptRelToWeb) {
  const path = `web/${scriptRelToWeb.replace(/^\.\//, '')}`;
  if (!existsSync(path)) return { error: `no such file '${path}'` };
  const src = readFileSync(path, 'utf8');

  // A compiler does not delete. Same defect as the `node --test` arm: without a
  // clean, output compiled from a since-deleted test keeps being executed and
  // keeps reporting pass.
  if (!/\brmSync\s*\(|\brm\s+-rf\b/.test(src)) {
    return {
      error:
        `'${path}' never removes its output directory, so stale output from ` +
        'deleted test files is still executed and still passes',
    };
  }

  const proj = src.match(/['"]-p['"]\s*,\s*['"]([^'"]+)['"]/) || src.match(/-p\s+(\S+)/);
  if (!proj) {
    return { error: `'${path}' names no \`tsc -p <config>\`; cannot cross-check what it runs` };
  }
  const cfg = tsconfigInfo(proj[1]);
  if (cfg === null) {
    return {
      error:
        `could not ask tsc to expand ${proj[1]} (is web/node_modules installed?); ` +
        `refusing to guess what '${path}' compiles`,
    };
  }
  const compiled = cfg.files.filter((f) => TEST_FILE_RE.test(f)).sort();

  // THE DOUBLE-COUNT INVARIANT, ASSERTED RATHER THAN ASSUMED.
  //
  // TEST_FILE_RE matches `.js`/`.mjs`/`.cjs`, so this runner's COMPILED OUTPUT
  // is, by name, a test file. It stays out of `present` today only because the
  // outDir happens to be gitignored -- an accident of another file, not a
  // decision recorded here. Move the outDir somewhere untracked-but-not-ignored
  // and `present` roughly doubles: every test counted once as source and once
  // as artefact. That direction still LOOKS safe, because the floor is more
  // satisfied than before, which is exactly why it has to be asserted.
  //
  // The outDir is taken from tsc, not from a hardcoded name, so renaming it
  // cannot quietly step around this.
  if (cfg.outDir) {
    const visibleOutput = candidateFiles(cfg.outDir).filter((f) => TEST_FILE_RE.test(f));
    if (visibleOutput.length) {
      return {
        error:
          `${proj[1]} compiles into '${cfg.outDir}', and ${visibleOutput.length} ` +
          'file(s) there are visible to git, so compiled output is being counted ' +
          'as source and every test is enumerated twice: ' +
          `[${visibleOutput.slice(0, 5).join(', ')}]. Add '${cfg.outDir}/' to ` +
          '.gitignore, or point outDir at a directory that is ignored.',
      };
    }
  }

  // WHICH FILES DOES IT RUN? Two ways to establish that, never one.
  //
  // Preferred: the runner states its own list. That statement is NOT
  // self-certifying and never stands alone -- a runner that under-reports is
  // precisely the failure being guarded against, and believing the claim would
  // let it grade its own homework. It is reconciled BOTH against what tsc says
  // the same script compiles AND against `present`, an independent scan of the
  // tree. Any residue in any direction is fatal.
  //
  // Fallback, for a runner that offers no list: read the walk out of its source
  // and cross-check that against tsc. Weaker, and printed as such.
  //
  // Only ask a runner that advertises the flag. Passing `--list` to a runner
  // that does not know it would not list anything -- it would RUN THE SUITE,
  // during a check whose entire job is to not need the suite to have run.
  const claim = /--list/.test(src) ? ask(path, ['--list']) : null;

  if (claim !== null) {
    const claimed = [
      ...new Set(
        claim
          .split('\n')
          .map((l) => l.trim())
          .filter(Boolean)
          .map((l) => `web/${l.replace(/^\.\//, '')}`),
      ),
    ].sort();
    if (claimed.length === 0) {
      return { error: `'${path} --list' reported no test files at all` };
    }

    const phantom = claimed.filter((f) => !present.includes(f));
    if (phantom.length) {
      return {
        error:
          `'${path} --list' claims files an independent scan of the tree does ` +
          `not have: [${phantom.join(', ')}]`,
      };
    }

    // THE COUPLING (see TEST_SUFFIXES in the runner). The runner's discovery
    // list and the tsconfig's `include` are one object written in two files. A
    // file in one but not the other is a test that compiles and never runs, or
    // runs and never compiles. Both are silent today and loud here.
    const notCompiled = claimed.filter((f) => !compiled.includes(f));
    const notRun = compiled.filter((f) => !claimed.includes(f));
    if (notCompiled.length || notRun.length) {
      return {
        error:
          `'${path}' and ${proj[1]} have diverged -- the runner's discovery ` +
          "list and the tsconfig's `include` must match: " +
          `listed-but-not-compiled [${notCompiled.join(', ') || 'none'}] ` +
          `compiled-but-not-listed [${notRun.join(', ') || 'none'}]`,
      };
    }

    return {
      files: claimed,
      label:
        `${path} — agreed by its own --list (${claimed.length}) + ` +
        `tsc ${proj[1]} + an independent tree scan`,
    };
  }

  const walks = [...src.matchAll(WALK_RE)].map((m) => ({ dir: m[2], suffix: m[5] }));
  if (walks.length === 0) {
    return {
      error:
        `cannot determine which files '${path}' runs. It offers no \`--list\`, ` +
        'and its discovery shape is unrecognised. A runner must not be assumed ' +
        'to run everything or nothing: give it a `--list` mode, or teach ' +
        'WALK_RE in scripts/ci-suite-manifest.mjs its shape.',
    };
  }

  const walked = present
    .filter((p) => walks.some((w) => p.startsWith(`web/${w.dir}/`) && p.endsWith(w.suffix)))
    .sort();

  const onlyWalked = walked.filter((f) => !compiled.includes(f));
  const onlyCompiled = compiled.filter((f) => !walked.includes(f));
  if (onlyWalked.length || onlyCompiled.length) {
    return {
      error:
        `'${path}' walks a different set than ${proj[1]} compiles, so what it ` +
        'runs cannot be established: ' +
        `walked-only [${onlyWalked.join(', ') || 'none'}] ` +
        `compiled-only [${onlyCompiled.join(', ') || 'none'}]`,
    };
  }

  const shape = walks.map((w) => `${w.dir}/**/*${w.suffix}`).join(', ');
  return {
    files: walked,
    label: `${path} — agreed by walk ${shape} + tsc ${proj[1]} (no --list offered)`,
  };
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


// ------------------------------------------------------- population guard ---
// THE TWO SETS ARE DRAWN FROM DIFFERENT UNIVERSES. THAT IS THE WHOLE POINT.
//
//   `present`  (enumerated) <- GIT. Tracked files, plus untracked-and-not-
//                              ignored ones. Nothing gitignored can EVER be in
//                              it.
//   `executed` (attributed) <- THE FILESYSTEM. Every runner resolves its own
//                              discovery against the disk, and the disk also
//                              holds gitignored build artefacts.
//
// The difference between them is therefore structurally ASYMMETRIC. A
// gitignored path -- the compiled intermediates under `web/.tmp-test/`, say --
// can appear on the attributed side and can never appear on the enumerated
// side. And `missing` is enumerated-minus-attributed, ONE DIRECTION, so
// crediting an out-of-population path can only ever push `missing` toward
// zero.
//
// So it is not that `missing == 0` happened not to catch a runner sweeping up
// build artefacts. `missing == 0` was STRUCTURALLY INCAPABLE of catching it: a
// metric that cannot go up is not a metric. This arm measures the other
// direction, attributed-minus-enumerated, and it is NOT redundant with the
// missing check. Anyone about to "simplify" it away is deleting the only arm
// that looks at the universe where the extra files live.
function outOfPopulation(files) {
  return files.filter((f) => !present.includes(f));
}

// POSITIVE CONTROL, FIRED ON EVERY RUN, IN-PROCESS.
//
// `outOfPopulation(...).length === 0` has its PASS CONDITION AT ZERO -- and
// zero is also exactly what a BROKEN implementation returns. A typo, a wrong
// path root, a set built from the wrong variable, an empty input: any of them
// makes this arm return a constant zero and pass forever while reading as a
// clean bill of health. A guard whose failure mode is indistinguishable from
// its expected output is not a guard.
//
// So the same function used for the real answer is also fired, in the same
// invocation, at a path constructed to be outside any population, and the
// result is printed next to the real answer. A zero that has never been shown
// capable of being non-zero is a default, not a measurement.
const CONTROL_PATH = 'web/__ci-suite-manifest-positive-control__/seeded.test.ts';
const controlHits = outOfPopulation([CONTROL_PATH]);
if (controlHits.length !== 1) {
  console.error(
    'FAIL: the surplus arm\'s positive control did not fire.\n' +
      `      outOfPopulation(['${CONTROL_PATH}']) returned ` +
      `${controlHits.length}; it must return 1.\n` +
      '\n' +
      '      That seeded path is not in the tree, so the surplus computation\n' +
      '      MUST flag it. It did not, which means the computation is broken\n' +
      '      and every `surplus=0` it reports is a constant, not a finding.\n' +
      '      The real answer below cannot be trusted and is not printed as a\n' +
      '      pass.\n' +
      '\n' +
      '      DO THIS: fix `outOfPopulation` or the `present` set it closes\n' +
      '      over in scripts/ci-suite-manifest.mjs -- usually a wrong path\n' +
      '      root, or `present` having come back empty. If instead somebody\n' +
      '      has genuinely created a file at CONTROL_PATH, rename CONTROL_PATH\n' +
      '      to something still absent. Do not delete the control: a surplus\n' +
      '      arm with no positive control is the failure mode it exists for.',
  );
  process.exit(1);
}

const executed = new Set();
// Paths a runner claimed that are NOT in the enumerated population. Recorded
// per-runner and BY NAME: the count alone tells whoever has to fix this
// nothing, whereas the paths themselves name the runner and the directory.
const surplus = [];
const unanalysable = [];
const discovery = [];

// Attribute a runner's discovery set to the population, refusing to silently
// intersect. In-population paths are credited; out-of-population paths are
// recorded as surplus, which is fatal at the verdict below.
function credit(source, files) {
  const outside = outOfPopulation(files);
  if (outside.length) surplus.push({ source, paths: outside });
  for (const f of files) if (present.includes(f)) executed.add(f);
}
let compileConfig = null;
const cleaned = new Set();

for (const leaf of leafCommands('test')) {
  const t = leaf.text;

  if (leaf.kind === 'missing') {
    unanalysable.push(`npm run ${t} -> no such script in web/package.json`);
    continue;
  }
  if (leaf.kind === 'unquotable') {
    unanalysable.push(`${t} -> unterminated quote; cannot split into commands`);
    continue;
  }
  // Pure compile/typecheck steps execute no tests -- but they decide what a
  // later runner is ABLE to see, so remember which tsconfig was used and which
  // output directories were cleaned first.
  if (/^(tsc|rimraf|rm|mkdir|cpy|cp)\b/.test(t)) {
    const proj = t.match(/(?:^|\s)(?:-p|--project)\s+(\S+)/);
    if (proj) compileConfig = proj[1].replace(/^\.\//, ''); // relative to web/
    if (/^(rm|rimraf)\b/.test(t)) {
      for (const a of tokenise(t).slice(1)) {
        if (!a.startsWith('-')) cleaned.add(a.replace(/^\.\//, '').replace(/\/+$/, ''));
      }
    }
    continue;
  }

  if (/^node\b/.test(t)) {
    const flags = tokenise(t).filter((a) => a.startsWith('-'));
    const args = t
      .split(/\s+/)
      .slice(1)
      .filter((a) => !a.startsWith('-'));

    // `node --test <positional>`: THE POSITIONAL MUST BE AN EXPLICIT FILE.
    //
    // What node does with a positional changed between the version this repo's
    // containers run and the version ci.yml pins, and the change is silent:
    //
    //   node 20.20.2   node 22.23.1
    //   ------------   ------------
    //   `--test .tmp-test`              walks the dir   loads the dir AS A MODULE
    //                                   1 pass, exit 0  MODULE_NOT_FOUND, exit 1
    //   `--test '.tmp-test/**/*.js'`    literal path    glob-expands
    //                                   ENOENT, exit 1  1 pass, exit 0
    //   `--test` (no positional)        finds the       finds the .ts SOURCE and
    //                                   compiled .js    fails it
    //   `--test <file.js>`              1 pass          1 pass
    //
    // Measured locally against both binaries; the directory row is CI run
    // 30458935255, which turned main red. Only the explicit-file row agrees
    // across versions, so every other shape is refused here rather than left to
    // be discovered by whichever node the next runner happens to pin.
    if (flags.includes('--test')) {
      if (args.length === 0) {
        unanalysable.push(
          `${t} -> \`node --test\` with no positional: node 20 discovers the ` +
            'compiled output, node 22 discovers the TypeScript sources instead',
        );
        continue;
      }
      let bad = false;
      for (const a of args) {
        if (a.includes('*')) {
          unanalysable.push(
            `${t} -> glob positional '${a}': expanded by node 22, taken as a ` +
              'literal path by node 20 (ENOENT). Name the files.',
          );
          bad = true;
        } else if (!/\.[cm]?js$/.test(a)) {
          unanalysable.push(
            `${t} -> directory positional '${a}': node 20 walks it, node 22 ` +
              'loads it as a module and fails with MODULE_NOT_FOUND. Name the files.',
          );
          bad = true;
        }
      }
      if (bad) continue;

      if (!compileConfig) {
        unanalysable.push(
          `${t} -> node --test with no preceding \`tsc -p <config>\`; ` +
            'cannot tell which sources reach the runner',
        );
        continue;
      }
      // `.files` and not the whole record: this arm only asks WHICH SOURCES tsc
      // emits, so it can tell a named artefact that will exist from one that
      // never will. The outDir half of the record is the other call site's
      // concern (the double-count invariant), not this one's.
      const emittedCfg = tsconfigInfo(compileConfig);
      if (emittedCfg === null) {
        unanalysable.push(
          `${t} -> could not ask tsc to expand web/${compileConfig} ` +
            '(is web/node_modules installed?)',
        );
        continue;
      }
      const emitted = emittedCfg.files;

      for (const a of args) {
        // A compiler does not delete. Without a clean, the compiled form of a
        // since-deleted test can still sit in the output directory. Measured on
        // the previous branch: the manifest said 1 and `npm test` ran 2.
        const top = a.replace(/^\.\//, '').split('/')[0];
        if (!cleaned.has(top)) {
          unanalysable.push(
            `${t} -> nothing removes '${top}' before the compile step, so ` +
              'stale output from deleted test files survives in it',
          );
          continue;
        }
        const src = mapArtefactToSource(a);
        if (!src) {
          unanalysable.push(`${t} -> cannot map '${a}' to a tracked test file`);
          continue;
        }
        // The named artefact only exists if the tsconfig actually emits its
        // source. Naming a file the compile step never produces is a red at
        // runtime, not a silent skip -- but it is cheaper to say so here.
        if (!emitted.includes(src)) {
          unanalysable.push(
            `${t} -> '${a}' is named, but tsc does not compile its source ` +
              `${src} under web/${compileConfig}, so it is never emitted`,
          );
          continue;
        }
        credit(t, [src]);
      }
      continue;
    }

    if (args.length === 0) {
      unanalysable.push(`${t} -> node invocation with no script argument`);
      continue;
    }
    for (const a of args) {
      const src = mapArtefactToSource(a);
      if (src) {
        credit(t, [src]);
        continue;
      }
      // Not a compiled test artefact. It may be a RUNNER SCRIPT that walks the
      // tree for test files -- `node scripts/run-node-tests.mjs`. Such a script
      // must be expanded to the set it will actually walk. Waving it through on
      // the strength of its name would re-open the hole this check exists to
      // close: a runner whose glob quietly stops matching a directory looks
      // exactly like a runner that ran.
      const r = expandRunnerScript(a);
      if (r.error) {
        unanalysable.push(`${t} -> ${r.error}`);
        continue;
      }
      discovery.push(r.label);
      credit(r.label, r.files);
    }
    continue;
  }

  if (runnerToken(t) === 'vitest') {
    // Ask vitest. Its config `include`/`exclude` and its positional filters are
    // vitest's semantics, not this script's, and the previous revision's
    // hand-written approximations of both were wrong in opposite directions:
    // with no filter it credited EVERY test file in the tree, including ones
    // vitest's own `include` excludes.
    const files = vitestFiles(runnerArgs(t));
    if (files === null) {
      unanalysable.push(
        `${t} -> could not ask vitest which files it would run ` +
          `(needs ${VITEST_BIN}; run \`npm ci\` in web/ first)`,
      );
      continue;
    }
    if (files.length === 0) {
      unanalysable.push(`${t} -> vitest reports it would run NO files at all`);
      continue;
    }
    discovery.push(`${t} (${files.length} files, per \`vitest list\`)`);
    credit(`${t} (per \`vitest list\`)`, files);
    continue;
  }

  unanalysable.push(
    `${t} -> unrecognised test runner '${runnerToken(t) ?? '(none)'}'; ` +
      'teach scripts/ci-suite-manifest.mjs about it',
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
console.log(
  `TEST FILES ATTRIBUTED TO A RUNNER NAMED IN \`npm test\` (${executedList.length}):`,
);
if (executedList.length === 0) console.log('  (none)');
executedList.forEach((p) => console.log(`  ${p}`));
discovery.forEach((d) => console.log(`  ^ via discovery by: ${d}`));
console.log('');

const surplusTotal = surplus.reduce((n, s) => n + s.paths.length, 0);
if (surplusTotal) {
  console.log(`ATTRIBUTED BUT OUTSIDE THE ENUMERATED POPULATION (${surplusTotal}):`);
  for (const s of surplus) {
    console.log(`  from ${s.source}:`);
    s.paths.forEach((p) => console.log(`    ${p}`));
  }
  console.log('');
}

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

// Three integers, always, on every verdict. A missing integer is missing,
// whereas a missing intention reads as a sentence: "every present file is
// executed" is a true sentence about an empty tree and a false reassurance.
const counts =
  `enumerated=${present.length} executed=${executedList.length} ` +
  `missing=${missing.length}`;

// FLOOR FIRST. If enumeration under-ran, every other number below is a
// statement about a population that was never found, and the membership
// comparison passes vacuously.
if (present.length < MIN_TEST_FILES) {
  console.error(
    `FAIL: ${MIN_TEST_FILES - present.length} JS/TS test file(s) have gone ` +
      `missing from the tree.\n` +
      `      Enumerated ${present.length}; this repository is known to have at ` +
      `least ${MIN_TEST_FILES}.\n` +
      '\n' +
      '      TEST FILES DO NOT USUALLY VANISH ON PURPOSE. Assume they were\n' +
      '      lost until you have shown otherwise -- most often to a merge\n' +
      '      resolution that dropped a side, a move that left the `web`\n' +
      '      pathspec, a rename past TEST_FILE_RE, or a .gitignore rule that\n' +
      '      now covers them. FIND THEM FIRST:\n' +
      '\n' +
      '        git log --diff-filter=D --name-only -20 -- web\n' +
      '        git status --porcelain --ignored web | grep -E "test|spec"\n' +
      '\n' +
      '      The population is the defect here, not the membership: an empty\n' +
      '      set satisfies "every present file is executed", so without this\n' +
      '      floor the run below would have exited 0 and told you nothing.\n' +
      '\n' +
      '      WHAT THIS FLOOR DETECTS: a NET REDUCTION in the population. It is\n' +
      '      set equal to the population, so any commit that ends with fewer\n' +
      '      test files than it started with lands here -- including the total\n' +
      '      collapse to zero, which is the vacuous-pass case where there is\n' +
      '      nothing left to compare and the comparison therefore succeeds.\n' +
      '\n' +
      '      WHAT IT CANNOT DETECT, so do not read a green as more than it is:\n' +
      '      a SUBSTITUTION. Delete one test file and add another in the same\n' +
      '      commit and the count is unchanged, so this check passes while a\n' +
      '      suite has been lost. Only a committed expected-SET catches that.\n' +
      '      The enumerated/executed/missing reconciliation below is a separate\n' +
      '      check again, and this floor is not a substitute for either.\n' +
      '\n' +
      '      Lowering MIN_TEST_FILES is not the remedy for this failure. It\n' +
      '      is a separate, deliberate decision that a suite is INTENDED to\n' +
      '      be gone: make it in the commit that deletes the suite, and say\n' +
      '      in the message which files went and why. Lowering it to make\n' +
      '      this message stop is how the alarm gets disabled by the person\n' +
      '      it was ringing for. (Raising it is the other half: a new suite\n' +
      '      should raise the floor in the commit that adds it.)',
  );
  console.error(`      ${counts} unanalysable=${unanalysable.length}`);
  process.exit(1);
}

// SURPLUS BEFORE MISSING. A surplus does not merely add a second problem, it
// INVALIDATES the missing number printed above: the two sides were drawn from
// different populations, so `missing=0` there is not evidence of anything.
if (surplusTotal) {
  const named = [];
  for (const s of surplus) {
    named.push(`        from ${s.source}:`);
    s.paths.forEach((p) => named.push(`          ${p}`));
  }
  console.error(
    `FAIL: ${surplusTotal} path(s) were attributed to a runner named in\n` +
      '      web/package.json "test" but are NOT in the enumerated population.\n' +
      '\n' +
      '      THE SURPLUS, BY RUNNER AND BY NAME:\n' +
      `${named.join('\n')}\n` +
      '\n' +
      '      WHY THIS IS FATAL AND NOT A ROUNDING ERROR. The two sides come\n' +
      '      from different universes: `enumerated` is what GIT can see\n' +
      '      (tracked, or untracked and not ignored), `attributed` is what a\n' +
      '      runner finds on the FILESYSTEM. `missing` is enumerated minus\n' +
      '      attributed -- one direction -- so a path that exists on disk but\n' +
      '      not in git can only ever push `missing` DOWN, never up. Left\n' +
      '      unchecked, `missing=0` becomes unfalsifiable and this whole gate\n' +
      '      certifies green by construction. The surplus is the diagnostic.\n' +
      '\n' +
      '      THE LIKELY CAUSE IS A RUNNER WITH NO CONFIG FILE. With nothing to\n' +
      '      scope it, a runner falls back to its BUILT-IN DEFAULT `include`\n' +
      '      and sweeps up everything that matches by name -- typically another\n' +
      '      runner\'s test sources AND the compiled intermediates under a\n' +
      '      gitignored output directory. A runner running unconfigured is what\n' +
      '      a surplus looks like from here, and it is usually also red under a\n' +
      '      real `npm test` for the same reason.\n' +
      '\n' +
      '      DO THIS: add the missing config and scope its `include` to the\n' +
      '      files that runner actually owns. For vitest, that is\n' +
      '      web/vitest.config.ts:\n' +
      '\n' +
      "          import { defineConfig } from 'vitest/config';\n" +
      '          export default defineConfig({\n' +
      "            test: { include: ['test/**/*.test.ts'], environment: 'jsdom' },\n" +
      '          });\n' +
      '\n' +
      '      Then re-run. Point `include` at the directory that runner owns; if\n' +
      '      that directory has no tests yet, the honest fix is to give the\n' +
      '      runner its first test or to stop naming it in scripts.test.\n' +
      '\n' +
      '      DO NOT widen the enumerated population to swallow the surplus, and\n' +
      '      DO NOT delete this arm. Both make the build green by making the\n' +
      '      gate blind, which is the state this gate exists to end. Un-ignoring\n' +
      '      a build-output directory so its artefacts count as source is the\n' +
      '      same move wearing a different hat.',
  );
  console.error(
    `      ${counts} surplus=${surplusTotal} unanalysable=${unanalysable.length}`,
  );
  process.exit(1);
}

if (missing.length || unanalysable.length) {
  console.error(
    'FAIL: the set of test files that exist and the set that run do not match.\n' +
      '      This is the exact condition under which a suite disappears and the\n' +
      '      build still reports success. Wire the files above into\n' +
      '      web/package.json "test", or teach this script the new runner.',
  );
  console.error(`      ${counts} unanalysable=${unanalysable.length}`);
  process.exit(1);
}

// SAY ONLY WHAT WAS CHECKED. The previous wording here claimed every tracked
// test file "is executed by `npm test`" -- a claim about a command this script
// NEVER RUNS. It parses scripts.test statically and asks each runner to
// ENUMERATE. A static parse of a script is not an observation of the script,
// and enumeration is not execution: `vitest list` lists twelve files without
// running one of them, so it cannot possibly notice that all twelve are
// incapable of running. Making the script run `npm test` would be circular and
// slow; making the claim match the evidence is neither.
console.log(
  'OK: every tracked JS/TS test file is ATTRIBUTABLE to a runner named in ' +
    `web/package.json "test". ${counts} (floor ${MIN_TEST_FILES})`,
);
console.log(
  '    ATTRIBUTION IS NOT EXECUTION, AND IT IS NOT PASSING. This script did not\n' +
    '    run `npm test`. It read scripts.test and asked each runner to ENUMERATE\n' +
    '    (`vitest list`, `run-node-tests.mjs --list`); listing does not run a\n' +
    '    file, so nothing above is evidence that a listed file executes at all,\n' +
    '    let alone that it passes. Run `npm test` for that. A green here says\n' +
    '    exactly one thing: no tracked test file is orphaned from every runner.',
);
console.log(
  `    surplus=0 of ${executedList.length} attributed path(s). The two sides come from\n` +
    '    DIFFERENT UNIVERSES -- enumerated from GIT (tracked, or untracked and\n' +
    '    not ignored), attributed from the FILESYSTEM (runner discovery) -- so\n' +
    '    this arm is not redundant with missing=0 and must not be simplified\n' +
    `    away. Positive control, fired this run: outOfPopulation(['${CONTROL_PATH}'])\n` +
    `    returned ${controlHits.length}, so the zero above is a measurement and not a default.`,
);
