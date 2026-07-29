# Beads Field Analysis: NTO Extension Candidates

Analysis of Beads Issue fields not currently mapped to Farm Table's Normalized Task Object (NTO), with assessment of whether each warrants a first-class NTO analog.

**Context:** The Beads platform adapter (commit 2a32d8a) maps all core work-tracking fields to the NTO. The fields below are Beads-specific and currently unmapped. This analysis evaluates each for general-purpose work-tracking value.

---

## High Priority

### Gate Fields: AwaitType, AwaitID, Timeout, Waiters

**What they do in Beads:**
A "gate" is an issue that blocks downstream work until an external condition resolves. The gate fields encode:

- **AwaitType** — The kind of external condition: `gh:run` (CI pipeline), `gh:pr` (pull request merge), `timer` (wall-clock deadline), `human` (manual approval), `mail` (email confirmation).
- **AwaitID** — The external identifier for the condition (e.g., a GitHub Actions run ID, a PR number, a timer name).
- **Timeout** — Maximum wait time before escalation. If the gate hasn't cleared by this duration, the system escalates (notifies waiters, marks as blocked, or auto-fails).
- **Waiters** — List of addresses (email, agent IDs) to notify when the gate clears.

Beads also has a `waits-for` dependency type with metadata distinguishing `all-children` (fanout: wait for every child to complete) from `any-children` (proceed on first completion). Combined with gates, this gives Beads a complete async coordination vocabulary.

**Why this matters for Farm Table:**

