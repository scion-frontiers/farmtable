import 'package:flutter/cupertino.dart';
import 'package:macos_ui/macos_ui.dart';
import '../state/app_state.dart';

class FederationModal extends StatefulWidget {
  final AppState appState;

  const FederationModal({super.key, required this.appState});

  @override
  State<FederationModal> createState() => _FederationModalState();
}

class _FederationModalState extends State<FederationModal> {
  final _nameController = TextEditingController();
  final _urlController = TextEditingController();
  bool _isSubmitting = false;
  String? _error;

  @override
  void dispose() {
    _nameController.dispose();
    _urlController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final name = _nameController.text.trim();
    final url = _urlController.text.trim();

    if (name.isEmpty || url.isEmpty) {
      setState(() {
        _error = 'Both name and URL are required.';
      });
      return;
    }

    setState(() {
      _isSubmitting = true;
      _error = null;
    });

    try {
      await widget.appState.addPeer(name, url);
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
    return MacosScaffold(
      backgroundColor: MacosDynamicColor.resolve(
        MacosColors.windowBackgroundColor,
        context,
      ),
      children: [
        ContentArea(
          builder: (context, scrollController) {
            return Container(
              constraints: const BoxConstraints(maxWidth: 400),
              padding: const EdgeInsets.all(20.0),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      const MacosIcon(CupertinoIcons.cloud, size: 24),
                      const SizedBox(width: 12),
                      Text(
                        'Add Federation Peer',
                        style: MacosTheme.of(context).typography.title2,
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Connect this project to a remote Beads database.',
                    style: MacosTheme.of(context).typography.footnote.copyWith(
                      color: MacosColors.systemGrayColor,
                    ),
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
                            : const Text('Add Peer'),
                      ),
                    ],
                  ),
                ],
              ),
            );
          },
        ),
      ],
    );
  }
}
