import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { TaskStore } from '../store/task-store.js';
import { TaskStoreController } from '../store/task-store-controller.js';
import { AvailabilityReason, TaskPriority, type Task } from '../gen/types.js';
import { PRIORITY_VARIANT, PRIORITY_LABEL } from '../util/priority-utils.js';
import { isReady } from '../utils/task-ready.js';
import {
  AVAILABILITY_REASON_LABEL,
  holdReasonLabel,
  isClosedStage,
} from '../util/task-state-utils.js';
import './ft-empty-state.js';

interface StateStat {
  label: string;
  count: number;
}

interface PriorityStat {
  priority: TaskPriority;
  label: string;
  variant: string;
  count: number;
}

@customElement('ft-dashboard-view')
export class FtDashboardView extends LitElement {
  static styles = css`
    :host {
      display: block;
      height: 100%;
    }

    .dashboard {
      max-width: 900px;
      margin: 0 auto;
      padding: 1rem 0;
    }

    .section-title {
      font-size: 0.85rem;
      font-weight: 700;
      color: var(--sl-color-neutral-500);
      text-transform: uppercase;
      letter-spacing: 0.04em;
      margin: 0 0 0.75rem;
    }

    .stat-cards {
      display: flex;
      gap: 0.75rem;
      flex-wrap: wrap;
      margin-bottom: 1.5rem;
    }

    .stat-card {
      flex: 1;
      min-width: 120px;
      border: 1px solid var(--sl-color-neutral-200);
      border-radius: var(--sl-border-radius-medium);
      padding: 1rem 1.25rem;
      background: var(--sl-color-neutral-0);
      text-align: center;
    }

    .stat-card.total {
      border-color: var(--sl-color-primary-300);
      background: var(--sl-color-primary-50);
    }

    .stat-card.ready {
      border-color: var(--sl-color-success-300);
      background: var(--sl-color-success-50);
      cursor: pointer;
      transition: background 0.15s, border-color 0.15s, box-shadow 0.15s;
    }

    .stat-card.ready:hover {
      border-color: var(--sl-color-success-500);
      box-shadow: 0 0 0 1px var(--sl-color-success-500);
    }

    .stat-card.ready .stat-count {
      color: var(--sl-color-success-700);
    }

    .stat-card.ready .stat-label {
      color: var(--sl-color-success-600);
    }

    .stat-count {
      font-size: 2rem;
      font-weight: 700;
      line-height: 1.2;
      color: var(--sl-color-neutral-900);
    }

    .stat-card.total .stat-count {
      color: var(--sl-color-primary-700);
    }

    .stat-label {
      font-size: 0.8rem;
      color: var(--sl-color-neutral-500);
      margin-top: 0.25rem;
    }

    .priority-badges {
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
      align-items: center;
    }

    .priority-item {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
    }

    .priority-count {
      font-size: 0.8rem;
      font-weight: 600;
      color: var(--sl-color-neutral-600);
    }
  `;

  @property({ attribute: false })
  store!: TaskStore;

  connectedCallback() {
    super.connectedCallback();
    new TaskStoreController(this, this.store);
  }

  private computeStateStats(tasks: readonly Task[]): StateStat[] {
    let active = 0;
    let closed = 0;
    let held = 0;
    let unavailable = 0;

    for (const task of tasks) {
      if (isClosedStage(task.stage)) closed++;
      else active++;
      if (holdReasonLabel(task.holdReason)) held++;
      if (task.availability?.available === false) unavailable++;
    }

    return [
      { label: 'Active', count: active },
      { label: 'Closed', count: closed },
      { label: 'Held', count: held },
      { label: 'Unavailable', count: unavailable },
    ];
  }

  /** Count tasks available under the shared Available Queue predicate. */
  private computeAvailableCount(tasks: readonly Task[]): number {
    return tasks.filter((task) => isReady(task, this.store)).length;
  }

