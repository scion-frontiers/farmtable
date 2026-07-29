import 'package:flutter/cupertino.dart';
import 'package:macos_ui/macos_ui.dart';
import '../main.dart';
import '../state/app_state.dart';
import 'label_chip.dart';

/// A row of active label-filter chips, shown between the `ToolBar` and
/// `ContentArea` on every screen that supports label filtering — only when
/// [AppState.hasActiveLabelFilters] is true (renders nothing otherwise, so
/// each screen only needs to add a single `FilterChipBar()` line to its
/// layout regardless of whether filters are currently active).
///
/// Per GEMINI.md's ToolBar `RenderFlex`-overflow guidance, this deliberately
/// lives in its own row rather than being crammed into `ToolBar.actions`.
class FilterChipBar extends StatelessWidget {
  const FilterChipBar({super.key});

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: appState,
      builder: (context, _) {
        if (!appState.hasActiveLabelFilters) return const SizedBox.shrink();
        final theme = MacosTheme.of(context);
        return Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          decoration: BoxDecoration(
            border: Border(bottom: BorderSide(color: theme.dividerColor)),
          ),
          child: Wrap(
            crossAxisAlignment: WrapCrossAlignment.center,
            spacing: 6,
            runSpacing: 4,
            children: [
              ...appState.labelFiltersAll.map(
                (l) => _buildFilterChip(context, l, LabelFilterMode.all),
              ),
              ...appState.labelFiltersAny.map(
                (l) => _buildFilterChip(context, l, LabelFilterMode.any),
              ),
              ...appState.labelFiltersExclude.map(
                (l) => _buildFilterChip(context, l, LabelFilterMode.exclude),
              ),
              GestureDetector(
                onTap: appState.clearLabelFilters,
                child: MouseRegion(
                  cursor: SystemMouseCursors.click,
                  child: Text(
                    'Clear all',
                    style: theme.typography.footnote.copyWith(
                      color: theme.primaryColor,
                      decoration: TextDecoration.underline,
                      decorationColor: theme.primaryColor.withValues(
                        alpha: 0.5,
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildFilterChip(
    BuildContext context,
    String label,
    LabelFilterMode mode,
  ) {
    final theme = MacosTheme.of(context);
    final prefix = switch (mode) {
      LabelFilterMode.all => 'AND',
      LabelFilterMode.any => 'OR',
      LabelFilterMode.exclude => 'NOT',
    };
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          prefix,
          style: theme.typography.footnote.copyWith(
            fontSize: 9,
            fontWeight: FontWeight.bold,
            color: MacosColors.systemGrayColor,
          ),
        ),
        const SizedBox(width: 3),
        LabelChip(
          label: label,
          compact: true,
          onRemove: () => appState.toggleLabelFilter(label, mode),
        ),
      ],
    );
  }
}
