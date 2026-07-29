import 'package:flutter/cupertino.dart';
import 'package:macos_ui/macos_ui.dart';
import '../main.dart';
import '../state/app_state.dart';
import 'label_chip.dart';

/// A funnel-icon toolbar trigger that opens a fuzzy-searchable Label Picker
/// popover — modeled directly on beads_viewer's `pkg/ui/label_picker.go` (see
/// docs/LABEL_AND_FEATURE_COMPARISON_beads_viewer.md), independently
/// reimplemented per that doc's licensing note. Type-to-fuzzy-filter every
/// known label, sorted by issue count descending, with inline count badges.
///
/// DEVIATION NOTE: the task called for a `MacosPopover` widget, but macos_ui
/// (pinned to ^2.2.2, the latest version published as of this writing) has
/// never shipped one. This implements an equivalent anchored panel directly
/// with `OverlayEntry`, which is the standard Flutter idiom for popover-style
/// UI in packages that don't provide a dedicated popover widget.
class LabelPickerButton extends StatefulWidget {
  const LabelPickerButton({super.key});

  @override
  State<LabelPickerButton> createState() => _LabelPickerButtonState();
}

class _LabelPickerButtonState extends State<LabelPickerButton> {
  OverlayEntry? _entry;

  void _toggle() {
    if (_entry != null) {
      _close();
    } else {
      _open();
    }
  }

  void _open() {
    final renderBox = context.findRenderObject() as RenderBox?;
    if (renderBox == null || !renderBox.attached) return;
    final buttonPos = renderBox.localToGlobal(Offset.zero);
    final buttonSize = renderBox.size;
    final screenSize = MediaQuery.of(context).size;
    const panelWidth = 280.0;

    final left = (buttonPos.dx + buttonSize.width - panelWidth).clamp(
      8.0,
      screenSize.width - panelWidth - 8.0,
    );
    final top = buttonPos.dy + buttonSize.height + 6;

    final overlay = Overlay.of(context);
    _entry = OverlayEntry(
      builder: (overlayContext) => Stack(
        children: [
          // Transparent barrier: tapping outside the panel dismisses it.
          Positioned.fill(
            child: GestureDetector(
              behavior: HitTestBehavior.translucent,
              onTap: _close,
            ),
          ),
          Positioned(
            left: left,
            top: top,
            width: panelWidth,
            child: _LabelPickerPanel(onClose: _close),
          ),
        ],
      ),
    );
    overlay.insert(_entry!);
    setState(() {});
  }

  void _close() {
    _entry?.remove();
    _entry = null;
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    _entry?.remove();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    // NOTE: [ToolBarIconButton] extends macos_ui's internal `ToolbarItem`
    // (not `Widget`), so it can only be placed directly in a `ToolBar.actions`
    // list — it can't be built from an arbitrary widget's build() method.
    // This button is instead embedded via `CustomToolbarItem` (see each
    // screen's ToolBar wiring), so it replicates ToolBarIconButton's visual
    // styling (MacosIconButton + MacosTooltip, showLabel: false shape)
    // directly with plain widgets.
    return ListenableBuilder(
      listenable: appState,
      builder: (context, _) {
        final brightness = MacosTheme.of(context).brightness;
        return MacosTooltip(
          message: appState.hasActiveLabelFilters
              ? 'Filter by Label (active)'
              : 'Filter by Label',
          child: MacosIconButton(
            icon: MacosIcon(
              CupertinoIcons.line_horizontal_3_decrease_circle,
              size: 20,
              color: appState.hasActiveLabelFilters
                  ? MacosTheme.of(context).primaryColor
                  : brightness.resolve(
                      const Color.fromRGBO(0, 0, 0, 0.5),
                      const Color.fromRGBO(255, 255, 255, 0.5),
                    ),
            ),
            boxConstraints: const BoxConstraints(
              minHeight: 26,
              minWidth: 20,
              maxWidth: 48,
              maxHeight: 38,
            ),
            padding: const EdgeInsets.symmetric(horizontal: 12.0),
            onPressed: _toggle,
          ),
        );
      },
    );
  }
}

class _LabelPickerPanel extends StatefulWidget {
  final VoidCallback onClose;

  const _LabelPickerPanel({required this.onClose});

  @override
  State<_LabelPickerPanel> createState() => _LabelPickerPanelState();
}

class _LabelPickerPanelState extends State<_LabelPickerPanel> {
  final _queryController = TextEditingController();
  String _query = '';

  @override
  void dispose() {
    _queryController.dispose();
    super.dispose();
  }

