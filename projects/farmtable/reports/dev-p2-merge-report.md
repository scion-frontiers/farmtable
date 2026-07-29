# dev-p2-merge — report

**Agent:** dev-p2-merge
**Date:** 2026-07-29
**Workspace:** `/workspace/farmtable-p2-merge` (clone of the local path `/workspace/farmtable`)
**Branch:** `p2-merge-2982ffd` — **committed, NOT pushed**

| | |
|---|---|
| Merge commit | `7e0e387cbd4792836834eacf11bf2133fbca7706` |
| Project-log commit | `b814cc4` |
| First parent (main) | `2982ffd8f3f6e231d8855b9cae7c448c2bd3144f` |
| Second parent (branch) | `e64138c058ad707d2b08b3a213cfa63c17c8e953` |
| Merge base | `aa08f1ae8ca972f463215f76113c121c4578ce70` |

## 0. Headline

The merge is committed and everything asked for is delivered, **except that
acceptance criterion (c) — "the web test suite runs and passes" — cannot be met
while acceptance criterion (a) — "the two safe-url files left at main's version"
— also holds.** Section 7 sets that out. Per section 10 of the brief I have not
silently picked one; I implemented (a), left (c) failing, and am reporting it.

The failures are confined to the deferred carve-out. Nothing else is red.

## 1. Base confirmed before any work

```
git rev-parse 2982ffd8f3f6e231d8855b9cae7c448c2bd3144f  -> resolves
git rev-parse origin/main                               -> 2982ffd8f3f6...  SAME
git merge-base 2982ffd e64138c                          -> aa08f1ae8ca9...  as briefed
git rev-list --count 439b309..2982ffd                   -> 15
```

`439b309` is an ancestor of `2982ffd`, 15 commits back. Every figure below was
re-derived at `2982ffd`; nothing was carried forward.

## 2. The conflict set is SEVEN — measured, with the prose trap demonstrated

`git merge-tree --write-tree 2982ffd e64138c` → rc=1, merged tree
`42a71d84294421fca73121c6e68be5c9d19fb5ba` — **byte-identical to the tree OID in
the brief**, so my invocation and the EM's agree.

Expected before running: stage channel 7, prose channel 8, differing member
`ft-app.ts`. All three confirmed.

**Stage channel** (`awk '$3 ~ /^[123]$/ {print $4}' | sort -u`) — 7 paths:

```
web/package-lock.json
web/package.json
web/src/components/inspector/ft-inspector-code.ts
web/src/components/inspector/ft-inspector-meta.ts
web/src/util/safe-url.test.ts
web/src/util/safe-url.ts
web/src/utils/task-ready.test.ts
```

**Prose channel** (`grep '^Auto-merging '`) — 8 paths.

- `prose − stage` = exactly `web/src/components/ft-app.ts` — the false positive.
- `stage − prose` = empty.

**Cross-check against the real index:** after `git merge`,
`git diff --name-only --diff-filter=U` returned the identical 7 paths. The
merge-tree prediction and the real index agree exactly.

### Stage composition — the add/add property, with a control

| Path | Stages |
|---|---|
| `web/package-lock.json` | 1,2,3 |
| `web/package.json` | 1,2,3 |
| `.../ft-inspector-code.ts` | 1,2,3 |
| `.../ft-inspector-meta.ts` | 1,2,3 |
| `web/src/utils/task-ready.test.ts` | 1,2,3 |
| **`web/src/util/safe-url.test.ts`** | **2,3 — NO STAGE 1** |
| **`web/src/util/safe-url.ts`** | **2,3 — NO STAGE 1** |

The absence of stage 1 on the safe-url pair is reported alongside the five
known-present stage-1 members the same instrument DID return, so the zero is not
a bare zero. Confirmed add/add, as briefed.

## 3. The five resolutions

