# Phase 2 Report: Tasks vs. Design Document Comparison

**Date:** 2026-07-23
**Assessor:** farmtable-em-blind-auth-exercise
**Method:** Comparison of Phase 1 (tasks-only) assessment against the design document and current-state findings.

---

## What the Tasks Conveyed Well

The tasks did an excellent job of communicating several critical aspects:

### 1. Overall Scope and Motivation (Mostly Accurate)
My Phase 1 understanding of the problem space was essentially correct. I identified all six core gaps (advisory auth, no web login, unreliable audit trail, no RBAC, token in URLs, fragile external credentials). The design doc confirmed each of these and added only minor nuance.

### 2. Stage Sequencing and Dependencies (Fully Accurate)
The dependency graph I reconstructed from the task relationships exactly matched the design doc's proposed ordering:
```
Stage 0 → Stage 1 → (Stage 2 || Stage 3) → (Stage 5 || Stage 4) → Stage 6
```
The farmtable task system's `blocks`/`blocked_by` relationships conveyed this perfectly — no design doc needed.

### 3. Technical Approach for Stages 0-3 (Accurate and Detailed)
For the foundational stages, the task descriptions were detailed enough to implement from. Specific function names (`extractToken()`, `authCtx()`, `UserIDFromContext()`), file paths (`internal/server/auth.go`, `internal/cli/connect.go`), gRPC error codes (`codes.Unauthenticated`, `codes.PermissionDenied`), and behavioral specifications were all present.

### 4. RBAC Scope Vocabulary (Fully Specified)
The scope vocabulary (`task:read`, `task:write`, `task:claim`, `collection:read`, `collection:write`, `collection:admin`, `token:manage`, `user:read`, `*`) was explicitly enumerated in the tasks, matching the design doc exactly. This is the kind of "load-bearing design decision" that really must be in the tasks.

### 5. Backward Compatibility Strategy (Well Conveyed)
Each stage's backward-compat provisions were captured in both task descriptions and acceptance criteria: open-access flag, scopeless tokens as wildcard, localStorage fallback, existing PATs continuing to work. The design doc's migration sections confirmed what the tasks already stated.

### 6. Testing Requirements (Thorough)
Each stage's test task enumerated specific test cases. This level of detail is unusual and valuable — a developer knows exactly what test cases to write.

---

## What Was Missing or Unclear (Revealed by the Design Doc)

### 1. Non-Goals — Critical Strategic Context
The design doc explicitly lists non-goals that the tasks completely omit:
- **"Not building a full identity provider"** — farmtable delegates identity
- **"Not multi-tenancy / org-level isolation"** — single-deployment tool, not SaaS
- **"Real-time permission revocation not needed"** — eventual consistency acceptable

These non-goals are arguably more important than the goals for a developer making trade-off decisions. Without them, a developer might over-engineer (e.g., building a JWT revocation system when eventual consistency via token expiry is fine).

### 2. Alternatives Considered — Architectural Rationale
The design doc has a full "Alternatives Considered" section that tasks don't capture:
- **JWT vs encrypted cookies for sessions:** The design doc explains WHY encrypted cookies were chosen (JWTs are irrevocable, a problem scion encountered). The task just says "use gorilla/sessions CookieStore with AES-256 encryption" without explaining why.
- **Capability-based vs RBAC:** The doc explains why RBAC fits farmtable's agent model. The task just defines the RBAC vocabulary.
- **All-at-once vs staged:** The rationale for incremental shipping (each stage validated before next) isn't in the tasks.
- **Skipping Stage 1:** The design doc explains that without mandatory enforcement, all later stages are "theater."

This rationale matters when developers encounter edge cases and need to decide which direction to lean.

### 3. Current-State Context — What Already Exists
The current-state doc (`auth-current-state.md`) is rich with context that tasks assume but never state:

- **`FARMTABLE_TOKEN` naming confusion:** The same env var has 4 different meanings depending on context (enable flag on server, actual token value on dashboard, client credential on CLI, browser credential). No task mentions this.
- **Auth interceptor flow:** 5-step process (extract → hash → lookup → inject context → record usage). Tasks reference modifying this but never describe it.
- **`ensureLocalUser()` and `ensureDashboardToken()` flow:** The embedded mode auto-auth path is complex, and the task just says "verify and ensure" it continues working.
- **GitHub pass-through mode:** This entirely separate auth path (`FARMTABLE_GITHUB_REPO`) has no auth interceptors installed. None of the auth improvement tasks account for it.
- **Token generation quality:** SHA-256 hash-only storage, timing-safe comparison, async usage tracking — all existing and working. Good to know when designing additional auth layers.
- **`WhoAmI` is the ONLY RPC that currently checks auth.** This is a crucial baseline fact not stated in any task.

