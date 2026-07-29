# CI-hardening track, cc92735..43bd206 — Review

**Reviewed commit:** `43bd20627e0b07c50f113fda266117d419a9b4ad` (asserted before review).
**Range:** `cc92735..43bd206`, 20 files, +1981/−82.
**Verdict:** **REQUEST CHANGES** — 1 Critical, 3 Required.

---

## Measurement discipline (read this before citing any number below)

Per the track's primary rule as amended at 14:39Z, every result reported here was produced
from a **fresh checkout of a commit**, not from a working tree, unless explicitly flagged.

| Commit | What it is | Tree state at measurement |
|---|---|---|
| `43bd206` | the reviewed commit; fresh `git clone` of the bundle | `git status --porcelain` **empty** |
| `f410023` | canary: child of 43bd206 with `web/dist/.gitkeep` untracked, as a `git commit -a` after a build would produce | fresh clone, `--porcelain` **empty** |
| `930fdb1` | canary: child of 43bd206 with `t.Skip` added to one test | fresh clone, `--porcelain` **empty** |
| `de97465` | canary: child of 43bd206 with `stream.SendHeader(nil)` removed | fresh clone, `--porcelain` **empty** |
| `a007273` | canary: child of 43bd206 with one test renamed | fresh clone, `--porcelain` **empty** |

**One confession, per the fallback clause.** Finding C-1's first leg — "`npm run build` deletes
`web/dist/.gitkeep`" — is necessarily a statement about what a build does *to a tree*, and
cannot be a property of a commit. It was measured from a fresh clone of `43bd206` whose
`--porcelain` was empty immediately before `npm run build`; the build's effect on the tree
is the measurement. Its *consequence* was then re-measured properly, as commit `f410023`.

**All greens here were off-runner when first written.** By the track's rule that is
insufficient as evidence. The prediction stated in advance — **both canaries go green on the
runner** — has since been **CONFIRMED ON THE RUNNER, string for string**. See
"Runner confirmation" at the end of this report. Nothing below is retracted.

---

## Executive Summary

The delta is careful, well-reasoned work and most of its guards fire correctly — I attacked
seven of them and five held. But the change has one hole of the same species as the one the
track exists to close: the *clean-clone-compiles* invariant, which is the entire purpose of
`assets.go` + `.gitignore` + `web/dist/.gitkeep`, is asserted by no gate, is destroyed by
every `make build`, and can be committed away with a routine `git commit -a` while CI stays
fully green. Risk: **HIGH**.

---

## Critical

### C-1 — The clean-clone-compiles invariant is unguarded, and every build destroys it

`web/vite.config.ts` sets `build.outDir: 'dist'`, which is inside the vite root (`web/`), so
vite's `emptyOutDir` defaults to **true**. Every `npm run build` — and therefore every
`make web`, `make build`, `make dashboard`, and `make test` path that reaches them — **deletes
`web/dist/.gitkeep`**.

Measured from a fresh clone of `43bd206`, `--porcelain` empty immediately before the build:

```
status BEFORE build:            (empty)
gitkeep tracked:                web/dist/.gitkeep
vite exit=0
ls web/dist/.gitkeep:           No such file or directory
git status AFTER build:          D web/dist/.gitkeep
find web/dist -type f | wc -l:  4109
```

This directly falsifies the load-bearing claim at **`.github/workflows/ci.yml:102-104`**:

> "`.gitignore` ignores `web/dist/*` with an exception for that one file, so a real 4109-file
> build dropped into the tree still leaves `git status --porcelain` empty."

It does not. It leaves a **deletion**. The file count in that comment (4109) is exactly right;
the cleanliness claim built on it is wrong.

**The consequence.** A developer builds, then runs `git commit -a` or `git add -A`. The
placeholder is untracked. Measured on commit `f410023` (fresh clone, `--porcelain` empty):

```
$ go list ./...
assets.go:20:12: pattern all:web/dist: no matching files found
pkgs=0
```

That is the original defect, verbatim, restored.

**And CI is green on it.** All four relevant arms run verbatim against `f410023`:

