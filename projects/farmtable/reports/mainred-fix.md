# main RED — flake investigation and fix

**Author:** farmtable-dev (mainred-fix leg)
**Date:** 2026-07-29
**Brief:** `briefs/farmtable-mainred-fix.md`
**Base revision:** `cc927355e5a23c45bfd983cd331eb540b0a61ad5`
**Branch:** `fix/mainred-watchtasks-race-and-test-isolation` (local, in `/workspace/farmtable-mainred-fix`, **not pushed**)

---

## Bottom line

There are **two defects, not one**, with **different mechanisms**. The brief conflated them.
Both are fixed. The evidence for each is of a different strength, and I say which is which below.

| | Defect 1 | Defect 2 |
|---|---|---|
| Symptom | 7 `TestWatchTasks_*` tests hang to timeout | `TestListUsers` sees 3 users after creating 2 |
| Mechanism | Lost-event race — subscription registered *after* the client can publish | Cross-test state leakage via a process-wide in-memory DB |
| Brief's stated mechanism | ❌ wrong for this test | ✅ correct — this is where it belongs |
| Evidence | **Executed.** Interleaved discriminator, 10/10 vs 0/10, p≈1e-5 | **Mechanism executed; exact interleaving derived, not reproduced** |
| Fixed by | `stream.SendHeader` after `Subscribe` + `awaitSubscribed` in tests | Unique DB name per `NewTestStore` |

**The before/after natural-rate comparison does NOT on its own establish the fix.** It is
underpowered (p = 0.23). What establishes Defect 1 is the discriminator. I have not
rounded that up into a stronger claim.

---

## 1. Did the brief's hypothesis hold?

**Partly — and the part that failed is the more important half.**

The brief hypothesised that *background work kicked off without any way for the test that
started it to wait for completion* caused tests to observe data left by other tests, and
named `TestWatchTasks_NoInitial` as a member of that class, with `TestListUsers` as a
different species.

**That is backwards.** In my own words:

- `TestWatchTasks_NoInitial` is **not** an instance of unwaitable background work, and it
  does not observe data left by other tests. It is a **lost-event race inside a single
  test**. Nothing leaks into it; something of its own goes missing. The test is not
  polluted, it is *deaf* — it starts listening a fraction too late and misses an event it
  caused itself.
- The mechanism the brief described — unwaitable background work outliving the test that
  started it — is real, and it is the mechanism behind **`TestListUsers`**, the very test
  the brief set aside as a different species.

So the brief had two genuine defects and swapped their labels. The refutation was worth
more than the fix here, exactly as the brief anticipated: had I taken the diagnosis as
given, I would have gone looking for a `WaitGroup` around `WatchTasks` and found nothing,
because there is no background work in that path to wait for.

The brief's instruction to treat the diagnosis as a hypothesis rather than a finding is
what made this recoverable. It was correct to flag it.

---

## 2. Defect 1 — lost-event race in `WatchTasks`

### Mechanism

`client.WatchTasks(...)` **returns before the server handler runs.** Creating a gRPC stream
only requires the transport to accept the request. Meanwhile the handler still has to get
through, in order (`internal/server/watch.go`, line numbers at base revision):

| Line | Work done before subscribing |
|---|---|
| 23 | `RequireIdentity` |
| 26 | `RequireScope` |
| 29 | `validateWatchTasksRequest` |
| 35 | `uuid.Parse` |
| 39 | `RequireCollectionAccess` |
| 43 | `s.store.GetCollection` — **a store round trip** |
| **60** | **`sub := s.eventBus.Subscribe(filter)`** |

A test that calls `WatchTasks` and then immediately mutates a task can have its own event
published into the window between "call returned" and line 60.

`EventBus.Publish` (`internal/streaming/eventbus.go:68`) takes an RLock and iterates
`eb.subscribers`. **There is no replay and no backlog.** A subscriber that is not yet in
the map does not merely miss a full channel — it is not iterated at all, so the event does
not even reach the `WARNING: dropping event` log line. It vanishes with no trace. The test
then waits out its full timeout for an event that already happened.

This is why the failure looks like slowness and is not.

