import 'dart:convert';

import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:agent_watcher/state/settings_repository.dart';

// Minimal package_info stub shared across tests.
void _stubPackageInfo() {
  TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
      .setMockMethodCallHandler(
        const MethodChannel('dev.fluttercommunity.plus/package_info'),
        (call) async {
          if (call.method == 'getAll') {
            return {
              'appName': 'watcher',
              'packageName': 'wtf.ghc.watcher',
              'version': '1.0.0',
              'buildNumber': '1',
              'buildSignature': '',
            };
          }
          return null;
        },
      );
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    SharedPreferences.setMockInitialValues({});
    _stubPackageInfo();
  });

  final repo = SettingsRepository();

  // ── Load defaults ──────────────────────────────────────────────────────────

  group('load() — defaults on empty prefs', () {
    test('returns expected defaults', () async {
      final s = await repo.load();
      expect(s.syncIntervalMinutes, 5);
      expect(s.heartbeatIntervalSeconds, 30);
      expect(s.preferredTerminal, 'Ghostty');
      expect(s.showClosedInTree, isFalse);
      expect(s.customBdPath, isEmpty);
      expect(s.sidebarSortOrder, SidebarSortOrder.alphabetical);
      expect(s.gcpProjectId, isNull);
      expect(s.ghosttyTheme, isNull);
      expect(s.ghosttyFontFamily, isNull);
    });

    test('appVersion is populated from package_info', () async {
      final s = await repo.load();
      expect(s.appVersion, '1.0.0+1');
    });
  });

  // ── AI model seeding ───────────────────────────────────────────────────────

  group('AI model seeding', () {
    test('first-run seeds gemini-3.5-flash as the default', () async {
      final s = await repo.load();
      expect(s.aiModels, isNotEmpty);
      expect(s.defaultAiModel?.identifier, 'gemini-3.5-flash');
      expect(s.defaultAiModel?.region, 'global');
    });

    test(
      'seed is persisted so a second load returns the same models',
      () async {
        await repo.load();
        final s2 = await repo.load();
        expect(s2.aiModels.length, greaterThanOrEqualTo(2));
        expect(s2.defaultAiModel?.identifier, 'gemini-3.5-flash');
      },
    );

    test(
      'v2 migration upgrades gemini-3-flash-preview to gemini-3.5-flash',
      () async {
        final oldModel = GenerativeModelConfig(
          id: 'default-flash-3',
          displayName: 'Gemini 3 Flash (Preview)',
          identifier: 'gemini-3-flash-preview',
          region: 'global',
        );
        SharedPreferences.setMockInitialValues({
          'ai_models': [jsonEncode(oldModel.toJson())],
          'default_ai_model_id': 'default-flash-3',
          // model_seed_version absent → treated as v1
        });

        final s = await repo.load();
        expect(s.aiModels.first.identifier, 'gemini-3.5-flash');
        expect(s.aiModels.first.id, 'default-flash-3'); // id preserved
        expect(s.defaultAiModel?.identifier, 'gemini-3.5-flash');
      },
    );

    test('migration is idempotent for already-migrated installs', () async {
      final currentModel = GenerativeModelConfig(
        id: 'default-flash-3.5',
        displayName: 'Gemini 3.5 Flash',
        identifier: 'gemini-3.5-flash',
        region: 'global',
      );
      SharedPreferences.setMockInitialValues({
        'ai_models': [jsonEncode(currentModel.toJson())],
        'default_ai_model_id': 'default-flash-3.5',
        'model_seed_version': 2,
      });

      final s = await repo.load();
      expect(s.aiModels.first.identifier, 'gemini-3.5-flash');
    });
  });

  // ── Save round-trips ───────────────────────────────────────────────────────

  group('save/load round-trips', () {
    test('syncInterval', () async {
      await repo.saveSyncInterval(15);
      final s = await repo.load();
      expect(s.syncIntervalMinutes, 15);
    });

    test('heartbeatInterval', () async {
      await repo.saveHeartbeatInterval(60);
      final s = await repo.load();
      expect(s.heartbeatIntervalSeconds, 60);
    });

    test('actorName', () async {
      await repo.saveActorName('Test Actor');
      final s = await repo.load();
      expect(s.actorName, 'Test Actor');
    });

    test('preferredTerminal', () async {
      await repo.savePreferredTerminal('iTerm2');
      final s = await repo.load();
      expect(s.preferredTerminal, 'iTerm2');
    });

    test('ghosttyTheme set and clear', () async {
      await repo.saveGhosttyTheme('catppuccin-mocha');
      expect((await repo.load()).ghosttyTheme, 'catppuccin-mocha');

      await repo.saveGhosttyTheme(null);
      expect((await repo.load()).ghosttyTheme, isNull);
    });

    test('ghosttyFontFamily set and clear', () async {
      await repo.saveGhosttyFontFamily('JetBrains Mono');
      expect((await repo.load()).ghosttyFontFamily, 'JetBrains Mono');

      await repo.saveGhosttyFontFamily('');
      expect((await repo.load()).ghosttyFontFamily, isNull);
    });

    test('showClosedInTree', () async {
      await repo.saveShowClosedInTree(true);
      expect((await repo.load()).showClosedInTree, isTrue);
    });

    test('customBdPath', () async {
      await repo.saveCustomBdPath('/opt/homebrew/bin/bd');
      expect((await repo.load()).customBdPath, '/opt/homebrew/bin/bd');
    });

    test('sidebarSortOrder', () async {
      await repo.saveSidebarSortOrder(SidebarSortOrder.activity);
      expect((await repo.load()).sidebarSortOrder, SidebarSortOrder.activity);
    });

    test('gcpProjectId set and clear', () async {
      await repo.saveGcpProjectId('my-project-123');
      expect((await repo.load()).gcpProjectId, 'my-project-123');

      await repo.saveGcpProjectId(null);
      expect((await repo.load()).gcpProjectId, isNull);
    });

    test('aiModels with custom defaultId', () async {
      final models = [
        GenerativeModelConfig(
          id: 'custom-1',
          displayName: 'Custom',
          identifier: 'gemini-custom',
          region: 'us-east1',
        ),
      ];
      // seed first to avoid migration overwriting on reload
      await repo.load();
      await repo.saveAiModels(models, 'custom-1');
      final s = await repo.load();
      expect(s.aiModels.length, 1);
      expect(s.defaultAiModel?.identifier, 'gemini-custom');
    });
  });

  // ── Expanded nodes ─────────────────────────────────────────────────────────

  group('expandedNodes', () {
    test('saves and loads expanded node set per project', () async {
      await repo.saveExpandedNodes('/proj/a', {'issue-1', 'issue-2'});
      final nodes = await repo.loadExpandedNodes('/proj/a');
      expect(nodes, containsAll(['issue-1', 'issue-2']));
    });

    test('different projects have isolated expanded node sets', () async {
      await repo.saveExpandedNodes('/proj/a', {'x'});
      await repo.saveExpandedNodes('/proj/b', {'y'});
      expect(await repo.loadExpandedNodes('/proj/a'), {'x'});
      expect(await repo.loadExpandedNodes('/proj/b'), {'y'});
    });

    test('empty set returns empty on load', () async {
      final nodes = await repo.loadExpandedNodes('/proj/new');
      expect(nodes, isEmpty);
    });
  });

  // ── Project last viewed ────────────────────────────────────────────────────

  group('projectLastViewed', () {
    test('saves and loads timestamps', () async {
      final now = DateTime(2026, 6, 29, 12, 0);
      await repo.saveProjectLastViewed({'/proj/a': now});
      final s = await repo.load();
      expect(s.projectLastViewed['/proj/a']?.toUtc(), now.toUtc());
    });
  });
}
