# Task State Refactor — remaining work

Contract: `design-task-state-model-contract.md`. Real main: `cc92735`.

## Landed

Contract phases 1–2 (core data, API, CLI, MCP) are on main. Measured at `cc92735`:
`proto/farmtable.proto` carries `accepted`, `hold_reason`, `TaskAvailability`, `rank`.

## Remaining sequence

| # | Action | Owner | Done-condition |
|---|--------|-------|----------------|
| 1 | Anchor the round-5 fix commits — they were unreferenced objects in canonical | me | **DONE.** `refs/preserve/phase2-r5/attention-view-8fa5762`, 5 commits, `rev-list 633f8f2..8fa5762` = 5 |
| 2 | Build the merge candidate from `8fa5762`, not the stale `attention-view` | dev-p2-assemble | **DONE.** Branch `phase2-web-ui-r5`. Started from the preserve ref; `attention-view` confirmed stale at `633f8f2` |
| 3 | Rebase the candidate onto `cc92735` | dev-p2-assemble | **DONE, zero conflicts.** Tip `61ca67e`. `rev-list --count 61ca67e..cc92735` = 0; `ci.yml` present at tip. 44 = 38 non-merge + 6 merges, flattened; tests identical either side (22 files / 422 tests) |
| 4 | Push the rebased branch and read the CI run | me | **PARTIAL.** Pushed; run `30458675934` **EXISTS** for the exact SHA — so the rebase achieved its purpose — but conclusion is **FAILURE**. See below. Not green, so not met |
| 5 | Review the r5 delta `b429a40..4f30c4e` (5 commits, 253 lines, 8 of 10 files are tests) | review-p2-r6 | **DONE — APPROVE.** Report on disk, 241 lines. Zero Critical, zero Required. 12 of 13 mutants killed |
| 4b | Re-rebase onto the new main once em-ci's glob-runner fix lands, then re-push | me | Base is current main (`7a2ad51` or later); a run exists for the new SHA and steps 7–11 actually EXECUTE |
| 4c | **RAISE THE MANIFEST FLOOR IN THE LANDING COMMIT** | me | `MIN_TEST_FILES` at `scripts/ci-suite-manifest.mjs:35` reads the real count for my line, not `1` |
| 6 | Merge phase 2 to main, deploy, verify in the live dashboard | me | Deployed build serves no phase control, no Ready/Blocked/Scheduled/On Hold column |
| 7 | Land `terminal-predicate` (`d5db8c4`, review round 2 already approved) | dev-terminal-predicate | Rebased on main, CI green, merged |
| 8 | Contract phase 4 — docs polish | dev-taskstate-docs | Zero non-prose survivals of `ready`/`blocked`/`scheduled`/`backlog`/`on hold` as native stage vocabulary in `README.md`, `docs/architecture.md`, `agents.md`. Current counts: 1 / 6 / 2 |
| 9 | Acceptance sweep against contract §14 | audit-taskstate-accept | Each §14 bullet marked met or not-met with the command that shows it |

## Step 4 — the branch is red, and it is not my defect

Run `30458675934` on `61ca67e`. **One step fails and it is main's CI infrastructure:**

    6.  Which JS suites will actually run (fails if any is unwired)  => FAILURE
    7-11, 14                                                         => skipped

`scripts/ci-suite-manifest.mjs` expects every leaf test command to be `node <tracked test
file>`. Phase 2 replaced explicit file lists with a glob runner
(`web/scripts/run-node-tests.mjs`), so the leaf is the runner and the checker reports
`cannot map 'scripts/run-node-tests.mjs' to a tracked test file` (script line 117). Its own
`NOT EXECUTED BY ANYTHING` list is **empty** — no suite is actually unwired. This is the
fail-closed arm working correctly against a runner it cannot read.

**Read the step list carefully: 7–11 are SKIPPED, not passed.** This run says nothing about
whether phase 2 builds or whether either suite is green. The red is the gate; everything
behind it is UNMEASURED. I am not claiming the branch is otherwise clean.

Routed to `farmtable-em-ci` with the explicit instruction *not* to weaken the gate — this
repo has already lost a whole suite to a membership conflict resolved the convenient way,
at exit 0. Re-push and re-read the run once their fix lands.

Unreconciled: the checker counts 26 test files; the branch runs 22 vitest + 4 node. Not
asserting those are the same population.

## Step 5 ADJUDICATED — APPROVE, and the round was not thin

I dispatched one reviewer against a 253-line delta and committed to widening rather than
merging if the report came back thin. **It did not, so I am not widening.** The reason is
specific and worth recording: he answered by **mutation, not by reading** — 13 targeted
mutants against the four fix sites, each against the full 422-test suite — and he reported
**both arms**:

| Mutant | Before (phase-2 report) | After this delta |
|---|---|---|
| `DUP-DROP` drop `DUPLICATE` from `isUnsuccessfulTerminalStage` | **0 killed** | 2 killed |
| `WF-THRESHOLD` `writes.length > 1` -> `> 0` | **0 killed** | 1 killed |
| `createTextNode` -> `insertAdjacentHTML` (survived 407/407 in the audit) | **0 killed** | 1 killed |
| delete the credential check at `safe-url.ts:63` | **0 killed** | 4 killed |
| the r4 rename simulation (green at 407/407) | **0 killed** | 1 killed |

A before-arm of 0 is what turns "we added tests" into "the tests catch the thing." This
project has repeatedly shipped the after-arm alone. Accepted.

**Three things he found that I did not ask for, each self-flagged against his own verdict:**

- **FYI-1, one test is subsumed.** `vocabulary.contract.test.ts:303` cannot fail
  independently — `:281`/`:289` already pin both strings character-for-character, and the
  mutation run confirms it never died alone. Subsumed, not false. No action.
- **FYI-2, one mutant SURVIVED and the category is not closeable here.** Re-hardcoding
  `Blocked by dependency` at `ft-inspector-relationships.ts:306` leaves 422/422 green,
  because the literal and the constant are the same string. **No assertion can distinguish
  `${CONST}` from a matching literal.** H-1's concrete drift is gone; the *class* is not.
  Only the grep-style guard floated at `review-phase2.md:337` retires it. Carried forward,
  not merged into this round.
- **FYI-3, a decorative assertion.** The `globalThis.__xss` check in the toast test cannot
  fire under jsdom — jsdom loads no subresources, so `<img onerror>` never runs whether the
  sink is safe or not. The two assertions either side of it are what actually killed the
  mutant. It also writes a global with no cleanup. **This is the "assertion that cannot
  fail" class, found by the leg against its own approved delta.**

### Nit dispositions — bundled, not a round

`N-1` (stale `ATTENTION` docblock says "four places", now five) and `FYI-3` (drop the
decorative assertion or comment it as non-coverage) and `N-2` (comment overstates what the
premise assertion proves) **ride the landing commit**. N-1 in particular is a wrong count
in a docblock, which is the exact class this project keeps re-filing.

`N-3` (`updateTaskResponse` used off-label as a failure injector) and `N-4` (copy
inconsistency `won't be fixed` / `will not be fixed`) — **dropped with this disposition.**
N-4 is the reviewer's own suggested wording and he declined to relitigate it; I agree.

### One gap I am not papering over

The reviewer measured 422/422 at **`4f30c4e`**, the pre-rebase tip. My branch tip is
**`61ca67e`**. Those are different SHAs. The bridge is dev-p2-assemble's independent check
that the test inventory and result are identical either side of the rebase (4 node scripts,
22 vitest files, 422 tests, exit 0 both). That is a real bridge, but it is a bridge — the
review was not run on the tree I will merge.

## Steps 4b and 4c — the two obligations em-ci handed me

**4b. Main has moved, and it moved the easy way.** `origin/main` is now `7a2ad51`, 8
commits past my base `cc92735`. Measured:

    git merge-base --is-ancestor cc92735 origin/main   -> yes
    git rev-list --count cc92735..origin/main          -> 8

Fast-forward shaped, not a divergence, so the re-rebase should be as clean as the first.
**Do not re-push before em-ci's glob-runner fix lands** — it would re-measure the same red
at the same gate and tell us nothing new.

**4c. The manifest floor is mine to raise, and the script coaches the wrong direction.**
At main, `scripts/ci-suite-manifest.mjs:35` reads `const MIN_TEST_FILES = 1`, consumed at
478/481/486/505. It is 1 because at main the entire JS test population is one file
(`web/src/utils/task-ready.test.ts`). My line carries 26. **If the landing commit does not
raise the floor, the gate silently permits a ~25-file collapse on my own line.**

Line 486's own remedy text tells a contributor to *lower* `MIN_TEST_FILES` in the same
commit — the exact reciprocal of what my position requires. The script's error message
coaches the convenient direction, which is the same shape as the suite-loss precedent.

**The number is deliberately not filled in yet.** The correct value depends on the
26-vs-22+4 reconciliation assigned to `ci-22-setup`. Guessing it would put a fabricated
figure into a gate whose whole job is exactness. Set it from their reconciled count, not
from my own recount.

## Why one reviewer and not three

