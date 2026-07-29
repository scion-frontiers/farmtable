# dev-194-fixes-3 — restore the authorization boundary F2 accidentally relaxed

## Status: round 2 FAILED the gate. Both legs returned REQUEST CHANGES.

**Workspace:** `/workspace/farmtable-close-label-swap` · branch `close-label-swap`,
head **`9f98ad8`**, clean. Confirm with `git rev-parse --short HEAD` **in that
clone** before your first commit. `/workspace` is **not** a git repository — it is
the parent of ~35 clones, and this branch name resolves to different commits in
several of them.

| leg | verdict |
|---|---|
| `audit-194-r2` | **REQUEST CHANGES** — 2 High, 2 Medium, 3 Low, 1 Info |
| `test-194-r2` | **REQUEST CHANGES** — 1 Blocking (High), 2 Medium, 6 Low/Info |
| `review-194-r2` | not run — infrastructure fault |

Read both in full before starting. They overlap, they disagree in one place, and
**neither is correct as written**:
- `/scion-volumes/scratchpad/projects/farmtable/reports/audit-194-r2.md`
- `/scion-volumes/scratchpad/projects/farmtable/reports/test-194-r2.md`

**Your own previous work is well regarded.** Both reviewers confirmed F1 is right
and pinned in both directions, #198 is sound, both F2 over-breadth guards are
load-bearing, there are no self-built oracles, and `claim_gate_test.go:38` was
called *exemplary* sink-binding. Both explicitly praised §6 disclosing a surviving
mutant rather than hiding it — keep doing that. The problem is F2's blast radius,
not the craft.

---

## The finding, and what I verified myself

**F2 silently downgrades an authorization requirement.**

`server.go:537` computes the required scope from the *current* stage:

```go
if transitionScope := TransitionScope(string(existing.Stage), string(st)); transitionScope != ScopeTaskWrite {
```

`transitions.go:93-98` requires `task:accept` for any move out of a terminal stage
("reopening a closed task is a re-accept"). F2 rewrites that **source** value from
terminal to `accepted`, so the rule stops matching and the transition falls through
to the default `task:write`.

I confirmed this myself at `9f98ad8` rather than taking it on report: the gate does
read `existing.Stage`; the terminal rule does require `ScopeTaskAccept`; and
`GetTask` for a GitHub collection routes MultiStore → pass-through → `issueToTask`
→ `IssueToPhaseStage`, which is **not** gated by the ephemeral pool. The demoted
value genuinely reaches the gate in production.

The auditor's framing is the sharp one: `transitions.go:86-88` already defends this
exact laundering for triage, deliberately. F2 opens the same hole for terminal — not
via the destination, but by rewriting the source.

**Root cause, and the thing to hold in your head:** one field is serving two
masters. A value that GitHub labels can rewrite is being used for *display*, for
*authorization*, and for *work scheduling*. This round separates the first from the
other two. The full display-vs-authoritative split is filed as **#203** and is
architect-scoped — **do not attempt it here.**

---

## Scope

### 1. BLOCKER — authorization must read the un-demoted stage

Ruling from the coordinator: **restore the pre-F2 authorization behaviour.** F2
keeps the demoted stage for **display**; the authz gate reads the label-derived
stage. `NativeLabel` is already populated at `passthrough.go:218`.

The auditor's option 1 sketch (verify it, do not paste on trust):

```go
// server.go — authorization reads the un-demoted stage.
authStage := existing.Stage
if native := task.Stage(existing.NativeLabel); store.IsTerminalStage(native) {
    authStage = native  // a terminal label still means "reopen" for RBAC
}
if transitionScope := TransitionScope(string(authStage), string(st)); transitionScope != ScopeTaskWrite {
```

Judge whether `NativeLabel` is the right carrier, or whether the un-demoted stage
should be threaded explicitly. If you pick something different, say why.

**Both directions are in scope.** The coordinator was explicit:

> "Treat the tightening the same way as the loosening: it's a side effect of the
> same refactor with no deliberate justification offered."

| direction | before F2 | after F2 | required outcome |
|---|---|---|---|
| terminal → triage/accepted/in_review/in_qa/deploying | `task:accept` | `task:write` | **restore `task:accept`** |
| terminal → completed | `task:write` | `task:close` | **restore `task:write`** unless you can articulate why `task:close` should now be required |

Do not let *"it happened to get stricter this time"* pass without the same
scrutiny as *"it happened to get looser."* If you believe the tightening is
correct, argue it explicitly in the report — do not silently keep it.

**Do NOT "fix" this by reverting the RBAC rule in `transitions.go`.** Both
reviewers said so independently.

**Acceptance.** A test in **`internal/server`** binding F2 to the gate: an
`UpdateTask` against a pass-through-backed collection with an agent-scoped
context, asserting the resulting scope decision. This is the missing
**sink-binding** — today, reverting F2 produces failures only in
`internal/platform/github` and **zero** in `internal/server`. Your new test must
fail if the authz fix is reverted. Paste that proof.

