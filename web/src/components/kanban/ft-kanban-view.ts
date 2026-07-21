import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { TaskStore } from '../../store/task-store.js';
import { TaskStoreController } from '../../store/task-store-controller.js';
import { TaskStage, TaskPhase } from '../../gen/types.js';
import type { Task } from '../../gen/types.js';
import { applyTaskUpdateFields, phaseForStage, type FarmTableServiceClient } from '../../gen/service.js';
import type { UpdateTaskFields } from '../../gen/service.js';
import { matchesTaskFilters } from '../task-filters.js';
import type { FtAddTaskDialog, TaskCreateDetail } from './ft-add-task-dialog.js';
import type { FtKanbanColumn } from './ft-kanban-column.js';

// TODO(test-coverage): Add component tests for the column-add-task event flow.

interface ColumnDef {
  stage: TaskStage;
  label: string;
  phase: TaskPhase;
}

interface ColumnNavDetail {
  direction: 'left' | 'right';
  fromIndex: number;
  stage: TaskStage;
}

const BOARD_COLUMNS: ColumnDef[] = [
  { stage: TaskStage.TRIAGE, label: 'Triage', phase: TaskPhase.OPEN },
  { stage: TaskStage.BACKLOG, label: 'Backlog', phase: TaskPhase.OPEN },
  { stage: TaskStage.READY, label: 'Ready', phase: TaskPhase.OPEN },
  { stage: TaskStage.WORKING, label: 'Working', phase: TaskPhase.IN_PROGRESS },
  { stage: TaskStage.IN_REVIEW, label: 'In Review', phase: TaskPhase.IN_PROGRESS },
  { stage: TaskStage.IN_QA, label: 'In QA', phase: TaskPhase.IN_PROGRESS },
  { stage: TaskStage.DEPLOYING, label: 'Deploying', phase: TaskPhase.IN_PROGRESS },
  { stage: TaskStage.COMPLETED, label: 'Completed', phase: TaskPhase.CLOSED },
];

const ON_HOLD_STAGES: ColumnDef[] = [
  { stage: TaskStage.BLOCKED, label: 'Blocked', phase: TaskPhase.ON_HOLD },
  { stage: TaskStage.WAITING_FOR_INPUT, label: 'Waiting for Input', phase: TaskPhase.ON_HOLD },
  { stage: TaskStage.DEFERRED, label: 'Deferred', phase: TaskPhase.ON_HOLD },
  { stage: TaskStage.SCHEDULED, label: 'Scheduled', phase: TaskPhase.ON_HOLD },
];

const CLOSED_STAGES = new Set([
  TaskStage.COMPLETED,
  TaskStage.WONT_FIX,
  TaskStage.DUPLICATE,
  TaskStage.CANCELLED,
]);

