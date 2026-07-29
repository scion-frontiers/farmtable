# Watcher Frontend vs. Farmtable Frontend: Adoptable Patterns

## What Each Tool Is

### Watcher
A **native macOS desktop application** (Flutter/Dart, `macos_ui` library) that provides a rich graphical interface for [beads (`bd`)](https://github.com/steveyegge/beads), a local-first, dependency-aware issue tracker. It reads directly from local `.beads` database files and features file-system watching for live updates, a bundled Go daemon (JSON-RPC 2.0 over stdin/stdout), and optional Gemini AI integration for health assessments and planning. Single-user, multi-project, offline-first.

Key technical stack: Flutter, Dart, `macos_ui`, `go_router`, JSON-RPC Go daemon, SharedPreferences for persistence, Firebase AI Logic (Vertex AI) for Gemini integration.

### Farmtable
A **web dashboard** (Lit web components, TypeScript, Shoelace UI, Vite) for managing tasks in cloud-hosted Farmtable collections via gRPC-Web streaming. Deployed on Cloud Run, multi-user, real-time. Features Kanban and Tree views, collection management, import/export, phase/assignee filtering, an inspector panel with tabs, keyboard navigation, and URL-driven routing.

Key technical stack: Lit, TypeScript, gRPC-Web (streaming), Shoelace components, Vite, Cloud Run.

---

## Ranked Adoptable Patterns

### 1. Command Palette / Global Search (Cmd+K or Cmd+P)

**What it is:** A modal overlay triggered by a keyboard shortcut that provides instant fuzzy search across all tasks. Watcher searches by ID, title, description, type, status, owner, and assignee simultaneously. Results are navigable with arrow keys, selectable with Enter, dismissable with Escape. Includes keyboard hint footer and mouse-hover selection.

**Where in Watcher:** `lib/widgets/command_palette.dart` (lines 1-590). Triggered from the sidebar's search icon button or via `Cmd+P`.

**Why it's valuable for Farmtable:** This is the single highest-impact UX pattern Farmtable is missing. Currently, finding a specific task requires scrolling the Kanban/Tree view or using the Phase/Assignee filters, which are coarse. A command palette lets users jump directly to any task by typing a few characters of its title or ID. Every modern productivity tool (VS Code, Linear, Notion, Slack) has this pattern and users expect it.

**Feasibility: Pure UI port.** All task data is already in `TaskStore.allTasks`. No backend changes needed. Implementation: a new `<ft-command-palette>` Lit component with a Shoelace `<sl-dialog>` or custom overlay, a text input, filtered list rendering, and keyboard navigation. Wire `Cmd+K` or `/` in `ft-app.ts`'s `onDocumentKeyDown`. Estimated scope: **XS-Small** (one component, one wiring point).

---

### 2. Dashboard / Summary View

**What it is:** A project-level overview page showing aggregate statistics as stat cards: Open/In Progress/Closed/Total counts, priority breakdown badges (P0-P3 with color-coded counts), and a "Readiness" card showing Ready vs. Blocked counts with tappable links to dedicated views. Also includes an AI insights panel, federation status, and a recent activity feed.

**Where in Watcher:** `lib/screens/project_dashboard.dart` (lines 1-780). The stat cards (`SimpleStatCard`, `PriorityStatCard`, `ReadinessStatCard`) are self-contained widgets.

**Why it's valuable for Farmtable:** Farmtable currently lands directly on the Kanban board when a collection is selected. There's no at-a-glance overview of project health. A dashboard would let users quickly see: how many tasks are in each phase, what the priority distribution looks like, and whether progress is being made. This is especially useful for managers or users returning to a project after time away.

**Feasibility: Pure UI (for the stat cards).** The task data needed (phase counts, priority counts) is already in the store. The readiness/blocked stats would require computing blocked status from relationships, which is a slightly larger lift (see pattern #4). A minimal dashboard with phase+priority counts is **XS**; a full one with readiness stats is **Small**.

---

### 3. Drag-and-Drop Kanban Cards

**What it is:** Kanban cards are `Draggable` widgets that can be dropped onto different columns to change status. Cards claimed by an agent are "locked" (showing a lock icon) and cannot be dragged to prevent accidental status changes to in-progress work.

**Where in Watcher:** `lib/widgets/kanban_card.dart` (lines 100-113, the `Draggable<Issue>` wrapper) and `lib/widgets/kanban_column.dart` (the `DragTarget`).

**Why it's valuable for Farmtable:** Drag-and-drop is the quintessential Kanban interaction. Farmtable has inline editing for phase changes, but moving a card between columns by dragging it is more intuitive and faster for bulk triage. The "locked" concept is also valuable — preventing accidental moves of actively-worked tasks.

**Feasibility: Pure UI + existing API.** Farmtable already has `updateTask` via gRPC and applies optimistic updates (`applyTaskUpdate` in `ft-app.ts:256-269`). The main work is adding HTML5 drag-and-drop events to `ft-task-card.ts` and `ft-kanban-column.ts`. Note: HTML5 drag-and-drop can be finicky on touch devices; a library like `@shopify/draggable` or SortableJS could help. Estimated scope: **Small-Medium**.

---

### 4. Ready Queue View

**What it is:** A flat, priority-sorted list of only the immediately actionable tasks: open or in-progress AND not blocked by any open dependency. Each row shows priority badge, type icon, ID, title, labels, an "Blocks N" badge (showing how many tasks completing this one would unblock), and an "IN PROGRESS" badge where applicable. Mirrors the `bd ready` CLI command.

**Where in Watcher:** `lib/screens/ready_queue_screen.dart` (lines 1-282). Filtering logic at lines 24-36: `status == 'open' || 'in_progress'` AND `!isBlocked(all)`.

**Why it's valuable for Farmtable:** When a project has dependency relationships between tasks, this view answers the question "what can I actually work on right now?" without manual filtering. The "Blocks N" badge is particularly powerful — it surfaces high-impact tasks that, if completed, unblock the most other work.

**Feasibility: Depends on relationship data in the store.** Farmtable already has relationship data (`ft-inspector-relationships.ts` renders parent/children/blocked-by/blocking). The question is whether the `TaskStore` makes `blockedBy` relationships queryable globally or only per-task in the inspector. If relationship data is loaded as part of each task object, this is a **Small** pure-frontend view. If relationships require per-task API calls, a new `ListBlockers` or enriched `StreamTasks` response would be needed — making this **Medium**.

---

### 5. Blocked View

**What it is:** Every blocked task listed with its open blockers shown inline as tappable links. Each row shows the blocked task's priority, title, ID, and labels, plus a "Blocked by:" section listing each blocker with its status. Clicking a blocker navigates to it. Mirrors `bd blocked`.

**Where in Watcher:** `lib/screens/blocked_screen.dart` (lines 1-313). The `_BlockerLink` widget (lines 261-313) renders each blocker as a tappable link with a status icon.

**Why it's valuable for Farmtable:** Triage companion to the Ready Queue. Shows exactly what's impeding progress and lets users quickly navigate to blockers to resolve them. Without this, users must open each blocked task's inspector individually to see what's blocking it.

**Feasibility: Same prerequisite as Ready Queue (#4).** If relationship/blocked data is globally queryable, this is a **Small** pure-frontend view.

---

### 6. Dependency Graph View

**What it is:** A list-based DAG visualization of blocking chains. Shows "root blockers" (tasks that block others but aren't themselves blocked) as collapsible chain cards, with their dependents listed underneath. Includes a summary bar showing total chain count and blocked issue count. Also shows "indirect impediments" (blocked by things that are themselves blocked). Not a canvas-drawn graph — it's a structured list with indentation.

**Where in Watcher:** `lib/screens/dependency_graph_screen.dart` (lines 1-464). Key data structures: `participantIds` (all tasks in blocks relationships), `roots` (unblocked blockers), `_ChainCard` (collapsible root → dependents), `_SummaryBar` (aggregate stats).

**Why it's valuable for Farmtable:** For projects with deep dependency trees, this view provides a structural understanding that neither Kanban nor Tree views offer. It answers "which tasks are critical-path blockers?" and "how deep are the dependency chains?"

**Feasibility: Medium-High.** Same relationship data prerequisite as #4 and #5. The view itself is more complex (computing DAG roots, traversing chains, handling cross-epic edges). Pure frontend if the data is available, but the component is substantial. Recommend implementing after Ready Queue and Blocked views to validate that the relationship data access pattern works.

---

### 7. Activity Feed / Recent Activity

**What it is:** A chronological list of recent project activity: who did what, when. Shows semantic action descriptions ("claimed", "completed", "escalated priority to P1 on", "commented on") with tappable issue links and "Unblocked N tasks!" badges when completing blockers. Capped at 20 most recent items.

**Where in Watcher:** `lib/widgets/activity_ticker.dart` (lines 1-218). Uses an `Interaction` model with actor, action, field, old/new values, timestamp, and issue ID.

**Why it's valuable for Farmtable:** Gives project-level visibility into what's happening. Farmtable already has per-task change history (`ft-inspector-changes.ts`), but no aggregate feed. Useful for teams and for returning to a project after time away.

**Feasibility: Medium — needs backend support.** Farmtable's `ft-inspector-changes.ts` fetches change history per task. A global activity feed would need either: (a) a new `ListRecentActivity` RPC that aggregates changes across all tasks, or (b) client-side aggregation by fetching recent changes for all tasks (expensive). Option (a) is the right approach but requires backend work.

---

### 8. Collapsible Inspector Sections with Persisted State

**What it is:** Each section in the inspector (Description, Notes, Design, Acceptance Criteria, Dependencies, Comments) has a collapsible disclosure header with an animated chevron. Collapse/expand state is persisted to `SharedPreferences` so it survives app restarts.

**Where in Watcher:** `lib/widgets/issue_inspector.dart`, specifically the `_CollapsibleSection` widget (lines 1030-1092) and the `_loadCollapsePrefs`/`_toggleSection` methods (lines 67-95). Persistence keys like `inspector.collapse.description`.

**Why it's valuable for Farmtable:** Farmtable's inspector already has substantial content (header, meta, description, relations, code context, comments, changes). Users who don't need to see all sections would benefit from collapsing the ones they rarely use. Persisting the state via `localStorage` means preferences survive page reloads.

**Feasibility: Pure UI + localStorage. XS.** Trivially adoptable. Add a collapsible wrapper component, wire `localStorage` get/set. The Shoelace `<sl-details>` component provides this out of the box.

---

### 9. Reusable Empty State Component

**What it is:** A standardized empty-state view with configurable icon, title, subtitle, and optional icon color. Used consistently across all screens (Kanban, Tree, Ready Queue, Blocked, Dependency Graph) to prevent visual drift.

**Where in Watcher:** `lib/widgets/empty_state_view.dart` (lines 1-61). Simple centered column with icon (48px), title (title1 typography), optional subtitle.

**Why it's valuable for Farmtable:** Farmtable has per-column empty-filter-state messages (Feature #17), but may not have a general-purpose reusable empty state for entire views. As more views are added (e.g., dashboard, ready queue), a consistent empty state prevents each view from reinventing the pattern.

**Feasibility: Pure UI. XS.** Trivial to create a `<ft-empty-state>` Lit component with icon/title/subtitle slots.

---

### 10. Expanded View Mode Switcher

**What it is:** A compact, icon-based segmented control in the toolbar for switching between 6 different views (Dashboard, Tree, Kanban, Ready Queue, Blocked, Dependency Graph). Each view is a distinct icon with a tooltip.

**Where in Watcher:** `lib/widgets/view_mode_segmented_control.dart` (lines 1-171). Uses `MacosTooltip`, per-segment tap handlers, subtle dividers between segments.

**Why it's valuable for Farmtable:** If Farmtable adopts additional views (dashboard, ready queue, blocked, graph), the current radio-button switcher (`<sl-radio-group>` with "Kanban"/"Tree" text labels) won't scale. An icon-based approach is more compact.

**Feasibility: Pure UI. XS.** Only relevant once more views are actually implemented. Don't adopt this until there are 3+ views.

---

## Considered But Not Recommended

### AI Planner / AI Assistant Insights Panel
**What it is:** Gemini integration for project health assessment, actionable recommendations (with one-click "Execute" buttons to apply changes), and goal-based plan generation with approve-and-execute flow.

**Where in Watcher:** `lib/widgets/ai_assistant_insights_panel.dart` (536 lines), `lib/widgets/planner_modal.dart` (239 lines), `lib/services/generative_ai_service.dart`, `lib/services/planner_service.dart`.

**Why not:** This is deeply tied to Watcher's Gemini/Firebase AI Logic integration and its local `bd` CLI execution model (tmux orchestration, file-based polling). Adopting this in Farmtable would require: choosing an LLM provider, building a backend AI service, designing a plan execution model compatible with gRPC-Web (not local CLI execution), and handling authentication/cost. This is a major new product surface, not a UI pattern to port. If Farmtable wants AI features, it should be designed from Farmtable's constraints, not ported from Watcher's.

### Multi-Project Sidebar (Desktop-style)
**What it is:** A persistent sidebar listing all local projects with unread-activity indicators, activity timestamps, drag-to-reorder, and one-click switching.

**Where in Watcher:** `lib/screens/home_screen.dart` (sidebar builder, lines 72-244).

**Why not:** Farmtable already has a collection picker dropdown + URL routing that suits the web paradigm. A full sidebar is a desktop pattern that would eat significant screen real estate on web. The collection picker is the web-appropriate equivalent.

### Settings Modal (Watcher-specific)
**What it is:** Extensive settings for terminal preferences, Ghostty theme, federation sync intervals, heartbeat intervals, AI model management, project reordering.

**Where in Watcher:** `lib/widgets/settings_modal.dart` (753 lines).

**Why not:** Almost entirely Watcher-specific configuration (terminal app, bd path, heartbeat interval, federation sync). Farmtable's equivalent settings needs are minimal (theme toggle already exists). No adoptable patterns here beyond what Farmtable already has.

### Federation / Peer Sync
**What it is:** Multi-peer data synchronization for distributed `bd` databases.

**Why not:** Farmtable is a centralized cloud service with a single source of truth (gRPC backend). Federation is a solution to a problem Farmtable doesn't have.

### Create Issue Modal (with Parent Epic Picker)
**What it is:** Modal for creating issues with type selection (Task/Epic/Bug), priority dropdown, title/description fields, and a parent-epic picker for child tasks.

**Where in Watcher:** `lib/widgets/create_issue_modal.dart` (253 lines).

**Why not:** Farmtable already has `ft-add-task-dialog.ts` (Feature #1) and per-column inline create (Feature #2). The parent-task picker is a nice enhancement but Farmtable's relationship model is different. This is a possible enhancement to the existing dialog, not a new pattern.

---

## Summary Recommendation

The highest-value, lowest-effort wins are:
1. **Command Palette** — immediately impactful, trivial to build
2. **Dashboard view** — project health at a glance, pure frontend
3. **Collapsible inspector sections** — UX polish, use `<sl-details>` or custom wrapper

The medium-effort views worth considering as a set:
4. **Ready Queue + Blocked views** — valuable together, depend on relationship data access in the store
5. **Drag-and-drop Kanban** — intuitive interaction, existing API supports it

The larger investments:
6. **Dependency Graph** — defer until Ready Queue/Blocked views validate the data access pattern
7. **Activity Feed** — needs backend RPC; defer unless there's backend bandwidth
