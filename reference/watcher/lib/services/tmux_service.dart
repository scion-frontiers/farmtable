import 'dart:io';
import 'beads_service.dart';
import 'package:flutter/foundation.dart';
import '../utils/app_logger.dart';

class TmuxService {
  static final _log = AppLogger('TmuxService');
  static final _env = macosPathEnv;

  /// Escapes a value for safe interpolation inside an AppleScript double-quoted
  /// string literal (SEC-02, defense-in-depth).
  ///
  /// Callers already sanitize session names to `[a-zA-Z0-9_-]` upstream
  /// (`Project.effectiveTmuxSessionName`), but this method must not trust its
  /// inputs: it is a public API and interpolates values into `osascript -e`.
  /// Backslashes are escaped first, then double quotes, so a value can never
  /// terminate the string literal or inject additional AppleScript statements.
  static String _escapeForAppleScript(String value) {
    return value.replaceAll('\\', r'\\').replaceAll('"', r'\"');
  }

  @visibleForTesting
  static String escapeForAppleScript(String value) =>
      _escapeForAppleScript(value);

  /// Resolves the absolute path to the bd executable.
  /// [customBdPath] is an optional override from user settings; when empty
  /// or absent the method probes standard Homebrew / system locations.
  static Future<String> _getBdPath({String customBdPath = ''}) async {
    if (customBdPath.isNotEmpty) {
      if (await File(customBdPath).exists()) {
        return customBdPath;
      }
    }
    const paths = ['/opt/homebrew/bin/bd', '/usr/local/bin/bd', '/usr/bin/bd'];
    for (final path in paths) {
      if (await File(path).exists()) {
        return path;
      }
    }
    return 'bd'; // Fallback
  }

  /// Resolves the absolute path to the tmux executable to bypass macOS GUI PATH limitations.
  static Future<String> _getTmuxPath() async {
    const paths = [
      '/opt/homebrew/bin/tmux',
      '/usr/local/bin/tmux',
      '/usr/bin/tmux',
    ];
    for (final path in paths) {
      if (await File(path).exists()) {
        return path;
      }
    }
    return 'tmux'; // Fallback
  }

  /// Checks if a tmux session with the given name exists.
  static Future<bool> hasSession(String sessionName) async {
    try {
      final tmux = await _getTmuxPath();
      final result = await Process.run(tmux, [
        'has-session',
        '-t',
        sessionName,
      ], environment: _env);
      return result.exitCode == 0;
    } catch (e) {
      if (e is ProcessException) {
        _log.warning('tmux not found for has-session check', error: e);
      }
      return false;
    }
  }

  /// Creates a new detached tmux session.
  static Future<void> createSession(
    String sessionName,
    String workingDirectory,
  ) async {
    final tmux = await _getTmuxPath();
    try {
      final result = await Process.run(tmux, [
        'new-session',
        '-d',
        '-s',
        sessionName,
        '-c',
        workingDirectory,
      ], environment: _env);
      if (result.exitCode != 0) {
        throw Exception('Failed to create tmux session: ${result.stderr}');
      }
    } on ProcessException catch (e) {
      _log.processException('tmux createSession', e);
      throw Exception(
        'tmux is not installed or could not be found. Please install it (e.g. `brew install tmux`) to use AI Terminal Orchestration.',
      );
    }
  }

  /// Ensures a session exists, creating it if necessary.
  static Future<void> ensureSession(
    String sessionName,
    String workingDirectory,
  ) async {
    if (!await hasSession(sessionName)) {
      await createSession(sessionName, workingDirectory);
    }
  }

  /// Sends keys (a command) to the specified tmux session and presses Enter.
  /// [customBdPath] is passed through to [_getBdPath] when the command starts
  /// with `bd ` so the user's configured executable is used.
  static Future<void> sendKeys(
    String sessionName,
    String command, {
    String customBdPath = '',
  }) async {
    final tmux = await _getTmuxPath();
    // Resolve bd path if the command starts with it
    var finalCommand = command;
    if (command.startsWith('bd ')) {
      final bd = await _getBdPath(customBdPath: customBdPath);
      finalCommand = command.replaceFirst('bd ', '$bd ');
    }

    try {
      final result = await Process.run(tmux, [
        'send-keys',
        '-t',
        sessionName,
        finalCommand,
        'C-m',
      ], environment: _env);
      if (result.exitCode != 0) {
        throw Exception(
          'Failed to send keys to tmux session: ${result.stderr}',
        );
      }
    } on ProcessException catch (e) {
      _log.processException('tmux sendKeys', e);
      throw Exception(
        'tmux is not installed or could not be found. Please install it (e.g. `brew install tmux`) to use AI Terminal Orchestration.',
      );
    }
  }

