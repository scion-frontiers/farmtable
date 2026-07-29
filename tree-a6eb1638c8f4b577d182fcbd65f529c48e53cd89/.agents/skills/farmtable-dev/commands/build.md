---
description: Build Farm Table and rebuild the ft binary
argument-hint: [--install]
---

Build all Go packages:

```bash
go build ./...
```

If source changes need to be exercised through the dog-food CLI, rebuild the
prebuilt binary:

```bash
go build -o /workspace/.farmtable/bin/ft ./cmd/ft
```

If Ent schemas changed, regenerate before building:

```bash
go generate ./internal/store/ent
go build ./...
```
