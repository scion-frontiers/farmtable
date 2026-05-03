# Farm Table — CLI Command Surface Design

**Version:** 0.2.0 (Revised)
**Date:** 2026-05-03
**Status:** Design document — pre-implementation

**Revision notes (0.2.0):** Incorporates feedback from CLI design review. Key changes: added `ft status` command, replaced fragile `--add-pr` flag with `--add-pr-url`/`--add-pr-status`, deferred `--fields` projection to v1.1, added `request_id` to JSON responses, documented `graph ready` vs `task list --stage ready` distinction, added task release workflow pattern.

---

## 1. Overview & Design Philosophy

The Farm Table CLI (`ft`) is the primary interface for coding agents interacting with the Farm Table task runtime. It is a gRPC client that communicates with the Farm Table server, with HTTP transcoding available as a fallback.

### Design principles

1. **Agent-first ergonomics.** JSON output by default. Predictable structure. Machine-parseable errors. Exit codes that convey meaning without reading output.
2. **Shallow command hierarchy.** Two levels maximum for all common operations (`ft task list`, `ft comment add`). Agents should not need to memorize deep command trees.
3. **Noun-verb structure.** `ft <resource> <action>` — consistent, discoverable, greppable.
4. **Stdin-friendly.** Long-form text (descriptions, comments, acceptance criteria) can be piped from stdin, passed inline, or read from files.
5. **Minimal required arguments.** Defaults are sensible. A default collection can be configured so agents don't pass `--collection` on every call.
6. **Stage-driven status.** Agents set the Stage (tier 2); the CLI resolves the Phase (tier 1) automatically from the phase-stage mapping. Agents never need to think about phase directly.

### Binary name

- **`ft`** — primary invocation name.
- **`farmtable`** — long-form alias for environments where `ft` conflicts.

---

## 2. Configuration & Authentication

### Authentication

Farm Table uses API tokens for agent authentication. The token is read from (in priority order):

1. `--token` flag (per-command override)
2. `FARMTABLE_TOKEN` environment variable (recommended for agents)
3. Config file (`~/.config/farmtable/config.toml` → `token` field)

If no token is found, the CLI exits with code 3 and a clear error message.

### Server address

The server address is resolved from (in priority order):

1. `--server` flag
2. `FARMTABLE_SERVER` environment variable
3. Config file (`~/.config/farmtable/config.toml` → `server` field)
4. Default: `localhost:9090` (gRPC) / `localhost:8080` (HTTP)

### Config file

Location: `~/.config/farmtable/config.toml` (XDG-compliant, overridable via `FARMTABLE_CONFIG`).

```toml
# ~/.config/farmtable/config.toml

server = "farmtable.example.com:9090"
token = "ft_tok_abc123..."

# Default collection for commands that require one.
# Avoids passing --collection on every call.
default_collection = "a1b2c3d4-..."

# Default output format. Overridable per-command with -o.
output = "json"
```

### Configuration commands

```
ft config show                 # Print resolved configuration (redacts token)
ft config set <key> <value>    # Set a config value
ft config path                 # Print config file path
```

---

## 3. Global Conventions

### Global flags

Every command accepts these flags:

| Flag | Short | Default | Description |
|------|-------|---------|-------------|
| `--output` | `-o` | `json` | Output format: `json`, `table`, `quiet`, `jsonl` |
| `--collection` | `-c` | Config default | Scope operation to a collection (UUID or name) |
| `--server` | | Config/env | Server address |
| `--token` | | Env/config | API token override |
| `--verbose` | `-v` | false | Verbose output (includes request/response metadata) |
| `--help` | `-h` | | Show help for the command |

### Output formats

| Format | Description | Use case |
|--------|-------------|----------|
| `json` | Full JSON object/array. Default. | Agent parsing, programmatic consumption |
| `jsonl` | One JSON object per line (for list commands) | Streaming agent processing |
| `table` | Aligned columns, human-readable | Human debugging, interactive use |
| `quiet` | IDs only, one per line | Piping into other commands |

### Task identification

Tasks can be referenced by:

- **UUID** — the canonical Farm Table identifier (e.g., `a1b2c3d4-e5f6-7890-abcd-ef1234567890`)
- **UUID prefix** — shortest unambiguous prefix (e.g., `a1b2c3d4`), minimum 8 characters
- **Remote ID** — the identifier from the source platform (e.g., `PROJ-123`, `owner/repo#45`, `ENG-456`). Requires `--collection` to disambiguate across platforms.

The CLI resolves identifiers in the order above. If a remote ID matches multiple tasks across collections, the CLI returns an error requesting `--collection` to disambiguate.

### Pagination

List commands support cursor-based pagination:

| Flag | Default | Description |
|------|---------|-------------|
| `--limit` | 50 | Maximum items to return (max: 200) |
| `--cursor` | | Pagination cursor from a previous response |

JSON list responses include pagination metadata:

```json
{
  "items": [...],
  "next_cursor": "eyJpZCI6...",
  "has_more": true,
  "total_count": 142
}
```

### Stdin conventions

Flags that accept long-form text (`--description`, `--body`, `--acceptance-criteria`) support three input modes:

1. **Inline:** `--description "Fix the login bug by..."`
2. **File:** `--description @./description.md` (prefix with `@`)
3. **Stdin:** `--description -` (reads from stdin)

When the value is `-`, the CLI reads stdin until EOF. Only one flag may read from stdin per invocation.

---

## 4. Command Reference

### 4.1 `ft task` — Task operations

The primary command group. Operates on Normalized Task Objects (NTOs).

---

#### `ft task list`

List tasks with filtering and sorting.

**Flags:**

