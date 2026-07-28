# #194 round 7 — independent code review (`label-write-scope-r7` @ `1d4442f`)

Independent code-review leg (correctness / readability / architecture / performance), run in
parallel with a security auditor and a test engineer on the same SHA, with no visibility between
legs. Full report:
`/scion-volumes/scratchpad/projects/farmtable/reports/review-194-r7.md`.

## Verdict

**REQUEST CHANGES** — one Critical, one Required.

## What was verified

Tree `/workspace`, branch `label-write-scope-r7`, HEAD `1d4442f`, clean. Ancestry of `6ced24e`,
`cc953e4`, `4df2d1e`, `15b7247` asserted with `git merge-base --is-ancestor`; negative control
`633f8f2` correctly reports not-ancestor. Surface excluding `.design/`: 16 files, +1185 / −117.
`git diff --name-only 15b7247 1d4442f -- ':!.design'` empty — no code changed after the merge was
verified.

Gates: `make web` 0, `go build ./...` 0, `go test ./...` 0 (no `WatchTasks` flake), `make race` 0.
`go vet ./...` exits 1 on exactly 4 pre-existing `copylocks` findings in exactly the four RPCs the
brief named (`GetReadyTasks`, `GetBlockedTasks`, `GetCriticalPath`, `GetBottlenecks`, all
"assignment copies lock value to ephReq"). **All gates pass while the Critical below is live.**

## Critical — A-4 reintroduces the free terminal-stage write

`RestrictLabelWriteToSnapshot` (`internal/platform/github/passthrough.go:1035`) filters `add` and
`remove` independently against the snapshot. The gate that authorizes the edit
(`internal/server/server.go:795-812`) predicts the outcome with `applyLabelDelta`, whose rule is
**remove wins over add** for a label named in both lists (`passthrough.go:978`). The two disagree.

For a label absent from the snapshot and named in BOTH lists, the restrictor keeps it in `add` and
drops it from `remove`, so the write **applies** a label the gate predicted would be absent and
therefore charged nothing for:

```
UpdateTask{ add_labels: ["ft:stage/completed"], remove_labels: ["ft:stage/completed"] }
```

on a GitHub-backed task not carrying that label, with a `task:write`-only token: free at the gate,
terminal after the write. Out of `ft ready`, unclaimable, `Available=false Reasons=[terminal]`, and
reversing it costs `task:accept`. That is the round-6 escalation, reopened by the fix meant to
close its last remnant.

**Regression, not pre-existing.** At `6ced24e` the server passed both lists through verbatim and
the store applied adds then removes, so the same request netted to nothing.

Measured with a throwaway differential harness (deleted; tree left clean) comparing the gate's
predicted label set against the narrowed write's outcome on an unchanged snapshot: 5/7 cases
agreed — positive control fires — and the 2 failures are exactly the both-lists shape, including
the case-differing spelling variant.

Fix: apply remove-wins inside the restrictor — drop from `add` any entry whose `labelMatchKey` is
also in `remove`, before the present/absent test. Pin it with a property test asserting
`applyLabelDelta(snapshot, narrowed...) == applyLabelDelta(snapshot, raw...)`, which is the
invariant the gate's soundness actually rests on. The existing A-4 tests are well built but both
single-sided; the matrix at `authz_label_write_scope_test.go:1316` would have caught this and is
one row short.

This also falsifies the doc claims at `passthrough.go:1011` ("exactly the complement of
applyLabelDelta … The two must agree") and `store.go:203` ("must only ever narrow"): the lists
narrow, the resulting label set gains a label.

## Required — M-1's config load is CWD-relative and silent

`cmd/farmtable-server/main.go:76`. The threading is correct end to end (`LoadConfig` →
`NewPlatformResolver(cfg)` → `NewPassThroughStore` → `NewLabelMapper` and `newGraphQLClient`; one
non-test caller, updated). But `DefaultConfigPath` is relative and `LoadConfig` treats a missing
file as "defaults, no error", so a server started from an unexpected working directory silently
runs `DefaultConfig()` and an operator with a custom `push_prefix` still has the gate disarmed —
the exact failure mode the comment above it says it is preventing. `log.Fatalf` only covers
malformed config. Fix: log the resolved absolute path, whether a file was found, and the effective
`push_prefix`, mirroring the `"Credential encryption enabled"` line above it.

## Non-blocking

- The M-2 check sits inside the per-step loop though `collID` is loop-invariant; for native
  collections `lazyResolve` does an uncached `GetCollection` per call, so it is a small N+1
  (`server.go:341`). Same extra trip for the new `RestrictLabelWriteToSnapshot` call.
- `internal/cli/connect.go:289` re-applies `FARMTABLE_GITHUB_CONFIG`, which `LoadConfig` already
  handles. Harmless duplication; drop it.
- The `27 top-level tests` figures are correct history (agreeing with the EM's ruling), but reading
  as a present-tense package property; an explicit `MEASURED at 6ced24e:` anchor is worth the three
  words.

## Findings for the record

- **Item 2 of the brief is clean.** The ten un-discarded errors routed through `writeLabelSwap` are
  a fix, not a regression. Unknown labels are dropped by `labelNamesToIDs` and are explicitly not
  an error, capping the blast radius; every newly-surfaced failure replaces a success return
  describing a state GitHub was never put into. `UpdateTask` writes title/description before the
  swaps, so an error can now follow a partial write — both halves are idempotent, so retry is safe.
- The `authz_terminal_reopen_test.go` mock change was forced by real error propagation: the
  mutations decode `labelable.labels.nodes`, and the old `clientMutationId` response was producing
  a decode error the `_ =` discards swallowed.
- **The `SnapshotLabelWriteRestrictor` interface is the right design.** Case-insensitive
  `labelMatchKey` on the GitHub side vs exact-string `mergeLabels` in Ent means a shared helper
  would be wrong for one store, and the predicate is store-specific in principle. It mirrors
  `LifecycleStageSetStager` exactly. No alternative proposed.
- Leg B's work is the strongest part of the diff: `ownershipTruthTable` is a genuine hand-written
  literal with totality and size pins, and the T-F5 note volunteering that the defect cost *less*
  than assumed is the right kind of honesty.

## Where the brief was wrong

The brief's risk ordering was inverted. Item 2 was flagged as "most likely to have an unintended
behavioural consequence"; it is clean. The unintended consequence is in item 1, which was framed as
an architectural question ("is a store interface the right home?") — the interface is right, the
implementation inside it is the Critical, and the architectural framing steered attention away from
the semantics. Relatedly, the brief restated leg A's "no-ops BY DEFINITION" premise without
challenge; that holds per-list, and the per-list-vs-joint gap is precisely the defect. For round 8
the question to ask is "does the narrowing agree with the gate's own prediction function on every
input?"
