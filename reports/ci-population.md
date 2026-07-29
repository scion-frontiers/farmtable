# ci-population — which gates run this project's tests, what each can see, and who runs it

**Leg:** read-ci-population (investigator)
**Date:** 2026-07-29
**Protocol followed:** PHASE 1 COLD, then PHASE 2. Sections 1–6 and 8 were written and saved
to disk **before** `_SEALED-em-ci-measurements.md` was opened. Section 7 was appended after.
No part of the sealed file was read during Phase 1. This is a truthful statement of order,
not a claimed one.

---

## 0. HEADLINE — READ THIS FIRST

**The brief's central premise is out of date, and the correction inverts the answer.**

The brief says `main` is `7a0f220dbd9332cb8db62138c841777432b4eda4` and that there is no CI.
`7a0f220` is a **stale local ref** in the clone I was given. The actual head of `main` on the
remote is **`cc927355e5a23c45bfd983cd331eb540b0a61ad5`**, which merged PR #205 and **added
`.github/workflows/ci.yml`**. GitHub Actions CI exists and is live on `main` as of today.

The real finding is a **cross-product miss**:

- The branch that has the CI (`main` @ `cc92735`) has a web suite of **one hand-named file**,
  and the URL-scheme security tests **do not exist on it**.
- The branch that has the URL-scheme security tests (`url-scheme-validation-r6` @ `c108acb`)
  has **no `.github/workflows` at all**, so pushing it triggers **no workflow whatsoever**.

**Consequence: `web/src/util/safe-url.test.ts` and `web/src/util/url-binding-scan.test.ts` —
the client-side half of the URL-scheme security property — are run by ZERO automated gates
anywhere in this project today.** On r6 they are reached only by a container image build or
by a human/agent typing `make test`. Neither is automated and neither fires on push.

---

## 1. POPULATION AND COMMANDS — what I searched, with roots, revisions, bounds

### Roots searched

| Root | What it is | Why it entered the population |
|---|---|---|
| `/workspace/farmtable-ci-population` | my assigned clone, detached at `633f8f2` | the assigned tree |
| `/workspace/farmtable-ci-22` | another leg's clone, branch `ci/22-github-actions-setup` | found by the uncommitted-gate sweep (§5) |
| `/workspace/farmtable` | canonical working copy, branch `task-state-web-ui-v2` | sweep |
| `/workspace/farmtable-writable-path`, `-prod-hardening`, `-xss-r5-audit` | sibling clones | sweep |
| `/scion-volumes/scratchpad/projects/farmtable/deploy/` | 109 deploy records | to establish who takes the image-build path |

### Revisions. Four, not two. I never conflate them.

| Label | SHA | Note |
|---|---|---|
| brief's "main" | `7a0f220dbd9332cb8db62138c841777432b4eda4` | **stale**; local `main` and local `origin/main` in my clone |
| **real main** | `cc927355e5a23c45bfd983cd331eb540b0a61ad5` | actual `refs/heads/main` on origin, verified by `git ls-remote` |
| r6 tip | `c108acbcfa2357862576092469828709bb6c4090` | tip of `url-scheme-validation-r6` |
| CI branch tip | `4c2d75424b9a0090be20d97dfdb91b2753663362` | `ci/22-github-actions-setup`, now merged into `cc92735` |

**The brief gives the r6 tip as `b330096...`. That is wrong.** `b330096` is a real commit
object and an *ancestor* of the tip, three commits back, but it is not the tip.
Command, ROOT `/workspace/farmtable-ci-population`:
`git rev-parse url-scheme-validation-r6^{commit}` → `c108acb...`;
`git merge-base --is-ancestor b330096 c108acb` → exit 0 (ancestor).
The dispatch message's `c108acb` is correct; the brief file's `b330096` is not. I used `c108acb`.

### Bounds on each search, stated with the finding

- **Tree enumeration** used `git ls-tree -r --name-only <SHA>`, which lists **dotfiles**. I did
  not use `ls`. Bound: tracked files at that revision only; ignores untracked/gitignored paths
  (`web/dist`, `node_modules`). Totals: `7a0f220` = 431 files, `c108acb` = 454 files.