| Flag | Short | Description |
|------|-------|-------------|
| `--collection` | `-c` | Filter by collection (UUID or name). Required unless default is configured. |
| `--phase` | | Filter by phase: `OPEN`, `IN_PROGRESS`, `ON_HOLD`, `CLOSED` |
| `--stage` | | Filter by stage (e.g., `ready`, `working`, `blocked`). Repeatable for OR. |
| `--assignee` | `-a` | Filter by assignee. Use `me` for the authenticated agent. Use `none` for unassigned. |
| `--priority` | `-p` | Filter by priority: `URGENT`, `HIGH`, `NORMAL`, `LOW` |
| `--type` | `-t` | Filter by task type (e.g., `bug`, `story`, `epic`) |
| `--label` | `-l` | Filter by label. Repeatable for AND. |
| `--parent` | | Filter by parent task ID (direct children only) |
| `--sort` | | Sort field: `created`, `updated`, `priority`, `due_date` (default: `created`) |
| `--order` | | Sort order: `asc`, `desc` (default: `desc`) |
| `--full` | | Return complete NTO for each task (default is compact) |
| `--limit` | | Max results (default: 50, max: 200) |
| `--cursor` | | Pagination cursor |

**Compact vs. full output:** By default, `task list` returns a compact representation (id, name, phase, stage, priority, assignees, type, collection_id, remote_id, updated_at). Use `--full` for the complete NTO including description, relationships, code_context, custom_fields, and remote_data.

> **Note:** `task list --stage ready` returns tasks with stage `ready` but **does not check blocker resolution**. A task may have stage `ready` but still have unresolved BLOCKED_BY relationships. For dependency-aware ready-task queries, use `ft graph ready`, which verifies that all blocking dependencies are resolved (CLOSED phase) before including a task.

**Examples:**

```bash
# List open tasks assigned to me
ft task list --phase OPEN --assignee me

# List tasks ready for work in a collection
ft task list -c my-project --stage ready

# List urgent bugs across all collections
ft task list --priority URGENT --type bug

# List unassigned tasks ready for claiming
ft task list -c my-project --stage ready --assignee none

# Get only task IDs for piping
ft task list --stage ready -o quiet | head -1 | xargs ft task claim
```

**Example output (JSON, compact):**

```json
{
  "items": [
    {
      "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "name": "Fix authentication timeout on token refresh",
      "phase": "OPEN",
      "stage": "ready",
      "priority": "HIGH",
      "type": "bug",
      "assignees": [],
      "collection_id": "c0ffee00-1234-5678-9abc-def012345678",
      "remote_id": "PROJ-456",
      "remote_url": "https://mycompany.atlassian.net/browse/PROJ-456",
      "updated_at": "2026-05-02T14:30:00Z"
    },
    {
      "id": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
      "name": "Add retry logic to webhook delivery",
      "phase": "OPEN",
      "stage": "backlog",
      "priority": "NORMAL",
      "type": "story",
      "assignees": [
        {"id": "u001", "name": "agent-alpha", "type": "AGENT"}
      ],
      "collection_id": "c0ffee00-1234-5678-9abc-def012345678",
      "remote_id": "PROJ-789",
      "remote_url": "https://mycompany.atlassian.net/browse/PROJ-789",
      "updated_at": "2026-05-01T09:15:00Z"
    }
  ],
  "next_cursor": "eyJpZCI6ImIyYzNkNGU1In0=",
  "has_more": true,
  "total_count": 47
}
```

**Example output (table):**

```
ID         NAME                                      PHASE    STAGE    PRI    ASSIGNEE       REMOTE
a1b2c3d4   Fix authentication timeout on token ref…  OPEN     ready    HIGH   —              PROJ-456
b2c3d4e5   Add retry logic to webhook delivery       OPEN     backlog  NORMAL agent-alpha    PROJ-789

Showing 2 of 47 tasks. Use --cursor to page.
```

---

#### `ft task get <id>`

Get the full NTO for a single task.

**Arguments:**

| Argument | Description |
|----------|-------------|
| `id` | Task identifier (UUID, UUID prefix, or remote ID) |

**Flags:**

| Flag | Description |
|------|-------------|
| `--with-comments` | Include the comment thread (most recent 20) |
| `--with-changes` | Include the change audit trail (most recent 50) |

**Examples:**

```bash
# Get a task by UUID
ft task get a1b2c3d4-e5f6-7890-abcd-ef1234567890

# Get a task by remote ID (requires collection context)
ft task get PROJ-456 -c my-project

# Get a task with its comment thread
ft task get a1b2c3d4 --with-comments
```

**Example output (JSON):**

```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "name": "Fix authentication timeout on token refresh",
  "description": "The OAuth token refresh flow times out after 5s when the upstream IdP is slow.\n\n## Steps to reproduce\n1. Configure a slow IdP (>3s response)\n2. Wait for token expiry\n3. Observe 504 in logs",
  "acceptance_criteria": "- Token refresh succeeds with IdP response times up to 30s\n- Retry with exponential backoff on transient failures\n- Existing tests pass",
  "phase": "OPEN",
  "stage": "ready",
  "native_status": "Ready for Dev",
  "type": "bug",
  "priority": "HIGH",
  "assignees": [],
  "creator": {
    "id": "u100",
    "name": "jordan.lee",
    "type": "HUMAN"
  },
  "start_date": null,
  "due_date": "2026-05-10T00:00:00Z",
  "collection_id": "c0ffee00-1234-5678-9abc-def012345678",
  "parent_task_id": "e5f6a7b8-c9d0-1234-5678-9abcdef01234",
  "relationships": [
    {
      "type": "BLOCKED_BY",
      "target_task_id": "d4e5f6a7-b8c9-0123-4567-89abcdef0123"
    }
  ],
  "labels": ["auth", "timeout"],
  "custom_fields": [],
  "code_context": {
    "repo": "myorg/auth-service",
    "branch": "fix/token-refresh-timeout",
    "pull_requests": [],
    "ci_status": null,
    "commit_shas": []
  },
  "remote_id": "PROJ-456",
  "remote_url": "https://mycompany.atlassian.net/browse/PROJ-456",
  "remote_data": null,
  "platform": "jira",
  "created_at": "2026-04-28T10:00:00Z",
  "updated_at": "2026-05-02T14:30:00Z",
  "closed_at": null
}
```

---

#### `ft task create <name>`

Create a new task. Returns the created task.

**Arguments:**

| Argument | Description |
|----------|-------------|
| `name` | Task title / summary (required) |

**Flags:**

