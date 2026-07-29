# #194 round 5 — scope label writes that change the lifecycle stage

**Your clone:** `/workspace/farmtable-labelwrite-scope`, branch
`label-write-scope`, based on `03ab6b6`, clean.

**Do not work in `/workspace/farmtable-close-label-swap`.** Round 4 is under
three-way independent review at `03ab6b6` right now and that SHA must not move.
Three reviewer clones are pinned to it. Your work lands on a separate branch and
I rebase it afterwards.

**Consequence for you: put your new tests in a NEW FILE.** Do not edit
`internal/server/authz_terminal_reopen_test.go` — the review legs may request
changes to it and I want a clean rebase. Use
`internal/server/authz_label_write_scope_test.go`.

---

## THE RULING

Round 4's fix is correct and stays exactly as it is. It closed the *read* side of
the bug. **The attack moved to the write side, and it is still Critical.**

Two self-service chains reproduce at `03ab6b6`, both measured by execution by the
security auditor, both with one token holding only `task:write`, no second actor,
no GitHub access, no partial failure, and both self-erasing.

### Direction 1 — removal. Revokes a maintainer's decision.

```
step 1  reopen                            -> DENIED (missing scope "task:accept")   labels=[ft:stage/wont_fix]
step 2  remove_labels[ft:stage/wont_fix]  -> ALLOWED                                labels=[]
step 3  reopen                            -> ALLOWED                                labels=[ft:stage/accepted]
```

Step 3's successful transition **stamps `ft:stage/accepted` itself**, so the end
state is byte-for-byte identical to a legitimate accept. Open on all three sinks:
`UpdateTask` authorization, `ComputeAvailability`, `ClaimTask`.

### Direction 2 — addition. Reaches *any* task, not only declined ones.

```
step 0  ordinary open task                     phase=open stage=accepted labels=[ft:stage/accepted]
step 1  close directly                      -> DENIED (missing scope "task:close")
step 2  add_labels[ft:stage/completed]      -> ALLOWED   labels=[ft:stage/accepted ft:stage/completed]
step 3  UpdateTask(stage=completed)         -> ALLOWED   (from == to short-circuits to task:write)
        after                                  labels=[ft:stage/completed]
```

4 of 4 terminal destinations. Baseline denied with `task:close` in every case, so
each is a genuine exercise of the gate.

**The uncomfortable part, and you should understand it before you start: the
round-4 fix is what makes step 2 work.** Before it, `TerminalLabelStage`
collapsed `[accepted, completed]` to `accepted` and returned `("", false)`, so
the attacker's label was invisible and could not occupy the `from` slot. A
*correct* terminal scan is precisely what promotes an attacker-supplied label
into the authorization source. This is not an argument against round 4. It is the
argument that **the label is the wrong place to read from at all, in either
direction.**

### The accurate impact — narrower than my first statement of it

I briefed this as "the task is closed as completed." **That was too strong and
the auditor corrected it by instrumenting the mock to count `closeIssue`
mutations: zero.** `passthrough.go:412-431` handles `p.Stage` by swapping labels
and never consults `p.Phase`. So the true claim is:

> A `task:write` holder can mark **any** task terminal *to Farm Table* — removed
> from `ft ready`, unclaimable, `Available=false Reasons=[terminal]` — and
> reversing it then requires `task:accept`, which the attacker does not hold. An
> unauthorized decline the attacker cannot itself undo, plus a false completion
> record.

**And the payload is step 1, not step 3.** `AddLabels` **alone** already flips
`Available=true → false`. The `from == to` short-circuit only removes
`ft:stage/accepted` and leaves a tidy `[ft:stage/completed]` — it launders the
result into something that looks like a legitimate transition. That is why the
control belongs at the label write: **a control there intercepts the payload; a
control at the short-circuit would only intercept the cosmetics.**

---

## THE ROOT, STATED AS AN INVARIANT

Not "close the remove spelling." Targets stated as deltas have failed on this
branch three rounds running.

> **If authorization reads a value, every write path to that value must be
> guarded by the same authorization.**

The authoritative lifecycle stage of a GitHub-backed task lives in its labels.
`server.go:621-625` lets any `task:write` holder rewrite those labels with no
check of any kind — the transition-scope gate at `server.go:552-557` sits inside
the `if req.Stage != nil` arm opened at `server.go:529`, so a label-only request
never reaches it.

