# 2026-07-29 — CI stood up on GitHub Actions

**Branch:** `ci/22-github-actions-setup` · **PR:** #205
**Full report:** `/scion-volumes/scratchpad/projects/farmtable/reports/ci-22-setup.md`

## What landed

- `.github/workflows/ci.yml` — runs on all PRs and pushes to any branch. Go 1.26.5
  (matching go.mod), Node 22, `npm ci` from `web/package-lock.json`, authenticating
  as `GITHUB_TOKEN`.
- `Makefile` — `build` now depends on `web`, and `test` runs both suites.
- `scripts/test-changed.sh` (`make test-changed`) — selective test runner for a dirty tree.
- `scripts/ci-suite-manifest.mjs` (`make suite-manifest`) — fails the build if a
  test file exists that nothing executes.

## Four findings worth remembering

**1. `make build` could not build a fresh clone.** `assets.go` embeds
`all:web/dist`; `dist/` is gitignored; nothing produced it. Fixed with a
prerequisite edge (`build: web`).

**2. Why nobody had noticed.** The canonical working copy carries a populated,
untracked, gitignored `web/dist` dated Jul 27 16:54 (measured by `scopedeny-93`
in a different clone). `go build ./...` therefore succeeded there while failing
in every fresh clone — and an untracked directory is invisible to `git status`
and to review. Two legs on two machines found the same defect from opposite ends.

> **The fix is NOT to commit `web/dist`.** That trades a broken build for a
> reproducible build of a stale asset tree. The workflow now asserts `web/dist`
> is absent before the build and present after, so the artefact must be produced
> by the run — and so that committing it reds the gate instead of hiding the problem.

**3. The gate's first run reported success while a Go test was failing inside
it.** GitHub's default step shell is `bash -e {0}` — `-e` *without* `pipefail`.
`go test ./... | tee log` reported `tee`'s exit status. Fixed with
`defaults.run.shell: bash` plus an explicit `set -o pipefail` in that step.

> **If a command's success is read through a pipe, what you read is the last
> stage.** `pipestatus`, `PIPESTATUS` and `pipefail` are spellings of that one
> fact, not three separate rules.

The brief warned about exactly this hazard — in the section about the Makefile.
I obeyed it there and nowhere else. **A warning scoped to a location is obeyed at
that location and nowhere else.**

**4. `TestWatchTasks_NoInitial` (`internal/server/watch_test.go:118`) fails on
~2 of 9 cold runs.** Two runs of the *identical commit* disagreed. It passes warm.
The test is not newly flaky, it is newly visible — every green this project has
seen was on a warm machine.

> **A brand-new gate which reds intermittently in its first week gets disabled,
> skipped or wrapped in `continue-on-error` by someone acting reasonably.**
> Don't. One flake on the first cold run is not one flaky test; it is the first
> member of a population of unknown size.

## Scope of the green — read before trusting it

The passing run covers `main` (`7a0f220`) only: 499 Go tests across 20 packages,
and **exactly one** JS/TS test file. It says nothing about the 22 commits ahead
on `task-state-web-ui-v2`, where the other 15 test files live — including all
four `safe-url` suites.

`url-binding-scan` **does not exist** anywhere in this repository; all 97 remote
branches were searched by filename and the canonical tree by content.

## Known gaps

- Codegen is gated by nothing: `build` does not run `buf generate` (plugin
  versions are pinned nowhere), so a `.proto` change with a stale `.pb.go`
  compiles clean. Fix once tools are pinned: a job that runs codegen and fails
  on a dirty tree.
- `make lint` (`buf lint`, `go vet`) does not run in CI.
- Integration tests (`-tags integration`) do not run — no Postgres service.
- `scripts/ci-suite-manifest.mjs` fails closed against the canonical branch's
  glob-based runner (`node scripts/run-node-tests.mjs`). Expected and measured;
  teach the script that leaf before pointing CI at that tree.