| Flag | Short | Description |
|------|-------|-------------|
| `--collection` | `-c` | Target collection (required unless default configured) |
| `--description` | `-d` | Task description (Markdown). Supports `@file` and `-` (stdin). |
| `--acceptance-criteria` | | Completion criteria (Markdown). Supports `@file` and `-`. |
| `--stage` | `-s` | Initial stage (default: `triage`) |
| `--priority` | `-p` | Priority: `URGENT`, `HIGH`, `NORMAL`, `LOW` |
| `--type` | `-t` | Task type: `bug`, `story`, `task`, `epic`, etc. |
| `--assignee` | `-a` | Assignee (user ID or `me`). Repeatable for multiple assignees. |
| `--label` | `-l` | Label to apply. Repeatable. |
| `--parent` | | Parent task ID for hierarchy |
| `--due-date` | | Due date (ISO 8601 or `YYYY-MM-DD`) |
| `--start-date` | | Start date (ISO 8601 or `YYYY-MM-DD`) |
| `--blocks` | | Task ID(s) this task blocks. Repeatable. |
| `--blocked-by` | | Task ID(s) blocking this task. Repeatable. |
| `--repo` | | code_context: repository identifier (e.g., `owner/repo`) |
| `--branch` | | code_context: target branch |
| `--reason` | | Audit trail reason for this creation |

**Examples:**

```bash
# Minimal creation
ft task create "Fix login timeout" -c my-project

# Full creation with code context
ft task create "Fix authentication timeout on token refresh" \
  -c my-project \
  -t bug \
  -p HIGH \
  -a me \
  --stage ready \
  --due-date 2026-05-10 \
  --repo myorg/auth-service \
  --branch fix/token-refresh-timeout \
  -d @./description.md \
  --acceptance-criteria "- Refresh succeeds up to 30s IdP latency\n- Retries on transient failure"

# Create and pipe description from another command
git log --oneline HEAD~5..HEAD | ft task create "Summarize recent changes" -c backlog -d -
```

**Example output (JSON):**

```json
{
  "id": "f7e8d9c0-b1a2-3456-7890-abcdef012345",
  "name": "Fix login timeout",
  "phase": "OPEN",
  "stage": "triage",
  "priority": null,
  "type": null,
  "assignees": [],
  "collection_id": "c0ffee00-1234-5678-9abc-def012345678",
  "platform": "farmtable",
  "created_at": "2026-05-03T16:00:00Z",
  "updated_at": null,
  "closed_at": null
}
```

**Example output (quiet):**

```
f7e8d9c0-b1a2-3456-7890-abcdef012345
```

---

#### `ft task update <id>`

Update one or more fields on a task. Returns the updated task.

**Arguments:**

| Argument | Description |
|----------|-------------|
| `id` | Task identifier |

**Flags:**

| Flag | Short | Description |
|------|-------|-------------|
| `--name` | | New task name |
| `--description` | `-d` | New description. Supports `@file` and `-`. |
| `--acceptance-criteria` | | New acceptance criteria. Supports `@file` and `-`. |
| `--stage` | `-s` | New stage (phase is inferred automatically) |
| `--priority` | `-p` | New priority |
| `--type` | `-t` | New task type |
| `--assignee` | `-a` | Set assignee(s). Repeatable. Use `none` to clear. |
| `--due-date` | | New due date. Use `none` to clear. |
| `--start-date` | | New start date. Use `none` to clear. |
| `--parent` | | New parent task ID. Use `none` to clear. |
| `--add-label` | | Add a label. Repeatable. |
| `--remove-label` | | Remove a label. Repeatable. |
| `--add-blocks` | | Add a BLOCKS relationship to a task ID. Repeatable. |
| `--add-blocked-by` | | Add a BLOCKED_BY relationship. Repeatable. |
| `--remove-relationship` | | Remove a relationship to a task ID. Repeatable. |
| `--repo` | | Update code_context repo |
| `--branch` | | Update code_context branch |
| `--add-pr-url` | | Add a PR to code_context: PR URL (must be paired with `--add-pr-status`) |
| `--add-pr-status` | | PR status: `open`, `merged`, `closed` (must be paired with `--add-pr-url`) |
| `--ci-status` | | Set CI status: `pending`, `running`, `passed`, `failed` |
| `--reason` | | Audit trail reason for this update |

**Stage transition behavior:** Setting `--stage` automatically resolves the correct phase. The stage-to-phase mapping is:

| Phase | Valid stages |
|-------|-------------|
| OPEN | `triage`, `backlog`, `ready` |
| IN_PROGRESS | `working`, `in_review`, `in_qa`, `deploying` |
| ON_HOLD | `blocked`, `waiting_for_input`, `deferred`, `scheduled` |
| CLOSED | `completed`, `wont_fix`, `duplicate`, `cancelled` |

Setting an invalid stage returns exit code 6 (validation error) with the valid options.

For external platform collections, the server maps the stage to the appropriate native status and executes any required platform-specific operations (e.g., Jira workflow transitions).

**Examples:**

```bash
# Start working on a task
ft task update a1b2c3d4 --stage working --reason "Starting implementation"

# Update priority and add labels
ft task update a1b2c3d4 -p URGENT --add-label hotfix --add-label auth

# Link a PR and update CI status
ft task update a1b2c3d4 \
  --add-pr-url "https://github.com/myorg/auth-service/pull/42" \
  --add-pr-status open \
  --ci-status running

# Mark as blocked with reason
ft task update a1b2c3d4 \
  --stage blocked \
  --add-blocked-by d4e5f6a7 \
  --reason "Waiting on d4e5f6a7 (API schema change) to merge"

# Clear assignee
ft task update a1b2c3d4 --assignee none
```

---

#### `ft task claim <id>`

Atomically claim a task: assigns it to the authenticated agent and transitions it to `working` (IN_PROGRESS) in a single transaction. If the task is already assigned or not in a claimable stage, the command fails.

This is the primary mechanism for agents to pick up work. On the built-in backend, this uses compare-and-swap for guaranteed atomicity. On external platforms, it uses read-check-write with advisory semantics.

**Arguments:**

| Argument | Description |
|----------|-------------|
| `id` | Task identifier |

**Flags:**

| Flag | Description |
|------|-------------|
| `--stage` | Override target stage (default: `working`) |
| `--reason` | Audit trail reason |

