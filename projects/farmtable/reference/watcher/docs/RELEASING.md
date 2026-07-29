# Releasing Watcher

This document outlines the process for releasing a new version of Watcher.

## Versioning Scheme

Watcher follows [Semantic Versioning](https://semver.org/).
- **Major:** Breaking changes or significant architectural shifts.
- **Minor:** New features and major UI improvements.
- **Patch:** Bug fixes and maintenance.

Versions are tracked in `pubspec.yaml`.

## Automated Releases (GitHub Actions & Release Please)

Watcher uses [Release Please](https://github.com/googleapis/release-please-action) to fully automate versioning, changelog generation, and GitHub Release creation based on [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/).

1.  **Merge to Main:** Every time you push or merge code to the `main` branch, the Release Please GitHub Action runs.
2.  **Release PR:** It parses your commit messages (e.g., `feat:`, `fix:`) and automatically creates or updates a "Release PR". This PR contains the drafted `CHANGELOG.md` and the updated `version` string in `pubspec.yaml`.
3.  **Approve & Merge:** When you are ready to cut a release, simply approve and merge that Release PR into `main`.
4.  **Automatic Bundling:** Once the Release PR is merged, Release Please automatically creates the GitHub Release and Git Tag. This triggers the `build-macos` job, which compiles the Go daemon, the Flutter macOS app, bundles them together, and uploads the final `.app.zip` to the GitHub Release.

### Controlling Version Bumps

Your commit messages determine the version bump:
- **Patch (0.0.x):** Use the `fix:` prefix (e.g., `fix: resolve crash on startup`).
- **Minor (0.x.0):** Use the `feat:` prefix (e.g., `feat: add new dashboard`).
- **Major (x.0.0):** Use the `feat!:` or `fix!:` prefix, or include `BREAKING CHANGE:` in the commit footer.

## Local/Manual Release

If you need to build a release build locally for testing:

1.  **Update Dependencies:**
    ```bash
    make update-bd
    flutter pub get
    ```
2.  **Build and Install:**
    ```bash
    make build
    # Or to install to /Applications via symlink
    make install
    ```
3.  **Manual Bundling:**
    To create a standalone `.app` bundle manually:
    - Run `flutter build macos --release`.
    - Build the daemon: `make build-daemon`.
    - Copy the daemon to `build/macos/Build/Products/Release/Watcher.app/Contents/Resources/`.
    - Re-sign: `codesign --force --deep --sign - build/macos/Build/Products/Release/Watcher.app`.

## Dependency Updates

To update the embedded `beads` dependency to the latest upstream release:
```bash
make update-bd
```
This will pull the latest stable version from GitHub and update `daemon/go.mod`.
