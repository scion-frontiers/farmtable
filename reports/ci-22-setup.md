# ci-22-setup — CI stood up for farmtable

**Author:** ci-22-setup (developer leg)
**Date:** 2026-07-29
**Brief:** `/scion-volumes/scratchpad/projects/farmtable/briefs/ci-22-setup.md` (incl. D4b amendment, 03:23Z)
**Branch:** `ci/22-github-actions-setup` @ `1d2863a`
**PR:** https://github.com/scion-frontiers/farmtable/pull/205 (open, `ci/22-github-actions-setup` → `main`)

Every claim below is marked **[M]** MEASURED (I ran it and read the output),
**[D]** DERIVED (follows from something measured, but not itself observed), or
**[U]** UNCHECKED (I believe it; I did not verify it).

---

## 0. The one-paragraph version

CI exists, runs on GitHub's runners, and has been **observed going red twice for
two different reasons and green afterwards** [M]. The most important thing this
task produced is not the gate — it is the discovery that **the first version of
the gate reported success while a Go test was failing inside it** [M]. That
defect is fixed and the fix is proven in isolation. Two things the coordinator
must act on: ~~`url-binding-scan` **does not exist anywhere in this repository**
[M]~~, and `TestWatchTasks_NoInitial` fails on roughly **2 cold runs in 7** [M].

> ### ⛔ STRUCK 2026-07-29 by reconcile-urlbindingscan — the sentence above is FALSE
> **Original wording preserved above per §3.5. It is struck, not rewritten.**
>
> **`url-binding-scan` DOES exist.** `web/src/util/url-binding-scan.test.ts`, blob
> `c8cb6993581fa202c44cf702f41680fa96442a78`, 68,066 bytes, created
> `f0ab53f85eb4ee3686168bfcea3ee51a3dba3763` at 2026-07-28T08:46:44Z — about 19 hours before
> this report was filed [M].
>
> **One-line reason:** the sweep behind this sentence covered **published refs only**, and the
> suite has never been pushed — six commits touch it and **zero** `refs/remotes/*` contain any
> of them (control: `origin/main` returns 7) [M]. **The zero was about publication, not
> existence.**
>
> The full population analysis, and why this measurement was *correct* while its conclusion was
> not, is in `reports/reconcile-urlbindingscan.md`. See also §5's strike, below.

---

## 1. D1 — Starting condition, re-measured

Measured in a fresh `git clone --no-hardlinks` of the repo, at
**`7a0f220dbd9332cb8db62138c841777432b4eda4`** (`origin/main`) [M].

**Correction to the brief's §2.** The brief stated the web side had multiple
vitest suites. At `origin/main` that is false [M]:

- `web/package.json` `"test"` is `tsc -p tsconfig.test.json && node .tmp-test/utils/task-ready.test.js` [M]
- there is **no vitest** in `web/package.json` dependencies at this SHA [M]
- there is exactly **one** test file under `web/`: `web/src/utils/task-ready.test.ts` [M]
- it uses a hand-rolled `assertEqual`, makes 9 assertions, and prints nothing on success [M]

The brief's description matches the *canonical* branch, not `main`. See §9.

**Base-SHA discrepancy, resolved.** The brief named `633f8f2` as canonical.
That commit **does not exist in my clone after `git fetch --prune`**, and is not
reachable from any remote branch [M]. `origin/task-state-web-ui-v2` is now
**`6c0fcfb`, 22 commits ahead of `main` and 0 behind** [M], re-measured
2026-07-29T03:51Z. The "39 commits ahead of `633f8f2`" figure I reported to the
coordinator earlier tonight is **stale and should not be quoted** [M]. I did not
determine whether the branch was rebased or the commit simply never reached
origin [U].

---

## 2. D2 — Corrected Makefile

Diff: `Makefile | 65 +++++++++++++--` [M]. Full file on the branch.

### The fresh-clone build defect

`assets.go:5` is `//go:embed all:web/dist` [M]. `.gitignore:17` is `dist/` [M].
Therefore on a fresh clone `web/dist` does not exist and `go build ./...` cannot
compile [D — and confirmed by the fix working, §2.3].

Original: `build: generate` → `go build ./...`. Nothing ever produced the
embedded assets [M]. **The build target could not build a fresh clone.**

Fix: `build: web`, where `web: web-deps` → `cd web && npm run build`.

### `generate` deliberately dropped from `build`

Approved by the coordinator before implementing. Rationale, all [M]: the
generated protobuf (`api/farmtable/v1/*.pb.go`) is committed; `buf.gen.yaml` is
v2 using `local:` plugins (`protoc-gen-go`, `protoc-gen-go-grpc`); there is no
`tools.go` and no go.mod `tool` directive, so **those plugin versions are pinned
nowhere**. Making every build depend on unpinned codegen binaries trades a
reproducible build for an unreproducible one. `generate` is preserved as its own
target. **The hole this leaves is named in D7 §12.1 — it is not left silent.**

### `test` must fail if either suite fails

Original: `test: go test ./...` — the web suite was **never run by `make test`** [M].

Fix uses prerequisites, not chained shell commands:

```make
test: test-go test-web
```

This is the point the brief warned about. Make stops at the first failing
prerequisite, so a Go failure cannot be masked by a later command's exit status
— unlike `go test ./... ; cd web && npm test`, which reports only the last
status. The Makefile carries the comment **"Do not collapse this into a single
recipe."** Proven on the runner: the `Makefile self-check` step runs `make test`
and passes [M, run 30420553718].

