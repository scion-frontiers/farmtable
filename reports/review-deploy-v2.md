# Review: PR #168 rework — commit `4dc8d2a` (`fix(deploy): address runbook H1/H2/H3 review findings`)

**Branch:** `auth-stage4-deploy-prep`
**Delta reviewed:** `.design/project-log/auth-stage4-deploy-rollout.md` (+26/−9), `internal/cli/token.go` (+3)
**Reviewer:** code-reviewer
**Date:** 2026-07-27

---

## Review Summary

**Verdict:** REQUEST CHANGES (docs only — the Go change is clean and approved)

**Overview:** All three findings (H1, H2, H3) are genuinely addressed, and I verified each one
empirically by building `ft` and executing the runbook against a scratch SQLite DB. The 3-line Go
change is correct, idiomatic, and mirrors the existing pattern in `newTokenCreateCmd` exactly. The
blocking problem is that the H3 fix is **scoped too narrowly**: it warns that `ft token update` is
SQLite-only, but `ft token list`, `ft user create`, `ft token create`, and `ft token revoke` all call
the same `openDirectStore()`. Steps 1, 3, and 4 of the runbook therefore still fail *silently* against
a Postgres deployment — which is the exact hazard class H3 was raised to eliminate.

**Risk level:** Low for the code; Medium-High for the runbook as an operator-facing artifact.

---

## Verification Performed

I did not take the commit message at its word. Evidence gathered:

| Check | Method | Result |
|---|---|---|
| Build | `go build ./...` | PASS |
| Format | `gofmt -l internal/cli/token.go` | clean |
| Vet | `go vet ./internal/cli/...` | clean, exit 0 |
| Tests | `go test ./internal/cli/...` | `ok` |
| H1 old form | `ft user create --type reviewer --name "task-reviewer"` | `unknown flag: --name`, exit 1 — old runbook was indeed broken |
| H1 new form | `ft user create "task-reviewer" --type reviewer --email …` | created, `"type": "reviewer"` |
| H2 inventory | `ft token list -o json \| jq '.items[] \| {id,name,user_name,scopes}'` | emits `scopes` array |
| H3 failure mode | `FARMTABLE_DB_PATH='postgres://user:pass@db.example.com:5432/…' ft token update …` | created dir tree `postgres:/user:pass@db.example.com:5432/farmtable`, then `TOKEN_NOT_FOUND` — **exactly** as documented |
| Storage format | `select scopes from api_tokens` | `["task:read","task:write",…]` — matches the runbook's SQL literal byte-for-byte |
| Schema names | `internal/store/ent/migrate/schema.go:25,19` | table `api_tokens`, column `scopes` (`TypeJSON`, `Nullable`) — SQL in runbook is valid |
| Reviewer defaults | `server.DefaultScopesForUserType("reviewer")` (`internal/server/scopes.go:129`) | matches the six scopes the runbook claims |
| Token caching | `internal/server/token_lookup.go` | no cache/TTL — direct SQL takes effect immediately, no restart caveat needed |

---

## Critical Issues

### C1 — `.design/project-log/auth-stage4-deploy-rollout.md:70-91` — "SQLite Only" warning covers only 1 of the 5 commands the runbook uses

The new section states:

> The `ft token update` command uses `openDirectStore()` which hardcodes the `sqlite3` driver.

That is true but incomplete, and the singular framing actively implies the other commands are
server-aware. Every token/user command in the runbook opens the local SQLite store:

```
internal/cli/user.go:38    newUserCreateCmd   -> openDirectStore()
internal/cli/token.go:124  newTokenCreateCmd  -> openDirectStore()
internal/cli/token.go:223  newTokenListCmd    -> openDirectStore()
internal/cli/token.go:351  newTokenUpdateCmd  -> openDirectStore()
internal/cli/token.go:423  newTokenRevokeCmd  -> openDirectStore()
```

None of them consult `globals.server` / `FARMTABLE_SERVER`. Reproduced against a "production"
deployment (server env set, no local DB):

