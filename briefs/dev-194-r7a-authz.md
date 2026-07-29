# Brief — dev-194-r7a: close the live label-write authorization bypass

## Provenance of every claim in this brief

Read this section first. In round 6 I put an unverified claim ("two active tests pin
the seam") into three review briefs and two of the three legs echoed it back to me as
verified. It was false. So: below, every factual claim is tagged either **[MEASURED]**
(I or a reviewer ran something) or **[CLAIM]** (believed, not verified). You are
required to verify any **[CLAIM]** that your fix depends on, and to tell me if one is
wrong. Finding my brief wrong is a deliverable, not a distraction.

## Context

- Your tree: `/workspace/farmtable-194-r7a`, branch `label-write-scope-r7a`, based on
  `6ced24e53234da12def832c46df1c2be906fc038` (the verified #194 round-6 combined tree).
- **[MEASURED]** That base is merge-verified: legs A and B touched disjoint file sets
  and every blob in the merge is byte-identical to its owning leg. You are not
  inheriting a bad merge.
- **[MEASURED — and this is the clock]** The bypass described in A-4 below is **live in
  production right now**, on a real actively-used collection. Production serves
  revision `farmtable-00067-ckt`, running code at or essentially at current `main`.
  Round 6 closes the common-case version of this. Your job is to close what round 6
  left open. **Do not gold-plate. A tight, correct fix that ships is worth more than a
  comprehensive one that slips.**

## File ownership — STRICT

A parallel leg (`dev-194-r7b`) is editing tests at the same time. To keep the merge
disjoint, **you own** everything you need EXCEPT these five files, which you must not
touch for any reason:

```
internal/platform/github/stage_label_swap_scope_test.go
internal/platform/github/empty_stage_set_contract_test.go
internal/platform/github/lifecycle_stage_consumers_test.go
internal/platform/github/label_stage_collision_test.go
internal/store/lifecycle_stage_set_test.go
```

Also **do not touch `internal/platform/github/labels.go`** — leg B owns a doc comment
in it. If you believe you need a change in `labels.go`, stop and message me instead of
making it. That is exactly the cross-leg seam that bit us in round 6.

`internal/server/authz_label_write_scope_test.go` is YOURS.

## Work item 1 — A-4 [HIGH, live in prod]. Free retryable label-destruction primitive.

**[MEASURED by audit-194-r6, and I independently re-confirmed both anchors]**

Three facts compose into the bypass:

1. The gate (`internal/server/server.go`, anchor: the block beginning
   `if len(req.GetAddLabels()) > 0 || len(req.GetRemoveLabels()) > 0 {` that calls
   `store.LabelDeltaLifecycleStages` and then `store.SameStageSet(before, after)`)
   compares lifecycle stage SETS derived from a snapshot `existing`. Removing a label
   that is ABSENT from that snapshot yields `before == after`, so `SameStageSet` is
   true and **no scope is charged at all**. Audit measured this 4/4 with a positive
   control.
2. The write (`internal/platform/github/passthrough.go`, anchor:
   `if len(p.RemoveLabels) > 0 {` → `removeIDs := s.labelNamesToIDs(p.RemoveLabels)` →
   `_ = s.gql.removeLabels(ctx, issueID, removeIDs)`) is **unconditional and blind**.
   `labelNamesToIDs` resolves against a repo-wide label index, not against the labels
   actually on this issue, and the error is discarded into `_`.
3. **`p.Version` is never consulted on this path.** Audit verified this by reading
   `passthrough.go` lines 409-610.

Composed: a caller holding only `task:write` issues
`UpdateTask(task, remove_labels=["ft:stage/wont_fix"])` in a loop. Each call is free at
the gate because the label is absent at snapshot time. The moment another actor adds
that label, the next iteration's blind write deletes it — a privileged state change
achieved with an unprivileged scope, retryable indefinitely at no cost.

**Audit's disclosed limit, which you must close:** they measured the authorization half
directly, but the write half is **code-reading only**. Before you fix it, prove the
composition end-to-end with a failing test. Prove-It Pattern: the test goes red first.

**Acceptance criteria:**
- A test that reproduces the composed bypass and is RED before your fix, GREEN after.
  It must exercise the real gate and the real write path, not a restatement of either.
- The write must not be able to delete a label the gate did not authorize. Two shapes
  are acceptable and I am not mandating which — (a) enforce optimistic concurrency via
  `p.Version` so a changed issue rejects the write, or (b) constrain the write to the
  intersection of requested removals with the label set the gate actually evaluated.
  Whichever you choose, say in your report why the other was rejected.
- Stop discarding the error from `removeLabels`/`addLabels`. A silently-swallowed write
  failure is how this stayed invisible.
- **Mutation-verify your own test**: break your fix deliberately and confirm the new
  test reddens. A test that has never failed is not evidence. State the mutation and
  the result in your report.

## Work item 2 — M-1 [MEDIUM, must ship with this issue]

**[MEASURED by audit-194-r6, independently confirmed by the coordinator, and I read
`resolver.go` myself]**

`NewPlatformResolver()` takes no config parameter. At the anchor
`return NewPassThroughStore(token, owner, repo, nil, &cid), nil` in
`internal/platform/github/resolver.go`, the config argument is hardcoded `nil`, so the
store falls back to `DefaultConfig()`. Wired at `cmd/.../main.go` (anchor:
`NewPlatformResolver`). **[MEASURED]** `github.LoadConfig` is called from exactly one
place in the whole repo: `internal/cli/connect.go`.

Consequence: a deployed server ALWAYS runs `DefaultConfig()`. Any operator who
customised their label prefix has the new gate silently disarmed — it does not
recognise their labels as lifecycle labels at all.

I ruled this must ship WITH #194 rather than after, because a gate that is disarmed for
exactly the operators who customised something is worse than no gate: it creates false
confidence.

**Acceptance criteria:**
- The server binary honours configured label settings; `NewPlatformResolver` threads
  real config through to `NewPassThroughStore`.
- A test proving a non-default prefix is honoured **through the resolver**, not by
  injecting config below it. **[CLAIM — verify this]** I believe
  `internal/server/authz_label_write_scope_test.go` (anchor: test named
  `TestTerminalStageInput_RequiresTheConfiguredPrefix`) already covers the non-default
  prefix at the *service* level by injecting config directly. Your new test must cover
  the layer that one skips: the resolver wiring itself.
- Do NOT build the full 12-cell custom-prefix write matrix. That is deliberately
  deferred to r8 (my task #31). Scope discipline.

## Work item 3 — M-2 [MEDIUM]

**[MEASURED by audit-194-r6]** `InsertTasksAfter` (`internal/server/server.go`, anchor:
the label handling inside `InsertTasksAfter`) applies labels with no lifecycle gate. It
is currently unreachable only because the passthrough returns `ErrNotImplemented`
(anchor in `passthrough.go`). That is a reachability accident, not a control — the day
someone implements it, the gate is absent.

Audit also flagged `ImportCollection` (`internal/server/export_import.go`) and inbound
`SyncCollection` (anchor: `internal/platform/github/github.go`, actor `uuid.Nil`).

**Acceptance criteria:**
- `InsertTasksAfter` either rejects lifecycle-stage labels outright with a clear error,
  or routes through the same gate. Rejecting is acceptable and cheaper — pick it unless
  you find a reason not to.
- Add a test pinning the chosen behaviour so a future implementer trips over it.
- For `ImportCollection` and `SyncCollection`: **do not fix them in this round.**
  Instead, enumerate every write path that can set labels and record the list with
  reachability status in your report. I will route them. Enumeration is the
  deliverable, not the fix.

## Standing bars (non-negotiable, learned the hard way)

- **Positive control before any negative claim.** "No occurrences" is worthless from a
  grep that has never returned a hit. Show the grep finding something first.
- **Any harness must ABORT on a failed prerequisite**, never continue and report a
  green. Ten separate void harnesses have produced confident wrong answers on this
  workstream. Every one printed a clean number.
- **Exit codes come from the child process, never through a pipe.** `go test ./... | tail`
  reports the exit status of `tail`.
- **Edit by content anchor, never by line number.** Line numbers in this brief have
  already drifted once (the audit said `labels.go:369-371`; the text is actually at
  line 361). If an anchor is not unique, abort and tell me.
- **[MEASURED] `go build ./...` fails on a fresh clone** — `assets.go` embeds
  `all:web/dist`, which is gitignored. Run `make web` first (~4109 files).
- **[MEASURED] `go test ./...` is not reliably EXIT 0** — there is a known flake at
  ~0.06% (3 in 5000) in the WatchTasks subscribe path. If you hit a failure in
  `watch`-related tests, re-run before assuming you caused it, and tell me.
- **[MEASURED] `make race` is scoped** to `./internal/platform/github/` only.
- Predict counts BEFORE measuring them. Write the prediction down first.
- Costly disclosure is the trust signal. A narrower true claim beats a broader
  unverified one. If you could not verify something, say so plainly and name the limit
  — do not reason onward from it. Eleven minutes of asking is cheaper than a wrong
  claim; that is a measured number from this workstream.

## Deliverables — all four required

1. Code + tests committed to `label-write-scope-r7a` in `/workspace/farmtable-194-r7a`.
   Clear commit messages. **Do not push. Do not merge. I do that.**
2. A report at
   `/scion-volumes/scratchpad/projects/farmtable/reports/dev-194-r7a.md` covering: what
   you changed and why; the failing-test-first evidence for A-4; the mutation you ran
   against your own tests and its result; the full write-path enumeration for M-2; and
   an explicit **LIMITS** section naming everything you did NOT verify.
3. A project log entry in `.design/project-log/`, committed.
4. Tell me if any **[CLAIM]** in this brief is wrong.

You MUST write the report file, write the project log entry, commit, and then mark the
task complete. Do not stop after the analysis.