| Path | Resolution |
|---|---|
| `web/package.json` | Union. Main's `@types/jsdom ^28.0.3`, `@types/node ^26.1.2`, `jsdom ^29.1.1`; branch's `vitest ^3.2.7` and its `test`/`test:node`/`test:components` script split. The conflict hunk only covered the jsdom region — the scripts and vitest regions auto-merged from the branch, so the whole file had to be reconciled, not just the hunk. |
| `web/package-lock.json` | Regenerated: main's lockfile restored as baseline, then `npm install --package-lock-only`. **Neither side's lockfile satisfies the merged manifest** — main's has no `vitest`, the branch's has no `@types/jsdom`/`@types/node` and pins jsdom 26. Verified after: lock contains `node_modules/vitest` (3.2.7), `@types/jsdom`, `@types/node`, jsdom 29.1.1. npm printed "up to date", which is misleading prose; the content was checked rather than the message believed. |
| `.../ft-inspector-code.ts` | Main's `safeHref` import and `renderPrLink`; branch's `safeExternalUrl` import and inline `prUrl` anchor removed. |
| `.../ft-inspector-meta.ts` | Main's `renderExternalSourceLink` and `t.remoteUrl` guard; branch's `safeExternalUrl` import and `externalUrl` local removed. |
| `web/src/utils/task-ready.test.ts` | Union of both imports. `assertEqual` is used in 10 assertions and `phaseForStage` in the fixture builder — both genuinely needed. |

**The two inspector resolutions were forced, not chosen.** Main and the branch
export **disjoint** APIs from `safe-url.ts`:

- main: `SAFE_SCHEMES`, `safeHref`
- branch: `LOCAL_HTTP_LINKS_ENABLED`, `safeExternalUrl`

With `safe-url.ts` pinned to main, `safeExternalUrl` does not exist in this tree,
so the branch's form of those two files cannot compile. Note this was not just
the conflict hunks: the branch's `safeExternalUrl` **import lines and call sites
auto-merged in outside the markers** in both files and had to be removed by hand,
or the files would have referenced a non-existent symbol.

## 4. The carve-out — pinned to main, verified both directions

Both files left at **main's version**, DEFERRED to `farmtable-em-hardening`.

Verified at the merge commit:

| Path | vs main | vs branch |
|---|---|---|
| `web/src/util/safe-url.ts` | **0 diff** | differs |
| `web/src/util/safe-url.test.ts` | **0 diff** | differs |

The "differs from branch" column is the control — it shows the zero against main
is a real pin and not an artefact of the two sides being identical.

## 5. `ft-app.ts` — reviewed as assigned. Auto-merge is CORRECT.

It merged cleanly, main had touched it since the merge base, and nobody was
looking at it. I read the merged result.

- **Main** (`af9ea8c`, test-pinned by `2738599`) moved `isCollectionWritable` out
  of `ft-app.ts` into an exported function in `capabilities.ts`, deliberately
  leaving **no local copy**; `capabilities.test.ts` asserts `ft-app.ts` imports
  the predicate and declares none of its own.
- **The branch** replaced the single `phaseFilter` with a four-axis filter model
  (`groupFilter`, `stageFilter`, `holdReasonFilter`, `availabilityFilter`) and
  added `showErrorToast`.

Disjoint concerns, compatible in meaning and not merely in line position.

Measured in the merged file: import present at line 19; **0** local declarations
of `isCollectionWritable`; **0** `this.isCollectionWritable` call sites; the two
getters call the imported predicate. Main's security guard survived intact.

Control for that absence: the branch's diff on this file is **not** empty — 172
changed lines — and the identifiers it added/removed are the filter fields and
`showErrorToast`, none of them `isCollectionWritable`.

## 6. The floor — re-derived, 6 → 30

Two independent methods over the merged tree, **identical sets**:

- A: `git ls-tree -r --name-only <merged tree> -- web` + gate `TEST_FILE_RE` + the
  `web/dist/` and `node_modules/` exclusions → 30
- B: the gate's own `candidateFiles('web')` (tracked + untracked-not-ignored) → 30

`diff A B` → empty. Re-derived again against the committed object `7e0e387`
afterwards: still the same 30.

**The path set (the artefact; the integer 30 is only its cardinality), at the
merge commit whose first parent is main `2982ffd`:**

```
web/src/capabilities.test.ts
web/src/components/inspector/render-sink-xss.test.ts
web/src/util/assertions.test.ts
web/src/util/rank.test.ts
web/src/util/safe-url.test.ts
web/src/util/task-state-utils.test.ts
web/src/util/url-binding-scan.test.ts
web/src/utils/task-ready.test.ts
web/test/attention-view.test.ts
web/test/ft-app.write-error-seam.test.ts
web/test/ft-app.write-error.test.ts
web/test/ft-dashboard-view.test.ts
web/test/ft-filter-chips.test.ts
web/test/ft-inspector-changes.vocabulary.test.ts
web/test/ft-inspector-code.safe-url.test.ts
web/test/ft-inspector-header.availability.test.ts
web/test/ft-inspector-meta.safe-url.test.ts
web/test/ft-inspector-meta.state.test.ts
web/test/ft-inspector-relationships.test.ts
web/test/ft-kanban-view.contract.test.ts
web/test/ft-kanban.drop-refusal-affordances.test.ts
web/test/ft-ready-queue-view.availability.test.ts
web/test/ft-ready-queue-view.concurrent-reorder.test.ts
web/test/ft-ready-queue-view.rank-adversarial.test.ts
web/test/ft-ready-queue-view.rank.test.ts
web/test/ft-task-card.attention.test.ts
web/test/ft-toolbar.contract.test.ts
web/test/queue-ordering.test.ts
web/test/safe-url.contract.test.ts
web/test/vocabulary.contract.test.ts
```

