/// Lightweight structured logger built on dart:developer log().
///
/// Uses dart:developer so entries appear in Flutter DevTools under the
/// named-logger filter. Zero additional dependencies.
///
/// Usage:
///   static final _log = AppLogger('BeadsService');
///   _log.warning('Daemon timed out', error: e, stackTrace: st);
///   _log.processException('bd dolt killall failed', e);
///
/// In release builds only WARNING and above are emitted to the console;
/// DEBUG and INFO are captured by dart:developer only (visible in DevTools).
library;

import 'dart:developer' as dev;
import 'dart:io';

import 'package:flutter/foundation.dart';

// Dart developer log level constants (from java.util.logging.Level):
const _levelDebug = 300; // FINE
const _levelInfo = 800; // INFO
const _levelWarning = 900; // WARNING
const _levelError = 1000; // SEVERE

/// Structured logger for a named component.
class AppLogger {
  final String name;

  const AppLogger(this.name);

  // ── Public API ─────────────────────────────────────────────────────────────

  /// Fine-grained diagnostic detail. Suppressed in release builds.
  void debug(String message, {Object? error, StackTrace? stackTrace}) {
    if (kDebugMode) _emit(_levelDebug, message, error: error, st: stackTrace);
  }

  /// Informational lifecycle events (daemon started, project loaded, etc.).
  void info(String message, {Object? error, StackTrace? stackTrace}) {
    _emit(_levelInfo, message, error: error, st: stackTrace);
  }

  /// Something unexpected happened but the app can continue.
  void warning(String message, {Object? error, StackTrace? stackTrace}) {
    _emit(_levelWarning, message, error: error, st: stackTrace);
  }

  /// A failure that the user may need to act on.
  void error(String message, {Object? error, StackTrace? stackTrace}) {
    _emit(_levelError, message, error: error, st: stackTrace);
  }

  /// Convenience for the most common exception type in this codebase.
  ///
  /// Captures the executable, arguments, and OS error-code alongside the
  /// human-readable message so crash logs contain actionable context.
  void processException(
    String context,
    ProcessException e, {
    StackTrace? stackTrace,
  }) {
    final detail = {
      'executable': e.executable,
      'arguments': e.arguments,
      'errorCode': e.errorCode,
      'message': e.message,
    };
    _emit(
      _levelError,
      '$context: ${e.message} (exit ${e.errorCode})',
      error: detail,
      st: stackTrace,
    );
  }

  // ── Internal ───────────────────────────────────────────────────────────────

  void _emit(int level, String message, {Object? error, StackTrace? st}) {
    dev.log(message, name: name, level: level, error: error, stackTrace: st);

    // Mirror to debugPrint in debug builds so the message is visible in the
    // run console even without DevTools attached.
    if (kDebugMode) {
      final prefix = _prefix(level);
      final buf = StringBuffer('$prefix [$name] $message');
      if (error != null) buf.write('\n  ↳ $error');
      debugPrint(buf.toString());
      if (st != null && level >= _levelError) {
        debugPrint('  $st');
      }
    } else if (level >= _levelWarning) {
      // In release: surface WARNING+ to the platform console.
      debugPrint(
        '${_prefix(level)} [$name] $message'
        '${error != null ? ': $error' : ''}',
      );
    }
  }

  static String _prefix(int level) {
    if (level >= _levelError) return '🔴';
    if (level >= _levelWarning) return '⚠️ ';
    if (level >= _levelInfo) return 'ℹ️ ';
    return '🔍';
  }
}
