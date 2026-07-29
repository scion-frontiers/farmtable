# dev-p2-fixes-r4 — close the round-3 review findings on Phase 2

## Context

Phase 2 of the task-state-model web UI. Phase 1 is merged, deployed and LIVE —
do not touch it, do not redeploy it. Go code is out of scope.

Round 3 ran three independent reviews against `task-state-web-ui-v2` @ `49e55e9`:

| Review | Verdict | Critical | High |
|---|---|---|---|
| code (`review-p2-r3`) | REQUEST CHANGES | 0 | 0 (2 Important) |
| security (`audit-p2-r3`) | APPROVE | 0 | 0 |
| test (`test-p2-r3`) | APPROVE WITH FINDINGS | 0 | **2** |

Reports (read them, they are excellent and contain working reproductions):
- `/scion-volumes/scratchpad/projects/farmtable/reports/review-p2-r3.md`
- `/scion-volumes/scratchpad/projects/farmtable/reports/audit-p2-r3.md`
- `/scion-volumes/scratchpad/projects/farmtable/reports/test-p2-r3.md`

Your workspace is a clone at `/workspace/farmtable-p2-fixes-r4`, branch
`fixes-r4`, based on `task-state-web-ui-v2` @ `49e55e9`.

**The headline: all three reviewers independently landed on `bandFor()`**, from
three different mandates — a correctness bug, a security finding, and a test
oracle defect. When three reviewers with different briefs converge on one
function, that function is the work.

---

## 1. `bandFor()` — availability must not scope the rank arithmetic (TOP PRIORITY)

Reported three times: **I-1** (code), **MEDIUM-2** (security), and implicated by
**M-1** (test).

`web/src/components/ready-queue/ft-ready-queue-view.ts:296-306`:

```ts
private bandFor(task: Task): Task[] {
  const bandPriority = priorityRank(task.priority);
  return this.store.allTasks
    .filter(
      (candidate) =>
        candidate.collectionId === task.collectionId &&
        priorityRank(candidate.priority) === bandPriority &&
        this.isReady(candidate),        // <-- this line
    )
    .sort(compareAcceptedQueueOrder);
}
```

The round-3 F-2 fix replaced *view-filter* narrowing with *availability*
narrowing. **Same bug class, different hiding mechanism.** A held, blocked, or
future-start task still carries a rank, is invisible to the midpoint arithmetic,
and gets collided with.

**Read the function's own docstring** — it already states the correct principle:
"a filter decides what is *drawn*, never what the arithmetic is computed over."
`isReady` is precisely a drawability predicate. The implementation contradicts
its own doc comment. That is the clearest possible statement of the defect.

Non-adversarial reproduction from the audit: task `H` (rank 1536) becomes
dependency-blocked → server reports unavailable → `H` leaves the band → user
drags `C` between `A (1024)` and `B (2048)` → client writes `C = 1536`,
colliding with `H`. `H` later unblocks and rejoins with a duplicate rank, and
the order is then resolved by `created_at` rather than where the user dropped
it. It does **not** self-heal: `singleWrite`'s strictly-increasing guard only
inspects band members, so the colliding pair never meets.

**Required fix — and note the two reviewers proposed slightly different things.**
The code reviewer said scope by `!isClosedStage(candidate.stage)`; the auditor
said drop the predicate entirely, gating only on collection + priority band.

