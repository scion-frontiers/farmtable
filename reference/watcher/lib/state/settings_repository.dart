import 'dart:convert';
import 'dart:io';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../utils/app_logger.dart';
import '../services/beads_service.dart'; // for macosPathEnv

// ─────────────────────────────────────────────────────────────────────────────
// Data classes
// ─────────────────────────────────────────────────────────────────────────────

enum SidebarSortOrder { alphabetical, activity }

class GenerativeModelConfig {
  final String id;
  final String displayName;
  final String identifier;
  final String region;

  const GenerativeModelConfig({
    required this.id,
    required this.displayName,
    required this.identifier,
    required this.region,
  });

  factory GenerativeModelConfig.fromJson(Map<String, dynamic> json) =>
      GenerativeModelConfig(
        id: json['id'] as String,
        displayName: json['display_name'] as String,
        identifier: json['identifier'] as String,
        region: json['region'] as String,
      );

  Map<String, dynamic> toJson() => {
    'id': id,
    'display_name': displayName,
    'identifier': identifier,
    'region': region,
  };
}

/// All user-configurable settings loaded from SharedPreferences.
/// Immutable snapshot produced by [SettingsRepository.load].
class AppSettings {
  final String appVersion;
  final int syncIntervalMinutes;
  final int heartbeatIntervalSeconds;
  final String preferredTerminal;
  final String? ghosttyTheme;
  final String? ghosttyFontFamily;
  final bool showClosedInTree;
  final String customBdPath;
  final SidebarSortOrder sidebarSortOrder;
  final bool aiEnabled;
  final String aiProvider;
  final String? gcpProjectId;
  final String? geminiApiKey;
  final List<GenerativeModelConfig> aiModels;
  final String? defaultAiModelId;
  final String actorName;
  final Map<String, DateTime> projectLastViewed;

  const AppSettings({
    required this.appVersion,
    required this.syncIntervalMinutes,
    required this.heartbeatIntervalSeconds,
    required this.preferredTerminal,
    this.ghosttyTheme,
    this.ghosttyFontFamily,
    required this.showClosedInTree,
    required this.customBdPath,
    required this.sidebarSortOrder,
    required this.aiEnabled,
    required this.aiProvider,
    this.gcpProjectId,
    this.geminiApiKey,
    required this.aiModels,
    this.defaultAiModelId,
    required this.actorName,
    required this.projectLastViewed,
  });

