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
  `;

  @property({ attribute: false })
  store!: TaskStore;

  @property({ type: String })
  focusRootId: string | null = null;

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
    if (this.focusRootId) {
      const focusRoot = this.store.getTask(this.focusRootId);
      if (focusRoot) walk(focusRoot.id, 0);
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
