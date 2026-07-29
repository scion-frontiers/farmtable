import 'package:flutter_test/flutter_test.dart';
import 'package:agent_watcher/models/issue.dart';

void main() {
  group('IssueHierarchy extension', () {
    final now = DateTime.now();

    test(
      'isDirectChildOf detects implicit dotted parent-child relationships',
      () {
        final parent = Issue(
          id: 'epic-1',
          title: 'Epic 1',
          status: 'open',
          priority: 1,
          issueType: 'epic',
          createdAt: now,
          updatedAt: now,
        );

        final child = Issue(
          id: 'epic-1.task-1',
          title: 'Child Task',
          status: 'open',
          priority: 1,
          issueType: 'task',
          createdAt: now,
          updatedAt: now,
        );

        final nonChild = Issue(
          id: 'epic-2.task-1',
          title: 'Non Child',
          status: 'open',
          priority: 1,
          issueType: 'task',
          createdAt: now,
          updatedAt: now,
        );

        expect(child.isDirectChildOf(parent), isTrue);
        expect(nonChild.isDirectChildOf(parent), isFalse);
      },
    );

    test(
      'isDirectChildOf detects explicit parent-child relationships via dependencies',
      () {
        final parent = Issue(
          id: 'some-epic',
          title: 'Epic',
          status: 'open',
          priority: 1,
          issueType: 'epic',
          createdAt: now,
          updatedAt: now,
        );

        final child = Issue(
          id: 'independent-task',
          title: 'Child Task',
          status: 'open',
          priority: 1,
          issueType: 'task',
          createdAt: now,
          updatedAt: now,
          dependencies: [
            Dependency(
              issueId: 'independent-task',
              dependsOnId: 'some-epic',
              type: 'parent-child',
            ),
          ],
        );

        expect(child.isDirectChildOf(parent), isTrue);
      },
    );

    test('hasParentIn identifies if a parent exists in the list', () {
      final parent = Issue(
        id: 'epic-1',
        title: 'Epic 1',
        status: 'open',
        priority: 1,
        issueType: 'epic',
        createdAt: now,
        updatedAt: now,
      );

      final child = Issue(
        id: 'epic-1.task-1',
        title: 'Child Task',
        status: 'open',
        priority: 1,
        issueType: 'task',
        createdAt: now,
        updatedAt: now,
      );

      final issuesList = [parent, child];

      expect(child.hasParentIn(issuesList), isTrue);
      expect(parent.hasParentIn(issuesList), isFalse);
    });

    test('hasOpenDescendant works recursively', () {
      final root = Issue(
        id: 'epic',
        title: 'Epic',
        status: 'open',
        priority: 1,
        issueType: 'epic',
        createdAt: now,
        updatedAt: now,
      );

      final childClosed = Issue(
        id: 'epic.child1',
        title: 'Child 1',
        status: 'closed',
        priority: 1,
        issueType: 'task',
        createdAt: now,
        updatedAt: now,
      );

      final grandchildOpen = Issue(
        id: 'epic.child1.grandchild',
        title: 'Grandchild',
        status: 'open',
        priority: 1,
        issueType: 'task',
        createdAt: now,
        updatedAt: now,
      );

      final issuesList = [root, childClosed, grandchildOpen];

      expect(root.hasOpenDescendant(issuesList), isTrue);
    });

    test(
      'isDescendantOf identifies deep ancestors correctly without circular loops',
      () {
        final root = Issue(
          id: 'epic-a',
          title: 'Root Epic',
          status: 'open',
          priority: 1,
          issueType: 'epic',
          createdAt: now,
          updatedAt: now,
        );

        final mid = Issue(
          id: 'epic-a.task-b',
          title: 'Middle Task',
          status: 'open',
          priority: 1,
          issueType: 'task',
          createdAt: now,
          updatedAt: now,
        );

        final leaf = Issue(
          id: 'epic-a.task-b.subtask-c',
          title: 'Leaf Subtask',
          status: 'open',
          priority: 1,
          issueType: 'task',
          createdAt: now,
          updatedAt: now,
        );

        final allIssues = [root, mid, leaf];

        expect(leaf.isDescendantOf(root, allIssues), isTrue);
        expect(mid.isDescendantOf(root, allIssues), isTrue);
        expect(root.isDescendantOf(leaf, allIssues), isFalse);
      },
    );
  });
}
