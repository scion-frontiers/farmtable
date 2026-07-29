# PRE-REGISTRATION — import/writable question
Written BEFORE measurement, at eng-manager request (05:54Z).
Tree: /workspace/farmtable-xss-r5-audit @ d305391 (worktree HEAD 8f92a09 on audit-leg-xss-r5).
Premise taken as GIVEN from the review leg; I am not re-measuring the two Lit read sites
or the zero-writer sweep unless my own trace contradicts them.

## DISCLOSURE OF PRIOR — I am not blind on this question

I already own a finding on this exact key. My r5 report's **F4 (MEDIUM, PASS-1)** reads:
"`writable` capability gate exists **only in Lit**; zero occurrences in non-test Go.
Passthrough `UpdateTask` really mutates GitHub. Out of scope, non-blocking."

So I arrive with (i) the same zero-writer result the review leg measured, reached
independently, and (ii) a belief that passthrough UpdateTask reaches GitHub for real.
That second one is load-bearing for branch C and I have NOT verified its authorization
side. My prior is therefore tilted toward "the flag is not the boundary, the server is."
**A pre-registration written by someone with a prior is worth less than one written
blind, and I am saying so rather than pretending otherwise.**

I also carry one measured fact that cuts AGAINST the "server never reads collection
remote_data" story: `graph_support.go`'s `collectionSupportsGraph` reads
`c.RemoteData["graph_queries"]` with a `v.(bool)` check. **Server-side branching on
attacker-influenceable collection remote_data already exists in this codebase.** That is
precedent, not proof, and it is a feature gate rather than an authz gate. But it means
"the server would never do that" is not available to me as an argument.

## The three branches the eng-manager asked me to pre-commit

### BRANCH A — Q1 YES, Q2 NO
(Author-chosen remote_data reaches a GitHub-platform collection, but only via a principal
who already holds write authority over that collection.)

CONCLUSION I WILL WRITE: **`writable` is not a privilege boundary on the import path.**
A principal who can already write the collection gaining the ability to set a flag about
that collection is not an escalation; it is a tautology. Severity driven entirely by the
(c) measurement, expected LOW/INFO.

**PRE-COMMITTED SUB-CASE, so I cannot discover it conveniently later:** if the collection
is readable by principals OTHER than the importer, then A is NOT benign — it becomes
stored capability-confusion, one principal setting a UI capability flag that a different
principal's browser obeys. If that is the shape, I will report it as such and severity
rises to MEDIUM at least, independent of server gating, because the affected party is not
the actor. **I must therefore check collection read-scope before I call branch A benign.**

### BRANCH B — Q1 NO
(No import document can put an author-chosen remote_data onto a GitHub-platform collection.)

CONCLUSION I WILL WRITE: **the escalation story dies at step one and I will say so
plainly, including that the eng-manager's handed-me story was the thing I killed.** The
residue is a dead branch: a gate reading a key nothing writes always takes the else path,
and the else path is everything-disabled — **fail-closed dead code, which is not a
vulnerability.** Severity INFO, recommendation to delete or pin the branch.

What I will explicitly NOT claim in branch B: that the key can never be set. Out-of-tree
writers (hand-edited DB, a different producer build, a migration, a future adapter) are
outside what I can measure read-only, and a zero-writer sweep is an unproven zero unless
I show the sweep can find a writer. **§10.20 applies to my own sweep here** — I will run
a positive control on the search that produces the zero, or mark it UNCHECKED.

### BRANCH C — Q1 YES, Q2 YES, but the server independently authorizes every capability
CONCLUSION I WILL WRITE: **cosmetic UI lie, not an escalation.** The flag buys the
attacker rendered buttons whose invocations the server rejects. Severity LOW. The real
finding becomes latent-coupling: a client-side capability flag persisted in
attacker-influenceable storage is a trap for the next change that decides to trust it,
and the codebase ALREADY has a server-side read of collection remote_data
(`graph_queries`) showing that decision is one commit away.
Recommendation: server must never consult it, and the client must say why.

**The honesty condition on branch C:** "the server gates every capability" is a universal
claim over the GitHub capability set. If I cannot enumerate that set and check each
member, I do not get to fire branch C. Partial coverage fires as "branch C for the
members I checked, UNCHECKED for the rest" and severity stays open. I will not launder
an unenumerated universal into a clean LOW.

### The fourth outcome, unprompted, which the three branches do not cover
Q1 YES, Q2 YES, and some capability is NOT independently gated server-side. Then the flag
is a real privilege boundary and it is attacker-settable. **HIGH.** The eng-manager gave
me three branches; this is the one they omit, and omitting it would let me record a miss
as unanticipated. Pre-registering it now.

## Falsifiers for the specific measurement that decides severity

- I predict the server does NOT read `remote_data["writable"]` anywhere in authz.
  FALSIFIED IF: any non-test Go reads that key on a decision path. Positive control
  required on the search, per §10.20.
- I predict the mutating RPCs (UpdateTask and the GitHub-set siblings) authorize from the
  request principal + collection ownership, NOT from any client-supplied capability.
  FALSIFIED IF: a handler trusts a client-sent capability/flag field.
- I predict import platform is taken from the DOCUMENT, not the server.
  FALSIFIED IF: the importer overrides platform server-side or rejects non-farmtable
  platforms. NOTE: my r5 F-series recorded that EXPORT is gated to `PlatformFarmtable`.
  **Export being gated says nothing about import being gated** and I will not let the
  symmetry assumption stand in for a measurement.

## §10.25 commitment
Every guard I conclude holds, I will state the surroundings I chose for it. Every absence
claim gets a positive control or the tag UNCHECKED. No unproven zeros.
