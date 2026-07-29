import 'package:file_selector/file_selector.dart';
import 'package:flutter/cupertino.dart';
import 'package:macos_ui/macos_ui.dart';
import 'package:go_router/go_router.dart';
import '../main.dart';
import '../state/app_state.dart';
import '../widgets/issue_inspector.dart';
import '../widgets/settings_modal.dart';
import '../widgets/command_palette.dart';
import '../utils/dialog_utils.dart';

class HomeScreen extends StatefulWidget {
  final Widget child;

  const HomeScreen({super.key, required this.child});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int get _currentIndex {
    // Determine if we are currently on the settings route
    final location = GoRouterState.of(context).uri.toString();
    if (location == '/settings') {
      // Return a value outside the typical projects index to deselect the project list
      return -1;
    }

    final projects = appState.sortedProjects;
    if (projects.isEmpty) return 0;
    if (appState.selectedProject == null) return projects.length;
    final index = projects.indexOf(appState.selectedProject!);
    return index == -1 ? 0 : index;
  }

  void _onItemTapped(int index) {
    final projects = appState.sortedProjects;
    if (index >= 0 && index < projects.length) {
      appState.selectProject(projects[index]);
      // If we are on the settings page, pop back to the dashboard
      final location = GoRouterState.of(context).uri.toString();
      if (location == '/settings') {
        context.go('/');
      }
    } else if (index == projects.length) {
      _addProject();
    }
  }