`generate`, `lint`, `web-dev`, `dashboard`, `decomposer` all preserved [M].
Added: `WEB_DEPS` marker-file target so `npm ci` is incremental rather than
re-running on every build [M].

---

## 3. D3 — Selective test path

**`make test-changed`** → `scripts/test-changed.sh` (143 lines, exec bit set) [M].

```
make test-changed                 # vs origin/main
BASE=HEAD~3 make test-changed     # vs anything
LIST_ONLY=1 make test-changed     # print the plan, run nothing
```

Works from a dirty tree: it unions committed (`BASE...HEAD`), unstaged, staged,
and untracked files [M]. Go changes map to package directories; `go.mod`/`go.sum`
escalate to all packages; anything under `web/` (excluding `dist`, `node_modules`)
runs the whole web suite. Each suite's status is captured separately so neither
can mask the other [M]. Verified from a dirty tree with `LIST_ONLY=1` [M].

**What it does NOT cover** — this is printed by the script itself on every run,
not merely documented:

- **Go: it runs tests in packages whose files changed. It does NOT run tests in
  packages that merely depend on them.** Change a signature in A, break B, and
  this will not tell you.
- Web is all-or-nothing: any `web/` change runs everything, none runs nothing.
- No integration tests (`-tags integration`), no lint, no vet.
- A package with no `_test.go` reports "no test files" and passes.

Every run ends with `SELECTIVE RUN -- THIS IS NOT THE FULL SUITE.` The risk this
guards against is its green being mistaken for the gate's green.

---

## 4. D4 — The workflow

`.github/workflows/ci.yml`, 147 lines [M].

| Requirement | Status |
|---|---|
| On PRs | `on: pull_request` [M] |
| On push to default branch | `push: branches: ['**']` — **any** branch [M] |
| Go installed, pinned | `actions/setup-go@v5`, `1.26.5`, matching go.mod [M] |
| Node installed, pinned | `actions/setup-node@v4`, `22` [M] |
| Uses `web/package-lock.json` | `npm ci` + `cache-dependency-path: web/package-lock.json` [M] |
| Authenticates as `GITHUB_TOKEN` | `token: ${{ github.token }}` [M] |
| Never references the CI PAT | no secret reference of any kind in the file [M] |

**Node 22 justification.** No `.nvmrc` exists, so this is a choice, not a
discovery [M]. Node 22 is the active LTS line and the lowest LTS satisfying the
strictest engine constraint in the lockfile — vite 6.4.3 requires
`^18.0.0 || ^20.0.0 || >=22.0.0` [M].

**Trigger scope.** Initially `branches: [main]`. The coordinator asked me to
confirm the scope; the gap was real and I widened it to `'**'` [M]. A gate that
watches only the default branch ignores every branch where work happens, and
that silence reads as a pass. Accepted cost: a branch with an open PR gets two
runs per push. Confirmed empirically — commit `1d2863a` produced runs
`30420550986` (push) and `30420553718` (pull_request) [M].

`permissions: contents: read`; `concurrency` with `cancel-in-progress` [M].

---

## 5. D4b — Suite membership, not exit codes

### The gate does not reach the tests through `make test`

Go and web suites are invoked **directly** as their own steps [M]. `make test`
runs afterwards as a separate **Makefile self-check** step. If my Makefile edit
were wrong, that step goes red — but coverage does not silently shrink, because
the gate never depended on it. This is exactly the coordinator's requirement:
the gate must not be load-bearing on my own Makefile edit.

### Membership check

`scripts/ci-suite-manifest.mjs` (190 lines) runs **before** the suites, so a
missing suite is reported as a missing suite rather than as a pass [M]. It
compares test files that *exist* against test files `npm test` *executes*, by
parsing the npm script graph. It is **fail-closed**: an unrecognised runner is a
failure, not a reassuring empty result. Verified locally on both the passing and
failing paths [M].

### EXECUTED SUITE NAMES — verbatim from run 30420553718 [M]

```
=== JS/TS TEST SUITE MEMBERSHIP ===
web/package.json "test" = "tsc -p tsconfig.test.json && node .tmp-test/utils/task-ready.test.js"

TEST FILES PRESENT IN TREE (1):
  web/src/utils/task-ready.test.ts

TEST FILES ACTUALLY EXECUTED BY `npm test` (1):
  web/src/utils/task-ready.test.ts

OK: every tracked JS/TS test file is executed by `npm test`.
```

Go side, same run [M]: **501 top-level test invocations / 499 unique test
names**, across **32 packages — 10 with tests (all `ok`), 22 with no test
files**. 0 FAIL, 0 SKIP.

> **Corrected.** An earlier draft of this report said "20 packages with tests,
> 44 without, 64 total." Those were **exact double-counts** (2×10, 2×22, 2×32):
> I counted package result lines on the whole-run log, in which the Go step's
> output appears twice. The corrected figures are confirmed two independent
> ways [M] — by isolating the `Go tests` step in the runner log, and by counting
> directories in the tree at `origin/main` (`32` dirs containing `.go`, `10`
> containing `_test.go`). Both methods agree exactly. See §13.

### ⚠️ safe-url and url-binding-scan — READ THIS

The coordinator asked me to look for these specifically because another fix in
flight is pinned by them.

~~**`url-binding-scan` DOES NOT EXIST.** [M] I searched all **97 remote branches**~~
~~for any file matching `url-binding` / `binding-scan`, and separately grepped the~~
~~canonical tree's file *contents* for the strings `url-binding`, `urlBinding`,~~
~~`binding-scan`. **Zero hits in both searches.** This suite is not in this~~
~~repository under that name. Whoever is blocked on it is blocked on something~~
~~that has not landed, or that is named differently. **This is merge-blocking for~~
~~another leg, not a detail of mine.**~~

