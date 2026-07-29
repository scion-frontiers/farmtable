---
description: Run Farm Table tests
argument-hint: [--integration]
---

Run the unit test suite:

```bash
go test ./...
```

Run integration tests only when a live Postgres instance is available:

```bash
go test ./... -tags integration
```

For source changes, run tests before rebuilding the dog-food binary. For Ent
schema changes, run generation first:

```bash
go generate ./internal/store/ent
go test ./...
```