- **CI-config search**, ROOT `/workspace/farmtable-ci-population`, both revisions:
  `git ls-tree -r --name-only <SHA> | grep -i -E 'workflow|\.github|/ci|ci/|jenkins|gitlab|travis|circle|azure-pipe|\.buildkite|cloudbuild|drone|woodpecker'`
  → at **both** `7a0f220` and `c108acb` the only hits are
  `.agents/skills/farmtable/resources/workflow.md`, `.github/ISSUE_TEMPLATE/bug_report.md`,
  `.github/PULL_REQUEST_TEMPLATE.md`. **Bound: tracked files at those two revisions in that
  clone.** This negative is true at those two revisions and is *false* for the repository as a
  whole — see §5. This is exactly the boundary the brief warned reads like a comma.
- **Invocation-string search**, both revisions:
  `git grep -n -I -E 'npm (run )?test|go test|make test|make lint|make build|npm ci|npm run build' <SHA> -- . ':!*.md' ':!web/package-lock.json'`
  Bound: excludes markdown and the lockfile, so prose mentions are deliberately out of
  population; `-I` skips binary.
- **Go build-tag search**: `git grep -n -E '^//go:build' <SHA> -- '*_test.go'`. Bound: only
  `//go:build` at line start in `_test.go` files; would miss a legacy `// +build` line.
- **Uncommitted-gate sweep**: `git status --porcelain` plus `ls -a <clone>/.github` across the
  clones listed above. Bound: named clones under `/workspace`, not an exhaustive filesystem walk.
- **Remote truth**: `git ls-remote --heads origin 'ci/22*' 'url-scheme-validation-r6' 'main'`
  from ROOT `/workspace/farmtable-ci-22`. Bound: three refspecs, not all refs.

### Apparatus note — a shell fact that cost me a command

`git show "$R:web/package.json"` **fails in zsh**: `:w` is a zsh history-expansion modifier, so
`$R:web/...` expands to garbage and git reports `ambiguous argument 'b/package.json'`. Quoting
does not help. Use `"${R}:web/package.json"` — braces terminate the expansion. `$R:Dockerfile`
works by luck (`:D` is not a modifier). Any leg scripting `git show` over a path starting with
`w` in zsh will hit this and may misread an empty/failed result as an absent file.

---

## 2. THE GATE INVENTORY — every automated path that runs any test, per revision

| # | Gate | `7a0f220` (stale main) | `cc92735` (REAL main) | `c108acb` (r6) |
|---|---|---|---|---|
| G1 | GitHub Actions `.github/workflows/ci.yml` | **absent** | **PRESENT, live** | **absent** |
| G2 | `make test` | Go only | Go + web | Go + web |
| G3 | `Dockerfile` / `Dockerfile.server` image build | build only, no tests | build only, no tests | **runs `npm test`** |
| G4 | `web` `npm test` | 1 hand-named file | 1 hand-named file | 4 files, discovered |
| G5 | `scripts/ci-suite-manifest.mjs` membership check | absent | **PRESENT** | absent |
| G6 | `test/integration/run-all.sh` | present, **invoked by nothing** | present, **invoked by nothing** | present, **invoked by nothing** |
| G7 | `internal/webguard` Go-side web assertions | absent | absent | present (via `go test ./...`) |

---

## 3. FOR EACH GATE — BOTH POPULATIONS

### G1 — GitHub Actions `ci.yml` (real main `cc92735` only)

**What it can see.** Full checkout at the pushed revision. Steps, in order: `npm ci`;
`node scripts/ci-suite-manifest.mjs`; assert `web/dist` absent; `make build`; assert `web/dist`
produced; `go test ./... -v | tee go-test.log`; `cd web && npm test`; membership report;
artifact upload; `make test` as a Makefile self-check. It deliberately invokes the two suites
**directly** rather than through `make test`, so a Makefile regression cannot silently reduce
coverage — `make test` is then re-run separately as a self-check. That is a genuinely good design.

**What invocation path runs it, and who takes it.** `on: pull_request` and
`push: branches: ['**']`. **Any push to any branch, by anyone.** This is the broadest possible
trigger and it is the correct choice.

**The load-bearing catch, and it is the whole finding:** for a `push` event, GitHub Actions runs
the workflow file **as it exists in the pushed branch's own tree**. `url-scheme-validation-r6`
does not contain `.github/workflows/ci.yml`:
ROOT `/workspace/farmtable-ci-population`,
`git ls-tree -r --name-only c108acbcfa2357862576092469828709bb6c4090 -- .github/workflows`
→ **empty output, exit 0** (bound: tracked files at `c108acb`). So **pushing r6 runs nothing.**
A pull request from r6 into main would run the *base*-resolved workflow and would gate it — but
no such run has gated it to date, and the r6 tree's own comments assert "there is no CI
configuration in this repository at all", which was true when written and is now false.

