import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart' show SelectableText;
import 'package:flutter/services.dart';
import 'package:macos_ui/macos_ui.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../main.dart';
import '../models/issue.dart';
import '../state/app_state.dart';
import '../utils/dialog_utils.dart';
import '../utils/date_formatters.dart';
import 'label_chip.dart';

class IssueInspector extends StatefulWidget {
  final Issue issue;
  final ScrollController scrollController;

  const IssueInspector({
    super.key,
    required this.issue,
    required this.scrollController,
  });

  @override
  State<IssueInspector> createState() => _IssueInspectorState();
}

// Keys for persisted collapsible section state.
const _kCollapseDescription = 'inspector.collapse.description';
const _kCollapseNotes       = 'inspector.collapse.notes';
const _kCollapseDesign      = 'inspector.collapse.design';
const _kCollapseAcceptance  = 'inspector.collapse.acceptance_criteria';
const _kCollapseDeps        = 'inspector.collapse.dependencies';
const _kCollapseComments    = 'inspector.collapse.comments';

class _IssueInspectorState extends State<IssueInspector> {
  final _commentController = TextEditingController();
  final _labelController = TextEditingController();

  // HIG-FIX: controllers lifted to state so they survive rebuilds and don't
  // silently discard in-progress edits when a sibling field changes.
  late TextEditingController _ownerController;
  late TextEditingController _assigneeController;

  // Whether the inline "Add label" text field is currently revealed.
  bool _addingLabel = false;

  // Collapsible section state — expanded by default.
  bool _descExpanded   = true;
  bool _notesExpanded  = true;
  bool _designExpanded = true;
  bool _acExpanded     = true;
  bool _depsExpanded   = true;
  bool _commentsExpanded = true;

  @override
  void initState() {
    super.initState();
    _ownerController = TextEditingController(
      text: widget.issue.owner ?? '',
    );
    _assigneeController = TextEditingController(
      text: widget.issue.assignee ?? '',
    );
    _loadCollapsePrefs();
  }

  Future<void> _loadCollapsePrefs() async {
    final prefs = await SharedPreferences.getInstance();
    if (!mounted) return;
    setState(() {
      _descExpanded    = prefs.getBool(_kCollapseDescription) ?? true;
      _notesExpanded   = prefs.getBool(_kCollapseNotes)       ?? true;
      _designExpanded  = prefs.getBool(_kCollapseDesign)      ?? true;
      _acExpanded      = prefs.getBool(_kCollapseAcceptance)  ?? true;
      _depsExpanded    = prefs.getBool(_kCollapseDeps)        ?? true;
      _commentsExpanded= prefs.getBool(_kCollapseComments)    ?? true;
    });
  }

  Future<void> _toggleSection(String key, bool current) async {
    final next = !current;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(key, next);
    if (!mounted) return;
    setState(() {
      switch (key) {
        case _kCollapseDescription: _descExpanded    = next;
        case _kCollapseNotes:       _notesExpanded   = next;
        case _kCollapseDesign:      _designExpanded  = next;
        case _kCollapseAcceptance:  _acExpanded      = next;
        case _kCollapseDeps:        _depsExpanded    = next;
        case _kCollapseComments:    _commentsExpanded= next;
      }
    });
  }

  @override
  void didUpdateWidget(IssueInspector oldWidget) {
    super.didUpdateWidget(oldWidget);
    // When a different issue is selected, sync the controllers.
    if (oldWidget.issue.id != widget.issue.id) {
      _ownerController.text = widget.issue.owner ?? '';
      _assigneeController.text = widget.issue.assignee ?? '';
    }
  }

  @override
  void dispose() {
    _commentController.dispose();
    _labelController.dispose();
    _ownerController.dispose();
    _assigneeController.dispose();
    super.dispose();
  }

