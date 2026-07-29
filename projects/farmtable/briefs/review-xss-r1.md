# review-xss-r1 — code review: the diff and the structure

Your working tree is `/workspace`. Confirm with `git rev-parse --show-toplevel`, and verify
branch `url-scheme-validation` and commit **`d4c4e6b629ade1d0725bc303c0acf962838f03c9`**.
**Do NOT create any directory named in this brief.**

**You are one of three independent legs reviewing this change.** A test-engineering leg and a
security-audit leg are running in parallel, in their own clones, on the same commit, on
different axes. **You will not see their reports and they will not see yours.** That is
deliberate — the independence is the point. Do not speculate about what they will find and do
not scope your work around what you assume they are covering.

**Your axis is the diff and the structure**: correctness, readability, architecture, the
quality of the abstractions, and whether the change's own internal rationales are true.

## Baseline `[MEASURED by me at d4c4e6b in this exact clone]`

| check | result |
|---|---|
| `go build ./...` | exit 0 |
| `cd web && npm test` | exit 0 — `task-ready`, `safe-url: ok`, `url-binding-scan: ok` |
| `git status --porcelain` | empty |

Base of the branch is `7a0f220` = `origin/main` = **live in production**. At that base:
`go test ./...` exit 0 with 10 packages ok; `go vet ./...` exit 1 with **exactly 4**
pre-existing copylocks in `internal/server/server.go` at 1500/1610/1818/1995, all
`assignment copies lock value to ephReq: …contains sync.Mutex` `[MEASURED by me]`.

`internal/server` has a `TestWatchTasks*` flake at roughly **8% per full-suite run**
`[MEASURED-BY-test-194-r8]`, **and it fired on my first run in a sibling clone tonight** — my
`grep -c '^FAIL'` said 3, it was **one** test, and the 3 was output lines. Five re-runs were
clean. **Read failing test NAMES, never counts**, and re-run any `TestWatchTasks*` failure.

## Rules

- **Do not push. Do not modify production code.** Your independence depends on it. Probes and
  scratch experiments are fine; revert them and assert `git status --porcelain` empty.
- **Exit codes come from the child process, never through a pipe.** A leg tonight reported
  `BUILD_EXIT=0` that was `head`'s exit code.
- **A negative claim needs a positive control.** Every one. Mine included.
- **Predict before measuring** and report the prediction beside the result. Report the
  predictions you got wrong — they are the informative ones.
- **A green control is a finding.** Write it down.
- Tags: `[MEASURED]` = you ran it. `[MEASURED-BY-<x>]` = relayed, re-measure before relying.
- **My briefs have contained at least one error in twelve consecutive rounds.** Listing every
  place this brief is wrong is a **required deliverable**.

---

# What the change is

Three functional commits plus a project-log commit, fixing a **stored XSS**: attacker-controlled
URL text was persisted verbatim by the API and rendered directly into `href` attributes in the
Lit dashboard, with no validation in Go, none in TypeScript, and no sanitizer in Lit.

| commit | scope |
|---|---|
| `4187910` | Server: scheme allow-list at the `UpdateTask` write boundary |
| `80cab87` | Server: same allow-list on the collection-import ingress |
| `f0ab53f` | Frontend: shared `safeHref()`, two call-site fixes, a tree-wide scanner, a `target="_blank"` pin |
| `d4c4e6b` | Project log |

Diffstat: 13 files, +1079/−14. New files: `internal/server/urlvalidate.go` (121),
`urlvalidate_internal_test.go` (92), `urlvalidate_rpc_test.go` (210), `web/src/util/safe-url.ts`
(70), `safe-url.test.ts` (194), `url-binding-scan.test.ts` (225).

## The author's report — read it SECOND

The implementing leg wrote
`/scion-volumes/scratchpad/projects/farmtable/reports/dev-xss-url.md`.

**Form your own view of the diff before you read it.** Then read it and treat **every claim in
it as unverified**. It is a careful report, which makes it more dangerous to skim than a sloppy
one: this project's single most-repeated defect is **a docblock's account of what a line is
for, believed instead of measured**. Two legs last round recorded that exact error, in that
exact form, as their own.

There are several load-bearing claims in it that are **architectural decisions justified by
assertions about the code**, which is squarely your axis. Among them, and not exhaustively:

- That `Attachment.url` is a **dead field** — "no write path, no read path and no renderer" —
  and therefore deliberately not guarded, despite carrying a `uri` constraint.
- That an **interceptor-based fix would have missed a path**, and that placing the check in the
  service method body covers all four gRPC registration sites.
- That platform-sync writes (`internal/platform/github/*`) are **deliberately** left
  unvalidated because they are not client-controlled.
- That empty string is accepted and means "unset".
- That `ft-toolbar.ts:461-465` was **not** a reusable guard, so `safeHref()` is new code rather
  than a lift of an existing pattern.
- That a named constant lists the `RemoteData` keys that `convert.go` surfaces as URL-typed,
  kept correct by a "keep in sync with convert.go" comment.

**I am not telling you any of these is wrong.** I am telling you they are the load-bearing
ones, they are on your axis, and a comment is not a control.

# Specific things I want your judgement on

1. **The two guards are two implementations of one rule.** There is a Go allow-list and a
   TypeScript allow-list, and the report itself documents that **Go's `net/url` and the
   browser's WHATWG parser disagree about what `java\tscript:alert(1)` is** — Go errors, WHATWG
   strips the tab and yields `protocol === 'javascript:'`. The report argues the allow-list makes
   them agree on the *outcome* despite disagreeing on the *parse*. **Is that argument sound, and
   is it sound for the whole input space or only for the examples given?** Two independent
   implementations of one security rule, in two languages, with two parsers, is a drift surface.
   Say whether it is an acceptable one and what would detect the drift.

2. **The tree-wide scanner is the most interesting object in the diff.** `url-binding-scan.test.ts`
   is a chokepoint: it fails on any unapproved `href`/`src` binding or `.href`/`.src` assignment
   anywhere in the tree, with an allow-list carrying written justifications. This project's
   standing rule is *when a hazard is open-set, the fix is a chokepoint, not a checklist* — so the
   intent is right. **Review it as production code, because that is what it is.** Can it be
   silently disarmed? Can an allow-list entry be a rubber stamp? What binding shapes does it not
   match, and how would anyone find out? **What is its own oracle, and can that oracle falsify
   the thing it checks?**

3. **`web/tsconfig.test.json` changed (+6/−?) and `web/package.json`'s `test` script changed.**
   The suite is a hand-maintained chain of `node .tmp-test/...` invocations, `&&`-joined. Assess
   that as a structure: what happens when someone adds the fourth test file?

4. **Read all four commits separately, not just the squashed diff.** Check that each is coherent
   on its own and that commit messages describe what the commit does.

# A fact you need that is not in the diff, and is not yours to fix

`[MEASURED by me at this commit]`: **the Makefile is untouched on this branch**, `make test` is
`go test ./...`, `make web` is `cd web && npm ci && npm run build`, and **no Makefile target and
no documented command runs `npm test`.** So the new tree-wide scanner — the chokepoint in item 2
— is wired into `npm test` and `npm test` is invoked by nothing.

A separate track (`dev-prod-hardening`) is already fixing the Makefile, so **do not file this as
a defect in this change and do not fix it.** I am telling you because it may change your
judgement of item 2, and because I want your view on one question I have not decided:
**does this change ship correctly on its own, or must it ship together with the Makefile fix?**
Give me a recommendation with your reasoning.

# Deliverables — you are not done until all five exist

1. **A report at `/scion-volumes/scratchpad/projects/farmtable/reports/review-xss-r1.md`** with
   a clear verdict: **APPROVE** or **REQUEST CHANGES**, an overall risk rating, and findings
   numbered and severity-rated with `file:line` references and recommended fixes.
2. **Your explicit answer to the ship-alone-or-ship-together question above.**
3. **An explicit statement of whether this change should be escalated to any further specialist,
   and why.** Note carefully: this is your recommendation about *follow-on* work. **It is not a
   decision about the parallel legs already running, which you cannot cancel and must not
   assume the content of.** A review leg last round recommended against a security audit that
   was already running and had found two HIGH-severity issues the review could not see.
4. **A project log entry** in `.design/project-log/`, **committed** (the only thing you commit).
5. **An explicit list of every place this brief was wrong.** If nothing, say so and say what you
   checked. Twelve consecutive rounds; assume there are more.

**You MUST produce all five deliverables and then mark the task complete.**

**Do NOT push.**
