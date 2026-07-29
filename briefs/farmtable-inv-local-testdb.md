# Brief: Investigator — Did the Scratchpad Port Over a Local Test Database?

## Critical constraints (read first)
- Read-only research task. Do not modify or delete anything, do not start any database
  process that could conflict with anything else running.
- Do not disturb `/workspace/farmtable`'s shared checkout — reading files/configs there is
  fine.

## Context
Early in this project, a `farmtable-scratchpad.zip` was extracted into
`/scion-volumes/scratchpad` (13 docs + a `web-test/` artifacts folder — see
`.coordinator-state.md` in the workspace root for that history) and a duplicate copy also
ended up at `/workspace/shared-dirs/scratchpad`. ptone@google.com wants to know whether that
port-over included a **local-only test database** — something intended to let a developer
run farmtable locally (e.g. a SQLite file, a Postgres dump/`.sql` file, seed-data JSON, a
docker-compose for local Postgres, or similar) — and if so, whether it's usable as-is.

## Task
1. Search `/scion-volumes/scratchpad` (all of it, not just the `farmtable/` project
   subfolder) and `/workspace/shared-dirs/scratchpad` for anything that looks like a
   database file or dump: extensions like `.db`, `.sqlite`, `.sqlite3`, `.sql`, `.dump`,
   `.pgdump`, or files/directories named things like `testdb`, `seed`, `fixtures`,
   `local-db`, `dev-data`.
2. Also check `/workspace/farmtable` itself (the repo) for any local-dev database tooling
   already documented — `agents.md`, `README.md`, `Makefile`, `docker-compose*.yml`, or a
   `farmtable-dev` skill — to understand what "using farmtable locally" is supposed to look
   like normally (e.g. does it expect a running Postgres via docker-compose, or an
   embedded/SQLite mode?), so you can assess whether anything found in the scratchpad
   actually matches that expected shape.
3. If you find candidate file(s): note exact path, size, format, and — if it's something
   you can safely inspect without running a full server (e.g. `sqlite3 file.db .tables`,
   or `head`/`file` on a `.sql` dump) — a summary of what's in it (table names, rough row
   counts if cheap to get). Do NOT attempt to load/restore it into any live database as
   part of this investigation.
4. Give a clear verdict: was a local test database ported over? If yes, is it immediately
   usable for local farmtable development, or missing something (e.g. present but stale,
   or present but the repo's dev tooling expects a different setup)? If no, say so plainly.

## Deliverables
Write findings to:
`/scion-volumes/scratchpad/projects/farmtable/reports/local-testdb-check.md`

Must contain: what was searched, what (if anything) was found (paths, sizes, format,
content summary), how it compares to what the repo's own local-dev tooling expects, and an
explicit yes/no/partial verdict with a one-line reason.

## Direct contact
- Message the coordinator (`scion message coordinator "..."`) when done, or if blocked.
- Do not message ptone@google.com directly.

## Termination
You MUST produce the report at the path above and then mark the task complete.
