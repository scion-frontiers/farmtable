import 'package:flutter_test/flutter_test.dart';
import 'package:agent_watcher/services/tmux_service.dart';

void main() {
  group('TmuxService AppleScript escaping', () {
    test('does not modify simple safe strings', () {
      final input = 'my-session-name_123';
      expect(TmuxService.escapeForAppleScript(input), 'my-session-name_123');
    });

    test('escapes backslashes', () {
      final input = 'some\\path\\name';
      // In AppleScript, backslash must be double backslash
      expect(TmuxService.escapeForAppleScript(input), 'some\\\\path\\\\name');
    });

    test('escapes double quotes', () {
      final input = 'session "name"';
      expect(TmuxService.escapeForAppleScript(input), 'session \\"name\\"');
    });

    test('escapes backslashes first, then double quotes', () {
      // E.g., if input contains both: `\"` -> must become `\\\"`
      final input = 'session\\"name';
      expect(TmuxService.escapeForAppleScript(input), 'session\\\\\\"name');
    });
  });
}
