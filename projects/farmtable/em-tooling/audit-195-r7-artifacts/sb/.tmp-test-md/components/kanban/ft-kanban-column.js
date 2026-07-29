var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { TaskStage, TaskPriority } from '../../gen/types.js';
const STAGE_COLOR = {
    [TaskStage.TRIAGE]: 'var(--ft-stage-triage)',
    [TaskStage.ACCEPTED]: 'var(--ft-stage-accepted)',
    [TaskStage.WORKING]: 'var(--ft-stage-working)',
    [TaskStage.IN_REVIEW]: 'var(--ft-stage-in-review)',
    [TaskStage.IN_QA]: 'var(--ft-stage-in-qa)',
    [TaskStage.DEPLOYING]: 'var(--ft-stage-deploying)',
    [TaskStage.COMPLETED]: 'var(--ft-stage-completed)',
};
function priorityRank(p) {
    if (p === undefined || p === TaskPriority.UNSPECIFIED)
        return 99;
    return p;
}
function sortTasks(tasks) {
    return [...tasks].sort((a, b) => {
        const pa = priorityRank(a.priority);
        const pb = priorityRank(b.priority);
        if (pa !== pb)
            return pa - pb;
        return a.createdAt.localeCompare(b.createdAt);
    });
}
let FtKanbanColumn = class FtKanbanColumn extends LitElement {
    constructor() {
        super(...arguments);
        this.stage = TaskStage.UNSPECIFIED;
        this.tasks = [];
        this.label = '';
        this.totalCount = 0;
        this.selectedTaskId = null;
        this.readOnly = false;
        this.isDragOver = false;
        this.activeCardIndex = 0;
        this._sortedTasks = [];
        this._dragEnterCount = 0;
    }
    updated(changedProperties) {
        if (changedProperties.has('tasks')) {
            this._sortedTasks = sortTasks(this.tasks);
            const lastIndex = this._sortedTasks.length - 1;
            this.activeCardIndex = Math.max(0, Math.min(this.activeCardIndex, lastIndex));
        }
        if (changedProperties.has('selectedTaskId') && this.selectedTaskId) {
            void this.scrollToSelectedCard();
        }
    }
    /**
     * Scroll the selected task card into view within this column.
     * Uses scrollIntoView which cascades through scrollable ancestors —
     * vertically via the .main container (the single scroll region) and
     * horizontally via the .board container.
     */
    async scrollToSelectedCard() {
        const hasTask = this._sortedTasks.some((t) => t.id === this.selectedTaskId);
        if (!hasTask)
            return;
        await this.updateComplete;
        const card = this.cardElements.find((c) => c.selected);
        if (card) {
            card.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
        }
    }
    get isStageChangeDragDisabled() {
        return this.readOnly || this.capabilities?.canChangeStage === false;
    }
    onDragEnter() {
        if (this.isStageChangeDragDisabled)
            return;
        this._dragEnterCount++;
        this.isDragOver = true;
    }
    onDragOver(e) {
        if (this.isStageChangeDragDisabled)
            return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    }
    onDragLeave() {
        if (this.isStageChangeDragDisabled)
            return;
        this._dragEnterCount--;
        this.isDragOver = this._dragEnterCount > 0;
    }
    onDrop(e) {
        if (this.isStageChangeDragDisabled)
            return;
        e.preventDefault();
        this._dragEnterCount = 0;
        this.isDragOver = false;
        const taskId = e.dataTransfer.getData('text/plain');
        if (!taskId)
            return;
        this.dispatchEvent(new CustomEvent('stage-change', {
            detail: { taskId, stage: this.stage },
            bubbles: true,
            composed: true,
        }));
    }
    onAddTaskClick(e) {
        if (this.readOnly || this.capabilities?.canCreateTask === false)
            return;
        e.stopPropagation();
        this.dispatchEvent(new CustomEvent('column-add-task', {
            detail: { stage: this.stage, label: this.label },
            bubbles: true,
            composed: true,
        }));
    }
    async focusCardAt(index) {
        const cards = this.cardElements;
        if (cards.length === 0)
            return;
        const nextIndex = Math.max(0, Math.min(index, cards.length - 1));
        this.activeCardIndex = nextIndex;
        await this.updateComplete;
        this.cardElements[nextIndex]?.focusCard();
    }
    async focusTaskAt(index) {
        await this.focusCardAt(index);
    }
    get cardElements() {
        return Array.from(this.renderRoot.querySelectorAll('ft-task-card'));
    }
    cardIndexFromEvent(e) {
        const index = Number(e.currentTarget.dataset.cardIndex);
        return Number.isNaN(index) ? null : index;
    }
    onCardFocusHandler(e) {
        const index = this.cardIndexFromEvent(e);
        if (index === null)
            return;
        this.activeCardIndex = index;
    }
    onCardKeyDownHandler(e) {
        if (e.defaultPrevented)
            return;
        const index = this.cardIndexFromEvent(e);
        if (index === null)
            return;
        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                void this.focusCardAt(index + 1);
                break;
            case 'ArrowUp':
                e.preventDefault();
                void this.focusCardAt(index - 1);
                break;
            case 'Home':
                e.preventDefault();
                void this.focusCardAt(0);
                break;
            case 'End':
                e.preventDefault();
                void this.focusCardAt(this.cardElements.length - 1);
                break;
            case 'ArrowLeft':
            case 'ArrowRight':
                e.preventDefault();
                this.activeCardIndex = index;
                this.dispatchEvent(new CustomEvent('column-nav', {
                    detail: {
                        direction: e.key === 'ArrowLeft' ? 'left' : 'right',
                        fromIndex: index,
                        stage: this.stage,
                    },
                    bubbles: true,
                    composed: true,
                }));
                break;
        }
    }
    render() {
        const sorted = this._sortedTasks;
        const color = STAGE_COLOR[this.stage] ?? 'var(--ft-stage-triage)';
        const isFiltered = this.totalCount > 0 && sorted.length !== this.totalCount;
        // NOTE(i18n): Hardcoded English; extract if i18n is added.
        const countLabel = isFiltered ? `${sorted.length} of ${this.totalCount}` : `${sorted.length}`;
        const countChip = html `
      <span class=${classMap({ count: true, filtered: isFiltered })} aria-label=${`${countLabel} tasks`}
        >${countLabel}</span
      >
    `;
        const filteredCountTooltip = isFiltered
            ? `${sorted.length} tasks visible out of ${this.totalCount} total (filter active)`
            : '';
        return html `
      <div class="header">
        <span class="color-dot" style="background: ${color}"></span>
        ${this.label}
        ${isFiltered
            ? html `<sl-tooltip class="count-tooltip" content=${filteredCountTooltip} hoist placement="bottom"
              >${countChip}</sl-tooltip
            >`
            : countChip}
        ${this.readOnly || this.capabilities?.canCreateTask === false ? nothing : html `<sl-icon-button
          class="add-task-button"
          name="plus"
          size="small"
          label=${`Add task to ${this.label}`}
          @click=${this.onAddTaskClick}
        ></sl-icon-button>`}
      </div>
      <div
        class=${classMap({ cards: true, dragover: this.isDragOver })}
        role="listbox"
        aria-label=${this.label}
        @dragenter=${this.onDragEnter}
        @dragover=${this.onDragOver}
        @dragleave=${this.onDragLeave}
        @drop=${this.onDrop}
      >
        ${sorted.map((task, index) => html `
            <ft-task-card
              .task=${task}
              ?selected=${task.id === this.selectedTaskId}
              ?readOnly=${this.readOnly}
              card-tab-index=${index === this.activeCardIndex ? 0 : -1}
              data-card-index=${index}
              @focusin=${this.onCardFocusHandler}
              @keydown=${this.onCardKeyDownHandler}
            ></ft-task-card>
          `)}
        ${isFiltered && sorted.length === 0
            ? html `<div class="empty-filter-message" role="status">
              <!-- NOTE(i18n): Hardcoded English; extract if i18n is added. -->
              No visible tasks match this filter.
            </div>`
            : nothing}
      </div>
    `;
    }
};
FtKanbanColumn.styles = css `
    :host {
      display: flex;
      flex-direction: column;
      min-width: 260px;
      max-width: 300px;
      background: var(--sl-color-neutral-100);
      border-radius: 0.5rem;
      overflow: hidden;
    }
    .header {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.75rem 0.75rem 0.5rem;
      font-size: 0.85rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--sl-color-neutral-700);
    }
    .color-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      flex-shrink: 0;
    }
    .count {
      margin-left: auto;
      background: var(--sl-color-neutral-200);
      color: var(--sl-color-neutral-600);
      border-radius: 999px;
      padding: 0.1rem 0.45rem;
      font-size: 0.7rem;
      font-weight: 600;
      letter-spacing: 0;
      text-transform: none;
    }
    .count.filtered {
      background: var(--sl-color-primary-100);
      color: var(--sl-color-primary-700);
    }
    .count-tooltip {
      margin-left: auto;
    }
    .count-tooltip .count {
      margin-left: 0;
    }
    .add-task-button {
      --sl-input-height-small: 1.5rem;
      color: var(--sl-color-neutral-600);
      opacity: 0.35;
      transition: opacity 0.15s, color 0.15s;
    }
    .header:hover .add-task-button,
    .add-task-button:focus-visible {
      opacity: 0.85;
    }
    .add-task-button:hover {
      color: var(--sl-color-primary-600);
      opacity: 1;
    }
    .cards {
      flex: 1;
      padding: 0 0.5rem 0.5rem;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      min-height: 2rem;
      transition: background 0.15s;
    }
    .cards.dragover {
      background: rgba(59, 130, 246, 0.08);
      outline: 2px dashed var(--sl-color-primary-400);
      outline-offset: -2px;
      border-radius: 0.25rem;
    }
    .empty-filter-message {
      color: var(--sl-color-neutral-500);
      font-size: 0.8rem;
      line-height: 1.4;
      padding: 0.75rem 0.25rem;
      text-align: center;
    }
  `;
__decorate([
    property({ type: Number })
], FtKanbanColumn.prototype, "stage", void 0);
__decorate([
    property({ attribute: false })
], FtKanbanColumn.prototype, "tasks", void 0);
__decorate([
    property()
], FtKanbanColumn.prototype, "label", void 0);
__decorate([
    property({ type: Number, attribute: 'total-count' })
], FtKanbanColumn.prototype, "totalCount", void 0);
__decorate([
    property({ attribute: 'selected-task-id' })
], FtKanbanColumn.prototype, "selectedTaskId", void 0);
__decorate([
    property({ type: Boolean })
], FtKanbanColumn.prototype, "readOnly", void 0);
__decorate([
    property({ attribute: false })
], FtKanbanColumn.prototype, "capabilities", void 0);
__decorate([
    state()
], FtKanbanColumn.prototype, "isDragOver", void 0);
__decorate([
    state()
], FtKanbanColumn.prototype, "activeCardIndex", void 0);
__decorate([
    state()
], FtKanbanColumn.prototype, "_sortedTasks", void 0);
FtKanbanColumn = __decorate([
    customElement('ft-kanban-column')
], FtKanbanColumn);
export { FtKanbanColumn };
//# sourceMappingURL=ft-kanban-column.js.map