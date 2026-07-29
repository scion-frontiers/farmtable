# #194 round 6 (`label-write-scope-r6` @ 6ced24e) — CODE REVIEW leg

Reviewer: `review-194-r6`. Charge: correctness, readability, architecture.
Tree verified: `git rev-parse HEAD` = `6ced24e53234da12def832c46df1c2be906fc038`. Match.

## Executive Summary

This change closes several genuine fail-open paths (the empty-stage-set fallback,
the hardcoded-prefix hold reader, the ungated creation-time label, the
prefix-tolerant delete in `StageLabelSwap`), removes three duplicated copies of
the push-prefix rule, and replaces two runtime interface assertions that failed
open with compile-time ones. The production delta is small and disciplined —
**591 insertions across 8 files, of which 400 are comment lines**, so roughly
**191 lines of executable change** — and it is carried by 3,716 lines of new
tests. Risk level: **LOW**.

Verdict: **APPROVE**, with recommendations. No Critical, no Required.

This approval explicitly does **not** bless the known-open stage-collapse seam;
see "The seam" below, where I answer the EM's escalation question with evidence.

---

## What I independently verified (and how)

I ran the **real** `make web` — not a stub. `npm`/`node` are present in this
container and the vite build completed, so every build number below is from a
genuine asset tree, not a placeholder.

| Measurement | Result | Note |
|---|---|---|
| `go build ./...` before `make web` | **EXIT 1**, `assets.go:5:12: pattern all:web/dist: no matching files found` | see disclosure D1 |
| `make web` | **EXIT 0**, **4109** files in `web/dist` | real build |
| `go build ./...` after `make web` | **EXIT 0** | |
| `go vet ./...` | **EXIT 1**, exactly **4** findings | all `copies lock value to ephReq` |
| vet findings by **request type** | `GetReadyTasks`, `GetBlockedTasks`, `GetCriticalPath`, `GetBottlenecks` | matched by type, never by line |
| vet findings in `internal/platform/github/` | **0** | so any there would be new |
| vet at **base** `ea8ac390` (separate worktree) | **EXIT 1, 4 findings, same 4 types, 0 in github** | positive control, see below |
| `go test ./...` | **EXIT 0**, panics 0, setup-failed 0 | |
| `go test ./... -v` | **625** top-level / **1825** result lines, **0 skipped**, **0 failed** | |
| `make race` scope | `go test -race ./internal/platform/github/` only | brief's scoping claim confirmed |
| `go test -race ./internal/server/` | **EXIT 0**, **0** data races | I ran this once, not 3× |
| Delta size | 31 files, 5102 insertions, 218 deletions | matches |

**Positive control on the "pre-existing vet findings" claim.** Rather than take
"pre-existing" on faith, I created a `git worktree` at base `ea8ac390`, copied
the built `web/dist` into it, and ran vet there. **I recorded the prediction
before measuring**: 4 findings, same four request types, 0 in `platform/github`.
That is exactly what came back. The four are genuinely pre-existing and are not
this round's to fix.

**Restoration verified content-addressed.** After removing my probe files I
compared sha256 of all 466 tracked files against their `HEAD` blobs:
**0 mismatches** (see disclosure D2 for the harness bug this initially surfaced).

---

## Answers to the targeted charges

### R-1 — free functions that can fail, interface methods that cannot

**The split is coherent, and I verified the chokepoint rather than assuming it.**

I enumerated every non-test call site. Every production consumer of the
lifecycle stage set goes through the validating free function:

```
internal/server/server.go:165  store.LabelDeltaLifecycleStages(...)
internal/server/server.go:627  store.LifecycleStages(...)
internal/server/server.go:749  store.LabelDeltaLifecycleStages(...)
```

The only direct calls to the 2-valued interface methods are the two *inside* the
free functions and the two *inside* `MultiStore`, which is a router whose result
flows back up into the free function. There is no production path that consumes
an implementer's raw answer. So "only the free function turns an empty set into
an error" is true but not exploitable: the free function is the only door.

