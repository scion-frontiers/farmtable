# CONFIRMED

**But NOT the reported defect.** The specific hypothesis in the brief — `internal/cli/connect.go`
builds a gRPC server with no auth interceptor, therefore token writes are exposed — is **FALSE and
should be closed**. A *different*, real, unauthenticated token-write path exists: the six
`/api/link/*` HTTP routes. Severity is scoped hard below; it is **not** an emergency and it does
**not** mint a Farm Table credential.

- **Base:** `main` = `faf1c8c` ("Give each test store its own in-memory database"). MEASURED.
  Note: the canonical tree `/workspace/farmtable` has `633f8f2` checked out on another branch;
  `main` itself resolves to `faf1c8c` as stated.
- **Path filter / denominator hygiene:** I did not grep the canonical tree. I cloned
  `--no-hardlinks --shared` from the local path to `/tmp/ft-audit` and checked out `faf1c8c`.
  A fresh clone carries no untracked files, so `.claude/worktrees/` copies are **structurally
  absent**, not filtered out: `find` for `*.go` under `worktrees` = **0** hits. Population =
  **208 tracked `.go` files**. No git writes, no branch, nothing created in `/workspace`.

---

## 1–2. Token-write entry points and what authenticates each

"Token write" = creates/mutates a stored credential: a Farm Table `ApiToken` row, or a
`LinkedAccount.auth_token` / `refresh_token`. **N = 18**, all named.

### Network-reachable (11)

| # | Entry point (identifier) | Writes | Authenticated by |
|---|---|---|---|
| 1 | `LinkFlowManager.handleGitHubCallback` | `LinkedAccount` auth+refresh token | **NOTHING** (state param only) |
| 2 | `LinkFlowManager.handleJiraCallback` | same | **NOTHING** |
| 3 | `LinkFlowManager.handleLinearCallback` | same | **NOTHING** |
| 4 | `LinkFlowManager.handleGitHubInstall` | `pendingStates` (memory, no DB) | **NOTHING** |
| 5 | `LinkFlowManager.handleJiraConnect` | `pendingStates` | **NOTHING** |
| 6 | `LinkFlowManager.handleLinearConnect` | `pendingStates` | **NOTHING** |
| 7 | `FarmTableService.CreateLinkedAccount` (gRPC) | `LinkedAccount` auth token | `RequireIdentity` + `RequireScope(ScopeCollectionAdmin)` + `RequireCollectionAccess` |
| 8 | `FarmTableService.DeleteLinkedAccount` (gRPC) | deletes token row | same three |
| 9 | `GoogleOAuthManager.handleCallback` → `CreateSessionToken` | **mints `ApiToken`** | Google OAuth code exchange + state |
| 10 | `iapMiddleware` → `CreateSessionToken` | **mints `ApiToken`** | `IAPAuthenticator.Authenticate` (JWT + audience) |
| 11 | `SessionManager.handleLogin` → `RecordUsage` | `UpdateTokenLastUsed` | validates presented token via `LookupByHash` first |

### Background, no external entry (2)

| # | Entry point | Writes |
|---|---|---|
| 12 | `TokenRefresher.Start` | rotates `LinkedAccount` tokens |
| 13 | `StoreTokenLookup.RecordUsage` | `UpdateTokenLastUsed`, post-auth only |

### Local CLI — require a local shell **and** direct DB file access, no network listener (5)

`newTokenCreateCmd` (14, `CreateAPIToken`), `newTokenUpdateCmd` (15, `UpdateAPITokenScopes`),
`newTokenRevokeCmd` (16, `RevokeAPIToken`), `ensureLocalUser` (17, `CreateAPIToken` + writes the
raw token to the config file), `ensureDashboardToken` (18, `ApiToken.Create` with **empty scopes**).
All five call the store directly — they are not RPCs and are not reachable off-host.

**Decisive negative, two instruments agreeing:** *no gRPC method mints a Farm Table token.*
Instrument A — `proto/farmtable.proto`: 33 `rpc` declarations. Instrument B — the generated
descriptor `api/farmtable/v1/farmtable_grpc.pb.go`: 32 `MethodName` + 1 `StreamName` = 33. Both
lists agree and neither contains a token-creation RPC. Independently, `grep` for
`CreateAPIToken|CreateSessionToken|UpdateAPITokenScopes|RevokeAPIToken` across `internal/server/`
returns hits in **`_test.go` files only**. MEASURED.

