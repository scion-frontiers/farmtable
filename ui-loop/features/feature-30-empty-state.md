# Feature 30 — Reusable Empty State Component

**Date:** 2026-07-20
**Branch:** `feat/empty-state-component`
**Commit:** `607726d`

## What Was Built

A reusable `<ft-empty-state>` Lit web component that provides a consistent empty state UI pattern across the Farmtable dashboard.

### Component: `web/src/components/ft-empty-state.ts`

**Properties:**
- `icon` (string, default: `'inbox'`) — Shoelace/Bootstrap icon name
- `heading` (string) — primary title text
- `subtitle` (string, optional) — secondary description text
- `icon-color` (string, optional) — CSS color override for the icon; defaults to `var(--sl-color-neutral-400)`

**Layout:**
- Flexbox column, centered both axes
- `:host` fills available space with `height: 100%`
- 48px icon, 1.1rem/600-weight heading, 0.875rem subtitle
- 0.75rem gap between elements

### Integration Point

The tree view (`ft-tree-view.ts`) empty state was the first consumer. The previous implementation was a plain `<div class="empty-state">No tasks to display</div>` with inline CSS. This was replaced with:

```html
<ft-empty-state
  icon="diagram-3"
  heading="No tasks to display"
  subtitle="Tasks will appear here when added to this collection"
></ft-empty-state>
```

The `.empty-state` CSS class was removed from the tree view's styles since it's no longer needed.

### Registration

The component is globally registered in `web/src/index.ts`, placed alphabetically between `ft-connection-badge` and `ft-toolbar`.

## Design Decisions

1. **Icon color via inline style, not CSS variable override** — The `icon-color` property applies via inline `style` on the `<sl-icon>` element. This is simpler than requiring consumers to set a CSS custom property and works well with Lit's `nothing` directive for the no-color case.

2. **`:host` fills available space** — Using `height: 100%` on `:host` means the component fills its container. This matches how empty states are typically used (replacing content in a flex container).

3. **No slot / action button** — Kept simple for the initial implementation. A `<slot>` for an optional action button (e.g., "Create task") could be added later if needed.

4. **Global registration, no local imports** — Since the component is registered as a custom element in `index.ts`, consuming components just use the tag name — no import needed in the consuming file.

## Screenshots

Saved to: `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-30-empty-state/`

- `empty-state-variants.png` — Four variants demonstrating reusability (tree view, search results, inbox, custom color)
- `empty-state-tree-view.png` — Close-up of the tree view empty state

## Verification

- `npm run build` passes (tsc --noEmit + vite build)
- Screenshots confirm visual rendering with multiple icon/heading/subtitle combinations
