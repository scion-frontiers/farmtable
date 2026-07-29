# #194 round 5 — code review (leg 1 of 3)

**VERDICT: REQUEST CHANGES**

**Target:** `label-write-scope` @ `ea8ac390dad3d2401d65608684e5d6623ab15ac5` (verified
`git rev-parse HEAD`; tree clean before and after).

The three controls (B1, B5, B6) are **correctly implemented**. I found no bypass, no
regression, and no security defect in the code. Every blocking finding below is about a
**claim** — a comment or a log-table row that states a property more broadly than it
holds — plus the one missing test that would have caught it. That is precisely the
workstream's signature defect, and it is why I am not waving these through as nits.

## Severity summary

| Severity | Count | Findings |
| --- | --- | --- |
| Critical | 0 | — |
| High | 0 | — |
| Medium | 3 | F1, F2, F3 (all blocking) |
| Low | 2 | F4, F5 |
| Info | 3 | F6, F7, F8 |

## Gate — reproduced independently, agrees with the EM's

```
GO_BUILD_EXIT=0     (after stubbing web/dist/index.html)
GO_VET_EXIT=1       exactly 4 pre-existing copies-lock findings, no others:
                    server.go:1601, :1711, :1919, :2096
GO_TEST_EXIT=0      every package ok
MAKE_RACE_EXIT=0    go test -race ./internal/platform/github/  ok
```

I confirmed the four vet findings are the known ones **by request type**
(`GetReadyTasks` / `GetBlockedTasks` / `GetCriticalPath` / `GetBottlenecks`), not by line
number. **Agree with the EM's gate in full.**

### Controls are load-bearing (mutation, BY EXECUTION)

Each mutation was content-addressed with an abort-if-not-unique anchor, and the tree was
restored and sha256-verified against `git show HEAD:<path>` after each.

| Mutation | Effect | Result |
| --- | --- | --- |
| MUT-B1: `SameStageSet` → always true | disables the label-write gate | **6 server tests fail** |
| MUT-B5: `AllTerminalLabelStages` → `out[:1]` | collapses the set | **2 server tests fail** |
| MUT-B6: drop the prefix requirement in `authorizationStage` | reverts B6 | **4 server + 3 github tests fail** |

