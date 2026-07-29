ADDENDUM 3 to your brief. One new deliverable, **B6**. It is in the same
function you are already rewriting for B5, which is the whole reason it is
arriving now rather than next round.

Read §4 first if you are worried about how much this brief has grown. There is a
real escape hatch there and I mean it.

---

## 1. Why this is arriving mid-round

The round-4 security audit found that the round-4 fix **introduced** a
regression. Because the scan now reads the whole label set instead of one
precedence winner, GitHub's stock `duplicate` label — and any independently
created `wont_fix`/`completed`/`cancelled` label — is now an **authoritative
terminal signal**. Twelve cells changed answer BY EXECUTION:

```
[duplicate,  ft:stage/accepted]  round4="duplicate"  TERMINAL  |  round3="accepted"  non-terminal
[wont_fix,   ft:stage/accepted]  round4="wont_fix"   TERMINAL  |  round3="accepted"  non-terminal
[completed,  ft:stage/accepted]  round4="completed"  TERMINAL  |  round3="accepted"  non-terminal
[cancelled,  ft:stage/accepted]  round4="cancelled"  TERMINAL  |  round3="accepted"  non-terminal
   ... 12 cells total across the non-terminal masks
```

Round 3's precedence collapse *hid* these. The fix revealed them. This is also
the label state that the no-write conversion variant in Addendum 2 needs — a
human applying a stock label is what puts two terminal labels on an issue without
any attacker action.

I escalated this as a product question. **The coordinator ruled it engineering,
not product, and directed it shipped inside this round.** Verbatim:

> "Require the configured prefix for any label feeding an authorization or
> terminal-stage determination; keep prefix-tolerant matching for display purposes
> only. Restoring or tightening an existing security boundary does not need fresh
> sign-off, it needs to be correct, and letting a stock GitHub label with a lower
> permission bar than an explicit farmtable label drive an authorization-relevant
> answer is exactly the kind of accidental loosening that rule exists to catch."

So you are not waiting on anyone. Build it.

---

## 2. B6 — the configured prefix is required for authorization inputs

**The invariant** (state it this way in the code comment, not as a delta):

> **A label may contribute to an authorization or terminal-stage determination
> only if it carries the configured push prefix. Prefix-tolerant matching is a
> display affordance and must not reach a security decision.**

Sketch from the audit; shape is the requirement, spelling is yours:

```go
// TerminalLabelStage / AllTerminalLabelStages — only honour labels that are
// unambiguously ours.
for _, raw := range labels {
    l := strings.ToLower(strings.TrimSpace(raw))
    if m.pushPrefix != "" && !strings.HasPrefix(l, m.pushPrefix) {
        continue   // a bare "duplicate" is a human's triage note, not a Farm Table assertion
    }
    if stage, ok := m.labelToStage[m.stripForMatch(raw)]; ok && store.IsTerminalStage(stage) {
        present[stage] = true
    }
}
```

**Scope it precisely.** B6 applies to the terminal-stage / authorization readers —
the function you are extending for B5 and its single-answer sibling. It does
**not** apply to `MapLabelsToStage`, which is the display projection and should
stay prefix-tolerant. If you find yourself editing a display path, stop; you have
drifted.

**Do not try to avoid the twelve newly-denied cells.** I asked, and the ruling was
explicit that they are accepted:

> "That is a real, now-visible regression, but it is a **safe-direction** one —
> tasks incorrectly marked unavailable, not incorrectly granted access — and it is
> the acceptable interim cost of closing a live authorization hole. Do not hold
> the security fix hostage to the larger rework."

The long-term fix is moving authoritative state off labels entirely. That is
tracked and it is not yours.

### Existing tests will break. INVERT them, do not delete them.

There are tests pinning bare stock labels as terminal — the audit measured
`duplicate` alone as terminal under round-4 code. Those tests are now asserting
the wrong thing.

**Rewrite each one to assert the new behaviour, with a comment naming this ruling
and why.** Do not delete any of them, and do not weaken one into a form that
happens to pass. This workstream has already produced *tests that disappear
instead of failing*, and a deleted test is indistinguishable at review time from
a test that never existed. If you believe a test genuinely has no successor,
say so in your log entry and name it — do not make that call silently.

One narrowing you can rely on, measured by the test leg: **stock `wontfix` (no
underscore) does NOT match** — only `duplicate` plus independently created
labels. So the real-world exposure is smaller than the four-label table suggests.
Do not overstate it in your log entry.

### B6 tests

In your new test file, same as before.

1. **Vary the configured prefix.** This is the important one and it does not
   exist anywhere in the repository today. The test leg found that **no test
   anywhere varies `LabelConfig.Stages`** — the mapper configuration is held
   constant across the entire codebase, which is a dimension nobody thought of as
   an input. B6 makes `push_prefix` load-bearing for *security*, so it cannot
   stay an untested constant. Cover at minimum: default `ft:`, a custom prefix
   like `acme:`, and empty.
2. **A bare stock `duplicate` alongside `ft:stage/accepted` is NOT terminal** and
   the task stays claimable/available/ready.
3. **A prefixed `ft:stage/duplicate` IS still terminal** — the positive control.
   Without it, B6 passing proves only that you broke the function.
4. **Under a custom prefix, `acme:stage/completed` is terminal and
   `ft:stage/completed` is not.** This is the cell that proves you read the
   configuration rather than hardcoding a second string.

### One cheap verification I want measured, not assumed

The audit claims B6's fix also closes its F7: `StageLabelSwap` currently treats a
human's stock GitHub label as one of ours and **deletes** it during a normal stage
change. The audit's evidence was unit-level only and it explicitly declined to
extend the claim.

After B6, measure it: does `StageLabelSwap([duplicate bug], working)` still emit
`REMOVE=[duplicate]`? **Report what you measure, either way.** If B6 does not fix
it, say so plainly — that is a useful finding and I would rather have the true
narrow answer than the tidy broad one. Do not fix it if it is still broken; just
report it.

---

## 3. Still not yours. Unchanged.

- `treewalk.go` — the fourth sink, and `hasExternalUnavailableLabel`. The latter
  is the *same prefix theme* as B6 (it hardcodes `"ft:"` and `"stage/"` and can
  see neither `m.enabled` nor the configured prefix), and it is genuinely
  tempting now that prefix handling is on your mind. **Leave it.** It is in the
  file that is being sequenced separately and it would collide.
- Reordering `terminalStagePrecedence`, the fail-open tiebreak, the enum-rooted
  pins, the audit-trail gap.

**Claim accuracy, third time.** B6 closes bare stock labels as an authorization
input. It does not close the fourth sink, the prefix gap in
`hasExternalUnavailableLabel`, or holds being ignored under a custom prefix.
Name what you covered.

---

## 4. The escape hatch, and it is real

This brief has now grown twice under you. That is my doing, not yours, and I am
aware that "one more small thing" is exactly how a reviewable change becomes an
unreviewable one.

B6 is here because it edits the same function as B5 and splitting them would put
two rounds of changes inside one function. If that premise turns out to be false
when you are actually in the code — **or if B1+B5+B6 together stop being one
coherent reviewable change** — stop and tell me. I will pull B6 into round 6 and
take the rebase cost. That is a cheap trade and I would rather pay it than
receive a change no reviewer can hold in their head.

Say so early rather than at the end. A mid-round re-sequence is routine; a
finished change that has to be split is not.

You MUST land B1–B6 (or tell me which one you are handing back and why), write a
project log entry naming exactly which sinks, label-set cardinalities and prefix
configurations your controls cover, report the F7 measurement either way, commit
locally (**do not push**), and then mark the task complete.
