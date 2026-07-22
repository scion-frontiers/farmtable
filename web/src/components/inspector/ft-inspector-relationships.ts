import { LitElement, html, css, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { Task } from '../../gen/types.js';
import { RelationshipType } from '../../gen/types.js';
import type { TaskStore } from '../../store/task-store.js';
import type { UpdateTaskFields } from '../../gen/service.js';
import { STAGE_LABEL, STAGE_COLOR, REL_GROUP_LABEL, REL_GROUP_ORDER } from './inspector-stage-utils.js';

/** Relationship types that can be added via the UI (proto-supported mutations). */
const ADDABLE_TYPES = new Set([RelationshipType.BLOCKS, RelationshipType.BLOCKED_BY]);

@customElement('ft-inspector-relationships')
export class FtInspectorRelationships extends LitElement {
  static styles = css`
    :host {
      display: block;
      padding: 0.5rem 0;
    }
    .section {
      margin-bottom: 1rem;
    }
    .section:last-child {
      margin-bottom: 0;
    }
    .section-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 0.25rem;
    }
    .section-label {
      font-size: 0.75rem;
      font-weight: 600;
      color: var(--sl-color-neutral-500);
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .add-btn {
      font-size: 0.875rem;
      color: var(--sl-color-neutral-400);
    }
    .add-btn:hover {
      color: var(--sl-color-primary-600);
    }
    .entry {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.3rem 0.375rem;
      margin: 0.125rem 0;
      border-radius: 4px;
      font-size: 0.8125rem;
      color: var(--sl-color-primary-600);
      cursor: pointer;
    }
    .entry:hover {
      background: var(--sl-color-neutral-100);
    }
    .entry:focus-visible {
      outline: 2px solid var(--sl-color-primary-500);
      outline-offset: 2px;
    }
    .entry-name {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .stage-badge {
      display: inline-flex;
      align-items: center;
      padding: 0.1rem 0.4rem;
      border-radius: 9999px;
      font-size: 0.675rem;
      font-weight: 500;
      color: #fff;
      white-space: nowrap;
      flex-shrink: 0;
    }
    .delete-btn {
      font-size: 0.75rem;
      color: var(--sl-color-neutral-400);
      opacity: 0;
      transition: opacity 0.15s;
      flex-shrink: 0;
    }
    .entry:hover .delete-btn,
    .entry:focus-within .delete-btn {
      opacity: 1;
    }
    .delete-btn:hover {
      color: var(--sl-color-danger-600);
    }
    .none {
      font-style: italic;
      color: var(--sl-color-neutral-400);
      font-size: 0.8125rem;
      padding: 0.25rem 0.375rem;
    }
  `;

  @property({ attribute: false })
  task!: Task;

  @property({ attribute: false })
  store!: TaskStore;

  @property({ type: Boolean })
  readOnly = false;

  private onClickTask(taskId: string) {
    this.dispatchEvent(
      new CustomEvent('task-select', {
        detail: { taskId },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private onEntryKeyDown(taskId: string, e: KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      this.onClickTask(taskId);
    }
  }

  private onRemoveRelationship(targetTaskId: string, e: Event) {
    e.stopPropagation();
    if (this.readOnly) return;
    this.dispatchEvent(
      new CustomEvent('task-update', {
        detail: {
          taskId: this.task.id,
          fields: { removeRelationships: [targetTaskId] } as UpdateTaskFields,
        },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private onAddRelationship(relType: RelationshipType) {
    if (this.readOnly) return;
    this.dispatchEvent(
      new CustomEvent('open-add-relationship', {
        detail: { taskId: this.task.id, relationshipType: relType },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private renderStageBadge(task: Task) {
    const label = STAGE_LABEL[task.stage] ?? '';
    const color = STAGE_COLOR[task.stage] ?? 'var(--sl-color-neutral-500)';
    if (!label) return nothing;
    return html`<span class="stage-badge" style="background:${color}">${label}</span>`;
  }

  private renderEntry(task: Task, showDelete: boolean) {
    return html`
      <div class="entry"
        tabindex="0"
        role="button"
        @click=${() => this.onClickTask(task.id)}
        @keydown=${(e: KeyboardEvent) => this.onEntryKeyDown(task.id, e)}
      >
        <span class="entry-name">${task.name}</span>
        ${this.renderStageBadge(task)}
        ${showDelete
          ? html`<sl-icon-button
              class="delete-btn"
              name="trash"
              label="Remove relationship"
              @click=${(e: Event) => this.onRemoveRelationship(task.id, e)}
            ></sl-icon-button>`
          : nothing}
      </div>
    `;
  }

  private renderNone() {
    return html`<div class="none">None</div>`;
  }

  private renderSection(label: string, tasks: Task[], showDelete: boolean) {
    return html`
      <div class="section">
        <div class="section-header">
          <div class="section-label">${label}</div>
        </div>
        ${tasks.length > 0
          ? tasks.map((t) => this.renderEntry(t, showDelete))
          : this.renderNone()}
      </div>
    `;
  }

  render() {
    const task = this.task;
    if (!task) return nothing;

    // Parent
    const parentTask = task.parentTaskId
      ? this.store.getTask(task.parentTaskId)
      : undefined;
    const parentTasks = parentTask ? [parentTask] : [];

    // Children
    const children = this.store.getChildren(task.id);

    // Group non-hierarchical relationships by type
    const grouped = new Map<RelationshipType, Task[]>();
    for (const r of task.relationships) {
      const target = this.store.getTask(r.targetTaskId);
      if (!target) continue;
      const list = grouped.get(r.type);
      if (list) list.push(target);
      else grouped.set(r.type, [target]);
    }

    const canEdit = !this.readOnly;

    return html`
      ${this.renderSection('Parent', parentTasks, false)}
      ${this.renderSection('Children', children, false)}
      ${REL_GROUP_ORDER.map((type) => {
        const tasks = grouped.get(type) ?? [];
        const canAdd = canEdit && ADDABLE_TYPES.has(type);
        return html`
          <div class="section">
            <div class="section-header">
              <div class="section-label">${REL_GROUP_LABEL[type]}</div>
              ${canAdd
                ? html`<sl-icon-button
                    class="add-btn"
                    name="plus-lg"
                    label="Add relationship"
                    @click=${() => this.onAddRelationship(type)}
                  ></sl-icon-button>`
                : nothing}
            </div>
            ${tasks.length > 0
              ? tasks.map((t) => this.renderEntry(t, canEdit))
              : this.renderNone()}
          </div>
        `;
      })}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ft-inspector-relationships': FtInspectorRelationships;
  }
}
