import 'package:flutter/material.dart' show ThemeMode;
import 'package:flutter/cupertino.dart';
import 'package:flutter/services.dart';
import 'package:macos_ui/macos_ui.dart';
import 'state/app_state.dart';
import 'router.dart';
import 'widgets/settings_modal.dart';
import 'widgets/command_palette.dart';

final appState = AppState();

Future<void> _configureMacosWindowUtils() async {
  const config = MacosWindowUtilsConfig();
  await config.apply();
}

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await _configureMacosWindowUtils();

  runApp(const WatcherApp());
}

class WatcherApp extends StatelessWidget {
  const WatcherApp({super.key});

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: appState,
      builder: (context, _) {
        return PlatformMenuBar(
          menus: [
            PlatformMenu(
              label: 'Watcher',
              menus: [
                PlatformMenuItemGroup(
                  members: [
                    if (PlatformProvidedMenuItem.hasMenu(
                      PlatformProvidedMenuItemType.about,
                    ))
                      const PlatformProvidedMenuItem(
                        type: PlatformProvidedMenuItemType.about,
                      ),
                  ],
                ),
                PlatformMenuItemGroup(
                  members: [
                    PlatformMenuItem(
                      label: 'Settings...',
                      shortcut: const SingleActivator(
                        LogicalKeyboardKey.comma,
                        meta: true,
                      ),
                      onSelected: () {
                        final context = appRouter
                            .routerDelegate
                            .navigatorKey
                            .currentContext;
                        if (context != null) SettingsModal.show(context);
                      },
                    ),
                  ],
                ),
                PlatformMenuItemGroup(
                  members: [
                    if (PlatformProvidedMenuItem.hasMenu(
                      PlatformProvidedMenuItemType.servicesSubmenu,
                    ))
                      const PlatformProvidedMenuItem(
                        type: PlatformProvidedMenuItemType.servicesSubmenu,
                      ),
                  ],
                ),
                PlatformMenuItemGroup(
                  members: [
                    if (PlatformProvidedMenuItem.hasMenu(
                      PlatformProvidedMenuItemType.hide,
                    ))
                      const PlatformProvidedMenuItem(
                        type: PlatformProvidedMenuItemType.hide,
                      ),
                    if (PlatformProvidedMenuItem.hasMenu(
                      PlatformProvidedMenuItemType.hideOtherApplications,
                    ))
                      const PlatformProvidedMenuItem(
                        type:
                            PlatformProvidedMenuItemType.hideOtherApplications,
                      ),
                    if (PlatformProvidedMenuItem.hasMenu(
                      PlatformProvidedMenuItemType.showAllApplications,
                    ))
                      const PlatformProvidedMenuItem(
                        type: PlatformProvidedMenuItemType.showAllApplications,
                      ),
                  ],
                ),
                PlatformMenuItemGroup(
                  members: [
                    if (PlatformProvidedMenuItem.hasMenu(
                      PlatformProvidedMenuItemType.quit,
                    ))
                      const PlatformProvidedMenuItem(
                        type: PlatformProvidedMenuItemType.quit,
                      ),
                  ],
                ),
              ],
            ),
            const PlatformMenu(
              label: 'Edit',
              menus: [
                PlatformMenuItemGroup(
                  members: [
                    PlatformMenuItem(
                      label: 'Undo',
                      shortcut: SingleActivator(
                        LogicalKeyboardKey.keyZ,
                        meta: true,
                      ),
                      onSelected: null, // OS handles shortcut
                    ),
                    PlatformMenuItem(
                      label: 'Redo',
                      shortcut: SingleActivator(
                        LogicalKeyboardKey.keyZ,
                        meta: true,
                        shift: true,
                      ),
                      onSelected: null, // OS handles shortcut
                    ),
                  ],
                ),
                PlatformMenuItemGroup(
                  members: [
                    PlatformMenuItem(
                      label: 'Cut',
                      shortcut: SingleActivator(
                        LogicalKeyboardKey.keyX,
                        meta: true,
                      ),
                      onSelected: null,
                    ),
                    PlatformMenuItem(
                      label: 'Copy',
                      shortcut: SingleActivator(
                        LogicalKeyboardKey.keyC,
                        meta: true,
                      ),
                      onSelected: null,
                    ),
                    PlatformMenuItem(
                      label: 'Paste',
                      shortcut: SingleActivator(
                        LogicalKeyboardKey.keyV,
                        meta: true,
                      ),
                      onSelected: null,
                    ),
                    PlatformMenuItem(
                      label: 'Select All',
                      shortcut: SingleActivator(
                        LogicalKeyboardKey.keyA,
                        meta: true,
                      ),
                      onSelected: null,
                    ),
                  ],
                ),
              ],
            ),
            PlatformMenu(
              label: 'View',
              menus: [
                PlatformMenuItemGroup(
                  members: [
                    PlatformMenuItem(
                      label: 'Show Inspector',
                      shortcut: const SingleActivator(
                        LogicalKeyboardKey.keyI,
                        meta: true,
                        alt: true,
                      ),
                      onSelected: () {
                        final context = appRouter
                            .routerDelegate
                            .navigatorKey
                            .currentContext;
                        if (context == null) return;
                        final scope = MacosWindowScope.maybeOf(context);
                        scope?.toggleEndSidebar();
                      },
                    ),
                  ],
                ),
                PlatformMenuItemGroup(
                  members: [
                    if (PlatformProvidedMenuItem.hasMenu(
                      PlatformProvidedMenuItemType.toggleFullScreen,
                    ))
                      const PlatformProvidedMenuItem(
                        type: PlatformProvidedMenuItemType.toggleFullScreen,
                      ),
                  ],
                ),
              ],
            ),
            PlatformMenu(
              label: 'Window',
              menus: [
                if (PlatformProvidedMenuItem.hasMenu(
                  PlatformProvidedMenuItemType.minimizeWindow,
                ))
                  const PlatformProvidedMenuItem(
                    type: PlatformProvidedMenuItemType.minimizeWindow,
                  ),
                if (PlatformProvidedMenuItem.hasMenu(
                  PlatformProvidedMenuItemType.zoomWindow,
                ))
                  const PlatformProvidedMenuItem(
                    type: PlatformProvidedMenuItemType.zoomWindow,
                  ),
                if (PlatformProvidedMenuItem.hasMenu(
                  PlatformProvidedMenuItemType.arrangeWindowsInFront,
                ))
                  const PlatformProvidedMenuItem(
                    type: PlatformProvidedMenuItemType.arrangeWindowsInFront,
                  ),
              ],
            ),
            PlatformMenu(
              label: 'Help',
              menus: [
                PlatformMenuItemGroup(
                  members: [
                    PlatformMenuItem(
                      label: 'Watcher Help',
                      onSelected: null, // placeholder — no help URL yet
                    ),
                  ],
                ),
              ],
            ),
          ],
          child: Shortcuts(
            shortcuts: <ShortcutActivator, Intent>{
              const SingleActivator(
                LogicalKeyboardKey.comma,
                control: false,
                alt: false,
                shift: false,
                meta: true,
              ): const _OpenSettingsIntent(),
              const SingleActivator(
                LogicalKeyboardKey.keyP,
                control: false,
                alt: false,
                shift: false,
                meta: true,
              ): const _OpenSearchIntent(),
              const SingleActivator(
                LogicalKeyboardKey.keyK,
                control: false,
                alt: false,
                shift: false,
                meta: true,
              ): const _OpenSearchIntent(),
            },
            child: Actions(
              actions: <Type, Action<Intent>>{
                _OpenSettingsIntent: CallbackAction<_OpenSettingsIntent>(
                  onInvoke: (intent) {
                    final context =
                        appRouter.routerDelegate.navigatorKey.currentContext;
                    if (context != null) SettingsModal.show(context);
                    return null;
                  },
                ),
                _OpenSearchIntent: CallbackAction<_OpenSearchIntent>(
                  onInvoke: (intent) {
                    final context =
                        appRouter.routerDelegate.navigatorKey.currentContext;
                    if (context != null && appState.selectedProject != null) {
                      CommandPalette.show(context);
                    }
                    return null;
                  },
                ),
              },
              child: MacosApp.router(
                title: 'Beads Watcher',
                theme: MacosThemeData.light(),
                darkTheme: MacosThemeData.dark(),
                themeMode: ThemeMode.system,
                routerConfig: appRouter,
              ),
            ),
          ),
        );
      },
    );
  }
}

class _OpenSettingsIntent extends Intent {
  const _OpenSettingsIntent();
}

class _OpenSearchIntent extends Intent {
  const _OpenSearchIntent();
}
