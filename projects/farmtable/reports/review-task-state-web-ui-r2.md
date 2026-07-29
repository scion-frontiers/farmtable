# Review (Round 2): task-state-web-ui — CODE REVIEWER

Date: 2026-07-27
Branch: `task-state-web-ui-v2` @ `6c4a13f`
Base: `origin/main` @ `7a0f220`
Diff basis: `git diff origin/main...HEAD` — **resolved cleanly this round** (50 files,
+5715/−346). No degradation was necessary.

```
$ git log --oneline origin/main..HEAD
6c4a13f fix(web): require GitHub evidence before a GitHub-specific error message
c05e79d Merge branch 'tests-branch' into task-state-web-ui-v2
89671e9 test(web): add Lit component test harness and task-state UI tests
e211d2c docs: log the Phase 2 web UI review-fix pass
302ab9b refactor(web): rename dashboard ready-count internals to Available
7c01f4a fix(web): gate session-check skip and attribute server rejections correctly
ffbf917 fix(web): gate the localStorage token fallback behind a dev build flag
71f1baf fix(web): drop deleted stage vocabulary from mock change history
d5fcf22 fix(web): stop writing phase, add terminal lanes, refuse drops visibly
3669485 fix(web): validate external URL schemes before rendering hrefs
fe8e212 feat: update web UI for task state contract
```

---

## Executive Summary

**Verdict: REQUEST CHANGES** (light — all three round-1 code-review findings are
genuinely CLOSED, and the fixes are coherent rather than spot-patched).

Every round-1 code-review finding is closed with real code, not cosmetics: the
phase-write ban is enforced by the type system rather than by convention, the
board carries all ten native lanes, and the deleted stage vocabulary is gone from
the mocks. What blocks approval is new: one contract requirement in Section 10
("drag/drop normally reorders within a priority band") is not implemented while
its wire plumbing was added and left unreachable, and the round-2 error-attribution
fix reintroduces a milder version of the misattribution bug in the mirror direction.

---

## Verification (real output, not summarised)

```
$ cd /workspace/web && npm run build
> tsc --noEmit && vite build
vite v6.4.3 building for production...
✓ 343 modules transformed.
dist/index.html                   1.12 kB │ gzip:   0.57 kB
dist/assets/index-DATgx8W6.css   36.32 kB │ gzip:   6.53 kB
dist/assets/index-BA_IubPr.js   836.72 kB │ gzip: 212.83 kB │ map: 2,509.65 kB
(!) Some chunks are larger than 500 kB after minification.
✓ built in 3.01s
=== EXIT 0 ===
```

```
$ npm test
 ✓ test/ft-filter-chips.test.ts (11 tests) 86ms
 ✓ test/ft-task-card.attention.test.ts (15 tests) 134ms
 ✓ test/ft-ready-queue-view.availability.test.ts (14 tests) 135ms
 ✓ test/queue-ordering.test.ts (5 tests) 174ms
 ✓ test/ft-inspector-meta.safe-url.test.ts (14 tests) 226ms
 ✓ test/ft-app.write-error.test.ts (12 tests) 36ms
 ✓ test/ft-toolbar.contract.test.ts (13 tests) 281ms
 ✓ test/ft-kanban-view.contract.test.ts (20 tests) 521ms
 ✓ test/ft-inspector-changes.vocabulary.test.ts (3 tests) 8504ms
 Test Files  11 passed (11)
      Tests  135 passed (135)
```

```
$ npm run test:node
Compiling 3 Node test script(s) with tsconfig.test.json…
▶ .tmp-test/util/safe-url.test.js
safe-url tests passed
▶ .tmp-test/util/task-state-utils.test.js
▶ .tmp-test/utils/task-ready.test.js
3 Node test script(s) passed.
```

```
$ npm audit --audit-level=low
found 0 vulnerabilities
```

```
$ grep -o "farmtable\.token" dist/assets/*.js | wc -l
0
$ grep -o "farmtable\.token" dist/assets/*.js.map | wc -l
3
```

