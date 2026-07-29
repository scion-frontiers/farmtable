# #194 round 6 — leg A: the label prefix / terminal-set authorization surface

You are `dev-194-fixes-6a`. Your workspace is mounted at `/workspace`. Branch
`label-write-scope-r6a`, based on `ea8ac390dad3d2401d65608684e5d6623ab15ac5`.
Verify that with `git rev-parse HEAD` before you touch anything. If it does not
match, stop and tell me.

## Your domain — and the boundary you must not cross

You own **`internal/platform/github/`** plus wherever `push_prefix` config is
parsed, plus the `.design/project-log/` corrections listed below.

A second developer (`dev-194-fixes-6b`) is working in parallel on
**`internal/server/`** and **`internal/store/`**. Do not edit files in those two
directories. If you conclude a fix of yours requires a change there, do not make
it — write it down and tell me, and I will route it.

## Context you need before you start

Round 5 went through a full three-way independent review. Two legs approved, one
requested changes. **Round 5's code is not wrong.** Almost everything below is a
fix to a *claim* — a comment, a log entry, or a test — that is true today by
accident rather than by construction. Read that sentence again before you start
"fixing" working code.

The three reports are on disk. Read all three in full. They are long and they
are worth it:

- `/scion-volumes/scratchpad/projects/farmtable/reports/review-194-r5.md`
- `/scion-volumes/scratchpad/projects/farmtable/reports/audit-194-r5.md`
- `/scion-volumes/scratchpad/projects/farmtable/reports/test-194-r5.md`

## The defect class this whole workstream keeps producing

**A check that derives from the thing it is checking cannot falsify it.** Six
instances so far on this branch. Related forms, all of which have bitten us:

- **A fixture that cannot express the input.** The test passes because the
  harness has no way to construct the case that breaks it. Round 5's alias
  coverage is exactly this: `grep -rn "Stages:" --include='*_test.go' internal/`
  returns **zero**. Every terminal-alias test uses the default config.
- **A correct check answering a question nobody meant to ask.**
- **An expected value derived from the same configuration it is meant to verify.**

When you write a pin, ask: *what input would make this fail, and can my fixture
even build that input?* If it can't, the pin is decorative.

## Work items

### A1 — Review F1 [BLOCKING]: the `TerminalLabelStage` comment is false

`labels.go:527-531` claims the function has multiple consumers that depend on
the ordering. It does not. It has exactly **one** production caller,
`GitHubPassThroughStore.LifecycleStage` (`passthrough.go:784`), whose result
reaches exactly two consumers — `passthrough.go:612` →
`issueUnavailableForClaim`, and `passthrough.go:974` → `ComputeAvailability` —
and **neither of them branches on which terminal stage it is.** Both collapse
every terminal stage to one boolean.

So the code is correct, and it is correct for a reason nobody wrote down. The
reviewer proved the current behaviour by execution:

```
default   [completed wont_fix]  winner="completed"  claim=refused available=false [terminal]
reversed  [completed wont_fix]  winner="wont_fix"   claim=refused available=false [terminal]
default   [cancelled duplicate] winner="duplicate"  claim=refused available=false [terminal]
reversed  [cancelled duplicate] winner="cancelled"  claim=refused available=false [terminal]
```

Two unpinned preconditions hold it up. Add **one** consumer that branches on
*which* terminal stage — entirely natural, e.g. a different denial reason for
`wont_fix` vs `duplicate` — and the invariant is violated at a privilege gate
with no test failing.

Do:
1. Replace the false comment with the true one: name the single caller, name the
   two consumers, and state the actual precondition — *this ordering is
   unobservable **only** while every consumer collapses terminal stages to a
   boolean.*
2. Put the invariance argument where it can rot loudly: at
   `GitHubPassThroughStore.LifecycleStage`.
3. **Give the precondition a tripwire.** A comment that says "if you add a
   branching consumer, this breaks" is an assumption with an expiration date
   nobody set. Make the expiration enforceable — a test that fails when a
   consumer starts discriminating, or a type/structure that makes the collapse
   explicit. Your judgement on the mechanism; if you conclude no honest tripwire
   is possible, say so explicitly and explain why rather than writing a
   comforting one.

