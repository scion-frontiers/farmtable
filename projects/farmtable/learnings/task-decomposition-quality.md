# Learnings: Task Decomposition Quality for Feature Plans

**Date:** 2026-07-23
**Source:** Blind EM exercise on the farmtable Auth Improvements collection
**Purpose:** Reusable reference for agents building DAGs (task decomposition graphs).
Will feed into a future skill for automated task decomposition.

---

## Exercise Design

A blind engineering manager was pointed at a 52-task collection (7 epics,
45 subtasks, 6 stages) decomposed from a design document. The EM had NO access
to the design doc, codebase, or any supplementary material. They assessed the
collection's ability to communicate the feature plan on its own, then received
the design doc and reassessed.

**Result:** Confidence 3/5 (tasks only) → 4/5 (tasks + design doc).

---

## What the Task System Did Well

These are patterns to PRESERVE in future decompositions:

### 1. Dependency Graph as Communication
The `blocks`/`blocked_by` relationships on tasks perfectly communicated the
execution DAG — stage sequencing, parallel workstreams, and the critical path.
The EM reconstructed the exact dependency graph from task relationships alone.
**Keep doing this.** Model both inter-epic and intra-epic dependencies.

### 2. Explicit Acceptance Criteria per Task
Every task had testable ACs. Each stage included a dedicated test task with
enumerated test cases. The EM called this "unusual and valuable."

### 3. Concrete Implementation References
Task descriptions included specific file paths, function names, gRPC error
codes, and behavioral specifications. This makes tasks actionable for a
developer familiar with the codebase.

### 4. Load-Bearing Decisions in Tasks
The RBAC scope vocabulary (`task:read`, `task:write`, etc.) was explicitly
enumerated in the task, not left to the developer. When a decision is
load-bearing (costly to change later), put it in the task.

### 5. Backward Compatibility as First-Class Concern
Each stage's backward-compat provisions appeared in both descriptions and ACs:
open-access flag, scopeless-tokens-as-wildcard, localStorage fallback.

### 6. Labels and Metadata
Consistent use of stage labels, domain labels (`auth`, `server`, `web`, `cli`,
`test`), priority, and phase fields. Good for filtering and triage.

---

## What Was Missing — The 3→4 Gap

These are patterns to ADD to future decompositions:

### 1. Non-Goals on Epics (HIGH impact)
The design doc listed: "not building a full identity provider," "not
multi-tenancy," "real-time revocation not needed." None of this was in the
tasks. **Without non-goals, developers over-engineer.** A developer might build
a JWT revocation system when eventual consistency via token expiry is fine.

**Rule:** Every epic should state 1-3 things this stage explicitly does NOT
address.

### 2. Architectural Rationale on Epics (HIGH impact)
Why encrypted cookies over JWTs? (JWTs are irrevocable — a problem scion
encountered.) Why RBAC over capabilities? (Better fit for farmtable's agent
model.) Why staged over all-at-once? (Validate each stage before the next.)

**Rule:** When a task specifies a technical choice, include one sentence on
WHY that choice was made.

### 3. Current-State Context (HIGH impact for early stages)
Developers need "today X does Y; change it to do Z" framing. The EM flagged:
- The 5-step auth interceptor flow (extract → hash → lookup → inject → record)
- `WhoAmI` is the ONLY enforcing RPC today
- `FARMTABLE_TOKEN` has 4 different meanings depending on context
- The deployment uses `ft dashboard`, not `farmtable-server`

**Rule:** For stages that modify existing behavior, state the current behavior
in the epic description.

### 4. Reference Pattern Descriptions (MEDIUM impact)
Tasks referenced "scion's `sessionToBearerMiddleware` pattern" without
explaining what it does. Even one sentence — "reads session cookie, extracts
validated token, injects as Authorization header" — fills the gap.

**Rule:** When borrowing a named pattern from another codebase, include a 1-2
sentence functional description AND the source file path.

### 5. Open Questions as Visible Blockers (MEDIUM impact)
The design doc had 3 unresolved questions (scope vocabulary refinement, OAuth
provider choice, encryption key management). Only one partially surfaced in
tasks. Open questions should be explicit tasks or noted as decisions-needed in
blocking task descriptions.

**Rule:** Unresolved design decisions become explicit "decision" tasks that
block the implementation tasks they affect.

### 6. Deployment/Rollout Tasks (MEDIUM impact)
No tasks existed for deploying stages, verifying existing clients, or
coordinating the transition from open to mandatory auth. This is operational
work that blocks "done."