### G2 — `make test`

- `7a0f220`: `test: go test ./...`. **Web suite unreachable.** The Makefile's own r6 comment
  confirms this was the state.
- `cc92735` and `c108acb`: `test: test-go test-web`, with `test-go: go test ./...` and
  `test-web: cd web && npm test`. Both reach both suites. Note these are *prerequisites*, not a
  chained recipe, so make stops at the first failure and a Go failure cannot be masked.
- **Who takes it.** Humans and dev agents. At `c108acb`, `agents.md` (to which `CLAUDE.md` and
  `GEMINI.md` are **symlinks**, mode `120000` → blob `47d29cb`) was updated to say
  `make test  # go test ./... AND cd web && npm test` and explicitly *"Do not substitute a bare
  `go test ./...`"*. At `7a0f220` it still says plain `go test ./...`.
- **Residual gap at r6, unfixed:** `.agents/skills/farmtable-dev/commands/test.md` is
  **byte-identical at both revisions** — `git rev-parse <SHA>:.agents/skills/farmtable-dev/commands/test.md`
  returns blob `0e9e5d3e48e34adca0bf4c1d58c0c29f3100de5d` for both — and it still instructs
  `go test ./...` only, with no mention of `make test` or the web suite. An agent that invokes
  the `/test` skill command rather than reading `agents.md` **still runs the Go-only path on r6.**
  The r6 fix updated the guide and missed the skill that fronts it.

### G3 — Container image builds

At `c108acb` both `Dockerfile:9` and `Dockerfile.server:9` add `RUN npm test` between `npm ci`
and `npm run build`. At `7a0f220` and `cc92735` they do not (`git show "cc92735:Dockerfile" |
grep -n 'npm test'` → no match, exit 1; bound: `Dockerfile` only, that revision).

- **Sees:** only the web suite. Neither Dockerfile runs `go test` at any revision. So
  `internal/webguard` (G7) is invisible to the image build, as its own `doc.go` correctly states.
- **Who takes it:** a deploy leg running `gcloud builds submit` with `-f Dockerfile.server`,
  manually. Evidence: 109 deploy records under
  `/scion-volumes/scratchpad/projects/farmtable/deploy/`, e.g. `2026-07-25-deploy-55.md` citing
  a `gcr.io/cloud-builders/docker` step with `-f Dockerfile.server`. **This path is real and
  regularly taken, but it is manual and it is the *last* gate before production, not the first.**

### G4 — `npm test` and its file population

- `7a0f220` and `cc92735`:
  `"test": "tsc -p tsconfig.test.json && node .tmp-test/utils/task-ready.test.js"`, with
  `tsconfig.test.json` `"include": ["src/utils/task-ready.test.ts"]`. **The population is one
  hand-named file, hand-maintained in two places that must agree.** This is precisely the
  "gate that runs but sees a population of one" shape the brief suspected — **CONFIRMED**. It is
  mitigated on `cc92735` only because exactly one web test file exists there, so the hand-list is
  accidentally complete.
- `c108acb`: `"test": "rm -rf .tmp-test && tsc -p tsconfig.test.json && node scripts/run-tests.mjs"`,
  `tsconfig.test.json` `"include": ["src/**/*.test.ts"]`, and `web/scripts/run-tests.mjs`
  discovers compiled output and cross-checks it against source. Population = **4 files**:
  `util/assertions.test.ts`, `util/safe-url.test.ts`, `util/url-binding-scan.test.ts`,
  `utils/task-ready.test.ts`. The runner adds a naming chokepoint (broad test-shaped regex, fails
  loudly on `*.spec.ts` / `__tests__/`), a `tsconfig` include pin, a per-file `#assertions N`
  consumption receipt, and an exact `EXPECTED_ASSERTIONS = 380` pin. This is a materially better
  gate than either main variant, and its own comments are honest about what the count pin misses.

### G5 — `scripts/ci-suite-manifest.mjs` (real main only)

