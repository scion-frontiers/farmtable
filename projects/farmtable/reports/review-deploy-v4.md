# Review: PR #168 — final round (commits `ee0f3a2`, `cb770d9`)

**Branch:** `auth-stage4-deploy-prep` (6 commits, base `main`)
**Delta reviewed this round:** `.design/project-log/auth-stage4-deploy-rollout.md` (+75/−18) — docs only
**Reviewer:** code-reviewer
**Date:** 2026-07-27
**Prior reviews:** `review-deploy-v2.md` (`4dc8d2a`), `review-deploy-v3.md` (`61198d5`)

---

## Review Summary

**Verdict:** APPROVE (with non-blocking recommendations)

**Overview:** Both blocking findings from v3 (**C1-a** dead gRPC/dashboard pointer, **I2-a** non-existent
`ft user delete`) are fully resolved, and the N1 SQL provisioning recipe is factually correct on every
claim I could check — schema columns, `uuid`/`timestamptz`/`jsonb` Postgres types, token format, hash
scheme, and the subtle "scopes column is the sole enforcement input" assertion all verified against
source and reproduced empirically. The runbook is now internally self-consistent: all four checklist
steps have both a SQLite CLI path and a Postgres SQL path.

**Risk level:** Low. Docs-only delta; the Go code is byte-identical to the commit approved in v2
(`git diff 4dc8d2a..HEAD` touches only the `.md`). No Critical issues remain.

---

## Verification Performed

I did not accept any claim in the new SQL block on its face. Each was checked against source at the
pinned dependency version, and the recipe was executed end-to-end.

