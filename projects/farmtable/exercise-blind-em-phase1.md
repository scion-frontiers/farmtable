# Phase 1 Report: Auth Improvements — Tasks-Only Assessment

**Date:** 2026-07-23
**Assessor:** farmtable-em-blind-auth-exercise
**Method:** Blind assessment from farmtable task system only. No design documents, source code, or supplementary materials consulted.

---

## Scope Summary

**What is this feature?** A comprehensive authentication and authorization overhaul for Farm Table, a task management system used by AI agents. The project transforms Farm Table from a system where unauthenticated users have equal data access to one with mandatory authentication, identity-aware operations, role-based access control (RBAC), OAuth/SSO integration, and secure external credential management.

**What problem does it solve?** Multiple security and operational gaps:
1. **No mandatory auth:** Currently, unauthenticated requests can access data the same way authenticated ones can. The auth interceptor "passes through" instead of rejecting.
2. **No web dashboard login:** The web dashboard operates anonymously — browser users have no identity.
3. **Unreliable audit trail:** Mutations can record `uuid.Nil` as the actor because identity isn't enforced.
4. **No permission granularity:** All tokens are equivalent — a CI bot reading task status has the same permissions as an admin deleting collections.
5. **Token in URLs:** The `?token=` URL parameter leaks credentials via browser history, server logs, and referrer headers.
6. **Manual external credential management:** Connecting to GitHub/Jira/Linear requires manually entering PATs that can expire without notice.
7. **Plaintext credential storage:** LinkedAccount tokens are stored unencrypted.

---

## Architecture

### Technical Approach

From the task descriptions, the architecture follows these patterns:

- **Go backend** using **Ent ORM** (entgo.io) for data modeling, with SQLite (embedded) and Postgres (server mode).
- **gRPC** for the API layer, with **gRPC-Web** for browser clients.
- **Session management** via `gorilla/sessions` CookieStore with AES-256 encryption.
- **Token-based auth** using `ft_` prefixed API tokens validated through a `TokenLookup` interface (`StoreTokenLookup` backed by the Ent store).
- **Interceptor pattern** for auth enforcement — both unary and streaming gRPC interceptors.
- **HTTP middleware** for web dashboard auth — `sessionToBearerMiddleware` bridges browser sessions to the gRPC auth layer (cookie → bearer token injection).
- **IAP integration** — reads `X-Goog-IAP-JWT-Assertion` header and verifies ES256 JWTs against Google JWKS.
- **Resource:action scope model** (e.g., `task:read`, `task:write`, `collection:admin`, `*`) for RBAC.

### Key Technologies Referenced
- Google Cloud IAP (Identity-Aware Proxy)
- Google OAuth 2.0 (for user login)
- GitHub App installation OAuth (for external credential acquisition)
- Jira/Linear OAuth 2.0 flows
- AES-256-GCM encryption for at-rest credential storage
- ES256 JWT signature verification

### Patterns Borrowed
The tasks frequently reference "scion patterns":
- `UnifiedAuthMiddleware` with `isUnauthenticatedEndpoint()` exemption list
- `sessionToBearerMiddleware` pattern
- `IAPAuthenticator` and `ProxyAuthenticator` interface
- `ProxyUserProvisioner` pattern
- `extractAgentToken()` pattern

---

## Phases/Stages

The work is structured into 7 stages (0-6), with clear progression from foundational to advanced:

### Stage 0: X-Farmtable-Token Header Fix ✅ COMPLETED
- **6 tasks, all completed.** Added `x-farmtable-token` custom gRPC metadata header so clients can authenticate through IAP. This was necessary because IAP consumes the `Authorization` header.
- PR #136 merged (commit 45635c1).

### Stage 1: Mandatory Auth Enforcement (6 tasks, all open)
- Flip the auth interceptor from pass-through to reject-by-default when `TokenLookup` is configured.
- Add RPC exemption list for health/version endpoints.
- Add `--open-access` opt-out flag for local dev.
- Ensure embedded CLI mode auto-authenticates.
- Tests and migration testing.

### Stage 2: Web Dashboard Auth (7 tasks, all open)
- Server-side session management endpoints (POST/GET/DELETE `/api/auth/session`).
- Session-to-bearer middleware (cookie → bearer bridge).
- Token-entry login screen modal UI.
- Logout functionality with user identity display.
- Remove `?token=` URL parameter (security fix).
- Keep localStorage fallback for dev.
- Tests.

### Stage 3: Identity-Aware Operations (6 tasks, all open)
- Enforce auth on all mutating RPCs (`requireAuthenticatedUser()` helper).
- Enforce auth on WatchTasks streaming RPC.
- Verify read-only RPCs remain accessible.
- Ensure Change records (audit trail) capture authenticated actor.
- Deprecate `LegacyTokenAuth`.
- Tests.