```console
$ FARMTABLE_SERVER=prod.example.com:443 FARMTABLE_DB_PATH=/tmp/rbtest2/ft.db ft token list -o json
{ "total_count": 0, "items": null }          # step 1: silent empty inventory

$ ft user create "task-reviewer" --type reviewer
{ "id": "58869a2e-…", "type": "reviewer" }   # step 3: phantom user in a throwaway SQLite file
```

Operator impact, following the runbook verbatim against Postgres:
- **Step 1** reports zero tokens → operator concludes "no migration needed" and skips the rollout.
- **Step 3** mints a reviewer user + token that production has never heard of; the printed UUID and
  raw token are useless, but nothing signals failure.
- **Step 4** verification returns nothing and is indistinguishable from "not yet applied".

This is strictly worse than the pre-fix state for steps 1/3/4, because H3's warning now gives the
operator false confidence that the *rest* of the document is deployment-agnostic.

**Suggested fix** — hoist the limitation to the top of the Pre-Deploy Checklist and generalise it:

```markdown
## ⚠️ Before You Start: This Runbook Is SQLite-Only

Every `ft user` / `ft token` command below (`create`, `list`, `update`, `revoke`) opens the local
embedded SQLite database via `openDirectStore()`. **None of them talk to a farmtable server**, and
they ignore `--server` / `FARMTABLE_SERVER`.

Against a PostgreSQL/server deployment they fail *silently*, not loudly:
- `ft token list` returns `{"total_count": 0, "items": null}` — looks like "nothing to migrate".
- `ft user create` / `ft token create` succeed against a throwaway local SQLite file and print a
  UUID and raw token that do not exist in production.

For PostgreSQL deployments, use the direct SQL procedure in "PostgreSQL Deployments" below for
**all** steps, not just scope updates.
```

Then retitle the existing tail section from "Known Limitation: SQLite Only" to "PostgreSQL
Deployments", keep the `FARMTABLE_DB_PATH` warning (it is accurate and well-written), and add the
SELECT/INSERT equivalents for the inventory and user/token-creation steps — or explicitly state that
user and token *creation* on Postgres must go through the server's RPC/dashboard and is out of scope
for this runbook.

---

## Important Issues

### I1 — `auth-stage4-deploy-rollout.md:82-89` — direct-SQL path bypasses the `mergeScopes` guard rails, including the empty-set → wildcard footgun

`mergeScopes` (`internal/cli/token.go:36-89`) exists precisely to stop three silent-escalation
scenarios, and PR #167 added `errEmptyScopes` for the most dangerous one. Confirmed at
`internal/server/scopes.go:82-85`:

```go
// nil/empty scopes = wildcard (backward compatible with existing tokens)
if len(scopes) == 0 {
    return nil          // <- full access
}
```

The new SQL block hands operators a path with none of those rails:
- `SET scopes = '[]'` (or `NULL`) silently converts the token to **full admin access**. The CLI
  refuses this with `EMPTY_SCOPES`.
- Scope strings are not run through `server.ValidateScopes`, so `'["task:cl0se"]'` is accepted and
  the token silently loses the capability at runtime.
- The `SELECT` shown does not tell the operator what `NULL` means (legacy wildcard — the CLI's
  `UNSCOPED_TOKEN` case, which requires explicit full-set intent).

**Suggested fix:**

````markdown
```sql
-- Verify current scopes first.
-- NULL or [] means LEGACY WILDCARD (full access), not "no access".
SELECT id, name, scopes FROM api_tokens WHERE id = '<token-id>';

-- Update scopes (JSON array format, exactly as ent encodes it).
UPDATE api_tokens SET scopes = '["task:read","task:write","task:claim","task:close","collection:read"]'
WHERE id = '<token-id>';

-- Confirm exactly one row changed and the value round-trips.
SELECT id, name, scopes FROM api_tokens WHERE id = '<token-id>';
```