### 4. Scion Pattern References — Where's the Code?
My Phase 1 report flagged this as the #1 question. The design doc references the same patterns but adds slightly more context:
- `extractAgentToken()` → `pkg/hub/agenttoken.go:292` (specific file+line in scion codebase)
- `sessionToBearerMiddleware` → described functionally (cookie → bearer bridge)
- `IAPAuthenticator` → described functionally (JWKS-based ES256 verification)
- `ProxyUserProvisioner` → find-or-create user from proxy identity

The design doc gives functional descriptions of the patterns but still assumes the developer has access to and familiarity with the scion codebase. For a developer who doesn't know scion, neither the tasks nor the design doc provides enough to implement these patterns cold.

### 5. Open Questions — Unresolved Design Decisions
The design doc has 3 explicit open questions:
1. Should the scope vocabulary be refined based on actual agent usage patterns?
2. Google-only OAuth, or also GitHub login?
3. LinkedAccount encryption: GCP KMS vs env var?

The tasks partially surface #3 (mentioned in the encrypted storage task description) but not #1 or #2. A developer might make the wrong choice on these without knowing they're open questions.

### 6. Deployment Model Context
The current-state doc reveals that the Cloud Run deployment uses `ft dashboard` (not `farmtable-server`), that the Dockerfile runs `CMD ["/ft", "dashboard", "--port", "8080"]`, and that the actual deployment is "effectively open" despite having `FARMTABLE_TOKEN` set. None of this deployment context appears in the tasks.

---

## Information Gaps: What a Developer Needs from the Design Doc

| Gap | Impact | Where It Lives |
|-----|--------|----------------|
| Non-goals (what NOT to build) | HIGH — prevents over-engineering | Design doc "Non-Goals" section |
| Why encrypted cookies over JWTs | MEDIUM — affects session implementation | Design doc "Alternatives Considered" |
| Current auth interceptor flow (5-step process) | HIGH — Stage 1 modifies this directly | Current-state doc §1 |
| FARMTABLE_TOKEN naming confusion (4 meanings) | MEDIUM — affects understanding of what changes | Current-state doc §7.5 |
| GitHub pass-through mode has no auth | HIGH — potential security gap in auth rollout | Current-state doc §3 |
| WhoAmI is the only enforcing RPC today | MEDIUM — baseline understanding | Current-state doc §1 |
| Deployment uses `ft dashboard` not `farmtable-server` | HIGH — affects where session endpoints live | Current-state doc §2 |
| Scion pattern implementations (actual code) | MEDIUM — developers need reference code | Scion codebase (not in design doc either) |
| OAuth client registration / infra setup | MEDIUM — Stage 5 can't ship without it | Not documented anywhere |
| Frontend framework (web dashboard) | LOW — developer discovers on reading code | Not in design doc either |

---

## Task Quality Assessment

### Structural Quality: Strong (4/5)

- **Parent-child relationships:** All 45 subtasks correctly assigned to their stage epic via `parent_task_id`. The hierarchy is clean and navigable.
- **Dependency modeling:** `blocks`/`blocked_by` relationships are used extensively and correctly. Both inter-stage (epic → epic) and intra-stage (task → task) dependencies are modeled.
- **Labels:** Consistent use of stage labels (`stage-1`, `stage-2`), domain labels (`auth`, `server`, `web`, `cli`, `test`), and functional labels (`rbac`, `oauth`, `identity`). Good for filtering.
- **Priority:** Used meaningfully — HIGH on core implementation tasks, NORMAL on ancillary tasks, LOW on the localStorage fallback.
- **Phase/stage fields:** Epics use these correctly. The CLOSED phase on Stage 0 is a nice touch.

### Acceptance Criteria Quality: Good (3.5/5)

- **Positive:** Each task has AC. Most are testable and specific. Stage test tasks enumerate individual test cases.
- **Negative:** Some ACs are broad ("all existing client paths work identically before and after") without specifying how to verify this. The session security attributes (cookie flags) are specified in the AC, which is good, but session duration/expiry is not.

### Description Quality: Good for Implementation, Weak on Context (3/5)

- **Positive:** Descriptions name specific files, functions, error codes, and behavioral expectations. A developer familiar with the codebase can start coding.
- **Negative:** Descriptions assume deep codebase familiarity. They reference scion patterns by name without explaining them. They don't include "why" — the rationale for design choices. They don't mention current state ("today, the interceptor does X; change it to do Y").