All four manager-stated claims reproduce. No lint script is defined in
`web/package.json`; `tsc --noEmit` is the only static gate and it is clean.

---

## Round-1 code-review findings — closure status

| # | Round-1 finding | Status | Evidence |
|---|---|---|---|
| I1 | Board only defines lanes through `Completed`; `WONT_FIX`/`DUPLICATE`/`CANCELLED` unreachable | **CLOSED** | `web/src/components/kanban/ft-kanban-view.ts:33-44` exports a 10-entry `BOARD_COLUMNS`; `web/src/util/task-state-utils.ts:47-58` carries the matching `STAGE_COLOR`; `web/src/styles/theme.css:13-14` adds `--ft-stage-wont-fix` / `--ft-stage-duplicate`. `web/test/ft-kanban-view.contract.test.ts:103-110` asserts `columns.map(c=>c.stage).sort()` equals every non-`UNSPECIFIED` enum member **and** `toHaveLength(10)` — that assertion fails if a lane is dropped or the enum grows. |
| I2 | Mock change history exposes deleted stage labels (`Ready`, `Blocked`) | **CLOSED** | `web/src/gen/service.ts:404-410` (`Ready` → `Accepted`), `:428-434` (`stage: Working → Blocked` replaced by `hold_reason: null → Waiting for input`). Independently swept: `grep -rn "'Ready'\|'Blocked'\|'Backlog'\|'Scheduled'\|'On Hold'" web/src --include='*.ts'` returns zero hits outside `types.ts`. |
| O1 | `computeReadyCount` / `navigateToReadyQueue` internal naming drift | **CLOSED** | `web/src/components/ft-dashboard-view.ts:145`, `:158`, `:168`. The broader `ready-queue` route id and `ft-ready-queue-view` component name remain — correctly deferred and documented in `.design/project-log/task-state-web-ui-fixes.md:456` as URL-visible. |

I also verified the two fixes outside my round-1 report that touch correctness:

- **Phase-write ban — CLOSED and structurally enforced.** `web/src/gen/service.ts:28`
  makes `UpdateTaskFields = Omit<Partial<Task>, 'phase' | …>`, so a phase write is a
  compile error, and `ft-kanban-view.ts:177` calls `updateTask(taskId, { stage })` then
  reconciles from the response at `:179`. The test at
  `web/test/ft-kanban-view.contract.test.ts:82` asserts
  `expect(Object.keys(fields)).toEqual(['stage'])` — an exact-key assertion, not a
  `not.toHaveProperty`, so it also catches accidental payload widening. This is the
  right shape of fix: enforcement by the compiler, not by reviewer vigilance.
- **`safeExternalUrl` — CLOSED**, see the XSS sweep below.

---

## XSS completeness sweep (manager-requested)

I swept every markup sink in `web/src`:

```
$ grep -rn "href=\|src=\|unsafeHTML\|innerHTML\|srcdoc\|window\.open\|location\.href" \
    web/src --include='*.ts' | grep -v test
src/components/inspector/ft-inspector-code.ts:112:  href=${prUrl}          ← guarded
src/components/inspector/ft-inspector-meta.ts:616:  href=${externalUrl}    ← guarded
src/components/ft-toolbar.ts:548:                    href=${url}          ← constructed
src/components/inspector/ft-inspector-desc.ts:233:  ${unsafeHTML(renderMarkdown(this.description))}
src/components/inspector/ft-inspector-comments.ts:221:${unsafeHTML(renderMarkdown(c.body))}
src/components/ft-app.ts:{558,1106,1121,1136,1150,1166}: new URL(window.location.href)  ← reads
```

**No third injection site.** Findings:

- Both untrusted anchors now route through `safeExternalUrl()` and render an
  unlinked fallback on `null` (`ft-inspector-code.ts:108-116`,
  `ft-inspector-meta.ts:601`, `:611-620`). `rel` was also upgraded from
  `noopener` to `noopener noreferrer` at both sites.
