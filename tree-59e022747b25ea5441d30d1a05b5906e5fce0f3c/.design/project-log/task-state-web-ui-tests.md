# Task-state web UI tests

Branch: `task-state-web-ui-tests`
Author: test engineer (`farmtable-dev-p2-tests`)
Date: 2026-07-27

Deliverable: a Lit component test harness for `web/`, plus rendered-UI tests for
the task-state contract work. The parallel agent `dev-p2-fixes` implements the
component fixes on a separate branch that is merged **after** this branch, so a
large number of these tests **fail on this branch by design**. Every test is
recorded below as PASSES NOW or FAILS NOW.

---

## 1. Harness

### 1.1 What was chosen

| Concern | Choice |
| --- | --- |
| Runner | **Vitest 3.2.7** (`web/vitest.config.ts`) |
| DOM | **jsdom 26** (`environment: 'jsdom'`), headless, no browser |
| Location | component tests in `web/test/**/*.test.ts` |
| Setup | `web/test/setup.ts` |
| Helpers | `web/test/helpers/{dom,fixtures,feedback}.ts` |
| Node-script tests | unchanged style, now globbed — `web/scripts/run-node-tests.mjs` |

Both suites run from one command:

```
npm test  ->  npm run test:node && npm run test:components
              node scripts/run-node-tests.mjs        (tsc -> .tmp-test -> node)
              vitest run                             (test/**/*.test.ts, jsdom)
```

### 1.2 Why Vitest and not a hand-rolled tsc + jsdom runner

The existing convention (`tsc -p tsconfig.test.json` → `.tmp-test/` → `node
file.js`) works for pure functions but cannot render components:

- Lit 3 components use **legacy decorators** with `useDefineForClassFields:
  false`. Vite already applies the project's `tsconfig.json`, so decorators,
  `.js` → `.ts` specifier resolution, `import.meta.env` and CSS imports all
  behave exactly as they do in `npm run dev` — no second, drifting config.
- Vitest gives per-file isolation (`isolate: true`) and `restoreMocks`, so no
  custom-element registry or `document.body` state leaks between files.
- **Decisive for this task:** esbuild transforms without typechecking. Several
  tests are written against APIs that do not exist on this branch yet
  (`BOARD_COLUMNS`, `safeExternalUrl`). Under a `tsc`-based runner a single
  missing export is a compile error that takes the *whole suite* down. Under
  Vitest only the dependent tests fail, and the rest keep providing signal.

Trade-off accepted: component tests are **not typechecked**. Adding `web/test`
to `tsconfig.test.json` would make `npm test` fail to compile until the fixes
land, which defeats the point. `npm run build` (`tsc --noEmit && vite build`)
still typechecks all of `src`, which is where production code lives.

`vitest.config.ts` deliberately does **not** extend `vite.config.ts`: the app
config runs `vite-plugin-static-copy`, which copies ~2000 Shoelace assets on
every start.

### 1.3 Shoelace: stubs, not the real library

`web/test/setup.ts` registers 24 lightweight `sl-*` custom elements
(`ShoelaceStubElement`) instead of importing `@shoelace-style/shoelace`.

Rationale — and this is the important part: **no Farm Table component imports
Shoelace.** The library is registered once at app boot in `src/index.ts`. In a
test the components are therefore already running against whatever `sl-*`
definitions happen to exist, so a stub is not a compromise; it is a faithful
model of the component's actual dependency (an unknown element with a `value`
property and `sl-*` events). Real Shoelace would additionally pull in
`ResizeObserver`, animations, popup positioning and form-control internals that
jsdom implements poorly, producing failures that say nothing about Farm Table.

The stubs implement only the surface Farm Table uses: attribute-backed `value`,
boolean props (`open`, `disabled`, `checked`, `loading`, `clearable`, `hoist`,
`pill`, `removable`), `show()`/`hide()` emitting `sl-show`/`sl-hide`, `toast()`,
`select()` and `checkValidity()`.

