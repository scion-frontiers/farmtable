import { LitElement, html, css, nothing, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { Task, User } from '../../gen/types.js';
import type { FarmTableServiceClient, UpdateTaskFields } from '../../gen/service.js';
import { formatDate } from '../../util/format.js';
import { iconButtonFocusStyles } from './inspector-shared-styles.js';

type EditableDateField = 'startDate' | 'dueDate';

@customElement('ft-inspector-meta')
export class FtInspectorMeta extends LitElement {
  static styles = [
    iconButtonFocusStyles,
    css`
    :host {
      display: block;
    }
    .row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding: 0.375rem 0;
      font-size: 0.8125rem;
      gap: 0.5rem;
    }
    .label {
      color: var(--sl-color-neutral-500);
      flex-shrink: 0;
      min-width: 5rem;
    }
    .value {
      text-align: right;
      word-break: break-word;
    }
    .assignees {
      display: flex;
      gap: 0.375rem;
      flex-wrap: wrap;
      justify-content: flex-end;
    }
    .labels {
      display: flex;
      gap: 0.25rem;
      flex-wrap: wrap;
      justify-content: flex-end;
      align-items: center;
    }
    .empty {
      color: var(--sl-color-neutral-400);
      font-style: italic;
    }
    .date-value {
      display: inline-flex;
      align-items: center;
      justify-content: flex-end;
      gap: 0.25rem;
      flex-wrap: wrap;
    }
    .date-editor {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 0.25rem;
      flex-wrap: wrap;
    }
    .date-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.25rem 0.75rem;
      padding: 0.375rem 0;
      font-size: 0.8125rem;
    }
    .date-cell {
      display: flex;
      flex-direction: column;
      gap: 0.125rem;
      min-width: 0;
    }
    .date-cell .label {
      color: var(--sl-color-neutral-500);
      font-size: 0.75rem;
    }
    .date-cell .value {
      text-align: left;
      word-break: break-word;
    }
    .date-cell .date-value {
      justify-content: flex-start;
    }
    .date-cell .date-editor {
      justify-content: flex-start;
      flex-direction: column;
      align-items: flex-start;
    }
    .date-cell sl-input.date-input {
      width: 100%;
    }
    .date-cell .edit-buttons {
      display: flex;
      gap: 0.125rem;
    }
    sl-input.date-input {
      --sl-input-height-small: 1.75rem;
      --sl-input-font-size-small: 0.8125rem;
    }
    sl-input.label-input {
      width: 8rem;
      --sl-input-height-small: 1.75rem;
      --sl-input-font-size-small: 0.8125rem;
    }
    .assignee-picker {
      display: flex;
      flex-direction: column;
      gap: 0.125rem;
      margin-top: 0.25rem;
    }
    .assignee-option {
      display: flex;
      align-items: center;
      gap: 0.375rem;
      padding: 0.25rem 0.5rem;
      font-size: 0.8125rem;
      cursor: pointer;
      border-radius: var(--sl-border-radius-small);
    }
    .assignee-option:hover {
      background: var(--sl-color-neutral-100);
    }
  `,
  ];

  @property({ attribute: false })
  task!: Task;

  @property({ attribute: false })
  client?: FarmTableServiceClient;

  @state()
  private editingDate: EditableDateField | null = null;

  @state()
  private dateDraft = '';

  @state()
  private addingLabel = false;

  @state()
  private labelDraft = '';

  @state()
  private pickingAssignee = false;

  @state()
  private availableUsers: User[] = [];

  /** Cached user list from listUsers(); cleared when the client changes. */
  private userCache: User[] | null = null;

  private prevTaskId = '';

  override willUpdate(changedProps: PropertyValues<this>) {
    if (!changedProps.has('task')) return;

    // task is an object reference; guard by ID so store refreshes for the same task keep edits intact.
    const nextTaskId = this.task?.id ?? '';
    if (nextTaskId !== this.prevTaskId) {
      this.prevTaskId = nextTaskId;
      this.resetEditState();
    }
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this.removeDismissListener();
    document.removeEventListener('keydown', this.onDocumentKeyDown, { capture: true });
  }

  private async startDateEdit(field: EditableDateField) {
    this.editingDate = field;
    this.dateDraft = this.dateInputValue(this.task[field]);
    this.addDismissListener();
    await this.updateComplete;
    this.renderRoot.querySelector<HTMLElement>('sl-input.date-input')?.focus();
  }

  private onDateInput(e: Event) {
    this.dateDraft = (e.currentTarget as HTMLInputElement).value;
  }

  private onDateKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      this.saveDateEdit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      this.cancelDateEdit();
    }
  }

  private saveDateEdit() {
    if (!this.editingDate) return;

    const field = this.editingDate;
    const currentValue = this.dateInputValue(this.task[field]);
    const nextValue = this.dateDraft ? `${this.dateDraft}T00:00:00.000Z` : null;
    this.editingDate = null;
    this.removeDismissListenerIfIdle();

    if (this.dateDraft === currentValue) return;
    // TS cannot narrow this computed date field key to the matching update shape.
    this.dispatchTaskUpdate({ [field]: nextValue } as UpdateTaskFields);
  }

  private clearDateEdit(field: EditableDateField) {
    this.editingDate = null;
    if (!this.task[field]) return;
    this.dispatchTaskUpdate({ [field]: null } as UpdateTaskFields);
  }

  private cancelDateEdit() {
    this.editingDate = null;
    this.dateDraft = '';
    this.removeDismissListenerIfIdle();
  }

  private onLabelRemove(e: Event) {
    const label = (e.currentTarget as HTMLElement).dataset.label;
    if (label) this.dispatchTaskUpdate({ removeLabels: [label] });
  }

  private async startLabelAdd() {
    this.addingLabel = true;
    this.labelDraft = '';
    this.addDismissListener();
    await this.updateComplete;
    this.renderRoot.querySelector<HTMLElement>('sl-input.label-input')?.focus();
  }

  private onLabelInput(e: Event) {
    this.labelDraft = (e.currentTarget as HTMLInputElement).value;
  }

  private onLabelKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      this.saveLabelAdd();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      this.cancelLabelAdd();
    }
  }

  private saveLabelAdd() {
    const label = this.labelDraft.trim();
    if (!label) return;

    this.addingLabel = false;
    this.labelDraft = '';
    this.removeDismissListenerIfIdle();

    if (this.task.labels.includes(label)) return;
    this.dispatchTaskUpdate({ addLabels: [label] });
  }

  private cancelLabelAdd() {
    this.addingLabel = false;
    this.labelDraft = '';
    this.removeDismissListenerIfIdle();
  }

  private onAssigneeRemove(e: Event) {
    const userId = (e.currentTarget as HTMLElement).dataset.userId;
    if (!userId) return;
    const currentIds = this.task.assignees.map((u) => u.id);
    const newIds = currentIds.filter((id) => id !== userId);
    if (newIds.length === 0) {
      this.dispatchTaskUpdate({ clearAssignees: true });
    } else {
      this.dispatchTaskUpdate({ assigneeIds: newIds });
    }
  }

  private async startAssigneePick() {
    if (!this.client) return; // S-4: no-op when client is absent
    this.pickingAssignee = true;
    this.addDismissListener();
    try {
      if (!this.userCache) {
        this.userCache = await this.client.listUsers();
      }
      this.availableUsers = this.userCache;
    } catch {
      this.availableUsers = [];
    }
  }

  private cancelAssigneePick() {
    this.pickingAssignee = false;
    this.removeDismissListenerIfIdle();
  }

  private onAssigneeSelect(userId: string) {
    const currentIds = this.task.assignees.map((u) => u.id);
    if (currentIds.includes(userId)) return;
    this.pickingAssignee = false;
    this.removeDismissListenerIfIdle();
    this.dispatchTaskUpdate({ assigneeIds: [...currentIds, userId] });
  }

  private onDocumentKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && this.pickingAssignee) {
      e.preventDefault();
      e.stopPropagation();
      this.cancelAssigneePick();
    }
  };

  override connectedCallback() {
    super.connectedCallback();
    document.addEventListener('keydown', this.onDocumentKeyDown, { capture: true });
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

  private dateInputValue(iso: string | undefined): string {
    if (!iso) return '';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '';
    return date.toISOString().slice(0, 10);
  }

  private resetEditState() {
    this.editingDate = null;
    this.dateDraft = '';
    this.addingLabel = false;
    this.labelDraft = '';
    this.pickingAssignee = false;
    this.availableUsers = []; // Clear rendered list; intentionally keep userCache for next pick.
    this.removeDismissListener();
  }

  private onDocumentPointerDown = (e: PointerEvent) => {
    if (!this.hasActiveEditor()) return;
    if (e.composedPath().includes(this)) return;
    this.resetEditState();
  };

  private hasActiveEditor() {
    return this.editingDate !== null || this.addingLabel || this.pickingAssignee;
  }

  private addDismissListener() {
    document.addEventListener('pointerdown', this.onDocumentPointerDown, { capture: true });
  }

  private removeDismissListenerIfIdle() {
    if (!this.hasActiveEditor()) {
      this.removeDismissListener();
    }
  }

  private removeDismissListener() {
    document.removeEventListener('pointerdown', this.onDocumentPointerDown, { capture: true });
  }

  private renderDateCell(label: string, field: EditableDateField, value: string | undefined) {
    const isEditing = this.editingDate === field;

    return html`
      <div class="date-cell">
        <span class="label">${label}</span>
        <span class="value">
          ${isEditing
            ? html`
                <span class="date-editor">
                  <sl-input
                    class="date-input"
                    size="small"
                    type="date"
                    .value=${this.dateDraft}
                    @input=${this.onDateInput}
                    @keydown=${this.onDateKeyDown}
                  ></sl-input>
                  <span class="edit-buttons">
                    <sl-icon-button
                      name="check2"
                      label="Save ${label}"
                      @click=${this.saveDateEdit}
                    ></sl-icon-button>
                    <sl-icon-button
                      name="x-lg"
                      label="Cancel ${label} edit"
                      @click=${this.cancelDateEdit}
                    ></sl-icon-button>
                  </span>
                </span>
              `
            : html`
                <span class="date-value">
                  ${value
                    ? html`${formatDate(value)}`
                    : html`<span class="empty">None</span>`}
                  <sl-icon-button
                    name="pencil"
                    label="Edit ${label}"
                    @click=${() => this.startDateEdit(field)}
                  ></sl-icon-button>
                  ${value
                    ? html`
                        <sl-icon-button
                          name="x-lg"
                          label="Clear ${label}"
                          @click=${() => this.clearDateEdit(field)}
                        ></sl-icon-button>
                      `
                    : nothing}
                </span>
              `}
        </span>
      </div>
    `;
  }

  private renderReadOnlyDateCell(label: string, value: string | undefined) {
    return html`
      <div class="date-cell">
        <span class="label">${label}</span>
        <span class="value">${value ? formatDate(value) : '—'}</span>
      </div>
    `;
  }

  private renderAssignees() {
    const assignees = this.task.assignees;
    const assignedIds = new Set(assignees.map((u) => u.id));
    const unassignedUsers = this.availableUsers.filter((u) => !assignedIds.has(u.id));

    return html`
      <span class="assignees">
        ${assignees.length > 0
          ? assignees.map(
              (u) => html`
                <sl-tag
                  data-user-id=${u.id}
                  size="small"
                  variant="neutral"
                  removable
                  @sl-remove=${this.onAssigneeRemove}
                >
                  ${u.name}
                </sl-tag>
              `,
            )
          : html`<span class="empty">Unassigned</span>`}
        ${this.pickingAssignee
          ? html`
              <sl-icon-button
                name="x-lg"
                label="Cancel assignee pick"
                @click=${this.cancelAssigneePick}
              ></sl-icon-button>
              <div class="assignee-picker">
                ${unassignedUsers.length > 0
                  ? unassignedUsers.map(
                      (u) => html`
                        <span class="assignee-option" @click=${() => this.onAssigneeSelect(u.id)}>
                          <sl-avatar
                            initials=${u.name.slice(0, 2)}
                            label=${u.name}
                            style="--size: 1.4rem; font-size: 0.55rem;"
                          ></sl-avatar>
                          ${u.name}
                        </span>
                      `,
                    )
                  : html`<span class="empty">No users available</span>`}
              </div>
            `
          : this.client
            ? html`
                <sl-icon-button
                  name="plus-lg"
                  label="Add assignee"
                  @click=${this.startAssigneePick}
                ></sl-icon-button>
              `
            : nothing}
      </span>
    `;
  }

  private renderLabels() {
    const labels = this.task.labels;

    return html`
      <span class="labels">
        ${labels.length > 0
          ? labels.map(
              (label) => html`
                <sl-tag
                  data-label=${label}
                  size="small"
                  variant="neutral"
                  removable
                  @sl-remove=${this.onLabelRemove}
                >
                  ${label}
                </sl-tag>
              `,
            )
          : html`<span class="empty">None</span>`}
        ${this.addingLabel
          ? html`
              <sl-input
                class="label-input"
                size="small"
                maxlength="100"
                .value=${this.labelDraft}
                @input=${this.onLabelInput}
                @keydown=${this.onLabelKeyDown}
              ></sl-input>
              <sl-icon-button
                name="check2"
                label="Add label"
                @click=${this.saveLabelAdd}
              ></sl-icon-button>
              <sl-icon-button
                name="x-lg"
                label="Cancel label add"
                @click=${this.cancelLabelAdd}
              ></sl-icon-button>
            `
          : html`
              <sl-icon-button
                name="plus-lg"
                label="Add label"
                @click=${this.startLabelAdd}
              ></sl-icon-button>
            `}
      </span>
    `;
  }

  render() {
    const t = this.task;

    return html`
      <div class="row">
        <span class="label">Assignees</span>
        <span class="value">${this.renderAssignees()}</span>
      </div>

      ${t.type
        ? html`<div class="row">
            <span class="label">Type</span>
            <span class="value">${t.type}</span>
          </div>`
        : nothing}

      <div class="row">
        <span class="label">Labels</span>
        <span class="value">${this.renderLabels()}</span>
      </div>

      <div class="date-grid">
        ${this.renderDateCell('Start date', 'startDate', t.startDate)}
        ${this.renderDateCell('Due date', 'dueDate', t.dueDate)}
        ${this.renderReadOnlyDateCell('Created', t.createdAt)}
        ${this.renderReadOnlyDateCell('Updated', t.updatedAt)}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ft-inspector-meta': FtInspectorMeta;
  }
}
