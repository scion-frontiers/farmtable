# Verification Evidence — Stage 4 Scope Vocabulary Extension

**Branch:** `auth-stage4-scope-ext` (not pushed)
**Repo:** `/workspace/farmtable-auth-scope-ext`
**Date:** 2026-07-26

## Files

| File | What it is |
|---|---|
| `scope-matrix-transcript.txt` | Transcript of `TestEvidence_Stage4ScopeMatrix` — real gRPC calls over bufconn with real tokens, one line per role/operation with the observed status code. This is the primary evidence. |
| `rpc-lifecycle-tests.txt` | Verbose run of the seven new RPC-level RBAC tests in `internal/server/rbac_test.go`. |
| `transition-table-tests.txt` | Verbose run of the `TransitionScope` table tests (all 15×15 stage pairs covered). |
| `full-suite.txt` | `go build ./...` + `go test ./...` — whole repo green. |
| `compat-findings.md` | Backward-compatibility investigation. |

## How the evidence was produced

Not mocks. `testutil.NewTestServerWithAuth` starts a real `grpc.Server` on a
bufconn listener with the production `TokenAuthInterceptor`, backed by a real
Ent/SQLite store. Tokens are minted through `store.CreateAPIToken` with scopes
from `server.DefaultScopesForUserType(...)` and presented as
`authorization: Bearer <token>` metadata. Every assertion below is an observed
gRPC status code from that stack.

Reproduce:

```bash
cd /workspace/farmtable-auth-scope-ext
go test ./internal/server/ -run TestEvidence_Stage4ScopeMatrix -v
```

## Claims and proof

Token scopes in play (logged at the top of the transcript):

```
agent         [task:read task:write task:claim collection:read]
reviewer      [task:read task:write task:claim task:accept task:close collection:read]
orchestrator  [task:read task:write task:claim task:accept task:close collection:read]
```

### (a) An agent-scoped token CANNOT accept from triage or close — PROVEN

```
agent  UpdateTask triage→ready       => PermissionDenied  missing required scope "task:accept"
agent  UpdateTask triage→working     => PermissionDenied  missing required scope "task:accept"
agent  CloseTask                     => PermissionDenied  missing required scope "task:close"
agent  UpdateTask working→completed  => PermissionDenied  missing required scope "task:close"
```

Both the direct close RPC and the UpdateTask-into-terminal-stage back door are
closed. Reopening is covered too:
`TestScopedToken_ReopenRequiresAccept` shows `completed → backlog` is
PermissionDenied for an agent and OK for a reviewer.

### (b) A reviewer/orchestrator-scoped token CAN do the full lifecycle — PROVEN

```
reviewer     UpdateTask triage→ready        => OK   (task:accept)
reviewer     ClaimTask  ready→working       => OK   (task:claim)
reviewer     UpdateTask working→in_review   => OK   (task:write)
reviewer     CloseTask  in_review→completed => OK   (task:close)
reviewer     UpdateTask completed→backlog   => OK   (task:accept, reopen)
orchestrator … identical, all OK
```

### (c) An agent-scoped token CAN still claim an already-accepted task — PROVEN

```
agent  ClaimTask  ready→working       => OK
agent  UpdateTask working→in_review   => OK
agent  UpdateTask working→blocked     => OK
```

Agents keep exactly the authority they had for accepted work. Non-stage field
updates on a triage task also still succeed under `task:write`
(`TestScopedToken_AgentCannotAcceptFromTriage`).

### (d) Claiming directly from triage is correctly rejected — PROVEN

```
agent         ClaimTask from triage => FailedPrecondition  task must be accepted before it can be claimed …
reviewer      ClaimTask from triage => FailedPrecondition  …
orchestrator  ClaimTask from triage => FailedPrecondition  …
admin (*)     ClaimTask from triage => FailedPrecondition  …
```

Rejected for **every** role including wildcard admin — it is a precondition, not
a permission. The transcript test also re-reads each task afterward and asserts
the stage is still `TRIAGE` and no assignee was set, proving the rejection
happens before any mutation.

### Backward compatibility — PROVEN

`TestScopedToken_LegacyNilScopesKeepLifecycleAccess`: a token with `nil` scopes
(pre-RBAC token) can still accept and close. Nil scopes remain wildcard.

## Whole-repo verification

`full-suite.txt`: `go build ./...` OK, `go test ./...` — all 10 packages with
tests report `ok`, zero `FAIL`. `go vet -tags integration ./internal/server/`
is clean apart from two pre-existing `copies lock value` warnings at
`server.go:1466` and `server.go:1576` (unrelated to this change, present on
`origin/main`).

## Deviations from the written spec — needs reviewer sign-off

The approved table has six rows. Two were generalized, both in the strict
direction, to close bypasses the spec text implies but the table does not
enumerate. Both are one-line entries in `transitionTable` and trivially
revertible.

1. **`triage → working / in_review / in_qa / deploying` requires `task:accept`**
   (spec table only lists `triage → accepted/backlog/ready`).
   Without this, an agent holding `task:claim` could move a triage task straight
   to `working` via UpdateTask and bypass the accept gate that ClaimTask
   enforces. The spec's own parenthetical — "task must already be
   accepted/backlog/ready/… — NOT triage" — is the justification.

2. **`terminal → any non-terminal` requires `task:accept`**
   (spec table only lists `terminal → triage/backlog`).
   Without this, `completed → working` would resolve to `task:claim` and an agent
   could resurrect a closed task. The spec's stated principle is
   "reopen = re-accept"; this applies it uniformly.

Also worth flagging, not a deviation:

- `from == to` (a no-op stage set on an ordinary field update) resolves to
  `task:write` rather than falling through the table.
- Unrecognized stage strings resolve to `task:write`, the pre-change baseline —
  no regression, and unreachable in practice because the handler validates the
  proto enum first.
- The proto `UserType` enum has no `reviewer`/`orchestrator` values. The store
  keeps user type as a free string so tokens for those types work, but such
  users serialize as `USER_TYPE_AGENT` in proto responses
  (`internal/server/convert.go:142-152`). Adding enum values is a proto change
  and was left out of scope.
