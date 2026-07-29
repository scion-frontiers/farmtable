import 'package:flutter_test/flutter_test.dart';
import 'package:agent_watcher/models/issue.dart';
import 'package:agent_watcher/models/interaction.dart';
import 'package:agent_watcher/models/ai_assistant.dart';

void main() {
  group('AIAssistantContext Model Tests', () {
    final now = DateTime.now();

    test('toPromptString compiles context successfully', () {
      final issue1 = Issue(
        id: 'watcher-1',
        title: 'Fix a critical bug',
        status: 'open',
        priority: 0,
        issueType: 'bug',
        createdAt: now,
        updatedAt: now,
        dependencies: [
          Dependency(
            issueId: 'watcher-1',
            dependsOnId: 'watcher-2',
            type: 'blocks',
          ),
        ],
      );

      final issue2 = Issue(
        id: 'watcher-2',
        title: 'Refactor Auth',
        status: 'closed',
        priority: 1,
        issueType: 'task',
        createdAt: now,
        updatedAt: now,
      );

      final health = HealthCheckResult(
        status: 'warning',
        diagnostics: [
          Diagnostic(
            issueId: 'watcher-1',
            type: 'cycle-detection',
            message: 'Cycle detected on watcher-1',
          ),
        ],
      );

      final interaction = Interaction(
        timestamp: now,
        actor: 'watcher-agent',
        action: 'closed_issue',
        issueId: 'watcher-2',
        extra: {'comment': 'Authentication refactored fully.'},
      );

      final context = AIAssistantContext(
        issues: [issue1, issue2],
        healthCheck: health,
        interactions: [interaction],
      );

      final promptString = context.toPromptString();

      expect(promptString, contains('=== AI ASSISTANT CONTEXT ==='));
      expect(
        promptString,
        contains('watcher-1 [bug, open, P0]: Fix a critical bug'),
      );
      expect(
        promptString,
        contains('watcher-2 [task, closed, P1]: Refactor Auth'),
      );
      expect(promptString, contains('watcher-1 blocks watcher-2'));
      expect(
        promptString,
        contains('cycle-detection on watcher-1: Cycle detected on watcher-1'),
      );
      expect(
        promptString,
        contains('watcher-agent closed_issue issue=watcher-2'),
      );
      expect(
        promptString,
        contains('comment="Authentication refactored fully."'),
      );
    });

    test('toPromptString handles empty state gracefully', () {
      final health = HealthCheckResult(status: 'ok', diagnostics: []);

      final context = AIAssistantContext(
        issues: [],
        healthCheck: health,
        interactions: [],
      );

      final promptString = context.toPromptString();

      expect(promptString, contains('(No issues found)'));
      expect(promptString, contains('(No dependencies declared)'));
      expect(promptString, contains('(None)'));
      expect(promptString, contains('(No recent activity)'));
    });
  });
}