**This path bypasses the `ft token update` guard rails. In particular:**
- **NEVER** write `'[]'` or `NULL` — an empty scope set is interpreted as **wildcard (full access)**
  by `RequireScope`. Use `ft token revoke` semantics (delete the row) to disable a token instead.
- Scope strings are **not validated** by SQL. A typo (`task:cl0se`) is stored happily and the
  capability is silently denied at runtime. Valid scopes are listed in `internal/server/scopes.go`.
- Changes take effect immediately — `StoreTokenLookup` does not cache, so no server restart is
  required.
````

### I2 — `auth-stage4-deploy-rollout.md:38-46` — step 3 walks the operator straight into the unrecognised-user-type → wildcard escalation

The runbook instructs `--type reviewer`, but `ft user create --type` has no validation and its own
help string advertises only `human, agent, service_account` (`internal/cli/user.go:76`). If an
operator types `reviewr`, `Reviewer`, or omits `--type` on a copy-paste, `DefaultScopesForUserType`
falls through to the default branch and returns `nil` — which means **wildcard**, i.e. the token
intended to be the *least*-privileged lifecycle actor is minted with full admin access. Verified:

```console
$ ft user create "legacy" --type weirdtype --output quiet   # then token create
$ ft token list -o json | jq '.items[] | {name, scopes}'
{ "name": "legacy-token", "scopes": null }                  # null == wildcard
```

The only signal today is a `log.Printf` warning on the *server* side, which an operator running the
CLI never sees. H2 has now made this detectable from the CLI — the runbook should use it.

**Suggested fix** — add a mandatory assertion to step 3:

````markdown
```bash
ft user create "task-reviewer" --type reviewer --email reviewer@example.com

# MUST verify: an unrecognised --type (e.g. a "reviewr" typo) silently mints a
# WILDCARD token instead of a scoped reviewer token.
ft token create <reviewer-user-id> --name "lifecycle-reviewer" | jq .scopes
# Expected exactly:
# ["task:read","task:write","task:claim","task:accept","task:close","collection:read"]
# If this prints null or is absent, the user type was not recognised — delete the
# token and the user, and re-create with the exact string "reviewer".
```
````

### I3 — `auth-stage4-deploy-rollout.md:22-26` — inventory step never explains that `scopes: null` means full access

This is the loose end of the H2 fix. With the new field, a legacy token renders as:

```json
{ "id": "…", "name": "legacy-token", "user_name": "legacy", "scopes": null }
```

`null` here is the single highest-priority row in a token audit — it is an unbounded-privilege
token — yet the runbook presents the output with no interpretation key. (The Go side is correct;
`if len(t.Scopes) > 0` omits the key and `jq` renders the absent key as `null`. The gap is purely
documentation.) The "Current State" section explains nil-scoped legacy tokens, but that is 40 lines
below the step where the operator needs it.

**Suggested fix:**

````markdown
```bash
# List all tokens and identify agent-typed ones
ft token list --output json | jq '.items[] | {id, name, user_name, scopes}'
```

Reading the output:
- `scopes: [...]` — explicitly scoped; migrate with `--add-scope` / `--remove-scope`.
- `scopes: null` — **legacy wildcard: this token currently has FULL ACCESS.** It will keep working
  after deploy (`RequireScope` treats nil as wildcard) but must be migrated with `--set-scopes`;
  `--add-scope` is refused with `UNSCOPED_TOKEN`.
- `["*"]` — explicit wildcard; `--remove-scope` is refused with `WILDCARD_TOKEN`.

```bash
# Triage the dangerous ones first
ft token list --output json | jq '.items[] | select(.scopes == null) | {id, name, user_name}'
```
````

### I4 — `auth-stage4-deploy-rollout.md:22-26` — "List **all** tokens" silently truncates at 200

`newTokenListCmd` hardcodes `Limit: 200` (`internal/cli/token.go:229-231`) and exposes no
`--limit`/`--cursor` flag. On a production instance with more than 200 tokens the inventory silently
omits the tail, and the runbook's phrasing ("List all tokens") guarantees the operator will not
suspect it. The `total_count` field in the envelope is the only tell.

