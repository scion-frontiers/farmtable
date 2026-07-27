# Phase 2 web UI — round-5 fix pass (pre-merge close-out)

**Branch:** `attention-view` (`633f8f2` → `8fa5762`)
**Date:** 2026-07-27

Closing round on the Phase 2 web UI line. Phase 2 took a full three-way
independent review at `633f8f2`: security audit APPROVE, test review APPROVE,
code review REQUEST CHANGES. This round addresses the code review's one High
and two Mediums plus the audit's two Lows. Five items, all additive, no
production behaviour changed except the vocabulary bindings in item 1.

Test count **407 → 422**. Full gate green.

## What changed

### 1. H-1 — the inspector's attention copy is now anchored

The inspector wrote the needs-attention concept a fifth time, in words of its
own. `:224` rendered `Dependency attention needed` while every other surface
fed by the *same* `attentionBlockers()` call rendered `ATTENTION.label` =
`Needs attention` — and the card badge and the inspector are on screen at the
same time, so this was already-live divergence rather than latent risk.

`:228–229` was worse than a synonym: `An unsuccessful terminal prerequisite is
still blocking this task` implies the block is merely *current*, while
`ATTENTION.explanation` deliberately conveys permanence. Contract §11 makes
these blocks permanent, so the inspector was conveying the precise wrong
implication the `explanation` docblock exists to prevent.

Extended `ATTENTION` with `calloutTitle` / `calloutBody(n)` and bound `:224`,
`:227–229` and `:308` (the last a hand-written twin of
`AVAILABILITY_REASON_LABEL[BLOCKED_BY_DEPENDENCY]`). The `Object.keys()`
completeness guard in `vocabulary.contract.test.ts` now forces the new entries
to be pinned.

The test's `ATTENTION_TITLE` / `PLAIN_BLOCKED_TITLE` were transcriptions used
as DOM locators — they moved with the component, which is exactly why renaming
the constant left the suite green with the UI internally inconsistent. They now
import the real symbols.

**A note on how this was verified, because the obvious check is misleading.**
The brief asked for the deliberate-rename simulation to go RED. Run literally
against the fixed tree it goes **green** — and that is the correct outcome, not
a failure to fix: the component now *derives* from the constant, so a rename
propagates properly and there is no drift left to detect. The experiment that
actually tests the new property is drift **re-introduction**: rename the
constant, update the anchor, and hardcode the inspector's literals as they were
before. Pre-fix that combination was 407/407 green; post-fix it is 10 failures.
Both runs are pasted in the report.

### 2. M-2 / F-2 / ATT-03 — derived-loop cardinality pinned in all four loops

Four test loops built their case list by filtering a stage list through the
very predicate under test. That protects against **widening** and is blind to
**narrowing**: remove a stage and the case for that stage does not fail, it
ceases to exist, and the runner reports green on a smaller number. The only
guards asserted `length > 0`, which one of three satisfies.

Nothing anywhere in the suite hardcoded `DUPLICATE`, so it was the exposed
member of both predicates. `WONT_FIX` and `CANCELLED` survived only
incidentally, because unrelated fixtures happen to use them.

