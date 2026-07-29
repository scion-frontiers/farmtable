# 2026-07-29 — teaching the membership check to expand a glob runner

**Branch:** `fix/ci-manifest-glob-runner` off `fix/web-test-node22` (`060e9ad`,
itself off `main` `7a2ad51`) · **Scope:** `scripts/ci-suite-manifest.mjs` only.

`phase2-web-ui-r5` (`61ca67e`) replaces explicitly named test files with
`web/scripts/run-node-tests.mjs`, which walks the tree. The checker could not
map a walker to tracked files and refused to report green — correctly, but it
blocked the branch at step 6 with steps 7–11 skipped, so nothing behind the gate
was measured. The fix is to expand the runner, not to admit it.

## The reconciliation: 26 against 22 + 4

Nobody had checked whether those were the same 26, so they were measured as
three sets rather than assumed to partition.

| set | how it was obtained | n |
|---|---|---|
| **A** present | `git ls-files web` through the checker's `TEST_FILE_RE` | 26 |
| **B** vitest | `vitest list --filesOnly` — vitest's own answer | 22 |
| **C** node runner | `web/src` walked recursively for `*.test.ts` | 4 |

```
B ∩ C = 0        A − (B ∪ C) = ∅        (B ∪ C) − A = ∅        |B ∪ C| = 26
```

**They are the same 26, exactly partitioned, with no residue in either
direction.** The two globs are genuinely different — `test/**/*.test.ts` for
vitest, `src/**/*.test.ts` for the node runner — and they are complementary by
design, which `web/vitest.config.ts` says in a comment and the measurement now
confirms independently of the comment.

Note what would NOT have been caught by arithmetic alone: 22 + 4 = 26 is also
consistent with an overlap of *k* files plus *k* files run by nobody. Only the
set operations rule that out.

## Ask the runner; do not model it

The previous revision reimplemented three foreign resolvers: a tsconfig
`include` glob matcher, a JSONC comment stripper, and vitest's path-filter
semantics. Two of the three were wrong, and both wrongs were found by firing a
canary rather than by reading the code. All three are now deleted, because both
tools answer the question directly:

- `tsc -p <cfg> --showConfig` → the concrete `files` its globs resolve to.
- `vitest list --filesOnly [filters]` → the files vitest would run.

Both are invoked from `web/`, both return null on any failure, and every caller
treats null as unanalysable. A tool that cannot be asked is not a tool that
agreed.

**This corrected a live over-credit.** The old no-filter vitest arm did
`present.forEach(p => executed.add(p))` — it credited *every test file in the
tree* to vitest, including the four under `web/src` that vitest's own `include`
excludes. On the fixture that produced a plausible `executed=26`: the right
number, by the wrong mechanism, and only right because a second runner happened
to cover the four. The control below shows what that costs.

## The runner script itself is expanded, not allowlisted

An allowlist keyed on the runner's name would re-open the exact hole this check
exists to close: a runner whose glob quietly stops matching a directory is
indistinguishable, from the outside, from a runner that ran. So
`expandRunnerScript` reads the walk out of the script's source and then
**cross-checks it against the tsconfig that same script compiles with**. Two
independent statements of one file set must agree over the real tree, or the
runner is reported unanalysable.

It refuses, rather than guesses, when it cannot recognise the walk, when the
script never clears its output directory (the stale-output defect from the
previous branch, in its new shape), or when walk and tsconfig disagree.

**Enumeration stays independent, per EM-CI's constraint.** `present` is a git
tree scan. It is never taken from a runner's self-report, and any file that is
enumerated but absent from what the runner will run is `missing`, which is red.
A runner that under-reports its own list therefore fails the gate instead of
being believed by it. That property is what canary N tests.

## Canary evidence

Run against the fixture worktree at `61ca67e`, which was never modified: every
canary was reverted from a pre-canary copy and the worktree confirmed at
`git status --porcelain -uall` = 0 afterwards. Nothing was committed to it.
**OLD** is `fix/web-test-node22` — main as it is about to be.

| # | What is planted | OLD | NEW |
|---|-----------------|-----|-----|
| — | baseline, untouched fixture | 1 red (`cannot map run-node-tests.mjs`) | **0 GREEN** `26/26/0` |
| **CONTROL** | node runner dropped from `npm test`, so 4 files genuinely stop running | **0 GREEN, executed=26** | **1 RED**, `executed=22 missing=4`, naming all four |
| N | `src/util/x.test.tsx` — present, matched by neither glob | — | **1 RED** `27/26/1` |
| O | `src/util/x.test.ts` — present, matched by the runner's glob | — | **0 GREEN** `27/27/0` |
| Q | runner's walk narrowed to `src/util`, tsconfig unchanged | — | **1 RED** *walks a different set than tsconfig.test.json compiles* |
| R | `rmSync(outDir)` removed from the runner | — | **1 RED** *never removes its output directory* |
| S | walk rewritten to an unrecognised shape | — | **1 RED** *cannot determine which files it walks* |
| P | `vitest.config.ts` include narrowed to two files | 1 red, **still claims executed=26** | **1 RED** `executed=6 missing=20` |

**The CONTROL row is the finding.** With the node runner deleted from
`npm test`, four test files stop running and the old checker reports
`enumerated=26 executed=26 missing=0` and **exits 0**. That is precisely the
scenario this repository has already paid for once — two branches with mutually
exclusive `npm test` lists, where resolving the conflict either way silently
deletes a suite and the build still exits 0. The old gate waved it through. The
new one names the four orphans.

Row P is the same defect seen from the vitest side: narrowing vitest's config so
it runs 2 of 22 leaves the old arm still asserting all 26 executed.

N and O are the pair EM-CI asked for: **red when the runner would skip a file
present in the tree, green when it would not**, with the population changing in
both.

## Still true after the change

`MIN_TEST_FILES` stays **1**, which is correct for main and is not mine to
raise; `phase2-web-ui-r5` carries 26 and the floor should be raised in the
commit that lands them. Canaries A, B, C and I were re-fired on the main-shaped
tree and still red; `npm test` is exit 0 under node 20.20.2 and node 22.23.1;
the main tree still reports `enumerated=1 executed=1 missing=0`.

## Cost of asking

The checker now shells out to `tsc` and, where vitest is wired, to `vitest`.
Both need `web/node_modules`, so the step must run after `npm ci` — in `ci.yml`
it does (install at line 71, membership at line 84). Without an install the
checker is unanalysable and red, which is the intended direction: it does not
fall back to the model it just deleted.

## Not measured here

`em-hardening`'s `xss-url-scheme-union` @ `789314a` was named as a second
customer of this work. **That ref is not present in local canonical** — no
branch matching `xss-url-scheme-union` and `789314a` is not a valid object — so
it has not been measured and nothing here is claimed about it. Its reported
symptom (analyser exit 1, 0 of 5 executed, while `npm test` runs all 5) is a
different shape from this one, where the count was right and the mechanism
wrong.