### How it was localised — the discriminator

Statistical flake-counting cannot localise a race; it only counts it. So I used an
**injected-delay discriminator**: two trees identical except for the *position* of one
200ms sleep relative to `sub := s.eventBus.Subscribe(filter)`. `diff` confirmed exactly one
line moved.

- **armA** — sleep **before** `Subscribe` (widens the suspect window)
- **armB** — sleep **after** `Subscribe` (same delay, same cost, window not widened)

If the window is the defect, armA fails and armB does not. If the delay merely perturbs
timing generally, both behave alike.

**This design was corrected mid-flight after the coordinator identified a real flaw in my
first attempt.** I originally ran the arms sequentially. The coordinator pointed out that
heavy host load delays handler scheduling — *the same causal pathway as my injected sleep* —
so a load drift between two sequential arms could manufacture 10/10 vs 0/10 with the sleep
doing nothing at all. He was right, and the wide separation of the result was no defence.
I re-ran interleaved. Schedule pre-registered before the first run: 10 pairs, armA then
armB within each pair, both arms every pair or neither, no arm re-run or dropped.

| Pair | armA (before Subscribe) | armB (after Subscribe) |
|---|---|---|
| 1 | **FAIL** 8.6s load=6.19 | pass 3.4s load=6.18 |
| 2 | **FAIL** 6.2s load=6.24 | pass 1.5s load=6.54 |
| 3 | **FAIL** 6.3s load=6.50 | pass 1.5s load=6.22 |
| 4 | **FAIL** 6.3s load=6.22 | pass 2.0s load=5.88 |
| 5 | **FAIL** 6.6s load=6.29 | pass 1.7s load=6.43 |
| 6 | **FAIL** 6.5s load=6.43 | pass 1.4s load=6.96 |
| 7 | **FAIL** 6.3s load=6.96 | pass 1.7s load=6.80 |
| 8 | **FAIL** 6.4s load=6.98 | pass 1.9s load=7.06 |
| 9 | **FAIL** 6.7s load=7.06 | pass 2.0s load=7.23 |
| 10 | **FAIL** 6.7s load=7.23 | pass 1.5s load=7.13 |

**armA 10/10 fail, armB 0/10 fail.** Loads matched pair-by-pair (5.88–7.23 on both arms;
each armB ran at essentially the load of the armA beside it). Fisher exact two-tailed
**p ≈ 1.1e-5**.

Load is now matched *by construction*, so it cannot be the explanation. The only surviving
difference between the arms is which side of `Subscribe` the sleep sits on. The failure
text is byte-identical to the one seen in CI.

### The fix

`stream.SendHeader(nil)` immediately after `Subscribe`, and a test helper `awaitSubscribed`
that blocks on `grpc.ClientStream.Header()`.

**This is a barrier, not a delay, and deliberately not a retry loop.** `Header()` returns the
instant the subscription exists and not before — it waits for precisely the event it needs
and no longer. The brief is right that a retry loop would convert a visible flake into an
invisible one and make the defect permanently unmeasurable; there is none here.

`awaitSubscribed` is added to the **7 tests that subscribe then mutate**:
`_NoInitial`, `_CreatedEvent`, `_UpdatedEvent`, `_ClosedEvent`, `_ClaimEvent`,
`_CollectionFilter`, `_Heartbeat`.

It is **not** added to `_IncludeInitial` or `_SequenceNumbers`, which `Recv` before mutating
anything — a successful `Recv` is itself proof the subscription exists, so adding a barrier
there would be cargo-culting.

Note the scope correction: **the defect spans 7 tests, not the one the brief named.** Both
natural failures observed in experiment 1 were `_CreatedEvent` and `_Heartbeat` — *not*
`_NoInitial`. Anyone fixing only the named test would have left the flake in place and
believed it fixed.

### Verification that the fix closes the window

Two further arms, on the fixed tree:

- **armD** — fix + 200ms sleep before `Subscribe`: **0 failures / 10 runs**
- **armE** — fix + **2s** sleep before `Subscribe`: **0 failures / 5 runs**