> ### ⛔ STRUCK 2026-07-29 by reconcile-urlbindingscan — CONCLUSION FALSE, BOTH MEASUREMENTS TRUE
> **Original wording preserved above per §3.5, struck and not rewritten, because the fact that a
> careful measurement over a wrong population produced a confident false negative is the asset
> here — not the erratum.**
>
> **THE SUITE EXISTS.** `web/src/util/url-binding-scan.test.ts`, blob
> `c8cb6993581fa202c44cf702f41680fa96442a78`, 68,066 bytes [M]. Present in the trees of
> `d5e35a4869475cd79c3a46e791909a610d1ea8f2` (the pin held by dev-103-testlist),
> `e6bda7160b95da96dad3f1b8cddc0e2cc9ac8ab1` (the xss-r4 adjudication SHA), and the tips of
> local branches `url-scheme-validation-r5` and `-r6` [M]. Wired into `web/scripts/run-tests.mjs`
> [M]. **Absent** from `7a0f220`, `origin/task-state-web-ui-v2` and canonical `633f8f2` [M].
>
> **One-line reason the sweep missed it:** it has never been pushed. Six commits touch the file;
> **zero `refs/remotes/*` refs contain any of them**, against a live control of 7 for
> `origin/main` [M]. Not covered by either search: 205 `refs/heads/*`, 93 `refs/preserve/*`,
> `refs/stash` + 13 stash reflog entries, 125 sibling worktrees, and 4 worktrees nested inside
> canonical.
>
> **BOTH MEASUREMENTS IN THE STRUCK PARAGRAPH ARE TRUE.** The 97-branch sweep genuinely returns
> zero, and canonical genuinely does not contain the file. **Only the inference is wrong**, and
> the token was never the problem — the file is *literally named* `url-binding-scan.test.ts` and
> matches the search pattern on its first byte. A correctly-keyed search was run over a set that
> could not contain the answer.
>
> **The sentence "whoever is blocked on it is blocked on something that has not landed, or that
> is named differently" should not be relied on.** It has landed, on two local branches, and it
> is named exactly what the pin calls it. The pin is real and must not be weakened.
>
> **AND A CORRECTION TO THE CORRECTION:** the withdrawal in the coordinator ledger reads "IT IS
> IN CANONICAL RIGHT NOW." That is **also false at `633f8f2`** — `git merge-base --is-ancestor
> d5e35a4 633f8f2` returns rc=1 (control rc=0) [M]. **Pointing the gate at canonical does not
> pick up this suite**, and a gate aimed at a tree that cannot contain it emits a green rather
> than a red. Full analysis: `reports/reconcile-urlbindingscan.md`.

**`safe-url` EXISTS — but not on `main`.** [M] Four test files, all on
`origin/task-state-web-ui-v2` only:

```
web/src/util/safe-url.test.ts
web/test/ft-inspector-code.safe-url.test.ts
web/test/ft-inspector-meta.safe-url.test.ts
web/test/safe-url.contract.test.ts
(+ source: web/src/util/safe-url.ts)
```

**They were NOT executed by any run in this report**, because they are not on
the branch CI ran against [M]. See §9.

I ran my membership check against the canonical tree in a throwaway worktree
[M]: it finds all **16** test files there and reports all 16 as executed (via
`vitest run` auto-discovery plus a glob runner) — **including all four safe-url
suites**. So when CI is pointed at canonical, safe-url *will* run [D — static
analysis of canonical's wiring, not an observed run]. **But that run will fail
first**, for a reason I have measured and filed in §12.5.

---

## 6. D5 — Proof the gate can fail

> A GATE THAT HAS ONLY EVER BEEN OBSERVED PASSING HAS BEEN OBSERVED AGREEING, NOT GATING.

Both arms done, on GitHub's runners, as the coordinator directed.

### Arm A — failure through the step with the explicit `set -o pipefail`

A scratch Go test calling `t.Fatal` was committed (`7704ff0`), travelling the
exact `go test ... | tee` pipeline that swallowed a real failure in run 1.

- **Run https://github.com/scion-frontiers/farmtable/actions/runs/30420136763 — conclusion `failure`** [M]
- Red step: `Go tests (invoked directly)`; named failing test
  `TestCIGateProbe_DeliberateFailure` [M]
- Reverted in `9d0852f`; run `30420186230` → **`success`** [M]

### Arm B — failure through the workflow-level default ALONE

The coordinator's point: arm A proves the explicit line and says nothing about
`defaults.run.shell`, which is the defence every future step inherits and the
only one a contributor adding a step next month gets for free. Probe step
(`61e46fc`) with **no `set -o pipefail` of its own**: `false 2>&1 | tee ...`.

- **Run https://github.com/scion-frontiers/farmtable/actions/runs/30420276292 — conclusion `failure`** [M]
- Red step: `SCRATCH default-only pipefail probe` [M]
- Shell line from the log, which is the actual proof [M]:
  `shell: /usr/bin/bash --noprofile --norc -e -o pipefail {0}`

**The workflow-level default supplies pipefail. A future step that forgets the
explicit line is still protected** [M].

Reverted with `git revert` (`1d2863a`), **not** a history rewrite, so both red
runs remain verifiable.

### Green afterwards

- **https://github.com/scion-frontiers/farmtable/actions/runs/30420553718 — `success`**, all 16 steps green [M]
- **https://github.com/scion-frontiers/farmtable/actions/runs/30420550986 — `success`** [M]

### Run inventory [M]

| # | Run ID | Commit | Event | Conclusion | Why |
|---|---|---|---|---|---|
| 1 | 30419891173 | 2af583e | PR | **success** | **…while a Go test failed inside it. See §7.** |
| 2 | 30420136763 | 7704ff0 | PR | failure | Arm A — deliberate test failure |
| 3 | 30420186230 | 9d0852f | PR | success | probe reverted |
| 4 | 30420273953 | 61e46fc | push | failure | flake `TestWatchTasks_NoInitial` |
| 5 | 30420276292 | 61e46fc | PR | failure | **Arm B — default-only pipefail probe** |
| 6 | 30420550986 | 1d2863a | push | success | probe reverted |
| 7 | 30420553718 | 1d2863a | PR | success | probe reverted |
| 8 | 30420881695 | 1f57e23 | push | success | + web/dist built-not-inherited assertions |
| 9 | 30420883113 | 1f57e23 | PR | success | 18 steps green |
| 10 | 30420983616 | 4c2d754 | push | success | project-log entry |
| 11 | 30420985228 | 4c2d754 | PR | **success** | **final — PR check `SUCCESS`** |

No check was disabled, skipped, retried-until-green, or wrapped in
`continue-on-error` at any point [M].

---

## 7. THE FINDING — a green run over a failing test

**Run 1 (`30419891173`) reported `success` while `TestWatchTasks_NoInitial`
failed inside it** [M].

Root cause, read from the log [M]: GitHub's default step shell is
`/usr/bin/bash -e {0}` — `-e` **without** `pipefail`. My step was
`go test ./... -v 2>&1 | tee go-test.log`. `tee` exited 0, so the step exited 0,
so the job was green.

Fix: `defaults.run.shell: bash` (which is `bash --noprofile --norc -eo pipefail {0}`),
**plus** a redundant explicit `set -o pipefail` in that specific step, because it
should not depend on a setting several dozen lines away staying correct. Plus a
`|| true` guard on the membership grep, which under pipefail would otherwise fail
the reporting step when it legitimately matches nothing [M].

The transferable rule, in the coordinator's words:

> **IF A COMMAND'S SUCCESS IS READ THROUGH A PIPE, WHAT YOU READ IS THE LAST
> STAGE. `pipestatus`, `PIPESTATUS` AND `pipefail` ARE SPELLINGS OF THAT ONE
> FACT, NOT THREE SEPARATE RULES.**

The brief *did* warn about exactly this hazard — under D2, about the Makefile.
I obeyed it there and nowhere else:

> **A WARNING SCOPED TO A LOCATION IS OBEYED AT THAT LOCATION AND NOWHERE ELSE.**
>
> **I DEFENDED THE PLACE I HAD BEEN WARNED ABOUT AND NOT THE PLACE I HAD NOT.**

Filed by the coordinator as the 13th instance of *"an artefact that records a
concern was handled is indistinguishable from the concern having been handled."*

### Where my predictions were wrong

Predictions were pre-registered before every run in
`reports/_ci-22-run-predictions.md`, per the coordinator's standing instruction.
Two misses, reported as prominently as the successes:

1. **Run 1.** I predicted red at `make build` (tsc) or the Go suite, ~55%
   confidence the build would pass. `make build` passed first time — the missing
   `web` edge was the *entire* fresh-clone defect, with no second layer beneath
   it. The deeper miss, which I never wrote down and which is the one that
   mattered: **I ALSO PREDICTED A RED RUN WOULD BE VISIBLE AS A RED RUN, WHICH
   IS THE ASSUMPTION THAT ACTUALLY FAILED.**
2. **Run 4.** I predicted every step before the probe would be green. Instead
   the flake red-lined `Go tests` and the probe never executed. Arm B was only
   obtained because the sibling PR run of the *same commit* got past the flake.

### An accidental controlled experiment [M]

The same test, `TestWatchTasks_NoInitial`, failed in run 1 → **job GREEN**, and
failed in run 4 → **job RED**. Same test, same failure mode, same repo; the only
difference is the pipefail fix. The fix is therefore validated against a *real*
failure, not only against my synthetic probes.

---

## 8. Credential handling

- The CI PAT was never echoed, printed, logged, pasted, or committed [M].
- Authentication used an **env-only** credential helper, so nothing was written
  to disk [M]. Post-push audit: `.git/config` contains **0** matches for
  `helper|token|ghp_|github_pat` [M].
- Every `git remote` / push output was piped through
  `sed -E 's#//[^@]*@#//REDACTED@#g'` [M].
- **The workflow authenticates as `GITHUB_TOKEN` and references no PAT** [M].
- Only `ci/22-github-actions-setup` was pushed, containing only 4 files: the
  workflow, the Makefile, and two scripts [M]. Nothing merged; no push to `main`;
  no one else's commits pushed.

---

## 9. ⚠️ WHAT THE GREEN DOES AND DOES NOT COVER

**The green covers `7a0f220` (plus my 4 files). It says nothing whatsoever about
the 22 commits ahead of it on `origin/task-state-web-ui-v2`.** [M]

Concretely, what was actually verified green:

- **499 unique Go tests across 32 packages** — only **10 of those 32 have any
  tests at all** [M]
- exactly **one** JS/TS test file: `web/src/utils/task-ready.test.ts` [M]

What was **not** touched by any run in this report [M]:

- all **16** test files on canonical, including **all four `safe-url` suites**
- `web/test/` component suites (`ft-app`, `ft-kanban-view`, `ft-toolbar`,
  `ft-task-card`, `ft-filter-chips`, `ft-inspector-*`, `ft-ready-queue-view`,
  `queue-ordering`) — this entire directory does not exist on `main`
- `web/src/util/rank.test.ts`, `web/src/util/task-state-utils.test.ts`

**And: the PR that points this workflow at canonical will be the first time that
tree is compiled by anything.** Pushing canonical is the coordinator's job, not
mine, and I have not done it.

Canonical's test wiring is entirely different from `main`'s — `npm test` there is
`npm run test:node && npm run test:components` (a glob-based Node runner plus
`vitest run`), versus `main`'s single hardcoded file [M]. **The two npm `test`
definitions are mutually exclusive**; whichever survives the merge determines
what runs. Recorded as an observation at the coordinator's instruction; **not
acted on.**

---

## 10. D6 — Defects found, and one not reached

I expected the first run to fail and treated it as data. Nothing was disabled,
skipped, or wrapped in `continue-on-error` [M].

1. **`make build` could not build a fresh clone** — `//go:embed all:web/dist`
   with `dist/` gitignored and nothing producing it. Fixed (§2), and this was
   the *whole* defect [M]. **See §10.1 below for why nobody had noticed.**
