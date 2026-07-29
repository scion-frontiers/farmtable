import 'package:flutter/cupertino.dart';
import 'package:flutter/services.dart';
import 'package:flutter/material.dart' show Material, Colors;
import 'package:macos_ui/macos_ui.dart';
import '../main.dart';
import '../models/issue.dart';
import 'priority_badge.dart';

class CommandPalette extends StatefulWidget {
  const CommandPalette({super.key});

  static Future<void> show(BuildContext context) {
    return showGeneralDialog(
      context: context,
      barrierDismissible: true,
      barrierLabel: 'Dismiss Search',
      barrierColor: MacosColors.black.withValues(alpha: 0.15),
      transitionDuration: const Duration(milliseconds: 150),
      pageBuilder: (context, animation, secondaryAnimation) {
        return ScaleTransition(
          scale: CurvedAnimation(parent: animation, curve: Curves.easeOutQuad),
          child: const CommandPalette(),
        );
      },
    );
  }

  @override
  State<CommandPalette> createState() => _CommandPaletteState();
}

class _CommandPaletteState extends State<CommandPalette> {
  final _searchController = TextEditingController();
  final _focusNode = FocusNode();
  // A11Y-02: dedicated scope so Tab/Shift-Tab cycles within the palette only.
  final _focusScopeNode = FocusScopeNode();
  final _scrollController = ScrollController();
  List<Issue> _filteredIssues = [];
  int _selectedIndex = 0;

  // Dedicated FocusNode for the search text field so we can direct focus to
  // it explicitly without stealing from the outer key-handler Focus widget.
  final _searchFocusNode = FocusNode();