| Gate | Result |
|---|---|
| pre-build arm (`ci.yml:120-154`) | **GREEN** — `[ ! -e web/dist ]` → `echo "OK: web/dist does not exist on a clean checkout."` → `exit 0` (lines 122-125) |
| post-build content arm (`ci.yml:159-223`) | **GREEN** — `web/dist: 4109 files, 1 js, 1 css` |
| `go vet ./...` (`ci.yml:261`) | **GREEN** |
| `node scripts/ci-suite-manifest.mjs` | **GREEN** |

**Direct answer to your invitation to disagree.** Your composition claim is correct about the
property it composes, and load-bearing on a different one. The pre-build arm plus the content
arm *do* establish that `web/dist`'s **content** was produced by this run. They cannot
establish that a **clean clone of the commit compiles**, because CI never once compiles Go
against the committed tree: `make build` (`ci.yml:157`) runs `web` before `go build`, and
`go vet` (`ci.yml:261`) runs after that. Every Go compile in the workflow happens against a
tree that has just been populated. Nobody is protecting a property nobody asserted — you
called it, and this is it.

Note also that this is your *new* primary rule at the systems level: CI measures a **tree**
(post-`make build`) and every reader takes the answer to be about a **commit**. The rule as
written constrains how legs measure; it does not yet constrain the runner.

**Suggested fix — two parts, both needed.**

1. *Gate the property against the commit.* Add a step immediately after `Set up Go` and
   **before** `npm ci` / `make build`:
   ```yaml
   - name: A clean clone of this commit must compile
     run: |
       git ls-files --error-unmatch web/dist/.gitkeep
       go list ./... > /dev/null
   ```
   Measured at `43bd206` this is green (86 packages). Measured at `f410023` it is red at the
   first line. It measures the commit by construction, needs nothing but `setup-go`, and costs
   seconds.

2. *Stop the build from destroying the marker.* Either set `build.emptyOutDir` handling so the
   marker survives, or add a restore step to the `web` target in the `Makefile`. Part 1 alone
   leaves every build producing a commit-ready deletion, so the gate becomes a *recurring* red
   that developers must remember not to trip — better than silence, but a treadmill. Part 2
   alone is silent drift again. See "Residual risk created by deferring C-1 part 2" at the end
   of this report.

---

## Required

### R-1 — `t.Skip` defeats the Go membership manifest completely

`ci.yml:312` keys membership on `/^=== RUN   Test[^\/]*$/`. **A skipped test emits `=== RUN`.**
Nothing in the workflow counts, reports, or fails on `--- SKIP`.

Measured on commit `930fdb1` (fresh clone, `--porcelain` empty) — one line,
`t.Skip("in a hurry")`, added to `TestWatchTasks_CreatedEvent`:

```
go test ./... exit           = 0
executed rows                = 501
comm -23 MISSING             = 0
failure lines matched        = 0
SKIP lines in log            = 1
gate output                  → "OK: all 501 manifest tests executed."
```

That last line is false, and the gate emits it with confidence. This is the gate's own charter
— "A test that quietly stops running is the exact failure mode this gate exists to catch"
(`ci.yml:402-403`) — with a one-line, zero-friction bypass that a contributor in a hurry
reaches for *first*, and that reads as good citizenship in a diff (`t.Skip("flaky, see #123")`).

**Positive control that the instrument is not simply blind.** The same pipeline, run against a
*renamed* test (commit `a007273`, fresh clone, `--porcelain` empty), reported correctly:

```
MISSING     : .../internal/streaming  TestEventBus_Unsubscribe        → RED
UNEXPECTED  : .../internal/streaming  TestEventBus_UnsubscribeRenamed → notice
```

So the pipeline detects disappearance. It simply does not classify a skip as a disappearance.

**This is free to fix today.** At `43bd206` the tree contains exactly 3 `t.Skipf` calls, all
three in `internal/platform/github/integration_test.go`, all behind `//go:build integration`,
therefore **zero** skips in the CI-executed set. A strict "no skips" rule costs nothing now and
will only get more expensive later.

