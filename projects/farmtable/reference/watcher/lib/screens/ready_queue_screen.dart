import 'package:flutter/cupertino.dart';
import 'package:macos_ui/macos_ui.dart';
import '../main.dart';
import '../models/issue.dart';
import '../widgets/view_mode_segmented_control.dart';
import '../widgets/error_display_view.dart';
import '../widgets/priority_badge.dart';
import '../widgets/label_chip.dart';
import '../widgets/empty_state_view.dart';
import '../widgets/label_picker.dart';
import '../widgets/filter_chip_bar.dart';

/// A flat, priority-sorted list of actionable issues — open or in-progress
/// and not blocked by any open dependency. Mirrors `bd ready`.
class ReadyQueueScreen extends StatelessWidget {
  const ReadyQueueScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: appState,
      builder: (context, _) {
        final all = appState.filteredIssues;
        final ready =
            all
                .where(
                  (i) =>
                      (i.status == 'open' || i.status == 'in_progress') &&
                      !i.isBlocked(all),
                )
                .toList()
              ..sort((a, b) {
                final p = a.priority.compareTo(b.priority);
                if (p != 0) return p;
                return a.title.compareTo(b.title);
              });

        return MacosScaffold(
          toolBar: ToolBar(
            leading: MacosIconButton(
              icon: const MacosIcon(CupertinoIcons.sidebar_left),
              onPressed: () => MacosWindowScope.of(context).toggleSidebar(),
            ),
            title: Text(
              appState.selectedProject != null
                  ? '${appState.selectedProject!.name} — Ready Queue'
                  : 'Ready Queue',
            ),
            actions: [
              CustomToolbarItem(
                inToolbarBuilder: (context) => const LabelPickerButton(),
              ),
              ToolBarIconButton(
                label: 'Toggle Inspector',
                icon: const MacosIcon(CupertinoIcons.sidebar_right),
                showLabel: false,
                tooltipMessage: 'Toggle Inspector',
                onPressed: () =>
                    MacosWindowScope.maybeOf(context)?.toggleEndSidebar(),
              ),
              CustomToolbarItem(
                inToolbarBuilder: (context) => const Padding(
                  padding: EdgeInsets.symmetric(horizontal: 8),
                  child: ViewModeSegmentedControl(currentRoute: '/ready'),
                ),
              ),
            ],
          ),
          children: [
            ContentArea(
              builder: (context, scrollController) => Column(
                children: [
                  const FilterChipBar(),
                  Expanded(
                    child: _buildBody(context, scrollController, ready, all),
                  ),
                ],
              ),
            ),
          ],
        );
      },
    );
  }
}

Widget _buildBody(
  BuildContext context,
  ScrollController scrollController,
  List<Issue> ready,
  List<Issue> all,
) {
  if (appState.selectedProject == null) {
    return const Center(child: Text('No project selected.'));
  }
  if (appState.error != null) {
    return ErrorDisplayView(
      error: appState.error!,
      onRetry: () {
        if (appState.selectedProject != null) {
          appState.selectProject(appState.selectedProject!);
        }
      },
    );
  }
  if (appState.isLoading) {
    return const Center(child: ProgressCircle());
  }
  if (ready.isEmpty) {
    return const EmptyStateView(
      icon: CupertinoIcons.checkmark_circle,
      iconColor: MacosColors.systemGreenColor,
      title: 'Nothing to do!',
      subtitle: 'All open issues are either blocked or there are none.',
    );
  }
  return ListView.builder(
    controller: scrollController,
    padding: const EdgeInsets.all(16),
    itemCount: ready.length,
    itemBuilder: (context, index) {
      final issue = ready[index];
      return _ReadyRow(issue: issue, allIssues: all);
    },
  );
}

class _ReadyRow extends StatelessWidget {
  final Issue issue;
  final List<Issue> allIssues;

  const _ReadyRow({required this.issue, required this.allIssues});

  @override
  Widget build(BuildContext context) {
    final theme = MacosTheme.of(context);
    final isSelected = appState.selectedIssue?.id == issue.id;
    final blockingCount = issue.blocking(allIssues).length;

    return GestureDetector(
      onTap: () => appState.selectIssue(issue),
      child: MouseRegion(
        cursor: SystemMouseCursors.click,
        child: Container(
          margin: const EdgeInsets.only(bottom: 6),
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          decoration: BoxDecoration(
            color: isSelected
                ? theme.primaryColor.withValues(alpha: 0.12)
                : MacosDynamicColor.resolve(
                    theme.brightness.isDark
                        ? MacosColors.alternatingContentBackgroundColor
                        : MacosColors.controlBackgroundColor,
                    context,
                  ),
            borderRadius: BorderRadius.circular(6),
            border: Border.all(
              color: isSelected
                  ? theme.primaryColor.withValues(alpha: 0.4)
                  : theme.dividerColor,
            ),
          ),
          child: Row(
            children: [
              // Priority badge
              _priorityChip(issue.priority, context),
              const SizedBox(width: 10),
              // Type icon
              MacosIcon(
                _iconForType(issue.issueType),
                size: 14,
                color: MacosColors.systemGrayColor,
              ),
              const SizedBox(width: 8),
              // ID + title
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      issue.title,
                      style: theme.typography.body.copyWith(
                        fontWeight: FontWeight.w600,
                      ),
                      overflow: TextOverflow.ellipsis,
                    ),
                    Text(
                      issue.id,
                      style: theme.typography.footnote.copyWith(
                        color: MacosColors.systemGrayColor,
                      ),
                    ),
                    // UI-01 (r1f.4) sibling: compact label chips, same
                    // conditional pattern already used for PriorityBadge.
                    if (issue.labels?.isNotEmpty == true) ...[
                      const SizedBox(height: 4),
                      Wrap(
                        spacing: 4,
                        runSpacing: 2,
                        children: issue.labels!
                            .map(
                              (label) => LabelChip(label: label, compact: true),
                            )
                            .toList(),
                      ),
                    ],
                  ],
                ),
              ),
              // "Blocks N" hint — shows how important this item is to unblock
              if (blockingCount > 0) ...[
                const SizedBox(width: 8),
                MacosTooltip(
                  message: 'Completing this unblocks $blockingCount issue(s)',
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 6,
                      vertical: 2,
                    ),
                    decoration: BoxDecoration(
                      color: MacosColors.systemOrangeColor.withValues(
                        alpha: 0.15,
                      ),
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: Text(
                      '↑$blockingCount',
                      style: theme.typography.footnote.copyWith(
                        color: MacosColors.systemOrangeColor,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                ),
              ],
              // In-progress chip
              if (issue.status == 'in_progress') ...[
                const SizedBox(width: 8),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 6,
                    vertical: 2,
                  ),
                  decoration: BoxDecoration(
                    color: MacosColors.systemPurpleColor.withValues(
                      alpha: 0.15,
                    ),
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: Text(
                    'IN PROGRESS',
                    style: theme.typography.footnote.copyWith(
                      color: MacosColors.systemPurpleColor,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  // UI-01 (r1f.4): delegates to the shared PriorityBadge widget.
  Widget _priorityChip(int priority, BuildContext context) =>
      PriorityBadge(priority: priority);

  IconData _iconForType(String type) {
    switch (type.toLowerCase()) {
      case 'epic':
        return CupertinoIcons.square_stack_3d_up;
      case 'bug':
        return CupertinoIcons.ant;
      case 'feature':
        return CupertinoIcons.star;
      default:
        return CupertinoIcons.doc_text;
    }
  }
}
