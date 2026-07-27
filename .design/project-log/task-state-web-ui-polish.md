# Phase 2 web UI — round-2 review/audit fix pass ("polish")

- **Date:** 2026-07-27
- **Branch:** `polish-r2`, forked from `task-state-web-ui-v2` @ `6c4a13f`
- **Agent:** `farmtable-dev-p2-polish`
- **Brief:** `/scion-volumes/scratchpad/projects/farmtable/briefs/farmtable-dev-p2-polish.md`
- **Inputs:** round-2 code review (`review-task-state-web-ui-r2.md`, REQUEST CHANGES)
  and round-2 security audit (`audit-task-state-web-ui-r2.md`, APPROVE with 3 LOWs)

```
$ git log --oneline 6c4a13f..HEAD
ccd5010 refactor(web): fold in round-2 review observations
c9d9c8b refactor(web): finish the phase->stage migration in the dependency view
b35f36e fix(web): harden safe-url and stop shipping production sourcemaps
1b69a20 test(web): cover the dragover preventDefault inversion
0f7d137 fix(web): report server rejections without naming a culprit

22 files changed, 422 insertions(+), 85 deletions(-)
```

Not pushed. Code-review blocker #2 (intra-band rank reorder) is `dev-p2-rank`'s
work on branch `rank-reorder` and is not in this branch.

---

## Verification (real output)

```
$ npm run build
> tsc --noEmit && vite build
vite v6.4.3 building for production...
✓ 343 modules transformed.
dist/index.html                   1.12 kB │ gzip:   0.57 kB
dist/assets/index-DATgx8W6.css   36.32 kB │ gzip:   6.53 kB
dist/assets/index-DVOaHTU6.js   836.82 kB │ gzip: 213.02 kB
✓ built in 3.44s
=== EXIT 0 ===
```

The `map: 2,509.65 kB` column present in the round-2 reports is gone.

```
$ ls dist/assets/
index-DATgx8W6.css
index-DVOaHTU6.js
$ find dist -name '*.map' | wc -l
0
$ grep -o 'sourceMappingURL' dist/assets/*.js | wc -l
0
```

```
$ npm test
safe-url tests passed
task-state-utils tests passed
task-ready tests passed
3 Node test script(s) passed.

 ✓ test/safe-url.contract.test.ts (17 tests) 12ms
 ✓ test/ft-inspector-code.safe-url.test.ts (11 tests) 90ms
 ✓ test/ft-filter-chips.test.ts (11 tests) 93ms
 ✓ test/ft-ready-queue-view.availability.test.ts (14 tests) 118ms
 ✓ test/ft-task-card.attention.test.ts (15 tests) 140ms
 ✓ test/queue-ordering.test.ts (5 tests) 154ms
 ✓ test/ft-inspector-meta.safe-url.test.ts (14 tests) 192ms
 ✓ test/ft-app.write-error.test.ts (13 tests) 35ms
 ✓ test/ft-toolbar.contract.test.ts (13 tests) 291ms
 ✓ test/ft-kanban-view.contract.test.ts (32 tests) 681ms
 ✓ test/ft-inspector-changes.vocabulary.test.ts (3 tests) 8515ms
 Test Files  11 passed (11)
      Tests  148 passed (148)
```

135 → 148 tests (+13). All three Node scripts now print on success (Obs 11).

```
$ npm audit --audit-level=low
found 0 vulnerabilities
```

### Mutation checks — every claim below was run, not reasoned about

The brief required proof that the new `dragover` coverage bites. All three
mutants were re-run against the **final** committed state, not an intermediate
one, because later commits refactored the same code paths.

**1. Re-add the early return to `onDragOver` (the round-2 headline fix):**

```
$ # if (this.isDropRefused) return;  restored at the top of onDragOver
$ npx vitest run test/ft-kanban-view.contract.test.ts
 Test Files  1 failed (1)
      Tests  10 failed | 22 passed (32)
```