**Claimable stages:** `triage`, `backlog`, `ready` (any OPEN stage). The server rejects claims on tasks in other stages.

**Examples:**

```bash
# Claim a task
ft task claim a1b2c3d4

# Claim and set a specific stage
ft task claim a1b2c3d4 --stage in_review
```

**Example output (JSON):**

```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "name": "Fix authentication timeout on token refresh",
  "phase": "IN_PROGRESS",
  "stage": "working",
  "assignees": [
    {"id": "u200", "name": "agent-alpha", "type": "AGENT"}
  ],
  "claimed_at": "2026-05-03T16:05:00Z"
}
```

**Error (already claimed):**

```json
{
  "error": {
    "code": "CONFLICT",
    "message": "Task a1b2c3d4 is already assigned to agent-beta (stage: working)",
    "task_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "current_assignee": "agent-beta",
    "current_stage": "working",
    "request_id": "req_9d4e8f2a..."
  }
}
```

Exit code: 5 (conflict).

---

#### `ft task close <id>`

Convenience command to close a task. Sets stage to `completed` (CLOSED phase) by default.

**Arguments:**

| Argument | Description |
|----------|-------------|
| `id` | Task identifier |

**Flags:**

| Flag | Description |
|------|-------------|
| `--stage` | Close stage: `completed` (default), `wont_fix`, `duplicate`, `cancelled` |
| `--reason` | Audit trail reason |
| `--duplicate-of` | When `--stage duplicate`, the ID of the canonical task |

**Examples:**

```bash
# Mark a task complete
ft task close a1b2c3d4 --reason "PR #42 merged, tests passing"

# Close as won't fix
ft task close a1b2c3d4 --stage wont_fix --reason "Out of scope for v1"

# Close as duplicate
ft task close a1b2c3d4 --stage duplicate --duplicate-of b2c3d4e5
```

---

#### `ft task delete <id>`

Delete a task. Requires confirmation unless `--yes` is passed. Not available on all external platforms.

**Arguments:**

| Argument | Description |
|----------|-------------|
| `id` | Task identifier |

**Flags:**

| Flag | Description |
|------|-------------|
| `--yes` | Skip confirmation |
| `--reason` | Audit trail reason |

---

### 4.2 `ft comment` — Comment operations

Comments are the conversation thread on a task. Bodies are normalized to Markdown regardless of source platform.

---

#### `ft comment add <task-id> [body]`

Add a comment to a task.

**Arguments:**

| Argument | Description |
|----------|-------------|
| `task-id` | Task identifier |
| `body` | Comment body (Markdown). Optional if using `--body` flag or stdin. |

**Flags:**

| Flag | Description |
|------|-------------|
| `--body` | Comment body. Supports `@file` and `-` (stdin). |

If neither `body` argument nor `--body` flag is provided, the CLI reads from stdin.

**Examples:**

```bash
# Inline comment
ft comment add a1b2c3d4 "Starting work on this. Initial analysis suggests the timeout is in the HTTP client config."

# Multiline comment from stdin
ft comment add a1b2c3d4 --body - <<'EOF'
## Progress Update

- Identified root cause: hardcoded 5s timeout in `pkg/auth/client.go:47`
- Fix: make timeout configurable via `AUTH_TIMEOUT` env var
- PR draft pushed: https://github.com/myorg/auth-service/pull/42

### Remaining
- [ ] Add retry with exponential backoff
- [ ] Update integration tests
EOF

# Comment from file
ft comment add a1b2c3d4 --body @./update.md
```

**Example output (JSON):**

```json
{
  "id": "c0mm-ent1-d234-5678-9abcdef01234",
  "task_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "author": {
    "id": "u200",
    "name": "agent-alpha",
    "type": "AGENT"
  },
  "body": "Starting work on this. Initial analysis suggests the timeout is in the HTTP client config.",
  "created_at": "2026-05-03T16:10:00Z",
  "updated_at": null
}
```

---

#### `ft comment list <task-id>`

List comments on a task, ordered chronologically.

**Arguments:**

| Argument | Description |
|----------|-------------|
| `task-id` | Task identifier |

**Flags:**

| Flag | Description |
|------|-------------|
| `--limit` | Max comments to return (default: 50) |
| `--cursor` | Pagination cursor |
| `--order` | `asc` (default, oldest first) or `desc` |

**Example:**

```bash
ft comment list a1b2c3d4 --limit 10
```

---

#### `ft comment get <comment-id>`

Get a single comment by its ID.

---

### 4.3 `ft collection` — Collection operations

Collections represent a project, board, or repository. Each collection maps 1:1 to a single external platform integration (or the built-in backend).

---

#### `ft collection list`

List all collections accessible to the authenticated agent.

**Flags:**

| Flag | Description |
|------|-------------|
| `--platform` | Filter by platform: `farmtable`, `github`, `linear`, `jira`, `asana`, `beads` |

**Example output (JSON):**

```json
{
  "items": [
    {
      "id": "c0ffee00-1234-5678-9abc-def012345678",
      "name": "Auth Service",
      "platform": "jira",
      "remote_id": "PROJ",
      "task_count": 47,
      "created_at": "2026-04-01T00:00:00Z"
    },
    {
      "id": "deadbeef-0000-1111-2222-333344445555",
      "name": "myorg/frontend",
      "platform": "github",
      "remote_id": "myorg/frontend",
      "task_count": 123,
      "created_at": "2026-04-15T00:00:00Z"
    },
    {
      "id": "abcdef12-3456-7890-abcd-ef1234567890",
      "name": "Agent Workbench",
      "platform": "farmtable",
      "remote_id": null,
      "task_count": 8,
      "created_at": "2026-05-01T00:00:00Z"
    }
  ],
  "next_cursor": null,
  "has_more": false,
  "total_count": 3
}
```

---

#### `ft collection get <id>`

Get full details of a collection, including status mappings and custom field definitions.

**Arguments:**

| Argument | Description |
|----------|-------------|
| `id` | Collection identifier (UUID or name) |

**Example output (JSON):**

