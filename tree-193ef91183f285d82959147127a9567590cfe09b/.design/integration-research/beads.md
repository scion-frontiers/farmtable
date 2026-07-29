# Integration Research: Beads (bd)

> Research template for evaluating a Farm Table integration target.
> Copy this file to `{platform-name}.md` and fill in each section.

---

## 1. Platform Overview

- **Platform:** Beads (bd)
- **Tier:** 1 — Launch Target
- **Primary users:** AI coding agents and their human developer counterparts, seeking a persistent, structured memory and dependency-aware graph task tracker that lives alongside their code.
- **Archetype tested:** Agent-native CLI / local-first version-controlled database. Validates Farm Table's ability to integrate with a CLI-driven, SQL-backed (via Dolt), highly decentralized tool.

---

## 2. Data Model

### Native task structure

- **Task entity name:** Issue
- **Identifier format:** Hash-based string IDs (e.g., `bd-a1b2`) or hierarchical IDs for epics (e.g., `bd-a3f8.1.1`).
- **Hierarchy model:** Epic → Task → Sub-task (using dotted hierarchical IDs).
- **Maximum nesting depth:** Arbitrary (delineated by dots in the ID like `.1.1`), though typically 3-4 levels in practice.
- **Description format:** Markdown (in `description`, `design`, `acceptance_criteria`, `notes` fields).

### Fields and metadata

- **Built-in fields:** `id`, `title`, `description`, `design`, `acceptance_criteria`, `notes`, `spec_id`, `status`, `priority`, `issue_type`, `assignee`, `owner` (for CV attribution), `estimated_minutes`, timestamps (`created_at`, `updated_at`, `started_at`, `closed_at`, `due_at`, `defer_until`), `external_ref`, `source_system`, `labels` (array of strings).
- **Custom fields:** Stored as an arbitrary JSON object in the `metadata` field. Validated as well-formed JSON on create/update.
- **Required fields:** `title`.

### Relationships and dependencies

- **Supported relationship types:** `blocks`, `related`, `duplicates`, `parent-child` (workflow types); plus `relates_to`, `supersedes`, and `replies_to` for knowledge graphs.
- **How relationships are modeled:** First-class relationship graph stored in a separate dependencies table. Linked using commands like `bd dep add <child> <parent>`.
- **Cross-project references:** Yes, via the `external_ref` field or federation (`source_system`).

### NTO mapping considerations

- **Status mapping to OPEN / IN_PROGRESS / ON_HOLD / CLOSED:**
  - `open` -> OPEN
  - `in_progress`, `hooked` (claimed by worker) -> IN_PROGRESS
  - `blocked`, `deferred`, `pinned` -> ON_HOLD
  - `closed`, `tombstone` -> CLOSED
- **Priority mapping to URGENT / HIGH / NORMAL / LOW:**
  - `0` (Critical) -> URGENT
  - `1` (High) -> HIGH
  - `2` (Medium) -> NORMAL
  - `3` (Low), `4` (Backlog) -> LOW
- **Assignee model:** Single assignee (`assignee` string), plus a separate `owner` field for git author email / human attribution.
- **Fields with no NTO equivalent:** `content_hash`, `compaction_level`, `compacted_at`, `original_size`, `wisp_type`, `ephemeral`, `sender` (used for inter-agent messaging).
- **NTO fields with no native equivalent:** None natively mapped, but can be seamlessly pushed into the `metadata` JSON object.

---

## 3. API Surface

### API architecture

- **API style:** CLI commands returning JSON (`--json` flag with `BD_JSON_ENVELOPE=1`), or direct SQL querying via Dolt (MySQL-compatible).
- **Base URL pattern:** Local executable (`bd`), or `mysql://127.0.0.1:3306` (if running `dolt sql-server`).
- **API versioning strategy:** JSON Schema envelope versioning. The environment variable `BD_JSON_ENVELOPE=1` wraps all outputs in `{"schema_version": 1, "data": <payload>}`.
- **Documentation URL:** https://gastownhall.github.io/beads/

### Key endpoints / operations

| Operation | Method / Query | Notes |
|-----------|---------------|-------|
| List tasks | `bd list --json` or `bd ready --json` | Limit-based pagination via `--limit` |
| Get task detail | `bd show <id> --json` | Returns full issue details including dependencies |
| Create task | `bd create "Title" --json` | Priority (`-p`), Type (`-t`), Labels (`-l`) |
| Update task | `bd update <id> --json` | Partial updates supported |
| Transition status | `bd update <id> --status <status> --json` | E.g., `bd close <id>` |
| Add comment | `bd comment add <id> "Text"` | Threading supported via messaging |
| List relationships| `bd dep list <id>` | Graph connections included in `bd show` |

### Pagination

- **Strategy:** Limit-based in CLI (no native cursor/offset). If connected via Dolt SQL Server, standard SQL `LIMIT` and `OFFSET` apply.
- **Default page size / max page size:** Default is 50 (or 20 in Agent Mode). Explicit `--limit 0` removes the limit.
- **Total count available?** Not directly returned by the CLI envelope. Can be obtained by running an unlimited query or direct SQL `SELECT COUNT(*)`.

### Rate limiting

- **Rate limit model:** None. It runs locally as a process or a local database server.
- **Documented limits:** N/A.
- **Rate limit headers:** N/A.
- **Recommended backoff strategy:** Retries on SQLite busy/lock states are handled internally by the tool.