### 2. BLOCKER — the live over-report of abandoned work

Both reviewers flagged this; **they disagreed about the mechanism and I measured
it.** Read this carefully, because the auditor's stated vector is wrong and the
test reviewer's severity is wrong.

**Not reachable** (auditor's High, as written): the ephemeral graph path.
`WithEphemeralPool` is called only from test files; `main.go:98` builds the service
with `WithEventBus` only; `graph_routing.go:59` returns `Internal "ephemeral store
pool not configured"` when the pool is nil. Collection-scoped `GetReadyTasks` on a
GitHub collection **errors** in production. (That is its own pre-existing bug,
filed as **#202** — not yours.)

**Reachable today** (the test reviewer called this "cosmetic"; it is not):

```ts
// web/src/utils/task-ready.ts:13
if (task.phase !== TaskPhase.OPEN || task.stage !== TaskStage.ACCEPTED) return false;
```

F2 produces exactly `phase=open, stage=accepted`, and this path is fed by
`ListTasks`/`GetTask` through pass-through — **not** ephemeral-gated. So an issue a
maintainer marked `wont_fix` / `duplicate` / `cancelled` is presented as available
work in the dashboard today.

Note `isReady` **defers to `task.availability` when present** (`task-ready.ts:9-11`).
`test-194-r2` reports the store currently says `available=true` for these. **The
cleanest fix is almost certainly server-side**: make the computed `availability`
reflect the terminal label, so every client — web, CLI, MCP — inherits the correct
answer instead of each re-deriving it. Assess and justify your choice; if you fix
it server-side, say explicitly whether `task-ready.ts` still needs a change.

**Acceptance.** A test proving a `wont_fix`-labelled OPEN issue is **not**
presented as available, at whichever layer you fix. Plus: state plainly whether
the two ready paths (`passthrough.GetReadyTasks` and the ephemeral mirror) now
agree, and if they still disagree, that they disagree **deliberately** and are
documented as such.

### 3. The tree-walk pin is tautological — the divergence is not actually pinned

`internal/platform/github/reopen_test.go:187-195`.
`TestComputeReady_OpenTerminalLabelledIssueIsNotReady` builds a node with
`Stage: task.StageCompleted` and asserts `computeReady(nodes, false)` is empty. With
`includeUnblocked=false` the only appending arm requires `StageAccepted`
(`treewalk.go:92`), so a `StageCompleted` node is excluded **regardless of any
terminal handling**. The nodes are hand-built, so `buildIssueTree` — the function
that would have to learn the rule — is never invoked.

The auditor proved it with **MUT-T**: teaching `buildIssueTree` the symmetric rule
(the exact change the test's own failure message describes) leaves the package
fully green. So *"we pinned it rather than fixing it"* is **not true in effect**.

Drive the real constructor and use the arm that consults `IsTerminalStage`.
**Acceptance:** re-run MUT-T; the test must now fail.

> `test-194-r2` discussed this very test (its F-5) and missed that it cannot fail.
> Two reviewers looked at it and one experiment settled it. That is the standard.

### 4. Same-file correctness items

- `reopen_test.go:213-215` — the compound guard can never fire (`&&` where `||` was
  almost certainly intended); both reviewers confirmed, one by execution showing
  **zero** detection contribution. Replace with the assertion it was meant to be.
  Note it is the sole consumer of the `internal/store` import in that file.
- `treewalk_test.go:35-55` — this #191 test's comment asserts the **exact negation**
  of F2's premise ("the stage, not the issue state, has to be what keeps it out of
  the ready set"). Amend it to record that it pins the *tree-walk* path, and
  cross-reference `reopen_test.go`. If item 3 makes the two paths agree, reconcile
  them properly rather than leaving contradictory comments.
- `close_label_swap_test.go` — the `ClosedAt` arm is covered **only** through the
  fake's deliberate infidelity (it ignores the GraphQL `states` variable), i.e. in a
  state the production query cannot reach. Add one sentence naming the real call
  path that can deliver a closed issue, or mark it explicitly as unreachable
  defence-in-depth. Do not change the arm.

### 5. `-race`, and an accessor no test exercises

`Makefile:9-10` runs `go test ./...` with no `-race`, and there is **no CI on this
project**, so the race property the concurrency tests exist to assert is never
actually checked. Add a `race` target (`go test -race ./internal/platform/github/`)
and run it. `TestPassThroughEnsureRepoID_ConcurrentUseDoesNotRace` is near-vacuous
without it, and `cachedRepoID()` — an accessor added by this very diff
(`passthrough.go:159`) — is exercised by **no test at all**. Have that test assert
via `cachedRepoID()`.

`concurrency_test.go:79,83,114` read mutex-guarded fields directly, modelling the
exact pattern the fix forbids — use the accessors. `:182` calls `t.Fatalf` from an
HTTP handler goroutine, which is documented-incorrect (`runtime.Goexit` on the
wrong goroutine) — convert to `t.Errorf` or a channel.

**If `-race` surfaces anything new, STOP and report it rather than fixing it
quietly.**

### 6. Report corrections — your own report is a relied-upon artefact

- §6: "nine `labelNameToID` call sites" → **15**. Both reviewers independently
  counted 15 and both checked every one; the happens-before argument **holds**, so
  only the number is wrong. State the invariant that does the work: *every*
  `labelNameToID` call is dominated by an `ensureLabelIndex` in the same function.
- §7 table row (e): **10 → 8** subtests. Your own pasted §3 output already shows 8,
  so the table contradicts the evidence directly above it.
- Check (1) of the five F2 checks: distinguish `GitHubPassThroughStore.UpdateTask`
  (a producer) from `FarmTableService.UpdateTask` (the **consumer** that matters).
  That single conflation is what let the authz gate go unnoticed.

---

## Explicitly OUT of scope — do not expand

- **#203** — splitting `IssueToPhaseStage` into display vs authoritative stages.
  Architect-scoped. The auditor notes **F7** (`UpdateTask` relabels to terminal
  without closing) is one of the three paths F2 cites as justification, so fixing F7
  may remove the need for the demotion entirely — that sequencing question belongs
  to #203, not here.
- **#202** — the ephemeral pool never being wired in production.
- **Stock GitHub `duplicate` label laundering** (auditor Medium): stage labels match
  bare and unprefixed (`labels.go:95-97`), and `duplicate` ships by default in every
  new GitHub repo. The auditor judges that fixing items 1 and 2 **largely subsumes**
  this. Assess whether it does once your fix is in; if a live claimable path
  remains, **report it, do not fix it** — requiring a prefix for terminal labels is
  a user-visible behaviour change that needs its own decision.
- Exhaustiveness assertions on the hardcoded stage lists (Info) — cleanup branch.
- #195, #191, #196, #197, Phase 2 — other branches.

If you find something **Critical or High**, stop and report rather than fixing it
quietly.

---

## Acceptance criteria

- **Every claim proved by a pasted mutation going green → red.** In particular:
  the new `internal/server` authz test must fail when the authz fix is reverted;
  MUT-T must now kill the tree-walk pin; the over-report test must fail when the
  availability fix is reverted.
- **Address mutations by CONTENT, never by line number.** Standing bar on this
  workstream: a `sed '302s/...'` on a file that had shifted landed inside a docblock,
  never applied, and reported a false SURVIVED that looked exactly like a real
  finding. You will be editing these files repeatedly.
- **Restore from `cp` backups outside the repo, never `git checkout`** — it cannot
  distinguish your mutation from your uncommitted fix. Assert
  `git status --porcelain` is empty after each restore. `audit-194-r2` avoided the
  hazard entirely by running every mutation in a disposable `git worktree` under
  `/tmp` — that is the better pattern; copy it.
- **Reconstruction is not reachability.** If you claim a path is or is not live,
  show the production wiring. An auditor rated a finding High this round by
  composing the real functions in the order production *would* call them; the path
  is unwired and the call errors out instead.
- **No self-built oracle.** Three reviewers have hunted a fifteenth across three
  branches and found none. Do not add one.
- **The five previously-dead mutants must stay dead** (M1, M2, M3, M4, and the F2
  over-breadth guards R-F2-BROAD / R-F2-CLOSED). Re-run them.
- **The disclosed surviving mutant (MUT-X / RACE-B) is explained and accepted** —
  both reviewers confirmed the happens-before argument holds. Do not chase it.
- Full gate pasted: `go build ./...`, `go test ./...`, the new `race` target, and
  `go vet ./...`. Redirect to a file and check `$?` — do not read success off a
  pipeline's exit code.

## Deliverables — all required

1. Commits on `close-label-swap`. **Do not push.** Commit locally; the manager
   pushes. Hard rule on this project.
2. A project log entry in `.design/project-log/`, with a "Not done, and why"
   section.
3. A report at
   `/scion-volumes/scratchpad/projects/farmtable/reports/dev-194-fixes-3.md`
   covering each item with its verification, all mutation output, the corrected §6
   / §7 / check-(1) figures, and anything found but not fixed.

**A note on the disclosure, so you understand the stakes.** The F2 *fix* survives
review. The F2 *impact analysis* does not — the claim "no legitimate workflow is
affected" is **void** and will not be published. Your report is the artefact the
deploy disclosure is built from, which is why item 6 matters as much as the code.

You MUST commit your work, write the project log entry, write the report at the
exact path above, and then mark the task complete.
