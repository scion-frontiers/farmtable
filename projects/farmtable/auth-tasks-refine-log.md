# Auth Tasks Refine — Change Log

**Date:** 2026-07-23
**Agent:** farmtable-em-auth-tasks-refine
**Collection:** Auth Improvements (`9a16e171-59e6-4179-a79d-708b8e2adade`)
**Source spec:** `/scion-volumes/scratchpad/projects/farmtable/task-edit-specs.md` (produced by farmtable-architect-auth)

---

## Summary

Applied 21 edits from the architect's task-edit-specs.md to the live Auth Improvements collection. The spec was derived from the blind-EM exercise's Phase 2 recommendations (exercise-blind-em-phase2.md). Total tasks went from 52 → 62.

## Edits Applied

### Category 1: Epic Description Prepends (6 edits)

Each stage epic (Stages 1-6) received a context block prepended to its existing description. The context block includes: current behavior, desired behavior, non-goals, key design decisions, parallelism guidance, and scion reference source file paths.

| # | Epic | Task ID | What was added |
|---|------|---------|----------------|
| 1 | Stage 1: Mandatory Auth Enforcement | `88970ef7` | Context on 5-step interceptor flow, WhoAmI as only enforcing RPC, FARMTABLE_TOKEN overloading, GitHub pass-through mode caveat, scion ref to `UnifiedAuthMiddleware` at `pkg/hub/auth.go:82` |
| 2 | Stage 2: Web Dashboard Auth | `4a2808ff` | Context on current grpc-client.ts token resolution chain, design rationale for cookies vs JWTs, where session endpoints live, scion ref to `sessionToBearerMiddleware` at `pkg/hub/web.go:581` |
| 3 | Stage 3: Identity-Aware Operations | `9b99e139` | Context on uuid.Nil actor problem, three-layer auth separation (authn/identity/authz), parallelism guidance |
| 4 | Stage 4: Scoped Tokens & RBAC | `63de00c3` | Context on ApiToken schema, RBAC vs capability rationale, load-bearing vocabulary note, open question, scion ref to `pkg/hub/agenttoken.go:45-60` |
| 5 | Stage 5: OAuth / SSO & IAP Proxy Auth | `56845fff` | Context on IAP JWT assertion handling, three auth modes, open question, scion refs to `IAPAuthenticator`, `ProxyAuthenticator`, `MakeProxyUserProvisioner` with file paths |
| 6 | Stage 6: External Credential Improvements | `84cb1551` | Context on LinkedAccount schema, Sensitive() vs encryption distinction, open question on KMS vs env var |

### Category 2: Subtask Scion Reference Appends (4 edits)

| # | Subtask | Task ID | Scion reference added |
|---|---------|---------|----------------------|
| 7 | Add session-to-bearer middleware | `5ccdac08` | `pkg/hub/web.go:581` — functional description of cookie→bearer bridge |
| 8 | Implement RequireScope() helper | `3e3045ea` | `pkg/hub/authz.go:422` — HasScope() check and wildcard bypass |
| 9 | Implement IAPAuthenticator | `e1eb7477` | `pkg/hub/proxyauth.go:42,70` — ProxyAuthenticator interface and IAP ES256 verification |
| 10 | Implement user provisioning | `3a7dc53e` | `pkg/hub/auth.go:567` — MakeProxyUserProvisioner find-or-create pattern |

### Category 3a: New Deployment/Verification Tasks (6 tasks created)

| # | Task name | New Task ID | Parent Epic | Blocked By |
|---|-----------|-------------|-------------|------------|
| 11 | Deploy and verify mandatory auth enforcement | `5860d4d5` | Stage 1 | Migration testing task |
| 12 | Deploy and verify web dashboard auth | `3cfdc386` | Stage 2 | Web dashboard test task |
| 13 | Deploy and verify identity-aware operations | `f3399ee6` | Stage 3 | Identity-aware test task |
| 14 | Deploy and verify RBAC enforcement | `0fff1ae4` | Stage 4 | RBAC test task |
| 15 | Deploy and verify OAuth/IAP proxy auth | `5f446737` | Stage 5 | OAuth/IAP test task |
| 16 | Deploy and verify external credential improvements | `d316d212` | Stage 6 | External credential test task |

### Category 3b: New Decision Tasks (3 tasks created)

| # | Task name | New Task ID | Parent Epic | Blocks |
|---|-----------|-------------|-------------|--------|
| 17 | Decision: Scope vocabulary refinement | `3a28c25a` | Stage 4 | "Define scope vocabulary" subtask |
| 18 | Decision: OAuth provider choice | `c736e10f` | Stage 5 | "Implement Google OAuth login flow" subtask |
| 19 | Decision: LinkedAccount encryption key management | `04d95ed3` | Stage 6 | "Add encrypted-at-rest storage" subtask |

### Category 3c: Cross-Stage Integration Test (1 task created)

| # | Task name | New Task ID | Blocked By |
|---|-----------|-------------|------------|
| 20 | End-to-end auth integration test | `1b68166e` | All 6 stage epics (Stages 1-6) |

### Category 4: Collection Description Update (1 edit)

| # | Change | Target |
|---|--------|--------|
| 21 | Added scion reference source path, design doc path, current state findings path, and task decomposition learnings path to collection description | Collection `9a16e171` |

## Design Doc Gaps

The architect (`farmtable-architect-auth`) had already updated the design doc (`design-auth-improvements.md`) with a comprehensive 10-pattern scion reference table including specific file paths and line numbers. No additional gaps were found that needed flagging.

## Scion Reference Source Exploration

During preparation, the following scion reference files were read and mapped to farmtable auth stages:

| Scion File | Farmtable Stage(s) | Key Pattern |
|------------|-------------------|-------------|
| `pkg/hub/auth.go` | 1, 5 | `UnifiedAuthMiddleware`, `isUnauthenticatedEndpoint()`, `MakeProxyUserProvisioner` |
| `pkg/hub/proxyauth.go` | 5 | `ProxyAuthenticator` interface, `IAPAuthenticator` with ES256/JWKS verification |
| `pkg/hub/agenttoken.go` | 4 | `AgentTokenScope` constants, `HasScope()`, `RequireAgentScope()` middleware |
| `pkg/hub/web.go` | 2 | `sessionToBearerMiddleware`, `gorilla/sessions` CookieStore setup, session key management |
| `pkg/hub/usertoken.go` | 4 | User access token (PAT) structure with `scion_pat_*` prefix |

## Technical Notes

- Used a patched `ft` CLI binary (at `/tmp/ft-iap`) with `FARMTABLE_IAP_TOKEN` env var support to handle dual-header IAP auth. The patch was applied in a disposable git worktree at `/tmp/farmtable-iap-build` — no changes committed to the main repo.
- Used a small Go helper (at `/tmp/update-collection`) to call the `UpdateCollection` gRPC RPC for the collection description update, since the `ft` CLI doesn't have a `collection update` subcommand.
- The architect's spec was applied verbatim; no freelanced interpretations or additional edits beyond the spec.
