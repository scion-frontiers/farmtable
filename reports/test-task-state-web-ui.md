# Test Review: Farm Table Phase 2 Web UI Task State Contract

Verdict: REQUEST CHANGES

Branch: `task-state-web-ui`  
Reviewed commit: `2f912bbee2f4cfc2f40f2650164a56c69a697fb9` (`feat: update web UI for task state contract`)  
Requested base: `origin/main` at `7a0f220dbd9332cb8db62138c841777432b4eda4`  
Review time: `2026-07-27T09:20:28Z`

## Verification Commands

Command: `npm test` from `/workspace/web`

Expected: TypeScript test build succeeds and both web test programs exit 0.

Actual:

```text
> farmtable-web@0.0.1 test
> tsc -p tsconfig.test.json && node .tmp-test/utils/task-ready.test.js && node .tmp-test/util/task-state-utils.test.js
```

Exit code: 0

Command: `npm run build` from `/workspace/web`

Expected: TypeScript typecheck and Vite production build succeed.

Actual:

```text
> farmtable-web@0.0.1 build
> tsc --noEmit && vite build

vite v6.4.3 building for production...
✓ 342 modules transformed.
dist/index.html                   1.12 kB │ gzip:   0.57 kB
dist/assets/index-DATgx8W6.css   36.32 kB │ gzip:   6.53 kB
dist/assets/index-DMTOiPHe.js   835.33 kB │ gzip: 212.42 kB │ map: 2,498.88 kB

(!) Some chunks are larger than 500 kB after minification.
[vite-plugin-static-copy] Copied 2053 items.
✓ built in 3.21s
```

Exit code: 0

Base comparison note: local checkout did not contain `origin/main` or the requested base SHA. `git fetch origin main` failed with `fatal: could not read Username for 'https://github.com': No such device or address`, so this review used the available target commit contents and local workspace files.

## Test Coverage Analysis

### Current Coverage

- `web/package.json:9` runs only two Node-based TypeScript test files: `web/src/utils/task-ready.test.ts` and `web/src/util/task-state-utils.test.ts`.
- `task-ready.test.ts` covers `isReady()` with server availability precedence, assigned accepted tasks, held tasks, future start dates, non-accepted stages, terminal tasks, and incomplete blockers.
- `task-state-utils.test.ts` covers `compareAcceptedQueueOrder()`, selected `matchesTaskFilters()` cases, active group exclusion by stage, and `attentionBlockers()` for one cancelled blocker.

### Coverage Gaps Identified

1. Native stage controls remain reachable, and tests do not catch it.

   Reproduction:

   ```bash
   nl -ba web/src/components/ft-toolbar.ts | sed -n '345,359p'
   nl -ba web/src/components/kanban/ft-kanban-column.ts | sed -n '177,213p'
   nl -ba web/src/components/kanban/ft-kanban-view.ts | sed -n '133,149p'
   npm test
   ```

   Expected: no contract-facing native stage selector or native stage transition control is exposed; test suite should fail if one is reintroduced.

   Actual: the toolbar renders a reachable `sl-select` with placeholder `Stage`, populated from `NATIVE_STAGE_OPTIONS`, and `ft-kanban-column` emits `stage-change` on drop. `ft-kanban-view` handles that event by updating `{ stage, phase: newPhase }` through `client.updateTask()`. `npm test` still passes because no test instantiates the toolbar, kanban column, or kanban view.

   Root cause: current tests exercise only helper predicates and sorting functions. They do not assert the absence of UI controls or events that mutate native stages/phases.

2. The suite does not prove "no native phase controls exposed."

   Reproduction:

   ```bash
   rg -n "TaskPhase|phase|stage-change|updateTask\\(taskId, \\{ stage, phase" web/src/components web/src/gen/service.ts
   npm test
   ```

   Expected: coverage should fail if phase-facing UI or phase mutation is exposed in the web UI.

   Actual: tests pass while the kanban stage-change path computes and sends `phase` with the native `stage` update. There is no component-level assertion that phase controls are absent or that user interactions cannot produce a phase write.

   Root cause: the coverage target is contract-facing UI behavior, but the test harness cannot render components or observe emitted/update payloads.

3. Hold-reason and availability behavior is partially covered at predicate/helper level, but rendered labels and control wiring are unproved.

   What is covered:

   - `task-state-utils.test.ts:75-102` covers held/unavailable filter matching using server-computed availability.
   - `task-state-utils.ts:61-72` defines hold and availability reason labels.

   What is not covered:

   - `ft-toolbar` hold and availability select options and `filter-change` payloads.
   - `ft-filter-chips` rendered chip labels and clear events.
   - `ft-task-card`, `ft-inspector-header`, `ft-inspector-meta`, and `ft-ready-queue-view` rendered hold/availability labels.

   Root cause: label helpers are used by components, but tests do not render the components that users actually see.

4. Rank ordering is covered for the comparator, but not for the UI surfaces that consume it.

   Covered: `task-state-utils.test.ts:60-73` verifies priority, rank, created-at, and id fallback ordering in `compareAcceptedQueueOrder()`.

   Gap: no test proves `ft-ready-queue-view` or `ft-kanban-column` renders tasks in that comparator order. A future component change could sort differently while the comparator test still passes.

5. Attention workflow coverage is too narrow for the UI requirement.

   Covered: `task-state-utils.test.ts:117-131` verifies `attentionBlockers()` returns a cancelled blocker when the dependent task has `BLOCKED_BY_DEPENDENCY`.

   Gaps:

   - No component test proves the `Needs attention` badge appears on `ft-task-card`.
   - No test covers `WONT_FIX` or `DUPLICATE`, even though both are unsuccessful terminal stages in `task-state-utils.ts:78-80`.
   - No negative tests cover completed blockers, non-terminal blockers, missing blocker tasks, or tasks without `BLOCKED_BY_DEPENDENCY`.

6. Fallback ready predicate tests remain meaningful, but they are still fallback-only.

   `task-ready.test.ts` is useful because it proves server-computed `availability` is authoritative and that the legacy/local fallback is conservative. The main residual gap is that the UI available queue itself is not rendered in tests, so the suite does not prove the queue applies `isReady()` plus filters and ordering together.

## Recommended Tests

1. Add component tests for `ft-toolbar` that assert no native phase selector exists and no native stage selector is rendered or reachable under the Phase 2 contract.
2. Add component tests for `ft-kanban-view` / `ft-kanban-column` that fail if drag/drop can emit or execute native stage/phase updates when those controls are supposed to be deleted.
3. Add component tests for hold-reason and availability filters: option labels, selected values, emitted `filter-change` payloads, active filter chip labels, and clear behavior.
4. Add rendered ordering tests for `ft-ready-queue-view` and `ft-kanban-column` using mixed priority/rank/created-at/id inputs.
5. Add rendered attention tests for `ft-task-card` covering cancelled, duplicate, and wont-fix blockers, plus negative cases.
6. Keep the existing `isReady()` fallback tests, and add a queue-level test proving explicit server availability remains authoritative through the rendered ready queue.

## Priority

- Critical: native stage/phase controls and mutation paths are reachable but unguarded by tests.
- High: hold/availability filter wiring and rendered labels are not proven.
- High: attention workflow is only tested as a helper, not as a visible workflow.
- Medium: rank ordering is tested as a comparator but not in consuming UI components.
- Medium: fallback ready predicate tests are meaningful, but need queue-level integration coverage.