10 of the 12 new tests fail. The 2 that stay green are the accepting-lane
controls, which the early return correctly does not affect. Confirmed the
reported baseline as well: **all 20 pre-existing kanban tests stay green under
this mutation**, which is exactly why the test engineer's mutation run found the
fix revertible.

**2. Remove the userinfo rejection from `safeExternalUrl`:**

```
Error: https: with user:pass is rejected: expected null, got https://user:pass@evil.example/
```

**3. Un-gate the `http:` loopback carve-out (`ALLOW_LOCAL_HTTP` forced true):**

```
Error: Node test runner must exercise the production (https-only) configuration: expected false, got true
```

**4. Restore the old "Farm Table rejected this change" wording:**

```
 Tests  2 failed | 11 passed (13)
```

Working tree verified clean (`git status --porcelain` empty) after each
mutant was reverted.

---

## Work items

### 1 (BLOCKER) — `showWriteError` misattributed in the mirror direction — DONE

`ft-app.ts` now reports `The change was rejected: ${raw}` for the
`isServerRejection` branch. Branch order and the "textual evidence beats the
`platform` field" reasoning are unchanged, as instructed — only the wording.

The test at `ft-app.write-error.test.ts:56` was replaced with two tests: one
asserting the neutral wording *and* that `FARMTABLE_REASON` still reaches the
user, one feeding `PermissionDenied("403 Forbidden writing issue #7")` — the
exact input that made the mirrored bug visible — and asserting Farm Table is not
blamed. The `not.toMatch(/github/i)` / `not.toMatch(/token/i)` assertions
carrying the round-1 guarantee were kept untouched.

### 2 (SHOULD FIX) — `dragover` regression coverage — DONE, verified RED

Added `dragOverOn()` and `dragTaskOnto()` to `web/test/helpers/dom.ts` and a
12-test block to `ft-kanban-view.contract.test.ts`.

`dragOverOn` asserts `defaultPrevented` directly. `dragTaskOnto` is the stronger
one: it enforces the browser rule (`drop` only fires if `dragover` was
cancelled) and returns `false` when the gesture was swallowed, so a reverted fix
produces no drop, no toast, and no feedback at all — the silent no-op reproduced
end to end rather than asserted by proxy.

Covered: the three terminal lanes, `readOnly`, `canChangeStage: false`, two
accepting-lane controls, and that `dropEffect` is set to `move` rather than left
at `none` (which cancels the drop in a real browser — the same bug by another
route). Mutation result above.

### 3 (SHOULD FIX) — `availability` in the `UpdateTaskFields` omit list — DONE

`gen/service.ts`. `id`/`version`/`createdAt`/`collectionId`/`platform` left alone
as instructed.

### 4 (SHOULD FIX) — dependency view phase→stage migration — DONE

All ten `TaskPhase.CLOSED` comparisons in `ft-dependency-view.ts` replaced with
`isClosedStage(task.stage)`; the now-unused `TaskPhase` import dropped; the stale
`:653` comment ("including ON_HOLD tasks in the 'blocked' stage") rewritten,
since `blocked` is not a stage any more.

One judgement call worth flagging: line 747 is a **layout cache key**
(`structureKey`), not a visibility predicate. Migrating it from `t.phase` to
`t.stage` is a small behaviour change — a `completed → cancelled` move now
invalidates the cache where before it did not. That is the correct direction
(visibility depends on `isClosedStage(stage)`, so the key must track `stage`),
and it can only cause an extra relayout, never a stale one. Called out because
it is the only line of the ten that is not a pure refactor.

### 5 (AUDIT LOW-1) — dev-gate the `http:` localhost carve-out — DONE

`safe-url.ts` exports `LOCAL_HTTP_LINKS_ENABLED`, gated on `import.meta.env.DEV`
like the token fallback.

Verified folded out of the production bundle, to the same evidence standard the
auditor used for the token gate:

```
$ grep -o '127\.0\.0\.1' dist/assets/*.js | wc -l
0
$ grep -o 'localhost' dist/assets/*.js | wc -l
1
```

