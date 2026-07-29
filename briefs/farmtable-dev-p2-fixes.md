# Brief: dev-p2-fixes — Farm Table Phase 2 Web UI, Review-Fix Pass

## Your workspace
- **Inside your container your repo is mounted at `/workspace`.** Just `cd /workspace`.
- It is a normal standalone Git clone (NOT a git worktree), already checked out on
  branch `task-state-web-ui-v2`, with `web/node_modules` already installed.
- `origin` points at a local path and `origin/main` resolves to `7a0f220`.
- Base commit on your branch: `fe8e212 feat: update web UI for task state contract`

Do NOT run `git init`. Do NOT re-initialize the repo, re-clone it, or add
`.git/info/exclude` allowlists. Two previous agents on this project hit a broken
git setup and "fixed" it by reinitializing, which destroyed the branch's Git
ancestry and cost a full rebuild. Your repo is already correct — I verified it.
Verify before you start and again before you finish that this works and is non-empty:

```bash
cd /workspace
git diff --stat origin/main...HEAD   # must show ~26 files changed
```

If any git command misbehaves, **stop and message me** rather than repairing it
yourself:
`scion message farmtable-em-task-state-model-v2 "<what git did>"`

Never `git push`. Commit locally only.

## Context
Phase 1 (core data/API/CLI/MCP) is merged and live in production. You are fixing
Phase 2 (web UI). An initial Phase 2 implementation exists on your branch and was
independently reviewed by three reviewers, all of whom returned REQUEST CHANGES.
None of the findings have been fixed yet. That is your job.

Authoritative design contract:
`/scion-volumes/scratchpad/projects/farmtable/design-task-state-model-contract.md`
(Section 10 "Web UI Implications" is the part that governs your work.)

Full review reports — read all three before you start:
- `/scion-volumes/scratchpad/projects/farmtable/reports/review-task-state-web-ui.md`
- `/scion-volumes/scratchpad/projects/farmtable/reports/audit-task-state-web-ui.md`
- `/scion-volumes/scratchpad/projects/farmtable/reports/test-task-state-web-ui.md`

## Scope: what you fix

### FIX 1 — [HIGH severity XSS] unvalidated `remoteUrl` in anchor href
`web/src/components/inspector/ft-inspector-meta.ts:607`

`task.remoteUrl` is interpolated straight into an `<a href>` with `target="_blank"`.
Lit escapes attribute *values* but does not validate URL *schemes*, so a
`javascript:` URL in that field executes script in the app origin when clicked.

Required implementation — create a new dedicated module so it is independently
testable. This exact path and signature is an interface contract with another
agent writing tests in parallel; do not deviate from it:

```ts
// web/src/util/safe-url.ts
export function safeExternalUrl(raw: string | null | undefined): string | null;
```

Semantics:
- Return the normalized `url.href` for `https:` URLs.
- Return the normalized `url.href` for `http:` URLs ONLY when the hostname is
  exactly `localhost` or `127.0.0.1`.
- Return `null` for everything else: `javascript:`, `data:`, `vbscript:`, `file:`,
  non-localhost `http:`, empty string, null/undefined, and anything that throws
  in `new URL()`.
- Be careful with scheme-casing and whitespace tricks (`JavaScript:`,
  `\tjavascript:`, leading/trailing spaces). `new URL()` normalizes protocol case
  and trims control characters, but add a test for each anyway.

Then in `ft-inspector-meta.ts`, render the link only when `safeExternalUrl()`
returns non-null, and render `nothing` otherwise. Keep
`rel="noopener noreferrer"` on the anchor.

Audit the rest of the web source for the same pattern and fix any other spot
where untrusted data reaches an `href` or `src`:

```bash
grep -rn "href=\${\|src=\${" web/src/
```

The collection-level GitHub link already validates `remoteId` against an
`owner/repo` regex — that one is fine, leave it.

### FIX 2 — [Contract violation] the UI must never write `phase`
`web/src/components/kanban/ft-kanban-view.ts:133-149`

`onStageChange` currently does:
```ts
const newPhase = phaseForStage(stage);
this.store.upsert({ ...task, stage, phase: newPhase });
await this.client.updateTask(taskId, { stage, phase: newPhase });
```

`phase` is a **server-derived wire projection**, not a client-writable field. The
contract (Section 6 and Section 10, "no native phase control") means the web UI
must never assert a phase value. Required changes:

- `client.updateTask()` must be called with `{ stage }` only. Never include
  `phase` in an update payload, anywhere in the codebase.
