# Farm Table Architecture

Farm Table is a Go task-tracking system used by agents and developers.

## Core Stack

- Go application and CLI.
- Ent ORM for persistence.
- SQLite for embedded local mode.
- Postgres for server mode and integration coverage.
- gRPC server API.
- gRPC-Web plus Lit for the web dashboard.
- MCP adapter for agent tool access.
- Platform adapters for integrations such as GitHub and Beads.

## Source of Truth

`proto/farmtable.proto` is the source of truth for the data model. Ent schemas
and generated code should stay aligned with proto changes.

## Development Flow

1. Modify Go, proto, or Ent source.
2. Run generation when schemas or generated assets require it.
3. Run `go test ./...`.
4. Rebuild `/workspace/.farmtable/bin/ft` when testing through the dog-food CLI.