### Webhooks / real-time updates

- **Webhook support:** No traditional HTTP webhooks natively exposed by the CLI.
- **Event types available:** N/A.
- **Webhook registration method:** N/A.
- **Payload format:** N/A.
- **If no webhooks:** Since data is stored in the Git/Dolt repository (`.beads/dolt/`), standard Git hooks (`post-commit`, `pre-push`) or filesystem watchers can be used to detect changes.

---

## 4. Authentication & Authorization

### Auth model

- **Supported auth methods:** Local system file permissions (for CLI access), or standard MySQL authentication if running `dolt sql-server`.
- **Recommended method for Farm Table:** Execute `bd` locally as a subprocess using the `--json` flag to inherit the workspace's environment and permissions.
- **OAuth grant type:** N/A.
- **Token lifecycle:** N/A.

### Scopes and permissions

- **Available scopes:** Bound entirely by local filesystem or Git repository write access.
- **Minimum scopes required for Farm Table:** Read/Write access to the project directory where `.beads/` resides.
- **Granularity:** Workspace-level (repository-level).
- **Can scopes be narrowed after initial grant?** No.

### Service accounts / machine users

- **Bot/app user model:** Interactions are attributed to the `Assignee` or `Owner`. Integrations can identify themselves in the `SourceSystem` field or track operations via Git commit authorship.
- **Audit trail:** Yes, every modification writes a commit to the local Dolt SQL history, providing an immutable, version-controlled audit trail.
- **Account lifecycle:** N/A.

---

## 5. Normalization Challenges

### Status mapping complexity

- **Custom workflow states:** Not natively supported. The platform relies on a strict set of built-in statuses (`open`, `in_progress`, `blocked`, `deferred`, `closed`, `tombstone`, `pinned`, `hooked`).
- **Workflow transition constraints:** None strictly enforced by the schema, although `blocked` is natively computed based on open dependencies.
- **Default vs. custom workflows:** Standardized workflow.

### Custom field handling

- **Field types supported:** Arbitrary JSON types inside the `metadata` object.
- **Field discovery mechanism:** None. The API schema does not define what keys exist inside `metadata`.
- **Mapping strategy:** Map custom NTO fields into a Farm Table-namespaced key inside `metadata` (e.g., `metadata.farm_table`).

### Content format translation

- **Native format:** Markdown.
- **Conversion to/from Markdown:** Direct 1:1 mapping with no translation needed.

### Identity resolution

- **User identifier format:** Plain string (typically an email, GitHub username, or generic handle).
- **Cross-referencing with Farm Table identity:** Simple string matching against `assignee` or `owner`.

---

## 6. Operational Considerations

### Data volume and performance

- **Typical task count per workspace:** Designed to handle thousands of tasks. Includes a unique "compaction" feature (semantic memory decay) to summarize old, closed tasks into a compact representation to save agent context windows.
- **Bulk operations support:** Limited in CLI, but fully supported if using direct SQL `INSERT`/`UPDATE` via Dolt Server.
- **Search/filter capabilities:** Strong native filtering in CLI (`--status`, `--priority`, `--assignee`, `--type`, `--label`, `--spec`). Full SQL indexing is available under the hood.

### Error handling

- **Error response format:** CLI exits with non-zero status code and emits error text to `stderr`.
- **Common failure modes:** CLI not installed, repository not initialized with `bd init`, lock conflicts (rare).
- **Idempotency support:** Can be achieved by relying on specific external references (`external_ref`), but creation generally yields a new hash-based ID. Updates are idempotent by nature of declarative CLI flags.

### Platform-specific quirks

- **Architecture:** It is not a cloud service. It's a CLI tool backed by a local SQL database (Dolt). Any Farm Table integration must run in the environment where the repository is cloned, or connect to a locally running Dolt SQL server.
- **Envelope API:** Requires setting `export BD_JSON_ENVELOPE=1` to guarantee a stable `{"schema_version": 1, "data": ...}` wrapper on JSON responses.
- **Agent Focus:** Designed to minimize token overhead. Native support for "wisps" (ephemeral messages) and "compaction".

---

## 7. Integration Complexity Assessment

| Dimension | Complexity (Low / Medium / High) | Notes |
|-----------|----------------------------------|-------|
| Data model mapping | Low | Clean 1:1 mapping with many standard fields. Superset of NTO. |
| API ergonomics | Medium | Subprocess CLI execution instead of HTTP API, but reliable JSON output makes parsing trivial. |
| Auth setup | Low | Relies strictly on local OS permissions; no tokens or OAuth required. |
| Status normalization | Low | Hardcoded statuses match cleanly to standard buckets. |
| Custom field handling | Low | Passthrough via the flexible `metadata` JSON field. |
| Real-time sync | Medium | Requires filesystem watching, Git hooks, or polling rather than standard webhooks. |
| Overall | Low | Extremely straightforward if Farm Table operates as a local agent or has local repository access. |

---

## 8. Open Questions

- Should Farm Table interact exclusively via `bd` subprocess executions, or connect to `dolt sql-server` directly for richer SQL query support (like offset-pagination and bulk ops)?
- How will Farm Table distribute the `bd` binary dependency to its runtime environments if integrating natively?

---

## 9. References

- Documentation: `https://gastownhall.github.io/beads/`
- CLI Reference & Architecture (found in `.scratch/beads/docs/`)
- Dolt SQL Database: `https://github.com/dolthub/dolt`