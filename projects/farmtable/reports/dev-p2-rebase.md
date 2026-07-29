# dev-p2-rebase — report

**Result:** `p2-land` rebased onto `aa08f1a`, in `/workspace/dev-p2-rebase`.

- **Rebase tip `3679e247e6b5ccf9d4c7b81df01acda3e836cedc`** — the 42 replayed commits. Every
  measurement in sections C and D was taken at this sha.
- **Branch tip `e64138c058ad707d2b08b3a213cfa63c17c8e953`** — adds one docs-only commit, the
  §10 project-log entry (`.design/project-log/task-state-web-ui-p2-rebase.md`). This is the
  deliverable branch: 43 commits from `aa08f1a`.

Re-verified at `e64138c` after the log commit: `git status --porcelain` zero lines; runner blob
`2163726`, manifest blob `2d2f0996`, `web/package.json` blob `ac89df7` all unchanged; gate exit 0 at
`enumerated=26 executed=26 missing=0`. The log commit touches no code.

**Read section A first.** One instruction in the brief could not be obeyed as written. I did not
silently pick a side — I resolved it the way section 9's own tie-break rule points, and I ran the
counterfactual so you can see what the other side costs.

---

## A. THE BRIEF IS NOT JOINTLY SATISFIABLE — `web/package.json`

Section 3 says:

> Keep main's `test` script. Keep the branch's phase 2 additions to every other field.

Section 5 says `node scripts/ci-suite-manifest.mjs` must exit 0.

**These two cannot both hold.** Not a style disagreement — measured, both ways, at the tip.

Main's `test` is `node scripts/run-node-tests.mjs`. Main's runner walks **`web/src/` only** (its own
header says so: *"Component tests live in `web/test/` and are run by Vitest instead"*). Phase 2's 26
test files split 4 under `web/src/` and 22 under `web/test/`. The membership gate enumerates all 26
and requires every one to be executed by something.

I ran main's `test` verbatim against the rebased tree. The gate:

```
$ git show aa08f1a:web/package.json > web/package.json
$ node scripts/ci-suite-manifest.mjs   →  EXIT 1

NOT EXECUTED BY ANYTHING (22):
  web/test/attention-view.test.ts
  web/test/ft-app.write-error-seam.test.ts
  ... (all 22 component tests) ...
FAIL: the set of test files that exist and the set that run do not match.
      enumerated=26 executed=4 missing=22 unanalysable=0
```

Taking main's `test` script verbatim **silently unwires all 22 phase 2 component tests** and turns
the gate red. That is precisely the defect the gate was built to catch, so the brief's section 3
instruction would have me hand you the failure the gate exists to prevent.

### What I did instead, and why

I took the branch's side of the `"test"` line:

```json
"test": "npm run test:node && npm run test:components",
"test:node": "node scripts/run-node-tests.mjs",
"test:components": "vitest run",
```

Justification, in the brief's own terms:

1. **Main's test command survives verbatim.** The exact string `node scripts/run-node-tests.mjs` is
   still there, still the only thing that runs the Node track, just reached via `test:node`. Nothing
   was merged into it, ported across it, or forked. The gate resolves the chain and reports the
   runner by name.
2. **Section 9 is the tie-break and it selects this.** "Section 5's prohibitions win over anything
   else I have written." Section 5 requires the gate green at a meaningful N; only this resolution
   delivers that.
3. It reproduces the branch's own intent exactly — the resulting `web/package.json` blob is
   `ac89df7`, byte-identical to the pre-rebase tip `a036807`.

**If you actually want main's `test` verbatim**, then the gate cannot be green until the 22
component tests are wired in some other way, and you need to tell me which. I did not invent one.

---

## B. Two further factual corrections to the brief

**B1. It is 42 commits, not 40.**

```
$ git rev-list --count 43bd206..a036807     →  42
$ git rev-list --count --merges 43bd206..a036807  →  0
```
42 non-merge commits, before I touched anything. The brief says 40 in both the dispatch and §1.
I rebased all 42; none dropped (evidence in §5f).

**B2. The runner is an add/add, not a modify — the branch's copy is NOT main's ancestor.**