I am flagging this as a runbook defect rather than a code defect, since `Limit: 200` predates this
branch and adding pagination is out of scope here.

**Suggested fix** — add to step 1:

```bash
# ft token list caps at 200 rows and has no pagination flag. Confirm you saw everything:
ft token list --output json | jq '{returned: (.items | length), total: .total_count}'
# If returned < total, the inventory is INCOMPLETE — query the DB directly:
#   SELECT id, name, user_id, scopes FROM api_tokens ORDER BY created_at;
```

---

## Suggestions

### S1 — `internal/cli/token.go:289-291` — `collection_ids` is the other half of the audit and is still missing from `ft token list`

The H2 change correctly follows `newTokenCreateCmd`'s pattern, but `token create` emits *both*
`scopes` and `collection_ids` (`internal/cli/token.go:191-201`), while `token list` now emits only
`scopes`. For a pre-deploy access audit, "which collections can this token touch"
(`RequireCollectionAccess`, `internal/server/scopes.go:100-119`) is as material as "which verbs".
Same three-line shape, no new dependencies:

```go
if len(t.Scopes) > 0 {
    m["scopes"] = t.Scopes
}
if len(t.CollectionIds) > 0 {
    ids := make([]string, len(t.CollectionIds))
    for i, id := range t.CollectionIds {
        ids[i] = id.String()
    }
    m["collection_ids"] = ids
}
```

Non-blocking — reasonable to defer, but if deferred it should be an explicit follow-up rather than
an oversight.

### S2 — `internal/cli/token.go:242` — `table` output not updated alongside `json`

The `ID/NAME/USER/CREATED/LAST_USED/EXPIRES` header gained no `SCOPES` column, so the two output
modes now disagree on what a token *is*. Low priority (the runbook drives `--output json`
throughout), but worth a `SCOPES` column or a deliberate note that `--output json` is required for
scope inspection.

### S3 — No test covers the new JSON field

`internal/cli/token_test.go` only exercises `mergeScopes`; there is no output-capture harness for any
CLI command in this package, so the omission is consistent with existing conventions and I am not
treating it as blocking. I did verify the behaviour end-to-end manually (see Verification table). If
a harness is added later, `token list` JSON shape is a good first candidate given a deploy runbook now
depends on it contractually.

### S4 (out of delta, informational) — `auth-stage4-deploy-rollout.md:42`

The unchanged `ft token create <reviewer-user-id> --name "lifecycle-reviewer"` line prints the raw
bearer token to stdout (I captured `ft_074c310c…` in my test run). Since you are already editing this
section for I2, it would be cheap to add "capture with `--output quiet` and store in your secret
manager; the raw token lands in terminal scrollback and CI logs otherwise." Not a finding against
this commit.

---

## What's Done Well

- **The Go change is exemplary for its size.** `if len(t.Scopes) > 0 { m["scopes"] = t.Scopes }` is a
  byte-for-byte match of the guard/key/assignment pattern already used in `newTokenCreateCmd`
  (`token.go:191-193`), keeps `nil` distinguishable from `[]`, adds no allocation on the hot path,
  introduces no dependency, and correctly continues to withhold `token_hash`. It is the minimal
  correct diff, and it is exactly what H2 needed — nothing more.
- **H3's warning is empirically accurate, not speculative.** I reproduced the described failure
  precisely: pointing `FARMTABLE_DB_PATH` at a Postgres DSN creates the directory tree
  `postgres:/user:pass@db.example.com:5432/farmtable` and then reports `TOKEN_NOT_FOUND`. Documenting
  a real observed failure mode — including the misleading error the operator will actually see — is
  far more useful than a generic "not supported" note. (Bonus hazard the fix implicitly avoids: that
  path embeds the DB password in a filesystem directory name.)
- **The SQL fallback is technically correct where it counts.** Table `api_tokens`, column `scopes`
  (`TypeJSON`, nullable), and the JSON array literal all match ent's actual encoding, which I
  confirmed by dumping the DB. The author clearly checked the generated migration schema rather than
  guessing at names.
