# Farm Table — Project Instructions

## Farm Table CLI (dog-fooding)

This project uses Farm Table (`ft`) to manage its own development tasks. The binary is pre-built at `/workspace/.farmtable/bin/ft`.

**Setup** — add these to your environment:
```
export PATH=/workspace/.farmtable/bin:$PATH
export FARMTABLE_DB_PATH=/workspace/.farmtable/farmtable.db
```

**Usage** — run `ft --help` to discover commands. Key operations:
```
ft task list                          # list tasks
ft task create "title"                # create a task
ft task get <id>                      # view task details
ft task update <id> --stage working   # update status
ft task claim <id>                    # claim a task for yourself
ft task close <id>                    # mark complete
```

**Identity** — when creating or claiming tasks, pass your Scion agent identity:
```
ft task claim <id> --assignee $(scion whoami --format json 2>/dev/null | jq -r '.id // "unknown"')
```

**Labels** — use labels to categorize work: `feature`, `bug`, `refactor`, `review`, `design`, `test`, `infra`, `docs`.

**Rebuild** — if the Farm Table source code changes, rebuild manually:
```
go build -o /workspace/.farmtable/bin/ft ./cmd/ft
```

## Development

- **Language:** Go
- **ORM:** Ent (entgo.io) on SQLite (embedded) / Postgres (server mode)
- **Proto:** `proto/farmtable.proto` is the source of truth for the data model
- **Build:** `go build ./...`
- **Test:** `go test ./...`
- **Generate Ent:** `go generate ./internal/store/ent`
- **Design docs:** `.design/` directory
