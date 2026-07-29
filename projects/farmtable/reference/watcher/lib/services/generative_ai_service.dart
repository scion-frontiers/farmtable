import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_ai/firebase_ai.dart';
import '../models/issue.dart';
import '../state/settings_repository.dart';
import '../firebase_options.dart';
import '../utils/app_logger.dart';

class GenerativeAiService {
  static final _log = AppLogger('GenerativeAiService');
  static bool _initialized = false;

  static Future<void> ensureInitialized({required String? gcpProjectId}) async {
    if (_initialized) return;
    if (gcpProjectId == null || gcpProjectId.isEmpty) {
      throw Exception('GCP Project ID is required for Vertex AI initialization.');
    }
    try {
      await Firebase.initializeApp(
        options: DefaultFirebaseOptions.getOptions(projectId: gcpProjectId),
      );
      _initialized = true;
    } catch (e) {
      _log.error('Failed to initialize Firebase', error: e);
      rethrow;
    }
  }

  static Future<String?> summarizeIssueResolution({
    required String? gcpProjectId,
    required GenerativeModelConfig? defaultAiModel,
    required Issue issue,
    required List<Map<String, dynamic>> comments,
    String? gitDiff,
    String? aiProvider,
    String? geminiApiKey,
    http.Client? client,
  }) async {
    final config = defaultAiModel;
    if (config == null) {
      _log.info('AI configuration missing — skipping summarization');
      return null;
    }

    final provider = aiProvider ?? 'direct_gemini';

    final promptText = '''
You are an expert software engineering assistant. 
Summarize the resolution of the following issue in exactly one or two concise sentences. 
Focus on *how* it was fixed based on the comments and context provided.

Issue: ${issue.id} - ${issue.title}
Description: ${issue.description}

Comments:
${comments.map((c) => "${c['author']}: ${c['text']}").join('\n')}

${gitDiff != null ? "Git Diff:\n$gitDiff" : ""}

Resolution Summary:
''';

    if (provider == 'gcp_vertex') {
      if (gcpProjectId == null || gcpProjectId.isEmpty) {
        _log.info('AI configuration missing — skipping summarization');
        return null;
      }
      await ensureInitialized(gcpProjectId: gcpProjectId);

      try {
        final ai = FirebaseAI.vertexAI(location: config.region);

        final model = ai.generativeModel(
          model: config.identifier,
          generationConfig: GenerationConfig(
            maxOutputTokens: 250,
            temperature: 0.2,
          ),
        );

        final response = await model.generateContent([Content.text(promptText)]);
        return response.text?.trim();
      } catch (e) {
        _log.error('Generative AI summarization error via Vertex', error: e);
        return null;
      }
    } else {
      // direct_gemini
      if (geminiApiKey == null || geminiApiKey.isEmpty) {
        _log.info('AI configuration missing — skipping summarization');
        return null;
      }

      final httpClient = client ?? http.Client();
      try {
        final url = Uri.parse(
          'https://generativelanguage.googleapis.com/v1beta/models/${config.identifier}:generateContent?key=$geminiApiKey',
        );
        final response = await httpClient.post(
          url,
          headers: {'Content-Type': 'application/json'},
          body: jsonEncode({
            'contents': [
              {
                'parts': [
                  {'text': promptText}
                ]
              }
            ],
            'generationConfig': {
              'temperature': 0.2,
              'maxOutputTokens': 250,
            }
          }),
        );

        if (response.statusCode != 200) {
          throw Exception('Gemini API call failed with status: ${response.statusCode}');
        }

        final responseData = jsonDecode(response.body);
        final candidates = responseData['candidates'] as List?;
        if (candidates == null || candidates.isEmpty) {
          throw Exception('No candidates returned from Gemini API');
        }
        final content = candidates[0]['content'];
        final parts = content?['parts'] as List?;
        if (parts == null || parts.isEmpty) {
          throw Exception('No parts returned in Gemini content');
        }
        final text = parts[0]['text'] as String?;
        return text?.trim();
      } catch (e) {
        _log.error('Generative AI summarization error via direct Gemini', error: e);
        return null;
      } finally {
        if (client == null) {
          httpClient.close();
        }
      }
    }
  }