- **The documented reviewer scope set matches `DefaultScopesForUserType("reviewer")` exactly**, all
  six scopes in order — verified against `internal/server/scopes.go:129-139` and against live CLI
  output.
- **H1 was a real bug, correctly diagnosed.** The old `--name` form genuinely exits 1 with
  `unknown flag: --name`; the new positional form works. Good catch on the original review, clean fix.
- Guard rails from PR #167 (`UNSCOPED_TOKEN`, `WILDCARD_TOKEN`, `EMPTY_SCOPES`) behave exactly as the
  runbook's step 2 Option A/Option B branching assumes — I exercised both paths and the error codes
  and exit status (6) line up with the documented flow.

---

## Verification Story

- **Tests reviewed:** Yes. `internal/cli/token_test.go` covers `mergeScopes` only; the new JSON field
  has no automated coverage, but the package has no CLI-output harness, so this matches existing
  convention (see S3). Behaviour verified manually instead.
- **Build verified:** Yes — `go build ./...` clean; `ft` binary built and exercised.
- **Lint/static analysis clean:** Yes — `gofmt -l` clean, `go vet ./internal/cli/...` exit 0.
- **Tests pass:** Yes — `go test ./internal/cli/...` → `ok`.
- **Security checked:** Yes. The Go change exposes no secrets (`token_hash` still withheld; scopes are
  not sensitive). Two security-relevant gaps remain in the *documentation*: the SQL path bypasses the
  empty-scopes → wildcard guard rail (I1), and step 3 can silently mint a wildcard token on a
  user-type typo (I2).
- **Runbook executed end-to-end:** Yes, against a scratch SQLite DB — steps 1, 2 (both options), 3,
  and 4 all behave as written. Against a simulated Postgres/server deployment, steps 1, 3, and 4 fail
  silently (C1).

---

## Final Verdict

**REQUEST CHANGES — docs only, one more pass.**

The Go delta is approved as-is; no changes requested to `internal/cli/token.go`. H1, H2, and H3 are
each correctly fixed for the SQLite path. The rework should not merge as a deploy runbook until **C1**
is addressed — generalise the SQLite-only warning to cover every `ft user`/`ft token` command and move
it above the checklist — since an operator on Postgres currently gets a silently empty inventory and a
phantom reviewer token with no error. I1–I4 are small, self-contained doc edits that I would fold into
the same pass; suggested replacement text is provided inline for each.

Estimated effort: ~30 minutes of documentation editing. No code rework required.

---

# Addendum (post-review follow-up, 2026-07-27)

Added at the coordinator's request while C1 was being relayed to the EM. Three additional facts that
sharpen the diagnosis and **change the shape of the remedy**.

## A1 — There is no server-mode path to build. The RPCs do not exist.

The service surface exposes only *read* RPCs for identity (`proto/farmtable.proto:1094-1096`):

```
rpc WhoAmI(WhoAmIRequest) returns (User);
rpc ListUsers(ListUsersRequest) returns (ListUsersResponse);
rpc GetUser(GetUserRequest) returns (User);
```

There is **no** `CreateUser`, and **no token RPCs whatsoever** — no `CreateAPIToken`,
`ListAPITokens`, `UpdateTokenScopes`, or `RevokeAPIToken`.

This matters for the fix direction: the remedy for C1 **cannot** be "wire the CLI up to the server."
Every token mutation and user creation is missing from the API entirely. The runbook's closing line —
"A server-mode RPC for token scope updates is tracked as a follow-up" — understates it: the follow-up
is a whole missing management surface, not one RPC.

**Consequence:** direct SQL is genuinely the only option for Postgres today, so the SQL section should
stay. That makes **I1 (the guard-rail warnings on the SQL path) more important, not less** — it is the
only path operators have, so it must carry the safety semantics the CLI enforces.

## A2 — `ft user` is split-brain: reads hit production, writes hit local SQLite.