The single surviving `localhost` is grpc-web's XHR feature detection
(`o.open("GET","https://localhost")`), not `safe-url`. The `LOCAL_HOSTNAMES` Set
is tree-shaken away entirely once the branch folds.

**Two things future readers need to know**, both now documented in code:

- The gate is written `typeof import.meta.env !== 'undefined' && import.meta.env.DEV === true`,
  not the bare form from the audit report. `safe-url.ts` is also compiled by
  `tsconfig.test.json` and run under plain **Node**, where `import.meta.env` does
  not exist and the bare form throws. Node therefore takes the production
  answer — the strict one — so the Node suite pins production behaviour and the
  arrangement fails closed.
- **Vitest runs with `DEV` true**, so the two component/contract tests that
  assert loopback links render are asserting the *development* contract. They
  passed before and after this change and would have quietly misled the next
  reader into thinking production allows loopback. I annotated both
  (`test/safe-url.contract.test.ts` header, `test/ft-inspector-meta.safe-url.test.ts:83`)
  and renamed the latter to `… (dev builds only)`. No assertions changed.

Production-rejection tests added for every obfuscated form in the audit:
`0x7f000001`, `2130706433`, `127.1`, `0177.0.0.1`, fullwidth `127．0．0．1`, a
hex-with-port variant, and `[::1]`.

### 6 (AUDIT LOW-2) — reject embedded credentials — DONE

`if (url.username || url.password) return null;`, placed before the protocol
checks so it applies to loopback `http:` too. Added the two cases from the audit
plus `https://github.com@evil.example/`, a password-only form, and
`http://user:pass@localhost/`.

### 7 (AUDIT LOW-3) — production sourcemaps — DONE

`sourcemap: false` in `vite.config.ts`, **not** `'hidden'` — the comment in the
config records why, so nobody "improves" it to `'hidden'` later: `'hidden'` only
drops the `sourceMappingURL` comment and still writes the `.map` into `dist/`,
which `//go:embed all:web/dist` ships inside the server binary where
`http.FileServer` serves it unauthenticated. Verified: 0 `.map` files, 0
`sourceMappingURL` references.

### 8 — Observations

| Obs | Status | Note |
|---|---|---|
| 1 — dead `ft-tree-view` filter bindings | DONE | Dropped all **five**, not four — `.assigneeFilter` is equally dead (`grep -rn "Filter" web/src/components/tree/` returns nothing). Replaced with an HTML comment explaining why they are absent. Not wired up; that is a feature. **Follow-up: the tree view silently ignores every contract filter.** |
| 2 — duplicated refusal strings | DONE | Exported as `DROP_REFUSAL` from `task-state-utils.ts` next to `acceptsStageDrop()`. The two terminal-lane variants are kept distinct (`terminalLaneHint` read before the gesture, `terminalLaneToast` read after) with a comment saying the difference is deliberate, so nobody "deduplicates" them into one. |
| 3 / INFO-3 — check order in `onStageChange` | DONE | `store.getTask()` hoisted above the refusal branches. |
| 4 (part) — permanent tooltip on read-only boards | DONE | New `dropTooltip` getter: only the lane-intrinsic refusal gets a native `title`. Board-level reasons still reach the user via `aria-description` and the post-drop toast. **`aria-description` → `aria-describedby` deliberately NOT changed** — manager filing separately. |
| 5 — padlock semantics | **NOT DONE (out of scope)** | Product decision; manager filing. Untouched. |
| 6 — availability reasons count available tasks | DONE | |
| 7 — stringly-typed held count | DONE | See note below. |
| 8 — `UNSPECIFIED` not normalised in `task-ready.ts` | DONE | See note below. |
| 9 — vestigial `columnsForStage` | DONE | Removed; `onColumnNav` uses `BOARD_COLUMNS`. |
| 10 — `inspector-stage-utils.ts` shim | DONE (partial by design) | See note below. |
| 11 — silent Node test scripts | DONE | Both now print; all three are consistent. |

