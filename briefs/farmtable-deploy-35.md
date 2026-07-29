# Brief: URGENT-CARE Deploy latest `main` to Cloud Run (deploy-35) — Auth Plan Stage 4 (RBAC)

## Critical Constraints (read first)
- Do this in a dedicated git worktree, NOT the shared `/workspace/farmtable` checkout:
  `git worktree add /workspace/farmtable-deploy-35 -b deploy-35-snapshot origin/main`
  (standing policy — farmtable-em-auth-implementation is actively working Stages 5/6 in
  its own worktree(s), this is safe).
- **THIS IS A HIGH-RISK DEPLOY** — Stage 4 adds scope + collection-access enforcement to
  ALL 28+ RPC handlers. If a scope/collection check is too strict or misconfigured
  anywhere, this could lock out legitimate access broadly. Be methodical: verify each
  access path BEFORE declaring success. If anything looks broken, STOP and report
  immediately.
- Do not merge/modify any code. This is a build+deploy+verify task only.
- GitHub GraphQL API may still be rate-limited — prefer REST (`gh api repos/...`).

## Context
Last deploy was rev `farmtable-00040-c8p` (commit `befeffd`, Auth Stages 1-3). Since then,
Stage 4 (Scoped Tokens & Basic RBAC) merged directly to `main` by
`farmtable-em-auth-implementation` (self-merge authority for this workstream), commit
`5b05b01`:
- New scope vocabulary: `task:read`, `task:write`, `task:claim`, `collection:read`,
  `collection:write`, `collection:admin`, `token:manage`, `user:read`, `*` wildcard.
- `RequireScope()` + `RequireCollectionAccess()` enforced on ALL 28+ RPC handlers.
- Scope/collection fields added to the `ApiToken` schema.
- `ft token create --scope`/`--collection` flags.
- Default scopes assigned by user type (admin=`*`, agent=task rw+claim+collection read,
  viewer=read-only).

## Task
1. Confirm exactly what's new: `git log --oneline origin/main` since `befeffd`.
2. Build and deploy `main` HEAD to the existing `farmtable` Cloud Run service, project
   `deploy-demo-test`, region `us-central1` — same pattern as prior deploys (check
   `deploy/2026-07-23-deploy-34.md` for exact commands/flags).
3. Verify the new revision is live and serving 100% traffic (`gcloud run services describe`
   + `curl`).
4. **Verify scope/collection enforcement works correctly**, in this order, stopping to
   report immediately if any fails:
   a. Existing/default token (created before Stage 4, or the standard `farmtable-token`
      secret) still works for its expected operations — confirm backward compat wasn't
      broken (an old token should still be able to do what it could before, per whatever
      default scope migration Stage 4 applied to pre-existing tokens — check the design
      doc/task log if unclear on what that migration was).
   b. Create a new SCOPED token via `ft token create --scope task:read --collection
      <some-collection-id>` and confirm: (i) it CAN read tasks in that collection, (ii) it
      CANNOT write/mutate tasks in that collection (should be rejected), (iii) it CANNOT
      access a DIFFERENT collection at all (should be rejected).
   c. Create a token with `--scope "*"` (admin) and confirm it can do everything (read,
      write, manage tokens, access any collection).
   d. Confirm the web dashboard (session-based auth from Stage 2) still works end-to-end —
      RBAC shouldn't have broken the session-to-bearer middleware's effective permissions
      for a normal logged-in user.
   e. Confirm the decomposer / ft CLI (dual-header IAP pattern) still works with
      appropriate scopes.
5. Report every single check's pass/fail explicitly — do not summarize away a failure.

## Deliverables
1. New Cloud Run revision live, 100% traffic, independently verified (gcloud + curl).
2. Explicit pass/fail evidence for EACH of the 5 checks above (with sub-checks for b).
   Saved under `/scion-volumes/scratchpad/projects/farmtable/deploy/2026-07-23-deploy-35/`
3. A deploy log at
   `/scion-volumes/scratchpad/projects/farmtable/deploy/2026-07-23-deploy-35.md`.
4. A message to the coordinator with revision ID, commit SHA, and explicit pass/fail on
   each check — if ANY fails, say so clearly and do not claim overall success.

## Direct Contact
- Coordinator: `scion message coordinator "<message>"` — message immediately if anything
  looks broken, don't wait until the end.
- Do not message ptone@google.com directly.

## Termination
You MUST deploy, verify scope/collection enforcement explicitly per the checks above,
produce the log, and message the coordinator with a clear per-check pass/fail. Then signal
task_completed.