---

## 3. The `connect.go` hypothesis — FALSIFIED

- `connect.go` has **two** `grpc.NewServer` sites. The embedded one **does** install
  `server.TokenAuthInterceptor` and `server.TokenAuthStreamInterceptor`. Only the *pass-through*
  server omits them. The brief's "no auth interceptor" is half true at best. MEASURED.
- **Reachability — this is what settles it.** Both `connect.go` servers listen on
  `bufconn.Listen(1<<20)`, an **in-process in-memory** listener. `grep` for
  `net.Listen|ListenAndServe` across all non-test Go files returns exactly **two** real network
  listeners in the whole tree: `cmd/farmtable-server/main.go` (`httpServer.ListenAndServe`) and
  `internal/cli/dashboard.go` (`net.Listen("tcp", listenAddr)`). Neither is in `connect.go`.
  MEASURED.
- **Binds no address. Not reachable off-host. Not reachable on-host by any other process** — it has
  no socket at all; the only client is the in-process `bufconn` dialer in the same function.
- **Container paths:** `Dockerfile` → `CMD ["/ft","dashboard","--port","8080"]`;
  `Dockerfile.server` → `CMD ["/farmtable-server"]`. Neither invokes `ft connect`. The pass-through
  server is reached only by a developer running `ft connect` locally. MEASURED.
- `ft dashboard` **does** bind `:8080` on all interfaces and **is** a production container path —
  but its gRPC server installs `TokenAuthInterceptor`, non-nil unless `FARMTABLE_OPEN_ACCESS=1`.

**Close this lead.**

## 4. Verdict question — is there a token-write entry point a caller with NO credential can reach?

**Yes — entries 1–6**, at the application layer. MEASURED, by runtime probe, not by grep.

I built the full `UnifiedHandler` with `AuthMode: AuthModeProxy`, a non-nil `IAPAudience`, and a
non-nil `TokenLookup`, then issued `GET /api/link/github/install?collection_id=<uuid>` with no
Authorization header, no `x-farmtable-token`, no session cookie and no IAP assertion:

```
AUDIT RESULT: status=307 location="https://github.com/login/oauth/authorize?...&state=bf5fe652..."
```

**Control** (so a "no auth" result is not a harness artifact): the same `iapMiddleware` wrapping a
gRPC path, given a malformed assertion, returned **401**. The middleware rejects when it is in the
path — it simply is not in the path for `/api/link/*`.

Root cause, by identifier: in `UnifiedHandler`, `iapMiddleware` and
`SessionManager.SessionToBearerMiddleware` are applied **only to `grpcWebHandler`**.
`LinkFlowManager.RegisterRoutes` registers on the **bare `mux`**, so both wrappers are bypassed.
The callbacks' only gate is a `state` value the attacker mints himself at step 4–6.
(Probe was a throwaway `_test.go` in my `/tmp` clone, deleted; tree left clean, nothing committed.)

**Precondition (UNCHECKED, out-of-repo):** `NewLinkFlowManager` only populates a platform config if
`FARMTABLE_{GITHUB,JIRA,LINEAR}_CLIENT_ID` is set; otherwise every route returns **503** and the
finding is **inert**. There are **no deployment manifests in this repo** (no Cloud Run YAML, no
terraform — only `Dockerfile*`, `Makefile`, `.github/workflows/ci.yml`), so I cannot determine the
production value. **Someone must check the deployed env before this is actioned.**

## 5. What does the attacker get?

**Not a Farm Table token.** No path reachable without a credential mints an `ApiToken` — entries 9
and 10 are the only minting paths and both sit behind real identity verification.

What they get instead: they bind **their own** third-party OAuth token to a **collection UUID of
their choosing**, including a collection they have no rights to. `EntStore.CreateLinkedAccount` is a
plain `Create` — no ownership check, no dedup, no upsert — so they can attach arbitrarily many
linked accounts to any collection. Consequence is **credential injection, not credential theft**:
subsequent platform sync for that collection authenticates as the attacker, giving task-data
exfiltration through an attacker-controlled GitHub/Jira/Linear account and content injection back.