Also polyfilled in `setup.ts`: `Element.prototype.scrollIntoView` and
`crypto.randomUUID`, neither of which jsdom provides.

`import.meta.env` and CSS imports: handled by Vite natively — no shims needed.

### 1.4 Helpers

- `helpers/dom.ts` — `mount()` (assigns properties *before* connection, because
  several components read `this.store` in `connectedCallback`), `settle()` (two
  render passes: `ft-kanban-column` assigns derived state inside `updated()`),
  shadow-DOM-piercing `queryDeep`/`queryAllDeep`/`textDeep`/`htmlDeep`,
  `selectValue()`, `removeTag()`, `dropTaskOn()` and `flush()`.
  `textDeep()` skips `<style>` content so text assertions see only what a user
  can read.
  `dropTaskOn()` builds a plain bubbling `drop` event with a minimal fake
  `dataTransfer`: jsdom implements neither `DragEvent` nor `DataTransfer`.
- `helpers/fixtures.ts` — `task()` (derives the wire-only `phase` from `stage`
  so no fixture can encode a combination the server would never send), `user()`,
  `storeWith()`, and `RecordingClient`, a `FarmTableServiceClient` that records
  every `updateTask()` payload. It is constructed with the component's store and
  answers with the **whole** updated task via `applyTaskUpdateFields`, matching
  the merged implementation, which reconciles from the response.
- `helpers/feedback.ts` — `collectFeedback()` observes both refusal channels
  (`write-error` events and `<sl-alert>` toasts) and exposes `reasons()` for the
  discriminated `detail.reason`.

### 1.5 Test-list glob (handoff item from the coordinator)

`web/tsconfig.test.json` now includes `src/**/*.test.ts` instead of a hardcoded
two-file list, and `scripts/run-node-tests.mjs` globs the compiled output rather
than naming files. `web/src/util/safe-url.test.ts`, which exists only on the
`dev-p2-fixes` branch, is therefore picked up automatically at merge with no
further edit to `package.json` or `tsconfig.test.json`. No stub copy of that
file was created, per instruction.

The runner also deletes `.tmp-test/` before compiling (a stale artifact would
otherwise keep running deleted tests) and fails loudly if the number of compiled
scripts does not match the number of sources.

---

## 2. Test inventory: PASSES NOW / FAILS NOW

118 collected component tests across 10 files, plus 2 pre-existing Node scripts.
**79 pass, 39 fail** on this branch. An 11th file
(`test/safe-url.contract.test.ts`, 17 tests) cannot even load, so its tests are
not in the 118 — that load failure is itself the recorded signal that the
contracted module is absent.

Every FAILS NOW entry below is expected to flip to PASS when `dev-p2-fixes` is
merged. No assertion was weakened and no file under `web/src/components/` or
`web/src/gen/` was modified.

### `test/ft-toolbar.contract.test.ts` — 13 tests, 13 PASS

Scope note: per the coordinator's correction, the stage filter, stage lanes and
drag-to-change-stage are contract-**required**. Nothing here asserts their
absence; the phase ban is asserted instead, and the stage selector is asserted
*positively*.

| Test | Status |
| --- | --- |
| renders no phase-valued control anywhere in its shadow DOM | PASSES NOW |
| offers no user-selectable option carrying raw TaskPhase vocabulary | PASSES NOW |
| emits filter-change payloads that carry no phase key | PASSES NOW |
| renders the active/closed group filter that replaced the phase filter | PASSES NOW |
| emits the selected group in the filter-change payload | PASSES NOW |
| renders exactly the ten native stages as options | PASSES NOW |
| offers no deleted stage vocabulary as a selectable option | PASSES NOW |
| emits the selected stage as a numeric TaskStage | PASSES NOW |
| renders exactly the two valid hold reasons | PASSES NOW |
| emits the selected hold reason as a numeric TaskHoldReason | PASSES NOW |
| shows the current hold filter as the select value | PASSES NOW |
| renders available/unavailable plus one option per availability reason | PASSES NOW |
| emits string availability filters unchanged and reason filters as numbers | PASSES NOW |

