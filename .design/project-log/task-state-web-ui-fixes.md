# Phase 2 Web UI — Review-Fix Pass (task-state-web-ui-v2)

Date: 2026-07-27
Branch: `task-state-web-ui-v2`
Base: `fe8e212 feat: update web UI for task state contract`
Inputs: `review-task-state-web-ui.md`, `audit-task-state-web-ui.md`,
`test-task-state-web-ui.md` (all three returned REQUEST CHANGES), plus the
coordinator's scope ruling of 2026-07-27T14:42Z.

## Commits

| Commit | Scope |
| --- | --- |
| `3669485` | FIX 1 — external URL scheme validation |
| `d5fcf22` | FIX 2 + FIX 3 + coordinator (a)/(b) — phase writes, terminal lanes, visible drop refusal |
| `71f1baf` | FIX 4 — mock change-history vocabulary |
| `ffbf917` | FIX 5 (client half) — dev-gated localStorage token |
| `7c01f4a` | FIX 5 (app half) + coordinator (c) — session gate, error attribution |
| `302ab9b` | Review observation — dashboard `ready` → `available` naming |

---

## FIX 1 — [HIGH] unvalidated `remoteUrl` in anchor href

**Finding:** `web/src/components/inspector/ft-inspector-meta.ts:607` interpolated
`task.remoteUrl` into an `<a href>` with `target="_blank"`. Lit escapes
attribute *values* but does not validate URL *schemes*, so a `javascript:` URL
on a task executed script in the app origin when clicked.

**Change:** new module `web/src/util/safe-url.ts`:

```ts
export function safeExternalUrl(raw: string | null | undefined): string | null;
```

Returns `url.href` for `https:`, and for `http:` only when the hostname is
exactly `localhost` or `127.0.0.1`. Returns `null` for everything else,
including anything that throws in `new URL()`. Scheme casing and whitespace
tricks are handled by `new URL()` normalization (it lowercases the scheme and
strips control characters), and each case has an explicit test anyway.

`ft-inspector-meta.ts` now renders the External Source row only when
`safeExternalUrl()` returns non-null, with `rel="noopener noreferrer"`.

**Second site found by the sweep:** `ft-inspector-code.ts:106` had the same
pattern with `pr.url` (untrusted platform data). It now validates the same way
and renders the PR id unlinked when the URL is unsafe.

**Sweep note.** The grep in the brief,
`grep -rn "href=\${\|src=\${" web/src/`, returns nothing in this environment —
the `\|` BRE alternation combined with `${` does not match. The working
equivalents are `grep -rn 'href=\$' src/` and `grep -rn 'src=\$' src/`. Final
state:

```text
$ grep -rn 'href=\$' src/
src/components/inspector/ft-inspector-code.ts:112:  ... href=${prUrl} target="_blank" rel="noopener noreferrer"
src/components/ft-toolbar.ts:548:  <a href=${url} target="_blank" rel="noopener" class="external-link" ...>
src/components/inspector/ft-inspector-meta.ts:616:  href=${externalUrl}
$ grep -rn 'src=\$' src/
(no matches)
```

`ft-toolbar.ts:548` is the collection GitHub link built from a `remoteId`
already validated against `/^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/` — left alone
per the brief. Other navigation sinks were also checked:
`grep -rn "window.open\|location.href *=\|location.assign\|\.href = " src/`
returns only `ft-toolbar.ts:579` (`a.href = url` for a `URL.createObjectURL`
blob download), which is not attacker-controlled.

**Tests:** `web/src/util/safe-url.test.ts`, in the plain Node style of
`task-state-utils.test.ts`. Covers `javascript:` / `JavaScript:` /
`JAVASCRIPT:`, tab-, newline- and space-prefixed `javascript:`, an
embedded-tab `java\tscript:`, `data:`, `vbscript:`, `file:`, `blob:`, `ftp:`,
empty string, whitespace-only, `null`, `undefined`, malformed input, relative
and protocol-relative paths, `https://` with no host, non-localhost `http:`,
`http://localhost.evil.example`, `localhost` in a query string, `localhost` in
userinfo, plus the accepted cases: `https:`, upper-case `HTTPS:`, padded
`https:`, `https:` normalization, `http://localhost:8080`,
`http://127.0.0.1:3000`, `https://localhost:8443`.

