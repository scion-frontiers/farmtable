# BRIEFING: The web test split between `main` and `phase2-web-ui-r5`

**From:** architect-reviewer (independent reviewer of process, engaged directly by ptone)
**To:** farmtable-em-ci, farmtable-em-task-state-model-v2, coordinator
**Date:** 2026-07-29
**Endorsement:** ptone has read and endorsed the recommendation in §5.
**Escalation:** Questions go to **ptone**, not to each other, and not to me.

Measurement basis: `origin/main` @ `aa08f1a`, `origin/phase2-web-ui-r5` @ `61ca67e`,
both re-fetched at 15:0xZ. Main moved at 14:42:54Z; figures taken before that are stale.

---

## 1. The one-line finding

**There is no strategic fork to resolve.** Two workstreams independently built the two
halves of the same design and neither knows the other did it. The CI workstream built
first-class vitest support into main's CI gate, and it has never had a vitest suite to
run. The task-state workstream built a vitest suite, and it has never had CI support.
They fit together. The merge is three narrow textual conflicts, not a decision.

## 2. Why the "node:test vs vitest — pick one" framing is false

Three independent measurements, any one of which is sufficient.

**2a. The branch preserves main's test command exactly and adds a second one.**

```
MAIN    "test":            "node scripts/run-node-tests.mjs"

BRANCH  "test":            "npm run test:node && npm run test:components"
        "test:node":       "node scripts/run-node-tests.mjs"     <-- byte-identical to main's
        "test:components": "vitest run"                          <-- additive
```

The branch is a strict superset. Its only devDependency additions are `vitest ^3.2.7`
and `jsdom ^26.1.0`.

**2b. The two globs provably do not overlap.**

Main's runner walks `web/src/` only. `web/vitest.config.ts` sets
`include: ['test/**/*.test.ts']` — `web/test/` only. Measured file counts on the branch:
22 test files in `web/test/`, 4 under `web/src/`. No file is in both sets. The branch's
vitest config says so in a comment, and the tree agrees.

**2c. They test different things, and one of them is currently untestable.**

`web/src/**` holds pure-logic tests run as standalone Node scripts. `web/test/**` holds
Lit component/DOM tests needing jsdom. `dev-onhold-toolbar` stopped its task partly
because "the project has no browser/DOM test harness at all" and a DOM assertion
"cannot execute in this project today, regardless of wiring." The branch supplies
exactly that harness.

## 3. Answering ptone's question directly

> *"Can't CI leverage different test approaches for different parts of the codebase —
> seems like if tests are already written with Vite, we should use that in CI."*

Yes — and main's CI is **already built for it**, more thoroughly than the question assumes.

`scripts/ci-suite-manifest.mjs` runs in CI as the step *"Which JS suites will actually
run (fails if any is unwired)."* It is runner-polymorphic by design. It parses
`web/package.json`, follows `npm run X` chains, identifies each runner, and resolves
each one's true file set:

- `node --test <explicit files>` — reads the positionals, and **fails** the build on a
  bare `node --test` with no positional (node 20 and node 22 discover different files).
- a runner script offering `--list` — asks it, then cross-checks the answer against
  `tsc -p <config> --showConfig` and against an independent tree scan, failing on any
  residue in either direction.
- **vitest** — `VITEST_BIN = 'web/node_modules/vitest/vitest.mjs'`, and `vitestFiles()`
  shells `vitest list --filesOnly`, honouring vitest's own `include`/`exclude` and any
  positional filters.

The vitest arm carries this comment: *"the previous revision's hand-written
approximations of both were wrong in opposite directions."* Someone iterated on vitest
support, twice, in a repository containing zero vitest tests.

Finally, the gate fails if any test file on disk belongs to **no** suite. That is
precisely the guarantee that makes "different approaches for different parts" safe
rather than a place for files to go missing.

## 4. The three conflicts

`git merge-tree --write-tree` against current main, exit 1:

```
CONFLICT (content): web/package.json
CONFLICT (add/add): web/scripts/run-node-tests.mjs
CONFLICT (content): web/tsconfig.test.json
```

The add/add is new since the earlier survey — main independently created a file of the
same name at the same path. It is **not** a rename or a near-duplicate; the two files
are substantially different and main's is the more developed.

## 5. RECOMMENDED RECONCILIATION (ptone-endorsed)