2. **`make test` never ran the web suite** — `test:` was `go test ./...` only.
   Fixed (§2) [M].
3. **The gate itself reported green over a failing test.** The most serious
   defect found, and it was in *my* work. Fixed and proven both ways (§6, §7) [M].
4. **`TestWatchTasks_NoInitial` is unreliable on cold runners** — §11. Not fixed;
   the coordinator owns it and told me not to chase it.
5. **Trigger was scoped to `main` only.** Found by the coordinator's challenge,
   confirmed by me, fixed to `'**'` [M].

### 10.1 Why the fresh-clone failure stayed invisible — corroborated from the opposite end

**Measured by `scopedeny-93`, not by me** [M, second-hand — credit belongs to
that leg, working in a different clone on an unrelated task]: the canonical
working copy at `/workspace/farmtable` **carries a populated `web/dist` —
`favicon.svg`, `index.html`, `assets/`, `shoelace/` — dated Jul 27 16:54**. It
is untracked and gitignored, left behind by an npm build two days ago.

Composing that with my own measurement gives the fact neither of us could see
alone [D]:

> **`go build ./...` SUCCEEDS IN CANONICAL AND FAILS IN EVERY FRESH CLONE, AND
> THE DIFFERENCE IS AN UNTRACKED DIRECTORY THAT `git status` CANNOT SHOW YOU.**

