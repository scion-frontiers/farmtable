# CI workflow guards: making the gates actually fire

Date: 2026-07-29
Branch: `fix/ci-workflow-guards`
Scope: `.github/workflows/ci.yml` plus one new companion file,
`.github/expected-go-tests.txt`.

Every guard in this workflow had been written but never observed firing. The
work below fixes six reported defects and, for each one, plants a canary that
drives the guard red, confirms it goes red, removes the canary, and confirms it
returns green. No canary is committed.

## Method: canaries run the shipped script, not a copy

Canaries execute the actual `run:` block extracted verbatim from `ci.yml` under
the same shell GitHub uses (`bash --noprofile --norc -eo pipefail`). Testing a
retyped copy of a grep proves nothing about the grep that ships.

All Go fixtures are **real captured `go test` output**, never hand-typed lines:

| Fixture | Source |
|---|---|
| green log, 2220 lines | artifact of run `30457818557` (head `faf1c8c`, success) |
| failing log | artifact of run `30421407653` (head `cc92735`, failure) |
| local full-suite log | `go test ./... -v` on this tree, 501 tests, exit 0 |

The local run and the green run artifact produce **byte-identical** membership
(501 package-qualified pairs), so the committed manifest is valid for both
`cc92735` and `faf1c8c`.

## Defect 1 — the failure summary matched nothing, ever

`ci.yml:169` was `grep -E '^(--- FAIL|FAIL|ok  ) '`. The trailing **space**
broke three of the four forms `go test` emits, independently:

- `FAIL<TAB>pkg<TAB>0.00s` and `FAIL<TAB>pkg [setup failed]` — a TAB follows
- `--- FAIL: TestName (0.00s)` — a COLON follows
- `FAIL` (bare, last line of a failing run) — nothing follows at all

Only `ok  <TAB>pkg` matched, by accident, because `go` happens to emit two
spaces after `ok`. The step therefore printed the word `none` under
"failures, if any" on every run this repository has ever produced — including
run `30421407653`, whose log carries **5 real failure lines and 2 genuinely
failing tests**. Measured: the old expression matched **0 of 5**.

Fixed with tab-anchored alternatives covering all four forms, and the trailing
`|| echo "none"` replaced by an explicit **count**, so a summary that is empty
because nothing failed cannot be confused with one that is empty because the
expression stopped matching.

Two further hardenings in the same step:

- A **parser self-check**: if not one package result line can be recognised,
  the log is truncated or `go`'s format moved, and the step fails rather than
  reporting "no failures" from an unparseable file.
- The step now **fails on failure lines itself**, independently of the `go test`
  step's exit status. This workflow's first run went green while a Go test was
  failing, because a missing `pipefail` let `tee` report success; a summary step
  that can see failures and still exit 0 leaves that hole open from the far side.

## Defect 2 — absent evidence was a warning

`if-no-files-found: warn` meant that if the evidence logs were missing the
upload printed a warning and the job stayed green: an evidence gate that passes
when there is no evidence. Now `error`. `go-test-failures.txt` was added to the
uploaded set.

## Defect 3 — NOT A DEFECT, report was stale

The recorded defect said CI cannot see its own branches. It can. Measured on the
real repository (`scion-frontiers/farmtable`), pushes to a non-main branch do
produce runs:

```
push branch=ci/22-github-actions-setup   (6 runs)
pull_request branch=ci/22-github-actions-setup   (6 runs)
```

`on.push.branches: ['**']` works as written, and the duplicate push +
pull_request pairs the header comment predicts are visible in the history. No
change made. Inventing a fix here would have been a change with no defect
behind it.

## Defect 4 — membership keyed bare test names, and a red vanished

`ci.yml:161` keyed membership on the bare test name, dropping the package. On
the green run artifact that collapsed **501 real tests into 499 rows**:
`internal/server` and `internal/store` each define `TestListUsers` and
`TestGetUser`.

That is not a cosmetic undercount. A failing test merges into a passing test of
the same name and the failing one is what disappears. Membership is now keyed on
`package<TAB>test`, derived by attributing each block of `=== RUN` lines to the
package named by the terminator line (`ok  <TAB>pkg` / `FAIL<TAB>pkg`) that
closes the block. Tests whose package never reported a result at all are
emitted as `(unterminated)` and fail the step, because that is unaccounted-for
evidence rather than a pass.

## Defect 5 — membership was reported, never asserted

The step counted executed tests and uploaded the list. It never compared that
list to anything, so a Go test that silently stopped running left CI green — the
same defect class as the JS manifest checks, which do fail closed.

Executed membership is now diffed against a committed manifest,
`.github/expected-go-tests.txt` (501 package-qualified entries, seeded from the
run above). The comparison is deliberately **asymmetric**:

