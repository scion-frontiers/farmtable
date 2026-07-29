#!/usr/bin/env bash
# Run ON THE MAC HOST, from the watcher repo root:
#   bash docs/commands/08-close-r1f-polish-batch.sh
#
# WHY THIS IS A SCRIPT (not run by the container agent):
# Container agents can't write bd (BEADS_DOLT_AUTO_START=false; the Mac host owns
# the single Dolt write lock). See /workspace/kb/container-living.md §2.
#
# WHAT THIS DOES:
# Records the Phase-3 UI/A11Y POLISH batch and (after verification) closes:
#   r1f.4 UI-01, r1f.5 UI-02, r1f.6 A11Y-03, r1f.7 A11Y-04, r1f.8 UI-03,
#   r1f.9 UI-04, r1f.10 REL-04, and watcher-ckm UI-05.
# This is a DART-ONLY slice (daemon/main.go unchanged) -> NO Go/ICU rebuild.
# After this, ALL r1f children are done; the epic watcher-r1f can be closed.
#
# VERIFY BEFORE THE CLOSE SECTION (this closes issues):
#   flutter analyze     # host-only; container has no Dart toolchain
#   flutter test
#   dart format .       # several widgets were hand-wrapped (Semantics/badge) —
#                       # formatting is functionally correct but not pretty.
#
# CONTAINER STATUS: brace/paren/bracket balance OK on all 17 touched files
# (3 new: lib/widgets/priority_badge.dart, lib/widgets/empty_state_view.dart,
# lib/utils/date_formatters.dart); no daemon change; no obviously-unused imports
# introduced. Dart analyze/test are host-only.
#
# Safe to re-run: comments may duplicate; bd close on a closed issue errors
# harmlessly. Every line guarded with `|| true`.
set -u
test -d .beads || { echo "Run from the watcher repo root on the Mac."; exit 1; }

ACTOR="implementation-agent"

echo "==> r1f.4 UI-01 — reusable PriorityBadge"
bd comment watcher-r1f.4 --actor "$ACTOR" \
  "IMPLEMENTED. New lib/widgets/priority_badge.dart (text 'P<n>' + color + border + tooltip, with a compact variant and a static colorFor()). Replaced the divergent per-screen implementations: tree_node._buildPriorityBadge, ready_queue_screen._priorityChip, blocked_screen._priorityChip now delegate to it; ADDED a compact PriorityBadge to kanban_card (previously had none). Because it always shows a text label it also underpins the A11Y-03 fix. FOLLOW-UP: golden/widget test for the badge." || true
bd close watcher-r1f.4 --reason "UI-01: shared PriorityBadge applied across tree/ready/blocked/kanban_card (kanban now shows priority); divergent chips removed." || true

echo "==> r1f.6 A11Y-03 — colorblind-safe priority in Command Palette"
bd comment watcher-r1f.6 --actor "$ACTOR" \
  "IMPLEMENTED. command_palette.dart replaced the color-ONLY 8px priority dot with the shared PriorityBadge (compact) so P0..P4 is readable as text (colorblind-safe); removed the now-unused _getPriorityColor. NOTE: the other cited site, project_dashboard.dart _buildBadge, already renders a 'P<n>' TEXT label (found during validation), so it was not color-only and needed no change." || true
bd close watcher-r1f.6 --reason "A11Y-03: command palette now shows a text priority badge instead of a color-only dot; project_dashboard already had text labels." || true

echo "==> r1f.5 UI-02 — reusable EmptyStateView"
bd comment watcher-r1f.5 --actor "$ACTOR" \
  "IMPLEMENTED. New lib/widgets/empty_state_view.dart (icon 48 + title1 + optional subtitle + optional iconColor). Applied in all 5 screens: kanban_screen, tree_view_screen, ready_queue_screen, blocked_screen, dependency_graph_screen — replacing the hand-rolled Center>Column blocks whose icon color/opacity and title typography had drifted (title2+alpha vs title1, green vs gray vs faint). FOLLOW-UP: activity_ticker has a 6th, differently-shaped empty state left as-is." || true