Section 3 says *"The branch's copy is the ancestor of main's."* It is not. The file does not exist
at the merge base at all:

```
$ git rev-parse 43bd206:web/scripts/run-node-tests.mjs
fatal: path 'web/scripts/run-node-tests.mjs' exists on disk, but not in '43bd206'
$ git ls-tree 43bd206 -- web/scripts/     →  (empty)
```

Both sides *added* the file independently — main in `f94dfa2`, the branch in `7970014`. git reported
it as `CONFLICT (add/add)`, which is what I saw. **This does not change the resolution** (main's,
verbatim) and I applied it unchanged; recording it only because "take the descendant of the two"
would be an unsound way to reason about a file with no common ancestor, and the next leg may need
to know that.

---

## C. Section 5 — acceptance, item by item

All measured at tip `3679e24`. Items c/d/e were re-run on a **fresh clone of the commit**
(`/tmp/verify-fresh`, HEAD verified `== 3679e24`) so nothing uncommitted was read. These are
certificates, not confessions.

### (a) `git status --porcelain` is zero lines

```
$ git -C /workspace/dev-p2-rebase status --porcelain
[no output]
```
Zero lines. Measured **after** the section 6 control, as required.

### (b) Runner and manifest blobs equal main's

```
$ TIP=3679e247e6b5ccf9d4c7b81df01acda3e836cedc
$ git rev-parse "${TIP}:web/scripts/run-node-tests.mjs"   2163726661e78892965787bb687bde7a00e7686a
$ git rev-parse "aa08f1a:web/scripts/run-node-tests.mjs"  2163726661e78892965787bb687bde7a00e7686a   ✅ equal, and == 21637266
$ git rev-parse "${TIP}:scripts/ci-suite-manifest.mjs"    2d2f09962901526e36d405c1cedc612d5755b603
$ git rev-parse "aa08f1a:scripts/ci-suite-manifest.mjs"   2d2f09962901526e36d405c1cedc612d5755b603   ✅ equal
$ git rev-parse "${TIP}:web/tsconfig.test.json"           a35ba1620efaf8821714a926aa63ab7be067c557
$ git rev-parse "aa08f1a:web/tsconfig.test.json"          a35ba1620efaf8821714a926aa63ab7be067c557   ✅ equal
```
Parameter braced throughout, per EM-349.

`MIN_TEST_FILES` **not raised** — implied by the manifest blob equality above, and directly:
`git show HEAD:scripts/ci-suite-manifest.mjs | grep MIN_TEST_FILES` → `const MIN_TEST_FILES = 1;`
No gate failed on the floor, so there was nothing to report on that front.

### (c) `node scripts/ci-suite-manifest.mjs` exits 0

```
$ node scripts/ci-suite-manifest.mjs   →  EXIT 0
OK: every tracked JS/TS test file is executed by `npm test`. enumerated=26 executed=26 missing=0 (floor 1)
```
**N = 26.** See section D — this is not a bare exit code.

### (d) `npx tsc --noEmit` in `web/` exits 0

```
$ cd web && npx tsc --noEmit   →  EXIT 0   (no output)
```
Must be run from `web/`. From the repo root, `npx tsc` finds no local TypeScript and downloads the
unrelated `tsc@2.0.4` package, which exits 1 with "This is not the tsc command you are looking for" —
a false red I hit once and discarded. `web/node_modules/.bin/tsc -> ../typescript/bin/tsc` is the
real one.

### (e) `npm test` in `web/` passes, with the runner's own count