This is the ordinary validate-at-the-boundary pattern, and leg B's choice to
leave the interface 2-valued so leg A compiled untouched is a reasonable
merge-sequencing decision, not a relocation of the problem. `MultiStore` no
longer carries a second copy of the fallback rule, which was the actual defect —
two copies of a fail-open rule that could drift. There is now one rule and it
denies.

**Residual (Optional, O1):** the chokepoint is held by convention, not by the
type system. Nothing stops a future caller writing `s.store.LifecycleStages(ctx, t)`
directly and getting the unvalidated answer, which is precisely the silent
fail-open this round removed. The move: rename the interface methods to mark
them raw (`LifecycleStagesUnchecked` / `LabelDeltaLifecycleStagesUnchecked`), so
the validated free function is the only spelling that reads as correct at a call
site. Cheap, and it converts a convention into something a reviewer can see.

### R-2 — `CreateTask`'s gate shape, and the nil `ClosedAt`

**The single-`from` shape is correct. The nil `ClosedAt` is real but conservative
— it cannot under-charge.** I traced this rather than reasoning from the comment.

`lifecycleStagesForLabels` never reads the synthetic task's `Stage` field on the
pass-through path; it reads `ClosedAt` and `RemoteData`. With `ClosedAt` nil and
no labels, `before` resolves through `IssueToPhaseStage("open", "", nil)`, which
returns **`StageAccepted`** — a non-terminal stage, always. So:

- `before` is effectively the constant `{accepted}` regardless of the requested
  creation stage.
- Any label naming a terminal stage puts a terminal value in `after`.
- A terminal `after` therefore **always** differs from a non-terminal `before`,
  so `SameStageSet` can never short-circuit the security-critical case.

Modelling the issue as open makes `before` *more* likely to differ from `after`,
i.e. it makes the gate fire *more* often. It is fail-safe in the direction that
matters; the cost is a possible spurious denial, not a bypass.

On the charge itself: `from = stage` (the authorized creation stage) rather than
`from ∈ before`. I checked whether that is ever weaker than the cross product.
Using `stage` gives `task:write` only when `stage == to`, and reaching a terminal
`stage` requires the `req.Stage` arm above to have already charged
`TransitionScope(triage, stage)` = `task:close`. I confirmed the transition
matrix by execution: every non-terminal→terminal and terminal→terminal cell is
`task:close`; only `from == to` is `task:write`. So there is no cell where the
single-`from` shape is weaker *and* unpaid. The comment's argument holds.

**Residual (Optional, O2):** `&ent.Task{Stage: stage, CollectionID: collID}` sets
`Stage` in a way that looks load-bearing but is **inert on the pass-through path**
— the only path where this block does anything. It matters only for the Ent path,
where `before == after` by construction anyway. A reader reasonably infers that
`before` is anchored to `stage`; it is not. Either drop the field with a comment
saying why, or note explicitly that `before` is the constant open/label-less
resolution. This is a comprehension trap in exactly the code that most needs to
be re-derivable.

### R-3 — `Validate` rejecting configs that used to load

**Rejection is the right call, and the error message is good enough to act on.**
I agree with your ruling.

The message names both offending keys, the normalised form they collide to, both
values, the reason the collision now exists (`#194` normalisation), and the
remedy ("Spell the intended alias once"). An operator can act on it without
reading the source. That is above the bar.

Rejection over warning is correct because the alternative is a **coin flip at an
authorization gate** — the log entry records 500 mappers from one unchanged
config resolving `ft:shipped` as `completed` 60 times and `wont_fix` 440 times.
A warning that is ignored leaves a nondeterministic privilege decision live.
Refusing to start is the only answer that cannot be ignored.

The blast radius is also narrower than "a config that loaded yesterday refuses to
load today" suggests: `github.LoadConfig` has exactly one production caller,
`internal/cli/connect.go:292`. This fails a CLI `connect` invocation loudly at
setup time, not a running server mid-flight. That materially lowers the cost of
the strict choice.