**Suggested fix.** In the same awk pass, capture `^--- SKIP: (Test[^ ]*)` and either fail the
step on any skip in the executed set, or subtract skipped tests from `executed-go-tests.txt`
so they surface through the existing `MISSING` path. The first is stricter and free.

### R-2 — The pre-build arm's allowed set is "whatever git tracks", not "the marker"

`ci.yml:140-142`. You found this; here is the number and the second-order point.

Measured: `npm run build && git add -f web/dist && git commit` →

```
tracked files in web/dist : 4109
git status --porcelain    : (empty)
pre-build arm             : GREEN, "allowed 4109 tracked files"
post-build content arm    : GREEN
```

One `git add -f` clears **both** arms and leaves the tree clean.

The second-order point is that the step's own diagnostic states a rule the code does not
implement: *"The tracked .gitkeep marker is fine; a build is not"* (`ci.yml:148`). The code
implements "tracked is fine." The comment at `ci.yml:137-139` explains the choice — "so this
stays correct if the placeholder is renamed or added to" — which trades a real guarantee for
a hypothetical refactor.

**Suggested fix, and it closes C-1's detection in the same line.** Assert the tracked set
*equals* the expected marker set rather than deriving the allowed set from it:

```bash
tracked=$(git ls-files web/dist)
if [ "$tracked" != "web/dist/.gitkeep" ]; then
  echo "::error::web/dist tracks something other than exactly the marker:"
  printf '%s\n' "$tracked"
  exit 1
fi
```

Empty (C-1) and 4109 files (R-2) both fail this. If the marker is ever renamed, the rename and
this line change in the same commit — which is the correct amount of friction for changing the
thing the whole clean-clone story rests on.

### R-3 — The membership parser lives inline in YAML, so it cannot be tested, run locally, or reused to regenerate the manifest

The awk at `ci.yml:310-319` is the single most load-bearing piece of logic in this diff: it
defines what "a test ran" means for 501 assertions. It exists only inside the workflow file.
Consequences, all present at `43bd206`:

- It has no tests and cannot have any.
- It cannot be run locally. `make` has no target; `scripts/` contains only
  `ci-suite-manifest.mjs`, `remap-github-sub-issues.sh`, `test-changed.sh`.
- **There is no generator for `.github/expected-go-tests.txt`.** `ci.yml:404` instructs the
  author to "update `.github/expected-go-tests.txt` in the same change that removes the test"
  and names no command. The author's routes are hand-editing 501 lines or reconstructing the
  awk out of YAML. The first is fine. The second is where a wrong manifest comes from.
- The JS-side equivalent, `scripts/ci-suite-manifest.mjs`, is a *file* — and is consequently
  reviewable, runnable via `make suite-manifest`, and canary-able (I canaried it; see N-5).
  The Go side deserves the same treatment.

**Suggested fix.** Extract the awk into `scripts/go-test-membership.sh <log>` (or a `make`
target) emitting the package-qualified list on stdout. Have `ci.yml` call it, and have the
regeneration path call the identical code. One implementation, two callers, testable.

---

## On your standing rules

### The asymmetry rule is right. Keep it. The recorded reason is the weaker of the two.

You decided MISSING fails and UNEXPECTED is a notice, on the grounds that forcing a manifest
edit "trains people to regenerate the manifest reflexively" (`ci.yml:379-382`). True, and
secondary. The stronger reason, which I would record instead:

> Asymmetry keeps the manifest's **diff** signal-dense. Under symmetry, every test-adding PR
> edits the manifest; reviewers habituate to manifest churn and stop reading it; and the one
> hunk that matters — a removal — hides among additions. Under asymmetry a manifest edit
> appears **only** when a test is removed, so a manifest hunk in a diff is always a question
> worth asking.

Do not make it symmetric.

**The cost you have not priced.** Because UNEXPECTED is a notice only, the manifest's coverage
of the suite **decays monotonically and nothing measures the decay**. At `43bd206` coverage is
exact — I measured 501 expected, 501 executed, 0 missing, 0 unexpected. From the first added
test onward it is not, and nobody will know by how much. A test added in August and deleted in
October was never protected by this gate, and its deletion will be silent.

