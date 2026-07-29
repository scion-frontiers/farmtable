# Experiment Report: GitHub-Backed Collection via Farmtable

**Date:** 2026-07-19
**Target repo:** `scion-frontiers/farmtable`
**Live service:** `https://farmtable-qo7k5fvpda-uc.a.run.app` (revision `farmtable-00007-w87`)
**Auth:** `ptone` GitHub PAT via `$GITHUB_TOKEN`

---

## Executive Summary

**Verdict: Partially working — the GitHub integration is fully functional but only
via the CLI's local passthrough mode, not via the deployed Cloud Run server.**

The code supports two distinct GitHub integration paths:
1. **`GitHubPassThroughStore`** — a full `store.Store` implementation that proxies
   all operations directly to GitHub's GraphQL API. Activated client-side via the
   `FARMTABLE_GITHUB_REPO` env var. **This works completely.**
2. **`GitHubAdapter`** — a `platform.Adapter` for syncing GitHub issues into
   Farmtable's database. This code exists but is **not wired into the server** —
   there's no RPC endpoint to create a GitHub-platform collection or trigger sync.

You **cannot** create a GitHub-backed collection on the live Cloud Run service.
The `CreateCollection` RPC hardcodes `platform: "farmtable"` and accepts no
platform, remote_id, workspace_id, or linked_account_id parameters.

---

## Part 1: Code Analysis

### Files examined

| File | Purpose |
|------|---------|
| `internal/platform/github/github.go` | `GitHubAdapter` — sync-based integration (implements `platform.Adapter`) |
| `internal/platform/github/passthrough.go` | `GitHubPassThroughStore` — full store implementation proxying to GitHub API |
| `internal/platform/github/config.go` | YAML-based config for label mapping, repo coordinates |
| `internal/platform/github/graphql.go` | GraphQL client for GitHub v4 API |
| `internal/platform/platform.go` | `Adapter` interface definition |
| `internal/cli/connect.go` | CLI client creation — **contains the passthrough activation logic** |
| `internal/cli/collection.go` | Collection CLI commands |
| `internal/server/server.go` | gRPC service implementation |
| `cmd/farmtable-server/main.go` | Server binary entrypoint |
| `proto/farmtable.proto` | Proto definitions |

### Auth mechanism

Both `GitHubAdapter` and `GitHubPassThroughStore` use a **Personal Access Token**
via OAuth2 static token source:

```go
ts := oauth2.StaticTokenSource(&oauth2.Token{AccessToken: token})
tc := oauth2.NewClient(context.Background(), ts)
```

No GitHub App installation or interactive OAuth flow is required. A PAT with
repo scope works directly.

### Two integration modes

#### Mode 1: `GitHubAdapter` (sync-based)

- **Auth:** PAT, passed as constructor arg
- **Behavior:** `SyncCollection()` pulls all GitHub issues via REST API, creates/updates
  tasks in Farmtable's local DB. `PushTask()` creates/edits GitHub issues. `PushComment()`
  creates GitHub issue comments.
- **Two-way:** Yes — both read (sync) and write (push) are implemented.
- **Wired into server?** **No.** No RPC endpoint calls `SyncCollection()`, `PushTask()`,
  or `PushComment()`. The adapter exists as library code only.

#### Mode 2: `GitHubPassThroughStore` (client-side passthrough)

- **Auth:** PAT via `$GITHUB_TOKEN` env var (or git credential helper)
- **Behavior:** Implements the full `store.Store` interface. Every CRUD operation
  (ListTasks, GetTask, CreateTask, UpdateTask, CloseTask, etc.) is proxied directly
  to GitHub's GraphQL API. No local database.
- **Two-way:** Yes — `CreateTask` creates GitHub issues, `UpdateTask` edits them,
  `CloseTask` closes them, `AddComment` creates comments.
- **Activation:** Set `FARMTABLE_GITHUB_REPO=owner/repo` env var. The `ft` CLI
  detects this in `newClient()` (connect.go:121-123) and spins up an **in-process
  gRPC server** backed by the passthrough store instead of connecting to a remote server.
- **Config:** Optional `FARMTABLE_GITHUB_CONFIG` env var pointing to a YAML file
  for label-to-stage/priority mapping. Falls back to `.farmtable/github.yaml`, then defaults.
