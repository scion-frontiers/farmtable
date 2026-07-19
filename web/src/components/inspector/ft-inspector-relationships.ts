import { LitElement, html, css, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { Task, Relationship } from '../../gen/types.js';
import { RelationshipType, TaskStage } from '../../gen/types.js';
import type { TaskStore } from '../../store/task-store.js';

const REL_GROUP_LABEL: Record<number, string> = {
  [RelationshipType.BLOCKED_BY]: 'Blocked by',
  [RelationshipType.BLOCKS]: 'Blocks',
  [RelationshipType.RELATED]: 'Related',
  [RelationshipType.DUPLICATE]: 'Duplicate of',
};

const REL_GROUP_ORDER = [
  RelationshipType.BLOCKED_BY,
  RelationshipType.BLOCKS,
  RelationshipType.RELATED,
  RelationshipType.DUPLICATE,
];

const STAGE_LABEL: Record<number, string> = {
  [TaskStage.TRIAGE]: 'Triage',
  [TaskStage.BACKLOG]: 'Backlog',
  [TaskStage.READY]: 'Ready',
  [TaskStage.WORKING]: 'Working',
  [TaskStage.IN_REVIEW]: 'In Review',
  [TaskStage.IN_QA]: 'In QA',
  [TaskStage.DEPLOYING]: 'Deploying',
  [TaskStage.BLOCKED]: 'Blocked',
  [TaskStage.WAITING_FOR_INPUT]: 'Waiting',
  [TaskStage.DEFERRED]: 'Deferred',
  [TaskStage.SCHEDULED]: 'Scheduled',
  [TaskStage.COMPLETED]: 'Completed',
  [TaskStage.WONT_FIX]: "Won't Fix",
  [TaskStage.DUPLICATE]: 'Duplicate',
  [TaskStage.CANCELLED]: 'Cancelled',
};

const STAGE_COLOR: Record<number, string> = {
  [TaskStage.TRIAGE]: 'var(--ft-stage-triage)',
  [TaskStage.BACKLOG]: 'var(--ft-stage-backlog)',
  [TaskStage.READY]: 'var(--ft-stage-ready)',
  [TaskStage.WORKING]: 'var(--ft-stage-working)',
  [TaskStage.IN_REVIEW]: 'var(--ft-stage-in-review)',
  [TaskStage.IN_QA]: 'var(--ft-stage-in-qa)',
  [TaskStage.DEPLOYING]: 'var(--ft-stage-deploying)',
  [TaskStage.BLOCKED]: 'var(--ft-stage-blocked)',
  [TaskStage.COMPLETED]: 'var(--ft-stage-completed)',
  [TaskStage.CANCELLED]: 'var(--ft-stage-cancelled)',
};

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
    .section-label {
      font-size: 0.75rem;
      font-weight: 600;
      color: var(--sl-color-neutral-500);
      text-transform: uppercase;
      letter-spacing: 0.04em;
      margin-bottom: 0.25rem;
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

  private onClickTask(taskId: string) {
    this.dispatchEvent(
      new CustomEvent('task-select', {
        detail: { taskId },
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

  private renderEntry(task: Task) {
    return html`
      <div class="entry" @click=${() => this.onClickTask(task.id)}>
        <span class="entry-name">${task.name}</span>
        ${this.renderStageBadge(task)}
      </div>
    `;
  }

  private renderNone() {
    return html`<div class="none">None</div>`;
  }

  private renderSection(label: string, tasks: Task[]) {
    return html`
      <div class="section">
        <div class="section-label">${label}</div>
        ${tasks.length > 0
          ? tasks.map((t) => this.renderEntry(t))
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

    return html`
      ${this.renderSection('Parent', parentTasks)}
      ${this.renderSection('Children', children)}
      ${REL_GROUP_ORDER.map((type) => {
        const tasks = grouped.get(type) ?? [];
        return this.renderSection(REL_GROUP_LABEL[type], tasks);
      })}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ft-inspector-relationships': FtInspectorRelationships;
  }
}