### `test/ft-kanban-view.contract.test.ts` — 20 tests, 6 PASS / 14 FAIL

| Test | Status | Why it fails now |
| --- | --- | --- |
| sends only { stage } to updateTask and never a phase key | FAILS NOW | payload is `{ stage, phase }` |
| moves the card into the drop-target lane on success | PASSES NOW | |
| exports a BOARD_COLUMNS lane for every native TaskStage | FAILS NOW | `BOARD_COLUMNS` is module-local, not exported |
| renders one lane per BOARD_COLUMNS entry, in order, with its stage label | FAILS NOW | same |
| renders the three unsuccessful terminal lanes | FAILS NOW | board has 7 lanes, not 10 |
| renders every native stage lane and no others | FAILS NOW | same |
| shows tasks in their own lane, including terminal stages | FAILS NOW | same |
| labels every lane with its canonical stage label | PASSES NOW | |
| rolls the stage back in the store when updateTask rejects | PASSES NOW | |
| dispatches a composed, bubbling write-error carrying the rejection | PASSES NOW | |
| tags the server failure with reason "stage-change-failed" | FAILS NOW | `detail` has no `reason` discriminator yet |
| **snaps the card back to its ORIGINAL lane when the server rejects the move** | PASSES NOW | the rendered snap-back proof the coordinator asked for |
| gives visible feedback when a card is dropped on the WONT_FIX lane | FAILS NOW | silent no-op |
| gives visible feedback when a card is dropped on the DUPLICATE lane | FAILS NOW | silent no-op |
| gives visible feedback when a card is dropped on the CANCELLED lane | FAILS NOW | silent no-op |
| tags a terminal-lane refusal with reason "stage-change-refused" | FAILS NOW | no event at all |
| gives visible feedback instead of silently ignoring a drop when readOnly | FAILS NOW | silent no-op |
| tags a read-only refusal with reason "stage-change-refused" | FAILS NOW | no event at all |
| gives visible feedback instead of silently ignoring a drop when canChangeStage is false | FAILS NOW | silent no-op |
| tags a capability refusal with reason "stage-change-refused" | FAILS NOW | no event at all |

Notes:

- `BOARD_COLUMNS` is loaded by dynamic import behind an `expect(...).toBeDefined()`
  guard. A static import would abort the entire module under vite-node's
  named-export validation and cost the other 14 tests their signal.
- Lane coverage is derived from `Object.values(TaskStage)`, so adding a stage to
  the enum without adding a lane fails the test automatically.
- Per the coordinator: refusing lanes now accept the `dragover` gesture on
  purpose, so **a `drop` event is dispatched** on wont_fix/duplicate/cancelled
  and the expected outcome is a refusal signal + no `updateTask` call + the card
  staying put. No test asserts that `drop` is suppressed.

### `test/ft-inspector-changes.vocabulary.test.ts` — 3 tests, 1 PASS / 2 FAIL

| Test | Status | Why it fails now |
| --- | --- | --- |
| renders no deleted stage vocabulary for any mock task change history | FAILS NOW | `MOCK_CHANGES` still contains `Ready` and `Blocked` |
| renders only valid native stage labels as stage change values | FAILS NOW | same |
| still renders hold-reason vocabulary, which remains valid | PASSES NOW | guards against over-deleting: `waiting_for_input` / `deferred` stay |

The history panel lazy-loads on `sl-show`; the test expands it and waits out the
mock client's 300 ms delay.

### `test/ft-filter-chips.test.ts` — 11 tests, 11 PASS

Hold + availability filter wiring, chip labels, per-chip clear preserving other
filters, `Clear all` appearing only at ≥2 active filters, `N of M tasks`, and no
`phase` key in any `filter-clear` payload. All PASSES NOW.

### `test/ft-task-card.attention.test.ts` — 15 tests, 15 PASS

