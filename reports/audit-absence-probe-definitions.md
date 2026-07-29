# Probe definitions and expected outcomes — absence-as-permission audit

**Why this file exists.** The probes below produced **no commits and no git objects**. They were
working-tree-only `_test.go` files, run and deleted. A ref sweep, a bundle and an fsck all
correctly report nothing to preserve. What somebody would otherwise re-derive from scratch is
*the arm definitions and their expected outcomes*, which are prose. That table is here, on the
shared volume, not only in a container.

**Measured at:** `7a2ad51`. **Canonical main at time of writing:** `2982ffd`.
**Module:** `github.com/farmtable-io/farmtable`.

## How to re-run

Two clones at `7a2ad51`: a **pristine** one for reads, and a **mutation** one carrying the probe.
Place the file at `internal/server/zz_probe_test.go`, package `server_test`. Run
`go test -run '^TestS…$' -v ./internal/server/`. Sample `git status --porcelain` and
`git diff --stat` after **each** run: porcelain must show exactly one untracked line and
`diff --stat` must be empty.

**Do not try to measure this from a separate module.** Go forbids external modules importing
`internal/…`; a `replace`-directive probe fails with
`use of internal package github.com/farmtable-io/farmtable/internal/server not allowed`. Farm
Table keeps essentially everything under `internal/`, so read-only external measurement is
unavailable for this codebase.

## Key technique

Never reach for the unexported `authEnforcedKey`. Plant it the way production does — run the
real `TokenAuthInterceptor` with a **non-nil** lookup and capture the context the handler
receives:

```go
type stubLookup struct{ res *server.TokenLookupResult; err error }
func (s stubLookup) LookupByHash(ctx context.Context, h string) (*server.TokenLookupResult, error) { return s.res, s.err }
func (s stubLookup) RecordUsage(ctx context.Context, id uuid.UUID) {}

// ctx carrying metadata.Pairs("x-farmtable-token", "any-token-value");
// the stub ignores the hash, so any token string works.
// FullMethod must NOT be GetVersion/GetStatus (those are exempt).
```

`TokenLookupResult{UserID, TokenID, ExpiresAt, Scopes, CollectionIDs}` — all exported.

## Arms and expected outcomes

| Arm | Setup | Expected (the finding) |
|---|---|---|
| **S1** | `TokenAuthInterceptor(nil)`, bare ctx | `handlerCalled=true err=<nil>` |
| **S1 control** | `TokenAuthInterceptor(stub)`, no credentials | `handlerCalled=false err=Unauthenticated: authentication required` |
| **S3** | `RequireScope(context.Background(), ScopeTaskWrite)` | `err=<nil>` |
| **S6** | enforced ctx, `Scopes: []string{}` | `err=<nil>` (empty = wildcard) |
| **S6 control** | enforced ctx, `Scopes: []string{ScopeTaskRead}` | `PermissionDenied: missing required scope "task:write"` |
| **S4** | `RequireCollectionAccess(context.Background(), uuid.New())` | `err=<nil>` |
| **S7** | enforced ctx, `CollectionIDs: []uuid.UUID{}` | `err=<nil>` |
| **S7 control** | enforced ctx, `CollectionIDs: [someOtherUUID]` | `PermissionDenied: token not authorized for collection …` |
| **S5** | `RequireIdentity(context.Background())` | `id=00000000-0000-0000-0000-000000000000 err=<nil>` |
| **S5 control** | enforced ctx | real UUID, `err=<nil>` |
| **S8** | `DefaultScopesForUserType(t)` for several `t` | see below |

**S8 full result — the recognised vocabulary is only three values:**

| userType | scopes | nil (⇒ wildcard via S6) |
|---|---|---|
| `agent` | `[task:read task:write task:claim collection:read]` | no |
| `human` | `[*]` | no |
| `admin` | `[*]` | no |
| `service` | `[]` | **yes** |
| `reviewr` | `[]` | **yes** |
| `""` | `[]` | **yes** |

`service` is the load-bearing case: not a typo, but a plausible-looking type name that silently
yields wildcard.

## Red target

**Every control must DENY and every absence must GRANT.** A probe run in which the controls also
pass proves nothing — it cannot distinguish "the absence grants" from "the harness never
reached the check". If a control ever returns `<nil>`, the harness is broken; do not record the
arm.

## Harness footgun found while running these

A positive control written as:

```bash
git merge-base --is-ancestor "$sha" "$canon"; echo "ref=[$(…)] rc=$?"
```

reports **rc=0 regardless**. Bash expands the command substitution before `$?`, so `$?` carries
the substitution's status, not the command's. This produced a *false control failure* that
briefly appeared to invalidate a correct measurement. Correct form:

```bash
git merge-base --is-ancestor "$sha" "$canon"; rc=$?; echo "rc=$rc"
```

Same class of defect as everything else this audit documents: the instrument was reporting on
itself.
