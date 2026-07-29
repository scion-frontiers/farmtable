# Proposal: Visualizing the Dependency Hierarchy

_Generated 2026-06-29. A review of how Watcher visualizes issue relationships, benchmarked
against real-world `bd` usage in the sister project `read-aloud`, with a prioritized set of
proposed improvements. No app code changed as part of this review._

## 1. The reality of the data model

`bd` issue graphs are **two overlapping layers**, confirmed by the `read-aloud` project:

1. **Parent-child tree** — the *organizational* hierarchy (epic → task → subtask). In
   `read-aloud`: `89j` epic with children `89j.2 … 89j.6`.
2. **`blocks` DAG** — the *execution-ordering* graph that **crosses tree branches**. In
   `read-aloud`, `ijo.3` (under epic `ijo`) is blocked by `89j.3` (under epic `89j`). These
   edges are what `bd ready` and `bd blocked` are computed from — the single most important
   workflow signal in a dependency-aware tracker.

There are four dependency types in play: `parent-child`, `blocks`, `related`, `discovered-from`.

**Watcher renders layer 1 fully (the tree view) and layer 2 almost not at all.**

### Canonical edge direction (verified against `bd blocked`)
A dependency stored on issue **X** as `{depends_on_id: Y, type: blocks}` means **“X is blocked
by Y”** — Y must close before X is actionable. Verified: `ijo.3` carries `depends_on=89j.3`
and `bd blocked` reports *“ijo.3: Blocked by [89j.3]”*. An issue is **blocked** if it has at
least one `blocks` dependency whose target issue is **not closed**; otherwise it is **ready**.

## 2. Current-state inventory

| Surface | parent-child | blocks | related | discovered-from | dep counts |
|---|---|---|---|---|---|
| Tree view | ✅ full | ❌ | ❌ | ❌ | ❌ |
| Inspector | ❌ no parent/child section | ⚠️ present but **inverted** | ❌ | ❌ | ❌ |
| Kanban | ❌ | ❌ | ❌ | ❌ | ❌ |
| Dashboard | ❌ | ❌ | ❌ | ❌ | ❌ |
| Activity ticker | ❌ | ✅ transient “Unblocked N!” on close | ❌ | ❌ | ❌ |
| Model (`issue.dart`) | ✅ | ❌ | ❌ | ❌ | parsed, unused |

Key consequence: **on the primary surfaces (tree, kanban, dashboard) a blocked issue is
visually identical to an actionable one.** The concept of "what can I work on now" — the entire
point of `bd ready` — is absent from the GUI.

## 3. Findings (most → least severe)

**F1 — No "ready vs blocked" concept anywhere.** The app never computes whether an issue is
actionable. This is the biggest gap: a dependency-aware tracker that doesn't show readiness is
just a list with indentation.

**F2 — Inspector blocks direction is inverted (correctness bug).**
`issue_inspector.dart:163-179`: the issue's own `blocks` deps (`dependsOnId`) are labeled
**"Blocks"**, and the reverse lookup is labeled **"Blocked By"**. Per the verified canonical
direction these are **swapped** — what the inspector calls "Blocks" is really "Blocked By".
Every future visualization built on this code would inherit the inversion.

**F3 — Parent/child links are absent from the inspector.** The tree shows hierarchy, but when
an issue is selected there is no "Parent:" / "Children:" section. Selecting a deeply nested
task gives no upward context.

**F4 — `related` and `discovered-from` are completely invisible** (0 usages in `lib/`).
`discovered-from` is emphasized in `AGENTS.md` as the standard way agents link follow-up work;
that provenance is lost in the GUI.

**F5 — `dependencyCount` / `dependentCount` are parsed but never displayed.** Free signal,
unused.

**F6 — No way to create/edit non-parent-child links.** Drag-and-drop only sets a parent
(`tree_node.dart:105`). Issue creation hardcodes `parent-child` (`beads_service.dart`). Blocks
relationships can only be made via the CLI.

**F7 — The `GraphNode` model is dead** (`issue.dart:68-85`, `beads_service.dart` `getGraph()`
returns empty wrappers) — vestige of an intended graph view that was never built.

## 4. Proposed changes (prioritized)

### P1 — Model foundation: readiness + correct direction
- Add an `IssueDependencies` extension (sibling to `IssueHierarchy`) with, computed against the
  in-memory issue list:
  - `List<Issue> blockers(all)` — open issues that block this one (this issue's `blocks` deps
    whose target is not closed).
  - `List<Issue> blocking(all)` — issues this one blocks (reverse lookup).
  - `bool get isBlocked => blockers(all).isNotEmpty`.
- Unit-test the direction explicitly against the `read-aloud` example to lock semantics
  (`ijo.3` is blocked-by `89j.3`, not the reverse).
- This is the keystone; every UI change below consumes it.

### P1 — Fix + expand the inspector
- Correct the inverted "Blocks"/"Blocked By" labels (F2).
- Add a **Hierarchy** section: clickable **Parent** and **Children** (we already compute these
  in `IssueHierarchy`).
- Show **`related`** and **`discovered-from`** links (F4) — discovered-from rendered as
  "Discovered from →" provenance.
- Render a blocker's status inline (e.g. dim/strike closed blockers) so it's clear which
  blockers are still live.

### P2 — Surface readiness on the primary views
- **Kanban card badge**: red "⛔ Blocked by N" when `isBlocked`, subtle "Ready" affordance
  otherwise (`kanban_card.dart` — add below the type badge). Optionally dim blocked cards.
- **Tree node indicator**: a small blocker pip/count on rows that are blocked
  (`tree_node.dart:_buildIssueRow`), distinct from the existing `status=='blocked'` badge
  (which only reflects the literal status string, not computed blockage).
- **Dashboard stat cards**: add **Ready** and **Blocked** counts next to the existing
  status/priority cards (`project_dashboard.dart`) — the at-a-glance "what's actionable" number.

### P2 — Make counts visible
- Surface `dependencyCount`/`dependentCount` (or the locally computed equivalents) as small
  affordances on cards/rows (e.g. "↓2 ↑1") so high-leverage hub issues are visible (F5).

### P3 — A real dependency graph view
- Replace the dead `GraphNode` path with an actual DAG view (new screen alongside
  Tree/Kanban/Dashboard) showing `blocks` edges across the tree — the thing `read-aloud`'s
  structure actually demands. Larger effort; revisit after P1/P2 land. Could lean on the
  existing `bd graph`/`dep tree` output rather than a from-scratch layout engine.

### P3 — Author dependencies from the UI
- Inspector "＋ Add dependency" (pick type + target), and/or modifier-drag in the tree to
  create a `blocks` edge instead of reparenting (F6).

## 5. Suggested sequencing
1. P1 model extension + direction unit tests (small, unblocks everything).
2. P1 inspector fix/expansion (high value, contained).
3. P2 kanban + dashboard readiness (highest visible payoff).
4. P2 counts.
5. P3 graph view and dependency authoring (larger, separate epic).