Attention badge for cancelled / duplicate / wont_fix blockers, plus six negative
cases (completed blocker, non-terminal blocker, blocker missing from the store,
no `BLOCKED_BY_DEPENDENCY` reason, server says available, non-`BLOCKED_BY`
relationship) and the hold/availability badge labels. All PASSES NOW.

### `test/queue-ordering.test.ts` — 5 tests, 5 PASS

A 7-task fixture that separates pairs by priority band, rank, created-at and id
in turn. Comparator baseline, `ft-kanban-column` rendered order, re-sort on task
change, `ft-ready-queue-view` rendered row order, header count. All PASSES NOW.

### `test/ft-ready-queue-view.availability.test.ts` — 14 tests, 14 PASS

| Group | Status |
| --- | --- |
| server `availability.available = true` wins even when the local fallback would reject (triage + assigned + held) | PASSES NOW |
| server `availability.available = false` wins even when the local fallback would accept | PASSES NOW |
| local `isReady()` fallback applies only when `availability` is absent — 6 parameterized cases + 2 blocker cases | PASSES NOW |
| availability and assignee filters compose with the queue predicate | PASSES NOW |
| no deleted stage vocabulary in the rendered queue | PASSES NOW |

`src/utils/task-ready.test.ts` was left untouched, as instructed.

### `test/ft-inspector-meta.safe-url.test.ts` — 14 tests, 5 PASS / 9 FAIL

Rendered XSS evidence. These assert on the DOM only and import nothing from
`safe-url.ts`, so they hold whichever way the sanitization is implemented.

| Test | Status |
| --- | --- |
| **renders no link for javascript: remoteUrl** | FAILS NOW |
| renders no link for data: remoteUrl | FAILS NOW |
| renders no href for remoteUrl `javascript:alert(document.domain)` | FAILS NOW |
| renders no href for remoteUrl `JaVaScRiPt:alert(1)` | FAILS NOW |
| renders no href for remoteUrl `  javascript:alert(1)  ` | FAILS NOW |
| renders no href for remoteUrl `data:text/html;base64,…` | FAILS NOW |
| renders no href for remoteUrl `vbscript:msgbox(1)` | FAILS NOW |
| renders no href for remoteUrl `file:///etc/passwd` | FAILS NOW |
| renders no External Source row at all when the URL is unsafe | FAILS NOW |
| renders no link for a remote http: remoteUrl | FAILS NOW |
| renders a link for an https: remoteUrl | PASSES NOW |
| keeps rel="noopener" and target="_blank" on the rendered link | PASSES NOW |
| renders a link for a localhost http: remoteUrl | PASSES NOW |
| renders no External Source row when remoteUrl is absent | PASSES NOW |

### `test/ft-inspector-code.safe-url.test.ts` — 11 tests, 4 PASS / 7 FAIL

Second injection site, added after the coordinator reported it
(`ft-inspector-code.ts:108` interpolates `pr.url` into an `href`). Same pattern
as the meta panel.

| Test | Status |
| --- | --- |
| renders no link for a javascript: pull request url | FAILS NOW |
| renders no href for `JaVaScRiPt:alert(document.domain)` | FAILS NOW |
| renders no href for `  javascript:alert(1)  ` | FAILS NOW |
| renders no href for `data:text/html;base64,…` | FAILS NOW |
| renders no href for `vbscript:msgbox(1)` | FAILS NOW |
| renders no href for `file:///etc/passwd` | FAILS NOW |
| renders no href for `http://evil.example.com/pr/7` | FAILS NOW |
| still shows the pull request id when its url is unsafe | PASSES NOW |
| renders a link for an https: pull request url | PASSES NOW |
| renders a link for a localhost http: pull request url | PASSES NOW |
| keeps rel="noopener" and target="_blank" on the pull request link | PASSES NOW |

### `test/safe-url.contract.test.ts` — 17 tests, ALL FAIL (module does not load)

