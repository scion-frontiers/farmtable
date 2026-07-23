import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { TaskStore } from '../../store/task-store.js';

@customElement('ft-hierarchy-nav')
export class FtHierarchyNav extends LitElement {
  static styles = css`
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
  `;

  @property({ attribute: false })
  store!: TaskStore;

  @property({ type: String })
  focusRootId: string | null = null;

  @property({ type: Boolean })
  isolateMode = false;

  @property({ type: String })
  selectedTaskId: string | null = null;

  @state()
  private selectedLevel = '-1';

  private getMaxLevel(): number {
    let max = 0;
    const walk = (taskId: string, depth: number) => {
      if (depth > max) max = depth;
      for (const child of this.store.getChildren(taskId)) {
        walk(child.id, depth + 1);
      }
    };
    // In isolate mode, compute depth relative to the isolated root (the
    // selected task) so the level dropdown only shows depths that actually
    // exist in the isolated subtree.
    const effectiveRootId =
      this.isolateMode && this.selectedTaskId
        ? this.selectedTaskId
        : this.focusRootId;
    if (effectiveRootId) {
      const root = this.store.getTask(effectiveRootId);
      if (root) walk(root.id, 0);
    } else {
      for (const root of this.store.roots) {
        walk(root.id, 0);
      }
    }
    return max;
  }

  private getBreadcrumbTrail(): Array<{ id: string; name: string }> {
    if (!this.focusRootId) return [];
    const trail: Array<{ id: string; name: string }> = [];
    let task = this.store.getTask(this.focusRootId);
    while (task) {
      trail.unshift({ id: task.id, name: task.name });
      task = task.parentTaskId
        ? this.store.getTask(task.parentTaskId)
        : undefined;
    }
    return trail;
  }

  private onLevelChange(e: Event) {
    const target = e.target as HTMLElement & { value: string };
    this.selectedLevel = target.value;
    const maxDepth = parseInt(target.value, 10);
    this.dispatchEvent(
      new CustomEvent('level-change', {
        detail: { maxDepth },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private onIsolateClick() {
    this.dispatchEvent(
      new CustomEvent('isolate-toggle', {
        detail: { isolateMode: !this.isolateMode },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private onCrumbClick(taskId: string | null) {
    this.dispatchEvent(
      new CustomEvent('focus-change', {
        detail: { focusRootId: taskId },
        bubbles: true,
        composed: true,
      }),
    );
  }

  render() {
    const maxLevel = this.getMaxLevel();
    const levels: number[] = [];
    for (let i = 0; i <= maxLevel; i++) levels.push(i);
    const breadcrumbs = this.getBreadcrumbTrail();

    return html`
      <sl-select
        size="small"
        value=${this.selectedLevel}
        @sl-change=${this.onLevelChange}
      >
        <sl-option value="-1">All Levels</sl-option>
        ${levels.map(
          (l) => html`
            <sl-option value=${String(l)}>
              Level ${l}${l === 0 ? ' (Roots)' : ''}
            </sl-option>
          `,
        )}
      </sl-select>

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

      ${breadcrumbs.length > 0
        ? html`
            <div class="breadcrumbs">
              <span class="crumb" @click=${() => this.onCrumbClick(null)}
                >Root</span
              >
              ${breadcrumbs.map(
                (crumb, i) => html`
                  <span class="separator">›</span>
                  ${i < breadcrumbs.length - 1
                    ? html`<span
                        class="crumb"
                        @click=${() => this.onCrumbClick(crumb.id)}
                        >${crumb.name}</span
                      >`
                    : html`<span class="current">${crumb.name}</span>`}
                `,
              )}
            </div>
          `
        : nothing}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ft-hierarchy-nav': FtHierarchyNav;
  }
}
