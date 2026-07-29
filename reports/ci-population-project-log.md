# Project log — read-ci-population

**Leg:** read-ci-population (investigator)
**Date:** 2026-07-29
**Report:** `/scion-volumes/scratchpad/projects/farmtable/reports/ci-population.md`
**Mode:** READ-ONLY. No build token used. No commits. No pushes. No contact with any agent
but the dispatching EM.

## What was asked

Which automated gates run this project's tests, what population of tests can each see, and
who actually takes the invocation path that runs it — at `main` and at the r6 tip.

## Protocol

Two-phase, followed as written. Sections 1–6 and 8 of the report were written and saved to
disk before `_SEALED-em-ci-measurements.md` was opened. Section 7 was appended afterwards.
No breach. Where Phase 2 changed a Phase 1 conclusion, the Phase 1 wording is left intact
and marked with an amendment rather than rewritten.

## Revisions handled — four, not the two in the brief

| Label | SHA |
|---|---|
| brief's "main" (stale local ref) | `7a0f220dbd9332cb8db62138c841777432b4eda4` |
| **real main on origin** | `cc927355e5a23c45bfd983cd331eb540b0a61ad5` |
| r6 tip | `c108acbcfa2357862576092469828709bb6c4090` |
| CI branch tip (merged into real main) | `4c2d75424b9a0090be20d97dfdb91b2753663362` |

## Findings, in order of consequence

1. **CI exists.** `.github/workflows/ci.yml` is merged into `main` at `cc92735` (PR #205)
   and pushed to origin. The project-wide belief that "there is no CI" is false and is
   asserted by three committed artefacts: the brief, r6's `Makefile` comment, and r6's
   `internal/webguard/doc.go`. All three were true when written.

2. **The gate and the tests are on different branches.** Real main has the CI but a web
   suite of one hand-named file with no security assertions. r6 has the four discovered web
   test files carrying the URL-scheme security property but no workflow. Consequence: the
   client-side URL-scheme guards have **zero automated invokers today**.

3. **r6 was never pushed.** `git ls-remote --heads origin` returns 97 heads, none matching
   `url-scheme|r6`. The workflow's `push: branches: ['**']` trigger was written specifically
   to watch long-lived unmerged branches and still cannot reach r6, because the branch is not
   on the remote.

4. **Predicted merge blocker.** On merging r6 into real main, the CI step
   `node scripts/ci-suite-manifest.mjs` is predicted to exit 1: it cannot map r6's
   `node scripts/run-tests.mjs` to a test file, so all four r6 web tests land in `missing`.
   This is its fail-closed design working correctly. UNVERIFIED — needs a build token.
   The two branches independently built incompatible solutions to the same problem: r6
   replaced the hand-list with discovery; main kept the hand-list and added a checker for it.

5. **A gate nothing invokes.** `test/integration/run-all.sh` is referenced only by its own
   README at every revision examined, including the one with CI. No Makefile target, no
   Dockerfile step, no workflow step.

6. **A population of one.** `npm test` at both main revisions hand-names a single compiled
   file, in two places that must agree (`package.json` and `tsconfig.test.json`).

7. **Incomplete fix at r6.** `agents.md` was updated to mandate `make test`, but
   `.agents/skills/farmtable-dev/commands/test.md` is byte-identical at both revisions
   (blob `0e9e5d3`) and still says `go test ./...` only.

8. **Minor r6 regression.** Real main's `test-web` depends on a `web-deps` (`npm ci`) target;
   r6's does not, so `make test` on a fresh r6 clone fails at the web half.

## Where my instrument could not answer the question

The assigned clone (`/workspace/farmtable-ci-population`) **cannot see the CI commit at all**
— `git cat-file -t 4c2d754` fatals, and its `origin/main` is stale at `7a0f220`. The dispatch's
"all 206 branches fetched" did not include `ci/22-github-actions-setup`. A scan bounded to the
assigned tree would have confidently filed "no CI exists". The brief's decision to state the
known gap explicitly, rather than hide it, is the only reason it was closed.

## Method note worth keeping

**`git ls-remote` is the only cheap read in git that cannot be stale**, and it was absent from
every instrument list used tonight. Four separate stale-artefact incidents in this
investigation — the brief's r6 SHA, canonical's `origin/main`, the sealed file's r6 ref, and
canonical's untracked `web/dist` — would each have been caught by one remote read. Recommend it
becomes standing apparatus for any question of the form "what is on branch X".

**Second, smaller:** in zsh, `git show "$R:web/..."` silently misparses because `:w` is a
history-expansion modifier. Use `"${R}:web/..."`. A leg scripting this could read the failure as
"file absent".

## Disagreements with the sealed EM measurements

Agreed exactly on items 1, 2, 3, 6, 7, 8, 9, 10 and the first clause of 11. Disagreed on:

- **Item 4** — canonical's r6 ref now reads `c108acb`, not `b330096`. Staleness, not error.
- **Item 5** — correct within its stated bound; the project's generalisation from it is false.
- **Item 11, second clause** — `web/node_modules` is **present** in canonical (110 entries),
  with node v20.20.2 and npm 10.8.2 on PATH. The developer container **can** run the web half.
  It is absent only in fresh clones. This removes the load-bearing evidence for the sealed
  conclusion's mirror-image argument.
- **The conclusion** — the mirror-image framing holds only at r6 and only under the false
  no-CI premise; on real main a single gate runs both suites.

## Not checked

No suite executed (no build token). No GitHub Actions run history queried, so I cannot say the
gate is green, red, or effective — only that it is configured and triggered. Branch-protection
and required-check settings unexamined, so I cannot say the workflow blocks a merge. Six of
~230 workspace directories audited, chosen by name; two relevant-looking directories
(`farmtable-dev-103-testlist`, `farmtable-xss-r6-fix`) have no `.git` and were not opened.
203 of 206 branches unexamined.
