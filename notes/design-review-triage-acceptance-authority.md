# Design Review: Triage→Accepted Authority & the Auth Architecture

**Date:** 2026-07-26
**Author:** Architect agent (auth workstream)
**Input:** `notes/auth-side-note-triage-acceptance-authority.md` from c-phase/task-state model review
**Requested by:** ptone@google.com

---

## The Core Insight

c-phase correctly identified that "who can move a task from triage to accepted"
is an authorization question, not a data-model question. The task schema should
represent the state (`triage`, `accepted`), but the auth layer should govern who
is allowed to make that transition.

This is a clean separation of concerns. I agree with it fully.

---

## How This Maps to the Current Auth Design

### Today: No Transition Authorization

Currently, `UpdateTask` in `internal/store/entstore.go` (line 521) accepts any
stage value without validation:

```go
if p.Stage != nil {
    update.SetStage(*p.Stage)
}
```

There is no check on:
- Whether the caller is authorized for this transition
- Whether the transition itself is valid (e.g., can you go from `completed`
  back to `triage`?)
- Whether the caller's relationship to the task matters (e.g., only the
  assignee can move from `working` to `in_review`)

`ClaimTask` (line 752) is the only operation that enforces a state machine
contract: it checks `Phase != Closed` and `AssigneeID == nil` before setting
stage to `working`. But this is data-integrity logic, not authorization.

### Where It Fits in the Staged Plan

The triage→accepted authority concern spans two of our planned stages:

**Stage 3 (Identity-Aware Operations)** establishes that all mutations have a
known actor. This is a prerequisite — you can't authorize a transition if you
don't know who's making it.

**Stage 4 (Scoped Tokens & RBAC)** introduces `resource:action` scopes. This
is where transition authorization would live.

---

## Design Analysis: Three Approaches

### Approach A: Extend the Scope Vocabulary (Recommended)

Add transition-specific actions to the existing `resource:action` vocabulary:

```
task:accept       — move task from triage to accepted/backlog/ready
task:claim        — already exists (assign + move to working)
task:close        — move task to terminal stage (completed, wont_fix, etc.)
task:reopen       — move task from terminal back to open
```

The existing `task:write` scope covers general field edits (title, description,
priority, labels). Transition-specific scopes cover lifecycle state changes that
carry different authority levels.

**Enforcement point:** The `RequireScope()` helper we already planned for Stage
4. When `UpdateTask` receives a stage change, it checks the appropriate
transition scope instead of the generic `task:write`.

**Pseudocode:**
```go
func (s *Server) UpdateTask(ctx context.Context, req *pb.UpdateTaskRequest) {
    // Stage 3: identity required
    userID := requireAuth(ctx)

    if req.Stage != nil {
        // Stage 4: transition-specific authorization
        scope := transitionScope(oldStage, *req.Stage)
        requireScope(ctx, scope)  // e.g., "task:accept" for triage→accepted
    }

    // Generic field updates only need task:write
    if hasFieldChanges(req) {
        requireScope(ctx, "task:write")
    }
}
```

**Pros:**
- Fits cleanly into the existing RBAC model
- No new authorization infrastructure needed
- The scope vocabulary is extensible — add `task:deploy`, `task:review` later
  if needed
- Actor-agnostic: works for humans, agents, orchestrators, automation

**Cons:**
- Scope vocabulary grows — but it's an enumerated set, not combinatorial
- Need to define which transitions map to which scopes (a small state machine)

### Approach B: Role-Based Transition Rules (Separate from Scopes)

Define a transition rules table that maps `(from_stage, to_stage) → required_role`:

```
triage → accepted:     requires role "reviewer" or "admin"
accepted → working:    requires role "assignee" or "admin"
working → in_review:   requires role "assignee"
in_review → completed: requires role "reviewer" or "admin"
```

This is a more structured approach but introduces a new concept (roles with
transition rules) alongside the existing scope system.

**Why I don't recommend this:** It creates a parallel authorization mechanism.
Scopes already provide `resource:action` granularity. Adding role-based
transition rules means two systems to maintain and reason about. The scope
approach (A) is simpler and composes with everything else we've designed.

### Approach C: Workflow Engine (Over-Engineering)

Build a proper workflow/state machine engine with configurable transitions,
guard conditions, and hooks. This is the "enterprise BPM" approach.

