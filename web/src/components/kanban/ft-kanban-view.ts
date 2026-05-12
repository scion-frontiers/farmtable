import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { TaskStore } from '../../store/task-store.js';
import { TaskStoreController } from '../../store/task-store-controller.js';
import { TaskStage, TaskPhase } from '../../gen/types.js';
import type { Task } from '../../gen/types.js';
import type { FarmTableServiceClient } from '../../gen/service.js';

interface ColumnDef {
  stage: TaskStage;
  label: string;
  phase: TaskPhase;
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

function phaseForStage(stage: TaskStage): TaskPhase {
  const col = [...BOARD_COLUMNS, ...ON_HOLD_STAGES].find((c) => c.stage === stage);
  return col?.phase ?? TaskPhase.UNSPECIFIED;
}

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
      overflow-x: auto;
      padding-bottom: 0.5rem;
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
      font-size: 0.8rem;
      font-weight: 600;
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

  private storeController!: TaskStoreController;

  @state()
  private onHoldExpanded = false;

  connectedCallback() {
    super.connectedCallback();
    this.storeController = new TaskStoreController(this, this.store);
  }

  private getColumnTasks(stage: TaskStage): Task[] {
    return this.store.getByStage(stage);
  }

  private get onHoldTotal(): number {
    return ON_HOLD_STAGES.reduce(
      (sum, col) => sum + this.getColumnTasks(col.stage).length,
      0,
    );
  }

  private async onStageChange(e: CustomEvent) {
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
    } catch {
      this.store.upsert({ ...task, stage: oldStage, phase: oldPhase });
    }
  }

  private toggleOnHold() {
    this.onHoldExpanded = !this.onHoldExpanded;
  }

  render() {
    const onHoldTotal = this.onHoldTotal;

    return html`
      <div class="board" @stage-change=${this.onStageChange}>
        ${BOARD_COLUMNS.map(
          (col) => html`
            <ft-kanban-column
              .stage=${col.stage}
              .tasks=${this.getColumnTasks(col.stage)}
              .label=${col.label}
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
                    <div class="on-hold-columns" @stage-change=${this.onStageChange}>
                      ${ON_HOLD_STAGES.map(
                        (col) => html`
                          <ft-kanban-column
                            .stage=${col.stage}
                            .tasks=${this.getColumnTasks(col.stage)}
                            .label=${col.label}
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
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ft-kanban-view': FtKanbanView;
  }
}
