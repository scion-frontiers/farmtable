import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { ConnectionStatus } from '../store/stream-manager.js';

@customElement('ft-connection-badge')
export class FtConnectionBadge extends LitElement {
  static styles = css`
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

  @property()
  status: ConnectionStatus = 'disconnected';

  render() {
    const { dot, label } = this.statusDisplay();
    return html`
      ${dot === 'spinner'
        ? html`<sl-spinner style="font-size: 0.8rem;"></sl-spinner>`
        : html`<span class="dot ${dot}"></span>`}
      <span class="label">${label}</span>
    `;
  }

  private statusDisplay(): { dot: string; label: string } {
    switch (this.status) {
      case 'connecting':
        return { dot: 'spinner', label: 'Connecting...' };
      case 'syncing':
        return { dot: 'spinner', label: 'Loading tasks...' };
      case 'live':
        return { dot: 'green', label: 'Live' };
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
}

declare global {
  interface HTMLElementTagNameMap {
    'ft-connection-badge': FtConnectionBadge;
  }
}
