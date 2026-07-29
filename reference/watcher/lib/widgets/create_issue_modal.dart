import 'package:flutter/cupertino.dart';
import 'package:macos_ui/macos_ui.dart';
import '../state/app_state.dart';
import '../utils/dialog_utils.dart';

class CreateIssueModal extends StatefulWidget {
  final AppState appState;
  final String? initialType; // 'task' or 'epic'

  const CreateIssueModal({super.key, required this.appState, this.initialType});

  @override
  State<CreateIssueModal> createState() => _CreateIssueModalState();
}

class _CreateIssueModalState extends State<CreateIssueModal> {
  final _titleController = TextEditingController();
  final _descriptionController = TextEditingController();
  String _selectedType = 'task';
  int _selectedPriority = 2;
  String? _selectedEpicId;
  bool _isSubmitting = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    if (widget.initialType != null) {
      _selectedType = widget.initialType!;
    }
  }

  @override
  void dispose() {
    _titleController.dispose();
    _descriptionController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final title = _titleController.text.trim();
    final description = _descriptionController.text.trim();

    if (title.isEmpty) {
      setState(() {
        _error = 'Title is required.';
      });
      return;
    }

    setState(() {
      _isSubmitting = true;
      _error = null;
    });

    try {
      await widget.appState.createIssue(
        title,
        description,
        _selectedType,
        parent: _selectedType == 'task' || _selectedType == 'bug'
            ? _selectedEpicId
            : null,
        priority: _selectedPriority,
      );
      if (mounted) {
        Navigator.of(context).pop();
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = e.toString();
          _isSubmitting = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final epics = widget.appState.currentIssues
        .where((i) => i.issueType == 'epic')
        .toList();

    return ModalFocusTrap(
      child: Container(
        constraints: const BoxConstraints(maxWidth: 500, maxHeight: 600),
        decoration: BoxDecoration(color: MacosTheme.of(context).canvasColor),
        padding: const EdgeInsets.all(20.0),
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  const MacosIcon(CupertinoIcons.plus_square, size: 24),
                  const SizedBox(width: 12),
                  Text(
                    'Create New ${_selectedType == 'epic' ? 'Epic' : 'Task'}',
                    style: MacosTheme.of(context).typography.title2,
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Text(
                'Add a new item to your local beads project.',
                style: MacosTheme.of(context).typography.footnote.copyWith(
                  color: MacosColors.systemGrayColor,
                ),
              ),
              const SizedBox(height: 24),

              const Text('Type', style: TextStyle(fontWeight: FontWeight.bold)),
              const SizedBox(height: 4),
              MacosPopupButton<String>(
                value: _selectedType,
                items: const [
                  MacosPopupMenuItem(value: 'task', child: Text('Task')),
                  MacosPopupMenuItem(value: 'epic', child: Text('Epic')),
                  MacosPopupMenuItem(value: 'bug', child: Text('Bug')),
                ],
                onChanged: (value) {
                  if (value != null) {
                    setState(() {
                      _selectedType = value;
                      if (value == 'epic') {
                        _selectedEpicId = null;
                      }
                    });
                  }
                },
              ),
              const SizedBox(height: 16),

              const Text(
                'Priority',
                style: TextStyle(fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 4),
              MacosPopupButton<int>(
                value: _selectedPriority,
                items: const [
                  MacosPopupMenuItem(value: 0, child: Text('P0 - Critical')),
                  MacosPopupMenuItem(value: 1, child: Text('P1 - High')),
                  MacosPopupMenuItem(value: 2, child: Text('P2 - Medium')),
                  MacosPopupMenuItem(value: 3, child: Text('P3 - Low')),
                  MacosPopupMenuItem(value: 4, child: Text('P4 - Trivial')),
                ],
                onChanged: (value) {
                  if (value != null) {
                    setState(() {
                      _selectedPriority = value;
                    });
                  }
                },
              ),
              const SizedBox(height: 16),

              const Text(
                'Title',
                style: TextStyle(fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 4),
              MacosTextField(
                controller: _titleController,
                placeholder: 'What needs to be done?',
                autofocus: true,
              ),
              const SizedBox(height: 16),

              const Text(
                'Description',
                style: TextStyle(fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 4),
              MacosTextField(
                controller: _descriptionController,
                placeholder: 'Add details, context, and criteria...',
                maxLines: 5,
              ),

              if ((_selectedType == 'task' || _selectedType == 'bug') &&
                  epics.isNotEmpty) ...[
                const SizedBox(height: 16),
                const Text(
                  'Parent Epic',
                  style: TextStyle(fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 4),
                MacosPopupButton<String?>(
                  value: _selectedEpicId,
                  hint: const Text('None'),
                  items: [
                    const MacosPopupMenuItem<String?>(
                      value: null,
                      child: Text('None'),
                    ),
                    ...epics.map(
                      (epic) => MacosPopupMenuItem<String?>(
                        value: epic.id,
                        child: Text('${epic.title} (${epic.id})'),
                      ),
                    ),
                  ],
                  onChanged: (value) {
                    setState(() {
                      _selectedEpicId = value;
                    });
                  },
                ),
              ],

              if (_error != null)
                Padding(
                  padding: const EdgeInsets.only(top: 16.0),
                  child: Text(
                    _error!,
                    style: const TextStyle(color: MacosColors.systemRedColor),
                  ),
                ),
              const SizedBox(height: 24),
              Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  PushButton(
                    controlSize: ControlSize.regular,
                    secondary: true,
                    onPressed: _isSubmitting
                        ? null
                        : () {
                            Navigator.of(context).pop();
                          },
                    child: const Text('Cancel'),
                  ),
                  const SizedBox(width: 12),
                  PushButton(
                    controlSize: ControlSize.regular,
                    onPressed: _isSubmitting ? null : _submit,
                    child: _isSubmitting
                        ? const ProgressCircle(radius: 8)
                        : const Text('Create'),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
