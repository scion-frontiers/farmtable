ADDENDUM 2 to your brief. This one DOES change your scope. Read it before you
finish B1.

---

## 1. I am retracting a line from your brief. It has been falsified by execution.

Your brief says:

> "`from == to` does NOT need separate hardening today."

**That is wrong.** I wrote it on the strength of a round-3 measurement. Two
independent round-4 legs have since measured the case that measurement never
constructed — **two terminal labels present at once** — and both found live
state change with `task:write` alone.

Test leg, §7:

```
[wont_fix completed] -> completed with task:write only: err=<nil> labels-after=[ft:stage/completed]
R-B CONFIRMED: the tiebreak picked `completed`, from == to short-circuited to
  task:write, and the maintainer's wont_fix label was swapped away by the write.
```

Security leg, Z4C — 12 ordered terminal→terminal pairs, prediction encoded
before the run, `prediction_misses=0`:

```
Z4C ordered pairs=12 CONVERTED=6 denied=6
TERMINAL->TERMINAL CONVERSION WITH task:write ONLY: wont_fix  -> completed ALLOWED
TERMINAL->TERMINAL CONVERSION WITH task:write ONLY: duplicate -> completed ALLOWED
TERMINAL->TERMINAL CONVERSION WITH task:write ONLY: duplicate -> wont_fix  ALLOWED
TERMINAL->TERMINAL CONVERSION WITH task:write ONLY: cancelled -> completed ALLOWED
TERMINAL->TERMINAL CONVERSION WITH task:write ONLY: cancelled -> wont_fix  ALLOWED
TERMINAL->TERMINAL CONVERSION WITH task:write ONLY: cancelled -> duplicate ALLOWED
   `old terminal present=false, new terminal present=true` on every converted cell
```

These are **real state changes, not no-op writes**. And Z4E shows the attacker
does not even need to write a label to get there:

```
control: single ft:stage/cancelled -> duplicate DENIED (as it must be)
NO-WRITE CONVERSION: start=[ft:stage/cancelled duplicate]          ask=duplicate -> ALLOWED with task:write only
NO-WRITE CONVERSION: start=[ft:stage/cancelled ft:stage/completed] ask=completed -> ALLOWED with task:write only
NO-WRITE CONVERSION: start=[ft:stage/duplicate ft:stage/wont_fix]  ask=wont_fix  -> ALLOWED with task:write only
```

`cancelled -> completed` with an agent token is precisely the lie an agent that
failed its task would want to tell. `DefaultScopesForAgent` grants neither
`task:close` nor `task:accept`.

The security leg also reversed its own round-3 sequencing call, explicitly:

> "R-B alone is genuinely low-impact — the four diagonal cells write nothing new.
> It is the *combination* with the selectable tiebreak that produces state change,
> and that combination shipped in round 4. I would pull the R-B fix into the same
> change as this one rather than leave a round-4 feature depending on a round-5
> fix for its safety."

I agree. **Round 4 currently ships a feature whose safety depends on a fix that
does not exist yet.** That is not a state I am willing to merge, so it comes
into your round.

---

## 2. NEW DELIVERABLE B5 — stop picking one source

This is at the same call site as B1 (`server.go:552-557`), which is why it is
yours and not a separate round.

The root cause is not the *order* of `terminalStagePrecedence`. It is that a
single-answer tiebreak exists in an authorization path at all. From the audit:

> "Any deterministic single-answer tiebreak hands an add-capable attacker control
> of the reported source; changing the order only changes *which* six pairs are
> reachable, never that six are. The order is currently written as though it were
> a neutral display detail; **it is an access-control parameter**."

So: do not pick a winner. Evaluate the transition against **every** terminal
stage present and demand the strongest scope. Sketch from the audit — treat the
shape as the requirement and the spelling as yours:

```go
// server.go, replacing the single-source TransitionScope call at :552
stages := store.AllTerminalLabelStages(ctx, s.store, existing) // ALL present, not one
if len(stages) == 0 {
    stages = []task.Stage{existing.Stage}
}
for _, from := range stages {
    if err := RequireScope(ctx, TransitionScope(from, target)); err != nil {
        return nil, err
    }
}
```