```json
{
  "id": "c0ffee00-1234-5678-9abc-def012345678",
  "name": "Auth Service",
  "description": "Authentication and authorization service tasks",
  "platform": "jira",
  "remote_id": "PROJ",
  "workspace_id": "mycompany",
  "linked_account_id": "la-0001-...",
  "status_mappings": [
    {"native_status": "To Do", "phase": "OPEN", "stage": "backlog"},
    {"native_status": "Ready for Dev", "phase": "OPEN", "stage": "ready"},
    {"native_status": "In Progress", "phase": "IN_PROGRESS", "stage": "working"},
    {"native_status": "In Review", "phase": "IN_PROGRESS", "stage": "in_review"},
    {"native_status": "Done", "phase": "CLOSED", "stage": "completed"}
  ],
  "custom_field_definitions": [
    {"field_id": "customfield_10026", "field_name": "Story Points", "field_type": "NUMBER", "required": false}
  ],
  "created_at": "2026-04-01T00:00:00Z",
  "updated_at": "2026-05-02T12:00:00Z"
}
```

---

#### `ft collection create <name>`

Create a new collection in the built-in backend. External platform collections are created through the admin/setup flow, not the CLI.

**Arguments:**

| Argument | Description |
|----------|-------------|
| `name` | Collection name |

**Flags:**

| Flag | Description |
|------|-------------|
| `--description` | Collection description |

**Example:**

```bash
ft collection create "Sprint 12 Tasks" --description "Work items for the May sprint"
```

---

### 4.4 `ft graph` — Graph query operations

Graph queries operate on task dependency relationships. Full graph analysis (critical path, bottleneck detection) is available only on the built-in backend. Basic dependency traversal works on all platforms.

---

#### `ft graph ready`

List tasks that are ready to work on: phase is OPEN, stage is `ready` (or configurable), and all blocking dependencies are resolved (CLOSED phase).

This is the primary "what should I work on next?" query for agents.

**Flags:**

| Flag | Description |
|------|-------------|
| `--collection` / `-c` | Scope to a collection |
| `--assignee` / `-a` | Filter by assignee. Use `me` or `none`. |
| `--priority` / `-p` | Minimum priority threshold (e.g., `--priority HIGH` returns URGENT and HIGH) |
| `--include-unblocked-open` | Also include `triage` and `backlog` tasks with no unresolved blockers |
| `--limit` | Max results |

**Examples:**

```bash
# What can I work on right now?
ft graph ready -c my-project --assignee me

# What's ready and unassigned?
ft graph ready -c my-project --assignee none

# High-priority ready tasks across all collections
ft graph ready --priority HIGH
```

**Example output (JSON):**

```json
{
  "items": [
    {
      "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "name": "Fix authentication timeout on token refresh",
      "phase": "OPEN",
      "stage": "ready",
      "priority": "HIGH",
      "assignees": [],
      "blockers_resolved": 1,
      "collection_id": "c0ffee00-..."
    }
  ],
  "total_count": 1
}
```

---

#### `ft graph blocked`

List tasks that are currently blocked (stage `blocked` or have unresolved BLOCKS relationships), along with what blocks them.

**Flags:**

| Flag | Description |
|------|-------------|
| `--collection` / `-c` | Scope to a collection |
| `--assignee` / `-a` | Filter by assignee |

**Example output (JSON):**

```json
{
  "items": [
    {
      "id": "x1y2z3...",
      "name": "Deploy auth service v2",
      "stage": "blocked",
      "blocked_by": [
        {
          "task_id": "a1b2c3d4...",
          "name": "Fix authentication timeout on token refresh",
          "phase": "IN_PROGRESS",
          "stage": "working"
        }
      ]
    }
  ]
}
```

---

#### `ft graph deps <task-id>`

Show the dependency tree for a task — what it blocks, what blocks it, and the transitive closure in both directions.

**Arguments:**

| Argument | Description |
|----------|-------------|
| `task-id` | Task identifier |

**Flags:**

| Flag | Description |
|------|-------------|
| `--direction` | `up` (what blocks this), `down` (what this blocks), `both` (default) |
| `--depth` | Maximum traversal depth (default: 5) |

**Example:**

```bash
ft graph deps a1b2c3d4 --direction down --depth 3
```

**Example output (JSON):**

```json
{
  "task": {
    "id": "a1b2c3d4...",
    "name": "Fix authentication timeout on token refresh",
    "phase": "IN_PROGRESS",
    "stage": "working"
  },
  "blocks": [
    {
      "task": {
        "id": "x1y2z3...",
        "name": "Deploy auth service v2",
        "phase": "OPEN",
        "stage": "blocked"
      },
      "blocks": [
        {
          "task": {
            "id": "p9q8r7...",
            "name": "Enable SSO for enterprise customers",
            "phase": "OPEN",
            "stage": "backlog"
          },
          "blocks": []
        }
      ]
    }
  ],
  "blocked_by": []
}
```

---

#### `ft graph critical-path`

*Built-in backend only.* Identify the longest chain of dependent tasks that determines overall completion time.

**Flags:**

| Flag | Description |
|------|-------------|
| `--collection` / `-c` | Scope to a collection (required) |
| `--root` | Start from a specific task (e.g., an epic) instead of the full graph |

**Example:**

```bash
ft graph critical-path -c my-project
```

**Example output (JSON):**

```json
{
  "path": [
    {"id": "t001...", "name": "Design API schema", "stage": "completed", "depth": 0},
    {"id": "t002...", "name": "Implement auth endpoints", "stage": "working", "depth": 1},
    {"id": "t003...", "name": "Write integration tests", "stage": "backlog", "depth": 2},
    {"id": "t004...", "name": "Deploy to staging", "stage": "backlog", "depth": 3}
  ],
  "total_depth": 4,
  "bottleneck": {
    "id": "t002...",
    "name": "Implement auth endpoints",
    "fan_out": 3,
    "reason": "Blocks 3 downstream tasks"
  }
}
```

---

#### `ft graph bottlenecks`

*Built-in backend only.* Find tasks with the highest fan-out of downstream dependents — the tasks whose completion would unblock the most other work.

**Flags:**

| Flag | Description |
|------|-------------|
| `--collection` / `-c` | Scope to a collection (required) |
| `--limit` | Max results (default: 10) |

**Example output (JSON):**

