# Fix Round: auth-stage4-scope-ext — independent review found 2 confirmed bypasses

## Verdict received: REQUEST CHANGES (high quality review, empirically verified)
Full report: `/scion-volumes/scratchpad/projects/farmtable/reports/review-scope-ext.md`
Read it in full before starting — this note only summarizes the required actions.

The reviewer confirms the engineering quality is good (clean transition table, thorough
tests, real bufconn-based evidence) but found the accept gate this PR exists to create is
**bypassable by an agent-scoped token via two independent, empirically-confirmed paths**.
Since Stage 4 RBAC is live in prod and this PR's whole point is establishing the
accept/close boundary, a boundary with holes is worse than shipping nothing — do not merge
until C1 and C2 below are closed.

## BLOCKING — required before merge
1. **C1 (on-hold laundering bypass)**: `stagesOnHold` is reachable from triage with only
   `task:write`, and every stage is reachable *from* on-hold without `task:accept`. An
   `agent` token can do `triage→blocked` (task:write) then `blocked→ready` or
   `blocked→working`/ClaimTask, reaching `working` on a never-accepted task. The review
   includes the exact fix: add a catch-all row "any move out of triage (other than
   closing) is an accept" placed below the terminal-close rule but above the on-hold/claim
   rules, so triage becomes a sticky prefix. Update `transitions_test.go:63,64,70` (which
   currently assert the hole as CORRECT behavior) to expect `ScopeTaskAccept`.
2. **C2 (CreateTask bypass)**: `CreateTask` only checks `task:write` then accepts an
   arbitrary `req.Stage` — the new transition table only governs `UpdateTask`. An agent can
   `create(stage=ready)` then claim it (defeats task:accept), or `create(stage=completed)`
   in one call (defeats task:close). Fix: gate `CreateTask`'s explicit stage through
   `TransitionScope(triage, requestedStage)` (exact suggested code is in the review, C2
   section). Confirm the decomposer and ImportTasks call sites per the review's notes.
3. **I1**: the compat-findings doc only mentions agents losing claim-from-triage — it does
   NOT mention that **every existing agent token also loses the ability to close its own
   work** (`task:close` didn't exist before; agents' persisted scopes never included it).
   This is `agents.md`'s documented step 5 of the agent core loop. Amend compat-findings to
   state this plainly AND propose a rollout answer: who closes agent-created work once this
   ships — reprovision existing agent tokens with `task:close`? Require a human/orchestrator
   step? Decide and document it, don't leave it implicit.
4. Add the two missing negative tests the review calls out: an RPC-level multi-hop
   laundering test (`triage → blocked → {ready, working}` with an agent token, assert
   denial), and an agent-initiated `CreateTask(stage=ready)` / `CreateTask(stage=completed)`
   negative test (today ALL fixtures create via `adminCtx`, so this path is fully untested).

## Fix in the same pass if cheap (reviewer's call, not mandatory but should be trivial)
5. **I2**: add the stage-group partition exhaustiveness test from the review (fails loudly
   if a future stage enum value isn't assigned to exactly one group, instead of silently
   fail-open to `task:write`).
6. **I3**: `DefaultScopesForUserType`'s default branch returns full wildcard for ANY
   unrecognized `user.Type` string (typos like "reviewr" get full admin). At minimum add a
   warning log on that branch. This is pre-existing but this PR is the first change that
   makes user-type strings a real privilege boundary, raising the blast radius of a typo.

## Must resolve before DEPLOY (not necessarily before merge, but before this ships live)
7. **O4 — real production-impact risk**: `GetReadyTasks` includes `StageTriage`, so agents
   polling the ready queue will receive triage tasks they can neither claim nor accept, and
   will hard-stop on `FailedPrecondition`. Needs either a companion fix (exclude triage from
   the agent-visible ready queue) or an explicit rollout decision — do not silently ship
   this without a plan, it's flagged as "the most likely production symptom of this
   rollout."
8. **No accept affordance exists in CLI/MCP today** — the only way to move triage→accepted
   is `ft task update --stage ready`, and agents (who lack `task:accept`) can't invoke it
   anyway, but neither can anyone else easily. Per the review: "should land with or before
   this change." Add a CLI/MCP `accept` command/affordance for whichever role should be
   calling it (reviewer/orchestrator-scoped tokens, or a human via CLI).
9. **O1 (TOCTOU)**: not a blocker per the reviewer, but for an auth-critical path, at least
   record the decision (accept the narrow race, or require `req.Version` on stage-changing
   updates) explicitly in the design doc rather than leaving it implicit.
10. **O2, O3, O5**: minor — O2 is dead/redundant code (fine to just delete `stagesReopen`
    and the redundant rule), O3 is a one-line error-message wording fix, O5 is a
    pre-existing `ClaimTaskRequest.stage`-ignored quirk (not introduced by this PR — file as
    a GitHub issue for tracking per project convention if not fixing now, don't just drop
    it).

## Process note
This is exactly the kind of review this workstream needed given the live-production,
auth-critical blast radius — good catch. Once C1/C2 are fixed and covered by the new
tests, and I1/I2/I3 land in the same pass, re-request review from the same reviewer
(or an equivalent independent one) before merging. Do NOT self-review this one, and do NOT
merge on your own judgment given the severity of what was found — get an explicit
re-review APPROVE first.

## Deliverables
1. Updated PR (same branch, new commits) addressing items 1-6 above, with a top-of-PR note
   summarizing what changed since the last review pass.
2. Explicit rollout decision written into compat-findings.md for I1 and O4 (who closes
   agent work; how the ready-queue exposure is handled).
3. Re-review verdict (APPROVE) before merge.
4. A message to the coordinator with: what was fixed, the rollout decisions made for I1/O4,
   the CLI/MCP accept-affordance status, and the re-review verdict, before you merge or
   deploy anything.

## Termination
You MUST fix C1, C2, I1, add the two missing tests, address I2/I3, resolve/decide on O4 and
the CLI/MCP accept-affordance gap, get a genuine re-review APPROVE (not self-reviewed), and
report back to the coordinator with the full picture before merging. Then signal
task_completed.
