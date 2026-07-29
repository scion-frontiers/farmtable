# Brief: Phase 2 — close the round-2 test-review gaps

## Your workspace
Your repo is mounted at `/workspace`. It is a **standalone Git clone** (not a git
worktree) on branch `tests-r3`, forked from `task-state-web-ui-v2` @ `6c0fcfb`, with
`web/node_modules` already installed.

Do NOT `git init`, re-clone, or "repair" git. If something about git looks wrong,
**message the manager instead of fixing it**. Three agents on this project destroyed
their own work by reinitialising a repo that was actually fine. If git complains about
commit identity, set `user.name`/`user.email` **repo-locally only** — that is expected
and fine.

`origin` is a local path and resolves:
```bash
cd /workspace
git diff origin/main...HEAD    # 7a0f220 -> 6c0fcfb, 58 files
```

Commit locally on `tests-r3`. **Never push.** The manager pushes.

Current baseline, which you should reproduce before changing anything:
`npm test` → **164 passing** (148 Vitest + 4 Node scripts... precisely: 12 Vitest files
/ 164 tests, plus 4 Node scripts). `npm run build` → EXIT 0. `npm audit --audit-level=low`
→ 0 vulnerabilities.

## Context
Farm Table Phase 2 is the web UI migration to the new task-state contract. Phase 1
(backend/API/CLI/MCP) is merged and live in production — out of scope, do not touch.
Go code is out of scope.

Round 2 review produced: security **APPROVE**, code review **REQUEST CHANGES**, test
review **REQUEST CHANGES**. The code-review and audit findings have all been fixed and
merged. **You are closing the test-review findings.** Nothing else is outstanding.

**Read the round-2 test review in full before you start — it is your work order:**
`/scion-volumes/scratchpad/projects/farmtable/reports/test-task-state-web-ui-r2.md`

Supporting context:
- `/scion-volumes/scratchpad/projects/farmtable/reports/review-task-state-web-ui-r2.md`
- `/scion-volumes/scratchpad/projects/farmtable/reports/audit-task-state-web-ui-r2.md`
- Contract: `/scion-volumes/scratchpad/projects/farmtable/design-task-state-model-contract.md`
- Implementer logs in `.design/project-log/`: `task-state-web-ui-fixes.md`,
  `task-state-web-ui-tests.md`, `task-state-web-ui-polish.md`,
  `task-state-web-ui-rank.md`

## Why this pass exists — read this, it sets the standard

The round-2 test reviewer did not read the suite, they **broke it**: 55 source
mutations, 39 killed. That is how they discovered that 135 passing tests did not cover
the two behaviours the round existed to deliver. Reintroducing the original
silent-no-op bug left 20/20 green; deleting the entire `onWriteError` handler left
135/135 green.

**You are held to that same standard.** A test you add is not done until you have
mutated the code it covers and watched it go red. "It passes" is not evidence of
anything. Do not report a test as closing a finding unless you have run the mutation.

Two findings have already been closed this way and independently re-verified by the
manager — use them as the model for what "closed" looks like:
- The kanban `dragover` inversion (C-1): re-adding `if (this.isDropRefused) return;`
  to `onDragOver` now fails **10** tests.
- The new rank reorder: re-adding an early return to `onRowDragOver` fails **2** tests.

---

## Work items

### C-2 (CRITICAL) — the `write-error` → toast seam is entirely uncovered
`ft-app.ts` `onWriteError()` converts a view's `write-error` event into a visible
toast. Deleting the whole handler left 135/135 green. Two independent causes:
1. `test/ft-app.write-error.test.ts` — the local `showWriteError()` helper prefers
   `app.showWriteError` when present, and it *is* present (TS `private` is compile-time
   only), so **`onWriteError` is never invoked by any test**.
2. That helper only ever builds `detail: { error }`, never `detail: { message }`, so
   the client-side-refusal branch has no input that reaches it.

Meanwhile the kanban and ready-queue tests only assert the event was *dispatched*.
Nobody joins the two halves, so "a refused drag is never a silent no-op" — the entire
point of this round — is **not proven end to end**.

Close it: dispatch a bubbling, composed `write-error` at `ft-app` with
`detail: { message, reason: 'stage-change-refused' }` **and** with `detail: { error }`,
and assert the toast carries the message. Then mutate: delete the handler body and
confirm red.