A 2-second artificial window, ten times the one that produced 10/10 failures unfixed,
produces none. The barrier holds the window open rather than racing it shut.

---

## 3. Defect 2 — `TestListUsers`: verdict

**Verdict: a genuinely different defect from Defect 1, and the one the brief's stated
mechanism actually describes.** Not the same bug, not a duplicate.

### Mechanism

`TestListUsers` (`internal/server/identity_test.go:184`) creates 2 users and asserts
`resp.GetTotalCount() != 2` at line 205. The count is **global and unfiltered**, so the test
fails if any user from an earlier test is still visible — e.g. `comment-agent` from
`TestAddComment_PropagatesUserID` (line 145).

The leak was in the test DSN. `NewTestStore` used:

```
file::memory:?cache=shared&_fk=1
```

This does **not** mean "a private in-memory database". It names **one process-wide
database** shared by every connection in the test binary — all 124 `NewTestStore` call
sites — and SQLite destroys it only when the **last** connection closes.

Test isolation under that DSN was therefore never a property of the tests. It was a **race
on connection lifetimes.** Any connection outliving its test by a moment keeps the database
alive and hands the next test the previous test's rows.

`recordTokenUsage` (`internal/server/auth.go`) is exactly such a route:

```go
func recordTokenUsage(lookup TokenLookup, tokenID uuid.UUID) {
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), tokenUsageTimeout)
		defer cancel()
		lookup.RecordUsage(ctx, tokenID)
	}()
}
```

A detached goroutine on `context.Background()` with a 5-second timeout, called on every
unary (line 152) and stream (line 201) request. **Nothing can wait for it.** That is the
brief's "background work kicked off without any way for the test that started it to wait
for completion", precisely.

### What I measured rather than assumed

I did not take the shared-DB premise on trust. A temporary probe (`zzprobe_test.go`, since
deleted) measured it directly:

- **PHASE 2** — a second store opened independently **saw the first store's rows** while
  both were open. → sharing confirmed, not inferred.
- **PHASE 4** — the database was destroyed **only when the last connection closed**. →
  lifetime-race confirmed.

### The fix

Each store now gets a **uniquely named** database:
`file:testdb-<uuid>?mode=memory&cache=shared&_fk=1`.

The databases are disjoint **by construction**, so no goroutine lifetime can carry state
across a test boundary. This fixes the class, not just `TestListUsers`, and does so
**without touching the detached goroutine** — the goroutine is a symptom-carrier here, not
the disease, and changing production auth code was out of scope for a test-isolation fix.

`NewTestStorePair` is added for the single place that genuinely needs two handles on the
same rows (see §5).

### What I could NOT establish — stated plainly

**I did not reproduce the exact failing interleaving of `TestListUsers` end-to-end.**

- I predicted that a 300ms delay inside the `recordTokenUsage` goroutine would make the
  `TestAddComment` → `TestListUsers` pair fail. **It did not: 0 failures / 10 runs. My
  prediction was refuted.** I am recording that rather than quietly dropping it.
- Running the pair in isolation, and each test solo, also passed.

So: **the mechanism is established by direct measurement; the specific interleaving that
produced the observed 3-users-instead-of-2 is derived, not executed.** The fix is
justified by the mechanism — the shared database and the unwaitable goroutine both
demonstrably exist, and together they are sufficient — but I have not watched this
particular defect fail on demand, and I am not going to imply that I have.

---

## 4. Flake rates — before and after, with populations

> **TREE COORDINATES for every figure in this section.** Declared as coordinates rather
> than as a label, because a label is chosen by nearest-match and then fails to predict the
> figure:
>
> | Axis | Value |
> |---|---|
> | `web/dist` | **real** — genuine `npm ci` + `vite build`, 4,109 files, 21MB. Not a stub. |
> | `node_modules` | **present** |
> | module cache | **warm** — shared `/home/scion/go/pkg/mod`, populated before these runs |
>
> Trees: `/tmp/mainred/{unfixed,fixed,armA,armB}`, copies of `cc92735`. **Not the main
> working copy** — I took no measurement there. **Not CI figures.** The §6 vet figures are
> the only ones taken at different coordinates.
>
> The warm cache matters and is not decoration: at a cold or partial cache these same
> commands would have failed packages for reasons unrelated to `web/dist`, reporting an
> identical `setup failed` line. My runs show four setup-failed pristine and none built,
> which is the signature of a warm cache. Two legs holding byte-identical trees at this
> commit can report different package counts, and nothing printable about the tree explains
> it — `GOMODCACHE` is under `/home/scion`, which is per-agent.

