# Close Label Swap Security Audit R4

Date: 2026-07-28
Branch: `close-label-swap`
Reviewed head: `03ab6b63287b29b079afac30f7a0fb345052a521`
Verdict: `REQUEST CHANGES`

## Scope

R4 audited the landed fix for #194 ("Fix #194 multi-label terminal bypass at the
root"), which introduces `LabelMapper.TerminalLabelStage` — a set scan over all
labels — and routes three authorization/availability sinks through it instead of
through the precedence-collapsed display projection.

Charges:

- Confirm the Critical is closed, then extend the round-3 PoC along the two axes
  it could not express: multi-call, and destination-varying.
- Search for the next spelling of the defect class — any other place where
  authorization or availability derives from a label-derived value.
- Determine what an attacker gains by choosing which terminal stage the
  `terminalStagePrecedence` tiebreak reports, beyond the sequenced `from == to`
  residual, and what happens on enum drift.
- Verify the `!m.enabled` guard by execution and sweep for other label-derived
  paths that skip it.
- Re-derive stock/unprefixed label exposure under the new set scan.
- Treat the self-erasing property of the bypass as its own detection question.

## Result

**The Critical is closed.** Confirmed independently and extended: 112 unit cells
over the full terminal power-set (0 blind, order-independent) and 156
server-level authorization cells (0 bypass lines), on a harness proven able to
express both success and failure. The only allowed cells in the 40-cell
destination-varying matrix are the four `from == to` diagonals, which is the
already-sequenced residual.

Changes are requested on findings that are not the sequenced residuals:

- **HIGH** — `computeReady` (`treewalk.go:36`, `:92`) still derives readiness
  from `MapLabelsToStage`, the display projection the fix's own comment forbids
  authorization from using. 5 of 5 attack cells bypass. Latent today only because
  `GitHubPassThroughStore.GetReadyTasks` is reachable only through an ephemeral
  pool that has no production construction site — #202 is what wires it, so the
  disclosed remediation plan activates a live bypass.
- **HIGH** — the terminal tiebreak is attacker-selectable. Adding a label can
  only lower the winning rank, so a `task:write` holder can perform exactly the
  6 of 12 terminal→terminal conversions where `rank(dest) < rank(start)`,
  including `cancelled -> completed`. The old label is removed and the new one
  applied, so these are real state changes. Three realistic label states reach
  the same conversions with no attacker label write at all.
- **MEDIUM** — GitHub-backed tasks have no audit trail: the pass-through store
  stubs the whole `Change` interface, the event bus emits only post-change state,
  and the gate's lifecycle input is discarded after the comparison. Every
  label-mediated transition therefore erases its own precondition. Confirmed
  against a native-task control that does produce change rows.
- **MEDIUM** — `hasExternalUnavailableLabel` (`treewalk.go:153-164`) is a
  package-level function with no mapper, so it honours labels when mapping is
  disabled and ignores a configured non-default `push_prefix`. It feeds
  `issueUnavailableForClaim`, which is enforcement.
- **MEDIUM** — the set scan widens unprefixed stock labels into authoritative
  terminal signals in 12 cells that round 3's precedence collapse hid. A
  regression introduced by this fix, landing on repositories that used GitHub
  labels before adopting Farm Table.
- **LOW** — enum drift path 2 (a terminal stage in the enum but absent from
  `allStages`) is unguarded and the shipped guard would pass vacuously, because
  the guard draws its universe from `allStages` itself.
- **LOW** — a normal stage change deletes human-applied stock GitHub labels,
  because bare stage names are registered as lookup keys.
- **INFO** — a clean checkout cannot `go build ./...` before `make web`.

## Gate

Reproduced independently, exit codes captured from the child process:

```
go build ./...   rc=0   (after `make web`; see INFO finding)
go test ./...    rc=0
make race        rc=0
go vet ./...     rc=1   — exactly 4 pre-existing copies-lock findings, all in
                          internal/server/server.go (:1516 :1626 :1834 :2011)
```

Full agreement with the shared brief.

## Positive observations

Declaring `terminalStagePrecedence` separately rather than filtering
`stagePrecedence` is the right structural call. The comment naming the display
ordering as a display rule is what made the next spelling findable. Three sinks
were corrected in one change rather than one per round, and a drift guard shipped
with the fix.

## Notes

Full report, including proof-of-concept output, recommended patches and
methodology disclosures, is at
`/scion-volumes/scratchpad/projects/farmtable/reports/audit-194-r4.md`. Probes
and raw output are salvaged under
`/scion-volumes/scratchpad/projects/farmtable/salvage/audit-194-r4-*`.

The audit reused the round-3 stateful GraphQL harness and its fail-closed
self-check rather than rebuilding them. Two positive controls fired during the
run and changed the work, which is the intended behaviour after the round-3
false negative. One priming disclosure is recorded in the report: the shared
salvage file was overwritten by a concurrently running leg mid-read, exposing
that leg's answer to the tiebreak charge; the mechanism was re-derived and the
prediction encoded in the test before execution.

No production code was modified.