| Claim / check | Method | Result |
|---|---|---|
| Docs-only delta | `git diff --stat 4dc8d2a..HEAD` | 1 file, `.md` only ✓ Go untouched since approval |
| Build | `go build ./...` | exit 0 |
| Tests | `go test ./internal/cli/... ./internal/server/... ./internal/platform/...` | all `ok` |
| Vet | `go vet ./internal/cli/... ./internal/server/...` | exit 0 (4 pre-existing `protoimpl` lock-copy warnings in `server.go`, outside delta) |
| gofmt | `gofmt -l internal/cli internal/server` | flags `enums.go`, `graph.go`, `beads_import.go`, `scopes.go` — all **pre-existing, outside delta**; `token.go` clean |
| **Token format** | `entstore.go:1384` `"ft_" + hex.EncodeToString(rawBytes)`, `rawBytes` = 32 | `openssl rand -hex 32` → 64 hex chars; total 67 ✓ exact match |
| **Hash scheme** | `HashToken` = `hex(sha256(raw))` (`entstore.go:1374-1377`) vs `printf '%s' \| sha256sum \| cut -d' ' -f1` | byte-identical for the same input ✓ (ran both) |
| `printf` vs `echo` | — | `printf '%s'` correctly omits the trailing newline; `echo` would produce a wrong hash. Correct as written ✓ |
| **`users` columns** | `migrate/schema.go:273-282` | `id, email, display_name, type, status, platform_id, created_at, updated_at` — every column in the INSERT exists; all NOT-NULL columns are supplied (`platform_id` is nullable) ✓ |
| **`api_tokens` columns** | `migrate/schema.go:12-22` | `id, token_hash, name, created_at, expires_at, last_used_at, scopes, collection_ids, user_id` — INSERT covers all NOT-NULL columns; omitted ones are all `Nullable: true` ✓ |
| **`::jsonb` cast** | ent **v0.14.6** `dialect/sql/schema/postgres.go:132-133` → `field.TypeJSON` ⇒ `postgres.TypeJSONB` | ✓ correct, and idiomatic. Confirmed the pinned version, not `master`. |
| Physical schema matches | `entstore.go:71-76` `client.Schema.Create(ctx)` runs on the Postgres path | auto-migrate produces exactly `migrate/schema.go` ✓ |
| **`gen_random_uuid()`** | ent postgres.go:130-131 → `field.TypeUUID` ⇒ `uuid` column | `gen_random_uuid()` returns `uuid` — no cast needed ✓ |
| pg13 / pgcrypto caveat | — | Accurate: `gen_random_uuid()` became core in PG13; `pgcrypto` required on ≤12 ✓ |
| **`now()`** | ent postgres.go:139-140 → `field.TypeTime` ⇒ `timestamptz` | `now()` returns `timestamptz` ✓ |
| **Reviewer scope array** | `scopes.go:129-139` | `task:read, task:write, task:claim, task:accept, task:close, collection:read` — matches the doc **exactly, in order** ✓ |
| **"DefaultScopesForUserType only runs at CLI/provisioning time"** | `grep` all call sites | exactly 2: `cli/token.go:158`, `serverapp/provisioning.go:141`. **Neither is in the request-authz path** ✓ claim is precisely correct |
| **"scopes column is the ONLY thing enforcement reads"** | `scopes.go:75-94` `RequireScope` reads `ScopesFromContext` only | ✓ |
| **NULL/`[]` = wildcard** | `scopes.go:82-85` `if len(scopes)==0 { return nil }` | ✓ covers both NULL and `'[]'` |
| **Proto surface claim** | `proto/farmtable.proto:1094-1096` | only `WhoAmI`, `ListUsers`, `GetUser`; no `CreateUser`, no token RPCs (33 RPCs total, none token-related) ✓ |
| **Dashboard OAuth claim** | `provisioning.go:92` `Type: "human"`; `:140` `24 * time.Hour`; `:145` `Name: "session-auth"` | all three details ✓ |
| No token cache | `server/token_lookup.go` (whole file) | no caching layer — "no restart required" still true ✓ |
| NULL `expires_at` | `token_lookup.go:29-31` sets `ExpiresAt` only when non-nil | omitting the column ⇒ non-expiring token (matches `ft token create` default) ✓ |
| **N1 end-to-end** | Hand-inserted user+token via raw SQL mirroring the recipe, then read back through the app layer | `ft token list` returned `user_name: task-reviewer` with **exactly** the 6 reviewer scopes ✓ |
| **N2** — no `ft user delete` | `ft user --help` | only `create/get/list/whoami` ✓; `ft token revoke` exists ✓ |
| **N3** — issue numbers | `gh issue view 169/170` | #169 "ft token/user CLI commands need server-mode support" OPEN ✓; #170 "openDirectStore() should error when server config is set" OPEN ✓ |
| **S1** — `.items[]?` | Ran all 4 pipelines against a fresh empty DB | all 4 exit 0, empty output ✓. Old `.items[]` form: `jq: error … Cannot iterate over null`, rc=5 ✓ regression confirmed fixed |
| S1 — count pipeline untouched | `jq '{returned:(.items\|length), total:.total_count}'` | `{returned:0, total:0}` ✓ correctly left alone (`null \| length` is `0`) |
| **S3** — step-4 SQL | l.209-215 present | ✓ |
| **S4** — DELETE-first wording | l.158-161 | ✓ leads with `DELETE FROM`, `ft token revoke` demoted to parenthetical |
| Live Postgres execution | `psql`/`docker` unavailable in container | **not possible** — the doc's own caveat (l.217-220) discloses this honestly |

---

## Finding-by-Finding: v3 → v4

| v3 finding | Status |
|---|---|
| **C1-a** (Critical) — Postgres step 3 points at non-existent gRPC/dashboard | ✅ **Resolved** — replaced with a working, verified SQL recipe |
| **I2-a** (Important) — "delete the user", no such command | ✅ **Resolved** — now `ft token revoke`, explicitly states no `ft user delete` |
| **S1** — `.items[]` on null | ✅ Resolved, all 4 sites |
| **S2** — cite #169 by number | ✅ Resolved (l.33-34), both issues named with correct titles |
| **S3** — no "replaces step 4" | ✅ Resolved |
| **S4** — `ft token revoke` inside Postgres section | ✅ Resolved |
| **S5** — raw token in scrollback | ⚠️ Not taken up; now applies to the new `echo` at l.180 — see Sug 2 |

