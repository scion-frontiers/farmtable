# Investigation: Feature 46 Not Visible on Live Site

**Date:** 2026-07-22  
**Investigator:** farmtable-inv-f46  
**Reporter:** ptone@google.com — "I'm not seeing Feature 46 on the live site? (no trash or add icons in relationships inspector)"

## Summary

Feature 46 IS deployed and fully working on the live site. The deploy agent's (farmtable-deploy-21) Playwright verification was **not** a false positive — I independently confirmed the same results. The root cause of the user's report is almost certainly **browser cache** (stale HTML serving an old JS bundle) or **UX confusion** — the user may be looking at the "Relations" section in the General tab instead of clicking the separate "Relationships" tab. A contributing factor is the server's lack of `Cache-Control` headers on the HTML page.

## Evidence

### 1. Deployment Is Correct ✅

- **Revision `farmtable-00027-6hc`** is the latest created and ready revision
- **100% traffic** routed to this revision (no split routing)
- Traffic became ready at `2026-07-22T14:10:15.495319Z`
- Image digest `sha256:2ca385401f1b...` matches both the Artifact Registry `:latest` tag and the revision's container spec
- Commit `7a2e742` (PR #123) is HEAD of `origin/main`

```
status.traffic[0] = { revisionName: "farmtable-00027-6hc", percent: 100, latestRevision: true }
```

### 2. Code Is in the Live Bundle ✅

The live JS bundle (`/assets/index-Dl-OMHtI.js`) contains all F46 identifiers:

| Identifier | Count in bundle |
|---|---|
| `delete-btn` | 5 |
| `trash` | 1 |
| `add-btn` | 3 |
| `plus-lg` | 3 |
| `rel-type` | 8 |
| `add-relationship` | 4 |
| `open-add-relationship` | 2 |
| `removeRelationships` | 6 |

### 3. PR #123 Diff Contains Expected Changes ✅

The diff includes:
- `ft-inspector-relationships.ts`: trash icon (`sl-icon-button[name="trash"]` with `.delete-btn` class) on each relationship entry, `+` button (`sl-icon-button[name="plus-lg"]` with `.add-btn` class) on BLOCKS/BLOCKED_BY section headers
- `ft-command-palette.ts`: add-relationship mode with type pills (Blocks / Blocked by)
- `ft-app.ts`: plumbing for `@open-add-relationship` and `@relationship-add` events
- `grpc-client.ts` / `service.ts`: `addBlocks`, `addBlockedBy`, `removeRelationships` mutation support

### 4. Independent Playwright Verification ✅

I ran Playwright headless Chrome against the live site (`https://farmtable-486315127503.us-central1.run.app/`) and confirmed:

**Default (Farm Table) collection:**
- `readOnly` = `false`
- "Blocked by" section: `hasAdd` = `true` (+ button present)
- "Blocks" section: `hasAdd` = `true` (+ button present)
- All 6 sections rendered (Parent, Children, Blocked by, Blocks, Related, Duplicate of)

**GitHub mirror collection:**
- `readOnly` = `false` (writable GitHub collection)
- Same result: both + buttons present

Screenshots saved at `/tmp/f46-test1-02-rel-tab.png` and `/tmp/f46-test2-02-rel-tab.png`.

### 5. Deploy-21's Verification Was Legitimate ✅

The deploy-21 verification script (`verify-f46.mjs`) used the correct approach:
- Ran against the live URL `https://farmtable-486315127503.us-central1.run.app`
- Navigated shadow DOMs correctly (`ft-app → ft-inspector → ft-inspector-relationships`)
- Confirmed trash icons present on entries, + buttons on BLOCKED BY/BLOCKS sections
- Tested full add and delete flows
- Screenshots saved under `/scion-volumes/scratchpad/projects/farmtable/deploy/2026-07-22-deploy-21/`

## Root Cause Analysis

The feature IS live. The user's report is explained by one or both of:

### Cause A: Browser Cache (Likely)

The server serves HTML via bare `http.FileServer` with **no `Cache-Control`, no `ETag`, and no `Last-Modified` headers**:

```go
// internal/serverapp/unified.go:23
mux.Handle("/", http.FileServer(assets))
```

Go's `embed.FS` zeros file modification times, so `http.FileServer` cannot generate `Last-Modified` headers. Without any cache directives, browsers apply **heuristic freshness** — the user's browser may have cached the HTML page from before the F46 deploy, which would reference the old JS bundle filename (Vite content-hashes the bundle, so old HTML → old bundle name → old code).

Evidence: `curl -sI` on the HTML page returns only `content-type: text/html; charset=utf-8` — no cache headers whatsoever.

### Cause B: UX Confusion (Possible)

There are two confusingly similar views in the Inspector:

1. **"Relations" section** (General tab, default) — uses `ft-inspector-relations` component — read-only clickable links, NO trash/add icons. Only shown when `task.relationships.length > 0`.
2. **"Relationships" tab** (separate tab) — uses `ft-inspector-relationships` component — F46 features (trash icons on hover, + buttons on BLOCKS/BLOCKED_BY sections).

The General tab is the default active tab. If the user opens the Inspector, sees a "Relations" collapsible section with relationship entries, and expects F46 features there, they would not find them. The F46 features are only in the separate "Relationships" tab.

### Cause C: Subtle UI (Contributing)

- The `+` buttons use `color: var(--sl-color-neutral-400)` — a subtle gray that could be easy to miss
- The trash icons have `opacity: 0` by default and only appear on hover (`.entry:hover .delete-btn { opacity: 1 }`)

## Scope Recommendation

**XS** — No code fix is required for the immediate issue. Two follow-up items are worth considering:

1. **Add `Cache-Control: no-cache` to HTML responses** (XS fix) — prevents stale HTML from serving old JS bundles. This would fix Cause A permanently. Location: `internal/serverapp/unified.go` or a middleware wrapper around the file server.
2. **Consider consolidating "Relations" and "Relationships"** (Medium, optional UX improvement) — having two similarly-named views showing overlapping data with different capabilities is confusing. Either remove the General tab's "Relations" section and let the "Relationships" tab be the single source, or rename them more distinctly.

## Recommended Approach

**Immediate action:** Tell ptone to hard-refresh the page (Ctrl+Shift+R / Cmd+Shift+R) or open in a private/incognito window. This will bypass any cached HTML.

**Short-term fix:** Add `Cache-Control: no-cache` header to HTML responses (the `index.html` route). Content-hashed assets (`/assets/*`) can use `Cache-Control: public, max-age=31536000, immutable` since their filenames change on each build.

## Open Questions

- I could not determine whether ptone was using a cached browser session. A follow-up with the user to confirm whether hard-refresh resolves the issue would close this conclusively.
- The "Relations" vs "Relationships" naming overlap may warrant a UX review but is separate from this incident.