### Stage 4: Scoped Tokens & Basic RBAC (8 tasks, all open)
- Add `scopes` field to ApiToken Ent schema.
- Define scope vocabulary (`task:read`, `task:write`, `task:claim`, `collection:read`, `collection:write`, `collection:admin`, `token:manage`, `user:read`, `*`).
- Per-collection scoping via `collection_ids` field.
- `RequireScope()` enforcement helper.
- Apply scope checks to all RPC handlers.
- CLI flags for scoped token creation.
- User type-based default scopes.
- Tests.

### Stage 5: OAuth / SSO & IAP Proxy Auth (6 tasks, all open)
- Google OAuth login flow (server-side redirect/callback).
- `ProxyAuthenticator` with `IAPAuthenticator` (verify `X-Goog-IAP-JWT-Assertion`).
- Auth mode configuration (`FARMTABLE_AUTH_MODE=token|oauth|proxy`).
- User auto-provisioning with domain allowlist and admin email list.
- Update web dashboard for OAuth login.
- Tests.

### Stage 6: External Credential Improvements (6 tasks, all open)
- GitHub App installation OAuth flow.
- Jira/Linear OAuth flows.
- Background token refresh for expiring OAuth grants.
- Encrypted-at-rest storage for LinkedAccount tokens (AES-256-GCM).
- Credential status monitoring (background validation job).
- Tests.

---

## Dependencies

### Epic-Level Dependency Chain

```
Stage 0 (completed) → Stage 1 → Stage 2 → Stage 5
                               → Stage 3 → Stage 4 → Stage 6
```

The dependency graph shows two main tracks after Stage 1:
1. **Web/OAuth track:** Stage 1 → Stage 2 → Stage 5
2. **Identity/RBAC track:** Stage 1 → Stage 3 → Stage 4 → Stage 6

**Notable:** Stage 2 and Stage 3 can run in parallel after Stage 1 completes. Stage 5 depends only on Stage 2; Stage 4 depends only on Stage 3. Stage 6 depends only on Stage 4.

### Intra-Stage Dependencies (within stages)

Each stage has well-defined internal dependency chains:

**Stage 1:**
```
Implement reject-by-default → Add RPC exemption list ──→ Add tests for mandatory auth ──→ Migration testing
                               Add --open-access flag ──→ Add tests for mandatory auth
```

**Stage 2:**
```
Implement session endpoints → Add session-to-bearer middleware → Remove ?token= URL parameter
                            → Build login screen UI → Add logout functionality
                            → Add tests for web dashboard auth flow
```

**Stage 3:**
```
Enforce auth on mutating RPCs → Ensure Change records capture actor → Add tests for identity-aware operations
Enforce auth on WatchTasks ──────────────────────────────────────────→ Add tests for identity-aware operations
```

**Stage 4:**
```
Add scopes field to schema ──→ Add per-collection scoping
                             → RequireScope() helper → Add scope enforcement to all RPCs → Add tests
Define scope vocabulary ─────→ RequireScope() helper
                             → Add --scope/--collection CLI flags → Implement user type-based defaults
```

**Stage 5:**
```
Implement Google OAuth → Add auth mode configuration → Update web dashboard for OAuth login
Implement IAPAuthenticator → Add auth mode configuration
                           → Implement user provisioning with domain allowlist
                           → Add tests for OAuth and IAP proxy auth
```

**Stage 6:**
```
Implement GitHub App OAuth ──→ Implement background token refresh → Credential status monitoring
Implement Jira/Linear OAuth ─→ Implement background token refresh
Add encrypted-at-rest storage ──────────────────────────────────────→ Add tests
```

### Parallel Workstreams

Within each stage, there are some tasks that can be parallelized:
- Stage 1: `--open-access` flag is independent of the exemption list.
- Stage 2: Login screen UI can start once session endpoints exist, independent of the middleware.
- Stage 3: WatchTasks auth and mutating RPCs auth can be done in parallel.
- Stage 4: Schema changes and scope vocabulary can be done in parallel.
- Stage 5: Google OAuth and IAPAuthenticator can be done in parallel.
- Stage 6: GitHub App flow, Jira/Linear flows, and encrypted storage can be done in parallel.

---

## Acceptance Criteria

Each task has specific acceptance criteria. Key highlights:

**Stage 1 AC:** Tokenless requests → `codes.Unauthenticated`. Valid tokens → pass through. No token configured → pass through (open mode). GetVersion/GetStatus exempt.

**Stage 2 AC:** Login modal appears. Token entry creates session. Cookie is httpOnly, SameSite=Lax, Secure in production. No tokens in URLs.

**Stage 3 AC:** All Change records have valid, non-nil actor. Mutations without auth → rejected. Read-only RPCs remain accessible.

**Stage 4 AC:** Tokens created with restricted scopes. Scope violations → `PermissionDenied`. Existing scopeless tokens → `*` (unrestricted). Per-collection scoping works.

**Stage 5 AC:** Google OAuth or IAP passes identity through. Auth mode configurable. User auto-provisioning with domain allowlist works.

**Stage 6 AC:** External platforms linkable via OAuth. Credentials encrypted at rest. Token refresh works. Credential monitoring detects invalid credentials.

The acceptance criteria are generally well-specified and testable. Each stage includes a dedicated testing task with detailed test case enumeration.

