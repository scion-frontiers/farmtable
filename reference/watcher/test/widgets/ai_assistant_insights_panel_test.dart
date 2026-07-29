import 'package:flutter/cupertino.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:macos_ui/macos_ui.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:agent_watcher/state/app_state.dart';
import 'package:agent_watcher/models/issue.dart';
import 'package:agent_watcher/widgets/ai_assistant_insights_panel.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

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

  Widget buildTestableWidget(Widget child) {
    return MacosApp(
      home: child,
    );
  }

  testWidgets(
    'AIAssistantInsightsPanel renders local structural health fallback when AI is disabled/unconfigured',
    (WidgetTester tester) async {
      final state = await tester.runAsync(() async {
        final s = AppState();
        await Future.delayed(const Duration(milliseconds: 100));
        return s;
      });

      expect(state, isNotNull);
      if (state == null) return;

      state.aiEnabled = false;
      state.selectedProject = Project('/some/path');
      state.selectedProjectHealth = HealthCheckResult(
        status: 'warning',
        diagnostics: [
          Diagnostic(
            issueId: 'watcher-1',
            type: 'priority-inversion',
            message: 'P2 blocks P0 issue',
            fix: '{"actionType":"updateIssue","payload":{"id":"watcher-1","priority":0}}',
          ),
        ],
      );

      await tester.pumpWidget(buildTestableWidget(
        AIAssistantInsightsPanel(appState: state),
      ));

      await tester.pump();

      // Verify that it morphs into 'Local Structural Health' panel
      expect(find.text('Local Structural Health'), findsOneWidget);
      expect(find.text('AI Assistant Insights'), findsNothing);

      // Verify that local diagnostic message is displayed
      expect(find.text('Fix Local Structural Issue: watcher-1'), findsOneWidget);
      expect(find.text('P2 blocks P0 issue (Type: priority-inversion)'), findsOneWidget);

      // Verify that 'Execute' button is rendered
      expect(find.text('Execute'), findsOneWidget);

      await tester.runAsync(() async {
        state.dispose();
      });
    },
  );

  testWidgets(
    'AIAssistantInsightsPanel renders AI Assistant layout when AI is enabled and configured',
    (WidgetTester tester) async {
      final state = await tester.runAsync(() async {
        final s = AppState();
        await Future.delayed(const Duration(milliseconds: 100));
        return s;
      });

      expect(state, isNotNull);
      if (state == null) return;

      state.aiEnabled = true;
      state.aiProvider = 'direct_gemini';
      state.geminiApiKey = 'dummy-key';
      state.selectedProject = Project('/some/path');

      await tester.pumpWidget(buildTestableWidget(
        AIAssistantInsightsPanel(appState: state),
      ));

      await tester.pump();

      // Verify that it renders the AI Assistant layout title
      expect(find.text('AI Assistant Insights'), findsOneWidget);
      expect(find.text('Local Structural Health'), findsNothing);

      await tester.runAsync(() async {
        state.dispose();
      });
    },
  );
}
