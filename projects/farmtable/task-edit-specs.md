# Task Edit Specifications — Auth Improvements Collection

**Date:** 2026-07-23
**Collection:** Auth Improvements (`9a16e171-59e6-4179-a79d-708b8e2adade`)
**Purpose:** Apply the blind-EM's 7 recommendations to improve task quality.
**Reference:** Phase 2 report at `exercise-blind-em-phase2.md`, learnings at
`learnings/task-decomposition-quality.md`

---

## Category 1: Add Context Sections to Epic Descriptions

For each epic (Stages 1–6), prepend the following context block to the existing
description. Do NOT replace the existing description — prepend.

### Stage 1 Epic (`88970ef7`) — Mandatory Auth Enforcement

Prepend to description:

```
## Context

**Current behavior:** The auth interceptor in `internal/server/auth.go` is advisory — when no Authorization header or X-Farmtable-Token is sent, requests pass through unauthenticated. The interceptor follows a 5-step flow: extract token from metadata → SHA-256 hash → lookup via TokenLookup interface → inject userID into context → record usage async. Currently, `WhoAmI` is the ONLY RPC that rejects unauthenticated requests. All other RPCs (including mutating ones like CreateTask, UpdateTask) accept requests with no user identity, recording uuid.Nil as the actor.

**Desired behavior:** When TokenLookup is configured (FARMTABLE_TOKEN set), the interceptor rejects tokenless requests with codes.Unauthenticated. Health/version endpoints are exempt. An explicit opt-out (--open-access) exists for local dev.

**Non-goals for this stage:** We are NOT adding authorization/RBAC (that's Stage 4), NOT adding a web login flow (Stage 2), and NOT requiring identity on specific RPCs beyond the blanket auth check (Stage 3). We are also NOT building real-time token revocation — eventual consistency via token expiry is acceptable.

**Key design decision:** We chose reject-by-default with an exemption list (following scion's UnifiedAuthMiddleware + isUnauthenticatedEndpoint() pattern) over a per-RPC opt-in approach, because the exemption list is shorter and safer — new RPCs are protected by default.

**Note on FARMTABLE_TOKEN:** This env var has 4 different meanings depending on context: (1) on farmtable-server, it's an "enable auth" flag, (2) on ft dashboard, it's the actual token value registered in the DB, (3) on the ft CLI, it's the client credential, (4) on window.FARMTABLE_TOKEN, it's the browser client token. Be aware of this overloading when modifying auth behavior.

**Note on deployment:** The Cloud Run deployment uses `ft dashboard --port 8080` (not farmtable-server). See Dockerfile. The ensureLocalUser() and ensureDashboardToken() flows in internal/cli/dashboard.go create the user/token automatically.

**Note on GitHub pass-through mode:** When FARMTABLE_GITHUB_REPO is set, the CLI creates a pass-through server that proxies to GitHub Issues. Auth interceptors are NOT installed in this mode. This stage's changes should not break pass-through mode.

**Parallel work:** Subtasks "Add --open-access flag" and "Ensure embedded CLI mode auto-authenticates" can run in parallel with the core interceptor work.

**Scion reference:** `UnifiedAuthMiddleware` at pkg/hub/auth.go:82, `isUnauthenticatedEndpoint()` at pkg/hub/auth.go:350. Source at /scion-volumes/scratchpad/scion-reference/
```

### Stage 2 Epic (`4a2808ff`) — Web Dashboard Auth

Prepend to description:

```
## Context

**Current behavior:** The web dashboard operates unauthenticated. The browser client in web/src/gen/grpc-client.ts resolves tokens via: URL ?token= → window.FARMTABLE_TOKEN → localStorage['farmtable.token'] → '' (empty). When empty, no metadata is sent, and the interceptor passes through. There is no login page, no session management, and no way for browser users to acquire a token. The dashboard is a Lit/TypeScript SPA served as static assets by the Go server via internal/serverapp/unified.go.

**Desired behavior:** Users see a token-entry modal on first load. Entering a valid ft_ token creates a server-side session (httpOnly cookie). The session-to-bearer middleware reads the cookie and injects the token as Authorization: Bearer on gRPC-web requests. Users see their identity and can log out.

**Non-goals for this stage:** We are NOT implementing OAuth/SSO login (Stage 5). The login mechanism is token-entry only. We are NOT adding per-user data isolation or RBAC to the dashboard (Stages 3-4).

**Key design decision:** We chose encrypted cookies (gorilla/sessions CookieStore with AES-256) over JWTs for session tokens. JWTs are irrevocable once issued — a problem scion encountered with long-lived JWTs. Encrypted cookies with server-side validation are simpler and more secure for a single-deployment app.

**Where session endpoints live:** The session HTTP endpoints (POST/GET/DELETE /api/auth/session) are added to the UnifiedHandler in internal/serverapp/unified.go, alongside the existing grpc-web and static asset handlers. The session-to-bearer middleware wraps the grpc-web handler.

**Parallel work:** "Build token-entry login screen UI" and "Add session-to-bearer middleware" can start in parallel once session endpoints exist. "Keep localStorage fallback" is independent of everything else.

**Scion reference:** `sessionToBearerMiddleware` at pkg/hub/web.go:581 — reads session cookie, extracts token, injects as Authorization header. Source at /scion-volumes/scratchpad/scion-reference/
```

### Stage 3 Epic (`9b99e139`) — Identity-Aware Operations

Prepend to description:

```
## Context

**Current behavior:** Mutating RPCs (CreateTask, UpdateTask, ClaimTask, AddComment, etc.) accept requests from authenticated AND unauthenticated users equally. When a user is authenticated, UserIDFromContext(ctx) returns their ID and it's recorded in Change records. When unauthenticated, it returns uuid.Nil — so mutations succeed but the audit trail records a nil actor, making it impossible to attribute changes.

**Desired behavior:** All mutating RPCs require a valid, non-nil user ID from context. Read-only RPCs (ListTasks, GetTask, ListCollections) remain accessible to any authenticated user. WatchTasks (streaming) requires auth because it's long-lived.

**Non-goals for this stage:** We are NOT adding fine-grained read restrictions (all authenticated users can read everything). We are NOT adding RBAC or scopes (Stage 4). We are enforcing identity, not authorization.

**Key design decision:** We separate authentication (Stage 1: "are you who you say you are?") from identity enforcement (this stage: "do we know who you are?") from authorization (Stage 4: "are you allowed to do this?"). This lets each layer be validated independently.

**Parallel work:** "Enforce auth on mutating RPCs" and "Enforce auth on WatchTasks" can run in parallel. "Verify read-only RPCs remain accessible" and "Deprecate LegacyTokenAuth" are independent.
```

### Stage 4 Epic (`63de00c3`) — Scoped Tokens & Basic RBAC

Prepend to description:

```
## Context

**Current behavior:** All API tokens are equivalent — a CI bot reading task status has the same permissions as an admin deleting collections. The ApiToken schema (internal/store/schema/apitoken.go) has: id, token_hash, name, user_id, created_at, expires_at, last_used_at. No scopes or permission fields exist.

**Desired behavior:** Tokens carry resource:action scopes (e.g., task:read, collection:admin). RPCs enforce required scopes. Tokens can be scoped to specific collections. Existing scopeless tokens are treated as wildcard (*) for backward compatibility.

**Non-goals for this stage:** We are NOT implementing real-time permission revocation — scope changes take effect when a new token is created. We are NOT adding frontend capability maps yet (future enhancement). We are NOT building org-level or tenant isolation.

**Key design decision:** We chose RBAC with resource:action scopes over capability-based auth. Capability tokens are more flexible but harder to audit. RBAC fits farmtable's "agents with assigned roles" model. The scope vocabulary is a LOAD-BEARING decision — changing it later requires token migration. The proposed vocabulary: task:read, task:write, task:claim, collection:read, collection:write, collection:admin, token:manage, user:read, * (superuser).

**Open question:** Should the scope vocabulary be refined based on actual agent usage patterns before committing? Default assumption: ship with the proposed vocabulary and iterate.

**Parallel work:** "Add scopes field to schema" and "Define scope vocabulary" can run in parallel.

**Scion reference:** Scope enforcement at pkg/hub/authz.go:422 (HasScope check), scope constants at pkg/hub/agenttoken.go:45-60. Source at /scion-volumes/scratchpad/scion-reference/
```