### Green baseline

**0 failures across 1 run of 499 top-level tests (904 including subtests) across 32
packages.** Taken in a **throwaway BUILT tree**. Conditional on `web/dist` having been
built first — see §7.

**Correction (second pass, after Bulletin 20).** An earlier revision of this line said the
four embed-dependent packages were "not in the 32 and never were." **That was wrong**, and
it was wrong because I generalised an abort behaviour across verbs that do not share it:

> `go list`, `go vet` and `go build` abort pattern expansion at exit 1 with **zero packages
> analysed** in a tree without a built frontend. **`go test` does not.** It expands fully to
> all **32** packages and marks exactly **four** setup-failed — `farmtable`,
> `cmd/farmtable-server`, `cmd/ft`, `internal/cli`, the four that embed `all:web/dist`. The
> other **28 run normally and their results are valid.** `internal/server` is not among the
> four.

So the four **are** in the 32. What a pristine tree costs is those four packages' tests,
not the denominator. My `internal/server` flake dataset — the entire basis of this report —
sits in the 28 that run regardless, which is why it was never at risk from this.

**The 32 is bound to the commit, not just the tree.** At `cc92735`:
`32 = 4 setup-failed + 8 ok + 20 no-test-files`. A count of **33** is not a disagreement
with this — it is the r8 lineage, which adds `internal/webguard`, a package with tests. The
columns reconcile exactly: setup-failed 4 in both, no-test-files 20 in both, packages +1,
ok +1. **Name the commit as well as the tree**; two figures that look contradictory here
differ by exactly the object that distinguishes the two revisions.

**A run reporting substantially more than four setup-failed is measuring something else and
must not be read as the `web/dist` defect.** A cold or partial module cache under
`GOPROXY=off` produces the same `setup failed` line for an unrelated reason, and the output
does not say which cause it is.

### Natural-rate comparison, unfixed vs fixed

Paired and interleaved per the coordinator's binding procedure. 10 pairs pre-registered
before the first run; both arms every pair; every run reported individually.

**Experiment 2** (current fix; supersedes experiment 1). Command per run:
`go test ./... -count=1`, full suite.

| Pair | unfixed | fixed |
|---|---|---|
| 1 | pass 8.4s load=6.61 | pass 9.2s load=7.98 |
| 2 | pass 6.8s load=7.14 | pass 6.7s load=6.89 |
| 3 | pass 7.2s load=7.00 | pass 6.4s load=6.92 |
| 4 | **FAIL** 10.9s load=6.61 — `TestWatchTasks_CreatedEvent` | pass 6.9s load=7.88 |
| 5 | pass 6.4s load=7.85 | pass 6.8s load=7.39 |
| 6 | pass 6.9s load=7.03 | pass 6.6s load=6.25 |
| 7 | pass 7.0s load=5.91 | pass 6.8s load=5.75 |
| 8 | pass 6.5s load=5.45 | pass 6.7s load=5.01 |
| 9 | pass 7.0s load=4.24 | pass 6.7s load=4.62 |
| 10 | pass 7.1s load=4.33 | pass 8.6s load=4.53 |

**unfixed 1 failure / 10 runs. fixed 0 failures / 10 runs.**

**Experiment 1** (reported in full; its *fixed* arm contained a regression I introduced,
see §5). Same command and design.

