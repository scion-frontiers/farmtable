# dev-phase2-fixes-r5 — pre-merge fix round on the Phase 2 web UI line

## Status: two APPROVE, one REQUEST CHANGES. This is the round that closes it.

Phase 2 went through a full three-way independent review at `633f8f2`:

| reviewer | verdict |
|---|---|
| `audit-phase2` | **APPROVE** — 0 Critical / 0 High / 0 Medium, 2 Low, 2 Info |
| `test-phase2` | **APPROVE** — 20 mutants applied, 4 survived, all "additive" |
| `review-phase2` | **REQUEST CHANGES** — 1 High blocker, 2 Medium before merge |

This is not a repudiation. All three reviewers praised the line; `review-phase2`
called the attention view "a genuinely good piece of work" and the rank/reorder
code "the strongest in the branch," and every reviewer independently confirmed
**no fifteenth self-built oracle** exists. The verdict split is about three
contained gaps, all small, all additive.

**Workspace:** `/workspace/farmtable-attention-view`
**Branch: `attention-view`, currently `633f8f2`, clean.**

> ⚠ **Commit to `attention-view`, NOT to `task-state-web-ui-v2`.** Both names
> exist in this worktree. `task-state-web-ui-v2` is at `6d8ea23` — three commits
> behind, missing the entire attention view. `attention-view` is a clean
> fast-forward ahead of it and is the reviewed tree. Confirm with
> `git branch --show-current` before your first commit.

## Read these first — all three, in full

- `/scion-volumes/scratchpad/projects/farmtable/reports/review-phase2.md`
- `/scion-volumes/scratchpad/projects/farmtable/reports/test-phase2.md`
- `/scion-volumes/scratchpad/projects/farmtable/reports/audit-phase2.md`

All three supplied working diffs. **Prefer theirs over inventing your own — but
verify each yourself, do not paste on trust.**

---

## Scope — five items. Nothing else.

### 1. H-1 (review-phase2, **BLOCKER**) — anchor the inspector's attention copy

`web/src/components/inspector/ft-inspector-relationships.ts:224,228,229,308`

Two other reviewers rated this a follow-up. **I am overriding them, because
`review-phase2` did an experiment the others did not**, and evidence beats
headcount:

- It verified the copy is **in the delta**, not pre-existing —
  `git show 7a0f220:...` has no `renderAttention` at all. The "existing tech
  debt, out of scope" defence does not apply.
- It ran a **deliberate-rename simulation**: renamed
  `AVAILABILITY_REASON_LABEL[BLOCKED_BY_DEPENDENCY]` *and* updated the anchor
  test — exactly what the anchor's docblock instructs a developer to do — and got
  **407/407 green** with the UI internally inconsistent. The drift is provably
  invisible to the suite.
- `:224` renders `Dependency attention needed` while every other surface fed by
  the *same* `attentionBlockers()` call renders `ATTENTION.label` =
  `Needs attention`. The card badge and the inspector are **on screen at the same
  time**. So this is already-live divergence, not latent risk.
- `:228–229` **contradicts** rather than merely differs: `ATTENTION.explanation`
  deliberately conveys permanence ("nothing will clear these on its own"), while
  `An unsuccessful terminal prerequisite is still blocking this task` implies the
  block is merely current — the precise wrong implication the `explanation`
  docblock says to avoid.

Note `test-phase2` judged this "latent drift risk rather than live disagreement."
That judgement was about `:308` alone, where both strings do read the same today.
It is not wrong; it is narrower. `review-phase2` checked all four lines and found
`:224` already divergent. Not a conflict between reports — a difference in scope.

Take `review-phase2`'s fix: extend `ATTENTION` with `calloutTitle` / `calloutBody(n)`
in `task-state-utils.ts`, bind `:224`, `:227-229` and `:308`. The
`Object.keys()` completeness guard in `vocabulary.contract.test.ts` then forces
the new entries to be pinned. Update `ft-inspector-relationships.test.ts:32-33`
to **import** the constants instead of transcribing them.