  GenerativeModelConfig? get defaultAiModel {
    if (defaultAiModelId == null || aiModels.isEmpty) return null;
    return aiModels.firstWhere(
      (m) => m.id == defaultAiModelId,
      orElse: () => aiModels.first,
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Repository
// ─────────────────────────────────────────────────────────────────────────────

/// Handles all SharedPreferences persistence for user-configurable settings.
///
/// [load] returns an [AppSettings] snapshot — AppState uses this on startup
/// and after any write to keep its fields in sync.
///
/// All save methods are fire-and-forget (they update prefs and return); the
/// caller is responsible for updating its local state and calling
/// notifyListeners() if needed.
class SettingsRepository {
  static final _log = AppLogger('SettingsRepository');

  /// Current model-seed schema version. Increment when the default
  /// aiModels list changes so existing installs receive a migration pass.
  static const int _currentModelSeedVersion = 2;

  static const _defaults = (
    syncIntervalMinutes: 5,
    heartbeatIntervalSeconds: 30,
    preferredTerminal: 'Ghostty',
    showClosedInTree: false,
    customBdPath: '',
    sidebarSortOrder: 'alphabetical',
    actorName: 'Watcher UI',
  );

  // ── Load ──────────────────────────────────────────────────────────────────

  Future<AppSettings> load() async {
    final packageInfo = await PackageInfo.fromPlatform();
    final appVersion = '${packageInfo.version}+${packageInfo.buildNumber}';

    final prefs = await SharedPreferences.getInstance();

    final syncIntervalMinutes =
        prefs.getInt('sync_interval_minutes') ?? _defaults.syncIntervalMinutes;
    final preferredTerminal =
        prefs.getString('preferred_terminal') ?? _defaults.preferredTerminal;
    final ghosttyTheme = prefs.getString('ghostty_theme');
    final ghosttyFontFamily = prefs.getString('ghostty_font_family');
    final showClosedInTree =
        prefs.getBool('show_closed_in_tree') ?? _defaults.showClosedInTree;
    final customBdPath =
        prefs.getString('custom_bd_path') ?? _defaults.customBdPath;
    final sortOrderStr =
        prefs.getString('sidebar_sort_order') ?? _defaults.sidebarSortOrder;
    final sidebarSortOrder = sortOrderStr == 'activity'
        ? SidebarSortOrder.activity
        : SidebarSortOrder.alphabetical;
    final aiEnabled = prefs.getBool('ai_enabled') ?? false;
    final aiProvider = prefs.getString('ai_provider') ?? 'direct_gemini';
    final gcpProjectId = prefs.getString('gcp_project_id');
    final geminiApiKey = prefs.getString('gemini_api_key');

    final (aiModels, defaultAiModelId) = await _loadAiModels(prefs);

    final projectLastViewed = _loadProjectLastViewed(prefs);

    final heartbeatIntervalSeconds =
        prefs.getInt('heartbeat_interval_seconds') ??
        _defaults.heartbeatIntervalSeconds;

    final actorName = await _resolveActorName(prefs);

    return AppSettings(
      appVersion: appVersion,
      syncIntervalMinutes: syncIntervalMinutes,
      heartbeatIntervalSeconds: heartbeatIntervalSeconds,
      preferredTerminal: preferredTerminal,
      ghosttyTheme: ghosttyTheme,
      ghosttyFontFamily: ghosttyFontFamily,
      showClosedInTree: showClosedInTree,
      customBdPath: customBdPath,
      sidebarSortOrder: sidebarSortOrder,
      aiEnabled: aiEnabled,
      aiProvider: aiProvider,
      gcpProjectId: gcpProjectId,
      geminiApiKey: geminiApiKey,
      aiModels: aiModels,
      defaultAiModelId: defaultAiModelId,
      actorName: actorName,
      projectLastViewed: projectLastViewed,
    );
  }

  // ── AI model seed + versioned migration ───────────────────────────────────

  Future<(List<GenerativeModelConfig>, String?)> _loadAiModels(
    SharedPreferences prefs,
  ) async {
    final modelData = prefs.getStringList('ai_models') ?? [];
    var models = modelData
        .map((d) => GenerativeModelConfig.fromJson(jsonDecode(d)))
        .toList();
    var defaultId = prefs.getString('default_ai_model_id');

    if (models.isEmpty) {
      // First run: seed current defaults.
      models = _defaultModels();
      defaultId = 'default-flash-3.5';
      await prefs.setInt('model_seed_version', _currentModelSeedVersion);
      await _persistAiModels(prefs, models, defaultId);
    } else {
      // Versioned migration for existing installs.
      final seedVersion = prefs.getInt('model_seed_version') ?? 1;
      if (seedVersion < _currentModelSeedVersion) {
        bool migrated = false;
        for (int i = 0; i < models.length; i++) {
          if (models[i].identifier == 'gemini-3-flash-preview') {
            models[i] = GenerativeModelConfig(
              id: models[i].id,
              displayName: 'Gemini 3.5 Flash',
              identifier: 'gemini-3.5-flash',
              region: 'global',
            );
            migrated = true;
          }
        }
        if (migrated) await _persistAiModels(prefs, models, defaultId);
        await prefs.setInt('model_seed_version', _currentModelSeedVersion);
      }
    }

    return (models, defaultId);
  }

  List<GenerativeModelConfig> _defaultModels() => [
    const GenerativeModelConfig(
      id: 'default-flash-3.5',
      displayName: 'Gemini 3.5 Flash',
      identifier: 'gemini-3.5-flash',
      region: 'global',
    ),
    const GenerativeModelConfig(
      id: 'default-flash-2.5',
      displayName: 'Gemini 2.5 Flash',
      identifier: 'gemini-2.5-flash',
      region: 'us-central1',
    ),
  ];

  // ── Actor name ────────────────────────────────────────────────────────────

  Future<String> _resolveActorName(SharedPreferences prefs) async {
    final saved = prefs.getString('actor_name');
    if (saved != null && saved.isNotEmpty) return saved;
    try {
      final result = await Process.run('git', [
        'config',
        'user.name',
      ], environment: macosPathEnv);
      if (result.exitCode == 0 && result.stdout.toString().trim().isNotEmpty) {
        return result.stdout.toString().trim();
      }
    } catch (e) {
      _log.debug(
        'git config user.name unavailable, using default actor name',
        error: e,
      );
    }
    return _defaults.actorName;
  }

  // ── Project-last-viewed timestamps ───────────────────────────────────────

  Map<String, DateTime> _loadProjectLastViewed(SharedPreferences prefs) {
    final result = <String, DateTime>{};
    for (final str in prefs.getStringList('project_last_viewed') ?? []) {
      final parts = str.split('|||');
      if (parts.length == 2) {
        result[parts[0]] = DateTime.parse(parts[1]);
      }
    }
    return result;
  }

  // ── Save methods (individual settings) ───────────────────────────────────

  Future<void> saveSyncInterval(int minutes) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setInt('sync_interval_minutes', minutes);
  }

  Future<void> saveHeartbeatInterval(int seconds) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setInt('heartbeat_interval_seconds', seconds);
  }

  Future<void> saveActorName(String name) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('actor_name', name);
  }