- `ft-toolbar.ts:544-548`: **I concur with the manager's judgement.** The URL is a
  hardcoded `https://github.com/` prefix plus `remoteId` gated by
  `/^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/`. The character class excludes `/`, `:`, `@`
  and `\`, so no host, scheme or userinfo can be smuggled; a `../..` payload still
  normalises to a path on `github.com`. Safe.
- Both `unsafeHTML` sites are fed by `renderMarkdown` =
  `DOMPurify.sanitize(marked.parse(md))` (`web/src/util/markdown.ts:4`). Pre-existing
  and sound; not touched by this delta.
- Every `style=` binding in the delta takes its value from a fixed `STAGE_COLOR` /
  `PRIORITY_COLOR` record with a literal fallback (`ft-kanban-column.ts:321`,
  `ft-ready-queue-view.ts:306`, `ft-inspector-header.ts:191`,
  `ft-inspector-relationships.ts:182`). No task-controlled data reaches a style sink.
- `showErrorToast` (`ft-app.ts:853-865`) composes the toast with
  `document.createTextNode(message)`, not `innerHTML`. Server-controlled error text
  is interpolated into `Failed to save changes: ${raw}` — with a `createTextNode`
  sink that is inert. This is easy to get wrong and was got right.

**`safeExternalUrl` allowlist assessment** (`web/src/util/safe-url.ts:21-37`): not
bypassable for the vectors listed in the brief. `new URL()` lowercases the scheme
and strips leading/trailing C0 and space characters, so casing and whitespace
tricks normalise; `url.hostname` excludes userinfo and port and is punycode-
normalised, so `http://127.0.0.1.evil.com`, `http://localhost@evil.example/`, and
IDN homographs all miss the exact-match `Set`. `http://[::1]` is *rejected* — a
safe-side false negative for IPv6 dev, not a hole. Redirects are irrelevant: the
target is an `_blank` anchor, and following a redirect off an already-`https:`
origin is normal browsing. One residual, deferred to the auditor: the function
accepts `https://user:pass@evil.example/` and preserves the credentials in
`url.href` — not XSS, but a spoofing/credential surface; rejecting
`url.username || url.password` would close it.

---

## Critical Issues

None.

---

## Important Issues

### 1. `showWriteError` reintroduces misattribution in the mirror direction — `web/src/components/ft-app.ts:830-834`

The round-2 fix is asymmetric. It correctly stops asserting "GitHub" without
evidence, but the fallback it routes to is not the neutral message the code comment
claims — it is an equally confident *positive claim* in the other direction:

```ts
if (isServerRejection(error)) {
  message = `Farm Table rejected this change: ${raw}`;
}
```

`isServerRejection` (`web/src/util/grpc-error.ts:30-36`) returns true for **any**
`PermissionDenied`/`FailedPrecondition` whose text lacks `/github/i`. A genuine
GitHub 403 relayed by the adapter as `PermissionDenied("403 Forbidden writing
issue")` — no literal "github" in the text — is therefore reported to the user as
*"Farm Table rejected this change"*. That is exactly the failure mode round 1
flagged, pointed the other way. The header comment at `:826-827` says "the generic
branch shows the real server reason — a truthful generic message beats a confident
wrong one", but this branch is not generic.

The reasoning behind preferring textual evidence over `collection.platform` is
sound and I agree with it; the branch **order** is also correct. Only the wording
is wrong.

**Suggested Fix** — drop the attribution, keep the reason:

```ts
if (isServerRejection(error)) {
  // The rejection reached us from the Farm Table server, but it may have
  // originated in a platform adapter. Report the reason, not the culprit.
  message = `The change was rejected: ${raw}`;
}
```

`web/test/ft-app.write-error.test.ts:58` asserts
`toMatch(/farm ?table rejected this change/i)` and will need updating with it; the
adjacent `not.toMatch(/github/i)` / `not.toMatch(/token/i)` assertions (`:74-77`)
are the ones carrying the actual round-1 guarantee and should stay.

