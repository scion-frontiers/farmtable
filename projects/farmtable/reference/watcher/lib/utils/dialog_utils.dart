import 'package:flutter/cupertino.dart';
import 'package:macos_ui/macos_ui.dart';

/// A11Y-02: wraps modal content so keyboard Tab/Shift-Tab traversal stays inside
/// the modal instead of leaking into the background screen's toolbar/sidebar.
///
/// Use as the root of a modal presented via `showMacosSheet` (which provides a
/// route barrier but no Tab trap). It creates a dedicated [FocusScope] that
/// requests focus on show and restores the previously-focused node on dismiss,
/// and a [FocusTraversalGroup] so Tab cycles only through this subtree.
class ModalFocusTrap extends StatefulWidget {
  final Widget child;
  const ModalFocusTrap({super.key, required this.child});

  @override
  State<ModalFocusTrap> createState() => _ModalFocusTrapState();
}

class _ModalFocusTrapState extends State<ModalFocusTrap> {
  final FocusScopeNode _scopeNode = FocusScopeNode();

  @override
  void initState() {
    super.initState();
    // Move focus into the modal once it is mounted so Tab starts inside it.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _scopeNode.requestFocus();
    });
  }

  @override
  void dispose() {
    _scopeNode.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return FocusScope(
      node: _scopeNode,
      child: FocusTraversalGroup(child: widget.child),
    );
  }
}

/// Shared alert helpers (REL-01).
///
/// Fire-and-forget UI mutations (updateIssue, removeProject, drag-and-drop
/// reparenting/status changes) previously swallowed failures, so a user could
/// perform an action, see nothing happen, and not know why. These helpers give
/// those call sites a consistent native failure alert.
class DialogUtils {
  DialogUtils._();

  /// Shows a native macOS error alert. Safe to call after an `await`: callers
  /// should guard with a `context.mounted` check first.
  static Future<void> showError(
    BuildContext context, {
    required String title,
    required String message,
  }) {
    return showMacosAlertDialog(
      context: context,
      builder: (context) => MacosAlertDialog(
        appIcon: const MacosIcon(
          CupertinoIcons.exclamationmark_triangle_fill,
          size: 56,
          color: MacosColors.systemRedColor,
        ),
        title: Text(title),
        message: Text(
          message,
          textAlign: TextAlign.center,
          style: MacosTheme.of(context).typography.body,
        ),
        primaryButton: PushButton(
          controlSize: ControlSize.large,
          onPressed: () => Navigator.of(context).pop(),
          child: const Text('OK'),
        ),
      ),
    );
  }

  /// Shows a native-looking temporary success or error toast overlay.
  static void showToast(
    BuildContext context, {
    required String message,
    bool isError = false,
  }) {
    final overlay = Overlay.of(context);
    late OverlayEntry entry;

    entry = OverlayEntry(
      builder: (context) {
        return Positioned(
          bottom: 40,
          left: 0,
          right: 0,
          child: Align(
            alignment: Alignment.bottomCenter,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              decoration: BoxDecoration(
                color: isError
                    ? const Color(0xFFE53935)
                    : MacosTheme.of(context).brightness.isDark
                        ? const Color(0xFF28282B)
                        : const Color(0xFFF4F5F6),
                borderRadius: BorderRadius.circular(20),
                boxShadow: [
                  BoxShadow(
                    color: MacosColors.black.withValues(alpha: 0.15),
                    blurRadius: 10,
                    offset: const Offset(0, 4),
                  ),
                ],
                border: Border.all(
                  color: isError
                      ? const Color(0xFFD32F2F)
                      : MacosColors.systemGrayColor.withValues(alpha: 0.2),
                ),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  MacosIcon(
                    isError
                        ? CupertinoIcons.exclamationmark_triangle_fill
                        : CupertinoIcons.checkmark_circle_fill,
                    color: isError ? MacosColors.white : MacosColors.systemGreenColor,
                    size: 18,
                  ),
                  const SizedBox(width: 8),
                  Text(
                    message,
                    style: TextStyle(
                      color: isError
                          ? MacosColors.white
                          : MacosTheme.of(context).brightness.isDark
                              ? const Color(0xFFF1F2F3)
                              : const Color(0xFF1A1A1A),
                      fontWeight: FontWeight.w500,
                      fontSize: 13,
                      decoration: TextDecoration.none,
                    ),
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );

    overlay.insert(entry);
    Future.delayed(const Duration(seconds: 3), () {
      if (entry.mounted) {
        entry.remove();
      }
    });
  }
}
