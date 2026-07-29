import 'package:flutter/cupertino.dart';
import 'package:go_router/go_router.dart';
import 'package:macos_ui/macos_ui.dart';

class ViewModeSegmentedControl extends StatelessWidget {
  final String currentRoute;

  const ViewModeSegmentedControl({super.key, required this.currentRoute});

  int _getIndexFromRoute(String route) {
    if (route == '/') return 0;
    if (route == '/tree') return 1;
    if (route == '/kanban') return 2;
    if (route == '/ready') return 3;
    if (route == '/blocked') return 4;
    if (route == '/graph') return 5;
    return 0;
  }

  void _onTabChanged(BuildContext context, int index) {
    if (index == 0) context.go('/');
    if (index == 1) context.go('/tree');
    if (index == 2) context.go('/kanban');
    if (index == 3) context.go('/ready');
    if (index == 4) context.go('/blocked');
    if (index == 5) context.go('/graph');
  }

  @override
  Widget build(BuildContext context) {
    final currentIndex = _getIndexFromRoute(currentRoute);
    final theme = MacosTheme.of(context);
    final isDark = theme.brightness.isDark;

    // Very subtle, translucent background for the entire control
    final backgroundColor = isDark
        ? MacosColors.white.withValues(alpha: 0.1)
        : MacosColors.black.withValues(alpha: 0.05);

    // Active item background
    final activeColor = isDark ? const Color(0xFF646669) : MacosColors.white;

    return Container(
      height: 22,
      decoration: BoxDecoration(
        color: backgroundColor,
        borderRadius: BorderRadius.circular(5.0),
      ),
      child: Padding(
        padding: const EdgeInsets.all(1.0),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            _buildSegment(
              context: context,
              icon: CupertinoIcons.square_grid_2x2,
              tooltip: 'Dashboard',
              isSelected: currentIndex == 0,
              activeColor: activeColor,
              onTap: () => _onTabChanged(context, 0),
            ),
            _buildDivider(isDark, currentIndex == 0 || currentIndex == 1),
            _buildSegment(
              context: context,
              icon: CupertinoIcons.list_bullet_indent,
              tooltip: 'Tree View',
              isSelected: currentIndex == 1,
              activeColor: activeColor,
              onTap: () => _onTabChanged(context, 1),
            ),
            _buildDivider(isDark, currentIndex == 1 || currentIndex == 2),
            _buildSegment(
              context: context,
              icon: CupertinoIcons.square_split_2x1,
              tooltip: 'Kanban Board',
              isSelected: currentIndex == 2,
              activeColor: activeColor,
              onTap: () => _onTabChanged(context, 2),
            ),
            _buildDivider(isDark, currentIndex == 2 || currentIndex == 3),
            _buildSegment(
              context: context,
              icon: CupertinoIcons.checkmark_circle,
              tooltip: 'Ready Queue',
              isSelected: currentIndex == 3,
              activeColor: activeColor,
              onTap: () => _onTabChanged(context, 3),
            ),
            _buildDivider(isDark, currentIndex == 3 || currentIndex == 4),
            _buildSegment(
              context: context,
              icon: CupertinoIcons.exclamationmark_circle,
              tooltip: 'Blocked Issues',
              isSelected: currentIndex == 4,
              activeColor: activeColor,
              onTap: () => _onTabChanged(context, 4),
            ),
            _buildDivider(isDark, currentIndex == 4 || currentIndex == 5),
            _buildSegment(
              context: context,
              icon: CupertinoIcons.arrow_branch,
              tooltip: 'Dependency Graph',
              isSelected: currentIndex == 5,
              activeColor: activeColor,
              onTap: () => _onTabChanged(context, 5),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSegment({
    required BuildContext context,
    required IconData icon,
    required String tooltip,
    required bool isSelected,
    required Color activeColor,
    required VoidCallback onTap,
  }) {
    return MacosTooltip(
      message: tooltip,
      child: GestureDetector(
        onTap: onTap,
        child: MouseRegion(
          cursor: SystemMouseCursors.click,
          child: Container(
            width: 28,
            decoration: BoxDecoration(
              color: isSelected ? activeColor : MacosColors.transparent,
              borderRadius: BorderRadius.circular(4.0),
              boxShadow: isSelected
                  ? [
                      BoxShadow(
                        color: MacosColors.black.withValues(alpha: 0.1),
                        offset: const Offset(0, 1),
                        blurRadius: 1,
                      ),
                      BoxShadow(
                        color: MacosColors.black.withValues(alpha: 0.05),
                        offset: const Offset(0, 0),
                        blurRadius: 0.5,
                        spreadRadius: 0.5,
                      ),
                    ]
                  : null,
            ),
            child: Center(
              child: MacosIcon(
                icon,
                size: 16,
                color: MacosTheme.of(context).typography.body.color,
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildDivider(bool isDark, bool hideDivider) {
    if (hideDivider) return const SizedBox(width: 1);
    return Container(
      width: 1,
      height: 12,
      color: isDark
          ? MacosColors.white.withValues(alpha: 0.15)
          : MacosColors.black.withValues(alpha: 0.15),
    );
  }
}
