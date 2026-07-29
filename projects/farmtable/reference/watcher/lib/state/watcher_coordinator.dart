import 'dart:async';
import 'dart:io';
import 'project_repository.dart';

/// Owns all timer and file-watcher concerns that detect when the in-memory
/// issue data needs refreshing. Calls [onRefreshNeeded] whenever a trigger
/// fires, keeping the coordinator fully decoupled from AppState internals.
///
/// Three distinct triggers:
///   1. **Per-project watcher** — `.beads/backup/` fsevents on the selected
///      project, debounced to 100 ms.
///   2. **Safety heartbeat** — periodic fallback so no event is ever missed.
///   3. **Federation sync timer** — periodic `syncPeer()` for federated repos.
///
/// [onRefreshNeeded] is called for (1) and (2).
/// [onSyncNeeded] is called for (3).
/// [onNonSelectedProjectChanged] is called when a background project's backup
/// directory changes — triggers a sidebar re-render but not a full data reload.
class WatcherCoordinator {
  final void Function() onRefreshNeeded;
  final void Function() onSyncNeeded;
  final void Function(String projectPath) onNonSelectedProjectChanged;

  WatcherCoordinator({
    required this.onRefreshNeeded,
    required this.onSyncNeeded,
    required this.onNonSelectedProjectChanged,
  });

  StreamSubscription<FileSystemEvent>? _watchSubscription;
  final Map<String, StreamSubscription<FileSystemEvent>> _globalWatchers = {};
  Timer? _debounceTimer;
  Timer? _heartbeatTimer;
  Timer? _syncTimer;

  /// The path of the currently selected project — used to gate
  /// [onNonSelectedProjectChanged] vs [onRefreshNeeded] in global watchers.
  String? _selectedProjectPath;

  // ── Per-project watcher ───────────────────────────────────────────────────

  /// Start watching [projectPath]/.beads/backup/ for changes.
  /// Each change resets a 100 ms debounce before calling [onRefreshNeeded].
  void watchProject(String projectPath) {
    _watchSubscription?.cancel();
    _debounceTimer?.cancel();
    _selectedProjectPath = projectPath;

    final backupDir = Directory('$projectPath/.beads/backup');
    if (!backupDir.existsSync()) return;

    _watchSubscription = backupDir.watch(recursive: true).listen((_) {
      if (_debounceTimer?.isActive ?? false) _debounceTimer!.cancel();
      _debounceTimer = Timer(
        const Duration(milliseconds: 100),
        onRefreshNeeded,
      );
    });
  }

  void stopProjectWatcher() {
    _watchSubscription?.cancel();
    _watchSubscription = null;
    _debounceTimer?.cancel();
    _debounceTimer = null;
    _selectedProjectPath = null;
  }

  // ── Cross-project (sidebar activity) watchers ─────────────────────────────

  /// Set up background watchers for every project in [projects].
  /// Calls [onNonSelectedProjectChanged] when an unselected project changes,
  /// which lets the sidebar re-render its activity dot without a full refresh.
  void setupGlobalWatchers(List<Project> projects) {
    for (final sub in _globalWatchers.values) {
      sub.cancel();
    }
    _globalWatchers.clear();

    for (final project in projects) {
      final backupDir = Directory('${project.path}/.beads/backup');
      if (!backupDir.existsSync()) continue;

      _globalWatchers[project.path] = backupDir.watch(recursive: true).listen((
        _,
      ) {
        if (project.path != _selectedProjectPath) {
          onNonSelectedProjectChanged(project.path);
        }
      });
    }
  }

  void cancelGlobalWatcher(String projectPath) {
    _globalWatchers[projectPath]?.cancel();
    _globalWatchers.remove(projectPath);
  }

  // ── Safety heartbeat ──────────────────────────────────────────────────────

  /// Start (or restart) the safety heartbeat at [intervalSeconds].
  /// Pass 0 or negative to disable.
  void startHeartbeat(int intervalSeconds) {
    _heartbeatTimer?.cancel();
    if (intervalSeconds <= 0) return;

    _heartbeatTimer = Timer.periodic(
      Duration(seconds: intervalSeconds),
      (_) => onRefreshNeeded(),
    );
  }

  void stopHeartbeat() {
    _heartbeatTimer?.cancel();
    _heartbeatTimer = null;
  }

  // ── Federation sync timer ─────────────────────────────────────────────────

  /// Start (or restart) the federation sync timer at [intervalMinutes].
  /// Pass 0 or negative to disable.
  void startSyncTimer(int intervalMinutes) {
    _syncTimer?.cancel();
    if (intervalMinutes <= 0) return;

    _syncTimer = Timer.periodic(
      Duration(minutes: intervalMinutes),
      (_) => onSyncNeeded(),
    );
  }

  void stopSyncTimer() {
    _syncTimer?.cancel();
    _syncTimer = null;
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  void dispose() {
    _watchSubscription?.cancel();
    for (final sub in _globalWatchers.values) {
      sub.cancel();
    }
    _globalWatchers.clear();
    _debounceTimer?.cancel();
    _heartbeatTimer?.cancel();
    _syncTimer?.cancel();
  }
}