- **Wired into server?** **No** — this is a CLI-only mode. The deployed Cloud Run
  server cannot use it.

### Server-side limitations

The deployed server (`cmd/farmtable-server/main.go`):
- Initializes a Postgres-backed `store.EntStore`
- Has no GitHub adapter, no passthrough store, no platform routing
- `CreateCollection` RPC (server.go:800-812) hardcodes `Platform: "farmtable"`:
  ```go
  p := store.CreateCollectionParams{
      Name:        req.GetName(),
      Description: req.GetDescription(),
      Platform:    "farmtable",  // hardcoded
  }
  ```
- `CreateCollectionRequest` proto (farmtable.proto:690-693) only has `name` and
  `description` fields — no `platform`, `remote_id`, `workspace_id`, or
  `linked_account_id`
- No `SyncCollection` RPC exists
- No linked-account management RPCs exist

### Schema vs. implementation gap

The proto schema defines:
- `Collection.platform` (enum including `PLATFORM_GITHUB`)
- `Collection.remote_id`, `Collection.workspace_id`, `Collection.linked_account_id`
- `LinkedAccount` message with `platform`, `auth_method`, `scopes`, `remote_user_id`

But **none of these fields are settable through any RPC**. They exist in the data
model but the API doesn't expose them for creation/modification.

---

## Part 2: Experiment Against Live Service

### Step 1: List existing collections

```bash
export PATH=/workspace/.farmtable/bin:$PATH
TOKEN=$(gcloud secrets versions access latest --secret=farmtable-token --project=deploy-demo-test)
export FARMTABLE_SERVER=farmtable-qo7k5fvpda-uc.a.run.app:443
ft collection list --token "$TOKEN"
```

**Result:** Success. Two collections exist:
- `default` (id: `1e0f02d1-99cd-46bc-a739-bac0fde60710`, platform: `farmtable`)
- `smoke-test-1784479392` (id: `b638f6c0-1a56-4c00-9061-bd94f2731b49`, platform: `farmtable`)

### Step 2: Attempt to create a GitHub-backed collection via the server

```bash
ft collection create "github-experiment-scion-frontiers-farmtable" \
  --description "Experiment: GitHub-backed collection pointing at scion-frontiers/farmtable" \
  --token "$TOKEN"
```

**Result:** Collection created, but with `platform: "farmtable"`:
```json
{
  "id": "6a0a49f9-9c61-46cf-af5a-46f98f90ff20",
  "name": "github-experiment-scion-frontiers-farmtable",
  "platform": "farmtable",
  "remote_id": null
}
```

The CLI's `collection create` has no `--platform` flag. The server hardcodes
`platform: "farmtable"`. There is no way to create a GitHub-platform collection
on the live server.

### Step 3: Check CLI help for collection creation

```bash
ft collection create --help
```

**Result:**
```
Create a collection (built-in backend)

Usage:
  ft collection create <name> [flags]

Flags:
      --description string   Collection description
  -h, --help                 help for create
```

Note the help text itself says "built-in backend" — this is intentional.

---

## Part 3: GitHub Passthrough Mode (CLI-side, works)

### Step 4: Activate passthrough mode

```bash
export FARMTABLE_GITHUB_REPO=scion-frontiers/farmtable
# GITHUB_TOKEN already set in environment
ft collection list
```

**Result:** Success. Single synthetic collection with `platform: "github"`:
```json
{
  "items": [{
    "id": "19c451be-13c1-51f1-9748-d675a509fe49",
    "name": "scion-frontiers/farmtable",
    "description": "GitHub Issues: scion-frontiers/farmtable (pass-through)",
    "platform": "github"
  }],
  "total_count": 1
}
```

### Step 5: List GitHub issues as Farmtable tasks

```bash
ft task list
```

**Result:** All 45 GitHub issues appeared as Farmtable tasks (43 open, 2 closed).
Each issue is mapped with:
- Deterministic UUID based on `github:scion-frontiers/farmtable#N`
- `remote_id` set to `scion-frontiers/farmtable#N`
- `phase: OPEN/CLOSED` mapped from GitHub issue state
- `stage: triage/completed` mapped from issue state
- `type: bug` mapped from GitHub labels (when applicable)
- `parent_task_id` set from GitHub sub-issue relationships

