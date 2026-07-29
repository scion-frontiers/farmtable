import 'package:flutter/cupertino.dart';
import 'package:macos_ui/macos_ui.dart';
import 'package:flutter_markdown_plus/flutter_markdown_plus.dart';
import '../services/planner_service.dart';
import '../state/app_state.dart';
import '../utils/dialog_utils.dart';

class PlannerModal extends StatefulWidget {
  final Project project;
  final AppState appState;

  const PlannerModal({
    super.key,
    required this.project,
    required this.appState,
  });

  @override
  State<PlannerModal> createState() => _PlannerModalState();
}

class _PlannerModalState extends State<PlannerModal> {
  final _goalController = TextEditingController();
  bool _isPlanning = false;
  bool _isExecuting = false;
  String? _planMarkdown;
  String? _error;

  @override
  void dispose() {
    _goalController.dispose();
    super.dispose();
  }

  Future<void> _generatePlan() async {
    if (_goalController.text.trim().isEmpty) return;

    setState(() {
      _isPlanning = true;
      _error = null;
      _planMarkdown = null;
    });

    try {
      await PlannerService.startGeneratePlan(
        workspacePath: widget.project.path,
        goal: _goalController.text,
        sessionName: widget.project.effectiveTmuxSessionName,
        terminalApp: widget.appState.preferredTerminal,
        ghosttyTheme: widget.appState.ghosttyTheme,
        ghosttyFontFamily: widget.appState.ghosttyFontFamily,
        customBdPath: widget.appState.customBdPath,
      );

      final result = await PlannerService.pollForCompletion(
        widget.project.path,
      );

      if (mounted) {
        setState(() {
          _planMarkdown = result;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = e.toString();
        });
      }
    } finally {
      if (mounted) {
        setState(() {
          _isPlanning = false;
        });
      }
    }
  }

  Future<void> _executePlan() async {
    if (_planMarkdown == null) return;

    setState(() {
      _isExecuting = true;
      _error = null;
    });

    try {
      await PlannerService.executeScript(
        widget.project.path,
        _planMarkdown!,
        customBdPath: widget.appState.customBdPath,
      );
      if (mounted) {
        Navigator.of(context).pop(); // Close the modal on success
      }
    } catch (e) {
      setState(() {
        _error = e.toString();
      });
    } finally {
      if (mounted) {
        setState(() {
          _isExecuting = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return ModalFocusTrap(
      child: Container(
        constraints: const BoxConstraints(maxWidth: 600, maxHeight: 600),
        decoration: BoxDecoration(color: MacosTheme.of(context).canvasColor),
        padding: const EdgeInsets.all(20.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'AI Planner',
                  style: MacosTheme.of(context).typography.title1,
                ),
                MacosIconButton(
                  icon: const MacosIcon(CupertinoIcons.clear),
                  onPressed: () => Navigator.of(context).pop(),
                ),
              ],
            ),
            const SizedBox(height: 20),
            if (_planMarkdown == null) ...[
              Text('What would you like to build in ${widget.project.name}?'),
              const SizedBox(height: 8),
              MacosTextField(
                controller: _goalController,
                placeholder: 'e.g. Migrate the frontend to Tailwind CSS',
                maxLines: 3,
              ),
              const SizedBox(height: 16),
              if (_error != null)
                Padding(
                  padding: const EdgeInsets.only(bottom: 16.0),
                  child: Text(
                    'Error: $_error',
                    style: const TextStyle(color: MacosColors.systemRedColor),
                  ),
                ),
              Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  PushButton(
                    controlSize: ControlSize.large,
                    secondary: true,
                    onPressed: () => Navigator.of(context).pop(),
                    child: const Text('Cancel'),
                  ),
                  const SizedBox(width: 12),
                  PushButton(
                    controlSize: ControlSize.large,
                    onPressed: _isPlanning ? null : _generatePlan,
                    child: _isPlanning
                        ? const Text('Check terminal...')
                        : const Text('Generate Plan'),
                  ),
                ],
              ),
            ] else ...[
              Expanded(
                child: Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: MacosDynamicColor.resolve(
                      MacosColors.controlBackgroundColor,
                      context,
                    ),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(
                      color: MacosTheme.of(context).dividerColor,
                    ),
                  ),
                  child: Markdown(
                    data: _planMarkdown!,
                    selectable: true,
                    styleSheet: MarkdownStyleSheet(
                      p: MacosTheme.of(context).typography.body,
                      h1: MacosTheme.of(context).typography.title1,
                      h2: MacosTheme.of(context).typography.title2,
                      h3: MacosTheme.of(context).typography.title3,
                      code: TextStyle(
                        fontFamily: 'Courier',
                        backgroundColor: MacosTheme.of(
                          context,
                        ).dividerColor.withValues(alpha: 0.1),
                      ),
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              if (_error != null)
                Padding(
                  padding: const EdgeInsets.only(bottom: 16.0),
                  child: Text(
                    'Error: $_error',
                    style: const TextStyle(color: MacosColors.systemRedColor),
                  ),
                ),
              Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  PushButton(
                    controlSize: ControlSize.large,
                    secondary: true,
                    onPressed: () {
                      setState(() {
                        _planMarkdown = null; // Go back to edit goal
                      });
                    },
                    child: const Text('Back'),
                  ),
                  const SizedBox(width: 12),
                  PushButton(
                    controlSize: ControlSize.large,
                    onPressed: _isExecuting ? null : _executePlan,
                    child: _isExecuting
                        ? const ProgressCircle(radius: 8)
                        : const Text('Approve & Execute'),
                  ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }
}