---

## FIX 2 — the UI must never write `phase`

**Finding:** `ft-kanban-view.onStageChange` called
`client.updateTask(taskId, { stage, phase: newPhase })`. `phase` is a
server-derived wire projection (contract §6, §10) and is not client-writable.

**Changes:**

- `UpdateTaskFields` in `web/src/gen/service.ts` now omits `'phase'`
  (`Omit<Partial<Task>, 'phase' | ...>`), so a phase write is a compile error
  rather than a silent contract violation. The type lives in `service.ts`, not
  `grpc-client.ts` as the brief guessed; `grpc-client.ts` re-exports it.
- The gRPC request builder (`grpc-client.ts:updateTask`) never wrote a phase
  field to the wire, so nothing to stop there — verified by reading every
  `request.* =` assignment.
- `onStageChange` sends `{ stage }` only, then reconciles the store from the
  `Task` returned by `updateTask()`, which carries the authoritative
  stage/phase projection.
- The optimistic store entry still uses `phaseForStage(stage)` so the card
  moves lanes immediately, with a comment stating it is a local display
  projection that is never sent and is overwritten by the server response.
  Same for the `createTask` safety-net override further down the file.
- `MockFarmTableClient.updateTask` now derives `phase` from `stage` the way the
  server does. Without this the mock would return a stale phase (since
  `applyTaskUpdateFields` no longer carries one) and the reconcile step would
  push the card back to its old lane in mock mode.

**Verification:**

```text
$ grep -rn "phase" web/src/ | grep -i "updateTask\|update(\|mutation"
web/src/gen/service.ts:28:export type UpdateTaskFields = Omit<Partial<Task>, 'phase' | 'parentTaskId' | ...
```

The single hit is the `Omit` that *prevents* phase writes.

**Out of scope, per the brief and confirmed by the coordinator's ruling:** the
toolbar stage filter and kanban drag-to-change-stage are kept. Only the
phase *write* was removed.

---

## FIX 3 — missing terminal-stage columns

**Finding:** `BOARD_COLUMNS` stopped at `Completed`, so filtering for
`WONT_FIX` / `DUPLICATE` / `CANCELLED` produced a visibly empty board.

**Changes:**

- `BOARD_COLUMNS` is now **exported** from `ft-kanban-view.ts` with all ten
  lanes, exactly as specified in the brief. `ColumnDef` is exported too, with a
  comment noting that its `phase` is a lane display grouping and is never sent
  to the server.
- `ft-kanban-column.ts` deleted its local seven-entry `STAGE_COLOR` and now
  imports the ten-entry `STAGE_COLOR` from `web/src/util/task-state-utils.ts`.
  All ten `--ft-stage-*` CSS variables already exist in `src/styles/theme.css`,
  including `wont-fix`, `duplicate` and `cancelled`.

  **Correction (round-2 polish pass, 2026-07-27):** this was originally written
  as "single source of truth", which overstated it. At the time of the round-2
  review `STAGE_COLOR` was unified across *three of four* call sites: the two
  inspector components still reached it through a re-export shim
  (`inspector-stage-utils.ts`), and `ft-tree-node.ts:6-30` keeps a fourth
  private copy with deliberately abbreviated labels. The polish pass deleted the
  shim and re-pointed both inspector imports at `util/task-state-utils.js`, so
  three of four is now accurate for the shim and the `ft-tree-node.ts` copy is a
  deliberate, documented exception rather than drift.
- The old inline guard `CLOSED_STAGES.has(stage) && stage !== COMPLETED` is
  replaced by `acceptsStageDrop(stage)` in `task-state-utils.ts`, so the
  policy has one definition shared by the view (which refuses) and the column
  (which renders the refusal). The local `CLOSED_STAGES` set in
  `ft-kanban-view.ts` is gone.