### A2 — Review F3 [BLOCKING]: the missing end-to-end test

No test drives **two** terminal labels through `ClaimTask` /
`ComputeAvailability`. The reviewer wrote one,
`TestSingularSinksAreBlindToTheTerminalTiebreak`, ran it, and deleted it; it is
reproduced in `review-194-r5.md`. Land it (adapt as needed — do not paste
blindly, and make sure it is asserting what you think it is).

### A3 — Test T-1 [BLOCKING, and part of it is actively harmful]

Configured terminal aliases are completely uncovered. Measured behaviour:

```
key="shipped"     label="shipped"     | lifecycle="accepted"  available=true  | display="completed",true | AllTerminalLabelStages=[]
key="shipped"     label="ft:shipped"  | lifecycle="completed" available=false | display="completed",true | AllTerminalLabelStages=[completed]
key="ft:shipped"  label="ft:shipped"  | lifecycle="accepted"  available=true  | display="",false         | AllTerminalLabelStages=[]
key="ft:shipped"  label="shipped"     | lifecycle="accepted"  available=true  | display="",false         | AllTerminalLabelStages=[]
```

Row 1 is a display/authorization divergence on a deliberately configured alias:
the UI says "completed", the authorization layer says claimable.

**Row 3 is the urgent one.** Row 3 is what you get if you follow the
remediation sentence currently written in the round-5 project log. An operator
who reads that log entry and acts on it turns a half-working alias into a
**fully dead** one — `buildLabelMapper` (`labels.go:144`) stores the key
verbatim, while `stripForMatch` (`labels.go:542`) strips before lookup, so the
key can never match.

Do:
1. **Correct the wrong remediation sentence in the project log first.** It is
   the only item in this brief that is currently misleading a human operator.
2. Normalize configured alias keys through the same `stripForMatch` path used
   for lookup, so a key works whether or not the operator wrote the prefix.
3. Build a fixture that can **vary `Stages:`**. This is the fixture-cannot-
   express-the-input gap; closing it is worth more than any individual
   assertion. Cover all four rows above.
4. Audit A-5 [INFO] is the same surface — a configured alias with the prefix in
   the key is reachable only as a double prefix. Your fix should subsume it;
   confirm that it does.

### A4 — Audit A-2 [LOW]: whitespace `push_prefix` silently disarms everything

`push_prefix: " "` (also `"\t"`, U+00A0) silently disables B1+B5+B6 **together**.
`matchPrefix` defaults only on the empty string, but both readers `TrimSpace`
the label before `HasPrefix`. The auditor's fix:

```go
func (m *LabelMapper) matchPrefix() string {
    if p := strings.ToLower(strings.TrimSpace(m.config.PushPrefix)); p != "" { return p }
    return "ft:"
}
```

Note `TrimSpace` is unicode-aware, so U+00A0 is covered — the auditor predicted
otherwise and was wrong, and left that on the record. Verify it yourself rather
than trusting either of us.

Also reject a whitespace-only `push_prefix` at config-parse time with a clear
error. Silently falling back is better than silently disarming, but failing loud
at startup is better than both.

### A5 — Audit A-3 [LOW]: F7 is RPC-reachable and worse than recorded

`LabelDeltaLifecycleStages`' `(current, current)` fallback is fail-**open**.
Reachable today: `UpdateTask(stage=wont_fix)` on an issue labelled
`[ft:stage/wont_fix, duplicate]` is **ALLOWED**, and it destroys the human's
stock `duplicate` label. Fix the swap path so a write that removes a
third-party terminal label is gated like any other terminal transition.

`store.LabelDeltaLifecycleStages` itself lives in leg B's domain. If your fix
needs to change that function's behaviour rather than its caller, **stop and
tell me** — do not edit `internal/store/`.

### A6 — Review F5 [LOW]: three copies of the push-prefix default

`"ft:"` is spelled at `terminal_label_stages.go:62`, `labels.go:125`, and
`labels.go:262`. Drift fails closed today, which is why it is Low. Collapse to
one source. This is the same shape as test T-2 (duplicated unreachable
fallbacks) — two copies of a rule is one copy plus a future bug.

