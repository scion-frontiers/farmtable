# B7: UI Read-Only Mode for External Collections

When the active collection has a platform other than `Platform.FARMTABLE`
(i.e., it comes from GitHub, Linear, Jira, Asana, or Beads), all write
controls in the web dashboard are now disabled and a visual "Read-only" badge
with a lock icon is displayed in the toolbar. Farmtable-native collections
continue to work normally with full edit access.

## Approach

`ft-app` loads the current collection metadata via
`unscopedClient.getCollection()` and exposes a computed `isReadOnly` getter
(`platform !== Platform.FARMTABLE`). This boolean is passed down the component
tree through Lit's `?readOnly` attribute binding.

## Components modified (10 files)

| Component | Change |
|---|---|
| `ft-app` | Loads collection, computes `isReadOnly`, passes down, guards `onTaskUpdate` |
| `ft-toolbar` | Renders "Read-only" badge with lock icon when readOnly |
| `ft-kanban-view` | Hides "Add Task" button, guards stage-change and task-update handlers |
| `ft-kanban-column` | Guards drag-and-drop handlers, hides per-column add-task button |
| `ft-task-card` | Disables dragging, guards title/priority editing, hides edit buttons |
| `ft-inspector` | Passes readOnly to header, meta, and description sub-components |
| `ft-inspector-header` | Shows static priority badge instead of editable button |
| `ft-inspector-meta` | Guards all edit handlers, hides add buttons, makes tags non-removable |
| `ft-inspector-desc` | Guards edit, hides pencil icons, disables click/dblclick-to-edit |
| `ft-tree-view` | Guards drag-start handlers to prevent reparenting |

## Verification

- `cd web && ./node_modules/.bin/tsc --noEmit` — compiles cleanly
- Manual: open an external collection (GitHub/Linear) → all write controls
  disabled, "Read-only" badge visible
- Manual: switch to a Farmtable collection → full edit access restored
