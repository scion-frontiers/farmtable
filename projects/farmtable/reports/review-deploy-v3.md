# Review: PR #168 rework #2 — commit `61198d5` (`docs(deploy): generalize SQLite-only warning to all CLI commands (C1/I1-I4)`)

**Branch:** `auth-stage4-deploy-prep`
**Delta reviewed:** `.design/project-log/auth-stage4-deploy-rollout.md` (+89/−14) — docs only
**Reviewer:** code-reviewer
**Date:** 2026-07-27
**Prior review:** `review-deploy-v2.md` (commit `4dc8d2a`)

---

## Review Summary

**Verdict:** REQUEST CHANGES (docs only — one factual defect and one unactionable instruction)

**Overview:** Four of the five findings (I1–I4) are correctly and accurately addressed, and I verified
each one empirically rather than by reading. C1 is ~80% addressed — the hoisted warning is excellent
and every factual claim in it checks out — but the commit resolves the "what do Postgres operators do
for step 3?" question by pointing them at **a gRPC API and a web dashboard that do not exist**. The
prior review's own Addendum A1 established this, so the new text contradicts information already in
hand.

**Risk level:** Low for code (unchanged). Medium for the runbook — a Postgres operator following the
*recommended* rollout path now reaches an explicit dead end instead of a silent one.

**Go code:** Confirmed byte-identical to the approved `4dc8d2a` (`git diff 4dc8d2a..61198d5 --
internal/cli/token.go` is empty). Not re-reviewed, per instruction.

---

## Verification Performed

I did not take the commit message at its word. Every claim the new text makes was checked against
source or executed against a scratch SQLite DB with a freshly built `ft`.

| Check | Method | Result |
|---|---|---|
| Docs-only commit | `git show --stat 61198d5` | 1 file, `.md` only ✓ |
| Go unchanged | `git diff 4dc8d2a..61198d5 -- internal/cli/token.go` | empty ✓ |
| Build | `go build ./...` | exit 0 |
| Vet | `go vet ./internal/cli/...` | exit 0 |
| Tests | `go test ./internal/cli/...` | `ok` |
| `--server` ignored (C1) | `ft token list --server prod.example.com:443` | returned 5 **local SQLite** rows ✓ claim confirmed |
| Postgres DSN hazard (C1) | `FARMTABLE_DB_PATH='postgres://user:pass@…' ft token update …` | created `./postgres:/user:pass@db.example.com:5432/farmtable`, then `TOKEN_NOT_FOUND` ✓ password in dir name, exactly as documented |
| Split-brain (C1) | `internal/cli/user.go` | `create`→`openDirectStore()` (l.38); `get`/`list`/`whoami`→`newClient()` (l.90/122/162) ✓ |
| Empty inventory (C1) | `ft token list -o json` on fresh DB | `{"items": null, "total_count": 0}` ✓ |
| **CreateUser / token RPCs** | `grep rpc.*(User\|Token) proto/farmtable.proto` | only `WhoAmI`, `ListUsers`, `GetUser` — **no create/update/revoke** ✗ |
| **Dashboard user/token UI** | `find web/src` | only `ft-collection-settings-dialog.ts`; no user/token management ✗ |
| Server provisioning path | `internal/serverapp/provisioning.go:89` | OAuth/IAP login only, hardcodes `Type: "human"`; `CreateSessionToken` is a 24h `session-auth` token — cannot mint a named reviewer token ✗ |
| Empty scopes = wildcard (I1) | `internal/server/scopes.go:82-85` | `if len(scopes)==0 { return nil }` ✓ |
| No token cache (I1) | `grep -E 'cache\|ttl' internal/server/token_lookup.go` | no matches — "no restart required" ✓ |
| SQL literal vs on-disk (I1) | `PRAGMA`/`SELECT scopes` via python sqlite3 | `["task:read","task:write",…]` byte-for-byte match ✓ |
| SQL column names (I1) | `internal/store/ent/migrate/schema.go:11-22` | `id, token_hash, name, created_at, expires_at, last_used_at, scopes, collection_ids, user_id` ✓ all referenced columns valid |
| I2 correct path | `ft user create --type reviewer` → `token create` → runbook's verify cmd | emitted the exact 6 documented scopes, in the documented order ✓ |
| I2 typo path | `ft user create --type reviewr` → verify cmd | emitted `null` ✓ — the check catches it, as claimed |
| Reviewer scope set | `server.DefaultScopesForUserType` (`scopes.go:129-139`) | matches doc line 99 exactly ✓ |
| I3 triage cmd | `jq '.items[] \| select(.scopes==null)'` | correctly isolated the wildcard token ✓ |
| I4 cap | `internal/cli/token.go:229-231` | `Limit: 200` hardcoded, no `--limit`/`--cursor` flag ✓ |
| I4 count cmd | `jq '{returned:(.items\|length), total:.total_count}'` | works ✓ |
| Issue refs | `gh issue list` | #170 "openDirectStore() should error…" ✓ real; #169 "ft token/user CLI commands need server-mode support" **OPEN** |
| SQL token-creation feasibility | inserted a row with `ft_$(openssl rand -hex 32)` + `sha256sum` hash | `ft token list` shows it with correct scopes ✓ — a real alternative exists |