### A7 — Round-6 structural items already scoped to this branch

- The **treewalk scheduling sink**: `computeReady` (`treewalk.go:84`) is a fourth
  consumer of terminal state that keys off issue STATE, not label stage. Bring it
  onto the same determination the other three sinks use, or document with a
  tripwire why it must differ.
- The **fail-open tiebreak** and **enum-rooted pins** (review F6: no compile-time
  assertion for `LifecycleStageSetStager`). Root the pins in the enum so adding a
  stage forces a decision instead of silently defaulting.
- `hasExternalUnavailableLabel` must respect the configured prefix. The reviewer
  notes `matchPrefix()` is a net assist here.

### A8 — Small true things

- Review F4: the "(#194 round 5)" tags on round-6 work are wrong. Fix the tags.
- Test T-5: stale control-attribution comment at `reopen_test.go:272-275`.
- Review F2 [BLOCKING]: the project-log "Sinks covered" table at lines 109-111
  writes `store.LifecycleStage(s)` and thereby conflates B5 with B6. Ground
  truth: **B5 does not reach `ComputeAvailability`/`ClaimTask`; B6 does.**
  Correct the table.

## Standing bars — these are not optional

1. **Positive control before any negative claim.** If you report "X is not
   reachable" or "this mutation is caught," first demonstrate your harness can
   detect the thing when it *is* present. A green result from a harness you have
   never seen go red is worth nothing. An auditor on the parallel #195 workstream
   produced a complete, clean, entirely fictitious table of eight caught
   mutations this way — the script was erroring out before it ever ran the suite.
2. **Mutations content-addressed, never line-addressed.** Anchor on unique
   surrounding text; **abort if the anchor is not unique.** A reviewer's first
   mutation this round correctly aborted because four stage constants also match
   `stagePrecedence`'s tail.
3. **"Clean" is not "unchanged."** Verify restoration with sha256 against an
   out-of-repo pristine copy, not `git status`.
4. **Verify a green mutation actually weakens the thing** before you conclude
   anything from it. Two mutations last round were invalid — they failed to
   compile on unused imports — and would have been two false findings if judged
   on exit code alone.
5. **Exit codes from the child, never through a pipe.**
6. **Costly disclosure is the trust signal.** Report your dead ends, your voided
   runs, and the places you were wrong. Every leg that did this last round
   produced a better report than the finding count suggests. A narrower true
   claim beats a broader unverified one.
7. **Beware `identity_test.go:250`.** It panics, and a panicking run silently
   skips tests: fault injection measured **215 tests clean vs 115 under fault —
   100 tests never executed.** Any kill count measured on a panicking run is
   unreliable. Test T-4 is a one-line fix and it belongs to leg B; until it
   lands, sanity-check your test *counts*, not just exit codes.

## Your gate

Run and record, each with the exit code taken directly from the child process:

```
go build ./...          # expect 0
go vet ./...            # expect 1 — 4 PRE-EXISTING copies-lock findings.
                        # Verify BY REQUEST TYPE that these are the same four.
go test ./...           # expect 0
make race               # expect 0 (scoped to ./internal/platform/github/)
```

Also report the total test count, so a silent skip cannot hide in a green run.

There is **no CI**. Nothing runs these but you.

## Deliverables — all four are required

1. Code and tests committed to `label-write-scope-r6a`, in coherent commits with
   clear messages.
2. **A project log entry** at `.design/project-log/`. Not optional. State what
   you fixed, what you deliberately did not fix, and — for every claim you make
   about reachability or coverage — the command or execution that establishes it.
   If you correct something in an earlier log entry, say so explicitly.
3. A short summary message to me (`scion message farmtable-em-task-state-model-v2`) with: the four
   gate exit codes, the test count, one line per work item A1–A8 with its status,
   and anything you were forced to leave for leg B or for me.
4. **Do not push.** Commit locally only. I am the only agent permitted to push.

If any item turns out to be wrong, or the fix is bigger than the finding
suggests, say so rather than forcing it — a report that an item was
mis-scoped is a useful result, not a failure.

You MUST commit your work, write the project log entry, send me the summary, and
then mark the task complete.