**Remedy that preserves the asymmetry entirely:** print the drift as a number into
`$GITHUB_STEP_SUMMARY` on every run — `manifest covers <expected> of <executed> executed tests;
<n> unmanifested`. Additions still never block. Decay stops being invisible. Red above a
threshold only if you want it.

### "Prove RED, remove the canary, prove GREEN" is being satisfied per-guard and not per-property — and C-1 is what fell through that

Every individual arm of the `web/dist` pair has been canaried, and every one of them fires; I
re-verified this independently. What has never been canaried is the **property** the pair was
built to protect. A rule phrased as "canary the guard" can never produce a canary for a
property that no guard owns — it has no hook to hang on.

**Suggested amendment, small:** *canary the PROPERTY, then ask which guard went red. If none
did, the property is unguarded, and that is the finding.* Running that once against "a fresh
clone of this commit compiles" would have produced C-1 on the runner, in one job, before this
landed. This is the only one of your rules I found costing more than it protects, and the cost
is one Critical.

The other four rules held everywhere I looked, and "a positive control validates the tool,
never the referent" is doing visible work in the diff — `ci.yml:283-292` (parser self-check
before trusting the parser) and `scripts/ci-suite-manifest.mjs:525-537` (floor before
membership) are both that rule applied correctly, not ritually.

---

## Attacks that failed — negative results, at full specificity

### N-1 — `proto.Clone` quartet: correct, not merely vet-silent

*Attack:* silencing a `copylocks` finding is easy and can change behaviour. Does the deep copy
mutate what the caller intended, and would a shallow copy have differed observably?

*Why it did not work:* all four request types are **scalar-only** — no repeated fields, no
nested messages, no maps — so deep and shallow copies cannot diverge for the mutations
performed.

| Type | Fields |
|---|---|
| `GetReadyTasksRequest` | `CollectionId *string`, `Assignee *string`, `MinPriority *TaskPriority`, `IncludeUnblockedOpen bool`, `PageSize int32`, `PageToken string` |
| `GetBlockedTasksRequest` | `CollectionId *string`, `Assignee *string`, `PageSize int32`, `PageToken string` |
| `GetCriticalPathRequest` | `CollectionId string`, `RootTaskId *string` |
| `GetBottlenecksRequest` | `CollectionId string`, `Limit int32` |

Mutations at `internal/server/server.go:1501-1503`, `1611-1613`, `1819-1822`, `1996-1998` are
all top-level field assignments on the copy (set `CollectionId`; in `GetCriticalPath`
additionally `RootTaskId = nil`). With nothing to alias, the copies are equivalent. The
caller's `req` is not mutated in either version at any of the four sites: the ephemeral branch
returns immediately, and the later reads of `req` (e.g. `req.GetPageSize()` at `server.go:1507`)
are on the non-ephemeral path.

The one behavioural delta is a **fix**, not a regression: `ephReq := *req` aliased the caller's
`unknownFields` byte slice and shared `protoimpl.MessageState` — which contains a `sync.Mutex`
and an atomically-published `*MessageInfo`. Sharing that between two live messages is the
actual defect vet reported, not a style complaint. Nil-receiver behaviour is unchanged: both
the old shallow copy and `proto.Clone(nil-typed).(*T)` followed by a field write panic.

*Positive control on the instrument, not the referent:* reverting site 1 to `ephReqV := *req`
reproduces
`internal/server/server.go:1501:15: assignment copies lock value to ephReqV:
...GetReadyTasksRequest contains ...protoimpl.MessageState contains sync.Mutex`.
Vet sees it. Vet is silent at `43bd206` because the code is right.

### N-2 — `WatchTasks` race fix: window closed, not moved; test capable of failing

*Attack:* is the lost-event window actually closed, or relocated to somewhere less visible?

*Why it did not work:* `internal/server/watch.go:79` places `stream.SendHeader(nil)` after
`s.eventBus.Subscribe(filter)` (line 60) and before the `IncludeInitial` snapshot. gRPC writes
the HEADERS frame at that point and `grpc.ClientStream.Header()` unblocks only then. Nothing
can publish between Subscribe and SendHeader — the handler is the only thing running there and
it is not yet reading. The window is genuinely closed for a header-waiting client.

