import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { Change } from '../../gen/types.js';
import type { FarmTableServiceClient } from '../../gen/service.js';
import { formatTimestamp } from '../../util/format.js';

function formatValue(v: unknown): string {
  if (v == null) return '—';
  if (typeof v === 'string') return v;
  return String(v);
}

@customElement('ft-inspector-changes')
export class FtInspectorChanges extends LitElement {
  static styles = css`
    :host {
      display: block;
    }
    .entry {
      padding: 0.5rem 0;
      font-size: 0.8125rem;
    }
    .entry + .entry {
      border-top: 1px solid var(--sl-color-neutral-200);
    }
    .entry-header {
      display: flex;
      align-items: center;
      gap: 0.375rem;
      margin-bottom: 0.25rem;
    }
    .field-name {
      font-weight: 500;
    }
    .entry-time {
      font-size: 0.7rem;
      color: var(--sl-color-neutral-500);
      margin-left: auto;
    }
    .entry-values {
      font-size: 0.75rem;
      color: var(--sl-color-neutral-600);
    }
    .old-value {
      text-decoration: line-through;
      color: var(--sl-color-neutral-400);
    }
    .arrow {
      color: var(--sl-color-neutral-400);
      margin: 0 0.25rem;
    }
    .changed-by {
      font-size: 0.7rem;
      color: var(--sl-color-neutral-500);
    }
    .empty {
      font-size: 0.8125rem;
      color: var(--sl-color-neutral-400);
      font-style: italic;
      padding: 0.5rem 0;
    }
  `;

  @property()
  taskId = '';

  @property({ attribute: false })
  client?: FarmTableServiceClient;

  @state()
  private changes: Change[] = [];

  @state()
  private loading = false;

  @state()
  private loaded = false;

  private cachedTaskId = '';

  updated(changed: Map<string, unknown>) {
    if (changed.has('taskId') && this.taskId !== this.cachedTaskId) {
      this.loaded = false;
      this.changes = [];
      this.cachedTaskId = this.taskId;
      const details = this.shadowRoot?.querySelector('sl-details');
      if (details?.open) {
        this.onExpand();
      }
    }
  }

  private isSectionOpen(): boolean {
    return localStorage.getItem('inspector.collapse.changes') !== 'false';
  }

  private async onExpand() {
    localStorage.setItem('inspector.collapse.changes', 'true');
    if (this.loaded && this.cachedTaskId === this.taskId) return;
    if (!this.client || !this.taskId) return;
    this.loading = true;
    try {
      this.changes = await this.client.listChanges(this.taskId);
      this.cachedTaskId = this.taskId;
      this.loaded = true;
    } finally {
      this.loading = false;
    }
  }

  private onCollapse() {
    localStorage.setItem('inspector.collapse.changes', 'false');
  }

  render() {
    const count = this.loaded ? this.changes.length : '';
    const summary = `Change History${count !== '' ? ` (${count})` : ''}`;

    return html`
      <sl-details summary=${summary} ?open=${this.isSectionOpen()} @sl-show=${this.onExpand} @sl-hide=${this.onCollapse}>
        ${this.loading
          ? html`<sl-spinner style="font-size: 1rem;"></sl-spinner>`
          : this.loaded && this.changes.length === 0
            ? html`<div class="empty">No changes recorded</div>`
            : this.changes.map(
                (c) => html`
                  <div class="entry">
                    <div class="entry-header">
                      <span class="field-name">${c.field}</span>
                      <span class="entry-time">${formatTimestamp(c.changedAt)}</span>
                    </div>
                    <div class="entry-values">
                      ${c.oldValue != null
                        ? html`<span class="old-value">${formatValue(c.oldValue)}</span><span class="arrow">→</span>`
                        : nothing}
                      <span>${formatValue(c.newValue)}</span>
                    </div>
                    <div class="changed-by">${c.changedBy.name}</div>
                  </div>
                `,
              )}
      </sl-details>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ft-inspector-changes': FtInspectorChanges;
  }
}