**Scope semantics — my answer does not depend on them.** Entries 1–6 are plain HTTP handlers that
never enter the gRPC scope layer, so neither "empty grants everything" nor "empty grants nothing"
changes this result. For the record, current semantics are **empty = wildcard**: `RequireScope`
returns `nil` when `len(scopes) == 0` (MEASURED). Two things worth handing to whoever owns that
flip: `ensureDashboardToken` creates its token with **no scopes set** — a wildcard today, inert
after the change; and `RequireScope`/`RequireCollectionAccess` both return `nil` outright when
`authEnforcedKey` is absent.

## 6. Reachability under IAP

Using the owner's three categories:

- **Reachable by an UNAUTHENTICATED stranger** — *only if* `/api/link/*` is exempted from IAP at the
  edge. This is a realistic configuration, because OAuth callbacks from an external IdP are a
  standard IAP-exemption. **UNCHECKED — out-of-repo.**
- **Reachable by an AUTHENTICATED user who should not have the privilege** — the expected case if
  IAP genuinely fronts every path. Any IAP-authenticated user can bind a linked account to any
  collection, including collections they cannot otherwise read. This is broken access control, and
  it is real work.
- **Reachable by NOBODY** — if no platform OAuth client ID is configured in production, all six
  routes return 503 and the item closes on that basis alone.

## Severity call

**Medium**, assuming the owner's standing position holds and IAP fronts every path — an
authenticated user reaching a privilege they should not have. **High** if `/api/link/*` is
IAP-exempt for callback delivery. **Not Critical** either way: no Farm Table credential is stolen or
minted, and there is no path to full compromise. Closes to **no finding** if the platform OAuth
client IDs are unset in production.

Two out-of-repo facts decide this, and I could not check either from the tree: (a) is `/api/link/*`
IAP-exempt, (b) are `FARMTABLE_{GITHUB,JIRA,LINEAR}_CLIENT_ID` set in prod.

## Secondary observation — not fixed, not scoped, surfacing only

`cmd/farmtable-server/main.go` sets `lookup` to nil when `FARMTABLE_OPEN_ACCESS=1` **or when
`FARMTABLE_TOKEN` is merely unset** (the latter logs only `WARNING: ... running in open access
mode`). `TokenAuthInterceptor(nil)` returns `handler(ctx, req)` unconditionally, and
`RequireIdentity`/`RequireScope`/`RequireCollectionAccess` all soft-pass when `authEnforcedKey` is
absent. In that configuration the entire 33-method gRPC surface — including token-write entry 7,
`CreateLinkedAccount` — is unauthenticated. This is a **default-open failure mode on a missing env
var**, distinct from the deliberate `FARMTABLE_OPEN_ACCESS` switch. Worth its own item; I did not
scope it.

## Positive observations

- Entries 9 and 10, the only two paths that mint a Farm Table token, are both correctly gated.
- `main.go` hard-fails (`log.Fatal`) when `AuthModeProxy` is set without `FARMTABLE_IAP_AUDIENCE`,
  explicitly to prevent accepting any valid IAP JWT — good, and correctly reasoned in-comment.
- Token comparison uses SHA-256 hashes with `crypto/subtle` available; raw tokens are not stored.
- `LinkedAccount` credentials are encrypted at rest when `credentialEncryptor` is configured.
- `handleLogin` bounds the request body with `io.LimitReader(r.Body, 4096)`.
- The `iapMiddleware` session-token guard avoids minting a new token row per request — a real bug
  someone already found and fixed.

## Method notes

- Every count above carries its denominator. Both cross-checked negatives used two independent
  instruments; the reachability claim in §4 was settled by **execution with a passing control**,
  not by grep.
- `go vet ./...` / `go build ./...` are **not usable as evidence in this tree**: `web/dist` is
  absent, so `assets.go`'s `//go:embed all:web/dist` fails pattern expansion and `go list ./...`
  reports `pattern all:web/dist: no matching files found`. I confirmed this rather than assuming it,
  and I did **not** create `web/dist`. `internal/serverapp` compiles on its own, which is what let
  the runtime probe run.
- Citations are by identifier throughout; no line numbers.
