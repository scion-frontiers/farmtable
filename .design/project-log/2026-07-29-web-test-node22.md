# 2026-07-29 — `node --test <dir>` is not portable, and it turned main red

**Branch:** `fix/web-test-node22` off `main` (`7a2ad51`) · **Scope:**
`web/package.json` test script and `scripts/ci-suite-manifest.mjs`.

Main went red at run 30458935255, step *Web tests (invoked directly)*:

```
> rm -rf .tmp-test && tsc -p tsconfig.test.json && node --test .tmp-test
Error: Cannot find module '/home/runner/work/farmtable/farmtable/web/.tmp-test'
code: MODULE_NOT_FOUND ... not ok 1 - .tmp-test ... # fail 1
```

`tsc` printed nothing and exited 0. The compile was fine. The runner invocation
was not.

## The hypothesis was testable, so it was tested

EM-CI proposed a node version split and asked for evidence rather than assent.
`npx -p node@22 node` yields v22.23.1 — the exact version the runner reported —
so both binaries were available locally and the same tree was run under each.

| `node --test` positional | node 20.20.2 (containers) | node 22.23.1 (`ci.yml` `NODE_VERSION`) |
|---|---|---|
| `.tmp-test` (directory) | exit 0, 1 pass | **exit 1, MODULE_NOT_FOUND** |
| `./.tmp-test` | exit 0, 1 pass | **exit 1, MODULE_NOT_FOUND** |
| `tmp-test` (no leading dot) | exit 0, 1 pass | **exit 1, MODULE_NOT_FOUND** |
| `'.tmp-test/**/*.test.js'` | **exit 1, ENOENT** | exit 0, 1 pass |
| none | exit 0, runs the compiled `.js` | **exit 1, runs the `.ts` SOURCE and fails it** |
| `.tmp-test/utils/task-ready.test.js` | exit 0, 1 pass | exit 0, 1 pass |

**Hypothesis confirmed**, and the local reproduction is byte-identical to the CI
failure. Two refinements the measurement added that reading would not have:

- **It is not the leading dot.** `tmp-test` fails on node 22 exactly as
  `.tmp-test` does. The dot matters only in the no-positional row, where node 22
  skips dot-directories while walking and therefore finds `src/**/*.test.ts`
  instead of the compiled output.
- **A positional on node 22 is a file, not a place to look.** That is the whole
  defect. Node 20 walks it.

Only the explicit-file row agrees across both versions, so that is the fix.

## What was wrong with the evidence, not with the tree

The previous branch's canary table was honest and every row of it was real. The
suite was green here, green under review, and red on the runner. Nothing in the
tree changed between those three readings; the interpreter did.

> **A canary run only in the dev environment does not prove the gate on the runner.**

This is the same shape as that branch's own `tsc`-outDir find — two instruments
disagreeing, with the reassuring one wrong — except that this time the two
instruments were two *node versions*, and the one I had was the reassuring one.
The generalisation I should have drawn then and did not: when a check depends on
a tool, the version of that tool is part of the check, and a version that only
CI has is a part of the check I have not run.

## The fix, and why it is not merely a workaround

`web/package.json` now names the compiled file:

```
rm -rf .tmp-test && tsc -p tsconfig.test.json && node --test .tmp-test/utils/task-ready.test.js
```

Naming files is what this whole track exists to stop being *silent* about — but
it is not silent here, because `ci-suite-manifest.mjs` compares the named set
against the tree and reds on any drift. An unnamed new test file is a build
failure, not a skipped suite. The durable answer is the discovery runner from
the paused glob-runner task, which does its walking in JavaScript and so does
not depend on node's CLI semantics at all; this fix is what gets main green
today, and that one replaces it.

The more valuable half is in the manifest. It now **refuses the three
non-portable shapes outright** rather than waiting for the next node bump to
find them:

- a directory positional,
- a glob positional,
- `--test` with no positional.

Each refusal names both versions and what each does. The failure that cost main
a red run is now a condition the gate detects before the push.

## Canary evidence

Every guard fired, then the tree was restored and confirmed byte-identical by
`cmp` against a pre-canary copy. Canaries were not committed.

| # | Guard | Canary (`scripts.test`) | exit |
|---|-------|--------------------------|------|
| A | leading-token runner classification | `npx vitest-runner-x` | **1 RED** |
| B | path-filter anchoring | `npx vitest run read` | **1 RED** |
| C | population floor | `npx vitest run` + emptied index | **1 RED** |
| I | **directory positional** | `… && node --test .tmp-test` | **1 RED** |
| J | **glob positional** | `… && node --test .tmp-test/**/*.test.js` | **1 RED** |
| K | **no positional** | `… && node --test` | **1 RED** |
| L | output dir not cleaned | `rm -rf` dropped | **1 RED** |
| M | tsconfig never emits the named file | `include: ["src/**/*.spec.ts"]` | **1 RED** |
| — | baseline and after restore | committed script | **0 GREEN**, `enumerated=1 executed=1 missing=0` |

Canary **I is the outage**: had this guard existed yesterday, the manifest step
would have failed on the branch and main would never have gone red.

Canary C used a temporary `GIT_INDEX_FILE` plus moving the file outside the
repository, so the real index was never modified; it reports
`enumerated=0 executed=0 missing=0 unanalysable=0` — every guard empty, which is
the vacuous pass the floor exists to catch.

**Verified after the fix, under both binaries:** `npm test` exit 0,
`# tests 1 # pass 1 # fail 0` on node 20.20.2 **and** node 22.23.1; manifest
exit 0.

## Not fixed here

`ci.yml` pins `NODE_VERSION: 22` while every container on this host runs node
20. That gap is what made a locally-green suite a red runner, and it will do so
again for the next tool whose behaviour moved between those versions. Owned by
`farmtable-ci-workflow`; worth either aligning the versions or running the web
suite under both.