---

## Risks or Gaps

### What's Clear
1. **Stage sequencing is well-defined** — the dependency chain is logical and each stage builds on the previous.
2. **Stage 0 is done** — the foundation (x-farmtable-token header) is already deployed and verified.
3. **Pattern references are consistent** — tasks reference scion patterns by name, indicating a known codebase to draw from.
4. **Each stage has a test task** — testing isn't an afterthought.
5. **Scope vocabulary is explicitly enumerated** — the RBAC model is concrete, not abstract.
6. **Backward compatibility is considered** — each stage includes backward-compat provisions (open-access flag, scopeless-tokens-as-wildcard, localStorage fallback, existing PATs continue working).

### Questions I'd Need Answered Before Assigning Work

1. **What is `scion`?** Tasks reference scion patterns (UnifiedAuthMiddleware, sessionToBearerMiddleware, IAPAuthenticator, ProxyUserProvisioner, extractAgentToken) but there's no indication of where this code lives, whether it's a separate codebase to import from, or just a conceptual reference for the pattern. Is the developer expected to copy-port these patterns, or import a library?

2. **Where exactly does session management plug into the HTTP handler?** The task says "before grpc-web" but the actual handler middleware chain structure isn't described. A developer would need to understand the existing server initialization code.

3. **What's the web dashboard tech stack?** Task descriptions reference `web/src/gen/grpc-client.ts` but don't specify the frontend framework (React? Vanilla TS? Something else?). The login modal and OAuth button tasks need this context.

4. **Session cookie encryption key management:** The task mentions AES-256 with gorilla/sessions CookieStore, but doesn't specify where the encryption key comes from at startup. Is there a secrets manager? An env var? A generated key?

5. **How are user types currently managed?** Stage 4 assumes user types (admin, agent, viewer/human) exist, and tasks reference the User schema having a type field. But the relationship between user types and the token system isn't fully explained in the tasks — is this already implemented or does it need to be built?

6. **OAuth client registration:** Stage 5 requires `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`, but there's no task for setting these up in the deployment infrastructure. Same for GitHub App credentials in Stage 6.

7. **Database migration strategy:** Adding new schema fields (scopes, collection_ids) requires database migrations. The tasks mention "go generate ./internal/store/ent" but don't discuss migration of existing data or deployment coordination.

8. **GCP KMS vs env var for encryption:** The encrypted storage task explicitly notes this as an "open question from design doc" — it hasn't been resolved. The task says "start with env var, make it pluggable" but this is a design decision that could affect other tasks.

9. **No deployment or rollout tasks:** There are no tasks for deploying any of these stages, updating deployment configs, managing the transition from open to mandatory auth in production, or coordinating with existing clients during the auth enforcement rollout.

10. **No tasks for documentation updates:** The auth model changes significantly but there are no tasks for updating API docs, agent guides, or deployment guides.

11. **Rate limiting / brute force protection:** The token-entry login screen has no mention of rate limiting failed attempts. The OAuth flows don't mention CSRF protection (though OAuth state parameter is standard).

12. **Session expiry/timeout:** Tasks mention session cookies but don't specify session duration, idle timeout, or absolute expiry. This is a security-relevant gap.

13. **Error handling strategy for auth failures:** Tasks mention returning `codes.Unauthenticated` and `codes.PermissionDenied` but don't discuss error message formatting, whether to reveal why auth failed (information leakage), or how the web dashboard should handle 401/403 responses.

14. **Cross-stage testing:** Each stage has its own test task, but there's no integration test task that validates the full auth stack works end-to-end across all stages.

---

## Confidence Rating

**3 out of 5** — A developer familiar with the farmtable codebase could probably execute Stages 0-3 from these tasks alone, but would likely need additional context for Stages 4-6.

### Why a 3:

**Strengths pushing higher:**
- Tasks are well-decomposed with clear parent-child relationships
- Acceptance criteria are specific and testable
- Dependencies are modeled in the task system itself (blocks/blocked-by)
- Each stage includes a test task with enumerated test cases
- Backward compatibility is explicitly addressed
- The scope vocabulary for RBAC is concretely defined rather than left abstract

**Weaknesses pulling lower:**
- Heavy reliance on "scion patterns" without explaining what those patterns actually are or where the reference code lives
- No deployment/rollout tasks — a developer wouldn't know how to actually ship any stage
- Open design questions remain embedded in task descriptions (KMS vs env var)
- Missing context on web frontend stack, server initialization structure, and deployment infrastructure
- No documentation or communication tasks
- Session security details (expiry, rate limiting) are underspecified
- The collection description references a design doc, suggesting the tasks were derived from it and aren't fully self-contained

**Bottom line:** The task structure is solid for coordination and tracking, but the tasks assume a reader who already understands the farmtable architecture, the scion codebase, and the deployment environment. A new developer would be productive on the simpler tasks (Stage 1 interceptor changes, Stage 3 enforcement) but would struggle with the more complex tasks (session management, OAuth flows, IAP integration) without supplementary context.
