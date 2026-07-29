var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
let FtConnectionBadge = class FtConnectionBadge extends LitElement {
    constructor() {
        super(...arguments);
        this.status = 'disconnected';
    }
    render() {
        const { dot, label } = this.statusDisplay();
        return html `
      ${dot === 'spinner'
            ? html `<sl-spinner style="font-size: 0.8rem;"></sl-spinner>`
            : html `<span class="dot ${dot}"></span>`}
      <span class="label">${label}</span>
    `;
    }
    statusDisplay() {
        switch (this.status) {
            case 'connecting':
                return { dot: 'spinner', label: 'Connecting...' };
            case 'syncing':
                return { dot: 'spinner', label: 'Loading tasks...' };
            case 'live':
                return { dot: 'green', label: 'Live' };
            case 'polling':
                return { dot: 'green', label: 'Polling' };
            case 'reconnecting':
                return { dot: 'yellow', label: 'Reconnecting...' };
            case 'disconnected':
                return { dot: 'red', label: 'Disconnected' };
            case 'error':
                return { dot: 'red', label: 'Error' };
            default:
                return { dot: 'red', label: 'Unknown' };
        }
    }
};
FtConnectionBadge.styles = css `
    :host {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
    }
    .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      display: inline-block;
    }
    .dot.green { background: var(--ft-stage-completed, #22c55e); }
    .dot.yellow { background: var(--ft-priority-high, #f97316); }
    .dot.red { background: var(--ft-stage-blocked, #ef4444); }
    .label {
      font-size: 0.8rem;
      color: var(--sl-color-neutral-500);
    }
  `;
__decorate([
    property()
], FtConnectionBadge.prototype, "status", void 0);
FtConnectionBadge = __decorate([
    customElement('ft-connection-badge')
], FtConnectionBadge);
export { FtConnectionBadge };
//# sourceMappingURL=ft-connection-badge.js.map