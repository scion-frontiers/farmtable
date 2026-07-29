# 2026-07-29 — Phase 2 web UI rebased onto real main (CI-bearing)

**Branch:** `phase2-web-ui-r5` · **Base:** `cc92735` (real main, "Merge PR #205: stand up CI on GitHub Actions")
**Source:** `refs/preserve/phase2-r5/attention-view-8fa5762` (NOT the branch `attention-view`, which is stale at `633f8f2`)
**Result:** `4f30c4e` · preserved at `refs/preserve/phase2/rebased-4f30c4e23154a3a8963806080cf48aaa82270706`

## Why

The Phase 2 line did not contain `.github/workflows/ci.yml`. Pushing it produced
**no CI run at all**, and no run is indistinguishable from a green one. This rebase
puts the Phase 2 work on top of the CI stack so that a push produces a real signal.

## Starting point

`attention-view` points at `633f8f2` and is **five commits behind** the round-5 fix
pass. Those five commits were unreferenced objects until anchored at
`refs/preserve/phase2-r5/attention-view-8fa5762`. Branching from the branch ref would
have silently dropped the entire round-5 fix pass. Verified before starting:

    git rev-list --count 633f8f2..8fa5762   = 5
    git cat-file -e cc92735:.github/workflows/ci.yml  -> present
    git cat-file -e 8fa5762:.github/workflows/ci.yml  -> absent

## Conflicts hit

**None.** The rebase of 38 commits onto `cc92735` completed with zero conflicts.

The brief anticipated conflicts in `web/package.json`, `package-lock.json`,
`tsconfig*.json` and possibly `Makefile`. None occurred, because the two lines are
disjoint at file level: main's 12 CI commits touch only `Makefile`,
`.github/workflows/ci.yml`, `scripts/ci-suite-manifest.mjs`, `scripts/test-changed.sh`
and one project-log file, while the Phase 2 line is almost entirely under `web/`.
`Makefile` was the only shared file and the edits fell in different regions.

Because there were no conflicts, **no test-list or script-list was resolved by
picking a side.** Verified independently rather than assumed — the test-file
inventory is byte-identical before and after:

    diff <(git ls-tree -r --name-only 8fa5762     | grep -E '\.(test|spec)\.' | sort) \
         <(git ls-tree -r --name-only phase2-web-ui-r5 | grep -E '\.(test|spec)\.' | sort)
    -> no differences (27 files both sides)

## 44 commits in, 38 replayed — accounted for

The rebase reported `Rebasing (1/38)` against a 44-commit range. The 6-commit gap is
exactly the 6 merge commits in that range, which a non-interactive rebase flattens:

    git rev-list --count cc92735..8fa5762            = 44
    git rev-list --count --no-merges cc92735..8fa5762 = 38
    git rev-list --count --merges    cc92735..8fa5762 =  6

No content was lost to the flattening. The proof is the rebase diff below, which
contains only main's additions.

## Rebase diff — nothing changed beyond picking up main

    git diff 8fa5762..phase2-web-ui-r5 --stat
     .design/project-log/2026-07-29-ci-github-actions-setup.md |  76 +++++++++
     .github/workflows/ci.yml                                  | 185 ++++++++++++++++++++
     Makefile                                                  |  65 ++++++-
     scripts/ci-suite-manifest.mjs                             | 190 +++++++++++++++++++++
     scripts/test-changed.sh                                   | 143 ++++++++++++++++
     5 files changed, 650 insertions(+), 9 deletions(-)

This is precisely main's own contribution over the merge base — same file set, same
650/9 line counts. The rebase introduced **no** change of its own to any Phase 2 file.

## Verification

    git rev-list --count phase2-web-ui-r5..cc92735          = 0
    git cat-file -e phase2-web-ui-r5:.github/workflows/ci.yml -> exit 0

## Test counts — before and after

Identical on both sides of the rebase (`npm test` in `web/`, exit 0):

| | before (`8fa5762`) | after (`4f30c4e`) |
|---|---|---|
| `test:node` (`scripts/run-node-tests.mjs`) | 4 scripts passed | 4 scripts passed |
| `test:components` (`vitest run`) | 22 files, 422 tests passed | 22 files, 422 tests passed |
| exit code | 0 | 0 |

Node scripts both sides: `rank`, `safe-url`, `task-state-utils`, `task-ready`.

`npm run build` was deliberately NOT run: it is `tsc --noEmit && vite build`, and
`vite build` writes `web/dist`, which is forbidden here.

## Open finding — this branch will go RED at the CI membership gate

Not a rebase defect, and deliberately **not** fixed here. Reported for a decision.

`ci.yml` runs `node scripts/ci-suite-manifest.mjs` as a gate step. That check is
fail-closed by design ("A check that cannot see is not a check that passes"). It
analyses `web/package.json` `"test"` and maps each leaf command to the test files it
executes. On this branch it cannot analyse one leaf:

    COULD NOT ANALYSE (1):
      node scripts/run-node-tests.mjs -> cannot map 'scripts/run-node-tests.mjs'
                                         to a tracked test file
    FAIL: the set of test files that exist and the set that run do not match.

The cause is a benign collision of two independently-correct designs:

- main's checker was written when the JS wiring **named every test file explicitly**,
  so it expects `node <a-test-file>`.
- the Phase 2 line replaced that with a **glob-based** runner
  (`web/scripts/run-node-tests.mjs`, which walks `src/**/*.test.ts`), so the leaf
  command is the runner, not a test file.

**No suite is actually unexecuted.** The 4 `src` node tests run via the glob runner and
the 22 `web/test` files run via vitest auto-discovery; `NOT EXECUTED BY ANYTHING` is
empty. The failure is purely the fail-closed arm.

The fix is to teach `scripts/ci-suite-manifest.mjs` about the glob runner. That is a
change to main's CI infrastructure, so it is out of scope for this leg and is left for
the owner to direct. Worth noting the Phase 2 glob runner carries its own equivalent
guard — it compares source count to compiled count and fails if `tsconfig.test.json`'s
`include` list misses a file — so the membership property is still enforced, just by a
different mechanism than the one main's checker knows how to read.
