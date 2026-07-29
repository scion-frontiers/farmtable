# Predictions — test-194-r7 mutation scoring

Written BEFORE any mutation was run. Derived from a static read of
`passthrough.go`, `terminal_label_stages.go`, `labels.go`, `store.go`,
`multistore.go`, `server.go`, `resolver.go` and the seven changed test files at
`1d4442f`.

Tree: `/workspace`, branch `label-write-scope-r7`, HEAD
`1d4442f1982b6e03233f1517106d0c369af1afe6`.

Gates already measured GREEN before this file was written: `make web` 0,
`go build ./...` 0, `go test ./...` 0 (0 FAIL lines, no WatchTasks flake seen),
`make race` 0.

All 14 anchors verified UNIQUE before this file was written (uniqueness is a
prerequisite check, not a measurement).

## Standing facts the predictions rest on

- **F-a.** `CloseTask` does NOT route through `writeLabelSwap`. The round-7
  refactor converted `UpdateTask` (5 sites) and `ClaimTask` (1 site) only;
  CloseTask kept its own inline, deliberately error-swallowing swap. So every
  CloseTask label test is insensitive to any `writeLabelSwap` mutation *by
  construction*.
- **F-b.** `failLabelWrites` — the fake's only knob that makes an add/remove
  label mutation fail — is set at exactly 4 sites, ALL in
  `close_label_swap_test.go`, ALL driving `CloseTask`. Nothing anywhere fails a
  label write while driving `UpdateTask` or `ClaimTask`.
- **F-c.** The `internal/server` httptest mock always answers
  `addLabelsToLabelable` / `removeLabelsFromLabelable` with success. No
  server-side test can observe a label-write error either.
- **F-d.** No test in the repository names `RestrictLabelWriteToSnapshot`. Its
  only coverage is end-to-end, through the two new A-4 tests.
- **F-e.** `LifecycleStages` → `AllTerminalLabelStages` → `authorizationStage`.
  `resolver_test.go`'s other two tests never construct a label.

## Mutation predictions

| id | mutation | scope | predicted verdict | predicted count | reasoning |
|---|---|---|---|---|---|
| M1 | `writeLabelSwap`: `add, remove = nil, nil` (whole component dead) | github | RED | **3** | replicates dev-194-combine-r7. By F-a only ClaimTask/UpdateTask notice, and only positive "the label landed" assertions can. |
| M2 | `writeLabelSwap`: `remove = nil` | github | GREEN | **0** | replication. No github-package test asserts a label was REMOVED by UpdateTask/ClaimTask. |
| M2w | same, widened | `./...` | RED | **10, all `internal/server`** | replication of the brief's §2 number. |
| M3 | `writeLabelSwap`: `add = nil` | github | RED | **3** (same 3 as M1) | replication. |
| **M4** | **`writeLabelSwap` error returns swallowed (both halves) — writes still happen** | `./...` | **GREEN** | **0** | **F-b + F-c: nothing can make a label write fail on the UpdateTask/ClaimTask path. The entire behavioural change of the round-7 refactor — error propagation — is predicted unpinned.** Headline candidate finding. |
| M4a | remove-side error swallowed only | `./...` | GREEN | 0 | as M4 |
| M4b | add-side error swallowed only | `./...` | GREEN | 0 | as M4 |
| M5 | `authorizationStage` → always `("", false)` | github | RED | **29** | dev leg measured **27** at round 6. Round 7 adds exactly two newly-sensitive top-level tests: leg B's rewritten `TestStageLabelSwap_OwnershipMatchesTheAuthorizationReader` (+1 — this is the direct proof T-F2's fix worked) and `TestNewPlatformResolver_ThreadsTheConfiguredPrefixIntoTheStore` (+1). 27+2 = 29. |
| M5r | same, restricted to `resolver_test.go`'s 3 top-level tests | github | — | **exactly 1 of 3** | §3b. By F-e. The other two pin the pre-existing fall-through arms, not `authorizationStage`. |
| M6 | A-4 control reverted at the server call site | `./...` | RED | **exactly 2** — `TestUpdateTask_FreeRemovalCannotDestroyALabelTheGateNeverSaw`, `TestUpdateTask_FreeAdditionCannotRestoreALabelTheGateNeverSaw` | §3a. |
| M7 | M-2 guard disabled (`InsertTasksAfter`) | `./...` | RED | **exactly 1** — `TestInsertTasksAfter_RejectsLifecycleStageLabels` | |
| M8 | M-1 reverted (resolver passes `nil` again) | `./...` | RED | **exactly 1** — `TestNewPlatformResolver_ThreadsTheConfiguredPrefixIntoTheStore` | nothing else builds a store through `NewPlatformResolver` with a non-default config; `cmd/farmtable-server` has no test. |
| M9 | github `RestrictLabelWriteToSnapshot` returns inputs unchanged | `./...` | RED | **2** (same two as M6) | M6/M9 are the two ends of one wire. |
| M10 | package-level `store.RestrictLabelWriteToSnapshot` never dispatches | `./...` | RED | **2** (same two) | by F-d there is no store-package unit test to add a third. |
| M11 | `MultiStore.RestrictLabelWriteToSnapshot` never dispatches | `./...` | RED | **2** (same two) | the server fixture routes through MultiStore. |
| **M14** | **`RestrictLabelWriteToSnapshot` stops folding case (query side uses raw `l`, `present` still keyed by `labelMatchKey`)** | `./...` | **GREEN** | **0** | **The only case-variant coverage is `TestUpdateTask_RemovingATerminalLabelIsDeniedWhateverTheCase`, whose probe takes the `if !reaches` branch — a `t.Logf("OVER-PREDICTION …")`, not a failure. A case-folding regression on the write side is absorbed by a log line.** Second candidate finding. |

