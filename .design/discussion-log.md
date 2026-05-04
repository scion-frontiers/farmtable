# Farm Table — Product Discussion Log

## 2026-05-03: Initial Product Interrogation

### Participants
- ptone@google.com (product owner)
- PM review agent

---

### Q1: Differentiation vs. existing unified APIs (Merge.dev, Unified.to, Truto)

**Challenge:** The N×M integration pitch is identical to every commercial unified API company. What's the actual moat?

**Resolution:** Two key differentiators:
1. **100% open source and free** — distribution advantage over commercial unified API SaaS products.
2. **Agent-first from the ground up** — not a human-first integration layer that also works for agents. Purpose-built for agent consumption: atomic claims, ready-task detection, Change audit trail, zero-config built-in backend.

**Open item:** Consider repositioning the product definition to lead with "task runtime for AI agents" rather than "universal task interface." The integration layer is a means, not the end. The agent-first design decisions (not just the open-source license) are the deeper moat.

---

### Q2: Beads in Tier 1 — justified or over-scoped?

**Challenge:** Beads is niche. Every Tier 1 integration is ongoing maintenance. Is inclusion user-driven or architecturally motivated?

**Resolution:** Kept in Tier 1 for two reasons:
1. **Audience fit** — popular among agent-first development teams, which is the primary target audience.
2. **Graph-model influence** — Beads' thinking about tasks-as-graph-data-structure directly informs the built-in backend's design.

**Open item:** The second reason is a design input, not a shipping rationale. The audience-popularity claim should be validated with concrete evidence (community signals, user conversations) before final Tier 1 commitment.

---

### Q3: Multi-agent coordination across platform boundaries

**Challenge:** Atomic claims, ready-task detection, and critical-path analysis only work on the built-in backend. External platforms (Jira, GitHub, etc.) lack compare-and-swap semantics for task assignment. The product definition implies these capabilities are universal.

**Discussion:**
- **Manager-agent pattern mitigates the race condition.** If a single orchestrator agent serializes task assignments, atomicity is guaranteed at the application layer regardless of platform. This is the most common deployment pattern.
- **Low-frequency transactions reduce collision risk.** Task assignment operates on human timescales (minutes to hours). Advisory locks with read-check-write discipline catch 99%+ of conflicts without distributed locking.
- **Graph-analytical capabilities remain built-in-backend-only.** Critical-path analysis, bottleneck detection, and ready-task queries require the graph model and can't be replicated over flat external APIs.

**Decision:** Rather than a hard "Core vs. Coordinated" tier split, document orchestration patterns and which capabilities each platform level supports. The framing is **"Farm Table works everywhere; the built-in backend unlocks more"** — encouraging agent builders to start with external integrations (low friction) and graduate to the built-in backend as they need deeper coordination.

Proposed capability matrix:

| Pattern | External platforms | Built-in backend |
|---|---|---|
| Manager assigns work | Works well (serialized writes) | Works well + atomic guarantees |
| Agents self-select | Advisory locks, low collision risk | Atomic claims, guaranteed consistency |
| Dependency-aware scheduling | Read-only graph traversal | Full graph queries + ready-task detection |
| Graph analytics (critical path, bottleneck) | Not available | Full support |

---

### Q4: Consistency model for external platform sync

**Challenge:** Farm Table says it's "not a sync product," but agents reading and writing to external platforms face stale-read risks when humans update tasks directly in the source platform.

**Discussion:**
- At task-assignment timescales, optimistic concurrency with re-fetch-before-write is sufficient.
- Full conflict resolution is not needed at launch.
- The Change audit trail surfaces after-the-fact overwrites.
- May need to consider locked states or active drift detection for certain status transitions.

**Decision:** Needs further design work. Initial approach: optimistic concurrency (re-read if task was fetched more than N seconds ago). Defer full drift detection and conflict resolution to post-launch. Document the staleness window and failure modes for agent builders.

---

### Q5: Primary audience is coding agents

**Challenge:** The product definition reads as horizontal ("any project management system," "autonomous workers"). The actual target is coding agents (Claude Code, Cursor, Devin, Codex, etc.) and coding-like agents on similar harnesses.

**Resolution:** Confirmed — primary audience is coding and coding-adjacent agents.

