# On-Hold Toolbar Option — Contract Check (no defect found)

Date: 2026-07-29
Role: Developer
Branch: `onhold-toolbar` (cut from `cc92735`, not pushed)
Worktree: `/tmp/onhold/work` — **pristine clone, `web/dist` ABSENT, `node_modules` ABSENT**

## Summary

Checked a suspected live acceptance-criteria violation: that the `ON_HOLD` entry in
`PHASE_OPTIONS` (`web/src/components/ft-toolbar.ts:37`) makes prime `on_hold` selectable through
the web interface.

**Verdict: NOT A DEFECT. Main complies. No code change made.**

The `ON_HOLD` option does render — but into a **view filter**, not a phase setter. The criterion
governs writing a native asserted value, which no web path can do. This entry exists because a
round that correctly finds nothing is the easiest result to lose, and losing it means the next
person re-runs it.

## Contract text this was checked against

Not in the repo — on the scratchpad volume. Both paths, since the absence of any in-repo copy is
itself why this took a round trip:

- `/scion-volumes/scratchpad/projects/farmtable/briefs/farmtable-dev-task-state-core.md:8`
  — "Removed native stage vocabulary must not survive as writeable/selectable native values:
  ... and prime `on_hold`."
- `/scion-volumes/scratchpad/projects/farmtable/briefs/farmtable-architect-task-state-contract.md:81`
  — "`on_hold` as a prime stage: replace with a hold/modifier axis."

Two further loci found by re-running the search independently, which disambiguate "selectable":

- `farmtable-architect-task-state-contract.md:355-357` — prime `on_hold` "cannot survive **as
  behavior** through overlooked CLI/MCP/web/adapter paths."
- `farmtable-review-task-state-core.md:12` — removed stages "cannot be **written or selected as
  native asserted values**."

The object in both is a *native asserted value* surviving *as behavior*. A dropdown that selects
a **view over tasks** asserts no value and changes no behavior. "Prime" is contract vocabulary
meaning a top-level workflow stage, as against the hold/modifier axis line 81 prescribes.

## Why main complies — three independent mechanisms

All measured at `cc92735` in the pristine clone named above.

1. `phaseForStage()` (`web/src/gen/service.ts:155`) returns only `OPEN`, `IN_PROGRESS`, `CLOSED`,
   or `UNSPECIFIED` in `default:`. **There is no branch returning `ON_HOLD`.**
2. The `TaskStage` enum (`web/src/gen/types.ts:22-37`) contains **no on-hold stage**. No drag
   target could map to one.
3. `const ON_HOLD_STAGES: ColumnDef[] = []` (`ft-kanban-view.ts:38`) — empty, so **zero on-hold
   columns render** and no drop target exists.

The only phase write in the entire web client is `ft-kanban-view.ts:170`,
`updateTask(taskId, { stage, phase: newPhase })`, with `newPhase = phaseForStage(stage)`. It is
gated by all three facts above. Any one of them is sufficient.

## The same holds for the CLI and MCP paths the contract names

Line 355 names CLI/MCP/web/adapter, so the web-only answer was not enough. Every `ON_HOLD`
reference in `internal/cli` and `internal/mcp` is on a **read** path:

- `internal/cli/task.go:305`, `internal/cli/watch.go:160`, `internal/mcp/server.go:61`,
  `internal/mcp/server.go:145` — all `--phase` / `phase` **filter** descriptors.
- All four `Phase = &p` assignments resolve to read requests: `pb.ListTasksRequest`
  (`cli/task.go:233`, `mcp/server.go:191`, `mcp/server.go:572`) and `pb.WatchTasksRequest`
  (`cli/watch.go:100`).

**No CLI or MCP path writes phase at all.** `on_hold` is filter-only across every path the
criterion names. (Adapter paths were not examined — see Limits.)

## Why the filter must NOT be removed

Removing the toolbar option would have been a **compliance regression shipped as a compliance
fix**:

- `on_hold` is first-class outside the web UI — `proto/farmtable.proto:40`,
  `internal/store/schema/task.go:22` (DB enum), `internal/cli/enums.go:136`,
  `internal/mcp/server.go:823`. The backend actively produces on-hold tasks.
- The same UI already surfaces them: `ft-dashboard-view.ts:147` renders an "On Hold" count and
  `ft-filter-chips.ts:10` labels the active filter.
- The contract does not *delete* holds, it **relocates** them to a modifier axis
  (`contract.md:81`). A system that still has holds must still let a user find them.