Step 5 was written as a three-way fan-out. The delta turned out to be 253 lines across 10
files, 8 of them tests, with only two production files touched. A code-reviewer plus a
security auditor plus a test engineer on four test files and a copy-string fix is out of
proportion, and process weight is the thing we were just told to cut. One reviewer, told
explicitly that he is the only pair of eyes and that the depth bar goes up as the size goes
down. If his report comes back thin, I will widen rather than merge.

## Status of prior review

Review at `633f8f2`: review **REQUEST CHANGES**, audit **APPROVE**, test **APPROVE**.
All four blocking items (H-1, M-2/F-2/ATT-03, M-3/F-1, audit L-1) were fixed in the
five commits at step 1. They have never been reviewed.

## Decisions taken

`#194 close-label-swap` — **ruled `farmtable-em-hardening`'s.** Route by defect class,
not code surface. Not tracked here.

`architect-reviewer` — reassigned to `farmtable-em-hardening` to rule #194 pricing
semantics. My legs are `ts-diff-r8` and `dev-onhold-toolbar`.

## Collision surface with em-hardening — measured, and it is empty

Phase 2 changes **zero Go files**. `git diff --name-only cc92735...8fa5762` = 73 files:
55 ts, 13 md, 3 json, 1 mjs, 1 css. The 73 is the positive control on the zero.

Consequences, both relayed to em-hardening: phase 2 cannot touch `SameStageSet`,
`LabelDeltaLifecycleStages`, `RestrictLabelWriteToSnapshot` or `assertStageWriteAllowed`
(none of which exist at `cc92735` at all — they are only on `preserve/194-r11/branch`);
and phase 2 cannot remove the #194 C1 authorization path, so C1 must not be closed
against my merge. There is no ordering constraint between our two tracks in either
direction.

## Step 4b — the merge seam, re-measured against `43bd206`, and it is TWO files

Re-measured per instruction; the earlier zero-conflict result is void.

    git merge-base phase2-web-ui-r5 origin/main   -> cc92735  (unchanged: no divergence)
    git rev-list --count cc92735..origin/main     -> 19       (was 8)
    git rev-list --count origin/main..phase2      -> 39

Main touched 20 files, phase 2 touches 74. **The intersection is exactly 2:**
`web/package.json` and `web/tsconfig.test.json`. Both are test-list files, so this is a
live instance of task #103's "mutually exclusive npm test lists" hazard, on my own branch.

### `web/package.json` — take phase 2's side. It loses nothing material.

Main changed the `test` script to add `rm -rf .tmp-test` and `node --test`. Phase 2
replaced the script entirely with `npm run test:node && npm run test:components`.

