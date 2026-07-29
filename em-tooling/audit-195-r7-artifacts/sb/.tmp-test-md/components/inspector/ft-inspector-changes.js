var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { formatTimestamp } from '../../util/format.js';
function formatValue(v) {
    if (v == null)
        return '—';
    if (typeof v === 'string')
        return v;
    return String(v);
}
let FtInspectorChanges = class FtInspectorChanges extends LitElement {
    constructor() {
        super(...arguments);
        this.taskId = '';
        this.changes = [];
        this.loading = false;
        this.loaded = false;
        this.cachedTaskId = '';
    }
    updated(changed) {
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
    isSectionOpen() {
        return localStorage.getItem('inspector.collapse.changes') !== 'false';
    }
    async onExpand() {
        localStorage.setItem('inspector.collapse.changes', 'true');
        if (this.loaded && this.cachedTaskId === this.taskId)
            return;
        if (!this.client || !this.taskId)
            return;
        this.loading = true;
        try {
            this.changes = await this.client.listChanges(this.taskId);
            this.cachedTaskId = this.taskId;
            this.loaded = true;
        }
        finally {
            this.loading = false;
        }
    }
    onCollapse() {
        localStorage.setItem('inspector.collapse.changes', 'false');
    }
    render() {
        const count = this.loaded ? this.changes.length : '';
        const summary = `Change History${count !== '' ? ` (${count})` : ''}`;
        return html `
      <sl-details summary=${summary} ?open=${this.isSectionOpen()} @sl-show=${this.onExpand} @sl-hide=${this.onCollapse}>
        ${this.loading
            ? html `<sl-spinner style="font-size: 1rem;"></sl-spinner>`
            : this.loaded && this.changes.length === 0
                ? html `<div class="empty">No changes recorded</div>`
                : this.changes.map((c) => html `
                  <div class="entry">
                    <div class="entry-header">
                      <span class="field-name">${c.field}</span>
                      <span class="entry-time">${formatTimestamp(c.changedAt)}</span>
                    </div>
                    <div class="entry-values">
                      ${c.oldValue != null
                    ? html `<span class="old-value">${formatValue(c.oldValue)}</span><span class="arrow">→</span>`
                    : nothing}
                      <span>${formatValue(c.newValue)}</span>
                    </div>
                    <div class="changed-by">${c.changedBy.name}</div>
                  </div>
                `)}
      </sl-details>
    `;
    }
};
FtInspectorChanges.styles = css `
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
__decorate([
    property()
], FtInspectorChanges.prototype, "taskId", void 0);
__decorate([
    property({ attribute: false })
], FtInspectorChanges.prototype, "client", void 0);
__decorate([
    state()
], FtInspectorChanges.prototype, "changes", void 0);
__decorate([
    state()
], FtInspectorChanges.prototype, "loading", void 0);
__decorate([
    state()
], FtInspectorChanges.prototype, "loaded", void 0);
FtInspectorChanges = __decorate([
    customElement('ft-inspector-changes')
], FtInspectorChanges);
export { FtInspectorChanges };
//# sourceMappingURL=ft-inspector-changes.js.map