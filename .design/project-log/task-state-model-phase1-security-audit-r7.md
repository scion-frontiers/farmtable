# Security audit — #194 round 7 (combined)

**Scope:** branch `label-write-scope-r7`, HEAD `1d4442f`, base `6ced24e`.
16 files, +1185 / −117 excluding `.design/`. Independent audit; a code reviewer and a
test engineer worked the same SHA in parallel without visibility into this work.

Full report: `/scion-volumes/scratchpad/projects/farmtable/reports/audit-194-r7.md`
Harness: `.../reports/audit-194-r7-harness.go.txt` (run in-tree, then deleted; no
production code modified).

## Verdict

**A-4's fix holds.** 38 evasion attempts across two attack directions produced zero
bypasses, from a harness whose positive controls both fired first. **But leg A's
unconfirmed §3 lead is CONFIRMED**, and one fix in this same diff is what makes it
reachable.

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