**Implications:**
- GitHub Issues becomes the most important Tier 1 integration.
- Asana may be a weaker Tier 1 candidate given the audience narrowing.
- The built-in backend's graph model could optimize for code-project structures (repos, branches, PRs as nodes).

**NTO Schema Decision — Typed Extensions:**

Three options were considered for adding code-specific context to the NTO:
- **Option A (rejected):** Add code fields directly to the Task schema. Pollutes the universal schema with domain-specific fields.
- **Option B (selected):** Define typed extension blocks (e.g., `code_context: { repo, branch, prs[], ci_status }`). Keeps the core NTO generic while giving agents structured, predictable access to domain-specific fields. Establishes a pattern for future extensions (`ops_context`, `design_context`, etc.).
- **Option C (rejected):** Push code context to the Collection level. Per-task code context (target branch, linked PRs) doesn't fit at the collection level.

**Decision:** Option B — typed extensions. The NTO gets an optional, typed extension block per domain. `code_context` is the first. This preserves universality while serving coding agents with first-class structured fields, and provides a clear extensibility pattern for future domains.

---

### Q6: Agent-facing API surface and delivery mechanism

**Challenge:** How do agents interact with Farm Table? MCP, REST, CLI, or some combination?

**Discussion:** Three options were initially proposed:
1. MCP-only — clean but locks out non-MCP frameworks.
2. REST-first, MCP adapter — more work, more reach.
3. MCP-first, REST for admin — pragmatic split.

All three were superseded by a better answer from the product owner.

**Decision: CLI-first with agent skills as the primary interface.**

- **CLI** is the primary agent-facing interface. Coding agents live in the shell; shelling out to a CLI is the lowest-friction integration — no protocol negotiation, no SDK dependency, universal agent compatibility.
- **Agent skills** (e.g., Claude Code skill) wrap the CLI to provide ergonomic, context-aware invocation for specific agent frameworks.
- **MCP** is offered but is second-priority. Can wrap the CLI or the underlying API later with minimal effort.
- **Server architecture:** gRPC-designed-first service with HTTP transcoding. The CLI is a gRPC client. REST access comes "for free" via transcoding, but gRPC is the canonical protocol.
- **Auth:** API token (environment variable, e.g., `FARMTABLE_TOKEN`) for v1. OAuth flow may be layered on top later.

This layering is clean: gRPC service → CLI client → agent skill wrapper → (optional) MCP adapter. Each layer adds ergonomics without coupling.

---

### Q7: GTD framework and status model

**Challenge:** The research doc describes a nine-state GTD workflow (Inbox → Brainstorm → Proposed → Backlog → In Progress → On Hold → Done → Reviewed → Archived). The NTO schema has four statuses. Are these reconciled?

**Discussion:** The GTD framework is research-phase thinking. The four-state model is the right level for a universal interface. However, a two-tier and then three-tier status system was proposed to capture workflow richness without polluting the universal layer.

**Decision: Three-tier status model.**

| Tier | Name | Type | Purpose |
|---|---|---|---|
| 1 | **Phase** | Fixed enum (4 values): OPEN, IN_PROGRESS, ON_HOLD, CLOSED | Universal across all platforms. Coarse agent reasoning ("is there work to do?"). |
| 2 | **Stage** | Fixed enum (~12-15 values), scoped per phase | Precise agent reasoning ("is this ready to start or still in triage?"). Farm Table controls this enum. |
| 3 | **Native label** | Freeform string, optional | Verbatim platform status label. Preserved for round-trip fidelity. |

Proposed Stage values per Phase:

| Phase | Stages |
|---|---|
| OPEN | `triage`, `backlog`, `ready` |
| IN_PROGRESS | `working`, `in_review`, `in_qa`, `deploying` |
| ON_HOLD | `blocked`, `waiting_for_input`, `deferred`, `scheduled` |
| CLOSED | `completed`, `wont_fix`, `duplicate`, `cancelled` |

Key properties:
- Platform mapping is deterministic: Jira's "Awaiting Code Review" → phase: IN_PROGRESS, stage: `in_review`, native: "Awaiting Code Review".
- The Stage enum is the governance surface — new stages are deliberate product decisions.
- Tier 3 native label enables round-trip writes back to the source platform.
- Stage enum starts as global/fixed. Per-collection scoping deferred unless real mapping gaps emerge.

