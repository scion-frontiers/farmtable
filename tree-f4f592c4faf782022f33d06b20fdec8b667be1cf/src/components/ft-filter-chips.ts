import { LitElement, html, css, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { AvailabilityReason, TaskHoldReason, TaskStage, type User } from '../gen/types.js';
import { UNASSIGNED_FILTER_VALUE, type TaskFilterChangeDetail } from './task-filters.js';
import type { AvailabilityFilter, TaskGroupFilter } from '../util/task-state-utils.js';
import {
  ATTENTION,
  AVAILABILITY_REASON_LABEL,
  HOLD_REASON_LABEL,
  STAGE_LABEL,
} from '../util/task-state-utils.js';

@customElement('ft-filter-chips')
export class FtFilterChips extends LitElement {
  static styles = css`
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

  @property({ attribute: false })
  groupFilter: TaskGroupFilter | null = null;

  @property({ attribute: false })
  stageFilter: TaskStage | null = null;

  @property({ attribute: false })
  holdReasonFilter: TaskHoldReason | null = null;

  @property({ attribute: false })
  availabilityFilter: AvailabilityFilter | null = null;

  @property({ attribute: false })
  assigneeFilter: string | null = null;

  @property({ attribute: false })
  users: User[] = [];

  @property({ attribute: false })
  filteredCount = 0;

  @property({ attribute: false })
  totalCount = 0;

  render() {
    const activeFilterCount =
      Number(this.groupFilter !== null) +
      Number(this.stageFilter !== null) +
      Number(this.holdReasonFilter !== null) +
      Number(this.availabilityFilter !== null) +
      Number(this.assigneeFilter !== null);
    this.hidden = activeFilterCount === 0;
    if (activeFilterCount === 0) return nothing;

    return html`
      <div class="chips" role="group" aria-label="Active filters">
        ${this.groupFilter !== null
          ? html`
              <sl-tag
                size="small"
                variant="neutral"
                removable
                @sl-remove=${this.clearGroupFilter}
              >
                Group: ${this.groupFilter === 'active' ? 'Active' : 'Closed'}
              </sl-tag>
            `
          : nothing}
        ${this.stageFilter !== null
          ? html`
              <sl-tag
                size="small"
                variant="neutral"
                removable
                @sl-remove=${this.clearStageFilter}
              >
                Stage: ${STAGE_LABEL[this.stageFilter] ?? String(this.stageFilter)}
              </sl-tag>
            `
          : nothing}
        ${this.holdReasonFilter !== null
          ? html`
              <sl-tag
                size="small"
                variant="neutral"
                removable
                @sl-remove=${this.clearHoldReasonFilter}
              >
                Hold: ${HOLD_REASON_LABEL[this.holdReasonFilter] ?? String(this.holdReasonFilter)}
              </sl-tag>
            `
          : nothing}
        ${this.availabilityFilter !== null
          ? html`
              <sl-tag
                size="small"
                variant="neutral"
                removable
                @sl-remove=${this.clearAvailabilityFilter}
              >
                Availability: ${this.availabilityLabel(this.availabilityFilter)}
              </sl-tag>
            `
          : nothing}
        ${this.assigneeFilter !== null
          ? html`
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
          ? html`
              <sl-button size="small" variant="text" @click=${this.clearAllFilters}>
                Clear all
              </sl-button>
            `
          : nothing}
      </div>
    `;
  }

  private assigneeLabel(assigneeId: string): string {
    if (assigneeId === UNASSIGNED_FILTER_VALUE) return 'Unassigned';

    const user = this.users.find((u) => u.id === assigneeId);
    return user?.name || user?.email || assigneeId;
  }

  private availabilityLabel(filter: AvailabilityFilter): string {
    if (filter === 'available') return 'Available';
    if (filter === 'unavailable') return 'Unavailable';
    // Needed explicitly: the reason map is keyed by number, so a string filter
    // would fall through to `String(filter)` and show the raw value.
    if (filter === 'attention') return ATTENTION.label;
    return AVAILABILITY_REASON_LABEL[filter as AvailabilityReason] ?? String(filter);
  }

  private clearGroupFilter() {
    this.dispatchFilterClear({
      group: null,
      stage: this.stageFilter,
      holdReason: this.holdReasonFilter,
      availability: this.availabilityFilter,
      assigneeId: this.assigneeFilter,
    });
  }

  private clearStageFilter() {
    this.dispatchFilterClear({
      group: this.groupFilter,
      stage: null,
      holdReason: this.holdReasonFilter,
      availability: this.availabilityFilter,
      assigneeId: this.assigneeFilter,
    });
  }

  private clearHoldReasonFilter() {
    this.dispatchFilterClear({
      group: this.groupFilter,
      stage: this.stageFilter,
      holdReason: null,
      availability: this.availabilityFilter,
      assigneeId: this.assigneeFilter,
    });
  }

  private clearAvailabilityFilter() {
    this.dispatchFilterClear({
      group: this.groupFilter,
      stage: this.stageFilter,
      holdReason: this.holdReasonFilter,
      availability: null,
      assigneeId: this.assigneeFilter,
    });
  }

  private clearAssigneeFilter() {
    this.dispatchFilterClear({
      group: this.groupFilter,
      stage: this.stageFilter,
      holdReason: this.holdReasonFilter,
      availability: this.availabilityFilter,
      assigneeId: null,
    });
  }

  private clearAllFilters() {
    this.dispatchFilterClear({
      group: null,
      stage: null,
      holdReason: null,
      availability: null,
      assigneeId: null,
    });
  }

  private dispatchFilterClear(detail: TaskFilterChangeDetail) {
    this.dispatchEvent(
      new CustomEvent<TaskFilterChangeDetail>('filter-clear', {
        detail,
        bubbles: true,
        composed: true,
      }),
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ft-filter-chips': FtFilterChips;
  }
}