### 2. Contract §10 "drag/drop normally reorders within a priority band" is not implemented, and its write plumbing is dead — `web/src/gen/grpc-client.ts:251,253`

Section 10 lists under **Required changes**: *"drag/drop normally reorders within a
priority band"* (the cross-band priority change is explicitly marked optional; this
one is not). The delta ships everything around it — `rank` is read from the wire
(`grpc-client.ts:463`), sorted on (`task-state-utils.ts:117-129`), and displayed
(`ft-ready-queue-view.ts:352`, `ft-inspector-meta.ts:647`) — but no gesture or
control ever writes it:

```
$ grep -rn "rank" web/src --include='*.ts' | grep -v test | grep -v priorityRank
ft-ready-queue-view.ts:144,352   ← display only
ft-inspector-meta.ts:647         ← display only
gen/grpc-client.ts:253:  if (fields.rank !== undefined) request.rank = fields.rank;   ← no caller
gen/grpc-client.ts:463:  rank: optionalNumber(record.rank),
```

The same is true of `grpc-client.ts:251` (`fields.holdReason`) — no UI path sets it.
Section 10 only requires hold-reason *display and filters*, so that one is a
requirement-conformant dead branch rather than a gap, but it is still unreachable
code shipped without a caller.

This is not listed in the implementer's "Not done, and why" section
(`.design/project-log/task-state-web-ui-fixes.md:440-457`), which suggests it was
missed rather than descoped.

> **COORDINATOR RULING (2026-07-27T15:19Z):** not a descope. The coordinator
> re-read the contract text and confirmed intra-band rank reorder is explicitly
> **required**; only the cross-band priority change is marked optional. This
> finding stands as Important and is **not** to be downgraded.

**Suggested Fix** — implement intra-band reorder in the accepted/available queue:
drag a card within a priority band, write `{ rank }`, and reconcile from the server
response exactly as `onStageChange` does at `ft-kanban-view.ts:177-180`. That path
is already the established pattern in this codebase and the write plumbing at
`grpc-client.ts:253` is already in place — what is missing is the gesture and the
rank computation for the drop position.

Deferring is no longer an available option per the ruling above. If the work cannot
land in this PR, that is a scheduling conversation with the coordinator, not a
reviewer-side downgrade.

### 3. The dragover inversion — the actual root-cause fix — has zero test coverage

The silent no-op was caused by `onDragOver` bailing before `preventDefault()`, so
the browser never fired `drop`. The fix removes that early return
(`web/src/components/kanban/ft-kanban-column.ts:210-213`). Nothing tests it:

```
$ grep -rn "dragover\|preventDefault\|defaultPrevented" web/test/
(no output)
```

`dropTaskOn` (`web/test/helpers/dom.ts:150-166`) synthesises a bare `drop` Event
directly on the drop zone, which bypasses the browser rule that a `drop` only fires
when `dragover` was cancelled. **Reverting the fix — re-adding
`if (this.isDropRefused) return;` to `onDragOver` — leaves all 135 tests green.**
The 20 kanban tests prove the refusal *toast* fires once a drop happens; they cannot
prove a drop can happen.

**Suggested Fix** — add to `web/test/ft-kanban-view.contract.test.ts`:

```ts
function dragOver(element: Element): Event {
  const event = new Event('dragover', { bubbles: true, composed: true, cancelable: true });
  Object.defineProperty(event, 'dataTransfer', { value: { dropEffect: 'none' } });
  element.dispatchEvent(event);
  return event;
}

it.each([TaskStage.WONT_FIX, TaskStage.DUPLICATE, TaskStage.CANCELLED])(
  'cancels dragover on refusing lane %s so the browser still fires drop',
  async (stage) => {
    const { view } = await mountBoard(storeWith(task({ id: 't1' })));
    expect(dragOver(dropZoneFor(view, stage)).defaultPrevented).toBe(true);
  },
);
```

