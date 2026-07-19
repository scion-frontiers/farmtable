import { LitElement, html, css, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import type { Task } from '../../gen/types.js';
import { TaskStage, TaskPriority } from '../../gen/types.js';
import type { FtTaskCard } from './ft-task-card.js';

const STAGE_COLOR: Record<number, string> = {
  [TaskStage.TRIAGE]: 'var(--ft-stage-triage)',
  [TaskStage.BACKLOG]: 'var(--ft-stage-backlog)',
  [TaskStage.READY]: 'var(--ft-stage-ready)',
  [TaskStage.WORKING]: 'var(--ft-stage-working)',
  [TaskStage.IN_REVIEW]: 'var(--ft-stage-in-review)',
  [TaskStage.IN_QA]: 'var(--ft-stage-in-qa)',
  [TaskStage.DEPLOYING]: 'var(--ft-stage-deploying)',
  [TaskStage.BLOCKED]: 'var(--ft-stage-blocked)',
  [TaskStage.WAITING_FOR_INPUT]: 'var(--ft-stage-blocked)',
  [TaskStage.DEFERRED]: 'var(--ft-stage-triage)',
  [TaskStage.SCHEDULED]: 'var(--ft-stage-triage)',
  [TaskStage.COMPLETED]: 'var(--ft-stage-completed)',
};

function priorityRank(p?: TaskPriority): number {
  if (p === undefined || p === TaskPriority.UNSPECIFIED) return 99;
  return p;
}

function sortTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    const pa = priorityRank(a.priority);
    const pb = priorityRank(b.priority);
    if (pa !== pb) return pa - pb;
    return a.createdAt.localeCompare(b.createdAt);
  });
}

@customElement('ft-kanban-column')
export class FtKanbanColumn extends LitElement {
  static styles = css`
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
      overflow-y: auto;
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

  @property({ type: Number })
  stage: TaskStage = TaskStage.UNSPECIFIED;

  @property({ attribute: false })
  tasks: Task[] = [];

  @property()
  label = '';

  @property({ type: Number, attribute: 'total-count' })
  totalCount = 0;

  @property({ attribute: 'selected-task-id' })
  selectedTaskId: string | null = null;

  @state()
  private isDragOver = false;

  @state()
  private activeCardIndex = 0;

  @state()
  private _sortedTasks: Task[] = [];

  private _dragEnterCount = 0;

  protected updated(changedProperties: PropertyValues<this>) {
    if (!changedProperties.has('tasks')) return;

    this._sortedTasks = sortTasks(this.tasks);
    const lastIndex = this._sortedTasks.length - 1;
    this.activeCardIndex = Math.max(0, Math.min(this.activeCardIndex, lastIndex));
  }

  private onDragEnter() {
    this._dragEnterCount++;
    this.isDragOver = true;
  }

  private onDragOver(e: DragEvent) {
    e.preventDefault();
    e.dataTransfer!.dropEffect = 'move';
  }

  private onDragLeave() {
    this._dragEnterCount--;
    this.isDragOver = this._dragEnterCount > 0;
  }

  private onDrop(e: DragEvent) {
    e.preventDefault();
    this._dragEnterCount = 0;
    this.isDragOver = false;
    const taskId = e.dataTransfer!.getData('text/plain');
    if (!taskId) return;
    this.dispatchEvent(
      new CustomEvent('stage-change', {
        detail: { taskId, stage: this.stage },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private onAddTaskClick(e: MouseEvent) {
    e.stopPropagation();
    this.dispatchEvent(
      new CustomEvent('column-add-task', {
        detail: { stage: this.stage, label: this.label },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private async focusCardAt(index: number) {
    const cards = this.cardElements;
    if (cards.length === 0) return;

    const nextIndex = Math.max(0, Math.min(index, cards.length - 1));
    this.activeCardIndex = nextIndex;
    await this.updateComplete;
    this.cardElements[nextIndex]?.focusCard();
  }

  public async focusTaskAt(index: number) {
    await this.focusCardAt(index);
  }

  private get cardElements(): FtTaskCard[] {
    return Array.from(this.renderRoot.querySelectorAll<FtTaskCard>('ft-task-card'));
  }

  private cardIndexFromEvent(e: Event): number | null {
    const index = Number((e.currentTarget as HTMLElement).dataset.cardIndex);
    return Number.isNaN(index) ? null : index;
  }

  private onCardFocusHandler(e: FocusEvent) {
    const index = this.cardIndexFromEvent(e);
    if (index === null) return;

    this.activeCardIndex = index;
  }

  private onCardKeyDownHandler(e: KeyboardEvent) {
    if (e.defaultPrevented) return;

    const index = this.cardIndexFromEvent(e);
    if (index === null) return;

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
        this.dispatchEvent(
          new CustomEvent('column-nav', {
            detail: {
              direction: e.key === 'ArrowLeft' ? 'left' : 'right',
              fromIndex: index,
              stage: this.stage,
            },
            bubbles: true,
            composed: true,
          }),
        );
        break;
    }
  }

  render() {
    const sorted = this._sortedTasks;
    const color = STAGE_COLOR[this.stage] ?? 'var(--ft-stage-triage)';
    const isFiltered = this.totalCount > 0 && sorted.length !== this.totalCount;
    // NOTE(i18n): Hardcoded English; extract if i18n is added.
    const countLabel = isFiltered ? `${sorted.length} of ${this.totalCount}` : `${sorted.length}`;
    const countChip = html`
      <span class=${classMap({ count: true, filtered: isFiltered })} aria-label=${`${countLabel} tasks`}
        >${countLabel}</span
      >
    `;
    const filteredCountTooltip = isFiltered
      ? `${sorted.length} tasks visible out of ${this.totalCount} total (filter active)`
      : '';

    return html`
      <div class="header">
        <span class="color-dot" style="background: ${color}"></span>
        ${this.label}
        ${isFiltered
          ? html`<sl-tooltip class="count-tooltip" content=${filteredCountTooltip} hoist placement="bottom"
              >${countChip}</sl-tooltip
            >`
          : countChip}
        <sl-icon-button
          class="add-task-button"
          name="plus"
          size="small"
          label=${`Add task to ${this.label}`}
          @click=${this.onAddTaskClick}
        ></sl-icon-button>
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
        ${sorted.map(
          (task, index) => html`
            <ft-task-card
              .task=${task}
              ?selected=${task.id === this.selectedTaskId}
              card-tab-index=${index === this.activeCardIndex ? 0 : -1}
              data-card-index=${index}
              @focusin=${this.onCardFocusHandler}
              @keydown=${this.onCardKeyDownHandler}
            ></ft-task-card>
          `,
        )}
        ${isFiltered && sorted.length === 0
          ? html`<div class="empty-filter-message">
              <!-- NOTE(i18n): Hardcoded English; extract if i18n is added. -->
              No visible tasks match this filter.
            </div>`
          : ''}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ft-kanban-column': FtKanbanColumn;
  }
}
