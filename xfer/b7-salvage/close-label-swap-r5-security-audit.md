# #194 round 5 — security audit (leg 1 of 3)

**Target:** `ea8ac390dad3d2401d65608684e5d6623ab15ac5`, branch `label-write-scope`,
verified by SHA against a clean tree before starting.
**Report:** `/scion-volumes/scratchpad/projects/farmtable/reports/audit-194-r5.md`

## Verdict

**APPROVE.** B1, B5 and B6 do what the round-5 log claims. The headline claim —
that the terminal→terminal conversion class is closed — reproduces
independently, 12 of 12 in both shapes, with working positive controls and a
working differential. No new bypass of the `UpdateTask` gates was found at any
prefix I could construct.

Not a statement that #194 is closed. Round 5 does not satisfy its own
invariant 1: `CreateTask` remains an unguarded write path to the value
authorization reads.

## Gate

Reproduced independently; agrees with the EM's record. `GO_BUILD_EXIT=0` (after
stubbing `web/dist`), `GO_VET_EXIT=1` with exactly the four pre-existing
copies-lock findings (`server.go:1601, :1711, :1919, :2096`, verified by request
type not line number), `GO_TEST_EXIT=0`, `MAKE_RACE_EXIT=0`. Exit codes captured
from the child, not through a pipe. Still 0 with my two probe files added.

## Findings

| ID | Sev | Summary |
|---|---|---|
| A-1 | Medium | `CreateTask` is an unguarded write path to the value authorization reads; the residual reaches the #194 end state at creation time, one-way, on `task:write` |
| A-2 | Low | A whitespace-only `push_prefix` silently disables B1, B5 and B6 together; no config validation |
| A-3 | Low | F7 is RPC-reachable on a `task:write`-only token via the surviving `from == to` short-circuit (reachability extension of a known item, not a re-file) |
| A-4 | Info | `TrimSpace` is unicode-aware, so the B6 prefix requirement is wider than "starts with"; not exploitable, applied consistently |
| A-5 | Info | A configured terminal alias carrying the prefix is reachable only as a double prefix |
| A-6 | Info | The `stripForMatch` refactor is a provable no-op; display behaviour unchanged |

Nothing blocks the merge.

## Charges

1. **Closed. BY EXECUTION.** Positive control first, including the one round 4
   lacked (all four terminal destinations reachable via `UpdateTask` when
   `task:close` is held). `add_labels[Y]` on `[X]`: 0/12 converted, 12/12 denied
   naming `task:close`, 12/12 allowed once it is held. `UpdateTask(stage=Y)` on
   `[X,Y]`: same. Added a third shape the log does not tabulate —
   `remove_labels[X]` from `[X,Y]` — also 12/12 gated.
2. **No bypass.** 25-row adversarial matrix plus a 9-prefix × 117-label
   differential sweep. Double/triple prefix, infix prefix, fullwidth, Cyrillic,
   Turkish İ, ZWSP, combining marks all fail closed. Prefix-substring configs do
   not promote bare stock labels, with a per-prefix positive control.
3. **Not exploitable, for a reason that survives a new caller.** Both consumers
   of the singular reader ask a *boolean*, never *which* stage, and every
   terminal stage satisfies both — so the set is never weaker than the winner.
   Fragile point named: safety rests on the round-6 fail-open tiebreak item, and
   would break for any new caller reading the singular reader's *identity* for a
   privilege decision.
4. **`from == to` fires at cardinality 0 and 1**, five shapes; four write
   nothing a `task:write` token should not. The fifth is A-3. **REV9's premise
   holds** — proved the close counter can reach 1 (so `closeCalls == 0` is a
   measurement, not a vacuous assertion), then asserted the strictly stronger
   property the counter proxies for: issue STATE unchanged across 9 destinations
   from open and 3 from closed, no reopen.
5. **Residual is real, one-way, and narrower than it first looks.** Severity
   read: Medium. Blast radius is the caller's own new task; born-terminal
   children do **not** unblock parents (`hasOpenSubIssue` and `computeReady` key
   off issue state, not labels).
6. **Custom prefix honoured end to end** — 12/12 denied under `acme:`. Exhaustive
   grep: `treewalk.go:156-157` is the only other hardcoded prefix, the known
   out-of-scope item. Nothing else in the authorization path shares the defect.

## Disclosures

- My server probe **reuses** the developer's fixture helpers from
  `authz_label_write_scope_test.go`. Declared dependency: if they are wrong, my
  charge-1/-4/-5/-6 results are wrong with them. Expectations, terminal-stage
  list and terminal-label test are my own.
- **My own prediction was wrong once**: I expected a leading NBSP to defeat the
  prefix match. `TrimSpace` is unicode-aware; it does not. Row kept with the
  wrong prediction recorded beside the right answer.
- **One finding withdrawn**: `InsertTasksAfter` filed as a second unguarded
  creation verb from a static read, withdrawn after measuring `Unimplemented`
  on the pass-through store.
- **Fixture gaps, named not glossed**: the single-issue mock conflates create
  with update (charge 5's terminal reading was observed on the pre-existing
  task, and A-1's severity is written around that limit); the custom-prefix
  `CreateTask` cell measures nothing and is renamed
  `..._FIXTURE_CANNOT_EXPRESS_THIS`.
- **Not established**: cardinality 3 end to end; anything against live GitHub;
  **concurrency — a TOCTOU between `LabelDeltaLifecycleStages` and the actual
  label write is not excluded by anything I did.** Worth a later round.
- No production code modified: verified by sha256 against a pre-work manifest of
  all five changed files (all OK) and by `git status --short`.
- I did not read the other legs' reports or working files.

## Artifacts

- `internal/platform/github/audit_r5_prefix_probe_test.go` (8 tests, charges 2 and 3)
- `internal/server/audit_r5_probe_test.go` (11 tests, charges 1, 4, 5, 6)
- Logs: `/scion-volumes/scratchpad/projects/farmtable/salvage/r5-audit-194/`
