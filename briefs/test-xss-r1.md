# test-xss-r1 — test review: the pins and the fixtures

Your working tree is `/workspace`. Confirm with `git rev-parse --show-toplevel`, and verify
branch `url-scheme-validation` and commit **`d4c4e6b629ade1d0725bc303c0acf962838f03c9`**.
**Do NOT create any directory named in this brief.**

**You are one of three independent legs reviewing this change.** A code-review leg and a
security-audit leg are running in parallel, in their own clones, on the same commit, on
different axes. **You will not see their reports and they will not see yours.** Do not scope
your work around what you assume they cover.

**Your axis is whether the tests can fail.** Not whether they pass — whether any of them, run
against a broken implementation, would go red. This project's unifying defect is:

> **A check that derives from the thing it is checking cannot falsify it.**

## Baseline `[MEASURED by me at d4c4e6b in this exact clone]`

| check | result |
|---|---|
| `go build ./...` | exit 0 |
| `cd web && npm test` | exit 0 — `task-ready`, `safe-url: ok`, `url-binding-scan: ok` |
| `git status --porcelain` | empty |

Base of the branch is `7a0f220` = `origin/main` = **live in production**. At that base:
`go test ./...` exit 0 with 10 packages ok; `go vet ./...` exit 1 with **exactly 4**
pre-existing copylocks in `internal/server/server.go` at 1500/1610/1818/1995 `[MEASURED by me]`.

## The flake, and a live demonstration of why counts lie

`internal/server` has a `TestWatchTasks*` flake at roughly **8% per full-suite run**
`[MEASURED-BY-test-194-r8]`. **It fired on my very first run in a sibling clone tonight.** My
`grep -c '^FAIL'` said **3**; the actual content was **one** test,
`TestWatchTasks_NoInitial`, `watch_test.go:118: timed out waiting for event`, and the 3 was
output lines (a bare `FAIL`, a package `FAIL`, another bare `FAIL`). Five re-runs: 5/5 clean.

**This matters to you more than to the other legs.** At ~8% per sequential full-suite run, a
mutation matrix of N single-run cells carries roughly a 1-in-12 chance per twelve cells of a
**spurious RED** — a mutant you record as killed that was actually killed by the flake. If you
build a matrix, say how you controlled for this. **Read failing test NAMES, never counts.**

## Rules

- **Do not push. Do not modify production code.** Mutate freely to measure, then revert
  everything and assert `git status --porcelain` empty.
- **Exit codes come from the child process, never through a pipe.**
- **A negative claim needs a positive control.**
- **Predict before measuring**, report predictions beside results, and report your misses.
- **A green control is a finding.**
- **Report denominators.** A count without one is a confirmed lower bound wearing a
  measurement's clothes. That is taxonomy form (6) and it has bitten this project repeatedly —
  including me, tonight, on this very change.
- **My briefs have contained at least one error in twelve consecutive rounds.** Listing every
  place this brief is wrong is a **required deliverable**.

---

# What the change is

Three functional commits plus a project log, fixing a **stored XSS**: attacker-controlled URL
text was persisted verbatim and rendered into `href` attributes in the Lit dashboard.

| commit | scope |
|---|---|
| `4187910` | Server: scheme allow-list at the `UpdateTask` write boundary |
| `80cab87` | Server: same allow-list on the collection-import ingress |
| `f0ab53f` | Frontend: shared `safeHref()`, two call-site fixes, tree-wide scanner, `target="_blank"` pin |

New test files: `internal/server/urlvalidate_internal_test.go` (92 lines),
`internal/server/urlvalidate_rpc_test.go` (210), `web/src/util/safe-url.test.ts` (194),
`web/src/util/url-binding-scan.test.ts` (225). Also changed: `web/package.json` test script and
`web/tsconfig.test.json`.

## The author's report — read it SECOND

`/scion-volumes/scratchpad/projects/farmtable/reports/dev-xss-url.md`. **Form your own view
first, then read it, then treat every claim in it as unverified.**

It claims RED-then-GREEN for five separate experiments, naming failing tests. **Reproduce the
ones that matter rather than accepting the list.** In particular it reports that neutralising
`validateURLField` to `return nil` turns **24** tests red, itemised by subtest name. A count of
subtests going red under one mutation is weaker evidence than it looks: **22 of those 24 are
subtests of a single table**, so they may all be killed by one assertion, and the real question
is what the table cannot express, not how many rows it has.

# Specific things I want measured

