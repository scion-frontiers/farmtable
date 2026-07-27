import { LitElement, html, css, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { TaskStore } from '../../store/task-store.js';
import { TaskStoreController } from '../../store/task-store-controller.js';
import { TaskHoldReason, TaskStage, TaskPhase } from '../../gen/types.js';
import type { Task } from '../../gen/types.js';
import { applyTaskUpdateFields, phaseForStage, type FarmTableServiceClient } from '../../gen/service.js';
import type { UpdateTaskFields } from '../../gen/service.js';
import { matchesTaskFilters } from '../task-filters.js';
import { acceptsStageDrop, DROP_REFUSAL, STAGE_LABEL } from '../../util/task-state-utils.js';
import type { AvailabilityFilter, TaskGroupFilter } from '../../util/task-state-utils.js';
import type { CollectionCapabilities } from '../../capabilities.js';
import type { FtAddTaskDialog, TaskCreateDetail } from './ft-add-task-dialog.js';
import type { FtKanbanColumn } from './ft-kanban-column.js';

// TODO(test-coverage): Add component tests for the column-add-task event flow.

export interface ColumnDef {
  stage: TaskStage;
  label: string;
  /**
   * Display grouping for the lane only. `phase` is a server-derived wire
   * projection and is never written back to the server — see `onStageChange`.
   */
  phase: TaskPhase;
}

interface ColumnNavDetail {
  direction: 'left' | 'right';
  fromIndex: number;
  stage: TaskStage;
}

export const BOARD_COLUMNS: ColumnDef[] = [
  { stage: TaskStage.TRIAGE, label: 'Triage', phase: TaskPhase.OPEN },
  { stage: TaskStage.ACCEPTED, label: 'Accepted', phase: TaskPhase.OPEN },
  { stage: TaskStage.WORKING, label: 'Working', phase: TaskPhase.IN_PROGRESS },
  { stage: TaskStage.IN_REVIEW, label: 'In Review', phase: TaskPhase.IN_PROGRESS },
  { stage: TaskStage.IN_QA, label: 'In QA', phase: TaskPhase.IN_PROGRESS },
  { stage: TaskStage.DEPLOYING, label: 'Deploying', phase: TaskPhase.IN_PROGRESS },
  { stage: TaskStage.COMPLETED, label: 'Completed', phase: TaskPhase.CLOSED },
  { stage: TaskStage.WONT_FIX, label: "Won't Fix", phase: TaskPhase.CLOSED },
  { stage: TaskStage.DUPLICATE, label: 'Duplicate', phase: TaskPhase.CLOSED },
  { stage: TaskStage.CANCELLED, label: 'Cancelled', phase: TaskPhase.CLOSED },
];

@customElement('ft-kanban-view')
export class FtKanbanView extends LitElement {
  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
    }
    .board {
      display: flex;
      gap: 0.75rem;
      overflow: auto;
      padding-bottom: 0.5rem;
    }
    .view-header {
      display: flex;
      justify-content: flex-end;
      margin-bottom: 0.75rem;
    }
  `;

  @property({ attribute: false })
  store!: TaskStore;

  @property({ attribute: 'selected-task-id' })
  selectedTaskId: string | null = null;

  @property({ attribute: false })
  client?: FarmTableServiceClient;

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

  @property({ type: Boolean })
  readOnly = false;

  @property({ attribute: false })
  capabilities?: CollectionCapabilities;

  private storeController!: TaskStoreController;

  // ── Edge auto-scroll during drag ──────────────────────────────────
  private static readonly EDGE_THRESHOLD = 50;   // px from edge to trigger
  private static readonly SCROLL_SPEED_MIN = 2;  // px/frame at threshold boundary
  private static readonly SCROLL_SPEED_MAX = 12; // px/frame at container edge

  private _autoScrollRafId: number | null = null;
  private _autoScrollContainer: HTMLElement | null = null;
  private _autoScrollDirection: -1 | 0 | 1 = 0;
  private _autoScrollSpeed = 0;

  connectedCallback() {
    super.connectedCallback();
    this.storeController = new TaskStoreController(this, this.store);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.stopAutoScroll();
  }

  private getColumnTasks(stage: TaskStage): Task[] {
    return this.store.getByStage(stage).filter((task) => this.matchesFilters(task));
  }

  private matchesFilters(task: Task): boolean {
    return matchesTaskFilters(
      task,
      this.groupFilter,
      this.stageFilter,
      this.holdReasonFilter,
      this.availabilityFilter,
      this.assigneeFilter,
    );
  }

  /**
   * Surface a client-side refusal on the same toast channel as server write
   * failures. A drag the board declines must never be a silent no-op.
   */
  private reportRefusal(message: string) {
    this.dispatchEvent(new CustomEvent('write-error', {
      bubbles: true,
      composed: true,
      detail: { message, reason: 'stage-change-refused' },
    }));
  }

  private async onStageChange(e: CustomEvent) {
    const { taskId, stage } = e.detail as { taskId: string; stage: TaskStage };

    // Resolve the task first. `dragover` now cancels unconditionally, so a lane
    // also accepts content dragged in from another window or application; that
    // payload arrives here as a `taskId` matching nothing. Refusing before this
    // lookup would answer such a gesture with "This board is read-only", which
    // is a claim about a task that does not exist.
    const task = this.store.getTask(taskId);
    // Not ours, or a genuine no-op: the card was dropped back on its own lane.
    if (!task || task.stage === stage) return;

    if (this.readOnly) {
      this.reportRefusal(DROP_REFUSAL.readOnlyBoard);
      return;
    }
    if (this.capabilities?.canChangeStage === false) {
      this.reportRefusal(DROP_REFUSAL.stageChangeUnsupported);
      return;
    }

    if (!acceptsStageDrop(stage)) {
      this.reportRefusal(DROP_REFUSAL.terminalLaneToast(STAGE_LABEL[stage] ?? 'This outcome'));
      return;
    }

    // `phase` is a server-derived wire projection. It is computed here for the
    // optimistic store entry ONLY, so the card lands in the right lane
    // immediately; it is never included in an update payload and is replaced
    // by the authoritative value from the server response below.
    this.store.upsert({ ...task, stage, phase: phaseForStage(stage) });

    try {
      if (this.client) {
        // Contract: the UI writes `stage` only, never `phase`.
        const updated = await this.client.updateTask(taskId, { stage });
        // Reconcile with the server's authoritative stage/phase projection.
        this.store.upsert(updated);
      } else {
        console.warn('No client configured — stage change is local only');
      }
    } catch (error) {
      // Snap the card back to its original lane (restoring the original local
      // phase projection), then surface the server's rejection reason.
      console.warn('Failed to update task stage; rolled back optimistic change', error);
      this.store.upsert(task);
      this.dispatchEvent(new CustomEvent('write-error', {
        bubbles: true,
        composed: true,
        detail: { error, reason: 'stage-change-failed' },
      }));
    }
  }

  private async onTaskUpdate(e: CustomEvent) {
    if (this.readOnly) return;
    const { taskId, fields } = e.detail as { taskId: string; fields: UpdateTaskFields };
    const task = this.store.getTask(taskId);
    if (!task) return;

    const updated = applyTaskUpdateFields(task, fields);

    this.store.upsert(updated);

    try {
      if (this.client) {
        await this.client.updateTask(taskId, fields);
      } else {
        console.warn('No client configured — task update is local only');
      }
    } catch (error) {
      console.warn('Failed to update task; rolled back optimistic change', error);
      this.store.upsert(task);
      this.dispatchEvent(new CustomEvent('write-error', {
        bubbles: true,
        composed: true,
        detail: { error },
      }));
    }
  }

  // ── Auto-scroll helpers ───────────────────────────────────────────

  /**
   * Called on `dragover` of a scroll container (`.board` or `.on-hold-columns`).
   * Starts or adjusts an auto-scroll when the pointer is near the left/right edge.
   */
  private onContainerDragOver(e: DragEvent) {
    const container = e.currentTarget as HTMLElement;
    this.updateAutoScroll(container, e.clientX);
  }

  /** Stop auto-scroll when the pointer leaves the scroll container entirely. */
  private onContainerDragLeave(e: DragEvent) {
    const container = e.currentTarget as HTMLElement;
    // relatedTarget is the element the pointer entered — if it's still inside
    // the container, this is just a child-to-child transition, not a real leave.
    if (!container.contains(e.relatedTarget as Node)) {
      this.stopAutoScroll();
    }
  }

  /** Stop auto-scroll when the drag ends (fires on the dragged element, bubbles up). */
  private onContainerDragEnd() {
    this.stopAutoScroll();
  }

  /** Stop auto-scroll when a drop occurs (bubbles up from the column). */
  private onContainerDrop() {
    this.stopAutoScroll();
  }

  private updateAutoScroll(container: HTMLElement, clientX: number) {
    const rect = container.getBoundingClientRect();
    const threshold = FtKanbanView.EDGE_THRESHOLD;

    const distFromLeft = clientX - rect.left;
    const distFromRight = rect.right - clientX;

    let direction: -1 | 0 | 1 = 0;
    let proximity = 0; // 0 at threshold boundary, 1 at container edge

    if (distFromLeft < threshold && distFromLeft >= 0) {
      direction = -1;
      proximity = 1 - distFromLeft / threshold;
    } else if (distFromRight < threshold && distFromRight >= 0) {
      direction = 1;
      proximity = 1 - distFromRight / threshold;
    }

    if (direction === 0) {
      this.stopAutoScroll();
      return;
    }

    const min = FtKanbanView.SCROLL_SPEED_MIN;
    const max = FtKanbanView.SCROLL_SPEED_MAX;
    this._autoScrollSpeed = min + (max - min) * proximity;
    this._autoScrollDirection = direction;
    this._autoScrollContainer = container;

    // Start the loop if it's not already running.
    if (this._autoScrollRafId === null) {
      this._autoScrollRafId = requestAnimationFrame(this.autoScrollLoop);
    }
  }

  private autoScrollLoop = () => {
    if (!this._autoScrollContainer || this._autoScrollDirection === 0) {
      this._autoScrollRafId = null;
      return;
    }
    this._autoScrollContainer.scrollLeft +=
      this._autoScrollDirection * this._autoScrollSpeed;
    this._autoScrollRafId = requestAnimationFrame(this.autoScrollLoop);
  };

  private stopAutoScroll() {
    if (this._autoScrollRafId !== null) {
      cancelAnimationFrame(this._autoScrollRafId);
      this._autoScrollRafId = null;
    }
    this._autoScrollDirection = 0;
    this._autoScrollContainer = null;
    this._autoScrollSpeed = 0;
  }

  private async openAddTaskDialog() {
    const dialog = this.renderRoot.querySelector<FtAddTaskDialog>('ft-add-task-dialog');
    await dialog?.show();
  }

  private async onColumnAddTask(e: CustomEvent) {
    if (this.readOnly || this.capabilities?.canCreateTask === false) return;
    const { stage, label } = e.detail as { stage: TaskStage; label: string };
    const dialog = this.renderRoot.querySelector<FtAddTaskDialog>('ft-add-task-dialog');
    dialog?.setTarget(stage, label);
    await dialog?.show();
  }

  private async onTaskCreate(e: CustomEvent<TaskCreateDetail>) {
    if (this.readOnly || this.capabilities?.canCreateTask === false) return;
    const dialog = e.currentTarget as FtAddTaskDialog;

    if (!this.client) {
      dialog.setError('Failed to create task. Please try again.');
      return;
    }

    dialog.setCreating(true);

    try {
      const task = await this.client.createTask(e.detail);
      // TODO(server-stage-support): Remove client-side override once CreateTask
      // reliably honors the stage field in the response. The server should be
      // the source of truth; this override exists as a safety net during rollout.
      // The `phase` below is a local display projection for the store entry —
      // it is not sent to the server.
      this.store.upsert(
        e.detail.stage
          ? { ...task, stage: e.detail.stage, phase: phaseForStage(e.detail.stage) }
          : task,
      );
      dialog.close();
    } catch (error) {
      console.error('Failed to create task', error);
      dialog.setError('Failed to create task. Please try again.');
    } finally {
      dialog.setCreating(false);
    }
  }

  private onColumnNav(e: CustomEvent<ColumnNavDetail>) {
    const { direction, fromIndex, stage } = e.detail;
    const columns = BOARD_COLUMNS;
    const sourceIndex = columns.findIndex((col) => col.stage === stage);
    if (sourceIndex === -1) return;

    const step = direction === 'left' ? -1 : 1;
    for (
      let columnIndex = sourceIndex + step;
      columnIndex >= 0 && columnIndex < columns.length;
      columnIndex += step
    ) {
      const target = columns[columnIndex];
      const count = this.getColumnTasks(target.stage).length;
      if (count === 0) continue;

      const targetColumn = this.renderedColumnForStage(target.stage);
      if (!targetColumn) return;

      void targetColumn.focusTaskAt(Math.min(fromIndex, count - 1));
      return;
    }
  }

  private renderedColumnForStage(stage: TaskStage): FtKanbanColumn | undefined {
    return Array.from(
      this.renderRoot.querySelectorAll<FtKanbanColumn>('ft-kanban-column'),
    ).find((column) => column.stage === stage);
  }

  render() {
    const boardColumns = BOARD_COLUMNS.map((col) => {
      const allForStage = this.store.getByStage(col.stage);
      return {
        ...col,
        tasks: allForStage.filter((task) => this.matchesFilters(task)),
        totalCount: allForStage.length,
      };
    });
    return html`
      ${this.readOnly || this.capabilities?.canCreateTask === false ? nothing : html`<div class="view-header">
        <sl-button size="small" variant="primary" @click=${this.openAddTaskDialog}>
          <sl-icon name="plus" slot="prefix"></sl-icon>
          Add Task
        </sl-button>
      </div>`}

      <div
        class="board"
        @stage-change=${this.onStageChange}
        @task-update=${this.onTaskUpdate}
        @column-add-task=${this.onColumnAddTask}
        @column-nav=${this.onColumnNav}
        @dragover=${this.onContainerDragOver}
        @dragleave=${this.onContainerDragLeave}
        @dragend=${this.onContainerDragEnd}
        @drop=${this.onContainerDrop}
      >
        ${boardColumns.map(
          (col) => html`
            <ft-kanban-column
              .stage=${col.stage}
              .tasks=${col.tasks}
              .store=${this.store}
              .label=${col.label}
              .totalCount=${col.totalCount}
              ?readOnly=${this.readOnly}
              .capabilities=${this.capabilities}
              selected-task-id=${this.selectedTaskId ?? ''}
            ></ft-kanban-column>
          `,
        )}
      </div>

      <ft-add-task-dialog @task-create=${this.onTaskCreate}></ft-add-task-dialog>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ft-kanban-view': FtKanbanView;
  }
}