Unit-level contract for `safeExternalUrl(raw): string | null` — https always,
http only for localhost/127.0.0.1, null otherwise; 15 input/output rows plus a
"never returns a non-http(s) scheme" sweep. The import is static, so on this
branch the whole file fails to collect:

```
FAIL  test/safe-url.contract.test.ts [ test/safe-url.contract.test.ts ]
Error: Failed to resolve import "../src/util/safe-url.js" from
"test/safe-url.contract.test.ts". Does the file exist?
```

That is deliberate and is the clearest possible "the contracted module is not
here yet" signal. It is isolated in its own file precisely so the rendered
evidence above keeps reporting independently.

### `test/ft-app.write-error.test.ts` — 12 tests, 7 PASS / 5 FAIL

`ft-app.ts:807 showWriteError` maps anything matching
`/permission|403|forbidden/i` to "GitHub rejected this edit — your token may not
have write access", which misattributes Farm Table's own rejections to GitHub
and discards the actionable server reason.

| Test | Status | Why it fails now |
| --- | --- | --- |
| surfaces the server reason for a Farm Table PermissionDenied | FAILS NOW | reason replaced by GitHub text |
| attributes a Farm Table PermissionDenied to Farm Table | FAILS NOW | expects `Farm Table rejected this change: …` |
| does not blame the GitHub token for a Farm Table PermissionDenied | FAILS NOW | toast says "your token may not have write access" |
| does not blame the GitHub token for a Farm Table error whose text merely says "permission" | FAILS NOW | same |
| does not blame the GitHub token for a Farm Table error whose text merely says "forbidden" | FAILS NOW | same |
| surfaces the server reason for a Farm Table FailedPrecondition | PASSES NOW | currently falls through to the raw-message branch |
| mentions GitHub for a genuinely GitHub-sourced 403 | PASSES NOW | regression guard: real GitHub errors may keep the hint |
| keeps the GitHub token hint for a GitHub PermissionDenied | PASSES NOW | regression guard for `isServerRejection()`'s `github` carve-out |
| explains a rate limit | PASSES NOW | |
| explains an unreachable server | PASSES NOW | |
| falls back to the raw message for an unclassified failure | PASSES NOW | |
| shows a danger-variant, closable toast | PASSES NOW | |

Method note: `ft-app` is created with `document.createElement` and **not**
connected. `connectedCallback()` builds a gRPC client and performs a session
`fetch()`, neither of which is meaningful in jsdom, and the error→message
mapping is reachable without any of it. The helper tries `showWriteError` and
falls back to `onWriteError` so a rename of either does not silently skip the
test.

### Pre-existing Node scripts — 2 files, both PASS

`src/util/task-state-utils.test.ts` and `src/utils/task-ready.test.ts` still run
unchanged, now via the glob runner.

---

## 3. Verification output

### `npm test` (from `web/`)

```
> farmtable-web@0.0.1 test
> npm run test:node && npm run test:components

> farmtable-web@0.0.1 test:node
> node scripts/run-node-tests.mjs

Compiling 2 Node test script(s) with tsconfig.test.json…

▶ .tmp-test/util/task-state-utils.test.js

▶ .tmp-test/utils/task-ready.test.js

2 Node test script(s) passed.

> farmtable-web@0.0.1 test:components
> vitest run

 RUN  v3.2.7 /workspace/web

⎯⎯⎯⎯⎯⎯ Failed Suites 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  test/safe-url.contract.test.ts [ test/safe-url.contract.test.ts ]
Error: Failed to resolve import "../src/util/safe-url.js" from "test/safe-url.contract.test.ts". Does the file exist?
  Plugin: vite:import-analysis
  File: /workspace/web/test/safe-url.contract.test.ts:2:32

 …39 failing assertions, all listed in section 2…

 Test Files  6 failed | 5 passed (11)
      Tests  39 failed | 79 passed (118)
   Start at  14:58:23
   Duration  3.05s (transform 1.01s, setup 123ms, collect 2.46s, tests 3.66s, environment 5.56s, prepare 1.01s)
```

