import 'dart:convert';

import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:agent_watcher/state/app_state.dart';
import 'package:agent_watcher/models/issue.dart';
import 'package:agent_watcher/models/interaction.dart';
import 'package:agent_watcher/services/beads_service.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  group('Project model', () {
    test('extracts name from path correctly', () {
      final project = Project('/Users/username/projects/my_project');
      expect(project.name, 'my_project');
      expect(project.path, '/Users/username/projects/my_project');
    });

    test('handles path with trailing slash gracefully or normally', () {
      // In Dart, split('/') on string ending in '/' gives empty string last
      // So let's check what it does currently.
      final project = Project('/Users/username/projects/my_project/');
      expect(project.name, ''); // Based on the current simple implementation
    });
  });

  group('AppState', () {
    setUp(() {
      SharedPreferences.setMockInitialValues({});
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(
            const MethodChannel('dev.fluttercommunity.plus/package_info'),
            (MethodCall methodCall) async {
              if (methodCall.method == 'getAll') {
                return <String, dynamic>{
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
    });

    test('initializes with empty projects if no shared prefs', () async {
      final state = AppState();
      // AppState calls _loadSettings() which calls PackageInfo.fromPlatform()
      // We need to wait for it to complete.
      await Future.delayed(const Duration(milliseconds: 100));
      expect(state.projects, isEmpty);
      expect(state.selectedProject, isNull);
    });

    test(
      'addProject adds a project and selects it if it is the first',
      () async {
        final state = AppState();
        await state.addProject('/some/path');

        expect(state.projects.length, 1);
        expect(state.projects.first.path, '/some/path');
        expect(state.selectedProject?.path, '/some/path');
      },
    );

    test(
      'addProject selects the new project even when one is already selected',
      () async {
        final state = AppState();
        await state.addProject('/some/path1');
        expect(state.selectedProject?.path, '/some/path1');

        await state.addProject('/some/path2');

        // The newly added project must become selected immediately.
        expect(state.projects.length, 2);
        expect(state.selectedProject?.path, '/some/path2');
      },
    );

    test(
      'removeProject removes the project and updates selected project',
      () async {
        final state = AppState();
        await state.addProject('/some/path1');
        await state.addProject('/some/path2');

        expect(state.projects.length, 2);

        final p1 = state.projects.firstWhere((p) => p.path == '/some/path1');
        await state.removeProject(p1);

        expect(state.projects.length, 1);
        expect(state.projects.first.path, '/some/path2');
      },
    );

    test('first-run seed uses gemini-3.5-flash as default', () async {
      // Empty prefs → seed path
      final state = AppState();
      await Future.delayed(const Duration(milliseconds: 200));

      expect(state.aiModels, isNotEmpty);
      final defaultModel = state.defaultAiModel;
      expect(defaultModel, isNotNull);
      expect(defaultModel!.identifier, 'gemini-3.5-flash');
      expect(defaultModel.region, 'global');
    });

    test(
      'v2 migration replaces gemini-3-flash-preview in existing installs',
      () async {
        // Simulate an existing install: saved ai_models list with the old
        // preview identifier, seed version absent (defaults to 1).
        final oldModel = GenerativeModelConfig(
          id: 'default-flash-3',
          displayName: 'Gemini 3 Flash (Preview)',
          identifier: 'gemini-3-flash-preview',
          region: 'global',
        );
        final prefs = await SharedPreferences.getInstance();
        await prefs.setStringList('ai_models', [jsonEncode(oldModel.toJson())]);
        await prefs.setString('default_ai_model_id', 'default-flash-3');
        await prefs.remove('model_seed_version');

        final state = AppState();
        await Future.delayed(const Duration(milliseconds: 200));

        // The old entry should have been migrated in-place
        expect(state.aiModels.length, 1);
        expect(state.aiModels.first.id, 'default-flash-3'); // id preserved
        expect(state.aiModels.first.identifier, 'gemini-3.5-flash');
        expect(state.aiModels.first.region, 'global');

        // defaultAiModelId still resolves correctly
        expect(state.defaultAiModel?.identifier, 'gemini-3.5-flash');
      },
    );

    test(
      'v2 migration is idempotent for installs already on current seed',
      () async {
        // Simulate an install already on v2
        final currentModel = GenerativeModelConfig(
          id: 'default-flash-3.5',
          displayName: 'Gemini 3.5 Flash',
          identifier: 'gemini-3.5-flash',
          region: 'global',
        );
        final prefs = await SharedPreferences.getInstance();
        await prefs.setStringList('ai_models', [jsonEncode(currentModel.toJson())]);
        await prefs.setString('default_ai_model_id', 'default-flash-3.5');
        await prefs.setInt('model_seed_version', 2);

        final state = AppState();
        await Future.delayed(const Duration(milliseconds: 200));

        // Nothing changed
        expect(state.aiModels.first.identifier, 'gemini-3.5-flash');
        expect(state.defaultAiModel?.identifier, 'gemini-3.5-flash');
      },
    );

    test(
      'refreshData coalesces concurrent triggers via trailing-edge coalescing (RACE-02)',
      () async {
        final state = AppState();
        state.selectedProject = Project('/dummy');
        final fakeService = FakeBeadsService();
        state.currentServiceForTesting = fakeService;

        // Trigger multiple refreshes concurrently/synchronously (without awaiting)
        final f1 = state.refreshDataForTesting();
        final f2 = state.refreshDataForTesting();
        final f3 = state.refreshDataForTesting();

        await Future.wait([f1, f2, f3]);

        // The first run runs immediately. The second and third runs are queued.
        // The second run starts when the first finishes.
        // The third run is queued during the second run's loop, or during the first run's loop.
        // Thus, getIssues() should be called exactly TWICE!
        expect(fakeService.getIssuesCount, 2);
      },
    );

    group('isAIAssistantConfigured permutations', () {
      test('is false when aiEnabled is false', () {
        final state = AppState();
        state.aiEnabled = false;
        state.aiProvider = 'direct_gemini';
        state.geminiApiKey = 'key123';
        state.gcpProjectId = 'project123';
        expect(state.isAIAssistantConfigured, isFalse);
      });

      test('is false when aiEnabled is true but direct_gemini and geminiApiKey is null/empty', () {
        final state = AppState();
        state.aiEnabled = true;
        state.aiProvider = 'direct_gemini';
        state.geminiApiKey = null;
        expect(state.isAIAssistantConfigured, isFalse);

        state.geminiApiKey = '';
        expect(state.isAIAssistantConfigured, isFalse);
      });

      test('is true when aiEnabled is true, direct_gemini and geminiApiKey is configured', () {
        final state = AppState();
        state.aiEnabled = true;
        state.aiProvider = 'direct_gemini';
        state.geminiApiKey = 'valid-key';
        expect(state.isAIAssistantConfigured, isTrue);
      });

      test('is false when aiEnabled is true but gcp_vertex and gcpProjectId is null/empty', () {
        final state = AppState();
        state.aiEnabled = true;
        state.aiProvider = 'gcp_vertex';
        state.gcpProjectId = null;
        expect(state.isAIAssistantConfigured, isFalse);

        state.gcpProjectId = '';
        expect(state.isAIAssistantConfigured, isFalse);
      });

      test('is true when aiEnabled is true, gcp_vertex and gcpProjectId is configured', () {
        final state = AppState();
        state.aiEnabled = true;
        state.aiProvider = 'gcp_vertex';
        state.gcpProjectId = 'valid-project-id';
        expect(state.isAIAssistantConfigured, isTrue);
      });
    });
  });
}

class FakeBeadsService implements BeadsService {
  int getIssuesCount = 0;
  final Duration delay;

  FakeBeadsService({this.delay = const Duration(milliseconds: 10)});

  @override
  Future<List<Issue>> getIssues() async {
    getIssuesCount++;
    await Future.delayed(delay);
    return [];
  }

  @override
  Future<List<Interaction>> getInteractions() async {
    await Future.delayed(delay);
    return [];
  }

  @override
  Future<List<Map<String, String>>> getPeers() async {
    await Future.delayed(delay);
    return [];
  }

  @override
  Future<HealthCheckResult> checkHealth() async {
    return HealthCheckResult(status: 'healthy', diagnostics: []);
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}