Behaviour on dropping onto a terminal lane is unchanged in effect (the
transition is refused) but is now explicit and visible — see (b) below.

---

## FIX 4 — mock change history used deleted vocabulary

**Finding:** `web/src/gen/service.ts:400`/`:424` still contained
`oldValue: 'Ready'` and `newValue: 'Blocked'`, rendered verbatim by the
inspector's change history.

**Change:** `ch1` is now `field: 'stage', oldValue: 'Accepted', newValue:
'Working'`. `ch5` is now `field: 'hold_reason', oldValue: null, newValue:
'Waiting for input'` — the blocked case expressed as a hold reason rather than
a stage string, as the audit suggested. `Change.oldValue` is `unknown`, so
`null` is valid.

**Vocabulary sweep — hits left alone, with reasons:**

```text
$ grep -rniE "'(ready|blocked|scheduled|backlog|waiting_for_input|deferred)'" web/src/
web/src/util/task-state-utils.ts:63:  [TaskHoldReason.DEFERRED]: 'Deferred',
web/src/components/dependency/ft-dependency-view.ts:1222:   *  - 'blocked': the edge is on the downstream path ...
web/src/components/dependency/ft-dependency-view.ts:1227:  private classifyEdge(...): 'blocking' | 'blocked' | null {
web/src/components/dependency/ft-dependency-view.ts:1244:    if (fromIsDownOrSel && toIsDownOrSel) return 'blocked';
web/src/components/dependency/ft-dependency-view.ts:1510:                : classification === 'blocked'

$ grep -rniE ">(Ready|Blocked|Scheduled|Backlog|Deferred)<" web/src/
(no matches)
```

- `'Deferred'` is the label for `TaskHoldReason.DEFERRED` — a legitimate hold
  reason, invalid only as a stage. Kept.
- `ft-dependency-view`'s `'blocking' | 'blocked'` is an internal edge-direction
  classification for graph rendering (which side of the selected node an edge
  falls on). It is not a task state and never reaches a user-visible label.
  Kept.

A wider sweep for `\b(ready|blocked|scheduled|backlog)\b` outside `src/gen`
turns up only: the `ready-queue` view id and `ft-ready-queue-view` element
name, the `isReady()` predicate in `src/utils/task-ready.ts`, and
`'Blocked by'` / `'Blocked by dependency'`. The last two are the
`RelationshipType.BLOCKED_BY` label and the `AvailabilityReason` label — both
current contract vocabulary. The view id and `isReady()` are URL- and
test-visible identifiers (`?view=ready-queue`, `task-ready.test.ts`, which
belongs to `dev-p2-tests`); renaming them would be a URL-compat and
cross-agent-conflict change, so they were left alone and flagged here.

**Review observation addressed** (`review-task-state-web-ui.md`, Observations):
`ft-dashboard-view.ts` rendered the label "Available" while using
`computeReadyCount` / `navigateToReadyQueue` / `readyCount` internally. Renamed
to `computeAvailableCount` / `navigateToAvailableQueue` / `availableCount`
(commit `302ab9b`). Names and one comment only; no behaviour change.

---

## FIX 5 — [MEDIUM] bearer token readable from localStorage

**Finding:** `grpc-client.ts:418` read `farmtable.token` from `localStorage`
unconditionally, and `ft-app.ts:313` skipped session validation whenever that
key existed. Any XSS became credential theft.

**Changes:** both sites now require

```ts
const isDevTokenFallbackEnabled =
  import.meta.env.DEV && import.meta.env.VITE_ENABLE_LOCAL_TOKEN === 'true';
```

`ft-app.checkSessionAndRoute()` only short-circuits the `/api/auth/session`
check when that flag is on *and* the key exists.