  Future<void> savePreferredTerminal(String terminal) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('preferred_terminal', terminal);
  }

  Future<void> saveGhosttyTheme(String? theme) async {
    final prefs = await SharedPreferences.getInstance();
    if (theme != null && theme.isNotEmpty) {
      await prefs.setString('ghostty_theme', theme);
    } else {
      await prefs.remove('ghostty_theme');
    }
  }

  Future<void> saveGhosttyFontFamily(String? fontFamily) async {
    final prefs = await SharedPreferences.getInstance();
    if (fontFamily != null && fontFamily.isNotEmpty) {
      await prefs.setString('ghostty_font_family', fontFamily);
    } else {
      await prefs.remove('ghostty_font_family');
    }
  }

  Future<void> saveShowClosedInTree(bool value) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('show_closed_in_tree', value);
  }

  Future<void> saveCustomBdPath(String path) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('custom_bd_path', path);
  }

  Future<void> saveSidebarSortOrder(SidebarSortOrder order) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('sidebar_sort_order', order.name);
  }

  Future<void> saveGcpProjectId(String? projectId) async {
    final prefs = await SharedPreferences.getInstance();
    if (projectId != null && projectId.isNotEmpty) {
      await prefs.setString('gcp_project_id', projectId);
    } else {
      await prefs.remove('gcp_project_id');
    }
  }

  Future<void> saveAiEnabled(bool value) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('ai_enabled', value);
  }

  Future<void> saveAiProvider(String provider) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('ai_provider', provider);
  }

  Future<void> saveGeminiApiKey(String? key) async {
    final prefs = await SharedPreferences.getInstance();
    if (key != null && key.isNotEmpty) {
      await prefs.setString('gemini_api_key', key);
    } else {
      await prefs.remove('gemini_api_key');
    }
  }

  Future<void> saveAiModels(
    List<GenerativeModelConfig> models,
    String? defaultId,
  ) async {
    final prefs = await SharedPreferences.getInstance();
    await _persistAiModels(prefs, models, defaultId);
  }

  Future<void> saveProjectLastViewed(Map<String, DateTime> lastViewed) async {
    final prefs = await SharedPreferences.getInstance();
    final list = lastViewed.entries
        .map((e) => '${e.key}|||${e.value.toIso8601String()}')
        .toList();
    await prefs.setStringList('project_last_viewed', list);
  }

  Future<void> saveExpandedNodes(String projectPath, Set<String> nodes) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setStringList('expanded_nodes_$projectPath', nodes.toList());
  }

  Future<Set<String>> loadExpandedNodes(String projectPath) async {
    final prefs = await SharedPreferences.getInstance();
    return (prefs.getStringList('expanded_nodes_$projectPath') ?? []).toSet();
  }

  Future<void> saveLastSelectedProject(String projectPath) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('last_selected_project_path', projectPath);
  }

  Future<String?> loadLastSelectedProject() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString('last_selected_project_path');
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  Future<void> _persistAiModels(
    SharedPreferences prefs,
    List<GenerativeModelConfig> models,
    String? defaultId,
  ) async {
    await prefs.setStringList(
      'ai_models',
      models.map((m) => jsonEncode(m.toJson())).toList(),
    );
    if (defaultId != null) {
      await prefs.setString('default_ai_model_id', defaultId);
    }
  }
}
