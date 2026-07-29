import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:agent_watcher/state/project_repository.dart';

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));

  final repo = ProjectRepository();

  // ── Load ──────────────────────────────────────────────────────────────────

  group('load()', () {
    test('returns empty list from blank prefs', () async {
      expect(await repo.load(), isEmpty);
    });

    test('reads modern JSON format correctly', () async {
      SharedPreferences.setMockInitialValues({
        'project_data': [
          jsonEncode({'path': '/a/b/proj', 'tmuxSessionName': 'my-session'}),
          jsonEncode({'path': '/c/d/other', 'tmuxSessionName': null}),
        ],
      });

      final projects = await repo.load();
      expect(projects.length, 2);
      expect(projects[0].path, '/a/b/proj');
      expect(projects[0].name, 'proj');
      expect(projects[0].tmuxSessionName, 'my-session');
      expect(projects[1].path, '/c/d/other');
      expect(projects[1].tmuxSessionName, isNull);
    });

    test(
      'falls back to legacy project_paths when project_data absent',
      () async {
        SharedPreferences.setMockInitialValues({
          'project_paths': ['/x/y/alpha', '/x/y/beta'],
        });

        final projects = await repo.load();
        expect(projects.length, 2);
        expect(projects[0].path, '/x/y/alpha');
        expect(projects[1].path, '/x/y/beta');
        // Legacy format has no tmuxSessionName
        expect(projects[0].tmuxSessionName, isNull);
      },
    );

    test('handles corrupt JSON entry by treating it as a bare path', () async {
      SharedPreferences.setMockInitialValues({
        'project_data': [
          'not-valid-json',
          jsonEncode({'path': '/ok'}),
        ],
      });

      final projects = await repo.load();
      expect(projects.length, 2);
      expect(projects[0].path, 'not-valid-json');
      expect(projects[1].path, '/ok');
    });
  });

  // ── Save + round-trip ──────────────────────────────────────────────────────

  group('save()', () {
    test('persists projects so a subsequent load returns them', () async {
      final original = [
        Project('/proj/a', tmuxSessionName: 'sess-a'),
        Project('/proj/b'),
      ];
      await repo.save(original);

      final loaded = await repo.load();
      expect(loaded.length, 2);
      expect(loaded[0].path, '/proj/a');
      expect(loaded[0].tmuxSessionName, 'sess-a');
      expect(loaded[1].path, '/proj/b');
      expect(loaded[1].tmuxSessionName, isNull);
    });

    test(
      'writes legacy project_paths key for backwards compatibility',
      () async {
        await repo.save([Project('/proj/x'), Project('/proj/y')]);

        final prefs = await SharedPreferences.getInstance();
        final paths = prefs.getStringList('project_paths');
        expect(paths, ['/proj/x', '/proj/y']);
      },
    );

    test('overwrites on subsequent saves', () async {
      await repo.save([Project('/proj/old')]);
      await repo.save([Project('/proj/new')]);

      final loaded = await repo.load();
      expect(loaded.length, 1);
      expect(loaded[0].path, '/proj/new');
    });

    test('save then load preserves tmuxSessionName null correctly', () async {
      await repo.save([Project('/proj/no-session')]);
      final loaded = await repo.load();
      expect(loaded.first.tmuxSessionName, isNull);
    });
  });

  // ── Project model ──────────────────────────────────────────────────────────

  group('Project', () {
    test('derives name from last path component', () {
      expect(Project('/a/b/my-project').name, 'my-project');
    });

    test('effectiveTmuxSessionName uses derived name when no custom name', () {
      final p = Project('/a/b/my project!');
      expect(p.effectiveTmuxSessionName, 'watcher_my_project_');
    });

    test('effectiveTmuxSessionName uses sanitised custom name when set', () {
      final p = Project('/a/b/proj', tmuxSessionName: 'My Session!');
      expect(p.effectiveTmuxSessionName, 'watcher_My_Session_');
    });

    test(
      'effectiveTmuxSessionName ignores empty custom name and falls back',
      () {
        final p = Project('/a/b/proj', tmuxSessionName: '');
        expect(p.effectiveTmuxSessionName, 'watcher_proj');
      },
    );
  });
}
