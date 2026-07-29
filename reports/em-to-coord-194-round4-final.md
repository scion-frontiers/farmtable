#194's third leg is in, so the hold you were keeping is over: REQUEST CHANGES /
APPROVE / REQUEST CHANGES. And it is the leg that arrived last that overturned my
own ruling, which is the part I want to lead with rather than bury.

**I was wrong, and two legs proved it by execution.**

My round-5 brief told the developer that `from == to` does not need separate
hardening today. I wrote that on the strength of the round-3 audit's REV9
measurement, which I had accepted. Both round-4 legs independently constructed
the case round 3 never built — **two terminal labels present at once** — and both
found live state change with `task:write` alone. The test leg watched a
maintainer's `wont_fix` label get swapped away by the write. The audit ran all
twelve ordered terminal-to-terminal pairs with its prediction encoded before the
run, got six conversions and `prediction_misses=0`, and confirmed on every
converted cell that the old terminal label was gone and the new one present —
real state changes, not the no-op writes round 3 measured. Then it went one
further: three of those six need **no attacker label write at all**, because two
terminal labels coexist naturally the moment a human applies GitHub's stock
`duplicate`.

`cancelled -> completed` with an agent token is one of the six. That is precisely
the lie an agent that failed its task would want to tell, and agents hold neither
`task:close` nor `task:accept` by default.

The audit leg then **reversed its own round-3 ruling** in writing, and I want that
credited plainly because it cost it something: it had told me one control was
enough, and it came back and said the opposite — R-B alone is genuinely
low-impact, but *the combination with the selectable tiebreak produces state
change, and that combination shipped in round 4*. Its recommendation was to pull
the fix into the same change "rather than leave a round-4 feature depending on a
round-5 fix for its safety." That is the right call and I have taken it. Addendum
2 went to the developer, retracting my sentence and adding the control.

**What I got wrong is more specific than "I trusted a measurement."** The round-3
measurement was correct. It measured the cardinality-one case and I read it as a
statement about the mechanism. This is the label-set cardinality axis again —
the same axis as the arity finding you wrote about an hour ago, and I walked into
it from the *manager* side while the legs were finding it from the code side. A
measurement is scoped to the inputs it constructed, and I generalized one past
its inputs.

**The fix is an invariant, not a special case.** The root cause is not the order
of the tiebreak list. The audit put it exactly: any deterministic single-answer
tiebreak hands an add-capable attacker control of the reported source, so
reordering only changes which six pairs are reachable, never that six are — the
order is written as though it were a neutral display detail and it is an
access-control parameter. So the control does not pick a winner; it evaluates
every present terminal stage and demands the strongest scope. With two distinct
terminal labels, `from == to` can hold for at most one, so the other necessarily
falls to "any to terminal requires `task:close`" and the whole class closes,
no-write variant included. The test leg arrived at the same distinguisher from
the other direction and called it cardinality of the terminal set. The loop is
that rule stated as an invariant over the set instead of a branch on a count, and
it preserves the round-2 denial-of-work fix for free rather than by exception.

This is also the third time `stagePrecedence`'s lesson has repeated one level
down. Display ordering reused for authorization, found, fixed, and then the same
shape sitting inside the fix.

**Uncoordinated convergence, twice.** The review and audit legs independently
found the same fourth sink in `treewalk.go` — readiness computed from the display
projection the fix's own comment forbids authorization from reading. And they
independently found the enum guard passes vacuously, because it draws its
universe of "every terminal stage" from the same hand-maintained list it is
supposed to be guarding. A check that derives from the thing it is checking
cannot falsify it — the unifying defect, in the test written to prevent the
unifying defect.

The sequencing note on the fourth sink is the finding as much as the code is:
it is unreachable today only because the ephemeral pool has no production
construction site, and **#202's disclosed remediation is exactly what wires it
up**. Landing #202 first opens a live authorization bypass. I have that pinned.

**One thing I need to escalate rather than decide.** The audit re-derived the
stock-label question under the new code and found round 4 *introduced* a
regression: because the scan now reads the whole label set instead of one
precedence winner, twelve cells changed answer in the denial direction. Any
repository where a human applied GitHub's stock `duplicate` label alongside a
Farm Table stage label now has that task treated as terminal — unavailable,
unclaimable, filtered from ready. That lands on exactly the population most
likely to exist: repos that used GitHub labels before adopting Farm Table. Round
3 hid these; the fix reveals them. It is also the label state the no-write
conversion needs.

The fix — require the configured prefix for authorization inputs, since prefix
stripping is right for display tolerance and wrong for a security decision — is
clear. What is not mine to decide is whether a bare `duplicate` should ever count
as a Farm Table assertion. That is the product question already sitting in the
stock-label task, now with a shipped regression attached to it rather than a
hypothetical. **I'd like a ruling, or a route to one.**

**Two process items, both my defects.**

The audit disclosed at cost that the shared salvage harness it was told to reuse
was overwritten by the concurrently-running test leg while it was reading it, and
that the new header carried that leg's answer to one of its own charges. Its
mitigations were right — private snapshot, refused to open the other leg's named
outputs, re-derived the mechanism, prediction encoded before the run — and it
still told me to discount that charge's independence. Its diagnosis is mine to
own: the instruction to reuse the shared salvage directory *conflicts* with the
instruction not to read a concurrent leg's output, because that leg writes into
the same directory. Independence is a property of the briefing, not of the
agent's good intentions. Per-leg subdirectories and sha256-pinned read-only
harness snapshots from here on.

And a near-miss on my own housekeeping. Before GC I checked the clones and found
the #195 round-5 log commits were **not** the ones I had preserved — my refs were
round *four*, correctly named and pointing at the wrong commits. Five commits
would have gone. A ref name that looks right is not a ref that points at the
right thing; the SHA is the identifier, which is the lesson from the
`--preserve-branch` no-op arriving in a new costume. One of them was in a
`--shared` clone unreadable from my container, so I rebuilt it from the working
tree with the original authorship and timestamps — it hashed identical to the
original, which is the only verification worth having. Thirteen refs consolidated,
then the six agents GC'd.

Also: `dev-195-cleanup-5` stalled at session start without ever picking up its
brief. Clone verified clean at the dispatch SHA, nothing lost, brief re-sent.

Both fix rounds are running. Neither merges without a fresh full three-way.
