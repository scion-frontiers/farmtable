# Security audit — #194 round 7 (combined)

**Scope:** branch `label-write-scope-r7`, HEAD `1d4442f`, base `6ced24e`.
16 files, +1185 / −117 excluding `.design/`. Independent audit; a code reviewer and a
test engineer worked the same SHA in parallel without visibility into this work.

Full report: `/scion-volumes/scratchpad/projects/farmtable/reports/audit-194-r7.md`
Harness: `.../reports/audit-194-r7-harness.go.txt` (run in-tree, then deleted; no
production code modified).

## Verdict

> **Partly superseded — see the Addendum at the foot of this file.** A Critical cross-list
> bypass (C-1) was withheld from the brief by design and disclosed after filing; the audit
> did not find it. The §1 and §2 conclusions below are revised there.

**A-4's fix holds *on the single-label, single-list spelling axis*.** 38 evasion attempts
across two attack directions produced zero bypasses, from a harness whose positive controls
both fired first — but that scope qualifier is load-bearing and was missing from the
original filing. **Leg A's unconfirmed §3 lead is CONFIRMED**, and one fix in this same diff
is what makes it reachable.

## Findings

- **HIGH — lifecycle labels destroyed/forged via the `priority`/`type` arms of
  `UpdateTask`.** `GitHubConfig.Validate` checks alias-key collisions *within* each of
  `stages`/`priorities`/`types` but never *across* them. `stripForMatch` reduces
  `ft:stage/duplicate` to `duplicate`, which is both a lifecycle stage and a label GitHub
  ships in every new repo. With `types: {duplicate: chore}` — a config mentioning no stage
  at all — `UpdateTask(type=feature)` removes a maintainer's `ft:stage/duplicate` under
  bare `task:write`. Those two arms carry no transition gate and are not covered by
  `RestrictLabelWriteToSnapshot`, which is applied only to `req.AddLabels`/`RemoveLabels`.
  **Newly reachable because of M-1 in this same diff:** before it, `NewPlatformResolver()`
  hardcoded a `nil` config, so the server always ran `DefaultConfig()` and a custom `types`
  map never reached the server store. M-1 is a correct fix that opens this door.
- **MEDIUM — `req.Type` is unvalidated.** Unlike `stage` and `priority` it gets no
  `validateDefinedEnum`. An unknown type yields no add label but the remove loop still
  runs, stripping every type label on the issue.
- **LOW — `CloseTask` does not check `req.Stage` is terminal**, so a `task:close` holder
  can close an issue and stamp a non-terminal stage label on it.
- **INFO** — `ft connect` builds the pass-through server without `TokenAuthInterceptor`
  (pre-existing; bufconn, process-local). Unwired GitHub/beads adapters call `UpdateTask`
  with no scope check and no production constructor.

## §2 — where the control is bound

Enumerated all 8 label-mutation call sites with the gate named. "The other paths are
ungated" is **not** the finding: `ClaimTask` (:662) requires `task:claim`, `CloseTask`
(:764/:772) requires `task:close`. Binding at `writeLabelSwap` is **not possible as shaped**
— it sees only the store's fresh read, and narrowing against a fresh read is precisely the
defect the fix rules out. Binding at the server, where the gate and the authorized snapshot
already sit together, is correct; moving it would require threading the snapshot through
`UpdateTaskParams` into every store, with a fail-open default for any store that forgot.
The real consequence of that constraint is the HIGH above.

## §4 — dependence on non-empty scopes

Nothing in the diff is silently broken by the fail-open empty-scopes branch, and notably
**`RestrictLabelWriteToSnapshot` is not a scope check** — it is the one control #194 adds
that still functions under the live NULL-scopes credential. M-2's rejection likewise.
The exposure is the diff's *narrative*: the new code is documented throughout as "the
second half" of an invariant whose first half currently prices nothing, so a future reader
will over-count the protection. Remediation order must be grant scopes → verify traffic →
then close the branch.

## Gates