*Is the test capable of failing?* **Yes, measured.** Commit `de97465` (fresh clone,
`--porcelain` empty), `SendHeader` removed: **7 of 14** `TestWatchTasks_*` tests fail
(`_NoInitial`, `_CreatedEvent`, `_UpdatedEvent`, `_ClosedEvent`, `_ClaimEvent`,
`_CollectionFilter`, `_Heartbeat`). At `43bd206` (fresh clone, clean) all pass, inside the
501/501 green. Prove-red / prove-green satisfied, off-runner.

*Two things nothing in the diff says, both worth one line each somewhere:*
- The barrier is **client-side opt-in**. A client that calls `WatchTasks` and immediately
  mutates without calling `Header()` or `Recv()` still loses the event. `watch_test.go` opts in
  via `awaitSubscribed`; I found no production caller doing watch-then-immediately-mutate, so
  no caller change is owed today — but the API now carries an unwritten requirement.
- A **duplicate** is now possible where a loss used to be: an event published between
  `SendHeader` and the `IncludeInitial` snapshot read can appear both in the snapshot and as a
  live event. Duplicate-over-loss is the right trade for a watch stream. Naming it because
  nothing else does.

*Cost note:* the canary fails by timeout, 30s per test, 160s for the package. A real regression
here burns ~3 CI-minutes before it reports.

### N-3 — Renamed / deleted test: fires loudly and in the right direction

*Attack:* does a rename produce a useful red, or a confusing one?

*Why it did not work:* commit `a007273` (fresh clone, `--porcelain` empty), one test renamed.
The gate reds naming the **old** name under `::error::Go tests listed in the manifest DID NOT
RUN`, and separately notices the **new** name. Both directions correct, both actionable. A
deletion is the same mechanism with no accompanying notice.

### N-4 — `go test` build-cache replay does not produce a false MISSING

*Attack:* if `go test ./...` serves cached results, `=== RUN` lines might vanish and the
membership gate would red spuriously — a false-red that trains people to disable it.

*Why it did not work:* measured at `43bd206` — go replays the cached `-v` output including
`=== RUN` lines verbatim on the second run. No divergence. (CI runners are fresh anyway; this
matters for anyone running the pipeline locally.)

### N-5 — `ci-suite-manifest.mjs` fires on an added-but-unwired web test file

*Attack:* `web/tsconfig.test.json` was broadened to `src/**/*.test.ts` glob discovery, but
`web/package.json` "test" still names exactly one compiled file
(`.tmp-test/utils/task-ready.test.js`). Can a new web test file be compiled but never run?

*Why it did not work:* the script catches it. Adding `web/src/utils/second.test.ts`:

```
TEST FILES PRESENT IN TREE (2) / EXECUTED (1)
NOT EXECUTED BY ANYTHING (1): web/src/utils/second.test.ts
FAIL ... enumerated=2 executed=1 missing=1 unanalysable=0
exit=1
```

The compile-config cross-check at `ci-suite-manifest.mjs:400-440` — refusing a `node --test`
whose named artefact's source is not matched by the tsconfig `include` — is the sharpest single
idea in the diff. See O-5 for the one weakness that remains.

### N-6 — Symlinked `web/dist` defeats the pre-build arm but not the composition

*Attack:* `find web/dist -mindepth 1 -type f` (`ci.yml:141`) neither follows a symlinked start
path nor reports symlinks as files. A cache action restoring `web/dist` as a symlink to a
populated directory would show zero strays.

*Why it did not work:* the same `-type f` blindness trips the post-build arm. `find web/dist
-type f | wc -l` (`ci.yml:210`) also refuses to descend the symlink, yielding 0, which is below
the floor of 500 → red. The composition holds for this one.

---

## Nit / Optional

