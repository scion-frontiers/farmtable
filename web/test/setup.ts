/**
 * Global setup for the jsdom component-test harness.
 *
 * Two jobs:
 *   1. Fill in the handful of DOM APIs jsdom does not implement but that the
 *      Farm Table components call during render/update.
 *   2. Register lightweight stand-ins for the Shoelace custom elements.
 *
 * Why stubs instead of the real Shoelace library: none of the Farm Table
 * components import Shoelace themselves — `src/index.ts` registers the whole
 * library once at app boot. Loading real Shoelace into jsdom would drag in
 * ResizeObserver, the Floating UI positioner, animation APIs, and icon fetches,
 * none of which jsdom implements, and none of which any assertion in this suite
 * depends on. What the tests do need is that `<sl-select>`/`<sl-option>`/etc.
 * (a) exist as real elements, (b) carry the attributes the templates bind, and
 * (c) can carry a `.value` and emit `sl-*` events. That is exactly what these
 * stubs provide.
 */

/* eslint-disable max-classes-per-file */

// ── jsdom gaps ────────────────────────────────────────────────────────────

// Used by ft-kanban-column / ft-ready-queue-view when a task is selected.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function scrollIntoView() {
    /* no-op */
  };
}

// MockFarmTableClient.createTask() and friends use crypto.randomUUID().
if (typeof globalThis.crypto === 'undefined') {
  (globalThis as { crypto?: Crypto }).crypto = {} as Crypto;
}
if (typeof globalThis.crypto.randomUUID !== 'function') {
  let counter = 0;
  (globalThis.crypto as { randomUUID: () => string }).randomUUID = () =>
    `00000000-0000-4000-8000-${String(++counter).padStart(12, '0')}`;
}

// ── Shoelace stand-ins ────────────────────────────────────────────────────

const BOOLEAN_PROPS = ['open', 'disabled', 'checked', 'loading', 'clearable', 'hoist', 'pill', 'removable'] as const;

/**
 * Minimal Shoelace-shaped custom element.
 *
 * - `value` is attribute-backed, so Lit's `value=${...}` attribute bindings are
 *   readable through the property the real components use (`target.value`).
 * - Boolean props mirror their attribute, matching `?open=${...}` bindings.
 * - `show()`/`hide()` emit the `sl-show`/`sl-hide` events the real components
 *   listen for; `toast()` resolves so toast helpers do not reject.
 * - Children stay in the light DOM so `textContent` assertions see slotted
 *   labels (e.g. `<sl-option>Accepted</sl-option>`).
 */
class ShoelaceStubElement extends HTMLElement {
  get value(): string {
    return this.getAttribute('value') ?? '';
  }

  set value(next: unknown) {
    this.setAttribute('value', next == null ? '' : String(next));
  }

  async show(): Promise<void> {
    this.setAttribute('open', '');
    this.dispatchEvent(new CustomEvent('sl-show', { bubbles: true, composed: true }));
  }

  async hide(): Promise<void> {
    this.removeAttribute('open');
    this.dispatchEvent(new CustomEvent('sl-hide', { bubbles: true, composed: true }));
  }

  /**
   * Show the alert as a toast, the way real `<sl-alert>` does.
   *
   * This is deliberately NOT a no-op. Production appends the `<sl-alert>` to
   * `document.body` *before* calling `toast()`, so a stub that did nothing
   * would leave `document.querySelector('sl-alert')` satisfied whether or not
   * `toast()` was ever reached — every toast assertion in the suite would prove
   * only that an element exists in the DOM, not that a user would see it.
   * Deleting the `toast()` call from `ft-app.showErrorToast` survived the
   * round-2 mutation run for exactly that reason.
   *
   * Real Shoelace `toast()` moves the alert into the toast stack and calls
   * `show()`, which sets `open`. Mirroring that here makes `alert.open` the
   * honest "the user saw it" assertion, and an un-toasted alert stays closed.
   */
  async toast(): Promise<void> {
    await this.show();
  }

  select(): void {
    /* no-op: text selection is not modelled */
  }

  checkValidity(): boolean {
    return true;
  }
}

for (const prop of BOOLEAN_PROPS) {
  Object.defineProperty(ShoelaceStubElement.prototype, prop, {
    configurable: true,
    get(this: HTMLElement) {
      return this.hasAttribute(prop);
    },
    set(this: HTMLElement, next: unknown) {
      if (next) this.setAttribute(prop, '');
      else this.removeAttribute(prop);
    },
  });
}

/** Every Shoelace tag referenced from a Farm Table template. */
export const SHOELACE_TAGS = [
  'sl-alert',
  'sl-avatar',
  'sl-badge',
  'sl-button',
  'sl-card',
  'sl-details',
  'sl-dialog',
  'sl-dropdown',
  'sl-icon',
  'sl-icon-button',
  'sl-input',
  'sl-menu',
  'sl-menu-item',
  'sl-option',
  'sl-radio-button',
  'sl-radio-group',
  'sl-select',
  'sl-spinner',
  'sl-tab',
  'sl-tab-group',
  'sl-tab-panel',
  'sl-tag',
  'sl-textarea',
  'sl-tooltip',
] as const;

for (const tag of SHOELACE_TAGS) {
  if (customElements.get(tag)) continue;
  customElements.define(tag, class extends ShoelaceStubElement {});
}
