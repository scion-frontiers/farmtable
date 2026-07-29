# CI review findings W1–W5: the workflow never measured the commit

Date: 2026-07-29
Agent: dev-ci-workflow (CI-GREEN track)
Branch: `fix/ci-review-findings` off `d5f2c9e`
Commits: `2016940` (W1), `9866346` (W2+W3), `b2fa578` (W4+W5)

`review-ci-green` returned REQUEST CHANGES on `cc92735..43bd206`. Three findings
landed here because they are all in `ci.yml` and `ci.yml` has one owner; EM-CI
then added two more (W4, W5) after establishing that the Makefile half of the
W2 fix was never actually inside the frontend scope freeze.

## The finding that matters: CI never compiled Go against the committed tree

`make build` runs the web build before `go build`, and `go vet` runs after the
suites. Every step in this workflow that compiles Go therefore measured a tree
the build had already populated. Nothing ever asked whether the *commit*
compiles.

The consequence is not theoretical. `canary/c1-gitkeep-untracked` (`f410023`)
is one change — `web/dist/.gitkeep` untracked — and run **30463794909** is
**green on every arm**:

```
OK: web/dist does not exist on a clean checkout.
web/dist: 4109 files, 1 hashed js, 1 hashed css
OK: web/dist contains real build output produced by this run.
OK: all 501 manifest tests executed.
```

No `::error::`, no `::notice::`. A clean clone of that same commit gives
`go list ./...` → **0 packages** and `pattern all:web/dist: no matching files
found`. Both dist arms, vet, and the 501-test membership manifest certified a
commit that does not build.

The fix is a step placed **before `npm ci`**: `git ls-files --error-unmatch
web/dist/.gitkeep` and `go list ./... >/dev/null`. Its correctness does not rest
on discipline — it rests on the fact that no build has run yet, so there is
nothing in the tree for it to be fooled by. That is the "measure the commit, not
the tree" rule expressed as a step ordering rather than as a habit.

Verified from fresh clones of the commit, both directions:

| tree | result |
|---|---|
| `2016940`, marker tracked | `OK: the committed tree compiles -- 32 packages, nothing built yet.` exit 0 |
| same, marker untracked | `::error::web/dist/.gitkeep is not tracked in this commit.` exit 1 |

### Referent correction

The brief said this step should report **86 packages** at `43bd206`. It reports
**32**. Checked by name in the tree rather than assumed: `go list ./... | wc -l`
is 32 at `43bd206` and 32 at HEAD, and it agrees with the 32 package-result
lines in a real `go test ./... -v` log. The number in the brief is wrong; the
instruction it accompanied is not. Reported rather than quietly rounded to
whatever the tool said.

## W3: a skipped test was counted as an executed test

`go test -v` prints `=== RUN` for a test that immediately calls `t.Skip`. The
membership gate keyed on `=== RUN` and nothing read `--- SKIP`, so one line
removed a test from the suite while the gate kept counting it.

`canary/r1-tskip-defeats-membership` (`930fdb1`), run **30463804634**, green:

```
Go step:     --- SKIP: TestWatchTasks_CreatedEvent (0.00s)
membership:  package-qualified Go tests executed: 501
             OK: all 501 manifest tests executed.
```

**The skip was sitting in this workflow's own log four steps above the sentence
that says all 501 executed.** The evidence was collected and not read. That is a
worse failure than not collecting it, because the artefact makes the run look
audited.

`--- SKIP` lines are now parsed with the same package attribution and subtracted,
so a skipped manifest test falls out as MISSING — which is what it is — and any
skip at all fails the step with the names printed. Only top-level skips count; a
subtest skip is indented and the parent still ran.

This was free to close today and will not be free later. All four `t.Skip*` call
sites in the tree are reachable only under `-tags integration`, which CI does not
pass, so a real run skips zero. **A bypass is free to close while its population
is zero and becomes a negotiation the moment one legitimate instance exists.**

(Referent correction, minor: the review said "exactly 3 `t.Skipf` calls, all
behind `//go:build integration`". There are four `t.Skip*` sites. The fourth,
`internal/testutil/teststore.go:81`, carries no build tag — but all 23 of its
callers are in integration-tagged files, so the conclusion holds. Verified
empirically as well: fresh clone, `go test ./... -v`, zero `--- SKIP` lines.)

