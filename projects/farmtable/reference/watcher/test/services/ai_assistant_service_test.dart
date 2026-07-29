import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:agent_watcher/models/issue.dart';
import 'package:agent_watcher/models/ai_assistant.dart';
import 'package:agent_watcher/services/ai_assistant_service.dart';
import 'package:agent_watcher/state/settings_repository.dart';

void main() {
  group('AIAssistantService Tests', () {
    test(
      'assessProjectHealth returns null if gcpProjectId is missing',
      () async {
        final config = GenerativeModelConfig(
          id: 'test-model',
          displayName: 'Test Model',
          identifier: 'gemini-3.5-flash',
          region: 'us-central1',
        );

        final context = AIAssistantContext(
          issues: [],
          healthCheck: HealthCheckResult(status: 'ok', diagnostics: []),
          interactions: [],
        );

        final result = await AIAssistantService.assessProjectHealth(
          gcpProjectId: null,
          defaultAiModel: config,
          context: context,
        );

        expect(result, isNull);
      },
    );

    test(
      'assessProjectHealth returns null if defaultAiModel is missing',
      () async {
        final context = AIAssistantContext(
          issues: [],
          healthCheck: HealthCheckResult(status: 'ok', diagnostics: []),
          interactions: [],
        );

        final result = await AIAssistantService.assessProjectHealth(
          gcpProjectId: 'my-gcp-project',
          defaultAiModel: null,
          context: context,
        );

        expect(result, isNull);
      },
    );

    test('assessProjectHealth branches to direct_gemini and uses the provided API key', () async {
      final config = GenerativeModelConfig(
        id: 'test-model',
        displayName: 'Test Model',
        identifier: 'gemini-3.5-flash',
        region: 'us-central1',
      );

      final context = AIAssistantContext(
        issues: [],
        healthCheck: HealthCheckResult(status: 'ok', diagnostics: []),
        interactions: [],
      );

      var didCallMock = false;
      final mockClient = MockClient((request) async {
        didCallMock = true;
        expect(request.url.toString(), contains('models/gemini-3.5-flash:generateContent'));
        expect(request.url.queryParameters['key'], 'dummy-gemini-key');
        expect(request.method, 'POST');

        final payload = jsonDecode(request.body);
        expect(payload['contents'], isNotEmpty);
        expect(payload['generationConfig']['responseMimeType'], 'application/json');

        final responseJson = {
          'candidates': [
            {
              'content': {
                'parts': [
                  {
                    'text': jsonEncode({
                      'narrative': 'The project is in excellent health.',
                      'recommendations': [
                        {
                          'title': 'Resolve some task',
                          'action_type': 'update_priority',
                          'payload': {'issue_id': 'watcher-123', 'priority': 1}
                        }
                      ]
                    })
                  }
                ]
              }
            }
          ]
        };

        return http.Response(jsonEncode(responseJson), 200);
      });

      final result = await AIAssistantService.assessProjectHealth(
        gcpProjectId: null,
        defaultAiModel: config,
        context: context,
        aiProvider: 'direct_gemini',
        geminiApiKey: 'dummy-gemini-key',
        client: mockClient,
      );

      expect(didCallMock, isTrue);
      expect(result, isNotNull);
      expect(result!.narrative, 'The project is in excellent health.');
      expect(result.recommendations.length, 1);
      expect(result.recommendations[0].title, 'Resolve some task');
    });

    test('assessProjectHealth returns null if direct_gemini and geminiApiKey is missing', () async {
      final config = GenerativeModelConfig(
        id: 'test-model',
        displayName: 'Test Model',
        identifier: 'gemini-3.5-flash',
        region: 'us-central1',
      );

      final context = AIAssistantContext(
        issues: [],
        healthCheck: HealthCheckResult(status: 'ok', diagnostics: []),
        interactions: [],
      );

      final result = await AIAssistantService.assessProjectHealth(
        gcpProjectId: null,
        defaultAiModel: config,
        context: context,
        aiProvider: 'direct_gemini',
        geminiApiKey: null,
      );

      expect(result, isNull);
    });
  });
}