The flag expression is deliberately **inlined in both files** rather than
shared through a module: Vite statically replaces `import.meta.env.DEV` with
`false` at build time, and inlining guarantees the constant folding and dead-
code elimination happen locally. A shared exported const would rely on
cross-module constant propagation, which is not guaranteed. This is called out
in comments at both sites.

**Bundle verification (FIX 5 evidence):**

```text
$ npm run build && grep -c "farmtable.token" dist/assets/*.js
0
(grep exit status 1 — no matches)

$ grep -o "localStorage.getItem([^)]*)" dist/assets/*.js | sort -u
localStorage.getItem("farmtable.collectionId")
localStorage.getItem("inspector.collapse.changes")
localStorage.getItem("inspector.collapse.comments")
localStorage.getItem(`inspector.collapse.${e}`)
```

**The count is 0.** The string and the code path are both gone from the
production bundle; the surviving `localStorage` reads are the collection id and
inspector UI preferences, none of which are credentials.

The string *does* survive in the sourcemap
(`grep -c "farmtable.token" dist/assets/*.js.map` → `1`), which is expected —
sourcemaps embed original source text, including dead branches. That is not a
reachable code path. The audit's separate recommendation to consider disabling
production sourcemaps (`vite.config.ts`) is a build-config decision outside
this pass's scope and is not actioned here.

---

## Coordinator addition — visible failure on rejected stage changes

### (a) Silent no-ops in `onStageChange`

Before: three bare `return`s with zero feedback.

After:

| Guard | Before | After |
| --- | --- | --- |
| `readOnly` | silent return | `write-error` with "This board is read-only — stage changes are not saved." |
| `capabilities.canChangeStage === false` | silent return | `write-error` with "This collection does not support stage changes." |
| `!task \|\| task.stage === stage` | silent return | unchanged — genuine no-op (card dropped back on its own lane), left silent as instructed |
| terminal-outcome lane | silent return | `write-error` explaining the outcome is set through the API/CLI/MCP |

Refusals are dispatched as
`new CustomEvent('write-error', { detail: { message, reason: 'stage-change-refused' } })`,
and server failures now carry `{ error, reason: 'stage-change-failed' }`.
`ft-app.onWriteError` renders a `detail.message` verbatim on the existing
danger-toast channel (`showErrorToast`, factored out of `showWriteError`) and
otherwise falls through to the existing error-mapping path. The `error` key and
its behaviour are unchanged, so `dev-p2-tests` can assert on either shape.

Note on `readOnly`: `ft-task-card` already sets `draggable=false` when
read-only, so that refusal is defence in depth rather than a reachable drag.
`canChangeStage === false` is reachable — the card stays draggable and only the
column blocked the drop.

### (b) Terminal lanes render as drop-refusing, not broken

`ft-kanban-column` previously bailed out of `dragenter`/`dragover`/
`dragleave`/`drop` entirely when stage changes were disabled, which is exactly
what made the refusal silent: without `preventDefault()` on `dragover` the
browser never fires `drop`, so the view never learns about the attempt.

After: the column always accepts the drop *gesture* and lets
`ft-kanban-view` arbitrate, so the policy lives in one place and every refusal
reaches the toast. Refusing lanes are visually distinct — a `drop-refused`
class paints the drag-over outline in warning amber instead of primary blue —
and carry a `title` plus `aria-description` from a new `dropHint` getter
("'Won't Fix' is set through the API, CLI, or MCP — dragging here will not
change the stage.", or the read-only / capability variants).

Deliberate trade-off, recorded here: setting `dataTransfer.dropEffect = 'none'`
would be the more honest cursor, but per the HTML drag-and-drop spec it cancels
the drop event, which would make the refusal silent again. Gesture acceptance
plus an explicit toast was chosen over an accurate cursor.

### (c) `showWriteError` misattributed server rejections to GitHub

Before: any error matching `/permission|403|forbidden/i` produced "GitHub
rejected this edit — your token may not have write access", including Farm
Table's own Phase 1 rejections (missing `task:accept` / `task:claim` / close
scope, hold gate, availability gate) — telling the user to check a GitHub token
that has nothing to do with it.