Add the read-only and `canChangeStage: false` variants alongside.

### 4. The `UpdateTaskFields` type guard is incomplete — `web/src/gen/service.ts:28`

`phase` is excluded, but `availability` — the *other* server-computed projection
introduced by this phase — is not:

```ts
export type UpdateTaskFields = Omit<Partial<Task>, 'phase' | 'parentTaskId' | …>
```

`applyTaskUpdateFields` (`service.ts:64-66`) spreads `...rest` straight over the
task, so a caller passing `{ availability }` would splat a client-asserted
availability into the optimistic store entry with no compile error — the same class
of contract violation the `phase` omission was added to prevent. Nothing does this
today; the point is that the guard is documented as structural and only covers half
the surface.

**Suggested Fix:**

```ts
export type UpdateTaskFields = Omit<
  Partial<Task>,
  'phase' | 'availability' | 'parentTaskId' | 'dueDate' | 'startDate' | 'labels' | 'assignees'
> & { … };
```

(`id`, `version`, `createdAt`, `collectionId` and `platform` are arguably in the same
bucket, but those are pre-existing and out of scope for this delta.)

### 5. The phase→stage migration stops at `ft-dependency-view.ts`, splitting one view across two sources of truth

`ft-app.isTaskVisibleInCurrentView` was migrated for the dependencies view
(`ft-app.ts:627`, `:636`, `:643`, `:655` — `task.phase === TaskPhase.CLOSED` →
`isClosedStage(task.stage)`). The component that renders that same view was not:

```
$ grep -n "phase" web/src/components/dependency/ft-dependency-view.ts
126, 188, 665, 671, 678, 697, 721, 747, 807, 856   ← all TaskPhase.CLOSED comparisons
653:  *   (including ON_HOLD tasks in the "blocked" stage)   ← stale deleted vocabulary
```

The two predicates agree today (`phaseForStage` maps the four terminal stages to
`CLOSED` 1:1), so this is **not a live bug**. It is a maintenance hazard: two
mirrored visibility rules for one view now read from different fields, and the
contract makes `stage` the asserted state and `phase` a derived projection. The
comment at `:653` also keeps deleted `blocked`-stage vocabulary alive in the
codebase, which the round-1 guardrail was written to prevent.

**Suggested Fix:** replace the ten comparisons with `isClosedStage(task.stage)` from
`util/task-state-utils.js` and correct the `:653` comment. If the dependency view is
deliberately out of Phase 2 scope, say so in the project log and open a follow-up —
the half-migration is the problem, not either endpoint.

---

## Observations

- **`web/src/components/ft-app.ts:519-522`** — the delta hands `ft-tree-view` four
  filter properties (`.groupFilter`, `.stageFilter`, `.holdReasonFilter`,
  `.availabilityFilter`). `grep -rn "Filter" web/src/components/tree/` returns
  nothing: the component declares no filter properties at all. The old
  `.phaseFilter` binding was already dead, so this is not a regression, but the
  delta widens the dead surface from 2 bindings to 5 and makes the tree view the one
  place where the new contract filters silently do nothing. Either wire them through
  `matchesTaskFilters` or drop the bindings.

- **Refusal-string duplication** — `ft-kanban-column.dropHint`
  (`ft-kanban-column.ts:193-203`) and `ft-kanban-view.reportRefusal` call sites
  (`ft-kanban-view.ts:150`, `:154`, `:163-166`). Two of the three strings are
  byte-identical across the two files; the third is deliberately different wording
  for the same condition. Tooltip and toast will drift. Export the three messages
  from `util/task-state-utils.ts` next to `acceptsStageDrop()`, which is where the
  refusal rule already lives.

