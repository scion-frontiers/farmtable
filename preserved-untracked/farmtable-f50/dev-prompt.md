## Feature 50: Scrollable Collection List Landing Page + New Project Button

You are working in /workspace on branch feat/f50-landing-page-scroll-newproject.

### Your Task

Implement two changes to the landing page (the collection-selection page shown when no `?collection=` param is present):

1. **Make the collection list scrollable** when it overflows the viewport
2. **Add a "New Project" button** that opens the existing new-collection dialog

### Architecture Context

The app uses a Lit web components architecture with Shoelace UI library.

- `ft-app.ts` is the shell. Its `:host` has `height: 100vh; overflow: hidden`.
- When `routeView !== 'board'`, `ft-app` renders `<ft-collection-list>` directly as a child of the flex column — no scroll container wraps it. This means when there are many collections, the content is clipped.
- The board view uses `.content > .main { overflow: auto }` for scrolling — the landing view needs a similar pattern.

### Exact Changes Required

#### File 1: `web/src/components/ft-app.ts`

In the `render()` method, the landing view currently renders like this (around line 219-229):

```typescript
if (this.routeView !== 'board') {
  return html`
    ${this.routeView === 'validating'
      ? html`<div class="placeholder">...</div>`
      : html`<ft-collection-list ...></ft-collection-list>`}
    <ft-shortcut-overlay ...></ft-shortcut-overlay>
  `;
}
```

Wrap the landing content in a scroll container. Add a CSS class `.landing` to the styles:

```css
.landing {
  flex: 1;
  overflow: auto;
  min-height: 0;
}
```

Then wrap the `ft-collection-list` in `<div class="landing">`:

```html
<div class="landing">
  <ft-collection-list ...></ft-collection-list>
</div>
```

Keep the validating spinner outside (or inside — either works since it's small). The key requirement: `ft-collection-list` must be inside a bounded scroll container.

#### File 2: `web/src/components/ft-collection-list.ts`

**CSS changes:**
1. Remove `min-height: 100vh` from `:host` — this prevents the scroll container from working
2. Keep `display: block` on `:host` (it's fine)

**Add import:**
```typescript
import './ft-new-collection-dialog.js';
```

**Add types for the dialog** (copy the pattern from ft-toolbar.ts):
```typescript
type NewCollectionDialog = HTMLElement & {
  show(): Promise<void>;
  close(): void;
  setCreating(v: boolean): void;
  setError(msg: string): void;
};
```

**Add a query for the dialog:**
```typescript
import { customElement, property, state, query } from 'lit/decorators.js';
// ...
@query('ft-new-collection-dialog')
private newCollectionDialog!: NewCollectionDialog;
```

**Update the render() method** — add the New Project button AND the dialog:
- Place the button in the header area, next to or below the lede text, BEFORE the list
- Use a Shoelace button with the plus-lg icon
- Add the dialog at the end of the template

**Add the header layout** — wrap the h1, lede, and button in a flex header:
```css
.header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1.5rem;
}
.header-text {
  flex: 1;
}
```

Update render to put h1 and lede in .header-text, and the sl-button next to it:
```html
<div class="header">
  <div class="header-text">
    <h1>Select a collection</h1>
    <p class="lede">Choose which collection to open.</p>
  </div>
  <sl-button variant="primary" @click=${this.onNewProjectClick}>
    <sl-icon slot="prefix" name="plus-lg"></sl-icon>
    New Project
  </sl-button>
</div>
```

Remove the old `margin-bottom` from `.lede` since the header wrapper handles spacing now.

**Add event handlers** (exact pattern from ft-toolbar.ts lines 481-503):
```typescript
private async onNewProjectClick() {
  await this.newCollectionDialog.show();
}

private async onCollectionCreate(e: CustomEvent<{ name: string }>) {
  const dialog = this.newCollectionDialog;
  if (!this.client) {
    dialog.setError('Service not available. Please reload.');
    return;
  }
  dialog.setError('');
  dialog.setCreating(true);
  try {
    const collection = await this.client.createCollection(e.detail.name);
    dialog.close();
    this.dispatchEvent(new CustomEvent('collection-select', {
      detail: { collectionId: collection.id },
      bubbles: true,
      composed: true,
    }));
  } catch (error) {
    dialog.setError('Failed to create collection. Please try again.');
    console.warn('Failed to create collection', error);
  } finally {
    dialog.setCreating(false);
  }
}
```

Add `<ft-new-collection-dialog @collection-create=${this.onCollectionCreate}></ft-new-collection-dialog>` at the end of the render template (inside the `<main>` element).

### Acceptance Criteria
1. When there are enough collections to exceed viewport height, the landing page scrolls (via the .landing wrapper's overflow: auto)
2. A "New Project" button is visible in the header area of the landing page
3. Clicking "New Project" opens the ft-new-collection-dialog modal
4. Creating a collection through the dialog navigates to the new collection
5. The code compiles: `cd web && npm ci && npm run build` succeeds
6. The TypeScript types are correct (no `any` casts, proper event typing)

### Deliverables
1. Commit your changes with a clear message like: "feat(web): scrollable collection list landing page + new project button (F50)"
2. Write a project log entry at `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-50-landing-scroll-newproject/dev-log.md` summarizing what you changed and why.
3. You MUST commit your work and write the project log entry, then mark the task complete.
