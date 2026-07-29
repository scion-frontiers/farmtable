# Brief: Independent Review — Stage 5/6 Auth Wiring (commit 8665535)

## Critical Constraints (read first)
- Use a dedicated git worktree: `git worktree add /workspace/farmtable-review-auth-wiring
  origin/main` (standing policy).
- This is a **post-hoc independent review**, not a fresh blind review before merge — the
  change is already merged to `main`. Your job is to catch anything that should be fixed
  before/shortly after this goes to production, not to gate the merge itself (too late for
  that).
- Do NOT modify code. Review only. If you find a real bug, report it — do not fix it
  yourself.
- The EM (`farmtable-em-auth-implementation`) self-reviewed this change because the blind
  code-reviewer template failed to provision 7 times in a row this session (known
  intermittent "Not logged in" provisioning bug, not specific to this diff). This
  independent pass is a check on that self-review, given how consequential auth-path
  changes are for this project.

## Context
`farmtable-em-auth-implementation` wired Stage 5 (OAuth + IAP proxy auth modes) and Stage 6
(scoped-token credential improvements) into server startup. Commit `8665535` on `main`
("feat(auth): wire stage 5/6 auth components into server startup"), on top of merge commits
`5945891` (stage6) and `e455aea` (stage5) and `36235c3` (duplicate-symbol fix).

Per the EM's own report:
- Default `AuthMode` remains `token` — when `FARMTABLE_AUTH_MODE` is unset, no new routes,
  no new middleware, gRPC token-interceptor path unchanged from what deploy-34/deploy-35
  already validated.
- New background goroutines (`TokenRefresher`, `CredentialMonitor`) start unconditionally in
  `main.go` regardless of AuthMode — the EM claims these are "no-ops with no configuration."
  **Verify this claim directly** — a background goroutine that isn't actually inert (e.g.
  panics on nil config, leaks a ticker, spams logs) would be a real production risk even
  though it's not gated behind an opt-in flag.
- Known limitation already flagged by the EM: OAuth-login and IAP-provisioned sessions don't
  set `sessKeyToken`, so session-based auth can't bridge to gRPC auth in `oauth`/`proxy`
  modes. This is pre-disclosed, not something to rediscover — just confirm the severity
  assessment ("non-blocking, opt-in modes only") is accurate.
- Self-review notes at `.scratch/pr-reviews/wiring-review.md` in the EM's worktree (may not
  be accessible from your fresh worktree — re-derive your own view from the diff, use the
  EM's notes only as a cross-check if you can find them via `gh pr view` history).

## Task
1. `git log --oneline main` to find the actual PR(s)/commits for this wiring change; get the
   full diff (`gh pr diff <N>` or `git show <sha>` per commit — prefer REST API if GraphQL
   rate-limited).
2. Review specifically for:
   a. **Default-path safety**: with no `FARMTABLE_AUTH_MODE`/`FARMTABLE_IAP_AUDIENCE`/
      `FARMTABLE_ALLOWED_DOMAINS`/`FARMTABLE_BASE_URL`/`FARMTABLE_ENCRYPTION_KEY` env vars
      set at all, does the server start cleanly and behave identically to pre-wiring code?
      Trace the AuthMode switch in `unified.go` and the goroutine startup in `main.go` to
      confirm this by reading, not just trusting the report.
   b. **Background goroutine safety**: what do `TokenRefresher` and `CredentialMonitor`
      actually do when unconfigured? Do they busy-loop, log spam, or hold any locks/DB
      connections that could matter at scale? Any unhandled nil-deref risk if
      `CredentialEncryptor`/`EntStore` fields are nil?
   c. **Graceful shutdown**: do the new goroutines actually respect shutdown signals, or
      could they leak/block server shutdown?
   d. Secrets handling: does `FARMTABLE_ENCRYPTION_KEY` (or absence thereof) get handled
      safely — no panic, no silently-insecure fallback (e.g. hardcoded key) if unset?
   e. Anything else that looks like a real bug (not style nitpicks).
3. Produce a clear verdict: APPROVE (safe to run in production with default token mode),
   APPROVE WITH FOLLOW-UPS (safe now, but file these non-blocking issues), or BLOCKING
   ISSUES FOUND (describe exactly what and why it's not safe to leave running against the
   live Cloud Run instance).

## Deliverables
1. A review report at
   `/scion-volumes/scratchpad/projects/farmtable/reports/auth-wiring-independent-review.md`
   with your verdict and specific findings (file/line references).
2. A message to the coordinator with the verdict and a one-line summary of any findings.

## Direct Contact
- Coordinator: `scion message coordinator "<message>"`.
- Do not message ptone@google.com directly.
- If you have questions about original design intent, `scion message farmtable-architect-auth
  "<question>"`.

## Termination
You MUST produce the review report with an explicit verdict and message the coordinator.
Then signal task_completed.