Resolve each conflict independently. The direction is **not** uniform.

| File | Take | Why |
|---|---|---|
| `web/scripts/run-node-tests.mjs` | **main's, wholesale** | Handles the node 20 / node 22 discovery divergence that cost CI run 30458935255; treats zero discovered tests as failure rather than a silent pass; offers `--list`, which the CI gate consumes. The branch's version predates all of this and is superseded. |
| `web/tsconfig.test.json` | **main's (4 include globs)** | Main's runner hard-couples its `TEST_SUFFIXES` to this `include` list, and the CI gate cross-checks the two and fails on divergence. The branch narrows it to one glob, desyncing the pair. |
| `web/package.json` | **the branch's `scripts` block; union the devDeps** | This is the one place the branch wins outright: its `test:node` *is* main's `test`, so taking the branch's chain loses nothing and gains `test:components`. Add `vitest` + `jsdom`. |

**Nothing is lost by taking main's runner.** Both versions discover by glob, so the
branch's three new `web/src/util/*.test.ts` files are picked up unchanged.

Non-conflicting branch additions merge clean and should be kept: `web/vitest.config.ts`,
`web/test/` (22 test files plus `test/setup.ts`).

Ordering note, already satisfied: CI runs `npm ci` in `web/` *before* the manifest step,
so `VITEST_BIN` will exist when the gate asks vitest for its file list.

## 6. What I did NOT verify — the bounded task this leaves

I did not execute `scripts/ci-suite-manifest.mjs` against a merged tree. I read its
source; I did not run it. Everything in §3 is established by reading the code, and a run
could confirm or complicate it.

Two specific things a run would settle:

1. Post-merge the gate reports **two** suites and ~26 files for the first time in the
   repository's history. It has only ever seen one suite and one file.
2. `web/test/setup.ts` is not a `*.test.ts`. Whether the gate's "present" scan counts it
   as an unwired test file depends on how that scan is spelled, which I did not trace.

Both are small and belong to whoever performs the merge.

## 7. What this briefing does not decide

Branch ownership, merge sequencing relative to other in-flight work, and who performs
the merge are not mine to assign. ptone directs; I measured.

---

# ADDENDUM, 15:17Z — THIS BRIEFING'S FIGURES ARE SUPERSEDED

Everything above was derived at `origin/main` @ `aa08f1a`. **Main moved to `439b309` at
14:55:17Z**, roughly thirteen minutes later. Re-derived:

| Figure | At `aa08f1a` | At `439b309` |
|---|---|---|
| web test files on main | 1 | **6** |
| merge conflicts vs branch | 3 | **9** |
| merged population (union) | 26 | **30** |

New conflicts at `439b309`: `web/package-lock.json`,
`web/src/components/inspector/ft-inspector-code.ts`, `…/ft-inspector-meta.ts`,
`web/src/util/safe-url.ts` (add/add), `web/src/util/safe-url.test.ts` (add/add),
`web/src/utils/task-ready.test.ts`.

**The 30 trap.** em-ci's control was "26 = 22+4 confirms the four helpers are excluded;
30 otherwise." At `439b309` the *correct* merged population is 30, because the union grew
by four genuine test files. The disconfirming value became the expected value and nothing
announced the inversion. Coordinator's generalisation, which is the right one:
**publish the path set, never the integer.** A count cannot distinguish leak from growth;
a set can.

**`safe-url` is carved out of the merge** (coordinator's ruling). Both sides independently
wrote `web/src/util/safe-url.ts` and its test. That is two teams' separate knowledge of
what a hostile URL looks like, not a merge conflict. Procedure: union the two test tables
FIRST, then let the unioned table choose the implementation. If the tables contradict on a
scheme, escalate as a standalone policy question rather than resolving it silently.
em-hardening adjudicates and lands these two files separately.

**Section 5's core recommendation still stands** — the branch is a strict superset, the
globs do not overlap, and main's CI gate already speaks vitest. §6's caveat is now
discharged: em-ci ran the gate on a fresh clone of the rebased commit (two suites, exit 0),
and `dev-p2-rebase` had already committed the recommended reconciliation at 14:59:40Z,
independently.

**The durable lesson is the staleness itself.** Three separate figures in this document
decayed within twenty minutes of being measured. In this project, measurements expire
faster than they can be acted on; any figure must be published with the SHA it was taken
at, in the same sentence.
