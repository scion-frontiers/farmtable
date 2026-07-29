import 'package:flutter/cupertino.dart';
import 'package:macos_ui/macos_ui.dart';
import '../main.dart';
import '../models/issue.dart';
import 'label_chip.dart';
import 'priority_badge.dart';

class KanbanCard extends StatelessWidget {
  final Issue issue;

  const KanbanCard({super.key, required this.issue});

  @override
  Widget build(BuildContext context) {
    // If an agent has claimed it or it's in progress, lock it to prevent drag-and-drop state changes
    final bool isLocked =
        issue.status == 'in_progress' &&
        (issue.assignee != null && issue.assignee!.isNotEmpty);

    final cardContent = GestureDetector(
      onTap: () => appState.selectIssue(issue),
      child: MouseRegion(
        cursor: SystemMouseCursors.click,
        child: Container(
          margin: const EdgeInsets.all(8),
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: MacosDynamicColor.resolve(
              MacosTheme.of(context).brightness.isDark
                  ? MacosColors.alternatingContentBackgroundColor
                  : MacosColors.controlBackgroundColor,
              context,
            ),
            borderRadius: BorderRadius.circular(6),
            border: Border.all(color: MacosTheme.of(context).dividerColor),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      // UI-01 (r1f.4): surface priority on Kanban cards too.
                      PriorityBadge(priority: issue.priority, compact: true),
                      const SizedBox(width: 6),
                      Text(
                        issue.id,
                        style: MacosTheme.of(context).typography.footnote
                            .copyWith(color: MacosColors.systemGrayColor),
                      ),
                      if (isLocked) ...[
                        const SizedBox(width: 6),
                        const MacosTooltip(
                          message: 'Locked (Agent in process)',
                          child: MacosIcon(
                            CupertinoIcons.lock_fill,
                            size: 10,
                            color: MacosColors.systemGrayColor,
                          ),
                        ),
                      ],
                    ],
                  ),
                  _buildTypeBadge(issue.issueType),
                ],
              ),
              const SizedBox(height: 8),
              Text(
                issue.title,
                style: MacosTheme.of(
                  context,
                ).typography.body.copyWith(fontWeight: FontWeight.bold),
              ),
              if (issue.labels?.isNotEmpty == true) ...[
                const SizedBox(height: 6),
                _buildLabelChips(context),
              ],
              if (issue.assignee != null && issue.assignee!.isNotEmpty) ...[
                const SizedBox(height: 8),
                Text(
                  'Assignee: ${issue.assignee}',
                  style: MacosTheme.of(context).typography.footnote,
                ),
              ] else if (issue.owner != null && issue.owner!.isNotEmpty) ...[
                const SizedBox(height: 8),
                Text(
                  'Owner: ${issue.owner}',
                  style: MacosTheme.of(context).typography.footnote,
                ),
              ],
              _buildBlockerBadge(context),
            ],
          ),
        ),
      ),
    );

    if (isLocked) {
      return cardContent;
    }

    return Draggable<Issue>(
      data: issue,
      feedback: SizedBox(
        width: 284, // Approximate width of the card minus margins
        child: Opacity(opacity: 0.8, child: cardContent),
      ),
      childWhenDragging: Opacity(opacity: 0.3, child: cardContent),
      child: cardContent,
    );
  }

  // Card width is space-constrained, so cap to the first 2 label chips plus
  // a "+N" overflow indicator rather than wrapping an unbounded number.
  Widget _buildLabelChips(BuildContext context) {
    final labels = issue.labels!;
    const maxShown = 2;
    final shown = labels.take(maxShown);
    final overflow = labels.length - maxShown;
    return Wrap(
      spacing: 4,
      runSpacing: 4,
      children: [
        ...shown.map((label) => LabelChip(label: label, compact: true)),
        if (overflow > 0)
          MacosTooltip(
            message: labels.skip(maxShown).join(', '),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 4),
              decoration: BoxDecoration(
                color: MacosColors.systemGrayColor.withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(4),
                border: Border.all(
                  color: MacosColors.systemGrayColor.withValues(alpha: 0.3),
                ),
              ),
              child: Text(
                '+$overflow',
                style: const TextStyle(
                  fontSize: 9,
                  color: MacosColors.systemGrayColor,
                  fontWeight: FontWeight.w600,
                  height: 1.0,
                ),
              ),
            ),
          ),
      ],
    );
  }

  Widget _buildBlockerBadge(BuildContext context) {
    final blockers = issue.blockers(appState.currentIssues);
    if (blockers.isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(top: 8),
      child: Row(
        children: [
          const MacosIcon(
            CupertinoIcons.exclamationmark_circle_fill,
            size: 12,
            color: MacosColors.systemRedColor,
          ),
          const SizedBox(width: 4),
          Text(
            'Blocked by ${blockers.length}',
            style: MacosTheme.of(context).typography.footnote.copyWith(
              color: MacosColors.systemRedColor,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTypeBadge(String type) {
    Color color;
    switch (type.toLowerCase()) {
      case 'epic':
        color = MacosColors.systemPurpleColor;
        break;
      case 'bug':
        color = MacosColors.systemRedColor;
        break;
      case 'task':
        color = MacosColors.systemBlueColor;
        break;
      case 'feature':
        color = MacosColors.systemGreenColor;
        break;
      default:
        color = MacosColors.systemGrayColor;
    }
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.2),
        borderRadius: BorderRadius.circular(4),
      ),
      child: Text(
        type.toUpperCase(),
        style: TextStyle(
          fontSize: 10,
          color: color,
          fontWeight: FontWeight.bold,
        ),
      ),
    );
  }
}