**Rule:** Each stage that changes runtime behavior should include a
deployment/verification task.

### 7. Parallelism Guidance in Epics (LOW impact)
The EM could reconstruct parallelism from dependency edges, but it's easier
when the epic description says "subtasks A and B can run in parallel."

**Rule:** State parallelism opportunities explicitly in epic descriptions.

---

## Template for Future Epic Descriptions

```
## [Stage N]: [Title]

**Current behavior:** Today, [component] does [X]. [One sentence on how it works.]

**Desired behavior:** After this stage, [component] does [Y] instead.

**Non-goals for this stage:** We are NOT doing [Z] — that's Stage [M].
[Optional: rationale for deferral.]

**Key design decision:** We chose [A] over [B] because [reason].
[If borrowed from another codebase:] This follows [codebase]'s [PatternName]
pattern (see [file path]).

**Parallel work:** Subtasks [X] and [Y] can run in parallel after [Z] completes.

### Subtasks
[Standard task list with blocks/blocked_by]
```

---

## Scion Source Reference

The design borrows several patterns from the scion codebase. The reference
clone is at: `/scion-volumes/scratchpad/scion-reference/`

| Pattern | File | Line | Description |
|---------|------|------|-------------|
| `UnifiedAuthMiddleware` | `pkg/hub/auth.go` | 82 | Mandatory auth middleware with exemption list; handles token, session, and proxy auth in priority order |
| `isUnauthenticatedEndpoint()` | `pkg/hub/auth.go` | 350 | Exemption list for endpoints that don't require auth (health, login, static assets) |
| `extractAgentToken()` | `pkg/hub/agenttoken.go` | 292 | Checks `X-Scion-Agent-Token` header first, falls back to `Authorization: Bearer` |
| `sessionToBearerMiddleware` | `pkg/hub/web.go` | 581 | Reads session cookie, extracts validated token, injects as `Authorization` header on the request |
| `ProxyAuthenticator` interface | `pkg/hub/proxyauth.go` | 42 | Interface for proxy-supplied auth verification (returns email, subject, display name) |
| `IAPAuthenticator` | `pkg/hub/proxyauth.go` | 70 | Verifies `X-Goog-IAP-JWT-Assertion` ES256 JWTs against Google JWKS endpoint |
| `MakeProxyUserProvisioner` | `pkg/hub/auth.go` | 567 | Find-or-create user from proxy-verified identity (email → user record) |
| `AuthzService` (RBAC) | `pkg/hub/authz.go` | 115+ | Resource:action scope enforcement with `HasScope()` check |
| Scope constants | `pkg/hub/agenttoken.go` | 45-60 | `resource:action` vocabulary (`agent:status:update`, `project:secret:read`, etc.) |
| `AuthorizedDomains` | `pkg/hub/admin_settings_db.go` | 215+ | Domain allowlist for user auto-provisioning |

---

## Quantitative Observations

- **52 tasks total** for a 6-stage auth overhaul (7 epics + 45 subtasks)
- **~6-8 subtasks per stage** — good granularity for developer agents
- **Every stage has a dedicated test task** — non-negotiable for quality
- **Stage 0 completed tasks remained in DAG** — provides complete history
- **Confidence gap: 25% improvement** (3→4 out of 5) from adding design doc context
- **Cheapest fix:** 3-5 sentences of context per epic closes most of the gap

---

## Anti-Patterns Observed

1. **Referencing external patterns by name only** — "borrowing scion's X" means
   nothing to a developer who doesn't know scion.
2. **Embedding open questions in task descriptions** — they become invisible;
   should be separate decision tasks or explicit blockers.
3. **Assuming codebase familiarity** — tasks that say "modify the interceptor"
   without describing the interceptor's current behavior.
4. **Missing operational tasks** — implementation without deployment/verification
   tasks leaves the last mile unplanned.

---

## For the Future DAG-Building Skill

When this feeds into an automated decomposition skill, the key heuristics are:

1. **Start from the design doc's non-goals** — they constrain scope better than goals.
2. **Every epic needs: current → desired + non-goals + rationale + parallelism.**
3. **Load-bearing decisions go in the task, not just the design doc.**
4. **Test tasks are mandatory per stage, with enumerated test cases.**
5. **Deployment/rollout tasks are mandatory per stage that changes runtime behavior.**
6. **Reference patterns need functional descriptions, not just names.**
7. **Open questions become decision-type tasks that block implementation.**
8. **Model dependencies at both epic and subtask level.**
