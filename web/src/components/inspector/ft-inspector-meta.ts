import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { Task, User } from '../../gen/types.js';
import type { FarmTableServiceClient, UpdateTaskFields } from '../../gen/service.js';
import { formatDate } from '../../util/format.js';

type EditableDateField = 'startDate' | 'dueDate';

@customElement('ft-inspector-meta')
export class FtInspectorMeta extends LitElement {
  static styles = css`
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
    .assignee {
      display: flex;
      align-items: center;
      gap: 0.25rem;
      font-size: 0.8125rem;
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
    sl-input.date-input {
      width: 9rem;
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
  `;

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

  private async startDateEdit(field: EditableDateField) {
    this.editingDate = field;
    this.dateDraft = this.dateInputValue(this.task[field]);
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
      this.cancelDateEdit();
    }
  }

  private saveDateEdit() {
    if (!this.editingDate) return;

    const field = this.editingDate;
    const currentValue = this.dateInputValue(this.task[field]);
    const nextValue = this.dateDraft ? `${this.dateDraft}T00:00:00.000Z` : null;
    this.editingDate = null;

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
  }

  private onLabelRemove(e: Event) {
    const label = (e.currentTarget as HTMLElement).dataset.label;
    if (label) this.dispatchTaskUpdate({ removeLabels: [label] });
  }

  private async startLabelAdd() {
    this.addingLabel = true;
    this.labelDraft = '';
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
      this.cancelLabelAdd();
    }
  }

  private saveLabelAdd() {
    const label = this.labelDraft.trim();
    if (!label) return;

    this.addingLabel = false;
    this.labelDraft = '';

    if (this.task.labels.includes(label)) return;
    this.dispatchTaskUpdate({ addLabels: [label] });
  }

  private cancelLabelAdd() {
    this.addingLabel = false;
    this.labelDraft = '';
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
    this.pickingAssignee = true;
    if (this.client) {
      try {
        this.availableUsers = await this.client.listUsers();
      } catch {
        this.availableUsers = [];
      }
    }
  }

  private cancelAssigneePick() {
    this.pickingAssignee = false;
    this.availableUsers = [];
  }

  private onAssigneeSelect(userId: string) {
    const currentIds = this.task.assignees.map((u) => u.id);
    if (currentIds.includes(userId)) return;
    this.pickingAssignee = false;
    this.availableUsers = [];
    this.dispatchTaskUpdate({ assigneeIds: [...currentIds, userId] });
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

  private renderDateRow(label: string, field: EditableDateField, value: string | undefined) {
    const isEditing = this.editingDate === field;

    return html`
      <div class="row">
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
          : html`
              <sl-icon-button
                name="plus-lg"
                label="Add assignee"
                @click=${this.startAssigneePick}
              ></sl-icon-button>
            `}
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

      ${this.renderDateRow('Due date', 'dueDate', t.dueDate)}

      ${this.renderDateRow('Start date', 'startDate', t.startDate)}

      <div class="row">
        <span class="label">Created</span>
        <span class="value">${formatDate(t.createdAt)}</span>
      </div>

      ${t.updatedAt
        ? html`<div class="row">
            <span class="label">Updated</span>
            <span class="value">${formatDate(t.updatedAt)}</span>
          </div>`
        : nothing}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ft-inspector-meta': FtInspectorMeta;
  }
}
