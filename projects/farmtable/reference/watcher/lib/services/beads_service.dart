import 'dart:async';
import 'dart:convert';
import 'dart:io';
import '../models/issue.dart';
import '../models/interaction.dart';
import '../utils/app_logger.dart';

const macosDefaultPath =
    '/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin';

Map<String, String> _buildPathEnv() {
  final env = Map<String, String>.from(Platform.environment);
  final parentPath = env['PATH'] ?? '';
  env['PATH'] = parentPath.isEmpty
      ? macosDefaultPath
      : '$parentPath:$macosDefaultPath';
  return env;
}

final Map<String, String> macosPathEnv = _buildPathEnv();

/// JSON-RPC error code the daemon returns when an optimistic-concurrency check
/// fails (RACE-03). Kept in sync with `conflictErrorCode` in daemon/main.go.
const int kRpcConflictCode = -32001;

/// Thrown by [BeadsService] when a mutation is rejected because the issue was
/// modified since the client last read it (RACE-03). Callers should refresh and
/// inform the user rather than treating it as a generic failure.
class ConflictException implements Exception {
  final String message;
  ConflictException(this.message);
  @override
  String toString() => message;
}

/// Thrown to in-flight requests when the daemon process dies unexpectedly
/// (REL-05). [wasKilled] is true for SIGKILL-style exits (code -9), which are
/// usually transient (OS memory pressure, sleep). The daemon auto-respawns on
/// the next call, so callers should treat this as recoverable.
class DaemonCrashException implements Exception {
  final int code;
  final bool wasKilled;
  DaemonCrashException(this.code, {required this.wasKilled});

  @override
  String toString() => wasKilled
      ? 'The background service was stopped by the system (it will reconnect).'
      : 'The background service stopped unexpectedly (exit code $code).';
}

class BeadsService {
  static final _log = AppLogger('BeadsService');
  final String workingDirectory;

  /// Resolves the bd executable path. Pass a closure that reads
  /// the user's custom path from settings, defaulting to 'bd'.
  /// Defaults to a no-op resolver that always returns 'bd'.
  final String Function() _bdPathResolver;

  String get _bdExecutable => _bdPathResolver();

  Process? _daemonProcess;
  int _requestId = 1;
  final Map<int, Completer<dynamic>> _pendingRequests = {};

  /// REL-02: number of RPC requests that have timed out back-to-back with no
  /// intervening successful response. When it reaches
  /// [_maxConsecutiveTimeouts] the daemon is assumed hung/deadlocked and is
  /// force-restarted so subsequent requests don't time out indefinitely.
  /// Reset to 0 on any successful response.
  int _consecutiveTimeouts = 0;
  static const int _maxConsecutiveTimeouts = 2;

  /// Guards daemon startup so concurrent callers share a single initialization
  /// future instead of racing to spawn multiple daemons (RACE-01). Non-null
  /// while an initialization is in flight; cleared when it settles.
  Completer<void>? _initCompleter;

  bool _isDisposed = false;
  Function(String)? onModeChanged;

  /// REL-05: invoked when the daemon process exits UNEXPECTEDLY (non-zero exit
  /// while the service is still in use — e.g. SIGKILL/-9 from OS memory pressure
  /// or a sleep transition). Receives the exit [code] and whether it looks like
  /// an external kill. The next RPC call will transparently respawn the daemon;
  /// this hook lets the UI show a friendly "reconnecting" state instead of a raw
  /// crash error and/or proactively re-fetch.
  void Function(int code, {required bool wasKilled})? onCrash;

  /// Invoked when the daemon emits a schema_migration_required notification,
  /// meaning the beads library refused to open the database because pending
  /// schema migrations exist but a Dolt remote is configured. The callback
  /// receives the structured gate data so the UI can render MigrationGateView.
  void Function(Map<String, dynamic> params)? onSchemaMigrationRequired;

  final Future<Process> Function(
    String executable,
    List<String> arguments, {
    String? workingDirectory,
    Map<String, String>? environment,
    bool includeParentEnvironment,
    bool runInShell,
    ProcessStartMode mode,
  })
  _processStart;

  final Duration _requestTimeout;

  BeadsService(
    this.workingDirectory, {
    this.onModeChanged,
    this.onCrash,
    this.onSchemaMigrationRequired,
    String Function()? bdPathResolver,
    Future<Process> Function(
      String executable,
      List<String> arguments, {
      String? workingDirectory,
      Map<String, String>? environment,
      bool includeParentEnvironment,
      bool runInShell,
      ProcessStartMode mode,
    })?
    processStart,
    Duration? requestTimeout,
  }) : _bdPathResolver = bdPathResolver ?? (() => 'bd'),
       _processStart = processStart ?? Process.start,
       _requestTimeout = requestTimeout ?? const Duration(seconds: 15);