Within the same command group, subcommands disagree about what database they are talking to:

| Command | Backend | Server-aware? |
|---|---|---|
| `ft user create` | `openDirectStore()` → local SQLite | **No** |
| `ft user get` / `list` / `whoami` | `newClient()` → gRPC | **Yes** |
| `ft token create` / `list` / `update` / `revoke` | `openDirectStore()` → local SQLite | **No** |

Concretely, on a Postgres deployment an operator runs step 3, gets a UUID back, then verifies with
`ft user list` — and the user **is not there**, because the write went to SQLite and the read went to
prod. `ft user get <that-uuid>` returns `NOT_FOUND` from production. The operator now has two mutually
contradictory outputs from the same CLI and no explanation.

This is a stronger argument for C1 than the "silent failure" framing in the main report: the toolchain
does not merely fail quietly, it actively contradicts itself.

## A3 — Root cause: `openDirectStore()` ignores server config unconditionally.

`newClient()` (`internal/cli/connect.go:120-135`) branches correctly — real gRPC if
`FARMTABLE_SERVER`/`--server` is set, embedded SQLite otherwise. `openDirectStore()`
(`connect.go:258-273`) has **no such branch**; it goes straight to SQLite every time.

In a dev environment with no server configured, both paths land on the same embedded SQLite file, so
everything is consistent and the runbook tests clean — which is exactly why this was authored and
verified successfully, and why the defect was invisible. It only diverges in server mode.

**Recommended fix (raises C1 from a doc fix to a can't-get-it-wrong fix):** make `openDirectStore()`
refuse to run when the operator has pointed the CLI at a server. Roughly five lines:

```go
func openDirectStore() (*store.EntStore, func(), error) {
	if srv := resolveServer(""); srv != "" {
		return nil, nil, fmt.Errorf(
			"this command operates only on the local SQLite database, but a server is configured (%s). "+
				"Token and user management have no server-mode RPC; for a PostgreSQL deployment see "+
				"the direct-SQL procedure in the auth-stage4 deploy runbook. "+
				"Unset FARMTABLE_SERVER to operate on the local database intentionally", srv)
	}
	dbPath := resolveDBPath()
	...
}
```

This converts every silent-wrong-result in C1 into a loud, self-explaining error at the point of use,
and it protects operators who never read the runbook. It also subsumes the H3 `FARMTABLE_DB_PATH`
hazard for the common case.

**Caveat for the EM:** this is a behaviour change on five commands and is **outside the delta of this
PR** — I am not asking for it in #168. Sequencing suggestion: ship the generalized C1 doc warning plus
I1–I4 in this PR to unblock, and file the `openDirectStore()` guard plus the missing token/user
management RPCs as separate tracked work. Verify the guard does not break `ensureLocalUser` or any
test/CI path that sets `FARMTABLE_SERVER` while expecting embedded behaviour.

## Verdict unchanged

REQUEST CHANGES on #168, docs only. The Go change in `internal/cli/token.go` remains approved as-is.

---

# Addendum 2 — Re-review of the reworked runbook (2026-07-27)

The runbook was reworked in response to C1/I1–I4 while this review was open. **C1, I1, I3, and I4 are
correctly fixed.** However the C1 remedy introduced a **new blocking factual error**. Re-reviewed
against the current file.

## Fixed — confirmed good

- **C1 (structural half):** the SQLite-only warning is now hoisted above the checklist, generalised to
  all `ft user`/`ft token` commands, and states that `--server`/`FARMTABLE_SERVER` are ignored.
  Checklist retitled "(SQLite / Embedded Deployments)". Exactly the right shape.
- **I1:** all three guard-rail warnings carried over verbatim, including the `'[]'`/`NULL` → wildcard
  footgun and the no-cache/no-restart note. I verified my own "`ft token revoke` semantics (delete the
  row)" phrasing was accurate before it propagated — `RevokeAPIToken` is
  `ApiToken.DeleteOneID(id).Exec(ctx)` (`internal/store/entstore.go:1469-1478`). Correct.
