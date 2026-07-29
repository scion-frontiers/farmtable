# Brief: Independent Review — Stage 5/6 Follow-up Fixes (commit 5c05b0d)

## Critical Constraints (read first)
- Use a dedicated git worktree: `git worktree add /workspace/farmtable-review-auth-fixes
  origin/main` (standing policy).
- Post-hoc review, already merged — no code changes, review only.
- Small, narrow diff expected (3 targeted fixes) — this should be a quick review, not a
  deep architecture pass. Don't over-scope it.

## Context
`farmtable-em-auth-implementation` fixed the 3 non-blocking findings from the first
independent review of the Stage 5/6 auth wiring (commit `8665535`):
1. Empty `FARMTABLE_IAP_AUDIENCE` bypassing audience binding when `AuthMode=proxy` — should
   now have startup validation.
2. OAuth/IAP session-to-bearer gap — already tracked as a live follow-up task
   (`a7104d1b-674b-448c-aded-b6e0e9eb3ca7`), not expected to be fixed in this commit (was
   flagged as a larger follow-up, not a quick fix) — confirm it wasn't silently
   "fixed" in a way that needs checking, but don't expect a full fix here.
3. Malformed `FARMTABLE_ENCRYPTION_KEY` silently falling back to plaintext — should now
   either warn loudly or fail startup instead of silent fallback.

Original independent review report (for reference, what to check against):
`/scion-volumes/scratchpad/projects/farmtable/reports/auth-wiring-independent-review.md`

This is the SECOND time this EM's blind code-reviewer failed to provision and it had to
self-review its own fix — this review pass exists specifically to get an independent check
on record given that pattern, not because of specific doubt about the fix quality.

## Task
1. Find the actual commit/PR for `5c05b0d` on `main` (`gh api repos/... `, prefer REST if
   GraphQL rate-limited).
2. Confirm fixes 1 and 3 are real and correct:
   - Startup validation actually rejects/warns on empty IAP audience in proxy mode (check:
     does it fail cleanly, or could it be bypassed some other way?).
   - Encryption key validation actually catches malformed keys and does NOT silently
     continue with plaintext storage (check: what does "malformed" mean here — wrong length,
     invalid base64, etc. — and are all failure modes covered, or just some?).
3. Confirm fix 2 (session-bridging) was correctly left as NOT fixed here (should just be
   tracked as the existing follow-up task, not attempted in this narrow commit) — flag if
   the EM tried to sneak in a partial/risky fix for this without it being reviewed properly.
4. Confirm none of the 3 fixes changed default (`AuthMode=token`) behavior — these should be
   purely additive validation/logging in the opt-in oauth/proxy/Stage-6-encryption paths.
5. Give a clear verdict: APPROVE, APPROVE WITH FOLLOW-UPS, or BLOCKING ISSUES.

## Deliverables
1. A short review report at
   `/scion-volumes/scratchpad/projects/farmtable/reports/auth-fixes-independent-review.md`.
2. A message to the coordinator with the verdict.

## Direct Contact
- Coordinator: `scion message coordinator "<message>"`.
- Do not message ptone@google.com directly.

## Termination
You MUST review the fix commit, produce the report, and message the coordinator with a
clear verdict. Then signal task_completed.