  Future<void> _ensureDaemonRunning() async {
    if (_isDisposed) throw Exception('Service disposed');
    if (_daemonProcess != null) return;

    // RACE-01: if another caller is already initializing, await the SAME future
    // rather than spinning on a timer (which could race and spawn a second
    // daemon, causing Dolt/noms LOCK contention).
    if (_initCompleter != null) {
      await _initCompleter!.future;
      // The initializer either set _daemonProcess or failed; if it failed,
      // surface that to this caller too.
      if (_daemonProcess == null) {
        throw Exception('Daemon initialization failed');
      }
      return;
    }

    final completer = Completer<void>();
    completer.future.ignore();
    _initCompleter = completer;
    try {
      // Find the bundled daemon binary.
      String daemonPath = 'daemon/watcher-daemon';

      if (File(daemonPath).existsSync()) {
        // We are in dev mode, running from the project root. Make it absolute
        // so it works when Process.start changes the working directory.
        daemonPath = File(daemonPath).absolute.path;
      } else {
        // If we are running from a built app bundle on macOS, the executable is in Contents/MacOS
        final execPath = Platform.resolvedExecutable;
        final bundleDir = File(execPath).parent.parent;
        final bundledDaemon = File(
          '${bundleDir.path}/Resources/watcher-daemon',
        );
        if (bundledDaemon.existsSync()) {
          daemonPath = bundledDaemon.path;
        }
      }

      _daemonProcess = await _processStart(
        daemonPath,
        [workingDirectory],
        workingDirectory: workingDirectory,
        environment: macosPathEnv,
      );

      // Prevent unhandled async exceptions if the process crashes and the pipe breaks
      _daemonProcess!.stdin.done.catchError((_) {});

      // Use LineSplitter to frame the JSON-RPC messages (one per line)
      _daemonProcess!.stdout
          .transform(utf8.decoder)
          .transform(const LineSplitter())
          .listen((line) {
            if (line.trim().isEmpty) return;
            try {
              final response = jsonDecode(line);

              // Handle server-initiated notifications
              if (response['method'] == 'boot_status') {
                final params = response['params'] as Map<String, dynamic>;
                _log.info('Daemon boot_status', error: params);
                if (params.containsKey('mode') && onModeChanged != null) {
                  onModeChanged!(params['mode'] as String);
                }
                return;
              }

              if (response['method'] == 'schema_migration_required') {
                final params = response['params'] as Map<String, dynamic>;
                _log.warning('Daemon schema_migration_required', error: params);
                onSchemaMigrationRequired?.call(params);
                return;
              }

              final id = response['id'] as int?;
              if (id != null && _pendingRequests.containsKey(id)) {
                // REL-02: a matched response (even an error) proves the daemon
                // is alive and responsive, so the hang streak is broken.
                _consecutiveTimeouts = 0;
                if (response['error'] != null) {
                  final err = response['error'];
                  final message = err['message']?.toString() ?? 'Unknown error';
                  // RACE-03: map the conflict code to a typed exception so
                  // callers can refresh + alert instead of a generic failure.
                  _pendingRequests[id]!.completeError(
                    err['code'] == kRpcConflictCode
                        ? ConflictException(message)
                        : Exception(message),
                  );
                } else {
                  _pendingRequests[id]!.complete(response['result']);
                }
                _pendingRequests.remove(id);
              }
            } catch (e, st) {
              _log.warning(
                'Failed to process daemon output',
                error: e,
                stackTrace: st,
              );
            }
          });

      _daemonProcess!.stderr.transform(utf8.decoder).listen((line) {
        if (line.trim().isNotEmpty) _log.warning('Daemon stderr: $line');
      });

      _daemonProcess!.exitCode.then((code) {
        final unexpected = code != 0;
        // SIGKILL is delivered as a negative exit code (-9) by dart:io. Treat
        // any negative code as an external kill (REL-05).
        final wasKilled = code < 0;
        if (unexpected) {
          _log.error('Daemon exited unexpectedly', error: 'exit code $code');
        } else {
          _log.info('Daemon exited cleanly');
        }
        _daemonProcess = null;

        if (!_isDisposed) {
          for (var completer in _pendingRequests.values) {
            if (!completer.isCompleted) {
              completer.completeError(
                DaemonCrashException(code, wasKilled: wasKilled),
              );
            }
          }
        }
        _pendingRequests.clear();

        // REL-05: notify the app so it can reconnect gracefully instead of
        // surfacing a raw crash. Only for unexpected exits while still in use.
        if (unexpected && !_isDisposed) {
          onCrash?.call(code, wasKilled: wasKilled);
        }
      });

      // Initialization succeeded (daemon spawned and listeners attached).
      if (!completer.isCompleted) completer.complete();
    } catch (e, st) {
      // Initialization failed: ensure no half-started state lingers and
      // propagate the error to every waiter.
      _log.error('Daemon initialization failed', error: e, stackTrace: st);
      _daemonProcess?.kill();
      _daemonProcess = null;
      if (!completer.isCompleted) completer.completeError(e);
      rethrow;
    } finally {
      // Allow a subsequent call to retry initialization from scratch.
      _initCompleter = null;
    }
  }

