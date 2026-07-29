# Phase 2 combined review — SHARED CONTEXT

Read this first. Your role-specific brief references it.

## What you are reviewing

The complete Phase 2 web-UI line, `7a0f220..633f8f2` on branch
`task-state-web-ui-v2`: **39 commits, 73 files, +14063 / -378**.

`7a0f220` is `origin/main` and is **live in production**. Phase 2 has never
been merged or deployed. This is the review that gates that.

This is contract **§13 Phase 3** (web UI). Our internal numbering is off by one
from the contract's — our "Phase 2" is the contract's Phase 3. The contract is
the source of truth for requirements.

## Rounds 1–3 were already reviewed. Rounds 4 and the attention view were not.

Weight your effort accordingly, but do **not** treat the earlier rounds as
out of bounds — this is the last gate before a production deploy, and the point
of a combined review is to catch what per-round reviews could not see: whole-line
coherence, and interactions between fixes made in different rounds.

The unreviewed delta:

- **r4 fixes** — merged at `6d8ea23`. Included an `ft-app.ts` change for
  write-error delivery (H-2) that was flagged as delicate. Three mutants were
  required dead: `CMP-02`, `F3-05`, `RANK-09`.
- **attention view** — `3fb65f2`, `f228e72`, `633f8f2`. Contract §10's
  "attention view for dependents blocked by unsuccessful terminal
  prerequisites". Dev report:
  `/scion-volumes/scratchpad/projects/farmtable/reports/dev-attention-view.md`.

## Standing bars on this workstream

1. **Mutation testing is the bar.** A claim of "verified" without pasted actual
   failing output is not evidence. Apply this to your own work too: if you
   assert something is covered or uncovered, prove it by breaking it.
2. **The self-built oracle defect class.** A test that asserts against a local
   re-implementation of the logic instead of the real exported symbol. This
   workstream has removed **thirteen** and rejected a fourteenth. Ownership
   restricts writes, never reads — production and tests must both import the
   real symbol. Hunt for a fifteenth.
3. **The vocabulary anchor.** `web/test/vocabulary.contract.test.ts` claims to
   be the only place user-visible strings appear as literals. Round 3 found that
   claim already violated twice. The attention-view dev found a **third**
   violation and reported it without fixing (see below).
4. **Do not self-review.** Re-derive findings from the code. You may read the
   dev reports, but ratify nothing on their say-so.

## Known-deferred items — confirm the calls, do not re-litigate blindly

The attention-view dev disclosed these. I want your independent judgement on
whether each is acceptable to ship:

1. **`ft-inspector-relationships.ts` has unanchored user-visible copy**
   (`:224`, `:228`, `:229`, `:308`). `'Blocked by dependency'` at `:308` is a
   hand-written twin of `AVAILABILITY_REASON_LABEL[BLOCKED_BY_DEPENDENCY]`, so
   the two can now disagree **in the same panel**. This is the fifth place the
   attention concept is worded. Reported, not fixed — out of that dev's scope.
   **Is this a blocker or a follow-up?**
2. **`matchesTaskFilters` now takes seven positional parameters**, the seventh
   being `store: TaskStore`. The dev argued the store is resolution context, not
   a filter, and rejected an optional-store variant because a caller that forgot
   it would silently answer "nothing needs attention" — a wrong answer
   indistinguishable from a right one. Collapsing the six into an object was
   judged shared-architecture churn immediately before a deploy. **Right call?**
3. **Selecting "Needs attention" on the Available Queue shows "All clear!"**
   Attention tasks are unavailable by definition so the queue correctly lists
   none; identical to today's `unavailable`/`Held` behaviour. The dashboard tile
   routes to the board specifically so the affordance never lands a user there.
   The dev explicitly asked for a reviewer second opinion instead of
   special-casing. **Give it.**
4. **Scope exception the dev disclosed**: bound `ft-task-card.ts`'s inline
   `'Needs attention'` and its test's local constant to `ATTENTION.label`,
   because leaving them would have falsified the anchor's "only place" claim on
   the day it was written. Purely literal→constant.

