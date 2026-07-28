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

**Proposed pin is VACUOUS and must not ship.** The property
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