- **O-1 — `ci.yml:202-203`, pipefail kills the diagnostic it was written for.** Under the step
  shell (`bash --noprofile --norc -eo pipefail`), `js=$(find web/dist/assets ... 2>/dev/null |
  wc -l)` aborts the step at that assignment when `web/dist/assets` does not exist: GNU `find`
  exits 1, pipefail propagates, `set -e` fires. Measured:
  `bash -eo pipefail -c 'js=$(find /nonexistent/assets -maxdepth 1 -type f -name "index-*.js"
  2>/dev/null | wc -l); echo reached'` → prints nothing, exit 1. So the message at
  `ci.yml:205` — *"Expected hashed bundles in web/dist/assets (found ${js} js, ${css} css)"* —
  is unreachable in exactly the case it diagnoses, and the operator gets a bare "exit code 1"
  with no `::error::` annotation. It fails **closed**, so this is diagnosis quality, not a
  hole. Fix: `js=$( { find ... || true; } | wc -l )`, or guard with `[ -d web/dist/assets ]`
  first.

- **O-2 — `ci.yml:122-125` is a vacuous pass on the only condition that reaches it.** Now that
  `.gitkeep` is tracked, `[ ! -e web/dist ]` can only be true because the invariant broke — and
  the arm responds with `echo "OK: web/dist does not exist on a clean checkout."; exit 0`.
  Subsumed by the R-2 fix; flagging separately because the *message* will otherwise survive a
  partial fix and keep reassuring.

- **O-3 — `ci.yml:243` and `ci.yml:261` lack `if: always()`.** A red Go suite skips both
  `Web tests` and `Lint (go vet)`, so a run reports one defect where three may exist. The
  comment at `ci.yml:252-257` reasons carefully about precisely this suppression for the
  membership step and then stops. Both are independent of the Go suite; both should run.

- **O-4 — `ci.yml:424`, `if-no-files-found: error` is weaker than its comment.**
  `actions/upload-artifact@v4` errors only when **no** path in the list matches anything.
  `go-test.log` almost always exists, so the absence of `executed-go-tests.txt` or
  `go-test-failures.txt` — which happens whenever the membership step exits early at
  `ci.yml:280` or `ci.yml:291` — still uploads and stays green. The comment claims "Absent
  evidence is a failure"; the behaviour is "*totally* absent evidence is a failure." Use three
  separate upload steps, or assert the files exist before uploading.

- **O-5 — `scripts/ci-suite-manifest.mjs:35`, `MIN_TEST_FILES = 1` equals the current
  population.** Measured at `43bd206`: exactly one web test file. The floor therefore protects
  only against reaching zero. `ci-suite-manifest.mjs:34` says "Raise this when suites are
  added" and nothing enforces it — the same decay shape as the Go manifest, with no drift
  number either. Also, `candidateFiles('web')` at line 53 scopes enumeration to `web/`, so the
  script cannot see itself or any future root-level `*.test.mjs`.

- **O-6 — `Makefile:81-88`, `lint-proto` is now unreachable in practice.** `buf lint proto`
  previously ran for anyone with `buf` installed, via `make lint`. It is now split out, wired
  into no CI step and no default target, so it runs only if someone types it. The comment at
  `ci.yml:247-250` justifies keeping it out of CI, which I agree with; nothing schedules it
  anywhere else. If proto lint matters, give it a job with a `buf` setup action; if it does
  not, say so and delete the target rather than leaving a linter nobody invokes.

- **O-7 — `assets.go:41`, `fs.Stat` error is flattened.** Any stat error becomes
  `ErrWebAssetsNotBuilt`, discarding the original. On an `embed.FS` the only realistic error is
  not-exist, so this is currently harmless; `errors.Join` or wrapping would keep it honest.

- **O-8 — `assets.go:21`, `WebAssets` remains exported with no in-repo consumers.** Both call
  sites now use `WebUI()` (`cmd/farmtable-server/main.go:99`, `internal/cli/dashboard.go:118`),
  and the doc comment tells readers not to use `WebAssets` directly. It is at the module root,
  so unexporting is an external API break — your call whether that matters here.

---

## FYI