## Things that are NOT in this line — do not report them as Phase 2 defects

- **#195 markdown sanitizer hardening** is a **separate branch**
  (`markdown-sanitize`, based directly on `7a0f220`). Phase 2 therefore still
  contains the *unhardened* `renderMarkdown` — bare
  `DOMPurify.sanitize(marked.parse(md))` with no `FORBID_TAGS`/`FORBID_ATTR`.
  I have verified this same unhardened version is **already on `origin/main` and
  already live**, along with both `unsafeHTML` sinks. So it is a live production
  exposure that Phase 2 neither introduces nor worsens, and it is being fixed
  independently and merged ahead of Phase 2. Note any *interaction* you find,
  but do not file the sanitizer itself against Phase 2.
- **#191 / #194** are Go backend branches, not part of this line. I confirmed
  Phase 2 changes **0 `.go` files**, so there is no collision between them.
- **Phase 1** is merged, deployed and live. Out of scope. Do not propose changes
  to it.
- **#196** (production sourcemaps): I verified on this exact branch that
  `vite.config.ts:16` sets `sourcemap: false` and a clean build emits **0**
  `*.map` files. Confirm if you wish; do not "fix" it.
- **#197** flaky tests and **#199** `copylocks` in `internal/server/server.go`
  are filed and tracked elsewhere.

## Known merge collision with #195 — context, not a finding against you

Phase 2 merges **last**, after #195. I diffed the two file sets: the only
overlap is `web/package.json`, `web/package-lock.json`, `web/tsconfig.test.json`.
`markdown.ts` and `markdown.test.ts` do **not** overlap.

Two of the three resolve themselves, and credit where due — the Phase 2 author
clearly anticipated this:

- `tsconfig.test.json` — Phase 2's `src/**/*.test.ts` glob **subsumes** #195's
  explicit path, so #195's test still compiles.
- the `test` script — Phase 2 replaces it with `run-node-tests.mjs`, which globs
  rather than hardcoding, *and* fails loudly on a source/compiled count
  mismatch. #195's test is picked up automatically. The file even documents this
  intent: *"including files that arrive from other branches at merge time."*
  If you are looking for something to praise in this review, that is a real
  instance of designing for a merge the author could not see.

The third does **not** resolve itself: #195 declares `jsdom@^29.1.1`, Phase 2
declares `jsdom@^26.1.0`, and the ranges are disjoint. I have asked the #195
cleanup round to test whether the sanitizer suite passes on `^26` and, if so, to
move to it so this evaporates. **You do not need to act on this** — it is mine
to sequence, and I am telling you only so that if you see the version skew you
know it is tracked rather than missed. If you think the resolution should go the
other way, say so and I will weigh it.

## Gate status — I ran this myself on `633f8f2`, independent of any dev claim

```
npm test        -> 22 files, 407 tests, all pass  (base was 382)
npx tsc --noEmit                      -> exit 0
npx tsc -p tsconfig.test.json --noEmit -> exit 0
rm -rf dist && npm run build          -> clean
find dist -name '*.map' | wc -l       -> 0
npm audit --audit-level=low           -> 0 vulnerabilities
```

So "the suite is green" is established. Do not spend your round re-establishing
it — spend it on what green does not prove.

## Rules

- **Do not push.** If you commit anything at all, commit only your own project
  log entry. Never modify production code — that is the developer's job and your
  independence depends on not doing it.
- Your workspace is a dedicated clone. Confirm your branch with
  `git branch --show-current` before anything else.
- Give every finding a severity (Critical / High / Medium / Low / Info), a
  `file:line`, and a concrete recommendation. State a clear verdict:
  **APPROVE** or **REQUEST CHANGES**.
- Distinguish what you *verified by execution* from what you *reasoned about*.
  Say which is which. That distinction has repeatedly been the difference
  between a real finding and a wrong one on this workstream.
