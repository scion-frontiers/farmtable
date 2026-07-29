import { LitElement, html, css, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@customElement('ft-empty-state')
export class FtEmptyState extends LitElement {
  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      gap: 0.75rem;
    }
    sl-icon {
      font-size: 48px;
      color: var(--icon-color, var(--sl-color-neutral-400));
    }
    .heading {
      font-size: 1.1rem;
      font-weight: 600;
      color: var(--sl-color-neutral-600);
    }
    .subtitle {
      font-size: 0.875rem;
      color: var(--sl-color-neutral-500);
    }
  `;

  @property()
  icon = 'inbox';

  @property()
  heading = '';

  @property()
  subtitle = '';

  connectedCallback() {
    super.connectedCallback();
    this.setAttribute('role', 'status');
  }

  render() {
    return html`
      <sl-icon name=${this.icon} aria-hidden="true"></sl-icon>
      <span class="heading">${this.heading}</span>
      ${this.subtitle
        ? html`<span class="subtitle">${this.subtitle}</span>`
        : nothing}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ft-empty-state': FtEmptyState;
  }
}
