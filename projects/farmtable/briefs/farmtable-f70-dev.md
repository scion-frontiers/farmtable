# Brief: Feature 70 — Tractor Emoji Favicon

## Critical Constraints (read first)
- Dedicated git worktree: `git worktree add /workspace/farmtable-f70-dev -b feature-70-favicon origin/main`
- **Do NOT add new npm dependencies** (no `sharp`, `canvas`, favicon-generator packages,
  etc.) — none currently exist in `web/package.json`, and this feature doesn't need them.
- No `web/public/` directory currently exists — you'll be creating it. Vite serves this
  directory's contents at the site root automatically (default behavior), no config
  change needed (confirmed via `vite.config.ts` — no `public` dir override is set).

## User Request (verbatim, from ptone@google.com)
"We like to create some sort of favicon for the serving service. something based on the
tractor emoji"

## Approach
The simplest correct approach that needs zero new dependencies or external tools: an SVG
favicon containing a `<text>` element that renders the 🚜 emoji directly. This is a
standard, well-supported technique — modern browsers (Chrome, Firefox, Edge, Safari) all
render emoji glyphs inside SVG `<text>` elements when used as a favicon.

Example SVG content (adjust as needed for centering/sizing — verify visually rather than
trusting this exact markup):
```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <text x="50" y="50" font-size="80" text-anchor="middle" dominant-baseline="central">🚜</text>
</svg>
```

## Task
1. Create `web/public/favicon.svg` with an SVG rendering the tractor emoji (🚜),
   reasonably centered and sized to look good as a small favicon (browser tabs render
   favicons very small, ~16-32px — make sure the emoji isn't clipped or too small within
   the viewBox).
2. Add a favicon link tag to `web/index.html`'s `<head>`:
   `<link rel="icon" type="image/svg+xml" href="/favicon.svg">`
3. Build the app locally (`npm run build` or equivalent in `web/`) and confirm the
   favicon file ends up in the build output (`dist/`) and is referenced correctly.
4. Verify visually: serve the built app locally (or use the dev server) and take a
   screenshot of the browser tab showing the tractor emoji favicon rendering correctly.
5. Run `npx tsc --noEmit` if applicable (this change is HTML/SVG only, likely no
   TypeScript impact, but confirm nothing broke).

## Deliverables
1. A PR against `main`.
2. A screenshot showing the favicon rendering in an actual browser tab (not just the SVG
   file opened standalone — the point is confirming it works AS a favicon), saved to
   `/scion-volumes/scratchpad/projects/farmtable/reports/f70-favicon-evidence/`.
3. A message to the coordinator with the PR link.

## Direct Contact
- Coordinator: `scion message coordinator "<message>"` for questions or completion.
- Do not contact ptone@google.com directly.

## Termination
You MUST create the SVG favicon, wire it up in index.html, verify it actually renders as
a browser tab favicon with a real screenshot (not just the raw SVG), open the PR, and
message the coordinator with the PR link. Then signal task_completed.