Deleting the only way to find a state the system actively produces would have moved main further
from the contract while appearing to implement it.

## Corrections to the brief that commissioned this

Recorded because a stale field propagates into the next brief that inherits it, and the next one
may not point the same way:

1. **`web/tsconfig.test.json` include.** Brief stated `['src/**/*.test.ts']`. Measured:
   `["src/utils/task-ready.test.ts"]` — a single hardcoded file. The brief's conclusion (that
   `npm test` does not typecheck application source) holds *a fortiori*, but the field was wrong.
2. **The contract was cited with no path**, and it is not in the repo. A search of the repo for
   "prime" returns zero, correctly.

## Standing finding: the test config cannot host a new test

`web/package.json:9` — `"test": "tsc -p tsconfig.test.json && node .tmp-test/utils/task-ready.test.js"`.
Both the compile set and the executed file are hardcoded to one path, and exactly **1 test file
exists in the entire web tree**. A new test would be compiled by nothing and run by nothing.
The runner is plain `node`, so there is no DOM. Routed to a dedicated infrastructure owner; no
regression pin was written for this round and none was possible.

## Hazard: `npm run build` creates `web/dist`

`web/package.json:8` — `"build": "tsc --noEmit && vite build"`. **Running it materialises
`web/dist`**, which standing instruction forbids creating in any tree. Anyone told to "verify it
builds" will do this by reflex. `npm test` (writes `.tmp-test`) and `npx tsc --noEmit` are safe.

Likely provenance of the untracked build tree in the main working copy: **19 of 73 project-log
entries record `npm run build` as a routine verification step, 12 of them dated 2026-07-27**,
matching the mtimes on that tree; `task-state-model-phase1-test-review.md` records it with
`Worktree: /workspace` explicitly. The two-second mtime span identifies a single *final* build,
but the log shows the practice was repeated and normalised, not a one-off slip.

### `web/dist` IS ignored — a contrary report is a query artefact

A circulating corollary holds that `web/dist` is untracked **and unignored** (`check-ignore`
exits 1), and therefore that building would create thousands of *stageable* files. **Measured,
and it does not hold.** Paired control, same repo, one variable — whether the directory exists:

```
$ git -C /workspace/farmtable check-ignore -v web/dist          # dist EXISTS
.gitignore:17:dist/	web/dist                                     exit 0  -> IGNORED
$ git -C /tmp/onhold/work check-ignore -v web/dist              # dist ABSENT
                                                                 exit 1  -> "not ignored"
$ git -C /tmp/onhold/work check-ignore -v web/dist/index.html   # same absent tree
.gitignore:17:dist/	web/dist/index.html                          exit 0  -> IGNORED
```

`.gitignore:17` is `dist/` — a **trailing slash, so a directory-only pattern**. Git cannot know
`web/dist` is a directory when it does not exist on disk, so the pattern fails to match and
`check-ignore` exits 1. Querying any path *inside* it matches in **both** tree states. The
exit-1 result is an artefact of probing a directory-only pattern against a nonexistent path, not
a property of the ignore rules.

Consequences: `web/dist` contents are ignored in every tree state, which is why
`git status --porcelain web/dist` reports 0 lines in the main working copy. [DERIVED, from git's
documented handling of ignored paths] they are therefore *not* picked up by a bulk add, so the
asserted collision with the no-bulk-staging rule does not arise on these grounds. **The hazard
above is unaffected** — creating `web/dist` is prohibited outright, whatever its ignore status,
and no-bulk-staging stands on its own reasons.

Note the shape: `check-ignore` answers differently in two trees, and the deciding variable is
the very state under investigation. A tree-state probe whose own result depends on that tree
state cannot be used to classify it.

## Limits — what was not run, and which way each cuts

- **No live DOM render.** No `node_modules` in this clone; no browser test harness exists in the
  project. Would only *confirm* that the option is emitted (the `.map` is unconditional with no
  guard) — it could not overturn it.
- **No `tsc`, no build, no test execution, no vet.** No code was changed, so there was nothing to
  typecheck. **This entry reports no build, vet, test or package-count figure.**
- **Did not verify `ft-toolbar` is mounted** in the live app. Would *strengthen* "not a defect".
- **Adapter paths not examined**, though `contract.md:355` names them. Unknown direction — this
  is the one genuine gap in the four-path claim above.

All figures here are source-text counts over tracked files at `cc92735`, identical in a pristine
clone and in the built main copy at the same commit.
