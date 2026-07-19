import { LitElement, html, css, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { TaskPhase, type User } from '../gen/types.js';
import { UNASSIGNED_FILTER_VALUE, type TaskFilterChangeDetail } from './task-filters.js';

const PHASE_LABELS: Record<TaskPhase, string> = {
  [TaskPhase.UNSPECIFIED]: 'Unspecified',
  [TaskPhase.OPEN]: 'Open',
  [TaskPhase.IN_PROGRESS]: 'In Progress',
  [TaskPhase.ON_HOLD]: 'On Hold',
  [TaskPhase.CLOSED]: 'Closed',
};

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
  phaseFilter: TaskPhase | null = null;

  @property({ attribute: false })
  assigneeFilter: string | null = null;

  @property({ attribute: false })
  users: User[] = [];

  @property({ type: Number })
  filteredCount = 0;

  @property({ type: Number })
  totalCount = 0;

  render() {
    const activeFilterCount = Number(this.phaseFilter !== null) + Number(this.assigneeFilter !== null);
    this.hidden = activeFilterCount === 0;
    if (activeFilterCount === 0) return nothing;

    return html`
      <div class="chips" role="group" aria-label="Active filters">
        ${this.phaseFilter !== null
          ? html`
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

  private phaseLabel(phase: TaskPhase): string {
    return PHASE_LABELS[phase] ?? String(phase);
  }

  private assigneeLabel(assigneeId: string): string {
    if (assigneeId === UNASSIGNED_FILTER_VALUE) return 'Unassigned';

    const user = this.users.find((u) => u.id === assigneeId);
    return user?.name || user?.email || assigneeId;
  }

  private clearPhaseFilter() {
    this.dispatchFilterClear({
      phase: null,
      assigneeId: this.assigneeFilter,
    });
  }

  private clearAssigneeFilter() {
    this.dispatchFilterClear({
      phase: this.phaseFilter,
      assigneeId: null,
    });
  }

  private clearAllFilters() {
    this.dispatchFilterClear({
      phase: null,
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
