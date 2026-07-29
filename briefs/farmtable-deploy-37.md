# Brief: Deploy latest `main` to Cloud Run (deploy-37) — Auth Plan Final Follow-up Fixes

## Critical Constraints (read first)
- Do this in a dedicated git worktree, NOT the shared `/workspace/farmtable` checkout:
  `git worktree add /workspace/farmtable-deploy-37 -b deploy-37-snapshot origin/main`
  (standing policy).
- **LOW-RISK DEPLOY** — this is the tail end of the auth improvements plan. The 3 changes
  in this deploy are narrow, additive fixes (startup validation + a warning log) to opt-in
  code paths (`AuthMode=oauth`/`proxy`, Stage 6 encryption) that are NOT enabled on the live
  service. Default `AuthMode=token` behavior should be completely unaffected.
- Do not merge/modify any code. This is a build+deploy+verify task only.
- GitHub GraphQL API may still be rate-limited — prefer REST (`gh api repos/...`).
- Do NOT set `FARMTABLE_AUTH_MODE`, `FARMTABLE_IAP_AUDIENCE`, `FARMTABLE_ALLOWED_DOMAINS`,
  `FARMTABLE_BASE_URL`, or `FARMTABLE_ENCRYPTION_KEY` — keep the same env configuration as
  deploy-36 (all unset, default token mode).

## Context
Last deploy was deploy-36, revision `farmtable-00042-x2d` (commit `8665535`, Stage 5/6
wiring) — all 5 checks passed. Since then, `farmtable-em-auth-implementation` merged commit
`5c05b0d` fixing 3 non-blocking findings from the independent review:
1. Startup validation for empty `FARMTABLE_IAP_AUDIENCE` in proxy mode.
2. (Session-bridging gap — NOT fixed here, tracked as a separate live follow-up task,
   unrelated to this deploy.)
3. Warning/fail-fast on malformed `FARMTABLE_ENCRYPTION_KEY` instead of silent plaintext
   fallback.

This is expected to be the FINAL deploy closing out the 6-stage auth improvements plan.

## Task
1. Confirm exactly what's new: `git log --oneline origin/main` since commit `8665535`.
2. Build and deploy `main` HEAD to the existing `farmtable` Cloud Run service, project
   `deploy-demo-test`, region `us-central1` — same pattern as deploy-36 (check
   `deploy/2026-07-23-deploy-36.md` for exact commands/flags).
3. Verify the new revision is live and serving 100% traffic (`gcloud run services describe`
   + `curl`).
4. **Verify no regression from deploy-36's baseline**, in this order, stopping to report
   immediately if any fails:
   a. Service starts cleanly — check Cloud Run logs for the first few minutes (no panics,
      crash-loops, new startup errors from the validation changes).
   b. `ft` CLI dual-header IAP auth + RBAC scope enforcement still works (repeat deploy-36's
      check 4b at a basic level — read/write with existing token, scoped-token restriction).
   c. Web dashboard session-based login still works end-to-end.
   d. `GetVersion`/`GetStatus` still work unauthenticated.
   e. Revision stable for several minutes (no restarts/OOM/crash-loop).
5. Report every check's pass/fail explicitly.

## Deliverables
1. New Cloud Run revision live, 100% traffic, independently verified (gcloud + curl).
2. Explicit pass/fail evidence for EACH check above. Saved under
   `/scion-volumes/scratchpad/projects/farmtable/deploy/2026-07-23-deploy-37/`
3. A deploy log at
   `/scion-volumes/scratchpad/projects/farmtable/deploy/2026-07-23-deploy-37.md`.
4. A message to the coordinator with revision ID, commit SHA, and explicit pass/fail on
   each check.

## Direct Contact
- Coordinator: `scion message coordinator "<message>"` — message immediately if anything
  looks broken.
- Do not message ptone@google.com directly.

## Termination
You MUST deploy, verify the checks above, produce the log, and message the coordinator with
a clear per-check pass/fail. Then signal task_completed.
