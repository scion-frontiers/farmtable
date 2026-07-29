You called it in advance and you were right: the residual reproduced, and it
blocks merge. Round 5 is dispatched. Three things worth your time.

**1. Both directions reproduce at the landed fix, by execution.**
D1 (remove the terminal label at task:write, then reopen) survives on all three
sinks and is self-erasing. D2 (add a terminal label at task:write, then
re-assert it) reaches 4 of 4 terminal destinations from an ordinary accepted
task, with the baseline denied for missing task:close in every case. One token,
no second actor. Critical. One control at the label write closes both.

**2. My impact claim was too strong, and the auditor caught it by measuring.**
I briefed "the task is closed as completed." It instrumented the mock and
counted closeIssue mutations: zero. passthrough.go handles Stage by swapping
labels and never touches Phase. The accurate claim is narrower and still
Critical: a task:write holder can mark any task terminal TO FARM TABLE —
unavailable, unclaimable, and reversible only with task:accept, which the
attacker does not hold. An unauthorized decline the attacker cannot itself undo.

The correction I did not expect: **the payload is step 1, not the short-circuit.**
AddLabels alone already flips Available true to false. The re-assert step only
tidies the label set into something that looks like a legitimate transition. I
had been treating the short-circuit as the vulnerability and the label write as
the setup. It is the reverse — the short-circuit is a laundering step. That
inversion is what decides where the control goes: at the label write it
intercepts the payload; at the short-circuit it would intercept only the
cosmetics. I would have put it in the wrong place.

**3. Your observation, confirmed with a consequence attached.**
The fix that closes the reopen bypass is what enables the close bypass, and the
mechanism is exact: before round 4, TerminalLabelStage collapsed
[accepted, completed] to accepted and returned not-terminal, so the attacker's
own label was invisible and could not occupy the `from` slot. Making the scan
correct is precisely what promotes an attacker-supplied label into the
authorization source.

The auditor then generalized it in a way I think is the durable result of this
branch. A bypass occurs iff rank(destination) is lower than rank(start). Every
total order has a rank-0 element; that element is universally reachable and is a
fixed point. Today it happens to be `completed`. **Reordering only moves which
stage is free — no ordering fixes this**, because it is a property of ordered
tiebreaking as such and not of the order chosen. So I have told round 5
explicitly to reject the reordering impulse. This is also why I am escalating
#203 (move the authoritative stage off labels) from refactor to **security
dependency**: every control available here is a control over a verb, and the
verb set is open-ended — UpdateTask today, bulk edit or sync or a webhook
reconciler tomorrow. Enumerating verbs is a losing game against a single mutable
field. The measurement has now pointed at #203 twice, from opposite directions.

One asymmetry that sharpens it: for a CLOSED issue there IS a floor, because
state:CLOSED is a real GitHub field and not a label, so stripping the label
lands on another terminal stage and the gate holds. For an OPEN issue carrying a
terminal label there is no floor at all — the declined status exists only in a
field the attacker can write. No second witness.

**Sequencing.** Round 5 runs in parallel with the round-4 three-way, in a
separate clone branched from 03ab6b6, so the reviewers' pinned SHA cannot move
under them; round-5 tests go in a new file to keep the rebase clean. Round 5
gets its own three-way before merge.

**Two method notes.** I stated round 5's target as an invariant rather than a
delta — if authorization reads a value, every write path to that value must be
guarded by the same authorization — since delta-shaped targets have now failed
three rounds running here. And I checked round 4 for comments claiming the hole
is closed, since a Critical living under a comment asserting it is fixed is the
worst version of this; none found, and the round-4 log already sequences the
other end as its own round.

I also told round 5 not to add a second control at the from==to short-circuit,
because the auditor measured it a genuine no-op today — but to land that probe
as a PASSING regression test whose docblock names the reason it is a no-op. It
is a no-op only because the label swap never writes Phase, which is load-bearing
and was undocumented. Under #203, or under any "make UpdateTask and CloseTask
consistent" cleanup, re-asserting a stage the labels already name becomes an
open-to-closed transition costing only task:write, with no label write for any
control to inspect. I would rather that day produce a red test that explains
itself than a silent re-opening.

**Status.** #195 r5 at 53296af: audit and code review complete, test review
running. #194 r4 at 03ab6b6: code review complete, test and audit running. I am
holding all decisions until I have read all three legs of each — that is the
mistake this brief exists to prevent, and having two of three in hand is exactly
when it would be tempting.

Per-round GC done: audit-194-r3, test-194-r3, dev-194-fixes-4, dev-195-cleanup-4
deleted. One trap worth passing on — scion's --preserve-branch silently warns and
does nothing when invoked outside a git repo, and /workspace is not one. Two
reviewer log commits existed only inside a clone I was about to delete. I
consolidated every preserved ref into my own clone first and verified them by
SHA. The flag would not have saved them.
