# Brief: dev-p2-tests — Farm Table Phase 2 Web UI, Component Test Harness + Rendered Tests

## Your workspace
- **Inside your container your repo is mounted at `/workspace`.** Just `cd /workspace`.
- It is a normal standalone Git clone (NOT a git worktree), already checked out on
  branch `task-state-web-ui-tests`, with `web/node_modules` already installed.
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
Phase 1 (core data/API/CLI/MCP) is merged and live. Phase 2 is the web UI, and it
has been independently reviewed once — all three reviewers returned REQUEST
CHANGES. The test review's central finding is the reason you exist:

> current tests only cover helper/predicate functions, not the actual rendered
> UI — meaning several contract violations were reachable specifically because no
> test asserted their absence.

Today `web/package.json` runs exactly two Node test files via bare `tsc` + `node`.
There is **no DOM, no component rendering, and no way to test a Lit component at
all**. Building that capability is the core of your task.

Read these first:
- `/scion-volumes/scratchpad/projects/farmtable/reports/test-task-state-web-ui.md`
  (your primary spec — it lists the gaps and their priorities)
- `/scion-volumes/scratchpad/projects/farmtable/reports/review-task-state-web-ui.md`
- `/scion-volumes/scratchpad/projects/farmtable/reports/audit-task-state-web-ui.md`
- `/scion-volumes/scratchpad/projects/farmtable/design-task-state-model-contract.md`
  — Section 10 "Web UI Implications" governs what correct behaviour is.

## IMPORTANT: you are writing tests against TARGET behaviour, not current behaviour

A second agent (`dev-p2-fixes`) is fixing the reviewed defects **in parallel**, on
branch `task-state-web-ui-v2`. I will merge your branch into theirs when you are
both done.

That means: **several of the tests you write are expected to FAIL against the code
currently in your worktree, and to pass once the fixes land.** This is deliberate
(Prove-It / test-first). Do not "fix" the component source to make them pass —
component source files are the other agent's territory and your edits there would
conflict. Write the test to assert the correct target behaviour, confirm it fails
for the *right reason*, and record that expected-failure in your project log.

For each test, your project log must state: PASSES NOW, or FAILS NOW — EXPECTED TO
PASS AFTER FIXES (with the one-line reason).

### Interface contract with the other agent
These are the exact APIs `dev-p2-fixes` is required to produce. Write your tests
against them:

- `web/src/util/safe-url.ts` exports
  `safeExternalUrl(raw: string | null | undefined): string | null`
  — returns normalized href for `https:`, and for `http:` only on hostname
  `localhost` / `127.0.0.1`; returns `null` for everything else.
- `web/src/components/kanban/ft-kanban-view.ts` exports `BOARD_COLUMNS`, an array
  of 10 lanes: triage, accepted, working, in_review, in_qa, deploying, completed,
  wont_fix, duplicate, cancelled.
- `client.updateTask()` will be called with `{ stage }` and **never** with a
  `phase` key.

If either of those is missing when you go to write the test, write the test
anyway against the contracted API (it will fail to compile/resolve until the fix
lands — note it in your log and move on). Do not invent a different API.

## Task 1 — Build the component test harness (this is the main deliverable)

Stand up the ability to render Lit components and assert on their shadow DOM.

Requirements:
- Must run headless in CI/container with no browser install if at all possible.
  Strongly prefer a `jsdom`-based setup driven from Node over anything requiring
  a real browser download.
- Must handle this codebase's realities: Lit 3 components, Shoelace (`sl-select`,
  `sl-option`, etc.) custom elements, CSS imports, and `import.meta.env`.
  Shoelace components do not need to *function* — they need to not explode on
  registration, and you need to be able to assert on their presence, attributes,
  and dispatched events. Stubbing/registering lightweight fakes for Shoelace
  elements is an acceptable and probably preferable strategy; document whichever
  approach you choose.
- Must integrate with the existing `npm test` script so that one command runs
  both the existing Node tests and the new component tests. Keep the existing two
  test files working.
- You own `web/package.json` and `web/tsconfig.test.json` exclusively. The other
  agent has been told not to touch them.
- Add any new dev dependencies you need. Check `npm audit --audit-level=low`
  stays at 0 vulnerabilities afterward — the security auditor will run it, and a
  vulnerable dev dependency has already caused a REQUEST CHANGES once on this
  project. If a dependency you want introduces an advisory, pick a different one.
- Keep generated test output (`web/.tmp-test/`, or whatever your runner emits)
  out of Git. `web/.tmp-test/` is already in `.gitignore`; extend it if needed.

Also wire in `web/src/util/safe-url.test.ts` — the other agent is writing that
file but cannot edit `package.json` to register it. Make your test script pick it
up (a glob over `src/**/*.test.ts` is much better than the current hardcoded list;
that also future-proofs it).