| Pair | unfixed | fixed |
|---|---|---|
| 1 | **FAIL** 21.1s load=4.33 — `TestWatchTasks_CreatedEvent` | **FAIL** 21.0s load=5.41 — MultiStore ×2 |
| 2 | pass 7.9s load=4.45 | **FAIL** 7.0s load=5.04 — MultiStore ×2 |
| 3 | pass 8.0s load=4.88 | **FAIL** 7.0s load=5.62 — MultiStore ×2 |
| 4 | pass 6.5s load=6.13 | **FAIL** 6.8s load=5.49 — MultiStore ×2 |
| 5 | pass 6.4s load=5.45 | **FAIL** 8.0s load=5.41 — MultiStore ×2 |
| 6 | pass 7.4s load=6.23 | **FAIL** 6.4s load=5.97 — MultiStore ×2 |
| 7 | **FAIL** 10.8s load=6.14 — `TestWatchTasks_Heartbeat` | **FAIL** 7.1s load=6.90 — MultiStore ×2 |
| 8 | pass 7.0s load=8.11 | **FAIL** 8.2s load=7.54 — MultiStore ×2 |
| 9 | pass 6.8s load=7.74 | **FAIL** 8.1s load=7.25 — MultiStore ×2 |
| 10 | pass 6.6s load=7.63 | **FAIL** 7.9s load=6.76 — MultiStore ×2 |

**unfixed 2 failures / 10 runs. fixed 10/10 failures — all of them my regression, and
0 `WatchTasks` failures across all 10.**

### Combined and interpreted honestly

**Unfixed: 3 failures across 20 full-suite runs (15%).**
**Fixed: 0 `WatchTasks` failures across 20 full-suite runs.**

**This comparison is underpowered and does not by itself establish the fix.**
Fisher exact, 3/20 vs 0/20: **two-tailed p = 0.23.** That is not significant, and I will not
present it as though it were. Detecting a ~15%-per-run effect reliably needs far more than
10 runs per arm; the fixed arm's clean sheet is consistent with the fix working and equally
consistent with 20 lucky runs.

**The load in these observations was not controlled, only recorded** (4.24–8.11). The
coordinator's warning applies in full: a load-sensitive flake rate is not a number, it is a
function of load. The 15% figure is the rate *at the load these runs happened to see*, not a
property of the suite.

What actually carries the finding is the **discriminator** (p ≈ 1e-5), which matched load by
construction rather than hoping it stayed still. The natural-rate numbers are supporting
context, not proof.

**Magnitude sanity check.** The EM reports ~5 tests flaking at ~4.5% each, implying
1 − 0.955⁵ ≈ **20.6%** per full-suite run. I observed **15%** (3/20). Same order of
magnitude, and 20.6% sits comfortably inside the 95% CI of 3/20 (≈3–38%). This is **weak
agreement between two estimates, not confirmation of either — both could be wrong
together.** My finding that 7 tests are vulnerable rather than 5 sits consistently with it.

---

## 5. A regression I introduced, and caught

The `NewTestStore` change **broke two tests deterministically, 10/10**:

```
TestMultiStore_LazyRegistration_CreatesStoreOnFirstRequest
TestMultiStore_LazyRegistration_CachesOnSecondRequest
multistore_test.go:941: CreateTask: creating task: ent: constraint failed: FOREIGN KEY constraint failed
```

**Root cause — and it is really a second finding, not just my bug.** `newLazySetup` takes a
collection ID from one store and then drives task operations through a *different* store,
with tasks carrying that ID. That only ever worked because the old DSN silently made every
store the same database. The store API has no way to create a collection with a chosen ID,
so the two handles *must* address one database for the test to work at all — a dependency
that was completely invisible at the call site.

**Fix:** `testutil.NewTestStorePair`, which returns two handles on one deliberately-shared
database. The sharing is now explicit and commented, so a reader can *see* it instead of
having to know it. Verified 5/5 pass.

**I caught this only because experiment 1 was running with the full suite.** Had I measured
only `internal/server`, I would have shipped a green `WatchTasks` result on top of two
deterministically broken tests. That is an argument for full-suite measurement even when
the defect is local, and I'd flag it as a process point worth keeping.

---

## 6. `go vet` from a genuinely clean checkout