`make web` 0 · `go build ./...` 0 · `go test ./...` 0 (no `WatchTasks` flake this run) ·
`go vet ./...` 1 with exactly 4 pre-existing `copylocks` in exactly `GetReadyTasks`,
`GetBlockedTasks`, `GetCriticalPath`, `GetBottlenecks` · `make race` 0 — but it runs only
`./internal/platform/github/`, giving no race coverage of the `internal/server` and
`internal/store` changes in this diff.

## Process notes

Two void/near-void runs recorded in the report. The second matters: an early §3 config
produced empty swap results that read as a clean kill, but was vacuous — the requested
value matched the one already present, so both swaps short-circuited. Added explicit
prerequisite assertions, re-ran, and got the confirmation. The void version would have
reported a confident wrong answer.

Two errors found in the brief, chiefly: §2 describes `writeLabelSwap` as "the narrowest
point every path must traverse" while the same section correctly counts 2 raw mutation
calls outside it — it covers 6 of 8 sites, not all.

## Addendum — C-1 cross-list bypass (disclosed after filing)

The coordinator withheld a counterexample from the brief by design, to test whether a
security audit would find it unaided. **It did not.** Verified independently from source:

    UpdateTask{add_labels:["ft:stage/completed"], remove_labels:["ft:stage/completed"]}

on a task whose snapshot lacks that label. `applyLabelDelta` builds `removed` first and
skips those keys — remove wins — so `before == after` and no scope is charged.
`RestrictLabelWriteToSnapshot` filters the two lists in independent loops with no
cross-list test, so the add survives and the remove is dropped. The terminal label is
applied under bare `task:write`; reversal costs `task:accept`. **Critical, and a
regression introduced this round** — at `6ced24e` both lists passed through verbatim and
the request netted to nothing.

**Why the audit missed it — the diagnosis matters more than the finding.** Not an input
space problem: the harness already accepted both lists, and fed the counterexample
unmodified it returned `exploit=false` silently. The defect was the **oracle**. I hand
rolled "what did the gate charge?" as a per-label, per-list `present[key]` test; the real
gate prices *jointly* across both lists. Any defect in the interaction between the lists
is invisible to a per-label oracle no matter how many spellings are enumerated — so the
one-dimensional search was a symptom, not the cause. Spellings were the only axis the
instrument could read. The production docblock states the restrictor "must agree" with
`applyLabelDelta`; I quoted it and then built an oracle that reimplemented that very
function, committing in the harness the same error the code committed.

Rule for r8: **when auditing a control whose contract is "mirrors F", the oracle must BE
F.** Also: a positive control calibrates only the axis it is drawn from — mine fired on
the old bug's axis and licensed a far broader negative claim than it validated.

**Proposed fix is sound** (8 attempts on the fixed form, 0 residual), provided the
cross-list test uses `labelMatchKey` and not `==`.

**~~Proposed pin is VACUOUS and must not ship.~~ — WRONG, RETRACTED in Addendum 2 below.
Measured against the real implementation the pin fails on C-1 and on a case-blind mutant.
It ships. The paragraph is kept only to show how the error was made; do not cite it.** The
property
`applyLabelDelta(snap, Restrict(...)) == applyLabelDelta(snap, add, remove)` is satisfied
by the identity function — i.e. by the pre-fix A-4 code itself. Measured `true` in all 8
rows; it never discriminates. Shipping it would re-commit in r8 exactly the false
guarantee r7 retracts in `labels.go`. It states safety only; doing nothing is maximally
safe. Add a minimality property (no returned entry may be a no-op against the snapshot),
which rejects the pre-fix impl on all three known defects with no false positive on a
legitimate edit. Better still: derive the narrowed lists from `applyLabelDelta` rather
than mirroring it, so agreement holds by construction.

**Relation to the HIGH: two findings, one root cause.** C-1's fix does not touch the
HIGH — those labels are generated inside the store from the `p.Type`/`p.Priority` arms,
off a fresh read, and never pass through the restrictor. Track separately; both are r8
blockers. Shared cause: "which labels are lifecycle labels, and what was charged" is
answered in four places by four different predicates.

