import 'package:flutter/cupertino.dart';
import 'package:macos_ui/macos_ui.dart';

/// UI-02 (r1f.5): a single reusable empty-state view so the "nothing here"
/// screens stop drifting in icon size, color, opacity, and typography.
///
/// Replaces the hand-rolled Center>Column blocks in kanban_screen,
/// tree_view_screen, ready_queue_screen, blocked_screen and
/// dependency_graph_screen.
class EmptyStateView extends StatelessWidget {
  final IconData icon;
  final String title;
  final String? subtitle;

  /// Optional icon tint. Defaults to a muted secondary label color.
  final Color? iconColor;

  const EmptyStateView({
    super.key,
    required this.icon,
    required this.title,
    this.subtitle,
    this.iconColor,
  });

  @override
  Widget build(BuildContext context) {
    final theme = MacosTheme.of(context);
    final resolvedIconColor =
        iconColor ??
        MacosDynamicColor.resolve(MacosColors.secondaryLabelColor, context);

    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            MacosIcon(icon, size: 48, color: resolvedIconColor),
            const SizedBox(height: 16),
            Text(
              title,
              textAlign: TextAlign.center,
              style: theme.typography.title1,
            ),
            if (subtitle != null) ...[
              const SizedBox(height: 8),
              Text(
                subtitle!,
                textAlign: TextAlign.center,
                style: theme.typography.body.copyWith(
                  color: MacosColors.systemGrayColor,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