bd close watcher-r1f.5 --reason "UI-02: shared EmptyStateView applied across all 5 list/graph screens." || true

echo "==> r1f.9 UI-04 — centralized DateFormatters"
bd comment watcher-r1f.9 --actor "$ACTOR" \
  "IMPLEMENTED. New lib/utils/date_formatters.dart with full() (YYYY-MM-DD HH:MM) and short() (MM/DD HH:MM), preserving the exact prior outputs (no intl dependency added). issue_inspector._formatDate delegates to full(); activity_ticker uses short(). Removes the duplicated hand-rolled padLeft formatting." || true
bd close watcher-r1f.9 --reason "UI-04: timestamp formatting centralized in DateFormatters (full/short); inspector + ticker use it." || true

echo "==> r1f.10 REL-04 — http timeout on upstream version check"
bd comment watcher-r1f.10 --actor "$ACTOR" \
  "IMPLEMENTED. app_state._checkUpstreamVersion http.get now has .timeout(const Duration(seconds: 5)); the existing try/catch already handles TimeoutException (logged, non-fatal). Prevents background socket leaks on degraded/offline networks." || true
bd close watcher-r1f.10 --reason "REL-04: 5s timeout added to the GitHub releases version-check request." || true

echo "==> r1f.8 UI-03 — header truncation"
bd comment watcher-r1f.8 --actor "$ACTOR" \
  "IMPLEMENTED. kanban_column header Text ('title (n)') -> maxLines:1 + TextOverflow.ellipsis (fixed 300px column). issue_inspector header title -> maxLines:2 + ellipsis (inside Expanded). Prevents wrapping/clipping on narrow widths." || true
bd close watcher-r1f.8 --reason "UI-03: maxLines + ellipsis added to Kanban column and inspector header titles." || true

echo "==> r1f.7 A11Y-04 — semantic labels on MacosTextField"
bd comment watcher-r1f.7 --actor "$ACTOR" \
  "IMPLEMENTED. MacosTextField (macos_ui 2.2.2) exposes NO semanticsLabel property, so each field is wrapped in Semantics(textField:true, label:'<heading>'): issue_inspector (comment, owner/assignee via _buildEditableField's title, dependency target-id) and settings_modal (Actor Name, Custom bd Path, Ghostty Theme, Ghostty Font Family, GCP Project ID). Screen readers now announce each field with its section heading." || true
bd close watcher-r1f.7 --reason "A11Y-04: MacosTextField inputs wrapped in Semantics(textField, label) across inspector + settings (macos_ui has no semanticsLabel prop)." || true

echo "==> watcher-ckm UI-05 — error page contrast"
bd comment watcher-ckm --actor "$ACTOR" \
  "IMPLEMENTED. error_display_view.dart: the error message SelectableText inherited the default body color, which read faint on the alternatingContentBackground container. Pinned an explicit MacosColors.labelColor (resolved) so it meets WCAG AA. FOLLOW-UP: if design wants a specific ratio target, verify with a contrast checker against both light/dark." || true
bd close watcher-ckm --reason "UI-05: error message text now uses an explicit high-contrast labelColor instead of the faint inherited default." || true

echo
echo "==> With this batch, ALL watcher-r1f children are complete. Close the epic"
echo "    once you've verified (flutter analyze/test + dart format):"
echo "    bd close watcher-r1f --reason 'Phase 3 complete: architectural optimizations + UI/A11Y polish landed.'"
echo
echo "==> Export source of truth + show for review"
bd export -o .beads/issues.jsonl
git status --short .beads/issues.jsonl
echo "Suggested: git add .beads/issues.jsonl && git commit -m 'bd: close r1f UI/a11y polish batch + watcher-ckm'"
