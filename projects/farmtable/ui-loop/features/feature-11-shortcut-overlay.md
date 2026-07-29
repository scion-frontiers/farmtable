# Feature 11: Keyboard Shortcut Overlay

## Summary

Added a compact keyboard shortcut overlay for Farm Table's web dashboard. It is opened from a `?` help icon in the top toolbar or with the conventional `?` key, and it documents only the keyboard behavior implemented by Features 9 and 10.

## Changes

- `web/src/components/ft-shortcut-overlay.ts`
  - New Lit component with a modal-style shortcut reference.
  - Lists current Kanban shortcuts: Tab, Enter/Space, Arrow Up/Down, Arrow Left/Right, Home/End.
  - Lists current Inspector keyboard behavior: Tab through controls, Escape closes active editor or inspector.
  - Supports Escape, click-outside, and explicit close-button dismissal using document listeners and `composedPath()` containment checks.

- `web/src/components/ft-toolbar.ts`
  - Added a labeled `question-circle` icon button that dispatches `shortcut-help-open`.

- `web/src/components/ft-app.ts`
  - Added overlay open state and toolbar event wiring.
  - Added guarded `?` key handling that does not trigger from inputs, textareas, selects, Shoelace editable controls, or contenteditable targets.

- `web/src/index.ts`
  - Registered the new custom element.

## Verification

- `cd web && npm run typecheck`: passed.
- `cd web && npm run build`: passed.
- `go test ./...`: passed.
- `go build ./...`: passed.
- Playwright runtime verification against local Vite server:
  - Opened overlay from toolbar help icon and confirmed the real shortcut list is visible.
  - Dismissed overlay with Escape.
  - Opened overlay with `?` and dismissed by clicking outside the panel.

Local Vite produced expected existing gRPC-Web 500/404 console noise because no backend API is proxied behind the dev server; this did not affect overlay behavior.

## Screenshots

Saved in `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-11-shortcut-overlay/`.

- `shortcut-overlay-open.png`
  - MD5: `fe889c1a9a6955698dae910bef3aec03`
- `shortcut-overlay-dismissed-escape.png`
  - MD5: `b08fcdb10c4657828a12941602ad5d7c`
- `shortcut-overlay-dismissed-click-outside.png`
  - MD5: `4ebe00895fef4127fc0a4ee096d815d5`

## Review History

### R1: REQUEST CHANGES

All findings fixed:
- I-1: Added the General shortcut group documenting `?`.
- I-2: Changed the `?` key handler from open-only to toggle.
- S-1: Documented the split between FtApp's global `?` listener and the overlay's modal key listener.
- S-2: Restored focus to the previously focused element when the overlay closes.
- S-3: Added Tab/Shift+Tab focus trapping inside the modal panel.
- S-4: Consolidated duplicate toolbar icon CSS into `.toolbar-icon-button`.
- S-5: Replaced the hardcoded dialog title ID with a per-instance generated ID.

### R2: APPROVE

Verdict: APPROVE — non-blocking findings only, ship as-is per exit criteria.

- I-1 (non-blocking): Focus trap can escape on forward Tab due to shadow DOM element mismatch — `focusableElements()` returns Shoelace host elements but `activeElement()` traverses into shadow roots, causing `indexOf` to return -1.
- S-1: `?` key handler doesn't call `stopPropagation()` when overlay is open.
- S-2: Body scroll not locked while overlay is open.
- S-3: Module-level `let overlayId` could be a static class field.
- S-4: Consider `inert` attribute for background content.

## Unaddressed R2 Findings (shipped as-is per exit criteria)

- Focus trap forward-Tab shadow DOM edge case (Important but non-blocking)
- `?` handler stopPropagation (Suggestion)
- Body scroll lock (Suggestion)
- Static class field for overlayId (Suggestion)
- `inert` attribute for background content (Suggestion)

## Suggested Next UI/UX Feature

Return to new functional surface area next. The recent keyboard-accessibility arc now covers inspector keyboard behavior, kanban card navigation, and shortcut discoverability. The next high-value UI pass should be task filtering that actually drives the board data from the toolbar controls, so the existing Phase and Assignee controls become useful rather than decorative.

## Final State

- Branch: `feat/shortcut-overlay`
- PR: https://github.com/scion-frontiers/farmtable/pull/57
- Implementation commit: `08f41c7` (`feat: add keyboard shortcut overlay`)
- R1 fix commit: `9f4291b` (`fix: address R1 review findings for shortcut overlay`)
- 4 files changed, +395 / -3 lines
- Automated checks: typecheck and build passed
- Runtime verification: screenshots captured with distinct hashes
- 2 review rounds: R1 REQUEST CHANGES (all fixed), R2 APPROVE (non-blocking only, ship as-is)
