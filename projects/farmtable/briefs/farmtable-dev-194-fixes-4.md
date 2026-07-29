# #194 `close-label-swap` — round-4 fix brief

**Branch:** `close-label-swap`, head **`651da26`**, in `/workspace/farmtable-close-label-swap`.
Verify `git rev-parse --short HEAD` prints `651da26` before you touch anything.
**`/workspace` is NOT a git repository** — it is the parent of ~35 clones. Never
run the gate there. The branch name is not an identifier here; the SHA is.

Round 3 was reviewed by two independent legs. **The gate FAILED.** Read both in
full — they are the specification for this round, and they **disagree with each
other on the central question**, which is the single most important thing about
this round:

- `/scion-volumes/scratchpad/projects/farmtable/reports/audit-194-r3.md` — REQUEST CHANGES, **2 High**
- `/scion-volumes/scratchpad/projects/farmtable/reports/test-194-r3.md` — REQUEST CHANGES, 1 High / 1 Medium / 4 Low

**The test leg wrote: "The fix itself is sound, reachable in production, and
genuinely pinned. I tried hard to break it and could not."** The audit leg
produced a working proof of concept that defeats it. I ran that PoC myself. The
audit leg is right. Do not let the test leg's sentence reassure you — but do read
its report, because its F2–F6 are good and independent of the disagreement.

---

## THE RULING

Round 3's authorization fix is **directionally correct, genuinely wired, and
incomplete**. It restores the accept gate for exactly one input shape and the
production comments claim it holds for all of them.

### The defect (audit F1, High) — verified by execution, by the auditor and by me

`TerminalLabelStage` — the entire basis of the round-3 fix — is built on
`MapLabelsToStage`:

```go
// internal/platform/github/labels.go:444-453
func (m *LabelMapper) TerminalLabelStage(labels []string) (task.Stage, bool) {
	if m == nil {
		return "", false
	}
	stage, ok := m.MapLabelsToStage(labels)      // <-- collapses to ONE winner
	if !ok || !store.IsTerminalStage(stage) {
		return "", false
	}
	return stage, true
}
```

`MapLabelsToStage` does not report which stages a label set names. It collapses
them to the single highest-precedence winner (`labels.go:168-173`), and
`stagePrecedence` (`labels.go:13-24`) ranks **every non-terminal stage above
every terminal one**.

So one extra ordinary label defeats the gate. `[ft:stage/wont_fix,
ft:stage/accepted]` → `MapLabelsToStage` returns `accepted` → `TerminalLabelStage`
returns `("", false)` → `LifecycleStage` falls back to `t.Stage`, which is the
F2-demoted `accepted` → `TransitionScope(accepted, accepted)` hits the `from ==
to` short-circuit → `task:write`.

**The seam returns exactly the value it was built to avoid.**

**Audit PoC1: 12 of 16 combinations bypass.** Single-label baseline denied in all
16, so the harness fails closed. **Audit PoC2: the same root cause returns a
declined issue to the ready queue** (F2, High) — and that one needs no Farm Table
token at all, only GitHub triage rights.

The 4 non-bypassing cases are all the `ft:stage/triage` mask, and they are
**coincidence, not defence**: `triage → anything` independently requires
`task:accept` (`transitions.go:88-91`). The terminal label is still invisible to
the gate.

---

## THE MEASUREMENT NEITHER LEG MADE — and it changes your target

I wanted to know whether round 3 *introduced* this or merely failed to cover it,
because that changes the framing. **I measured it rather than assuming.** At
`a70d3d1` (the commit immediately BEFORE F2), with the mapper enabled:

```
labels=[ft:stage/wont_fix]                      -> phase=closed       stage=wont_fix
labels=[ft:stage/wont_fix  ft:stage/accepted]   -> phase=open         stage=accepted
labels=[ft:stage/duplicate ft:stage/working]    -> phase=in_progress  stage=working
labels=[ft:stage/completed ft:stage/in_review]  -> phase=in_progress  stage=in_review
labels=[ft:stage/wont_fix  ft:stage/triage]     -> phase=open         stage=triage
```

At `a70d3d1`, `server.go:537` reads `existing.Stage` directly. So:

