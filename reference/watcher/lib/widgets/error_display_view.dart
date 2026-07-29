import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart' show SelectableText;
import 'package:flutter/services.dart';
import 'package:macos_ui/macos_ui.dart';

class ErrorDisplayView extends StatefulWidget {
  final String error;
  final VoidCallback? onRetry;

  const ErrorDisplayView({super.key, required this.error, this.onRetry});

  @override
  State<ErrorDisplayView> createState() => _ErrorDisplayViewState();
}

class _ErrorDisplayViewState extends State<ErrorDisplayView> {
  bool _copied = false;

  void _copyError() async {
    await Clipboard.setData(ClipboardData(text: widget.error));
    if (mounted) {
      setState(() => _copied = true);
      Future.delayed(const Duration(seconds: 2), () {
        if (mounted) {
          setState(() => _copied = false);
        }
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final errorColor = MacosDynamicColor.resolve(
      const CupertinoDynamicColor.withBrightness(
        color: Color(0xFFC92A2A),
        darkColor: Color(0xFFFF8787),
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

    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24.0),
        child: Container(
          constraints: const BoxConstraints(maxWidth: 500),
          padding: const EdgeInsets.all(20.0),
          decoration: BoxDecoration(
            color: MacosDynamicColor.resolve(
              MacosColors.controlBackgroundColor,
              context,
            ),
            borderRadius: BorderRadius.circular(8.0),
            border: Border.all(
              color: errorColor.withValues(alpha: 0.3),
            ),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              MacosIcon(
                CupertinoIcons.exclamationmark_triangle_fill,
                size: 36,
                color: errorColor,
              ),
              const SizedBox(height: 12),
              Text(
                'An Error Occurred',
                style: MacosTheme.of(context).typography.headline.copyWith(
                  color: errorColor,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 12),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(12.0),
                decoration: BoxDecoration(
                  color: innerBgColor,
                  borderRadius: BorderRadius.circular(6.0),
                ),
                child: SelectableText(
                  widget.error,
                  // UI-05 (watcher-ckm): pin an explicit high-contrast label
                  // color so the message meets WCAG AA on the alternating
                  // background instead of inheriting a faint default.
                  style: MacosTheme.of(context).typography.body.copyWith(
                    fontFamily: 'CupertinoSystemMonospaced',
                    fontSize: 12,
                    color: innerTextColor,
                  ),
                  textAlign: TextAlign.left,
                ),
              ),
              const SizedBox(height: 16),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  PushButton(
                    controlSize: ControlSize.regular,
                    secondary: true,
                    onPressed: _copyError,
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        MacosIcon(
                          _copied
                              ? CupertinoIcons.checkmark_alt
                              : CupertinoIcons.doc_on_clipboard,
                          size: 14,
                          color: _copied
                              ? MacosColors.systemGreenColor
                              : MacosTheme.of(context).typography.body.color,
                        ),
                        const SizedBox(width: 6),
                        Text(_copied ? 'Copied!' : 'Copy Error'),
                      ],
                    ),
                  ),
                  if (widget.onRetry != null) ...[
                    const SizedBox(width: 12),
                    PushButton(
                      controlSize: ControlSize.regular,
                      onPressed: widget.onRetry,
                      child: const Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          MacosIcon(
                            CupertinoIcons.refresh,
                            size: 14,
                            color: MacosColors.white,
                          ),
                          SizedBox(width: 6),
                          Text('Retry'),
                        ],
                      ),
                    ),
                  ],
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
