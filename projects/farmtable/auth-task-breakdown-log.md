# Auth Improvements Task Breakdown — Running Log

**Date:** 2026-07-23
**Agent:** farmtable-em-auth-taskbreakdown
**Collection ID:** `9a16e171-59e6-4179-a79d-708b8e2adade`
**Collection Name:** "Auth Improvements"
**Live Instance:** farmtable-qo7k5fvpda-uc.a.run.app

---

## Task Structure

### Overview

- **Total tasks:** 52
- **Epics (stages):** 7
- **Subtasks:** 45
- **Completed (Stage 0 / PR #136):** 7 (1 epic + 6 subtasks)
- **Open:** 45

### Stage Breakdown

| Stage | Epic ID | Subtasks | Status | Blocked By |
|-------|---------|----------|--------|------------|
| Stage 0: X-Farmtable-Token Header Fix | `3192813c` | 6 | COMPLETED | None |
| Stage 1: Mandatory Auth Enforcement | `88970ef7` | 6 | Open | Stage 0 (completed) |
| Stage 2: Web Dashboard Auth | `4a2808ff` | 7 | Open | Stage 1 |
| Stage 3: Identity-Aware Operations | `9b99e139` | 6 | Open | Stage 1 |
| Stage 4: Scoped Tokens & Basic RBAC | `63de00c3` | 8 | Open | Stage 3 |
| Stage 5: OAuth / SSO & IAP Proxy Auth | `56845fff` | 6 | Open | Stage 2 |
| Stage 6: External Credential Improvements | `84cb1551` | 6 | Open | Stage 4 |

### Dependency Graph (Inter-Stage)

```
Stage 0 (DONE) ──→ Stage 1 ──┬──→ Stage 2 ──→ Stage 5
                              └──→ Stage 3 ──→ Stage 4 ──→ Stage 6
```

Stages 2 and 3 can run in parallel after Stage 1.
Stages 5 and 6 can run in parallel after their respective dependencies.

### Critical Path

Stage 0 → Stage 1 → Stage 3 → Stage 4 → Stage 6 (4 hops after completed Stage 0)

### Bottlenecks (top downstream impact)

1. **Add scopes field to ApiToken Ent schema** (Stage 4) — blocks 6 downstream
2. **Implement server-side session endpoints** (Stage 2) — blocks 5 downstream
3. **Stage 1: Mandatory Auth Enforcement** — blocks 5 downstream
4. **Define scope vocabulary** (Stage 4) — blocks 5 downstream

---

## Decision: Representing the Completed IAP Header Fix (PR #136)

**Decision:** Represented as a completed Stage 0 epic within the collection, with 6
completed subtasks, for a complete historical record.

**Rationale:**
- The IAP header fix is explicitly listed as Phase 0 in the design doc's implementation
  phases table, with the note "already designed."
- It is a prerequisite for Stage 1 (mandatory auth enforcement). Having it as a completed
  task in the DAG shows the complete dependency chain.
- The epic and all subtasks are marked `completed` with the PR URL
  (`https://github.com/scion-frontiers/farmtable/pull/136`) and commit reference
  (`45635c1`) attached.
- Alternative considered: just referencing it in Stage 1's description as a prerequisite.
  Rejected because the DAG would lose the Phase 0 → Phase 1 dependency edge.

---

## Technical Notes

### Connecting to Live Instance Through IAP

The live farmtable instance is behind Google Cloud IAP. The `ft` CLI doesn't natively
support IAP OIDC + farmtable token dual-header auth. To populate the collection, I:

1. Extracted the IAP OAuth Client ID from the IAP redirect URL:
   `486315127503-o94o6safp9v2865ddj9cupqftnst9jfn.apps.googleusercontent.com`
2. Built a temporary `ft-iap` binary with a small patch adding `FARMTABLE_IAP_TOKEN` env
   var support (sends IAP token in `Authorization: Bearer` and farmtable token in
   `x-farmtable-token`)
3. Created a wrapper script (`/tmp/ft-auth.sh`) that generates the IAP identity token and
   calls the patched binary
4. Reverted the code patch after completing the task (no code changes committed)

This approach is itself a data point for Stage 5 (OAuth / SSO & IAP Proxy Auth) — it
demonstrates the friction of the current dual-token setup and validates that native IAP
support would significantly improve the agent developer experience.

### Subtask Design Principles

- **Each subtask is developer-agent-actionable:** Descriptions include specific file paths,
  function names, and behavioral specifications. A developer agent can pick up any subtask
  and know what to build.
- **Test tasks are explicit:** Every stage has a dedicated test subtask with specific test
  case enumeration. Tests are blocked by their implementation prerequisites.
- **Intra-stage parallelism preserved:** Within each stage, subtasks that can run in
  parallel are not artificially sequenced. Only genuine dependencies create blocking edges.
- **Scion pattern references included:** Where the design doc references borrowing a
  pattern from scion (e.g., `sessionToBearerMiddleware`, `extractAgentToken`), the subtask
  description names the pattern for the developer to reference.

---

## Subtask Detail

### Stage 0 Subtasks (all COMPLETED)
1. Add extractToken() helper in auth.go
2. Update auth interceptors to use extractToken()
3. Update CLI authCtx() to send both headers
4. Update decomposer authCtx() to send both headers
5. Update web client metadata() to send both headers
6. Add unit tests for custom header auth

### Stage 1 Subtasks
1. Implement reject-by-default auth interceptor — HIGH priority, no dependencies
2. Add RPC exemption list for health/version endpoints — blocked by 1.1
3. Add --open-access flag and FARMTABLE_OPEN_ACCESS env — independent of 1.1/1.2
4. Ensure embedded CLI mode auto-authenticates — independent
5. Add tests for mandatory auth enforcement — blocked by 1.1, 1.2, 1.3
6. Migration testing: verify existing clients unaffected — blocked by 1.5

### Stage 2 Subtasks
1. Implement server-side session endpoints — HIGH priority, no dependencies within stage
2. Add session-to-bearer middleware — blocked by 2.1
3. Build token-entry login screen UI — blocked by 2.1
4. Add logout functionality to dashboard — blocked by 2.3
5. Remove ?token= URL parameter support — blocked by 2.1, 2.2
6. Keep localStorage token fallback for dev/testing — independent
7. Add tests for web dashboard auth flow — blocked by 2.1, 2.2

### Stage 3 Subtasks
1. Enforce auth on mutating RPCs — HIGH priority, no dependencies within stage
2. Enforce auth on WatchTasks streaming RPC — independent (parallel with 3.1)
3. Verify read-only RPCs remain accessible — independent
4. Ensure Change records capture authenticated actor — blocked by 3.1
5. Deprecate LegacyTokenAuth — independent
6. Add tests for identity-aware operations — blocked by 3.1, 3.2, 3.4

### Stage 4 Subtasks
1. Add scopes field to ApiToken Ent schema — no dependencies within stage
2. Define scope vocabulary — independent (parallel with 4.1)
3. Add per-collection scoping to ApiToken — blocked by 4.1
4. Implement RequireScope() enforcement helper — blocked by 4.1, 4.2
5. Add scope enforcement to all RPC handlers — blocked by 4.4
6. Add --scope and --collection flags to ft token create — blocked by 4.1, 4.2
7. Implement user type-based default scopes — blocked by 4.2, 4.6
8. Add tests for RBAC enforcement — blocked by 4.4, 4.5

### Stage 5 Subtasks
1. Implement Google OAuth login flow — no dependencies within stage
2. Implement ProxyAuthenticator with IAPAuthenticator — independent (parallel with 5.1)
3. Add auth mode configuration — blocked by 5.1, 5.2
4. Implement user provisioning with domain allowlist — blocked by 5.1, 5.2
5. Update web dashboard for OAuth login — blocked by 5.3
6. Add tests for OAuth and IAP proxy auth — blocked by 5.1, 5.2, 5.3

### Stage 6 Subtasks
1. Implement GitHub App installation OAuth flow — no dependencies within stage
2. Implement OAuth flows for Jira and Linear — independent (parallel with 6.1)
3. Implement background token refresh — blocked by 6.1, 6.2
4. Add encrypted-at-rest storage for LinkedAccount tokens — independent
5. Implement credential status monitoring — blocked by 6.3
6. Add tests for external credential improvements — blocked by 6.1, 6.3, 6.4