Note the check is correctly ordered *after* the `push_prefix` check, since
normalisation depends on the prefix — and empty `push_prefix` is correctly
**not** an error, since `DefaultConfig` relies on the field being unset.

### R-4 — sorted-key iteration as a determinism backstop

**It earns its place, but only because it is the second line of defence, not the
fix.** Your instinct is the right general one — sorted iteration usually hides a
real problem — and it does not apply here, for a reason the code states
explicitly and correctly:

> "Sorting makes the winner reproducible. It does NOT make it right — the
> operator still did not choose it — which is why Validate rejects the config
> outright and this is only the backstop for mappers built without going through
> LoadConfig."

That is the distinction that makes the pattern acceptable. The real problem
(two operator-distinct keys silently becoming one) is fixed by rejecting the
config; the sort only ensures that a mapper constructed *outside* `LoadConfig`
— which `Validate` cannot reach — degrades reproducibly instead of randomly. A
reproducible wrong answer is debuggable; a 60/440 split is not. If the sort were
the *only* mitigation I would call it a smell; paired with a hard rejection it is
defence in depth.

**Residual (FYI, O4):** the backstop exists precisely because programmatic
config construction bypasses `Validate`. That gap is acknowledged in the comment
but not closed. Worth a follow-up considering whether `NewPassThroughStore`
should validate, so the two construction paths agree.

### R-5 — the deliberate prefix asymmetry

**The warning is right. Do not "make it consistent."**

The asymmetry is justified by a monotonicity argument that actually holds:
`authorizationStage` answers "may this label GRANT?" and must refuse anything a
third party can apply; `hasExternalUnavailableLabel` answers "does anyone want
this held back?" and can only ever **withhold**. Honouring one more spelling on a
withhold-only predicate cannot escalate anything — the worst case is that work is
held back that need not have been, which is the recoverable direction.

The round-6 fix is also the right shape. The old behaviour was genuinely
backwards: under `push_prefix: "acme:"`, the operator's own `acme:blocked` was
ignored while `ft:blocked` — a namespace that deployment does not own — was
honoured. Keeping the default prefix *alongside* the configured one is correct
for the stated reason: dropping it would silently remove a hold some issue is
relying on, and that is the one direction where being wrong costs an operator
work they meant to withhold.

Both prefixes come from named sources (`m.matchPrefix()`, `defaultPushPrefix`),
so this is not a fourth copy of the literal that F5 collapsed. The nil-receiver
handling is real and correctly falls back to the default. Good.

### R-6 — the `computeReady` fix, and other non-display consumers

**The withhold-shaped fix is correct and complete for `computeReady`.** The guard
is placed before both appending arms, so it covers the `includeUnblocked` path
too. Using `AllTerminalLabelStages` (prefix-gated) rather than `node.Stage` (the
display collapse) makes the walk agree with `ComputeAvailability`, which reaches
the same prefix-gated predicate via `LifecycleStage` — I checked, and the claim
of agreement is accurate.

I enumerated the other consumers:

- `MapLabelsToStage` — `treewalk.go:36,53` (tree build) and `labels.go:514,546`
  (inside `IssueToPhaseStage`, display). No other gate reads it.
- `TerminalLabelStage` (single-answer) — one production caller,
  `passthrough.go:840` (`LifecycleStage`), reaching exactly two consumers:
  `issueUnavailableForClaim` and `ComputeAvailability`. Both collapse every
  terminal stage to one boolean, so the tiebreak is unobservable — and this is
  enforced by `TestLifecycleStageConsumers_MustCollapseEveryTerminalStageToOneAnswer`
  rather than merely documented. That is the right treatment for a precondition
  with no type-system support.
- `AllTerminalLabelStages` (set-valued) — `passthrough.go:863,921`,
  `treewalk.go:112`.

**One gap (Optional, O3):** `computeBlocked` did *not* receive the terminal
withhold that `computeReady` did. A terminal-labelled issue can still surface in
the blocked list. This is a reporting inconsistency rather than a privilege
issue — `computeBlocked` schedules nothing — but the two walks now disagree about
whether a completed task is worth listing, which is the same class of split the
A7 fix set out to remove. Cheap to close symmetrically.

