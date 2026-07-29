# #194 round 6 — SECURITY AUDIT leg

Read `/scion-volumes/scratchpad/projects/farmtable/briefs/farmtable-194-r6-shared.md`
FIRST and in full.

You are `audit-194-r6`. Report to
`/scion-volumes/scratchpad/projects/farmtable/reports/audit-194-r6.md`.
Classify findings Critical / High / Medium / Low / Info.

## The invariant this whole issue exists to establish

**If authorization reads a value, EVERY write path to that value must be guarded
by the same authorization.** Round 5 applied it to `add_labels`/`remove_labels`
on `UpdateTask` and missed `CreateTask`. Round 6 closed `CreateTask`. Your first
job is to decide whether the invariant now actually holds, or whether there is a
third write path nobody has enumerated.

## Prior rounds

Round 5's audit found A-1 (CreateTask), A-2 (whitespace push_prefix), A-3
(RPC-reachable fail-open destroying a stock `duplicate` label). All addressed.
Round 5's audit also reported a clean build against a stub, and its own server
probe reused the developer's fixtures — it renamed one cell
`..._FIXTURE_CANNOT_EXPRESS_THIS` rather than let it read as a pass. That honesty
is the standard.

## Targeted charges

A-1. **Enumerate every write path to the lifecycle stage.** `UpdateTask`
stage arm, `UpdateTask` labels arm, `CreateTask` stage arm, `CreateTask` labels
arm — and then find the ones not on that list. `InsertTasksAfter` returned
`Unimplemented` last round; re-verify rather than assume. Check MCP and CLI
surfaces, not only gRPC.

A-2. **The seam is open and live in the default config.** Do not re-derive it —
it is documented in the shared brief. Instead: **is it worse than stated?**
Specifically, can the collapse be used to ESCALATE (gain a stage the caller could
not otherwise reach) rather than only to DESTROY a label? Escalation would be a
severity change.

A-3. **`ft:priority:completed` authorizes as the terminal stage `completed`.**
A label in the PRIORITY namespace crossing into STAGE authorization. Nobody has
chased this. Determine its reachability and blast radius.

A-4. **The TOCTOU window** between the authorization decision and the label write
is open and acknowledged. Establish how wide it actually is and what a concurrent
caller can do with it. Do not accept "acknowledged" as "bounded".

A-5. **`Validate`'s new rejection is a denial-of-service surface** if an attacker
can influence config. Determine whether config is ever attacker-influenced.

A-6. **`CreateTask`'s gate builds a synthetic task with nil `ClosedAt`**, always
modelling an OPEN issue. Determine whether a caller can exploit the mismatch
between the modelled task and the one actually created.

A-7. **Positive control on your own probe FIRST.** Round 5's audit conflated
create with update in its mock. Build a fixture that can tell them apart, or you
will be auditing the mock.
