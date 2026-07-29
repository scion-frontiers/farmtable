var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { TaskPhase, TaskPriority } from '../../gen/types.js';
import { iconButtonFocusStyles } from './inspector-shared-styles.js';
import { STAGE_LABEL, STAGE_COLOR } from './inspector-stage-utils.js';
import { PRIORITY_VARIANT, PRIORITY_LABEL } from '../../util/priority-utils.js';
const PHASE_LABEL = {
    [TaskPhase.OPEN]: 'Open',
    [TaskPhase.IN_PROGRESS]: 'In Progress',
    [TaskPhase.ON_HOLD]: 'On Hold',
    [TaskPhase.CLOSED]: 'Closed',
};
const PRIORITY_OPTIONS = [
    TaskPriority.UNSPECIFIED,
    TaskPriority.URGENT,
    TaskPriority.HIGH,
    TaskPriority.NORMAL,
    TaskPriority.LOW,
];
let FtInspectorHeader = class FtInspectorHeader extends LitElement {
    constructor() {
        super(...arguments);
        this.readOnly = false;
        this.isEditingPriority = false;
        this.prevTaskId = '';
    }
    willUpdate(changedProps) {
        if (!changedProps.has('task'))
            return;
        // task is an object reference; guard by ID so store refreshes for the same task keep edits intact.
        const nextTaskId = this.task?.id ?? '';
        if (nextTaskId !== this.prevTaskId) {
            this.prevTaskId = nextTaskId;
            this.resetEditState();
        }
    }
    stopInspectorInteraction(e) {
        e.stopPropagation();
    }
    async startPriorityEdit(e) {
        if (this.readOnly)
            return;
        e.stopPropagation();
        this.isEditingPriority = true;
        await this.updateComplete;
        const select = this.renderRoot.querySelector('sl-select.priority-select');
        select?.focus();
        select?.show?.();
    }
    onPriorityChange(e) {
        e.stopPropagation();
        const raw = Number(e.currentTarget.value);
        if (Number.isNaN(raw))
            return;
        const nextPriority = raw;
        this.isEditingPriority = false;
        if (nextPriority === (this.task.priority ?? TaskPriority.UNSPECIFIED))
            return;
        this.dispatchTaskUpdate({ priority: nextPriority });
    }
    onPriorityBlur() {
        this.isEditingPriority = false;
    }
    onPriorityKeyDown(e) {
        if (e.key === 'Escape') {
            // Complements sl-after-hide, which handles native popup close/outside-click dismissal.
            e.preventDefault();
            e.stopPropagation();
            this.onPriorityBlur();
        }
    }
    resetEditState() {
        this.isEditingPriority = false;
    }
    dispatchTaskUpdate(fields) {
        this.dispatchEvent(new CustomEvent('task-update', {
            detail: { taskId: this.task.id, fields },
            bubbles: true,
            composed: true,
        }));
    }
    renderPriorityEditor(priority) {
        return html `
      <sl-select
        class="priority-select"
        size="small"
        value=${String(priority)}
        hoist
        @mousedown=${this.stopInspectorInteraction}
        @click=${this.stopInspectorInteraction}
        @keydown=${this.onPriorityKeyDown}
        @sl-change=${this.onPriorityChange}
        @sl-after-hide=${this.onPriorityBlur}
      >
        ${PRIORITY_OPTIONS.map((option) => html `
            <sl-option value=${String(option)}>${PRIORITY_LABEL[option]}</sl-option>
          `)}
      </sl-select>
    `;
    }
    renderPriorityBadge(priorityLabel, priorityVariant) {
        return html `
      <button
        class="priority-button"
        type="button"
        aria-label="Edit priority, current: ${priorityLabel}"
        title="Edit priority"
        @mousedown=${this.stopInspectorInteraction}
        @click=${this.startPriorityEdit}
      >
        <sl-badge variant=${priorityVariant} pill>${priorityLabel}</sl-badge>
      </button>
    `;
    }
    render() {
        const t = this.task;
        const phaseLabel = PHASE_LABEL[t.phase] ?? '';
        const stageLabel = STAGE_LABEL[t.stage] ?? '';
        const stageColor = STAGE_COLOR[t.stage] ?? 'var(--sl-color-neutral-500)';
        const priority = t.priority ?? TaskPriority.UNSPECIFIED;
        const priorityVariant = PRIORITY_VARIANT[priority] ?? 'neutral';
        const priorityLabel = PRIORITY_LABEL[priority] ?? 'Unknown';
        return html `
      <div class="title">${t.name}</div>
      <div class="badges">
        ${phaseLabel
            ? html `<sl-badge variant="neutral">${phaseLabel}</sl-badge>`
            : nothing}
        ${stageLabel
            ? html `<span class="stage-badge" style="background:${stageColor}">${stageLabel}</span>`
            : nothing}
        ${this.readOnly
            ? html `<sl-badge variant=${priorityVariant} pill>${priorityLabel}</sl-badge>`
            : this.isEditingPriority
                ? this.renderPriorityEditor(priority)
                : this.renderPriorityBadge(priorityLabel, priorityVariant)}
      </div>
    `;
    }
};
FtInspectorHeader.styles = [
    iconButtonFocusStyles,
    css `
    :host {
      display: block;
    }
    .title {
      font-size: 1.125rem;
      font-weight: 600;
      line-height: 1.4;
      margin-bottom: 0.75rem;
      word-break: break-word;
    }
    .badges {
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
      align-items: center;
    }
    .stage-badge {
      display: inline-flex;
      align-items: center;
      padding: 0.15rem 0.5rem;
      border-radius: 9999px;
      font-size: 0.75rem;
      font-weight: 500;
      color: #fff;
    }
    .priority-button {
      border: 0;
      background: transparent;
      padding: 0;
      cursor: pointer;
      line-height: 1;
    }
    .priority-button:focus-visible {
      outline: 2px solid var(--sl-color-primary-500);
      outline-offset: 2px;
      border-radius: 999px;
    }
    sl-select.priority-select {
      width: 7rem;
      --sl-input-height-small: 1.5rem;
      --sl-input-font-size-small: 0.75rem;
    }
  `,
];
__decorate([
    property({ attribute: false })
], FtInspectorHeader.prototype, "task", void 0);
__decorate([
    property({ type: Boolean })
], FtInspectorHeader.prototype, "readOnly", void 0);
__decorate([
    property({ attribute: false })
], FtInspectorHeader.prototype, "capabilities", void 0);
__decorate([
    state()
], FtInspectorHeader.prototype, "isEditingPriority", void 0);
FtInspectorHeader = __decorate([
    customElement('ft-inspector-header')
], FtInspectorHeader);
export { FtInspectorHeader };
//# sourceMappingURL=ft-inspector-header.js.map