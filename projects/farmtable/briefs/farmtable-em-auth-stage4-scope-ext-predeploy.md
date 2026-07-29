# Pre-Deploy Gate: auth-stage4-scope-ext (PR #166) — merge is fine, deploy is NOT yet

## Status
Re-review (`review-scope-ext-v2.md`) came back **APPROVE**. C1, C2, and I2 are genuinely
fixed and verified (independent adversarial audit of all 6 stage-writing paths, no new
bypass found). **You may merge PR #166.**

**Do NOT deploy yet.** Two Important findings from the re-review are real production-
breaking risks on an already-live system, not nitpicks, and the reviewer explicitly
recommends escalating the rollout as a separate work item before this ships. Treat these
as deploy blockers, same diligence level as everything else in this workstream.

## Required before deploy

### 1. Fold Important #1 into the IN-REPO project log (quick)
`compat-findings.md` (scratchpad, not merged) states the CloseTask/ClaimTask break
correctly, but `.design/project-log/auth-stage4-scope-extension.md` (which DOES merge into
the repo) only links to the scratchpad doc and its own Backward Compatibility section omits
the headline break entirely. Anyone reading the repo in 6 months gets the mild version.
Add the "BREAKING for agent-typed tokens — both ends of the lifecycle" block from the
review (exact suggested markdown is in review-scope-ext-v2.md, Important #1) directly into
the in-repo project log.

### 2. Decide and implement Important #2 — GitHub pass-through triage mapping (real, live-impacting)
**This is the one that actually matters for anything already deployed.** `LabelMapper.
IssueToPhaseStage` maps EVERY unlabelled open GitHub issue to `StageTriage` — which is the
overwhelming majority of real-world GitHub issues, not an edge case. Combined with the new
gate, `ClaimTask` on any unlabelled issue now returns `FailedPrecondition` for ALL roles,
including wildcard/admin, on any GitHub pass-through-backed collection. This silently
disables ClaimTask for that entire backend the moment this deploys — confirmed by your own
test suite, not hypothetical.

Pick one, implement or explicitly document it, and record the choice in the project log:
- **Option A (recommended by reviewer, smallest blast radius)**: in `labels.go`, change the
  unlabelled-open-issue fallback from `task.StageTriage` to `task.StageBacklog` — an
  unlabelled issue was never triaged IN, so treating it as accepted-but-unprioritized keeps
  the existing agent loop working for that backend.
- **Option B**: leave the mapping as-is, but you MUST then explicitly document (compat
  doc + in-repo project log) that pass-through collections now require an accept step
  (and a `stage/*` label) before ANY issue can be claimed by ANYONE, including admins. This
  pushes real cost onto operators of existing pass-through collections — don't ship this
  silently.
Either is acceptable per the reviewer; shipping neither (i.e. not deciding) is not.

### 3. Concrete rollout plan for existing agent tokens — not just documentation of the break
The architect's design intentionally excludes `task:close` from the default `agent` scope
set (this is deliberate, not an oversight — confirmed in design-review-triage-acceptance-
authority.md). But every ALREADY-ISSUED agent token has persisted scopes from before this
PR existed, so this breaks those tokens the moment the new code path runs against them —
not a config flip, a data migration (per the review, and per your own earlier compat
analysis).
You need an actual mechanism, not just a paragraph, before this deploys:
- Either a migration script that re-provisions existing agent-typed tokens (grants a
  `reviewer`/`orchestrator` tier to specific tokens that need to keep closing their own
  work), or
- A concrete hand-off protocol (which role closes agent-created work now, and is that role
  actually provisioned/exists yet in this deployment?), or
- If neither is ready, an explicit decision to hold this deploy until it is.
**Flag to the coordinator which path you're taking and confirm it's actually implemented
(not just decided) before you dispatch a deploy.**

## Also worth doing in the same pass (reviewer's Medium/Low items - not deploy-blocking, use judgment)
S3 (warn on empty-string user type too, not just non-empty garbage - empty string is
arguably the most dangerous case since it silently mints a wildcard token), S4 (3 missing
invariant tests locking in properties the fix now depends on - CloseTask-cannot-reopen,
DefaultScopesForUserType default branch, CreateTask-in-blocked-requires-accept), S1/S2/S5
are low-severity/nit, use judgment on whether to fix now or file as GitHub issues per
project convention (matching precedent - see issues #152/#153/#156 for what "tracked, not
blocking" looks like in this project).

## Deliverables
1. Merged PR #166 (fine to merge now - reviewer approved).
2. In-repo project log updated with the real CloseTask/ClaimTask break (item 1).
3. A concrete decision + implementation (or explicit documented tradeoff) for the GitHub
   pass-through triage mapping (item 2).
4. An actually-implemented (not just decided) rollout mechanism for existing agent tokens
   (item 3).
5. A message to the coordinator confirming all three are done, with the specific choices
   made (Option A vs B for item 2, and what the rollout mechanism is for item 3), BEFORE
   requesting a deploy dispatch.

## Direct Contact
- Coordinator: `scion message coordinator "<message>"` — especially if item 3's rollout
  decision has implications beyond farmtable's own UI (e.g. if other Scion agents/tooling
  authenticate to farmtable with agent-typed tokens that would be affected — flag this
  explicitly, the coordinator will loop in ptone if so).

## Termination
You MUST merge PR #166, fix the in-repo project log gap, resolve the GitHub pass-through
mapping question (implement or explicitly document), implement a real agent-token rollout
mechanism, and report back to the coordinator with all three confirmed before any deploy is
dispatched. Then signal task_completed.
