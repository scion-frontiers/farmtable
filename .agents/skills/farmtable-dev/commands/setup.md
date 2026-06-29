---
description: Set up the Farm Table development environment
argument-hint: [--fix-token]
---

Set up a local Farm Table dev shell:

```bash
export PATH=/workspace/.farmtable/bin:$PATH
export FARMTABLE_DB_PATH=/workspace/.farmtable/farmtable.db
```

The embedded SQLite DB lives at `/workspace/.farmtable/farmtable.db`. The local
token is stored in `~/.config/farmtable/config.toml` on first embedded run.

If `ft` reports `invalid token`, read [gotchas.md](../resources/gotchas.md) and
apply the stale token fix for the embedded DB.

Useful smoke checks:

```bash
ft --help
ft task list
```