## W1: the allow-list was a subset test

An allow-list asks "is everything present permitted?" and **the empty set passes
that trivially**. So it caught committed build output and waved through a missing
marker. Equality closes both directions with one predicate.

The empty case has a runner receipt: on run 30463794909 above, the pre-build arm
took the `web/dist does not exist` branch and printed OK. An absent `web/dist` is
not an acceptable state now that a tracked marker is what makes the embed work,
so the early `exit 0` is gone and the tracked set is compared against the index
first, before anything on disk is examined.

## W4/W5: the guard would otherwise have been a treadmill

`build.outDir` sits inside the vite root, so `emptyOutDir` defaults true and
**every `npm run build` deletes the tracked marker**. `.gitignore` hides the
~4108 files a build adds; it cannot hide the one file a build removes. So the new
guard, alone, converts a silent failure into a *recurring* red on any branch
where someone staged after building — and a recurring red with two
obvious-looking wrong fixes (delete the gate; hand-restore the marker forever
without asking why it keeps vanishing) is how a guard gets weakened by someone in
a hurry.

`make web` now restores the marker. Measured from a fresh clone of `b2fa578`:
`make web` exit 0, marker **PRESENT**, 4110 files, `git status --porcelain`
**empty**. Baseline without the line: marker **ABSENT**, 4109 files, porcelain
` D web/dist/.gitkeep`.

It is recorded in the Makefile as a **partial mitigation, in those words**: it
does not cover a developer running `npm run build` directly inside `web/`. A
mitigation described as a fix is how the next person stops looking.

### The frozen half, measured but not changed

`web/vite.config.ts` is frontend build config under a scope freeze, so this is
the option and not the change. Measured in a throwaway clone, config restored
identical, nothing committed:

| option | marker | files | cost |
|---|---|---|---|
| baseline | ABSENT | 4109 | the defect |
| A: `emptyOutDir: false` | SURVIVES | 4110 | stale output is never purged between builds |
| C: `closeBundle` plugin rewriting `dist/.gitkeep` | SURVIVES | 4110 | none found; emptying still happens |

C is strictly better than A. Part 1 (the guard) is **sound without part 2**: it
runs before `npm ci`, so the build's later deletion cannot reach it. Part 1 is
the detector; part 2 is the prevention. W4 is the cheap prevention that was
available to us.

W5 is a comment only. Before W4, every CI run ended with the marker deleted, so
a post-build `git status --porcelain` assertion — the obvious next hardening step
on this track — would have red on every run with ` D web/dist/.gitkeep` and looked
like a new defect. The warning now sits next to the touch so whoever writes that
step finds it before spending an afternoon on it.

## Negative result worth recording

The awk parser attributes `=== RUN` blocks to the next package terminator line,
which assumes each package's verbose output is contiguous. `go test ./...` runs
packages in parallel, so that assumption could have been wrong on the runner and
not locally. **It is not.** Across the canary runs, including 30463804634, zero
`(unterminated)` rows appeared. The assumption is not parallelism-sensitive here.
Recorded because a negative result is a full result, and because the next person
to touch that parser will otherwise re-derive the worry.

## Canaries handed over

None of these are ever merged.

| branch | commit | change | expected |
|---|---|---|---|
| `canary/w2-marker-untracked` | `5893676` | untrack `web/dist/.gitkeep` | RED at "Assert the COMMITTED tree compiles", the first gate in the run |
| `canary/w1-tracked-dist` | `2e5fcaa` | commit a stub under `web/dist` | GREEN at the compile guard, RED at the pre-build arm |
| `canary/w3-tskip` | `91ad031` | one `t.Skip("in a hurry")` | GREEN everywhere earlier, RED at "Go test membership", 500 executed / 1 skipped |

`w1-tracked-dist` and `w2-marker-untracked` are the two arms of the same
equality predicate failing in opposite directions.

## Offline pre-verification

Each shipped step was extracted from `ci.yml` verbatim by script rather than
retyped, and run under `bash --noprofile --norc -eo pipefail` — the runner's own
shell — against fresh clones of the commit and against a fresh-clone
`go-test.log`. Results: W1 red on empty and green on the placeholder; W2 green at
32 packages and red on the untracked marker; W3 501 executed / 0 skipped / exit 0
unmodified, and 500 / 1 / exit 1 with a single `--- PASS` line changed to
`--- SKIP`, naming the test both as SKIPPED and as DID NOT RUN.