**Sees:** every tracked-or-untracked `*.{test,spec}.*` under `web/`, compared against what it can
prove `npm test` executes by statically flattening the `scripts.test` chain. **Fail-closed**: an
unrecognised runner is a failure, not an empty pass. **Who runs it:** the CI job (step 3) and
`make suite-manifest`. On `cc92735` it passes: present = 1, executed = 1.

**Predicted merge collision, stated as a prediction because I hold no build token and could not
execute it.** When r6 merges into main, this step should **FAIL**. Tracing the source by hand:
`leafCommands('test')` splits r6's script on `&&`; `rm -rf .tmp-test` and `tsc -p ...` are skipped
by the `/^(tsc|rimraf|rm|mkdir|cpy|cp)\b/` filter; `node scripts/run-tests.mjs` enters the
`/^node\b/` arm; `mapArtefactToSource('scripts/run-tests.mjs')` strips the first path segment to
`run-tests.mjs`, whose `.js$` replace does not fire on `.mjs`, and matches no file in `present` —
so it lands in `unanalysable`, and all four r6 web test files land in `missing`. Both non-empty →
`process.exit(1)`. This is the fail-closed behaviour working **as designed** ("teach this script
the new runner"), not a bug — but it is a merge blocker nobody has been told about, and the two
branches have independently built **two different, mutually incompatible solutions to the same
problem**: r6 replaced the hand-list with discovery; main kept the hand-list and added a checker
that verifies the hand-list. What would settle it: run `node scripts/ci-suite-manifest.mjs` on a
trial merge. I could not, per the no-build-token rule.

### G6 — `test/integration/run-all.sh` — **the gate that nothing invokes**

Present at all revisions: `run-all.sh` plus three journey scripts and `common.sh`.
`git grep -n -I -E 'run-all\.sh|test/integration' <SHA> -- .` at both `7a0f220` and `c108acb`
returns **only `test/integration/README.md`** (5 hits, lines 28/34/35/36/46) — bound: tracked
files at that revision, all file types, whole tree. **No Makefile target, no Dockerfile step, no
workflow step, no skill command references it.** Its own `TESTS=(...)` array is additionally a
hand-maintained list of three. This is the brief's "test file that exists, compiles, is correct,
and which no invocation path reaches" — **CONFIRMED, and it is unchanged at every revision
examined, including the one with CI.** It requires a live server (`$FARMTABLE_SERVER`), which
explains but does not excuse the omission.

### G7 — `internal/webguard` (r6 only)

Go tests asserting properties of the `web/` tree, run by `go test ./...` → `make test-go`. Its
`doc.go` is an unusually honest artefact: it states the executor trade explicitly, notes neither
placement dominates, and correctly reports that the Dockerfiles run `npm test` and not `go test`.
Its one claim that is now stale is *"There is no CI configuration in this repository at all"* —
true at r6's tree and when written, **false of the repository as of `cc92735`**.

### Go population, all revisions (bound: `_test.go` filename match; excludes `//go:build integration`)

| Revision | `_test.go` files | integration-tagged | **seen by plain `go test ./...`** |
|---|---|---|---|
| `7a0f220` | 53 | 3 | **50** |
| `cc92735` | 53 | 3 | **50** |
| `c108acb` | 61 | 3 | **58** |

The 3 excluded at every revision: `internal/platform/github/integration_test.go`,
`internal/server/server_postgres_test.go`, `internal/store/entstore_postgres_test.go`. They run
only under `-tags integration` with live Postgres, which **no gate anywhere supplies**.

---

## 4. THE ANSWER, PER REVISION

### `7a0f220dbd9332cb8db62138c841777432b4eda4` (the brief's "main" — stale)

Automated gates: **none.** No CI. `make test` runs 50 Go test files and no web tests. The
Dockerfiles build the web bundle but run no tests. The single web test file
(`web/src/utils/task-ready.test.ts`) is executed **only** by a human typing `npm test` in `web/`
— and `agents.md` at this revision does not tell anyone to. Web coverage here is effectively
unexecuted.

### `cc927355e5a23c45bfd983cd331eb540b0a61ad5` (REAL main — what actually ships)

**GitHub Actions CI is live**, triggered on every PR and every push to every branch. It sees
50 Go test files + 1 web test file, and it additionally enforces *membership* via
`ci-suite-manifest.mjs`, asserts `web/dist` is built by the run rather than inherited, and
self-checks `make test`. This is a real gate with a real trigger and a broad audience: **every
push by every agent takes this path.** Its weakness is not the machinery, it is the population —
the web suite is one hand-named file, and the URL-scheme security tests do not exist on this
branch to be seen.

### `c108acbcfa2357862576092469828709bb6c4090` (r6 tip)

**No CI.** The best *test population* of any revision — 58 Go files including `internal/webguard`,
and 4 web files reached by genuine discovery with naming, compilation, consumption and
assertion-count gates. But the only things that invoke it are (a) a human or agent typing
`make test`, and (b) a manual container image build during deploy. **Pushing this branch fires no
workflow.**

### THE DIFFERENCE, CALLED OUT EXPLICITLY

The brief predicted the answer would differ between its two revisions. **It does — and the
difference is larger and runs in a different direction than the brief anticipated.** Against the
brief's stale `7a0f220`, r6 is a strict improvement: it adds the web suite to `make test`, adds
`npm test` to both image builds, replaces a hand-named population of 1 with a discovered
population of 4, and adds 8 Go test files.

But against **real** main `cc92735`, the comparison is a genuine trade, not an improvement:

| | real main `cc92735` | r6 `c108acb` |
|---|---|---|
| Automated push/PR gate | **YES** | **NO** |
| Web tests in `make test` | yes | yes |
| Web tests in image build | no | **yes** |
| Web test population | 1, hand-named | **4, discovered** |
| Go test population | 50 | **58** |
| URL-scheme guards exist | **no** | yes |
| Suite-membership check | **yes** (fail-closed) | equivalent, inside the runner |

**Neither branch has both the gate and the tests.** That is the answer to the third part of the
question, and it is the part that matters: the URL-scheme web guards have a population of zero
automated invokers today. They will not acquire one until r6 merges — and when it does, the
merge is predicted to fail at G5 until someone teaches `ci-suite-manifest.mjs` about r6's runner.

---

## 5. THE UNCOMMITTED-GATE GAP — how I closed it

**Closed, and it was the highest-yield thing I did.** The brief was right that this gap was real,
and my assigned clone could not see through it.

Method: rather than trusting the assigned clone, I enumerated sibling clones under `/workspace`
and, for each, read `git rev-parse HEAD`, `git status --porcelain`, and **`ls -a <clone>/.github`**
(`-a`, because `.github` is a dotfile and the brief's warning is correct). I prioritised clones
whose names suggested the subject: `farmtable-ci-22`, `farmtable-dev-103-testlist`,
`farmtable-writable-path`.

Result: `/workspace/farmtable-ci-22` is on branch `ci/22-github-actions-setup` at `4c2d754`,
**clean working tree**, containing `.github/workflows/ci.yml`. Following that led to `origin/main`
= `cc92735`, the merge of PR #205.

**Two facts that make this a structural warning, not just a lucky find:**

1. My assigned clone **cannot see the commit at all**. ROOT `/workspace/farmtable-ci-population`:
   `git cat-file -t 4c2d75424b9a0090be20d97dfdb91b2753663362` → `fatal: git cat-file: could not
   get object info`. `git branch -a --list '*22*' '*ci/*'` returns only `deploy-22-snapshot`.
   The "all 206 branches fetched" claim in the dispatch **does not include `ci/22-...`**.
2. My clone's `origin/main` is a **stale ref**: it reads `7a0f220` while the remote reads
   `cc92735`. `git ls-remote --heads origin main` from ROOT `/workspace/farmtable-ci-22` →
   `cc927355e5a23c45bfd983cd331eb540b0a61ad5`. Only `farmtable-ci-22` holds the object; I tested
   six clones with `git cat-file -t cc92735...` and five reported absent.

This is a live instance of the brief's own second rule, inverted: **objects absent from the clone
you were handed are not absent from the repository.** A scan bounded to the assigned tree would
have confidently and wrongly reported "no CI exists". I would have filed that negative. The only
reason I did not is the sweep.

The branch is genuinely pushed — `git ls-remote --heads origin 'ci/22*'` returns
`4c2d754 refs/heads/ci/22-github-actions-setup` — so the workflow is live on GitHub, not merely
local. Remote is `https://github.com/scion-frontiers/farmtable.git`.

**Not fully closed:** two directories named like relevant legs, `/workspace/farmtable-dev-103-testlist`
and `/workspace/farmtable-xss-r6-fix`, have **no `.git`** and I did not audit their contents.

---

## 6. WHAT I DID NOT CHECK

- **I executed no suite.** No build token. Every claim about what a runner *does* is read from
  its source, not observed. Specifically unverified by execution: that r6's `npm test` passes;
  that `EXPECTED_ASSERTIONS = 380` matches reality; that the G5 merge collision predicted in §3
  actually occurs. **Each is UNRESOLVED, not clean.** What would settle the last one: a trial
  merge of `c108acb` into `cc92735` followed by `node scripts/ci-suite-manifest.mjs`.
- **No GitHub Actions run history.** I never queried the Actions API, so I do not know whether
  CI is currently green, red, or whether runs are being cancelled by the `concurrency` group. I
  cannot say the gate is *effective*, only that it is *configured and triggered*. `gh run list`
  would settle it.
- **Branch-protection / required-checks settings are unexamined.** A workflow that runs but is
  not a *required* check does not block a merge. This materially affects whether G1 is a "gate"
  in the strong sense. `gh api repos/scion-frontiers/farmtable/branches/main/protection` settles it.
- **I audited 6 of ~230 directories under `/workspace`**, chosen by name. Other uncommitted gates
  may exist in the ~224 I did not open, including the two `.git`-less dirs named above.
- **206 branches unexamined.** I looked at `main`, r6, and `ci/22-...`. Another branch may carry
  another gate.
- **No `// +build` legacy-tag search**, so a test file excluded by the pre-1.17 tag syntax would
  not appear in my "excluded" count.
- I did not read `scripts/test-changed.sh` beyond its Makefile comment, nor r6's
  `web/src/util/assertions.ts`.
- I did not verify that `buf`/`protoc-gen-*` are available in CI, which `make generate` needs —
  though `build` on real main deliberately no longer depends on `generate`.

---

## 7. RECONCILIATION — Phase 2, written after §§1–6 and 8 were saved

Order confirmed: `reports/ci-population.md` containing §§1–6 and §8 was written to disk in full
before `_SEALED-em-ci-measurements.md` was opened for the first time. No breach.

**Net: we agree on every mechanism. We disagree on four measurements and on the conclusion.
Three of the four disagreements are staleness in the sealed file, and one is a claim that
appears simply inverted.**

### Where we agree — and the agreement is exact

Sealed items 7, 8, 9, 10 and the first clause of 11 match my independent readings **verbatim**:
the split `test:` target, main's one hardcoded compiled file with no discovery, r6's
`rm -rf .tmp-test && … node scripts/run-tests.mjs`, the runner's glob + cross-check + naming
sweep + assertion receipt, and `npm test` at line 9 of both Dockerfiles with neither running
`go test`. I found all of these before reading the file. Item 6 (`url-binding-scan.test.ts`
exists on r6) also holds at the tip.

### Disagreement 1 — sealed item 4 does not reproduce. **The r6 ref has moved.**

Sealed: *"Canonical's ref `url-scheme-validation-r6` resolves to `b330096`."*
Measured now, ROOT `/workspace/farmtable`: `git rev-parse url-scheme-validation-r6` →
**`c108acbcfa2357862576092469828709bb6c4090`**. My clone returns the same. Canonical also holds
`c108acb` as a commit object. So **both clones now agree on `c108acb`**, and the sealed value is
three commits stale — consistent with the sealed file's own 06:30Z timestamp and the branch
advancing before my 06:4x measurements. This also explains the brief's `b330096`: it was not
invented, it was *correct when written and stale when read*. That is the more instructive failure
mode, and it is the strongest possible argument for the project's own "cite SHAs, always" rule —
the rule was followed and still produced a stale identifier, because a SHA copied out of a ref
inherits the ref's timestamp. Items 1, 2 and 3 are unaffected: `d5e35a4` is a commit, `c8cb699`
is a blob, and `d5e35a4` remains an ancestor of both `b330096` and `c108acb`.

### Disagreement 2 — sealed item 5. **Correct within its bound, and the bound is where the
answer was hiding.**

Sealed item 5 is scrupulously honest: it states the bound (canonical's ref set) and names it as
the gap to close. Within that bound I reproduce it exactly — ROOT
`/workspace/farmtable-ci-population`, both revisions, the `ls-tree | grep` command in §1 returns
no `.github/workflows` path.

**But the conclusion the project drew from it — "there is no CI" — is false.** `.github/workflows/ci.yml`
exists, is committed at `4c2d754`, is **merged into `main` at `cc92735`**, and is **pushed to
origin**. Canonical could not see it because canonical's `origin/main` is itself stale at
`7a0f220` and canonical does not hold the object (`git cat-file -t cc92735` → absent, tested in
six clones; only `farmtable-ci-22` has it). This is the fourth stale-ref instance tonight and the
consequential one.

The sealed file says *"I have been wrong twice tonight … including once about which clones hold
a commit."* That is precisely the axis this failed on again. The generalisable lesson is not
"check more clones" — it is that **`git ls-remote` is the only cheap read that cannot be stale**,
and it was not in anyone's instrument list. One `ls-remote` would have caught this hours ago.

### Disagreement 3 — sealed item 11's second clause appears **inverted**.

Sealed: *"a separate leg measured that the developer container cannot run the web half at all
because `web/node_modules` is absent."*

Measured: ROOT `/workspace/farmtable` (canonical, the developer container's working copy),
`[ -d web/node_modules ]` → **PRESENT, 110 entries**. `node` v20.20.2 and `npm` 10.8.2 are on
`PATH` at `/usr/local/bin`. So the developer container **can** run the web half, and canonical is
the one place in this workspace where it can.

`web/node_modules` is **absent** in the *fresh* clones — `/workspace/farmtable-ci-population` and
`/workspace/farmtable-ci-22` both lack it. I suspect the other leg measured a fresh clone and the
finding was generalised to "the developer container". That is the brief's own discriminator
firing: *a controlled negative bounded to an event you caused, generalised to a tree you
searched.* It reached the sealed file as a property of the environment when it is a property of a
freshly-cloned directory. Note this does not disturb the sealed conclusion's *shape* — but it
removes its load-bearing evidence, because the mirror-image argument depends on the developer
container being unable to run the web suite, and it can.

Corollary worth flagging: real main's Makefile makes `test-web` depend on `web-deps`
(`npm ci` via a lockfile marker target), so on `cc92735` a fresh clone running `make test`
installs its own dependencies and the absence is self-healing. r6's `test-web` has no such
prerequisite — `test-web: cd web && npm test` — so on r6 a fresh clone's `make test` **fails at
the web half** until someone runs `npm ci` by hand. That is a real, if minor, r6 regression
against real main that neither of us had listed.

### Disagreement 4 — new fact, and it strengthens §4 rather than changing it

**`url-scheme-validation-r6` is not pushed to origin at all.** ROOT `/workspace/farmtable-ci-22`:
`git ls-remote --heads origin` returns **97 heads**, none matching `url-scheme|r6`. (The sealed
file's "123 remote refs" is canonical's stale remote-tracking count, not the remote's actual
head count — a different quantity measured a different way.)

So my §3 statement that "pushing r6 fires no workflow" is true for a second and more basic
reason than the one I gave: **r6 has never been pushed, so GitHub has never seen it.** The
workflow's `push: branches: ['**']` trigger — carefully written to catch exactly the long-lived
unmerged branch the workflow's own comment describes as *"39 commits ahead of main that nothing
has ever compiled"* — **cannot reach r6**, because a trigger that watches every branch on the
remote still cannot watch a branch that is not on the remote. The author anticipated the right
failure and the branch evaded it on an axis outside the workflow's reach.

### On the sealed conclusion

Sealed: *"the web suite is reached by the image builds and not by the developer container; the Go
suite is reached by the developer container and not by the image builds. Each is invisible to
exactly the path that runs the other."*

**Half right, and it is the half that the stale premise allowed.** The mirror-image trade is real
*at r6 and only at r6*, and r6's own `internal/webguard/doc.go` states it more carefully than the
sealed file does (it says neither placement dominates, and frames it as a judgement about who
trips the wire). But:

1. Its evidence is wrong — the developer container **can** run the web half (Disagreement 3), so
   the two suites are not actually invisible to each other on canonical. A developer running
   `make test` at r6 in canonical runs **both**.
2. It is scoped to a world with no CI. On real main `cc92735` there is a third path that runs
   **both** suites plus a membership check, on every push and every PR. The mirror-image framing
   dissolves there.

**The conclusion I would put in its place:** the problem is not that two suites have mirror-image
executors. It is that **the gate and the tests live on different branches, one of which was never
pushed.** Real main has a well-built automated gate watching a web population of one file that
contains no security assertions. r6 has four discovered web test files carrying the URL-scheme
security property and no automated gate, on a branch GitHub cannot see. The URL-scheme web guards
therefore have **zero automated invokers**, and will keep them until r6 is pushed and merged — at
which point the merge is predicted to fail at `ci-suite-manifest.mjs` (§3, G5) until that script
is taught r6's runner.

### One more thing the sealed file got right that I should not bury

`ci.yml`'s comment says the canonical working copy *"has carried a populated, untracked `web/dist`
since Jul 27 — which is precisely why `go build ./...` succeeded there for days while failing in
every fresh clone."* I confirmed it: `/workspace/farmtable/web/dist` exists and is populated
(`assets`, `favicon.svg`, `index.html`, `shoelace`). That is the same class of defect as
everything above — **a stale artefact in the canonical tree making a broken thing look healthy** —
and it is the fourth instance tonight. The CI author already built the assertion that catches it.

---

## 8. WHERE THE BRIEF WAS WRONG

Listed plainly, as requested. These are errors of fact in the brief, not disagreements of taste.

1. **The r6 tip SHA is wrong.** Brief §"TREE, BY SHA" gives `b330096...`. The tip is
   `c108acb...`; `b330096` is its 3rd-generation ancestor. The dispatch message had it right and
   the brief file had it wrong, which is the more dangerous direction — the durable artefact
   carried the error. Under the project's own "every artefact identifies a commit by SHA" rule,
   this is the rule failing in the artefact that states it.
   **[PHASE 2 AMENDMENT — I was too harsh here.]** The sealed file shows `b330096` was
   canonical's *actual* r6 ref when the brief was written. It was not an error, it was a
   correct reading that went stale within the hour (the ref now reads `c108acb` in canonical
   too). I leave my cold wording above unedited so the record shows what I concluded without
   the sealed file. The corrected lesson is sharper than the one I filed cold: a SHA copied
   out of a ref inherits that ref's staleness, so "cite SHAs" does not by itself buy
   immutability — only citing a SHA *and* the ref-read that produced it does.

2. **`main` is not `7a0f220`, and this is the big one.** Real `main` is `cc92735`. The brief
   describes `7a0f220` as "the line closest to what ships"; it is 12 commits behind, and the
   12 commits are *precisely the CI work this brief was commissioned to look for*. The brief
   was written against a stale clone.

3. **"There is no CI" is false.** This premise is embedded in the brief, in r6's `Makefile`
   comment, and in r6's `internal/webguard/doc.go`. It was true when each was written. It has
   been false since PR #205 merged. Three separate committed artefacts now assert a false
   negative about CI's existence — the belief propagated faster than the fact.

4. **The clone is not complete.** "All 206 branches fetched" — `ci/22-github-actions-setup` is
   not among them, its objects are absent, and `origin/main` is stale. The instrument I was given
   could not, even in principle, answer the question I was asked. The brief's own "known gap"
   section is what saved this; it was correct to state it rather than hide it, and it should be
   read as load-bearing rather than as a caveat.

5. **Framing understated the problem.** The brief suspected two shapes: a gate seeing a
   population of one, and a gate nothing invokes. Both are confirmed (G4 on main; G6 everywhere).
   But the actual defect is a third shape the brief did not name: **two gates and two test
   populations that exist on different unmerged branches, each complete and each useless without
   the other.** No single-revision analysis finds this. It is only visible across revisions, which
   is why the instruction to compare two revisions was right even though both SHAs were wrong.

6. **Minor.** The brief lists "the developer container's provisioning" as a surface to check.
   There is no devcontainer: `git ls-tree -r --name-only <SHA> | grep -i -E
   'devcontainer|\.vscode|setup|provision|bootstrap|install'` at both revisions returns only
   `.agents/skills/farmtable-dev/commands/setup.md` and the unrelated
   `internal/serverapp/provisioning*.go`. Bound: tracked files, those two revisions.

### Where the brief was right, and it mattered

- `.github` is a dotfile and `ls` hides it. I used `ls -a` and `git ls-tree` throughout; the
  positive find in §5 came from `ls -a`.
- Objects in a repository ≠ files in a checked-out tree. This decided G1: `b330096` and `4c2d754`
  both exist as objects in some clone, but neither puts `ci.yml` into r6's checkout, which is why
  pushing r6 runs nothing.
- The two-phase protocol. See §7.
