# Test Review (Round 2): Farm Table Phase 2 Web UI — Task State Contract

**Verdict: REQUEST CHANGES**

Branch: `task-state-web-ui-v2` @ `6c4a13f`
Base: `origin/main` @ `7a0f220` (`git diff origin/main...HEAD` resolved correctly this round — 50 files, +5715/-346)
Review time: 2026-07-27T15:08–15:22Z
Reviewer role: test-engineer

---

## Executive summary

**The harness is sound and the tests are overwhelmingly real, not theatre.** I mutation-tested
the branch with 55 valid source mutations. **39 were killed (71%).** Critically, all four
"render nothing at all" vacuity probes were killed, so the suite is not passing because
components fail to render.

However, I am returning REQUEST CHANGES on a narrow, specific basis:

> **The two headline fixes of this round — the dragover inversion (fix #6's root cause) and
> the visible-refusal toast (fix #6's user-facing payoff) — each have a completely uncovered
> seam. I reintroduced the original silent-no-op bug and deleted the entire `onWriteError`
> handler, and all 135 tests stayed green in both cases.**

Plus three demonstrably vacuous tests and one uncovered component (`ft-ready-queue-view`
availability badge). This is roughly a half-day of additions, not a rework.

All six round-1 test gaps are CLOSED or PARTIALLY CLOSED. None is fully open.

---

## Verification of claimed state

```
$ cd /workspace/web && npm test
safe-url tests passed
3 Node test script(s) passed.
 Test Files  11 passed (11)
      Tests  135 passed (135)
```
Exit code: 0 — **confirmed.** Note the suite is two runners: `scripts/run-node-tests.mjs`
(3 legacy script tests under `src/**`) + Vitest (135 under `test/**`). The "135" figure is
Vitest only.

```
$ npm run build
dist/assets/index-BA_IubPr.js   836.72 kB │ gzip: 212.83 kB │ map: 2,509.65 kB
[vite-plugin-static-copy] Copied 2053 items.
✓ built in 2.92s
```
Exit code: 0 — **confirmed.**

Workspace was clean before and after review; all mutation work was done in a throwaway
`git worktree` at `/tmp/ft-mut` (now removed). **Nothing was modified or committed.**

---

## Harness assessment

`web/vitest.config.ts`, `web/test/setup.ts`, `web/test/helpers/dom.ts` are well-built:

- **Shadow-DOM-aware queries** (`dom.ts:79-92`) correctly descend open shadow roots.
- **`textDeep()` excludes `<style>`** (`dom.ts:101-119`) — without this, Lit's shadow CSS
  would make every text assertion trivially true. This is exactly the right call.
- **`settle()` runs two passes** (`dom.ts:34-44`) to catch derived state assigned in
  `updated()` (e.g. `ft-kanban-column._sortedTasks`). Correct.
- **`isolate: true`** (`vitest.config.ts:24`) — right, since custom elements cannot be
  un-registered.
- Fixtures derive `phase` from `stage` (`fixtures.ts:30-47`), so fixtures cannot encode a
  stage/phase pair the server would never emit. Good discipline.

### Shoelace stubbing — does it invalidate what the tests prove?

**Mostly no, with one real exception.** The stubs (`setup.ts:56-132`) provide attribute-backed
`.value`, mirrored booleans, and light-DOM children. I probed the three plausible ways a stub
could satisfy an assertion the real component would fail:

| Stub feature | Load-bearing? | Finding |
|---|---|---|
| `checkValidity(): true` (`setup.ts:83`) | No | Not called by any test. |
| attribute-backed `.value` (`setup.ts:57-63`) | Only in `ft-toolbar` tests | Faithful — real `sl-select` single-value is a string. |
| Children in light DOM (`setup.ts:53`) | Yes, for `sl-option` text | Faithful — real Shoelace slots these too. |
| **`toast(): no-op` (`setup.ts:75-77`)** | **Yes** | **BROKEN — see M-3 below.** |

**The one real stub-fidelity defect:** `ShoelaceStubElement.toast()` is a no-op, and the
production code appends the alert to `document.body` *before* calling `toast()`
(`ft-app.ts:863-864`). So `document.querySelectorAll('sl-alert')` finds the element whether or
not `toast()` was ever called. In real Shoelace, an `<sl-alert>` without `toast()`/`open` is
**invisible**. Proof:

```
### M37 STUB FIDELITY ft-app: never call sl-alert.toast() (toast created but never shown)
file: src/components/ft-app.ts
STATUS: SURVIVED
      Tests  135 passed (135)
```

Every toast assertion in the suite therefore proves "an `<sl-alert>` element exists in the DOM",
not "the user saw a toast". Given that "refusals must be visible" is the entire point of fix #6,
this is a meaningful weakening.

---

## Mutation testing results

Method: apply one source mutation, run the suite, revert. Script and mutant definitions were
run from an isolated worktree. **55 valid mutants; 39 killed (71%); 16 survived.** (Five
additional mutants were malformed — pattern-equals-replacement or a dead method — and are
excluded from the score rather than counted as survivors.)

### Representative kills (evidence the tests are real)

```
KILLED  M01 kanban-view: reintroduce phase in updateTask payload
KILLED  M02 kanban-view: delete the WONT_FIX board lane
KILLED  M03 kanban-view: reportRefusal becomes a silent no-op
KILLED  M08 acceptsStageDrop always true (terminal lanes accept drags)
KILLED  M11 safe-url: allow every scheme (full XSS regression)
KILLED  M12 safe-url: allow http on ANY host (allowlist widened)
KILLED  M16 inspector-code: bypass safeExternalUrl at the pr.url call site
KILLED  M17 inspector-meta: bypass safeExternalUrl at the remoteUrl call site
KILLED  M22 grpc-error: isServerRejection always false
KILLED  M23 ft-app: drop the /github/i evidence requirement
KILLED  M29 isClosedStage inverted
KILLED  M36 matchesTaskFilters: every filter ignored
KILLED  M39b toolbar: reintroduce a REAL rendered native PHASE select
KILLED  M49 inspector-code: drop rel=noopener noreferrer
```

### Vacuity probes — all four killed (important positive result)

I forced `render()` to return `null` in four components to test whether absence-assertions
pass on a non-rendering component:

```
KILLED  M18 VACUITY PROBE inspector-code: render() returns nothing at all
KILLED  M19 VACUITY PROBE inspector-meta: render() returns nothing at all
KILLED  M20 VACUITY PROBE toolbar: render() returns nothing at all
KILLED  M21 VACUITY PROBE task-card: render() returns nothing at all
```

**Caveat:** these are killed at *file* granularity. The individual absence-assertions (e.g.
`ft-toolbar.contract.test.ts:40` `expect(htmlDeep(toolbar).toLowerCase()).not.toContain('phase')`)
*do* pass vacuously on a dead render; they survive only because sibling positive tests in the
same file fail. That is acceptable defence-in-depth, but it means individual tests should not be
cited as proof in isolation.

### The phase-write ban is enforced at both layers — confirmed

```
$ # inject a real phase write into ft-kanban-view.ts
$ npx vitest run test/ft-kanban-view.contract.test.ts
      Tests  1 failed | 19 passed (20)
$ npx tsc --noEmit
src/components/kanban/ft-kanban-view.ts(179,71): error TS2353: Object literal may only
specify known properties, and 'phase' does not exist in type 'UpdateTaskFields'.
```
Runtime assertion **and** the type-level `Omit` both fire. Good — the type ban is a real gate
(via `npm run build`), and the runtime test is not redundant with it.

---

## Findings

### CRITICAL

#### C-1. The dragover inversion — the actual root-cause fix — has zero test coverage

`ft-kanban-column.ts:210-213` deliberately calls `e.preventDefault()` on `dragover` for *all*
lanes, including refusing ones, so the browser will fire `drop` and the refusal can be
surfaced. The manager explicitly asked for this to be scrutinised. **It is untested.**

Reproduction:
```bash
# In ft-kanban-column.ts, restore the original bug:
#   private onDragOver(e: DragEvent) {
# +   if (this.isDropRefused) return;
#     e.preventDefault();
npx vitest run test/ft-kanban-view.contract.test.ts
```
Expected: refusal tests go red (a refusing lane that skips `preventDefault()` never receives
`drop`, so the refusal is silent again — the exact round-1 bug).
Actual:
```
### M09 kanban-column: onDragOver bails out on refusing lanes (the ORIGINAL silent-no-op bug)
STATUS: SURVIVED
      Tests  20 passed (20)
```

Root cause: `dropTaskOn()` (`test/helpers/dom.ts:150-162`) synthesizes a bare `drop` Event
directly on the drop zone. It never dispatches `dragenter`/`dragover`, so the browser's
"drop only fires if dragover was cancelled" gating is bypassed entirely. Confirmed by search:

```
$ grep -n "dragover\|dragenter\|DragEvent" test/helpers/dom.ts test/*.test.ts
test/helpers/dom.ts:146: * jsdom implements neither `DragEvent` nor `DataTransfer`, so this builds a
test/helpers/dom.ts:151:  const event = new Event('drop', { bubbles: true, composed: true, cancelable: true });
```
Not a single test in the suite dispatches `dragover`.

**Recommended test:** dispatch a cancelable `dragover` on the drop zone and assert
`event.defaultPrevented === true` for *every* lane including `WONT_FIX`/`DUPLICATE`/`CANCELLED`
and under `readOnly`/`canChangeStage:false`. One parameterized test closes this.

#### C-2. The entire `write-error` → toast seam is uncovered; `onWriteError` can be deleted

`ft-app.ts:867-877` `onWriteError()` is the handler that converts a view's `write-error`
event into a user-visible toast. Its `if (detail.message)` branch (`ft-app.ts:872-875`) was
added *specifically* by fix #6 to surface client-side refusals. **Nothing tests it.**

Reproduction:
```bash
# ft-app.ts:867 — neutralise the whole handler:
#   private onWriteError(e: CustomEvent) {
# +   if (1 as number) return;
npm test
```
Expected: the refusal tests, which claim "refusals must be visible", go red.
Actual:
```
### M31 ft-app: onWriteError body deleted entirely — run against ENTIRE suite
STATUS: SURVIVED
      Tests  135 passed (135)

### M25-FULL ft-app: refusal message ignored — run against ENTIRE suite
STATUS: SURVIVED
      Tests  135 passed (135)
```

Two independent causes:
1. `test/ft-app.write-error.test.ts:17-32` — the `showWriteError()` helper prefers
   `app.showWriteError` when present. It is present (TS `private` is compile-time only), so
   **the first branch always wins and `onWriteError` is never invoked by any test.**
2. The helper only ever builds `detail: { error }` (`:27`), never `detail: { message }`, so
   the refusal-message branch has no input that would reach it.

Meanwhile `test/ft-kanban-view.contract.test.ts` only asserts the *event was dispatched*
(`collectFeedback`, `helpers/feedback.ts:28-44`). Nobody joins the two halves. The claim
"a refused drag is never a silent no-op" is therefore **not proven end-to-end**.

**Recommended test:** mount `ft-app` (or attach its listener), dispatch a bubbling composed
`write-error` with `detail: { message: 'x', reason: 'stage-change-refused' }`, and assert a
toast carrying that message appears.

#### C-3. Three tests are vacuous — they cannot fail for the reason their name claims

**(a) `test/ft-ready-queue-view.availability.test.ts:65`** — named *"renders the server
availability reasons on the row"*:
```js
expect(textDeep(view)).toContain('Available');
```
The queue header renders `Available Queue (${tasks.length})` at
`ft-ready-queue-view.ts:292`, so `'Available'` is in `textDeep(view)` before any row is
examined. Proof — I deleted the availability badge from the row entirely:
```
### M52 VERIFY ready-queue: delete the availability badge from the row entirely
STATUS: SURVIVED
      Tests  135 passed (135)

### M56 ready-queue: availability badge always says 'Available' regardless of reasons
STATUS: SURVIVED
      Tests  135 passed (135)
```
Compounding: the fixture is `{available: true, reasons: []}`, so no *reasons* render at all.
The test verifies neither "reasons" nor "on the row".
Fix: scope to `queryAllDeep(view, '.queue-row sl-badge')` and use a fixture with real reasons.

**(b) `test/ft-app.write-error.test.ts:105-111`** — named *"keeps the GitHub token hint"*:
```js
showWriteError(new GrpcError(grpc.Code.PermissionDenied, 'github: 403 Forbidden writing issue #7'));
expect(toastText()).toMatch(/github/i);
```
The input string contains "github", and the generic fallback echoes `raw`
(`ft-app.ts:846`), so this passes under at least three mutually exclusive behaviours. Proof:
```
### M43 grpc-error: isServerRejection drops the !/github/i exclusion — ENTIRE suite
STATUS: SURVIVED
      Tests  135 passed (135)
```
That exclusion (`grpc-error.ts:32`) is the exact judgement call the manager asked to be
sanity-checked, and **no test pins it.** Fix: assert `/token/` or `/write access/`, not
`/github/i`. The same echo-the-input weakness affects `:99-103` and `:113-117`.

**(c) `test/safe-url.contract.test.ts:46-51`** — conditional assertion:
```js
for (const testCase of cases) {
  const result = safeExternalUrl(testCase.input);
  if (result !== null) expect(result).toMatch(/^https?:\/\//);
}
```
If `safeExternalUrl` regressed to always return `null`, this executes **zero** assertions.
Proof — I forced `return null` and ran only this test:
```
$ npx vitest run test/safe-url.contract.test.ts -t "never returns a value whose scheme"
 ✓ test/safe-url.contract.test.ts (17 tests | 16 skipped) 2ms
      Tests  1 passed | 16 skipped (17)
```
Fix: add `expect.hasAssertions()` or assert the non-null count is exactly 5.

### HIGH

#### H-1. `ft-inspector-changes.vocabulary.test.ts` loop bodies can execute zero assertions

`:44-62` and `:64-79` are `for (const entry of stageEntries) {…}`. With no entries, zero
assertions run and the test is green. Proof:
```
### M54b VERIFY inspector-changes: listChanges always returns [] (loop bodies never execute)
STATUS: SURVIVED
      Tests  135 passed (135)
```
The `mountChanges` guard only checks that `<sl-details>` exists, which
`ft-inspector-changes.ts:120` renders unconditionally — it proves nothing about the data path.

Two aggravating factors:
- **Flake risk.** This file takes **8.5 s** of the suite's 9.6 s; two tests run ~4.0 s each
  against Vitest's 5 s default `testTimeout` (10 mock tasks × `delay(300)` + a 400 ms wait).
  One slow CI box turns these red, or — worse — a timeout tuning bump turns them permanently
  vacuous.
- **It is a fixture lint, not a component test.** `ft-inspector-changes` renders
  `c.oldValue`/`c.newValue` verbatim (`:133-136`) and never imports `STAGE_LABEL`. The test
  asserts a property of the string literals in `MOCK_CHANGES` (`src/gen/service.ts:403-435`).
  That is still worth having (M55, corrupting `MOCK_CHANGES`, was KILLED) but it should be a
  fast assertion over the fixture constant, not a 4-second DOM crawl.

#### H-2. `ft-ready-queue-view` availability rendering is effectively untested

Beyond C-3(a): `ft-ready-queue-view.ts:354-356` can be deleted outright with 135 green (M52).
`availabilityLabel()` is rendered in four components (`ft-task-card.ts:210`,
`ft-inspector-header.ts:205`, `ft-inspector-meta.ts:642`, `ft-ready-queue-view.ts:355`) but
only `ft-task-card` actually pins it:
```
### M32 availabilityLabel returns empty string — ENTIRE suite
STATUS: KILLED
  RED: test/ft-task-card.attention.test.ts > renders Available for server-available tasks
  RED: test/ft-task-card.attention.test.ts > renders the server availability reasons for unavailable tasks
```
`ft-inspector-header` and `ft-inspector-meta` availability/hold rendering have no component
tests at all.

#### H-3. Reconcile-from-server-response (fix #2's second half) is unproven

`ft-kanban-view.ts:179-181` awaits the response and re-upserts it. Both variants of removing
that reconciliation survive:
```
### M40 kanban-view: stop reconciling from the server response — ENTIRE suite
STATUS: SURVIVED   Tests  135 passed (135)
### M46 kanban-view: reconcile discards the server response's stage — ENTIRE suite
STATUS: SURVIVED   Tests  135 passed (135)
```
Cause: `RecordingClient.updateTask()` (`fixtures.ts:117-125`) echoes back exactly what the
optimistic update already wrote, so the two are indistinguishable. Fix: have the client return
a task the optimistic path would *not* produce (e.g. server normalises `WORKING` → `IN_REVIEW`,
or adds `version: '2'`) and assert the store holds the server's version.

#### H-4. `FailedPrecondition` attribution is deletable

```
### M42 grpc-error: isServerRejection drops the FailedPrecondition code — ENTIRE suite
STATUS: SURVIVED   Tests  135 passed (135)
```
`test/ft-app.write-error.test.ts:62-69` asserts only `toContain(reason)` +
`not.toMatch(/github/i)` — both satisfied by the generic fallback. The `PermissionDenied` case
has a dedicated `/farm ?table rejected this change/i` assertion (`:56-60`); `FailedPrecondition`
needs the same.

### MEDIUM

#### M-1. Refusal *affordances* on the column are untested
```
### M50 kanban-column: isDropRefused ignores readOnly — SURVIVED (135 passed)
### M51 kanban-column: dropHint always empty (no refusal tooltip) — SURVIVED (135 passed)
```
The `.drop-refused` class (`ft-kanban-column.ts:98-101, 356`) and the `title`/`aria-description`
drop hint (`:360-361`) — the pre-drop signals telling the user a lane will refuse — have no
assertions. Note the accessibility angle: `aria-description` is the only refusal signal a
screen-reader user gets before dropping.

#### M-2. `safeExternalUrl` returns the *normalized* href; tests accept the raw string
```
### M48 safe-url: return the RAW input instead of the normalized URL.href — SURVIVED
      Tests  135 passed (135)
```
Normalization (via `new URL()`) is a security-relevant property — it is what collapses casing
and whitespace tricks. No test distinguishes `url.href` from `raw`. Low exploitability given
the scheme check already ran, but the contract test should pin the normalization it documents
at `safe-url.ts:26-28`.

#### M-3. Toast visibility cannot be distinguished from toast existence
See the Shoelace section — M37 survived. Assert `alert.open` (the stub mirrors it via
`BOOLEAN_PROPS`, `setup.ts:43`) or spy on `toast()`.

#### M-4. Filter chips are never asserted to be `removable`
```
### M53b VERIFY filter-chips: drop `removable` from ALL 5 chips — SURVIVED (135 passed)
```
`removeTag()` (`helpers/dom.ts:138-141`) dispatches `sl-remove` on any element, so the four
chip-clearing tests pass against chips that a real user could not clear. `removable` is in
`BOOLEAN_PROPS`, so `expect(chip.removable).toBe(true)` is free.

#### M-5. Same-lane drop no-op untested
```
### M41 kanban-view: same-lane drop now issues a write instead of no-op — SURVIVED
```
`ft-kanban-view.ts:160` guards against a wasted round-trip when a card is dropped back on its
own lane. Untested.

### LOW

- **L-1.** Six negative attention tests (`ft-task-card.attention.test.ts:71, 79, 86, 96, 104, 114`)
  are `not.toContain(ATTENTION_BADGE)` with no positive guard. All fixtures set `availability`,
  so `expect(badges(card).length).toBeGreaterThan(0)` is a free one-line guard.
- **L-2.** `ft-task-card.attention.test.ts:99-105` ("when the server reports the task as
  available") exercises the identical code path as `:89-97` — `attentionBlockers`
  (`task-state-utils.ts:130`) never reads `availability.available`. The title overpromises.
- **L-3.** `ft-task-card.attention.test.ts:161-163` asserts `ft-task-card` renders no
  `Ready`/`Backlog`/`Scheduled`. The component has no stage vocabulary in any branch, so this
  asserts a property of code that does not exist.
- **L-4.** `queue-ordering.test.ts:88-93` asserts the header count equals `MIXED.length`; header
  and rows derive from the same array (`ft-ready-queue-view.ts:292,294`), so it structurally
  cannot detect a mismatch. It does correctly pin the renamed `"Available Queue"` literal.
- **L-5.** A stray `;` terminates the `if` block at `test/setup.ts:39`. Harmless, but it is the
  kind of thing that makes a reader distrust the file.
- **L-6.** `web/src/util/safe-url.test.ts` (Node runner) covers cases the Vitest contract test
  misses — `blob:`, `ftp:`, `//example.com/x`, `http://localhost@evil.example/`,
  `http://localhost.evil.example/x`. Good coverage, but split across two runners; worth a
  README note so it is not mistaken for dead code or double-counted.

---

## Round-1 test-review gaps — closure status

| # | Round-1 gap | Status | Evidence |
|---|---|---|---|
| 1 | Native stage/phase controls reachable, unguarded by tests | **CLOSED** | Coordinator ruled stage controls are contract-required. The *phase* ban is now guarded: `ft-toolbar.contract.test.ts:36-76`; M39b (real rendered phase select) KILLED; M01 (phase in payload) KILLED. |
| 2 | Suite does not prove "no native phase controls exposed" | **CLOSED** | M01 KILLED at runtime; `tsc --noEmit` rejects the type violation (TS2353). Both layers verified independently. |
| 3 | Hold-reason / availability rendered labels and control wiring unproved | **PARTIALLY CLOSED** | Toolbar, chips, task-card now covered — M26/M33/M34 all KILLED. **But** `ft-ready-queue-view` (H-2, C-3a), `ft-inspector-header`, `ft-inspector-meta` availability rendering remain uncovered. |
| 4 | Rank ordering not proven in consuming UI | **CLOSED** | `queue-ordering.test.ts` covers both `ft-kanban-column` and `ft-ready-queue-view`; M13 and M30 KILLED. `EXPECTED_ORDER` is an independently derived constant, not comparator output — not a tautology. |
| 5 | Attention workflow too narrow (no `WONT_FIX`/`DUPLICATE`, no negatives) | **CLOSED** | `ft-task-card.attention.test.ts` covers all three terminal kinds plus negatives; M15 and M57 KILLED. Negative tests lack positive guards (L-1). |
| 6 | Ready queue does not prove isReady + filters + ordering together | **CLOSED** | `ft-ready-queue-view.availability.test.ts` composes availability/assignee filters over the queue predicate; M36 KILLED. |

No round-1 gap is STILL OPEN.

---

## Remaining coverage gaps (new)

| Area | File | Risk |
|---|---|---|
| `dragover` / `preventDefault` gating | `ft-kanban-column.ts:210-213` | **Critical** (C-1) |
| `onWriteError` → toast | `ft-app.ts:867-877` | **Critical** (C-2) |
| Reconcile-from-response | `ft-kanban-view.ts:179-181` | High (H-3) |
| `ft-ready-queue-view` availability badge | `ft-ready-queue-view.ts:354-356` | High (H-2) |
| `ft-inspector-header` / `ft-inspector-meta` availability + hold rendering | — | High |
| Column refusal affordances (`.drop-refused`, `aria-description`) | `ft-kanban-column.ts:98-101, 356-361` | Medium (M-1) |
| `ft-inspector-relationships.ts` (+80 lines this round) | — | Medium — **no test file at all** |
| `ft-dashboard-view.ts` (+104 lines, "Available" rename) | — | Medium — **no test file at all** |
| Keyboard navigation (`column-nav`, arrow/Home/End) | `ft-kanban-column.ts:277-317` | Low |

---

## Recommended tests (priority order)

1. **`dragover` is always cancelled** — parameterized over all 10 lanes × `readOnly` ×
   `canChangeStage:false`; assert `defaultPrevented === true`. Closes C-1.
2. **`write-error` → visible toast** — dispatch both `{message, reason:'stage-change-refused'}`
   and `{error}` at `ft-app` and assert toast text; assert `alert.open`. Closes C-2 and M-3.
3. **Fix the three vacuous assertions** — scope the ready-queue selector to `.queue-row`; assert
   `/token|write access/` instead of `/github/i`; add `expect.hasAssertions()`. Closes C-3.
4. **Guard the inspector-changes loops** — assert `entries.length > 0` for the three tasks that
   have change history, and move the vocabulary check off the 4-second DOM path. Closes H-1.
5. **Divergent server response** in `RecordingClient` to prove reconciliation. Closes H-3.
6. **`FailedPrecondition` attribution** — assert the `Farm Table rejected this change` prefix.
   Closes H-4.
7. **Component tests for `ft-ready-queue-view` / `ft-inspector-header` / `ft-inspector-meta`
   availability + hold badges.** Closes H-2 and round-1 gap #3.
8. Positive-render guards on the ~15 unguarded absence assertions (L-1, and the Medium list in
   the appendix). One line each.

---

## Recommendations outside my role (for the manager to route)

- **Sourcemaps / dependency posture / XSS completeness** are the security auditor's call; I did
  not assess them. I note only that `rel="noopener noreferrer"` **is** test-pinned (M49 KILLED)
  and both `safeExternalUrl` call sites **are** test-pinned (M16, M17 KILLED).
- **`ft-inspector-relationships.ts` (+80) and `ft-dashboard-view.ts` (+104)** changed
  substantially this round with no tests. Whether that blocks merge is a code-review/manager
  decision, not a test-review one; I flag it as coverage risk only.

---

## Verdict

**REQUEST CHANGES.**

To be clear about proportion: this is a **good** test suite. A 71% mutation score on a
brand-new harness is well above what I usually see, the vacuity probes all failed to slip
through, and every round-1 gap was genuinely addressed rather than papered over. The
implementer's log claims check out.

The blocker is narrow and specific: **the round's two flagship behaviours — "a refused drag
reaches the drop handler" and "a refused drag produces a visible toast" — are the two things
the suite does not actually test.** I reintroduced the original silent-no-op bug (M09) and
separately deleted the entire toast handler (M31), and got 135/135 green both times. Shipping
on that basis would mean the regression that triggered round 1 could recur undetected.

C-1, C-2, and C-3 should be closed before merge. H-1 through H-4 should be closed or explicitly
accepted with a tracking task. Everything at Medium and below can follow up.