Note there are now **four** reasons in play — `stage-change-refused`,
`stage-change-failed`, `rank-change-refused`, `rank-change-failed`. Cover the
discrimination, not just one.

### C-3 (CRITICAL) — three demonstrably vacuous tests
- **(a)** `test/ft-ready-queue-view.availability.test.ts` asserts
  `textDeep(view)).toContain('Available')`, which is satisfied by the *header*
  (`Available Queue (n)`) before any row is examined. Deleting the row badge entirely
  left 135 green. Scope the selector to the row, and use a fixture with **real
  reasons** — the current fixture is `{available: true, reasons: []}`, so no reasons
  render at all.
- **(b)** `test/ft-app.write-error.test.ts` "keeps the GitHub token hint" matches
  `/github/i` against an input that already contains "github", and the generic fallback
  echoes the raw message — so it passes under at least three mutually exclusive
  behaviours. Consequently the `!/github/i` exclusion in `grpc-error.ts` is pinned by
  **no test at all**. Assert on the hint text (`/token/`, `/write access/`), not on the
  echoed input. The same echo weakness affects its neighbours.
- **(c)** `test/safe-url.contract.test.ts` has a conditional assertion inside a loop —
  if `safeExternalUrl` regressed to always-`null` it executes **zero** assertions. Add
  `expect.hasAssertions()` or assert the exact non-null count.

**Sweep for this pattern generally.** Those three were found; assume there are more.
Any `if (x) expect(...)`, any loop that can iterate zero times, any assertion on a
string that the input already contains.

### H-1 — `ft-inspector-changes.vocabulary.test.ts`
Loop bodies can execute zero assertions (`listChanges -> []` survives), and this one
file burns **8.5 s of the suite's 9.6 s**, with two tests at ~4.0 s against Vitest's 5 s
default timeout — a real flake risk, and worse, a timeout bump would make them
permanently vacuous.

It is also a *fixture lint*, not a component test: the component renders
`oldValue`/`newValue` verbatim and never imports `STAGE_LABEL`, so the test asserts a
property of the string literals in `MOCK_CHANGES`. Keep the check — corrupting
`MOCK_CHANGES` was correctly killed — but make it a fast assertion over the constant
rather than a 4-second DOM crawl, and guard the loops with a non-zero length assertion.

### H-2 — availability rendering is only pinned in one of four places
`availabilityLabel()` renders in `ft-task-card`, `ft-inspector-header`,
`ft-inspector-meta` and `ft-ready-queue-view`; only `ft-task-card` pins it. Add
component coverage for the other three, including hold-reason rendering.

### H-3 — reconcile-from-server-response is unproven
`RecordingClient.updateTask()` echoes back exactly what the optimistic update wrote, so
removing the reconciliation entirely survives. Make the fake client return something
the optimistic path would **not** produce (server normalises the stage, or bumps
`version`) and assert the store holds the server's version. **This applies to the new
rank reorder too**, which reconciles the same way.

### H-4 — `FailedPrecondition` attribution is deletable
Dropping `FailedPrecondition` from `isServerRejection` survives, because the test
asserts only `toContain(reason)` + `not.toMatch(/github/i)`, both satisfied by the
generic fallback. Give it a dedicated assertion like the `PermissionDenied` case has.

**Note the wording changed since the report was written.** `showWriteError` no longer
says "Farm Table rejected this change" — that was a blocker, because it confidently
blamed Farm Table for what might be a GitHub adapter error. It is now
`The change was rejected: ${raw}`. Assert the current behaviour.

### Medium items
- **M-1** refusal *affordances* — the `.drop-refused` class and the drop-hint
  `title`/`aria-description` have no assertions; `isDropRefused` ignoring `readOnly`
  survives. Note the `title` is now gated (a round-2 fix), so assert the gated
  behaviour. The `aria-description` attribute is a known a11y weakness tracked in
  issue #181 — **test what is there, do not change it**.
- **M-2** `safeExternalUrl` returns the *normalized* `URL.href`; returning the raw
  input instead survives. Normalization is the security-relevant property — it is what
  collapses casing and whitespace tricks. Pin it.
