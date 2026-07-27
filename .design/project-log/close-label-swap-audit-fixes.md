# close-label-swap — audit and review fix round (#194 follow-up)

Second pass on the `close-label-swap` branch, resolving the blocking findings
from `audit-194`, `review-194` and `test-194`, plus GitHub #198 which was added
to the round after the brief was written. Branch rebased onto the full #191
branch; review range `d7314cf..c1ec1ba` was the starting point.

Six commits, one per item.

## What was wrong and what changed

### F1 — the remote issue state field was read two different ways

`issueToTask` compared the raw GitHub state string byte-for-byte against
`"CLOSED"`, while `IssueToPhaseStage` next to it used `EqualFold`, and the tree
walk used exact comparisons in four more places. Any non-canonical casing —
GitHub Enterprise, a caching or replay proxy, a schema change — left `ClosedAt`
nil while the label mapper still saw the issue as closed. The #194 Part 2 fix
then never fired and a closed issue reported `available=true reasons=[]`: the
original bug's exact fingerprint with the fix fully present.

New `state.go` holds `issueStateClosed` and `issueStateOpen`, the package's
single reading of that field. Both are positive tests. `issueStateClosed` is
deliberately **not** `!issueStateOpen`: an empty or unrecognised state must be
neither, because treating it as closed would stamp `ClosedAt` on live work and
report it terminal, which is denial-of-work — the direction that fails silently
because availability is advisory here and nothing downstream re-checks it.

The tree walk conversion also fixed two real latent bugs: a lowercase parent
state silently emptied the ready queue, and a lowercase child state silently
stopped blocking its parent.

### F2 — the reopen inverse

`ft close` now writes a terminal stage label. Reopening an issue is an ordinary
GitHub operation that clears state and `closedAt` and leaves labels alone, and
in a pass-through collection GitHub *is* the UI, so it happens entirely outside
Farm Table. That left live work reporting `available=false reasons=[terminal]`.

Took the **symmetric route** rather than pinning the behaviour: in
`IssueToPhaseStage`, a terminal stage label may not outrank GitHub saying the
issue is open, and such an issue is demoted to `accepted` — the same stage an
unlabelled open issue gets. The gate the brief put on this decision was whether
any legitimate workflow depends on an open issue holding a terminal stage. It
does not; the `UpdateTask` analysis is in the report. The three ways to reach
that state (reopen, `ft update --stage completed`, a partially failed close)
all already fail the user's intent.

Placed in `IssueToPhaseStage` because it has exactly one production caller,
`issueToTask`, which keeps the change on the pass-through read path.

### Test gaps 1–3 (plus 5–8)

No production change. Gap 1 is the one with real blast radius: #194 Part 2 made
`issueToTask`'s `ClosedAt` assignment safety-critical for the first time, but
only the CLOSED direction was pinned and every inverse test built `ent.Task` by
hand, bypassing `issueToTask` entirely. A mutation setting `ClosedAt` for OPEN
issues passed the whole suite while emptying the ready queue.

### review-194 H1 — the claim gate's `ClosedAt` arm

`issueUnavailableForClaim` is the enforcement counterpart to the advisory
`ComputeAvailability` and lacked the arm the latter gained in #194. It is a
no-op today because `ClaimTask` lists with `states: [OPEN]`, and the comment
says so. The premise is asserted rather than assumed, so widening the filter
fails a test next to the explanation of what the arm then starts doing.

### F5 — four silent error swallows in `CloseTask`

Control flow unchanged and deliberately so. What changed is that a rejected
label write and a bug in the swap logic are no longer indistinguishable from
outside the process — they leave identical residue on the issue.

### #198 — the lazy caches were unsynchronised

`labelIndex` and `repoID` are populated on first use, and one store instance
serves every request for its collection. `CloseTask` alone touches the map
three times per call (the populate, and the two `labelNamesToIDs` reads), so a
single pair of concurrent closes reaches it from both sides. In Go that is a
concurrent map read and map write: a fatal, unrecoverable runtime error that
takes the process and every tenant with it.

`sync.RWMutex`, read-locked fast path, fetch outside the lock, re-check under
the write lock, index built locally and published in one assignment. The race
test drives eight concurrent `CloseTask` calls and fails before the fix.

One measured result worth recording: with the double-check in place, dropping
the read lock in `labelNameToID` does **not** reproduce a race, because every
call site is preceded by `ensureLabelIndex` on the same goroutine. That is an
ordering argument spanning two functions; allow re-publication and the unlocked
read races immediately. Both variants were measured and the comment records it.

## Verification

`go build ./...`, `go test ./... -race` green. `go vet ./...` reports exactly 4
findings, all pre-existing copylocks in `internal/server/server.go` (#199); no
new ones. `gofmt -l .` lists 7 pre-existing files, none touched by this branch.

Twelve mutations re-run at final HEAD: the nine from the original round plus
test-194's three survivors (c), (d), (e). All twelve now die. Full transcripts
in `reports/dev-194-fixes.md`.

## Not done, and why

- **audit F3 — hoisting `store.IsTerminal(t)` across three implementations.**
  Out of scope by instruction. Not blocked by anything here, and nothing in
  this round made it more urgent.
- **audit F6.** Out of scope by instruction; unaffected by these changes.
- **audit F8.** Out of scope by instruction; unaffected by these changes.
- **Extracting the thrice-duplicated stage-label swap** (`UpdateTask`,
  `ClaimTask`, `CloseTask`). Out of scope by instruction, and this round added
  a fourth reason to leave it: the three copies now differ deliberately in
  their error handling — `CloseTask` logs and continues, the other two return —
  so an extraction has a design question to answer first rather than being a
  mechanical move.
- **The tree walk still diverges from `IssueToPhaseStage` on F2.**
  `buildIssueTree` calls `MapLabelsToStage` directly, so an open issue with a
  terminal label is available and claimable but does not appear in
  `GetReadyTasks`. The divergence is fail-safe (the ready queue under-reports)
  and closing it means changing a tree-walk predicate that #191 consolidated in
  the commit immediately below this branch. Pinned by
  `TestComputeReady_OpenTerminalLabelledIssueIsNotReady`, which carries an
  instruction to delete itself when the tree walk is taught the rule.
- **#193 — labels outrank `stateReason` on the closed branch** of
  `IssueToPhaseStage`, so a closed issue with a stale non-terminal label still
  *reports* stage `working`. Availability is correct regardless, which is what
  `ClosedAt` buys. Still out of scope, as in the previous round.
- **Test gap 4, transport-level failures** (connection reset, 5xx, context
  cancellation). Different path through the client; needs harness work beyond
  this round.
- **Pre-existing `gofmt` drift and the 4 `go vet` copylocks findings** were left
  alone. Both verified present at base `d7314cf` and in files this branch does
  not touch.
