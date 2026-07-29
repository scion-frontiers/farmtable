import 'package:flutter/cupertino.dart';
import 'package:macos_ui/macos_ui.dart';
import '../main.dart';
import '../models/issue.dart';
import '../widgets/view_mode_segmented_control.dart';
import '../widgets/error_display_view.dart';
import '../widgets/empty_state_view.dart';
import '../widgets/label_picker.dart';
import '../widgets/filter_chip_bar.dart';

/// A structured visualization of the blocks DAG — which issues are
/// blocking which others, including chains that cross epic boundaries.
///
/// This is a list-based DAG view rather than a canvas-drawn graph:
/// "roots" (blockers that aren't themselves blocked) cascade downward
/// to their dependents. Each chain is an expandable section.
class DependencyGraphScreen extends StatelessWidget {
  const DependencyGraphScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: appState,
      builder: (context, _) {
        final all = appState.filteredIssues;

        // Collect every issue that participates in a blocks relationship.
        final participantIds = <String>{};
        for (final issue in all) {
          for (final dep in issue.dependencies ?? []) {
            if (dep.type == 'blocks') {
              participantIds.add(issue.id);
              participantIds.add(dep.dependsOnId);
            }
          }
        }

        // Root blockers: participate in blocks, but are not themselves blocked.
        final roots =
            all
                .where(
                  (i) =>
                      participantIds.contains(i.id) &&
                      !i.isBlocked(all) &&
                      i.blocking(all).isNotEmpty,
                )
                .toList()
              ..sort((a, b) => a.priority.compareTo(b.priority));

        // Stats
        final blockedCount = all
            .where(
              (i) =>
                  (i.status == 'open' || i.status == 'in_progress') &&
                  i.isBlocked(all),
            )
            .length;
        final chainCount = roots.length;

        return MacosScaffold(
          toolBar: ToolBar(
            leading: MacosIconButton(
              icon: const MacosIcon(CupertinoIcons.sidebar_left),
              onPressed: () => MacosWindowScope.of(context).toggleSidebar(),
            ),
            title: Text(
              appState.selectedProject != null
                  ? '${appState.selectedProject!.name} — Dependency Graph'
                  : 'Dependency Graph',
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
                  child: ViewModeSegmentedControl(currentRoute: '/graph'),
                ),
              ),
            ],
          ),
          children: [
            ContentArea(
              builder: (context, scrollController) {
                // Wraps the original body in an IIFE so a FilterChipBar can
                // be inserted as a fixed row above it (GEMINI.md: filter
                // chips live between ToolBar and ContentArea, not inside it
                // unstyled) without restructuring every early return below.
                final body = (() {
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
                  if (participantIds.isEmpty) {
                    return const EmptyStateView(
                      icon: CupertinoIcons.arrow_branch,
                      title: 'No dependency edges',
                      subtitle:
                          'No "blocks" relationships have been recorded yet.',
                    );
                  }

                  return ListView(
                    controller: scrollController,
                    padding: const EdgeInsets.all(16),
                    children: [
                      // Summary header
                      _SummaryBar(
                        chainCount: chainCount,
                        blockedCount: blockedCount,
                      ),
                      const SizedBox(height: 20),
                      if (roots.isNotEmpty) ...[
                        Text(
                          'Blocking chains',
                          style: MacosTheme.of(context).typography.headline,
                        ),
                        const SizedBox(height: 4),
                        Text(
                          'Completing issues at the top of each chain unblocks those below.',
                          style: MacosTheme.of(context).typography.footnote
                              .copyWith(color: MacosColors.systemGrayColor),
                        ),
                        const SizedBox(height: 12),
                        ...roots.map(
                          (root) => _ChainCard(root: root, allIssues: all),
                        ),
                      ],
                      // Isolated blocked issues (blocked by things not in roots —
                      // e.g. their blockers are themselves blocked).
                      () {
                        final isolated =
                            all
                                .where(
                                  (i) =>
                                      participantIds.contains(i.id) &&
                                      i.isBlocked(all) &&
                                      i
                                          .blockers(all)
                                          .every(
                                            (b) =>
                                                !roots.any((r) => r.id == b.id),
                                          ),
                                )
                                .toList()
                              ..sort(
                                (a, b) => a.priority.compareTo(b.priority),
                              );
                        if (isolated.isEmpty) return const SizedBox.shrink();
                        return Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const SizedBox(height: 20),
                            Text(
                              'Indirect impediments',
                              style: MacosTheme.of(context).typography.headline,
                            ),
                            const SizedBox(height: 4),
                            Text(
                              'Blocked by issues that are themselves blocked.',
                              style: MacosTheme.of(context).typography.footnote
                                  .copyWith(color: MacosColors.systemGrayColor),
                            ),
                            const SizedBox(height: 12),
                            ...isolated.map(
                              (i) => _IssueChip(
                                issue: i,
                                allIssues: all,
                                indent: 0,
                              ),
                            ),
                          ],
                        );
                      }(),
                    ],
                  );
                })();
                return Column(
                  children: [
                    const FilterChipBar(),
                    Expanded(child: body),
                  ],
                );
              },
            ),
          ],
        );
      },
    );
  }
}

class _SummaryBar extends StatelessWidget {
  final int chainCount;
  final int blockedCount;

  const _SummaryBar({required this.chainCount, required this.blockedCount});

