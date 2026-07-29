# Feature 32 — Dashboard / Summary View (Minimal)

## Summary

Added a minimal dashboard/summary view to the Farmtable web frontend. The dashboard displays a project-level overview with phase stat cards and priority breakdown badges. It is accessible via the toolbar view switcher alongside the existing Kanban and Tree views.

## What Was Built

### New Component: `ft-dashboard-view`
- **Phase stat cards** — A row of five cards showing task counts per phase: Open, In Progress, On Hold, Closed, and Total. The Total card is visually distinguished with a primary-color accent.
- **Priority breakdown badges** — Color-coded Shoelace `<sl-badge>` elements showing counts for each priority level: Urgent (red/danger), High (orange/warning), Normal (blue/primary), Low (gray/neutral), and No priority (neutral).
- **Empty state** — Shows `<ft-empty-state>` with a bar-chart icon when no tasks exist.
- **Reactive updates** — Uses `TaskStoreController` to automatically recompute stats when tasks are added, removed, or updated.

### Shared Priority Utilities
- Extracted `PRIORITY_VARIANT` and `PRIORITY_LABEL` maps from `ft-inspector-header.ts` into `web/src/util/priority-utils.ts` to eliminate duplication. Both the inspector header and dashboard now import from this shared module.

### Toolbar Integration
- Added a third radio button to the view switcher with the `bar-chart-line` Bootstrap Icon, wrapped in `<sl-tooltip content='Dashboard view'>` with appropriate `aria-label`.
- Task filters (phase/assignee) are disabled when the dashboard is active, consistent with the tree view behavior.

### App Routing
- Updated `ft-app.ts` to handle `?view=dashboard` in the URL.
- The `currentView` type was widened to `'kanban' | 'tree' | 'dashboard'` across toolbar and app components.
- Kanban remains the default view.

## Files Changed

| File | Change |
|------|--------|
| `web/src/util/priority-utils.ts` | **New** — Shared PRIORITY_VARIANT and PRIORITY_LABEL maps |
| `web/src/components/ft-dashboard-view.ts` | **New** — Dashboard summary view component |
| `web/src/components/ft-toolbar.ts` | Added dashboard radio button; disabled filters for dashboard view |
| `web/src/components/ft-app.ts` | Added dashboard import, routing, and view rendering |
| `web/src/components/inspector/ft-inspector-header.ts` | Refactored to import priority maps from shared utility |

## Design Decisions

- **Card layout over charts** — Used simple stat cards with large count numbers rather than charts/graphs. This keeps the implementation minimal, dependency-free, and accessible. Charts can be added in a follow-up.
- **Shared priority utilities** — Extracted the duplicated priority maps into a shared module rather than leaving them co-located in the inspector header. This follows the existing pattern of `web/src/util/` for cross-cutting utilities.
- **`bar-chart-line` icon** — Chosen over `speedometer2` because it more clearly conveys "statistics/dashboard" at small sizes in the radio button group.
- **No task filtering on dashboard** — The dashboard always shows ALL tasks to provide a complete project overview. Filters are disabled (grayed out) when dashboard is active.

## Deferred Work

Readiness stats (Ready vs. Blocked counts) are deferred — they require relationship-queryability work being investigated in Feature 34. A follow-up feature can add a readiness card once Feature 34 lands the needed data access pattern.

## Screenshots

- `dashboard-stats.png` — Dashboard view showing phase stat cards and priority badges with mock data
- `dashboard-view-switcher.png` — Toolbar view switcher showing all three icons (Kanban, Tree, Dashboard)

Saved to: `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-32-dashboard/`

## Verification

- `npm run build` passes with zero TypeScript and Vite errors
- Screenshots confirm correct rendering of stat cards, priority badges, and view switcher
