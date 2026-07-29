import 'package:flutter/cupertino.dart';
import 'package:macos_ui/macos_ui.dart';
import 'package:go_router/go_router.dart';
import '../main.dart';

class ProjectSettingsScreen extends StatefulWidget {
  const ProjectSettingsScreen({super.key});

  @override
  State<ProjectSettingsScreen> createState() => _ProjectSettingsScreenState();
}

class _ProjectSettingsScreenState extends State<ProjectSettingsScreen> {
  final _nameController = TextEditingController();
  final _urlController = TextEditingController();
  late TextEditingController _tmuxController;
  bool _isSubmitting = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _tmuxController = TextEditingController(
      text: appState.selectedProject?.tmuxSessionName ?? '',
    );
  }

  @override
  void dispose() {
    _nameController.dispose();
    _urlController.dispose();
    _tmuxController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final name = _nameController.text.trim();
    final url = _urlController.text.trim();

    if (name.isEmpty || url.isEmpty) {
      setState(() => _error = 'Please fill out all fields.');
      return;
    }

    setState(() {
      _error = null;
      _isSubmitting = true;
    });

    try {
      await appState.addPeer(name, url);
      // Force an immediate sync and refresh to populate data
      await appState.syncPeer();
      if (mounted) {
        context.go('/');
      }
    } catch (e) {
      if (mounted) {
        setState(() => _error = e.toString());
      }
    } finally {
      if (mounted) {
        setState(() => _isSubmitting = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: appState,
      builder: (context, _) {
        if (appState.selectedProject == null) {
          return const Center(child: Text('No project selected.'));
        }

        return MacosScaffold(
          toolBar: ToolBar(
            title: const Text('Project Settings'),
            leading: MacosTooltip(
              message: 'Back to Dashboard',
              useMousePosition: false,
              child: MacosIconButton(
                icon: const MacosIcon(CupertinoIcons.back, size: 20),
                boxConstraints: const BoxConstraints(
                  minHeight: 20,
                  minWidth: 20,
                  maxWidth: 48,
                  maxHeight: 38,
                ),
                onPressed: () {
                  context.go('/');
                },
              ),
            ),
          ),
          children: [
            ContentArea(
              builder: (context, scrollController) {
                return SingleChildScrollView(
                  controller: scrollController,
                  padding: const EdgeInsets.all(40.0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Database Diagnostics',
                        style: MacosTheme.of(context).typography.largeTitle,
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'Detailed status information about the local beads database connection.',
                        style: MacosTheme.of(context).typography.footnote
                            .copyWith(color: MacosColors.systemGrayColor),
                      ),
                      const SizedBox(height: 24),
                      const Text(
                        'Connection Mode',
                        style: TextStyle(fontWeight: FontWeight.bold),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        appState.currentConnectionMode == 'server'
                            ? 'Server (Multi-Writer) - Recommended'
                            : appState.currentConnectionMode == 'embedded'
                            ? 'Embedded (Single-Writer) - Potential for lock contention'
                            : 'Detecting...',
                        style: MacosTheme.of(context).typography.body.copyWith(
                          color: appState.currentConnectionMode == 'server'
                              ? MacosColors.systemGreenColor
                              : MacosColors.systemOrangeColor,
                        ),
                      ),
                      const SizedBox(height: 40),

                      Text(
                        'AI Terminal Integration',
                        style: MacosTheme.of(context).typography.largeTitle,
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'Configure how Watcher interacts with your terminal and tmux.',
                        style: MacosTheme.of(context).typography.footnote
                            .copyWith(color: MacosColors.systemGrayColor),
                      ),
                      const SizedBox(height: 24),
                      const Text(
                        'Tmux Session Name (Optional)',
                        style: TextStyle(fontWeight: FontWeight.bold),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'Leave blank to auto-generate a deterministic name (e.g. watcher_projectname).',
                        style: MacosTheme.of(context).typography.footnote
                            .copyWith(color: MacosColors.systemGrayColor),
                      ),
                      const SizedBox(height: 8),
                      SizedBox(
                        width: 300,
                        child: MacosTextField(
                          controller: _tmuxController,
                          placeholder: 'e.g., watcher_api',
                          onChanged: (value) {
                            appState.setProjectTmuxSessionName(
                              appState.selectedProject!,
                              value.trim().isEmpty ? null : value.trim(),
                            );
                          },
                        ),
                      ),
                      const SizedBox(height: 40),

                      Text(
                        'Federation Peers',
                        style: MacosTheme.of(context).typography.largeTitle,
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'Connect this project to a remote Beads database.',
                        style: MacosTheme.of(context).typography.footnote
                            .copyWith(color: MacosColors.systemGrayColor),
                      ),
                      const SizedBox(height: 32),

                      // Add new peer form
                      Container(
                        constraints: const BoxConstraints(maxWidth: 500),
                        padding: const EdgeInsets.all(20),
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
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                const MacosIcon(CupertinoIcons.cloud, size: 20),
                                const SizedBox(width: 8),
                                Text(
                                  'Add New Peer',
                                  style: MacosTheme.of(
                                    context,
                                  ).typography.headline,
                                ),
                              ],
                            ),
                            const SizedBox(height: 24),
                            const Text(
                              'Peer Name',
                              style: TextStyle(fontWeight: FontWeight.bold),
                            ),
                            const SizedBox(height: 4),
                            MacosTextField(
                              controller: _nameController,
                              placeholder: 'e.g., origin, bazaar, central',
                            ),
                            const SizedBox(height: 16),
                            const Text(
                              'Endpoint URL',
                              style: TextStyle(fontWeight: FontWeight.bold),
                            ),
                            const SizedBox(height: 4),
                            MacosTextField(
                              controller: _urlController,
                              placeholder:
                                  'e.g., gs://generative-bazaar-001-beads/project',
                            ),
                            if (_error != null)
                              Padding(
                                padding: const EdgeInsets.only(top: 16.0),
                                child: Text(
                                  _error!,
                                  style: const TextStyle(
                                    color: MacosColors.systemRedColor,
                                  ),
                                ),
                              ),
                            const SizedBox(height: 24),
                            Row(
                              mainAxisAlignment: MainAxisAlignment.end,
                              children: [
                                PushButton(
                                  controlSize: ControlSize.regular,
                                  onPressed: _isSubmitting ? null : _submit,
                                  child: _isSubmitting
                                      ? const ProgressCircle(radius: 8)
                                      : const Text('Add Peer'),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                );
              },
            ),
          ],
        );
      },
    );
  }
}
