# Brief: URGENT-CARE Deploy latest `main` to Cloud Run (deploy-34) — Auth Plan Stages 1-3

## Critical Constraints (read first)
- Do this in a dedicated git worktree, NOT the shared `/workspace/farmtable` checkout:
  `git worktree add /workspace/farmtable-deploy-34 -b deploy-34-snapshot origin/main`
  (standing policy — farmtable-em-auth-implementation is actively working Stage 4 in its
  own worktree, this is safe).
- **THIS IS A HIGH-RISK DEPLOY** — Stages 1-3 of the auth improvements plan introduce
  mandatory auth enforcement, session-based web auth, and identity requirements on every
  mutating RPC. If something is wrong, this could lock out legitimate access to the live
  service entirely (including your own ability to verify it, and other agents'/ptone's
  access). Be methodical: verify each access path BEFORE declaring success, and if
  anything looks broken, STOP and report immediately rather than trying more things that
  could make it worse.
- Do not merge/modify any code. This is a build+deploy+verify task only.
- GitHub GraphQL API may still be rate-limited — prefer REST (`gh api repos/...`).

## Context
Last deploy was rev `farmtable-00039-8xw` (commit `c957f7e`, Feature 60). Since then, three
stages of the Auth Improvements plan merged directly to `main` by
`farmtable-em-auth-implementation` (which has self-merge authority for this workstream):
- Stage 1: mandatory auth enforcement (interceptor rejects unauthenticated requests when
  token auth is configured; `GetVersion`/`GetStatus` exempt; `FARMTABLE_OPEN_ACCESS=1`
  opt-out for local dev).
- Stage 2: web dashboard session auth (`/api/auth/session` endpoints, encrypted cookies,
  login dialog, logout button, `?token=` URL param removed).
- Stage 3: `RequireIdentity()` enforced on all 12 mutating RPCs + WatchTasks; read-only RPCs
  unaffected; `LegacyTokenAuth` deprecated.

## Task
1. Confirm exactly what's new: `git log --oneline origin/main` since `c957f7e`.
2. Build and deploy `main` HEAD to the existing `farmtable` Cloud Run service, project
   `deploy-demo-test`, region `us-central1` — same pattern as prior deploys (check
   `deploy/2026-07-23-deploy-33.md` for exact commands/flags).
3. Verify the new revision is live and serving 100% traffic (`gcloud run services describe`
   + `curl`).
4. **Verify EVERY access path still works under the new mandatory-auth model**, in this
   order, stopping to report immediately if any fails:
   a. `ft` CLI with the dual-header IAP auth pattern (`/workspace/agents.md`) — confirm
      `ft task list` and a mutating call (e.g. `ft task update`) both succeed with a valid
      token.
   b. An unauthenticated call (no token at all) to a MUTATING RPC — confirm it's now
      correctly REJECTED (this proves Stage 1/3 are actually enforcing, not just present in
      code but inert).
   c. `GetVersion`/`GetStatus` (or equivalent health-check RPCs) WITHOUT a token — confirm
      these still work unauthenticated (they're supposed to be exempt).
   d. The web dashboard: load it in a browser (Playwright), confirm the login flow works
      (session cookie set, can perform actions), confirm logout works, confirm there's no
      `?token=` URL param requirement anymore.
   e. If practical, confirm the decomposer binary or another existing token-based consumer
      still authenticates successfully (proves backward compat for the "legacy" path isn't
      totally broken, or if it should now use a different pattern, confirm the correct new
      pattern works).
5. Report every single check's pass/fail explicitly — do not summarize away a failure.

## Deliverables
1. New Cloud Run revision live, 100% traffic, independently verified (gcloud + curl).
2. Explicit pass/fail evidence for EACH of the 5 access-path checks above. Saved under
   `/scion-volumes/scratchpad/projects/farmtable/deploy/2026-07-23-deploy-34/`
3. A deploy log at
   `/scion-volumes/scratchpad/projects/farmtable/deploy/2026-07-23-deploy-34.md`.
4. A message to the coordinator with revision ID, commit SHA, and explicit pass/fail on
   each of the 5 checks — if ANY fails, say so clearly and do not claim overall success.

## Direct Contact
- Coordinator: `scion message coordinator "<message>"` — message immediately if anything
  looks broken, don't wait until the end.
- Do not message ptone@google.com directly.

## Termination
You MUST deploy, verify ALL 5 access paths explicitly, produce the log, and message the
coordinator with a clear per-check pass/fail. Then signal task_completed.
