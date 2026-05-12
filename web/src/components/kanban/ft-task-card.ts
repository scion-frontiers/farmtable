import { LitElement, html, css, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import type { Task } from '../../gen/types.js';
import { TaskPriority, RelationshipType } from '../../gen/types.js';

const PRIORITY_VARIANT: Record<number, string> = {
  [TaskPriority.URGENT]: 'danger',
  [TaskPriority.HIGH]: 'warning',
  [TaskPriority.NORMAL]: 'primary',
  [TaskPriority.LOW]: 'neutral',
};

const PRIORITY_LABEL: Record<number, string> = {
  [TaskPriority.URGENT]: 'Urgent',
  [TaskPriority.HIGH]: 'High',
  [TaskPriority.NORMAL]: 'Normal',
  [TaskPriority.LOW]: 'Low',
};

const MAX_LABELS = 3;
const MAX_TITLE_LEN = 80;

@customElement('ft-task-card')
export class FtTaskCard extends LitElement {
  static styles = css`
    :host {
      display: block;
    }
    sl-card {
      width: 100%;
      cursor: grab;
      transition: box-shadow 0.15s, border-color 0.15s;
      --border-color: var(--sl-color-neutral-200);
    }
    sl-card:active {
      cursor: grabbing;
    }
    sl-card::part(base) {
      background: var(--sl-color-neutral-50);
    }
    :host([dragging]) sl-card {
      opacity: 0.5;
    }
    .selected sl-card,
    .selected sl-card::part(base) {
      border-color: var(--sl-color-primary-500);
      box-shadow: 0 0 0 1px var(--sl-color-primary-500);
    }
    .title {
      font-size: 0.875rem;
      font-weight: 500;
      line-height: 1.3;
      margin-bottom: 0.5rem;
      word-break: break-word;
    }
    .meta {
      display: flex;
      align-items: center;
      gap: 0.375rem;
      flex-wrap: wrap;
      font-size: 0.75rem;
    }
    .type {
      color: var(--sl-color-neutral-500);
      font-size: 0.7rem;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }
    .assignee {
      margin-left: auto;
    }
    .labels {
      display: flex;
      gap: 0.25rem;
      flex-wrap: wrap;
      margin-top: 0.375rem;
    }
    sl-tag::part(base) {
      font-size: 0.65rem;
      padding: 0 0.35rem;
      height: 1.25rem;
    }
    .overflow-label {
      font-size: 0.65rem;
      color: var(--sl-color-neutral-500);
      line-height: 1.25rem;
    }
    .blocked-icon {
      color: var(--ft-stage-blocked);
    }
  `;

  @property({ attribute: false })
  task!: Task;

  @property({ type: Boolean })
  selected = false;

  private get isBlocked(): boolean {
    return this.task.relationships.some(
      (r) => r.type === RelationshipType.BLOCKED_BY,
    );
  }

  private onDragStart(e: DragEvent) {
    e.dataTransfer!.setData('text/plain', this.task.id);
    e.dataTransfer!.effectAllowed = 'move';
    this.setAttribute('dragging', '');
  }

  private onDragEnd() {
    this.removeAttribute('dragging');
  }

  private onClick() {
    this.dispatchEvent(
      new CustomEvent('task-select', {
        detail: { taskId: this.task.id },
        bubbles: true,
        composed: true,
      }),
    );
  }

  render() {
    const t = this.task;
    const title =
      t.name.length > MAX_TITLE_LEN
        ? t.name.slice(0, MAX_TITLE_LEN) + '…'
        : t.name;

    const priorityVariant = PRIORITY_VARIANT[t.priority ?? TaskPriority.UNSPECIFIED] ?? 'neutral';
    const priorityLabel = PRIORITY_LABEL[t.priority ?? TaskPriority.UNSPECIFIED] ?? '';

    const visibleLabels = t.labels.slice(0, MAX_LABELS);
    const overflowCount = t.labels.length - MAX_LABELS;

    const firstAssignee = t.assignees[0];

    return html`
      <div
        class=${classMap({ selected: this.selected })}
        draggable="true"
        @dragstart=${this.onDragStart}
        @dragend=${this.onDragEnd}
        @click=${this.onClick}
      >
        <sl-card>
          <div class="title">${title}</div>
          <div class="meta">
            ${priorityLabel
              ? html`<sl-badge variant=${priorityVariant} pill>${priorityLabel}</sl-badge>`
              : nothing}
            ${t.type ? html`<span class="type">${t.type}</span>` : nothing}
            ${this.isBlocked
              ? html`<sl-icon name="lock" class="blocked-icon"></sl-icon>`
              : nothing}
            ${firstAssignee
              ? html`<sl-avatar
                  class="assignee"
                  initials=${firstAssignee.name.slice(0, 2)}
                  label=${firstAssignee.name}
                  style="--size: 1.5rem; font-size: 0.6rem;"
                ></sl-avatar>`
              : nothing}
          </div>
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
        </sl-card>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ft-task-card': FtTaskCard;
  }
}