  static Future<String?> generateHealthInsights({
    required String? gcpProjectId,
    required GenerativeModelConfig? defaultAiModel,
    required List<Issue> issues,
    required List<Diagnostic> diagnostics,
    String? aiProvider,
    String? geminiApiKey,
    http.Client? client,
  }) async {
    final config = defaultAiModel;
    if (config == null) {
      _log.info('AI configuration missing — skipping insights generation');
      return null;
    }

    final provider = aiProvider ?? 'direct_gemini';

    final issuesText = issues.map((i) => '- ID: ${i.id}, Title: ${i.title}, Status: ${i.status}, Priority: ${i.priority}, Assignee: ${i.assignee}, Owner: ${i.owner}').join('\n');
    final diagnosticsText = diagnostics.isEmpty
        ? 'None. The project is completely healthy!'
        : diagnostics.map((d) => '- Issue: ${d.issueId}, Type: ${d.type}, Message: ${d.message}, Suggested Fix: ${d.fix ?? "None"}').join('\n');

    final promptText = '''
You are an expert software engineering AI Assistant analyzing a project managed by a lightweight issue tracker called beads (bd).
Your task is to analyze the project's issue list and the static diagnostics/issues produced by the structural health checker.
Using these, generate a beautiful, qualitative health summary and a list of recommended next actions that are actionable and can be executed via mutations.

Current Issues in Project:
$issuesText

Static Health Check Diagnostics (Hard Factual Constraints):
$diagnosticsText

Return a JSON object matching this schema:
{
  "summary": "A friendly, cohesive, human-like narrative (2-3 sentences) summarizing the project health, explaining key bottlenecks, circular dependencies, or high-priority issues that need attention.",
  "recommendations": [
    {
      "title": "A short, concise, actionable title for the recommended action (e.g., 'Resolve circular dependency between task A and B' or 'Assign high-priority bug watcher-12 to ghchinoy')",
      "description": "A brief explanation of why this action is recommended and what it will accomplish.",
      "actionType": "updateIssue | addDependency | removeDependency | createIssue",
      "payload": {
        // For updateIssue:
        // "id": "issue-id" (required), and optionally: "status", "priority", "owner", "assignee", "parent"
        // For addDependency:
        // "issueId": "issue-id", "dependsOn": "depends-on-id", "type": "blocks"
        // For removeDependency:
        // "issueId": "issue-id", "dependsOn": "depends-on-id"
        // For createIssue:
        // "title": "...", "description": "...", "type": "bug|task|feature", "parent": "...", "priority": ...
      }
    }
  ]
}

Only return valid JSON following the schema. Do not return any markdown markdown-wrapping around the JSON, just the JSON string itself.
''';

    if (provider == 'gcp_vertex') {
      if (gcpProjectId == null || gcpProjectId.isEmpty) {
        _log.info('AI configuration missing — skipping insights generation');
        return null;
      }
      await ensureInitialized(gcpProjectId: gcpProjectId);

      try {
        final ai = FirebaseAI.vertexAI(location: config.region);

        final model = ai.generativeModel(
          model: config.identifier,
          generationConfig: GenerationConfig(
            maxOutputTokens: 2048, // HIG-FIX: expanded from 1000 to prevent JSON truncation
            temperature: 0.2,
            responseMimeType: 'application/json',
          ),
        );

        final response = await model.generateContent([Content.text(promptText)]);
        String? text = response.text?.trim();
        if (text != null) {
          if (text.startsWith('```json')) {
            text = text.substring(7);
          } else if (text.startsWith('```')) {
            text = text.substring(3);
          }
          if (text.endsWith('```')) {
            text = text.substring(0, text.length - 3);
          }
          text = text.trim();
        }
        return text;
      } catch (e) {
        _log.error('Generative AI health insights error via Vertex', error: e);
        rethrow; // HIG-FIX: rethrow the actual exception so it bubbles up to the UI instead of swallowing it
      }
    } else {
      // direct_gemini
      if (geminiApiKey == null || geminiApiKey.isEmpty) {
        _log.info('AI configuration missing — skipping insights generation');
        return null;
      }

      final httpClient = client ?? http.Client();
      try {
        final url = Uri.parse(
          'https://generativelanguage.googleapis.com/v1beta/models/${config.identifier}:generateContent?key=$geminiApiKey',
        );
        final response = await httpClient.post(
          url,
          headers: {'Content-Type': 'application/json'},
          body: jsonEncode({
            'contents': [
              {
                'parts': [
                  {'text': promptText}
                ]
              }
            ],
            'generationConfig': {
              'responseMimeType': 'application/json',
              'temperature': 0.2,
              'maxOutputTokens': 2048,
            }
          }),
        );

        if (response.statusCode != 200) {
          throw Exception('Gemini API call failed with status: ${response.statusCode}');
        }

        final responseData = jsonDecode(response.body);
        final candidates = responseData['candidates'] as List?;
        if (candidates == null || candidates.isEmpty) {
          throw Exception('No candidates returned from Gemini API');
        }
        final content = candidates[0]['content'];
        final parts = content?['parts'] as List?;
        if (parts == null || parts.isEmpty) {
          throw Exception('No parts returned in Gemini content');
        }
        String? text = parts[0]['text'] as String?;
        if (text != null) {
          text = text.trim();
          if (text.startsWith('```json')) {
            text = text.substring(7);
          } else if (text.startsWith('```')) {
            text = text.substring(3);
          }
          if (text.endsWith('```')) {
            text = text.substring(0, text.length - 3);
          }
          text = text.trim();
        }
        return text;
      } catch (e) {
        _log.error('Generative AI health insights error via direct Gemini', error: e);
        rethrow;
      } finally {
        if (client == null) {
          httpClient.close();
        }
      }
    }
  }
}