**This revises the §2 conclusion.** I said the control could not bind at `writeLabelSwap`.
True only for snapshot narrowing. A weaker invariant *can* bind there using only the
mapper it already holds: refuse to write any label `authorizationStage` claims unless the
path is entitled to move the stage (an explicit flag set by the stage arm, `ClaimTask`
and `CloseTask`). That is a real single-point control at the narrow seam, it fixes the
HIGH structurally regardless of operator config, and it is defence in depth for C-1. I
now rate it the highest-value change available for r8.

## Addendum 2 — corrected M-1 premise, severity re-rate, and a self-correction

**M-1 is NOT shipped and NOT live.** The coordinator measured this against `origin/main`:
`NewPlatformResolver()` takes no config there, `DefaultConfigPath` does not exist there,
and `1d4442f` is not an ancestor of `origin/main`. M-1 exists only in the unmerged #194
branch. The brief's phrase "live in production" was true of the *defect* and false of the
*fix*; the label M-1 names both. Further: `Dockerfile.server`'s final stage copies only the
compiled binary, `FARMTABLE_GITHUB_CONFIG` is absent from the live env, and volumeMounts
are null — so `.farmtable/github.yaml` **structurally cannot resolve** in this deployment
even after M-1 merges.

**My lesson, independent of the ambiguous sentence: a fact doing severity work has to be
measured, not inherited.** I hardened an inherited premise into a load-bearing rating.

### Re-rate: HIGH → MEDIUM

Not reflexive. The HOLD argument — that the only operator who can trigger this is exactly
the operator M-1 exists to serve, so benefit and exposure arrive in one act — is decisive
about **ordering** and I accept it fully. But coupling is a scheduling property, not a
severity one. Rated as if merged today it is still not exploitable: three independent
things must change, one of them infrastructure that does not exist. Holding it at High to
force sequencing would be using severity as a scheduling lever, and downstream "High"
reads as "exploitable now". The correct instrument is a merge gate.

Note the mitigator that actually bites is the **deployment shape**, not the merge status —
for a pre-merge audit everything in the branch is "not live" by definition, so
non-liveness alone can never justify lowering.

**MEDIUM, returning to HIGH on the first deployment that mounts a GitHub config file.
The Validate fix is a blocking condition on the M-1 merge commit, not next-sprint work.**

### Order changes, not just the label

1. **C-1 (Critical) is now the top r8 item** — it needs no operator config and is reachable
   under `DefaultConfig()`. Previously I had the cross-table finding first. Wrong.
2. Ship P1 ∧ P2 with C-1's fix.
3. `writeLabelSwap` ownership assertion — fixes the cross-table finding structurally and is
   defence in depth for C-1.
4. Validate cross-table check — gated to the M-1 merge.

**Knock-on:** the unvalidated-`req.Type` MEDIUM needs no config file and is reachable under
`DefaultConfig()` today, so it is now the more immediately reachable of my two findings.

### I was wrong in Addendum 1: the proposed pin is NOT vacuous

Measured against the **real HEAD implementation**, which I had never run it against:
P1 **fails** on C-1 (`add=[ft:stage/completed] remove=[]` vs a predicted no-op) and
**fails** on a case-blind mutant. The coordinator's read was right; mine was wrong.
"Must not ship as specified" is **withdrawn** — it should read "must not ship *alone*".

**How I got it wrong is the point.** I evaluated P1 against only `identity` and my `fixed`
form, neither of which exhibits a snapshot-visible divergence, saw "true in all 8 rows",
and generalised to "it never discriminates". That was a property of the implementation set
I chose, not of the property. **I committed inside the addendum the identical error I had
just diagnosed in the main report** — a conclusion silently bounded by a self-chosen
enumeration, stated as general. Twice in one audit, same axis.

**P1's real blind spot** is structural: it quantifies over outcomes *against the snapshot
only*, so it cannot see a narrowing failure that is a no-op against the snapshot but not
against drifted remote state — exactly the A-4 class. It misses the bug the function was
written for and catches the regression introduced while fixing it. No extra test input
closes that; the quantifier is the limitation. Hence P2 (minimality) alongside it.
