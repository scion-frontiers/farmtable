var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { LitElement, html, css, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { TaskPhase } from '../gen/types.js';
import { UNASSIGNED_FILTER_VALUE } from './task-filters.js';
const PHASE_LABELS = {
    [TaskPhase.UNSPECIFIED]: 'Unspecified',
    [TaskPhase.OPEN]: 'Open',
    [TaskPhase.IN_PROGRESS]: 'In Progress',
    [TaskPhase.ON_HOLD]: 'On Hold',
    [TaskPhase.CLOSED]: 'Closed',
};
let FtFilterChips = class FtFilterChips extends LitElement {
    constructor() {
        super(...arguments);
        this.phaseFilter = null;
        this.assigneeFilter = null;
        this.users = [];
        this.filteredCount = 0;
        this.totalCount = 0;
    }
    render() {
        const activeFilterCount = Number(this.phaseFilter !== null) + Number(this.assigneeFilter !== null);
        this.hidden = activeFilterCount === 0;
        if (activeFilterCount === 0)
            return nothing;
        return html `
      <div class="chips" role="group" aria-label="Active filters">
        ${this.phaseFilter !== null
            ? html `
              <sl-tag
                size="small"
                variant="neutral"
                removable
                @sl-remove=${this.clearPhaseFilter}
              >
                Phase: ${this.phaseLabel(this.phaseFilter)}
              </sl-tag>
            `
            : nothing}
        ${this.assigneeFilter !== null
            ? html `
              <sl-tag
                size="small"
                variant="neutral"
                removable
                @sl-remove=${this.clearAssigneeFilter}
              >
                Assignee: ${this.assigneeLabel(this.assigneeFilter)}
              </sl-tag>
            `
            : nothing}
        <span class="task-count">${this.filteredCount} of ${this.totalCount} tasks</span>
        ${activeFilterCount >= 2
            ? html `
              <sl-button size="small" variant="text" @click=${this.clearAllFilters}>
                Clear all
              </sl-button>
            `
            : nothing}
      </div>
    `;
    }
    phaseLabel(phase) {
        return PHASE_LABELS[phase] ?? String(phase);
    }
    assigneeLabel(assigneeId) {
        if (assigneeId === UNASSIGNED_FILTER_VALUE)
            return 'Unassigned';
        const user = this.users.find((u) => u.id === assigneeId);
        return user?.name || user?.email || assigneeId;
    }
    clearPhaseFilter() {
        this.dispatchFilterClear({
            phase: null,
            assigneeId: this.assigneeFilter,
        });
    }
    clearAssigneeFilter() {
        this.dispatchFilterClear({
            phase: this.phaseFilter,
            assigneeId: null,
        });
    }
    clearAllFilters() {
        this.dispatchFilterClear({
            phase: null,
            assigneeId: null,
        });
    }
    dispatchFilterClear(detail) {
        this.dispatchEvent(new CustomEvent('filter-clear', {
            detail,
            bubbles: true,
            composed: true,
        }));
    }
};
FtFilterChips.styles = css `
    :host {
      display: block;
      border-bottom: 1px solid var(--sl-color-neutral-200);
      background: var(--sl-color-neutral-0);
    }
    :host([hidden]) {
      display: none !important;
    }
    .chips {
      display: flex;
      align-items: center;
      gap: 0.375rem;
      flex-wrap: wrap;
      padding: 0.5rem 1rem;
    }
    sl-tag {
      cursor: default;
    }
    sl-button::part(base) {
      min-height: var(--sl-input-height-small);
    }
    .task-count {
      margin-left: auto;
      font-size: 0.8rem;
      color: var(--sl-color-neutral-500);
      white-space: nowrap;
    }
  `;
__decorate([
    property({ attribute: false })
], FtFilterChips.prototype, "phaseFilter", void 0);
__decorate([
    property({ attribute: false })
], FtFilterChips.prototype, "assigneeFilter", void 0);
__decorate([
    property({ attribute: false })
], FtFilterChips.prototype, "users", void 0);
__decorate([
    property({ attribute: false })
], FtFilterChips.prototype, "filteredCount", void 0);
__decorate([
    property({ attribute: false })
], FtFilterChips.prototype, "totalCount", void 0);
FtFilterChips = __decorate([
    customElement('ft-filter-chips')
], FtFilterChips);
export { FtFilterChips };
//# sourceMappingURL=ft-filter-chips.js.map