```json
{
  "items": [
    {
      "id": "t002...",
      "name": "Implement auth endpoints",
      "stage": "working",
      "downstream_count": 5,
      "direct_dependents": 3
    }
  ]
}
```

---

### 4.5 `ft change` — Audit trail

The Change entity records field-level diffs for every modification to a task. This is the agent-facing audit trail.

---

#### `ft change list <task-id>`

List changes (audit trail) for a task, ordered newest first.

**Arguments:**

| Argument | Description |
|----------|-------------|
| `task-id` | Task identifier |

**Flags:**

| Flag | Description |
|------|-------------|
| `--field` | Filter to changes on a specific field (e.g., `stage`, `assignees`, `priority`) |
| `--limit` | Max results (default: 50) |
| `--cursor` | Pagination cursor |

**Example:**

```bash
ft change list a1b2c3d4 --field stage
```

**Example output (JSON):**

```json
{
  "items": [
    {
      "id": "ch-001...",
      "task_id": "a1b2c3d4...",
      "field": "stage",
      "old_value": "ready",
      "new_value": "working",
      "changed_by": {
        "id": "u200",
        "name": "agent-alpha",
        "type": "AGENT"
      },
      "changed_at": "2026-05-03T16:05:00Z",
      "reason": "Starting implementation"
    },
    {
      "id": "ch-002...",
      "task_id": "a1b2c3d4...",
      "field": "stage",
      "old_value": "backlog",
      "new_value": "ready",
      "changed_by": {
        "id": "u100",
        "name": "jordan.lee",
        "type": "HUMAN"
      },
      "changed_at": "2026-05-02T14:30:00Z",
      "reason": null
    }
  ]
}
```

---

### 4.6 `ft user` — User and identity

---

#### `ft user whoami`

Show the currently authenticated user/agent identity.

**Example output (JSON):**

```json
{
  "id": "u200",
  "name": "agent-alpha",
  "email": null,
  "type": "AGENT",
  "status": "ACTIVE"
}
```

---

#### `ft user list`

List users visible to the authenticated agent.

**Flags:**

| Flag | Description |
|------|-------------|
| `--type` | Filter by type: `HUMAN`, `AGENT`, `SERVICE_ACCOUNT` |
| `--collection` / `-c` | Filter to users active in a collection |

---

#### `ft user get <id>`

Get a user by ID.

---

### 4.7 `ft status`

Check server reachability, connection health, and connected platform status. Useful for agents to validate their environment at startup ("can I reach Farm Table? are the integrations I need connected?").

```bash
ft status
```

**Example output (JSON):**

```json
{
  "server": "farmtable.example.com:9090",
  "server_version": "0.1.0",
  "api_protocol": "grpc",
  "status": "ok",
  "latency_ms": 12,
  "authenticated_as": {
    "id": "u200",
    "name": "agent-alpha",
    "type": "AGENT"
  },
  "platforms": [
    {"platform": "jira", "status": "connected", "collections": 2},
    {"platform": "github", "status": "connected", "collections": 1},
    {"platform": "farmtable", "status": "connected", "collections": 1}
  ]
}
```

**Flags:**

| Flag | Description |
|------|-------------|
| `--platform` | Check status of a specific platform only |

Exit code 8 (server unavailable) if the server cannot be reached. Exit code 3 (auth error) if the token is invalid or missing.

---

### 4.8 `ft version`

Print the CLI version, server version (if reachable), and API protocol version.

```bash
ft version
```

```json
{
  "cli_version": "0.2.0",
  "server_version": "0.1.0",
  "api_protocol": "grpc",
  "server": "farmtable.example.com:9090"
}
```

---

## 5. Output Format Design

### JSON output (default)

All JSON output follows these conventions:

- **Single-object responses** (get, create, update, claim, close): top-level JSON object representing the entity.
- **List responses**: envelope with `items`, `next_cursor`, `has_more`, `total_count`.
- **Error responses**: envelope with `error` object (see section 6).
- **Field naming**: `snake_case`, matching the NTO schema.
- **Null fields**: included in output (not omitted), so agents can rely on field presence.
- **Timestamps**: ISO 8601 with UTC timezone (`2026-05-03T16:00:00Z`).
- **UUIDs**: lowercase with hyphens (`a1b2c3d4-e5f6-7890-abcd-ef1234567890`).
- **Request ID**: every JSON response includes a `request_id` field in the response metadata. For single-object and list responses, it appears as a top-level `request_id` field. For error responses, it appears inside the `error` object. The request ID correlates the CLI invocation with server-side logs and is essential for debugging `PLATFORM_ERROR` and other server-mediated failures. Also visible in `--verbose` stderr output.

### JSONL output

For `--output jsonl`, list commands emit one JSON object per line with no envelope. Useful for streaming processing:

```
{"id":"a1b2c3d4...","name":"Fix auth timeout","phase":"OPEN","stage":"ready"}
{"id":"b2c3d4e5...","name":"Add retry logic","phase":"OPEN","stage":"backlog"}
```

### Table output

For `--output table`, the CLI renders aligned columns with truncated values. Headers are included. Not intended for parsing — use JSON or JSONL for programmatic access.

### Quiet output

For `--output quiet`, the CLI emits only entity IDs (one per line). Designed for piping:

```bash
# Claim the first ready task
ft task list --stage ready -o quiet | head -1 | xargs ft task claim

# Close all tasks labeled "cleanup"
ft task list --label cleanup -o quiet | xargs -I{} ft task close {} --stage wont_fix
```

### Stdout vs. stderr

- **stdout**: structured output (the entity data, JSON, table rows, IDs).
- **stderr**: progress messages, warnings, verbose logs, and human-readable error context.

Agents should parse stdout only. Stderr is informational.

---

## 6. Error Handling & Exit Codes

### Exit codes

| Code | Name | Description |
|------|------|-------------|
| 0 | Success | Operation completed successfully |
| 1 | General error | Unclassified error |
| 2 | Usage error | Invalid arguments, missing required flags, malformed input |
| 3 | Auth error | Missing, expired, or invalid `FARMTABLE_TOKEN` |
| 4 | Not found | The referenced task, collection, or user does not exist |
| 5 | Conflict | Atomic operation failed (e.g., claim race, concurrent update) |
| 6 | Validation error | Invalid field value (e.g., bad stage, invalid date format, type mismatch) |
| 7 | Permission denied | Token is valid but lacks permission for this operation |
| 8 | Server unavailable | Cannot reach the Farm Table server |
| 9 | Platform error | The external platform returned an error (e.g., Jira transition rejected). Details in error body. |

