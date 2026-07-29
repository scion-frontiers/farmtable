# Schema Review Findings: DRAFT-schema.json vs. Integration Research

**Date:** 2026-05-03
**Scope:** Comparison of `DRAFT-schema.json` (v0.1.0) against integration research for GitHub Issues, Linear, Jira Cloud, Asana, and Beads, with product-definition.md as the reference for intended design.

---

## 1. What the Schema Handles Well

**Normalized status with round-trip fidelity.** The four-state `TaskStatus` (OPEN, IN_PROGRESS, ON_HOLD, CLOSED) is a reasonable universal bucketing for all five platforms. The `native_status` field preserves the verbatim source label, and `StatusMapping` on `Collection` allows per-collection configuration — essential for Jira's infinite custom workflows and Linear's per-team WorkflowStates.

**Flexible relationship model.** `RelationshipType` covers blocks, blocked_by, related, duplicate, parent, and child. Every researched platform's relationship types map cleanly into these categories (GitHub sub-issues, Linear IssueRelations, Jira issue links, Asana dependencies, Beads dependency graph).

**Multi-assignee support.** The `assignees` array accommodates GitHub's up to 10 assignees while gracefully degrading to a single-element array for Linear, Jira, Asana, and Beads (all single-assignee by default).

**Custom fields with typed values.** The `CustomFieldValue` / `CustomFieldType` system covers the field types surfaced by all five platforms: text, number, date, single/multi select, user, boolean. The `custom_field_definitions` on `Collection` enables dynamic discovery (Jira's `/createmeta`, Asana's custom field settings, Linear's `customFieldDefinitions`).

**The `remote_data` escape hatch.** Present on both Task and Collection, this handles platform-specific fields that don't map to the NTO: Jira's `components`, `fixVersions`, `environment`, `resolution`; Asana's `memberships`, `collaborators`; Beads' `content_hash`, `compaction_level`, `wisp_type`; Linear's `boardOrder`, `cycle`; GitHub's `milestone`.

**Webhook events with virtual webhook support.** The `VIRTUAL_WEBHOOK` source type in `WebhookEvent` directly addresses Beads' lack of native webhooks (poll or filesystem-watch derived events) and provides a fallback for any platform where webhook registration fails.

**Markdown normalization.** The schema's choice to normalize descriptions and comments to Markdown is correct — GitHub, Linear, and Beads are already Markdown-native. This puts the translation burden squarely on the Jira (ADF) and Asana (HTML) adapters, which is the right boundary.

**Audit trail.** The `Change` entity with field-level diffs, actor attribution, timestamps, and optional `reason` supports the product definition's "auditable by construction" principle across all platforms.

---

## 2. Gaps and Missing Fields

### 2.1 Three-Tier Status Model (Product Definition vs. Schema)

The product definition specifies a three-tier status model:
- **Phase:** 4 universal values (OPEN, IN_PROGRESS, ON_HOLD, CLOSED) — present as `status`
- **Stage:** A fixed set of finer-grained positions within each phase — **missing entirely**
- **Native label:** The verbatim source string — present as `native_status`

The schema jumps directly from Phase to Native label with no intermediate Stage tier. This matters because Linear has 6 state categories (`triage`, `backlog`, `unstarted`, `started`, `completed`, `canceled`) and Jira's status categories provide similar granularity. Without Stage, agents cannot distinguish between "Triage" and "Backlog" tasks that both map to OPEN, losing information the product definition intended to preserve.

### 2.2 Typed Domain Extensions (`code_context`)

The product definition explicitly describes typed domain extensions:

> The first extension is `code_context` — structured fields for repository, branch, pull requests, and CI status that coding agents need to begin work.

The schema has no domain extension mechanism whatsoever. For a product whose primary users are coding agents, the absence of structured code context (repo URL, branch name, linked PRs, CI status) is a significant gap. Currently this data can only land in unstructured `remote_data`, which defeats the purpose of giving agents a predictable schema to reason against.

### 2.3 Issue / Task Type

Multiple platforms have first-class task typing:
- **Jira:** Epic, Story, Task, Bug, Sub-task, and unlimited custom types — `issuetype` is a required creation field
- **Beads:** `issue_type` field (task, bug, feature, etc.)
- **Asana:** `resource_subtype` (default_task, milestone, approval)
- **GitHub/Linear:** Implicit via labels or hierarchy level

The NTO has no `type` field. Agents receiving a normalized task cannot distinguish a bug from an epic from a story without digging into `labels` or `remote_data`. This directly conflicts with the product definition's goal of providing "unambiguous scope" to agents.

### 2.4 Start Date

The NTO has `due_date` but no `start_date`. Platforms that model time ranges:
- **Asana:** `start_on` / `due_on`
- **Beads:** `started_at`
- **Jira:** Start date via custom fields or Sprint start
- **Linear:** Project start dates

Without `start_date`, agents cannot determine planned work windows, which limits scheduling and capacity reasoning.

### 2.5 Lifecycle Timestamps

The NTO has only `created_at` and `updated_at`. Missing:
- **`started_at`**: When work actually began (Beads has this natively)
- **`closed_at`** / **`completed_at`**: When the task was finished (Asana's `completed_at`, Beads' `closed_at`)

These timestamps are important for agent performance metrics and cycle-time analysis — a key value proposition for teams deploying agents.

### 2.6 Estimate / Effort

Several platforms provide effort estimation:
- **Linear:** `estimate` (story points)
- **Beads:** `estimated_minutes`
- **Jira:** Story points (custom field, but nearly universal)

No built-in NTO field for estimated effort. This could go into custom fields, but given how universal estimation is across agile workflows, a first-class field would reduce mapping ambiguity.

### 2.7 Comment Threading

Linear supports threaded comments via `parentId` on comments. The NTO `Comment` entity has no `parent_comment_id` field. Threaded discussions are flattened into a linear timeline, losing conversational structure.

### 2.8 Resolution / Close Reason

- **GitHub:** `state_reason` (completed, not_planned, reopened)
- **Jira:** `resolution` field (Fixed, Won't Fix, Duplicate, Cannot Reproduce, etc.)
- **Beads:** `tombstone` status for permanently dismissed tasks

The NTO has no field to distinguish "closed-completed" from "closed-won't-fix." Both map to CLOSED. The `native_status` field partially addresses this, but agents need to parse platform-specific strings to make this distinction. A normalized close reason would be more useful.

### 2.9 Acceptance Criteria

The product definition states agents receive tasks with "acceptance criteria." Beads has a dedicated `acceptance_criteria` field. No other platform has a native equivalent, but the product definition treats this as a core NTO concept. Currently there is no field for it.

### 2.10 Priority Optionality

`priority` is in the NTO's `required` array, but:
- **GitHub:** Has no native priority field at all
- **Linear:** Priority 0 means "No priority"

Forcing a priority value means integrations must invent defaults for tasks that explicitly have none. Consider making priority optional or adding a `NONE` value.

---

## 3. Conflicts and Ambiguities

### 3.1 Redundant Hierarchy: `parent_task_id` vs. PARENT/CHILD Relationships

The Task has both:
- `parent_task_id` (a direct UUID reference field)
- `PARENT` / `CHILD` in the `RelationshipType` enum (expressed via the `relationships` array)

These are two mechanisms for expressing the same thing. Which is authoritative? If an agent reads `parent_task_id` and a PARENT relationship that point to different tasks, the schema provides no resolution rule. All five platforms model hierarchy as a direct parent reference (Jira `parent`, Asana `parent`, Beads dotted IDs, Linear `parentId`, GitHub `subIssues`), suggesting `parent_task_id` is the right primary mechanism and PARENT/CHILD should be removed from `RelationshipType` to avoid inconsistency.

### 3.2 Single `collection_id` vs. Multi-Homing

The NTO has a single `collection_id`, but:
- **Asana:** Tasks can belong to multiple projects simultaneously (multi-homing is a first-class feature)
- **GitHub:** Issues can belong to multiple Projects V2

A single `collection_id` forces the integration to pick one canonical collection per task, silently discarding the others. This may be acceptable as a v1 simplification, but should be documented as a known limitation with a path to supporting an array of collection IDs.

### 3.3 Status Source Ambiguity for Binary-State Platforms

GitHub (open/closed) and Asana (completed/incomplete) are natively binary. Richer status comes from *different data sources*:
- GitHub: A custom "Status" field on a Projects V2 item (not on the Issue itself)
- Asana: A custom field enum or the Section a task is in

The `StatusMapping` model assumes status comes from a single native field (`native_status`). But for GitHub and Asana, the "real" status may live in a custom field or section that isn't the same data path as the issue's native state. The schema needs to either:
1. Document that integrations should use the richer status source to populate `native_status`, or
2. Extend `StatusMapping` to specify *which source field* is being mapped (e.g., `source_field: "projects_v2.status"`)

### 3.4 User Identity: Per-Platform vs. Cross-Platform

The `User` entity has a single `platform` field, implying each User record is platform-specific. But the `LinkedAccount` model allows one Farm Table user to connect to multiple platforms. This creates a modeling tension:

- A User with `platform: "github"` suggests a platform-scoped identity
- But the same human might be linked to GitHub, Jira, and Linear via LinkedAccounts

The User entity likely needs `platform` to be optional (or removed) for Farm Table-native users, with `remote_id` and `platform` only populated on platform-sourced user references. Alternatively, Task fields like `assignees` and `creator` should reference Farm Table user IDs, with platform-specific identity resolved through LinkedAccount lookups.

### 3.5 AuthMethod Enum Gaps

The `AuthMethod` enum lists: `OAUTH2_PKCE`, `API_KEY`, `PAT`, `SERVICE_ACCOUNT`. Missing methods identified in research:
- **GitHub App (JWT + Installation Token):** The recommended GitHub auth method doesn't fit any enum value. It's not OAuth2 PKCE, not a PAT, and not a traditional API key.
- **Atlassian Connect (JWT):** Jira's recommended native app auth model.
- **Local filesystem access (Beads):** No auth method applies; Beads runs as a local subprocess.

### 3.6 Jira Status Transitions vs. Direct State Setting

The NTO implies status can be set directly (just write a new `status` value). But Jira enforces *workflow transitions* — you cannot arbitrarily set a status; you must execute a valid transition that may itself require additional fields. The schema has no concept of "available transitions" or transition constraints. This is primarily an integration-layer concern, but the `WebhookEvent` type `task.status_changed` should document that the write-back path may involve transition IDs, not simple status assignments.

---

## 4. Recommended Schema Changes

### High Priority

| # | Change | Rationale |
|---|--------|-----------|
| 1 | **Add `stage` field to Task** (string enum, e.g., TRIAGE, BACKLOG, TODO, ACTIVE, REVIEW, QA, DONE, CANCELLED) | Fulfills the three-tier status model from the product definition. Maps cleanly to Linear's 6 state categories and Jira's status categories. Gives agents finer-grained status awareness without platform-specific parsing. |
| 2 | **Add a `code_context` extension object to Task** with fields: `repository_url`, `branch`, `pull_request_urls`, `ci_status` | Explicitly called out in the product definition. Primary users are coding agents — they need structured code context, not buried-in-remote_data guessing. Make it optional (`type: ["object", "null"]`). |
| 3 | **Add `type` field to Task** (string, e.g., "epic", "story", "task", "bug", "subtask") | Jira requires `issuetype` for creation. Beads has `issue_type`. Agents need to know what kind of work a task represents. Use a free-form string (not an enum) since types vary wildly across platforms. |
| 4 | **Remove PARENT/CHILD from `RelationshipType`** | Redundant with `parent_task_id`. Having two mechanisms for hierarchy creates ambiguity. Keep `parent_task_id` as the canonical hierarchy mechanism; `relationships` should model non-hierarchical links only. |
| 5 | **Make `priority` optional** (remove from `required` array) | GitHub has no native priority. Linear allows "No priority." Forcing a value creates noise. Alternatively, add `NONE` to the `TaskPriority` enum. |

### Medium Priority

| # | Change | Rationale |
|---|--------|-----------|
| 6 | **Add `start_date` to Task** (`type: ["string", "null"], format: "date-time"`) | Asana, Beads, and Jira all support start dates. Enables agents to reason about work windows. |
| 7 | **Add `closed_at` to Task** (`type: ["string", "null"], format: "date-time"`) | Asana's `completed_at`, Beads' `closed_at`. Essential for cycle-time metrics. |
| 8 | **Add `close_reason` to Task** (string enum: COMPLETED, WONT_FIX, DUPLICATE, NOT_PLANNED, or null) | Normalizes GitHub's `state_reason`, Jira's `resolution`, and Beads' `tombstone`. Agents can distinguish "done" from "abandoned." |
| 9 | **Add `parent_comment_id` to Comment** (`type: ["string", "null"], format: "uuid"`) | Preserves Linear's threaded comment structure. Platforms without threading leave it null. |
| 10 | **Expand `AuthMethod` enum** to include `GITHUB_APP`, `ATLASSIAN_CONNECT`, `LOCAL_PROCESS` | Covers the recommended auth methods from GitHub, Jira, and Beads research. |

### Low Priority / Document as Known Limitations

| # | Change | Rationale |
|---|--------|-----------|
| 11 | **Add `source_field` to `StatusMapping`** (optional string indicating which platform field the native status was read from) | Disambiguates GitHub Projects V2 status vs Issue state, and Asana section vs completed flag. |
| 12 | **Add `estimate` to Task** (`type: ["number", "null"]`) with a companion `estimate_unit` (enum: POINTS, MINUTES, HOURS) | Linear story points, Beads `estimated_minutes`. Common enough to warrant a built-in field. |
| 13 | **Document `collection_id` as single-select** and add a note that multi-homed tasks (Asana, GitHub Projects V2) must choose a primary collection, with additional memberships preserved in `remote_data`. | Multi-homing is an Asana-specific feature. A v1 simplification is acceptable if documented. |
| 14 | **Clarify User.platform semantics**: make `platform` and `remote_id` optional, documenting that Farm Table-native users omit them, and that cross-platform identity is resolved through `LinkedAccount`. | Resolves the per-platform vs cross-platform user modeling tension. |
| 15 | **Add `acceptance_criteria` to Task** (`type: ["string", "null"]`) | Product definition mentions this as a core concept agents need. Beads has it natively. For other platforms, it could be extracted from structured description sections. |

---

## 5. Summary

The DRAFT schema is a strong foundation. The core NTO structure, relationship model, status normalization approach, custom fields, and audit trail are well-designed and cover the majority of cross-platform needs.

The most critical gaps are architectural: the missing Stage tier in the status model and the absent `code_context` domain extension — both explicitly described in the product definition but not yet reflected in the schema. The `parent_task_id` / PARENT-CHILD relationship redundancy should be resolved before it creates conflicting data in production.

The remaining gaps (task type, start date, close reason, comment threading, estimate) are fields that would improve agent comprehension but can be addressed incrementally. The multi-homing and status-source-ambiguity issues should be documented as known v1 limitations with clear paths forward.