**Why this is the right shape and not a special case.** With two distinct
terminal labels present, `from == to` can hold for at most one of them, so the
other necessarily falls to rule 1 (`any -> terminal = task:close`) and the whole
class closes — including the no-write variant. The test leg independently
arrived at the same distinguisher from the other direction and called it
**cardinality of the terminal set**: short-circuit only when the source set names
at most one terminal stage. The loop above *is* that rule, expressed as an
invariant over the set rather than as a branch on a count. Prefer the invariant.

State the target as an invariant, not a delta:

> **An authorization decision must not depend on which of several equally-present
> values a tiebreak happens to select.**

### B5 acceptance criteria

- `AllTerminalLabelStages` (or your name for it) returns **every** present
  terminal stage, deterministically ordered for reproducibility, and is a new
  exported seam alongside `TerminalLabelStage` — **do not change
  `TerminalLabelStage`'s signature or its existing callers.** Other sinks depend
  on it and are being sequenced separately.
- **`TestUpdateTask_RestampingTheExistingTerminalStageStaysTaskWrite` MUST STAY
  GREEN.** This is the round-2 denial-of-work fix. A single terminal label
  restamping itself is `task:write` and must remain so. If your change makes that
  test fail, your change is wrong — do not edit the test.
- Do **not** reorder `terminalStagePrecedence` (Addendum 1 item 1 stands: no
  reorder; making it *total* is a different, safe operation and still belongs to
  round 6).

### B5 tests

New tests go in the same new file as your B1 tests
(`internal/server/authz_label_write_scope_test.go`) to keep the rebase clean.

Required cells, all at the server level, all through the real gate:

1. **Positive control that the probe can observe success.** Something ALLOWED
   with the token you are using. Without this, every DENIED below is a property
   of your request shape, not of your fix. The audit's first attempt at this used
   `dest=working` and the control **failed closed**, revealing that `working` is
   unreachable via `UpdateTask` at all. Pick your destination accordingly.
2. **Single-terminal restamp stays `task:write`** — the round-2 behaviour, pinned
   here too so a future change to B5 cannot silently take it away.
3. **The six Z4C conversions are now DENIED with `task:write` alone**, and
   ALLOWED with `task:close`. Both halves. A test that only shows denial cannot
   distinguish "correctly gated" from "broken".
4. **The three Z4E no-write cells are DENIED** — including
   `start=[ft:stage/cancelled, duplicate]`, the bare stock label.
5. **Assert the label state after refusal**, not just the error. The whole point
   of R-B is that the write erased a maintainer's label; a test that checks only
   the scope error would pass even if the labels were still clobbered.

---

## 3. What B5 still does NOT close. Do not claim it does.

Same discipline as Addendum 1 item 3. B4 (comment accuracy) now covers B5 too.

- **The fourth sink, `treewalk.go` / `computeReady`.** Both the review leg and
  the security leg found it independently, by execution — 5 of 5 and 7 of 12
  probed sets bypass. It is latent only because `WithEphemeralPool` has no
  production construction site. **Still not yours. Still do not edit
  `treewalk.go`.**
- **Bare stock GitHub labels being treated as authoritative terminal signals.**
  The security leg found round 4 *introduced* this: 12 cells changed answer, so a
  repository where a human applied GitHub's stock `duplicate` label now has that
  task treated as terminal — unavailable, unclaimable, filtered from ready. That
  is a regression with a product decision attached and I am escalating it
  separately. Your loop closes the *authorization* consequence of it; it does not
  make bare labels stop counting.
- **There is no audit trail at all on GitHub-backed tasks.** Every
  label-mediated transition erases its own precondition. Not yours this round.

So when you write your comment and your log entry: **name the sinks and the label
states your control covers.** Do not write "closes the terminal bypass," do not
write "closes #194." The signature defect of this workstream is a property that
holds for one consumer stated as though it held for all, and I have now walked
into it myself twice.

---

## 4. Everything else in the brief and in Addendum 1 stands.

If B5 turns out to be materially harder than the sketch suggests — in
particular if `AllTerminalLabelStages` cannot be added without touching
`TerminalLabelStage`'s existing callers — **stop and tell me** rather than
widening the change yourself. I will re-sequence.

You MUST land B1–B5, write a project log entry naming exactly which sinks and
label-set cardinalities your controls cover, commit locally (do not push), and
then mark the task complete.