**Acceptance:** re-run the deliberate-rename simulation yourself — rename the
constant, update the anchor test, and show the suite now goes **RED**. That is
the mutation that matters here.

### 2. M-2 / F-2 / ATT-03 — pin the derived-loop cardinality, in **all four** loops

Two reviewers found this independently and got the identical result: dropping
`TaskStage.DUPLICATE` from `isUnsuccessfulTerminalStage`
(`task-state-utils.ts:177`) kills **zero** of 407 tests. Suite goes 407 → **405**
and reports green. Contract §11 covers `cancelled`, **`duplicate`** and
`wont_fix`, so the clause is contract-required, not incidental.

The class — and it is a new named class on this workstream — is **tests that
disappear instead of failing**: a case list built by filtering through the very
predicate under test protects against *widening* and is blind to *narrowing*.
`WONT_FIX`/`CANCELLED` survive only incidentally because unrelated fixtures
hardcode them. **Nothing anywhere hardcodes `DUPLICATE`.**

> **This is the part neither report gets fully right, so read carefully.**
> `review-phase2` M-2 names two loops. `test-phase2` found a third symptom
> (`DROP-01`) but pointed at the source line, not the test loops. I grepped it
> out: the pattern occurs in **four** places across three files.
>
> | file:line | derived from |
> |---|---|
> | `test/ft-task-card.attention.test.ts:55` | `isUnsuccessfulTerminalStage` |
> | `test/ft-inspector-relationships.test.ts:30` | `isUnsuccessfulTerminalStage` |
> | `test/ft-kanban.drop-refusal-affordances.test.ts:244` | `!acceptsStageDrop` |
> | `test/ft-kanban-view.contract.test.ts:231,327` | `!acceptsStageDrop` |
>
> **Fix all four.** If you only do the two `review-phase2` names, `DROP-01`
> stays live.

`DROP-01` is the higher blast radius of the two mutants: make the Duplicate lane
accept drops (`task-state-utils.ts:98`) and 407 → **402**, five tests silently
vanish, and the board would accept a drag onto the Duplicate lane and issue a
stage change with **no duplicate target** — precisely what the docblock at
`task-state-utils.ts:91-95` forbids — on a green suite.

Keep the derived loops (the widening protection is genuinely valuable). Add an
explicit membership/cardinality assertion beside each, per `review-phase2`'s
suggested `toEqual([WONT_FIX, DUPLICATE, CANCELLED].sort())` shape.

**Acceptance:** `DUP-DROP` and `DROP-01` must both go from SURVIVED to DEAD, with
pasted before/after output.

### 3. M-3 / F-1 (WF-01, WF-02) — bind the partial-renumber emission

`web/src/components/ready-queue/ft-ready-queue-view.ts:490-493`

Again found independently by two reviewers with identical results: both
`writes.length > 1` → `> 0` **and** deleting the `message` key entirely leave
407/407 green.

The logic is **correct** as written — `review-phase2` traced `ranksForMove` and
confirmed `> 1` is a sound proxy. This is purely a coverage gap on the producer
side of the seam. The existing tests construct the detail object by hand and
dispatch it at `ft-app`, which binds `onWriteError`'s prefer-`message` branch
(genuinely valuable) but proves nothing about the queue actually attaching
`message` under the right condition and only then.

Worth knowing why this matters beyond the mutant: commit `3fb65f2` is titled
*"anchor the partial-renumber failure message"* and it anchored the **constant**
while leaving the **emission** unbound. The half hardest to get right is the half
with no test.

Drive the real `reorder()` and assert the emitted detail — both the >1 case
(message present, equals `WRITE_FAILURE.partialRenumber`) and the single-write
case (message absent).

**Acceptance:** `WF-01` and `WF-02` both DEAD, pasted.

### 4. audit L-1 (M4) — pin the toast's HTML escaping

`web/src/components/ft-app.ts:877`

`showErrorToast` uses `document.createTextNode` — correct, injection-proof. But
converting it to `insertAdjacentHTML` leaves **all 407 tests green**.