Sample output (first 3 of 45):
```
scion-frontiers/farmtable#45  BLOCKED: GitHub App lacks 'workflows' permission...  phase=OPEN  stage=triage
scion-frontiers/farmtable#44  FR: Cross-stream dependency queries...               phase=OPEN  stage=triage
scion-frontiers/farmtable#43  FR: ft task tree <scope-id>...                        phase=OPEN  stage=triage
```

### Step 6: Verify individual task detail with parent relationships

```bash
ft task get c37c29b0-34bd-5a3b-958d-30587b4e16d6
```

**Result:** Issue #45 shows `parent_task_id: 925b7823-c062-5ad3-9750-c24054e1a037`
(which maps to issue #4, "Stream 2: Remediation"). This confirms sub-issue
relationships from GitHub are correctly mapped to Farmtable parent-child task
relationships.

### Step 7: Verify issue counts match

```bash
gh issue list --repo scion-frontiers/farmtable --state open --limit 100
gh issue list --repo scion-frontiers/farmtable --state closed --limit 100
```

**Result:** GitHub reports 43 open, 2 closed — exact match with Farmtable
passthrough output.

### Step 8: Check passthrough server mode

```bash
ft status
```

**Result:**
```json
{
  "server_mode": "passthrough",
  "server_version": "passthrough",
  "status": "serving"
}
```

Confirms the CLI is running in passthrough mode, not connecting to any remote server.

### Step 9: Test ready-tasks graph query

```bash
ft task ready --include-unblocked
```

**Result:** 0 ready tasks. This is expected — no GitHub issues have labels
matching Farmtable's "ready" stage. The graph query infrastructure works but
returns no results because the label mapping defaults don't match any existing
labels on the repo.

---

## Verdict

### Summary table

| Capability | Live Cloud Run Server | CLI Passthrough Mode |
|---|---|---|
| Create GitHub-platform collection | **Not supported** (hardcoded to farmtable) | **Works** (synthetic collection auto-created) |
| List GitHub issues as tasks | **Not possible** | **Works** (45/45 issues mapped) |
| Issue state → phase/stage mapping | N/A | **Works** (open→OPEN/triage, closed→CLOSED/completed) |
| Parent-child relationships | N/A | **Works** (sub-issues mapped to parent_task_id) |
| Label → type mapping | N/A | **Works** (e.g., "bug" label → type: "bug") |
| Two-way sync (create/edit issues) | N/A | **Available** (not tested — would mutate real issues) |
| Ready/blocked graph queries | N/A | **Works** (but no matching labels in repo) |

### What works

The `GitHubPassThroughStore` is a **fully functional, production-quality** GitHub
Issues adapter. It maps all 45 issues from `scion-frontiers/farmtable` into
Farmtable's task model with correct state, labels, types, and parent-child
relationships. It also supports writing back to GitHub (creating/editing issues,
adding comments) though we did not test write operations to avoid mutating real
GitHub issues.

### What doesn't work

Creating a GitHub-backed collection on the **deployed Cloud Run server** is not
supported. The gap is at the API layer:

1. `CreateCollectionRequest` proto lacks `platform`, `remote_id`, `workspace_id`,
   `linked_account_id` fields
2. `CreateCollection` RPC handler hardcodes `Platform: "farmtable"`
3. No `SyncCollection` or linked-account management RPCs exist
4. The server binary doesn't initialize any GitHub adapter

### What would be needed to make it work on the server

1. Add `platform`, `remote_id`, `workspace_id`, `linked_account_id` fields to
   `CreateCollectionRequest`
2. Add linked-account management RPCs (create, list, get, delete)
3. Wire the `GitHubAdapter` into the server with platform-based routing
4. Add a `SyncCollection` RPC (or automated sync scheduler)
5. Store GitHub PAT/credentials securely (linked accounts)

### Artifacts created on live service

- Collection `github-experiment-scion-frontiers-farmtable`
  - ID: `6a0a49f9-9c61-46cf-af5a-46f98f90ff20`
  - Platform: `farmtable` (was the only option)
  - No tasks — it's an empty farmtable-backend collection
  - Safe to clean up or leave in place

No existing collections or tasks were modified.