---

## Finding-by-Finding Assessment

| Prior finding | Status |
|---|---|
| **C1** — SQLite-only warning too narrow | **Partially addressed** — see C1-a below |
| **I1** — SQL path bypasses guard rails | ✅ Addressed, accurate |
| **I2** — `--type` typo → wildcard escalation | ✅ Addressed (one unactionable step, see I2-a) |
| **I3** — `scopes: null` unexplained at inventory | ✅ Addressed, accurate |
| **I4** — 200-row silent truncation | ✅ Addressed, accurate |

### C1 — mostly addressed

What landed is genuinely good and I want to be specific about it, because the remaining gap is narrow:

- Warning is hoisted to **line 8**, above the checklist, where an operator actually reads it ✓
- Generalised to all four verbs (`create`, `list`, `update`, `revoke`) ✓
- All three silent-failure modes documented — and all three reproduce exactly as written ✓
- Split-brain hazard added (was Addendum A2), correctly cross-referenced to **#170** ✓
- Checklist retitled "Pre-Deploy Checklist (SQLite / Embedded Deployments)" — scoping now unambiguous ✓
- Tail section renamed "PostgreSQL Deployments" with SQL replacements for steps 1 and 2 ✓, both
  verified valid against the real schema and ent's real encoding ✓

The gap is step 3 only. See Critical C1-a.

---

## Critical Issues

### C1-a — `auth-stage4-deploy-rollout.md:25-26, 166-172` — the Postgres path for step 3 points at a gRPC API and dashboard that do not exist

Two places make the same positive factual claim:

> (l.25-26) User and token *creation* on Postgres must go through the server's RPC or dashboard —
> those operations are out of scope for this runbook's CLI path.

> (l.168-170) User and token creation on PostgreSQL deployments must go through the farmtable
> server's gRPC API or the web dashboard.

Both are false, on both halves:

- **gRPC:** `proto/farmtable.proto:1094-1096` exposes only `WhoAmI`, `ListUsers`, `GetUser`. There is
  no `CreateUser` and there are no API-token RPCs at all.
- **Dashboard:** the only settings surface under `web/src` is `ft-collection-settings-dialog.ts`.
  There is no user or token management UI.
- **Confirmed by the tracker:** issue **#169 — "ft token/user CLI commands need server-mode support"**
  is still **OPEN**. The capability the runbook instructs operators to use is unbuilt work.
- The one server-side path that does create users (`internal/serverapp/provisioning.go:89`) is
  OAuth/IAP login auto-provisioning. It hardcodes `Type: "human"` and derives identity from email, so
  it cannot produce a `reviewer`-typed user. Its `CreateSessionToken` mints a 24-hour `session-auth`
  token with `human` defaults (= wildcard), not a named lifecycle-reviewer token.

**Why this is blocking rather than cosmetic.** The document's own "Rollout Decision" (l.39-43) names
the hand-off protocol as *the recommended path*, and that path requires a reviewer/orchestrator token.
So for a Postgres deployment the runbook recommends a strategy, then tells the operator to provision
it via a mechanism that does not exist. The top-of-file warning explicitly promises the opposite —
"use the direct SQL procedure in **PostgreSQL Deployments** below for **all** steps" (l.23-24) — and
then step 3 is the one step with no SQL procedure. That is an internal contradiction in the artifact.

This is also information the author already had: Addendum A1 of the v2 review stated *"the remedy for
C1 cannot be 'wire the CLI up to the server' — there is no `CreateUser`, and no token RPCs
whatsoever."* The v2 review offered two acceptable outs and this commit took the one whose premise A1
had already disproved.

**Suggested fix** — a SQL recipe is genuinely feasible; I validated it end-to-end. Tokens are
`"ft_" + hex(32 random bytes)` and the stored hash is `hex(sha256(raw))`
(`internal/store/entstore.go:1374-1386`), both reproducible in shell. I inserted a token this way and
`ft token list` read it back with correct scopes.

````markdown
### User/token creation (replaces step 3)

There is **no** server-side path for this today: the gRPC API exposes only `WhoAmI`, `ListUsers`
and `GetUser` (no `CreateUser`, no token RPCs), and the dashboard has no user/token management UI.
Tracked as #169. Until that lands, provision directly in SQL.