  /**
   * Navigate to the Available Queue view by dispatching the same view-change
   * event the toolbar uses.
   */
  private navigateToAvailableQueue() {
    this.dispatchEvent(
      new CustomEvent('view-change', {
        detail: { view: 'ready-queue' },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private computePriorityStats(tasks: readonly Task[]): PriorityStat[] {
    const counts: Record<number, number> = {
      [TaskPriority.URGENT]: 0,
      [TaskPriority.HIGH]: 0,
      [TaskPriority.NORMAL]: 0,
      [TaskPriority.LOW]: 0,
      [TaskPriority.UNSPECIFIED]: 0,
    };
    for (const task of tasks) {
      const p = task.priority ?? TaskPriority.UNSPECIFIED;
      if (counts[p] !== undefined) {
        counts[p]++;
      }
    }
    const order = [
      TaskPriority.URGENT,
      TaskPriority.HIGH,
      TaskPriority.NORMAL,
      TaskPriority.LOW,
      TaskPriority.UNSPECIFIED,
    ];
    return order.map((p) => ({
      priority: p,
      label: PRIORITY_LABEL[p] ?? 'Unknown',
      variant: PRIORITY_VARIANT[p] ?? 'neutral',
      count: counts[p],
    }));
  }

  private computeAvailabilityReasons(tasks: readonly Task[]): StateStat[] {
    const counts: Record<number, number> = {
      [AvailabilityReason.TRIAGE]: 0,
      [AvailabilityReason.TERMINAL]: 0,
      [AvailabilityReason.HELD]: 0,
      [AvailabilityReason.BLOCKED_BY_DEPENDENCY]: 0,
      [AvailabilityReason.FUTURE_START_DATE]: 0,
    };
    for (const task of tasks) {
      for (const reason of task.availability?.reasons ?? []) {
        if (counts[reason] !== undefined) {
          counts[reason]++;
        }
      }
    }
    return Object.entries(counts)
      .map(([reason, count]) => ({
        label: AVAILABILITY_REASON_LABEL[Number(reason)] ?? reason,
        count,
      }))
      .filter((stat) => stat.count > 0);
  }

  render() {
    const tasks = this.store.allTasks;

    if (tasks.length === 0) {
      return html`
        <ft-empty-state
          icon="bar-chart"
          heading="No tasks yet"
          subtitle="Create tasks to see dashboard statistics"
        ></ft-empty-state>
      `;
    }

    const stateStats = this.computeStateStats(tasks);
    const priorityStats = this.computePriorityStats(tasks);
    const availabilityReasons = this.computeAvailabilityReasons(tasks);
    const totalCount = tasks.length;
    const availableCount = this.computeAvailableCount(tasks);

    return html`
      <div class="dashboard">
        <h2 class="section-title">Tasks by State</h2>
        <div class="stat-cards">
          ${stateStats.map(
            (stat) => html`
              <div class="stat-card" role="group" aria-label="${stat.label}: ${stat.count}">
                <div class="stat-count">${stat.count}</div>
                <div class="stat-label">${stat.label}</div>
              </div>
            `,
          )}
          <div
            class="stat-card ready"
            role="link"
            tabindex="0"
            aria-label="Available: ${availableCount} — click to view Available Queue"
            title="View Available Queue"
            @click=${this.navigateToAvailableQueue}
            @keydown=${(e: KeyboardEvent) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this.navigateToAvailableQueue();
              }
            }}
          >
            <div class="stat-count">${availableCount}</div>
            <div class="stat-label">Available</div>
          </div>
          <div class="stat-card total" role="group" aria-label="Total: ${totalCount}">
            <div class="stat-count">${totalCount}</div>
            <div class="stat-label">Total</div>
          </div>
        </div>

        <h2 class="section-title">Tasks by Priority</h2>
        <div class="priority-badges">
          ${priorityStats.map(
            (stat) => html`
              <div class="priority-item">
                <sl-badge variant=${stat.variant} pill>${stat.label}</sl-badge>
                <span class="priority-count">${stat.count}</span>
              </div>
            `,
          )}
        </div>

        ${availabilityReasons.length > 0
          ? html`
              <h2 class="section-title">Unavailable Reasons</h2>
              <div class="priority-badges">
                ${availabilityReasons.map(
                  (stat) => html`
                    <div class="priority-item">
                      <sl-badge variant="neutral" pill>${stat.label}</sl-badge>
                      <span class="priority-count">${stat.count}</span>
                    </div>
                  `,
                )}
              </div>
            `
          : null}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ft-dashboard-view': FtDashboardView;
  }
}
