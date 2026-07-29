import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart'
    show ReorderableListView, ReorderableDragStartListener, ListTile, Material;
import 'package:macos_ui/macos_ui.dart';
import '../main.dart';
import '../state/app_state.dart';
import '../utils/dialog_utils.dart';
import 'add_model_modal.dart';

class SettingsModal extends StatefulWidget {
  const SettingsModal({super.key});

  static Future<void> show(BuildContext context) {
    return showMacosSheet(
      context: context,
      barrierDismissible: true,
      builder: (context) => const SettingsModal(),
    );
  }

  @override
  State<SettingsModal> createState() => _SettingsModalState();
}

class _SettingsModalState extends State<SettingsModal> {
  late TextEditingController _actorController;
  late TextEditingController _ghosttyThemeController;
  late TextEditingController _ghosttyFontFamilyController;
  late TextEditingController _gcpProjectIdController;
  late TextEditingController _geminiApiKeyController;
  late TextEditingController _customBdPathController;
  bool _showApiKey = false;

  void _addModel() {
    showMacosSheet(
      context: context,
      builder: (context) => AddModelModal(appState: appState),
    );
  }

  @override
  void initState() {
    super.initState();
    _actorController = TextEditingController(text: appState.actorName);
    _ghosttyThemeController = TextEditingController(
      text: appState.ghosttyTheme,
    );
    _ghosttyFontFamilyController = TextEditingController(
      text: appState.ghosttyFontFamily,
    );
    _gcpProjectIdController = TextEditingController(
      text: appState.gcpProjectId,
    );
    _geminiApiKeyController = TextEditingController(
      text: appState.geminiApiKey,
    );
    _customBdPathController = TextEditingController(
      text: appState.customBdPath,
    );
  }