**Instrument validation — the exclusion is a real discrimination.** These four
`.ts` files exist in the merged tree under the `web` pathspec and are correctly
NOT counted: `web/test/setup.ts`, `web/test/helpers/dom.ts`,
`web/test/helpers/feedback.ts`, `web/test/helpers/fixtures.ts`. Each was checked
as `exists_in_tree=1, in_population=0`.

**No net reduction.** All six members of the 439b309 population are still
present, individually confirmed.

`MIN_TEST_FILES`: **6 → 30**. The path-set comment in
`scripts/ci-suite-manifest.mjs` was updated alongside the constant; leaving it
listing the six 439b309 paths beside a floor of 30 would have made the file
contradict itself, and the file's own text says the set is the auditable artefact.

Gate output: `OK: every tracked JS/TS test file is executed by npm test.
enumerated=30 executed=30 missing=0 (floor 30)`.

## 7. THE BLOCKER — acceptance (a) and acceptance (c) cannot both hold

**Stated as an instruction conflict, not resolved.**

- **(a)** requires the two safe-url files left at main's version.
- **(c)** requires the web test suite to pass.

The branch contributes three test files that encode the **branch's** safe-url
semantics. They are ordinary branch-side additions — not conflicted, not part of
the carve-out — so the merge brings them in unconditionally. With `safe-url.ts`
pinned to main they fail:

```
web/test/safe-url.contract.test.ts
web/test/ft-inspector-code.safe-url.test.ts
web/test/ft-inspector-meta.safe-url.test.ts
```

`vitest run`: **Test Files 3 failed | 19 passed (22). Tests 30 failed | 392
passed (422).**

Root causes, all inside the carve-out:

1. `TypeError: (0 , safeExternalUrl) is not a function` — main's `safe-url.ts`
   does not export it.
2. **Policy disagreement, unsafe URL:** main renders degraded visible text
   echoing the raw URL in a `title` attribute; the branch renders nothing. Tests
   asserting the output does not *contain* `javascript:`/`data:text/html` fail.
3. **Policy disagreement, remote http:** main links any `http:`; the branch links
   only localhost, gated by `LOCAL_HTTP_LINKS_ENABLED`. Hence
   `expected [ 'http://evil.example.com/pr/7' ] to deeply equal []`.

**No XSS regression, and I checked rather than assuming.** Every "renders no
href" assertion **passes** — `javascript:`, `JaVaScRiPt:`, whitespace-padded,
`data:`, `vbscript:`, `file:`. The residual string matches are the raw URL sitting
inertly inside a `title` attribute of a `<span>`, never in an `href`. That is
main's deliberate degrade-to-visible-text behaviour, documented in
`renderExternalSourceLink`.

Closing this needs a decision on `safe-url.ts` — the adjudication that is
explicitly not mine. The three options all belong to em-hardening: land the
branch's safe-url; drop/rewrite those three branch test files; or reconcile the
two policies. I did none of them.

## 8. The cross-language fixture — and a correction to the brief's model

`testdata/url-scheme-cases.json` — **unmoved, unmodified.**

| | |
|---|---|
| Blob at merge commit `7e0e387` | `4a543288d9b161c3014dc10fa7e702637c918f0b` |
| Blob at main `2982ffd` | `4a543288d9b161c3014dc10fa7e702637c918f0b` — identical |
| Present at merge base `aa08f1a` | no |
| Present on branch `e64138c` | no — **main-only file** |

Server half `TestValidateURLFieldMatchesSharedFixtures`
(`internal/server/urlvalidate_differential_test.go:93`) **passes**, with a named
subtest per fixture row (`https_ok`, `userinfo`, `ipv6_host`, `idn_host`,
`bad_percent_escape`, …) — lit, not vacuous.

**Correction worth having.** The brief says the fixture "is not in the web test
population, so no web gate can see it." True of the fixture itself — it is a
`.json` and can never match `TEST_FILE_RE`. But **its client-side reader is
`web/src/util/safe-url.test.ts`, which IS member #5 of the 30**. So a web gate
does exercise the fixture today, through that reader.

