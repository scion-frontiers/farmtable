import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import '../utils/app_logger.dart';

// ─────────────────────────────────────────────────────────────────────────────
// Domain model
// ─────────────────────────────────────────────────────────────────────────────

class Project {
  final String path;
  final String name;
  String? tmuxSessionName;

  Project(this.path, {this.tmuxSessionName}) : name = path.split('/').last;

  /// A sanitised tmux session name safe for use in shell commands and
  /// AppleScript string interpolation: always `watcher_<alphanum>`.
  /// Custom session names are sanitised identically to derived ones,
  /// closing the injection gap that existed when only the derived name
  /// was sanitised.
  String get effectiveTmuxSessionName {
    final rawName = (tmuxSessionName != null && tmuxSessionName!.isNotEmpty)
        ? tmuxSessionName!
        : name;
    final sanitized = rawName.replaceAll(RegExp(r'[^a-zA-Z0-9_-]'), '_');
    return 'watcher_$sanitized';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Repository
// ─────────────────────────────────────────────────────────────────────────────

/// Handles SharedPreferences persistence for the project list.
///
/// The on-disk format is a JSON array (`project_data`); a legacy path-only
/// format (`project_paths`) is still written for backwards compatibility and
/// read as a fallback when `project_data` is absent.
class ProjectRepository {
  static final _log = AppLogger('ProjectRepository');
  // ── Load ──────────────────────────────────────────────────────────────────

  Future<List<Project>> load() async {
    final prefs = await SharedPreferences.getInstance();

    // Prefer the richer JSON format introduced in 0.6.
    final jsonList = prefs.getStringList('project_data');
    if (jsonList != null) {
      return jsonList.map((raw) {
        try {
          final map = jsonDecode(raw) as Map<String, dynamic>;
          return Project(
            map['path'] as String,
            tmuxSessionName: map['tmuxSessionName'] as String?,
          );
        } catch (e) {
          _log.warning(
            'Corrupt project_data entry, treating as bare path',
            error: e,
          );
          return Project(raw);
        }
      }).toList();
    }

    // Legacy fallback: bare paths list.
    final paths = prefs.getStringList('project_paths') ?? [];
    return paths.map(Project.new).toList();
  }

  // ── Save ──────────────────────────────────────────────────────────────────

  Future<void> save(List<Project> projects) async {
    final prefs = await SharedPreferences.getInstance();

    await prefs.setStringList(
      'project_data',
      projects
          .map(
            (p) => jsonEncode({
              'path': p.path,
              'tmuxSessionName': p.tmuxSessionName,
            }),
          )
          .toList(),
    );

    // Maintain the legacy key so older builds (or manual recovery) can still
    // read the project list.
    await prefs.setStringList(
      'project_paths',
      projects.map((p) => p.path).toList(),
    );
  }
}