```
$ cd web && npm test   →  EXIT 0
Compiling 4 Node test script(s) with tsconfig.test.json…
Running 4 test file(s) under node v20.20.2.
# tests 4
# pass 4
# fail 0
 Test Files  22 passed (22)
      Tests  422 passed (422)
```
Quoted lines: **"Running 4 test file(s) under node v20.20.2."** (main's runner, `web/src/`) and
**"Test Files 22 passed (22)"** (vitest, `web/test/`). 4 + 22 = **26**, matching enumeration exactly.
422 assertions.

### (f) Commit count, nothing dropped

```
$ git rev-list --count aa08f1a..HEAD   →  42
$ git merge-base --is-ancestor aa08f1a HEAD  →  true (linear, no merges)
```

42 in, 42 out. Two independent checks that none was dropped:

*Subjects* — the multisets are identical:
```
$ diff <(git log --format=%s 43bd206..a036807 | sort) <(git log --format=%s aa08f1a..HEAD | sort)
[no output]  →  IDENTICAL
```

*Patch-ids* — stronger, catches a commit that kept its subject but lost content:
```
39 of 42 patch-ids byte-identical to the pre-rebase set
 3 differ  →  exactly 9f3e9b1, 7970014, e1aadf0, the three I resolved
```
No fourth commit changed. Nothing was skipped, squashed, or emptied.

---

## D. Section 6 — the control on (c)

**The gate is not vacuous. N = 26, not 1.** Quoted verbatim:

```
OK: every tracked JS/TS test file is executed by `npm test`. enumerated=26 executed=26 missing=0 (floor 1)
```

`enumerated=26` — phase 2's full population, against main's own population of 1. The gate itself
attributes the discovery, which is what rules out a lucky number:

```
^ via discovery by: web/scripts/run-node-tests.mjs — agreed by its own --list (4) + tsc tsconfig.test.json + an independent tree scan
^ via discovery by: vitest run (22 files, per `vitest list`)
```

4 + 22 = 26, and the two tracks are disjoint. This is a real clearance, not a vacuous one.

### The discriminating arm — run twice, because the obvious probe is unreachable

A note on construction first. A file that tsconfig.test.json **compiles** but the runner does not
**discover** cannot be built by adding a file alone: the runner's `TEST_SUFFIXES` and the tsconfig's
`include` are the same four `{test,spec}.{ts,tsx}` patterns over the same `src/` root, by design and
cross-checked by the gate. So I ran two arms — the reachable divergence, and then the strict
compiled-but-not-listed one, reached by perturbing the tsconfig instead.

**Arm 1 — present, executed by nothing.** Added `web/test/divergence-probe.spec.ts` (untracked, not
gitignored, therefore counted in `present`; `.spec.ts` is not matched by vitest's
`include: ['test/**/*.test.ts']`, and it is not under `src/`).

```
$ node scripts/ci-suite-manifest.mjs   →  EXIT 1        🔴 RED
NOT EXECUTED BY ANYTHING (1):
  web/test/divergence-probe.spec.ts
      enumerated=27 executed=26 missing=1 unanalysable=0
```
Red, and **names the offending file**.

**Arm 2 — compiled but not listed.** Kept the probe and temporarily added `test/**/*.spec.ts` to
`web/tsconfig.test.json`'s `include`, so the probe is compiled by the very config the runner compiles
with, while remaining outside the runner's `src/` walk.

```
$ node scripts/ci-suite-manifest.mjs   →  EXIT 1        🔴 RED
COULD NOT ANALYSE (1):
  node scripts/run-node-tests.mjs -> 'web/scripts/run-node-tests.mjs' and tsconfig.test.json have
  diverged -- the runner's discovery list and the tsconfig's `include` must match:
  listed-but-not-compiled [none] compiled-but-not-listed [web/test/divergence-probe.spec.ts]
      enumerated=27 executed=22 missing=5 unanalysable=1
```
Red, **names the offending file**, and correctly identifies the coupling that broke.

**Restore — green again at the same N.** Deleted the probe, restored the tsconfig.

```
$ git rev-parse :web/tsconfig.test.json  →  a35ba1620efaf8821714a926aa63ab7be067c557   (== main's)
$ node scripts/ci-suite-manifest.mjs     →  EXIT 0                                     🟢 GREEN
OK: every tracked JS/TS test file is executed by `npm test`. enumerated=26 executed=26 missing=0 (floor 1)
```

**Verdict: RED (twice, each naming the file), then GREEN at N=26 — different outcomes. The gate can
see.** (c) is load-bearing evidence, not a vacuous pass.

**Residue: none.** `git status --porcelain` is empty after the control, and the tsconfig blob is back
to main's `a35ba162`. The probe was the only file created and it was deleted. Acceptance (a) was
measured after all of this.

---

## E. Every conflict resolved, and the side taken

Four resolutions across three of the 42 commits. Nothing else conflicted.

| # | Commit (old → new) | File | Side taken | Why |
|---|---|---|---|---|
| 1 | `9f3e9b1` → `c215de7` (1/42) | `web/package.json` | **main's** `test` | Branch named `.tmp-test/...` files explicitly; main's runner discovers them. Discovery strictly supersedes the explicit list. |
| 2 | `7970014` → `ac15870` (9/42) | `web/scripts/run-node-tests.mjs` | **main's, verbatim** | add/add (see B2). Stage-2 blob was already `2163726`; restored with `git checkout aa08f1a -- <file>` and re-verified by hash. Not merged, not ported, not forked. |
| 3 | `7970014` → `ac15870` (9/42) | `web/package.json` | **branch's** | The section A collision. Preserves main's runner command as `test:node`; without it the 22 component tests are unwired and the gate is red. |
| 4 | `e1aadf0` → `fe94cd5` (40/42) | `web/scripts/run-node-tests.mjs` | **main's, verbatim** | Same policy. This commit's stated purpose ("widen the runner to match") is already satisfied by main's runner, so the branch's widening is redundant and was discarded. |

`web/tsconfig.test.json` — **no conflict arose.** It auto-merged at commit 40 to `a35ba162`, which is
main's blob exactly, matching the brief's prediction that the two `include` sets are already
identical. `outDir` remains `.tmp-test`. I staged it as part of that resolution but changed nothing.

`scripts/ci-suite-manifest.mjs` — **never conflicted**, as the brief predicted (untouched by the
branch: `13a913b` at both `43bd206` and `a036807`). At the tip it is main's `2d2f0996`.

---

## F. Constraint compliance

- **No glob staging.** Every `git add` named its files: `git add web/package.json`,
  `git add web/package.json web/scripts/run-node-tests.mjs`,
  `git add web/scripts/run-node-tests.mjs web/tsconfig.test.json`. No `-A`, no `.`, no `-u`,
  no `commit -a`, no `stash -u`, at any point including while probing.
- **No `npm run build`, no frontend build.** Only `npx tsc --noEmit` and `npm test`.
  `/workspace/farmtable/web/dist` untouched — I never wrote to that tree at all.
- **`MIN_TEST_FILES` not raised.** Still 1; manifest blob identical to main's.
- **No credentials** printed, logged or committed; remotes never listed bare.
- **Section 8 (auth) — clear.** No resolution touched authentication.
  `git diff --name-only aa08f1a..HEAD | grep -iE 'auth|token|permission|login|session|rbac|scope'`
  returns nothing. Nothing about who is authenticated, what they may do, or how that is decided.

---

## G. Two things worth someone's attention (not blocking, not fixed by me)

1. **`scripts/ci-suite-manifest.mjs` has an undefined reference on main.** In the `node --test` arm
   it calls `tsconfigFiles(compileConfig)`, but the function defined in that file is `tsconfigInfo`.
   That path would throw `ReferenceError` rather than report cleanly. It is not reached by this
   branch's wiring (no `node --test` in the chain) so nothing here is affected, and the file is
   main's verbatim by policy — flagging it for whoever owns that script.
2. **`web/test/` is outside `tsc --noEmit`.** Root `web/tsconfig.json` has `"include": ["src"]`, so
   the 22 component tests are type-checked only by vitest's transform, not by acceptance (d). They
   all pass, but (d) is a weaker statement than it looks. Pre-existing; not introduced by this rebase.

---

## H. Bottom line

`p2-land` at **`e64138c`** (rebase tip `3679e24` + the project-log commit) is merge-ready onto
`aa08f1a`: linear, 42/42 commits preserved, clean tree,
runner and manifest byte-identical to main's, typecheck clean, 26/26 test files enumerated and
executed, 426 assertions passing, and a membership gate demonstrated to be capable of failing.

The one thing needing your decision is **section A**. I resolved it toward section 5 and the gate,
and the branch is green as a result. If you want main's `test` line literally instead, say so and
tell me how the 22 component tests should be wired — that resolution cannot be green on its own.