- **50 of 549 declared `Test` functions (9%) are outside every gate in this diff.** Measured at
  `43bd206`: 549 `func Test*` declared, 499 unique names in the manifest, 501 manifest rows
  (the 2-row surplus is `TestListUsers`/`TestGetUser` in two packages, exactly as `ci.yml:302-308`
  describes). The 50 uncovered are all behind `//go:build integration`:
  `internal/store/entstore_postgres_test.go`, `internal/server/server_postgres_test.go`,
  `internal/platform/github/integration_test.go`. The manifest is *correct* to exclude them —
  they cannot run without Postgres and a GitHub token. Naming it because "501 tests are gated"
  reads as total coverage and is 91%.

- **All 3 existing `t.Skipf` calls are inside that tagged set**, so R-1's fix costs nothing at
  `43bd206`.

- **`internal/testutil/teststore.go:60-62`** — the per-store named DSN keeps a distinct
  in-memory SQLite database alive for the lifetime of the test binary wherever a connection
  leaks (the documented `recordTokenUsage` goroutine). 501 tests' worth of schemas are retained
  rather than reclaimed. The suite completes fine — measured, ~3 min at `43bd206` — so this is
  a note, not a finding.

- **Residual risk from the same change:** tightening isolation can convert a test that
  previously saw shared rows into one that passes vacuously (e.g. an assertion that a list is
  empty). 501/501 pass at `43bd206`, and the diff's own narrative describes the change
  *correcting* an over-count (`TestListUsers` seeing three users after creating two), so I have
  no evidence of a vacuous pass — only no way to rule one out from the delta alone.

---

## Positive Feedback

Not manufactured; these are the parts I tried to break and could not.

- **`ci.yml:283-292`, the parser self-check.** Refusing to trust the failure grep until at
  least one package result line has been recognised is the correct shape for an evidence gate,
  and it is the thing that stops "unparseable log" from reading as "no failures."
- **`ci.yml:334-350`, the tab-vs-space post-mortem.** Four failure forms enumerated, each
  anchored separately, each attributed to a real run artifact rather than a hand-written
  sample. This is how a regex fix should be documented.
- **`scripts/ci-suite-manifest.mjs:400-440`**, the compile-config cross-check — refusing a
  `node --test` whose named artefact's source is not matched by the tsconfig `include` — closes
  a blind spot the runner is structurally incapable of reporting about itself.
- **`scripts/ci-suite-manifest.mjs:355-373`**, the node 20/22 positional matrix. Refusing
  *every* shape that differs across node versions, rather than pinning to the one that happens
  to work today, is the right generalisation from a single incident.
- **`internal/testutil/teststore.go:16-30`**, the DSN comment. "Test isolation under that DSN
  is not a property of the test — it is a race on connection lifetimes" is the clearest
  sentence in the diff.

---

## Test Coverage

Adequate for the behavioural changes; the gate changes are the gap.

- **Race fix:** covered, and the coverage is real — 7 tests fail without it (canary `de97465`).
- **`proto.Clone` quartet:** no new tests, and none are owed. The behaviour is unchanged by
  construction (N-1) and `go vet` is now the regression detector, wired into CI for the first
  time at `ci.yml:261`.
- **Store isolation:** `internal/store/multistore_test.go:864-875` makes the previously
  accidental sharing explicit via `NewTestStorePair`, which is the right move — the comment
  documents *why* two handles must address one database.
- **Gap:** the awk membership parser (`ci.yml:310-319`) has no tests and structurally cannot
  have any while it lives in YAML. See R-3.
- **Gap:** `scripts/ci-suite-manifest.mjs` (389 net-new lines) has no tests and excludes itself
  from its own enumeration. I canaried it manually (N-5) and it fired; that canary is not
  committed anywhere.

## Backward Compatibility

- No wire-format changes. No proto edits; `api/farmtable/v1` untouched in this range.
- `WatchTasks` now sends response headers before the first message. This is additive on the
  wire and transparent to any existing client — headers were previously sent implicitly on the
  first `SendMsg`. No client is required to change.
- `farmtable.WebUI()` is additive. `farmtable.WebAssets` remains exported and unchanged
  (see O-8).
- Behavioural change worth knowing: a binary built without `make web` now fails at startup with
  `ErrWebAssetsNotBuilt` (`cmd/farmtable-server/main.go:99` → `log.Fatalf`) where previously
  `go build` would not have produced a binary at all. Failing loudly at startup is the right
  trade; it is a new runtime failure mode where there used to be a compile failure.
