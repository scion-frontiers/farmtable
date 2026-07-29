import { LitElement, html, css, nothing, type PropertyValues } from 'lit';
import { customElement, property } from 'lit/decorators.js';

interface ShortcutGroup {
  heading: string;
  shortcuts: Array<{
    keys: string[];
    description: string;
  }>;
}

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    heading: 'General',
    shortcuts: [
      { keys: ['?'], description: 'Toggle this keyboard shortcuts overlay' },
    ],
  },
  {
    heading: 'Kanban board',
    shortcuts: [
      { keys: ['Tab'], description: 'Focus a task card' },
      { keys: ['Enter', 'Space'], description: 'Open the selected task in the inspector' },
      { keys: ['Arrow Up', 'Arrow Down'], description: 'Move between cards in the current column' },
      { keys: ['Arrow Left', 'Arrow Right'], description: 'Move to the nearest card in another column' },
      { keys: ['Home', 'End'], description: 'Jump to the first or last card in a column' },
    ],
  },
  {
    heading: 'Inspector',
    shortcuts: [
      { keys: ['Tab'], description: 'Move through editable fields and controls' },
      { keys: ['Escape'], description: 'Close an active editor, or close the inspector when no editor is active' },
    ],
  },
];

let overlayId = 0;

@customElement('ft-shortcut-overlay')
export class FtShortcutOverlay extends LitElement {
  static styles = css`
    :host {
      display: contents;
    }
    .backdrop {
      position: fixed;
      inset: 0;
      z-index: 1000;
      display: flex;
      align-items: flex-start;
      justify-content: center;
      padding: clamp(1rem, 5vh, 3rem) 1rem 1rem;
      background: rgba(15, 23, 42, 0.42);
    }
    .panel {
      width: min(34rem, 100%);
      max-height: calc(100vh - 2rem);
      overflow: auto;
      border: 1px solid var(--sl-color-neutral-200);
      border-radius: var(--sl-border-radius-medium);
      background: var(--sl-color-neutral-0);
      box-shadow: var(--sl-shadow-large);
      color: var(--sl-color-neutral-900);
    }
    .panel:focus {
      outline: none;
    }
    .header {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 1rem 1rem 0.75rem;
      border-bottom: 1px solid var(--sl-color-neutral-200);
    }
    h2 {
      flex: 1;
      margin: 0;
      font-size: 1rem;
      line-height: 1.3;
      font-weight: 700;
    }
    .close-button {
      color: var(--sl-color-neutral-500);
    }
    .close-button:hover {
      color: var(--sl-color-neutral-900);
    }
    .content {
      padding: 0.875rem 1rem 1rem;
    }
    section + section {
      margin-top: 1rem;
      padding-top: 1rem;
      border-top: 1px solid var(--sl-color-neutral-100);
    }
    h3 {
      margin: 0 0 0.625rem;
      color: var(--sl-color-neutral-600);
      font-size: 0.75rem;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }
    dl {
      display: grid;
      grid-template-columns: minmax(8rem, max-content) 1fr;
      gap: 0.5rem 1rem;
      margin: 0;
      align-items: center;
    }
    dt {
      display: flex;
      gap: 0.25rem;
      flex-wrap: wrap;
    }
    dd {
      margin: 0;
      color: var(--sl-color-neutral-700);
      font-size: 0.875rem;
      line-height: 1.4;
    }
    kbd {
      min-width: 1.75rem;
      padding: 0.125rem 0.4rem;
      border: 1px solid var(--sl-color-neutral-300);
      border-bottom-width: 2px;
      border-radius: var(--sl-border-radius-small);
      background: var(--sl-color-neutral-50);
      color: var(--sl-color-neutral-800);
      font-family: var(--sl-font-mono);
      font-size: 0.75rem;
      line-height: 1.35;
      text-align: center;
      white-space: nowrap;
    }

    @media (max-width: 520px) {
      .backdrop {
        align-items: stretch;
        padding: 0;
      }
      .panel {
        width: 100%;
        max-height: 100vh;
        border-width: 0;
        border-radius: 0;
      }
      dl {
        grid-template-columns: 1fr;
        gap: 0.25rem;
      }
      dd + dt {
        margin-top: 0.375rem;
      }
    }
  `;

  @property({ type: Boolean, reflect: true })
  open = false;

  private previouslyFocusedElement: HTMLElement | null = null;
  private readonly titleId = `shortcut-overlay-title-${++overlayId}`;