- **Check order in `onStageChange`** — `ft-kanban-view.ts:149-158`. The read-only and
  capability refusals fire *before* `const task = this.store.getTask(taskId)`.
  Because `dragover` now unconditionally `preventDefault()`s, dropping arbitrary
  external text (a selection dragged from another window) onto a read-only board
  produces a spurious *"This board is read-only"* toast for a gesture that had
  nothing to do with a task. Hoisting the lookup above the refusal checks fixes it
  and costs nothing:

  ```ts
  const task = this.store.getTask(taskId);
  if (!task || task.stage === stage) return;   // not ours, or a genuine no-op
  if (this.readOnly) { … }
  ```

  Note this is the only reachable path for the read-only refusal at all: cards are
  `draggable=false` when `readOnly` (`ft-task-card.ts:411`), so a user can never
  start an internal drag on a read-only board. The `canChangeStage === false` refusal
  *is* genuinely reachable and does work.

- **Permanent native tooltip on read-only boards** — `ft-kanban-column.ts:361` binds
  `title=${dropHint}`, and `dropHint` returns the read-only string unconditionally
  (`:195`). On a read-only board every one of the ten lanes now shows a browser
  tooltip on hover, whether or not a drag is in progress. Consider gating the `title`
  on `!acceptsStageDrop(this.stage)` and leaving the read-only case to the existing
  board-level read-only affordance. Separately, `aria-description` (`:360`) is an
  ARIA 1.3 draft attribute with thin AT support; `aria-describedby` pointing at a
  visually-hidden span is the portable form.

