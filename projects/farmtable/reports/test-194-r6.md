# #194 round 6 — TEST REVIEW leg report

**Leg:** `test-194-r6`
**Tree:** branch `label-write-scope-r6` @ `6ced24e53234da12def832c46df1c2be906fc038` (verified with `git rev-parse HEAD`; matched before any work)
**Verdict:** **REQUEST CHANGES** — scoped. No production-code change is required. Every production gate I mutated was caught. The changes I am asking for are in the tests and in the doc comments that overclaim what those tests guarantee.

**Findings by severity:** 1 Medium-High, 3 Medium, 2 Low-Medium/Low, plus 1 partial falsification of the shared brief.

Tree state at handback: `git status` empty, HEAD unchanged, all 7 mutated files sha256-identical to an out-of-repo pristine copy, `go test ./...` EXIT 0. Both probe files I created were deleted.

---

## 0. The gate, re-measured independently

Per charge C-A I established my own build remedy rather than assuming the EM's.

| step | my result |
|---|---|
| `go build ./...` on the clone as handed to me | **EXIT 1**, `assets.go:5:12: pattern all:web/dist: no matching files found` |
| remedy: `make web` (`npm ci && npm run build`, real Vite build) | **EXIT 0** |
| `find web/dist -type f \| wc -l` | **4109** |
| `go build ./...` after | **EXIT 0** |
| `go vet ./...` | **EXIT 1, exactly 4 findings** |
| `go test ./...` | **EXIT 0** |
| `go test ./... -v` | **625 top-level / 1825 result lines** |

**Remedy chosen and why.** I used a real `make web`, not a stub. `web/dist` is genuinely absent (matched by `.gitignore:17`, `dist/`), `npm` 10.8.2 / node v20.20.2 are present, and the build is 3.5s. A stub `web/dist` would also make `go build` pass, but it would make "the branch builds" a claim about a directory I fabricated rather than about the branch. Given that last round's failure mode was three legs reporting a build that had never happened, I wanted the expensive answer. I ran the real build and counted the artifacts.

**Vet, verified BY REQUEST TYPE as instructed** — all four are `assignment copies lock value to ephReq` in `internal/server/server.go`, naming `GetReadyTasksRequest`, `GetBlockedTasksRequest`, `GetCriticalPathRequest`, `GetBottlenecksRequest`. `internal/platform/github/` has **zero**. Had I checked by line number I would have reported four false new findings, exactly as warned.

**No count corruption.** 0 panics, 0 `setup failed`, 0 `FAIL`, and **0 SKIP** across the whole verbose run. The 1825 result lines are all `--- PASS`. Round 5's T-4 lesson (a panic silently truncating every count on the tree) does not apply to any number in this report.

---

## T-6 — Count discipline

**Prediction recorded before measurement**, and derived from a source independent of the EM's runtime number: a static grep of `^func Test` declarations.

- 675 `func Test` declarations tree-wide
- 50 of them in the three `//go:build integration` files (`internal/server/server_postgres_test.go`, `internal/platform/github/integration_test.go`, `internal/store/entstore_postgres_test.go`)
- **P1 = 675 − 50 = 625 top-level tests**

**Measured: 625.** Prediction hit exactly.

I explicitly did **not** predict the 1825 result-line figure — subtest counts are not statically derivable — so that number is a **post-hoc reconciliation** and I am labelling it as such per standing bar #8, not presenting it as a confirmed prediction.

Leg A in isolation: `go test ./internal/platform/github/ -v` → **147 top-level / 526 result lines**. The 526 matches the EM's figure. Static cross-check: 165 `func Test` in that package's test files − 18 in `integration_test.go` = 147, matching the runtime top-level count.

**No discrepancy with the EM's numbers.** Nothing to report loudly here.

---

## T-1 — Mutation-testing the new gates: **PASS, no defects**

