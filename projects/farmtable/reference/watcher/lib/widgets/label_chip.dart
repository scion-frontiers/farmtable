import 'package:flutter/cupertino.dart';
import 'package:macos_ui/macos_ui.dart';

/// UI-01 (r1f.4 sibling): a single, reusable label chip used across the app
/// so padding, sizing, and colors stay consistent — mirrors [PriorityBadge]'s
/// established shape exactly (see lib/widgets/priority_badge.dart).
///
/// Color assignment is DETERMINISTIC and CLIENT-SIDE ONLY: each label string
/// is hashed into a small, fixed, colorblind-friendly palette (adapted from
/// beads_viewer's Dracula-derived 10-color `LABEL_COLORS` set — see
/// docs/LABEL_AND_FEATURE_COMPARISON_beads_viewer.md). Nothing is persisted
/// and bd's label store gains no new schema/color column — this is purely a
/// rendering convenience, same as `bv`'s approach.
///
/// Special-case: labels prefixed `status:` render in neutral gray instead of
/// a hashed color, since they are metadata-about-metadata (seen in real
/// project data) rather than a user-chosen tag.
class LabelChip extends StatelessWidget {
  final String label;

  /// When true, render a more compact chip (smaller font/padding) for dense
  /// rows like Tree nodes, Kanban cards, and Ready/Blocked list rows.
  final bool compact;

  /// Optional remove affordance: when provided, a small "x" glyph is shown
  /// after the label text and tapping it invokes this callback. Left null
  /// (the default) in every read-only display context (Tree/Kanban/Ready/
  /// Blocked) — only the Inspector's editable labels section passes one.
  final VoidCallback? onRemove;

  const LabelChip({
    super.key,
    required this.label,
    this.compact = false,
    this.onRemove,
  });

  // A fixed, colorblind-friendly 10-color palette adapted from
  // beads_viewer's Dracula-derived LABEL_COLORS (pkg/export/viewer_assets/
  // graph.js:80-92 per the comparison doc) — colors are assigned by hashing
  // the label string, not by storing anything in bd.
  static const List<Color> _palette = [
    Color(0xFF8BE9FD), // Cyan
    Color(0xFF50FA7B), // Green
    Color(0xFFFFB86C), // Orange
    Color(0xFFFF79C6), // Pink
    Color(0xFFBD93F9), // Purple
    Color(0xFFB8860B), // Yellow (darkened from Dracula's #F1FA8C for AA
    // contrast against light chip backgrounds)
    Color(0xFFFF5555), // Red
    Color(0xFF6272A4), // Comment (muted blue-gray)
    Color(0xFF9AA0C3), // Selection (lightened from Dracula's near-black
    // #44475A so it remains visible on dark backgrounds too)
    Color(0xFF5A5F73), // Foreground-adjacent neutral (darkened from
    // Dracula's near-white #F8F8F2 for legibility on light backgrounds)
  ];

  static Color colorFor(String label, BuildContext context) {
    final Color base;
    if (label.startsWith('status:')) {
      base = MacosColors.systemGrayColor;
    } else {
      // Simple deterministic string hash (djb2-style) so the same label
      // always maps to the same palette entry, regardless of which other
      // labels happen to be loaded — this widget has no visibility into the
      // full set of labels in the project (it only ever sees one label at a
      // time), so a sort-then-cycle scheme like bv's isn't applicable here.
      var hash = 5381;
      for (final unit in label.codeUnits) {
        hash = ((hash << 5) + hash + unit) & 0x7fffffff;
      }
      base = _palette[hash % _palette.length];
    }
    return MacosDynamicColor.resolve(base, context);
  }

  @override
  Widget build(BuildContext context) {
    final color = colorFor(label, context);
    return Semantics(
      label: 'Label $label',
      child: MacosTooltip(
        message: label,
        child: Container(
          padding: EdgeInsets.symmetric(
            horizontal: compact ? 4 : 6,
            vertical: compact ? 0 : 1,
          ),
          decoration: BoxDecoration(
            color: color.withValues(alpha: 0.15),
            borderRadius: BorderRadius.circular(4),
            border: Border.all(color: color.withValues(alpha: 0.3)),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                label,
                style: TextStyle(
                  fontSize: compact ? 9 : 10,
                  color: color,
                  fontWeight: FontWeight.w600,
                  height: 1.0,
                ),
              ),
              if (onRemove != null) ...[
                SizedBox(width: compact ? 2 : 3),
                Semantics(
                  button: true,
                  label: 'Remove label $label',
                  child: GestureDetector(
                    onTap: onRemove,
                    child: MouseRegion(
                      cursor: SystemMouseCursors.click,
                      child: MacosIcon(
                        CupertinoIcons.xmark,
                        size: compact ? 8 : 9,
                        color: color,
                      ),
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