  Future<dynamic> _sendRpcRequest(String method, [dynamic params]) async {
    await _ensureDaemonRunning();

    if (_daemonProcess == null) {
      throw Exception('Daemon process failed to start or died');
    }

    final id = _requestId++;
    final completer = Completer<dynamic>();
    _pendingRequests[id] = completer;

    final request = {
      'jsonrpc': '2.0',
      'method': method,
      ...?params != null ? {'params': params} : null,
      'id': id,
    };

    try {
      _daemonProcess!.stdin.writeln(jsonEncode(request));
    } catch (e) {
      _pendingRequests.remove(id);
      rethrow;
    }

    return completer.future.timeout(
      _requestTimeout,
      onTimeout: () {
        _pendingRequests.remove(id);

        // REL-02: track consecutive timeouts. A hung/deadlocked daemon would
        // otherwise make every subsequent request time out forever, because
        // _ensureDaemonRunning reuses the still-alive process. After
        // [_maxConsecutiveTimeouts] in a row, force-restart it so the next
        // request spawns a fresh daemon.
        _consecutiveTimeouts++;
        if (_consecutiveTimeouts >= _maxConsecutiveTimeouts) {
          _log.warning(
            'Daemon unresponsive after $_consecutiveTimeouts consecutive '
            'timeouts; force-restarting.',
          );
          _restartDaemon();
        }

        throw Exception(
          'Daemon timed out after ${_requestTimeout.inSeconds}s waiting for Dolt server to boot. Try selecting the project again.',
        );
      },
    );
  }

  /// REL-02: forcibly terminate the daemon so the next [_ensureDaemonRunning]
  /// spawns a fresh one. Killing the process triggers the existing
  /// `exitCode.then` handler, which nulls [_daemonProcess], fails any still
  /// pending requests, and clears [_pendingRequests]. We also reset the timeout
  /// counter so the fresh daemon starts with a clean slate.
  void _restartDaemon() {
    _consecutiveTimeouts = 0;
    final proc = _daemonProcess;
    // Null it eagerly so a concurrent caller doesn't reuse a dying process; the
    // exitCode handler is idempotent (it also nulls and clears).
    _daemonProcess = null;
    proc?.kill();
  }

  Future<List<Interaction>> getInteractions() async {
    final file = File('$workingDirectory/.beads/interactions.jsonl');
    if (!await file.exists()) {
      return [];
    }

    final List<Interaction> interactions = [];
    final lines = await file.readAsLines();
    // Read from end to get most recent first, take up to 50
    for (var line in lines.reversed.take(50)) {
      if (line.trim().isEmpty) continue;
      try {
        final Map<String, dynamic> data = jsonDecode(line);
        interactions.add(Interaction.fromJson(data));
      } catch (e) {
        _log.warning('Error parsing interaction JSON', error: e);
      }
    }
    return interactions;
  }

  Future<List<Issue>> getIssues() async {
    final result = await _sendRpcRequest('graph');

    if (result == null) return [];

    final List<Issue> issues = [];
    final list = result as List<dynamic>;
    for (var item in list) {
      issues.add(Issue.fromJson(item as Map<String, dynamic>));
    }
    return issues;
  }

  /// Updates an issue. When [expectedUpdatedAt] is provided (the `updatedAt` the
  /// client last saw), the daemon performs an optimistic-concurrency check and
  /// throws [ConflictException] if the issue changed in the meantime (RACE-03).
  Future<void> updateIssue(
    String id, {
    String? status,
    int? priority,
    String? owner,
    String? assignee,
    String? parent,
    required String actor,
    DateTime? expectedUpdatedAt,
  }) async {
    final Map<String, dynamic> updates = {};
    if (status != null) updates['status'] = status;
    if (priority != null) updates['priority'] = priority;
    if (owner != null) updates['owner'] = owner;
    if (assignee != null) updates['assignee'] = assignee;
    if (parent != null) updates['parent'] = parent;

    if (updates.isEmpty) return;

    await _sendRpcRequest('update_issue', {
      'id': id,
      'updates': updates,
      'actor': actor,
      if (expectedUpdatedAt != null)
        'expected_updated_at': expectedUpdatedAt.toUtc().toIso8601String(),
    });
  }