I observed the failure on a machine with no artefact; that leg found the
artefact on the machine that does not fail. Two clones, no channel between us,
the same defect from both ends. This is the mechanism by which the defect
survived: an untracked, gitignored directory is invisible to `git status
--porcelain`, invisible to code review, and invisible to every developer whose
machine happens to have one. **Every green this project produced before tonight
was standing on that directory, and the project had no instrument capable of
noticing.** That is the argument for a runner, and it is not a capacity
argument — a GitHub runner is the only place in this project where a two-day-old
untracked directory cannot quietly make a build pass.

### 🚫 The fix must NOT be to commit `web/dist`

**Committing `web/dist` would turn the gate green by tracking the artefact, and
would buy a perfectly reproducible build of a stale asset tree — the same
receipt with better paperwork.** The correct fix is the prerequisite edge
`build: web`, which makes the build *produce* the assets; it is already merged
on this branch and already proven on a runner [M, §2].

This is now enforced mechanically rather than by documentation. The workflow
asserts `web/dist` is **absent before** the build and **present after** it, so
the artefact must be produced by the run:

- if someone responds to a red gate by committing `web/dist`, the pre-check
  reds instead [D]
- if a cache ever restores it, the pre-check reds instead [D]
- if `make build` stops producing it, the post-check reds [D]

Added in `1f57e23`. Both assertions pass on the runner [M, run 30420883113] —
`OK: web/dist absent on a clean checkout, as it must be.` before the build, and
after it:

```
OK: web/dist produced by this run. Contents:
drwxr-xr-x 2 runner runner 4096 Jul 29 03:56 assets
-rw-r--r-- 1 runner runner  168 Jul 29 03:56 favicon.svg
-rw-r--r-- 1 runner runner 1124 Jul 29 03:56 index.html
drwxr-xr-x 3 runner runner 4096 Jul 29 03:56 shoelace
```

**Same four entries as canonical's stale copy. Dated `Jul 29 03:56` — during
this run — against canonical's `Jul 27 16:54`.** That timestamp difference is
the entire finding, made visible.

The next person who sees this gate red for a missing `dist` should reach for the
prerequisite, not the commit.

### NOT REACHED — the size of the flake population

> **ONE FLAKE ON THE FIRST COLD RUN IS NOT ONE FLAKY TEST, IT IS THE FIRST
> MEMBER OF A POPULATION OF UNKNOWN SIZE.**

I have not established how large that population is, and **nothing in this
report should be read as evidence that `TestWatchTasks_NoInitial` is the only
one** [U].

**Falsifier:** run the full suite N times on cold runners and count *distinct*
failing tests. If the count stays at 1 over a meaningful N, the population is
one; if new names appear, it is not. Deliberately not run tonight, per the
coordinator.

---

## 11. ⚠️ The flake, and the warning that goes next to it

`internal/server/watch_test.go:118`, `TestWatchTasks_NoInitial`.

Measured across all 11 runs — the Go step executed in every one [M]:

| Runs where it executed | Failures |
|---|---|
| 11 | **2** (runs 30419891173, 30420273953) |

