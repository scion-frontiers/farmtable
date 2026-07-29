## Task State Web UI Security Audit

Date: 2026-07-27
Branch: `task-state-web-ui`
Commit: `2f912bbee2f4cfc2f40f2650164a56c69a697fb9`
Requested base: `7a0f220dbd9332cb8db62138c841777432b4eda4`
Verdict: REQUEST CHANGES

### Scope Reviewed

- Web UI task-state rendering and wiring under `web/src/components`.
- Generated client/service changes under `web/src/gen`.
- Task-state utilities and tests under `web/src/util` and `web/src/utils`.
- Web styles and Vite/package configuration.
- Generated build output was searched for token and rendering sinks.

### Base Diff Limitation

The local checkout contains only the feature commit as a root commit. The requested base commit was not available locally, and fetching it failed because GitHub access required credentials. I audited the scoped current files directly and used the root commit file list from `git show HEAD`.

### Verification

- `npm audit --audit-level=low` from `web`: passed with 0 vulnerabilities.
- `npm test` from `web`: passed.
- `npm run build` from `web`: passed. Vite emitted a bundle-size warning, not a security failure.
- `git diff --check`: passed.

### Findings Summary

- High: untrusted `task.remoteUrl` is rendered directly as an external link in `web/src/components/inspector/ft-inspector-meta.ts`.
- Medium: generated client and app shell still support bearer token fallback from `localStorage` in `web/src/gen/grpc-client.ts` and `web/src/components/ft-app.ts`.
- Low: generated mock change history still exposes removed state vocabulary `Ready` and `Blocked` in `web/src/gen/service.ts`.

The primary report with proof of concept and remediation examples was written to:

`/scion-volumes/scratchpad/projects/farmtable/reports/audit-task-state-web-ui.md`

### Positive Notes

- Lit interpolation is used for the new task labels, names, assignees, stage badges, filter chips, and queue rows.
- Comment Markdown is sanitized with DOMPurify before being rendered via `unsafeHTML`.
- The URL token query parameter was removed from the generated gRPC client.
- No suspicious npm lifecycle scripts or dependency audit failures were found in the web package.