```bash
# Generate the token. The raw value is shown ONCE — capture it into your secret manager.
RAW="ft_$(openssl rand -hex 32)"
HASH=$(printf '%s' "$RAW" | sha256sum | cut -d' ' -f1)
echo "$RAW"   # store this now; only the hash is persisted
```

```sql
-- 1. Create the reviewer user.
INSERT INTO users (id, display_name, email, type, status, created_at)
VALUES (gen_random_uuid(), 'task-reviewer', 'reviewer@example.com', 'reviewer', 'active', now());

-- 2. Create the token with the reviewer scope set stated EXPLICITLY.
--    Scopes are NOT defaulted by SQL — DefaultScopesForUserType() is application logic and
--    does not run here. Omitting scopes yields NULL = WILDCARD (full access).
INSERT INTO api_tokens (id, token_hash, name, created_at, scopes, user_id)
VALUES (gen_random_uuid(), '<HASH>', 'lifecycle-reviewer', now(),
        '["task:read","task:write","task:claim","task:accept","task:close","collection:read"]',
        (SELECT id FROM users WHERE display_name = 'task-reviewer'));

-- 3. Verify.
SELECT u.display_name, u.type, t.name, t.scopes
FROM api_tokens t JOIN users u ON u.id = t.user_id
WHERE t.name = 'lifecycle-reviewer';
```

**The SQL path does not apply user-type scope defaults.** On the CLI, `ft token create` derives
scopes from the user's `type`; in SQL you must write the scope array yourself. A missing `scopes`
value is `NULL`, which `RequireScope` treats as **wildcard (full access)** — the exact escalation
step 3's CLI check (I2) exists to catch.
````

Then update the top-of-file pointer (l.25-26) to match, and cite **#169** rather than "the server's
RPC or dashboard".

If the team would rather not publish an `INSERT` recipe, the acceptable alternative is to say so
plainly — *"reviewer-token provisioning is not currently possible on PostgreSQL (#169); use the
Fallback path in Rollout Decision and grant `task:close` to existing agent tokens via the SQL in
'Scope updates' above"* — which at least leaves the operator with a working procedure.

---

## Important Issues

### I2-a — `auth-stage4-deploy-rollout.md:100-101` — remediation instructs `delete the user`, which no command can do

The new verification block ends:

> If this prints null or is absent, the user type was not recognised — revoke the token, delete the
> user, and re-create with the exact string "reviewer".

`ft user` exposes only `create`, `get`, `list`, `whoami` (verified via `ft user --help` and
`internal/cli/user.go`). There is **no** `ft user delete`. An operator who correctly detects the typo
is then told to run a command that does not exist, at the exact moment they are trying to clean up a
wildcard-privileged token.

The important half — revoking the over-privileged token — *is* actionable via `ft token revoke`. The
stale user record is harmless once it holds no tokens.

**Suggested fix:**

```markdown
# If this prints null or is absent, the user type was not recognised. Revoke the
# over-privileged token immediately, then re-create the user with the exact
# string "reviewer" and issue a new token:
#   ft token revoke <token-id>
#   ft user create "task-reviewer-v2" --type reviewer --email reviewer@example.com
# There is no `ft user delete`; the mistyped user record is inert once its tokens
# are revoked, but note it for cleanup when #169 lands.
```

---

## Suggestions

### S1 — `auth-stage4-deploy-rollout.md:54, 69, 97, 107` — `.items[]` aborts with a jq error when `items` is `null`

Verified on a fresh DB:

```console
$ ft token list --output json | jq '.items[] | select(.scopes == null) | {id, name}'
jq: error (at <stdin>:6): Cannot iterate over null (null)
```

`printList` emits `"items": null` (not `[]`) when there are no rows — which is precisely the Postgres
case the top-of-file warning describes. So the operator most likely to hit this is the one the
document is trying hardest to protect, and they get a jq parse error rather than the documented
`{"total_count": 0, "items": null}`. Use `(.items // [])[]` or `.items[]?` in all four pipelines.
(The I4 `returned/total` command at l.72 is already safe — `null | length` is `0` in jq.)

### S2 — `auth-stage4-deploy-rollout.md:34-35, 172` — cite #169 by number

Line 32 sets a good precedent with "(Tracked: #170)". The two "tracked as a follow-up (see GitHub
issue)" references are vague by comparison and both mean **#169**. Naming it also makes C1-a's
constraint self-evident to the reader.

### S3 — `auth-stage4-deploy-rollout.md:104-111` — no "replaces step 4" in the PostgreSQL section

The section provides replacements for steps 1, 2 and 3 but stops before verification, leaving step 4
("Verify after deploy") reachable only via CLI commands that the same document says don't work on
Postgres. A two-line `SELECT t.name, t.scopes FROM api_tokens t WHERE t.name = '<agent-token>';`
subsection would close the symmetry.