**There is a floor, and its exact shape matters — do not break it.**
For a **CLOSED** issue there IS a floor: `state:CLOSED` is a real GitHub field,
not a label, and `ClosedAt` survives label stripping. Stripping `ft:stage/wont_fix`
from a closed issue moves the stage `wont_fix → completed`, still terminal, and
the gate holds (measured). **That floor is load-bearing and must not be
refactored onto labels.**
For an **OPEN** issue carrying a terminal label there is **no floor at all**: the
declined status exists only in a field the attacker can write. There is no second
witness.

---

## B1 — THE CONTROL (blocking, this is the round)

In `UpdateTask`, before the label passthrough at `server.go:621`:

```go
if len(req.GetAddLabels()) > 0 || len(req.GetRemoveLabels()) > 0 {
    cur  := labelsOf(existing)
    next := applyLabelDelta(cur, req.GetAddLabels(), req.GetRemoveLabels())
    from := lifecycleStageForLabels(ctx, s.store, existing, cur)
    to   := lifecycleStageForLabels(ctx, s.store, existing, next)
    if from != to {
        if sc := TransitionScope(string(from), string(to)); sc != ScopeTaskWrite {
            if err := RequireScope(ctx, sc); err != nil {
                return nil, err
            }
        }
    }
}
```

That sketch is the auditor's and it is a sketch, not a specification. Design the
real thing yourself, and in particular decide honestly whether
`lifecycleStageForLabels` should be a new exported seam or whether there is a
cleaner factoring. **Push back if you think this shape is wrong** — the round-4
dev pushed back on my brief on a security-relevant point and was right, and that
exchange is why this round exists.

Requirements the design must satisfy:

1. **Gate on the transition the edit INDUCES, not on "a stage label was
   touched."** Otherwise routine label hygiene starts demanding `task:accept`.
2. **`from != to` is required, not optional.** Adding `ft:stage/completed` to an
   issue already labelled `completed` must stay free.
3. It must close **both** directions at step 1. Verified prediction:
   direction 1 `wont_fix → accepted` demands `task:accept`; direction 2
   `accepted → completed` demands `task:close`. Both DENIED at step 1.
4. **Do not change `terminalStagePrecedence`, and reject any impulse to.** The
   auditor measured the terminal-start matrix: a bypass occurs **iff
   `rank(dest) < rank(start)`**, so `completed` at rank 0 is reachable from
   everywhere and is a fixed point. That is a property of **ordered tiebreaking
   as such**, not of the order chosen — every total order has a rank-0 element.
   Reordering only moves which stage is free. **No ordering fixes this.**
5. It must subsume disclosed audit **F7** (the `add_labels`/`remove_labels`
   mirror). Say in your report whether it does.
6. Consider the non-GitHub path. `LifecycleStage` falls back to `t.Stage` for
   native Ent-backed tasks, where no label can forge `from`. Make sure the
   control is a no-op there rather than an accidental new restriction.

## B2 — Land REV9 as a passing regression test (blocking)

`from == to` does **not** need separate hardening today, and that was measured,
not assumed:

```
step 0  OPEN issue carrying ft:stage/wont_fix
step 1  UpdateTask(stage=wont_fix) -> ALLOWED (task:write, from==to short-circuit)
        phase unchanged, closedAt unchanged, labels unchanged
RESULT: genuinely a no-op.
```

It is a true no-op **because `passthrough.go:412-431` never writes `p.Phase`.**
That is load-bearing and currently undocumented.

If a later change makes `UpdateTask` honour phase for GitHub-backed tasks —
plausible under #203, or under any "make `UpdateTask` and `CloseTask`
consistent" cleanup — then re-asserting a stage the labels already name becomes
an **open → closed** transition costing only `task:write`, and the short-circuit
goes live **with no label write for any control to inspect.**

So: land this as a **passing** test whose doc comment names the assumption and
says what breaks when it fails. Do not add a speculative second control and do
not put a scope check on a genuine no-op. The auditor's harness contains REV9
with an adoption note.

## B3 — The ten-minute question nobody has answered (blocking to ANSWER, not to fix)

Can a **native, Ent-backed** task ever hold `stage=<terminal>` with `phase=open`?
If it can, `from == to` is a real close on the native path too, with no label
involved and nothing for B1 to inspect.

The auditor believes it is not constructible through the API but **explicitly did
not construct it and is not claiming it — REASONED, not measured.** Measure it.
If it is constructible, stop and tell me before building anything; that is a
different finding and possibly a different round.

