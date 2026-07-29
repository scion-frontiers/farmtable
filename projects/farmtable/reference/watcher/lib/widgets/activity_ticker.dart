import 'dart:convert' as dart_json;
import 'package:flutter/cupertino.dart';
import 'package:macos_ui/macos_ui.dart';
import '../main.dart';
import '../models/interaction.dart';
import '../utils/date_formatters.dart';

class ActivityTicker extends StatelessWidget {
  const ActivityTicker({super.key});

  @override
  Widget build(BuildContext context) {
    final interactions = appState.currentInteractions;
    if (interactions.isEmpty) {
      return Container(
        padding: const EdgeInsets.all(24),
        decoration: BoxDecoration(
          color: MacosDynamicColor.resolve(
            MacosTheme.of(context).brightness.isDark
                ? MacosColors.alternatingContentBackgroundColor
                : MacosColors.controlBackgroundColor,
            context,
          ),
          borderRadius: BorderRadius.circular(8),
        ),
        child: const Center(
          child: Text(
            'No recent activity found.',
            style: TextStyle(color: MacosColors.systemGrayColor),
          ),
        ),
      );
    }

    return Container(
      decoration: BoxDecoration(
        color: MacosDynamicColor.resolve(
          MacosTheme.of(context).brightness.isDark
              ? MacosColors.alternatingContentBackgroundColor
              : MacosColors.controlBackgroundColor,
          context,
        ),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: MacosTheme.of(context).dividerColor),
      ),
      child: ListView.separated(
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        itemCount: interactions.length > 20
            ? 20
            : interactions.length, // Show up to 20
        separatorBuilder: (context, index) =>
            Container(height: 1, color: MacosTheme.of(context).dividerColor),
        itemBuilder: (context, index) {
          final interaction = interactions[index];
          // UI-04 (r1f.9): shared formatter.
          final timeStr = DateFormatters.short(interaction.timestamp);

          return Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SizedBox(
                  width: 90,
                  child: Text(
                    timeStr,
                    style: const TextStyle(
                      color: MacosColors.systemGrayColor,
                      fontSize: 12,
                    ),
                  ),
                ),
                Expanded(
                  child: Wrap(
                    crossAxisAlignment: WrapCrossAlignment.center,
                    spacing: 4.0,
                    children: [
                      Text(
                        interaction.actor,
                        style: MacosTheme.of(context).typography.body.copyWith(
                          fontWeight: FontWeight.bold,
                          fontSize: 13,
                        ),
                      ),
                      _buildActionSemanticText(interaction, context),
                      if (interaction.issueId != null)
                        _buildIssueLink(interaction.issueId!, context),
                      if (interaction.action == 'closed')
                        _buildUnblockedBadge(interaction.issueId!, context),
                    ],
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _buildActionSemanticText(
    Interaction interaction,
    BuildContext context,
  ) {
    String text = interaction.action;

    if (interaction.action == 'field_change') {
      final field = interaction.field;
      if (field == 'status') {
        if (interaction.newValue == 'closed') {
          text = 'completed';
        } else {
          text = 'changed status of';
        }
      } else if (field == 'priority') {
        text = 'escalated priority to P${interaction.newValue} on';
      } else if (field == 'owner' || field == 'assignee') {
        text = 'reassigned';
      } else if (field == 'title') {
        text = 'renamed';
      } else {
        text = 'updated';
      }
    } else if (interaction.action == 'updated' &&
        interaction.newValue != null) {
      // Legacy support
      try {
        final Map<String, dynamic> changes = dart_json.jsonDecode(
          interaction.newValue!,
        );
        if (changes.containsKey('priority')) {
          text = 'escalated priority to P${changes['priority']} on';
        } else if (changes.containsKey('owner') ||
            changes.containsKey('assignee')) {
          text = 'reassigned';
        } else if (changes.containsKey('title')) {
          text = 'renamed';
        } else {
          text = 'updated';
        }
      } catch (_) {
        text = 'updated';
      }
    } else if (interaction.action == 'claimed') {
      text = 'claimed';
    } else if (interaction.action == 'closed') {
      // Legacy
      text = 'completed';
    } else if (interaction.action == 'created') {
      text = 'created';
    } else if (interaction.action == 'comment') {
      text = 'commented on';
    }

    return Text(
      text,
      style: MacosTheme.of(context).typography.body.copyWith(fontSize: 13),
    );
  }

  Widget _buildIssueLink(String issueId, BuildContext context) {
    final issue = appState.currentIssues
        .where((i) => i.id == issueId)
        .firstOrNull;
    final displayText = issue != null ? issue.title : issueId;

    return GestureDetector(
      onTap: () {
        if (issue != null) {
          appState.selectIssue(issue);
        }
      },
      child: MouseRegion(
        cursor: SystemMouseCursors.click,
        child: Text(
          displayText,
          style: TextStyle(
            fontSize: 13,
            color: MacosTheme.of(context).primaryColor,
            decoration: TextDecoration.underline,
          ),
        ),
      ),
    );
  }

  Widget _buildUnblockedBadge(String issueId, BuildContext context) {
    final issue = appState.currentIssues
        .where((i) => i.id == issueId)
        .firstOrNull;
    if (issue == null) return const SizedBox.shrink();

    final blocksCount =
        issue.dependencies?.where((d) => d.type == 'blocks').length ?? 0;
    if (blocksCount == 0) return const SizedBox.shrink();

    return Container(
      margin: const EdgeInsets.only(left: 4),
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: MacosColors.systemGreenColor.withValues(alpha: 0.2),
        borderRadius: BorderRadius.circular(4),
        border: Border.all(
          color: MacosColors.systemGreenColor.withValues(alpha: 0.5),
        ),
      ),
      child: Text(
        'Unblocked $blocksCount task${blocksCount == 1 ? '' : 's'}!',
        style: const TextStyle(
          fontSize: 11,
          color: MacosColors.systemGreenColor,
          fontWeight: FontWeight.bold,
        ),
      ),
    );
  }
}
