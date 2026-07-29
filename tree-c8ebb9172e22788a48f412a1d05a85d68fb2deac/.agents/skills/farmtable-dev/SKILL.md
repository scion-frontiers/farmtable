---
name: farmtable-dev
description: >
  Development workflow for working on Farm Table itself. Use when setting up the
  dev environment, running tests, building or rebuilding ft, hitting auth or
  token errors, modifying Go source, changing Ent schemas, or working on the
  farmtable codebase.
allowed-tools: "Bash(go:*),Bash(ft:*)"
compatible-with: [claude-code]
tags: [farmtable, development, go, tests, build]
---

# Farm Table Development

Use this skill when changing the Farm Table source code or diagnosing local
developer environment issues.

## Quick Setup

```bash
export PATH=/workspace/.farmtable/bin:$PATH
export FARMTABLE_DB_PATH=/workspace/.farmtable/farmtable.db
```

See [setup.md](commands/setup.md) for token setup and common auth recovery.

## Common Commands

```bash
go test ./...
go build ./...
go build -o /workspace/.farmtable/bin/ft ./cmd/ft
go generate ./internal/store/ent
```

## Command Guides

| Command | Purpose |
|---------|---------|
| [setup](commands/setup.md) | Environment setup and token config |
| [build](commands/build.md) | Build and rebuild the `ft` binary |
| [test](commands/test.md) | Unit and integration test workflow |

## Resources

- [gotchas.md](resources/gotchas.md) - known local issues and fixes.
- [architecture.md](resources/architecture.md) - brief architecture map.