- **Padlock semantics drifted** — `ft-task-card.ts:450` switched the lock icon from
  "has a `BLOCKED_BY` relationship" to `availability.available === false`. That is
  contract-conformant ("unavailable indicators come from server-computed
  availability"), but it means every Triage card and every Completed card now renders
  a padlock *plus* a redundant availability tag from `renderStateBadges()` (`:196-217`)
  saying the same thing. The CSS class is still named `.blocked-icon` (`:159`).
  Suggest showing the lock only for `BLOCKED_BY_DEPENDENCY` and letting the tag carry
  the other reasons.

- **`computeAvailabilityReasons` counts available tasks too** —
  `ft-dashboard-view.ts:206-226` is rendered under the heading "Unavailable Reasons"
  (`:297`) but iterates `task.availability?.reasons` for *all* tasks, including
  `available === true`. Harmless while the server sends no reasons for available
  tasks, but the heading and the computation disagree. Add
  `if (task.availability?.available !== false) continue;`.

- **Stringly-typed held count** — `ft-dashboard-view.ts:146`:
  `if (holdReasonLabel(task.holdReason)) held++`. Counting by rendering a label works
  (the label function returns `''` for `UNSPECIFIED`) but couples a statistic to a
  presentation helper. Prefer
  `task.holdReason !== undefined && task.holdReason !== TaskHoldReason.UNSPECIFIED`.

- **`UNSPECIFIED` hold reason not normalised in the availability fallback** —
  `web/src/utils/task-ready.ts:21` tests `task.holdReason !== undefined`, whereas
  `matchesTaskFilters` (`task-filters.ts:34`) and `holdReasonLabel`
  (`task-state-utils.ts:100`) both normalise `UNSPECIFIED`. The delta newly populates
  `holdReason` from the wire (`grpc-client.ts:459`), so this line is now live. Risk is
  low — `toObject({ defaults: false })` (`grpc-client.ts:48-53`) omits zero-valued
  enums, so an unset hold reason arrives as `undefined` — but if the field is ever
  declared `optional` in the proto and explicitly set to 0, the fallback would mark
  every task unavailable and silently empty the Available Queue. One-line hardening.

- **Vestigial indirection** — `ft-kanban-view.columnsForStage`
  (`ft-kanban-view.ts:380-383`) returns `BOARD_COLUMNS` or `[]`, a leftover from when
  the board had multiple column groups. With a single group, `onColumnNav` (`:358`)
  can use `BOARD_COLUMNS` directly.

- **`STAGE_COLOR` unification is partial, defensibly so** —
  `inspector-stage-utils.ts:2` is now a two-symbol re-export shim, so two import paths
  exist for the same constants (`ft-inspector-header.ts:8` and
  `ft-inspector-relationships.ts:7` still go through the shim;
  everything else imports `util/task-state-utils.js` directly). Separately,
  `ft-tree-node.ts:6-30` keeps a fourth private copy with deliberately abbreviated
  labels ("Review"/"QA"/"Deploy"/"Done"). That copy is complete and carries no deleted
  vocabulary, so leaving it is a reasonable call — but the fix log's "STAGE_COLOR
  unified" claim should read "unified across three of four call sites". Deleting the
  shim and re-pointing the two inspector imports is a five-line cleanup.

- **Silent Node test scripts** — `src/util/safe-url.test.ts` prints
  `safe-url tests passed`; `src/util/task-state-utils.test.ts` and
  `src/utils/task-ready.test.ts` print nothing, so a green run gives no signal that
  they executed anything. `run-node-tests.mjs` relies on exit codes only. A one-line
  `console.log` in each keeps the three consistent.

- **Production sourcemaps** — `vite.config.ts:7` `sourcemap: true` (pre-existing, not
  in the delta). I confirmed the shipped `.js` contains **zero** occurrences of
  `farmtable.token` and the `.js.map` contains three. Framing matters here: those three
  are the localStorage *key name* inside the dev-gated branch, not a credential, and
  the branch itself is genuinely constant-folded out of the executable bundle
  (`grpc-client.ts:424-432`, `ft-app.ts:314-321`). The residual exposure is full
  source disclosure of a 2.5 MB `.js.map`, which is a deployment-policy question, not
  a token leak. I defer the severity call to the auditor but recommend against
  describing it as a surviving credential.

---

## Positive Feedback

- **The phase ban is enforced structurally, not by convention.**
  `web/src/gen/service.ts:22-28` turns a contract rule into a compile error, and
  `web/test/ft-kanban-view.contract.test.ts:82`'s
  `expect(Object.keys(fields)).toEqual(['stage'])` locks the runtime payload with an
  exact-key assertion rather than a weaker `not.toHaveProperty`. This is the right
  answer to "how do we stop this regressing" and it is a level above what the round-1
  report asked for.

- **The second injection site was found by the implementer, not by any of the three
  round-1 reviewers.** `ft-inspector-code.ts:104-118` (`pr.url`) was a real hole that
  the review pass missed. Sweeping for the *class* of bug rather than patching the
  reported instance is exactly the behaviour that should be reinforced.

- **`safeExternalUrl` defaults to deny and is tested against the right bypasses.**
  `web/src/util/safe-url.test.ts:36-39` covers `http://localhost.evil.example/x`,
  `http://evil.example/?q=localhost` and `http://localhost@evil.example/` — the three
  cases a naïve `includes('localhost')` implementation would fail. The tests were
  written against the attack, not against the implementation.

- **`showErrorToast` uses `document.createTextNode`** (`ft-app.ts:863`) for a message
  that interpolates raw server-controlled text. The obvious implementation is
  `alert.innerHTML = message`, and it would have opened a fresh injection path in the
  same commit that closed two others.

- **The comments explain *why*, and the reasoning survives scrutiny.**
  `ft-kanban-column.ts:176-183` documents why refusing lanes deliberately accept the
  drop gesture and why `dropEffect = 'none'` is the wrong lever; `ft-kanban-view.ts:169-172`
  documents why `phaseForStage` is called for the optimistic store entry and never
  for the payload. Both are the kind of comment that stops the next person from
  "fixing" the code back to broken.

- **The implementer log is honest.** I spot-checked every claim in
  `.design/project-log/task-state-web-ui-fixes.md:440-457` ("Not done, and why") and
  each one is accurate — including the self-reported gap that `safe-url.test.ts` was
  not wired into `npm test`, which the merged glob-based runner
  (`web/scripts/run-node-tests.mjs:38`) has since closed. Verified: it executes.

---

## Verification Story

- **Tests reviewed:** yes. 135/135 green, reproduced. The harness is sound: real
  custom elements, shadow-DOM-aware queries, `restoreMocks`, per-file isolation with
  a documented reason (`vitest.config.ts:23`). Assertions are mostly non-vacuous —
  `ft-kanban-view.contract.test.ts:82` and `:103-110` would both fail on the exact
  regressions they guard. **One material gap in my area:** the `dragover`
  `preventDefault()` inversion is untested (Important #3), so the headline fix of this
  round is not regression-proof. Deeper harness analysis is the test-engineer's call.
- **Build verified:** yes. `npm run build` EXIT 0, `tsc --noEmit` clean. Pre-existing
  chunk-size warning only.
- **Lint/static analysis clean:** N/A — no lint script exists in `web/package.json`.
  `tsc --noEmit` is the only static gate and it passes.
- **Security checked:** yes. Full sink sweep, no third injection site, dev token
  fallback confirmed absent from the production bundle. `npm audit --audit-level=low`
  → 0 vulnerabilities; all new lock entries are `"dev": true`.
- **Diff basis:** `git diff origin/main...HEAD` resolved correctly. No degradation.

---

## Final Verdict

**REQUEST CHANGES**

All three round-1 code-review findings are CLOSED with real, structural fixes, and
the overall quality of this round is high — the phase ban, the URL guard, and the
refusal path are coherent designs rather than spot patches. The blockers are new:

**Must fix before merge**
1. `ft-app.ts:830-834` — the `isServerRejection` branch makes a confident wrong
   attribution in the mirror direction. One-string fix plus one test update.
2. Contract §10 intra-band drag reorder is unimplemented while `rank`/`holdReason`
   write plumbing ships unreachable (`grpc-client.ts:251,253`). **Confirmed a real
   blocker** — both the coordinator and the manager independently re-read the
   contract and ruled it is a Required change, not a descope. Implement.

**Should fix before merge**
3. Add `dragover`/`defaultPrevented` coverage — the round's headline fix is currently
   revertible with all 135 tests green.
4. Add `availability` to the `UpdateTaskFields` omit list.
5. Finish or explicitly defer the `ft-dependency-view.ts` phase→stage migration, and
   fix the stale "blocked stage" comment at `:653`.

Observations 1–11 are cleanup-pass material and should be forwarded regardless of
how the blockers are resolved.

---

## Addendum — dispositions (2026-07-27T15:19Z)

Recorded after the review was delivered, so the re-review has an accurate baseline.

| Finding | Disposition |
|---|---|
| Important 1 — mirror misattribution | Accepted; manager taking the suggested wording verbatim |
| Important 2 — intra-band rank reorder | **Confirmed blocker** by coordinator *and* manager, independently re-reading the contract. Dev task being scoped to implement. Not descoped. |
| Important 3 — dragover untested | Accepted; being fixed |
| Important 4 — `availability` omit | Accepted |
| Important 5 — dependency-view half-migration | Accepted; migration to be finished, not deferred |
| Observations 1–11 | Forwarded to the fix pass |
| Sourcemaps | Being disabled in prod regardless of severity |

**Sourcemap finding — strengthened by the manager's independent check.** I assessed
this as source disclosure rather than credential leak, and both parties agree with
that framing. The manager then verified the deployment half of the question, which
was outside my scope (Go code): `internal/serverapp/unified.go:101` mounts the asset
FS with `http.FileServer` under no auth middleware — auth wraps only the gRPC-web
handler — so the 2.5 MB `.js.map` is retrievable **unauthenticated**. That is the
manager's verification, not mine; I have not read that file. It does not change the
classification (the map still contains no credential, and the dev token branch is
genuinely constant-folded out of the bundle), but it does mean the disclosure is
public rather than authenticated-only, which raises the practical exposure. Prod
sourcemaps are being disabled.

No further reviewer action pending; re-review to be routed when the fixes land.