## §1 sweep — prediction

The sweep instrument is M1 (whole write component dead) over the 13
`internal/platform/github` tests that both drive a store write and assert on
label state. Predicted classification:

- **Immune (observe the component directly, via `addCalls`/`removeCalls`):**
  `TestPassThroughCloseTask_LabelIndexFailureStillCloses`,
  `TestPassThroughCloseTask_CloseFailureTouchesNoLabel`.
- **RED under M1 (positive "the label landed" assertions):** predicted 3, drawn
  from `TestPassThroughClaimTask_BareStockLabelIsNotATerminalSignal`,
  `TestPassThroughClaimTask_ClearingTheStaleLabelRestoresClaimability`, and one
  UpdateTask stage-label test.
- **Candidate bypass shape (negative label-set assertion, no call-count
  observation, GREEN under M1):** predicted ≥1 beyond the known
  `TestUpdateTask_DoesNotDestroyAThirdPartyTerminalLabel`. I will NOT count a
  CloseTask test as a new instance without checking F-a first — CloseTask's
  insensitivity to M1 is structural, not a defect.

## §2 answer — prediction

I expect to conclude that `internal/platform/github` **should** pin its own
helper, and that the specific unpinned thing is narrower and worse than the
locality observation: not "the removal path is covered two packages away" (it
is), but **M4 — that no package pins `writeLabelSwap`'s error propagation at
all**, which is the only behaviour the round-7 refactor actually introduced.

## Capability probe (not a survival mutation)

- **C1.** Delete the `cancelled` row from `ownershipTruthTable`. Predict
  `requireOwnershipTableIsTotal` fires on the `wantOwnershipRows` pin → RED.
- **C2.** Delete the row AND set `wantOwnershipRows = 9`. Predict the
  `allStages` completeness check fires and names `cancelled` → RED.
  If both fire, the guard is genuine and is NOT a "guard nobody guards".

---

# ADDENDUM — predictions written after batch 1, before batch 2

Batch 1 produced two `WatchTasks` appearances (`TestWatchTasks_CreatedEvent`
under M2w, `TestWatchTasks_Heartbeat` under M10). Predicted to be the brief's
known flake, i.e. reproducible-green on a clean tree and unrelated to any
label path. Verification run below.

## M-SWEEP — the §1 sweep instrument

`labelNamesToIDs` → `return nil`. This kills EVERY label write in the package,
including `CloseTask`'s inline swap, which `writeLabelSwap` mutations cannot
reach (fact F-a). Any test that asserts on label state and still passes is a
candidate for the bypass shape.

- Predicted RED count in `internal/platform/github`: **8–11 top-level tests** —
  the 3 that M1 killed, plus the CloseTask positive-assertion tests
  (`WontFixSwapsToWontFixLabel`, `ClaimedThenClosedIsUnavailable`,
  `TestAudit_ReopenAfterCloseIsDisplayedOpenButNotScheduled`, and the
  per-stage close rows).
- Predicted to stay GREEN, i.e. candidate bypass shape:
  `TestUpdateTask_DoesNotDestroyAThirdPartyTerminalLabel` (the known instance),
  `TestPassThroughCloseTask_LabelIndexFailureStillCloses` and
  `TestPassThroughCloseTask_CloseFailureTouchesNoLabel` (immune for a GOOD
  reason — they observe `addCalls`/`removeCalls` directly, so they are not
  instances), and `TestPassThroughClaimTask_ClosedIssueIsNotClaimable`.

## C1 / C2 — capability probe on `requireOwnershipTableIsTotal`

The brief points at "the guard nobody guards". `requireOwnershipTableIsTotal`
gates all 20 cells of the rewritten ownership test. Neutering it in a green
suite is a tautology (every assertion survives neutering in a green suite), so
the meaningful probe is CAPABILITY, not survival:

- **C1** delete the `cancelled` row → predict RED on the `wantOwnershipRows`
  pin, naming a row count of 9.
- **C2** delete the row AND set `wantOwnershipRows = 9` → predict RED on the
  `allStages` completeness check, naming `cancelled`.
- If both fire, the guard is genuine and is NOT a finding. Predicted: both RED.

## Batch 3 — sensitivity of the PROPOSED tests (predicted before running)

New file `internal/platform/github/write_label_swap_test.go`, 3 top-level tests,
all GREEN on the unmutated tree (measured).

- **M4 re-run with the new file present** (both writeLabelSwap error returns
  swallowed): predict RED, exactly **2** —
  `TestWriteLabelSwap_UpdateTaskReportsALabelWriteFailure` and
  `TestWriteLabelSwap_ClaimTaskReportsALabelWriteFailure`.
  `RemovalHalfIsPinnedInThisPackage` does not inject a failure, so it stays GREEN.
- **M4a alone** (remove-side return swallowed): predict RED, exactly **2** — the
  UpdateTask `remove_half` subtest and the ClaimTask test.
- **M4b alone** (add-side return swallowed): predict RED, exactly **1** — the
  UpdateTask `add_half` subtest only.
- **M2 re-run with the new file present** (`remove = nil`): predict RED,
  exactly **1** — `TestWriteLabelSwap_RemovalHalfIsPinnedInThisPackage`.
  This is the §2 locality gap closed inside the package.
- **M1 re-run** (whole component dead): predict RED, **3+** — all three new
  tests plus the original 3.
