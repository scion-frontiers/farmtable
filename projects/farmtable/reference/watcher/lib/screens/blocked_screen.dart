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

/// A list of every blocked issue with its open blockers shown inline.
/// Mirrors `bd blocked` — the triage counterpart to the Ready Queue.
class BlockedScreen extends StatelessWidget {
  const BlockedScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: appState,
      builder: (context, _) {
        final all = appState.filteredIssues;
        final blocked =
            all
                .where(
                  (i) =>
                      (i.status == 'open' || i.status == 'in_progress') &&
                      i.isBlocked(all),
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
                  ? '${appState.selectedProject!.name} — Blocked'
                  : 'Blocked Issues',
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
                  child: ViewModeSegmentedControl(currentRoute: '/blocked'),
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
                    child: _buildBody(context, scrollController, blocked, all),
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
  List<Issue> blocked,
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
  if (blocked.isEmpty) {
    return const EmptyStateView(
      icon: CupertinoIcons.checkmark_shield,
      iconColor: MacosColors.systemGreenColor,
      title: 'No impediments!',
      subtitle: 'No open issues are currently blocked.',
    );
  }
  return ListView.builder(
    controller: scrollController,
    padding: const EdgeInsets.all(16),
    itemCount: blocked.length,
    itemBuilder: (context, index) {
      final issue = blocked[index];
      return _BlockedRow(issue: issue, allIssues: all);
    },
  );
}

class _BlockedRow extends StatelessWidget {
  final Issue issue;
  final List<Issue> allIssues;

  const _BlockedRow({required this.issue, required this.allIssues});

  @override
  Widget build(BuildContext context) {
    final theme = MacosTheme.of(context);
    final isSelected = appState.selectedIssue?.id == issue.id;
    final openBlockers = issue.blockers(allIssues);

    return GestureDetector(
      onTap: () => appState.selectIssue(issue),
      child: MouseRegion(
        cursor: SystemMouseCursors.click,
        child: Container(
          margin: const EdgeInsets.only(bottom: 8),
          decoration: BoxDecoration(
            color: isSelected
                ? MacosColors.systemRedColor.withValues(alpha: 0.08)
                : MacosDynamicColor.resolve(
                    theme.brightness.isDark
                        ? MacosColors.alternatingContentBackgroundColor
                        : MacosColors.controlBackgroundColor,
                    context,
                  ),
            borderRadius: BorderRadius.circular(6),
            border: Border.all(
              color: isSelected
                  ? MacosColors.systemRedColor.withValues(alpha: 0.4)
                  : MacosColors.systemRedColor.withValues(alpha: 0.2),
            ),
          ),
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Blocked issue header
                Row(
                  children: [
                    _priorityChip(issue.priority, context),
                    const SizedBox(width: 8),
                    const MacosIcon(
                      CupertinoIcons.exclamationmark_circle_fill,
                      size: 14,
                      color: MacosColors.systemRedColor,
                    ),
                    const SizedBox(width: 6),
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
                                    (label) =>
                                        LabelChip(label: label, compact: true),
                                  )
                                  .toList(),
                            ),
                          ],
                        ],
                      ),
                    ),
                  ],
                ),
                // Open blockers list
                if (openBlockers.isNotEmpty) ...[
                  const SizedBox(height: 8),
                  Container(
                    margin: const EdgeInsets.only(left: 4),
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: MacosColors.systemGrayColor.withValues(
                        alpha: 0.06,
                      ),
                      borderRadius: BorderRadius.circular(4),
                      border: Border.all(
                        color: MacosColors.systemGrayColor.withValues(
                          alpha: 0.15,
                        ),
                      ),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Blocked by:',
                          style: theme.typography.footnote.copyWith(
                            color: MacosColors.systemGrayColor,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        const SizedBox(height: 4),
                        ...openBlockers.map((b) => _BlockerLink(blocker: b)),
                      ],
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }

  // UI-01 (r1f.4): delegates to the shared PriorityBadge widget.
  Widget _priorityChip(int priority, BuildContext context) =>
      PriorityBadge(priority: priority);
}

class _BlockerLink extends StatelessWidget {
  final Issue blocker;

  const _BlockerLink({required this.blocker});

  @override
  Widget build(BuildContext context) {
    final theme = MacosTheme.of(context);
    return GestureDetector(
      onTap: () => appState.selectIssue(blocker),
      child: MouseRegion(
        cursor: SystemMouseCursors.click,
        child: Padding(
          padding: const EdgeInsets.only(bottom: 3),
          child: Row(
            children: [
              MacosIcon(
                blocker.status == 'closed'
                    ? CupertinoIcons.checkmark_circle_fill
                    : CupertinoIcons.circle,
                size: 12,
                color: blocker.status == 'closed'
                    ? MacosColors.systemGreenColor
                    : MacosColors.systemOrangeColor,
              ),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  '${blocker.id}  ${blocker.title}',
                  style: theme.typography.footnote.copyWith(
                    color: theme.primaryColor,
                    decoration: TextDecoration.underline,
                    decorationColor: theme.primaryColor.withValues(alpha: 0.5),
                  ),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              const SizedBox(width: 6),
              Text(
                blocker.status.toUpperCase(),
                style: theme.typography.footnote.copyWith(
                  fontSize: 9,
                  color: MacosColors.systemGrayColor,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
