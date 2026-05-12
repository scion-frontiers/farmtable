import { LitElement, html, css, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { Task } from '../../gen/types.js';
import { TaskStage, TaskPriority } from '../../gen/types.js';

const STAGE_COLOR: Record<number, string> = {
  [TaskStage.TRIAGE]: '#6b7280',
  [TaskStage.BACKLOG]: '#9ca3af',
  [TaskStage.READY]: '#3b82f6',
  [TaskStage.WORKING]: '#f59e0b',
  [TaskStage.IN_REVIEW]: '#8b5cf6',
  [TaskStage.IN_QA]: '#06b6d4',
  [TaskStage.DEPLOYING]: '#ec4899',
  [TaskStage.BLOCKED]: '#ef4444',
  [TaskStage.WAITING_FOR_INPUT]: '#ef4444',
  [TaskStage.DEFERRED]: '#6b7280',
  [TaskStage.SCHEDULED]: '#9ca3af',
  [TaskStage.COMPLETED]: '#22c55e',
  [TaskStage.WONT_FIX]: '#6b7280',
  [TaskStage.DUPLICATE]: '#6b7280',
  [TaskStage.CANCELLED]: '#6b7280',
};

const STAGE_LABEL: Record<number, string> = {
  [TaskStage.TRIAGE]: 'Triage',
  [TaskStage.BACKLOG]: 'Backlog',
  [TaskStage.READY]: 'Ready',
  [TaskStage.WORKING]: 'Working',
  [TaskStage.IN_REVIEW]: 'Review',
  [TaskStage.IN_QA]: 'QA',
  [TaskStage.DEPLOYING]: 'Deploy',
  [TaskStage.BLOCKED]: 'Blocked',
  [TaskStage.WAITING_FOR_INPUT]: 'Waiting',
  [TaskStage.DEFERRED]: 'Deferred',
  [TaskStage.SCHEDULED]: 'Scheduled',
  [TaskStage.COMPLETED]: 'Done',
  [TaskStage.WONT_FIX]: "Won't Fix",
  [TaskStage.DUPLICATE]: 'Duplicate',
  [TaskStage.CANCELLED]: 'Cancelled',
};

const PRIORITY_COLOR: Record<number, string> = {
  [TaskPriority.URGENT]: '#ef4444',
  [TaskPriority.HIGH]: '#f97316',
  [TaskPriority.NORMAL]: '#3b82f6',
  [TaskPriority.LOW]: '#9ca3af',
};

const MAX_TITLE_LEN = 30;
const MAX_LABELS = 2;

@customElement('ft-tree-node')
export class FtTreeNode extends LitElement {
  static styles = css`
    :host {
      display: block;
      width: 100%;
      height: 100%;
      box-sizing: border-box;
    }
    .node {
      width: 100%;
      height: 100%;
      box-sizing: border-box;
      background: var(--sl-color-neutral-0, #1a1a2e);
      border: 2px solid var(--node-stage-color, #6b7280);
      border-left: 5px solid var(--node-priority-color, #3b82f6);
      border-radius: 8px;
      padding: 6px 8px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      cursor: pointer;
      overflow: hidden;
      font-family: var(--sl-font-sans, sans-serif);
      font-size: 12px;
      color: var(--sl-color-neutral-900, #e2e8f0);
    }
    .node.selected {
      border-color: var(--sl-color-primary-500, #6366f1);
      box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.4);
    }
    .title {
      font-weight: 600;
      font-size: 12px;
      line-height: 1.3;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .meta {
      display: flex;
      align-items: center;
      gap: 4px;
      margin-top: 2px;
    }
    .stage-badge {
      display: inline-block;
      padding: 1px 6px;
      border-radius: 4px;
      font-size: 10px;
      font-weight: 500;
      color: #fff;
      background: var(--node-stage-color, #6b7280);
      white-space: nowrap;
    }
    .assignee {
      font-size: 10px;
      color: var(--sl-color-neutral-500, #94a3b8);
      margin-left: auto;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 70px;
    }
    .bottom {
      display: flex;
      align-items: center;
      gap: 3px;
      margin-top: 2px;
    }
    .label-tag {
      display: inline-block;
      padding: 0 4px;
      border-radius: 3px;
      font-size: 9px;
      background: var(--sl-color-neutral-200, #334155);
      color: var(--sl-color-neutral-700, #cbd5e1);
      white-space: nowrap;
    }
    .child-count {
      margin-left: auto;
      font-size: 10px;
      color: var(--sl-color-neutral-500, #94a3b8);
      font-weight: 600;
      cursor: pointer;
      padding: 0 2px;
      border-radius: 3px;
    }
    .child-count:hover {
      background: var(--sl-color-neutral-200, #334155);
      color: var(--sl-color-neutral-900, #e2e8f0);
    }
  `;

  @property({ attribute: false })
  task!: Task;

  @property({ type: Boolean })
  selected = false;

  @property({ type: Number })
  childCount = 0;

  @property({ type: Boolean })
  expanded = true;

  private onDragStart(e: DragEvent) {
    e.dataTransfer!.setData('application/ft-task-id', this.task.id);
    e.dataTransfer!.setData('application/ft-subtree', 'true');
    e.dataTransfer!.effectAllowed = 'move';
  }

  private onToggleExpand(e: Event) {
    e.stopPropagation();
    this.dispatchEvent(
      new CustomEvent('toggle-expand', {
        detail: { taskId: this.task.id },
        bubbles: true,
        composed: true,
      }),
    );
  }

  render() {
    const t = this.task;
    const title =
      t.name.length > MAX_TITLE_LEN
        ? t.name.slice(0, MAX_TITLE_LEN) + '…'
        : t.name;

    const stageColor = STAGE_COLOR[t.stage] ?? '#6b7280';
    const stageLabel = STAGE_LABEL[t.stage] ?? '';
    const priorityColor =
      PRIORITY_COLOR[t.priority ?? TaskPriority.UNSPECIFIED] ?? '#3b82f6';

    const visibleLabels = t.labels.slice(0, MAX_LABELS);
    const firstAssignee = t.assignees[0];

    return html`
      <div
        class="node ${this.selected ? 'selected' : ''}"
        style="--node-stage-color: ${stageColor}; --node-priority-color: ${priorityColor}"
        draggable="true"
        @dragstart=${this.onDragStart}
      >
        <div class="title">${title}</div>
        <div class="meta">
          ${stageLabel
            ? html`<span class="stage-badge">${stageLabel}</span>`
            : nothing}
          ${firstAssignee
            ? html`<span class="assignee">${firstAssignee.name}</span>`
            : nothing}
        </div>
        ${visibleLabels.length > 0 || this.childCount > 0
          ? html`
              <div class="bottom">
                ${visibleLabels.map(
                  (l) => html`<span class="label-tag">${l}</span>`,
                )}
                ${this.childCount > 0
                  ? html`<span
                      class="child-count"
                      @click=${this.onToggleExpand}
                      >${this.expanded ? `[−${this.childCount}]` : `[+${this.childCount}]`}</span
                    >`
                  : nothing}
              </div>
            `
          : nothing}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ft-tree-node': FtTreeNode;
  }
}