**Why I don't recommend this:** Farmtable is a task runtime for agents, not a
workflow orchestration platform. The state machine is simple enough (< 15
states, predictable transitions) that encoding transition rules in the auth
layer is sufficient. A workflow engine is premature abstraction.

---

## Specific Design Recommendation for Stage 4

When implementing Stage 4 (Scoped Tokens & RBAC), the scope vocabulary should
be extended from the current proposal:

**Current:**
```
task:read, task:write, task:claim,
collection:read, collection:write, collection:admin,
token:manage, user:read, *
```

**Proposed addition:**
```
task:accept     — authorize triage→accepted (and backlog/ready) transitions
task:close      — authorize moves to terminal stages
```

`task:claim` already exists and handles the accepted→working transition.
`task:write` continues to cover non-lifecycle field edits.

**Transition scope mapping:**

| From | To | Required Scope |
|------|----|---------------|
| triage | accepted / backlog / ready | `task:accept` |
| any non-terminal | working (via ClaimTask) | `task:claim` |
| working | in_review / in_qa / deploying | `task:write` (assignee context) |
| any | completed / wont_fix / duplicate / cancelled | `task:close` |
| any terminal | triage / backlog | `task:accept` (reopen = re-accept) |
| any | blocked / waiting_for_input / deferred | `task:write` |

**Default scope assignments (updated):**
- `admin` → `*` (unchanged)
- `agent` → `task:read, task:write, task:claim, collection:read` (unchanged —
  agents can claim and work tasks, but cannot accept from triage or close)
- `reviewer/orchestrator` → `task:read, task:write, task:claim, task:accept,
  task:close, collection:read` (new role level — can manage the full lifecycle)
- `viewer` → `task:read, collection:read` (unchanged)

This means an agent with default scopes can:
- ✅ Read tasks
- ✅ Claim and work tasks
- ✅ Move tasks between working/in_review/blocked states
- ❌ Cannot accept tasks from triage (needs `task:accept`)
- ❌ Cannot close tasks as completed (needs `task:close`)

An orchestrator/supervisor with `task:accept` + `task:close` can manage the
full lifecycle — whether it's a human, a coordinator agent, or an automated
triage pipeline.

---

## The Key Principle: Actor-Agnostic Authority

c-phase's note emphasizes: "The model should not assume the intake reviewer is
always human." This is exactly right, and it's why scope-based authorization is
the correct abstraction.

A scope says "this token is authorized to perform this action." It says nothing
about whether the token belongs to a human, an agent, or an automated system.
The same `task:accept` scope works for:

- A human reviewer clicking "accept" in the dashboard
- A coordinator agent triaging incoming work
- An automated pipeline accepting tasks that match certain criteria
- A supervisor agent accepting work from a subordinate agent's recommendations

The authority lives in the token's scopes, not in the caller's nature.

---

## Implementation Timing

This does NOT need to change the current implementation plan. The transition
scope mapping is an input to Stage 4's scope vocabulary design, which already
has an open question about refinement. Specifically:

1. **Stages 1-3:** No changes needed. These stages establish identity and
   mutation enforcement. Stage transitions continue to be unrestricted (as they
   are today).

2. **Stage 4 (scope vocabulary decision task):** Incorporate `task:accept` and
   `task:close` into the vocabulary. Add the transition scope mapping as a
   sub-task of "Add scope enforcement to all RPC handlers."

3. **No new stages needed.** This fits entirely within Stage 4's existing scope.

---

## Decisions (Resolved 2026-07-26 with ptone)

1. **`task:claim` requires `task:accept` as a precondition (Option A).**
   A task must be accepted before it can be claimed. If an entity has both
   `task:accept` and `task:claim` permissions, they perform two distinct
   operations — accept the task (triage→accepted), then claim it
   (accepted→working). The operations are never conflated. This preserves
   the intake review gate as a deliberate step.

2. **Single `task:close` scope for all terminal states.** Start simple.
   Split later if needed — adding scopes is backward-compatible.

3. **Per-collection policy: out of scope for now, tracked as high-priority
   future auth feature.** The concept: authorization policy can be attached
   at the global scope OR bound to one or more collections in a many:many
   bind pattern. This is bigger than just transition roles — it's a
   general-purpose policy binding model. See tracking note:
   `notes/future-per-collection-auth-policy.md`