  protected updated(changedProperties: PropertyValues<this>) {
    if (!changedProperties.has('open')) return;

    if (this.open) {
      this.previouslyFocusedElement = this.activeElement();
      this.addDismissListeners();
      void this.updateComplete.then(() => {
        this.renderRoot.querySelector<HTMLElement>('.close-button')?.focus();
      });
    } else {
      this.removeDismissListeners();
      this.restoreFocus();
    }
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this.removeDismissListeners();
  }

  private onDocumentKeyDown = (e: KeyboardEvent) => {
    if (!this.open) return;

    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      this.requestClose();
    } else if (e.key === 'Tab') {
      this.trapFocus(e);
    }
  };

  private onDocumentPointerDown = (e: PointerEvent) => {
    if (!this.open) return;

    const panel = this.renderRoot.querySelector('.panel');
    if (panel && e.composedPath().includes(panel)) return;

    this.requestClose();
  };

  private addDismissListeners() {
    document.addEventListener('keydown', this.onDocumentKeyDown, { capture: true });
    document.addEventListener('pointerdown', this.onDocumentPointerDown, { capture: true });
  }

  private removeDismissListeners() {
    document.removeEventListener('keydown', this.onDocumentKeyDown, { capture: true });
    document.removeEventListener('pointerdown', this.onDocumentPointerDown, { capture: true });
  }

  private requestClose() {
    this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true }));
  }

  private activeElement(): HTMLElement | null {
    let activeElement: Element | null = document.activeElement;

    while (activeElement?.shadowRoot?.activeElement) {
      activeElement = activeElement.shadowRoot.activeElement;
    }

    return activeElement instanceof HTMLElement ? activeElement : null;
  }

  private restoreFocus() {
    const element = this.previouslyFocusedElement;
    this.previouslyFocusedElement = null;

    if (element?.isConnected) {
      element.focus();
    }
  }

  private trapFocus(e: KeyboardEvent) {
    const focusableElements = this.focusableElements();
    if (focusableElements.length === 0) {
      e.preventDefault();
      this.renderRoot.querySelector<HTMLElement>('.panel')?.focus();
      return;
    }

    const active = this.activeElement();
    const currentIndex = active ? focusableElements.indexOf(active) : -1;
    const lastIndex = focusableElements.length - 1;
    const shouldWrapBackward = e.shiftKey && currentIndex <= 0;
    const shouldWrapForward = !e.shiftKey && currentIndex === lastIndex;

    if (!shouldWrapBackward && !shouldWrapForward) return;

    e.preventDefault();
    focusableElements[shouldWrapBackward ? lastIndex : 0].focus();
  }

  private focusableElements(): HTMLElement[] {
    const panel = this.renderRoot.querySelector<HTMLElement>('.panel');
    if (!panel) return [];

    return Array.from(
      panel.querySelectorAll<HTMLElement>(
        [
          'a[href]',
          'button:not([disabled])',
          'input:not([disabled])',
          'select:not([disabled])',
          'textarea:not([disabled])',
          'sl-button:not([disabled])',
          'sl-icon-button:not([disabled])',
          '[tabindex]:not([tabindex="-1"])',
        ].join(','),
      ),
    ).filter((element) => element.offsetParent !== null);
  }

  private renderShortcutGroup(group: ShortcutGroup) {
    return html`
      <section>
        <h3>${group.heading}</h3>
        <dl>
          ${group.shortcuts.map(
            (shortcut) => html`
              <dt>${shortcut.keys.map((key) => html`<kbd>${key}</kbd>`)}</dt>
              <dd>${shortcut.description}</dd>
            `,
          )}
        </dl>
      </section>
    `;
  }

  render() {
    if (!this.open) return nothing;

    return html`
      <div class="backdrop">
        <div
          class="panel"
          tabindex="-1"
          role="dialog"
          aria-modal="true"
          aria-labelledby=${this.titleId}
        >
          <div class="header">
            <h2 id=${this.titleId}>Keyboard Shortcuts</h2>
            <sl-icon-button
              class="close-button"
              name="x-lg"
              label="Close keyboard shortcuts"
              @click=${this.requestClose}
            ></sl-icon-button>
          </div>
          <div class="content">
            ${SHORTCUT_GROUPS.map((group) => this.renderShortcutGroup(group))}
          </div>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ft-shortcut-overlay': FtShortcutOverlay;
  }
}
