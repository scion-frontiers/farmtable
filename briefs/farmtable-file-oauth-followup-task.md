# Brief: File One Follow-up Task on Live Auth Improvements Collection

## Critical Constraints (read first)
- This is a tiny, single-purpose task: create ONE task record on the live farmtable
  instance. No code changes to the farmtable repo are expected (a worktree is not needed
  unless you determine you must extend `ft-iap` — see below).
- `/workspace/.farmtable/bin/ft-iap` is a minimal custom wrapper for reaching the
  IAP-protected live instance — it currently only supports `list-tasks`, `get-task`,
  `update-task` (confirmed: no `create-task`). The plain `/workspace/.farmtable/bin/ft`
  binary does NOT work through IAP at all (no built-in OIDC token injection) — see
  `/workspace/agents.md` "Authenticating to the IAP-Protected Cloud Run Instance" for the
  full two-header auth model (IAP OIDC `Authorization: Bearer` + app-level
  `x-farmtable-token`).
- Coordinator already confirmed `grpcurl` is not installed and no proto reflection tooling
  is set up — don't assume it's there.

## Context
`farmtable-em-auth-implementation` wired Stage 5/6 auth components into `unified.go`/
`main.go` (commit `8665535`) and identified a known, non-blocking limitation: OAuth-login
and IAP-provisioned sessions don't set `sessKeyToken`, so `SessionToBearerMiddleware` can't
bridge them to gRPC auth in the opt-in `oauth`/`proxy` AuthModes (default `token` mode is
unaffected). The EM cannot itself create tasks against the live instance (same `ft-iap`
limitation) and asked the coordinator to file this as a tracked follow-up.

## Task
1. Find the fastest correct way to create a task record on the live instance's "Auth
   Improvements" collection (`9a16e171-59e6-4179-a79d-708b8e2adade`). Options in rough
   order of preference:
   a. Extend `ft-iap` with a minimal `create-task` command (small, additive change to
      whatever Go source built that wrapper — check `/scion-volumes/scratchpad/projects/farmtable/tools/`
      or ask `farmtable-architect-auth` if unsure where its source lives) and rebuild it.
   b. Write a tiny one-off Go program (or reuse relevant snippets from `cmd/ft`) that opens
      a gRPC connection with both required headers (per agents.md) and calls the
      `CreateTask` RPC directly.
   c. Any other reliable method — your judgment, as long as it actually lands the task on
      the LIVE instance (verify with `ft-iap get-task` or `list-tasks` afterward).
2. Create exactly this task:
   - **Title:** Follow-up: Bridge OAuth/IAP sessions to gRPC auth
   - **Priority:** LOW
   - **Stage:** triage
   - **Labels:** auth, follow-up
   - **Collection:** 9a16e171-59e6-4179-a79d-708b8e2adade (Auth Improvements)
   - **Description:**
     OAuth login and IAP proxy auth create user sessions (sessKeyUserID, sessKeyUserName,
     etc.) but do NOT set sessKeyToken. The SessionToBearerMiddleware checks sessKeyToken to
     inject a Bearer header for the gRPC auth interceptor, so gRPC requests from OAuth/IAP-
     authenticated users will fail with no auth.

     Options to fix:
     1. Extend gRPC interceptor to support session-based auth directly (check session
        cookie, look up user, inject identity into context without requiring a token)
     2. Auto-generate an API token for OAuth/IAP-provisioned users and store it in the
        session
     3. Modify SessionToBearerMiddleware to handle sessions without tokens

     Only affects opt-in AuthModeOAuth and AuthModeProxy. Default AuthModeToken is
     unaffected. Identified during Stage 5/6 wiring review. Non-blocking.
3. Verify the task actually landed (read it back via `ft-iap get-task` or `list-tasks`,
   don't just trust the create call's exit code — Simulation Trap applies here too).
4. If you built a new `create-task` capability into `ft-iap` (option 1a) and it required a
   real code change, treat that as a small deliverable too: note where the source lives and
   whether it's worth a PR, but do NOT open a PR yourself without checking with the
   coordinator first — this brief is scoped to filing the one task, not shipping new
   tooling.

## Deliverables
1. The task created and verified live on the Auth Improvements collection — include the
   new task's ID in your report.
2. A message to the coordinator confirming the task ID and how you created it.

## Direct Contact
- Coordinator: `scion message coordinator "<message>"`.
- Do not message ptone@google.com directly.

## Termination
You MUST create the task, verify it landed on the live collection, and message the
coordinator with the task ID. Then signal task_completed.