  @override
  void initState() {
    super.initState();
    _filteredIssues = appState.currentIssues;
    _searchController.addListener(_onSearchChanged);

    // Direct focus to the search input, not the outer Focus wrapper.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _searchFocusNode.requestFocus();
    });
  }

  @override
  void dispose() {
    _searchController.removeListener(_onSearchChanged);
    _searchController.dispose();
    _focusNode.dispose();
    _searchFocusNode.dispose();
    _focusScopeNode.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  void _onSearchChanged() {
    final query = _searchController.text.trim().toLowerCase();
    setState(() {
      if (query.isEmpty) {
        _filteredIssues = appState.currentIssues;
      } else {
        _filteredIssues = appState.currentIssues.where((issue) {
          final idMatch = issue.id.toLowerCase().contains(query);
          final titleMatch = issue.title.toLowerCase().contains(query);
          final descMatch =
              issue.description?.toLowerCase().contains(query) ?? false;
          final typeMatch = issue.issueType.toLowerCase().contains(query);
          final statusMatch = issue.status.toLowerCase().contains(query);
          final ownerMatch =
              issue.owner?.toLowerCase().contains(query) ?? false;
          final assigneeMatch =
              issue.assignee?.toLowerCase().contains(query) ?? false;

          return idMatch ||
              titleMatch ||
              descMatch ||
              typeMatch ||
              statusMatch ||
              ownerMatch ||
              assigneeMatch;
        }).toList();
      }

      // Keep selection within bounds
      if (_filteredIssues.isEmpty) {
        _selectedIndex = 0;
      } else {
        _selectedIndex = _selectedIndex.clamp(0, _filteredIssues.length - 1);
      }
    });
  }

  void _selectIssue(Issue issue) {
    appState.selectIssue(issue);
    Navigator.of(context).pop();
  }

  void _scrollSelectedIntoView() {
    if (_filteredIssues.isEmpty || !_scrollController.hasClients) return;

    const itemHeight = 54.0;
    final viewportHeight = _scrollController.position.viewportDimension;
    final currentOffset = _scrollController.offset;

    final selectedTop = _selectedIndex * itemHeight;
    final selectedBottom = selectedTop + itemHeight;

    if (selectedTop < currentOffset) {
      _scrollController.animateTo(
        selectedTop,
        duration: const Duration(milliseconds: 100),
        curve: Curves.easeOut,
      );
    } else if (selectedBottom > currentOffset + viewportHeight) {
      _scrollController.animateTo(
        selectedBottom - viewportHeight,
        duration: const Duration(milliseconds: 100),
        curve: Curves.easeOut,
      );
    }
  }

  Color _getStatusColor(String status) {
    switch (status) {
      case 'open':
        return MacosColors.systemOrangeColor.withValues(alpha: 0.15);
      case 'in_progress':
        return MacosColors.systemBlueColor.withValues(alpha: 0.15);
      case 'closed':
        return MacosColors.systemGreenColor.withValues(alpha: 0.15);
      default:
        return MacosColors.systemGrayColor.withValues(alpha: 0.15);
    }
  }

  Color _getStatusTextColor(String status) {
    switch (status) {
      case 'open':
        return MacosColors.systemOrangeColor;
      case 'in_progress':
        return MacosColors.systemBlueColor;
      case 'closed':
        return MacosColors.systemGreenColor;
      default:
        return MacosColors.systemGrayColor;
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = MacosTheme.of(context);
    final brightness = MacosTheme.brightnessOf(context);
    final isDark = brightness == Brightness.dark;

    final dialogBackground = isDark
        ? const Color(0xE01E1E1E) // Frosted dark
        : const Color(0xF0F5F5F7); // Frosted light

    // A11Y-02: trap Tab traversal inside the palette so keyboard focus cannot
    // escape into the background screen while this modal is open.
    return FocusScope(
      node: _focusScopeNode,
      child: FocusTraversalGroup(
        child: Focus(
          focusNode: _focusNode,
          onKeyEvent: (node, event) {
            if (event is KeyDownEvent) {
              if (event.logicalKey == LogicalKeyboardKey.arrowDown) {
                if (_filteredIssues.isNotEmpty) {
                  setState(() {
                    _selectedIndex =
                        (_selectedIndex + 1) % _filteredIssues.length;
                  });
                  _scrollSelectedIntoView();
                }
                return KeyEventResult.handled;
              } else if (event.logicalKey == LogicalKeyboardKey.arrowUp) {
                if (_filteredIssues.isNotEmpty) {
                  setState(() {
                    _selectedIndex =
                        (_selectedIndex - 1 + _filteredIssues.length) %
                        _filteredIssues.length;
                  });
                  _scrollSelectedIntoView();
                }
                return KeyEventResult.handled;
              } else if (event.logicalKey == LogicalKeyboardKey.enter ||
                  event.logicalKey == LogicalKeyboardKey.numpadEnter) {
                if (_filteredIssues.isNotEmpty &&
                    _selectedIndex >= 0 &&
                    _selectedIndex < _filteredIssues.length) {
                  _selectIssue(_filteredIssues[_selectedIndex]);
                }
                return KeyEventResult.handled;
              } else if (event.logicalKey == LogicalKeyboardKey.escape) {
                Navigator.of(context).pop();
                return KeyEventResult.handled;
              }
            }
            return KeyEventResult.ignored;
          },
          child: Center(
            child: Container(
              margin: const EdgeInsets.only(top: 80),
              alignment: Alignment.topCenter,
              child: Material(
                color: Colors.transparent,
                child: Container(
                  width: 600,
                  height: 400,
                  decoration: BoxDecoration(
                    color: dialogBackground,
                    borderRadius: BorderRadius.circular(12),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.3),
                        blurRadius: 20,
                        offset: const Offset(0, 10),
                      ),
                    ],
                    border: Border.all(
                      color: isDark
                          ? const Color(0xFF333333)
                          : const Color(0xFFE0E0E0),
                    ),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      // Search Input Header
                      Padding(
                        padding: const EdgeInsets.all(12.0),
                        child: Row(
                          children: [
                            const MacosIcon(
                              CupertinoIcons.search,
                              color: MacosColors.systemGrayColor,
                              size: 20,
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: MacosTextField(
                                controller: _searchController,
                                focusNode: _searchFocusNode,
                                placeholder:
                                    'Search issues by ID, title, description, assignee...',
                                decoration: const BoxDecoration(),
                                focusedDecoration: const BoxDecoration(),
                                style: theme.typography.title3,
                              ),
                            ),
                            const SizedBox(width: 8),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 6,
                                vertical: 3,
                              ),
                              decoration: BoxDecoration(
                                color: isDark
                                    ? const Color(0xFF3A333A)
                                    : const Color(0xFFE8E3E8),
                                borderRadius: BorderRadius.circular(4),
                              ),
                              child: Text(
                                'ESC',
                                style: theme.typography.caption2.copyWith(
                                  fontWeight: FontWeight.bold,
                                  color: theme.typography.caption1.color,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                      Container(
                        height: 1,
                        color: isDark
                            ? const Color(0xFF333333)
                            : const Color(0xFFE0E0E0),
                      ),
                      // Results List
                      Expanded(
                        child: _filteredIssues.isEmpty
                            ? Center(
                                child: Padding(
                                  padding: const EdgeInsets.all(16.0),
                                  child: Column(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      const MacosIcon(
                                        CupertinoIcons.search_circle,
                                        size: 48,
                                        color: MacosColors.systemGrayColor,
                                      ),
                                      const SizedBox(height: 12),
                                      Text(
                                        'No issues found',
                                        style: theme.typography.headline
                                            .copyWith(
                                              color:
                                                  MacosColors.systemGrayColor,
                                            ),
                                      ),
                                    ],
                                  ),
                                ),
                              )
                            : ListView.builder(
                                controller: _scrollController,
                                itemCount: _filteredIssues.length,
                                padding: const EdgeInsets.all(6),
                                itemBuilder: (context, index) {
                                  final issue = _filteredIssues[index];
                                  final isSelected = index == _selectedIndex;

                                  final itemBackground = isSelected
                                      ? theme.primaryColor.withValues(
                                          alpha: 0.15,
                                        )
                                      : Colors.transparent;

                                  return MouseRegion(
                                    onEnter: (_) {
                                      setState(() {
                                        _selectedIndex = index;
                                      });
                                    },
                                    child: Semantics(
                                      button: true,
                                      label:
                                          'Open issue ${issue.id}: ${issue.title}',
                                      child: GestureDetector(
                                        onTap: () => _selectIssue(issue),
                                        child: Container(
                                          padding: const EdgeInsets.symmetric(
                                            horizontal: 10,
                                            vertical: 8,
                                          ),
                                          margin: const EdgeInsets.symmetric(
                                            vertical: 2,
                                          ),
                                          decoration: BoxDecoration(
                                            color: itemBackground,
                                            borderRadius: BorderRadius.circular(
                                              6,
                                            ),
                                            border: isSelected
                                                ? Border.all(
                                                    color: theme.primaryColor
                                                        .withValues(alpha: 0.4),
                                                    width: 1,
                                                  )
                                                : Border.all(
                                                    color: Colors.transparent,
                                                    width: 1,
                                                  ),
                                          ),
                                          child: Row(
                                            children: [
                                              // A11Y-03 (r1f.6): text priority badge
                                              // instead of a color-only dot so
                                              // colorblind users can read P0..P4.
                                              PriorityBadge(
                                                priority: issue.priority,
                                                compact: true,
                                              ),
                                              const SizedBox(width: 10),
                                              // ID & Title
                                              Expanded(
                                                child: Column(
                                                  crossAxisAlignment:
                                                      alignmentStyle(context),
                                                  children: [
                                                    Row(
                                                      children: [
                                                        Text(
                                                          issue.id,
                                                          style: theme
                                                              .typography
                                                              .body
                                                              .copyWith(
                                                                fontWeight:
                                                                    FontWeight
                                                                        .bold,
                                                                color:
                                                                    isSelected
                                                                    ? theme
                                                                          .primaryColor
                                                                    : null,
                                                              ),
                                                        ),
                                                        const SizedBox(
                                                          width: 8,
                                                        ),
                                                        Container(
                                                          padding:
                                                              const EdgeInsets.symmetric(
                                                                horizontal: 5,
                                                                vertical: 1.5,
                                                              ),
                                                          decoration: BoxDecoration(
                                                            color:
                                                                _getStatusColor(
                                                                  issue.status,
                                                                ),
                                                            borderRadius:
                                                                BorderRadius.circular(
                                                                  4,
                                                                ),
                                                          ),
                                                          child: Text(
                                                            issue.status
                                                                .toUpperCase(),
                                                            style: theme
                                                                .typography
                                                                .caption2
                                                                .copyWith(
                                                                  fontSize: 9,
                                                                  fontWeight:
                                                                      FontWeight
                                                                          .bold,
                                                                  color: _getStatusTextColor(
                                                                    issue
                                                                        .status,
                                                                  ),
                                                                ),
                                                          ),
                                                        ),
                                                        if (issue
                                                                .assignee
                                                                ?.isNotEmpty ==
                                                            true) ...[
                                                          const SizedBox(
                                                            width: 8,
                                                          ),
                                                          Text(
                                                            '@${issue.assignee}',
                                                            style: theme
                                                                .typography
                                                                .caption1
                                                                .copyWith(
                                                                  color: MacosColors
                                                                      .systemGrayColor,
                                                                ),
                                                          ),
                                                        ],
                                                      ],
                                                    ),
                                                    const SizedBox(height: 3),
                                                    Text(
                                                      issue.title,
                                                      maxLines: 1,
                                                      overflow:
                                                          TextOverflow.ellipsis,
                                                      style: theme
                                                          .typography
                                                          .caption1
                                                          .copyWith(
                                                            color: isSelected
                                                                ? theme
                                                                      .typography
                                                                      .body
                                                                      .color
                                                                : MacosColors
                                                                      .systemGrayColor,
                                                          ),
                                                    ),
                                                  ],
                                                ),
                                              ),
                                              const SizedBox(width: 8),
                                              // Issue type indicator
                                              Text(
                                                issue.issueType.toUpperCase(),
                                                style: theme.typography.caption2
                                                    .copyWith(
                                                      fontSize: 10,
                                                      color: MacosColors
                                                          .systemGrayColor,
                                                    ),
                                              ),
                                            ],
                                          ),
                                        ),
                                      ),
                                    ),
                                  );
                                },
                              ),
                      ),
                      // Keyboard help footer
                      Container(
                        height: 1,
                        color: isDark
                            ? const Color(0xFF333333)
                            : const Color(0xFFE0E0E0),
                      ),
                      Padding(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 12.0,
                          vertical: 8.0,
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.end,
                          children: [
                            _buildKeyboardShortcutHint(
                              context,
                              '↑↓',
                              'Navigate',
                              isDark,
                            ),
                            const SizedBox(width: 16),
                            _buildKeyboardShortcutHint(
                              context,
                              '⏎',
                              'Select',
                              isDark,
                            ),
                            const SizedBox(width: 16),
                            _buildKeyboardShortcutHint(
                              context,
                              'ESC',
                              'Close',
                              isDark,
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  CrossAxisAlignment alignmentStyle(BuildContext context) {
    return CrossAxisAlignment.start;
  }

  Widget _buildKeyboardShortcutHint(
    BuildContext context,
    String keys,
    String label,
    bool isDark,
  ) {
    final theme = MacosTheme.of(context);
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
          decoration: BoxDecoration(
            color: isDark ? const Color(0xFF2C2C2E) : const Color(0xFFE5E5EA),
            borderRadius: BorderRadius.circular(4),
          ),
          child: Text(
            keys,
            style: theme.typography.caption2.copyWith(
              fontWeight: FontWeight.bold,
              color: theme.typography.caption1.color,
            ),
          ),
        ),
        const SizedBox(width: 4),
        Text(
          label,
          style: theme.typography.caption2.copyWith(
            color: MacosColors.systemGrayColor,
          ),
        ),
      ],
    );
  }
}
