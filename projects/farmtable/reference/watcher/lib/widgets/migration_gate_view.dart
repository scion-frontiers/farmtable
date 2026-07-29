import 'dart:io';
import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart' show SelectableText;
import 'package:flutter/services.dart';
import 'package:macos_ui/macos_ui.dart';
import '../state/app_state.dart';

/// Shown in place of ErrorDisplayView when the beads daemon emits a
/// schema_migration_required notification. Provides a plain-language
/// explanation of the migration gate and two actions:
///
/// - "Run Migration" — spawns a Ghostty/preferred-terminal tmux session with
///   the migration commands pre-loaded (BD_ALLOW_REMOTE_MIGRATE=1 bd migrate
///   schema && bd dolt push), then auto-retries the project connection.
/// - "Open Terminal" — opens the preferred terminal pointed at the project
///   directory without pre-loading commands, for users who want to inspect first.
class MigrationGateView extends StatefulWidget {
  final SchemaMigrationGate gate;
  final AppState appState;
  final VoidCallback? onRetry;

  const MigrationGateView({
    super.key,
    required this.gate,
    required this.appState,
    this.onRetry,
  });

  @override
  State<MigrationGateView> createState() => _MigrationGateViewState();
}

class _MigrationGateViewState extends State<MigrationGateView> {
  bool _launching = false;
  bool _copied = false;

  String? _extractSemver(String? versionString) {
    if (versionString == null) return null;
    final match = RegExp(r'(\d+)\.(\d+)\.(\d+)').firstMatch(versionString);
    return match?.group(0);
  }

  bool _isCliOutdated() {
    final cli = _extractSemver(widget.appState.cliVersion);
    final daemon = _extractSemver(widget.appState.daemonVersion);
    if (cli == null || daemon == null) return false;
    final cliParts = cli.split('.').map(int.parse).toList();
    final daemonParts = daemon.split('.').map(int.parse).toList();
    for (int i = 0; i < 3; i++) {
      if (cliParts[i] < daemonParts[i]) return true;
      if (cliParts[i] > daemonParts[i]) return false;
    }
    return false;
  }

  Future<void> _runMigration() async {
    setState(() => _launching = true);
    try {
      await widget.appState.runSchemaMigration();
    } finally {
      if (mounted) setState(() => _launching = false);
    }
  }

  Future<void> _openTerminal() async {
    setState(() => _launching = true);
    try {
      await widget.appState.openTerminalForProject();
    } finally {
      if (mounted) setState(() => _launching = false);
    }
  }