### Stage 5 Epic (`56845fff`) — OAuth / SSO & IAP Proxy Auth

Prepend to description:

```
## Context

**Current behavior:** Browser users authenticate to IAP via Google's OAuth cookie flow (handled by IAP, transparent to farmtable). The farmtable app itself has no OAuth or SSO — browser identity comes only from ft_ tokens entered manually (once Stage 2 is done). For IAP-protected deployments, the X-Goog-IAP-JWT-Assertion header carries a signed JWT with the user's email and subject, but farmtable ignores it.

**Desired behavior:** Three auth modes: (1) token (default, backward compat), (2) oauth (Google OAuth login for browser users), (3) proxy (trust IAP's JWT assertion, auto-provision users). Auth mode is configurable via FARMTABLE_AUTH_MODE env var.

**Non-goals for this stage:** We are NOT building a full identity provider. We are NOT adding multi-factor auth. We delegate identity to external providers.

**Key design decision:** We implement both OAuth and IAP proxy auth because they serve different deployment models. OAuth is for instances NOT behind IAP (or where IAP is optional). Proxy auth eliminates ft_ tokens entirely when behind IAP — the cleanest experience for GCP deployments.

**Open question:** Google-only OAuth, or also GitHub login? GitHub would be natural for developer-facing deployments. Default assumption: Google-only initially, make the OAuth provider pluggable.

**Parallel work:** "Implement Google OAuth login flow" and "Implement IAPAuthenticator" can run in parallel.

**Scion reference:** IAPAuthenticator at pkg/hub/proxyauth.go:70 (ES256 JWT verification against Google JWKS), ProxyAuthenticator interface at pkg/hub/proxyauth.go:42, MakeProxyUserProvisioner at pkg/hub/auth.go:567, AuthorizedDomains at pkg/hub/admin_settings_db.go:215. Source at /scion-volumes/scratchpad/scion-reference/
```

### Stage 6 Epic (`84cb1551`) — External Credential Improvements

Prepend to description:

```
## Context

**Current behavior:** LinkedAccounts (internal/store/schema/linkedaccount.go) are per-collection credentials for external platforms (GitHub, Jira, Linear, Asana). They support multiple auth methods at the schema level (PAT, OAuth, GitHub App, etc.) but only PAT/API key entry is implemented. The auth_token field is stored as plaintext in the database (marked Sensitive() in Ent, which excludes it from default queries but does NOT encrypt it). There's no token refresh, no expiry monitoring, and no way to detect when a credential becomes invalid.

**Desired behavior:** OAuth flows for GitHub App, Jira, and Linear. Background token refresh for expiring grants. AES-256-GCM encrypted storage for auth_token. Background credential validation.

**Non-goals for this stage:** We are NOT building a credential vault or secrets manager. We are improving the existing LinkedAccount system, not replacing it.

**Open question:** Encryption key management — GCP KMS or env var with generated key? Default assumption: start with env var (FARMTABLE_ENCRYPTION_KEY), make it pluggable for future KMS integration.

**Parallel work:** "GitHub App OAuth," "Jira/Linear OAuth," and "Encrypted storage" can all start in parallel.
```

---

## Category 2: Scion Pattern Inline Descriptions

For any subtask that references a scion pattern by name, ensure the description
includes both a 1-2 sentence functional description AND the source file path.