### S4 — `auth-stage4-deploy-rollout.md:158-159` — `ft token revoke` referenced inside the Postgres-only section

"Use `ft token revoke` semantics (delete the row) to disable a token instead" appears under
"PostgreSQL Deployments", where `ft token revoke` by definition does not work. The parenthetical
rescues it, but inverting to "delete the row (the equivalent of `ft token revoke` on SQLite)" removes
the double-take.

### S5 — prior S4 (raw token in scrollback) not taken up

Non-blocking and never requested as a change. Worth noting the CLI does print *"Save this token — it
will not be shown again."*, which partially mitigates it. If the C1-a rewrite happens, the `echo
"$RAW"` line in my suggested block deserves the same secret-manager caveat.

---

## What's Done Well

- **The hoisted warning is the right fix, executed well.** It is at line 8 — genuinely first — names
  all four verbs, and leads with the *consequence* ("they fail silently, not loudly") before the
  mechanism. Every one of its three failure claims reproduces exactly, including the password-in-a-
  directory-name detail. This is what C1 asked for.
- **I2's implementation improves on the review's own suggestion.** The v2 review proposed
  `ft token create … | jq .scopes`; the author instead verifies via `ft token list … | select(.name
  == "lifecycle-reviewer")`. That checks *persisted* state rather than the create-response echo, and
  it exercises the same H2 field the inventory step depends on. I ran both the correct and the
  `reviewr` typo path — six scopes in exact documented order, and `null` respectively. The check
  works and the documented expected output is correct to the string.
- **The Addendum A2 split-brain hazard was absorbed, not just acknowledged.** l.28-32 describes the
  contradiction accurately and cites a real, open issue (#170) whose title matches the recommended
  fix. Turning a review addendum into operator-facing guidance with a tracker link is the right
  instinct.
- **I1's three guard rails are all technically correct, including the subtle one.** "Changes take
  effect immediately — `StoreTokenLookup` does not cache, so no server restart is required" is the
  kind of claim that is usually asserted and wrong; it is right here, and it saves an operator an
  unnecessary and scary production restart.
- **The SQL continues to be verified rather than guessed.** Table `api_tokens`, columns `id`, `name`,
  `user_id`, `scopes`, `created_at` all exist; the JSON array literal matches ent's on-disk encoding
  byte-for-byte (I dumped the blob to confirm). The `NULL or '[]' means LEGACY WILDCARD` annotation is
  now on *both* the inventory and update queries — the reader cannot miss it.
- **I3 and I4 are tight, correct, and placed where the operator needs them** rather than 40 lines
  away. The `Limit: 200` claim, the absence of a pagination flag, and the `returned < total` tell are
  all accurate.

---

## Verification Story

- **Tests reviewed:** N/A for this commit (docs only). `go test ./internal/cli/...` re-run: `ok`.
- **Build verified:** Yes — `go build ./...` exit 0; `ft` rebuilt at `/tmp/ftrev` and used for all
  behavioural checks.
- **Lint/static analysis clean:** `go vet ./internal/cli/...` exit 0. `gofmt -l internal/cli/` flags
  `enums.go` and `graph.go` — both **outside this delta and pre-existing**; `token.go` is clean. Not
  a finding against this commit.
- **Security checked:** Yes. No credentials in the diff. Two security-relevant items: C1-a can leave
  a Postgres operator without a scoped-token procedure (raising the odds they improvise a NULL-scoped
  = wildcard token), and I2-a leaves an over-privileged token cleanup half-documented. The I1 warnings
  against `'[]'`/`NULL` are correct and well-placed.
- **Runbook executed:** Yes — SQLite path steps 1–4 all behave as written, including both I2 branches.
  Postgres path: steps 1 and 2 verified as valid SQL against the real schema; step 3 has no viable
  procedure (C1-a).

---

## Final Verdict

**REQUEST CHANGES — docs only, one focused pass.**

I1, I2, I3 and I4 are done and verified; I would not revisit them apart from the `.items[]?` nit.
C1's hoisted warning is exactly right. The single blocking item is **C1-a**: the Postgres step-3
guidance directs operators to a gRPC API and dashboard that do not exist (#169 is open and unbuilt),
which contradicts both the top-of-file promise that SQL covers *all* steps and the review addendum
that established this last round. Either add the SQL provisioning recipe (validated above — it works)
or state plainly that reviewer-token provisioning is blocked on #169 and route operators to the
Fallback path. **I2-a** (`delete the user` — no such command) should ride along in the same pass.

The Go delta remains approved and unchanged. Estimated effort: ~20 minutes of documentation editing.

**Recommend escalating to the EM:** #169 is not merely a doc footnote — it means PostgreSQL
deployments currently have no supported token administration surface at all. That is worth an
explicit product decision, separate from merging this PR.