Measured:

- main's `safe-url.test.ts` → **5** references to `url-scheme-cases`
- branch's `safe-url.test.ts` → **0** references

Because this merge pins that file to main, **the differential pin is INTACT at
this commit** — both halves live. The hazard is real but *conditional*, and it
lands with the adjudication rather than here: if hardening takes the branch's
`safe-url.test.ts`, the client reader disappears and the Go test goes on
asserting against a fixture nothing on the client checks — passing, executing,
measuring nothing. That is a decision input for em-hardening, not an action for
me.

## 9. Gate results

| Criterion | Result | What the run actually caught |
|---|---|---|
| (a) merge commit, 5 resolved, 2 at main | **PASS** | Parents verified `2982ffd` then `e64138c`; safe-url pair 0-diff vs main, non-zero vs branch |
| (b) `npx tsc --noEmit` in `web/` | **PASS (narrow — see below)** | 0 errors |
| (c) web suite passes | **FAIL — see §7** | node 8/8 pass; vitest 3/22 files fail, 30/422 tests |
| (d) `MIN_TEST_FILES` raised | **PASS** | 6 → 30; gate `enumerated=30 executed=30 missing=0` |
| (e) `go build` / `go vet` | **PASS** | Both exit 0 over 33 packages |
| (f) porcelain-clean | **PASS** | `git status --porcelain` empty; 0 untracked |

### (b) is a narrow green, and I proved the instrument is lit

`web/tsconfig.json` has `"include": ["src"]`. **tsc covers 8 of the 30 population
members; the 22 `web/test/**` files are not typechecked at all** — including
`web/test/safe-url.contract.test.ts`, the file that fails at runtime.

I predicted tsc would FAIL and it did not. Rather than accept the green I found
out why, then ran a positive control: a scratch file inside `src` making the same
`import { safeExternalUrl }` produced

```
src/__tsc_probe__.ts(2,10): error TS2305: Module '"./util/safe-url.js"' has no
exported member 'safeExternalUrl'.
```

So tsc **would** catch this exact defect class; the real file escapes solely by
living outside `include`. Probe deleted; tree verified clean afterwards.

### (c) enumerated / executed / missing

Expected before the run: 30 / 30 / 0. Actual: **30 / 30 / 0**. Note this gate
measures *membership*, not pass/fail — it confirms all 30 files execute, which is
what makes the 3 failures in §7 visible rather than silent.

`npm run test:node` — 8/8 pass, and lit: `url-binding-scan` fired 157 assertions,
`task-ready` 10.

### (e) the clean-checkout defect did not bite

`go build`/`go vet` are clean in this fresh clone. `web/dist/.gitkeep` is tracked
(`.gitignore:53-55` deliberately re-includes it) which satisfies
`//go:embed all:web/dist` in `assets.go`. No environment workaround needed.

## 10. Rule compliance

- **No directory or glob pathspec was ever staged.** Every `git add` named a
  single file. No `-A`, no `.`, no `-u`, no `commit -a`, no `git stash -u`.
- **No credential printed.** No `git remote -v`, no remote URL echoed anywhere.
  The clone was made from the local path `/workspace/farmtable`; its only remote
  is that path.
- **`web/dist` not deleted.** `npm run build` never invoked — only
  `npx tsc --noEmit`. `/workspace/farmtable/web/dist` verified intact (4 entries)
  after all work; my clone's `web/dist/.gitkeep` also intact across `npm ci`.
- **Not pushed.** Two commits sit on local branch `p2-merge-2982ffd`.
- **Auth architecture untouched.** The one auth-adjacent thing in range was main's
  `isCollectionWritable` relocation, and my work *preserves* it unchanged — no
  change to who is authenticated, what they may do, or how that is decided.

## 11. What I recommend next (not done)

1. **em-hardening adjudicates `safe-url.ts`.** Everything in §7 unblocks from
   that one decision. The add/add no-stage-1 property means there is no ancestor
   to diff, so it is a policy choice between two disjoint APIs, not a merge.
2. Feed §8 into that decision: taking the branch side silently unpins the
   cross-language fixture unless its reader is rehomed in the same change.
3. Separately consider whether `tsconfig.json`'s `include: ["src"]` should cover
   `web/test` — 22 of 30 test files are currently untypechecked, which is how a
   missing export reached runtime instead of the compiler. Out of scope here;
   flagged, not filed.