  @override
  void dispose() {
    _actorController.dispose();
    _ghosttyThemeController.dispose();
    _ghosttyFontFamilyController.dispose();
    _gcpProjectIdController.dispose();
    _geminiApiKeyController.dispose();
    _customBdPathController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return MacosSheet(
      child: ModalFocusTrap(
        child: ListenableBuilder(
          listenable: appState,
          builder: (context, _) {
            return Padding(
              padding: const EdgeInsets.all(24.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Text(
                        'Settings',
                        style: MacosTheme.of(context).typography.largeTitle,
                      ),
                      const Spacer(),
                      PushButton(
                        controlSize: ControlSize.regular,
                        secondary: true,
                        onPressed: () => Navigator.of(context).pop(),
                        child: const Text('Done'),
                      ),
                    ],
                  ),
                  const SizedBox(height: 24),
                  Expanded(
                    child: SingleChildScrollView(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'User Identity',
                            style: TextStyle(fontWeight: FontWeight.bold),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            'How your actions appear in the Activity Ticker and the database.',
                            style: MacosTheme.of(context).typography.footnote
                                .copyWith(color: MacosColors.systemGrayColor),
                          ),
                          const SizedBox(height: 8),
                          SizedBox(
                            width: 300,
                            child: Semantics(
                              textField: true,
                              label: 'Actor Name',
                              child: MacosTextField(
                                controller: _actorController,
                                placeholder: 'e.g., Jane Doe',
                                onChanged: (value) {
                                  appState.setActorName(value);
                                },
                              ),
                            ),
                          ),
                          const SizedBox(height: 32),
                          const Text(
                            'Custom bd Path',
                            style: TextStyle(fontWeight: FontWeight.bold),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            'Optional. Absolute path to the bd executable if it is not in your normal PATH.',
                            style: MacosTheme.of(context).typography.footnote
                                .copyWith(color: MacosColors.systemGrayColor),
                          ),
                          const SizedBox(height: 8),
                          SizedBox(
                            width: 300,
                            child: Semantics(
                              textField: true,
                              label: 'Custom bd Path',
                              child: MacosTextField(
                                controller: _customBdPathController,
                                placeholder: '/opt/homebrew/bin/bd',
                                onChanged: (value) {
                                  appState.setCustomBdPath(value);
                                },
                              ),
                            ),
                          ),
                          const SizedBox(height: 32),
                          const Text(
                            'Federation Sync Interval',
                            style: TextStyle(fontWeight: FontWeight.bold),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            'How often should federated projects check the cloud for updates?',
                            style: MacosTheme.of(context).typography.footnote
                                .copyWith(color: MacosColors.systemGrayColor),
                          ),
                          const SizedBox(height: 12),
                          SizedBox(
                            width: 300,
                            child: MacosPopupButton<int>(
                              value: appState.syncIntervalMinutes,
                              onChanged: (int? newValue) {
                                if (newValue != null) {
                                  appState.setSyncInterval(newValue);
                                }
                              },
                              items: const [
                                MacosPopupMenuItem(
                                  value: 1,
                                  child: Text('Every 1 minute'),
                                ),
                                MacosPopupMenuItem(
                                  value: 5,
                                  child: Text('Every 5 minutes'),
                                ),
                                MacosPopupMenuItem(
                                  value: 15,
                                  child: Text('Every 15 minutes'),
                                ),
                                MacosPopupMenuItem(
                                  value: 60,
                                  child: Text('Every hour'),
                                ),
                                MacosPopupMenuItem(
                                  value: 0,
                                  child: Text('Manual only (Disabled)'),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(height: 32),
                          const Text(
                            'Safety Heartbeat Interval',
                            style: TextStyle(fontWeight: FontWeight.bold),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            'How often should Watcher refresh the active project to ensure synchronization?',
                            style: MacosTheme.of(context).typography.footnote
                                .copyWith(color: MacosColors.systemGrayColor),
                          ),
                          const SizedBox(height: 12),
                          SizedBox(
                            width: 300,
                            child: MacosPopupButton<int>(
                              value: appState.heartbeatIntervalSeconds,
                              onChanged: (int? newValue) {
                                if (newValue != null) {
                                  appState.setHeartbeatInterval(newValue);
                                }
                              },
                              items: const [
                                MacosPopupMenuItem(
                                  value: 10,
                                  child: Text('Every 10 seconds'),
                                ),
                                MacosPopupMenuItem(
                                  value: 30,
                                  child: Text('Every 30 seconds'),
                                ),
                                MacosPopupMenuItem(
                                  value: 60,
                                  child: Text('Every minute'),
                                ),
                                MacosPopupMenuItem(
                                  value: 300,
                                  child: Text('Every 5 minutes'),
                                ),
                                MacosPopupMenuItem(
                                  value: 0,
                                  child: Text('Disabled'),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(height: 32),
                          const Text(
                            'Preferred Terminal',
                            style: TextStyle(fontWeight: FontWeight.bold),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            'Which terminal app should open when executing AI tasks?',
                            style: MacosTheme.of(context).typography.footnote
                                .copyWith(color: MacosColors.systemGrayColor),
                          ),
                          const SizedBox(height: 12),
                          SizedBox(
                            width: 300,
                            child: MacosPopupButton<String>(
                              value: appState.preferredTerminal,
                              onChanged: (String? newValue) {
                                if (newValue != null) {
                                  appState.setPreferredTerminal(newValue);
                                }
                              },
                              items: const [
                                MacosPopupMenuItem(
                                  value: 'Ghostty',
                                  child: Text('Ghostty'),
                                ),
                                MacosPopupMenuItem(
                                  value: 'iTerm2',
                                  child: Text('iTerm2'),
                                ),
                                MacosPopupMenuItem(
                                  value: 'Terminal',
                                  child: Text('Terminal.app'),
                                ),
                              ],
                            ),
                          ),
                          if (appState.preferredTerminal == 'Ghostty') ...[
                            const SizedBox(height: 16),
                            const Text(
                              'Ghostty Custom Settings',
                              style: TextStyle(fontWeight: FontWeight.bold),
                            ),
                            const SizedBox(height: 8),
                            Row(
                              children: [
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        'Theme',
                                        style: MacosTheme.of(context)
                                            .typography
                                            .footnote
                                            .copyWith(
                                              color:
                                                  MacosColors.systemGrayColor,
                                            ),
                                      ),
                                      const SizedBox(height: 4),
                                      Semantics(
                                        textField: true,
                                        label: 'Ghostty Theme',
                                        child: MacosTextField(
                                          placeholder: 'e.g. catppuccin-mocha',
                                          onChanged: appState.setGhosttyTheme,
                                          controller: _ghosttyThemeController,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        'Font Family',
                                        style: MacosTheme.of(context)
                                            .typography
                                            .footnote
                                            .copyWith(
                                              color:
                                                  MacosColors.systemGrayColor,
                                            ),
                                      ),
                                      const SizedBox(height: 4),
                                      Semantics(
                                        textField: true,
                                        label: 'Ghostty Font Family',
                                        child: MacosTextField(
                                          placeholder: 'e.g. JetBrains Mono',
                                          onChanged:
                                              appState.setGhosttyFontFamily,
                                          controller:
                                              _ghosttyFontFamilyController,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                          ],
                          const SizedBox(height: 32),
                          Row(
                            children: [
                              const Expanded(
                                child: Text(
                                  'AI Assistant Settings',
                                  style: TextStyle(fontWeight: FontWeight.bold),
                                ),
                              ),
                              PushButton(
                                controlSize: ControlSize.small,
                                onPressed: _addModel,
                                child: const Text('Add Model'),
                              ),
                            ],
                          ),
                          const SizedBox(height: 8),
                          Text(
                            'Enable or disable the AI Assistant globally, choose your provider, and configure credentials.',
                            style: MacosTheme.of(context).typography.footnote
                                .copyWith(color: MacosColors.systemGrayColor),
                          ),
                          const SizedBox(height: 16),
                          SizedBox(
                            width: 400,
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                  children: [
                                    const Text('Enable AI Assistant'),
                                    MacosSwitch(
                                      value: appState.aiEnabled,
                                      onChanged: appState.setAiEnabled,
                                    ),
                                  ],
                                ),
                                if (appState.aiEnabled) ...[
                                  const SizedBox(height: 16),
                                  Row(
                                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                    children: [
                                      const Text('Provider'),
                                      MacosPopupButton<String>(
                                        value: appState.aiProvider,
                                        onChanged: (String? value) {
                                          if (value != null) {
                                            appState.setAiProvider(value);
                                          }
                                        },
                                        items: const [
                                          MacosPopupMenuItem(
                                            value: 'direct_gemini',
                                            child: Text('Direct Gemini API'),
                                          ),
                                          MacosPopupMenuItem(
                                            value: 'gcp_vertex',
                                            child: Text('Google Cloud (Vertex)'),
                                          ),
                                        ],
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 16),
                                  if (appState.aiProvider == 'gcp_vertex') ...[
                                    Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          'GCP Project ID',
                                          style: MacosTheme.of(context)
                                              .typography
                                              .footnote
                                              .copyWith(
                                                color: MacosColors.systemGrayColor,
                                              ),
                                        ),
                                        const SizedBox(height: 4),
                                        Semantics(
                                          textField: true,
                                          label: 'GCP Project ID',
                                          child: MacosTextField(
                                            placeholder: 'e.g. my-project-id',
                                            onChanged: appState.setGcpProjectId,
                                            controller: _gcpProjectIdController,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ] else ...[
                                    Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          'Gemini API Key',
                                          style: MacosTheme.of(context)
                                              .typography
                                              .footnote
                                              .copyWith(
                                                color: MacosColors.systemGrayColor,
                                              ),
                                        ),
                                        const SizedBox(height: 4),
                                        Semantics(
                                          textField: true,
                                          label: 'Gemini API Key',
                                          child: MacosTextField(
                                            placeholder: 'Enter API Key...',
                                            obscureText: !_showApiKey,
                                            onChanged: appState.setGeminiApiKey,
                                            controller: _geminiApiKeyController,
                                            suffix: MacosIconButton(
                                              icon: MacosIcon(
                                                _showApiKey
                                                    ? CupertinoIcons.eye_slash
                                                    : CupertinoIcons.eye,
                                                size: 16,
                                              ),
                                              onPressed: () {
                                                setState(() {
                                                  _showApiKey = !_showApiKey;
                                                });
                                              },
                                            ),
                                          ),
                                        ),
                                      ],
                                    ),
                                  ],
                                ],
                              ],
                            ),
                          ),
                          const SizedBox(height: 16),
                          Container(
                            decoration: BoxDecoration(
                              color: MacosDynamicColor.resolve(
                                MacosColors.controlBackgroundColor,
                                context,
                              ),
                              borderRadius: BorderRadius.circular(8),
                              border: Border.all(
                                color: MacosColors.systemGrayColor
                                    .withValues(alpha: 0.2),
                              ),
                            ),
                            child: Column(
                              children: appState.aiModels.map((model) {
                                final isDefault =
                                    appState.defaultAiModelId == model.id;
                                return Container(
                                  padding: const EdgeInsets.all(12),
                                  decoration: BoxDecoration(
                                    border:
                                        model != appState.aiModels.last
                                        ? Border(
                                            bottom: BorderSide(
                                              color: MacosColors
                                                  .systemGrayColor
                                                  .withValues(alpha: 0.1),
                                            ),
                                          )
                                        : null,
                                  ),
                                  child: Row(
                                    children: [
                                      const MacosIcon(
                                        CupertinoIcons.sparkles,
                                        size: 16,
                                      ),
                                      const SizedBox(width: 12),
                                      Expanded(
                                        child: Column(
                                          crossAxisAlignment:
                                              CrossAxisAlignment.start,
                                          children: [
                                            Text(
                                              model.displayName,
                                              style: const TextStyle(
                                                fontWeight:
                                                    FontWeight.bold,
                                              ),
                                            ),
                                            Text(
                                              '${model.identifier} (${model.region})',
                                              style: MacosTheme.of(context)
                                                  .typography
                                                  .caption1
                                                  .copyWith(
                                                    color: MacosColors
                                                        .systemGrayColor,
                                                  ),
                                            ),
                                          ],
                                        ),
                                      ),
                                      if (isDefault)
                                        const Padding(
                                          padding: EdgeInsets.only(
                                            right: 8.0,
                                          ),
                                          child: MacosIcon(
                                            CupertinoIcons
                                                .checkmark_circle_fill,
                                            color: MacosColors
                                                .systemGreenColor,
                                            size: 16,
                                          ),
                                        )
                                      else
                                        PushButton(
                                          controlSize: ControlSize.small,
                                          secondary: true,
                                          onPressed: () =>
                                              appState.setDefaultAiModel(
                                                model.id,
                                              ),
                                          child: const Text(
                                            'Set Default',
                                          ),
                                        ),
                                      const SizedBox(width: 8),
                                      MacosIconButton(
                                        icon: const MacosIcon(
                                          CupertinoIcons.trash,
                                          size: 14,
                                          color:
                                              MacosColors.systemRedColor,
                                        ),
                                        onPressed: () => appState
                                            .removeAiModel(model.id),
                                      ),
                                    ],
                                  ),
                                );
                              }).toList(),
                            ),
                          ),
                          const SizedBox(height: 32),
                          const Text(
                            'Project Order',
                            style: TextStyle(fontWeight: FontWeight.bold),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            'Drag to reorder your projects in the sidebar.',
                            style: MacosTheme.of(context).typography.footnote
                                .copyWith(color: MacosColors.systemGrayColor),
                          ),
                          const SizedBox(height: 12),
                          Container(
                            width: 300,
                            constraints: const BoxConstraints(maxHeight: 200),
                            decoration: BoxDecoration(
                              color: MacosDynamicColor.resolve(
                                MacosColors.controlBackgroundColor,
                                context,
                              ),
                              borderRadius: BorderRadius.circular(8),
                              border: Border.all(
                                color: MacosColors.systemGrayColor.withValues(
                                  alpha: 0.2,
                                ),
                              ),
                            ),
                            child: ReorderableListView(
                              shrinkWrap: true,
                              buildDefaultDragHandles: false,
                              proxyDecorator:
                                  (
                                    Widget child,
                                    int index,
                                    Animation<double> animation,
                                  ) {
                                    return Material(
                                      color: MacosColors.transparent,
                                      elevation: 0.0,
                                      child: child,
                                    );
                                  },
                              onReorderItem: (oldIndex, newIndex) {
                                appState.reorderProjects(
                                  oldIndex,
                                  newIndex,
                                  isAdjusted: true,
                                );
                              },
                              children: appState.projects.asMap().entries.map((
                                entry,
                              ) {
                                final index = entry.key;
                                final project = entry.value;
                                return Material(
                                  key: ValueKey(project.path),
                                  color: MacosColors.transparent,
                                  child: ListTile(
                                    hoverColor: MacosColors.transparent,
                                    selectedTileColor: MacosColors.transparent,
                                    selectedColor: MacosColors.transparent,
                                    dense: true,
                                    title: Text(
                                      project.name,
                                      style: MacosTheme.of(
                                        context,
                                      ).typography.body,
                                    ),
                                    trailing: ReorderableDragStartListener(
                                      index: index,
                                      child: const MacosIcon(
                                        CupertinoIcons.bars,
                                        color: MacosColors.systemGrayColor,
                                      ),
                                    ),
                                  ),
                                );
                              }).toList(),
                            ),
                          ),
                          const SizedBox(height: 32),
                          const Text(
                            'Sidebar Preferences',
                            style: TextStyle(fontWeight: FontWeight.bold),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            'Control how projects are displayed in the sidebar.',
                            style: MacosTheme.of(context).typography.footnote
                                .copyWith(color: MacosColors.systemGrayColor),
                          ),
                          const SizedBox(height: 12),
                          SizedBox(
                            width: 300,
                            child: MacosPopupButton<SidebarSortOrder>(
                              value: appState.sidebarSortOrder,
                              onChanged: (SidebarSortOrder? newValue) {
                                if (newValue != null) {
                                  appState.setSidebarSortOrder(newValue);
                                }
                              },
                              items: const [
                                MacosPopupMenuItem(
                                  value: SidebarSortOrder.alphabetical,
                                  child: Text('Alphabetical'),
                                ),
                                MacosPopupMenuItem(
                                  value: SidebarSortOrder.activity,
                                  child: Text('Recent Activity'),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(height: 32),
                          const Text(
                            'System Information',
                            style: TextStyle(fontWeight: FontWeight.bold),
                          ),
                          const SizedBox(height: 12),
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'Watcher App: ${appState.appVersion ?? "Unknown"}',
                                style: MacosTheme.of(
                                  context,
                                ).typography.footnote,
                              ),
                              Text(
                                'Daemon: ${appState.daemonVersion ?? "Unknown"}',
                                style: MacosTheme.of(
                                  context,
                                ).typography.footnote,
                              ),
                              Text(
                                'Beads CLI: ${appState.cliVersion ?? "Unknown"}',
                                style: MacosTheme.of(
                                  context,
                                ).typography.footnote,
                              ),
                            ],
                          ),
                          const SizedBox(height: 16),
                          Text(
                            'Database backend: Dolt SQL',
                            style: MacosTheme.of(context).typography.body,
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            );
          },
        ),
      ),
    );
  }
}