- `make lint` no longer runs `buf lint proto` (O-6). Anyone relying on `make lint` for proto
  linting silently loses it.

## Final Verdict

**REQUEST CHANGES**

*(Runner confirmation for C-1 and R-1 follows this section.)*

C-1 alone is disqualifying: this change ships a guard for the clean-clone-compiles property
that does not guard it, in a track whose subject is guards that never fire, and the property
degrades on every build with no adversary required. R-2's one-line fix closes C-1's detection
and R-2 together; R-1's fix is a few lines of awk and is free at `43bd206`; R-3 is a file move.

Everything else here is Optional or a negative result. The change is otherwise a substantial
improvement to the health of this repository, and the reasoning recorded in the workflow
comments is of a quality I rarely see. Fix the four and it is a clear approve.

---

## Runner confirmation (added after the pre-registered canaries ran)

Predictions were pre-registered at
`/scion-volumes/scratchpad/projects/farmtable/reports/prereg-canaries-43bd206.md` **before**
any runner time was spent, naming per branch the expected step *outputs* and the specific steps
at which a red would refute the finding. Both came back green, via the exact mechanism modelled.

**Control:** `43bd206` itself has two green records on the same runner — **30460294525** (main)
and **30460044903** (integration/ci-green). A red on either canary would therefore have been
interpretable. No third job was needed.

### C-1 — `canary/c1-gitkeep-untracked` @ `f410023` — run **30463794909** — SUCCESS

```
OK: web/dist does not exist on a clean checkout.          <- the predicted ci.yml:122-125 arm
web/dist: 4109 files, 1 hashed js, 1 hashed css
OK: web/dist contains real build output produced by this run.
package-qualified Go tests executed: 501
OK: all 501 manifest tests executed.
no ::error::, no ::notice::, job success
```

Confirmed, and confirmed through the predicted branch rather than the stray/tracked branch — so
the *mechanism* is confirmed, not merely the colour. **The suite certifies a commit that cannot
be compiled from a clean clone.** `go list ./...` on that commit returns 0 packages.

### R-1 — `canary/r1-tskip-defeats-membership` @ `930fdb1` — run **30463804634** — SUCCESS

```
--- SKIP: TestWatchTasks_CreatedEvent (0.00s)             <- visible in the Go step's own log
package-qualified Go tests executed: 501
go test failure lines matched: 0
OK: all 501 manifest tests executed.
no ::error::, no ::notice::, no "(unterminated)" rows
```

Confirmed. The gate printed a true-sounding false certificate four steps after the skip appeared
in its own log.

### N-7 — awk contiguity is not parallelism-sensitive on the runner (negative result)

The pre-registered third branch — membership redding with `(unterminated)` rows, which would
have meant the per-package contiguity assumption at `ci.yml:294-319` is sensitive to the
runner's CPU count / `-p` parallelism — **did not occur** on run 30463804634. That was a
finding-in-waiting; it is now a negative result with a run ID behind it.

### Residual risk created by deferring C-1 part 2

The fix is ordered as part 1 (gate the property in CI) and part 2 (stop the build deleting the
marker). Part 2 is deferred as measure-and-report under a frontend-config scope freeze.
Consequence worth tracking: with vite still emptying `outDir`, **every build leaves a
commit-ready deletion of the marker**, so part 1 converts a silent failure into a *recurring*
CI red that developers must remember not to commit. Strictly better than silence, but a
recurring red with an obvious-looking wrong fix is how guards get weakened.

Cheap mitigation that may sit outside the frozen scope, because it is a `Makefile` change and
not a `vite.config.ts` change: restore the marker in the `web` target after `npm run build`
(e.g. `@touch web/dist/.gitkeep`). It does not cover a developer running `npm run build`
directly inside `web/`, so it is partial — but it removes the common path without touching
frontend config.

Related pre-warning: with part 2 deferred, CI runs now end with the marker deleted from the
post-build tree. Harmless today. If anyone later adds a post-build `git status --porcelain`
cleanliness assertion, it will red on every run.