- **I3:** the `scopes: null` interpretation key is now at the point of use, with a triage filter.
- **I4:** the 200-row cap and the `returned` vs `total` check are documented.
- **I2:** now verifies via `ft token list | select(.name == "lifecycle-reviewer") | .scopes`, which
  works (better than my `token create | jq` suggestion — it re-reads persisted state).

## N1 (CRITICAL, new) — `runbook:25-26, 111-115` — the replacement path for step 3 does not exist

Two places now tell operators:

> User and token *creation* on Postgres must go through the server's RPC or dashboard

> User and token creation on PostgreSQL deployments must go through the farmtable server's gRPC API
> or the web dashboard.

**Both named paths are unavailable.** This is the A1 finding from Addendum 1 applied to text written
after it:

1. **gRPC API** — no such RPCs. `proto/farmtable.proto:1036-1096` defines exactly three identity
   RPCs: `WhoAmI`, `ListUsers`, `GetUser`. There is no `CreateUser` and no token RPC of any kind.
   `CreateUser`/`CreateAPIToken` exist only as *store* methods, called from the CLI (SQLite) and from
   server-side provisioning.
2. **Web dashboard** — the only server-side creation path is OAuth/IAP auto-provisioning
   (`internal/serverapp/provisioning.go`), and it cannot produce what step 3 needs:
   - `ProvisionUser` **hardcodes `Type: "human"`** (line 89-94) — it can never mint a `reviewer`-typed
     user.
   - `CreateSessionToken` (line 137-150) always creates a token named `session-auth` with a **24-hour
     expiry** and `DefaultScopesForUserType("human")`, which is **`["*"]` — full wildcard**
     (`internal/server/scopes.go:143`).

   So the dashboard produces a 24h wildcard human session token, which is the *opposite* of the
   long-lived, narrowly-scoped `lifecycle-reviewer` token the hand-off protocol requires.

**Net effect:** step 3 — creating the reviewer identity — now has **no executable path on Postgres**.
Since the hand-off protocol is the runbook's *recommended* rollout (see "Rollout Decision"), the
recommended path is unachievable on the production deployment. The previous revision at least left
operators the (unguarded) SQL option; this revision removed it and substituted a dead end. An operator
will follow the pointer, find nothing, and improvise — most likely by reaching for the OAuth session
token, i.e. a wildcard credential.

**Suggested fix** — direct SQL creation is entirely feasible and should replace the dead pointer.
`HashToken` is plain unsalted SHA-256 hex (`internal/store/entstore.go:1374-1377`) and the raw format
is `"ft_" + hex(32 random bytes)` (line 1384), so an operator can mint a token by hand:

````markdown
### User/token creation (replaces step 3)

There is no `CreateUser` or token RPC on the server (`proto/farmtable.proto` exposes only `WhoAmI`,
`ListUsers`, `GetUser`), and dashboard OAuth provisioning always creates `human`-typed users with
24-hour wildcard `session-auth` tokens — it cannot create a scoped reviewer. Create both by hand:

```bash
# Generate the token locally. The DB stores only the SHA-256 hash.
RAW="ft_$(openssl rand -hex 32)"
HASH=$(printf '%s' "$RAW" | sha256sum | cut -d' ' -f1)
echo "Save this token now, it is never recoverable: $RAW"
```

```sql
-- 1. Reviewer user. The 'type' string must be exactly 'reviewer'.
INSERT INTO users (id, display_name, email, type, status, created_at, updated_at)
VALUES (gen_random_uuid(), 'task-reviewer', 'reviewer@example.com', 'reviewer', 'active', now(), now())
RETURNING id;

-- 2. Token, with the reviewer scope set written explicitly. Scopes are NOT
--    derived from user type on this path — you must state them.
INSERT INTO api_tokens (id, token_hash, name, user_id, created_at, scopes)
VALUES (gen_random_uuid(), '<HASH>', 'lifecycle-reviewer', '<user-id>', now(),
        '["task:read","task:write","task:claim","task:accept","task:close","collection:read"]');

-- 3. Verify.
SELECT u.type, t.name, t.scopes FROM api_tokens t JOIN users u ON u.id = t.user_id
WHERE t.name = 'lifecycle-reviewer';
```

