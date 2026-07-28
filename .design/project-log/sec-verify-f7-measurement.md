# sec-verify-f7: Measurement of Five Security Claims

**Date:** 2026-07-28
**Branch:** sec-verify
**Base:** 7a0f220 (= origin/main)
**Type:** Investigation / measurement only — **no production code changed**

## Summary

Five security claims (F7a–F7e) were surfaced in passing by an independent audit
(`audit-195-r9`) of an unrelated workstream and relayed as unverified hypotheses.
This log records the measurement of all five. Full report:
`/scion-volumes/scratchpad/projects/farmtable/reports/sec-verify-f7.md`.

Verification-first by explicit coordinator ruling: nothing here was fixed, and
two of the five are recommended for closure with no engineering action.

| claim | verdict | method |
|---|---|---|
| F7a `FARMTABLE_OPEN_ACCESS=1` fails open | **CONFIRMED, broader than described** | executed |
| F7b binds `0.0.0.0`, prints `localhost` | **CONFIRMED (narrow)** | executed |
| F7c permissive CORS ⇒ credentialed cross-origin write | **REFUTED as stated** | executed + spec |
| F7d empty scopes as wildcard | **CONFIRMED, broader than described** | code trace |
| F7e all `buf.validate` annotations inert | **CONFIRMED as to mechanism; risk over-claimed** | executed |

## Key findings

### F7a — the shipped default, not the env var, is the problem

`FARMTABLE_OPEN_ACCESS=1` does permit unauthenticated `CreateTask`/`UpdateTask`
end to end (measured against a real TCP listener with a credential-free gRPC
client; the run without the env var rejects with `Unauthenticated` as a positive
control).

The finding as relayed was scoped to `internal/cli/dashboard.go`. It missed that
`cmd/farmtable-server/main.go:68-70` **also fails open when `FARMTABLE_TOKEN` is
simply unset** — no env var required. `Dockerfile.server` sets neither variable,
so a container built from this repo as committed exposes a world-writable API.
Measured in three arms (unset / token set / token set + override).

### F7c — the relayed reasoning had SameSite backwards

The server does reflect any `Origin` and returns `Access-Control-Allow-Credentials:
true` on the gRPC-web path. Three credentials are accepted (`Authorization: Bearer`,
`X-Farmtable-Token`, and the `farmtable_session` cookie alone via
`SessionToBearerMiddleware`); a fourth exists in proxy mode.

But `SameSite=Lax` is precisely what *prevents* the scripted cross-origin
credentialed request the finding describes, not a factor enabling it. Exposure
today is zero. The genuine (unmentioned) risk is that `Allow-Credentials: true`
with a reflected origin is held safe by a single cookie attribute at
`internal/serverapp/session.go:55`.

### F7e — "inert" is not "unvalidated"

**142** field-level `buf.validate` annotations (not "two"; two different spellings
of the enum constraint account for 45 of them and defeat single-pattern counting).
The runtime validator `buf.build/go/protovalidate` is **absent from `go.mod` and
`go.sum` entirely** — only the annotation descriptor package is present, so the
constraints could not be enforced even in principle.

However, **139 of 142 are independently enforced** by Ent schema validators,
`uuid.Parse`, or hand-rolled handler checks — verified by sending violating values
to a live server. The single RPC-input field that is both inert and genuinely
unvalidated is `UpdateTaskRequest.remote_url` (`proto/farmtable.proto:633`), which
accepts `javascript:` and `data:` URIs verbatim. That field is already owned by
the separate URL-validation track.

### F7d — escalation is remote and invisible

The `default:` branch of `DefaultScopesForUserType` is reachable. Of 8 paths that
set a user type (reported as a **lower bound**), 0 validate against a closed list
and 2 carry controlled input: the CLI `--type` flag and — not previously noted —
the `ImportCollection` RPC, escalating `collection:admin` to wildcard remotely.
`internal/server/convert.go:211` renders any unrecognised type as `AGENT`, so an
escalated account looks normal in CLI, dashboard, and MCP.

## Recommended disposition

Two of five warrant engineering work: **F7a** (the unset-token default) and
**F7d**. F7c should be closed as described, F7e's "whole-schema" framing dropped,
and F7b folded into F7a.

## Verification

Probes ran from a separate Go module in `/tmp` (`replace` → `/workspace`); no file
in the repository was created, modified, or deleted by the investigation.

- `go build ./...` → 0
- `go test ./...` → 0, 10 packages ok, 0 failing test names
- `go vet ./...` → 1, exactly 4 pre-existing copylocks (`internal/server/server.go`
  1500/1610/1818/1995), messages unchanged
- `git status --porcelain` → empty

## Gotchas for the next investigator

- **Bash truncates strings at NUL.** `curl --data-binary $'\x00\x00\x00\x00\x00'`
  sends an *empty* body, and the gRPC-web handler then returns `Grpc-Status: 2 / EOF`
  identically for authenticated and unauthenticated requests — a framing error that
  reads exactly like a result. Build binary frames into a file first.
- Counting `buf.validate` constraints with one literal pattern undercounts: both
  `(buf.validate.field).enum.defined_only = true` and
  `(buf.validate.field).enum = {defined_only: true}` occur.
- `proto/farmtable.proto:343` is `Task.remote_url` (output-only); the write-boundary
  field is `:633`, `UpdateTaskRequest.remote_url`. Easy to swap, opposite risk.