### Error output format

Errors are written to stdout as JSON (to maintain parseable output) with details on stderr for human context:

**stdout:**

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid stage 'doing'. Valid stages for phase OPEN: triage, backlog, ready",
    "field": "stage",
    "value": "doing",
    "valid_values": ["triage", "backlog", "ready", "working", "in_review", "in_qa", "deploying", "blocked", "waiting_for_input", "deferred", "scheduled", "completed", "wont_fix", "duplicate", "cancelled"],
    "request_id": "req_7f3a2b1c..."
  }
}
```

**stderr:**

```
Error: Invalid stage 'doing'. Did you mean 'deploying'?
Valid stages: triage, backlog, ready, working, in_review, in_qa, deploying, blocked, waiting_for_input, deferred, scheduled, completed, wont_fix, duplicate, cancelled
```

### Error codes (in JSON)

| Code string | Exit code | Description |
|-------------|-----------|-------------|
| `USAGE_ERROR` | 2 | Bad arguments |
| `AUTH_REQUIRED` | 3 | No token provided |
| `AUTH_INVALID` | 3 | Token rejected |
| `AUTH_EXPIRED` | 3 | Token expired |
| `NOT_FOUND` | 4 | Entity not found |
| `CONFLICT` | 5 | Atomic operation conflict |
| `ALREADY_CLAIMED` | 5 | Task already assigned (specific to claim) |
| `VALIDATION_ERROR` | 6 | Field validation failure |
| `INVALID_TRANSITION` | 6 | Stage transition not allowed (e.g., Jira workflow constraint) |
| `PERMISSION_DENIED` | 7 | Insufficient permissions |
| `SERVER_UNAVAILABLE` | 8 | Cannot connect to server |
| `PLATFORM_ERROR` | 9 | External platform error |
| `PLATFORM_RATE_LIMITED` | 9 | External platform rate limit hit |
| `INTERNAL_ERROR` | 1 | Unexpected server error |

---

## 7. Agent Workflow Patterns

This section describes common end-to-end workflows that coding agents will execute using the CLI. These patterns inform the command design and validate that the CLI surface covers real agent needs.

### 7.1 Pick up and complete a task

The most common agent workflow: find work, claim it, do it, close it.

```bash
# 1. What's ready for me?
ft graph ready -c my-project --assignee none --priority HIGH

# 2. Read the task details
ft task get a1b2c3d4

# 3. Claim it (atomic assign + transition to working)
ft task claim a1b2c3d4

# 4. Post a progress update
ft comment add a1b2c3d4 "Starting work. Root cause identified in pkg/auth/client.go:47."

# 5. Link the PR
ft task update a1b2c3d4 \
  --add-pr-url "https://github.com/myorg/auth-service/pull/42" \
  --add-pr-status open \
  --branch fix/token-refresh-timeout

# 6. Move to review
ft task update a1b2c3d4 --stage in_review --reason "PR #42 ready for review"

# 7. CI passes, PR merged — close the task
ft task update a1b2c3d4 \
  --add-pr-url "https://github.com/myorg/auth-service/pull/42" \
  --add-pr-status merged \
  --ci-status passed
ft task close a1b2c3d4 --reason "PR #42 merged. All acceptance criteria met."
```

### 7.2 Manager agent assigns work to worker agents

An orchestrator agent distributes tasks across a pool of worker agents.

```bash
# 1. Get all ready, unassigned tasks
TASKS=$(ft graph ready -c my-project --assignee none)

# 2. Get available agents
AGENTS=$(ft user list --type AGENT)

# 3. Assign task to a specific agent
ft task update a1b2c3d4 --assignee agent-beta --stage ready

# Worker agent (agent-beta) then claims it:
ft task claim a1b2c3d4
```

### 7.3 Agent encounters a blocker

When an agent discovers it cannot proceed.

```bash
# 1. Mark as blocked and explain why
ft task update a1b2c3d4 \
  --stage blocked \
  --add-blocked-by d4e5f6a7 \
  --reason "Requires schema migration in d4e5f6a7 before this can proceed"

# 2. Comment with details for humans
ft comment add a1b2c3d4 "Blocked: the token_refresh table needs a new column (migration in PROJ-789). Cannot proceed until that migration is merged and applied to staging."
```

### 7.4 Agent releases a task it can't finish

When an agent can't complete a task and needs to return it to the pool. (A dedicated `ft task release` command is planned for v1.1; for v1, use `update`.)

```bash
# 1. Explain why in a comment
ft comment add a1b2c3d4 "Releasing task: the fix requires changes to the billing service which is outside my access scope. Leaving branch fix/token-refresh-timeout with partial progress."

# 2. Unassign and reset stage to ready
ft task update a1b2c3d4 --assignee none --stage ready --reason "Releasing: requires billing service access"
```

### 7.5 Create subtasks for a larger piece of work

An agent breaks down an epic or story into actionable subtasks.

```bash
# 1. Read the parent task
ft task get epic-123

# 2. Create subtasks
ft task create "Design API schema for token refresh" \
  -c my-project --parent epic-123 --stage ready -p HIGH

ft task create "Implement token refresh endpoint" \
  -c my-project --parent epic-123 --stage backlog -p HIGH \
  --blocked-by $(ft task list --parent epic-123 --stage ready -o quiet | head -1)

ft task create "Write integration tests for token refresh" \
  -c my-project --parent epic-123 --stage backlog -p NORMAL
```

### 7.6 Agent reviews its own work history

An agent checks what it has done recently, for context or reporting.

```bash
# Tasks I've worked on
ft task list --assignee me --phase CLOSED --sort updated --limit 10

# Audit trail for a specific task
ft change list a1b2c3d4
```

### 7.7 Cross-collection discovery

An agent working across multiple repositories or projects.

```bash
# All my tasks across all collections
ft task list --assignee me --phase OPEN

# All ready tasks across all collections
ft graph ready --assignee none