**Obs 7 + 8 were fixed together.** Both are the same
`undefined`-vs-`UNSPECIFIED` normalisation, and the codebase already had three
copies of it. Rather than add a fourth and a fifth inline, I added
`hasHoldReason()` to `task-state-utils.ts` and pointed `holdReasonLabel`, the
dashboard count and `task-ready.ts` at it. Slightly more than the reviewer asked
for; it seemed contrary to the spirit of Obs 2 to fix duplication in one place
and add it in another.

**Obs 10 is intentionally partial.** `inspector-stage-utils.ts` is *not* a
two-symbol shim — it also defines `REL_GROUP_LABEL` and `REL_GROUP_ORDER`, which
are relationship vocabulary with no other home. I deleted the
`export { STAGE_COLOR, STAGE_LABEL }` re-export line and re-pointed both
inspector imports at `util/task-state-utils.js`; the file survives for
`REL_GROUP_*`, which `ft-inspector-relationships.ts` still imports. Deleting the
file outright would have meant relocating those two constants, which is a
different change than the one asked for. `ft-tree-node.ts:6-30`'s private copy
left alone as instructed. The "STAGE_COLOR unified" claim in
`.design/project-log/task-state-web-ui-fixes.md` is corrected in place with a
dated correction note rather than a silent edit.

---

## Not done, and why

Everything in the brief was completed. This section records what was
**deliberately left**, so a re-reviewer can check the list rather than
rediscover it.

1. **Code-review blocker #2 — intra-band rank drag reorder.** Not mine.
   `dev-p2-rank` owns it on branch `rank-reorder`. Nothing in this branch touches
   `components/ready-queue/*`, `util/rank.ts`, or `ft-app.ts:489-501`; verified
   below.

2. **Obs 5 — padlock semantics.** Explicitly out of scope per the brief; a
   product decision the manager is filing. `ft-task-card.ts:450` untouched.

3. **`aria-description` → `aria-describedby`.** Explicitly out of scope; the
   manager is filing it as an accessibility follow-up. I gated the `title`
   attribute only and left `aria-description` exactly as it was.

4. **The other test-coverage gaps from the round-2 test review.** Out of scope by
   instruction — a dedicated test engineer runs against the combined branch after
   this merges. I only touched tests that were inseparable from production code I
   changed: the write-error assertion (work item 1), the `dragover` block (work
   item 2), and two comment-only annotations on the safe-url tests my dev-gate
   made mode-dependent. Things noticed but **not** fixed, for routing:

   - `test/ft-inspector-changes.vocabulary.test.ts` takes **8.5s of a 9.6s
     suite** — 88% of total runtime in 3 tests. Nothing is wrong with it, but it
     is the whole suite's wall-clock cost and worth a look.
   - `ft-kanban-view.ts` carries a `TODO(test-coverage)` for the
     `column-add-task` event flow, still uncovered.
   - The `readOnly` refusal path in `onStageChange` is only reachable via a
     foreign drag: cards are `draggable=false` when `readOnly`
     (`ft-task-card.ts:411`), so no internal drag can start. The tests that
     cover it synthesise a drop directly. Not wrong, but the coverage is more
     theoretical than it looks. `canChangeStage: false` *is* genuinely reachable.
   - Lit logs `scheduled an update ... after an update completed` for
     `ft-kanban-column` and `ft-inspector-changes` during the run. Pre-existing,
     not caused by this pass, tests pass regardless.

5. **Audit INFO-4 recommendation — naming `Attachment.url` in the `safe-url.ts`
   module comment.** One line, in a file I was already editing, and I left it
   out: it was not in my brief's work items and the instruction was not to
   expand scope silently. Flagging rather than doing. INFO-1 (assert the bundle
   grep in CI) and INFO-2 are likewise untouched — both are CI/backlog items
   outside this branch.

