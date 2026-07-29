var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { LitElement, html, css, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { TaskStage, TaskPriority } from '../../gen/types.js';
const STAGE_COLOR = {
    [TaskStage.TRIAGE]: '#6b7280',
    [TaskStage.ACCEPTED]: '#3b82f6',
    [TaskStage.WORKING]: '#f59e0b',
    [TaskStage.IN_REVIEW]: '#8b5cf6',
    [TaskStage.IN_QA]: '#06b6d4',
    [TaskStage.DEPLOYING]: '#ec4899',
    [TaskStage.COMPLETED]: '#22c55e',
    [TaskStage.WONT_FIX]: '#6b7280',
    [TaskStage.DUPLICATE]: '#6b7280',
    [TaskStage.CANCELLED]: '#6b7280',
};
const STAGE_LABEL = {
    [TaskStage.TRIAGE]: 'Triage',
    [TaskStage.ACCEPTED]: 'Accepted',
    [TaskStage.WORKING]: 'Working',
    [TaskStage.IN_REVIEW]: 'Review',
    [TaskStage.IN_QA]: 'QA',
    [TaskStage.DEPLOYING]: 'Deploy',
    [TaskStage.COMPLETED]: 'Done',
    [TaskStage.WONT_FIX]: "Won't Fix",
    [TaskStage.DUPLICATE]: 'Duplicate',
    [TaskStage.CANCELLED]: 'Cancelled',
};
const PRIORITY_COLOR = {
    [TaskPriority.URGENT]: '#ef4444',
    [TaskPriority.HIGH]: '#f97316',
    [TaskPriority.NORMAL]: '#3b82f6',
    [TaskPriority.LOW]: '#9ca3af',
};
const MAX_TITLE_LEN = 30;
const MAX_LABELS = 2;
let FtTreeNode = class FtTreeNode extends LitElement {
    constructor() {
        super(...arguments);
        this.selected = false;
        this.readOnly = false;
        this.childCount = 0;
        this.expanded = true;
    }
    onDragStart(e) {
        e.dataTransfer.setData('application/ft-task-id', this.task.id);
        e.dataTransfer.setData('application/ft-subtree', 'true');
        e.dataTransfer.effectAllowed = 'move';
    }
    onToggleExpand(e) {
        e.stopPropagation();
        this.dispatchEvent(new CustomEvent('toggle-expand', {
            detail: { taskId: this.task.id },
            bubbles: true,
            composed: true,
        }));
    }
    render() {
        const t = this.task;
        const title = t.name.length > MAX_TITLE_LEN
            ? t.name.slice(0, MAX_TITLE_LEN) + '…'
            : t.name;
        const stageColor = STAGE_COLOR[t.stage] ?? '#6b7280';
        const stageLabel = STAGE_LABEL[t.stage] ?? '';
        const priorityColor = PRIORITY_COLOR[t.priority ?? TaskPriority.UNSPECIFIED] ?? '#3b82f6';
        const visibleLabels = t.labels.slice(0, MAX_LABELS);
        const firstAssignee = t.assignees[0];
        return html `
      <div
        class="node ${this.selected ? 'selected' : ''}"
        style="--node-stage-color: ${stageColor}; --node-priority-color: ${priorityColor}"
        draggable=${this.readOnly ? 'false' : 'true'}
        @dragstart=${this.onDragStart}
      >
        <div class="title">${title}</div>
        <div class="meta">
          ${stageLabel
            ? html `<span class="stage-badge">${stageLabel}</span>`
            : nothing}
          ${firstAssignee
            ? html `<span class="assignee">${firstAssignee.name}</span>`
            : nothing}
        </div>
        ${visibleLabels.length > 0 || this.childCount > 0
            ? html `
              <div class="bottom">
                ${visibleLabels.map((l) => html `<span class="label-tag">${l}</span>`)}
                ${this.childCount > 0
                ? html `<span
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
};
FtTreeNode.styles = css `
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
      background: var(--sl-color-neutral-0);
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
      font-size: 13px;
      color: var(--sl-color-neutral-900);
    }
    .node.selected {
      border-color: var(--sl-color-primary-500);
      border-width: 3px;
      border-left-width: 5px;
      box-shadow: 0 0 0 3px transparent, 0 0 0 6px rgba(99, 102, 241, 0.45);
    }
    .title {
      font-weight: 600;
      font-size: 13px;
      line-height: 1.4;
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
      font-size: 11px;
      font-weight: 500;
      color: #fff;
      background: var(--node-stage-color, #6b7280);
      white-space: nowrap;
    }
    .assignee {
      font-size: 11px;
      color: var(--sl-color-neutral-500);
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
      font-size: 10px;
      letter-spacing: 0.04em;
      background: var(--sl-color-neutral-200);
      color: var(--sl-color-neutral-700);
      white-space: nowrap;
    }
    .child-count {
      margin-left: auto;
      font-size: 11px;
      color: var(--sl-color-neutral-500);
      font-weight: 600;
      cursor: pointer;
      padding: 0 2px;
      border-radius: 3px;
    }
    .child-count:hover {
      background: var(--sl-color-neutral-200);
      color: var(--sl-color-neutral-900);
    }
  `;
__decorate([
    property({ attribute: false })
], FtTreeNode.prototype, "task", void 0);
__decorate([
    property({ type: Boolean })
], FtTreeNode.prototype, "selected", void 0);
__decorate([
    property({ type: Boolean })
], FtTreeNode.prototype, "readOnly", void 0);
__decorate([
    property({ type: Number })
], FtTreeNode.prototype, "childCount", void 0);
__decorate([
    property({ type: Boolean })
], FtTreeNode.prototype, "expanded", void 0);
FtTreeNode = __decorate([
    customElement('ft-tree-node')
], FtTreeNode);
export { FtTreeNode };
//# sourceMappingURL=ft-tree-node.js.map