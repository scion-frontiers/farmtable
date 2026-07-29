# Farm Table Development Gotchas

## Stale Token Issue

Most common symptom: every `ft` command fails with `invalid token` after a new
agent session starts.

Cause: `~/.config/farmtable/config.toml` has a token from a previous session,
but the embedded SQLite DB was initialized by a different session.

Fix the DB token hash to match the config token:

```bash
python3 -c "
import sqlite3, hashlib, re
cfg = open('/home/scion/.config/farmtable/config.toml').read()
token = re.search(r'token = \"(.+?)\"', cfg).group(1)
token_hash = hashlib.sha256(token.encode()).hexdigest()
conn = sqlite3.connect('/workspace/.farmtable/farmtable.db')
c = conn.cursor()
c.execute('UPDATE api_tokens SET token_hash = ? WHERE name = ?', (token_hash, 'local-embedded'))
conn.commit()
print('Fixed. Rows updated:', c.rowcount)
"
```

## Build After Source Changes

The dog-food CLI is prebuilt at `/workspace/.farmtable/bin/ft`. After modifying
Go source, rebuild it manually:

```bash
go build -o /workspace/.farmtable/bin/ft ./cmd/ft
```

## Integration Tests Need Postgres

Unit tests run without Postgres:

```bash
go test ./...
```

Integration tests require a live Postgres instance:

```bash
go test ./... -tags integration
```

## Ent Schema Generation

If you modify Ent schemas, regenerate before building or testing:

```bash
go generate ./internal/store/ent
```