After: a new branch runs first, backed by `isServerRejection()` in
`web/src/util/grpc-error.ts`:

```ts
error instanceof GrpcError &&
  (error.code === grpc.Code.PermissionDenied ||
   error.code === grpc.Code.FailedPrecondition) &&
  !/github/i.test(error.message)
```

producing `Farm Table rejected this change: <server message>` — the server's
own reason, verbatim. The distinction is clean because Farm Table rejections
arrive as a typed `GrpcError` with a numeric status code, while platform
pass-through errors name the platform in their message and are excluded by the
`/github/i` test. The GitHub permission and rate-limit branches are unchanged
for genuine pass-through errors, and the generic
`Failed to save changes: <raw>` remains the fallback.

### (d) Snap-back re-render confirmed

Traced, not assumed:

- Rollback is now `this.store.upsert(task)` — the original object, restoring
  the original `stage` **and** the original local `phase` projection. This is a
  local projection restore, not a phase write.
- `TaskStore.upsert` sets the map entry, calls `_invalidateCaches()` and
  dispatches `tasks-changed`. Its "skip if identical" short-circuit cannot
  suppress the rollback, because the stored entry at that moment is the
  optimistic one with a different stage.
- `TaskStoreController` listens for `tasks-changed` and calls
  `host.requestUpdate()`, so `ft-kanban-view.render()` re-runs.
- Lanes are computed fresh each render from `store.getByStage(col.stage)`, so
  the card is re-projected into its original lane.
- No DOM is relocated by the drag: HTML5 drag-and-drop does not move nodes, and
  `ft-kanban-column.onDrop` only reads `dataTransfer` and dispatches an event.
  There is no path that can strand a card in the target lane.

Residual gap: this is a reasoned trace plus a type check, not a rendered test —
the component harness belongs to `dev-p2-tests`. The behaviour is observable
through the `write-error` detail payload and the store contents, which is what
their tests need.

---

## Verification

All commands run from `/workspace/web` unless noted.

```text
$ npm test

> farmtable-web@0.0.1 test
> tsc -p tsconfig.test.json && node .tmp-test/utils/task-ready.test.js && node .tmp-test/util/task-state-utils.test.js

EXIT=0
```

```text
$ npm run build

> farmtable-web@0.0.1 build
> tsc --noEmit && vite build

vite v6.4.3 building for production...
transforming...
✓ 343 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                   1.12 kB │ gzip:   0.57 kB
dist/assets/index-DATgx8W6.css   36.32 kB │ gzip:   6.53 kB
dist/assets/index-Dqxz-pW6.js   836.63 kB │ gzip: 212.81 kB │ map: 2,508.78 kB

(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rollupOptions.output.manualChunks to improve chunking: https://rollupjs.org/configuration-options/#output-manualchunks
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
[vite-plugin-static-copy] Copied 2053 items.
✓ built in 2.81s
EXIT=0
```

(The chunk-size warning is pre-existing. The bundle grew 835.33 kB → 836.63 kB.)

```text
$ npm audit --audit-level=low
found 0 vulnerabilities
EXIT=0
```

```text
$ grep -c "farmtable.token" dist/assets/*.js
0
grep-exit=1
$ grep -c "farmtable.token" dist/assets/*.js.map
1
```

```text
$ cd /workspace && git diff --check
EXIT=0
```

```text
$ cd /workspace && git diff --stat origin/main...HEAD | tail -3
 web/src/utils/task-ready.ts                        |   8 +-
 web/tsconfig.test.json                             |   2 +-
 30 files changed, 1419 insertions(+), 326 deletions(-)
```

Ancestry to `origin/main` is intact; no git repair, re-init or re-clone was
performed. A repo-local `user.name`/`user.email` was set to
`Scion Agent <scion-agent@local>` (matching the existing commits on the branch)
because committing failed with "Author identity unknown".

Standalone run of the new test — see the note below on why it is not run via
`npm test`:

```text
$ cat > tsconfig.safe-url.tmp.json <<'EOF'
{
  "extends": "./tsconfig.json",
  "compilerOptions": { "noEmit": false, "outDir": ".tmp-test", "rootDir": "src" },
  "include": ["src/util/safe-url.ts", "src/util/safe-url.test.ts"]
}
EOF
$ npx tsc -p tsconfig.safe-url.tmp.json && node .tmp-test/util/safe-url.test.js
safe-url tests passed
EXIT=0
$ rm -f tsconfig.safe-url.tmp.json
```

## Not done, and why

- **`web/src/util/safe-url.test.ts` is not wired into `npm test`.** Per the
  brief, `web/package.json` and `web/tsconfig.test.json` belong to
  `dev-p2-tests` and must not be edited from this branch. `tsconfig.test.json`
  uses an explicit `include` list, so the file is not picked up by
  `npm test` as-is. It *is* type-checked by `npm run build` (`tsc --noEmit`
  covers all of `src`), and it runs green standalone via the throwaway config
  above, which was deleted and not committed. **`dev-p2-tests` needs to add
  `src/util/safe-url.test.ts` to the `include` list and
  `node .tmp-test/util/safe-url.test.js` to the `test` script.**
- **No component-level tests** for the new terminal lanes, the drop refusal, or
  the write-error payload. That harness is `dev-p2-tests`' deliverable.
- **Production sourcemaps** are still emitted (audit's closing
  recommendation). Build-config change, outside this pass.
- **`ready-queue` view id / `isReady()` naming** left as-is — URL-visible and
  owned by another agent's test file. Flagged above.

---

# Follow-up — closing the untyped half of finding (c)