  @override
  Widget build(BuildContext context) {
    final theme = MacosTheme.of(context);
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: MacosDynamicColor.resolve(
          theme.brightness.isDark
              ? MacosColors.alternatingContentBackgroundColor
              : MacosColors.controlBackgroundColor,
          context,
        ),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: theme.dividerColor),
      ),
      child: Row(
        children: [
          _stat(
            context,
            '$chainCount',
            'root chain${chainCount == 1 ? '' : 's'}',
            CupertinoIcons.arrow_branch,
            MacosColors.systemOrangeColor,
          ),
          const SizedBox(width: 24),
          _stat(
            context,
            '$blockedCount',
            'blocked issue${blockedCount == 1 ? '' : 's'}',
            CupertinoIcons.exclamationmark_circle_fill,
            MacosColors.systemRedColor,
          ),
        ],
      ),
    );
  }

  Widget _stat(
    BuildContext context,
    String value,
    String label,
    IconData icon,
    Color color,
  ) {
    final theme = MacosTheme.of(context);
    final resolved = MacosDynamicColor.resolve(color, context);
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        MacosIcon(icon, size: 16, color: resolved),
        const SizedBox(width: 6),
        Text(
          value,
          style: theme.typography.title2.copyWith(
            fontWeight: FontWeight.bold,
            color: resolved,
          ),
        ),
        const SizedBox(width: 4),
        Text(label, style: theme.typography.footnote),
      ],
    );
  }
}

class _ChainCard extends StatefulWidget {
  final Issue root;
  final List<Issue> allIssues;

  const _ChainCard({required this.root, required this.allIssues});

  @override
  State<_ChainCard> createState() => _ChainCardState();
}

class _ChainCardState extends State<_ChainCard> {
  bool _expanded = true;

  @override
  Widget build(BuildContext context) {
    final blocked = widget.root.blocking(widget.allIssues);
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(8),
        border: Border.all(
          color: MacosColors.systemOrangeColor.withValues(alpha: 0.3),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Root issue header (the blocker)
          GestureDetector(
            onTap: () => setState(() => _expanded = !_expanded),
            child: MouseRegion(
              cursor: SystemMouseCursors.click,
              child: Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 10,
                ),
                decoration: BoxDecoration(
                  color: MacosColors.systemOrangeColor.withValues(alpha: 0.08),
                  borderRadius: BorderRadius.only(
                    topLeft: const Radius.circular(7),
                    topRight: const Radius.circular(7),
                    bottomLeft: Radius.circular(_expanded ? 0 : 7),
                    bottomRight: Radius.circular(_expanded ? 0 : 7),
                  ),
                ),
                child: Row(
                  children: [
                    MacosIcon(
                      _expanded
                          ? CupertinoIcons.chevron_down
                          : CupertinoIcons.chevron_right,
                      size: 12,
                      color: MacosColors.systemGrayColor,
                    ),
                    const SizedBox(width: 8),
                    MacosIcon(
                      CupertinoIcons.arrow_branch,
                      size: 14,
                      color: MacosDynamicColor.resolve(
                        MacosColors.systemOrangeColor,
                        context,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: GestureDetector(
                        onTap: () => appState.selectIssue(widget.root),
                        child: Text(
                          '${widget.root.id}  ${widget.root.title}',
                          style: MacosTheme.of(context).typography.body
                              .copyWith(fontWeight: FontWeight.w600),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Text(
                      'blocks ${blocked.length}',
                      style: MacosTheme.of(context).typography.footnote
                          .copyWith(
                            color: MacosDynamicColor.resolve(
                              MacosColors.systemOrangeColor,
                              context,
                            ),
                          ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          // Blocked dependents
          if (_expanded)
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 8, 12, 10),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: blocked
                    .map(
                      (i) => _IssueChip(
                        issue: i,
                        allIssues: widget.allIssues,
                        indent: 0,
                      ),
                    )
                    .toList(),
              ),
            ),
        ],
      ),
    );
  }
}

class _IssueChip extends StatelessWidget {
  final Issue issue;
  final List<Issue> allIssues;
  final int indent;

  const _IssueChip({
    required this.issue,
    required this.allIssues,
    required this.indent,
  });

  @override
  Widget build(BuildContext context) {
    final theme = MacosTheme.of(context);
    final isBlocked = issue.isBlocked(allIssues);
    final statusColor = isBlocked
        ? MacosColors.systemRedColor
        : MacosColors.systemGreenColor;

    return GestureDetector(
      onTap: () => appState.selectIssue(issue),
      child: MouseRegion(
        cursor: SystemMouseCursors.click,
        child: Padding(
          padding: EdgeInsets.only(left: indent * 16.0, bottom: 4),
          child: Row(
            children: [
              MacosIcon(
                isBlocked
                    ? CupertinoIcons.exclamationmark_circle_fill
                    : CupertinoIcons.checkmark_circle_fill,
                size: 12,
                color: MacosDynamicColor.resolve(statusColor, context),
              ),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  '${issue.id}  ${issue.title}',
                  style: theme.typography.footnote.copyWith(
                    color: theme.primaryColor,
                    decoration: TextDecoration.underline,
                    decorationColor: theme.primaryColor.withValues(alpha: 0.4),
                  ),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              if (issue.status == 'closed')
                Padding(
                  padding: const EdgeInsets.only(left: 4),
                  child: Text(
                    'CLOSED',
                    style: theme.typography.footnote.copyWith(
                      fontSize: 9,
                      color: MacosColors.systemGrayColor,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
