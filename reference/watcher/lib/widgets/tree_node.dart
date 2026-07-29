import 'package:flutter/cupertino.dart';
import 'package:macos_ui/macos_ui.dart';
import '../main.dart';
import '../models/issue.dart';
import '../state/app_state.dart';
import '../utils/dialog_utils.dart';
import 'label_chip.dart';
import 'priority_badge.dart';

class TreeNode extends StatefulWidget {
  final Issue issue;
  final List<Issue> allIssues;
  final int depth;
  final bool defaultExpanded;

  const TreeNode({
    super.key,
    required this.issue,
    required this.allIssues,
    required this.depth,
    this.defaultExpanded = true,
  });

  @override
  State<TreeNode> createState() => _TreeNodeState();
}

class _TreeNodeState extends State<TreeNode> {
  late bool _isExpanded;

  @override
  void initState() {
    super.initState();
    // Initialize from persisted state if available, otherwise use default
    if (appState.expandedNodes.isNotEmpty) {
      _isExpanded = appState.isNodeExpanded(widget.issue.id);
    } else {
      _isExpanded = widget.defaultExpanded;
    }
  }

  void _toggleExpansion() {
    setState(() {
      _isExpanded = !_isExpanded;
    });
    appState.toggleNodeExpansion(widget.issue.id, _isExpanded);
  }