  /// fzf-style scoring, simplified from beads_viewer's `fuzzyScore()`:
  /// exact > prefix > substring > subsequence. Returns null (excluded) when
  /// [query] isn't even a subsequence of [label].
  int? _fuzzyScore(String label, String query) {
    if (query.isEmpty) return 0;
    final l = label.toLowerCase();
    final q = query.toLowerCase();
    if (l == q) return 1000;
    if (l.startsWith(q)) return 500;
    if (l.contains(q)) return 250;

    // Subsequence check: every character of q appears in order within l.
    var qi = 0;
    for (var li = 0; li < l.length && qi < q.length; li++) {
      if (l[li] == q[qi]) qi++;
    }
    return qi == q.length ? 100 : null;
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: appState,
      builder: (context, _) {
        final theme = MacosTheme.of(context);
        final counts = <String, int>{};
        for (final issue in appState.currentIssues) {
          for (final label in issue.labels ?? const <String>[]) {
            counts[label] = (counts[label] ?? 0) + 1;
          }
        }

        final entries = appState.allKnownLabels
            .map((label) => (label: label, score: _fuzzyScore(label, _query)))
            .where((e) => e.score != null)
            .toList()
          ..sort((a, b) {
            final scoreCmp = b.score!.compareTo(a.score!);
            if (scoreCmp != 0) return scoreCmp;
            final countCmp = (counts[b.label] ?? 0).compareTo(
              counts[a.label] ?? 0,
            );
            if (countCmp != 0) return countCmp;
            return a.label.compareTo(b.label);
          });

        return MacosOverlayFilterPanelChrome(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(10, 8, 6, 6),
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        'Filter by Label',
                        style: theme.typography.headline,
                      ),
                    ),
                    MacosIconButton(
                      icon: const MacosIcon(
                        CupertinoIcons.xmark_circle,
                        size: 16,
                        color: MacosColors.systemGrayColor,
                      ),
                      onPressed: widget.onClose,
                    ),
                  ],
                ),
              ),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 10),
                child: MacosTextField(
                  controller: _queryController,
                  placeholder: 'Type to search labels…',
                  autofocus: true,
                  maxLines: 1,
                  onChanged: (v) => setState(() => _query = v),
                ),
              ),
              const SizedBox(height: 6),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 10),
                child: Text(
                  'Click a label to OR-filter. Use AND/NOT for stricter '
                  'combinations.',
                  style: theme.typography.footnote.copyWith(
                    color: MacosColors.systemGrayColor,
                    fontSize: 10,
                  ),
                ),
              ),
              const SizedBox(height: 4),
              ConstrainedBox(
                constraints: const BoxConstraints(maxHeight: 280),
                child: entries.isEmpty
                    ? Padding(
                        padding: const EdgeInsets.all(16),
                        child: Text(
                          'No matching labels.',
                          style: theme.typography.footnote.copyWith(
                            color: MacosColors.systemGrayColor,
                          ),
                        ),
                      )
                    : ListView.builder(
                        shrinkWrap: true,
                        padding: const EdgeInsets.symmetric(vertical: 4),
                        itemCount: entries.length,
                        itemBuilder: (context, index) {
                          final label = entries[index].label;
                          return _LabelPickerRow(
                            label: label,
                            count: counts[label] ?? 0,
                          );
                        },
                      ),
              ),
              const SizedBox(height: 6),
            ],
          ),
        );
      },
    );
  }
}

/// One row in the picker: the label + issue count, plus three small buttons
/// to add it to the AND / OR / EXCLUDE filter sets — an explicit, discoverable
/// alternative to shift-click/right-click modifiers for the same semantics.
class _LabelPickerRow extends StatelessWidget {
  final String label;
  final int count;

  const _LabelPickerRow({required this.label, required this.count});

  @override
  Widget build(BuildContext context) {
    final theme = MacosTheme.of(context);
    final inAll = appState.labelFiltersAll.contains(label);
    final inAny = appState.labelFiltersAny.contains(label);
    final inExclude = appState.labelFiltersExclude.contains(label);

    return GestureDetector(
      // Default single-click action: OR-filter (bv's default behavior).
      onTap: () => appState.toggleLabelFilter(label, LabelFilterMode.any),
      child: MouseRegion(
        cursor: SystemMouseCursors.click,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
          color: inAny
              ? theme.primaryColor.withValues(alpha: 0.08)
              : const Color(0x00000000),
          child: Row(
            children: [
              Expanded(
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Flexible(child: LabelChip(label: label, compact: true)),
                    const SizedBox(width: 6),
                    Text(
                      '($count)',
                      style: theme.typography.footnote.copyWith(
                        color: MacosColors.systemGrayColor,
                        fontSize: 10,
                      ),
                    ),
                  ],
                ),
              ),
              _modeButton(
                context,
                label: 'AND',
                tooltip: 'Require this label (AND)',
                active: inAll,
                onTap: () =>
                    appState.toggleLabelFilter(label, LabelFilterMode.all),
              ),
              const SizedBox(width: 4),
              _modeButton(
                context,
                label: 'NOT',
                tooltip: 'Exclude this label',
                active: inExclude,
                onTap: () => appState.toggleLabelFilter(
                  label,
                  LabelFilterMode.exclude,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _modeButton(
    BuildContext context, {
    required String label,
    required String tooltip,
    required bool active,
    required VoidCallback onTap,
  }) {
    final theme = MacosTheme.of(context);
    final color = active ? theme.primaryColor : MacosColors.systemGrayColor;
    return MacosTooltip(
      message: tooltip,
      child: GestureDetector(
        onTap: onTap,
        child: MouseRegion(
          cursor: SystemMouseCursors.click,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
            decoration: BoxDecoration(
              color: color.withValues(alpha: active ? 0.2 : 0.0),
              borderRadius: BorderRadius.circular(3),
              border: Border.all(color: color.withValues(alpha: 0.4)),
            ),
            child: Text(
              label,
              style: TextStyle(
                fontSize: 8,
                fontWeight: FontWeight.bold,
                color: color,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Shared visual chrome (background/border/shadow) for the overlay panel,
/// styled to match the app's existing floating-panel look (command palette).
class MacosOverlayFilterPanelChrome extends StatelessWidget {
  final Widget child;

  const MacosOverlayFilterPanelChrome({super.key, required this.child});

  @override
  Widget build(BuildContext context) {
    final theme = MacosTheme.of(context);
    return Container(
      decoration: BoxDecoration(
        color: MacosDynamicColor.resolve(
          theme.brightness.isDark
              ? MacosColors.alternatingContentBackgroundColor
              : MacosColors.controlBackgroundColor,
          context,
        ),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: theme.dividerColor),
        boxShadow: const [
          BoxShadow(
            color: Color(0x40000000),
            blurRadius: 16,
            offset: Offset(0, 6),
          ),
        ],
      ),
      child: child,
    );
  }
}
