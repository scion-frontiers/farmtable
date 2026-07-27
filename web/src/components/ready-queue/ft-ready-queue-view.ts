import { LitElement, html, css, nothing, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { TaskStore } from '../../store/task-store.js';
import { TaskStoreController } from '../../store/task-store-controller.js';
import {
  RelationshipType,
  TaskHoldReason,
  TaskPriority,
  TaskStage,
  type Task,
} from '../../gen/types.js';
import { isReady } from '../../utils/task-ready.js';
import { matchesTaskFilters } from '../task-filters.js';
import { PRIORITY_VARIANT, PRIORITY_LABEL } from '../../util/priority-utils.js';
import {
  STAGE_LABEL,
  STAGE_COLOR,
  compareAcceptedQueueOrder,
  availabilityLabel,
  DROP_REFUSAL,
  isClosedStage,
  priorityRank,
  rankBand,
  WRITE_FAILURE,
  type AvailabilityFilter,
  type TaskGroupFilter,
} from '../../util/task-state-utils.js';
import { ranksForMove } from '../../util/rank.js';
import type { FarmTableServiceClient } from '../../gen/service.js';
import type { CollectionCapabilities } from '../../capabilities.js';
import '../ft-empty-state.js';

/**
 * A flat, priority-sorted list of tasks that are available under the server
 * task-state availability model.
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

    .queue-row.dragging {
      opacity: 0.45;
    }

    /* Marks the row the dragged task will take the place of. */
    .queue-row.drop-target {
      border-color: var(--sl-color-primary-500);
      border-style: dashed;
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

    .priority-cell {
      display: inline-flex;
      flex-shrink: 0;
      min-width: 6.5rem;
    }

    .blocks-badge {
      flex-shrink: 0;
    }
    .rank {
      color: var(--sl-color-neutral-500);
      font-size: 0.75rem;
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
  client?: FarmTableServiceClient;

  @property({ type: Boolean })
  readOnly = false;

  @property({ attribute: false })
  capabilities?: CollectionCapabilities;

  /** Task currently being dragged, used to dim its row. */
  @state()
  private draggingId: string | null = null;

  /** Row the pointer is currently over, used to show the drop indicator. */
  @state()
  private dropTargetId: string | null = null;

  /**
   * True while a reorder's writes are on the wire.
   *
   * `drop` ends the gesture immediately but `reorder()` keeps awaiting, so
   * nothing stops a second drag from starting mid-flight. Two overlapping
   * reorders interleave their writes, and if the first then fails, its rollback
   * restores pre-first-drag ranks over rows the second already persisted —
   * leaving the store contradicting the server with nothing to trigger a
   * refetch. Not `@state()`: it changes no rendered output.
   */
  private reorderInFlight = false;

  connectedCallback() {
    super.connectedCallback();
    new TaskStoreController(this, this.store);
  }

  protected updated(changedProps: PropertyValues<this>) {
    if (changedProps.has('selectedTaskId') && this.selectedTaskId) {
      void this.scrollToSelectedRow();
    }
  }

  /**
   * Scroll the selected queue row into view after render completes.
   */
  private async scrollToSelectedRow() {
    await this.updateComplete;
    const row = this.renderRoot.querySelector<HTMLElement>('.queue-row.selected');
    if (row) {
      row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  /** Delegate to shared isReady() utility. */
  private isReady(task: Task): boolean {
    return isReady(task, this.store);
  }

  /**
   * Count how many open tasks this task currently blocks.
   */
  private countBlocks(task: Task): number {
    let count = 0;
    for (const rel of task.relationships) {
      if (rel.type !== RelationshipType.BLOCKS) continue;
      const target = this.store.getTask(rel.targetTaskId);
      if (target && !isClosedStage(target.stage)) {
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
          matchesTaskFilters(
            task,
            this.groupFilter,
            this.stageFilter,
            this.holdReasonFilter,
            this.availabilityFilter,
            this.assigneeFilter,
            this.store,
          ),
      )
      .sort(compareAcceptedQueueOrder);
  }

  /**
   * The rank scope of `task` — see `rankBand()`, which owns the rule and the
   * reasoning behind it.
   *
   * This is deliberately NOT the set of rows on screen, and the whole store is
   * handed over unfiltered: what this view draws is not what the arithmetic is
   * computed over. Living in `task-state-utils` rather than here also lets a
   * test derive the band the way production does instead of rebuilding it.
   */
  private bandFor(task: Task): Task[] {
    return rankBand(task, this.store.allTasks, (candidate) => this.isReady(candidate));
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

  // ── Drag reorder (design contract §10: reorder within a priority band) ──

  private onRowDragStart(e: DragEvent, taskId: string) {
    this.draggingId = taskId;
    e.dataTransfer?.setData('text/plain', taskId);
    if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
  }

  /**
   * Accept the drag gesture on *every* row, including rows this view will
   * refuse.
   *
   * A `drop` event only fires when `dragover` called `preventDefault()`.
   * Bailing out early here — on a read-only board, on a foreign priority band,
   * on anything — means the browser never fires `drop`, the refusal handler
   * never runs, and the gesture dies looking like a frozen UI. Refusals are
   * decided in `onRowDrop` and reported as a toast; see the matching note in
   * `ft-kanban-column.onDragOver`.
   */
  private onRowDragOver(e: DragEvent, taskId: string) {
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    this.dropTargetId = taskId;
  }

  private onRowDragEnd() {
    this.draggingId = null;
    this.dropTargetId = null;
  }

  private onRowDrop(e: DragEvent, targetTaskId: string) {
    e.preventDefault();
    const draggedId = e.dataTransfer?.getData('text/plain') ?? '';
    this.draggingId = null;
    this.dropTargetId = null;
    if (!draggedId) return;
    void this.reorder(draggedId, targetTaskId);
  }

  /**
   * Surface a client-side refusal on the same toast channel as server write
   * failures. A drag this view declines must never be a silent no-op.
   */
  private reportRefusal(message: string) {
    this.dispatchEvent(new CustomEvent('write-error', {
      bubbles: true,
      composed: true,
      detail: { message, reason: 'rank-change-refused' },
    }));
  }

  /**
   * Move `draggedId` to the position of `targetTaskId` within its priority
   * band and persist the resulting ranks.
   */
  private async reorder(draggedId: string, targetTaskId: string) {
    const dragged = this.store.getTask(draggedId);
    const target = this.store.getTask(targetTaskId);
    if (!dragged || !target) return;
    // Genuine no-op: the row was dropped back onto itself.
    if (draggedId === targetTaskId) return;

    if (this.readOnly) {
      this.reportRefusal(DROP_REFUSAL.readOnlyQueue);
      return;
    }
    if (this.capabilities?.canDragReorder === false) {
      this.reportRefusal(DROP_REFUSAL.reorderUnsupported);
      return;
    }
    // Serialise reorders rather than interleaving them; see `reorderInFlight`.
    // Refused out loud on the same channel as every other refusal, because a
    // drag this view declines must never look like a frozen row.
    if (this.reorderInFlight) {
      this.reportRefusal(DROP_REFUSAL.reorderBusy);
      return;
    }

    // Cross-band drag (dropping into another priority) is an explicitly
    // optional convenience in contract §10 and is not implemented. Refuse it
    // out loud rather than letting the row snap back with no explanation.
    if (priorityRank(dragged.priority) !== priorityRank(target.priority)) {
      this.reportRefusal(
        DROP_REFUSAL.crossBandToast(
          dragged.name,
          PRIORITY_LABEL[target.priority ?? TaskPriority.UNSPECIFIED] ?? 'that',
        ),
      );
      return;
    }

    // The band is the FULL rank scope, filters ignored; only the drop *target*
    // is identified visually. Resolving the visible target to its index in the
    // full band keeps the drop where the user aimed it while letting the
    // midpoint arithmetic see the neighbours the filter is hiding.
    const band = this.bandFor(dragged);
    const targetIndex = band.findIndex((task) => task.id === targetTaskId);
    if (targetIndex === -1) return;

    const writes = ranksForMove(band, draggedId, targetIndex);
    if (writes.length === 0) return;

    // Bail BEFORE touching the store. This guard used to sit after the
    // optimistic write, so a queue with no client moved the row, left the store
    // holding ranks the server had never seen, and said nothing but a
    // `console.warn` — a silent fake success. `ft-app` always assigns a client,
    // so this is defensive rather than a live path, but a reorder that cannot
    // be saved must refuse out loud like every other refusal in this view.
    if (!this.client) {
      this.reportRefusal(DROP_REFUSAL.reorderNotConnected);
      return;
    }

    // Optimistic update first so the row moves under the pointer immediately.
    const originals = writes
      .map((write) => this.store.getTask(write.id))
      .filter((task): task is Task => task !== undefined);
    for (const write of writes) {
      const task = this.store.getTask(write.id);
      if (task) this.store.upsert({ ...task, rank: write.rank });
    }

    this.reorderInFlight = true;
    try {
      for (const write of writes) {
        // Contract: the queue writes `rank` only — never `priority`, never `phase`.
        const updated = await this.client.updateTask(write.id, { rank: write.rank });
        this.store.upsert(updated);
      }
    } catch (error) {
      // Partial-failure policy for the renumber case: writes are sequential,
      // so an earlier task in the batch may already be persisted when a later
      // one fails. We roll the *whole* band back to its pre-drag ranks and
      // report the failure, because showing the user the order they started
      // from plus an explicit error beats leaving a half-applied order on
      // screen that looks like it saved. The local store can then disagree
      // with the server for the already-written tasks until the next snapshot
      // or watch event; the toast tells the user to reload for exactly that
      // reason. Re-fetching here instead would need a list entry point this
      // view does not have.
      //
      // Roll back the `rank` field ONLY, merged onto whatever the store holds
      // now. Re-upserting the whole pre-drag snapshot would also revert every
      // field that changed while the writes were on the wire — a watch event
      // carrying a rename, a stage change, or a `version` bump — silently
      // undoing server state this view never touched, and a stale `version`
      // then fails the *next* optimistic write.
      console.warn('Failed to update task rank; rolled back optimistic reorder', error);
      for (const original of originals) {
        const current = this.store.getTask(original.id);
        this.store.upsert(current ? { ...current, rank: original.rank } : original);
      }
      this.dispatchEvent(new CustomEvent('write-error', {
        bubbles: true,
        composed: true,
        detail: {
          error,
          reason: 'rank-change-failed',
          ...(writes.length > 1
            ? { message: WRITE_FAILURE.partialRenumber }
            : {}),
        },
      }));
    } finally {
      this.reorderInFlight = false;
    }
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
          subtitle="No tasks are available to work on right now"
        ></ft-empty-state>
      `;
    }

    return html`
      <div class="queue">
        <h2 class="queue-header">Available Queue (${tasks.length})</h2>
        <div class="queue-list" role="listbox" aria-label="Available tasks">
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
          dragging: this.draggingId === task.id,
          'drop-target': this.dropTargetId === task.id && this.draggingId !== task.id,
        })}
        tabindex="0"
        role="option"
        aria-label=${`Task: ${task.name}`}
        aria-selected=${String(this.selectedTaskId === task.id)}
        draggable="true"
        @click=${() => this.onRowClick(task.id)}
        @keydown=${(e: KeyboardEvent) => this.onRowKeyDown(e, task.id)}
        @dragstart=${(e: DragEvent) => this.onRowDragStart(e, task.id)}
        @dragover=${(e: DragEvent) => this.onRowDragOver(e, task.id)}
        @dragend=${() => this.onRowDragEnd()}
        @drop=${(e: DragEvent) => this.onRowDrop(e, task.id)}
      >
        <span class="priority-cell"><sl-badge variant=${priorityVariant} pill>${priorityLabel}</sl-badge></span>

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

        ${task.rank !== undefined ? html`<span class="rank">Rank ${task.rank}</span>` : nothing}

        ${task.availability
          ? html`<sl-badge variant=${task.availability.available ? 'success' : 'neutral'}>${availabilityLabel(task)}</sl-badge>`
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