Exit status 1 — expected on this branch, because the fixes are merged after it.
The Node suite runs first and passes, so both suites do run from the one
command.

### `npm run build`

```
> farmtable-web@0.0.1 build
> tsc --noEmit && vite build

vite v6.4.3 building for production...
transforming...
✓ 342 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                   1.12 kB │ gzip:   0.57 kB
dist/assets/index-DATgx8W6.css   36.32 kB │ gzip:   6.53 kB
dist/assets/index-DMTOiPHe.js   835.33 kB │ gzip: 212.42 kB │ map: 2,498.88 kB

(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rollupOptions.output.manualChunks to improve chunking: https://rollupjs.org/configuration-options/#output-manualchunks
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
[vite-plugin-static-copy] Copied 2053 items.
✓ built in 2.74s
```

Exit status 0.

### `npm audit --audit-level=low`

```
found 0 vulnerabilities
```

Exit status 0. `vitest@^3.2.7` and `jsdom@^26.1.0` are the only added
devDependencies.

### Git hygiene

```
$ git diff --check          # (no output)
$ git status --porcelain
 M web/package-lock.json
 M web/package.json
 M web/tsconfig.test.json
?? web/scripts/
?? web/test/
?? web/vitest.config.ts
```

`web/.tmp-test/`, `dist/` and `node_modules/` are already covered by the root
`.gitignore`; Vitest writes no artifacts of its own. No build or test output is
committed.

---

## 4. Files touched

Owned exclusively by this task, as agreed:

- `web/package.json` — `test`, `test:node`, `test:components` scripts; added
  `vitest`, `jsdom` devDependencies
- `web/tsconfig.test.json` — hardcoded file list → `src/**/*.test.ts`
- `web/package-lock.json` — lockfile for the two new devDependencies

New:

- `web/vitest.config.ts`
- `web/scripts/run-node-tests.mjs`
- `web/test/setup.ts`
- `web/test/helpers/{dom,fixtures,feedback}.ts`
- `web/test/*.test.ts` (11 files)
- `.design/project-log/task-state-web-ui-tests.md` (this file)

**Nothing under `web/src/` was modified** — not `components/`, not `gen/`, not
`util/`. Verified by `git status`.

---

## 5. Gaps not closed, and why

1. **`acceptsStageDrop()` has no direct unit test.** It is a new export in
   `util/task-state-utils.ts` that does not exist on this branch. A named import
   of a missing symbol fails the whole module under vite-node, and isolating one
   more file for it buys little: its behaviour is already covered end-to-end by
   the three terminal-lane refusal tests. Recommend the fix agent's own unit
   tests cover the predicate directly.
2. **No test that `UpdateTaskFields` rejects `phase` at compile time.** That is a
   type-level guarantee; the component tests are transformed without
   typechecking by design (§1.2). `npm run build` enforces it for `src`, and the
   runtime payload assertion in `ft-kanban-view.contract.test.ts` guards the JS
   path as a second layer.
3. **`web/test/**` is not typechecked.** Adding it to `tsconfig.test.json` would
   make `npm test` fail to compile until the fixes land. Worth turning on
   (`vitest --typecheck` or a `tsconfig.vitest.json`) once the branches are
   merged; noted as a follow-up rather than done here.
4. **The amber "drop refused" dragover styling is not asserted.** The tests
   assert the user-visible *outcome* (refusal signal, no write, card stays put)
   rather than a specific CSS class, so a restyle does not break them.
5. **`ft-app` is exercised unconnected.** A full mount needs a gRPC transport and
   a session endpoint; stubbing both would test the stubs. Flagged, not hidden.
6. **No E2E/browser layer.** Everything here is component-level in jsdom, which
   is the right level for shadow-DOM assertions and keeps `npm test` fast and
   dependency-free. Real drag-and-drop across lanes in a real browser remains
   uncovered by automation.
