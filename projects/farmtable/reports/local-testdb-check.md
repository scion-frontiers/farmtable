# Report: Was a Local Test Database Ported Over in the Scratchpad?

**Investigator:** farmtable-inv-local-testdb
**Date:** 2026-07-19
**Verdict: YES — a local test SQLite database was ported over and is usable as-is.**

---

## Summary

The `farmtable-scratchpad.zip` extraction included a fully seeded SQLite test
database at `web-test/farmtable.db`. It is a valid Farm Table embedded-mode
database with the correct schema (all 7 Ent-managed tables), 7 test tasks across
multiple lifecycle stages, and a pre-existing API token. It matches the schema of
the repo's current dev database at `/workspace/.farmtable/farmtable.db` and can
be used immediately for local development by setting `FARMTABLE_DB_PATH` to point
at it.

---

## What Was Searched

| Location | Method | Result |
|---|---|---|
| `/scion-volumes/scratchpad` (full tree) | `find` for `*.db`, `*.sqlite`, `*.sqlite3`, `*.sql`, `*.dump`, `*.pgdump`, `*testdb*`, `*seed*`, `*fixtures*`, `*local-db*`, `*dev-data*` | **1 hit:** `web-test/farmtable.db` |
| `/workspace/shared-dirs/scratchpad` (full tree) | Same search | **1 hit:** `web-test/farmtable.db` (identical copy, same md5) |
| `/workspace/farmtable` (the repo) | Checked `README.md`, `agents.md`, `Makefile`, Dockerfiles, Ent schema dir | No bundled test DB in the repo itself; local dev uses `FARMTABLE_DB_PATH` pointing to `~/.farmtable/farmtable.db` or `/workspace/.farmtable/farmtable.db` |

No Postgres dumps, docker-compose files for local Postgres, seed-data JSON, or
fixtures directories were found anywhere in either scratchpad location.

---

## What Was Found

### File: `/scion-volumes/scratchpad/web-test/farmtable.db`

| Property | Value |
|---|---|
| **Path (primary)** | `/scion-volumes/scratchpad/web-test/farmtable.db` |
| **Path (duplicate)** | `/workspace/shared-dirs/scratchpad/web-test/farmtable.db` |
| **Size** | 116 KB (118,784 bytes) |
| **Format** | SQLite 3 (confirmed via `strings` header: `"SQLite format 3"`) |
| **MD5** | `64b8ba3d43b40088dc7f7988f6cb10b2` (both copies identical) |
| **Created** | 2026-05-12 22:37 – 22:38 UTC (based on row timestamps inside the DB) |

### Schema (7 tables)

Extracted via `strings … | grep "CREATE TABLE"`:

1. **`users`** — id, email, display_name, type, status, platform_id, timestamps
2. **`api_tokens`** — id, token_hash, name, timestamps, user_id FK
3. **`collections`** — id, name, description, platform, timestamps
4. **`tasks`** — id, title, description, phase, stage, native_label, type, priority, assignee_id, dates, acceptance_criteria, remote_data (JSON), labels (JSON), repo, branch, ci_status, pull_requests (JSON), version, collection_id FK, parent_task_id FK
5. **`relationships`** — id, type, source_task_id FK, target_task_id FK
6. **`comments`** — id, author_id, body, timestamps, task_id FK
7. **`changes`** — id, author_id, field_name, old_value, new_value, created_at, task_id FK

This matches **exactly** the Ent schema files in the repo (`/workspace/farmtable/internal/store/schema/`: `apitoken.go`, `change.go`, `collection.go`, `comment.go`, `helpers.go`, `relationship.go`, `task.go`, `user.go`) and the table set in the current dev DB at `/workspace/.farmtable/farmtable.db`.

### Data Content

- **1 collection:** "default" (platform: farmtable)
- **1 user + 1 API token:** user `9fc96177-...`, token hash `a59013b0...`, name "local-embedded"
- **7 test tasks** spanning stages: ready, working, blocked, backlog, in_qa; with labels like `feature`, `bug`, `design`, `docs`; 2 tasks have parent-child relationships (subtasks of task 1)

### Context: Purpose of This DB

The `QA-PLAYBOOK.md` file in the same `web-test/` directory explicitly documents
this DB as the **pre-seeded test database for QA testing the web dashboard**:

> - **Database**: `/scion-volumes/scratchpad/web-test/farmtable.db` — SQLite with seeded test data

The `web-test/` directory also contains a pre-built `ft` binary (45 MB), Vite
build output (`web-dist/`), Playwright screenshot scripts, and a QA playbook
describing how to launch the dashboard against this DB with:

```bash
export FARMTABLE_DB_PATH=/scion-volumes/scratchpad/web-test/farmtable.db
ft dashboard --port 9090
```

---

## Comparison to the Repo's Expected Local-Dev Setup

The repo's `README.md` and `agents.md` describe local development as:

1. **Embedded mode (default):** SQLite at `~/.farmtable/farmtable.db` (or `FARMTABLE_DB_PATH`)
2. **Client-server mode:** Postgres (via `FARMTABLE_SERVER` env var or `--server` flag)
3. No docker-compose, no seed scripts, no fixture files exist in the repo

The scratchpad DB is a **direct match for embedded mode**. To use it, a developer
only needs to set `FARMTABLE_DB_PATH=/scion-volumes/scratchpad/web-test/farmtable.db`
and run `ft` commands or `ft dashboard` as usual.

The current active dev DB (`/workspace/.farmtable/farmtable.db`, 124 KB, last
modified 2026-07-19) has the same 7-table schema, so the scratchpad DB is
schema-compatible with the current codebase.

---

## Verdict

**YES** — a local test database was ported over with the scratchpad.

It is **immediately usable** for local farmtable development in embedded mode.
The schema matches the current codebase, it contains realistic test data across
multiple task lifecycle stages, and the QA playbook documents exactly how to use
it. The only caveat noted in the playbook is that the API token in this DB may
not match the token in `~/.config/farmtable/config.toml`, which would cause
"invalid token" errors — but that's a standard config-sync issue, not a
database-format problem.

---

## Open Questions

None — the investigation is conclusive.
