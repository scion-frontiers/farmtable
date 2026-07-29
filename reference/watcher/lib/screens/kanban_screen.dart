import 'package:flutter/cupertino.dart';
import 'package:macos_ui/macos_ui.dart';
import '../main.dart';
import '../widgets/view_mode_segmented_control.dart';
import '../widgets/kanban_column.dart';
import '../widgets/create_issue_modal.dart';
import '../widgets/error_display_view.dart';
import '../widgets/empty_state_view.dart';
import '../widgets/label_picker.dart';
import '../widgets/filter_chip_bar.dart';

class KanbanScreen extends StatelessWidget {
  const KanbanScreen({super.key});

  void _showCreateIssue(BuildContext context) {
    showMacosSheet(
      context: context,
      builder: (context) =>
          MacosSheet(child: CreateIssueModal(appState: appState)),
    );
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: appState,
      builder: (context, _) {
        if (appState.selectedProject == null) {
          return MacosScaffold(
            toolBar: ToolBar(
              title: const Text('Kanban View'),
              actions: [
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
                    padding: EdgeInsets.symmetric(horizontal: 8.0),
                    child: ViewModeSegmentedControl(currentRoute: '/kanban'),
                  ),
                ),
              ],
            ),
            children: [
              ContentArea(
                builder: (context, scrollController) =>
                    const Center(child: Text('No project selected.')),
              ),
            ],
          );
        }

        if (appState.error != null) {
          return MacosScaffold(
            toolBar: ToolBar(
              title: const Text('Kanban View'),
              actions: [
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
                    padding: EdgeInsets.symmetric(horizontal: 8.0),
                    child: ViewModeSegmentedControl(currentRoute: '/kanban'),
                  ),
                ),
              ],
            ),
            children: [
              ContentArea(
                builder: (context, scrollController) => ErrorDisplayView(
                  error: appState.error!,
                  onRetry: () {
                    if (appState.selectedProject != null) {
                      appState.selectProject(appState.selectedProject!);
                    }
                  },
                ),
              ),
            ],
          );
        }

        final issues = appState.filteredIssues;
        final openIssues = issues.where((i) => i.status == 'open').toList();
        final inProgressIssues = issues
            .where((i) => i.status == 'in_progress')
            .toList();

        // Sort closed issues by updatedAt descending (most recently closed/updated first)
        final closedIssues = issues.where((i) => i.status == 'closed').toList()
          ..sort((a, b) => b.updatedAt.compareTo(a.updatedAt));

        return MacosScaffold(
          toolBar: ToolBar(
            leading: MacosIconButton(
              icon: const MacosIcon(CupertinoIcons.sidebar_left),
              onPressed: () {
                MacosWindowScope.of(context).toggleSidebar();
              },
            ),
            title: Text(appState.selectedProject!.name),
            actions: [
              ToolBarIconButton(
                label: 'Create Issue',
                icon: const MacosIcon(CupertinoIcons.plus_square),
                showLabel: false,
                tooltipMessage: 'Create Issue',
                onPressed: () => _showCreateIssue(context),
              ),
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
                  padding: EdgeInsets.symmetric(horizontal: 8.0),
                  child: ViewModeSegmentedControl(currentRoute: '/kanban'),
                ),
              ),
            ],
          ),
          children: [
            ContentArea(
              builder: (context, scrollController) {
                Widget body;
                if (issues.isEmpty) {
                  body = const EmptyStateView(
                    icon: CupertinoIcons.checkmark_seal_fill,
                    title: 'No issues found',
                  );
                } else {
                  body = SingleChildScrollView(
                    controller: scrollController,
                    scrollDirection: Axis.horizontal,
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        KanbanColumn(
                          title: 'Open',
                          statusKey: 'open',
                          issues: openIssues,
                        ),
                        KanbanColumn(
                          title: 'In Progress',
                          statusKey: 'in_progress',
                          issues: inProgressIssues,
                        ),
                        KanbanColumn(
                          title: 'Closed',
                          statusKey: 'closed',
                          issues: closedIssues,
                        ),
                      ],
                    ),
                  );
                }
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