6. **`ft-dependency-view.ts:652`** still reads "All OPEN/IN_PROGRESS tasks". Left
   deliberately: `OPEN` and `IN_PROGRESS` are current `TaskPhase` members, so
   unlike the `blocked` *stage* at `:653` this is not deleted vocabulary. Only
   the line the brief identified was changed.

---

## Disagreements with the triage

None substantive — the triage was accurate and every finding reproduced as
described. Three notes rather than objections:

1. **Obs 1 undercounts.** The brief and review both say four dead filter
   bindings on `ft-tree-view`; there are five (`.assigneeFilter` too). I dropped
   all five, since dropping four and leaving one equally-dead binding would be
   the worse outcome. Flagging because it changes the follow-up's scope
   slightly.

2. **Obs 10's "two-symbol re-export shim" is not quite the shape described** —
   the file also owns `REL_GROUP_LABEL` / `REL_GROUP_ORDER`. Handled as described
   above; the five-line cleanup is really a three-line one plus a file that
   stays.

3. **The `import.meta.env.DEV` gate needed a `typeof` guard** the audit's
   recommended snippet does not have, or the Node test suite crashes on load.
   Worth knowing if LOW-1's snippet gets applied anywhere else.

---

## Ownership check

```
$ git diff --name-only 6c4a13f..HEAD
.design/project-log/task-state-web-ui-fixes.md      ← authorised by Obs 10
web/src/components/dependency/ft-dependency-view.ts
web/src/components/ft-app.ts                        ← NOT lines 489-501
web/src/components/ft-dashboard-view.ts
web/src/components/inspector/ft-inspector-header.ts
web/src/components/inspector/ft-inspector-relationships.ts
web/src/components/inspector/inspector-stage-utils.ts
web/src/components/kanban/ft-kanban-column.ts
web/src/components/kanban/ft-kanban-view.ts
web/src/gen/service.ts
web/src/util/safe-url.test.ts
web/src/util/safe-url.ts
web/src/util/task-state-utils.test.ts
web/src/util/task-state-utils.ts
web/src/utils/task-ready.test.ts
web/src/utils/task-ready.ts
web/test/ft-app.write-error.test.ts
web/test/ft-inspector-meta.safe-url.test.ts
web/test/ft-kanban-view.contract.test.ts
web/test/helpers/dom.ts
web/test/safe-url.contract.test.ts
web/vite.config.ts
```

Every path is on the brief's ownership list. Nothing owned by `dev-p2-rank` was
touched:

```
$ git diff --name-only 6c4a13f..HEAD | grep -E "ready-queue|util/rank"
NONE
```

`ft-app.ts` was modified only at old-file lines 515-524 and 831-835:

```
$ git diff 6c4a13f..HEAD -U0 -- web/src/components/ft-app.ts | grep '^@@'
@@ -515,0 +516,6 @@
@@ -519,5 +524,0 @@
@@ -831,4 +832,5 @@

$ diff <(git show 6c4a13f:web/src/components/ft-app.ts | sed -n '489,501p') \
       <(sed -n '489,501p' web/src/components/ft-app.ts)
IDENTICAL (byte-for-byte)
```

The reserved `case 'ready-queue':` block is unchanged.

---

## Note for the merger

`ft-app.ts` should merge cleanly with `rank-reorder` — the two branches touch
non-adjacent regions (mine at ~516 and ~832, theirs at 489-501).

One semantic interaction to be aware of rather than a conflict: this branch
moves `store.getTask()` above the refusal checks in
`ft-kanban-view.onStageChange` (Obs 3) and exports refusal strings as
`DROP_REFUSAL` from `task-state-utils.ts` (Obs 2). If the rank work adds its own
drop refusals, they should use `DROP_REFUSAL` and sit *after* the task lookup to
stay consistent.

`web/test/helpers/dom.ts` gained `dragOverOn` and `dragTaskOnto`. The rank branch
has its own drag tests; if it also added a dragover helper, keep one.