  Future<void> _copyCommands() async {
    final text = widget.gate.commands.join('\n');
    await Clipboard.setData(ClipboardData(text: text));
    if (mounted) {
      setState(() => _copied = true);
      Future.delayed(const Duration(seconds: 2), () {
        if (mounted) setState(() => _copied = false);
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final warningColor = MacosDynamicColor.resolve(
      const CupertinoDynamicColor.withBrightness(
        color: Color(0xFFB45309),
        darkColor: Color(0xFFFBBF24),
      ),
      context,
    );

    final errorColor = MacosDynamicColor.resolve(
      const CupertinoDynamicColor.withBrightness(
        color: Color(0xFFDC2626),
        darkColor: Color(0xFFFCA5A5),
      ),
      context,
    );

    final innerBgColor = MacosDynamicColor.resolve(
      const CupertinoDynamicColor.withBrightness(
        color: Color(0xFFF4F5F6),
        darkColor: Color(0xFF28282B),
      ),
      context,
    );

    final innerTextColor = MacosDynamicColor.resolve(
      const CupertinoDynamicColor.withBrightness(
        color: Color(0xFF1A1A1A),
        darkColor: Color(0xFFF1F2F3),
      ),
      context,
    );

    final gate = widget.gate;
    final commandText = gate.commands.join('\n');

    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24.0),
        child: Container(
          constraints: const BoxConstraints(maxWidth: 560),
          padding: const EdgeInsets.all(24.0),
          decoration: BoxDecoration(
            color: MacosDynamicColor.resolve(
              MacosColors.controlBackgroundColor,
              context,
            ),
            borderRadius: BorderRadius.circular(10.0),
            border: Border.all(
              color: warningColor.withValues(alpha: 0.4),
            ),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Header
              Row(
                children: [
                  MacosIcon(
                    CupertinoIcons.arrow_up_circle_fill,
                    size: 28,
                    color: warningColor,
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      'Schema Upgrade Required',
                      style: MacosTheme.of(context).typography.headline.copyWith(
                            color: warningColor,
                            fontWeight: FontWeight.bold,
                          ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),

              // Version pill
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: warningColor.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(
                    color: warningColor.withValues(alpha: 0.3),
                  ),
                ),
                child: Text(
                  '${gate.pending} pending migration${gate.pending == 1 ? '' : 's'}  '
                  '${gate.currentVersion} → ${gate.targetVersion}',
                  style: MacosTheme.of(context).typography.footnote.copyWith(
                        fontFamily: 'CupertinoSystemMonospaced',
                        color: warningColor,
                        fontWeight: FontWeight.w600,
                      ),
                ),
              ),
              const SizedBox(height: 16),

              // Explanation
              Text(
                'This version of Watcher requires a database schema upgrade '
                'that has not been applied yet. The upgrade must be run once '
                'on one machine and pushed — every other clone adopts it automatically.',
                style: MacosTheme.of(context).typography.body,
              ),
              const SizedBox(height: 12),

              // Risk callout
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: MacosColors.systemOrangeColor.withValues(alpha: 0.08),
                  borderRadius: BorderRadius.circular(6),
                  border: Border.all(
                    color: MacosColors.systemOrangeColor.withValues(alpha: 0.25),
                  ),
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const MacosIcon(
                      CupertinoIcons.exclamationmark_triangle,
                      size: 14,
                      color: MacosColors.systemOrangeColor,
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'Only run this if no other machine is currently '
                        'migrating the same database. Running it on two '
                        'machines simultaneously will fork the schema.',
                        style: MacosTheme.of(context)
                            .typography
                            .footnote
                            .copyWith(color: MacosColors.systemOrangeColor),
                      ),
                    ),
                  ],
                ),
              ),
              if (_isCliOutdated()) ...[
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: errorColor.withValues(alpha: 0.08),
                    borderRadius: BorderRadius.circular(6),
                    border: Border.all(
                      color: errorColor.withValues(alpha: 0.25),
                    ),
                  ),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      MacosIcon(
                        CupertinoIcons.exclamationmark_octagon_fill,
                        size: 14,
                        color: errorColor,
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Outdated beads CLI Detected',
                              style: MacosTheme.of(context)
                                  .typography
                                  .footnote
                                  .copyWith(
                                    color: errorColor,
                                    fontWeight: FontWeight.bold,
                                  ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              'Watcher\'s engine expects beads version ${widget.appState.daemonVersion ?? "unknown"}, '
                              'but your CLI is at ${widget.appState.cliVersion ?? "unknown"}. '
                              'Running the migration now will fail or be a no-op because your CLI does not know how to apply schema version ${gate.targetVersion}. '
                              'Please upgrade your CLI first.',
                              style: MacosTheme.of(context)
                                  .typography
                                  .footnote
                                  .copyWith(color: errorColor),
                            ),
                            const SizedBox(height: 6),
                            Text(
                              'Upgrade command:',
                              style: MacosTheme.of(context)
                                  .typography
                                  .footnote
                                  .copyWith(
                                    color: errorColor,
                                    fontWeight: FontWeight.w600,
                                  ),
                            ),
                            const SizedBox(height: 3),
                            Container(
                              width: double.infinity,
                              padding: const EdgeInsets.all(6),
                              decoration: BoxDecoration(
                                color: innerBgColor,
                                borderRadius: BorderRadius.circular(4),
                              ),
                              child: SelectableText(
                                Platform.isMacOS
                                    ? 'CGO_CFLAGS="-I\$(brew --prefix icu4c)/include" CGO_LDFLAGS="-L\$(brew --prefix icu4c)/lib" CGO_CXXFLAGS="-std=c++17 -I\$(brew --prefix icu4c)/include" go install github.com/steveyegge/beads/cmd/bd@latest'
                                    : 'go install github.com/steveyegge/beads/cmd/bd@latest',
                                style: MacosTheme.of(context)
                                    .typography
                                    .footnote
                                    .copyWith(
                                      fontFamily: 'CupertinoSystemMonospaced',
                                      fontSize: 10,
                                      color: innerTextColor,
                                    ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ],
              const SizedBox(height: 16),

              // Commands block
              Text(
                'Commands that will run:',
                style: MacosTheme.of(context)
                    .typography
                    .subheadline
                    .copyWith(fontWeight: FontWeight.w600),
              ),
              const SizedBox(height: 6),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(10.0),
                decoration: BoxDecoration(
                  color: innerBgColor,
                  borderRadius: BorderRadius.circular(6.0),
                ),
                child: SelectableText(
                  commandText,
                  style: MacosTheme.of(context).typography.body.copyWith(
                        fontFamily: 'CupertinoSystemMonospaced',
                        fontSize: 12,
                        color: innerTextColor,
                      ),
                ),
              ),
              const SizedBox(height: 20),

              // Action buttons
              Row(
                children: [
                  // Primary: Run Migration in terminal
                  PushButton(
                    controlSize: ControlSize.regular,
                    onPressed: _launching ? null : _runMigration,
                    child: _launching
                        ? const SizedBox(
                            width: 14,
                            height: 14,
                            child: ProgressCircle(),
                          )
                        : const Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              MacosIcon(
                                CupertinoIcons.arrow_up_circle_fill,
                                size: 13,
                                color: MacosColors.white,
                              ),
                              SizedBox(width: 6),
                              Text('Run Migration'),
                            ],
                          ),
                  ),
                  const SizedBox(width: 8),

                  // Secondary: open terminal without pre-loading
                  PushButton(
                    controlSize: ControlSize.regular,
                    secondary: true,
                    onPressed: _launching ? null : _openTerminal,
                    child: const Text('Open Terminal'),
                  ),
                  const SizedBox(width: 8),

                  // Copy commands
                  PushButton(
                    controlSize: ControlSize.regular,
                    secondary: true,
                    onPressed: _copyCommands,
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        MacosIcon(
                          _copied
                              ? CupertinoIcons.checkmark_alt
                              : CupertinoIcons.doc_on_clipboard,
                          size: 13,
                          color: _copied
                              ? MacosColors.systemGreenColor
                              : MacosTheme.of(context).typography.body.color,
                        ),
                        const SizedBox(width: 6),
                        Text(_copied ? 'Copied!' : 'Copy'),
                      ],
                    ),
                  ),

                  const Spacer(),

                  // Retry (after user manually ran migration)
                  if (widget.onRetry != null)
                    PushButton(
                      controlSize: ControlSize.regular,
                      secondary: true,
                      onPressed: widget.onRetry,
                      child: const Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          MacosIcon(
                            CupertinoIcons.refresh,
                            size: 13,
                          ),
                          SizedBox(width: 6),
                          Text('Retry'),
                        ],
                      ),
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