  Future<String> createIssue(
    String title,
    String description,
    String type, {
    String? parent,
    int? priority,
    required String actor,
  }) async {
    final response = await _sendRpcRequest('create_issue', {
      'issue': {
        'title': title,
        'description': description,
        'issue_type': type,
        'priority': priority ?? 2,
        if (parent != null && parent.isNotEmpty)
          'dependencies': [
            {'depends_on_id': parent, 'type': 'parent-child'},
          ],
      },
      'actor': actor,
    });

    if (response == null) {
      throw Exception('Failed to create issue: empty response from daemon');
    }

    return response as String;
  }

  Future<HealthCheckResult> checkHealth() async {
    final result = await _sendRpcRequest('check_health', {});
    return HealthCheckResult.fromJson(result as Map<String, dynamic>);
  }

  Future<String?> getVersion() async {
    final result = await _sendRpcRequest('get_version', {});
    if (result is String) {
      return result;
    }
    return null;
  }

  Future<String?> getCliVersion() async {
    try {
      final result = await Process.run(
        _bdExecutable,
        ['version'],
        workingDirectory: workingDirectory,
        environment: macosPathEnv,
      );
      if (result.exitCode == 0) {
        return result.stdout.toString().trim();
      }
    } catch (e) {
      _log.warning('Failed to get CLI version', error: e);
    }
    return null;
  }

  Future<String?> getProjectRequiredVersion() async {
    try {
      final file = File('$workingDirectory/.beads/metadata.json');
      if (await file.exists()) {
        final content = await file.readAsString();
        final data = json.decode(content);
        return data['required_version'] as String?;
      }
    } catch (e) {
      _log.warning('Failed to read project required version', error: e);
    }
    return null;
  }

  Future<void> addDependency(
    String issueId,
    String dependsOn,
    String type, {
    required String actor,
  }) async {
    await _sendRpcRequest('add_dependency', {
      'issue_id': issueId,
      'depends_on': dependsOn,
      'type': type,
      'actor': actor,
    });
  }

  Future<void> removeDependency(
    String issueId,
    String dependsOn, {
    required String actor,
  }) async {
    await _sendRpcRequest('remove_dependency', {
      'issue_id': issueId,
      'depends_on': dependsOn,
      'actor': actor,
    });
  }

  Future<List<Map<String, dynamic>>> getComments(String issueId) async {
    final result = await _sendRpcRequest('get_comments', {'id': issueId});
    if (result is List) {
      return result.map((e) => Map<String, dynamic>.from(e)).toList();
    }
    return [];
  }

  Future<void> addComment(
    String issueId,
    String comment, {
    required String actor,
  }) async {
    await _sendRpcRequest('add_comment', {
      'id': issueId,
      'comment': comment,
      'actor': actor,
    });
  }

  Future<void> addLabel(
    String issueId,
    String label, {
    required String actor,
  }) async {
    await _sendRpcRequest('add_label', {
      'id': issueId,
      'label': label,
      'actor': actor,
    });
  }

  Future<void> removeLabel(
    String issueId,
    String label, {
    required String actor,
  }) async {
    await _sendRpcRequest('remove_label', {
      'id': issueId,
      'label': label,
      'actor': actor,
    });
  }

  Future<List<Map<String, String>>> getPeers() async {
    final result = await _sendRpcRequest('get_peers');
    if (result == null) return [];

    final List<Map<String, String>> peers = [];
    final list = result as List<dynamic>;
    for (var item in list) {
      final map = item as Map<String, dynamic>;
      peers.add({
        'name': map['name'] as String? ?? '',
        'url': map['url'] as String? ?? '',
      });
    }
    return peers;
  }

  Future<void> addPeer(String name, String url) async {
    await _sendRpcRequest('add_peer', {'name': name, 'url': url});
  }

  Future<void> syncPeer([String? peer]) async {
    await _sendRpcRequest('sync_peer', {
      ...?peer != null ? {'peer': peer} : null,
    });
  }

  void dispose() {
    _isDisposed = true;
    _daemonProcess?.kill();
    _daemonProcess = null;
    for (var completer in _pendingRequests.values) {
      if (!completer.isCompleted) {
        completer.completeError(Exception('Service disposed'));
      }
    }
    _pendingRequests.clear();
  }
}
