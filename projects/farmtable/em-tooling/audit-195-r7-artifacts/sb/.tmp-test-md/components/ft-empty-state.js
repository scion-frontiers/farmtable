var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { LitElement, html, css, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
let FtEmptyState = class FtEmptyState extends LitElement {
    constructor() {
        super(...arguments);
        this.icon = 'inbox';
        this.heading = '';
        this.subtitle = '';
    }
    connectedCallback() {
        super.connectedCallback();
        this.setAttribute('role', 'status');
    }
    render() {
        return html `
      <sl-icon name=${this.icon} aria-hidden="true"></sl-icon>
      <span class="heading">${this.heading}</span>
      ${this.subtitle
            ? html `<span class="subtitle">${this.subtitle}</span>`
            : nothing}
    `;
    }
};
FtEmptyState.styles = css `
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
__decorate([
    property()
], FtEmptyState.prototype, "icon", void 0);
__decorate([
    property()
], FtEmptyState.prototype, "heading", void 0);
__decorate([
    property()
], FtEmptyState.prototype, "subtitle", void 0);
FtEmptyState = __decorate([
    customElement('ft-empty-state')
], FtEmptyState);
export { FtEmptyState };
//# sourceMappingURL=ft-empty-state.js.map