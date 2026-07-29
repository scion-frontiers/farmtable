import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:agent_watcher/models/issue.dart';
import 'package:agent_watcher/services/generative_ai_service.dart';
import 'package:agent_watcher/state/settings_repository.dart';

void main() {
  group('GenerativeAiService Tests', () {
    test('generateHealthInsights branches to direct_gemini and uses the provided API key', () async {
      final config = GenerativeModelConfig(
        id: 'test-model',
        displayName: 'Test Model',
        identifier: 'gemini-3.5-flash',
        region: 'us-central1',
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
                      'summary': 'The database structural check shows minor issues.',
                      'recommendations': []
                    })
                  }
                ]
              }
            }
          ]
        };

        return http.Response(jsonEncode(responseJson), 200);
      });

      final result = await GenerativeAiService.generateHealthInsights(
        gcpProjectId: null,
        defaultAiModel: config,
        issues: [],
        diagnostics: [],
        aiProvider: 'direct_gemini',
        geminiApiKey: 'dummy-gemini-key',
        client: mockClient,
      );

      expect(didCallMock, isTrue);
      expect(result, isNotNull);
      final Map<String, dynamic> data = jsonDecode(result!);
      expect(data['summary'], 'The database structural check shows minor issues.');
    });

    test('generateHealthInsights returns null if direct_gemini and geminiApiKey is missing', () async {
      final config = GenerativeModelConfig(
        id: 'test-model',
        displayName: 'Test Model',
        identifier: 'gemini-3.5-flash',
        region: 'us-central1',
      );

      final result = await GenerativeAiService.generateHealthInsights(
        gcpProjectId: null,
        defaultAiModel: config,
        issues: [],
        diagnostics: [],
        aiProvider: 'direct_gemini',
        geminiApiKey: null,
      );

      expect(result, isNull);
    });

    test('summarizeIssueResolution branches to direct_gemini and uses the provided API key', () async {
      final config = GenerativeModelConfig(
        id: 'test-model',
        displayName: 'Test Model',
        identifier: 'gemini-3.5-flash',
        region: 'us-central1',
      );

      final issue = Issue(
        id: 'watcher-1',
        title: 'Crash on startup',
        description: 'App crashes immediately on startup',
        status: 'open',
        priority: 1,
        issueType: 'bug',
        createdAt: DateTime.now(),
        createdBy: 'user',
        updatedAt: DateTime.now(),
      );

      var didCallMock = false;
      final mockClient = MockClient((request) async {
        didCallMock = true;
        expect(request.url.toString(), contains('models/gemini-3.5-flash:generateContent'));
        expect(request.url.queryParameters['key'], 'dummy-gemini-key');

        final responseJson = {
          'candidates': [
            {
              'content': {
                'parts': [
                  {
                    'text': 'Fixed the initialization race condition.'
                  }
                ]
              }
            }
          ]
        };

        return http.Response(jsonEncode(responseJson), 200);
      });

      final result = await GenerativeAiService.summarizeIssueResolution(
        gcpProjectId: null,
        defaultAiModel: config,
        issue: issue,
        comments: [],
        aiProvider: 'direct_gemini',
        geminiApiKey: 'dummy-gemini-key',
        client: mockClient,
      );

      expect(didCallMock, isTrue);
      expect(result, 'Fixed the initialization race condition.');
    });

    test('summarizeIssueResolution returns null if direct_gemini and geminiApiKey is missing', () async {
      final config = GenerativeModelConfig(
        id: 'test-model',
        displayName: 'Test Model',
        identifier: 'gemini-3.5-flash',
        region: 'us-central1',
      );

      final issue = Issue(
        id: 'watcher-1',
        title: 'Crash on startup',
        description: 'App crashes immediately on startup',
        status: 'open',
        priority: 1,
        issueType: 'bug',
        createdAt: DateTime.now(),
        createdBy: 'user',
        updatedAt: DateTime.now(),
      );

      final result = await GenerativeAiService.summarizeIssueResolution(
        gcpProjectId: null,
        defaultAiModel: config,
        issue: issue,
        comments: [],
        aiProvider: 'direct_gemini',
        geminiApiKey: null,
      );

      expect(result, isNull);
    });
  });
}
