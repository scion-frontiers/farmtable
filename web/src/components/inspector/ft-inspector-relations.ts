import { LitElement, html, css, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { Task, Relationship } from '../../gen/types.js';
import { RelationshipType } from '../../gen/types.js';
import type { TaskStore } from '../../store/task-store.js';
import { REL_GROUP_LABEL, REL_GROUP_ORDER } from './inspector-stage-utils.js';

@customElement('ft-inspector-relations')
export class FtInspectorRelations extends LitElement {
  static styles = css`
    :host {
      display: block;
    }
    .group-label {
      font-size: 0.75rem;
      font-weight: 600;
      color: var(--sl-color-neutral-500);
      text-transform: uppercase;
      letter-spacing: 0.04em;
      margin-bottom: 0.25rem;
      margin-top: 0.5rem;
    }
    .group-label:first-child {
      margin-top: 0;
    }
    .link {
      display: block;
      padding: 0.25rem 0.375rem;
      margin: 0.125rem 0;
      border-radius: 4px;
      font-size: 0.8125rem;
      color: var(--sl-color-primary-600);
      cursor: pointer;
      text-decoration: none;
    }
    .link:hover {
      background: var(--sl-color-neutral-100);
    }
  `;

  @property({ attribute: false })
  task!: Task;

  @property({ attribute: false })
  store!: TaskStore;

  private onClickRelation(taskId: string) {
    this.dispatchEvent(
      new CustomEvent('task-select', {
        detail: { taskId },
        bubbles: true,
        composed: true,
      }),
    );
  }

  render() {
    const rels = this.task.relationships;
    if (!rels || rels.length === 0) return nothing;

    const grouped = new Map<RelationshipType, Relationship[]>();
    for (const r of rels) {
      const list = grouped.get(r.type);
      if (list) list.push(r);
      else grouped.set(r.type, [r]);
    }

    return html`
      ${REL_GROUP_ORDER
        .filter((type) => grouped.has(type))
        .map((type) => {
          const group = grouped.get(type)!;
          return html`
            <div class="group-label">${REL_GROUP_LABEL[type]}</div>
            ${group.map((r) => {
              const target = this.store.getTask(r.targetTaskId);
              const label = target?.name ?? r.targetTaskId;
              return html`
                <span class="link" @click=${() => this.onClickRelation(r.targetTaskId)}>
                  ${label}
                </span>
              `;
            })}
          `;
        })}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ft-inspector-relations': FtInspectorRelations;
  }
}