### R-7 — the two new project log entries, checked against the code

I checked the factual assertions, not the prose. **Everything I checked was
accurate**, including the fragile parts:

| Claim | Verified |
|---|---|
| `transitions.go:124` short-circuits `from == to` | correct line, correct code |
| `terminal_label_stages.go:176` builds `present := make(map[task.Stage]bool, …)` | correct line, correct code |
| stale round-3 comment at `reopen_test.go:336` | present as described |
| all 9 named tests exist | all 9 found |
| `LifecycleStage` has one production caller, two consumers, both privilege paths | confirmed by enumeration |
| terminal→terminal costs `task:close`, `from==to` costs `task:write` | confirmed by execution |
| every stage has 4 authorized spellings under `DefaultConfig()` | confirmed for `completed` |

Notably, the round-6 log **corrects** a false round-5 claim rather than
inheriting it — the old comment asserted "callers on a privilege path use
`AllTerminalLabelStages` instead", which was untrue, and the new text says so
explicitly and names both actual consumers. That is the behaviour I want to see
from a log entry, and it is the opposite of what round 5 did.

I found **no false factual claim** in either new entry.

---

## The seam (known-open #1) — the EM's escalation question, answered

You asked to be told loudly if the stage-collapse seam enables **escalation**
rather than only label destruction. I built a probe to find out.

**Positive control first.** Before making any negative claim I confirmed the
harness can see an authorization answer move: an unlabelled open issue reports
`Available=true`; a `ft:stage/completed` issue reports `Available=false,
Reasons=[terminal]`. The instrument moves.

**Prediction, recorded before measuring:** every same-stage collapse removal is
permitted, none changes availability or lifecycle stage — destruction only — and
the chained second removal is denied.

**Result — prediction confirmed exactly**, across all four terminal stages:

```
stage=completed  permitted=true  stage completed->completed  available false->false  labels_after=[ft:completed]
stage=wont_fix   permitted=true  stage wont_fix ->wont_fix   available false->false  labels_after=[ft:wont_fix]
stage=duplicate  permitted=true  stage duplicate->duplicate  available false->false  labels_after=[ft:duplicate]
stage=cancelled  permitted=true  stage cancelled->cancelled  available false->false  labels_after=[ft:cancelled]

chained: step1=free  step2_permitted=false  final_available=false   (all four stages)
```

**Conclusion: the seam is destruction-only. It is NOT an escalation, and it is
not worse than you stated.** The mechanism is self-limiting: the quantity the
gate compares (the resolved stage set) is exactly the quantity that would have to
move for a privilege change, so any write that would escalate necessarily changes
the set and is charged. The second removal — which *would* de-terminalise the
task — is correctly denied at `task:accept`.