The biggest pain point from the first dogfooding day was task state drift — agents reported tasks as "completed" but the work was never delivered (push failed, CI didn't run, permissions blocked). The retro's key insight:

> The biggest risks aren't in the task data model — they're in the workflow between "agent says done" and "work is actually delivered."

Gates directly address this. Instead of a task being "done" when an agent says so, a gate task would block downstream work until an *external signal* confirms delivery:

1. **Push verification gate**: Agent commits code → gate blocks on `push:origin/main` → clears when commit SHA appears on remote → downstream tasks unblock.
2. **CI gate**: Code pushed → gate blocks on `gh:run:<run-id>` → clears when Actions run passes → deploy tasks unblock.
3. **Approval gate**: Design doc written → gate blocks on `human:lead-review` → clears when a human approves → implementation tasks unblock.
4. **Timer gate**: Hotfix deployed → gate blocks on `timer:24h-soak` → clears after 24 hours with no alerts → rollback plan is deactivated.

**How gates compose with existing FT primitives:**

Farm Table already has blocking dependencies (`blocks`/`blocked_by` relationships) and the three-tier status model (phase/stage/native_label). Gates would extend this:

- A gate is a task with `type: "gate"` and gate-specific fields.
- The gate's phase is `OPEN` while waiting, transitions to `CLOSED` when the condition resolves.
- Downstream tasks linked via `blocked_by` automatically unblock when the gate closes.
- The gate's native_label preserves the external condition state (e.g., "ci:passing", "ci:failing", "awaiting-approval").

**Possible NTO representation:**

Option A — Typed extension (like CodeContext):
```protobuf
message GateContext {
  string await_type = 1;    // "ci", "push", "human", "timer", "webhook"
  string await_id = 2;      // External identifier
  google.protobuf.Duration timeout = 3;
  repeated string waiters = 4;
  string resolution = 5;    // "cleared", "timed_out", "cancelled"
  google.protobuf.Timestamp resolved_at = 6;
}

message Task {
  // ... existing fields ...
  optional GateContext gate_context = 28;
}
```

Option B — Store in remote_data (no schema change):
Gate metadata goes into `remote_data` as a convention. Simpler but loses type safety and query ability.

Option C — Separate Gate entity (like Change or Comment):
Gates become a first-class entity linked to tasks, not embedded in them. Most flexible for querying ("show me all pending gates") but adds schema complexity.

**Recommendation:** Option A. Gates are a property of a task, not a separate entity. The typed extension pattern already works well for CodeContext. Query support ("list all tasks with pending gates") comes naturally from filtering on `gate_context != null AND gate_context.resolution == ""`.

**Polling and resolution:**

The open question is *who resolves gates*. Options:

1. **External webhook**: A CI system or deployment tool calls an FT API endpoint to clear the gate. Requires INT-8 (webhook ingestion framework, currently NEEDED).
2. **Polling adapter**: A platform adapter periodically checks the external condition and updates the gate. Fits the existing adapter pattern (SyncCollection already polls).
3. **Manual resolution**: A human or coordinator agent runs `ft gate resolve <task-id>` after verifying the condition. Simplest to implement, matches current dogfooding workflow where the coordinator manually verifies pushes.
4. **Agent-driven**: The agent itself checks and resolves before closing. Least reliable (agents skip ceremony), but zero infrastructure cost.

For initial implementation, manual resolution (option 3) plus polling adapter (option 2) for CI systems covers the dogfooding use case without requiring webhook infrastructure.

---

## Medium Priority

### SpecID / Template ID

**What it does in Beads:** Links an issue to the named spec or template it was instantiated from (e.g., `"deploy-checklist"`, `"incident-response"`). Beads has a full template system ("protos" and "molecules") where templates are composed, instantiated, and tracked.

**Function in work tracking:** Traceability from repeatable workflows. When a deploy task is created from a checklist template, `spec_id` records which template was used. Useful for: auditing compliance ("was the correct checklist followed?"), template iteration ("how many tasks from template X failed?"), and deduplication ("don't create another instance if one is already active").

**NTO assessment:** Multiple platforms have template/issue-type concepts — GitHub issue templates, Jira issue types with screens, Linear templates. A `template_id` field on the NTO would preserve this linkage during sync. Without it, the information either goes into remote_data (queryable only with JSON operators) or is lost.

**Recommendation:** Add as optional string field on Task. Low cost, meaningful for round-trip fidelity with template-heavy platforms.

### Pinned

**What it does in Beads:** Boolean flag marking an issue as persistent context — always visible regardless of status filters. Not a work item. Think of a pinned message in a chat channel or a pinned issue on a GitHub repo.

**Function in work tracking:** Reference anchors. A pinned "Architecture Decisions" issue stays visible on the board even though it's not actionable work. Useful for: team agreements, environment documentation, standing meeting agendas, constraint reminders.

**NTO assessment:** Could be modeled as a label (`pinned`) but a first-class boolean gives better filtering semantics — `ft task list --pinned` vs grep-on-labels. GitHub Issues has pinning. Linear has "favorites." Jira has "flagged."

**Recommendation:** Consider as a boolean field. Low complexity, improves dashboard ergonomics. Could also be deferred to labels without significant loss.

---

## Low Priority

### BondedFrom (Compound Molecule Lineage)

**What it does in Beads:** Array of BondRef records tracking which source templates ("protos") were combined to create a compound workflow. Each ref has a sourceID, bondType (sequential, parallel, conditional), and bondPoint (where in the graph the source attaches).

**Function in work tracking:** Workflow composition metadata. When a complex deployment task is assembled from "rollout-proto + canary-proto + monitoring-proto," BondedFrom records the recipe. Enables: reconstructing how a workflow was assembled, comparing instances of the same compound, detecting composition drift.

**NTO assessment:** This is sophisticated workflow composition that no other mainstream tracker supports. If Farm Table ever adds composable task templates (e.g., "create a release workflow from these building blocks"), this metadata becomes essential. Currently, parent-child relationships + labels cover simple cases.

**Recommendation:** Skip for now. Revisit if FT adds template composition.

### WorkType (mutex | open_competition)

**What it does in Beads:** Assignment model for a task. `mutex` = one worker claims exclusively (the standard model). `open_competition` = multiple workers submit solutions, the task owner picks the best. Think bounty boards or competitive code reviews.

**Function in work tracking:** Enables marketplace-style assignment. An "open competition" bug bounty would accept multiple fix submissions from different agents, and a human reviewer picks the winner. Changes how claim semantics work — multiple claims allowed, resolution is selection rather than completion.

**NTO assessment:** Farm Table's current claim model is exclusively mutex. Adding a work_type field would require rethinking ClaimTask semantics (allow multiple claims, add a "select winner" operation). Interesting for agent swarms but significant implementation surface.

**Recommendation:** Note for future design. Only becomes relevant if FT supports multi-agent competitive workflows.

---

## Skip (Beads-Specific Internals)

### Ephemeral, NoHistory, WispType

Beads' three-tier persistence model: normal issues (full Dolt history), no-history issues (persist but no version tracking), and ephemeral "wisps" (transient, GC-eligible, TTL-based compaction). WispType classifies wisps for TTL policy: heartbeat (6h), patrol (24h), recovery/error (7d).

These are artifacts of Beads' Dolt-as-database architecture where git history has real storage costs. Farm Table uses SQL with a separate Change audit trail; persistence tiers are a database concern, not a data model concern.

### CompactionLevel, CompactedAt, CompactedAtCommit, OriginalSize

Dolt history compaction metadata tracking when an issue's version history was squashed. Pure storage optimization internals.

### MolType (swarm | patrol | work)

Classifies the coordination pattern: swarm (parallel multi-worker), patrol (recurring operational), work (normal). Controls Beads' runtime routing and management behavior. Farm Table uses type + labels for this distinction and doesn't have a runtime coordination layer that would consume this field.

### EventKind, Actor, Target, Payload

Operational state-change events stored as Beads issues. "patrol.muted", "agent.started", etc. These aren't work items — they're audit trail records that share the Issue schema for storage convenience (Dolt gives free versioning). Farm Table has a dedicated Change entity for audit trails (M4: automatic change records on mutations).

### Sender

Identifies who sent a message-type issue in Beads' inter-agent communication layer. Farm Table uses Comments for task-level communication; a messaging layer would be a separate system.

### IsTemplate

Boolean marking an issue as a read-only template that can be instantiated. Part of Beads' proto/molecule system. See SpecID discussion — if FT adds templates, both fields become relevant together.

### SourceFormula, SourceLocation

Traceability for workflow automation: which formula (workflow definition) and which step within it created this issue. Analogous to "created by CI pipeline at step 3." Could be covered by metadata in remote_data or a generic `created_by_source` field. Not urgent.

---

## Summary

| Priority | Field(s) | Recommendation | Rationale |
|----------|----------|----------------|-----------|
| **High** | AwaitType, AwaitID, Timeout, Waiters | Add as `GateContext` typed extension | Closes "done vs delivered" gap; external condition blocking |
| **Medium** | SpecID | Add as `template_id` string field | Round-trip fidelity for template-based platforms |
| **Medium** | Pinned | Add as boolean field | Persistent context markers for dashboards |
| **Low** | BondedFrom | Skip; revisit with template composition | No current use case |
| **Low** | WorkType | Skip; note for future | Requires rethinking claim semantics |
| **Skip** | 9 fields | Do not add | Beads-specific runtime/storage internals |