## B4 — Comment accuracy (blocking)

Round 4's comments do **not** currently overclaim — I grepped for it and found
nothing, and the round-4 log already records the other end as sequenced. **Keep
it that way.** Whatever you write, describe precisely what your control closes
and what it does not. An inaccurate comment asserting a hole is fixed is the
exact failure mode this entire finding is about — see disclosed audit F3, a
comment claiming a property held for all three consumers when it held for one.

---

## OUT OF SCOPE — do not do these

**#203** (move the authoritative stage off labels entirely). The auditor's
conclusion, which I endorse and am escalating separately: *every control here is
a control over a verb, and the verb set is open-ended* — `UpdateTask` today, and
bulk edit, sync, import or a webhook reconciler tomorrow. Enumerating verbs is a
losing game against a single mutable field. **#203 is a security dependency, not
architectural tidying**, and the measurement now points at it twice. It is still
not this round.

Also out: #202 · audit F4 (unprefixed stage-named labels) · F5 · F7's `go vet`
findings · bare stock `duplicate` handling · `passthrough.go:424-431`
remove-then-add ordering (a naive fix creates the mirror risk: a failed add after
a successful remove strips the terminal label entirely) · `UpdateTask` building
its response proto from the issue *before* the label swap.

---

## Standing bars — these apply to your method

1. **Measure, do not assert.** Label every claim **BY EXECUTION** or **REASONED**.
2. **Measure regardless of whether the first answer is the one you would want to
   be true.** Both directions above exist because someone measured a residual
   they hoped was closed.
3. **A harness that cannot express an input cannot test it.** This has bitten
   four different legs tonight: a fixture whose *schema* took a single label
   string; a mock whose *state model* could not express a two-call sequence; a
   PoC whose *design* fixed the destination and hid four real bypass cells from
   two reviewers for a whole round; and the round-4 dev's own first claim probe,
   which was a **false pass** that laundered a bypass as a denial. **Prove your
   harness can express the state change before you trust any negative result**,
   with a self-check that fails closed. The auditor's harness
   (`salvage/audit-194-r3-stateful-harness.go`, 777 lines) already contains REV0
   for exactly this — **reuse it rather than rebuilding**, and note it documents
   three mock traps that have each produced a false result.
4. **Every probe carries a `BASELINE BROKEN` fatal** that aborts if the gate under
   test is already open. The auditor ran 21 baselines and all held; that is what
   makes its results non-vacuous.
5. **A count pin must state what its rows can and cannot express.**
6. **Content-addressed mutations only**, never line-numbered. Abort if the anchor
   is not unique. Back up **outside** the repo. After every restore assert
   `git status --porcelain` empty **and** positively assert the property you
   wanted restored.
7. **"Clean" is not "unchanged."** A tree-cleanliness check measures agreement
   with HEAD and is structurally blind to work that was never in HEAD. A sibling
   dev lost a full set of verified edits tonight to a restore that passed
   correctly. **Commit before running any mutation driver; refresh backups
   immediately after every commit.**
8. **Capture exit codes from the child process, never through a pipe.**
   `go test ./... 2>&1 | tail -3; echo $?` reports `tail`'s status. Note
   `make race` exits **2**, not 1, on failure.
9. **Costly disclosure is the signal we trust here.** Four legs tonight have
   disclosed something that made their own prior work look worse — including this
   round's auditor, which recorded plainly that the round-4 dev's approach was
   *better than the one it had itself recommended*. If your method turns out to be
   flawed, lead with it.

## Deliverables

1. The control, committed on `label-write-scope`, with both directions **DENIED
   at step 1** and demonstrated by execution.
2. New tests in `internal/server/authz_label_write_scope_test.go` — **not** in
   `authz_terminal_reopen_test.go`.
3. REV9 landed as a passing regression test with the load-bearing assumption
   named in its doc comment (B2).
4. A measured answer to B3.
5. Full gate: `go build`, `go test ./...`, `make race`, `go vet ./...` — each exit
   code captured from the child process. `go vet` is expected to report exactly
   the 4 pre-existing copies-lock findings in `internal/server/server.go`; report
   any change.
6. **A project log entry** in `.design/project-log/`. This is a required step, not
   an optional one.
7. Report back with the commit SHA, the gate results, what you closed, and — most
   importantly — **what you did not close and where you disagreed with this
   brief.**

**Do not push.** You MUST commit the work, write the project log entry, and then
mark the task complete.