> **TREE COORDINATES.** Both commands below were run in `/tmp/mainred/vetclean`, a copy of
> `cc92735` at: `web/dist` = **absent** · `node_modules` = **absent** · module cache =
> **warm**. Not the main working copy. Not a CI runner.
>
> `go vet` is one of the verbs that **does** abort pattern expansion in a tree without a
> built frontend, which is why the whole-project run below analyses zero packages. This is a
> property of the verb, not of the tree — `go test` in this same tree expands to all 32
> packages and fails only four.

```
$ go vet ./...        # PRISTINE tree
EXIT 1
assets.go:5:12: pattern all:web/dist: no matching files found
```

**One error, and it is not a vet finding — it is a load failure that aborts the run with
zero packages analysed.**

**Correction (2026-07-29, after the tree-state bulletin).** An earlier revision of this
report wrote that error as `internal/server/assets.go`. **That was wrong.** `assets.go` is
at the **repository root**, in package `farmtable`:

```go
package farmtable
import "embed"
//go:embed all:web/dist
var WebAssets embed.FS
```

The four packages that fail to load in a pristine tree are the root package and its
importers — `farmtable`, `cmd/farmtable-server`, `cmd/ft`, `internal/cli`. The count of
four was right; the location was not.

**`internal/server` is NOT among them**, and that is the point rather than a footnote.
Scoping to it works perfectly well in a pristine tree, because it does not import the root
package and so never touches the broken embed:

```
$ go vet ./internal/server        # PRISTINE tree, same tree, no build
EXIT 1
internal/server/server.go:1500:14: assignment copies lock value to ephReq: ...GetReadyTasksRequest contains protoimpl.MessageState contains sync.Mutex
internal/server/server.go:1610:14: ... GetBlockedTasksRequest ...
internal/server/server.go:1818:13: ... GetCriticalPathRequest ...
internal/server/server.go:1995:13: ... GetBottlenecksRequest ...
```

**All four findings from the brief are live and confirmed.** The brief cited lines
1509 / 1619 / 1827 / 2004; I see 1500 / 1610 / 1818 / 1995 — a **constant offset of exactly
9 lines**, so these are the same four findings observed on a different revision, not new
ones. That the offset is *constant across all four* is what makes them the same four rather
than four new ones.

**Provenance caution — do not cite this as corroboration.** The earlier four-findings
figure was retracted by the coordinator on **provenance** grounds: it had been quoted
against a population it was not measured over. My measurement does **not** un-retract it. A
correctly-retracted figure that later turns out numerically right is still correctly
retracted, because the retraction was about where the number came from, not what it was.
The figure above is a fresh measurement with its own command and tree state attached and
stands on that alone. **It is not a second source agreeing with the retracted one, and the
two must not be cited together as agreement.**

**Additional finding, and the important one: the `web/dist` breakage MASKS these four.**
Because `go vet ./...` aborts on the load error, the repo-wide vet that anyone would
actually run reports *one* problem and never reaches the four real ones.

The corrected location makes this **worse, not better.** The four findings are not stuck
behind an unbuildable package — `internal/server` builds and vets fine in a pristine tree,
with no build, no npm, and no frontend. They were reachable by a one-word change to the
command, at any point, by anyone. Nothing was hard here. The only reason they went unseen
is that `./...` is what people type, and `./...` aborts on an unrelated package at the
repository root before it reports them.

That is the difference between a blocked instrument and a misreporting one. A blocked
instrument is visibly blocked. This one answers, and it answers **one** when the truth is
**five**.

**FIXING EM-100 WILL MAKE FOUR FINDINGS APPEAR THAT WERE ALWAYS THERE. NOBODY SHOULD READ
THAT AS A REGRESSION.**

### Fixed? No — and why

**Reported, not fixed.** The brief says fix only if *trivially safe and in scope*. This
fails both tests:

- The correct repair is `proto.Clone(req).(*pb.XRequest)` in place of `ephReq := *req`.
  That swaps **shallow-copy for deep-copy semantics**. It is very likely fine — `ephReq` is
  only mutated on `CollectionId` and passed read-only downstream — but "very likely fine
  across four call sites in a file I have not otherwise touched" is not *trivially* safe.
- `server.go` is shared infrastructure, outside this task's assigned scope.

These are pre-existing and unchanged by my commits: `go vet` on the packages I did touch
(`internal/testutil`, `internal/store`) exits **0**.