- Remove `phase` from the `UpdateTaskFields` type in `web/src/gen/grpc-client.ts`
  if it is declared there, so this cannot regress by accident. If the generated
  request builder writes a phase field to the wire, stop it.
- For the optimistic local store update, you still need the card to move
  immediately. Keep using the locally-derived phase for the *optimistic store
  entry only* (it is overwritten by the server response on the next sync), but
  add a comment making clear it is a local projection and never sent to the
  server. Prefer reconciling from the server response returned by `updateTask()`
  if that response carries the authoritative phase.
- Verify no phase writes remain:
  ```bash
  grep -rn "phase" web/src/ | grep -i "updateTask\|update(\|mutation"
  ```

**Explicitly OUT of scope for you:** do NOT remove the toolbar stage *filter*
(`web/src/components/ft-toolbar.ts:345-359`) and do NOT remove kanban drag/drop
stage transitions entirely. Those are read/UX affordances that the design
contract Section 10 arguably requires ("The native board should show stage lanes
for triage, accepted, active stages, and terminal outcomes"), and I have an open
question with the coordinator about them. I will send you a follow-up message if
that scope is added. Fix only the `phase`-write problem for now.

### FIX 3 — Kanban board missing 3 terminal-stage columns
`web/src/components/kanban/ft-kanban-view.ts:29`

`BOARD_COLUMNS` stops at `Completed`, but `WONT_FIX`, `DUPLICATE`, and `CANCELLED`
are valid native terminal stages, are offered by the toolbar's stage filter, and
are returned by the server — so filtering for them yields a visibly empty board.

Add all four terminal columns. **Export `BOARD_COLUMNS`** from `ft-kanban-view.ts`
(interface contract with the parallel test agent):

```ts
export const BOARD_COLUMNS: ColumnDef[] = [
  { stage: TaskStage.TRIAGE, label: 'Triage', phase: TaskPhase.OPEN },
  { stage: TaskStage.ACCEPTED, label: 'Accepted', phase: TaskPhase.OPEN },
  { stage: TaskStage.WORKING, label: 'Working', phase: TaskPhase.IN_PROGRESS },
  { stage: TaskStage.IN_REVIEW, label: 'In Review', phase: TaskPhase.IN_PROGRESS },
  { stage: TaskStage.IN_QA, label: 'In QA', phase: TaskPhase.IN_PROGRESS },
  { stage: TaskStage.DEPLOYING, label: 'Deploying', phase: TaskPhase.IN_PROGRESS },
  { stage: TaskStage.COMPLETED, label: 'Completed', phase: TaskPhase.CLOSED },
  { stage: TaskStage.WONT_FIX, label: "Won't Fix", phase: TaskPhase.CLOSED },
  { stage: TaskStage.DUPLICATE, label: 'Duplicate', phase: TaskPhase.CLOSED },
  { stage: TaskStage.CANCELLED, label: 'Cancelled', phase: TaskPhase.CLOSED },
];
```

Note the `phase` here is a *display grouping* for the lane, which is fine — it is
not written to the server. That is consistent with FIX 2.

Update `STAGE_COLOR` in `web/src/components/kanban/ft-kanban-column.ts:11` to
cover the same terminal stages, or better, reuse the existing `STAGE_COLOR` from
`web/src/util/task-state-utils.ts` so there is a single source of truth. Prefer
the single-source-of-truth version.

Check the existing guard in `onStageChange`:
```ts
if (CLOSED_STAGES.has(stage) && stage !== TaskStage.COMPLETED) return;
```
Now that these lanes are visible, decide and document what dropping onto them
does. Keep the conservative behaviour (silently refuse the drop) but make it
non-silent: the lanes should render as valid drop-refusing targets rather than
appearing broken. A `title`/`aria` affordance is enough; don't build a big UX.

### FIX 4 — Mock change-history data uses deleted vocabulary
`web/src/gen/service.ts:400` and `:424`

Fixtures still contain `oldValue: 'Ready'` and `newValue: 'Blocked'`, which the
inspector's change history renders verbatim — so deleted stage vocabulary is
still visible in the UI. Replace with current stage/hold-reason terminology, per
the audit report's suggested fixture: use `Accepted` -> `Working` for the stage
change, and express the blocked case as a `hold_reason` change
(`field: 'hold_reason', oldValue: null, newValue: 'Waiting for input'`) rather
than a stage string.

Then sweep the whole web tree for surviving deleted vocabulary as *values or
labels* (not just as substrings of unrelated words):

```bash
grep -rniE "'(ready|blocked|scheduled|backlog|waiting_for_input|deferred)'" web/src/
grep -rniE ">(Ready|Blocked|Scheduled|Backlog|Deferred)<" web/src/
```

Note `waiting_for_input` and `deferred` are still valid as **hold_reason** values —
they are only invalid as **stage** values. Do not delete legitimate hold-reason
usage. Use judgement and check each hit.

### FIX 5 — [MEDIUM] Bearer token fallback readable from localStorage
`web/src/gen/grpc-client.ts:418` and `web/src/components/ft-app.ts:313`

The client resolves `farmtable.token` from `localStorage`, and `ft-app` skips the
session check whenever that key exists. Any XSS becomes credential theft — it is
exactly what made FIX 1 a HIGH rather than a MEDIUM. Gate this dev/testing
fallback behind an explicit build flag so it is not present in production builds:

```ts
const isDevTokenFallbackEnabled =
  import.meta.env.DEV && import.meta.env.VITE_ENABLE_LOCAL_TOKEN === 'true';

const token =
  globalConfig.FARMTABLE_TOKEN ??
  (isDevTokenFallbackEnabled ? localStorage.getItem('farmtable.token') : '') ??
  '';
```

Apply the same flag to `ft-app.ts:313` — do not skip session validation just
because `farmtable.token` exists unless the flag is on. Make sure the production
build (`npm run build`, which is not `DEV`) genuinely tree-shakes or disables this
path; confirm by grepping the built bundle:

```bash
npm run build && grep -c "farmtable.token" dist/assets/*.js
```
Report what that count is in your project log. If the string is still present,
explain why (e.g. it may legitimately remain in a sourcemap) and confirm the
*code path* is unreachable.

## Testing you own
Another agent (`dev-p2-tests`) is building the Lit component test harness and the
rendered-UI tests in parallel, on a separate branch. **You do not build the
component harness and you do not edit `web/package.json` or
`web/tsconfig.test.json`** — those are theirs, and edits from both of us would
conflict.

You DO write plain (non-DOM) unit tests for logic you introduce, in the existing
Node test style used by `web/src/util/task-state-utils.test.ts`:

- `web/src/util/safe-url.test.ts` covering `safeExternalUrl()`: `javascript:`,
  `JavaScript:` (mixed case), `data:`, `vbscript:`, `file:`, whitespace-prefixed
  `javascript:`, malformed input, empty string, null, undefined, valid `https:`,
  `http://localhost`, `http://127.0.0.1`, and non-localhost `http:` (must be
  rejected). This test is the primary evidence for the XSS fix, so make it
  thorough.

Because you cannot edit `package.json`, your new test file will not be wired into
`npm test` by you — the test agent will wire it up. Just make sure it compiles
under `tsconfig.test.json` and runs standalone:
```bash
npx tsc -p tsconfig.test.json && node .tmp-test/util/safe-url.test.js
```

## Acceptance criteria
- [ ] All five fixes implemented.
- [ ] `cd web && npm test` passes.
- [ ] `cd web && npm run build` passes (the ~835 kB chunk-size warning is
      pre-existing and fine).
- [ ] `npm audit --audit-level=low` in `web/` reports 0 vulnerabilities.
- [ ] `git diff --check` clean.
- [ ] `git diff --stat origin/main...HEAD` works and shows your changes —
      this proves ancestry is intact.
- [ ] No `phase` in any `updateTask` payload anywhere in `web/src/`.
- [ ] `safeExternalUrl` exported from `web/src/util/safe-url.ts` with the exact
      signature above.
- [ ] `BOARD_COLUMNS` exported from `ft-kanban-view.ts` with all 10 lanes.
- [ ] `web/src/util/safe-url.test.ts` exists and passes standalone.

## Required deliverables
1. Your code changes, committed to `task-state-web-ui-v2` in
   `/workspace`. Use focused commits with clear messages.
2. **Write a project log entry** at
   `.design/project-log/task-state-web-ui-fixes.md` covering: each finding and
   what you changed, the exact verification commands you ran and their real
   output (paste it, do not summarize), the `grep -c "farmtable.token" dist`
   result from FIX 5, any vocabulary-sweep hits you decided to leave alone and
   why, and anything you could not fix with the reason. Commit this too.
3. If you hit a genuine blocker or believe one of these findings is wrong, do not
   silently skip it — message me and explain:
   `scion message farmtable-em-task-state-model-v2 "<your message>"`

## Termination
You MUST implement the fixes, run the full verification set, write the project
log entry, commit everything, and then mark the task complete. Do not stop after
analysis. Do not push.