**Bounding my own claim (this is narrower than "no escalation exists"):** I tested
2 spellings × 4 terminal stages under `DefaultConfig()`. I did **not** test the
`ft:priority/…` and `ft:priority:…` spellings (known-open #4), non-default
`push_prefix`, or config-supplied aliases. A collapse pair drawn from those could
in principle behave differently, and I have not shown otherwise.

Both characterization tests are active, neither is `t.Skip`, and both currently
**pass** — i.e. the seam is still open, as intended. `go test -v` reports
**0 skipped** across the whole tree, so nothing is hiding behind a skip.

---

## Critical

None.

## Required

None.

## Nit / Optional

- **O1 (Consider) — the validated chokepoint is convention-only.** Nothing
  type-enforces that callers use `store.LifecycleStages` rather than the raw
  2-valued interface method. **Move:** rename the interface methods to
  `…Unchecked` so the unvalidated path is self-evidently wrong at a call site.
- **O2 (Consider) — `CreateTask`'s synthetic `Stage: stage` is inert on the
  pass-through path.** `before` is the constant `{accepted}`, not a value
  anchored to `stage`. Not a bug; a comprehension trap in security-sensitive
  code. **Move:** drop the field or state the constant explicitly.
- **O3 (Consider) — `computeBlocked` lacks `computeReady`'s terminal withhold.**
  A terminal-labelled issue can still appear in the blocked list. Reporting-only,
  no privilege impact. **Move:** apply the same `AllTerminalLabelStages` guard.
- **O4 (Optional) — `Validate` is bypassed by programmatic config construction.**
  Acknowledged in-comment as the reason the sort backstop exists. **Move:**
  consider validating in `NewPassThroughStore` so both paths agree.
- **N1 (Nit) — known-open #6 confirmed still present:** the stale comment at
  `passthrough.go:54` names `store.LifecycleStagesOf` /
  `store.LabelDeltaLifecycleStagesOf`, which do not exist. Reported only as
  confirmation, not as a new finding.

## FYI

- **`labels(first: 20)` is now a security parameter.** Both the top-level and
  sub-issue GraphQL selections cap labels at 20 (I checked — they match, so the
  `treewalk.go:63-64` overwrite of `node.Labels` by sub-issue data is *not*
  lossy; see disclosure D4). But an issue with >20 labels can have a terminal
  label truncated out of view, and the round-5/6 gates now make authorization
  decisions from that truncated set. The line is **pre-existing and outside the
  diff**; what is new is the diff's dependency on it. The failure direction is
  "work wrongly shown as available", consistent with the documented 12-cell
  trade, so I am not raising it above FYI — but it deserves an issue.
- **Comment density.** 400 of 591 production insertions are comments. I judge
  this a net positive on this workstream specifically, given the history of
  claims that outlived their code — and the round-6 comments correct round-5's
  false ones rather than repeating them. Flagging only so the ratio is a
  conscious choice rather than drift.

## Positive Feedback

Specific, not manufactured:

- **`TestSingularSinksAreBlindToTheTerminalTiebreak_PositiveControl`** — the
  developers wrote their own positive control without being made to. Given this
  workstream's void-harness history, that is the single most encouraging thing in
  the diff.
- **The collapse characterization test** (`authz_label_set_collapse_seam_test.go`)
  is unusually well built: three aborting premises, and PREMISE 3 is a genuine
  positive control proving the set-*changing* case is still gated, so the test
  cannot pass vacuously if label removal ever becomes ungated generally.
- **`empty_stage_set_contract_test.go`** is a real cross-leg contract test —
  3 configs × 8 label shapes × 4 deltas — and its header says it verified leg B's
  behaviour "against their actual code rather than a description of it." That is
  the exact discipline this round was asking for.
- **Replacing two runtime interface assertions with compile-time ones.** The
  reasoning ("a dynamic assertion whose miss is indistinguishable from *this store
  opted out* is not a check") is correct and is the highest
  value-per-line change in the diff — two lines that convert a silent
  everywhere-at-once fail-open into a build error at the site that caused it.
- **`StageLabelSwap`'s ownership fix** names the right principle: we were
  destroying precisely the labels we had decided we were not entitled to trust.
  The cost is stated rather than buried, and the direction is provably safe
  (it can only ever delete fewer labels).

## Test Coverage

Strong, and the tests are the majority of the change (3,716 of 5,102 insertions).
Every new production path I traced has a corresponding test, and the tests are
behavioural rather than implementation-shaped. 625 top-level tests, 1825 results,
0 failures, **0 skips**. The two characterization tests correctly assert the
*defective* behaviour so round 7 cannot close the seam silently.

Gap, consistent with known-open #5: there is still no custom-prefix end-to-end
matrix. `push_prefix` is now unambiguously a security parameter, and the coverage
it has is unit-level (`push_prefix_resolution_test.go`,
`external_unavailable_prefix_test.go`, and a `custom_prefix` config in the
contract test) rather than a gate-level proof at a non-default prefix. **I do not
consider its absence blocking for this merge** — the prefix resolution is now
single-sourced through `resolvePushPrefix`, which removes the drift that made the
matrix urgent — but it should land in round 7 and not be deferred a third time.

## Backward Compatibility

- **`store.LifecycleStages` and `store.LabelDeltaLifecycleStages` changed
  signature** (added `error`). Package-internal free functions; all three
  production call sites updated. No wire-format impact.
- **Interface methods unchanged**, deliberately — external implementers compile
  untouched. This is the merge-sequencing decision R-1 asks about and it is
  sound.
- **`Validate` is a new startup-time rejection.** A config with colliding alias
  keys naming different values that loaded yesterday will refuse today. This is
  intentional, the blast radius is one CLI call site, and the diagnostic is
  actionable. Worth a release note.
- No proto changes, no removed fields, no new required fields.

## Final Verdict

**APPROVE** — with O1–O4 and N1 forwarded as a cleanup pass, and the
custom-prefix matrix (known-open #5) tracked for round 7.

---

## C-A — brief claims I did not independently verify

Verified independently (listed in the table above): the SHA; the pre-`make web`
build failure and its exact error; `make web` exit and the 4109 file count; the
post-`make web` build; the vet exit, count, and the four request types; zero vet
findings in `platform/github`; that the four are pre-existing (base worktree,
prediction first); the test exit, panic and setup-failure counts; the 625/1825
counts; the `make race` scoping; `-race` on `internal/server`; the 31/5102/218
delta; that both characterization tests are active and not skipped; and
known-open #1 (by probe) and #6 (by inspection).

**Relied on without verifying:**

1. **"The merge was clean — no conflicts."** I did not replay the merge of the
   two legs. I reviewed the merged result only. If the merge silently dropped a
   hunk from either leg, I would not have seen it. *This is the one I would most
   want a second pair of eyes on*, because it is the only claim where being wrong
   produces missing code rather than wrong code, and missing code is invisible to
   the review I performed.
2. **Known-open #2 (TOCTOU window not closed).** Taken as stated. I confirmed no
   code in the diff *claims* it is closed, but I did not attempt to exercise the
   window.
3. **Known-open #4 (`ft:priority:completed` authorizes as terminal `completed`).**
   Taken as stated; not probed. My seam probe deliberately did not use these
   spellings, so my escalation finding does not cover them.
4. **Known-open #5 (custom-prefix matrix not landed).** I confirmed no such
   matrix exists in the diff, but did not verify the round-5 audit probes contain
   the deferred 12 cells.
5. **Known-open #3 (A5 benign not closed).** I verified `transitions.go:124`
   still short-circuits; I did not re-derive the benignity argument end to end.
6. **All historical/process claims** — "eight instances of the defect class",
   "five void harnesses in one night", "round 5's review reported `GO_BUILD_EXIT=0`
   against a stubbed `web/dist`", the "500 mappers / 60 vs 440" measurement, and
   the round-5 F1–F7 disposition. These are unfalsifiable from this tree. I relied
   on them for *prioritisation* — they are why I built a positive control and
   predicted before measuring — but **no technical finding or severity in this
   report rests on any of them**.

The gate numbers in this report are all first-hand, from a real `make web`. On
charge C-A's specific worry: had your build claim been wrong, my measurement
would have contradicted it, because I measured before reading your number for
comparison and I chased the one contradiction I did find (D2) rather than
explaining it away.

## C-B — least supported claim in this round's work

**The claim: that the two consumers of the single-answer `LifecycleStage` are
safe because "NEITHER CONSUMER BRANCHES ON WHICH TERMINAL STAGE IT IS."**

This is the load-bearing safety argument for keeping a tiebreak on a privilege
path, and it is the least supported claim in the round — not because it is
wrong (I checked both consumers and it is currently true), but because **it is a
claim about the future that is enforced by a test whose own coverage is defined
by the same enum the code uses.**
`TestLifecycleStageConsumers_MustCollapseEveryTerminalStageToOneAnswer` drives
both consumers with each terminal stage *from the enum* and fails if any two
answers differ. That is genuinely good. But it is a check over the set of
consumers that exist **today**: nothing makes a *newly added* third consumer
appear in it. The comment says a new discriminating consumer would reopen B5
"with nothing failing" — and the test does not change that, because the test does
not know the new consumer exists. It is close to this branch's named defect
class: a check whose scope derives from the thing it is checking.

**What would falsify it:** add a consumer of
`GitHubPassThroughStore.LifecycleStage` that branches on *which* terminal stage
it received — the natural example the comment itself gives, a distinct denial
reason for `wont_fix` versus `duplicate` — and run the suite. My prediction is
that **everything stays green** while an authorization answer has become
dependent on `terminalStagePrecedence`'s ordering. If that is what happens, the
enforcement is weaker than the comment claims and the real fix is structural:
make the single-answer reader unexported or otherwise unreachable from new code,
so that reaching for it is a compile error rather than a code-review catch.

I did not run this experiment — it requires adding a consumer, which is a
production-code change I am barred from making. I am naming it as the falsifier
rather than claiming the result.

---

## Costly disclosures — dead ends, voided measurements, and where I was wrong

**D1. My first build measurement was confounded and I nearly reported it.** My
initial `go build ./...` returned exit 1, which matched the brief exactly. But
the log was full of `go: downloading …` lines — the module cache was cold, so
exit 1 could have been a network failure rather than the embed. Reporting that
run as corroboration would have been a non-fact of exactly the shape charge C-A
exists to catch. I re-read the log tail, found the actual
`assets.go:5:12: pattern all:web/dist: no matching files found`, and only then
counted it.

**D2. My restoration harness produced two false mismatches.** The sha256 sweep
reported `CLAUDE.md` and `GEMINI.md` as modified, contradicting a clean
`git status` and an empty `git diff HEAD`. I chased the contradiction rather than
trusting the friendlier number. Both are **symlinks to `agents.md`**:
`git show HEAD:<f>` returns the 9-byte link target while `sha256sum` follows the
link and hashes the 3410-byte file. My harness was wrong, not the tree. I fixed
it to compare `readlink` output for symlinks and re-ran: **0 mismatches across
466 files.**

**D3. An exit code I took through a pipe, and discarded.** Very early I wrote
`ls web/dist 2>&1 | head -3; echo "EXIT_LS=$?"` and got `EXIT_LS=0` for a
directory that does not exist — `$?` was `head`'s status. I caught it, discarded
the value, and wrote every subsequent harness with `cmd > log 2>&1; E=$?`.
Standing bar 3 is there for a reason and I tripped it within my first three
commands.

**D4. Two hypotheses I formed and falsified.** Both would have been findings had
I stopped at the plausible-sounding stage:
  - I suspected `TransitionScope("completed", "wont_fix")` was `task:write`,
    which would have made `CreateTask`'s single-`from` shape a real hole. I
    executed the matrix: it is `task:close`. **Wrong.**
  - I suspected `treewalk.go:63-64` (`existing.Labels = child.Labels`) could drop
    a terminal label and defeat the new A7 withhold, if the sub-issue GraphQL
    selection fetched fewer labels than the top-level one. I read
    `graphql_queries.go`: both are `labels(first: 20)`. Not lossy. **Wrong.**

**D5. Scope I did not cover.** I ran `-race` on `internal/server` **once**, not
three times as the brief did, so I have less evidence than the brief for the
absence of a flaky race. I did not review the 3,716 lines of new tests
line-by-line — I read the tests bearing on my charges (the collapse seam, the
empty-set contract, the consumer preconditions) and spot-checked names and
premises elsewhere. I did not exercise the TOCTOU window. My seam probe covered
2 spellings × 4 terminal stages at the default prefix and nothing else.

**D6. A narrower true claim.** I can say: *under `DefaultConfig()`, for the four
terminal stages and the canonical/alias spelling pair, the collapse seam permits
label destruction and does not move any authorization answer I can observe.* I
cannot say *the seam is not an escalation* in general, and I have not written
that anywhere above without the bound attached.