---

## 7. Disclosures

Stated plainly, because a green that does not say what it needed in order to be green is
the thing we are trying to stop producing.

0. **TREE COORDINATES, NOT TREE LABELS.** Whole-project commands behave differently
   depending on at least three independent axes, so each figure declares its coordinates
   rather than picking a nearest label:

   | Figures | `web/dist` | `node_modules` | module cache |
   |---|---|---|---|
   | §6 vet (`/tmp/mainred/vetclean`) | absent | absent | warm |
   | §4–§5 test & flake (`/tmp/mainred/{unfixed,fixed,armA,armB}`) | real (4,109 files) | present | warm |

   **No measurement in this report was taken in the main working copy, and none is a CI
   figure.** The module cache is not in the tree at all, so no amount of describing the tree
   would have disambiguated these — `GOMODCACHE` lives under per-agent `/home/scion`.

1. **I built `web/dist` to make any test run possible at all.** At `cc92735`,
   `go test ./...` fails with 4 `[setup failed]` packages — `farmtable`,
   `cmd/farmtable-server`, `cmd/ft`, `internal/cli` — on
   `assets.go:5:12: pattern all:web/dist: no matching files found`, from the **root**
   `assets.go`, not `internal/server`. This is a deterministic build failure, not a flake.
   It independently confirms the EM's EM-100 reclassification from cosmetic to repo-wide
   toolchain blocker. I ran `make build` first, mirroring CI's own ordering.
   - It was a **real Vite build** — 4,109 files, 21MB, hashed assets — not a stub.
   - **`web/dist` IS gitignored, verified by direct measurement, not assumed.** In a tree
     where the directory exists: `git check-ignore -v web/dist` → **exit 0**, matched by
     `.gitignore:17:dist/`; and decisively, `git status --porcelain -uall` → **0 lines**
     with all 4,109 files present. So a built frontend produces **no** untracked, stageable
     files. **0 tracked files resulted.** See the caveat in §7a — this contradicts a claim
     currently in circulation.
   - **Every full-suite green in this report is therefore conditional on that build.** Per
     the coordinator's ruling, conditional rather than void.
   - All builds and measurement runs were done in `/tmp/mainred/`, **outside `/workspace`**,
     per the amended instruction not to build in a tree under review or audit. The
     deliverable tree was decontaminated: `web/dist` deleted by explicit full path, no
     wildcard.

2. **Void list: empty.** No arm was re-run to agreement, extended, or dropped. Every run
   executed under every pre-registered schedule is reported above, including experiment 1's
   fixed arm, which failed 10/10 because of my own regression.

3. **The base revision is not where the brief implied.** Local `main` was 12 commits stale
   (`7a0f220`); `.github/workflows/ci.yml`, which the brief referenced as being on main,
   existed only under `refs/preserve/real-main-cc92735`. I verified strict-ancestor
   (12 ahead / 0 behind) and worked from `cc92735`. The EM has since fast-forwarded
   `refs/heads/main` to `cc92735` himself.

4. **Scratch data** (`.measure/`, probe test, arm trees) was moved out of the deliverable
   tree before committing. Nothing untracked remains; `git status` is clean.

5. **Not pushed.** The EM is the only agent who pushes.

6. **The main working copy's built frontend was never touched.** I did not measure in it,
   did not delete from it, and did not clean it. The `web/dist` I deleted by explicit full
   path was the one in **my own clone**, `/workspace/farmtable-mainred-fix`, not the main
   copy. Per the standing instruction I will not create another built frontend anywhere;
   the throwaway ones under `/tmp/mainred/` die with this container and I am not rebuilding
   them.