The C1-a fix is notably **better than the fix I proposed in v3** on two counts, both of which I
verified: it uses `RETURNING id` rather than a `SELECT … WHERE display_name = …` subselect (correct —
`UsersTable` has **no unique index on `display_name`**, so the subselect I suggested could match
multiple rows), and it adds the `::jsonb` casts and the pg13/pgcrypto caveat that my version omitted.

---

## Critical Issues

**None.**

---

## Important Issues

### Imp-1 — `auth-stage4-deploy-rollout.md:92-102` — the SQLite step 3 can make the wildcard-escalation hazard *unreachable* instead of merely detectable

This paragraph is in-delta (N2 rewrote l.99-102). The current recipe relies on `ft token create`
inferring scopes from `users.type`, then documents a MUST-verify check plus a recovery procedure for
when a `--type` typo silently mints a wildcard token. That is correct and I confirmed both branches
reproduce as written.

But `ft token create` accepts explicit `--scope` flags, and `internal/cli/token.go:147-152` shows
they take priority over type inference **and** are run through `server.ValidateScopes`. Passing them
removes the failure mode entirely rather than catching it after the fact. I verified all three
behaviours against a user deliberately created with the `reviewr` typo:

```console
# type typo, no --scope  →  the documented hazard
$ ft token list -o json | jq -c '.items[]? | select(.name=="typo-tok") | .scopes'
null                                            # wildcard

# type typo, WITH explicit --scope  →  hazard neutralised
$ ft token create $UID --name scoped-tok --scope task:read --scope task:write \
    --scope task:claim --scope task:accept --scope task:close --scope collection:read
$ ft token list -o json | jq -c '.items[]? | select(.name=="scoped-tok") | .scopes'
["task:read","task:write","task:claim","task:accept","task:close","collection:read"]

# and a scope typo is rejected rather than silently ineffective
$ ft token create $UID --name bad --scope task:cl0se
Error: unknown scope "task:cl0se"
```

For a security-migration runbook, "the footgun cannot fire" beats "here is how to detect and recover
from the footgun". This also brings the SQLite path into line with the Postgres path, which the same
commit correctly built around *explicit* scopes.

**Suggested fix** (keep the verification step as a belt-and-braces check):

```bash
# Create a token with lifecycle scopes. Pass --scope EXPLICITLY: this overrides
# user-type inference (internal/cli/token.go:147) and is validated against the
# known scope list, so neither a `--type` typo nor a scope typo can silently
# mint a wildcard token.
ft token create <reviewer-user-id> --name "lifecycle-reviewer" \
  --scope task:read --scope task:write --scope task:claim \
  --scope task:accept --scope task:close --scope collection:read

# Verify anyway — this is the state enforcement actually reads.
ft token list --output json | jq '.items[]? | select(.name == "lifecycle-reviewer") | .scopes'
```

**Non-blocking:** the text as written is factually accurate and safe for an operator who follows it.
This is a strengthening, and it is fine to land it as a follow-up if the team prefers to freeze the PR.

---

## Suggestions

### Sug 1 — `:179` — `sha256sum` is GNU-only; macOS operators get "command not found"

Deploy runbooks get run from laptops. BSD/macOS ships `shasum`, not `sha256sum`.

```bash
HASH=$(printf '%s' "$RAW" | sha256sum | cut -d' ' -f1)   # GNU/Linux
# macOS: HASH=$(printf '%s' "$RAW" | shasum -a 256 | cut -d' ' -f1)
```

### Sug 2 — `:180` — the recipe writes a live, non-expiring credential to terminal scrollback

`echo "Save this token now, it is never recoverable: $RAW"` is now a *documented instruction* rather
than incidental CLI output, and the token it prints never expires (the INSERT omits `expires_at`;
`token_lookup.go:29-31` only enforces expiry when the column is non-NULL). It also persists in the
shell environment for the rest of the session. Worth routing at the point of generation:

```bash
# Write straight to your secret manager; avoid echoing to the terminal.
printf '%s' "$RAW" | gcloud secrets versions add farmtable-reviewer-token --data-file=-
unset RAW
```

Also worth one line noting the SQL path yields a **non-expiring** token, and that adding
`expires_at` (the equivalent of `ft token create --expires 720h`) is the safer default for a
service credential.

### Sug 3 — `:188` — `reviewer@example.com` collides with OAuth email matching

`ProvisionUser` (`provisioning.go:64-78`) looks users up **by email** and reuses the first active
match. If an operator substitutes a real person's address here, that person's next dashboard login
will bind to this `reviewer`-typed row and receive reviewer-scoped session tokens instead of
`human`/wildcard — and the service identity becomes entangled with a human. Recommend an explicitly
non-routable service address and a one-line warning:

```sql
-- Use a non-routable service address. OAuth provisioning matches users by email
-- (internal/serverapp/provisioning.go:64) and would bind a real person's login
-- to this service identity.
'farmtable-reviewer@svc.invalid',
```

### Sug 4 — `:23-25` — the top-of-file pointer no longer enumerates everything the section covers

It lists "inventory, scope updates, and user/token creation" but the same commit added a verification
subsection. One word: `…user/token creation, and verification are all covered with SQL equivalents.`

### Sug 5 — `:222-223` — closing line conflates the two issues

"A server-mode RPC for token/user CLI management is tracked as a follow-up (#169, #170)." Only **#169**
is the RPC work; **#170** is the `openDirectStore` guard. Lines 33-34 get this distinction right, so
the closing line should just cite #169.

### Sug 6 — `:187-199` — wrap the two INSERTs in a transaction

They are independent statements; a failure between them leaves an orphan user row. The doc elsewhere
(correctly) says a tokenless user row is harmless, so this is cosmetic — but `BEGIN;` / `COMMIT;` is
two lines and makes the RETURNING → paste → INSERT sequence obviously atomic.

### Sug 7 — `:170-171` — slightly ambiguous phrasing (trivial)

"`proto/farmtable.proto` exposes only `WhoAmI`, `ListUsers`, `GetUser`" reads as though the whole
service has three RPCs; it has 33. The surrounding sentence scopes it correctly, but
"…exposes only `WhoAmI`, `ListUsers` and `GetUser` for users, and no token RPCs at all" removes the
double-take.

### Sug 8 (out of delta, optional) — `:209-215` — verification assumes token auth is actually wired

`RequireScope` short-circuits to allow-everything when `authEnforcedKey` is absent
(`scopes.go:75-78`), which happens when the interceptor is installed with a nil lookup. All of the
scope work in this runbook is inert in that configuration. A one-line precondition near the
verification step — "confirm the server is running with `FARMTABLE_AUTH_MODE` set and the token
interceptor installed; otherwise scopes are not enforced at all" — would close the loop. Flagging as
optional because this predates the delta.

---

## What's Done Well

- **The `printf '%s'` detail is right, and it is the one most people get wrong.** Using `echo "$RAW"`
  would append a newline and produce a hash that never matches anything, sending an operator hunting
  through auth code at deploy time. I ran the shell pipeline against Go's `HashToken` for the same
  input and got byte-identical output. This is the mark of a recipe that was executed, not drafted.
- **The `::jsonb` casts are correct at the pinned version.** I checked ent **v0.14.6** specifically
  (`dialect/sql/schema/postgres.go:132-133`), not `master`, and `field.TypeJSON` does map to `jsonb`.
  Combined with `Schema.Create` running on the Postgres path, the physical column type is guaranteed
  to match. This is the kind of claim that is usually asserted and wrong.