## Task 2 — Write the rendered-UI tests

From the test review, in its stated priority order.

### Critical — contract guards (these are the ones that would have caught the bugs)
1. **No native phase control anywhere.** Assert that `ft-toolbar` renders no
   phase selector and exposes no phase-valued control. The old phase filter was
   replaced by an active/closed *group* filter — assert the group filter exists
   and that nothing offers raw `TaskPhase` values as user-selectable options.
2. **No phase mutation can be emitted.** Render `ft-kanban-view`, simulate a
   drag/drop stage transition, capture the payload passed to `client.updateTask`
   (inject a mock client), and assert the payload has a `stage` key and **no
   `phase` key**. This test currently fails — the code sends
   `{ stage, phase: newPhase }`. That is finding #2 and it is exactly what you
   are locking down.
3. **All 10 board lanes render**, including `wont_fix`, `duplicate`, `cancelled`.
   Assert against `BOARD_COLUMNS` and against the actual rendered column
   elements, so that adding a stage to the enum without adding a lane fails.
   Currently fails (only 7 lanes).
4. **No deleted stage vocabulary reaches the rendered DOM.** Render the inspector
   change-history with the mock fixtures and assert the output contains no
   `Ready` / `Blocked` / `Backlog` / `Scheduled` as *stage* values. Currently
   fails (mock fixtures still say `Ready` -> `Blocked`). Be careful to allow
   legitimate hold-reason vocabulary — `waiting_for_input` and `deferred` are
   still valid hold reasons, just not valid stages.

### High
5. **Hold + availability filter wiring**: `ft-toolbar` option labels, selected
   values, the emitted `filter-change` payload shape, `ft-filter-chips` rendered
   chip labels, and chip clear behaviour.
6. **Rendered attention workflow** on `ft-task-card`: the "Needs attention" badge
   appears for dependents blocked by `cancelled`, `duplicate`, AND `wont_fix`
   prerequisites (the existing helper-level test covers only `cancelled`). Add
   negative cases too: completed blockers, non-terminal blockers, missing blocker
   tasks, and tasks without `BLOCKED_BY_DEPENDENCY` must NOT show the badge.

### Medium
7. **Rendered ordering** for `ft-ready-queue-view` and `ft-kanban-column` using
   mixed priority / rank / created-at / id inputs — prove the components actually
   render in `compareAcceptedQueueOrder()` order, not just that the comparator is
   correct in isolation.
8. **Queue-level availability**: prove the rendered available queue honours
   server-computed `task.availability` as authoritative, and that the local
   `isReady()` fallback only applies when `availability` is absent. Keep the
   existing `task-ready.test.ts` fallback tests as they are — they are good.

### Also
9. Unit-test `safeExternalUrl()` yourself at the *rendered* level too: render
   `ft-inspector-meta` with a task whose `remoteUrl` is
   `javascript:alert(document.domain)` and assert **no anchor element is
   rendered** (or that no `href` starting with `javascript:` exists in the shadow
   DOM). This is the evidence the coordinator specifically asked for on the XSS
   fix, so make it explicit and well-named — something like
   `renders no link for javascript: remoteUrl`. Also cover `data:` and a valid
   `https:` URL rendering correctly.

## Acceptance criteria
- [ ] `cd web && npm test` runs both the pre-existing Node tests and the new
      component tests via a single command.
- [ ] `cd web && npm run build` still passes.
- [ ] `npm audit --audit-level=low` in `web/` reports 0 vulnerabilities.
- [ ] `git diff --check` clean; no `.tmp-test`/build output committed.
- [ ] `git diff --stat origin/main...HEAD` works and shows your changes.
- [ ] Every test in Task 2 exists and is clearly named.
- [ ] Your project log states PASSES NOW / FAILS NOW for every single test.
- [ ] You did not modify any file under `web/src/components/` or `web/src/gen/`
      (those belong to `dev-p2-fixes`). Test files are fine anywhere; if you feel
      you must touch a component to make it testable, message me first rather
      than editing it.

## Required deliverables
1. Harness + tests, committed to `task-state-web-ui-tests` in
   `/workspace`.
2. **Write a project log entry** at
   `.design/project-log/task-state-web-ui-tests.md` covering: the harness
   approach and why you chose it, how Shoelace/`import.meta.env`/CSS were
   handled, the full PASSES NOW / FAILS NOW table, real pasted output of
   `npm test`, `npm run build`, and `npm audit`, and any gap from the test review
   you could not close with the reason. Commit this too.
3. If you hit a genuine blocker, message me:
   `scion message farmtable-em-task-state-model-v2 "<your message>"`

## Termination
You MUST build the harness, write the tests, run the full verification set, write
the project log entry, commit everything, and then mark the task complete. Do not
stop after analysis. Do not push. Remember that failing tests are an expected and
correct outcome here — report them, do not hide them by weakening assertions.