The following subtasks need updates (add to existing description, don't replace):

### Stage 2, Subtask: "Add session-to-bearer middleware"
Add: `Scion reference: sessionToBearerMiddleware at /scion-volumes/scratchpad/scion-reference/pkg/hub/web.go:581. This middleware reads the session cookie set by the login endpoint, extracts the validated API token, and injects it as an Authorization: Bearer header on the request before passing to the gRPC-web handler. This lets the existing gRPC auth interceptor work unchanged — it sees a Bearer token as if the client sent it directly.`

### Stage 4, Subtask: "Implement RequireScope() enforcement helper"
Add: `Scion reference: AuthzService scope enforcement at /scion-volumes/scratchpad/scion-reference/pkg/hub/authz.go:422. Scion checks resource:action scope strings against the token's scope list using HasScope(). If the token lacks the required scope, the request is denied. The wildcard scope (*) bypasses all checks.`

### Stage 5, Subtask: "Implement ProxyAuthenticator with IAPAuthenticator"
Add: `Scion reference: ProxyAuthenticator interface at /scion-volumes/scratchpad/scion-reference/pkg/hub/proxyauth.go:42 and IAPAuthenticator at line 70. IAPAuthenticator reads the X-Goog-IAP-JWT-Assertion header, verifies the ES256 signature against Google's JWKS endpoint (https://www.gstatic.com/iap/verify/public_key-jwk), validates issuer/audience/expiry claims, and returns the user's email and subject ID.`

### Stage 5, Subtask: "Implement user provisioning with domain allowlist"
Add: `Scion reference: MakeProxyUserProvisioner at /scion-volumes/scratchpad/scion-reference/pkg/hub/auth.go:567. This function creates a provisioner that find-or-creates a user record from a proxy-verified identity (email → User). AuthorizedDomains config at pkg/hub/admin_settings_db.go:215 controls which email domains are allowed.`

---

## Category 3: New Tasks to Create

### 3a. Deployment/Verification Tasks (one per stage that changes runtime behavior)

**Stage 1: Deploy and verify mandatory auth enforcement**
- Parent: Stage 1 epic
- Blocked by: Stage 1 test task (migration testing)
- Description: Deploy the mandatory auth changes to Cloud Run. Verify: (1) existing ft CLI with FARMTABLE_TOKEN still works, (2) decomposer with x-farmtable-token still works, (3) web dashboard through IAP still loads (unauthenticated browser requests should still work since web dashboard doesn't send ft_ token yet), (4) tokenless gRPC requests from outside IAP are rejected. Test the --open-access flag in a local environment.
- Priority: HIGH

**Stage 2: Deploy and verify web dashboard auth**
- Parent: Stage 2 epic
- Blocked by: Stage 2 test task
- Description: Deploy the web dashboard auth changes. Verify: (1) login modal appears on first visit, (2) entering a valid ft_ token creates session, (3) session persists across page reloads, (4) logout clears session, (5) ?token= URL parameter no longer works, (6) localStorage fallback works in dev mode. Coordinate with any active agents using the dashboard.
- Priority: HIGH

**Stage 3: Deploy and verify identity-aware operations**
- Parent: Stage 3 epic
- Blocked by: Stage 3 test task
- Description: Deploy identity-aware mutation enforcement. Verify: (1) authenticated mutations record correct actor in Change records, (2) unauthenticated mutation attempts are rejected, (3) read-only RPCs still work, (4) WatchTasks requires auth, (5) no uuid.Nil actors in new Change records.
- Priority: HIGH

**Stage 4: Deploy and verify RBAC enforcement**
- Parent: Stage 4 epic
- Blocked by: Stage 4 test task
- Description: Deploy RBAC changes. Verify: (1) existing tokens (no scopes field) continue to work as wildcard, (2) newly created scoped tokens are enforced correctly, (3) per-collection scoping works, (4) scope violations return PermissionDenied with clear error message.
- Priority: HIGH

**Stage 5: Deploy and verify OAuth/IAP proxy auth**
- Parent: Stage 5 epic
- Blocked by: Stage 5 test task
- Description: Deploy OAuth and IAP proxy auth. Verify per auth mode: token mode unchanged, OAuth mode shows Google login button and completes flow, proxy mode auto-provisions user from IAP JWT. Verify domain allowlist blocks unauthorized domains. Requires OAuth client credentials configured in Cloud Run secrets.
- Priority: HIGH

**Stage 6: Deploy and verify external credential improvements**
- Parent: Stage 6 epic
- Blocked by: Stage 6 test task
- Description: Deploy external credential improvements. Verify: (1) GitHub App OAuth flow completes, (2) Jira/Linear OAuth flows complete, (3) background token refresh runs, (4) existing PAT-based LinkedAccounts are migrated to encrypted storage, (5) credential status monitoring detects invalid credentials.
- Priority: HIGH

### 3b. Decision Tasks for Open Questions

**Decision: Scope vocabulary refinement**
- Parent: Stage 4 epic
- Blocks: "Define scope vocabulary" subtask
- Description: DECISION NEEDED: Should the proposed resource:action scope vocabulary (task:read, task:write, task:claim, collection:read, collection:write, collection:admin, token:manage, user:read, *) be refined based on actual agent usage patterns before committing? This is a load-bearing decision — changing it later requires token migration. Default assumption if no decision is made: ship with the proposed vocabulary and iterate.
- Priority: HIGH
- Label: decision

**Decision: OAuth provider choice**
- Parent: Stage 5 epic
- Blocks: "Implement Google OAuth login flow" subtask
- Description: DECISION NEEDED: Google-only OAuth, or also GitHub login for developer-facing deployments? Default assumption: Google-only initially, make the OAuth provider interface pluggable so GitHub can be added later.
- Priority: NORMAL
- Label: decision

**Decision: LinkedAccount encryption key management**
- Parent: Stage 6 epic
- Blocks: "Add encrypted-at-rest storage" subtask
- Description: DECISION NEEDED: Use GCP KMS for LinkedAccount encryption, or a simpler env var approach (FARMTABLE_ENCRYPTION_KEY)? KMS is more secure but adds GCP dependency and latency. Default assumption: start with env var, make the key provider interface pluggable for future KMS integration.
- Priority: NORMAL
- Label: decision

### 3c. Cross-Stage Integration Test Task

**End-to-end auth integration test**
- No parent (standalone task, or create an "Integration Testing" epic)
- Blocked by: ALL stage epics (Stages 1-6)
- Description: End-to-end test that validates the full auth stack works together: (1) Mandatory auth rejects unauthenticated requests, (2) Web dashboard login creates session → session-to-bearer bridges to gRPC, (3) Authenticated mutations record correct actor, (4) Scoped tokens are enforced (token with task:read cannot write), (5) Per-collection scoping restricts access, (6) OAuth/IAP login provisions user and grants session, (7) LinkedAccount OAuth flows complete and credentials are encrypted. This is the final validation that all stages compose correctly.
- Priority: HIGH
- Label: test, integration

---

## Category 4: Scion Reference Note on Collection Description

Update the collection description (Auth Improvements) to include:

```
Scion reference source: /scion-volumes/scratchpad/scion-reference/
Design document: /scion-volumes/scratchpad/projects/farmtable/design-auth-improvements.md
Current state findings: /scion-volumes/scratchpad/projects/farmtable/auth-current-state.md
Task decomposition learnings: /scion-volumes/scratchpad/projects/farmtable/learnings/task-decomposition-quality.md
```

---

## Summary of Changes

| Category | Count | Effort |
|----------|-------|--------|
| Epic description prepends (context sections) | 6 | Medium — each is ~150-250 words |
| Subtask description appends (scion references) | 4 | Small — each is 2-3 sentences |
| New deployment/verification tasks | 6 | Small — straightforward descriptions |
| New decision tasks | 3 | Small — one paragraph each |
| New integration test task | 1 | Small — one description |
| Collection description update | 1 | Trivial |
| **Total edits** | **21** | |
