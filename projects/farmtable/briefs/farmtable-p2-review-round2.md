# Brief: Phase 2 Web UI — Review Round 2 (code review / security audit / test review)

## Your workspace
Your repo is mounted at `/workspace`. It is a standalone Git clone (not a git
worktree) on branch `task-state-web-ui-v2`, with `web/node_modules` already
installed. Do NOT `git init`, re-clone, or repair git — if something looks wrong,
message the manager instead.

**You have a working base diff this round.** Last round all three reviewers had to
degrade their review because `origin/main` was unreachable in their containers.
That is fixed — `origin` is a local path and resolves:

```bash
cd /workspace
git diff origin/main...HEAD          # 7a0f220 -> 6c4a13f, ~50 files
git log --oneline origin/main..HEAD  # 9 commits
```

Please review the actual base diff. If anything about it looks wrong, say so.

## What this is
Farm Table Phase 2 = the web UI migration to the new task-state contract. Phase 1
(core data/API/CLI/MCP) is already merged and live in production; it is NOT in
scope and must not be re-litigated.

Phase 2 was reviewed once already and all three reviewers returned REQUEST
CHANGES. This is the fix round. Your job is to verify the fixes are real and
complete, and to find anything new.

Authoritative design contract:
`/scion-volumes/scratchpad/projects/farmtable/design-task-state-model-contract.md`
Section 10 "Web UI Implications" governs the UI.

Round 1 reports — read the one matching your role at minimum, ideally all three:
- `/scion-volumes/scratchpad/projects/farmtable/reports/review-task-state-web-ui.md`
- `/scion-volumes/scratchpad/projects/farmtable/reports/audit-task-state-web-ui.md`
- `/scion-volumes/scratchpad/projects/farmtable/reports/test-task-state-web-ui.md`

Implementer logs (read these, then verify their claims rather than trusting them):
- `.design/project-log/task-state-web-ui-fixes.md`
- `.design/project-log/task-state-web-ui-tests.md`

## What changed in this round
Two agents worked in parallel and their branches were merged at `c05e79d`.

Fixes (`dev-p2-fixes`):
1. **HIGH XSS** — new `web/src/util/safe-url.ts` exporting `safeExternalUrl()`;
   allows `https:`, and `http:` only on `localhost`/`127.0.0.1`; returns `null`
   otherwise and the caller renders no link. Applied at
   `ft-inspector-meta.ts` (`task.remoteUrl`) and at `ft-inspector-code.ts`
   (`pr.url` — a **second injection site the round-1 reports missed**).
2. **Phase-write ban** — `updateTask()` is called with `{ stage }` only and
   reconciles from the server response. Enforced by type: `UpdateTaskFields` is
   now `Omit<..., 'phase' | ...>` in `web/src/gen/service.ts`, so a phase write is
   a compile error.
3. **10 board lanes** — `BOARD_COLUMNS` exported from `ft-kanban-view.ts` with the
   three missing terminal lanes added; `STAGE_COLOR` unified in
   `util/task-state-utils.ts`; new shared `acceptsStageDrop()` replaced an inline
   guard.
4. **Deleted vocabulary** removed from mock change history in `gen/service.ts`.
5. **Token fallback** gated behind `import.meta.env.DEV && VITE_ENABLE_LOCAL_TOKEN`.
6. **Visible rejection of refused drags** (added mid-round by the coordinator):
   read-only / capability / terminal-lane refusals now surface a toast instead of
   silently no-op'ing, and `write-error` detail is discriminated
   (`reason: 'stage-change-refused'` vs `'stage-change-failed'`).
7. **Error attribution** — new `isServerRejection()` in `util/grpc-error.ts`, and
   `showWriteError()` now requires positive `/github/i` evidence before giving a
   GitHub-specific diagnosis; otherwise it falls through to a generic message
   carrying the real server reason.

Tests (`dev-p2-tests`): a **Vitest + jsdom component test harness that did not
exist before** (the repo previously had no DOM/component testing at all), with
stubbed Shoelace elements, plus 135 tests in `web/test/`.

## Current state
`npm test` 135/135, `npm run build` EXIT 0, `npm audit --audit-level=low` 0
vulnerabilities. Verify these yourself; do not take them on trust.

## Specific things the manager wants scrutinised
Independent of your role, these are the areas where I am least confident:

- **XSS completeness.** Two injection sites were found. Is there a third? Sweep
  for anything untrusted reaching `href`, `src`, `style`, `srcdoc`, or
  `unsafeHTML`. Note `ft-toolbar.ts:548` builds a GitHub URL from a hardcoded
  prefix plus a strict `owner/repo` regex — I judged that safe; check my work.
- **The `safeExternalUrl` allowlist itself.** Is the `new URL()`-based parse
  bypassable? Consider casing, whitespace/control characters, embedded
  credentials, IDN/punycode, `http://127.0.0.1.evil.com`, `http://[::1]`,
  redirects.
- **The dragover inversion.** Refusing lanes now deliberately call
  `preventDefault()` on `dragover` so the browser actually fires `drop` (bailing
  out was the original cause of the silent no-op). Does accepting the gesture on
  a lane that will refuse introduce any other side effect?
- **The error-attribution judgement calls** in `showWriteError()`. The implementer
  chose textual `/github/i` evidence over the collection's `platform` field,
  reasoning that a Farm Table scope/availability rejection raised inside a
  GitHub-backed collection is still not a GitHub error. Agreed trade-off: a real
  GitHub 403 with no "github" in its text now gets a generic message. Sanity-check
  that reasoning and the resulting branch order.
- **New dev dependencies.** The Vitest harness added a lot to
  `web/package-lock.json`. A vulnerable dev dependency has already caused a
  REQUEST CHANGES on this project once.
- **Production sourcemaps.** Round 1's auditor recommended disabling them. They
  are still on, and `farmtable.token` survives in the `.js.map` (0 occurrences in
  the shipped `.js`). Assess whether that matters.
- **Is the new test suite real coverage or theatre?** 135 green tests is only
  meaningful if the assertions would actually fail on regression.

## Scope discipline
- Phase 1 / backend / Go code is OUT of scope.
- The toolbar stage **filter**, the stage lanes, and drag-to-change-stage are
  **contract-required and staying** — the coordinator ruled on this explicitly
  after round 1's test review wrongly flagged the stage filter as a violation.
  Contract Section 10 bans a native **phase** control, not stage controls, and
  affirmatively requires stage lanes. Do not re-raise this.
- Do report anything genuinely new, including in areas not listed above.

## Deliverable
Write your report to the exact path for your role (below), then message the
manager. Include real command output as evidence — pasted, not summarised — and
file:line references for every finding. Classify findings by severity and end
with an explicit verdict: **APPROVE** or **REQUEST CHANGES**.

State clearly, per round-1 finding, whether it is CLOSED, PARTIALLY CLOSED, or
STILL OPEN. If you cannot verify something, say so rather than assuming.

Do not fix anything yourself and do not commit. You are reviewing, not
implementing. Never push.

### Role report paths
- code-reviewer -> `/scion-volumes/scratchpad/projects/farmtable/reports/review-task-state-web-ui-r2.md`
- security-auditor -> `/scion-volumes/scratchpad/projects/farmtable/reports/audit-task-state-web-ui-r2.md`
- test-engineer -> `/scion-volumes/scratchpad/projects/farmtable/reports/test-task-state-web-ui-r2.md`

### Role focus
**code-reviewer**: correctness, contract conformance against Section 10,
readability, architecture, dead code, whether the fixes are coherent rather than
spot-patched. Confirm each round-1 code-review finding is closed.

**security-auditor**: the XSS fix and its completeness, the token-fallback
gating (verify the code path is genuinely absent from a production build, not
just the string), dependency posture including the new dev dependencies,
sourcemaps, and any new attack surface introduced by the refusal/toast paths.
Confirm each round-1 audit finding is closed, especially the HIGH.

**test-engineer**: whether the new harness is sound and whether the tests are
meaningful — try to break them. Would they actually catch a regression, or do
they pass vacuously (bad selectors, stubs that always satisfy assertions,
assertions on absence that would also pass if the component failed to render)?
Verify the Shoelace stubbing does not invalidate what the tests claim to prove.
Identify remaining coverage gaps. Confirm each round-1 test-review gap is closed.

## Termination
You MUST write your report file at the exact path above, message the manager with
your verdict, and then mark the task complete. Do not stop after analysis without
writing the file — that has happened on this project before.
