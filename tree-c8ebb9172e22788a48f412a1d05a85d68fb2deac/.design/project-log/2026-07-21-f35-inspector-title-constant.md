# F35 — Move Task Title to Constant Position Above Inspector Tabs

Moved the `ft-inspector-header` element from inside the "General" tab panel to
a fixed position above the `sl-tab-group`, between the header bar and the tab
navigation. This ensures the task title and header controls remain constantly
visible regardless of which inspector tab is active.

Changes in `web/src/components/inspector/ft-inspector.ts`:

- Relocated `<ft-inspector-header>` from inside `<sl-tab-panel name="general">`
  to directly after the `.header-bar` div and before `<sl-tab-group>`.
- Added CSS rule for `ft-inspector-header` with `margin-bottom: 0.5rem` and
  `flex-shrink: 0` to keep spacing consistent and prevent the header from
  collapsing during flex layout.

Verification:

- `npm run build` in `web/` passes (tsc + vite build, zero errors).