  /// REL-01 / RACE-03: run an issue mutation and show a native alert on failure
  /// or on a concurrent-edit conflict, instead of silently swallowing it.
  Future<void> _mutate(Future<MutationResult> Function() action) async {
    final result = await action();
    if (!mounted) return;
    switch (result) {
      case MutationResult.success:
        break;
      case MutationResult.conflict:
        await DialogUtils.showError(
          context,
          title: 'Issue Changed by Someone Else',
          message:
              'This issue was updated elsewhere while you were editing it, so '
              'your change was not saved. It has been refreshed with the latest '
              'values — please review and try again if needed.',
        );
      case MutationResult.failure:
        await DialogUtils.showError(
          context,
          title: 'Update Failed',
          message:
              'The change could not be saved. See the project error banner for '
              'details, then try again.',
        );
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = MacosTheme.of(context);
    final issue = widget.issue;

    // HIG-FIX: removed hardcoded width: 300 — the Sidebar's resizable pane
    // controls width; the inspector fills whatever it is allocated.
    return Container(
      decoration: BoxDecoration(
        border: Border(left: BorderSide(color: theme.dividerColor)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _buildHeader(context),
          Expanded(
            child: SingleChildScrollView(
              controller: widget.scrollController,
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Core Attributes
                  _buildStatusDropdown(context),
                  _buildPriorityDropdown(context),
                  _buildSection('Type', issue.issueType.toUpperCase(), context),

                  // Close Reason (shown when issue is closed)
                  if (issue.closeReason?.isNotEmpty == true)
                    _buildSection(
                      'Close Reason',
                      issue.closeReason!,
                      context,
                    ),

                  // Labels (section always shown so the add-label affordance
                  // is available even when the issue has no labels yet).
                  _buildLabelsSection(context, issue.labels ?? const []),

                  // People
                  _buildEditableField(
                    'Owner',
                    _ownerController,
                    context,
                    (value) {
                      _mutate(
                        () => appState.updateIssue(issue.id, owner: value),
                      );
                    },
                  ),
                  _buildEditableField(
                    'Assignee',
                    _assigneeController,
                    context,
                    (value) {
                      _mutate(
                        () => appState.updateIssue(issue.id, assignee: value),
                      );
                    },
                  ),

                  // Dependencies (collapsible)
                  _CollapsibleSection(
                    title: 'Dependencies',
                    expanded: _depsExpanded,
                    onToggle: () => _toggleSection(
                      _kCollapseDeps,
                      _depsExpanded,
                    ),
                    child: _buildDependenciesContent(context),
                  ),

                  const SizedBox(height: 4),
                  Container(height: 1, color: theme.dividerColor),
                  const SizedBox(height: 4),

                  // Description (collapsible)
                  _CollapsibleSection(
                    title: 'Description',
                    expanded: _descExpanded,
                    onToggle: () => _toggleSection(
                      _kCollapseDescription,
                      _descExpanded,
                    ),
                    child: SelectableText(
                      issue.description?.isNotEmpty == true
                          ? issue.description!
                          : 'No description provided.',
                      style: TextStyle(
                        color: issue.description?.isNotEmpty == true
                            ? null
                            : MacosColors.systemGrayColor,
                      ),
                    ),
                  ),

                  // Notes (collapsible, only when non-empty)
                  if (issue.notes?.isNotEmpty == true)
                    _CollapsibleSection(
                      title: 'Notes',
                      expanded: _notesExpanded,
                      onToggle: () => _toggleSection(
                        _kCollapseNotes,
                        _notesExpanded,
                      ),
                      child: SelectableText(issue.notes!),
                    ),

                  // Design (collapsible, only when non-empty)
                  if (issue.design?.isNotEmpty == true)
                    _CollapsibleSection(
                      title: 'Design',
                      expanded: _designExpanded,
                      onToggle: () => _toggleSection(
                        _kCollapseDesign,
                        _designExpanded,
                      ),
                      child: SelectableText(issue.design!),
                    ),

                  // Acceptance Criteria (collapsible, only when non-empty)
                  if (issue.acceptanceCriteria?.isNotEmpty == true)
                    _CollapsibleSection(
                      title: 'Acceptance Criteria',
                      expanded: _acExpanded,
                      onToggle: () => _toggleSection(
                        _kCollapseAcceptance,
                        _acExpanded,
                      ),
                      child: SelectableText(issue.acceptanceCriteria!),
                    ),

                  // Metadata (compact, always visible)
                  _buildMetadataSection(context, issue),

                  const SizedBox(height: 4),
                  Container(height: 1, color: theme.dividerColor),
                  const SizedBox(height: 4),

                  // Comments (collapsible)
                  _CollapsibleSection(
                    title: 'Comments',
                    expanded: _commentsExpanded,
                    onToggle: () => _toggleSection(
                      _kCollapseComments,
                      _commentsExpanded,
                    ),
                    child: _buildCommentsContent(context),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMetadataSection(BuildContext context, Issue issue) {
    final theme = MacosTheme.of(context);
    final textStyle = theme.typography.footnote.copyWith(
      color: MacosColors.systemGrayColor,
    );

    return Padding(
      padding: const EdgeInsets.only(top: 24, bottom: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (issue.createdBy != null && issue.createdBy!.isNotEmpty)
            Text(
              'Created by ${issue.createdBy} on ${_formatDate(issue.createdAt)}',
              style: textStyle,
            )
          else
            Text(
              'Created on ${_formatDate(issue.createdAt)}',
              style: textStyle,
            ),

          if (issue.startedAt != null)
            Text(
              'Started ${_formatDate(issue.startedAt!)}',
              style: textStyle,
            ),

          Text(
            'Last updated ${_formatDate(issue.updatedAt)}',
            style: textStyle,
          ),

          if (issue.closedAt != null)
            Text(
              'Closed on ${_formatDate(issue.closedAt!)}',
              style: textStyle,
            ),
        ],
      ),
    );
  }

  Widget _buildDependenciesContent(BuildContext context) {
    final issue = widget.issue;
    final all = appState.currentIssues;

    // ── Hierarchy ─────────────────────────────────────────────────────────
    final issueParent = issue.parent(all);
    final issueChildren = issue.children(all);

    // ── Blocks / Blocked By ───────────────────────────────────────────────
    // Canonical direction: a dep {depends_on_id: Y, type: 'blocks'} on this
    // issue means "this issue is BLOCKED BY Y."
    // blockedByIssues = the live blockers of this issue.
    // blocksIssues    = issues that are waiting on this issue to close.
    final blockedByIssues = issue.blockers(all);
    final blocksIssues = issue.blocking(all);

    // ── Related / Discovered-from ─────────────────────────────────────────
    final related = issue.relatedLinks(all);

    final hasHierarchy = issueParent != null || issueChildren.isNotEmpty;
    final hasBlocks = blockedByIssues.isNotEmpty || blocksIssues.isNotEmpty;
    final hasRelated = related.isNotEmpty;

    if (!hasHierarchy && !hasBlocks && !hasRelated) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'No dependencies.',
            style: TextStyle(color: MacosColors.systemGrayColor),
          ),
          const SizedBox(height: 4),
          _buildAddDependencyButton(context),
        ],
      );
    }

    return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // ── Hierarchy section ───────────────────────────────────────────
          if (hasHierarchy) ...[
            _depSectionLabel('Hierarchy', context),
            if (issueParent != null) ...[
              _depSubLabel('Parent', context),
              _buildIssueLink(issueParent, context),
            ],
            if (issueChildren.isNotEmpty) ...[
              _depSubLabel('Children (${issueChildren.length})', context),
              ...issueChildren.map((c) => _buildIssueLink(c, context)),
            ],
            const SizedBox(height: 10),
          ],

          // ── Blocked-by section ──────────────────────────────────────────
          if (blockedByIssues.isNotEmpty) ...[
            _depSectionLabel('Blocked By', context),
            ...blockedByIssues.map(
              (i) => _buildIssueLink(i, context, dimIfClosed: true),
            ),
            const SizedBox(height: 10),
          ],

          // ── Blocks section ──────────────────────────────────────────────
          if (blocksIssues.isNotEmpty) ...[
            _depSectionLabel('Blocks', context),
            ...blocksIssues.map(
              (i) => _buildIssueLink(i, context, dimIfClosed: true),
            ),
            const SizedBox(height: 10),
          ],

          // ── Related / Discovered-from ───────────────────────────────────
          if (hasRelated) ...[
            _depSectionLabel('Related', context),
            ...related.map((entry) {
              final label = entry.key == 'discovered-from'
                  ? 'Discovered from'
                  : 'Related';
              return _buildIssueLink(entry.value, context, prefixLabel: label);
            }),
            const SizedBox(height: 10),
          ],
          // ── Add dependency button ───────────────────────────────────────
          _buildAddDependencyButton(context),
        ],
      );
  }

  // HIG-FIX: wrapped in Focus so Tab navigation can reach it, and handles
  // Enter/Space to activate — satisfying HIG keyboard-centricity requirement.
  Widget _buildAddDependencyButton(BuildContext context) {
    return Focus(
      onKeyEvent: (node, event) {
        if (event is KeyDownEvent &&
            (event.logicalKey == LogicalKeyboardKey.enter ||
                event.logicalKey == LogicalKeyboardKey.space ||
                event.logicalKey == LogicalKeyboardKey.numpadEnter)) {
          _showAddDependencySheet(context);
          return KeyEventResult.handled;
        }
        return KeyEventResult.ignored;
      },
      child: Semantics(
        button: true,
        label: 'Add dependency',
        child: GestureDetector(
          onTap: () => _showAddDependencySheet(context),
          child: MouseRegion(
            cursor: SystemMouseCursors.click,
            child: Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const MacosIcon(
                    CupertinoIcons.plus_circle,
                    size: 13,
                    color: MacosColors.systemGrayColor,
                  ),
                  const SizedBox(width: 4),
                  Text(
                    'Add dependency',
                    style: MacosTheme.of(context).typography.footnote.copyWith(
                      color: MacosColors.systemGrayColor,
                      decoration: TextDecoration.underline,
                      decorationColor: MacosColors.systemGrayColor.withValues(
                        alpha: 0.5,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  void _showAddDependencySheet(BuildContext context) {
    showMacosSheet(
      context: context,
      builder: (ctx) => _AddDependencySheet(forIssue: widget.issue),
    );
  }

  Widget _depSectionLabel(String title, BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 4),
      child: Text(
        title,
        style: MacosTheme.of(context).typography.footnote.copyWith(
          color: MacosColors.systemGrayColor,
          fontWeight: FontWeight.bold,
        ),
      ),
    );
  }

  Widget _depSubLabel(String title, BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 2),
      child: Text(
        title,
        style: MacosTheme.of(context).typography.footnote.copyWith(
          color: MacosColors.systemGrayColor,
          fontStyle: FontStyle.italic,
        ),
      ),
    );
  }

  /// A tappable link row for an issue.
  /// [dimIfClosed] fades closed issues so live blockers stand out.
  /// [prefixLabel] prepends a short type hint (e.g. "Discovered from").
  Widget _buildIssueLink(
    Issue target,
    BuildContext context, {
    bool dimIfClosed = false,
    String? prefixLabel,
  }) {
    final isClosed = target.status == 'closed';
    final linkColor = isClosed && dimIfClosed
        ? MacosColors.systemGrayColor
        : MacosTheme.of(context).primaryColor;

    return Semantics(
      button: true,
      label: 'Open issue ${target.id}: ${target.title}',
      child: GestureDetector(
        onTap: () => appState.selectIssue(target),
        child: MouseRegion(
          cursor: SystemMouseCursors.click,
          child: Padding(
            padding: const EdgeInsets.only(bottom: 4),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (prefixLabel != null) ...[
                  Text(
                    '$prefixLabel → ',
                    style: MacosTheme.of(context).typography.footnote.copyWith(
                      color: MacosColors.systemGrayColor,
                    ),
                  ),
                ],
                Expanded(
                  child: Text(
                    '${target.id}  ${target.title}',
                    style: MacosTheme.of(context).typography.footnote.copyWith(
                      color: linkColor,
                      decoration: isClosed && dimIfClosed
                          ? TextDecoration.lineThrough
                          : TextDecoration.underline,
                      decorationColor: linkColor,
                    ),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildStatusDropdown(BuildContext context) {
    final issue = widget.issue;
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Status',
            style: MacosTheme.of(context).typography.footnote.copyWith(
              color: MacosColors.systemGrayColor,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 4),
          MacosPopupButton<String>(
            value: issue.status.toLowerCase(),
            onChanged: (String? newValue) {
              if (newValue != null && newValue != issue.status) {
                _mutate(() => appState.updateIssue(issue.id, status: newValue));
              }
            },
            items: const [
              MacosPopupMenuItem(value: 'open', child: Text('OPEN')),
              MacosPopupMenuItem(
                value: 'in_progress',
                child: Text('IN PROGRESS'),
              ),
              MacosPopupMenuItem(value: 'blocked', child: Text('BLOCKED')),
              MacosPopupMenuItem(value: 'closed', child: Text('CLOSED')),
              MacosPopupMenuItem(value: 'deferred', child: Text('DEFERRED')),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildPriorityDropdown(BuildContext context) {
    final issue = widget.issue;
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Priority',
            style: MacosTheme.of(context).typography.footnote.copyWith(
              color: MacosColors.systemGrayColor,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 4),
          MacosPopupButton<int>(
            value: issue.priority,
            onChanged: (int? newValue) {
              if (newValue != null && newValue != issue.priority) {
                _mutate(
                  () => appState.updateIssue(issue.id, priority: newValue),
                );
              }
            },
            items: const [
              MacosPopupMenuItem(value: 0, child: Text('P0 - Critical')),
              MacosPopupMenuItem(value: 1, child: Text('P1 - High')),
              MacosPopupMenuItem(value: 2, child: Text('P2 - Medium')),
              MacosPopupMenuItem(value: 3, child: Text('P3 - Low')),
              MacosPopupMenuItem(value: 4, child: Text('P4 - Backlog')),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildHeader(BuildContext context) {
    final issue = widget.issue;
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        border: Border(
          bottom: BorderSide(color: MacosTheme.of(context).dividerColor),
        ),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  issue.id,
                  style: MacosTheme.of(context).typography.footnote.copyWith(
                    color: MacosColors.systemGrayColor,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  issue.title,
                  style: MacosTheme.of(context).typography.headline,
                  // UI-03 (r1f.8): clamp long titles instead of wrapping.
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCommentsContent(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (appState.selectedIssueComments.isEmpty)
          Text(
            'No comments yet.',
            style: MacosTheme.of(context).typography.footnote.copyWith(
              color: MacosColors.systemGrayColor,
              fontStyle: FontStyle.italic,
            ),
          )
        else
          ListView.separated(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: appState.selectedIssueComments.length,
            separatorBuilder: (context, index) => const SizedBox(height: 12),
            itemBuilder: (context, index) {
              final comment = appState.selectedIssueComments[index];
              return Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: MacosDynamicColor.resolve(
                    MacosTheme.of(context).brightness.isDark
                        ? MacosColors.alternatingContentBackgroundColor
                        : MacosColors.controlBackgroundColor,
                    context,
                  ),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          comment['author']?.toString() ?? 'Unknown',
                          style: MacosTheme.of(context).typography.body
                              .copyWith(
                                fontWeight: FontWeight.bold,
                                fontSize: 12,
                              ),
                        ),
                        Text(
                          comment['created_at'] != null
                              ? _formatDate(
                                  DateTime.parse(
                                    comment['created_at'].toString(),
                                  ).toLocal(),
                                )
                              : '',
                          style: MacosTheme.of(context).typography.footnote
                              .copyWith(
                                color: MacosColors.systemGrayColor,
                                fontSize: 10,
                              ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    // HIG-FIX: SelectableText so comment bodies can be copied.
                    SelectableText(
                      comment['text']?.toString() ?? '',
                      style: MacosTheme.of(
                        context,
                      ).typography.body.copyWith(fontSize: 13),
                    ),
                  ],
                ),
              );
            },
          ),
        const SizedBox(height: 12),
        Row(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Expanded(
              // A11Y-04 (r1f.7): name the field for screen readers.
              child: Semantics(
                textField: true,
                label: 'Add a comment',
                child: MacosTextField(
                  controller: _commentController,
                  placeholder: 'Add a comment...',
                  maxLines: 3,
                  minLines: 1,
                ),
              ),
            ),
            const SizedBox(width: 8),
            // HIG-FIX: tooltip on icon-only button.
            MacosTooltip(
              message: 'Submit comment',
              child: MacosIconButton(
                icon: MacosIcon(
                  CupertinoIcons.arrow_up_circle_fill,
                  color: MacosTheme.of(context).primaryColor,
                  size: 24,
                ),
                onPressed: () {
                  if (_commentController.text.trim().isNotEmpty) {
                    appState.addComment(
                      widget.issue.id,
                      _commentController.text.trim(),
                    );
                    _commentController.clear();
                  }
                },
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildLabelsSection(BuildContext context, List<String> labels) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Labels',
            style: MacosTheme.of(context).typography.footnote.copyWith(
              color: MacosColors.systemGrayColor,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 4),
          if (labels.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(bottom: 4),
              child: Wrap(
                spacing: 4,
                runSpacing: 4,
                children: labels
                    .map(
                      (label) => LabelChip(
                        label: label,
                        onRemove: () =>
                            appState.removeLabel(widget.issue.id, label),
                      ),
                    )
                    .toList(),
              ),
            ),
          _buildAddLabelControl(context, labels),
        ],
      ),
    );
  }

  // Same small tappable-link interaction shape as _buildAddDependencyButton:
  // a "+" link that reveals a text field, plus a simple filtered suggestion
  // list (from AppState.allKnownLabels) to reduce label sprawl from typos
  // (e.g. tech-debt vs tech_debt).
  Widget _buildAddLabelControl(BuildContext context, List<String> existing) {
    if (!_addingLabel) {
      return Focus(
        onKeyEvent: (node, event) {
          if (event is KeyDownEvent &&
              (event.logicalKey == LogicalKeyboardKey.enter ||
                  event.logicalKey == LogicalKeyboardKey.space ||
                  event.logicalKey == LogicalKeyboardKey.numpadEnter)) {
            setState(() => _addingLabel = true);
            return KeyEventResult.handled;
          }
          return KeyEventResult.ignored;
        },
        child: Semantics(
          button: true,
          label: 'Add label',
          child: GestureDetector(
            onTap: () => setState(() => _addingLabel = true),
            child: MouseRegion(
              cursor: SystemMouseCursors.click,
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const MacosIcon(
                    CupertinoIcons.plus_circle,
                    size: 13,
                    color: MacosColors.systemGrayColor,
                  ),
                  const SizedBox(width: 4),
                  Text(
                    'Add label',
                    style: MacosTheme.of(context).typography.footnote.copyWith(
                      color: MacosColors.systemGrayColor,
                      decoration: TextDecoration.underline,
                      decorationColor: MacosColors.systemGrayColor.withValues(
                        alpha: 0.5,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      );
    }

    final issue = widget.issue;
    final query = _labelController.text.trim().toLowerCase();
    final suggestions = appState.allKnownLabels
        .where((l) => !existing.contains(l))
        .where((l) => query.isEmpty || l.toLowerCase().contains(query))
        .take(6)
        .toList();

    void submit(String value) {
      final label = value.trim();
      if (label.isNotEmpty && !existing.contains(label)) {
        appState.addLabel(issue.id, label);
      }
      _labelController.clear();
      setState(() => _addingLabel = false);
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            Expanded(
              child: Semantics(
                textField: true,
                label: 'Add a label',
                child: MacosTextField(
                  controller: _labelController,
                  placeholder: 'New label…',
                  autofocus: true,
                  maxLines: 1,
                  onSubmitted: submit,
                  onChanged: (_) => setState(() {}),
                ),
              ),
            ),
            const SizedBox(width: 4),
            MacosTooltip(
              message: 'Cancel',
              child: MacosIconButton(
                icon: const MacosIcon(
                  CupertinoIcons.xmark_circle,
                  size: 16,
                  color: MacosColors.systemGrayColor,
                ),
                onPressed: () {
                  _labelController.clear();
                  setState(() => _addingLabel = false);
                },
              ),
            ),
          ],
        ),
        if (suggestions.isNotEmpty) ...[
          const SizedBox(height: 4),
          Wrap(
            spacing: 4,
            runSpacing: 4,
            children: suggestions.map((s) {
              return GestureDetector(
                onTap: () => submit(s),
                child: MouseRegion(
                  cursor: SystemMouseCursors.click,
                  child: LabelChip(label: s),
                ),
              );
            }).toList(),
          ),
        ],
      ],
    );
  }

  Widget _buildSection(String title, String value, BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: MacosTheme.of(context).typography.footnote.copyWith(
              color: MacosColors.systemGrayColor,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 2),
          Text(value),
        ],
      ),
    );
  }

  // HIG-FIX: accepts a pre-existing controller (owned by state) instead of
  // creating a new one on every build call.
  Widget _buildEditableField(
    String title,
    TextEditingController controller,
    BuildContext context,
    Function(String) onSubmitted,
  ) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: MacosTheme.of(context).typography.footnote.copyWith(
              color: MacosColors.systemGrayColor,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 4),
          // A11Y-04 (r1f.7): associate the section heading with the input.
          Semantics(
            textField: true,
            label: title,
            child: MacosTextField(
              controller: controller,
              maxLines: 1,
              onSubmitted: onSubmitted,
              placeholder: 'Unassigned',
            ),
          ),
        ],
      ),
    );
  }

  // UI-04 (r1f.9): delegates to the shared DateFormatters utility.
  String _formatDate(DateTime date) => DateFormatters.full(date);
}

// ─────────────────────────────────────────────────────────────────────────────
// Collapsible section header + body
// ─────────────────────────────────────────────────────────────────────────────

class _CollapsibleSection extends StatelessWidget {
  final String title;
  final bool expanded;
  final VoidCallback onToggle;
  final Widget child;

  const _CollapsibleSection({
    required this.title,
    required this.expanded,
    required this.onToggle,
    required this.child,
  });

  @override
  Widget build(BuildContext context) {
    final theme = MacosTheme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Disclosure header — tappable row with chevron.
        MouseRegion(
          cursor: SystemMouseCursors.click,
          child: GestureDetector(
            onTap: onToggle,
            behavior: HitTestBehavior.opaque,
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 8),
              child: Row(
                children: [
                  // Animated chevron.
                  AnimatedRotation(
                    turns: expanded ? 0.25 : 0,
                    duration: const Duration(milliseconds: 150),
                    child: MacosIcon(
                      CupertinoIcons.chevron_right,
                      size: 11,
                      color: MacosColors.systemGrayColor,
                    ),
                  ),
                  const SizedBox(width: 5),
                  Text(title, style: theme.typography.headline),
                ],
              ),
            ),
          ),
        ),
        // Animated body.
        AnimatedCrossFade(
          firstChild: Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: child,
          ),
          secondChild: const SizedBox.shrink(),
          crossFadeState: expanded
              ? CrossFadeState.showFirst
              : CrossFadeState.showSecond,
          duration: const Duration(milliseconds: 150),
        ),
      ],
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Add-dependency sheet
// ─────────────────────────────────────────────────────────────────────────────

class _AddDependencySheet extends StatefulWidget {
  final Issue forIssue;

  const _AddDependencySheet({required this.forIssue});

  @override
  State<_AddDependencySheet> createState() => _AddDependencySheetState();
}

class _AddDependencySheetState extends State<_AddDependencySheet> {
  static const _types = ['blocks', 'related', 'discovered-from'];

  String _selectedType = 'blocks';
  final _targetController = TextEditingController();
  String? _error;

  @override
  void dispose() {
    _targetController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final target = _targetController.text.trim();
    if (target.isEmpty) {
      setState(() => _error = 'Please enter a target issue ID.');
      return;
    }
    final exists = appState.currentIssues.any((i) => i.id == target);
    if (!exists) {
      setState(
        () => _error = 'Issue "$target" not found in the current project.',
      );
      return;
    }
    if (target == widget.forIssue.id) {
      setState(() => _error = 'An issue cannot depend on itself.');
      return;
    }

    Navigator.of(context).pop();
    await appState.addDependency(widget.forIssue.id, target, _selectedType);
  }

  @override
  Widget build(BuildContext context) {
    final theme = MacosTheme.of(context);
    return MacosSheet(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text('Add Dependency', style: theme.typography.largeTitle),
            const SizedBox(height: 4),
            Text(
              'From: ${widget.forIssue.id}',
              style: theme.typography.footnote.copyWith(
                color: MacosColors.systemGrayColor,
              ),
            ),
            const SizedBox(height: 20),
            Text(
              'Type',
              style: theme.typography.footnote.copyWith(
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 6),
            MacosPopupButton<String>(
              value: _selectedType,
              onChanged: (v) => setState(() => _selectedType = v ?? 'blocks'),
              items: _types
                  .map((t) => MacosPopupMenuItem(value: t, child: Text(t)))
                  .toList(),
            ),
            const SizedBox(height: 16),
            Text(
              'Target Issue ID',
              style: theme.typography.footnote.copyWith(
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 4),
            // A11Y-04 (r1f.7): name the target-id input.
            Semantics(
              textField: true,
              label: 'Target Issue ID',
              child: MacosTextField(
                controller: _targetController,
                placeholder: 'e.g. proj-abc',
                autofocus: true,
                onSubmitted: (_) => _submit(),
              ),
            ),
            if (_error != null) ...[
              const SizedBox(height: 8),
              Text(
                _error!,
                style: theme.typography.footnote.copyWith(
                  color: MacosColors.systemRedColor,
                ),
              ),
            ],
            const SizedBox(height: 24),
            Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                PushButton(
                  controlSize: ControlSize.regular,
                  secondary: true,
                  onPressed: () => Navigator.of(context).pop(),
                  child: const Text('Cancel'),
                ),
                const SizedBox(width: 12),
                PushButton(
                  controlSize: ControlSize.regular,
                  onPressed: _submit,
                  child: const Text('Add'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
