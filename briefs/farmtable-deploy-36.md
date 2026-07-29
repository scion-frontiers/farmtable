# Brief: Deploy latest `main` to Cloud Run (deploy-36) — Auth Plan Stage 5/6 Wiring

## Critical Constraints (read first)
- Do this in a dedicated git worktree, NOT the shared `/workspace/farmtable` checkout:
  `git worktree add /workspace/farmtable-deploy-36 -b deploy-36-snapshot origin/main`
  (standing policy).
- **MODERATE-RISK DEPLOY** — lower risk than deploy-34/deploy-35 because the default
  `AuthMode` is unchanged (`token`), and Stage 4's RBAC enforcement (already validated live
  in deploy-35) is untouched by this change. The new risk surface is: (1) two new
  always-on background goroutines (`TokenRefresher`, `CredentialMonitor`) that start
  regardless of AuthMode, and (2) new OAuth/IAP-proxy routes that are opt-in only. Do NOT
  enable `FARMTABLE_AUTH_MODE=oauth` or `=proxy` on the live service — there's a known,
  disclosed limitation (session-to-bearer bridging gap) in those modes; leave `AuthMode`
  unset/`token` for this deploy. Verifying oauth/proxy modes end-to-end is explicitly OUT
  OF SCOPE for this deploy.
- Do not merge/modify any code. This is a build+deploy+verify task only.
- GitHub GraphQL API may still be rate-limited — prefer REST (`gh api repos/...`).
- An independent reviewer (`farmtable-review-auth-wiring`) is reviewing this same commit in
  parallel. If the coordinator relays a BLOCKING finding from that review before you
  declare success, stop and wait for further instruction.

## Context
Last deploy was rev from deploy-35 (commit `5b05b01`, Stage 4 RBAC — verify exact rev via
`gcloud run services describe`). Since then, `farmtable-em-auth-implementation` wired Stage
5 (OAuth + IAP proxy auth modes, not enabled by default) and Stage 6 (scoped-token
credential improvements: encryption, TokenRefresher, CredentialMonitor) into server startup.
Commit `8665535` on `main` ("feat(auth): wire stage 5/6 auth components into server
startup"), on top of `5945891` (stage6 merge) and `e455aea` (stage5 merge) and `36235c3`
(duplicate-symbol fix).

Per the EM: with `FARMTABLE_AUTH_MODE` unset (the deploy default), behavior should be
identical to current production — no new routes, no new middleware, token-interceptor path
unchanged.

## Task
1. Confirm exactly what's new: `git log --oneline origin/main` since the deploy-35 commit.
2. Build and deploy `main` HEAD to the existing `farmtable` Cloud Run service, project
   `deploy-demo-test`, region `us-central1` — same pattern as prior deploys (check
   `deploy/2026-07-23-deploy-35.md` for exact commands/flags). **Do not set
   `FARMTABLE_AUTH_MODE`, `FARMTABLE_IAP_AUDIENCE`, `FARMTABLE_ALLOWED_DOMAINS`,
   `FARMTABLE_BASE_URL`, or `FARMTABLE_ENCRYPTION_KEY`** — deploy with the same env
   configuration as deploy-35 (default/unset) to keep AuthMode=token.
3. Verify the new revision is live and serving 100% traffic (`gcloud run services describe`
   + `curl`).
4. **Verify default-mode behavior is unchanged and the new background goroutines don't
   destabilize the service**, in this order, stopping to report immediately if any fails:
   a. Service starts cleanly — check Cloud Run logs for the first few minutes after deploy
      for any panics, crash-loops, or repeated error spam from `TokenRefresher` or
      `CredentialMonitor`.
   b. `ft` CLI with the dual-header IAP auth pattern (`/workspace/agents.md`) — confirm
      `ft task list` and a mutating call both still succeed with a valid scoped token
      (re-run the equivalent of deploy-35's checks 4a-4c to confirm Stage 4 RBAC still
      works post-wiring).
   c. The web dashboard: load it in a browser (Playwright), confirm session-based login
      still works end-to-end (Stage 2 behavior, unaffected by this wiring).
   d. `GetVersion`/`GetStatus` still work unauthenticated (exempt RPCs, unaffected).
   e. Check Cloud Run revision has been stable for at least several minutes (no restarts /
      OOM / crash-loop) — this is the main new risk (always-on goroutines).
5. Report every single check's pass/fail explicitly — do not summarize away a failure.

## Deliverables
1. New Cloud Run revision live, 100% traffic, independently verified (gcloud + curl).
2. Explicit pass/fail evidence for EACH of the 5 checks above. Saved under
   `/scion-volumes/scratchpad/projects/farmtable/deploy/2026-07-23-deploy-36/`
3. A deploy log at
   `/scion-volumes/scratchpad/projects/farmtable/deploy/2026-07-23-deploy-36.md`.
4. A message to the coordinator with revision ID, commit SHA, and explicit pass/fail on
   each check — if ANY fails, say so clearly and do not claim overall success.

## Direct Contact
- Coordinator: `scion message coordinator "<message>"` — message immediately if anything
  looks broken, don't wait until the end.
- Do not message ptone@google.com directly.

## Termination
You MUST deploy with AuthMode left at default (token), verify the 5 checks above, produce
the log, and message the coordinator with a clear per-check pass/fail. Then signal
task_completed.
