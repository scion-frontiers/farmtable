import 'package:flutter/cupertino.dart';
import 'package:macos_ui/macos_ui.dart';

/// UI-01 (r1f.4): a single, reusable priority badge used across the app so
/// padding, sizing, colors, and font weights stay consistent (and so priority
/// is always shown with a TEXT label `P<n>`, which also satisfies the
/// colorblind-accessibility concern in A11Y-03).
///
/// Replaces the previously divergent per-screen implementations in
/// tree_node, ready_queue_screen, blocked_screen, kanban_card (and the dot-only
/// indicator in the command palette).
class PriorityBadge extends StatelessWidget {
  final int priority;

  /// When true, render a more compact badge (smaller font/padding) for dense
  /// rows like Kanban cards and list chips.
  final bool compact;

  const PriorityBadge({
    super.key,
    required this.priority,
    this.compact = false,
  });

  static Color colorFor(int priority, BuildContext context) {
    final Color base;
    switch (priority) {
      case 0:
        base = MacosColors.systemRedColor;
      case 1:
        base = MacosColors.systemOrangeColor;
      case 2:
        base = MacosColors.systemYellowColor;
      case 3:
        base = MacosColors.systemBlueColor;
      default:
        base = MacosColors.systemGrayColor;
    }
    return MacosDynamicColor.resolve(base, context);
  }

  @override
  Widget build(BuildContext context) {
    final color = colorFor(priority, context);
    return Semantics(
      label: 'Priority $priority',
      child: MacosTooltip(
        message: 'Priority $priority',
        child: Container(
          alignment: Alignment.center,
          padding: EdgeInsets.symmetric(horizontal: compact ? 4 : 6),
          decoration: BoxDecoration(
            color: color.withValues(alpha: 0.15),
            borderRadius: BorderRadius.circular(4),
            border: Border.all(color: color.withValues(alpha: 0.3)),
          ),
          child: Text(
            'P$priority',
            style: TextStyle(
              fontSize: compact ? 9 : 10,
              color: color,
              fontWeight: FontWeight.w600,
              height: 1.0,
            ),
          ),
        ),
      ),
    );
  }
}