- **M-3** `ShoelaceStubElement.toast()` is a no-op and production appends the alert
  *before* calling `toast()`, so every toast assertion proves an `sl-alert` exists in
  the DOM, not that a user would see it. Removing the `toast()` call survives. Assert
  `alert.open`, or spy on `toast()`. This matters precisely because "refusals must be
  visible" is the whole point of the round.
- **M-4** filter chips are never asserted `removable`, and the `removeTag()` helper
  dispatches `sl-remove` on any element — so four chip-clearing tests pass against
  chips a real user could not clear. `removable` is in `BOOLEAN_PROPS`, so this is free.
- **M-5** the same-lane drop no-op guard is untested.

### Low items
L-1 through L-6 in the report: unguarded negative assertions, an overpromising test
title, an assertion about code that does not exist, a structurally-impossible header
count check, a stray `;` at `test/setup.ts:39`, and the two-runner split needing a
README note. Fold in what is cheap.

### New coverage this pass must add
- **The rank reorder feature** (`web/src/util/rank.ts`,
  `web/src/components/ready-queue/ft-ready-queue-view.ts`,
  `web/test/ft-ready-queue-view.rank.test.ts`). It currently has 16 component tests and
  a Node unit suite, **all written by the developer who wrote the feature**. That is
  the weakest link in the branch and it is why this pass runs after the merge rather
  than beside it. Go after it adversarially: the sparse-rank midpoint arithmetic, gap
  exhaustion, the renumber path, bands where every rank is `undefined` (the actual
  production state), duplicate/non-monotonic ranks, and the partial-failure rollback.
- **`ft-inspector-relationships.ts` (+80 lines) and `ft-dashboard-view.ts` (+104
  lines)** changed substantially in this phase and have **no test file at all**.
- **Consolidate the duplicate dragover helpers**: `dragOverOn` in `test/helpers/dom.ts`
  (used by the kanban tests) and a local `dragOver` in
  `test/ft-ready-queue-view.rank.test.ts` do the same job. Keep one, in the helper.

---

## Hard rules

1. **Do not weaken or delete an assertion to make something pass.** If an existing
   assertion fails, that is a finding — report it, do not silence it. A previous round
   on this project had a developer and a test author disagree; the manager ruled for
   the test author and verified afterwards that the test files were untouched. The same
   check will be run on your branch.
2. **Production code changes need a reason.** This is a test pass. If closing a finding
   genuinely requires a source change (e.g. exposing a seam), that is allowed — but
   call it out explicitly in your log and keep it minimal. Do not refactor.
3. **Every closed finding needs mutation evidence**, pasted as real output.
4. Do not re-litigate settled scope: the toolbar stage filter, stage lanes and
   drag-to-change-stage are contract-required (coordinator ruling). Cross-band drag,
   padlock semantics, `aria-describedby`, keyboard reordering and the `ready-queue`
   rename are tracked as issues #180-#187 — out of scope.

## Acceptance criteria
- [ ] `npm run build` EXIT 0, `tsc --noEmit` clean.
- [ ] `npm test` and `npm run test:node` fully green.
- [ ] `npm audit --audit-level=low` → 0 vulnerabilities.
- [ ] `find web/dist -name '*.map' | wc -l` → 0 (a round-2 security fix; do not regress it).
- [ ] C-2, C-3, H-1, H-2, H-3, H-4 closed **with mutation evidence for each**.
- [ ] Suite runtime materially improved (H-1 is ~88% of it today).
- [ ] A re-run mutation score, with the new denominator, reported against the branch.
- [ ] Committed on `tests-r3`. Not pushed.

## Deliverables
1. Commits on `tests-r3`, logically scoped.
2. **A project log at `.design/project-log/task-state-web-ui-tests-r3.md`.** Required.
   Per finding: what you added, the mutation you ran, and the observed result. Include
   an explicit **"Not done, and why"** section. The round-2 reviewer spot-checked the
   previous logs' "Not done" claims against the code and found them accurate — that is
   why logs here are trusted. Do not claim anything you have not run.
3. Message the manager with a per-finding status table, mutation evidence pasted as
   real output, the new mutation score, and anything you could not close.

## Termination
You MUST commit your work, write
`.design/project-log/task-state-web-ui-tests-r3.md`, message the manager, and then mark
the task complete. Do not stop after analysis without writing the log file — agents on
this project have done exactly that before.
