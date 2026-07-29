import 'package:flutter/cupertino.dart';
import 'package:macos_ui/macos_ui.dart';
import 'package:go_router/go_router.dart';
import '../main.dart';
import '../models/issue.dart';
import '../widgets/view_mode_segmented_control.dart';
import '../widgets/activity_ticker.dart';
import '../widgets/planner_modal.dart';
import '../widgets/ai_assistant_insights_panel.dart';
import '../widgets/create_issue_modal.dart';
import '../widgets/error_display_view.dart';
import '../widgets/migration_gate_view.dart';
import '../widgets/label_picker.dart';
import '../widgets/filter_chip_bar.dart';

class ProjectDashboard extends StatelessWidget {
  const ProjectDashboard({super.key});

  void _showPlanner(BuildContext context) {
    showMacosSheet(
      context: context,
      builder: (context) => MacosSheet(
        child: PlannerModal(
          project: appState.selectedProject!,
          appState: appState,
        ),
      ),
    );
  }

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
              title: const Text('Dashboard'),
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
                    child: ViewModeSegmentedControl(currentRoute: '/'),
                  ),
                ),
              ],
            ),
            children: [
              ContentArea(
                builder: (context, scrollController) => const Center(
                  child: Text('No project selected. Add one from the sidebar.'),
                ),
              ),
            ],
          );
        }

        if (appState.isLoading) {
          return MacosScaffold(
            toolBar: ToolBar(
              title: const Text('Dashboard'),
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
                    child: ViewModeSegmentedControl(currentRoute: '/'),
                  ),
                ),
              ],
            ),
            children: [
              ContentArea(
                builder: (context, scrollController) =>
                    const Center(child: ProgressCircle()),
              ),
            ],
          );
        }

        if (appState.error != null) {
          // If the error is a schema migration gate, render the purpose-built
          // MigrationGateView with actionable buttons instead of a raw error box.
          final gate = appState.schemaMigrationGate;
          return MacosScaffold(
            toolBar: ToolBar(
              title: const Text('Dashboard'),
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
                    child: ViewModeSegmentedControl(currentRoute: '/'),
                  ),
                ),
              ],
            ),
            children: [
              ContentArea(
                builder: (context, scrollController) => gate != null
                    ? MigrationGateView(
                        gate: gate,
                        appState: appState,
                        onRetry: () {
                          if (appState.selectedProject != null) {
                            appState.selectProject(appState.selectedProject!);
                          }
                        },
                      )
                    : ErrorDisplayView(
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
        final openCount = issues.where((i) => i.status == 'open').length;
        final openP1Count = issues
            .where((i) => i.status == 'open' && i.priority == 1)
            .length;
        final openP2Count = issues
            .where((i) => i.status == 'open' && i.priority == 2)
            .length;
        final openP3Count = issues
            .where((i) => i.status == 'open' && i.priority == 3)
            .length;
        final inProgressCount = issues
            .where((i) => i.status == 'in_progress')
            .length;
        final closedCount = issues.where((i) => i.status == 'closed').length;
        final activeIssues = issues
            .where((i) => i.status == 'open' || i.status == 'in_progress')
            .toList();
        final blockedCount = activeIssues
            .where((i) => i.isBlocked(issues))
            .length;
        final readyCount = activeIssues
            .where((i) => !i.isBlocked(issues))
            .length;

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
              ToolBarIconButton(
                label: 'AI Planner',
                icon: const MacosIcon(CupertinoIcons.sparkles),
                showLabel: false,
                tooltipMessage: 'AI Planner',
                onPressed: () => _showPlanner(context),
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
                  child: ViewModeSegmentedControl(currentRoute: '/'),
                ),
              ),
            ],
          ),
          children: [
            ContentArea(
              builder: (context, scrollController) {
                return Column(
                  children: [
                    const FilterChipBar(),
                    Expanded(
                      child: SingleChildScrollView(
                        controller: scrollController,
                        padding: const EdgeInsets.all(20),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Project Overview',
                              style: MacosTheme.of(
                                context,
                              ).typography.largeTitle,
                            ),
                            const SizedBox(height: 20),
                            if (appState.projectRequiredVersion != null &&
                                appState.daemonVersion != null &&
                                appState.projectRequiredVersion !=
                                    appState.daemonVersion)
                              Padding(
                                padding: const EdgeInsets.only(bottom: 20.0),
                                child: Container(
                                  padding: const EdgeInsets.all(12),
                                  decoration: BoxDecoration(
                                    color: MacosColors.systemRedColor
                                        .withValues(alpha: 0.1),
                                    border: Border.all(
                                      color: MacosColors.systemRedColor,
                                    ),
                                    borderRadius: BorderRadius.circular(6),
                                  ),
                                  child: Row(
                                    children: [
                                      const MacosIcon(
                                        CupertinoIcons
                                            .exclamationmark_octagon_fill,
                                        color: MacosColors.systemRedColor,
                                      ),
                                      const SizedBox(width: 8),
                                      Expanded(
                                        child: Text(
                                          'Incompatible Version: This project requires beads version ${appState.projectRequiredVersion}, but your Watcher daemon is running ${appState.daemonVersion}. Some features may be broken or unreadable.',
                                          style: MacosTheme.of(
                                            context,
                                          ).typography.body,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            if (appState.currentConnectionMode == 'embedded')
                              Padding(
                                padding: const EdgeInsets.only(bottom: 20.0),
                                child: Container(
                                  padding: const EdgeInsets.all(12),
                                  decoration: BoxDecoration(
                                    color: MacosColors.systemOrangeColor
                                        .withValues(alpha: 0.1),
                                    border: Border.all(
                                      color: MacosColors.systemOrangeColor,
                                    ),
                                    borderRadius: BorderRadius.circular(6),
                                  ),
                                  child: Row(
                                    children: [
                                      const MacosIcon(
                                        CupertinoIcons.info_circle_fill,
                                        color: MacosColors.systemOrangeColor,
                                      ),
                                      const SizedBox(width: 8),
                                      Expanded(
                                        child: Text(
                                          'Dolt Embedded Mode: This project is running in single-writer mode. To avoid lock contention with background AI agents, we recommended running "bd dolt server" in your terminal.',
                                          style: MacosTheme.of(
                                            context,
                                          ).typography.body,
                                        ),
                                      ),
                                      const SizedBox(width: 12),
                                      PushButton(
                                        controlSize: ControlSize.small,
                                        secondary: true,
                                        onPressed: () =>
                                            appState.launchDoltServer(),
                                        child: const Text('Start Server'),
                                      ),
                                      const SizedBox(width: 8),
                                      PushButton(
                                        controlSize: ControlSize.small,
                                        secondary: true,
                                        onPressed: () =>
                                            appState.reconnectActiveProject(),
                                        child: const Text('Reconnect'),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            Row(
                              children: [
                                SimpleStatCard(
                                  title: 'Open',
                                  value: openCount.toString(),
                                ),
                                const SizedBox(width: 16),
                                PriorityStatCard(
                                  p0Count: issues
                                      .where(
                                        (i) =>
                                            i.status == 'open' &&
                                            i.priority == 0,
                                      )
                                      .length,
                                  p1Count: openP1Count,
                                  p2Count: openP2Count,
                                  p3Count: openP3Count,
                                ),
                                const SizedBox(width: 16),
                                SimpleStatCard(
                                  title: 'In Progress',
                                  value: inProgressCount.toString(),
                                ),
                                const SizedBox(width: 16),
                                SimpleStatCard(
                                  title: 'Closed',
                                  value: closedCount.toString(),
                                ),
                                const SizedBox(width: 16),
                                SimpleStatCard(
                                  title: 'Total',
                                  value: issues.length.toString(),
                                ),
                              ],
                            ),
                            const SizedBox(height: 12),
                            Row(
                              children: [
                                ReadinessStatCard(
                                  readyCount: readyCount,
                                  blockedCount: blockedCount,
                                  onReadyTap: () => context.go('/ready'),
                                  onBlockedTap: () => context.go('/blocked'),
                                ),
                              ],
                            ),
                            const SizedBox(height: 32),
                             AIAssistantInsightsPanel(appState: appState),
                            const SizedBox(height: 32),
                            Text(
                              'Federation',
                              style: MacosTheme.of(context).typography.title2,
                            ),
                            const SizedBox(height: 12),
                            if (appState.currentPeers.isEmpty)
                              Container(
                                decoration: BoxDecoration(
                                  color: MacosDynamicColor.resolve(
                                    MacosTheme.of(context).brightness.isDark
                                        ? MacosColors
                                              .alternatingContentBackgroundColor
                                        : MacosColors.controlBackgroundColor,
                                    context,
                                  ),
                                  borderRadius: BorderRadius.circular(8),
                                  border: Border.all(
                                    color: MacosColors.systemGrayColor
                                        .withValues(
                                          alpha:
                                              MacosTheme.of(
                                                context,
                                              ).brightness.isDark
                                              ? 0.1
                                              : 0.2,
                                        ),
                                  ),
                                ),

                                child: Padding(
                                  padding: const EdgeInsets.all(16.0),
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        'No peers configured',
                                        style: MacosTheme.of(
                                          context,
                                        ).typography.headline,
                                      ),
                                      const SizedBox(height: 4),
                                      Text(
                                        'This project only exists locally.',
                                        style: MacosTheme.of(
                                          context,
                                        ).typography.body,
                                      ),

                                      const SizedBox(height: 12),
                                      PushButton(
                                        controlSize: ControlSize.regular,
                                        child: const Text(
                                          'Configure Federation...',
                                        ),
                                        onPressed: () {
                                          context.go('/project/settings');
                                        },
                                      ),
                                    ],
                                  ),
                                ),
                              )
                            else
                              Container(
                                decoration: BoxDecoration(
                                  color: MacosDynamicColor.resolve(
                                    MacosTheme.of(context).brightness.isDark
                                        ? MacosColors
                                              .alternatingContentBackgroundColor
                                        : MacosColors.controlBackgroundColor,
                                    context,
                                  ),
                                  borderRadius: BorderRadius.circular(8),
                                  border: Border.all(
                                    color: MacosColors.systemGrayColor
                                        .withValues(
                                          alpha:
                                              MacosTheme.of(
                                                context,
                                              ).brightness.isDark
                                              ? 0.1
                                              : 0.2,
                                        ),
                                  ),
                                ),

                                child: Padding(
                                  padding: const EdgeInsets.all(16.0),
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Row(
                                        mainAxisAlignment:
                                            MainAxisAlignment.spaceBetween,
                                        children: [
                                          Text(
                                            '${appState.currentPeers.length} Peers Configured',
                                            style: MacosTheme.of(
                                              context,
                                            ).typography.headline,
                                          ),
                                          PushButton(
                                            controlSize: ControlSize.regular,
                                            secondary: true,
                                            onPressed: () {
                                              appState.syncPeer();
                                            },
                                            child: const Text('Sync All'),
                                          ),
                                        ],
                                      ),
                                      const SizedBox(height: 12),
                                      ...appState.currentPeers.map(
                                        (peer) => Padding(
                                          padding: const EdgeInsets.only(
                                            bottom: 8.0,
                                          ),
                                          child: Row(
                                            children: [
                                              const MacosIcon(
                                                CupertinoIcons.cloud,
                                                size: 16,
                                              ),
                                              const SizedBox(width: 8),
                                              Text(
                                                peer['name'] ?? '',
                                                style: MacosTheme.of(
                                                  context,
                                                ).typography.headline,
                                              ),
                                              const SizedBox(width: 8),
                                              Text(
                                                peer['url'] ?? '',
                                                style: MacosTheme.of(context)
                                                    .typography
                                                    .footnote
                                                    .copyWith(
                                                      color: MacosColors
                                                          .systemGrayColor,
                                                    ),
                                              ),
                                            ],
                                          ),
                                        ),
                                      ),
                                      const SizedBox(height: 4),
                                      PushButton(
                                        controlSize: ControlSize.regular,
                                        child: const Text(
                                          'Configure Federation...',
                                        ),
                                        onPressed: () {
                                          context.go('/project/settings');
                                        },
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            const SizedBox(height: 32),
                            Text(
                              'Recent Activity',
                              style: MacosTheme.of(context).typography.title2,
                            ),
                            const SizedBox(height: 12),
                            const ActivityTicker(),
                          ],
                        ),
                      ),
                    ),
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

class StatCard extends StatelessWidget {
  final String title;
  final Widget child;

  const StatCard({super.key, required this.title, required this.child});

  @override
  Widget build(BuildContext context) {
    final isDark = MacosTheme.of(context).brightness.isDark;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: MacosDynamicColor.resolve(
          isDark
              ? MacosColors.alternatingContentBackgroundColor
              : MacosColors.controlBackgroundColor,
          context,
        ),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(
          color: MacosColors.systemGrayColor.withValues(
            alpha: isDark ? 0.1 : 0.2,
          ),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: MacosTheme.of(context).typography.subheadline.copyWith(
              color: MacosColors.systemGrayColor,
            ),
          ),
          const SizedBox(height: 8),
          child,
        ],
      ),
    );
  }
}

class SimpleStatCard extends StatelessWidget {
  final String title;
  final String value;

  const SimpleStatCard({super.key, required this.title, required this.value});

  @override
  Widget build(BuildContext context) {
    return StatCard(
      title: title,
      child: Text(
        value,
        style: MacosTheme.of(
          context,
        ).typography.title1.copyWith(fontWeight: FontWeight.bold),
      ),
    );
  }
}

class PriorityStatCard extends StatelessWidget {
  final int p0Count;
  final int p1Count;
  final int p2Count;
  final int p3Count;

  const PriorityStatCard({
    super.key,
    required this.p0Count,
    required this.p1Count,
    required this.p2Count,
    required this.p3Count,
  });

  Widget _buildBadge(
    BuildContext context,
    String label,
    int count,
    Color color,
  ) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
          decoration: BoxDecoration(
            color: color,
            borderRadius: BorderRadius.circular(4),
          ),
          child: Text(
            label,
            style: const TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.bold,
              color: MacosColors.white,
            ),
          ),
        ),
        const SizedBox(width: 6),
        Text(
          count.toString(),
          style: MacosTheme.of(
            context,
          ).typography.title2.copyWith(fontWeight: FontWeight.bold),
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    return StatCard(
      title: 'Priority Open',
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (p0Count > 0) ...[
            _buildBadge(context, 'P0', p0Count, MacosColors.systemRedColor),
            const SizedBox(width: 12),
          ],
          _buildBadge(context, 'P1', p1Count, MacosColors.systemOrangeColor),
          const SizedBox(width: 12),
          _buildBadge(context, 'P2', p2Count, MacosColors.systemYellowColor),
          const SizedBox(width: 12),
          _buildBadge(context, 'P3', p3Count, MacosColors.systemBlueColor),
        ],
      ),
    );
  }
}

/// A stat card showing Ready vs Blocked counts with tappable sections that
/// navigate to the Ready Queue and Blocked views respectively.
class ReadinessStatCard extends StatelessWidget {
  final int readyCount;
  final int blockedCount;
  final VoidCallback onReadyTap;
  final VoidCallback onBlockedTap;

  const ReadinessStatCard({
    super.key,
    required this.readyCount,
    required this.blockedCount,
    required this.onReadyTap,
    required this.onBlockedTap,
  });

  Widget _buildSection(
    BuildContext context,
    String label,
    int count,
    Color color,
    IconData icon,
    VoidCallback onTap,
  ) {
    return Semantics(
      button: true,
      label: '$count $label',
      child: GestureDetector(
        onTap: onTap,
        child: MouseRegion(
          cursor: SystemMouseCursors.click,
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              MacosIcon(icon, size: 14, color: color),
              const SizedBox(width: 6),
              Text(
                count.toString(),
                style: MacosTheme.of(context).typography.title2.copyWith(
                  fontWeight: FontWeight.bold,
                  color: color,
                ),
              ),
              const SizedBox(width: 4),
              Text(
                label,
                style: MacosTheme.of(context).typography.footnote.copyWith(
                  color: color,
                  decoration: TextDecoration.underline,
                  decorationColor: color.withValues(alpha: 0.5),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return StatCard(
      title: 'Readiness',
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          _buildSection(
            context,
            'Ready',
            readyCount,
            MacosColors.systemGreenColor,
            CupertinoIcons.checkmark_circle_fill,
            onReadyTap,
          ),
          const SizedBox(width: 20),
          _buildSection(
            context,
            'Blocked',
            blockedCount,
            MacosColors.systemRedColor,
            CupertinoIcons.exclamationmark_circle_fill,
            onBlockedTap,
          ),
        ],
      ),
    );
  }
}