  @override
  Widget build(BuildContext context) {
    if (appState.expandedNodes.isNotEmpty) {
      _isExpanded = appState.isNodeExpanded(widget.issue.id);
    }

    // Find children of this issue and filter out closed issues,
    // UNLESS the closed child has its own open children.
    final children = widget.allIssues.where((potentialChild) {
      if (!potentialChild.isDirectChildOf(widget.issue)) return false;

      if (!appState.showClosedInTree && potentialChild.status == 'closed') {
        return potentialChild.hasOpenDescendant(widget.allIssues);
      }

      return true;
    }).toList();
    return Padding(
      padding: EdgeInsets.only(
        left: widget.depth == 0 ? 16 : 24,
        top: widget.depth == 0 ? 8 : 4,
        right: 16,
        bottom: widget.depth == 0 ? 8 : 0,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              if (children.isNotEmpty)
                GestureDetector(
                  onTap: _toggleExpansion,
                  child: MouseRegion(
                    cursor: SystemMouseCursors.click,
                    child: Padding(
                      padding: const EdgeInsets.only(right: 4.0),
                      child: MacosIcon(
                        _isExpanded
                            ? CupertinoIcons.chevron_down
                            : CupertinoIcons.chevron_right,
                        size: 12,
                        color: MacosColors.systemGrayColor,
                      ),
                    ),
                  ),
                )
              else
                const SizedBox(width: 16),
              Expanded(
                child: DragTarget<Issue>(
                  onWillAcceptWithDetails: (details) {
                    final dragged = details.data;
                    // Cannot drop on self
                    if (dragged.id == widget.issue.id) return false;
                    // Cannot drop epic onto another issue (to avoid epic hierarchy)
                    if (dragged.issueType == 'epic') return false;
                    // Prevent circular dependencies (dragged is an ancestor of target)
                    if (widget.issue.isDescendantOf(
                      dragged,
                      widget.allIssues,
                    )) {
                      return false;
                    }
                    return true;
                  },
                  onAcceptWithDetails: (details) async {
                    final dragged = details.data;
                    // REL-01/RACE-03: alert on failure or concurrent-edit conflict.
                    final result = await appState.updateIssue(
                      dragged.id,
                      parent: widget.issue.id,
                    );
                    if (!context.mounted || result == MutationResult.success) {
                      return;
                    }
                    await DialogUtils.showError(
                      context,
                      title: result == MutationResult.conflict
                          ? 'Issue Changed by Someone Else'
                          : 'Could Not Move Issue',
                      message: result == MutationResult.conflict
                          ? '${dragged.id} was updated elsewhere, so it was not '
                                'moved. The tree has been refreshed.'
                          : 'Failed to reparent ${dragged.id} under '
                                '${widget.issue.id}. Please try again.',
                    );
                  },
                  builder: (context, candidateData, rejectedData) {
                    final isHovered = candidateData.isNotEmpty;
                    final isSelected =
                        appState.selectedIssue?.id == widget.issue.id;
                    return Container(
                      decoration: BoxDecoration(
                        color: isSelected
                            ? MacosTheme.of(
                                context,
                              ).primaryColor.withValues(alpha: 0.15)
                            : (isHovered
                                  ? MacosTheme.of(
                                      context,
                                    ).primaryColor.withValues(alpha: 0.1)
                                  : null),
                        borderRadius: BorderRadius.circular(4),
                        border: isSelected
                            ? Border.all(
                                color: MacosTheme.of(
                                  context,
                                ).primaryColor.withValues(alpha: 0.3),
                                width: 1,
                              )
                            : null,
                      ),
                      child: Draggable<Issue>(
                        data: widget.issue,
                        feedback: Opacity(
                          opacity: 0.8,
                          child: Container(
                            padding: const EdgeInsets.all(8),
                            decoration: BoxDecoration(
                              color: MacosTheme.of(context).canvasColor,
                              borderRadius: BorderRadius.circular(8),
                              boxShadow: [
                                BoxShadow(
                                  color: const Color(
                                    0x33000000,
                                  ), // black with 0.2 alpha
                                  blurRadius: 8,
                                  offset: const Offset(0, 4),
                                ),
                              ],
                            ),
                            child: DefaultTextStyle(
                              style: MacosTheme.of(context).typography.body,
                              child: Text(
                                '${widget.issue.id} - ${widget.issue.title}',
                              ),
                            ),
                          ),
                        ),
                        childWhenDragging: Opacity(
                          opacity: 0.3,
                          child: GestureDetector(
                            onTap: () => appState.selectIssue(widget.issue),
                            child: MouseRegion(
                              cursor: SystemMouseCursors.click,
                              child: _buildIssueRow(
                                widget.issue,
                                context,
                                isRoot: widget.depth == 0,
                              ),
                            ),
                          ),
                        ),
                        child: Semantics(
                          button: true,
                          label:
                              'Open issue ${widget.issue.id}: ${widget.issue.title}',
                          child: GestureDetector(
                            onTap: () => appState.selectIssue(widget.issue),
                            child: MouseRegion(
                              cursor: SystemMouseCursors.click,
                              child: _buildIssueRow(
                                widget.issue,
                                context,
                                isRoot: widget.depth == 0,
                              ),
                            ),
                          ),
                        ),
                      ),
                    );
                  },
                ),
              ),
            ],
          ),
          if (children.isNotEmpty && _isExpanded)
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: children
                  .map(
                    (child) => TreeNode(
                      issue: child,
                      allIssues: widget.allIssues,
                      depth: widget.depth + 1,
                      defaultExpanded: widget.defaultExpanded,
                    ),
                  )
                  .toList(),
            ),
        ],
      ),
    );
  }

  Widget _buildIssueRow(
    Issue issue,
    BuildContext context, {
    required bool isRoot,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            MacosIcon(
              _getIconForType(issue.issueType),
              color: MacosTheme.of(context).primaryColor,
              size: 16,
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                '${issue.id} - ${issue.title}',
                style: TextStyle(
                  fontWeight: isRoot ? FontWeight.bold : FontWeight.normal,
                  fontSize: isRoot ? 14 : 13,
                  decoration: issue.status == 'closed'
                      ? TextDecoration.lineThrough
                      : null,
                  color: issue.status == 'closed'
                      ? MacosColors.systemGrayColor
                      : null,
                ),
              ),
            ),
            const SizedBox(width: 8),
            Row(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                // Blocker indicator — only shown when blocked by an open dep,
                // distinct from the status=='blocked' literal badge.
                if (issue.isBlocked(appState.currentIssues))
                  Padding(
                    padding: const EdgeInsets.only(right: 4),
                    child: MacosTooltip(
                      message:
                          'Blocked by ${issue.blockers(appState.currentIssues).length} open issue(s)',
                      child: const MacosIcon(
                        CupertinoIcons.exclamationmark_circle_fill,
                        size: 12,
                        color: MacosColors.systemRedColor,
                      ),
                    ),
                  ),
                // Hub indicator — shows how many issues depend on this one.
                _buildDepCountChip(issue, context),
                SizedBox(
                  width: 32,
                  height: 20,
                  child: Align(
                    alignment: Alignment.centerRight,
                    child: _buildPriorityBadge(issue.priority, context),
                  ),
                ),
                const SizedBox(width: 4),
                SizedBox(
                  width: 24,
                  height: 20,
                  child: Align(
                    alignment: Alignment.centerRight,
                    child: _buildStatusBadge(issue.status, context),
                  ),
                ),
              ],
            ),
          ],
        ),
        // UI: compact label chips under the title, same conditional pattern
        // as PriorityBadge — only render the row when labels are present.
        if (issue.labels?.isNotEmpty == true)
          Padding(
            padding: const EdgeInsets.only(left: 24, top: 2),
            child: Wrap(
              spacing: 4,
              runSpacing: 2,
              children: issue.labels!
                  .map((label) => LabelChip(label: label, compact: true))
                  .toList(),
            ),
          ),
      ],
    );
  }

  IconData _getIconForType(String type) {
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

  // UI-01 (r1f.4): delegates to the shared PriorityBadge widget.
  Widget _buildPriorityBadge(int priority, BuildContext context) =>
      PriorityBadge(priority: priority);

  /// Shows a small "↑N" chip when this issue is blocking N others,
  /// surfacing it as a hub that others depend on.
  Widget _buildDepCountChip(Issue issue, BuildContext context) {
    final n = issue.blocking(appState.currentIssues).length;
    if (n == 0) return const SizedBox.shrink();
    final color = MacosDynamicColor.resolve(
      MacosColors.systemOrangeColor,
      context,
    );
    return Padding(
      padding: const EdgeInsets.only(right: 4),
      child: MacosTooltip(
        message: 'Blocks $n other issue${n == 1 ? '' : 's'}',
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
          decoration: BoxDecoration(
            color: color.withValues(alpha: 0.15),
            borderRadius: BorderRadius.circular(4),
            border: Border.all(color: color.withValues(alpha: 0.3)),
          ),
          child: Text(
            '↑$n',
            style: TextStyle(
              fontSize: 10,
              color: color,
              fontWeight: FontWeight.w600,
              height: 1.0,
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildStatusBadge(String status, BuildContext context) {
    Color baseColor;
    IconData iconData;
    switch (status.toLowerCase()) {
      case 'open':
        baseColor = MacosColors.systemBlueColor;
        iconData = CupertinoIcons.circle;
        break;
      case 'in_progress':
        baseColor = MacosColors.systemPurpleColor;
        iconData = CupertinoIcons.circle_lefthalf_fill;
        break;
      case 'blocked':
        baseColor = MacosColors.systemRedColor;
        iconData = CupertinoIcons.minus_circle_fill;
        break;
      case 'deferred':
        baseColor = MacosColors.systemGrayColor;
        iconData = CupertinoIcons.snow;
        break;
      case 'closed':
        baseColor = MacosColors.systemGreenColor;
        iconData = CupertinoIcons.check_mark_circled_solid;
        break;
      default:
        baseColor = MacosColors.systemGrayColor;
        iconData = CupertinoIcons.circle;
    }
    final resolvedColor = MacosDynamicColor.resolve(baseColor, context);

    return MacosTooltip(
      message: 'Status: $status',
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 4.0),
        child: MacosIcon(iconData, color: resolvedColor, size: 16),
      ),
    );
  }
}
