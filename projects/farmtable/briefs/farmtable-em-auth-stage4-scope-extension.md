# Brief: Auth Stage 4 follow-up — task:accept / task:close scopes + transition enforcement

## Critical Constraints (read first)
- Dedicated git worktree: `git worktree add /workspace/farmtable-auth-scope-ext -b auth-stage4-scope-ext origin/main`
- This touches LIVE, PRODUCTION auth enforcement (Stage 4 RBAC is already deployed and
  active in default `token` AuthMode). Treat with the same care as the original 6-stage
  auth plan — this is not a low-risk change.
- **Real backward-compatibility risk you must explicitly evaluate and address**: today
  `ClaimTask` only checks `Phase != Closed && AssigneeID == nil` (see
  `internal/store/entstore.go` ~line 752) — it does NOT check `Stage`. If you add a hard
  requirement that a task must already be in `accepted` (or backlog/ready) stage before
  `ClaimTask` will succeed, any EXISTING caller/token that currently claims tasks directly
  out of `triage` will start failing. Before shipping, determine: (a) does live/default
  usage rely on claiming straight from triage today, and (b) what should happen to
  in-flight triage tasks / existing automation if so. Do not silently break a working
  claim flow — flag this explicitly to the coordinator if you find real live usage that
  depends on the old behavior, and propose a migration/rollout approach (e.g. only enforce
  for NEW tasks, a grace-period warning, or a one-time backfill accepting all
  currently-triage-but-assigned tasks) rather than just shipping a hard break.
- Given the auth-critical blast radius, this REQUIRES an independent code review before
  merge (same as every prior Stage 4/5/6 change) — do not self-review even if the
  code-reviewer template has provisioning issues again; escalate to the coordinator if it
  fails to provision rather than skipping the review.

## Context
You (farmtable-em-auth-implementation) implemented and shipped the full 6-stage Auth
Improvements Plan, including Stage 4 (Scoped Tokens & RBAC), which is live in production
(default `token` AuthMode, deploy-37 commit `5d197fe` onward). ptone had a follow-up
design discussion with the auth architect (`farmtable-architect-auth`) about
"who can move a task from triage to accepted" — this is a NEW, ptone-approved extension
to the Stage 4 scope vocabulary, not a bug fix. Two decisions were resolved 2026-07-26 and
the architect's design doc has been updated:

Full design rationale and analysis:
`/scion-volumes/scratchpad/projects/farmtable/notes/design-review-triage-acceptance-authority.md`
Related future-feature tracking (informs how to structure `RequireScope()`, NOT to be
implemented now): `/scion-volumes/scratchpad/projects/farmtable/notes/future-per-collection-auth-policy.md`

## Decisions to implement (verbatim from the architect/ptone discussion)
1. Add two new scopes to the vocabulary: `task:accept` and `task:close`.
2. `task:claim` requires `task:accept` as a precondition — a task must be `accepted`
   (or backlog/ready) before it can be claimed. Accept and claim remain two DISTINCT
   operations (accept moves triage→accepted; claim moves accepted→working) — never
   conflate them into one operation even for a caller with both scopes.
3. Single `task:close` scope covers ALL terminal-state transitions (completed,
   wont_fix, duplicate, cancelled) — do not split into per-terminal-state scopes.
4. Per-collection auth policy is explicitly OUT OF SCOPE for this task — do NOT
   implement it. But per the architect's design note, structure `RequireScope()` /
   the transition-scope mapping so it CAN be layered on top later without a rewrite:
   - `RequireScope()` should be able to accept a collection context parameter (even if
     unused today)
   - The transition→scope mapping should be a configurable table/data structure, not
     hardcoded if/else chains scattered across RPC handlers
   - Keep the scope check centralized, not duplicated per-RPC

## Transition → required scope mapping (from the design doc)
| From | To | Required Scope |
|------|----|----|
| triage | accepted / backlog / ready | `task:accept` |
| any non-terminal | working (via ClaimTask) | `task:claim` (task must already be `accepted`+) |
| working | in_review / in_qa / deploying | `task:write` |
| any | completed / wont_fix / duplicate / cancelled | `task:close` |
| any terminal | triage / backlog | `task:accept` (reopen = re-accept) |
| any | blocked / waiting_for_input / deferred | `task:write` |

Default role scope updates:
- `admin` → `*` (unchanged)
- `agent` → `task:read, task:write, task:claim, collection:read` (unchanged — agents can
  claim/work but NOT accept-from-triage or close)
- `reviewer`/`orchestrator` → `task:read, task:write, task:claim, task:accept,
  task:close, collection:read` (this is a NEW effective role tier — confirm how roles are
  currently assigned/configured and add this tier correctly)
- `viewer` → `task:read, collection:read` (unchanged)

## Task
1. Read the full design doc (`design-review-triage-acceptance-authority.md`) before
   starting — it has the complete rationale, pseudocode sketch, and the "actor-agnostic
   authority" principle behind this.
2. Locate the existing Stage 4 scope vocabulary and `RequireScope()` implementation
   (should be from your own prior Stage 4 work — you know this code).
3. Add `task:accept` and `task:close` to the vocabulary.
4. Implement the transition→scope mapping as a centralized, configurable table (not
   inline hardcoded checks scattered across handlers) per the extensibility requirement
   above.
5. Wire it into `UpdateTask` (stage-change path) and `ClaimTask`.
6. **Investigate and resolve the backward-compatibility risk described above** before
   considering this done. Report your findings either way (found real live dependency on
   old behavior + your mitigation, OR confirmed no live impact + why).
7. Update default role→scope assignments per the table above.
8. Run existing Go tests; add test coverage for the new transition enforcement
   (this package already has an established test convention — `iapauth_test.go`,
   `unified_test.go` — follow it, don't skip tests for this PR).
9. Real verification (not code-analysis only, given auth-critical risk): exercise actual
   RPC calls (or a local test harness) proving (a) an `agent`-scoped token CANNOT accept
   from triage or close, (b) a `reviewer`-scoped token CAN do the full lifecycle, (c) an
   `agent`-scoped token CAN still claim an already-accepted task, (d) claiming directly
   from triage is correctly rejected (or handled per your compat-risk resolution above).

## Deliverables
1. A PR against `main`.
2. Evidence of real verification (not just unit tests) for the 4 scenarios in step 9,
   saved to `/scion-volumes/scratchpad/projects/farmtable/reports/auth-stage4-scope-ext-evidence/`.
3. Explicit written findings on the backward-compatibility question (step 6), even if the
   answer is "no live impact found."
4. A message to the coordinator with the PR link, your compat-risk findings, and
   confirmation that an independent review is either done or actively requested (per the
   Critical Constraints — do not skip it).

## Direct Contact
- Coordinator: `scion message coordinator "<message>"` for questions, blockers, or the
  compat-risk finding, and when ready for review/merge/deploy sequencing.
- ptone@google.com / auth architect already resolved the design questions — do not
  re-litigate the decisions above, they are final. If you hit a NEW design ambiguity not
  covered here, message the coordinator rather than guessing.

## Termination
You MUST implement the scope vocabulary extension, the transition-enforcement mapping,
resolve/report on the backward-compatibility risk, get an independent review (not
self-reviewed), produce real verification evidence, open the PR, and message the
coordinator with the PR link and findings. Then signal task_completed.