Date: 2026-07-27 (after the merge with `dev-p2-tests`' harness)
Commit: see below
Trigger: coordinator ruling of 2026-07-27T15:03Z. With both branches merged the
suite was 133/135; the two failures were in `web/test/ft-app.write-error.test.ts`:

- `does not blame the GitHub token for a Farm Table error whose text merely says "permission"`
- `does not blame the GitHub token for a Farm Table error whose text merely says "forbidden"`

Both call `showWriteError(new Error(...))` with a **plain `Error`**, not a
`GrpcError`.

## What was wrong

My first pass at finding (c) fixed the *typed* path — `isServerRejection()`
catches `GrpcError` with `PermissionDenied` / `FailedPrecondition` — and left
the untyped fallback exactly as it was:

```ts
} else if (/permission|403|forbidden/i.test(raw)) {
  message = 'GitHub rejected this edit — your token may not have write access';
```

That branch blames a specific credential on nothing more than the word
"permission" or "forbidden" appearing in the text, which is the same
confident-but-unfounded guess finding (c) was raised about. Any error reaching
`showWriteError` without being a `GrpcError` — an adapter that rethrows, an
error wrapped or serialized across a boundary, a future code path — still sent
the user off to check a GitHub token that may be entirely unrelated, and
discarded the actual server reason while doing it. The coordinator's ruling is
correct and the tests are right; the code was changed to match them, and no
test in `web/test/` was touched.

## Change

`ft-app.showWriteError()` now requires **positive evidence** of GitHub
involvement before giving a GitHub-specific diagnosis:

```ts
const mentionsGitHub = /github/i.test(raw);

if (isServerRejection(error)) {
  message = `Farm Table rejected this change: ${raw}`;
} else if (mentionsGitHub && /permission|403|forbidden/i.test(raw)) {
  message = 'GitHub rejected this edit — your token may not have write access';
} else if (/rate.?limit|429|too many requests/i.test(raw)) {
  message = mentionsGitHub
    ? 'GitHub rate limit reached — please wait before making more edits'
    : 'Rate limit reached — please wait before making more edits';
} else if (/network|fetch|ECONNREFUSED|unavailable|deadline/i.test(raw)) {
  ...
} else {
  message = `Failed to save changes: ${raw}`;
}
```

`isServerRejection()` is unchanged — the typed path stays exactly as designed.

Reasoning for the two specific choices:

- **Evidence = `/github/i` in the message, not the collection's platform.** The
  call site can cheaply reach the current collection, but keying off
  `platform === GITHUB` would re-introduce the same class of guess: a Farm
  Table scope or availability rejection raised while working in a
  GitHub-backed collection is still not a GitHub error, and would be
  misdiagnosed for every user of every GitHub collection. Textual evidence is
  the narrower and more defensible rule, so it is what shipped.
- **Rate limiting gets a neutral variant rather than falling through to the
  generic branch.** A rate limit names no credential, so
  "Rate limit reached — please wait before making more edits" is truthful
  regardless of source and keeps the actionable advice. Only the GitHub-
  attributed wording is gated. (The generic fallback would also have passed the
  test, which only asserts `/rate limit/i`, but it would have thrown away
  useful guidance.)

Accepted trade-off, per the ruling: a genuine GitHub 403 whose message happens
not to contain the word "github" now gets the generic message with the real
reason instead of the token hint. That is the correct direction to fail.

Behaviour table after the change:

| Input | Before | After |
| --- | --- | --- |
| `GrpcError(PermissionDenied, 'permission denied: …')` | Farm Table reason | unchanged |
| `Error('permission denied: collection is archived')` | "GitHub rejected this edit — your token may not have write access" | `Failed to save changes: permission denied: collection is archived` |
| `Error('forbidden: assignment requires an accepted stage')` | GitHub token hint | `Failed to save changes: forbidden: assignment requires an accepted stage` |
| `Error('403 Forbidden from api.github.com/…')` | GitHub token hint | unchanged (evidence present) |
| `GrpcError(PermissionDenied, 'github: 403 Forbidden writing issue #7')` | GitHub token hint | unchanged (excluded from `isServerRejection` by the `/github/i` test, then matched by the gated GitHub branch) |
| `Error('rate limit exceeded (429)')` | "GitHub rate limit reached …" | "Rate limit reached …" |
| `Error('fetch failed: ECONNREFUSED')` | unreachable-server message | unchanged |
| `Error('boom')` | `Failed to save changes: boom` | unchanged |

This closes the untyped half of finding (c). Both halves of the finding are now
covered: typed rejections by `isServerRejection()`, untyped ones by requiring
GitHub evidence before a GitHub diagnosis.

## Verification

```text
$ npm test

> farmtable-web@0.0.1 test
> npm run test:node && npm run test:components

> farmtable-web@0.0.1 test:node
> node scripts/run-node-tests.mjs

Compiling 3 Node test script(s) with tsconfig.test.json…

▶ .tmp-test/util/safe-url.test.js
safe-url tests passed

▶ .tmp-test/util/task-state-utils.test.js

▶ .tmp-test/utils/task-ready.test.js

3 Node test script(s) passed.

> farmtable-web@0.0.1 test:components
> vitest run

 RUN  v3.2.7 /workspace/web
...
 ✓ test/ft-toolbar.contract.test.ts (13 tests) 320ms
 ✓ test/ft-kanban-view.contract.test.ts (20 tests) 552ms
 ✓ test/ft-inspector-changes.vocabulary.test.ts (3 tests) 8504ms

 Test Files  11 passed (11)
      Tests  135 passed (135)
   Duration  9.53s
```

**135/135, zero failures.** No file under `web/test/` was modified.

```text
$ npm run build > /tmp/build.log 2>&1; echo "BUILD EXIT=$?"
BUILD EXIT=0
```

```text
$ npm audit --audit-level=low
found 0 vulnerabilities
```

```text
$ grep -c "farmtable.token" dist/assets/*.js
0
```

```text
$ cd /workspace && git diff --check
clean
```

The `dev-p2-tests` handoff item from the previous section is resolved: their
harness wired `src/util/safe-url.test.ts` in via
`tsconfig.test.json` (`include: ["src/**/*.test.ts"]`) and
`scripts/run-node-tests.mjs`, and it runs green as part of `npm test`.
