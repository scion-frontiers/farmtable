# Clean-clone build and `make lint`

Date: 2026-07-29
Branch: `fix/clean-clone-build` (based on `faf1c8c`)
Agent: dev-ci-build (CI-GREEN track)

## Defect 1: a clean clone could not build

`assets.go` declared `//go:embed all:web/dist`, but `web/dist` was produced
only by the frontend build and was never tracked. The `dist/` rule in
`.gitignore` excluded it.

In a pristine clone the embed pattern matched nothing, and because the failure
happens at pattern-match time it took down the whole module rather than one
package.

Measured before the fix, at `faf1c8c`:

| Command | Exit | Packages processed |
|---|---|---|
| `go list ./...` | 1 | 0 |
| `go build ./...` | 1 | 0 |
| `go vet ./...` | 1 | 0 |
| `go test ./...` | 1 | 4 setup failures |

The single error in every case was
`assets.go:5:12: pattern all:web/dist: no matching files found`.
The four setup failures were `farmtable`, `cmd/farmtable-server`, `cmd/ft` and
`internal/cli` — the packages that import the root package. The other 28 were
fine, and `internal/server` was never affected. `go list -e ./...` still
enumerated 32 packages, which is how we know the module was otherwise intact.

CI did not catch this because the workflow runs the web build before any Go
command, so `web/dist` always existed by the time Go ran.

### Fix

Track a placeholder, `web/dist/.gitkeep`, so the embed resolves with no
frontend build.

The `.gitignore` mechanics matter and are easy to get wrong. `dist/` excludes
the *directory*, and **git will not re-include a file inside an excluded
directory**, so a plain `git add web/dist/.gitkeep` is refused. `git add -f`
would work but would make the file tracked by force rather than by rule, so
nobody could reproduce the state. The working pattern is a trio:

```gitignore
!web/dist/        # un-exclude the directory
web/dist/*        # re-exclude everything in it
!web/dist/.gitkeep # exempt the placeholder
```

Verified in a scratch repo, querying **inside paths** rather than the bare
directory (a bare-directory `git check-ignore` is state-dependent and
misreports when the directory is absent), with a near-miss control to prove the
query discriminates:

| Path | Before trio | After trio |
|---|---|---|
| `web/dist/.gitkeep` | IGNORED | tracked-able |
| `web/dist/index.html` | IGNORED | IGNORED |
| `web/dist/assets/app.js` | IGNORED | IGNORED |
| `web/notdist/keep.js` (control) | tracked-able | tracked-able |

So real build output stays fully ignored and only the placeholder is tracked.

### Stub guard

A tree holding only the placeholder embeds a *stub*. Both call sites did
`fs.Sub(WebAssets, "web/dist")` and would have served an empty filesystem — a
blank dashboard, with no error. `assets.go` now exposes `WebUI()`, which
returns `ErrWebAssetsNotBuilt` when `index.html` is missing;
`cmd/farmtable-server/main.go` and `internal/cli/dashboard.go` both use it.

Guard proven in both directions before committing: with only the placeholder it
fires; with a synthetic `index.html` present it stays silent and returns the
filesystem.

## Defect 2: `make lint` was broken and unexercised

The target ran `buf lint proto` then `go vet ./...`. It could not pass
anywhere: `buf` is an external CLI that is not installed in this environment,
and `go vet ./...` aborted at zero packages. No workflow invoked the target, so
neither failure was ever visible.

Split into `lint` (runs `lint-go`, i.e. `go vet ./...`, needing nothing but the
Go toolchain) and `lint-proto` (proto linting, which checks for `buf` and fails
with an install hint when absent, so a missing linter is never mistaken for a
pass).

The stale comment on `build: web` was also corrected. It claimed a fresh clone
could not compile without the frontend build; that is no longer true. The
dependency stays because the placeholder is a stub and shipped binaries need
real assets.

## Four copylocks findings surfaced, and were fixed

Fixing the embed made `go vet ./...` analyse packages for the first time, which
surfaced four pre-existing `assignment copies lock value` findings at
`internal/server/server.go` 1500, 1610, 1818, 1995. **These were not a
regression.** They were always present — `internal/server` vets dirty in
isolation in a pristine tree — and were merely unreachable through `./...`
while vet aborted at zero packages.

Each site built an ephemeral-store request with `ephReq := *req`. Protobuf
messages embed `protoimpl.MessageState`, which contains a `sync.Mutex`, so the
shallow copy copies a lock. Fixed with `proto.Clone`, not by taking a pointer:
each site mutates `CollectionId` (and `RootTaskId`) on the copy, so it needs an
independent message rather than an alias that would corrupt the caller's
request. Nine lines changed, kept in a separate commit so it can be reverted
independently of the embed fix.

## Acceptance

Verified in a **fresh clone of the branch** with no web build ever run
(`web/dist` contains only `.gitkeep`, `web/node_modules` absent):

| Command | Before | After |
|---|---|---|
| `go list ./...` | exit 1, 0 pkgs | exit 0, 32 pkgs |
| `go build ./...` | exit 1, 0 pkgs | exit 0 |
| `go vet ./...` | exit 1, 0 pkgs | exit 0, 0 findings |
| `go test ./...` | exit 1, 4 setup failures | exit 0, 0 setup failures |
| `make lint` | could not pass | exit 0 |

## Note for CI wiring

`make lint` needs no new tooling and can be wired into the workflow as-is.
`make lint-proto` requires the `buf` CLI to be installed first; its
`buf lint proto` invocation is unverified here because `buf` is not available
in this environment. Sequencing matters: wiring lint in *before* the embed fix
would have proven nothing, since vet analysed zero packages. After this branch
it is meaningful, and it is green.