**NEVER** omit the `scopes` column or write `'[]'` — NULL/empty is interpreted as wildcard.
````

Note the type-vs-scopes decoupling worth calling out explicitly: on the SQL path, `type` is inert
metadata. `DefaultScopesForUserType` runs only at CLI/provisioning time, so the `scopes` column is the
sole thing enforcement reads. Writing `type='reviewer'` without scopes yields a **wildcard** token.

## N2 (Minor, new) — `runbook:51-52` — instructs an operation the CLI does not support

> If this prints null or is absent, the user type was not recognised — revoke the token, **delete the
> user**, and re-create with the exact string "reviewer".

There is no `ft user delete`. The `user` command group is `create`, `get`, `list`, `whoami`
(`internal/cli/user.go:19-25`). `ft token revoke` works; the user deletion half does not.

**Suggested fix:** "…revoke the token with `ft token revoke <id>`, then create a *new* user with the
exact string `reviewer` and issue the token against that user. There is no `ft user delete`; the
mistyped user row is harmless once it holds no tokens (it can be cleaned up later with
`UPDATE users SET status='inactive' WHERE id='<id>'`)."

## N3 (Nit) — `runbook:28-29` — `(see GitHub issue)` is an unfilled placeholder

Worth substituting the real issue number from the two follow-ups the coordinator filed, or dropping
the parenthetical.

## Revised verdict

**REQUEST CHANGES — still docs only, one narrow fix.** The rework is a clear net improvement and
resolves the original C1/I1–I4. N1 must be corrected before merge: as written, the runbook directs
operators to a non-existent API for the one step that has no other documented path, on the rollout
route it recommends. N2/N3 are one-line edits. `internal/cli/token.go` remains approved and untouched
by any of this.

---

## Addendum 3 — Verification caveat on the N1 SQL block

I described the N1 replacement SQL as "ready-to-paste"; that overstates what I verified. Scoping it
honestly, because the whole point of N1 is that operators trust this document:

**What I did verify:** the schema definitions (`internal/store/ent/migrate/schema.go` — table names,
column names, nullability), the stored `scopes` encoding (dumped from a live SQLite DB:
`["task:read",…]`), the hashing scheme (`HashToken` = unsalted `sha256` hex,
`internal/store/entstore.go:1374-1377`), and the raw token format (`"ft_" + hex(32)`, line 1384).
These are dialect-independent and are correct.

**What I did NOT verify:** none of the SQL — neither my new `INSERT`s nor the pre-existing `UPDATE`
from I1 — has been executed against a live PostgreSQL instance. No Postgres was reachable in this
environment (`pg_isready` negative), so all execution-level verification was done on SQLite.

Two specific spots where Postgres may diverge:

1. **`gen_random_uuid()`** is built-in only from PostgreSQL 13. On 12 or earlier it requires
   `CREATE EXTENSION pgcrypto;` first. Ent maps `field.TypeUUID` to the native `uuid` type, so the
   value is type-compatible — but that is inference from the schema, not an executed test.
2. **JSON column cast.** Ent maps `field.TypeJSON` to `json`/`jsonb` on Postgres. A bare string
   literal relies on the implicit cast from `unknown`, which works in `INSERT ... VALUES` and
   `UPDATE ... SET` context but is fragile under refactoring. An explicit
   `'["task:read",…]'::jsonb` is more robust and self-documenting, and I would recommend the doc use
   it throughout.

**Recommendation for whoever lands the N1 fix:** validate the block against the existing Postgres
integration path before merging — `internal/server/server_postgres_test.go` exists and
`CLAUDE.md` documents `go test ./... -tags integration` against a live instance. A five-minute
execution check converts this from schema-derived to actually-verified, which is the standard this
particular document needs to meet.
