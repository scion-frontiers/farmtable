import { LitElement, html, css, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { Task } from '../../gen/types.js';

function formatDate(iso: string | undefined): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
}

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
  `;

  @property({ attribute: false })
  task!: Task;

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

      ${t.labels.length > 0
        ? html`<div class="row">
            <span class="label">Labels</span>
            <span class="value">
              <span class="labels">
                ${t.labels.map(
                  (l) => html`<sl-tag size="small" variant="neutral">${l}</sl-tag>`,
                )}
              </span>
            </span>
          </div>`
        : nothing}

      ${t.dueDate
        ? html`<div class="row">
            <span class="label">Due date</span>
            <span class="value">${formatDate(t.dueDate)}</span>
          </div>`
        : nothing}

      ${t.startDate
        ? html`<div class="row">
            <span class="label">Start date</span>
            <span class="value">${formatDate(t.startDate)}</span>
          </div>`
        : nothing}

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
