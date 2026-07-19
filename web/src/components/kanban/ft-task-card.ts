import { LitElement, html, css, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import type { Task } from '../../gen/types.js';
import { TaskPriority, RelationshipType } from '../../gen/types.js';
import type { UpdateTaskFields } from '../../gen/service.js';

const PRIORITY_VARIANT: Record<number, string> = {
  [TaskPriority.UNSPECIFIED]: 'neutral',
  [TaskPriority.URGENT]: 'danger',
  [TaskPriority.HIGH]: 'warning',
  [TaskPriority.NORMAL]: 'primary',
  [TaskPriority.LOW]: 'neutral',
};

const PRIORITY_LABEL: Record<number, string> = {
  [TaskPriority.UNSPECIFIED]: 'No priority',
  [TaskPriority.URGENT]: 'Urgent',
  [TaskPriority.HIGH]: 'High',
  [TaskPriority.NORMAL]: 'Normal',
  [TaskPriority.LOW]: 'Low',
};

const PRIORITY_OPTIONS = [
  TaskPriority.UNSPECIFIED,
  TaskPriority.URGENT,
  TaskPriority.HIGH,
  TaskPriority.NORMAL,
  TaskPriority.LOW,
];

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
      display: flex;
      align-items: flex-start;
      gap: 0.25rem;
      font-size: 0.875rem;
      font-weight: 600;
      line-height: 1.4;
      margin-bottom: 0.5rem;
      word-break: break-word;
    }
    .title-text {
      flex: 1;
      min-width: 0;
    }
    .title-edit-button {
      flex-shrink: 0;
      margin-top: -0.25rem;
      opacity: 0;
      transition: opacity 0.15s, color 0.15s;
      color: var(--sl-color-neutral-500);
    }
    .title:hover .title-edit-button,
    .title-edit-button:focus-visible {
      opacity: 1;
    }
    sl-input.title-input {
      width: 100%;
      --sl-input-height-small: 1.75rem;
      --sl-input-font-size-small: 0.875rem;
    }
    .priority-button {
      border: 0;
      background: transparent;
      padding: 0;
      cursor: pointer;
      line-height: 1;
    }
    .priority-button:focus-visible {
      outline: 2px solid var(--sl-color-primary-500);
      outline-offset: 2px;
      border-radius: 999px;
    }
    sl-select.priority-select {
      width: 7rem;
      --sl-input-height-small: 1.5rem;
      --sl-input-font-size-small: 0.75rem;
    }
    .meta {
      display: flex;
      align-items: center;
      gap: 0.375rem;
      flex-wrap: wrap;
      font-size: 0.8rem;
    }
    .type {
      color: var(--sl-color-neutral-500);
      font-size: 0.7rem;
      text-transform: uppercase;
      letter-spacing: 0.04em;
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
      font-size: 0.75rem;
      padding: 0 0.35rem;
      height: 1.25rem;
    }
    .overflow-label {
      font-size: 0.75rem;
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

  @state()
  private isEditingTitle = false;

  @state()
  private isEditingPriority = false;

  @state()
  private titleDraft = '';

  private get isBlocked(): boolean {
    return this.task.relationships.some(
      (r) => r.type === RelationshipType.BLOCKED_BY,
    );
  }

  private onDragStart(e: DragEvent) {
    if (this.isEditingTitle || this.isEditingPriority) {
      e.preventDefault();
      return;
    }
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

  private stopCardInteraction(e: Event) {
    e.stopPropagation();
  }

  private async startTitleEdit(e?: Event) {
    e?.stopPropagation();
    this.titleDraft = this.task.name;
    this.isEditingTitle = true;
    await this.updateComplete;
    const input = this.renderRoot.querySelector<HTMLElement & { focus: () => void; select: () => void }>(
      'sl-input.title-input',
    );
    input?.focus();
    input?.select();
  }

  private saveTitleEdit() {
    if (!this.isEditingTitle) return;

    const nextTitle = this.titleDraft.trim();
    this.isEditingTitle = false;

    if (!nextTitle || nextTitle === this.task.name) return;

    this.dispatchTaskUpdate({ name: nextTitle });
  }

  private cancelTitleEdit(e?: Event) {
    e?.stopPropagation();
    this.titleDraft = this.task.name;
    this.isEditingTitle = false;
  }

  private onTitleInput(e: Event) {
    this.titleDraft = (e.currentTarget as HTMLInputElement).value;
  }

  private onTitleKeyDown(e: KeyboardEvent) {
    e.stopPropagation();

    if (e.key === 'Enter') {
      e.preventDefault();
      this.saveTitleEdit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      this.cancelTitleEdit();
    }
  }

  private async startPriorityEdit(e: Event) {
    e.stopPropagation();
    this.isEditingPriority = true;
    await this.updateComplete;
    const select = this.renderRoot.querySelector<HTMLElement & { focus: () => void; show?: () => void }>(
      'sl-select.priority-select',
    );
    select?.focus();
    select?.show?.();
  }

  private onPriorityChange(e: Event) {
    e.stopPropagation();
    const raw = Number((e.currentTarget as HTMLInputElement).value);
    if (Number.isNaN(raw)) return;

    const nextPriority = raw as TaskPriority;
    this.isEditingPriority = false;

    if (nextPriority === (this.task.priority ?? TaskPriority.UNSPECIFIED)) return;

    this.dispatchTaskUpdate({ priority: nextPriority });
  }

  private onPriorityBlur() {
    this.isEditingPriority = false;
  }

  private dispatchTaskUpdate(fields: UpdateTaskFields) {
    this.dispatchEvent(
      new CustomEvent('task-update', {
        detail: { taskId: this.task.id, fields },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private renderPriorityEditor(priority: TaskPriority) {
    return html`
      <sl-select
        class="priority-select"
        size="small"
        value=${String(priority)}
        hoist
        @mousedown=${this.stopCardInteraction}
        @click=${this.stopCardInteraction}
        @sl-change=${this.onPriorityChange}
        @sl-after-hide=${this.onPriorityBlur}
      >
        ${PRIORITY_OPTIONS.map(
          (option) => html`
            <sl-option value=${String(option)}>${PRIORITY_LABEL[option]}</sl-option>
          `,
        )}
      </sl-select>
    `;
  }

  private renderPriorityBadge(priority: TaskPriority, label: string, variant: string) {
    return html`
      <button
        class="priority-button"
        type="button"
        title="Edit priority"
        @mousedown=${this.stopCardInteraction}
        @click=${this.startPriorityEdit}
      >
        <sl-badge variant=${variant} pill>${label}</sl-badge>
      </button>
    `;
  }

  render() {
    const t = this.task;
    const title =
      t.name.length > MAX_TITLE_LEN
        ? t.name.slice(0, MAX_TITLE_LEN) + '…'
        : t.name;

    const priority = t.priority ?? TaskPriority.UNSPECIFIED;
    const priorityVariant = PRIORITY_VARIANT[priority] ?? 'neutral';
    const priorityLabel = PRIORITY_LABEL[priority] ?? 'Unknown';

    const visibleLabels = t.labels.slice(0, MAX_LABELS);
    const overflowCount = t.labels.length - MAX_LABELS;

    const firstAssignee = t.assignees[0];

    return html`
      <div
        class=${classMap({ selected: this.selected })}
        draggable=${String(!this.isEditingTitle && !this.isEditingPriority)}
        @dragstart=${this.onDragStart}
        @dragend=${this.onDragEnd}
        @click=${this.onClick}
      >
        <sl-card>
          <div class="title" @dblclick=${this.startTitleEdit}>
            ${this.isEditingTitle
              ? html`
                  <sl-input
                    class="title-input"
                    size="small"
                    maxlength="200"
                    value=${this.titleDraft}
                    @mousedown=${this.stopCardInteraction}
                    @click=${this.stopCardInteraction}
                    @input=${this.onTitleInput}
                    @keydown=${this.onTitleKeyDown}
                    @blur=${this.saveTitleEdit}
                  ></sl-input>
                `
              : html`
                  <span class="title-text">${title}</span>
                  <sl-icon-button
                    class="title-edit-button"
                    name="pencil"
                    size="small"
                    label="Edit title"
                    @mousedown=${this.stopCardInteraction}
                    @click=${this.startTitleEdit}
                  ></sl-icon-button>
                `}
          </div>
          <div class="meta">
            ${this.isEditingPriority
              ? this.renderPriorityEditor(priority)
              : this.renderPriorityBadge(priority, priorityLabel, priorityVariant)}
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