This is iteration evidence, not merge evidence. The runner runs are the evidence.

## Runner results at the original base (`aa08f1a`)

| ref | commit | run | result | red step |
|---|---|---|---|---|
| `fix/ci-review-findings` | `bbc9a59` | 30464871524 | SUCCESS | — |
| `canary/w1-tracked-dist` | `2e5fcaa` | 30464873663 | FAILURE | Assert web/dist holds no build output before the build |
| `canary/w2-marker-untracked` | `5893676` | 30464875218 | FAILURE | Assert the COMMITTED tree compiles (nothing built yet) |
| `canary/w3-tskip` | `91ad031` | 30464876923 | FAILURE | Go test membership (asserted against a committed manifest) |

Each red on its own gate, and W2's is the first gate in the run.

## Rebase onto `439b309`

Main moved by a 95-commit union merge. **The base commit was not reachable from
this tree, and no rebase was attempted until it was.** `git cat-file -t 439b309`
failed; `git fetch origin` returned nothing because this clone's origin is a
local path stale at `cc92735`; `gh` under this identity cannot see the
repository at all. Rebasing onto "the nearest thing that looks like main" would
have produced four SHAs that look like an answer, so the work stopped and asked.
That is the same rule as the positive-control one: a control validates the tool,
never the referent, and the referent has to be checked by name.

The object was delivered as `refs/em-ci/main`. One correction: it was pushed into
`/workspace`, not into this clone, so it still had to be fetched by exact ref
name — `git fetch origin refs/em-ci/main:refs/em-ci/main` — and the resulting SHA
verified against `439b309` before anything was rebased onto it.

### What the merge actually touched

51 paths between `aa08f1a` and `439b309`. Reported as a set rather than a count,
because a count cannot be reconciled: **`.github/workflows/ci.yml` is not among
them, `Makefile` is not among them, and `scripts/ci-suite-manifest.mjs` is not
among them.** Those are the three files this branch owns or was warned about. All
four refs rebased with zero conflicts, and `ci.yml` and `Makefile` are
byte-identical before and after (`git diff bbc9a59:<path> <new>:<path>` empty for
both).

Step ordering survived the merge: the compile guard is still step 4, still ahead
of `npm ci`.

### Re-measured at the new base, from fresh clones

| measurement | at `aa08f1a` | at `439b309` |
|---|---|---|
| `go list ./...` | 32 packages | **33** |
| top-level Go tests executed | 501 | **548** |
| `.github/expected-go-tests.txt` | 501 rows | **503** |
| top-level skips in a real run | 0 | **0** |

Every gate re-verified from a fresh checkout of the rebased commit: compile guard
green at 33 packages and red on an untracked marker; equality arm green on the
placeholder, red on a tracked stub, red on the empty case; membership green at
548 executed / 0 skipped, and red at 547 / 1 with a single `--- PASS` line
changed to `--- SKIP`.

### Observation, not actioned

The merge added **45 Go tests that are not in `.github/expected-go-tests.txt`**.
The membership gate reports them as a `::notice::` and does not fail — that
asymmetry is deliberate and it is working. But it means the manifest is now 503
rows describing a 548-test suite, and the gap grows every time someone adds a
test without regenerating it. The generator that would close this is R-3, which
is explicitly not this branch's work, so this is filed rather than fixed. Naming
it here because a drifting manifest degrades quietly: each individual notice
looks like noise, and the set of tests the gate actually protects shrinks as a
fraction of the suite.

### One text change made during the rebase

The compile guard printed `33 packages` and nothing else. **An integer is not
diffable** — it cannot tell the next reader whether a package appeared,
disappeared, or both at once, and two people reconciling counts will agree on a
number while disagreeing about which members produced it. The package list now
goes to the step summary and is uploaded with the other evidence. This is the
same lesson two other agents hit this afternoon from the other direction:
conflict sets of 8 and 9 for one merge, disagreeing in three members, where
reconciling the integers would have sent an unexamined file into the merge.
