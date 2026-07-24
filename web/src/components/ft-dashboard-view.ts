import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { TaskStore } from '../store/task-store.js';
import { TaskStoreController } from '../store/task-store-controller.js';
import { TaskPhase, TaskPriority, type Task } from '../gen/types.js';
import { PRIORITY_VARIANT, PRIORITY_LABEL } from '../util/priority-utils.js';
import { isReady } from '../utils/task-ready.js';
import './ft-empty-state.js';

interface PhaseStat {
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

  private computePhaseStats(tasks: Task[]): PhaseStat[] {
    const counts: Record<number, number> = {
      [TaskPhase.OPEN]: 0,
      [TaskPhase.IN_PROGRESS]: 0,
      [TaskPhase.ON_HOLD]: 0,
      [TaskPhase.CLOSED]: 0,
    };
    for (const task of tasks) {
      if (counts[task.phase] !== undefined) {
        counts[task.phase]++;
      }
    }
    return [
      { label: 'Open', count: counts[TaskPhase.OPEN] },
      { label: 'In Progress', count: counts[TaskPhase.IN_PROGRESS] },
      { label: 'On Hold', count: counts[TaskPhase.ON_HOLD] },
      { label: 'Closed', count: counts[TaskPhase.CLOSED] },
    ];
  }

  /**
   * Count tasks that are "ready" (actionable / unblocked) using the canonical
   * isReady() utility shared with the Ready Queue view.
   */
  private computeReadyCount(tasks: Task[]): number {
    return tasks.filter((task) => isReady(task, this.store)).length;
  }

  /**
   * Navigate to the Ready Queue view by dispatching the same view-change
   * event the toolbar uses.
   */
  private navigateToReadyQueue() {
    this.dispatchEvent(
      new CustomEvent('view-change', {
        detail: { view: 'ready-queue' },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private computePriorityStats(tasks: Task[]): PriorityStat[] {
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

    const phaseStats = this.computePhaseStats(tasks);
    const priorityStats = this.computePriorityStats(tasks);
    const totalCount = phaseStats.reduce((sum, s) => sum + s.count, 0);
    const readyCount = this.computeReadyCount(tasks);

    return html`
      <div class="dashboard">
        <h2 class="section-title">Tasks by Phase</h2>
        <div class="stat-cards">
          ${phaseStats.map(
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
            aria-label="Ready: ${readyCount} — click to view Ready Queue"
            title="View Ready Queue"
            @click=${this.navigateToReadyQueue}
            @keydown=${(e: KeyboardEvent) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this.navigateToReadyQueue();
              }
            }}
          >
            <div class="stat-count">${readyCount}</div>
            <div class="stat-label">Ready</div>
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
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ft-dashboard-view': FtDashboardView;
  }
}