Harness bars enforced: content-addressed multi-line anchors with an **abort if the anchor is not unique**; abort if the workspace is not pristine before starting; **a mutant that does not compile is a void run, not a surviving mutant**; exit codes taken from the child (`cmd > log 2>&1; E=$?`), never through a pipe; restoration verified by `sha256sum -c` against an out-of-repo pristine copy at `/tmp/pristine-194r6`, not by `git status`.

Before mutating I confirmed each `-run` selector actually executes tests, so a zero-match selector could not masquerade as a surviving mutant:

- `./internal/server/ -run TestCreateTask_` → 3 top-level / 10 results
- `./internal/store/ -run 'TestLifecycleStages_|TestLabelDeltaLifecycleStages_|TestMultiStore_|TestLifecycleStageHelpers_'` → 37 top-level / 43 results
- `./internal/platform/github/ -run TestLifecycleStageSetStager_` → 3 top-level / 99 results

| # | mutation | compiles | result |
|---|---|---|---|
| M1 | `server.go` CreateTask label gate disabled (`if false && !store.SameStageSet(...)`) | yes | **CAUGHT** — EXIT 1, `TestCreateTask_TerminalStageLabelCostsWhatTheTerminalStageCosts` + 4 subtests (`completed`, `wont_fix`, `duplicate`, `cancelled`) |
| M2 | `store.go` `LifecycleStages` fail-closed reverted to the OLD fail-open substitution | yes | **CAUGHT** — EXIT 1, `TestLifecycleStages_EmptyResultFailsClosed` |
| M3 | `store.go` `LabelDeltaLifecycleStages` fail-closed reverted to `(current, current)` | yes | **CAUGHT** — EXIT 1, `TestLabelDeltaLifecycleStages_EmptySideFailsClosed` (3 subtests) + `TestMultiStore_PropagatesAnEmptyInnerAnswerVerbatim` |

All three restored; sha256 verified.

The rule that fired in each case is the same one: the test asserts the **error identity** (`ErrEmptyLifecycleStageSet`) or the **denial**, against a hand-written expectation, using a fixture (`brokenStageSetStore`, `internal/store/lifecycle_stage_set_test.go:45-63`) that genuinely constructs the contract-violating input. That fixture is the reason M2 and M3 are catchable at all, and it is the single best piece of test engineering added this round.

---

## T-2 — The two seam tripwires: **one is load-bearing, one is not**

Predictions were recorded before each run.

### Tripwire 1 — `TestUpdateTask_TwoLabelsOneStageCollapseIsUngatedToday` (server): **sound, fires correctly**

**E1 (predicted GREEN, measured GREEN).** I removed *only* the `SameStageSet` short-circuit in `UpdateTask` (`server.go:754`). The tripwire stayed green. This **confirms its own docstring's claim** that "removing the short-circuit alone does not help" — with `before == after == [completed]`, the only pair is `(completed, completed)`, and `TransitionScope`'s `from == to` short-circuit (`transitions.go:124`) still returns `task:write`.

**E2 (predicted RED, measured RED).** I removed *both* halves — the `SameStageSet` short-circuit **and** the `from == to` short-circuit. The tripwire fired exactly as designed:

```
--- FAIL: TestUpdateTask_TwoLabelsOneStageCollapseIsUngatedToday (0.01s)
authz_label_set_collapse_seam_test.go:88: SEAM CLOSED — THIS IS GOOD NEWS.
  Removing "ft:stage/completed" from an issue also carrying "ft:completed" was
  denied (rpc error: code = PermissionDenied desc = missing required scope "task:close").
```

This tripwire routes through the real service (`svc.UpdateTask`), so it detects a closure wherever the fix lands. Its three abort-on-vacuous premises (alias still resolves; both labels genuinely present; the set-*changing* removal is still denied) are the right design and each is a `t.Fatalf`, not a soft skip.

### FINDING T-F1 (Medium) — Tripwire 2 cannot detect a gate-level closure, though its docstring says it will

`internal/platform/github/label_stage_collision_test.go:188`, `TestSpellingCollision_IsInvisibleToTheStageSetGate`.

