import { LitElement, html, css, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { TaskStore } from '../../store/task-store.js';
import { TaskStoreController } from '../../store/task-store-controller.js';
import {
  TaskPhase,
  TaskPriority,
  RelationshipType,
  type Task,
} from '../../gen/types.js';
import { matchesTaskFilters } from '../task-filters.js';
import { PRIORITY_VARIANT, PRIORITY_LABEL } from '../../util/priority-utils.js';
import {
  STAGE_LABEL,
  STAGE_COLOR,
} from '../inspector/inspector-stage-utils.js';
import '../ft-empty-state.js';

/**
 * A flat, priority-sorted list of tasks that are actionable (not blocked).
 *
 * A task is "ready" when:
 * 1. Its phase is OPEN or IN_PROGRESS.
 * 2. It has no BLOCKED_BY relationship targeting a non-CLOSED task.
 */
@customElement('ft-ready-queue-view')
export class FtReadyQueueView extends LitElement {
  static styles = css`
    :host {
      display: block;
      height: 100%;
    }

    .queue {
      max-width: 960px;
      margin: 0 auto;
      padding: 1rem 0;
    }

    .queue-header {
      font-size: 0.85rem;
      font-weight: 700;
      color: var(--sl-color-neutral-500);
      text-transform: uppercase;
      letter-spacing: 0.04em;
      margin: 0 0 0.75rem;
    }

    .queue-list {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .queue-row {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.625rem 0.75rem;
      border: 1px solid var(--sl-color-neutral-200);
      border-radius: var(--sl-border-radius-medium);
      background: var(--sl-color-neutral-0);
      cursor: pointer;
      transition: background 0.15s, border-color 0.15s, box-shadow 0.15s;
    }

    .queue-row:hover {
      background: var(--sl-color-neutral-50);
      border-color: var(--sl-color-neutral-300);
    }

    .queue-row:focus {
      outline: none;
    }

    .queue-row:focus-visible {
      outline: 2px solid var(--sl-color-primary-500);
      outline-offset: 2px;
    }

    .queue-row.selected {
      border-color: var(--sl-color-primary-500);
      box-shadow: 0 0 0 1px var(--sl-color-primary-500);
    }

    .task-type {
      color: var(--sl-color-neutral-500);
      font-size: 0.7rem;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      flex-shrink: 0;
      min-width: 3rem;
    }

    .task-id {
      font-size: 0.75rem;
      color: var(--sl-color-neutral-500);
      font-family: var(--sl-font-mono);
      flex-shrink: 0;
    }

    .task-title {
      flex: 1;
      min-width: 0;
      font-size: 0.875rem;
      font-weight: 600;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .labels {
      display: flex;
      gap: 0.25rem;
      flex-shrink: 0;
    }

    sl-tag::part(base) {
      font-size: 0.75rem;
      padding: 0 0.35rem;
      height: 1.25rem;
    }

    .overflow-label {
      font-size: 0.75rem;
      color: var(--sl-color-neutral-500);
      line-height: 1.25rem;
    }

    .blocks-badge {
      flex-shrink: 0;
    }

    .stage-badge {
      flex-shrink: 0;
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      font-size: 0.7rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.02em;
      padding: 0.125rem 0.5rem;
      border-radius: 999px;
      white-space: nowrap;
    }

    .stage-dot {
      width: 0.5rem;
      height: 0.5rem;
      border-radius: 50%;
      flex-shrink: 0;
    }
  `;

  @property({ attribute: false })
  store!: TaskStore;

  @property({ attribute: 'selected-task-id' })
  selectedTaskId: string | null = null;

  @property({ attribute: false })
  phaseFilter: TaskPhase | null = null;

  @property({ attribute: false })
  assigneeFilter: string | null = null;

  connectedCallback() {
    super.connectedCallback();
    new TaskStoreController(this, this.store);
  }

  /**
   * Determine whether a task is "ready":
   * - Phase is OPEN or IN_PROGRESS
   * - Not blocked by any open (non-CLOSED) task
   */
  private isReady(task: Task): boolean {
    if (task.phase !== TaskPhase.OPEN && task.phase !== TaskPhase.IN_PROGRESS) {
      return false;
    }

    for (const rel of task.relationships) {
      if (rel.type !== RelationshipType.BLOCKED_BY) continue;
      const blocker = this.store.getTask(rel.targetTaskId);
      // If the blocker is unknown (deleted, cross-collection, etc.), don't block.
      if (blocker && blocker.phase !== TaskPhase.CLOSED) {
        return false;
      }
    }

    return true;
  }

  /**
   * Count how many open tasks this task currently blocks.
   */
  private countBlocks(task: Task): number {
    let count = 0;
    for (const rel of task.relationships) {
      if (rel.type !== RelationshipType.BLOCKS) continue;
      const target = this.store.getTask(rel.targetTaskId);
      if (target && target.phase !== TaskPhase.CLOSED) {
        count++;
      }
    }
    return count;
  }

  private getReadyTasks(): Task[] {
    return this.store.allTasks
      .filter(
        (task) =>
          this.isReady(task) &&
          matchesTaskFilters(task, this.phaseFilter, this.assigneeFilter),
      )
      .sort((a, b) => {
        const pa = a.priority ?? TaskPriority.UNSPECIFIED;
        const pb = b.priority ?? TaskPriority.UNSPECIFIED;
        // UNSPECIFIED (0) sorts after LOW (4): treat 0 as 5
        const na = pa === TaskPriority.UNSPECIFIED ? 5 : pa;
        const nb = pb === TaskPriority.UNSPECIFIED ? 5 : pb;
        if (na !== nb) return na - nb;
        return a.name.localeCompare(b.name);
      });
  }

  private shortId(id: string): string {
    return id.length > 8 ? `...${id.slice(-6)}` : id;
  }

  private onRowClick(taskId: string) {
    this.dispatchEvent(
      new CustomEvent('task-select', {
        detail: { taskId },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private onRowKeyDown(e: KeyboardEvent, taskId: string) {
    if (e.target !== e.currentTarget) return;
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    this.onRowClick(taskId);
  }

  render() {
    if (this.store.isLoading) {
      return html`<div style="display:flex;align-items:center;justify-content:center;height:100%;"><sl-spinner style="font-size:2rem;"></sl-spinner></div>`;
    }

    const tasks = this.getReadyTasks();

    if (tasks.length === 0) {
      return html`
        <ft-empty-state
          icon="check-circle"
          heading="All clear!"
          subtitle="No tasks are ready to work on right now"
        ></ft-empty-state>
      `;
    }

    return html`
      <div class="queue">
        <h2 class="queue-header">Ready Queue (${tasks.length})</h2>
        <div class="queue-list" role="listbox" aria-label="Ready tasks">
          ${tasks.map((task) => this.renderRow(task))}
        </div>
      </div>
    `;
  }

  private renderRow(task: Task) {
    const priority = task.priority ?? TaskPriority.UNSPECIFIED;
    const priorityVariant = PRIORITY_VARIANT[priority] ?? 'neutral';
    const priorityLabel = PRIORITY_LABEL[priority] ?? 'Unknown';
    const blocksCount = this.countBlocks(task);
    const stageLabel = STAGE_LABEL[task.stage] ?? '';
    const stageColor = STAGE_COLOR[task.stage] ?? 'var(--sl-color-neutral-400)';

    const MAX_LABELS = 3;
    const visibleLabels = task.labels.slice(0, MAX_LABELS);
    const overflowCount = task.labels.length - MAX_LABELS;

    return html`
      <div
        class=${classMap({
          'queue-row': true,
          selected: this.selectedTaskId === task.id,
        })}
        tabindex="0"
        role="option"
        aria-label=${`Task: ${task.name}`}
        aria-selected=${String(this.selectedTaskId === task.id)}
        @click=${() => this.onRowClick(task.id)}
        @keydown=${(e: KeyboardEvent) => this.onRowKeyDown(e, task.id)}
      >
        <sl-badge variant=${priorityVariant} pill>${priorityLabel}</sl-badge>

        ${task.type
          ? html`<span class="task-type">${task.type}</span>`
          : nothing}

        <span class="task-id">${this.shortId(task.id)}</span>

        <span class="task-title">${task.name}</span>

        ${visibleLabels.length > 0
          ? html`
              <div class="labels">
                ${visibleLabels.map(
                  (l) => html`<sl-tag size="small" variant="neutral">${l}</sl-tag>`,
                )}
                ${overflowCount > 0
                  ? html`<span class="overflow-label">+${overflowCount} more</span>`
                  : nothing}
              </div>
            `
          : nothing}

        ${blocksCount > 0
          ? html`<sl-badge class="blocks-badge" variant="warning" pill>Blocks ${blocksCount}</sl-badge>`
          : nothing}

        <span
          class="stage-badge"
          style="background: color-mix(in srgb, ${stageColor} 15%, transparent); color: ${stageColor};"
        >
          <span class="stage-dot" style="background: ${stageColor};"></span>
          ${stageLabel}
        </span>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ft-ready-queue-view': FtReadyQueueView;
  }
}
