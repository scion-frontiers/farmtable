ADDENDUM 1 to your brief. Three items. None of them changes your scope — two
narrow a sentence I wrote badly, one is independent confirmation.

**1. Correction to B1 item 4. "Do not change `terminalStagePrecedence`" means do
not REORDER it.** It does not mean the list is untouchable.

A parallel review leg, independently and by execution, found that the tiebreak
loop **fails open**: a stage that `store.IsTerminalStage` says is terminal but
that is absent from `terminalStagePrecedence` is silently dropped and reported
non-terminal — `("", false)`, the exact value the seam exists to avoid, for a
label set that demonstrably names a terminal stage. It demonstrated this by
removing `cancelled` from the list. `MapLabelsToStage` has a fallback for the
same situation; the security-critical function is the one without it.

That is a real finding and my sentence would have told you to sit on it. It is
still **not your round** — it belongs to the round-4 follow-up and I am
sequencing it separately, so do not fold it in and do not edit `labels.go`. But
if your own work runs into it, say so rather than treating my brief as a bar.

The reason the sentence existed is narrower than how I wrote it: the *order*
must not be touched, because reordering cannot fix anything (R3.4 — every total
order has a rank-0 element that is universally reachable) and would only move
which stage is free while looking like a fix. Making the tiebreak **total** is a
different operation and is safe.

**2. Independent confirmation of your control's shape.** The same leg reviewed
the round-5 control as described and said it is the right shape with no
objection to the sequencing. You are not obliged to agree — push back if the
design is wrong — but you are not the only one who has looked at it.

**3. Something your control will NOT close, so do not claim it does.**

The same leg found, by execution, a **fourth sink** carrying the round-4 defect,
live today: `ft ready` scheduling. `GetReadyTasks` → `buildIssueTree` →
`MapLabelsToStage` (`treewalk.go:36`) → `computeReady` (`:92`, `:105`) asks
terminal-ness of the **precedence-collapsed winner**, not of the set.
`TerminalLabelStage` is not on that path at all. 7 of 12 probed label sets
schedule terminal-labelled work as ready; every cardinality-1 row passes, which
is why the shipped fixture cannot see it.

That sink is **downstream of any label state, trustworthy or not** — so your
control does not help it, and it does not help you. Two consequences for you:

- Do not describe your control as closing "the label bypass" or "scheduling."
  Name the sinks it covers. This is the workstream's signature defect — a
  property that holds for one consumer, stated as if it held for all — and B4
  exists because of it.
- If you find yourself tempted to fix `treewalk.go` while you are in there:
  don't. It is being sequenced separately and it would collide.

Everything else in the brief stands.
