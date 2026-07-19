import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { Task } from '../../gen/types.js';
import type { UpdateTaskFields } from '../../gen/service.js';
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
  `;

  @property({ attribute: false })
  task!: Task;

  @state()
  private editingDate: EditableDateField | null = null;

  @state()
  private dateDraft = '';

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
                    value=${this.dateDraft}
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

  render() {
    const t = this.task;

    return html`
      <div class="row">
        <span class="label">Assignees</span>
        <span class="value">
          ${t.assignees.length > 0
            ? html`<span class="assignees">
                ${t.assignees.map(
                  (u) => html`
                    <span class="assignee">
                      <sl-avatar
                        initials=${u.name.slice(0, 2)}
                        label=${u.name}
                        style="--size: 1.4rem; font-size: 0.55rem;"
                      ></sl-avatar>
                      ${u.name}
                    </span>
                  `,
                )}
              </span>`
            : html`<span class="empty">Unassigned</span>`}
        </span>
      </div>

      ${t.type
        ? html`<div class="row">
            <span class="label">Type</span>
            <span class="value">${t.type}</span>
          </div>`
        : nothing}

      <div class="row">
        <span class="label">Labels</span>
        <span class="value">
          ${t.labels.length > 0
            ? html`
              <span class="labels">
                ${t.labels.map(
                  (l) => html`<sl-tag size="small" variant="neutral">${l}</sl-tag>`,
                )}
              </span>
            `
            : html`<span class="empty">None</span>`}
        </span>
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
