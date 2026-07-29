import 'package:flutter_test/flutter_test.dart';
import 'package:agent_watcher/models/issue.dart';

// ---------------------------------------------------------------------------
// Helper: minimal Issue factory
// ---------------------------------------------------------------------------
Issue _issue({
  required String id,
  String status = 'open',
  List<Dependency>? deps,
}) {
  final now = DateTime.utc(2026);
  return Issue(
    id: id,
    title: id,
    status: status,
    priority: 2,
    issueType: 'task',
    createdAt: now,
    updatedAt: now,
    dependencies: deps,
  );
}

Dependency _blocksDep(String issueId, String dependsOnId) =>
    Dependency(issueId: issueId, dependsOnId: dependsOnId, type: 'blocks');

Dependency _parentChildDep(String issueId, String dependsOnId) => Dependency(
  issueId: issueId,
  dependsOnId: dependsOnId,
  type: 'parent-child',
);

Dependency _relatedDep(String issueId, String dependsOnId) =>
    Dependency(issueId: issueId, dependsOnId: dependsOnId, type: 'related');

Dependency _discoveredFromDep(String issueId, String dependsOnId) => Dependency(
  issueId: issueId,
  dependsOnId: dependsOnId,
  type: 'discovered-from',
);

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
void main() {
  group('IssueDependencies — canonical blocks direction', () {
    // Mirrors the real-world read-aloud example used to verify direction:
    //   ijo.3 carries depends_on=89j.3, type=blocks
    //   bd blocked reports: "ijo.3: Blocked by [89j.3]"
    //
    // Invariant: a dependency {depends_on_id: Y, type: 'blocks'} on issue X
    // means X IS BLOCKED BY Y (Y must close before X is actionable).

    test('blockers() returns the target issue when it is open', () {
      final ijo3 = _issue(id: 'ijo.3', deps: [_blocksDep('ijo.3', '89j.3')]);
      final s89j3 = _issue(id: '89j.3', status: 'open');
      final all = [ijo3, s89j3];

      expect(ijo3.blockers(all), contains(s89j3));
      expect(ijo3.blockers(all).length, 1);
    });

    test('blockers() does NOT return the target when it is closed', () {
      final ijo3 = _issue(id: 'ijo.3', deps: [_blocksDep('ijo.3', '89j.3')]);
      final s89j3 = _issue(id: '89j.3', status: 'closed');
      final all = [ijo3, s89j3];

      expect(ijo3.blockers(all), isEmpty);
    });

    test('isBlocked() is true when at least one open blocker exists', () {
      final ijo3 = _issue(id: 'ijo.3', deps: [_blocksDep('ijo.3', '89j.3')]);
      final s89j3 = _issue(id: '89j.3', status: 'open');
      expect(ijo3.isBlocked([ijo3, s89j3]), isTrue);
    });

    test('isBlocked() is false when all blockers are closed', () {
      final ijo3 = _issue(id: 'ijo.3', deps: [_blocksDep('ijo.3', '89j.3')]);
      final s89j3 = _issue(id: '89j.3', status: 'closed');
      expect(ijo3.isBlocked([ijo3, s89j3]), isFalse);
    });

    test('isBlocked() is false when issue has no blocks deps', () {
      final leaf = _issue(id: 'leaf');
      expect(leaf.isBlocked([leaf]), isFalse);
    });

    test(
      'blockers() is empty when the blocker id is not in the issue list',
      () {
        // A missing blocker (not in the in-memory list) does not crash and
        // is treated as non-blocking — don't invent blocks from dangling refs.
        final ijo3 = _issue(
          id: 'ijo.3',
          deps: [_blocksDep('ijo.3', 'missing-issue')],
        );
        expect(ijo3.blockers([ijo3]), isEmpty);
      },
    );

    test('multiple blockers: only open ones count', () {
      final task = _issue(
        id: 'task',
        deps: [
          _blocksDep('task', 'dep-a'), // open → still blocking
          _blocksDep('task', 'dep-b'), // closed → not blocking
        ],
      );
      final depA = _issue(id: 'dep-a', status: 'open');
      final depB = _issue(id: 'dep-b', status: 'closed');
      final all = [task, depA, depB];

      expect(task.blockers(all), [depA]);
      expect(task.isBlocked(all), isTrue);
    });
  });

  group('IssueDependencies — blocking() reverse lookup', () {
    test('blocking() returns issues that depend on this one', () {
      // ijo.3 blocks 89j.1 means 89j.1 depends_on ijo.3 → ijo.3.blocking() = [89j.1]
      // Wait — "ijo.3 blocks 89j.1" would be stored as a dep ON ijo.3 pointing at 89j.1?
      // No. Per canonical direction: dep stored ON THE BLOCKED ISSUE pointing at the blocker.
      // If ijo.3 is blocked by A, then ijo.3.deps = [{depends_on: A, type: blocks}].
      // blocking() = reverse = "who has a blocks dep pointing at ME?"
      final a = _issue(id: 'a');
      final b = _issue(
        id: 'b',
        deps: [_blocksDep('b', 'a')],
      ); // b is blocked by a
      final c = _issue(
        id: 'c',
        deps: [_blocksDep('c', 'a')],
      ); // c is blocked by a
      final d = _issue(id: 'd'); // no relation

      final all = [a, b, c, d];
      final result = a.blocking(all);

      expect(result, containsAll([b, c]));
      expect(result, isNot(contains(d)));
    });

    test('blocking() is empty for an issue nobody depends on', () {
      final issue = _issue(id: 'solo');
      expect(issue.blocking([issue]), isEmpty);
    });
  });

  group('IssueDependencies — parent()', () {
    test('parent() resolves via explicit parent-child dep', () {
      final epic = _issue(id: 'epic-a');
      final child = _issue(
        id: 'task-1',
        deps: [_parentChildDep('task-1', 'epic-a')],
      );
      expect(child.parent([epic, child]), equals(epic));
    });

    test('parent() resolves via dotted-ID convention', () {
      final epic = _issue(id: 'proj-x');
      final child = _issue(id: 'proj-x.1');
      expect(child.parent([epic, child]), equals(epic));
    });

    test('parent() returns null for a root issue', () {
      final root = _issue(id: 'root');
      expect(root.parent([root]), isNull);
    });

    test('parent() prefers explicit dep over dotted-ID when both present', () {
      final realParent = _issue(id: 'real-parent');
      final dotParent = _issue(id: 'real'); // would match dotted 'real.child'
      final child = _issue(
        id: 'real.child',
        deps: [_parentChildDep('real.child', 'real-parent')],
      );
      expect(child.parent([realParent, dotParent, child]), equals(realParent));
    });
  });

  group('IssueDependencies — children()', () {
    test('children() returns direct children only', () {
      final epic = _issue(id: 'ep');
      final child1 = _issue(id: 'ep.1');
      final child2 = _issue(
        id: 'ep-task',
        deps: [_parentChildDep('ep-task', 'ep')],
      );
      final grandchild = _issue(id: 'ep.1.a');
      final unrelated = _issue(id: 'other');
      final all = [epic, child1, child2, grandchild, unrelated];

      final result = epic.children(all);
      expect(result, containsAll([child1, child2]));
      expect(result, isNot(contains(grandchild))); // grandchild, not direct
      expect(result, isNot(contains(unrelated)));
    });
  });

  group('IssueDependencies — relatedLinks()', () {
    test('relatedLinks() returns related and discovered-from deps', () {
      final base = _issue(id: 'base');
      final rel = _issue(id: 'rel');
      final disc = _issue(id: 'disc');
      final issue = _issue(
        id: 'mine',
        deps: [
          _relatedDep('mine', 'rel'),
          _discoveredFromDep('mine', 'disc'),
          _blocksDep('mine', 'base'), // should NOT appear in relatedLinks
        ],
      );

      final links = issue.relatedLinks([base, rel, disc, issue]);
      final types = links.map((e) => e.key).toList();
      final targets = links.map((e) => e.value).toList();

      expect(types, containsAll(['related', 'discovered-from']));
      expect(types, isNot(contains('blocks')));
      expect(targets, containsAll([rel, disc]));
    });

    test('relatedLinks() is empty when no related deps exist', () {
      final issue = _issue(id: 'alone');
      expect(issue.relatedLinks([issue]), isEmpty);
    });
  });
}
