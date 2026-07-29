# SHARED BASELINE BLOCK — #194 r9 @ 06f01d7

(Included verbatim in all three r9 review briefs. Kept as its own file so a correction lands once.)

## Your tree

Your working tree is `/workspace`. Confirm with `git rev-parse --show-toplevel`, and verify branch
`label-write-scope-r9` and commit **`06f01d7d6555a311fcd0728eac40335e654c1de6`**.
Base is **`158c8ae`** (`git merge-base HEAD 158c8ae` = `158c8ae`, so the branch is a clean
descendant). **Do NOT create any directory named in this brief.**

## READ THIS BEFORE YOU RUN A SINGLE GATE — a baseline correction I got wrong for many rounds

I have told previous legs, repeatedly and tagged `[MEASURED by me]`, that in this repository
`go vet ./...` exits 1 on **exactly 4 pre-existing copylocks**. That statement is **conditional on
build state I never disclosed, because I did not know it was there.**

`assets.go:5` is `//go:embed all:web/dist`. `web/dist` is **gitignored** — by the bare pattern
`dist/` at `.gitignore:17`, *not* by a literal `web/dist` entry, so grepping `.gitignore` for
`web/dist` finds nothing; confirm with `git check-ignore -v web/dist`, which reports
`.gitignore:17:dist/`. (Corrected after a leg caught the imprecise quotation.) It has
**zero tracked files** (`git ls-files web/dist` is empty). It is produced only by
`make web` = `cd web && npm ci && npm run build`. **No Go target depends on it.**

Two-arm control, `[MEASURED by me this session]`:

| arm | `go build ./...` | `go test ./...` | `go vet ./...` |
|---|---|---|---|
| **fresh `git clone`, no `web/dist`** | **exit 1** | **exit 1** | **exit 1, ZERO copylocks** |
| **built clone (yours)** | exit 0 | exit 0, 10 ok pkgs | exit 1, **4 copylocks** |

Fresh-clone failure message, all three commands:
`assets.go:5:12: pattern all:web/dist: no matching files found`
(plus `FAIL ... [setup failed]` for `farmtable`, `cmd/farmtable-server`, `cmd/ft`).

**Note the trap, because it is the whole lesson: BOTH ARMS EXIT 1.** The exit code is identical and
cannot tell them apart. Only the *messages* can. If you had "verified" my baseline by exit code you
would have confirmed it and learned nothing.

**I have pre-built `web/dist` into your clone** so the Go gates are meaningful. It is untracked and
will not appear in `git status --porcelain`. You are not being asked to fix this (it is task #100,
pre-existing, byte-identical to production, and the release container gets it right —
`Dockerfile.server` runs `npm run build` in a frontend stage and `COPY --from=frontend` before
`go build`). **Do not file it as a defect in this change.** It is disclosed because a baseline you
cannot reproduce is not a baseline.

## Baseline at `06f01d7` in a BUILT clone `[MEASURED by me in a clone of your exact commit]`

| check | result |
|---|---|
| `go build ./...` | exit 0 |
| `go test ./...` | **exit 0** |
| `go vet ./...` | exit 1 — exactly 4 copylocks, all in `internal/server/server.go` |
| `git status --porcelain` | empty |

The 4 vet lines, in full, so you can diff messages and not counts:

```
internal/server/server.go:1782:14: assignment copies lock value to ephReq: ...GetReadyTasksRequest contains ...MessageState contains sync.Mutex
internal/server/server.go:1892:14: assignment copies lock value to ephReq: ...GetBlockedTasksRequest contains ...MessageState contains sync.Mutex
internal/server/server.go:2100:13: assignment copies lock value to ephReq: ...GetCriticalPathRequest contains ...MessageState contains sync.Mutex
internal/server/server.go:2277:13: assignment copies lock value to ephReq: ...GetBottlenecksRequest contains ...MessageState contains sync.Mutex
```

These are pre-existing and out of scope. **Check the messages, not the count** — a different 4 is
not the same 4.

## Known flake

`internal/server` has a `TestWatchTasks_NoInitial` / `_Heartbeat` / `_ClosedEvent` flake at roughly
**8% per sequential full-suite run** (`watch_test.go:118: timed out waiting for event`); one leg
independently saw it fire 1 of 3 runs. A sibling leg also once saw `rbac_test.go:767
"database table is locked"`. **Read failing test NAMES, never counts.** If you run a mutation
matrix, exclude `TestWatchTasks` by `-run` selection and add a tripwire that greps for it, rather
than hoping.

## Rules

- **Do not push.** Do not modify production code. Probes and harnesses are fine; revert them and
  assert `git status --porcelain` is empty afterwards.
- **Revert by snapshot restore (`cp` from a `/tmp` copy), not `git checkout`.** A previous leg lost
  uncommitted work to `git checkout`; a snapshot restore is immune regardless of what is committed.
- **Exit codes come from the child process, never through a pipe.** (`cmd > f 2>&1; echo $?`, not
  `cmd | tail`. I made exactly this mistake this session and got an empty exit code.)
- **A negative claim needs a positive control.** Every one. A "nothing found" with no control is
  not a result.
- **Predict before measuring, and report your misses.** The single most valuable finding in the
  parallel XSS round came from a *wrong* prediction that its author chased.
- Tags: `[MEASURED]` = you ran it this session. `[MEASURED-BY-<x>]` = relayed, re-measure it.
- **Separate the observation from the inference and tag them differently.** A correct fact carrying
  a wrong inference is more dangerous than a wrong fact, because the fact survives verification and
  the inference rides in behind it. This bit me this session; do not inherit it.
- **My briefs have contained at least one error in every round for at least fifteen consecutive
  rounds.** Listing every place this brief is wrong is a **required deliverable**, not a courtesy.