7a. **A `web/dist` hazard claim in circulation is an artefact of how it was probed.** The
   standing guidance states that `web/dist` is untracked *and unignored* (`check-ignore`
   exits 1), so producing one creates several thousand untracked, **stageable** files that
   collide with the no-bulk-staging rule. **Measured, both halves are reproducible and they
   mean different things:**

   ```
   tree WITHOUT web/dist:  git check-ignore -v web/dist  -> exit 1   (appears unignored)
   tree WITH    web/dist:  git check-ignore -v web/dist  -> exit 0   .gitignore:17:dist/
   tree WITH    web/dist:  git status --porcelain -uall  -> 0 lines  (4,109 files present)
   ```

   The ignore pattern is `dist/` — **directory-only**. When the path does not exist, git
   cannot know it is a directory, so the pattern cannot match and `check-ignore` exits 1.
   That exit code reports the absence of the directory, not the absence of an ignore rule.

   **Consequence: for a real build, the staging-collision hazard does not exist.** A build
   creates a *directory*; everything under it is ignored; nothing is stageable. The
   prohibition on creating one still stands on its own separate grounds, and I am observing
   it — but it should not be justified by a staging risk that measurement does not support,
   because a false rationale attached to a real rule is what gets the real rule discounted
   later.

   **Bound the claim, though.** The EM has since measured a third arm I did not: `web/dist`
   created as a **regular file** rather than a directory is *not* matched by a
   directory-only pattern — `check-ignore` exits 1 and the file **does** appear in
   `porcelain`, stageable. So the correct statement is "a real build is fully ignored", not
   "`web/dist` can never be stageable." My measurement covers the directory case only.

   **The general lesson is worth more than the specific answer.** This was an instrument
   available only in the state where its answer does not matter, and unavailable in the
   state where it does: the check can be run truthfully only once the thing it warns about
   has already happened. Note also that `.gitignore`'s *content* is settled by
   commit-addressed evidence and is byte-identical here at `cc92735` and at `HEAD` — but
   `check-ignore`'s *answer* is not, and moves three ways over that one identical pattern.
   **Commit-addressed evidence immunises the content of a file, not the behaviour of a
   command that reads it.**

8. **Evidence preserved off-container.** `/tmp` is per-container. 736K of raw measurement
   data — result TSVs, run scripts with their pre-registrations, both vet logs, every
   per-run log, and the 424-byte discriminator diff that *is* the instrument — is at
   `reports/mainred-fix-evidence/`. It is **untracked** there and I staged nothing. The
   492MB of trees and the 21MB `web/dist` were deliberately not preserved.

---

## 8. What is not established

- **The exact `TestListUsers` interleaving** — mechanism measured, specific failing
  sequence derived only. My one prediction about it was refuted (0/10). §3.
- **The natural before/after difference is not statistically significant** (p = 0.23). The
  fix rests on the discriminator, not on this. §4.
- **Flake rates are load-conditional.** Load was recorded but not controlled in the
  natural-rate runs; only the discriminator matched load by construction. §4.
- **The 4 `go vet` findings are reported, not fixed**, deliberately. §6.
- **No clean-checkout full-suite green exists, from me or anyone**, and cannot until EM-100
  is fixed. §7.
- **The probe source is gone.** `zzprobe_test.go`, which measured the two facts under
  Defect 2's mechanism, was deleted before commit and survives nowhere; only its output
  remains in the evidence directory. Re-verifying Defect 2 means rewriting it from the
  description in §3. I should have preserved it. §3, §7.
- **One correction already applied to this report**, rather than silently: the pristine-tree
  vet error was originally attributed to `internal/server/assets.go`. It is the **root**
  `assets.go`, package `farmtable`. The count of four affected packages was right, the
  location was wrong, and the corrected location makes the masking finding stronger. §6.

---

## 9. Files changed

Branch `fix/mainred-watchtasks-race-and-test-isolation` off `cc92735`. Two commits, four
files, +118 / −10. Every path staged by explicit full name; no bulk stage at any point.

| File | Change |
|---|---|
| `internal/server/watch.go` | `stream.SendHeader(nil)` after `Subscribe`, with rationale comment |
| `internal/server/watch_test.go` | `awaitSubscribed` helper; applied to the 7 vulnerable tests |
| `internal/testutil/teststore.go` | Unique DB name per store; `NewTestStorePair` for deliberate sharing |
| `internal/store/multistore_test.go` | `newLazySetup` uses `NewTestStorePair` explicitly |

`gofmt` clean. `go vet` exit 0 on both packages I modified.
