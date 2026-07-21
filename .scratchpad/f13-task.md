# Feature 13: Active Filter Chips

## Branch
You are on branch `feat/filter-chips` in /workspace/farmtable.

## Read First
- web/src/components/task-filters.ts
- web/src/components/ft-toolbar.ts  
- web/src/components/ft-app.ts
- web/src/components/inspector/ft-inspector-meta.ts (sl-tag pattern)
- web/src/gen/types.ts (TaskPhase enum, User type)

## Step 1: Create web/src/components/ft-filter-chips.ts

LitElement component `<ft-filter-chips>` with props:
- `phaseFilter: TaskPhase | null`
- `assigneeFilter: string | null`  
- `users: User[]`

Behavior:
- When no filters active → render `nothing` from lit
- Phase chip: "Phase: Open ×" etc. Map: OPEN→"Open", IN_PROGRESS→"In Progress", ON_HOLD→"On Hold", CLOSED→"Closed"
- Assignee chip: "Assignee: Alice ×". For value `__unassigned` show "Assignee: Unassigned". Else look up user name from users array.
- Use `<sl-tag size="small" removable>` for chips (same pattern as inspector-meta.ts)
- "Clear all" chip/button: only when 2+ filters active
- Dispatch `filter-clear` events with `TaskFilterChangeDetail` shape from task-filters.ts

## Step 2: Wire into ft-app.ts

- Import ft-filter-chips.ts
- Place between `<ft-toolbar>` and `<div class="content">` in render()
- Add `@state() private users: User[] = []` to ft-app, load via client.listUsers() when client ready
- Pass .phaseFilter, .assigneeFilter, .users
- Listen @filter-clear → update phaseFilter and assigneeFilter

## Step 3: Build
```bash
cd /workspace/farmtable/web && npm run build
```

## Step 4: Screenshots
```bash
export PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium
```
Playwright at /scion-volumes/scratchpad/web-test/node_modules

Capture 4 screenshots to /scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-13-filter-chips/:
- 01-no-filters.png (no chip row)
- 02-one-filter-chip.png (Phase:Open chip, no Clear all)
- 03-two-filters-clear-all.png (both chips + Clear all)
- 04-post-clear.png (after Clear all, no chips)

## Step 5: Project Log
Write to /scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-13-filter-chips.md

## Step 6: Commit
```bash
git add -A && git commit -m "feat: add active filter chips with clear-all action"
```
