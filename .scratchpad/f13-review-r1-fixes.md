# Review Round 1 Fixes Required

The reviewer APPROVED but found 4 items. Fix ALL of them.

## Fix 1 (Important): Remove duplicate handler onFilterClear

In `web/src/components/ft-app.ts`, `onFilterClear` is identical to `onFilterChange`.
Delete `onFilterClear` and change the template to use `onFilterChange` directly:

Change:
```
@filter-clear=${this.onFilterClear}
```
To:
```
@filter-clear=${this.onFilterChange}
```

Then delete the `onFilterClear` method entirely (lines ~181-185).

## Fix 2 (Suggestion): Fix phantom 1px border when no filters active

In `web/src/components/ft-filter-chips.ts`, the `:host` CSS always applies `display: block` and `border-bottom`, so even when `render()` returns `nothing`, a 1px border line appears.

Fix: Use `this.hidden` to hide the host when no filters are active:

```typescript
render() {
    const activeFilterCount = Number(this.phaseFilter !== null) + Number(this.assigneeFilter !== null);
    this.hidden = activeFilterCount === 0;
    if (activeFilterCount === 0) return nothing;
    // ... rest of render
}
```

And add to CSS:
```css
:host([hidden]) {
  display: none !important;
}
```

## Fix 3 (Suggestion): Note about duplicate listUsers RPC

This is a known minor inefficiency. Add a brief code comment in ft-app.ts near `loadUsers()`:

```typescript
// TODO: ft-toolbar also calls listUsers() independently. Consider consolidating
// into a single app-level user list passed to both toolbar and filter chips.
```

## Fix 4 (Suggestion): Add role="group" to chips container

In `web/src/components/ft-filter-chips.ts`, change the chips div:

From:
```html
<div class="chips" aria-label="Active filters">
```
To:
```html
<div class="chips" role="group" aria-label="Active filters">
```

## After fixing

1. Run `cd /workspace/farmtable/web && npm run build` to verify
2. Commit with message: `fix: address review findings for filter chips`