### Dependency Correctness: Very Good (4.5/5)

- **The dependency graph is logically correct.** I found no missing dependencies or false dependencies.
- **The task breakdown log** (which I discovered after Phase 1) confirms the parallelism I identified independently from the task relationships. That's a good sign — the task system communicates the execution graph accurately.
- **One minor issue:** Stage 2 and Stage 3 can run in parallel (correctly modeled at epic level), but there's no explicit note about this in any task description. A manager would need to discover this from the dependency graph analysis.

### Completeness: Adequate for Implementation, Incomplete for Operations (3/5)

- **Missing:** No deployment tasks, no documentation tasks, no rollout coordination tasks, no infrastructure setup tasks (OAuth client registration, encryption key provisioning), no cross-stage integration test.
- **Present:** All code-level implementation work is covered. Test tasks are thorough.

---

## Recommendations

### 1. Add a "Context" Section to Epic Descriptions
Each epic should include:
- **Current behavior:** "Today, the interceptor does X"
- **Desired behavior:** "After this stage, it does Y"
- **Non-goals for this stage:** "We are NOT doing Z — that's Stage N"
- **Key architectural decision:** "We chose encrypted cookies over JWTs because..."

This bridges the gap between the design doc's rationale and the task's implementation instructions. Estimated addition: 3-4 sentences per epic.

### 2. Add Scion Pattern Reference Links or Inline Descriptions
Either:
- Link to specific scion source files (if the developer has access)
- OR inline a 3-5 line pseudo-code description of each borrowed pattern

The current "borrowing scion's `sessionToBearerMiddleware` pattern" is insufficient for a developer who doesn't know scion. Even a sentence like "reads session cookie, extracts validated token, injects it as Authorization header on the request" (which IS in the Stage 2 task description, but not all patterns are described this well) helps enormously.

### 3. Add Deployment/Rollout Tasks
Each stage that changes auth behavior needs at minimum:
- A "deploy to staging" task
- A "verify existing clients still work in production" task
- For Stage 1 specifically: a "coordinate with active agents before flipping to mandatory auth" task

### 4. Surface Open Questions as Explicit Tasks or Blockers
The 3 open questions from the design doc should be:
- Tasks of type "decision" or "spike" that block the implementation tasks they affect
- OR notes in the blocked task descriptions saying "DECISION NEEDED: X. Default assumption: Y."

### 5. Add Current-State Context to Stage 1 Tasks
Stage 1 is the most sensitive stage (changes fundamental auth behavior). Its tasks should include:
- The current 5-step interceptor flow
- The fact that `WhoAmI` is the only currently-enforcing RPC
- The `FARMTABLE_TOKEN` naming confusion
- The GitHub pass-through mode caveat

### 6. Add a Cross-Stage Integration Test Task
After the final stage, or as a rolling task, there should be an end-to-end test that validates the full auth stack: mandatory enforcement → session login → identity in mutations → RBAC scope enforcement → OAuth login (when applicable).

### 7. Include the Task Breakdown Log's Parallelism Guidance in Epic Descriptions
The task breakdown log contains excellent guidance about which subtasks can run in parallel within a stage. This information should be in the epic description, not in a separate log that a manager might not find.

---

## Revised Confidence Rating

**Phase 1 rating (tasks only): 3/5**
**Phase 2 rating (tasks + design doc + current state): 4/5**

The jump from 3→4 comes from:
- Understanding non-goals (prevents over-engineering)
- Understanding alternatives considered (guides edge-case decisions)
- Understanding current state (makes "change X to Y" instructions actionable)
- Understanding the deployment model (where to add session endpoints)

Still not 5/5 because:
- Scion pattern implementations remain unavailable (design doc describes functionally but doesn't provide code)
- No deployment/rollout tasks
- Open questions still unresolved
- OAuth infrastructure setup not documented

---

## Summary

The farmtable task system does a **solid job as a coordination and tracking tool** — the dependency graph, stage structure, acceptance criteria, and test enumeration are all well-executed. Where it falls short is as a **standalone communication vehicle**: it assumes the reader already has the architectural rationale (from the design doc), the current-state context (from the findings doc), and familiarity with the scion codebase.

The most impactful improvement would be adding 3-5 sentences of context to each epic description: current behavior, desired behavior, key design rationale, and non-goals. This would bring the tasks from "good for someone who attended the design review" to "good for any developer with codebase access."