| label set | pre-F2 `a70d3d1` | post-F2 `0b87721` | round 3 `651da26` |
|---|---|---|---|
| `[wont_fix]` | `wont_fix` — **gate held** | `accepted` — bypass (round 2's regression) | `wont_fix` — **restored** |
| `[wont_fix, accepted]` | `accepted` — **BYPASS** | `accepted` — bypass | `accepted` — **STILL BYPASS** |

**The multi-label bypass predates F2. Round 3 restored exactly the one cell F2
broke, and no more.**

Two consequences, and they are the reason I am writing this section:

1. **This is not a regression you introduced.** Do not go looking for what you
   broke. You did not break it.
2. **"Restore pre-F2 behaviour" is not a sufficient specification of done, and it
   has been the operating target for three rounds.** Pre-F2 was already wrong
   here. The target has to be stated positively: *authorization must never read a
   precedence-collapsed label projection.* Aim at that, not at a diff.

**A methodological note, because it nearly bit me:** my first run of this
measurement returned `accepted` for all five label sets, including the single
`[wont_fix]`. That looked like a clean result and it was worthless — I had
constructed the mapper with `LabelConfig{}`, so `enabled` was false and nothing
matched. Five different inputs producing one identical output is a tell. If your
verification produces a suspiciously uniform answer, the harness is the first
suspect.

---

## THE DEFECT CLASS — you already identified it, one level up

From your own round-3 log, rejecting the audit's `NativeLabel` suggestion:

> "It is — from the *post*-demotion stage (`NativeLabel: string(stage)`), so
> reading it would have been a silent no-op that looked like a fix."

That reasoning was exactly right. And then `TerminalLabelStage` was built on
`MapLabelsToStage` — **the same precedence collapse whose display-orientation
caused the bug in the first place.** You saw the class and stepped in it one
level down.

The general form, which has now appeared four times tonight across three
branches: **a check that derives from the thing it is checking cannot falsify
it.** `MapLabelsToStage`'s single-winner contract is a *display* contract.
Deriving a *privilege* decision from it inherits the display bias wholesale.

I am not saying this to score a point. I am saying it because it is the thing to
hold in mind while you write round 4: for every value the fix reads, ask *what
question was this value computed to answer?*

---

## BLOCKING — must be done this round

**B1. Make `TerminalLabelStage` scan for ANY terminal label, independently of
`stagePrecedence`.** The audit's candidate fix is in `audit-194-r3.md` under F1's
Recommendation, and the auditor verified it by execution (both PoCs pass, no
existing test breaks, targeted suites rc=0).

**Do not ratify it because the auditor measured it.** Re-derive it, apply it, and
break it yourself. Two things to think about that the candidate does not discuss:

- It iterates `stagePrecedence` filtered to terminal stages so multiple terminal
  labels resolve deterministically. Is precedence order the right tiebreak for a
  *privilege* decision, or should any terminal label simply be sufficient? The
  authorization question only needs the boolean; the specific stage matters for
  the error message and for `ComputeAvailability`'s `Reasons`. Say which you
  chose and why.
- It adds `|| !m.enabled` to the nil guard. Audit F6 established the fallback is
  *correct* when `enabled == false` (`IssueToPhaseStage` also declines to map, so
  no demotion occurs and `t.Stage` is authoritative). Confirm that still holds
  under your version rather than inheriting the claim.

**B2. Make the authorization test suite structurally capable of seeing this.**
The audit found the root cause of the blindness in one line —
`internal/server/authz_terminal_reopen_test.go:65`:

```go
"labels": {"nodes": [{"name": %q}]},
```

The fixture takes a single `string`, not a `[]string`. All 24 subtests build an
issue with exactly one label. **It is not that the case was considered and
skipped; the data shape forecloses it.** Change the fixture to take a label
*set*, and extend the matrix to terminal × destination × mask, where mask ranges
over every non-terminal stage **and the empty mask**. Include `triage` and
document in the test that it is denied for an unrelated reason.

**B3. Pin the availability side separately** (audit F2). Assert `Reasons`
contains `terminal`, not merely `Available == false` — the latter can pass for
the wrong reason.

**B4. Assert the table lengths.** `if len(cases) != N { t.Fatalf(...) }`. The
audit confirmed the suite is not vacuous today but that nothing stops a row being
deleted silently. `internal/store/terminal_availability_test.go:76-85` already
has the pattern. This is the cheap structural guard against the erosion class
that produced F1.

**B5. Add a guard test on `stagePrecedence` ordering.** It is now load-bearing
for a security property. Fail if any terminal stage is ever ordered above a
non-terminal one, and say in a comment on `stagePrecedence` that its ordering is
a display rule that authorization must not depend on.

**B6. Correct the false comment at `passthrough.go:812-815`** (audit F3, Medium).
It claims availability is "the one answer every client inherits," naming `ft
ready`, MCP `task_ready`, and the web dashboard. The auditor verified only the
**web dashboard** is true. `GetReadyTasks` intercepts before `MultiStore` is
consulted (`server.go:1505-1518`, `graph_support.go:10-17`) and MCP delegates to
the same RPC (`internal/mcp/server.go:661`) and drops the field. **Your round-3
project log makes the same claim** — correct it there too. One sentence each; do
not attempt to make the other two consumers actually inherit it, that is #202
territory.

**B7. Strengthen the `from == to` and positive-control assertions** to inspect
the resulting stage, not just `err != nil` / `err == nil` (audit item 5b). As
written they would pass if `UpdateTask` succeeded while doing nothing.

---

## DEFERRED — do NOT do these

- **The stock `duplicate` label.** Ptone has ruled, and the ruling changes the
  approach rather than answering the question as posed: **do not gate on any
  label, prefixed or not.** GitHub has a native "close as duplicate" that sets
  `state_reason` on a CLOSED issue and requires actual close permissions — a much
  higher bar than triage rights. The mapper should key off closed state +
  `state_reason`, not label matching. I checked the plumbing: `state_reason` is
  **already fetched and already passed in** (`graphql_queries.go:19`,
  `passthrough.go:200-205`, `IssueToPhaseStage(state, stateReason, labels)`), so
  no new field or query is needed. **This is its own issue and its own round** —
  it changes mapping logic, not an authz check. Do not start it here.
- **#203** — the display/authoritative stage split. Architect-scoped. F1 is
  further evidence for it; note that in your log, do not implement it.
- **#202** — the ephemeral pool is unwired. Confirmed again by the audit.
- **audit F5** (availability silently degrading to a stage-only answer on error)
  — the auditor verified it is **pre-existing**, not round 3, and Low because the
  pass-through path cannot trigger it. Ticket, not this round.
- **audit F7 / `go vet` copies-lock ×4** — confirmed pre-existing and untouched.
- **The disclosed surviving `labelNameToID` RLock mutant** — accepted.
- **`passthrough.go:424-431` remove-then-add error swallowing.** Note it in your
  log as a ticket. The audit's warning is worth carrying: fixing it naively
  creates the mirror risk, where a failed *add* after a successful *remove*
  strips the terminal label entirely.

---

## Standing bars on this workstream

1. **Mutation testing is the bar.** "Verified" without pasted actual failing
   output is not evidence. Prove every fix by breaking it.
2. **Address mutations by CONTENT, never by line number.**
3. **Restore from `cp` backups outside the repo, never `git checkout`** — it
   cannot distinguish your mutation from an uncommitted fix. Assert
   `git status --porcelain` empty after each restore.
4. **Do not read an exit code through a pipe.** `go test ./... | tail -3; echo $?`
   reports **tail's** status, always 0. Redirect to a file, capture `$?` on the
   next line, then read the file.
5. **Assertions must fail closed.** A comparison where both sides are empty
   silently passes. A false negative announces itself; a false positive does not.
   Check your own tooling — see the uniform-answer story above.
6. **Distinguish what you verified BY EXECUTION from what you REASONED about.**
7. **`make race` must stay green.** Note `make race` exits **2**, not 1, on
   failure (test leg's V6 nit) — do not write a checker that tests for 1.
8. **Do not push.** Commit locally with clear messages. Pushing is mine alone.

## Deliverables

1. The fixes above, committed to `close-label-swap`.
2. **A project log entry in `.design/project-log/`** — required, not a nicety.
   Correct the two false inheritance claims in the round-3 entry while you are
   there.
3. A reply to me listing, for each blocking item: the change, the mutation you
   ran against it, and the pasted output proving the vector is dead. Plus the two
   PoCs re-run and passing. Plus anything this brief got wrong — the last three
   rounds each found something the brief missed, and I would rather you keep that
   streak than protect my ego.

**You MUST complete the fixes, write the project log entry, commit, report back,
and then mark the task complete.**