- **The `RETURNING id` choice is better than what v3 proposed.** My suggested subselect keyed on
  `display_name`, and `UsersTable` has no unique index on that column — it could have matched
  multiple rows. The author's version is strictly safer. Good judgement in not just applying the
  reviewer's patch verbatim.
- **The type-vs-scopes decoupling warning (l.193-196) is the single most important sentence in the
  new section, and it is exactly correct.** I traced every `DefaultScopesForUserType` call site:
  there are two, both at creation time, neither in the authorization path. So `type='reviewer'` with
  NULL scopes really is a wildcard token, and the doc says so in capital letters right where an
  operator would otherwise assume the type field is doing the work. That is a non-obvious escalation
  path documented before anyone hit it.
- **The pg13/`pgcrypto` caveat is a nice touch of operational realism** — Cloud SQL still offers PG12
  instances, and this is precisely the kind of "works on my box" failure that stalls a deploy at 2am.
- **The honesty note at l.217-220 is the right call.** Stating plainly that the SQL was validated
  against the ent schema and SQLite but *not* a live Postgres is better than silent confidence. I
  could not execute against Postgres either (no `psql`/`docker` in this container), so that caveat is
  doing real work rather than hedging.
- **S1 was diagnosed correctly, not pattern-matched.** The author changed the four `.items[]`
  pipelines and correctly left the `(.items | length)` count pipeline alone, because `null | length`
  is `0` in jq. Getting the exception right shows the fix was reasoned about.
- **Sustained responsiveness across four rounds.** Every finding from v2 and v3 is now either
  implemented or explicitly addressed, and the two hardest ones (C1-a, I2-a) were fixed by going and
  finding out what the system actually supports rather than softening the prose.

---

## Verification Story

- **Tests reviewed:** N/A this round (docs-only delta). Full suite re-run: `internal/cli`,
  `internal/server`, `internal/platform/{beads,github}` all `ok`.
- **Build verified:** Yes — `go build ./...` exit 0; `ft` rebuilt at `/tmp/ftv4` and used for all
  behavioural checks.
- **Lint/static analysis clean:** `go vet` exit 0 on the relevant packages. `gofmt -l` findings are
  all pre-existing files outside this delta; `internal/cli/token.go` is clean.
- **Security checked:** Yes. No credentials in the diff. The new SQL recipe's security-critical
  claims (NULL/`[]` ⇒ wildcard, type field inert at enforcement, scopes column authoritative) are all
  verified correct against source. Two residual, non-blocking items: a live credential echoed to the
  terminal (Sug 2, with the aggravating factor that the token never expires) and the OAuth
  email-collision interaction (Sug 3).
- **Runbook executed:** SQLite path — steps 1-4 all behave as written, including both branches of the
  step-3 typo check and all four `.items[]?` pipelines on an empty DB. Postgres path — schema, column
  types, and function return types verified against ent v0.14.6 and `migrate/schema.go`; the N1
  recipe was executed end-to-end in its SQLite-equivalent form and round-tripped through the
  application layer with exactly the intended scopes. Live Postgres execution was not possible in
  this container, matching the doc's own disclosure.

---

## Final Verdict

**APPROVE — merge.**

Both v3 blockers are resolved, the new SQL is correct on every verifiable claim, and the runbook now
gives a Postgres operator a complete, executable path through all four steps. The Go delta remains
unchanged from the v2 approval. No Critical issues.

**Recommendations to forward for a cleanup pass** (none gate merge): **Imp-1** (explicit `--scope` in
SQLite step 3 — one line, eliminates the wildcard-escalation footgun rather than detecting it) and
**Sug 1-3** (`sha256sum` portability, credential echo + non-expiring token, OAuth email collision).
Sug 4-7 are one-word/one-line polish and can be bundled or dropped.

**Still worth an EM decision, carried forward from v3:** #169 remains open, which means PostgreSQL
deployments have no supported token-administration surface — the hand-written SQL in this runbook
*is* the administration surface today. That is a product decision independent of this PR, and the
runbook is now an accurate description of that reality rather than a workaround for it.