This is in scope because Phase 2's own H-2 change added a caller branch routing
`crossBandToast` — which interpolates a **raw task title** (`ft-ready-queue-view.ts:416`,
`dragged.name`) — into that sink. So the range both refactored the sink and gave
it user-controlled input, while adding nothing that pins the escaping.

Not exploitable today; the code is right. If it regressed it would be stored XSS
in the app origin. `audit-phase2` supplied the test verbatim — take it.

**Acceptance:** `M4` DEAD, pasted.

### 5. audit L-2 — three rows on the safe-url contract table

`web/test/safe-url.contract.test.ts:44`

`safeExternalUrl` rejects embedded credentials (`safe-url.ts:63`) to defeat
destination confusion, but the contract table has no `@`-bearing input at all —
delete the check and the contract suite stays fully green. It is currently
guarded only by the plain-Node suite. Structural risk: if the Node runner is ever
retired in favour of the Vitest harness Phase 2 just built, the check silently
loses all coverage.

Three rows, supplied by the auditor.

---

## Explicitly OUT of scope — do not fix these

All are real, all are logged as follow-ups on the cleanup branch. Do **not**
expand this round:

- M-4 (containment fixture), M-5 (generic filtered empty state)
- L-1/L-3 (vocabulary anchor claim + grep lint), L-2 (`ft-tree-node` drifted
  stage labels), L-4 (derive `BOARD_COLUMNS.label`)
- the `matchesTaskFilters` object-parameter refactor
- `REL_GROUP_LABEL`/`REL_GROUP_ORDER` unpinned in the anchor (test-phase2)
- audit I-1 (`onViewChange` cast), audit I-2 (CI guard — **there is no CI on this
  project**; I am routing that invariant into the deploy plan instead)
- test F-3 (numeric availability reasons), F-4 (queue+attention combination)
- the two pre-existing Go-side items (`unified.go:83` comment/code mismatch,
  `ft-toolbar.ts:552` `rel`)

**All three reviewers independently endorsed the four deferred design decisions**
(required `store` param; no special-casing "All clear!"; the `ft-task-card` scope
exception; unanchored copy → the only one escalated, which is item 1). Do not
revisit them.

If you find something **High or Critical**, stop and report immediately rather
than fixing it quietly.

---

## Acceptance criteria

- **Every mutation above goes SURVIVED → DEAD with real pasted output.** This is
  the standing bar on this workstream; unverified claims of "verified" get sent
  back. Specifically: `DUP-DROP`, `DROP-01`, `WF-01`, `WF-02`, `M4`, plus the
  H-1 deliberate-rename simulation going red.
- The five previously-dead mutants stay dead: `CMP-02`, `F3-05`, `RANK-09`,
  `ATT-01`, `ATT-02`.
- **No self-built oracle.** Three reviewers hunted a fifteenth and none exists.
  Do not add it. Every new test binds to the real exported symbol.
- Test count rises from 407. Report the new number.
- Full gate, run and pasted: `npm test`, `npx tsc --noEmit`,
  `npx tsc -p tsconfig.test.json --noEmit`, `npm run build`,
  `npm audit --audit-level=low`, and `find dist -name '*.map' | wc -l`
  (**expected `0` on this branch** — the sourcemap fix lives here).
- Do not read build success from a pipeline's exit code —
  `go build ./... | tail -3; echo $?` reports `tail`'s status. Redirect to a
  file, then check `$?`.

## Deliverables — all required

1. Commits on branch **`attention-view`**. **Do not push.** Commit locally; the
   manager pushes. Hard rule on this project.
2. A project log entry in `.design/project-log/` for this round, with a
   "Not done, and why" section.
3. A report at
   `/scion-volumes/scratchpad/projects/farmtable/reports/dev-phase2-fixes-r5.md`
   covering each of the five items with its verification, all mutation output,
   and anything found but not fixed.

You MUST commit your work, write the project log entry, write the report file at
the exact path above, and then mark the task complete.