**Use `!isClosedStage(candidate.stage)`.** My reasoning, which I want reflected
in a comment: terminal tasks will never re-enter the queue, so their ranks are
dead weight that can only force unnecessary renumbers. Held / blocked /
future-start tasks **will** re-enter, so their ranks are live and must anchor
the arithmetic. That distinction is exactly the line `isClosedStage` draws, and
it mirrors `store.IsTerminalStage` on the server (see PR #191). Contract §4.6
scopes rank to `(collection, priority band)`; availability is not part of that
scope, but neither is dead terminal work.

Replace the docstring's filter-only rationale with one that covers **every**
mechanism that can hide a row — view filter, availability, and stage — so the
next person does not close a third variant of this same bug.

### Why the existing tests missed it — do not repeat this

All three F-2 regression tests use a fixture helper that sets
`availability.available = true`, specifically so the hidden task stays
`isReady`. The suite proves *filter*-narrowing is gone and **never tested
availability-narrowing**. Your new tests must cover a hidden-by-hold neighbour,
a hidden-by-dependency neighbour, and a hidden-by-future-start neighbour, and
prove no duplicate rank is written and relative position is preserved.

### Also fix the test oracle (M-1) — it is in the same blast radius

`test/ft-ready-queue-view.rank-adversarial.test.ts:542-563` claims to bind the
component's writes to `ranksForMove` itself, but feeds it a **locally
reconstructed band** built from `rowIds(view)` — the *filtered* rows. It
reproduces none of `bandFor`'s three scopings, and it **encodes the pre-fix,
buggy definition of the band**. This is the thirteenth self-built oracle; the
round-3 pass removed twelve.

Derive the band the way production does (import the real thing), or fall back to
hardcoded expectations like the rest of the file, which are at least honest
about being literals. Do not leave a private re-implementation in a test whose
docstring advertises it as the binding to production.

---

## 2. I-2 / LOW-4 — overlapping reorders corrupt state

`reorder()` is `async` and unguarded. A second drag can start while the first's
sequential multi-write renumber is still in flight; if the first then fails, its
rollback restores stale ranks **over the second reorder's already-successful
writes**. Reproduced by both the code reviewer and the auditor.

The auditor found two further consequences worth fixing together:
- **Stale rollback clobbers a newer, already-persisted edit** — and nothing ever
  triggers a refetch, so the UI and server disagree indefinitely.
- **Whole-object rollback discards concurrent server state** — a watch event
  arriving mid-flight (rename, stage change, `version` bump) is silently
  reverted, *including `version`*.

Add an in-flight guard, reusing the existing `reportRefusal` channel so the
refusal is actually surfaced. Consider whether the rollback should restore whole
`Task` snapshots or only the `rank` field — restoring only what you changed
fixes the third bullet. Report your reasoning either way.

---

## 3. H-1 (High) — the `id` tiebreak is asserted twice and pinned by neither

Mutant `CMP-02`: `src/util/task-state-utils.ts:183`,
`return a.id.localeCompare(b.id);` → `return 0;` **SURVIVED, 362/362 passed.**

Both tests that claim to cover the tiebreak are defeated by **sort stability**:
each fixture lists the tie participants already in id order, so a comparator
returning `0` produces identical output. The assertion cannot distinguish them.

This matters more than a generic gap — the tiebreak is exactly where the
original self-built oracle diverged.

Fix (proven by the reviewer, kills the mutant three times over): in
`test/queue-ordering.test.ts` list `f-normal-2b` before `e-normal-2a`; in
`src/util/rank.test.ts:379-382` list `zz` before `aa`. **Add a comment saying
the order is deliberately adversarial**, so nobody "tidies" it back.

## 4. H-2 (High) — queue refusals asserted at dispatch, never at delivery

Mutant `F3-05`: `reportRefusal()`, `composed: true` → `composed: false`.
**SURVIVED, 362/362 passed.**

With `composed: false` the `write-error` event never crosses the shadow
boundary, `ft-app` never receives it, and **no toast reaches the user** for any
queue refusal — `readOnlyQueue`, `reorderUnsupported`, `crossBandToast`, or
`reorderNotConnected`. The row snaps back with no explanation: the exact
silent-no-op class this workstream exists to eliminate, and a property an
earlier round was specifically run to guarantee.

Assert refusals **at delivery** — that the toast actually reaches the user —
not merely that an event was dispatched. Killing `F3-05` is the acceptance test.

## 5. M-2 — the vocabulary anchor's "only place" claim is false

`test/vocabulary.contract.test.ts:23` says it is "the ONLY place these strings
appear as literals". It is not:
- `test/ft-app.write-error-seam.test.ts:120,124` shadows `DROP_REFUSAL.readOnlyQueue`
- `:196` shadows `DROP_REFUSAL.crossBandToast` — **already truncated; no view
  emits that string**

These are tautological — the test dispatches a literal and asserts the same
literal, so they can never go red. `DROP_REFUSAL` is already imported in that
file. Use the constants. Where an arbitrary payload is genuinely wanted, use an
obviously-synthetic string like the `'refusal text'` already used at line 131.

## 6. M-3 — safe-integer boundary unreached

Mutant `RANK-09`: tail-of-band branch,
`return Number.isSafeInteger(candidate) ? candidate : null;` → `return candidate;`
**SURVIVED.** Add an enumerated case that reaches the boundary and kills it.

---

## Explicitly OUT of scope

- **F-4, F-6, F-7** — deferred, all three reviewers agreed. Leave their
  characterisation tests alone. (Note: fixing item 1 shrinks F-6's blast radius
  to queue-membership-only as a side effect. Do not treat that as fixing F-6.)
- **audit MEDIUM-1** (markdown sanitizer permits `<form action>`) — real, but in
  a Phase 1 file untouched by this diff. I am filing and handling it separately.
  Do not touch `web/src/util/markdown.ts`.
- **audit LOW-3 / INFO-2 / INFO-3**, **test L-1..L-5** — triage, not this round.
- **review M-1 (attention view)** — a contract-completeness gap I am tracking
  separately. Do not build a filter or dashboard tile.

---

## Acceptance criteria

- Items 1-6 fixed.
- **Every surviving mutant named above (`CMP-02`, `F3-05`, `RANK-09`) must now
  be KILLED.** Re-run each one yourself and paste the real failing output. These
  are the acceptance tests for items 3, 4 and 6 — a fix without its mutant dying
  is not done.
- Item 1 needs tests for hidden-by-hold, hidden-by-dependency and
  hidden-by-future-start neighbours, each proving no duplicate rank and
  preserved relative position.
- No test weakened or deleted to make anything pass. If an existing assertion
  fails and you believe it was wrong, say so and pin the new behaviour — do not
  silently change it.
- Full gate green, run and pasted: `npm test`, `npx tsc --noEmit`,
  `npx tsc -p tsconfig.test.json --noEmit`, `npm run build`,
  `find dist -name '*.map' | wc -l` (must be 0), `npm audit --audit-level=low`.

## Deliverables — all required

1. Commits on branch `fixes-r4` in `/workspace/farmtable-p2-fixes-r4`.
2. A project log entry at `.design/project-log/task-state-web-ui-fixes-r4.md`
   with a "Not done, and why" section.
3. A report at
   `/scion-volumes/scratchpad/projects/farmtable/reports/dev-p2-fixes-r4.md`
   with each fix, its killing mutation with real output, your reasoning on the
   rollback-scope question in item 2, and anything found but not fixed.

**Do not push.** Commit locally; the manager pushes.

If you find a further defect while in here, do not silently fix it and do not
silently skip it — report it and let me scope it.

You MUST commit your work, write the project log entry, write the report file at
the exact path above, and then mark the task complete.