This supersedes the GTD framework from the research doc. GTD-inspired concepts (triage, backlog, ready) live as Stage values within the three-tier model.

---

### Q8: Identity, authentication, and governance

**Challenge:** How does an agent authenticate to Farm Table, and whose permissions does it use to reach external platforms?

**Decision: Farm Table as auth bridge.**

- **Agent → Farm Table:** API token only. The agent never sees or holds external platform credentials.
- **Farm Table → External platform:** Farm Table holds platform credentials and proxies all operations. Auth method varies by platform:
  - GitHub: PAT (personal access token, potentially a bot account's)
  - Linear: MCP OAuth flow (Farm Table acts as MCP client to Linear's MCP server)
  - Jira: API token or OAuth 2.0 app
  - Asana: PAT or OAuth
  - Built-in backend: no external auth needed

Key properties:
- **Single trust boundary.** Revoking the Farm Table API token cuts off agent access to all platforms.
- **Auth bridge enforces least-privilege.** Even if the stored PAT has broad access, Farm Table restricts what it proxies based on agent role, task assignment, or policy.
- **Platform credentials are a deployment-time admin concern**, not an agent concern.
- **MCP-as-platform-connector** (distinct from MCP-as-agent-interface): Farm Table uses MCP's OAuth flow to connect to platforms that support it. No contradiction with CLI-first agent interface.

**Collection-to-integration mapping: 1:1.** A Farm Table collection maps to exactly one external platform integration (one GitHub repo, one Jira project, one Linear team, etc.). A deployment can have many collections spanning multiple platforms, but each collection has a single platform credential and identity scope.

---

### Q9: Source of truth — JSON Schema vs. Protobuf

**Challenge:** The project has a JSON Schema (DRAFT-schema.json) and has decided on gRPC-first with HTTP transcoding. Which schema format is the canonical definition?

**Options considered:**
- **Option A (rejected):** JSON Schema as source of truth. Doesn't define services/RPCs; would require maintaining two schema definitions in sync (proto for service layer, JSON Schema for data model).
- **Option B (selected):** Protobuf as source of truth. Defines both data shapes and service contracts in one place. Native to the chosen stack (gRPC, Go, HTTP transcoding). First-class code generation, wire-compatible evolution via field numbering, `buf` toolchain for linting and breaking change detection.
- **Option C (future):** Proto as source of truth with generated JSON Schema for documentation and external consumers. Deferred but likely near-term addition for richer data type validation.

**Decision:** Option B now, with a path to Option C. The existing JSON Schema served its purpose as a design artifact for product discussion. The proto file becomes the canonical schema definition going forward. Validation constraints (uuid, email, uri formats) move to `protovalidate` annotations on proto messages.

---

### Q10: Schema review findings — triage and resolution

**Context:** A schema review (`schema-review-findings.md`) compared DRAFT-schema.json v0.1.0 against integration research. Findings were triaged against v0.2.0 updates already made.

**Already resolved by v0.2.0:**
- Three-tier status model (finding 2.1)
- code_context typed extension (finding 2.2)

**Resolved in v0.3.0 (this round):**

| Change | Finding | Rationale |
|---|---|---|
| Added `type` field (freeform string, nullable) | 2.3 | Jira requires issuetype for creation. Agents need to distinguish bug/epic/story. Freeform string since types vary wildly. |
| Removed PARENT/CHILD from RelationshipType | 3.1 | Redundant with `parent_task_id`. Two hierarchy mechanisms cause data inconsistency. |
| Made `priority` optional (nullable) | 2.10 | GitHub has no native priority. Forcing a value creates noise. |
| Added `start_date` | 2.4 | Asana, Beads, Jira support it. Enables scheduling and capacity reasoning. |
| Added `closed_at` | 2.5 | Essential for cycle-time metrics and agent performance analysis. |
| Expanded AuthMethod enum | 3.5 | Added GITHUB_APP, ATLASSIAN_CONNECT, LOCAL_PROCESS for platform-specific auth. |
| Added `acceptance_criteria` (nullable) | 2.9 | Product definition promises "acceptance criteria" for agents. First-class in built-in backend; extracted from descriptions for external platforms. |

**Deferred (v2+):**
- Estimate/effort (2.6) — custom_fields for now
- Comment threading (2.7) — Linear-specific, low priority
- Multi-homing (3.2) — documented as v1 limitation
- Status source ambiguity (3.3) — integration-layer concern
- Jira workflow transitions (3.6) — integration-layer concern

**Close reason (2.8):** Resolved by the Stage tier — `completed`, `wont_fix`, `duplicate`, `cancelled` stages within CLOSED phase provide normalized close reasons without a separate field.

**Integration-level concerns** (findings 3.3, 3.6, and other platform-specific behaviors): left in `schema-review-findings.md` for now as a reference. These are implementation concerns for individual platform adapters, not schema-level decisions.

---

### Q11: Consistency model for optimistic concurrency

**Context:** Q4 identified the need for a consistency model. This is the detailed design.

**Decision: Optimistic concurrency via version tokens.**

- Every Task carries a `string version` field — opaque concurrency token.
- **Built-in backend:** Monotonically increasing integer (as string). Auto-incremented on every mutation via Ent hook. Conditional updates use database-level CAS: `UPDATE ... WHERE version = $expected`.
- **External platforms:** Version derived from platform-native primitives — ETag (Jira), `updatedAt` (Linear, GitHub), or computed hash of mutable fields (Asana, where no native concurrency primitive exists).
- **Conditional updates are opt-in.** Supply `--version` flag to get conflict detection; omit it for fire-and-forget (last-write-wins). Backward compatible.
- **Re-fetch-before-write on external platforms.** Server re-reads from source platform before applying conditional updates. ~100ms TOCTOU window, acceptable at task-assignment timescales.
- **Conflict signal:** gRPC `ABORTED` / HTTP 409 / CLI exit code 5. Response includes current task state for agent inspection and retry.

**Proto impact:** `string version = 27` on Task; `optional string version` on UpdateTaskRequest (field 41), ClaimTaskRequest (field 4), CloseTaskRequest (field 5).

**Deferred:** Active drift detection via webhooks, field-level conflict merge, distributed locks.

Full design: `.design/consistency-model.md`

---

### Q12: Backend architecture — dual-mode operation (embedded + client-server)

**Context:** The built-in backend was designed Postgres-only. This creates friction for local dev, single-agent use, testing, and the "zero-config quick start" promise.

**Challenge:** How to support both SQLite (for embedded/local/testing) and Postgres (for production multi-agent) without duplicating the codebase or creating architectural complexity?

**Decision: Dual-mode via bufconn.**

- **Embedded mode (default):** CLI starts an in-process gRPC server over bufconn (gRPC's in-memory transport), backed by SQLite at `~/.farmtable/farmtable.db`. No separate server process, no Postgres, no configuration. Just works.
- **Client-server mode:** When `FARMTABLE_SERVER` is set or `--server` is provided, CLI dials a remote `farmtable-server` backed by Postgres. Production multi-agent deployments use this mode.
- **Single store implementation:** Rename `PostgresStore` → `EntStore` with a dialect parameter. Ent handles SQL differences between Postgres and SQLite. The existing code has no Postgres-specific queries — it's already dialect-agnostic.
- **Single decision point:** Mode selection happens in `connect.go` only. CLI commands, service layer, and store layer are completely unaware of which mode is active.

**Key properties:**
- Zero-config by default (embedded SQLite). Server config opts into client-server mode.
- Same Ent schemas, same service code, same CLI code for both modes.
- SQLite concurrency is sufficient for embedded single-process use. Postgres required for multi-agent production.
- Recursive CTEs (graph queries) supported by both databases.

**Implementation phases:** A (EntStore refactor) → B (embedded mode) → C (default collection) → D (test infrastructure).

Full design: `.design/backend-architecture.md`

---

## Open items for future discussion
- Repositioning / messaging (Q1 follow-up)
- Beads audience validation (Q2 follow-up)
- Business model / sustainability
- gRPC error code for conflicts: current implementation uses FAILED_PRECONDITION, consistency model specifies ABORTED (conventional for retryable concurrency conflicts). Minor alignment needed.