# Check which collections are available
ft collection list
```

---

## 8. Command Quick Reference

```
ft task list         List tasks with filters
ft task get          Get full task details
ft task create       Create a new task
ft task update       Update task fields and status
ft task claim        Atomically claim and start a task
ft task close        Close a task
ft task delete       Delete a task

ft comment add       Add a comment to a task
ft comment list      List comments on a task
ft comment get       Get a single comment

ft collection list   List collections
ft collection get    Get collection details
ft collection create Create a built-in backend collection

ft graph ready       List tasks ready to work on (dependencies resolved)
ft graph blocked     List blocked tasks with blocker details
ft graph deps        Show dependency tree for a task
ft graph critical-path  Identify the critical path (built-in backend only)
ft graph bottlenecks    Find high-fan-out blocking tasks (built-in backend only)

ft change list       List audit trail for a task

ft user whoami       Show authenticated identity
ft user list         List users
ft user get          Get user details

ft config show       Show resolved configuration
ft config set        Set a configuration value
ft config path       Print config file path

ft status            Check server and platform connection health
ft version           Show version information
```

---

## 9. Environment Variables

| Variable | Description |
|----------|-------------|
| `FARMTABLE_TOKEN` | API token for authentication (primary auth method) |
| `FARMTABLE_SERVER` | Server address (`host:port`) |
| `FARMTABLE_OUTPUT` | Default output format (`json`, `table`, `quiet`, `jsonl`) |
| `FARMTABLE_COLLECTION` | Default collection ID (same as `default_collection` in config) |
| `FARMTABLE_CONFIG` | Path to config file (overrides default `~/.config/farmtable/config.toml`) |
| `FARMTABLE_INSECURE` | Set to `1` to disable TLS (development only) |
| `NO_COLOR` | Standard — disables color in table output when set |

Priority order for all settings: flag > environment variable > config file > built-in default.

---

## 10. Design Decisions & Rationale

### Why `ft` (short binary name)?
Agents type (or generate) commands hundreds of times per session. Short names reduce token overhead and typo risk. `farmtable` is available as an alias for human use and scripts that prefer explicitness.

### Why JSON as the default output format?
The primary users are coding agents. Agents parse JSON natively. Making JSON the default eliminates a flag from the vast majority of invocations. Humans who prefer table output set `FARMTABLE_OUTPUT=table` once.

### Why stage-driven status updates (not phase)?
The three-tier status model has a deterministic stage-to-phase mapping. Agents should think in terms of what the task is doing (stage: `working`, `in_review`, `blocked`) not what lifecycle bucket it is in (phase: `IN_PROGRESS`). The CLI resolves the phase automatically, reducing cognitive load and preventing invalid phase/stage combinations.

### Why `ft task claim` as a dedicated command?
Atomic claim is the most important coordination primitive for multi-agent systems. Making it a first-class command (rather than a two-step `update --assignee me && update --stage working`) ensures atomicity, provides clear error semantics for race conditions, and makes the operation self-documenting.

### Why `ft graph` as a separate command group?
Graph queries are semantically different from CRUD operations — they traverse relationships, not individual entities. Separating them also makes it clear which operations require the built-in backend for full functionality.

### Why cursor-based pagination (not offset)?
Offset pagination is fragile when the underlying data changes between pages (tasks created, deleted, or reordered). Cursor-based pagination provides stable iteration. This aligns with the gRPC service's pagination model and with most external platform APIs (GitHub GraphQL, Linear, Asana).

### Why `--reason` on mutating commands?
The Change audit trail is a core Farm Table principle ("auditable by construction"). Making `--reason` available on every mutating command means agents can explain *why* they made a change, not just *what* they changed. This is especially valuable when humans review agent work history.

### Why separate `--add-pr-url` and `--add-pr-status` (not a combined flag)?
The original design used `--add-pr "url,status"` with comma-delimited positional values. This is fragile — URLs can contain commas, and positional semantics in a single string are error-prone for agents. Two explicit flags are unambiguous, self-documenting, and map cleanly to the proto request message fields.

### Why `ft status` as a standalone command?
Agents need to validate their environment at startup: is the server reachable, is the token valid, are the platform integrations they need connected? Without this, an agent that starts with a misconfigured environment won't know until its first real operation fails. `ft status` provides a single pre-flight check that covers server, auth, and platform health.

---

## 11. Future Considerations

These items are out of scope for v1 but inform the CLI design to avoid painting ourselves into a corner.

- **`ft task release <id>`**: Dedicated inverse of `ft task claim` — atomically unassigns a task and returns it to `ready` stage. Could enforce business logic such as auto-commenting release reasons or policy-based stage reset. For v1, agents use `ft task update --assignee none --stage ready` (see workflow pattern 7.4). Planned for v1.1.
- **`--fields` projection flag**: Fine-grained field selection on `task list` and `task get` (e.g., `--fields id,name,stage`). Deferred because the compact vs. full distinction and `--output quiet` already cover the common cases. Adds complexity to both the proto definition and the agent's mental model. Revisit if agents report needing intermediate projections between compact and full.
- **Collection-scoped configuration**: Support for per-directory or per-repo defaults via a `.farmtable.toml` file in the repo root, similar to git's local/global config hierarchy. Useful for agents working across multiple collections. The current single `default_collection` config is sufficient for v1, but the config resolution design should not preclude hierarchical overrides.
- **`ft watch <task-id>`**: Stream real-time changes to a task (maps to gRPC server streaming). Useful for agents that need to react to status changes from humans.
- **`ft task batch`**: Bulk create/update tasks from a JSONL file. Useful for agents decomposing large plans.
- **`ft collection sync`**: Trigger a manual re-sync from an external platform (admin operation).
- **`ft event list`**: Query webhook/virtual-webhook events (for debugging and observability).
- **`ft linked-account list/create`**: Manage platform credentials (admin operation, likely restricted to human users).
- **Shell completions**: Generate bash/zsh/fish completions via `ft completion <shell>`.
- **Agent skill wrappers**: Claude Code skill, Cursor skill, etc. that provide framework-specific ergonomics on top of the CLI. These translate natural-language task descriptions into `ft` commands with appropriate flags.