**18%, not "one flake."** Failure modes seen: `DeadlineExceeded` at 5.00s and
`timed out waiting for event` at 5.01s [M]. It passed warm in the same job where
it had failed cold (`ok ... 0.760s`) [M]. Most tellingly, **two runs of the
identical commit `61e46fc` disagreed** — the push run failed on it, the PR run
passed [M]. That is non-determinism, measured, not inferred.

> **EVERY GREEN THIS PROJECT HAS EVER SEEN WAS ON A WARM MACHINE. THE TEST IS
> NOT NEWLY FLAKY, IT IS NEWLY VISIBLE.**

And the warning the coordinator asked to be written here in these words:

> **IT IS THAT A BRAND-NEW GATE WHICH REDS INTERMITTENTLY IN ITS FIRST WEEK GETS
> DISABLED, SKIPPED OR WRAPPED IN `continue-on-error` BY SOMEONE ACTING
> REASONABLY.**

I did not do any of those three things, and the next person to see this red
should not either.

---

## 12. D7 — What I did not do

1. **Codegen is gated by nothing.** `build` no longer runs `buf generate`, so a
   `.proto` change committed with a stale `.pb.go` compiles clean and CI stays
   green. **Fix, filed not built:** a separate job that runs the codegen and
   fails on a dirty tree — viable only once the buf plugin versions are pinned
   (`tools.go` or a go.mod `tool` directive).
2. **`make lint` is not in CI** — neither `buf lint proto` nor `go vet ./...`
   runs on the runner. I added no linting the brief did not ask for.
3. **Integration tests do not run** — `-tags integration` needs live Postgres;
   no service container was added.
4. **I did not point CI at canonical, and did not push it.** Out of scope by
   instruction; that push is the coordinator's.
5. **I did not teach the membership script canonical's glob runner.** Measured
   [M]: run against `6c0fcfb`, `scripts/ci-suite-manifest.mjs` **exits 1** with
   `node scripts/run-node-tests.mjs -> cannot map 'scripts/run-node-tests.mjs'
   to a tracked test file`. This is fail-closed working as designed — but it
   means **the coordinator's first canonical run will red at that step.** Fix:
   teach the script that this leaf is a directory-walking runner covering
   `src/**/*.test.ts`. Filed, not built, per instruction — but filed *with the
   exact error string* so it is recognised on sight rather than debugged.
6. **I did not fix or investigate the flake.** Coordinator owns it.
7. **I ran no local builds** — no `go build`, `go test`, `npm ci`, `npm run
   build`, or `make` on this machine. Everything compiled was compiled on
   GitHub's runners. Local verification was limited to `node` and `git`.
8. **I did not add caching beyond the two actions' defaults**, no matrix, no
   multi-OS, no artifact retention tuning.
9. **I did not verify Go 1.26.5 exists in the setup-go index by reading the
   index** — I verified it by the step passing on the runner [M].

---

## 13. Observations recorded, not acted on

- **`CLAUDE.md` says "Never push from an agent session."** The brief (§0.7)
  granted a narrow exception for this one branch, which is what I used. The two
  documents conflict; the repo-level rule should probably be amended to name the
  exception, or the exception withdrawn. Flagging, not resolving [M].
- **Mutually exclusive `npm test` definitions** between `main` and canonical
  (§9). Observation only, per instruction [M].
- **22 of 32 Go packages have no test files at all** [M]. Not my call to make.
- **My own log-scanning gave THREE false readings tonight**, every one caught by
  cross-checking rather than by the instrument itself [M]:
  1. A grep for `--- FAIL` matched the *echoed command text* of the workflow
     step that runs that same grep — reporting a failure in a green run.
  2. An over-anchored regex reported the flake rate as 0%, when the validated
     pattern gives 2/11.
  3. Package counts were **exactly doubled** because the Go step's output
     appears twice in the whole-run log, and I counted the whole log.

  Recorded because it is the same shape as the finding this whole task turned
  on: **I read a log for a pattern and got back my own instrument.** Each was
  caught only because a second, differently-shaped measurement disagreed with
  the first — #3 by counting directories in the tree instead of lines in a log.
  **The lesson is not "grep carefully." It is that a single measurement of a log
  has no error term.** Anyone reusing the run IDs here should isolate the step
  first (`awk -F'\t' '$2=="Go tests (invoked directly)"'`) and re-derive counts,
  rather than trusting a summary — including this one.

---

## 14. POST-MERGE — the gate on `main` is RED, and it found a second test

PR #205 merged to `main` at 2026-07-29T04:07:20Z by `ptone`. Merge commit
**`cc927355e5a23c45bfd983cd331eb540b0a61ad5`**; `main` moved from `7a0f220` [M].

**First push-to-main run: https://github.com/scion-frontiers/farmtable/actions/runs/30421407653 — conclusion `failure`** [M].

Failing step: **`Go tests (invoked directly)`**. Everything before it green,
including both `web/dist` assertions. `Web tests` and `Makefile self-check`
skipped as a consequence [M].

Two tests failed [M]:

```
--- FAIL: TestListUsers (0.01s)
    identity_test.go:206: total = 3, want 2
--- FAIL: TestWatchTasks_NoInitial (5.00s)
    watch_test.go:118: timed out waiting for event
```

I did not fix it and did not revert it, per instruction.

### ⚠️ `TestListUsers` is a NEW failure, and it is not a timeout