1. **Mutate, do not read.** For each pin, break the implementation it claims to protect and
   confirm the pin actually goes red. Include mutations the author did **not** try. Some
   starting points, not a limit: narrow the allow-list to `http` only; accept any scheme whose
   name merely *starts with* `http`; drop the host-non-empty requirement; drop the
   control-character rejection; skip case-folding; make the import-path guard validate only the
   first element of a list; make `safeHref` reject everything (does any test notice a
   **false-positive** regression, or do the tests only pin rejection?).

2. **The tree-wide scanner is a test that is also a control, and it needs its own oracle
   examined.** `url-binding-scan.test.ts` fails on unapproved `href`/`src` bindings tree-wide,
   with an allow-list of justified exemptions. The author reports **7 positive fixtures and 5
   negative fixtures**. Verify that count and, much more importantly:
   - **Does the scanner have a self-test?** If its detector function is replaced with
     `return null` / an empty result, does anything go red — or does the whole suite stay green
     because the scan finds nothing and nothing asserts it *should* have found something?
     **A loop is non-vacuous exactly when some assertion REQUIRES A POSITIVE OUTCOME from it —
     a non-zero count, a named offender, a specific result. A loop whose assertion only ever
     PERMITS an empty result cannot fail when emptied.** Apply that criterion to every loop in
     the file and give me the census **with a denominator**: how many loops, how many survive
     emptying.
   - **Is the scanner blind to its own input?** If the file list it scans is replaced with an
     empty list, or with files that contain no bindings at all, does anything fail? A scanner
     fed nothing that reports nothing wrong is the same defect in a new costume.
   - **Can an allow-list entry be a rubber stamp?** The author claims entries asserting they use
     `safeHref` are checked to actually import it, and that stale entries fail. Test both
     claims by mutation.

3. **Are the *acceptance* paths pinned, or only the rejections?** The author reports a green
   control that is worth taking seriously: with validation **entirely disabled**,
   `TestValidateURLField_AcceptsHTTPAndHTTPS`, `TestRPC_UpdateTask_AcceptsHTTPURLs` and
   `TestRPC_ImportCollection_AcceptsHTTPURLs` **all stayed green**. That is correct and expected
   for those tests — but it raises the converse question, which nobody has asked: **if the guard
   became too strict and started rejecting legitimate `https://` URLs, which test fails?**
   A security guard that can silently break the product is a live risk and the happy-path tests
   are the only thing standing between it and a regression. Establish whether they are load-
   bearing or decorative.

4. **The three ingress paths.** The author claims 3 client-controlled ingress paths for these
   fields and all 3 guarded, and separately that several other writers are deliberately
   unguarded. **Is each guarded path pinned by a test that exercises that path specifically?**
   A path that is guarded but unpinned regresses silently. Report which of the 3 have their own
   pin and which are covered only by a sibling's coverage — coverage locality is not coverage.

5. **A trust question about the evidence itself, which you should settle early.** The author
   self-reports that during one experiment they reverted a file with `git checkout` while the
   real fix on that file was **not yet committed**, wiping the fix — caught by the next test
   run. They state that afterwards they committed before experimenting. **Some RED/GREEN
   measurements in that report were taken before that discipline was in place.** Decide for
   yourself which results you can rely on and re-measure the rest. Do not assume the accident
   was contained just because it was noticed.

# A fact you need that is not yours to fix

`[MEASURED by me at this commit]`: **the Makefile is untouched on this branch.** `make test` is
`go test ./...`; `make web` is `cd web && npm ci && npm run build`; **no Makefile target and no
documented command runs `npm test`.** Every frontend test in this change — including the
chokepoint scanner in item 2 — therefore runs only when a human types `npm test` by hand.

A separate track is already fixing the Makefile. **Do not file it as a defect in this change and
do not fix it.** I am telling you because it bears on how much protection these pins actually
deliver, and because I want your answer to one question: **of the tests added by this change,
which are load-bearing enough that shipping them unrun would be a mistake?**

# Deliverables — you are not done until all six exist

1. **A report at `/scion-volumes/scratchpad/projects/farmtable/reports/test-xss-r1.md`** with a
   verdict — **APPROVE** or **REQUEST CHANGES** — and findings numbered and severity-rated.
2. **Your mutation table**, with every prediction stated before the result, your **hit/miss
   count including misses**, and your control for the flake.
3. **The loop/fixture census with denominators** for `url-binding-scan.test.ts` and
   `safe-url.test.ts`: how many loops and tables, how many survive emptying, how many are
   guarded.
4. **Your answer to the load-bearing-tests question above.**
5. **A project log entry** in `.design/project-log/`, **committed** (the only thing you commit).
6. **An explicit list of every place this brief was wrong.** If nothing, say so and say what you
   checked. Twelve consecutive rounds; assume there are more.

**You MUST produce all six deliverables and then mark the task complete.**

**Do NOT push.**