Its docstring states: *"When r7 lands a label-level delta this test goes red, and that is the point: the pin exists so the fix cannot land silently."*

**Measured: it does not.** Under E2 — a genuine closure of the seam, where the identical removal became a `PermissionDenied` — this test **passed green** (EXIT 0). It never touches `server.go` or `transitions.go`; it computes both endpoints itself from `m.AllTerminalLabelStages(...)`.

I did establish it is not *void*. **M6** (positive control): rewriting `AllTerminalLabelStages` to preserve label multiplicity instead of deduplicating into `map[task.Stage]bool` turns it **RED** (EXIT 1). So it has a reachable red state — but only for a fix implemented *inside that one function*.

That is the wrong shape. Seam test #1's own comment describes the r7 fix as *"a delta over LABELS rather than over resolved stages, which is a contract change spanning internal/server and internal/platform/github"* — i.e. new surface, with `AllTerminalLabelStages` (whose `[]task.Stage` return type cannot express two labels for one stage) likely left alone. In that scenario tripwire 2 stays green.

**Consequence for the shared brief:** the claim that the seam is pinned by "two active tests" so it "cannot be closed silently" is **half-supported**. One test guards it. Recommend either re-pointing this test through the gate, or amending its docstring to say what it actually pins (the mapper's dedup behaviour).

### On whether the seam is *worse* than stated

The EM asked to be told loudly if the seam enables **escalation** rather than only label destruction. **It does not.** I traced it: the collapse only ever makes an edit *free* when the resolved stage set is unchanged. Any edit that *adds* a terminal stage the task did not have changes the set and is charged (`any -> terminal` = `task:close`); any edit that removes the last label naming a stage changes the set and is charged. The collapse therefore permits destruction of a *redundant* spelling, never acquisition of a terminal stage. Severity classification is unchanged.

Two respects in which it is worse **in degree**, not in kind:

1. **8 authorized spellings per stage, not 4.** The EM self-corrected this mid-review; I did not take either figure. I derived it from `stripForMatch` (`labels.go:662-679`): after the prefix strip it applies three *sequential* `TrimPrefix` calls in fixed order (`stage/`, `priority/`, `priority:`), so every order-preserving subset normalises to the bare stage name — 2³ = 8. I then brute-forced all 8 through `authorizationStage` and confirmed all 8 authorize, **for every stage**, on stock defaults.
2. **The surviving label need not look like a stage label.** `ft:priority:completed` authorizes as terminal stage `completed` (measured). This is shared-brief KNOWN-OPEN #4, but it interacts with the seam: the label left behind holding the stage in place can read to a human as a *priority annotation*. The seam's stated harm is "the audit trail lost a label and nothing observable moved" — this makes the thing that pins the stage actively misleading, not merely redundant.

---

## T-3 — Fixture expressiveness sweep

I delegated a broad read of the eight new test files, then **re-verified every claim I am reporting by my own measurement or my own reading**. Claims I did not personally verify are quarantined at the end of this section and are explicitly not part of my findings.

### FINDING T-F2 (Medium-High) — a test that provably cannot fail, credited in production doc comments as the structural guarantee

`internal/platform/github/stage_label_swap_scope_test.go:157`, `TestStageLabelSwap_OwnershipMatchesTheAuthorizationReader`.

The test computes its expected value by calling `m.authorizationStage(label)` (:174) and its actual value from `m.StageLabelSwap(...)` (:175). `StageLabelSwap`'s ownership predicate **is** `authorizationStage` (`labels.go:387`). Both sides derive from one call, so they move together. `A == A`.

**Proof by mutation (M8), not by inspection.** I broke `authorizationStage` so it always returns `("", false)`:

- whole package: **EXIT 1, 27 top-level tests failing**
- `TestStageLabelSwap_OwnershipMatchesTheAuthorizationReader`: **EXIT 0, PASS**

The ownership machinery was comprehensively destroyed and the test whose entire stated purpose is to detect reader/writer disagreement about ownership did not notice.

Why this one matters more than an ordinary weak test: the production doc comment at `labels.go:369-371` names it and asserts it *"enumerates both spellings of every stage and fails if the two ever diverge again."* They cannot diverge — the writer calls the reader. And the file header (`:29-36`) credits it with catching a mutant alongside two tests that genuinely would. The round-5 defect it commemorates was precisely "writer and reader used DIFFERENT predicates"; the fix made them the same function, which is correct, and simultaneously made this test unfalsifiable — while the comment kept claiming falsifiability. This is **instance #9** of the branch's defect class.

Its `if checked == 0` guard (:189) also cannot fire: `allStages` is a package-level literal of 10 entries and `checked` is 18.

### FINDING T-F3 (Medium) — a "POSITIVE CONTROL" that controls nothing

`internal/platform/github/empty_stage_set_contract_test.go:124`, `TestLifecycleStageSetStager_EmptySideIsDetectable`, documented at :117-120 as *"the POSITIVE CONTROL for the two tests above, and it is not optional."*

Verified by reading :124-142. Two of its three assertions are Go language guarantees:

```go
var empty []task.Stage
if len(empty) != 0 { t.Fatal("CONTROL BROKEN: ...") }        // len(nil slice) == 0 by spec
if len([]task.Stage{}) != len(empty) { t.Fatal(...) }        // 0 != 0
```

Neither branch is reachable in any conforming Go implementation. The third (`store.IsTerminalStage(task.StageWontFix)`) is a link-time smoke check on a constant. The test exercises **no code from either package under review**.

This matters because of what it is claimed to license. `TestLifecycleStageSetStager_NeverReturnsAnEmptySide` sweeps 3 configs × 8 tasks × 4 deltas = 96 subtests and concludes no input produces an empty side. That conclusion is a claim about a search, and the file correctly says a search needs a demonstration that it can recognise its target — then supplies a demonstration that `len(nil) == 0`. The actual production paths (`passthrough.go:862-867`, `:919-925`) return slice literals of length ≥ 1 on **every** branch, so the sweep's target is unreachable by construction rather than by evidence. The 96 cells sample one branch-free line.

I am not calling the sweep worthless — as a contract pin against a future edit it has value, and M2/M3 show the *store-side* fail-closed path is genuinely covered by a fixture that can express the violation. The finding is narrower: **the stated positive control does not control the stated sweep**, and the honest version of this file would either route the control through a stub store that really returns empty (as `internal/store/lifecycle_stage_set_test.go` does with `brokenStageSetStore`) or drop the claim.

### FINDING T-F4 (Low-Medium) — a post-hoc tally naming a condition it cannot detect

`internal/platform/github/lifecycle_stage_consumers_test.go`, the `winnersSeen` coverage block (~:286-307). Its failure message reads *"Either the precedence order changed or the pair enumeration stopped being total."*

**M9 (measured):** I reversed `terminalStagePrecedence` (`labels.go:58-63`) to `[cancelled, duplicate, wont_fix, completed]`. `TestSingularSinksAreBlindToTheTerminalTiebreak` stayed **GREEN (14 pass, 0 fail)**. Over all ordered pairs of any total order, ranks 0..n−2 each win at least one pair and rank n−1 wins none — true for every permutation, so both the tally and the expectation being read out of the same production slice makes the block invariant under the change it names.

**Mitigating measurement, which lowers this from Medium:** the reversal *is* caught elsewhere — `TestTerminalLabelStage_Cardinality` in the same package fails, and 3 packages fail tree-wide. So there is no uncovered risk. This is a **mis-attributed assertion**, not a coverage hole. Fix the message or fix the check.

### FINDING T-F5 (Low) — `SameStageSet(before, after)` on the same slice header

`internal/store/lifecycle_stage_set_test.go:191` and `:288`. The non-implementer arms return the identical slice for both endpoints — `store.go:186-188` (`current := ...; return current, current, nil`) and `multistore.go:287-288`. `SameStageSet` is an elementwise compare, so `!SameStageSet(before, after)` can never be true. Verified by my own reading of both production sites.

At :288 the second conjunct (`before` against the literal `[]task.Stage{task.StageInReview}`) *is* falsifiable and carries the test; the first conjunct is decoration. Low, because the surrounding test is otherwise sound and this file is the strongest in the change.

### Quarantined — delegated, NOT independently verified by me

A broad sweep also flagged the following. I did **not** verify these myself and I am **not** asserting them; they are recorded so the EM can route them, and they should not be counted as findings from this leg:

- `TestPushPrefix_DefaultIsSpelledOnce` (`push_prefix_resolution_test.go:157-159`) reimplements the one-line body of `matchPrefix`.
- Several rows of `TestPushPrefix_ResolutionIsSharedByReaderAndWriter` are guaranteed by the shared resolver (notably the `custom` row's annotation claiming it "proves the config is read rather than a second hardcoded string").
- `TestComputeReady_IsNotBlindedByAMaskingLabel` (`treewalk_terminal_sink_test.go:79-89`) — the precondition entails the assertion.
- Five fixture self-checks that restate a constructor argument (`lifecycle_stage_consumers_test.go:108`, `:237`; `stage_alias_config_test.go:109`, `:189`; `stage_label_swap_scope_test.go:232`).
- `TestUpdateTask_DoesNotDestroyAThirdPartyTerminalLabel`'s removal control bypasses the GraphQL path it is meant to license.

Note on the `custom`-row claim specifically: I have *counter-evidence* that the underlying property is covered elsewhere — M7 below shows the server-side custom-prefix test does catch a hardcoded prefix — so even if the row's annotation overclaims, the property is not unguarded.

---

## T-4 — The salvaged r5 probes: keeps are sound, one drop reason has expired

`internal/server/audit_r5_probe_test.go`, 4 of 11 kept, 7 dropped with in-file reasons.

**The four keeps are sound and I would keep all four.** Judged against "what input would make this fail, and can the fixture build it":

- `PositiveControl_TheProbeCanObserveAnAllow` — four arms, each a `t.Fatalf`, including the one the round-4 audit lacked (terminal destinations reachable when `task:close` is held). Correctly placed first in reading order.
- `Charge1_RemovalDirection` — 12 cells with a per-cell BASELINE abort *and* a `denied+ungated != 12` coverage abort. Because a subtest `t.Fatalf` only `Goexit`s that subtest, a broken baseline drops the count and the coverage abort fires; there is no silent truncation path. This is the right way to write a matrix.
- `Charge4_FromEqualsToReachability` — hand-written `wantAllowed` literals, plus a `sawAllow/sawDeny` vacuity abort, plus write-effect assertions (close-count, terminal-ness movement) that measure what got *written*, not just who got refused. `labelSetNamesATerminal` deliberately re-spells `"ft:"` rather than calling the resolver, and the comment defending that independence against the combine is correct reasoning.
- `Charge4_REV9PremiseAdversarially` — validates that the close counter can reach 1 before relying on its being 0, then asserts the strictly stronger issue-state property. This is the bar the EM cited and it deserves the billing.

**The seven drops are well-reasoned** and the practice of listing them with reasons rather than deleting silently is exactly right. Drops 4, 5 and 7 (tests that assert nothing / cannot express their input) are clean drops on the branch's own stated standard. Drop 3 is self-evidently correct — it asserts a hole round 6 closed, and it additionally would not compile against B4's two-return `store.LifecycleStages`, which I confirmed by reading the new signature at `store.go:154`.

### FINDING T-F6 (Medium) — drop reason #6 is self-expiring, and its condition has expired

Drop #6, `Charge6_CustomPrefixEndToEnd`, is annotated **"GOOD TEST, WRONG TREE"** and deferred because *"leg A is unifying prefix resolution across reader and writer in this same round... Landing it here means my file would break their change at combine time. RECOMMENDED FOR THE COMBINED TREE."*

**This is the combined tree.** `6ced24e` is the merge of leg A (`5db3937`) and leg B (`089fac7`) — I confirmed the two parents with `git log --format='%H %P'`. The stated blocker is resolved at this SHA, the recommendation was never actioned, and the deferral now reads as permanent by default. That is the mechanism by which a deliberate deferral becomes a silent gap, and it is worth an explicit round-7 item rather than leaving the note to age.

### Partial falsification of shared-brief KNOWN-OPEN #5

The brief states: *"A custom-prefix end-to-end control is NOT landed."*

**That is too strong.** `TestTerminalStageInput_RequiresTheConfiguredPrefix` (`authz_label_write_scope_test.go:2111`) is an end-to-end custom-prefix control in `internal/server`: 7 cells, two at `push_prefix: "acme:"`, driving the real `svc.UpdateTask` and asserting that reopening costs `task:accept` **iff** the prefixed label counted as terminal. It also covers the empty-prefix-means-default case.

I verified it is not decorative. **M7 (predicted RED, measured RED):** hardcoding `matchPrefix()` to return `defaultPushPrefix` — the pre-round-6 bug — turns it **EXIT 1**, failing exactly `custom_prefix_custom_label` and `custom_prefix_default_label`.

So the accurate statement of the gap is narrower than the brief's: **what is missing is the 12-cell label-write (add/remove) matrix at a non-default prefix.** The stage-arm/reopen direction at a custom prefix *is* covered and *is* falsifiable. I would not call the residual gap blocking, given M7, but T-F6 stands as the reason it should be scheduled rather than re-deferred.

---

## T-5 — The flake: characterized, reproduced, and NOT silenced

**Reproduced independently.** `go test -count=200 ./internal/server/ -run TestWatchTasks_CreatedEvent` → 1 failure, with the EM's exact signature:

```
--- FAIL: TestWatchTasks_CreatedEvent (5.01s)
    watch_test.go:153: timed out waiting for event
```

**Rate at scale:** `-count=5000` → **3 failures / 5000 ≈ 0.06%**, unloaded.

**The event is lost, not late.** `recvEvent` waits a full 5 seconds (`watch_test.go:31`). A merely slow delivery would arrive inside that window; consuming the entire timeout means nothing was ever delivered.

**Mechanism, confirmed by reading `watch.go`.** `s.eventBus.Subscribe(filter)` is at **`watch.go:60`**, inside the server handler, behind `RequireIdentity`, `RequireScope`, `validateWatchTasksRequest`, `RequireCollectionAccess` and a `GetCollection` **database read**. The client's `client.WatchTasks(...)` returns as soon as the client-side stream object exists — it does not wait for the handler to reach line 60. A `CreateTask` that publishes inside that window is dropped: nothing buffers and nothing replays.

**Discriminating experiment — including one void run I am disclosing.**

My first attempt was void and I nearly reported from it. I ran a no-sleep arm and a 250ms-settle arm at 300 iterations each; **both returned 0 failures**. My prediction that the no-sleep arm would flake at N=300 was **wrong** — the base rate is ~0.06%, so 300 iterations was far too small. The control never went red, which makes the settle arm's clean result worthless. Reporting "a settle fixes it" from that pair would have been precisely the void-harness pattern: a complete, plausible, non-erroring table proving nothing.

My second attempt was also void, differently: I added 32 CPU busy-loops on a 16-core box to widen the window, and starved the test process into a 10-minute timeout. Discarded.

The run I am reporting from ran both arms at **equal N = 5000**:

| arm | failures / 5000 |
|---|---|
| no settle (identical to the shipped test) | **3** |
| 20ms settle between `WatchTasks` and `CreateTask` | **0** |

I switched the settle from 250ms to 20ms specifically so the arm could be run at the *same* N as the control within budget — 5000 × 250ms exceeds 20 minutes, and comparing a rate against a sample too small to contain the event is not a comparison.

**Strength of this result, stated honestly:** under the null hypothesis that the settle changes nothing, the expected count in the settle arm is 3, and observing 0 has p ≈ e⁻³ ≈ 0.05. That is **evidence at roughly 95%, not proof**. Combined with the code reading — a subscription that provably happens after a DB read, with no buffering — I am confident in the mechanism, but I am not claiming it demonstrated to the standard M1–M3 met.

**The undocumented API precondition this flake is the only detector for:**

> A `WatchTasks` call returning does **not** mean the subscription is active. Events published between the call returning and the server reaching `watch.go:60` are lost, with no gap indication to the client.

**Do not silence it.** Concretely, do not add a sleep, do not extend the 5s timeout, and do not `t.Skip` it. Two constructive options, in preference order:

1. **Document the precondition** on the RPC and note that clients requiring completeness must pass `include_initial`. This is already the correct client pattern and the ordering supports it: `Subscribe` (line 60) precedes `sendInitialSnapshot` (line 65), so an `include_initial` client has no gap. The test does not use it.
2. **Give the handler a readiness signal** so the precondition disappears rather than being documented.

If option 1 is taken, the *right* fix to the test is to make it use `include_initial` and assert the snapshot-then-event ordering — which removes the flake by removing the race, not by hiding it. If the test is changed to use a bare sleep, the precondition loses its only detector.

---

## C-A — Claims in the shared brief I did NOT independently verify

Listing these because, as the brief says, three legs handed the same premises are not independent about any of them.

**Verified myself (did not rely on the brief):** the pre-`make web` build failure and its exact message; `make web` exit 0 and 4109 files; the post-remedy build; `go vet` exit 1 with exactly 4 findings identified **by request type**; zero vet findings in `internal/platform/github/`; `go test ./...` exit 0 with 0 panics and 0 setup failures; 625/1825; leg A's 526 in isolation; that the stage-collapse seam is live on stock defaults with no configuration; that `stripForMatch` strips prefix then `stage/`, `priority/`, `priority:`; that `AllTerminalLabelStages` keys on `map[task.Stage]bool`; that `transitions.go:124` still short-circuits `from == to`; that `ft:priority:completed` authorizes as terminal `completed`; that neither seam test is a `t.Skip` (0 SKIP lines tree-wide); the stale `passthrough.go:54` comment naming `store.LifecycleStagesOf` / `store.LabelDeltaLifecycleStagesOf`, which do not exist (grep confirms); the merge's two parents.

**NOT verified — and where I relied on them:**

1. **`make race` exit 0, and `go test -race ./internal/server/` exit 0 ×3 with 0 data races.** I ran **no** race-detector runs at all. This is the largest hole in my coverage and I am flagging it rather than letting the brief's line stand in for my work. Anything I say about concurrency this round rests on the EM's measurement, not mine.
2. **That the four vet findings are PRE-EXISTING at `ea8ac390`.** I verified they exist at HEAD and match by request type; I did not check out the base to confirm they predate the branch. Relied on for the conclusion "not yours to fix."
3. **"There is no CI."** Not verified. Relied on for the framing that nothing but the review legs runs any of this.
4. **"Eight instances of the defect class."** I did not audit the prior eight. I found what I believe is a ninth (T-F2) independently, but "ninth" inherits the brief's count.
5. **"Five void harnesses in one night."** Not verified; no bearing on my findings (though it correctly shaped my method, and I produced two void runs of my own).
6. **Round 5's T-1 … T-4 history, and that all were addressed.** Not verified.
7. **"The merge was clean — no conflicts"**, and the 31 files / 5102 insertions figure beyond a `git diff --stat` glance.
8. **The audit-probe provenance** (710 lines, 11 tests, sha256 `7e36f5cd…`, commit `0075526`). Not verified. I judged the 4 keeps and the 7 written reasons on their merits, not against the original file.
9. **KNOWN-OPEN #2, the TOCTOU window.** Not independently verified as open; I only confirmed the `CreateTask` comment acknowledges it.
10. **KNOWN-OPEN #5** — **partially falsified**, see T-4.
11. **"Four authorized spellings per stage"** — **falsified** (8). The EM self-corrected mid-review; I derived 8 from `stripForMatch` myself and confirmed by brute force across every stage, taking neither figure on faith.

---

## C-B — The single least-supported claim in this round's work

**Nominated: that the stage-collapse seam is pinned by "two active tests" such that round 7 cannot close it silently.**

This is stated in the shared brief and echoed in `label_stage_collision_test.go:184-187`. Measured, **one** of the two detects a closure. Under E2 — a real closure, where the previously-free destructive removal became `PermissionDenied` — `TestSpellingCollision_IsInvisibleToTheStageSetGate` passed green. It only reddens for a fix implemented inside `AllTerminalLabelStages` (M6), which is not the fix shape the other seam test's own comment describes.

**What would falsify my position:** an r7 change that closes the seam *by making `AllTerminalLabelStages` label-aware* would turn both tests red, and the "two tests" claim would hold. My claim is conditional on the fix landing at the gate/contract level, which is what the round-6 comments say is planned. The cheap way to settle it permanently is to make tripwire 2 route through the gate, after which the claim is true regardless of fix shape.

**Runner-up:** the doc comment at `labels.go:369-371` asserting that `TestStageLabelSwap_OwnershipMatchesTheAuthorizationReader` "fails if the two ever diverge again." Falsified outright by M8 — I broke `authorizationStage` completely, 27 tests in the package went red, and that test stayed green.

---

## Recommended round-7 items

| id | severity | item |
|---|---|---|
| T-F2 | Medium-High | Fix or delete `TestStageLabelSwap_OwnershipMatchesTheAuthorizationReader`; correct the `labels.go:369-371` comment that credits it with a guarantee it cannot provide. To be real it must assert ownership against **hand-written literals**, not against `authorizationStage`. |
| T-F1 | Medium | Re-point `TestSpellingCollision_IsInvisibleToTheStageSetGate` through the gate, or amend its docstring. As written it will not fire when r7 closes the seam. |
| T-F3 | Medium | Replace `TestLifecycleStageSetStager_EmptySideIsDetectable` with a control that routes a genuinely-empty return through the production path (the `brokenStageSetStore` pattern), or drop the "POSITIVE CONTROL" claim. |
| T-F6 | Medium | Land `Charge6_CustomPrefixEndToEnd` (the 12-cell label-write matrix at a non-default prefix). Its deferral condition expired at this merge. |
| T-5 | Medium | Document the `WatchTasks` subscribe-after-return precondition, or add a readiness signal. **Do not silence the test.** |
| T-F4 | Low-Med | Fix the `winnersSeen` block's failure message or its check; it cannot detect the precedence change it names (though the change is caught elsewhere). |
| T-F5 | Low | `SameStageSet(before, after)` on an identical slice header at `lifecycle_stage_set_test.go:191`, `:288`. |
| — | Low | Stale line references inside the seam test's own documentation: it cites `terminal_label_stages.go:120` (actually :176) and `labels.go:542` (actually :662). On a branch where the EM had to warn against line-number verification, comments should cite symbols. |

---

## Method notes / disclosures

- **Two void runs of my own, both disclosed above** (T-5): a settle comparison at N=300 where the control never fired, and a CPU-load run that starved the test into a timeout. Neither contributed a number to this report.
- **One prediction I got wrong:** that the no-sleep flake arm would reproduce at N=300. It did not; the rate is ~0.06%.
- **Predictions I recorded before measuring and hit:** 625 top-level tests (static derivation); E1 green; E2 red on tripwire 1 and green on tripwire 2; M7 red; 8 authorized spellings per stage.
- **Not covered by me:** the race detector (see C-A #1); the `internal/store` Ent-native paths beyond the lifecycle helpers; anything under `-tags integration` (50 tests, no Postgres available).
- All mutations content-addressed with uniqueness assertions; all restorations sha256-verified against `/tmp/pristine-194r6`; final tree state confirmed identical to `6ced24e` with `go test ./...` EXIT 0.
