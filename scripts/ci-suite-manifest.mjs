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
// would print OK and exit 0. Raise this when suites are added.
const MIN_TEST_FILES = 1;

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
// paths. `--showConfig` resolves the globs against the real tree, so this is
// what tsc will actually compile -- not what this script thinks those globs mean.
function tsconfigFiles(cfgRelToWeb) {
  const out = ask(TSC_BIN, ['-p', cfgRelToWeb, '--showConfig']);
  if (out === null) return null;
  try {
    const files = JSON.parse(out).files;
    return Array.isArray(files) ? files.map(toRepoPath).sort() : null;
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
// The walk is read out of the script's source, and then CHECKED against the
// tsconfig the same script compiles with. Two independent statements of the
// same file set must agree; if they do not, the runner is reported unanalysable
// rather than believed. Anything this function cannot recognise returns an
// error string, never a set.
const WALK_RE =
  /walk\(\s*join\(\s*webRoot\s*,\s*(['"])([^'"]+)\1\s*\)\s*,\s*\(?\s*(\w+)\s*\)?\s*=>\s*\3\.endsWith\(\s*(['"])([^'"]+)\4\s*\)/g;

function expandRunnerScript(scriptRelToWeb) {
  const path = `web/${scriptRelToWeb.replace(/^\.\//, '')}`;
  if (!existsSync(path)) return { error: `no such file '${path}'` };
  const src = readFileSync(path, 'utf8');

  const walks = [...src.matchAll(WALK_RE)].map((m) => ({ dir: m[2], suffix: m[5] }));
  if (walks.length === 0) {
    return {
      error:
        `cannot determine which files '${path}' walks. It is a runner script, ` +
        'so it must not be assumed to run everything or nothing; teach ' +
        'WALK_RE in scripts/ci-suite-manifest.mjs its discovery shape.',
    };
  }

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
    return { error: `'${path}' names no \`tsc -p <config>\`; cannot cross-check its walk` };
  }
  const cfgFiles = tsconfigFiles(proj[1]);
  if (cfgFiles === null) {
    return {
      error:
        `could not ask tsc to expand ${proj[1]} (is web/node_modules installed?); ` +
        `refusing to guess what '${path}' compiles`,
    };
  }

  const walked = present
    .filter((p) => walks.some((w) => p.startsWith(`web/${w.dir}/`) && p.endsWith(w.suffix)))
    .sort();
  const compiled = cfgFiles.filter((f) => TEST_FILE_RE.test(f)).sort();

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
  return { files: walked, label: `${path} (walks ${shape}, cross-checked against ${proj[1]})` };
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

// tsconfig "include"/"files" globs, as anchored regexes over paths relative to
// web/. Needed because a `tsc -p ... && node --test <dir>` pipeline discovers
// only what the COMPILE step emitted: a test file the tsconfig does not include
// is invisible to the runner, and the runner cannot report its own blind spot.
function globToRe(g) {
  let re = '';
  for (let i = 0; i < g.length; i++) {
    const c = g[i];
    if (c === '*') {
      if (g[i + 1] === '*') {
        if (g[i + 2] === '/') {
          re += '(?:[^/]+/)*';
          i += 2;
        } else {
          re += '.*';
          i += 1;
        }
      } else {
        re += '[^/]*';
      }
    } else if (c === '?') {
      re += '[^/]';
    } else {
      re += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    }
  }
  return new RegExp(`^${re}$`);
}

// Strip // and /* */ comments from JSONC, ignoring anything inside a string.
//
// A naive /\/\*[\s\S]*?\*\//g does NOT ignore strings, and the glob
// "src/**/*.test.ts" contains both `/*` and `*/` -- so the naive version
// silently rewrites it to "src*.test.ts" and the include list stops matching
// the files it names. Found by running this, not by reading it.
function stripJsonComments(src) {
  let out = '';
  let inStr = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inStr) {
      out += c;
      if (c === '\\') {
        out += src[++i] ?? '';
      } else if (c === '"') {
        inStr = false;
      }
      continue;
    }
    if (c === '"') {
      inStr = true;
      out += c;
      continue;
    }
    if (c === '/' && src[i + 1] === '/') {
      while (i < src.length && src[i] !== '\n') i++;
      out += '\n';
      continue;
    }
    if (c === '/' && src[i + 1] === '*') {
      i += 2;
      while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) i++;
      i++;
      continue;
    }
    out += c;
  }
  return out;
}

// Returns null when the config cannot be read, [] meaning "matches everything"
// when it declares neither include nor files.
function compiledPatterns(cfgPath) {
  if (!existsSync(cfgPath)) return null;
  let cfg;
  try {
    cfg = JSON.parse(stripJsonComments(readFileSync(cfgPath, 'utf8')));
  } catch {
    return null;
  }
  const globs = [...(cfg.include ?? []), ...(cfg.files ?? [])];
  if (globs.length === 0) return [];
  return globs.map((g) => globToRe(g.replace(/^\.\//, '')));
}

const executed = new Set();
const unanalysable = [];
let discoveryRunner = null;
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
    if (proj) compileConfig = `web/${proj[1].replace(/^\.\//, '')}`;
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
      const pats = compiledPatterns(compileConfig);
      if (pats === null) {
        unanalysable.push(`${t} -> cannot read or parse ${compileConfig}`);
        continue;
      }

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
        const rel = src.replace(/^web\//, '');
        if (pats.length !== 0 && !pats.some((re) => re.test(rel))) {
          unanalysable.push(
            `${t} -> '${a}' is named, but its source ${src} is not matched by ` +
              `"include"/"files" in ${compileConfig}, so it is never compiled`,
          );
          continue;
        }
        executed.add(src);
      }
      continue;
    }

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

  if (runnerToken(t) === 'vitest') {
    const args = runnerArgs(t);
    if (args.length === 0) {
      // No path filter: vitest auto-discovers every matching test file.
      discoveryRunner = t;
      present.forEach((p) => executed.add(p));
    } else {
      for (const a of args) {
        const hits = present.filter((p) => pathFilterMatches(p, a));
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
    `FAIL: enumerated ${present.length} JS/TS test files, expected at least ` +
      `${MIN_TEST_FILES}.\n` +
      '      The population is the defect, not the membership. An empty set\n' +
      '      satisfies "every present file is executed" and would otherwise\n' +
      '      have exited 0. Check the `web` pathspec, TEST_FILE_RE, and\n' +
      '      whether the suites moved. If suites were deliberately removed,\n' +
      '      lower MIN_TEST_FILES in the same commit.',
  );
  console.error(`      ${counts} unanalysable=${unanalysable.length}`);
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

console.log(
  `OK: every tracked JS/TS test file is executed by \`npm test\`. ${counts} ` +
    `(floor ${MIN_TEST_FILES})`,
);
