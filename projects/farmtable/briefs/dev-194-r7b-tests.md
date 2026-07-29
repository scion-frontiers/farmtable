# Brief — dev-194-r7b: tests that cannot fail, and a production comment that lies

## Provenance of every claim in this brief

Every factual claim below is tagged **[MEASURED]** (someone ran it) or **[CLAIM]**
(believed, not verified). Verify any **[CLAIM]** your work depends on. Telling me a
claim in this brief is wrong is a deliverable, not a distraction — in round 6 I put an
unverified premise into three briefs and two legs echoed it back as verified.

## Context

- Your tree: `/workspace/farmtable-194-r7b`, branch `label-write-scope-r7b`, based on
  `6ced24e53234da12def832c46df1c2be906fc038` (the verified #194 round-6 combined tree).
- These findings come from `test-194-r6`, which reached them **by mutation, not by
  inspection**. Two other independent legs read the same code and did not find them.
  That is the standard you are working to: a claim about what a test detects is only
  worth what a mutation says it is worth.

## The defect class you are fixing

This whole issue exists to fight one bug shape:

> **A check that derives from the thing it is checking cannot falsify it.**

It has now appeared nine times on this workstream. Your work item 1 is instance #9 —
and it is the first one that a production comment advertises as a guarantee.

## File ownership — STRICT

A parallel leg (`dev-194-r7a`) is changing production authorization code at the same
time. **You own exactly these files and nothing else:**

```
internal/platform/github/stage_label_swap_scope_test.go
internal/platform/github/empty_stage_set_contract_test.go
internal/platform/github/lifecycle_stage_consumers_test.go
internal/store/lifecycle_stage_set_test.go
internal/platform/github/labels.go          <-- COMMENT TEXT ONLY, no code
```

Do NOT touch `internal/server/**`, `internal/platform/github/passthrough.go`,
`internal/platform/github/resolver.go`, `cmd/**`, or
`internal/platform/github/label_stage_collision_test.go`. If you think you need a
change outside your list, stop and message me. **No production logic changes in this
leg at all** — if a fix seems to require one, that is a finding to report, not a change
to make.

## Work item 1 — T-F2 [Medium-High]. The self-confirming ownership test. BLOCKING.

**[MEASURED by test-194-r6 via mutation M8]**

In `internal/platform/github/stage_label_swap_scope_test.go`, the test
`TestStageLabelSwap_OwnershipMatchesTheAuthorizationReader` computes its EXPECTED value
from `m.authorizationStage(label)` and its ACTUAL value from `m.StageLabelSwap(...)`.
But `StageLabelSwap`'s ownership predicate **is** `authorizationStage` (in `labels.go`).
The test asks a function to agree with itself.

The measurement: M8 broke `authorizationStage` to always return `("", false)`.
**27 top-level tests went RED. This test stayed GREEN, exit 0.**

Why this is blocking even though it is "just a test": the production doc comment in
`labels.go` (content anchor — locate by this text, the line number in the source report
was wrong: `spellings of every stage and fails if the two ever diverge again`) cites
this test and asserts it "enumerates both spellings of every stage and fails if the two
ever diverge again." **They cannot diverge — the writer calls the reader.** A false
guarantee in production code is worse than no guarantee, because the next maintainer
budgets against it.

**[MEASURED]** The `if checked == 0` guard in that test also cannot fire: there are 10
literals and `checked` reaches 18.

**Acceptance criteria:**
- Rewrite the test to derive EXPECTED from a source independent of the mapper — a
  hand-written literal table of stage → both spellings, maintained deliberately. If a
  new stage is added and the table is not updated, the test must fail. Say in your
  report how you achieved that.
- Re-run mutation M8 (`authorizationStage` returns `("", false)`) and confirm the
  rewritten test now goes **RED**. Report the before/after. Without this the rewrite is
  unverified.
- Fix or delete the `labels.go` comment so it describes what the test actually
  guarantees. Comment text only — do not change code in that file.
- Make the `checked == 0` guard meaningful or remove it. A guard that cannot fire is
  decoration.

## Work item 2 — T-F3 [Medium]. A positive control that controls nothing.

**[MEASURED by test-194-r6]** In
`internal/platform/github/empty_stage_set_contract_test.go`, the test
`TestLifecycleStageSetStager_EmptySideIsDetectable` is documented as "the POSITIVE
CONTROL... not optional". It asserts `len(nil) != 0` and `0 != 0`. Those are Go
language guarantees. **It exercises no code from either package.**

It also licenses a 96-cell sweep whose target is **unreachable by construction**:
**[CLAIM — verify before acting]** the relevant branches in `passthrough.go` are said
to return slice literals of length >= 1 on every path, so the empty-stage-set case the
sweep is checking for cannot occur. Verify that claim yourself by reading
`passthrough.go` (read only — you do not own that file).

**Acceptance criteria:** either make the control call real code from the package it
claims to control, or delete it and drop the "positive control" claim from the
docstring and from the sweep's justification. Both are acceptable. If the 96-cell sweep
is genuinely unreachable, say so explicitly in your report and recommend keep-or-delete
with a reason — do not quietly leave it.

## Work item 3 — T-F4 [Low-Med]. A mis-attributed assertion.

**[MEASURED by test-194-r6 via mutation M9]** In
`internal/platform/github/lifecycle_stage_consumers_test.go`, the `winnersSeen`
assertion block stayed GREEN when M9 reversed `terminalStagePrecedence` in `labels.go`.

**This is not a coverage hole** — the condition IS caught elsewhere, by
`TestTerminalLabelStage_Cardinality`. It is a mis-attributed assertion: the block claims
to be pinning precedence and does not. Fix the attribution (comment and/or assertion)
so it says what it does. Do not add redundant coverage.

## Work item 4 — T-F5 [Low]. Comparing a thing to itself.

**[MEASURED by test-194-r6]** In `internal/store/lifecycle_stage_set_test.go`, two call
sites pass the same slice header as both `before` and `after` to
`SameStageSet(before, after)`, because the helper they use returns `(current, current,
nil)`. Construct genuinely distinct inputs or drop the assertions.

## Standing bars (non-negotiable)

- **Every fix in this brief must be verified by mutation.** You are fixing tests that
  cannot fail; a rewrite that also cannot fail is a net loss. For each item, state the
  mutation, and the test's status before and after. No mutation, no credit.
- **Positive control before any negative claim.** A mutation harness that has never
  reported RED is worth nothing — prove it can.
- **A harness must ABORT on a failed prerequisite.** Ten void harnesses on this
  workstream have printed clean, confident, wrong numbers. Every single one looked fine.
- **Exit codes from the child process, never through a pipe.** `go test ./... | tail`
  gives you `tail`'s status. This exact mistake has been made twice here.
- **Edit by content anchor, never line number.** The line refs in the source report have
  already drifted once (it said `labels.go:369-371`; the text is at 361). If an anchor
  is not unique, abort and tell me.
- **[MEASURED] `go build ./...` fails on a fresh clone** — run `make web` first
  (~4109 files); `assets.go` embeds gitignored `web/dist`.
- **[MEASURED] `go test ./...` is not reliably EXIT 0.** Known flake at 3-in-5000
  (~0.06%) in the WatchTasks subscribe path. Re-run before assuming you caused it. Do
  NOT attempt to fix or silence that flake — it is tracked separately as task #23.
- Predict counts BEFORE measuring. Write the prediction down first, then measure.
- Costly disclosure is the trust signal. Name what you could not verify rather than
  reasoning past it.

## Deliverables — all four required

1. Test changes committed to `label-write-scope-r7b` in `/workspace/farmtable-194-r7b`.
   **Do not push. Do not merge. I do that.**
2. A report at
   `/scion-volumes/scratchpad/projects/farmtable/reports/dev-194-r7b.md` with a
   per-item **mutation table**: item, mutation applied, test status before, test status
   after. Plus an explicit **LIMITS** section naming what you did not verify.
3. A project log entry in `.design/project-log/`, committed.
4. Tell me if any **[CLAIM]** in this brief is wrong.

You MUST write the report file, write the project log entry, commit, and then mark the
task complete. Do not stop after the analysis.