- **Missing** (expected, not executed) → **fail**. This is the regression the
  gate exists for.
- **Unexpected** (executed, not expected) → **report only**. Adding a test is
  not a defect, and forcing a manifest edit in the same commit trains people to
  regenerate the manifest reflexively — which is precisely how a genuinely
  missing test would get rubber-stamped back to green.

`LC_ALL=C` is exported so the sort that produced the manifest and the `comm`
that consumes it cannot disagree over locale.

## Defect 6 — NOT A DEFECT, the workflow file parses clean

`gh run rerun` is refused with "its workflow file may be broken". That message
is generic, not literal. Evidence:

- `actionlint` on the exact file at `cc92735` — the file run `30421407653`
  actually used — reports **zero findings**.
- `actionlint` on the modified file — **zero findings**.
- The Actions API reports the workflow as `state=active`.
- The workflow has executed 13 runs, on two branches, on both event types.

No fix made.

## web/dist: existence replaced by content

`web/dist/.gitkeep` is now tracked (branch `fix/clean-clone-build`), so
`[ -e web/dist ]` is always true and the old "assert web/dist is absent" step
would have gone red the moment that merged.

- **Pre-build** now asserts that web/dist contains nothing git does not track.
  The allowed set is defined as "whatever `git ls-files` reports here" rather
  than a hardcoded `.gitkeep`, so it stays correct if the placeholder is renamed
  or added to. A committed real build or a cache-restored dist still goes red.
- **Post-build** now asserts **content**, which is what existence used to stand
  in for: `index.html` present, over 200 bytes, and referencing a hashed bundle;
  hashed `index-*.js` and `index-*.css` present; total file count above a floor
  of 500 (the real build is 4109 files, so the floor tolerates churn while no
  stub can clear it).

The header comment previously read "Do NOT fix this by committing web/dist."
That instruction has been narrowed rather than abandoned, and the comment now
records why: the placeholder is an empty marker, `assets.go`'s `WebUI()` returns
`ErrWebAssetsNotBuilt` when `index.html` is absent from the embed so a stub
cannot be served silently, and the content check above carries the guarantee
that existence used to. Commit the marker, never the build.

## Canary results

27 canaries, all observed red-then-green. Highlights:

| Guard | Canary | Result |
|---|---|---|
| Defect 1 form A | real `ok  <TAB>pkg` line flipped to real `FAIL<TAB>pkg` | old expr `none` → new RED → GREEN |
| Defect 1 form B | real `--- FAIL: TestListUsers` spliced from run `30421407653` | old expr `none` → new RED → GREEN |
| Defect 1 form C | bare trailing `FAIL` | old expr `none` → new RED → GREEN |
| Defect 1 self-check | package result lines stripped | RED → GREEN |
| Defect 4 | deleted **only** `internal/store`'s `TestListUsers` | bare-name keying still reported it present; package-qualified gate went RED → GREEN |
| Defect 5 | `TestWatchTasks_NoInitial` removed from the run | RED → GREEN |
| Defect 5 | unexpected test not in manifest | reports, stays GREEN (by design) |
| Defect 5 | `go-test.log` deleted / manifest deleted | RED → GREEN |
| Item 9 | placeholder-only dist; stub index.html; bundles removed; below floor | RED ×4 → GREEN |
| Pre-build | untracked build output beside the placeholder | RED → GREEN |

Defect 2 is the one guard **not** canaried end to end: `if-no-files-found` is
behaviour inside `actions/upload-artifact`, which cannot be exercised without a
runner. The value was verified against that action's published `action.yml`
input schema (`warn` / `error` / `ignore`, default `warn`). Its red/green
observation has to happen on the first real run.

## Open item, escalated rather than worked around

`make lint` is wired in, and **it will red the gate on its first run**.

`go vet ./...` on this tree exits **1** with 4 findings, all pre-existing and all
in `internal/server/server.go` (lines 1500, 1610, 1818, 1995): `assignment
copies lock value` — `ephReq := *req` copies a protobuf message containing a
`sync.Mutex`. The code is unrelated to any CI work and predates it.

Per the track rule, the assertion was **not** weakened, disabled, or quarantined
to obtain green. The step ships as instructed and the finding is reported for a
fix-versus-quarantine decision. Placement was chosen so this is survivable: lint
runs *after* both suites, so a vet failure cannot take `go-test.log` down with
it and leave the membership gate reporting a missing log instead of the real
problem.

`make lint` also depends on the Makefile change on `fix/clean-clone-build` that
reduces `lint` to `go vet` and moves `buf` to `lint-proto`. On `main` today
`make lint` still runs `buf lint proto`, and `buf` is installed nowhere here, so
**this workflow change must not merge ahead of that Makefile change.**