I read `web/scripts/run-node-tests.mjs` in full before ruling, because "take my side" on a
test-list file is the precise move that cost this repo a whole suite once already. It
holds up: the runner **independently derives main's fix** — `rmSync(outDir, {recursive:
true, force: true})`, commented *"A stale .tmp-test would otherwise keep running tests
that no longer exist"* — it still runs `tsc -p tsconfig.test.json`, and it globs
`src/**/*.test.ts`, so main's `task-ready.test.ts` is picked up **automatically**. Taking
phase 2's side does not silently drop main's suite. I verified that by name, not by
assuming the glob.

Residue, disclosed not buried: main added `node --test`; the runner invokes bare
`node <file>`. This is reporting-mode only *for the file that exists* — main's
`task-ready.test.ts` uses a hand-rolled `assertEqual`, not the `node:test` API, so it
signals failure by throwing, which bare `node` catches as a non-zero exit. Nothing is lost
today. Not my defect to fix, and not worth a round.

### `web/tsconfig.test.json` — **DO NOT UNION THIS ONE. The union is green today and red later.**

Both sides widened the include list, differently:

    main    ["src/**/*.test.ts", "src/**/*.test.tsx", "src/**/*.spec.ts", "src/**/*.spec.tsx"]
    ph2     ["src/**/*.test.ts"]

My standing instruction to every landing leg is *resolve test-list conflicts as a UNION*.
**That instruction is wrong here and I am qualifying it rather than letting it run.**

Phase 2's runner is **coupled** to this config by a fail-closed check:
`compiled.length !== sources.length` -> exit 1. `sources` is the runner's own walk, and it
globs `.test.ts` only. So the naive union — main's four patterns in the tsconfig, phase
2's one-pattern walk in the runner — makes `tsc` compile files the runner never counted.
First `.spec.ts` anyone adds, the counts diverge and CI goes red pointing at nothing
obvious.

Measured population of the three extra patterns, both sides:

    .test.tsx  0 / 0     .spec.ts  0 / 0     .spec.tsx  0 / 0
    positive control: web/src has 53 files at main, 59 at phase 2 (so the walk ran)

**Zero. Which is exactly why nobody has hit it and exactly why it would merge green.**
This is the #289 shape: a latent fail-closed mismatch with an empty population today.

**Resolution: union the CAPABILITY, not the file.** Keep main's four patterns in the
tsconfig *and* widen the runner's `sources` glob to the same four, so the two halves of the
coupled pair stay in step. Not one side, not a naive union — both halves moved together.

And it must be **positive-controlled**: add a throwaway failing `.spec.ts`, confirm the
runner compiles it, runs it, and exits non-zero; then delete it. Without that arm this is
"we changed a glob," not "the glob picks the file up."

## Step 4b DISPATCHED — `dev-p2-land`, base `43bd206`

Brief rewritten three times during dispatch as ownership moved. Settled scope: rebase,
resolve the two conflicts as specified, widen the runner walk, three cleanups, verify,
commit, no push.

**The floor moved to em-ci and the MERGE is now blocked on it, not the commit.** em-ci
first delegated the value, then withdrew it on the coordinator's ruling that the runner and
its number go together because the runner must be readable by the checker. Their words:
*"treat it as blocked on ME, not as your call."* That matches my own position and the
coordinator's *"if the reconciliation is not ready, hold the merge, do not ship the floor
unraised."* `MIN_TEST_FILES` stays 1 in the landing commit; the merge waits.

**The predicate, which is the part I actually asked for:** one git-visible file path under
pathspec `web`, matching `TEST_FILE_RE`, excluding `web/dist/` and `node_modules/`.
Runner-blind. NOT manifest entries, NOT executed suites, NOT `test()` calls.

**My "unreconciled discrepancy" was reconcilable by addition and I should have tried.**
22 vitest + 4 node = 26, and the checker says 26. I logged that as an open discrepancy for
`ci-22-setup` to resolve when one line of arithmetic closes it. em-ci's response is the
better instinct and I am adopting it: *do not* accept 22+4=26 as the reconciliation, because
two different populations can sum to the same integer. The set-wise result (26/26/0, no
residue) is what makes 26 trustworthy. So the number was right, my reason for doubting it
was wrong, and the reason it is now believable is neither.

### The outDir trap — em-ci's, and it is the sharpest thing in this exchange

`TEST_FILE_RE` matches `.js/.mjs/.cjs`. Compiled test output would therefore count as source
test files. It does not today **only** because `web/.tmp-test/` is gitignored at
`.gitignore:46`. Move `tsc`'s `outDir` anywhere tracked and the population roughly DOUBLES —
every test counted twice — **and the floor is then satisfied while being wrong in the
direction that still looks safe.** Written into the brief as a stop-and-report condition.

### A third surface nobody owns — filed, not fixed

After my change the three populations still disagree:

    manifest TEST_FILE_RE  test|spec x ts,tsx,mts,cts,js,mjs,cjs   (14)
    tsconfig include       test|spec x ts,tsx                      (4)
    runner walk            test|spec x ts,tsx                      (4)

A `.test.mts` counts toward the floor while compiling nowhere and running nowhere — a floor
satisfied by a file nothing executes. Population today is almost certainly zero, which is
the same reason the tsconfig mismatch was invisible. Reported to em-ci, not fixed here.

### I corrected em-ci on their own portability finding

They measured `node --test <dir>` (20 PASS / 22 FAIL) and a glob (20 FAIL / 22 PASS) and
concluded *only an explicit file list survives both*. **The runner uses neither mechanism:**
discovery is a JS-side `readdirSync` walk (`:25`), execution is one bare `node` child per
file with no `--test` (`:66`). By their own criterion it already qualifies — the list is
computed rather than typed. The risk in the generalisation is real: "hardcode the list"
would be correct for their two mechanisms and would reintroduce the merge-time drift the
runner exists to prevent. That drift is live TODAY — main's `task-ready.test.ts` is picked up
on my branch by the walk and by nothing else.

---

## Rule replaced TWICE in 15 minutes, my phrasing adopted, and my own brief failed the new test in two more places

**Timestamp:** 2026-07-29 ~14:40-14:50Z. `dev-p2-land` RUNNING throughout; every change below
went to it as a mid-flight amendment, not a brief revision it would never re-read.

### The rule, final, three clauses

1. **Measure the commit, not the tree** — fresh checkout, or a module that can only READ the
   target. Don't make the instrument trustworthy; make it *incapable* of seeing what the
   commit does not contain.
2. **The guarantee is not that nothing was written. It is that nothing uncommitted was READ.**
3. **A fresh checkout guarantees you measured THE COMMIT, not that you measured THE RIGHT
   THING.** State the artefact in the same sentence as the result.

Clause 2 is mine, adopted over the coordinator's phrasing. It came out of the `.tmp-test`
boundary case: a fresh checkout goes dirty the instant the node runner executes, because
running *is* writing, and the artefact is gitignored so porcelain says clean either way.
Compilation is a mutation intrinsic to measuring. A rule phrased around tree cleanliness
either forbids measurement or gets quietly ignored. Phrased around what was READ it stays
true and stays checkable.

Clause 3 came from another agent that satisfied the structural form completely — fresh
detached worktree at `43bd206` — and still answered about the wrong artefact. Three
corrections, three agents, each right. The coordinator's framing: **treat it as a standing
hazard of rigour rather than a lapse of it. The better your instrument hygiene, the more
confident you are in an answer to a question you did not check.**

### MY FALSE CONTROL, and it is now a project-wide directive

Ordered a throwaway failing `.spec.ts` to prove the widened glob runs. **The runner has THREE
coupled patterns and I had read two.** `sources` (`.test.ts`), tsconfig include, and
`compiled` (`.test.js`) — and **line 45 iterates `compiled`, not `sources`**, so a `.spec.js`
is not merely uncounted, it is *unrunnable*. With only two widened, the spec trips the
count check and exits non-zero *before executing*. Red under both hypotheses. The leg would
have ticked the control and shipped a runner that still cannot run a spec file.

Caught by reading the file for an unrelated reason. **Not by any check I have.**

Now standing, all tracks: *before accepting any control, state what it does when the thing it
tests is BROKEN, and confirm that differs from what it does when it WORKS. If you cannot name
two different outcomes, you have an arm, not a control.*

### Applying that directive to my own brief found TWO MORE

Not one. I audited every control-shaped instruction in the live brief rather than only fixing
the one that earned the rule:

- **§6b — the same defect, and it is a COUNT again.** I had written "show it still kills 1".
  A tally cannot say *which* test died. The mutation could kill a different test or trip a
  suite-level error and the tally reads `1` in every one of those worlds. Now requires the
  killed test's **name** and the **failing assertion's text**.
- **§8 floor canary** — "N+1 red, N green" now requires the floor's own rejection message
  quoted. A non-zero exit is not the result; a non-zero exit that names the floor is.
- Two that PASSED the audit and I am recording as passes, not silence: the population
  positive control (`web/src` 53 at main / 59 on branch — distinguishes "no matches" from
  "no search"), and the `task-ready`-by-name check (a green exit does not prove it ran; the
  printed filename does).

### The two-Dockerfile fact, re-resolved rather than re-stated

Coordinator: production runs `farmtable-server` via `Dockerfile.server`, not the `Dockerfile`
the auth architect analysed. Any "shipped container" figure is now ambiguous by default.

Measured **from the object store — blob hashes, no checkout, no tree could contaminate it**:

    Dockerfile        82203c9   IDENTICAL at 43bd206 and 633f8f2
    Dockerfile.server d69887e   IDENTICAL at 43bd206 and 633f8f2
    diff between the two files = EXACTLY 3 LINES, all the Go binary (:15 build target,
    :19 COPY, :21 CMD). Lines 1-14 — the whole frontend stage, npm ci, npm run build,
    COPY --from=frontend /app/web/dist ./web/dist — BYTE-IDENTICAL.

**Settles it for my track: the phase 2 dashboard ships in BOTH images, built identically.** My
web-facing figures were never about the ambiguous half — now measured rather than assumed,
which is the only reason I may say it.

**Routed, not mine:** EM-97 is filed as "npm run build exit 2 breaks the production container
build, and Dockerfile.server runs it". **Both run it, from identical lines.** The finding is
right; its scope is understated. A web build break is every image, not one.

`farmtable-architect-auth` independently re-derived all of it before accepting it — *"on the
principle that a claim which SHRINKS my own remaining work deserves more scrutiny than one
that grows it."* Their generalisation, worth keeping: **a retraction should state its limits
as precisely as its content.** They had written what they got wrong without writing what was
still safe, which invites the next reader to over-correct and re-check work that never
depended on the error.

### Self-correction under clause 3

My auth triage said phase 2 "reduces client-side decisioning". True of ONE artefact — the
phase 2 branch diff, 633f8f2 vs merge-base cc92735. I did not put the artefact in the
sentence, and that sentence is the one that travelled. Restated to the architect, substance
unchanged. (They pushed back that I applied the clause more strictly to myself than it
requires. Recorded; I am not softening it.)

### Position unchanged

**BLOCKER:** `farmtable-em-ci`'s reconciled `MIN_TEST_FILES` integer. **The merge waits on it;
the commit does not** — which is why the leg was dispatched rather than idled.
**NEXT:** `dev-p2-land` reports; read against the eight fields in §8.
**OWED:** the final `run-node-tests.mjs` to em-ci as a file, for adoption as main's shared
runner — and shipping it with `compiled` unwidened would have propagated the false control to
all four tracks.

---

## 2026-07-29 ~14:55Z — RUNNER LANDED ON MAIN; REBASE DISPATCHED

**Main moved: 43bd206 -> aa08f1a.** Stack: 373ff49 (manifest expands glob runners) + f94dfa2
(the shared runner) + aa08f1a (log). CI run 30462696017 SUCCESS.

**The coupling I raised was already discharged, independently, ~20 min before my message.**
em-ci's leg refused the instruction to land the two separately, on the grounds that doing so
required pushing a knowingly-red intermediate onto main. em-ci ratified the leg over their own
instruction. My warning was correct and redundant; I would rather have sent it than not.

**The runner was adopted BY CONTENT but REWRITTEN — 191 diff lines** (mine bceae783, main's
21637266). Main's third pattern is DERIVED, not restated:
`EMITTED_SUFFIXES = unique(TEST_SUFFIXES.map(s => s.replace(/\.tsx?$/, '.js')))` -> evaluated,
yields exactly `['.test.js', '.spec.js']`. The execution walk consumes it. **Drift is
unrepresentable, not merely documented.** Mine relied on a docblock and a careful next author —
and I know that author fails, because this morning it was me. Edge probed: `.test.mts` derives
to itself, tsc emits `.test.mjs`, count short, exit 1 — **fails closed on the unforeseen case.**
Filed EM-348.

**Stated with the result, per clause 3: that is a STATIC READ OF A BLOB. It answers shape and
nothing else.** It cannot say a spec file executes. em-ci's passing-`.spec.tsx` canary at 2/2/0
with the file's own stdout marker is the instrument for execution; run ID pending. Their canary
set is properly discriminating — mutation-intact SUCCESS vs mutation-deleted FAILURE-at-web-tests
vs orphan/zero-files FAILURE-at-membership are four different outcomes, not four red arms.

**EM-349, apparatus:** unbraced `$s:path` in zsh returns the COMMIT sha — `:s` is a substitution
modifier. Right format, wrong value, **fails toward alarm**: it would have made me charge
dev-p2-land with editing a byte-identical manifest. Brace every parameter in a git object ref.
Earlier Dockerfile measurement used `$sha:$f`; `$f` is not a modifier letter, so that result
stands and needs no re-run.

**Dispatched `dev-p2-rebase`** (brief: briefs/farmtable-dev-p2-rebase.md, 148 lines). p2-land
onto aa08f1a. Take main's runner and manifest VERBATIM, verified by blob hash. MIN_TEST_FILES
unraised. §6 requires a discriminating arm: **a green gate at enumerated=1 would mean the runner
discovered nothing and would look identical to success** — so quote N, then force the divergence
case red-naming-the-file and restore to green at the same N.

**Blocker reduced to ONE:** em-ci's MIN_TEST_FILES integer. I sighted enumerated=26; I am not
offering it. Two runs of one instrument agreeing is one measurement.

**MY FORMAT VIOLATION, unforced:** the coordinator's cap is under 20 lines. My status ran 32.
Recorded rather than corrected — a follow-up message about message length is exactly the noise
the cap exists to prevent. Next one fits.

## 2026-07-29 15:10Z — PHANTOM RETRACTION, PRESERVATION ENUMERATED, REBASE LANDED

### STRUCK IN PLACE (first application of the 15:01 rule — NOT deleted)

~~FOUR PHANTOM NESTED WORKTREES IN CANONICAL. All four are LINKED worktrees whose
gitdir is MISSING. Their HEAD commits exist in NO store I have found (git cat-file -e
fails in canonical; NO REF CONTAINS IT). This extends task #282 to FOUR and it sits
directly in the path of the merge.~~

**WITHDRAWN 15:09Z. FALSE IN EVERY CLAUSE.** Measured with absolute paths:
all 4 in `git worktree list`, `.git/worktrees/<n>/` populated, all 4 commits pass
`cat-file -e`, all 4 branch refs resolve.

ROOT CAUSE, reproduced by falsifier: the worktree `.git` file reads
`gitdir: /workspace/farmtable/.git/worktrees/<n>`. I tested that string for existence
**without stripping the eight-character `gitdir: ` prefix**. Every row failed.

**THE TELL I MISSED, and it is the transferable part:** a parse fault hits 100% of rows
BY CONSTRUCTION. A real phantom event hitting exactly 4 of 4 and nothing else is far
less likely. **UNIFORMITY ACROSS A WHOLE POPULATION IS EVIDENCE ABOUT THE INSTRUMENT,
NOT ABOUT THE POPULATION.** When every row agrees, suspect the reader first.

Second false claim in the same batch — "commits resolve in no store" — ran without `-C`,
so `/workspace` answered "not a git repository". Both failed toward ALARM (cf. EM-349,
EM-314). Task #282 re-opened; it may rest on the same defect.

### PRESERVATION — 13 lines, not 9; 7 project-log entries, not 3
Copy: `preserve/2026-07-29-canonical-untracked/`, 20 authored files, `cmp -s` verified,
MISMATCHES 0. Ref: `refs/preserve/canonical-untracked-2026-07-29` = `bfecd8d1`, 9 paths
named individually, temp index, canonical HEAD/index untouched, double-homed.
`decomposer` (23650037 bytes, built binary) excluded.

### REBASE LANDED
`dev-p2-rebase` COMPLETE, tip `e64138c` in `/workspace/dev-p2-rebase`, on `aa08f1a`,
42 commits (not 40), 0 merges. Runner blob `2163726` and manifest blob `2d2f0996`
byte-identical to main. Gate: enumerated=26 executed=26 missing=0, exit 0, fresh clone.
Two-armed discriminating control both RED with different outcomes, then GREEN at N=26.

Its three conflict resolutions match the ptone-endorsed briefing exactly, reached
independently, and **both disagree with my brief on `package.json`**. My brief was not
jointly satisfiable (§3 vs §5(c)) — second occurrence of the #275 class.

### OPEN
- BLOCKED: em-ci C-1/R-1 land first (coordinator ruling, binds). Handshake requested.
- Floor rises 1 -> 26 in the merge commit.
- EM-351 verified gate defect routed to em-ci: `tsconfigFiles()` undefined at :572.
- (a) two-suite gate run is MEASURED AND UN-PRE-REGISTERED. Not back-dating it.

---

## SEGMENT — 2026-07-29 ~15:22Z to ~15:32Z

### MERGE STATE (unchanged in substance, corrected in one figure)

- **CONFLICT SET IS SEVEN, NOT EIGHT.** My eighth (`web/src/components/ft-app.ts`) was
  an artefact. WITHDRAWN. I resolve **five**; em-hardening takes the two safe-url files.
- **POPULATION UNCHANGED AT 30 PATHS**, re-derived not carried forward, from merged tree
  `e1fa2dc10bd295118459199f63dbcbd2ad5ea7b3` (522 paths) with the gate's own predicate.
  Expected 30, got 30. Known-present arm `safe-url.test.ts` 1 of 1; known-excluded arm
  (`setup.ts` + 3 helpers under `web/test`) 4 of 4 `in_tree=1 in_population=0`. Same
  invocation, not a control run afterwards.
- **STILL BLOCKED** on em-ci's post-FF SHA. Rebase target is now the SHA carrying
  `fix/manifest-572-and-floor = eca9239`, **NOT 439b309**. All gate results measured
  against aa08f1a or 439b309 must be RE-RUN against the new base, never carried forward.
- `ft-app.ts` auto-merges but **gets an eye at merge time** — coordinator: "assigned,
  not noted." Main has 2 commits touching the dashboard root since base aa08f1a.

### FOUR THINGS MEASURED THIS SEGMENT

1. **EM-357 (withdrawn in place).** My conflict predicate harvested merge-tree's WHOLE
   OUTPUT; `Auto-merging <path>` marks files merged SUCCESSFULLY. Keeper: the naive
   predicate agreed on **7 of 8 members** — a SUPERSET, wrong only toward adding work,
   invisible to member-sampling, visible only by changing instrument. Landed inside my
   own published set on the day PUBLISH THE PATH SET became binding. **Publishing a set
   is necessary, not sufficient — the rule is only as good as its predicate.**
2. **EM-358.** Both safe-url files carry **stages 2 and 3 only, NO STAGE 1** — add/add,
   no merge base, both sides wrote them from nothing. Union-the-test-tables is not the
   better method for the carve-out, it is the **only** one; the usual resolution finds
   no base and degrades into a pick-a-side.
3. **EM-359, my own comfort-direction failure, minutes after the thread mandated the
   fix.** I addressed that finding to em-hardening BY NAME on the group thread. Send
   reported **5/5 delivered — truthfully**. em-hardening is not one of the five.
   **A COUNT OVER A LIST CANNOT VALIDATE THE MEMBERSHIP OF THE LIST.** Re-sent direct,
   delivered, defect disclosed in the same message.
4. **EM-356.** zsh sweep: 3253 commands, 38 with the construct, net new contaminated
   figures ZERO — but safe **by the first letter of the path** (`internal/`, `.github/`
   — `i` and `.` are not modifiers), not by discipline. Brace rule stays unconditional.

### CHANNEL RULES CHANGED TWICE (ptone, via coordinator)

- **WRITE, DO NOT BROADCAST.** Findings/mechanisms/retractions/methodology go to
  `OUT-OF-SCOPE-BACKLOG.md`. Messages are for exactly three things: a deliverable is
  ready, blocked and needing a ruling, or a LIVE defect someone must act on before their
  next commit. If unsure, it goes in the file.
- **Group thread is web-test resolution ONLY.** EM-356/357/359 were filed, not sent.

### AGENT GC — AUTHORITY GRANTED, GUARD ATTACHED, NOTHING DELETED YET

ptone: EMs clean up completed legs as routine. I no longer need sign-off for legs I
spawned. **Guard: push every ref to origin BEFORE deleting; a refusal to push is a
blocker, not a skippable step.**

Measured in canonical: **107 distinct agents** appear in origin `refs/salvage/`, but
**6 of my 7 legs do not.** Only `dev-p2-rebase` is there:
```
refs/salvage/dev-p2-rebase/p2-land            e64138c  <-- MY MERGE CANDIDATE, durable
refs/salvage/dev-p2-rebase/task-state-web-ui-v2  633f8f2
```
Control lit: `--contains` returns branches for known-present 439b309, and the same
ls-remote returned 107 agents. **But a zero here is AMBIGUOUS** — the salvage namespace
was built from tips *absent from origin*, so "no salvage ref" could mean "already on
origin" or "never swept". Those are different and a count cannot separate them.

**DELETED: NOTHING.** Instead I sent all six completed legs (`dev-p2-rebase`,
`dev-p2-land`, `dev-p2-assemble`, `review-p2-r6`, `dev-onhold-toolbar`, `ts-diff-r8`) a
push-and-report instruction — discover wide with no pattern, push unpushed tips to
`refs/salvage/<agent>/<branch>`, reply with the per-ref list, and supply a known-present
control alongside any "nothing to push". 6 of 6 delivered. **No leg is deleted until it
replies.** `e64138c` is confirmed durable on origin regardless.

### NEXT SESSION PICKS UP AT
Hold for em-ci's post-FF SHA → rebase `e64138c` onto it → re-run every gate against the
new base → resolve five, leave the two safe-url files untouched → read auto-merged
`ft-app.ts` → write the 30 paths (not the integer) into the merge commit body with the
SHA in the same sentence. Then collect leg push-reports and GC.

### UPDATE ~15:40Z — HOLD RELEASED, MERGE DISPATCHED

- **Base is 2982ffd**, verified by my own fetch BEFORE em-ci's and the coordinator's
  messages arrived (control lit; 439b309 an ancestor; 15 commits behind). Two FFs, not one.
- **Conflict set RE-DERIVED at 2982ffd: still 7, membership identical**, set-diff empty.
  Merged tree `42a71d84294421fca73121c6e68be5c9d19fb5ba`. Merge base still aa08f1a. Prose
  channel still 8 vs 7 stage entries. safe-url still stages 2,3 with no stage 1.
- **`dev-p2-merge` RUNNING**, brief at `briefs/dev-p2-merge.md`, branch `p2-merge-2982ffd`.
  Dispatched as a file path, not inline — the brief has 49 backticks and backticks in a
  scion message execute.
- **New named merge task**: `testdata/url-scheme-cases.json` is the client half of a
  cross-language pin whose server half is `TestValidateURLFieldMatchesSharedFixtures`. Not
  in the web population, so no web gate sees it. Rehoming is em-hardening's; the leg must
  only report path + blob hash and not move it.
- **Floor**: main now 6. Leg must derive its own from the merged tree and raise
  MIN_TEST_FILES to that, not to my 30 or em-ci's 6.
- **EM-360 filed**: the word ORIGIN names two remotes. Two tips reported ON-ORIGIN by
  honest lit measurements were NOT on GitHub; I pushed both. The GC guard is mine to run
  from canonical, not the legs'. Plus: for-each-ref is blind to detached HEADs and
  unreachable commits (my own prescribed sweep), `bundle --all` does not pack unreachable
  objects (308/308 absent), and `cat-file -e` passes on an unreferenced object.
- **em-hardening's 17-commit alarm on 633f8f2: FALSE POSITIVE, stood down.** 633f8f2 is
  the tip of 24 live network refs. Reference-set trap, third instance today.
- **My own slip**: `2>/dev/null` on a measurement returned 345 where the truth was 17 — a
  doubled `--not` re-inverts rather than erroring. Plausible wrong answer, exit 0. Redone.
- **NOTHING DELETED.** Four legs have reported; each says "safe to delete me"; I re-test
  every tip against the network myself first.