  Future<void> _addProject() async {
    final String? directoryPath = await getDirectoryPath();
    if (directoryPath != null) {
      appState.addProject(directoryPath);
      // Navigate away from settings back to the main view if needed
      if (mounted) {
        context.go('/');
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: appState,
      builder: (context, _) {
        return MacosWindow(
          backgroundColor: const Color(
            0x00000000,
          ), // Transparent to allow vibrancy
          sidebar: Sidebar(
            minWidth: 200,
            decoration: const BoxDecoration(color: MacosColors.transparent),
            builder: (context, scrollController) {
              return SidebarItems(
                currentIndex: _currentIndex,
                onChanged: _onItemTapped,
                scrollController: scrollController,
                items: [
                  SidebarItem(
                    section: true,
                    label: Row(
                      children: [
                        const Expanded(child: Text('PROJECTS')),
                        if (appState.selectedProject != null) ...[
                          MacosTooltip(
                            message: 'Search Issues (⌘P)',
                            child: MacosIconButton(
                              icon: const MacosIcon(
                                CupertinoIcons.search,
                                size: 14,
                                color: MacosColors.systemGrayColor,
                              ),
                              onPressed: () {
                                CommandPalette.show(context);
                              },
                              boxConstraints: const BoxConstraints(),
                              padding: EdgeInsets.zero,
                            ),
                          ),
                          const SizedBox(width: 8),
                          MacosTooltip(
                            message: 'Voice Mode (Watcher Live)',
                            child: MacosIconButton(
                              icon: const MacosIcon(
                                CupertinoIcons.mic,
                                size: 14,
                                color: MacosColors.systemGrayColor,
                              ),
                              onPressed: () {
                                // TODO: Implement Watcher Live Modal
                              },
                              boxConstraints: const BoxConstraints(),
                              padding: EdgeInsets.zero,
                            ),
                          ),
                          const SizedBox(width: 8),
                          MacosTooltip(
                            message: 'Refresh current project',
                            child: MacosIconButton(
                              icon: MacosIcon(
                                CupertinoIcons.refresh,
                                size: 14,
                                color: appState.isRefreshing
                                    ? MacosTheme.of(context).primaryColor
                                    : MacosColors.systemGrayColor,
                              ),
                              onPressed: appState.refreshActiveProject,
                              boxConstraints: const BoxConstraints(),
                              padding: EdgeInsets.zero,
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                  ...appState.sortedProjects.map((p) {
                    final isSelected =
                        appState.selectedProject == p && _currentIndex != -1;
                    final isRefreshing = isSelected && appState.isRefreshing;
                    final hasError = appState.projectErrors.containsKey(p.path);

                    Widget leadingIcon;
                    if (isRefreshing) {
                      leadingIcon = const CupertinoActivityIndicator(radius: 8);
                    } else if (hasError) {
                      leadingIcon = const MacosIcon(
                        CupertinoIcons.exclamationmark_triangle_fill,
                        color: MacosColors.systemRedColor,
                      );
                    } else {
                      final timeStr = appState.getProjectLastActivity(p);
                      // Only show activity timestamp if sorting by activity
                      if (timeStr != null &&
                          appState.sidebarSortOrder ==
                              SidebarSortOrder.activity) {
                        leadingIcon = SizedBox(
                          width: 24,
                          child: Text(
                            timeStr,
                            textAlign: TextAlign.center,
                            style: MacosTheme.of(context).typography.footnote
                                .copyWith(
                                  color: isSelected
                                      ? MacosTheme.of(context).primaryColor
                                      : MacosColors.systemGrayColor,
                                  fontWeight: FontWeight.bold,
                                  fontSize: 10,
                                ),
                          ),
                        );
                      } else {
                        final hasPeers =
                            isSelected && appState.currentPeers.isNotEmpty;
                        leadingIcon = MacosIcon(
                          hasPeers
                              ? CupertinoIcons.cloud
                              : CupertinoIcons.folder,
                          size: 16,
                          color: isSelected
                              ? null
                              : MacosTheme.of(
                                  context,
                                ).typography.body.color?.withValues(alpha: 0.5),
                        );
                      }
                    }

                    Widget? trailingWidget;
                    if (isSelected) {
                      trailingWidget = MacosIconButton(
                        icon: const MacosIcon(
                          CupertinoIcons.clear_circled,
                          size: 14,
                        ),
                        onPressed: () async {
                          final ok = await appState.removeProject(p);
                          if (!context.mounted) return;
                          if (!ok) {
                            await DialogUtils.showError(
                              context,
                              title: 'Could Not Remove Project',
                              message:
                                  'Failed to remove "${p.name}". Your projects '
                                  'could not be saved. Please try again.',
                            );
                            return;
                          }
                          if (appState.projects.isEmpty) {
                            context.go('/settings');
                          }
                        },
                        boxConstraints: const BoxConstraints(
                          minWidth: 16,
                          minHeight: 16,
                        ),
                        padding: EdgeInsets.zero,
                      );
                    } else if (appState.hasUnreadActivity(p)) {
                      trailingWidget = Container(
                        width: 8,
                        height: 8,
                        decoration: const BoxDecoration(
                          color: MacosColors.systemBlueColor,
                          shape: BoxShape.circle,
                        ),
                      );
                    }

                    return SidebarItem(
                      leading: leadingIcon,
                      label: Text(p.name),
                      unselectedColor: isSelected
                          ? MacosTheme.of(
                              context,
                            ).primaryColor.withValues(alpha: 0.2)
                          : null,
                      trailing: trailingWidget,
                    );
                  }),
                  const SidebarItem(
                    leading: MacosIcon(CupertinoIcons.add),
                    label: Text('Add Project'),
                  ),
                ],
              );
            },
            bottom: MacosListTile(
              leading: const MacosIcon(CupertinoIcons.settings),
              title: const Text('Settings'),
              onClick: () {
                SettingsModal.show(context);
              },
            ),
          ),
          endSidebar: Sidebar(
            startWidth: 300,
            minWidth: 200,
            maxWidth: 400,
            isResizable: true,
            shownByDefault: false,
            builder: (context, scrollController) {
              if (appState.selectedIssue == null || _currentIndex == -1) {
                return const SizedBox.shrink();
              }
              return IssueInspector(
                issue: appState.selectedIssue!,
                scrollController: scrollController,
              );
            },
          ),
          child: _InspectorController(child: widget.child),
        );
      },
    );
  }
}

class _InspectorController extends StatefulWidget {
  final Widget child;

  const _InspectorController({required this.child});

  @override
  State<_InspectorController> createState() => _InspectorControllerState();
}

class _InspectorControllerState extends State<_InspectorController> {
  String? _previousSelectedIssueId;

  @override
  void initState() {
    super.initState();
    _previousSelectedIssueId = appState.selectedIssue?.id;
    appState.addListener(_onAppStateChanged);
  }

  @override
  void dispose() {
    appState.removeListener(_onAppStateChanged);
    super.dispose();
  }

  void _onAppStateChanged() {
    if (!mounted) return;
    final scope = MacosWindowScope.maybeOf(context);
    if (scope == null) return;

    // Check if we are on settings screen, if so, hide end sidebar
    final location = GoRouterState.of(context).uri.toString();
    if (location == '/settings') {
      if (scope.isEndSidebarShown) {
        scope.toggleEndSidebar();
      }
      return;
    }

    final currentSelectedIssueId = appState.selectedIssue?.id;
    if (currentSelectedIssueId != null &&
        currentSelectedIssueId != _previousSelectedIssueId) {
      if (!scope.isEndSidebarShown) {
        scope.toggleEndSidebar();
      }
    }
    _previousSelectedIssueId = currentSelectedIssueId;
  }

  @override
  Widget build(BuildContext context) {
    return widget.child;
  }
}