@customElement('ft-kanban-view')
export class FtKanbanView extends LitElement {
  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
    }
    .board {
      display: flex;
      gap: 0.75rem;
      flex: 1;
      min-height: 0;
      overflow-x: auto;
      padding-bottom: 0.5rem;
    }
    .view-header {
      display: flex;
      justify-content: flex-end;
      margin-bottom: 0.75rem;
    }
    .on-hold-section {
      border-top: 1px solid var(--sl-color-neutral-200);
      padding-top: 0.75rem;
      margin-top: 0.5rem;
    }
    .on-hold-header {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      cursor: pointer;
      font-size: 0.85rem;
      font-weight: 700;
      color: var(--sl-color-neutral-500);
      text-transform: uppercase;
      letter-spacing: 0.04em;
      margin-bottom: 0.5rem;
      user-select: none;
    }
    .on-hold-header sl-icon {
      transition: transform 0.2s;
    }
    .on-hold-columns {
      display: flex;
      gap: 0.75rem;
      overflow-x: auto;
      padding-bottom: 0.5rem;
    }
    .on-hold-count {
      background: var(--sl-color-neutral-200);
      color: var(--sl-color-neutral-600);
      border-radius: 999px;
      padding: 0.1rem 0.45rem;
      font-size: 0.7rem;
    }
  `;

  @property({ attribute: false })
  store!: TaskStore;

  @property({ attribute: 'selected-task-id' })
  selectedTaskId: string | null = null;

  @property({ attribute: false })
  client?: FarmTableServiceClient;

  @property({ attribute: false })
  phaseFilter: TaskPhase | null = null;

  @property({ attribute: false })
  assigneeFilter: string | null = null;

  @property({ type: Boolean })
  readOnly = false;

  private storeController!: TaskStoreController;

  @state()
  private onHoldExpanded = false;

  connectedCallback() {
    super.connectedCallback();
    this.storeController = new TaskStoreController(this, this.store);
  }

  private getColumnTasks(stage: TaskStage): Task[] {
    return this.store.getByStage(stage).filter((task) => this.matchesFilters(task));
  }

  private matchesFilters(task: Task): boolean {
    return matchesTaskFilters(task, this.phaseFilter, this.assigneeFilter);
  }

  private async onStageChange(e: CustomEvent) {
    if (this.readOnly) return;
    const { taskId, stage } = e.detail as { taskId: string; stage: TaskStage };
    const task = this.store.getTask(taskId);
    if (!task || task.stage === stage) return;

    if (CLOSED_STAGES.has(stage) && stage !== TaskStage.COMPLETED) return;

    const oldStage = task.stage;
    const oldPhase = task.phase;
    const newPhase = phaseForStage(stage);
    this.store.upsert({ ...task, stage, phase: newPhase });

    try {
      if (this.client) {
        await this.client.updateTask(taskId, { stage, phase: newPhase });
      } else {
        console.warn('No client configured — stage change is local only');
      }
    } catch (error) {
      // TODO(ui-feedback): Show a toast/snackbar when an optimistic save rolls back.
      console.warn('Failed to update task stage; rolled back optimistic change', error);
      this.store.upsert({ ...task, stage: oldStage, phase: oldPhase });
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
      // TODO(ui-feedback): Show a toast/snackbar when an optimistic save rolls back.
      console.warn('Failed to update task; rolled back optimistic change', error);
      this.store.upsert(task);
    }
  }

  private toggleOnHold() {
    this.onHoldExpanded = !this.onHoldExpanded;
  }

  private async openAddTaskDialog() {
    const dialog = this.renderRoot.querySelector<FtAddTaskDialog>('ft-add-task-dialog');
    await dialog?.show();
  }

  private async onColumnAddTask(e: CustomEvent) {
    if (this.readOnly) return;
    const { stage, label } = e.detail as { stage: TaskStage; label: string };
    const dialog = this.renderRoot.querySelector<FtAddTaskDialog>('ft-add-task-dialog');
    dialog?.setTarget(stage, label);
    await dialog?.show();
  }

  private async onTaskCreate(e: CustomEvent<TaskCreateDetail>) {
    if (this.readOnly) return;
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
    const columns = this.columnsForStage(stage);
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

  private columnsForStage(stage: TaskStage): ColumnDef[] {
    // Board columns and on-hold columns are separate keyboard regions by design.
    // Arrow navigation stays within the currently visible section.
    if (BOARD_COLUMNS.some((col) => col.stage === stage)) return BOARD_COLUMNS;
    return ON_HOLD_STAGES;
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
    const onHoldColumns = ON_HOLD_STAGES.map((col) => {
      const allForStage = this.store.getByStage(col.stage);
      return {
        ...col,
        tasks: allForStage.filter((task) => this.matchesFilters(task)),
        totalCount: allForStage.length,
      };
    });
    const onHoldTotal = onHoldColumns.reduce((sum, col) => sum + col.tasks.length, 0);

    return html`
      ${this.readOnly ? nothing : html`<div class="view-header">
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
      >
        ${boardColumns.map(
          (col) => html`
            <ft-kanban-column
              .stage=${col.stage}
              .tasks=${col.tasks}
              .label=${col.label}
              .totalCount=${col.totalCount}
              ?readOnly=${this.readOnly}
              selected-task-id=${this.selectedTaskId ?? ''}
            ></ft-kanban-column>
          `,
        )}
      </div>

      ${onHoldTotal > 0
        ? html`
            <div class="on-hold-section">
              <div class="on-hold-header" @click=${this.toggleOnHold}>
                <sl-icon
                  name=${this.onHoldExpanded ? 'chevron-down' : 'chevron-right'}
                ></sl-icon>
                On Hold
                <span class="on-hold-count">${onHoldTotal}</span>
              </div>
              ${this.onHoldExpanded
                ? html`
                    <div
                      class="on-hold-columns"
                      @stage-change=${this.onStageChange}
                      @task-update=${this.onTaskUpdate}
                      @column-add-task=${this.onColumnAddTask}
                      @column-nav=${this.onColumnNav}
                    >
                      ${onHoldColumns.map(
                        (col) => html`
                          <ft-kanban-column
                            .stage=${col.stage}
                            .tasks=${col.tasks}
                            .label=${col.label}
                            .totalCount=${col.totalCount}
                            ?readOnly=${this.readOnly}
                            selected-task-id=${this.selectedTaskId ?? ''}
                          ></ft-kanban-column>
                        `,
                      )}
                    </div>
                  `
                : nothing}
            </div>
          `
        : nothing}

      <ft-add-task-dialog @task-create=${this.onTaskCreate}></ft-add-task-dialog>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ft-kanban-view': FtKanbanView;
  }
}