> ### ⛔ WITHDRAWN FIGURE — read before using the number below
>
> An earlier version of this section said **"`TestListUsers` executed 22 times
> across the 11 pre-merge runs and failed 0 of them."** **That denominator is
> withdrawn.** It is preserved here rather than deleted so that a reader who
> already absorbed "22" meets its withdrawal, and a reader who has not cannot
> pick it up.
>
> **`TestListUsers` is a duplicated name.** Two distinct tests declare it —
> `internal/server/identity_test.go:184` and `internal/store/identity_test.go:92`
> [M]. The 22 was **11 runs × 2 distinct tests = 22 executions of a *name***,
> not 22 executions of the test that failed. Origin of the correction:
> `flakepop-81`'s tree-wide census (551 test functions declared, 549 unique
> names, exactly two duplicates: `TestListUsers` and `TestGetUser`), relayed by
> the coordinator; I re-derived the same figures from source at `origin/main`
> by a different route [M] — **but see the bound below before crediting that
> agreement.**
>
> **⚠️ BOUND ON THE REPRODUCTION — it is weaker than it looks.** The coordinator
> handed me `551 / 549 / {TestGetUser, TestListUsers}` *in the tasking*, before I
> counted. So:
>
> > **A REPRODUCTION THAT KNOWS ITS TARGET STOPS WHEN IT HITS THE TARGET.**
>
> Had my first count returned 552 I would have hunted the discrepancy; returning
> 551 ended the search. **The number and the stopping rule share a cause.** What
> is corroborated here is therefore **the method, not the number** — this is
> *one measurement by two routes with a shared expectation*, and must not be
> recorded as two independent measurements. Not redone; recorded at its true
> weight.

**Corrected: the test that failed is `internal/server`'s `TestListUsers`. It
executed 11 times across the 11 pre-merge runs and failed 0 of them. This is its
first observed failure** [M].

Disambiguated two independent ways [M]: (a) `identity_test.go:206` falls inside
`server`'s `TestListUsers` (declared at 184, next declaration at 210), and (b)
the red run reports `FAIL github.com/farmtable-io/farmtable/internal/server` while
`internal/store` is `ok`. Note that the filename alone cannot disambiguate —
**both files are named `identity_test.go`.**

It is also **a different species from the known flake.** `TestWatchTasks_NoInitial`
fails on a 5-second deadline — a timing failure. `TestListUsers` fails on
`total = 3, want 2`: **a count of rows, not a clock.** That is the signature of
cross-test pollution — a user created by another test surviving into this one —
which makes it order- or parallelism-dependent rather than load-dependent [D].
I did not confirm the mechanism [U].

This is the falsifier from §10 firing on its own, six minutes after I filed it:

> **ONE FLAKE ON THE FIRST COLD RUN IS NOT ONE FLAKY TEST, IT IS THE FIRST
> MEMBER OF A POPULATION OF UNKNOWN SIZE.**

The population is now **at least two, and the second member is not the same kind
of thing as the first** [M]. Any remediation scoped to "the flaky watch test"
is already too narrow.

### ⚠️ 14.1 THE GATE KEYS TEST IDENTITY ON THE BARE NAME — measured, not fixed

**Answer: BARE.** [M] The reporting step I wrote is:

```bash
grep -E '^=== RUN   Test[^/]*$' go-test.log | sed -E 's/^=== RUN   //' | sort -u > executed-go-tests.txt
```

`go test -v` emits `=== RUN   TestListUsers` with **no package qualifier**, and
`sort -u` then collapses across packages. For the two duplicated names, the gate
merges two distinct tests into one record.

**This is not a hypothetical masking risk — it happened in the red run.** In
run `30421407653`, both `TestListUsers` tests executed: **one PASSED and one
FAILED** in the same run [M]:

```
=== RUN   TestListUsers  : 2 occurrences
--- PASS: TestListUsers  : 1   (internal/store  -> ok)
--- FAIL: TestListUsers  : 1   (internal/server -> FAIL)
```

`executed-go-tests.txt` records that as **a single line reading `TestListUsers`**
— a green and a red merged into one entry, with the red the one that vanishes.

#### What that artefact is, stated plainly

**It is a TRUE DOCUMENT.** Every name in `executed-go-tests.txt` did execute.
Nothing in it is false. There is no line an auditor could point at and call
wrong. And it records a pass under a name that also failed — so a reader who
consults it to ask *"did `TestListUsers` run, and was it green?"* **gets a
correct answer to the question they asked and the wrong answer to the question
they meant.**

This is the hardest kind of bad receipt to find, because it is the only kind
that **survives a line-by-line audit intact**. Every technique that checks
whether an artefact's contents are true will pass it. The defect is not in any
statement; it is in what the document's *shape* implies about identity.

#### Blast radius — which emitted numbers inherit the error

Affected (all off by the duplicate factor of 2 names / 2 tests):

1. **`top-level Go tests executed: 499`** in `$GITHUB_STEP_SUMMARY` — counts
   unique *names*. Distinct tests executed is **501**. Undercounts by 2 [M].
2. **The `executed-go-tests.txt` artifact** — 499 lines for 501 tests; the
   `TestListUsers` and `TestGetUser` entries each stand for two different tests
   in two different packages [M].
3. **This report's "499 unique names"** wherever it appears (§5, §9, §14) — the
   figure is correct *as a count of names* and is now labelled as such, but it
   is **not** a count of tests.
4. **The failure list** (`grep -E '^(--- FAIL|FAIL)'`) prints
   `--- FAIL: TestListUsers` **with no package**, so a reader of the summary
   cannot tell which of the two failed [M]. That is how I initially mis-attributed
   the denominator — **the artefact taught me the wrong thing.** See §14.1.1.
5. **The withdrawn "22 executions"** denominator, above.

#### 14.1.1 The class: an output format is a theory of what things are

Generalising item (d), sharpened with the coordinator:

> **AN INSTRUMENT'S OUTPUT FORMAT IS A THEORY OF WHAT THINGS ARE, AND EVERY
> DOWNSTREAM READER ADOPTS THAT THEORY WITHOUT NOTICING THEY HAVE ADOPTED
> ANYTHING.**

Printing a bare test name is not a formatting choice. **It is an assertion that
a test name identifies a test.** That assertion is false in this repository for
two names, and every consumer of the output inherits it silently.

The evidence that this propagates rather than merely existing is that **it
infected both of us, in opposite directions, from the same channel** [M]: I
misread my own artefact and reported "22 executions, 0 failures"; the
coordinator carried that figure back to me as an established denominator. Two
people, one of whom built the instrument, neither careless. Neither of us made a
sloppy inference — **we correctly read a log that asserts something false about
identity.**

The defect travelled through the one channel nobody audits, which is **the shape
of the output**. Line-by-line review cannot catch it, because the lines are
true (§14.1). What would catch it is asking what the format claims, not what it
says.

**NOT affected — and this is the important boundary:** the gate's **red/green
verdict does not inherit the error.** Pass/fail comes from `go test`'s exit
status per package, propagated by `pipefail` — not from any name parsing. The
run went red correctly. **What is corrupted is the gate's per-test bookkeeping,
not its verdict** [M].

#### OPEN ITEM (not a remedy) — package-qualified test identity

Not fixed tonight, per instruction. **And re-filed deliberately as an OPEN ITEM
rather than as "a remedy awaiting implementation,"** under a rule adopted
tonight:

> **WHEN YOU NAME A PROPERTY, ASK WHAT GOES RED IF IT CHANGES.**

The candidate change is: key on `package + name` by parsing `go test -json`
(`.Package` + `.Test`) instead of grepping `-v` text. **But if someone later
reverts that to name-only parsing, nothing fails.** There is no test, no
assertion, and no gate step that would go red. A named-but-unpinned property is
an open item, not a finding — so the open question travels *with* it:

- **What goes red if package-qualified identity is removed again?** Currently:
  nothing. Until that has an answer, this stays open even if the parsing is
  changed, because changed-and-unpinned is one careless edit from where we are
  now.

By contrast, the `web/dist` absent-before/present-after assertion (§10.1) *does*
have an answer to that question — remove the property and the gate reds. That is
the difference between a fixed thing and a described thing.

#### Population of this sweep

Swept, in full: `reports/ci-22-setup.md`, `reports/_ci-22-run-predictions.md`,
`.design/project-log/2026-07-29-ci-github-actions-setup.md`,
`.github/workflows/ci.yml`, `scripts/ci-suite-manifest.mjs`,
`scripts/test-changed.sh`, `Makefile` [M]. Searched both line-wise and on a
**flattened** copy (`tr '\n' ' '`), because a single-line grep cannot see a
sentence that wraps across two lines and its zero is indistinguishable from
absence. One affected claim found and corrected; the other `22`s in these files
are Node 22, "22 commits ahead", and "22 packages with no tests" — unrelated [M].

**Explicitly NOT covered:** any unpublished or unpushed work by other legs — I
did not and cannot see it. My own clone has **0 unpushed commits and a clean
tree** [M]. The merged project-log entry still carries the superseded "499 Go
tests across 20 packages" line and I did not correct it, because doing so needs
a push to `main` and the PAT is retired (§14.2 follow-up).

**And the zero above is about where I looked.** I verified my detector fires by
matching the known-affected sentence, but a positive control proves the
instrument works when pointed at the thing — **it cannot prove I pointed it
everywhere.**

> **Provenance of that caveat, and of the flattened search:** both rules were
> given to me by the coordinator roughly twenty minutes before I applied them.
> **Applying them is compliance, not independent diligence, and it is not
> evidence that I would have caught either hazard unprompted.** Recorded because
> a report that quietly presents borrowed discipline as its own is the same
> species of true-but-misleading artefact as §14.1.

### What the red does and does not mean

It does **not** mean the merge broke anything: both tests exist unchanged on
`7a0f220`, and my branch added no Go code [M]. It means **the gate is now
pointed at the branch it is supposed to protect and is reporting what was
already true there.** A red first run on `main` is the instrument working.

**And note what would have happened three hours ago:** the same two failures,
travelling the same `| tee` pipeline, under the shell default this task fixed,
would have produced a **green** badge on `main`. That is not hypothetical — it
is exactly what run 1 did with one of these two tests (§7).

### Numbers the gate executes on `main` [M]

Confirmed two independent ways — isolating the runner's Go step, and counting
directories in the tree at `origin/main`. Both agree exactly.

| | Count |
|---|---|
| Go packages compiled | **32** |
| Go packages that have any tests | **10** (22 have none) |
| Distinct top-level Go tests executed | **501** |
| — of which the gate *reports* | **499**, because it keys on bare names and two are duplicated (§14.1) |
| JS/TS test files executed | **1** (`web/src/utils/task-ready.test.ts`) |

Quote **501** for tests and **499** only for "distinct names the gate emits."

---

## 15. Termination checklist (brief §6)

| Required | Status |
|---|---|
| Corrected Makefile | ✅ `1a01678` [M] |
| Selective-test path | ✅ `scripts/test-changed.sh`, `make test-changed` [M] |
| Workflow | ✅ `.github/workflows/ci.yml` [M] |
| PR | ✅ [#205](https://github.com/scion-frontiers/farmtable/pull/205) [M] |
| Red-then-green evidence | ✅ both arms, run URLs in §6 [M] |
| Report at the D8 path | ✅ this file |
| Project-log entry | ✅ `.design/project-log/` on the branch |