Fixed all four sites (the code review named two; the third and fourth came from
the test review's `DROP-01` symptom and a grep):

| file | derived from |
|---|---|
| `test/ft-task-card.attention.test.ts` | `isUnsuccessfulTerminalStage` |
| `test/ft-inspector-relationships.test.ts` | `isUnsuccessfulTerminalStage` |
| `test/ft-kanban.drop-refusal-affordances.test.ts` | `!acceptsStageDrop` |
| `test/ft-kanban-view.contract.test.ts` (×2) | `!acceptsStageDrop` |

Kept the derived loops — the widening protection is genuinely valuable — and
added an explicit membership assertion beside each.

### 3. M-3 / F-1 — the partial-renumber emission is bound

Both `writes.length > 1` → `> 0` and deleting the `message` key outright left
the suite green. The logic was correct as written; this was purely a coverage
gap on the **producer** side of the seam. The existing tests construct the
detail object by hand and dispatch it at `ft-app`, which binds `onWriteError`'s
prefer-`message` branch but proves nothing about the queue attaching `message`
under the right condition and only then.

Worth recording: commit `3fb65f2` is titled *"anchor the partial-renumber
failure message"* and it anchored the **constant** while leaving the
**emission** unbound. The half hardest to get right was the half with no test.

One wrinkle found while writing the test. The obvious construction —
`client.rejectUpdateWith` — rejects from call **one**, so nothing is ever
persisted and the scenario is not the part-way failure the message describes;
it also makes `updateTaskCalls.length` a useless proxy for `writes.length`. The
new multi-write test instead fails the **second** write via
`updateTaskResponse`, producing a genuine partial renumber with an earlier rank
already on the server. The pre-existing test at
`ft-ready-queue-view.rank.test.ts` named "rolls the whole band back when a
renumber fails part way through" has the same weakness — it fails on write one,
so it is not really exercising "part way through". Left alone as out of scope;
noted below.

### 4. audit L-1 (M4) — the toast's HTML escaping is pinned

`showErrorToast` uses `document.createTextNode` — correct and injection-proof —
but converting it to `insertAdjacentHTML` left all tests green. In scope
because Phase 2's own H-2 change added a caller branch routing `crossBandToast`
through that sink, and that message interpolates a **raw task title**. So the
range both refactored the sink and gave it user-controlled input while adding
nothing that pins the escaping. Not exploitable today; a regression would be
stored XSS in the app origin.

### 5. audit L-2 — three credential rows on the safe-url contract table

`safeExternalUrl` rejects embedded credentials to defeat destination confusion
(both call sites render *static* link text, so `https://github.com@evil.example/`
reads as github.com in the status bar). The contract table had no `@`-bearing
input at all, so the check was guarded only by the plain-Node suite. Structural
risk rather than a live hole: if the Node runner is ever retired in favour of
the Vitest harness Phase 2 just built, the check silently loses all coverage.

## Verification

Every mutation named in the brief went SURVIVED → DEAD, with output pasted in
the report:

| mutant | before | after |
|---|---|---|
| `DUP-DROP` | SURVIVED (407→405 green) | **DEAD** — 2 failed / 414 |
| `DROP-01` | SURVIVED (407→402 green) | **DEAD** — 3 failed / 411 |
| `WF-01` | SURVIVED (407 green) | **DEAD** — 1 failed / 418 |
| `WF-02` | SURVIVED (407 green) | **DEAD** — 1 failed / 418 |
| `M4` | SURVIVED (407 green) | **DEAD** — 1 failed / 419 |
| `M1` (contract suite alone) | SURVIVED | **DEAD** — 4 failed |
| H-1 drift re-introduction | 407/407 green | **10 failed / 411** |

The five previously-dead mutants stay dead: `CMP-02` (node exit 1 + vitest 3
failed), `F3-05` (1 failed), `RANK-09` (node exit 1, vitest 0 — as before),
`ATT-01` (5 failed), `ATT-02` (node exit 1 + vitest 26 failed).

Full gate: `npm test` 22 files / **422 passed**; `tsc --noEmit` 0;
`tsc -p tsconfig.test.json --noEmit` 0; `npm run build` 0;
`npm audit --audit-level=low` 0 vulnerabilities;
`find dist -name '*.map' | wc -l` → **0**; `go build ./...` 0.

## Not done, and why

Everything below is real and was deliberately left. The brief scoped this round
to five items and listed these as out of scope; expanding would have made a
close-out round into another review cycle.

- **M-4 (containment fixture)** — `attention-view.test.ts`'s "strict subset"
  test does not actually test containment; its fixture cannot distinguish. The
  property does hold structurally and *is* protected by the card and inspector
  negative tests; only the test advertising itself as the proof isn't doing the
  work. Follow-up.
- **M-5 (generic filtered empty state)** — the Available Queue says "All clear!"
  under a filter that legitimately matches nothing. Reachable in two clicks.
  Correctly *not* special-cased for attention; the generic fix is a follow-up.
  All three reviewers endorsed not special-casing.
- **L-1 / L-3** — the vocabulary anchor's "only place these strings appear as
  literals" claim is still false in the strict sense (three shadow label maps
  predate this branch), and the grep lint that would make it true is unwritten.
  Item 1 removed the in-delta counterexample, which was the part this branch
  created.
- **L-2 (`ft-tree-node` drifted stage labels)** — four of ten disagree with the
  anchor today. Out of delta; `git diff` on `tree/` is empty.
- **L-4** — deriving `BOARD_COLUMNS.label` from `STAGE_LABEL`. Safe as-is; the
  duplication is test-pinned.
- **`matchesTaskFilters` object-parameter refactor** — all three reviewers
  endorsed the current seven-parameter shape, and transposition provably does
  not typecheck. Post-deploy ticket.
- **`REL_GROUP_LABEL` / `REL_GROUP_ORDER` unpinned in the anchor** — the fourth
  exception to the anchor's claim. Folds into the L-1/L-3 follow-up.
- **audit I-1 (`onViewChange` cast)** — self-healing, consistency not security.
- **audit I-2 (CI guard on the sourcemap fix)** — there is no CI on this
  project; the EM is routing that invariant into the deploy plan.
- **test F-3 (numeric availability reasons), F-4 (queue+attention combination)**
  — additive coverage, no write consequence.
- **Two pre-existing Go-side items** — `unified.go:83` comment/code mismatch and
  `ft-toolbar.ts:552` missing `noreferrer`. Both predate this line.
- **The "fails part way through" rank test's first-write rejection** (found this
  round, described above). It is a weaker test than its name claims, but it is
  pre-existing, it still pins the rollback behaviour it asserts, and the new
  multi-write test now covers the genuine part-way case. Worth a follow-up.

Nothing High or Critical was found this round.