  static Future<bool> _isAppInstalled(String appName) async {
    try {
      final result = await Process.run('osascript', [
        '-e',
        'id of application "$appName"',
      ]);
      return result.exitCode == 0;
    } on ProcessException catch (e) {
      _log.warning('osascript not available for app-installed check', error: e);
      return false;
    } catch (e) {
      _log.warning('_isAppInstalled($appName) failed', error: e);
      return false;
    }
  }

  /// Launches the preferred terminal app and attaches it to the tmux session.
  static Future<void> attachInTerminal(
    String sessionName, {
    String terminalApp = 'Ghostty',
    String? ghosttyTheme,
    String? ghosttyFontFamily,
    String? workingDirectory,
  }) async {
    final tmux = await _getTmuxPath();

    // Escape all values interpolated into osascript strings (SEC-02).
    final safeTmux = _escapeForAppleScript(tmux);
    final safeSession = _escapeForAppleScript(sessionName);

    if (terminalApp == 'Ghostty') {
      if (!await _isAppInstalled('Ghostty')) {
        throw Exception(
          'Ghostty terminal is not installed. Please install it, or select a different preferred terminal under Global Settings.',
        );
      }

      final styleArgs = <String>['--window-save-state=never'];
      if (ghosttyTheme != null && ghosttyTheme.isNotEmpty) {
        styleArgs.add('--theme=$ghosttyTheme');
      }
      if (ghosttyFontFamily != null && ghosttyFontFamily.isNotEmpty) {
        styleArgs.add('--font-family=$ghosttyFontFamily');
      }
      if (workingDirectory != null && workingDirectory.isNotEmpty) {
        styleArgs.add('--working-directory=$workingDirectory');
      }

      // We use the 'open -na' approach but without the -e flag to just get the window,
      // then use AppleScript to write the text. This avoids the security dialog.
      final styleArgsList = <String>['-na', 'Ghostty'];
      if (styleArgs.isNotEmpty) {
        styleArgsList.add('--args');
        styleArgsList.addAll(styleArgs);
      }

      await Process.run('open', styleArgsList, environment: _env);

      final writeScript =
          '''
        tell application "Ghostty"
          try
            set active_terminal to focused terminal of selected tab of front window
            input text "$safeTmux attach -t $safeSession" to active_terminal
            send key "enter" to active_terminal
            return "success"
          on error err
            return "error: " & err
          end try
        end tell
      ''';

      // Poll until Ghostty window is ready and has responded to AppleScript
      bool success = false;
      for (int i = 0; i < 20; i++) {
        final result = await Process.run('osascript', ['-e', writeScript]);
        final output = result.stdout.toString().trim();
        if (result.exitCode == 0 && output == 'success') {
          success = true;
          break;
        }
        await Future.delayed(const Duration(milliseconds: 200));
      }

      if (!success) {
        throw Exception(
          'Ghostty failed to respond after launch. Please try clicking the action again.',
        );
      }
    } else if (terminalApp == 'iTerm2') {
      if (!await _isAppInstalled('iTerm')) {
        throw Exception(
          'iTerm2 is not installed. Please install it, or select a different preferred terminal under Global Settings.',
        );
      }

      // iTerm2 AppleScript to create a new window and attach
      final script =
          '''
        tell application "iTerm"
          create window with default profile
          tell current session of current window
            write text "$safeTmux attach -t $safeSession"
          end tell
          activate
        end tell
      ''';
      await Process.run('osascript', ['-e', script]);
    } else {
      // Default to Apple's Terminal.app
      final script =
          '''
        tell application "Terminal"
          do script "$safeTmux attach -t $safeSession"
          activate
        end tell
      ''';
      await Process.run('osascript', ['-e', script]);
    }
  }
}
