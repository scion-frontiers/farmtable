var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { LitElement, html, css, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
let FtHierarchyNav = class FtHierarchyNav extends LitElement {
    constructor() {
        super(...arguments);
        this.focusRootId = null;
        this.isolateMode = false;
        this.selectedTaskId = null;
        /** Current depth limit, passed from the tree view (keeps dropdown in sync with auto-depth). */
        this.maxDepth = -1;
        /** Layout orientation: 'LR' (left-to-right, default) or 'TB' (top-to-bottom). */
        this.layoutOrientation = 'LR';
    }
    getMaxLevel() {
        let max = 0;
        const walk = (taskId, depth) => {
            if (depth > max)
                max = depth;
            for (const child of this.store.getChildren(taskId)) {
                walk(child.id, depth + 1);
            }
        };
        // In isolate mode, compute depth relative to the isolated root (the
        // selected task) so the level dropdown only shows depths that actually
        // exist in the isolated subtree.
        const effectiveRootId = this.isolateMode && this.selectedTaskId
            ? this.selectedTaskId
            : this.focusRootId;
        if (effectiveRootId) {
            const root = this.store.getTask(effectiveRootId);
            if (root)
                walk(root.id, 0);
        }
        else {
            for (const root of this.store.roots) {
                walk(root.id, 0);
            }
        }
        return max;
    }
    getBreadcrumbTrail() {
        if (!this.focusRootId)
            return [];
        const trail = [];
        let task = this.store.getTask(this.focusRootId);
        while (task) {
            trail.unshift({ id: task.id, name: task.name });
            task = task.parentTaskId
                ? this.store.getTask(task.parentTaskId)
                : undefined;
        }
        return trail;
    }
    onLevelChange(e) {
        const target = e.target;
        const maxDepth = parseInt(target.value, 10);
        this.dispatchEvent(new CustomEvent('level-change', {
            detail: { maxDepth },
            bubbles: true,
            composed: true,
        }));
    }
    onIsolateClick() {
        this.dispatchEvent(new CustomEvent('isolate-toggle', {
            detail: { isolateMode: !this.isolateMode },
            bubbles: true,
            composed: true,
        }));
    }
    onOrientationToggle() {
        const next = this.layoutOrientation === 'TB' ? 'LR' : 'TB';
        this.dispatchEvent(new CustomEvent('layout-orientation-toggle', {
            detail: { layoutOrientation: next },
            bubbles: true,
            composed: true,
        }));
    }
    onCrumbClick(taskId) {
        this.dispatchEvent(new CustomEvent('focus-change', {
            detail: { focusRootId: taskId },
            bubbles: true,
            composed: true,
        }));
    }
    render() {
        const maxLevel = this.getMaxLevel();
        const levels = [];
        for (let i = 0; i <= maxLevel; i++)
            levels.push(i);
        const breadcrumbs = this.getBreadcrumbTrail();
        const isDepthLimited = this.maxDepth >= 0 && this.maxDepth < maxLevel;
        return html `
      <sl-select
        size="small"
        value=${String(this.maxDepth)}
        @sl-change=${this.onLevelChange}
      >
        <sl-option value="-1">All Levels</sl-option>
        ${levels.map((l) => html `
            <sl-option value=${String(l)}>
              Level ${l}${l === 0 ? ' (Roots)' : ''}
            </sl-option>
          `)}
      </sl-select>

      ${isDepthLimited
            ? html `<span class="depth-badge">
            <sl-icon name="layers"></sl-icon>
            ${maxLevel - this.maxDepth} deeper level${maxLevel - this.maxDepth !== 1 ? 's' : ''} hidden
          </span>`
            : nothing}

      <sl-tooltip content=${this.isolateMode ? 'Show full tree' : 'Solo selected task and its descendants'}>
        <button
          class="isolate-btn ${this.isolateMode ? 'active' : ''}"
          ?disabled=${!this.selectedTaskId}
          @click=${this.onIsolateClick}
        >
          <sl-icon name=${this.isolateMode ? 'fullscreen-exit' : 'funnel'}></sl-icon>
          Solo
        </button>
      </sl-tooltip>

      <sl-tooltip content=${this.layoutOrientation === 'LR' ? 'Switch to top-down layout' : 'Switch to left-to-right layout'}>
        <button
          class="isolate-btn"
          @click=${this.onOrientationToggle}
        >
          <sl-icon name=${this.layoutOrientation === 'LR' ? 'arrow-clockwise' : 'arrow-counterclockwise'}></sl-icon>
        </button>
      </sl-tooltip>

      ${breadcrumbs.length > 0
            ? html `
            <div class="breadcrumbs">
              <span class="crumb" @click=${() => this.onCrumbClick(null)}
                >Root</span
              >
              ${breadcrumbs.map((crumb, i) => html `
                  <span class="separator">›</span>
                  ${i < breadcrumbs.length - 1
                ? html `<span
                        class="crumb"
                        @click=${() => this.onCrumbClick(crumb.id)}
                        >${crumb.name}</span
                      >`
                : html `<span class="current">${crumb.name}</span>`}
                `)}
            </div>
          `
            : nothing}
    `;
    }
};
FtHierarchyNav.styles = css `
    :host {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.5rem 0.75rem;
      background: var(--sl-color-neutral-50, #1e1e2e);
      border-bottom: 1px solid var(--sl-color-neutral-200, #334155);
      font-family: var(--sl-font-sans, sans-serif);
      flex-shrink: 0;
    }
    .breadcrumbs {
      display: flex;
      align-items: center;
      gap: 0.25rem;
      font-size: 0.85rem;
    }
    .crumb {
      cursor: pointer;
      color: var(--sl-color-primary-600, #818cf8);
    }
    .crumb:hover {
      text-decoration: underline;
    }
    .separator {
      color: var(--sl-color-neutral-400, #64748b);
    }
    .current {
      color: var(--sl-color-neutral-700, #cbd5e1);
      font-weight: 600;
    }
    sl-select {
      min-width: 150px;
    }
    .isolate-btn {
      display: inline-flex;
      align-items: center;
      gap: 0.3rem;
      padding: 0.25rem 0.6rem;
      border: 1px solid var(--sl-color-neutral-300, #475569);
      border-radius: var(--sl-border-radius-medium, 4px);
      background: var(--sl-color-neutral-0, #fff);
      color: var(--sl-color-neutral-700, #cbd5e1);
      font-size: 0.8rem;
      font-weight: 500;
      cursor: pointer;
      white-space: nowrap;
      transition: background 0.15s, border-color 0.15s, color 0.15s;
      font-family: inherit;
      line-height: 1.4;
    }
    .isolate-btn:hover {
      background: var(--sl-color-neutral-100, #334155);
      border-color: var(--sl-color-neutral-400, #64748b);
    }
    .isolate-btn.active {
      background: var(--sl-color-primary-100, #312e81);
      border-color: var(--sl-color-primary-500, #6366f1);
      color: var(--sl-color-primary-700, #a5b4fc);
    }
    .isolate-btn.active:hover {
      background: var(--sl-color-primary-200, #3730a3);
    }
    .isolate-btn sl-icon {
      font-size: 0.9rem;
    }
    .isolate-btn[disabled] {
      opacity: 0.4;
      cursor: not-allowed;
    }
    .depth-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.3rem;
      padding: 0.15rem 0.5rem;
      border-radius: var(--sl-border-radius-pill, 9999px);
      background: var(--sl-color-warning-100, #451a03);
      color: var(--sl-color-warning-700, #fbbf24);
      font-size: 0.75rem;
      font-weight: 500;
      white-space: nowrap;
    }
    .depth-badge sl-icon {
      font-size: 0.8rem;
    }
  `;
__decorate([
    property({ attribute: false })
], FtHierarchyNav.prototype, "store", void 0);
__decorate([
    property({ type: String })
], FtHierarchyNav.prototype, "focusRootId", void 0);
__decorate([
    property({ type: Boolean })
], FtHierarchyNav.prototype, "isolateMode", void 0);
__decorate([
    property({ type: String })
], FtHierarchyNav.prototype, "selectedTaskId", void 0);
__decorate([
    property({ type: Number })
], FtHierarchyNav.prototype, "maxDepth", void 0);
__decorate([
    property({ type: String })
], FtHierarchyNav.prototype, "layoutOrientation", void 0);
FtHierarchyNav = __decorate([
    customElement('ft-hierarchy-nav')
], FtHierarchyNav);
export { FtHierarchyNav };
//# sourceMappingURL=ft-hierarchy-nav.js.map