No mutation was a no-op; each changed observable behaviour before the tests caught it
(standing bar #6).

---

## F1 — Medium, BLOCKING. The `TerminalLabelStage` doc claim is false as written, and the reasoning that makes the code safe is load-bearing and unstated

**`internal/platform/github/labels.go:527-531`** (added this round):

> "Callers on a privilege path use `AllTerminalLabelStages` instead; the remaining
> single-answer sinks are sequenced separately (#194 round 5)."

**Checked against every actual caller, not against intent.** `TerminalLabelStage` has
exactly **one** production caller — `GitHubPassThroughStore.LifecycleStage`
(`passthrough.go:784`) — which in turn has exactly two:

| Call site | Path | Uses `AllTerminalLabelStages`? |
| --- | --- | --- |
| `passthrough.go:612` → `issueUnavailableForClaim` (`:671`) | **the claim gate** | No |
| `passthrough.go:974` → `ComputeAvailability` | **the availability gate** | No |

Both are privilege paths. They are, by name, two of the three gates that
`labels.go:490-492` says the round-3 bug reopened ("the same root cause reopened the
availability and claim gates"). So the first clause is not a near-miss; it is false about
the only two callers there are.

**The code is nonetheless correct, and I verified it.** Both consumers are identity-blind
over `TerminalLabelStage`'s all-terminal codomain:

- `issueUnavailableForClaim`: `lifecycleStage != task.StageAccepted` — no terminal stage
  is `accepted`, so any winner yields the same answer.
- `ComputeAvailability`: `store.IsTerminalStage(s.LifecycleStage(...))` — true for every
  winner.

**BY EXECUTION.** I reversed `terminalStagePrecedence` and drove two terminal labels
through both sinks. The tiebreak winner genuinely moved, and both answers held:

```
default   [completed wont_fix]  winner="completed"  claim=refused available=false [terminal]
reversed  [completed wont_fix]  winner="wont_fix"   claim=refused available=false [terminal]
default   [cancelled duplicate] winner="duplicate"  claim=refused available=false [terminal]
reversed  [cancelled duplicate] winner="cancelled"  claim=refused available=false [terminal]
```

**So: is the reasoning written down anywhere?** No. I read `LifecycleStage`'s doc
(`passthrough.go:772-783`), `ComputeAvailability`'s arm comment (`:950-974`) and
`issueUnavailableForClaim` (`:671`). None of them records it. Worse, the surrounding prose
argues the *opposite* direction — `LifecycleStages`' doc (`:795-805`) says the collapse
"is what let a `task:write` holder convert a maintainer's `wont_fix` into `completed`" —
without noting that the two consumers still doing it are unaffected.

The invariant has two silent preconditions, neither pinned:

1. `TerminalLabelStage`'s codomain is entirely terminal.
2. Every `LifecycleStage` consumer collapses all terminal stages to a single boolean.

Add one consumer that branches on *which* terminal stage — entirely natural, e.g. showing
a different denial reason for `wont_fix` vs `duplicate` — and B5's invariant is violated
at a gate, with no test failing.

**Fix (all three):**
1. Correct the sentence. Something like: *"Two callers remain on this singular answer —
   `ClaimTask` and `ComputeAvailability`, both via `LifecycleStage`. That is safe only
   because each reduces every terminal stage to one boolean, so the tiebreak cannot change
   their answer. A consumer that branches on which terminal stage must use
   `AllTerminalLabelStages`."*
2. Put that invariance argument on `LifecycleStage` (`passthrough.go:783`), where the
   consumers are, not only on the producer.
3. Pin it with a test — see F3.

## F2 — Medium, BLOCKING. The log's "Sinks covered" row conflates B5 with B6

**`.design/project-log/close-label-swap-r5-label-write-scope.md:109-111`:**

> "**Sinks covered** — the two gates inside `UpdateTask` (`server.go`), and, through
> `store.LifecycleStage(s)`, the readers that already consumed round 4's seam:
> `ComputeAvailability` and `ClaimTask`."

The `(s)` makes one token stand for two different functions and hides exactly the gap in
F1. Ground truth:

| Control | `UpdateTask` gates | `ComputeAvailability` | `ClaimTask` |
| --- | --- | --- | --- |
| B1 (label write gate) | yes | n/a | n/a |
| B5 (set-valued source) | yes | **no** — still the singular collapse | **no** |
| B6 (prefix required) | yes | yes | yes |

B6 does reach both readers, because `TerminalLabelStage` now calls `authorizationStage`.
B5 does not. A reader of this table concludes the round's set-valued control covers the
claim and availability gates. It does not, and it does not need to (F1) — but the table
should say which control reached where.

**Fix:** split the row per control, and state that `ClaimTask` / `ComputeAvailability`
retain the single-valued read deliberately, with the invariance reason from F1.

## F3 — Medium, BLOCKING. No test exercises the two singular sinks with two terminal labels

This is the gap that let F1's unstated invariant go unrecorded, and I caught it only
because my own first probe was wrong — see Disclosures.

`TestUpdateTask_ReAssertingATerminalStageOnAMultiTerminalTaskRequiresClose`
(`authz_label_write_scope_test.go:1642`) is the **only** multi-terminal end-to-end cell in
the branch, and it sits at the `UpdateTask` gate. Nothing drives a two-terminal-label task
through `ClaimTask` or `ComputeAvailability`. Standing bar #5: the fixtures for those
sinks cannot express the input that would falsify F1's invariant.

**Fix:** add the probe below (it passes today; it fails the moment a consumer starts
branching on the winner). I wrote and ran it during review, then deleted it — it is yours
to land, not mine.

```go
func TestSingularSinksAreBlindToTheTerminalTiebreak(t *testing.T) {
	for _, labels := range [][]string{
		{"ft:stage/completed", "ft:stage/wont_fix"},
		{"ft:stage/cancelled", "ft:stage/duplicate"},
	} {
		ctx := context.Background()
		fake := newFakeIssueRepo(t, labels...)
		s := fake.store()

		// ClaimTask and ComputeAvailability must refuse whichever stage the
		// tiebreak selects; both reduce every terminal stage to one boolean.
		if _, err := s.ClaimTask(ctx, s.issueUUID(1), uuid.New(), ""); err == nil {
			t.Errorf("labels=%v: ClaimTask succeeded, want refusal", labels)
		}
		tk := &ent.Task{ID: uuid.New(), Stage: task.StageAccepted, Labels: labels}
		avail, err := s.ComputeAvailability(ctx, tk)
		if err != nil {
			t.Fatalf("labels=%v: %v", labels, err)
		}
		if avail.Available {
			t.Errorf("labels=%v: available=true, want false", labels)
		}
	}
}
```

## F4 — Low. `(#194 round 5)` tags round-6 work

`labels.go:531`. The parenthetical follows "the remaining single-answer sinks are
sequenced separately", and those sinks are sequenced to **round 6**. The codebase does use
`(#194 round N)` as provenance elsewhere (`passthrough.go:834`, `store.go:83`), so the
glyph is ambiguous rather than simply wrong — but placed directly after "sequenced
separately" it reads as the target. **Fix:** `sequenced separately (#194 round 6)`, or move
the provenance tag away from the sequencing clause.

## F5 — Low / Consider. The push-prefix default still has three copies

`matchPrefix` (`terminal_label_stages.go:62`), `NewLabelMapper` (`labels.go:125`), and
`StageToLabel` (`labels.go:262`) each carry their own `"" → "ft:"` defaulting.

`matchPrefix`'s comment claims non-drift, and **as scoped it is accurate** — it says
`authorizationStage` and `stripForMatch` must not drift, and those two genuinely share it.
I am not filing the comment as false. But `authorizationStage`'s own justification
(`terminal_label_stages.go:41-45`) reasons from what `StageToLabel` *writes*, and
`StageToLabel` keeps a private copy of the constant that argument depends on.

I checked the failure direction before assigning severity: drift between the copies fails
**closed** in both directions (Farm Table's own labels stop being honoured — a
denial-of-work bug, not an escalation). That is why this is not blocking. **Fix:** route
all three through one helper so the security parameter has one definition.

---

## Charge-by-charge answers

### Charge 2 — one coherent change, or three? **Keeping them together was the right call.**

The 3092-insertion figure is misleading. Measured production delta, excluding comments and
blank lines:

| File | added | comment/blank | **code** |
| --- | --- | --- | --- |
| `labels.go` | 18 | 16 | **2** |
| `passthrough.go` | 145 | 91 | **54** |
| `terminal_label_stages.go` | 129 | 89 | **40** |
| `server.go` | 88 | 66 | **22** |
| `multistore.go` | 26 | 8 | **18** |
| `store.go` | 91 | 58 | **33** |
| | | | **169 total** |

The remaining 2923 lines are tests (2098), the log entry (300), and comments (328). 169
lines of production code across six files is comfortably one reviewable change.

The coupling is real, not incidental, and splitting would have cost correctness:

- **B5 forced a rework of B1**, which the developer disclosed (log:279-282): B1 originally
  compared two single stages, so B1's own gate depended on the tiebreak B5 forbids. Handing
  B5 to round 6 would have shipped a B1 that violates the invariant round 6 then lands,
  and reopened B1's gate to fix it.
- **B5 and B6 share `authorizationStage`**, which feeds both `TerminalLabelStage` and
  `AllTerminalLabelStages`. Splitting means the whole-set scan lands prefix-tolerant and
  then gets narrowed — the same 12 cells flip answer twice, across two releases.

**This is not a finding about your sequencing.** The reviewability friction is real but
its source is the 2023-line single test file, not the three controls. The useful remedy is
splitting `authz_label_write_scope_test.go` by control (B1 / B5 / B6 / harness), which is
a non-blocking cleanup, not a re-scoping of the round.

### Charge 3 — the two fenced files. **Both edits were within what was authorized; collision risk with round 6 is low.**

**`labels.go`.** Two surgical edits: the scan predicate (`:524`) and `stripForMatch`
sharing `matchPrefix` (`:542-552`). I independently confirmed the fail-open tiebreak loop
(`:527-535`) and `terminalStagePrecedence` (`:57-61`) are byte-identical to base. The
`stripForMatch` change is a **pure refactor** — old `strings.ToLower(cfg.PushPrefix)` with
`"" → "ft:"` and new `matchPrefix()` resolve identically, including case. Reading the
fence as covering the fail-open loop was reasonable: B6 could not be implemented anywhere
else, since the prefix requirement must sit on the predicate the loop consumes.

Round-6 collision assessment:
- **Net assist, not collision:** round 6 must make `hasExternalUnavailableLabel`
  (`treewalk.go:153-164`) stop hardcoding `"ft:"`. Round 5 created `matchPrefix()`, which
  is exactly the helper that fix needs.
- **No semantic conflict:** round 6's fix to the fail-open loop only strengthens the
  "any terminal ⇒ some terminal" property F1's two sinks rely on.
- **Residual, textual only:** round 6 will likely rewrite `TerminalLabelStage`'s doc block,
  which round 5 grew by 12 lines. Expect a rebase conflict in the comment, not in logic.

**`authz_terminal_reopen_test.go`.** Addendum 3 explicitly ordered this test inverted, and
the old test's own failure message said "you are probably implementing that ruling — update
it rather than working around it." Squarely authorized. Round 6 has no stated work in this
file.

Both edits were disclosed unprompted with reasons (log:284-291). That is the behaviour the
standing bars ask for.

### Charge 4 — the new seam. **Fallback is correct; a store cannot implement one half.**

The one-element wrap at `store.go:139` / `multistore.go:256` is correct for native Ent: the
stage lives in its own column, no label can forge it, and "a label edit induces no stage
transition" is the true answer rather than a stub. The doc says exactly this and is
accurate.

**"Can a store implement one interface and not the other and get a silently wrong answer?"**
No — `LifecycleStageSetStager` bundles both methods, so a partial implementation fails the
type assertion and falls back wholesale rather than half-and-half. Both implementers
(`GitHubPassThroughStore`, `MultiStore`) provide all three methods. Verified by
enumeration, not assumption.

Two residual risks, neither blocking:

- **F6 — Info.** There is no compile-time assertion. `passthrough.go:48` asserts
  `var _ store.Store = (*GitHubPassThroughStore)(nil)` but nothing asserts
  `LifecycleStageSetStager`. A future label-backed store that implements only
  `LifecycleStager` silently gets the one-element wrap, and B1 and B5 are inert for it with
  no compile error and no failing test. **Recommend** adding
  `var _ store.LifecycleStageSetStager = (*GitHubPassThroughStore)(nil)` — one line, and
  it is the only store that must have it.
- **F7 — Info / Consider.** `LabelDeltaLifecycleStages` (`store.go:154`,
  `multistore.go:265`) requires `len(b) > 0 && len(a) > 0` and otherwise falls back to
  `current, current` — i.e. "no transition", which charges nothing. For an implementation
  that returned one empty side, that is fail-**open**. The interface doc says "never
  empty" but nothing enforces it, and today's sole implementer cannot return empty
  (`lifecycleStagesForLabels` always yields ≥1). Low likelihood; worth an explicit
  either-both-or-neither guard if a second implementer ever appears.

### Charge 5 — the two inverted tests. **Coverage preserved, and strengthened. No cell vanished.**

**`reopen_test.go`.** The bare `duplicate` row left the table and became
`TestPassThroughClaimTask_BareStockLabelIsNotATerminalSignal`, asserting the opposite on
*the same input* ("Exactly the state the old row used"). It **gained** an assertion the old
row did not have — `fake.hasLabel("ft:stage/working")`, so a claim that succeeds vacuously
without stamping is caught. The remaining table is now all-prefixed and is explicitly the
positive control for the inversion.

**`authz_terminal_reopen_test.go`.** `..._IsHonouredToday` → `..._IsNoLongerHonoured` keeps
the same fixture and inverts the assertion, and adds the load-bearing half the original
lacked: a **prefixed** positive control whose failure message is "CONTROL BROKEN: … this
says the terminal scan is dead". That is the exact vacuity the old test could not
distinguish. The harness's "CANNOT express" block (`:329-332`) was updated to point at the
new name rather than left stale.

Both are non-vacuous **BY EXECUTION**: MUT-B6 fails
`TestUpdateTask_UnprefixedTerminalLabelIsNoLongerHonoured` and
`TestPassThroughClaimTask_BareStockLabelIsNotATerminalSignal` among others.

### Charge 6 — empty-prefix semantics. **Consistent across every reader and writer. The ruling is right.**

All four `PushPrefix` sites, checked individually:

| Site | Role | `""` resolves to |
| --- | --- | --- |
| `config.go:81` | shipped default | `"ft:"` |
| `labels.go:125` (`NewLabelMapper`) | **writer** — builds `stageToLabel` | `"ft:"` |
| `labels.go:262` (`StageToLabel`) | **writer** — push label | `"ft:"` |
| `terminal_label_stages.go:62` (`matchPrefix`) | **reader** — `authorizationStage` + `stripForMatch` | `"ft:"` |

No site treats empty as "no prefix required". The writers use the raw configured value
while `matchPrefix` lowercases it, but that cannot desynchronise them because
`authorizationStage` lowercases the incoming label before `HasPrefix` — so
`push_prefix: "FT:"` writes `FT:stage/completed` and still reads as terminal. Checked.

Pinned by two dedicated cells in `TestTerminalStageInput_RequiresTheConfiguredPrefix`:
`empty_prefix_default_label` (terminal) and `empty_prefix_bare_label` (not terminal). Each
cell asserts across all three sinks — lifecycle stage, availability, and the reopen scope —
so the consistency is measured, not assumed. The `custom_prefix_default_label` cell
(`acme:` configured, `ft:stage/completed` **not** terminal) is what distinguishes a real
config read from a second hardcoded string; it is the right cell to have picked.

The developer's reasoning is sound: an empty config meaning "no prefix required" would make
the deployment that writes our own labels the one that also honours everyone else's, which
is backwards. F5 above is the only residual, and it fails closed.

### Charge 7 — `applyLabelDelta` over-prediction. **Verified fail-closed. It cannot deny legitimate work in any way that matters.**

**The order claim checks out.** `applyLabelDelta`'s comment says remove wins over add,
"matching the order `UpdateTask` applies them in (adds first, then removes)". Confirmed at
`passthrough.go:468-484`: `p.AddLabels` at `:468-476`, then `p.RemoveLabels` at `:477-484`.
Had the real order been the reverse, a label in both lists would survive on the issue while
the model predicted it gone — an **under**-prediction, i.e. a bypass. It is not.

**Over-prediction is the only direction, and it fails closed.** A label absent from the
repository is dropped by `labelNamesToIDs` (`:185-193`) but modelled as added, so the
caller is charged for a transition that will not occur. The denied request is one that
*expresses* terminal intent from a caller lacking the scope, so no legitimate work is lost.
The one real cost: `UpdateTask` denies wholesale, so an unrelated field edit bundled into
the same request is denied too. Narrow, and on the correct side.

**I searched for the under-prediction direction and could not construct one.** The only
source of a terminal label appearing in reality but not in the model is `StageLabelSwap`,
which is driven by `p.Stage` — and the stage arm charges `any → terminal` as `task:close`
independently. I hand-checked the composed stage+label cases, including the one that looks
most likely to slip (`Stage=wont_fix` restamp *plus* `remove_labels=[ft:stage/wont_fix]`):
the stage arm short-circuits on `from == to`, but the label arm computes
`{wont_fix} → {accepted}` and charges `task:accept`. Closed.

This is REASONED, not BY EXECUTION — see Limitations.

---

## Positive feedback

Genuine, and specific:

- **`TestTerminalStageInput_RequiresTheConfiguredPrefix`** is the best test in the branch.
  Every row carries a `why`, it has a BASELINE assertion that fails if the fixture lost the
  label (so "not terminal" can never be a fixture artefact), and it asserts across all
  three sinks rather than at the seam. The `acme:` + `ft:stage/completed` cell is the one
  that proves the config is actually read.
- **`TestUpdateTask_StockLabelBesideATerminalLabelIsDeniedButNotByB5`** attributes each
  denial to the control that actually produced it, and carries a control proving the first
  row is not denied for B5's reason. Refusing to claim a code path that does not execute is
  exactly right, and it is the discipline that F1 and F2 are missing elsewhere.
- **The B1 "before"/"after" single-seam decision** (log:271-278) is a better design than
  the brief's sketch. Sourcing "before" from round 4's `LifecycleStage` would have mixed a
  `t.Stage` fallback with a hypothetical label set and produced spurious transitions —
  which at this gate are denial-of-work bugs.
  `TestLifecycleStageForLabels_AgreesWithLifecycleStageOnTheTasksOwnLabels` pins the two
  readings against each other rather than asserting they agree.
- **F7 measured rather than inherited**, and reported unfixed. **`CreateTask` disclosed and
  pinned** as current behaviour rather than quietly left. **Both fence departures disclosed
  unprompted with reasons.** Costly disclosure is the trust signal, and this round supplies
  it repeatedly.
- **`AllTerminalLabelStages` deliberately not inheriting the fail-open** — deciding
  membership by `store.IsTerminalStage` rather than presence in `terminalStagePrecedence`,
  and saying so in the doc — is the right call. It means round 6's fix to that loop cannot
  regress this function.

## Test coverage

New paths are well covered; 19 new test functions plus two inversions. The three mutations
above confirm the suite is non-vacuous for all three controls. Gaps:

- **F3 (blocking):** no multi-terminal cell at `ClaimTask` / `ComputeAvailability`.
- **Cardinality 3–4 end to end.** Covered at the unit level only
  (`TestAllTerminalLabelStages_...` has an `all_four_masked_by_a_non_terminal_label` row).
  The log states this limitation accurately (log:137) — disclosed, not hidden. Not blocking.
- **`applyLabelDelta` order.** The adds-then-removes dependency is load-bearing for
  correctness but pinned only by the comment. A cell with the same label in both
  `add_labels` and `remove_labels` would pin it. Non-blocking; recommend.

## Backward compatibility

No wire-format change: no proto edits, no field removals, no new required fields. The
`LifecycleStageSetStager` interface is additive and optional — stores that do not implement
it are answered from `LifecycleStage`, so no existing store breaks.

**Behavioural change, already ruled and accepted:** the 12 cells where a task carrying only
a stock label now reads as live/available (B6), and the raised scope for label writes that
move the lifecycle stage (B1). Callers holding only `task:write` that previously moved a
stage via `add_labels`/`remove_labels` will now be denied. That is the point of the change,
but it is a caller-visible break worth a release note.

## Methodology, disclosures, limitations

**Method.** Read both briefs before the code; read tests before implementation; enumerated
every caller of `TerminalLabelStage` and every reader of `PushPrefix` by grep rather than
by assumption; reproduced the gate; ran three content-addressed mutations plus one
tiebreak-reversal probe.

**Costly disclosure — my first probe was wrong.** My initial charge-1 evidence was "reverse
`terminalStagePrecedence`, and the whole `internal/server` suite still passes." I was about
to report that as proof the singular sinks are order-invariant. It proves nothing: I then
checked and found **no test anywhere drives two terminal labels through `ClaimTask` or
`ComputeAvailability`**, so the probe was vacuous at exactly the sinks it was meant to
cover (standing bar #2). I rewrote it as a direct probe that constructs the two-label input
itself, and confirmed the winner actually moves under reversal before trusting the result
(standing bar #6). That vacuity *is* F3.

**A second self-correction.** My first attempt at the reversal mutation used the four
stage constants as the anchor. It **aborted — anchor not unique**: the identical sequence
appears in `stagePrecedence`'s terminal tail. Had I used a line-addressed edit I would have
silently mutated the display precedence and drawn a wrong conclusion. Standing bar #4
earned its keep; I re-anchored on the full `var terminalStagePrecedence = ...` declaration.

**Cleanliness verified by sha256, not `git status`** (standing bar #3). After every
mutation I restored from an out-of-repo pristine copy in my own salvage directory and
compared `sha256sum <path>` against `git show HEAD:<path> | sha256sum`. Final state: all
four touched files **MATCH**, `git status --short` empty, full suite green. My throwaway
probe file (`zz_reviewprobe_test.go`) was deleted; its content is reproduced in F3 for you
to land deliberately.

**What I did NOT establish:**
- **Charge 7 is REASONED, not BY EXECUTION.** I verified the add/remove ordering by reading
  `passthrough.go:468-484`, and reasoned through the composed stage+label cases by hand. I
  did not build a fixture exercising a repository missing a label, so I have not
  *measured* the over-prediction; I have only confirmed its direction and the ordering
  claim it rests on. The developer's "2 of 3 probed spellings live, third over-predicts" I
  have **not** independently reproduced.
- **F1's invariance is established for today's two consumers only.** I did not prove no
  third consumer of `LifecycleStage` exists outside `internal/platform/github` — I proved
  it by grep across the repo, which would miss a caller reaching it through an interface
  value under a different name.
- **No integration run.** `go test -tags integration` needs live Postgres; not available.
  The GitHub paths are exercised against `fakeIssueRepo` only, so every claim about GitHub's
  real case-folding and label-resolution behaviour is inherited from the developer's
  comments, not verified against the API.
- **Deliberately out of scope, not re-filed:** the fourth sink (`treewalk.go`),
  `hasExternalUnavailableLabel`, the fail-open tiebreak loop, enum drift, the audit-trail
  gap, `CreateTask`, F7, and the 12 newly-denied cells. I found none of them materially
  worse than recorded. I did confirm the fail-open loop is untouched, independently of the
  EM's verification.

**Independence.** I read no other leg's report or working files, and wrote only to my own
salvage directory. I encountered no file whose header discussed this round's findings. I
copied no prior-round harness. One environment note: my leg brief gave the host path
`/workspace/farmtable-review-194`, which does not exist in my container; the EM confirmed
mid-review that `/workspace` is the mount of that clone. I verified the SHA and a clean
tree before starting, which is the check that matters. Nothing about this compromised
independence.

---

## Final verdict

**REQUEST CHANGES.**

To be unambiguous about what this does and does not mean: **the implementation is correct.**
B1, B5 and B6 do what they claim, they are load-bearing under mutation, the seam is sound,
the fence departures were authorized, the test inversions preserved coverage and improved
it, empty-prefix semantics are consistent, and the delta over-prediction fails closed. I
tried to break all three controls and could not.

The three blocking findings are two false-scope claims (F1, F2) and the missing test that
would have caught them (F3). I am not labelling them Nit. The brief's charge 1 says this
workstream's signature defect is *a property that holds for one consumer stated as if it
held for all*, and F1 is a clean instance of it: a comment asserting that privilege-path
callers use the set-valued function, when both actual privilege-path callers do not, and
where the argument that makes that safe is real, load-bearing, and written nowhere. Round 4
shipped two false comments. Filing these as nits is how a third one ships.

All three fixes are mechanical — two comment corrections, one log-table row, and a test I
have already written and handed over. I would expect them inside an hour, and I do not
need to see the branch again if the EM confirms them.
