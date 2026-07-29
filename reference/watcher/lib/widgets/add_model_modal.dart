import 'package:flutter/cupertino.dart';
import 'package:macos_ui/macos_ui.dart';
import 'package:uuid/uuid.dart';
import '../state/app_state.dart';

class AddModelModal extends StatefulWidget {
  final AppState appState;

  const AddModelModal({super.key, required this.appState});

  @override
  State<AddModelModal> createState() => _AddModelModalState();
}

class _AddModelModalState extends State<AddModelModal> {
  final _displayNameController = TextEditingController();
  final _identifierController = TextEditingController();
  final _regionController = TextEditingController();
  String? _error;

  @override
  void dispose() {
    _displayNameController.dispose();
    _identifierController.dispose();
    _regionController.dispose();
    super.dispose();
  }

  void _submit() {
    final name = _displayNameController.text.trim();
    final id = _identifierController.text.trim();
    final region = _regionController.text.trim();

    if (name.isEmpty || id.isEmpty || region.isEmpty) {
      setState(() => _error = 'Please fill out all fields.');
      return;
    }

    widget.appState.addAiModel(
      GenerativeModelConfig(
        id: const Uuid().v4(),
        displayName: name,
        identifier: id,
        region: region,
      ),
    );

    Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    return MacosSheet(
      child: Padding(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Add AI Model',
              style: MacosTheme.of(context).typography.largeTitle,
            ),
            const SizedBox(height: 8),
            const Text('Configure a new Gemini model from Vertex AI.'),
            const SizedBox(height: 24),
            const Text(
              'Display Name',
              style: TextStyle(fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 4),
            MacosTextField(
              controller: _displayNameController,
              placeholder: 'e.g. Gemini 3.5 Flash',
            ),
            const SizedBox(height: 16),
            const Text(
              'Model Identifier',
              style: TextStyle(fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 4),
            MacosTextField(
              controller: _identifierController,
              placeholder: 'e.g. gemini-3.5-flash',
            ),
            const SizedBox(height: 16),
            const Text('Region', style: TextStyle(fontWeight: FontWeight.bold)),
            const SizedBox(height: 4),
            MacosTextField(
              controller: _regionController,
              placeholder: 'e.g. us-central1 or global',
            ),
            if (_error != null)
              Padding(
                padding: const EdgeInsets.only(top: 16.0),
                child: Text(
                  _error!,
                  style: const TextStyle(color: MacosColors.systemRedColor),
                ),
              ),
            const Spacer(),
            Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                PushButton(
                  controlSize: ControlSize.regular,
                  secondary: true,
                  onPressed: () => Navigator.of(context).pop(),
                  child: const Text('Cancel'),
                ),
                const SizedBox(width: 12),
                PushButton(
                  controlSize: ControlSize.regular,
                  onPressed: _submit,
                  child: const Text('Add Model'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
