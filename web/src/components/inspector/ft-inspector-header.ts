import { LitElement, html, css, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { Task } from '../../gen/types.js';
import { TaskPhase, TaskStage, TaskPriority } from '../../gen/types.js';

const PHASE_LABEL: Record<number, string> = {
  [TaskPhase.OPEN]: 'Open',
  [TaskPhase.IN_PROGRESS]: 'In Progress',
  [TaskPhase.ON_HOLD]: 'On Hold',
  [TaskPhase.CLOSED]: 'Closed',
};

const STAGE_LABEL: Record<number, string> = {
  [TaskStage.TRIAGE]: 'Triage',
  [TaskStage.BACKLOG]: 'Backlog',
  [TaskStage.READY]: 'Ready',
  [TaskStage.WORKING]: 'Working',
  [TaskStage.IN_REVIEW]: 'In Review',
  [TaskStage.IN_QA]: 'In QA',
  [TaskStage.DEPLOYING]: 'Deploying',
  [TaskStage.BLOCKED]: 'Blocked',
  [TaskStage.WAITING_FOR_INPUT]: 'Waiting',
  [TaskStage.DEFERRED]: 'Deferred',
  [TaskStage.SCHEDULED]: 'Scheduled',
  [TaskStage.COMPLETED]: 'Completed',
  [TaskStage.WONT_FIX]: "Won't Fix",
  [TaskStage.DUPLICATE]: 'Duplicate',
  [TaskStage.CANCELLED]: 'Cancelled',
};

const STAGE_COLOR: Record<number, string> = {
  [TaskStage.TRIAGE]: 'var(--ft-stage-triage)',
  [TaskStage.BACKLOG]: 'var(--ft-stage-backlog)',
  [TaskStage.READY]: 'var(--ft-stage-ready)',
  [TaskStage.WORKING]: 'var(--ft-stage-working)',
  [TaskStage.IN_REVIEW]: 'var(--ft-stage-in-review)',
  [TaskStage.IN_QA]: 'var(--ft-stage-in-qa)',
  [TaskStage.DEPLOYING]: 'var(--ft-stage-deploying)',
  [TaskStage.BLOCKED]: 'var(--ft-stage-blocked)',
  [TaskStage.COMPLETED]: 'var(--ft-stage-completed)',
  [TaskStage.CANCELLED]: 'var(--ft-stage-cancelled)',
};

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

@customElement('ft-inspector-header')
export class FtInspectorHeader extends LitElement {
  static styles = css`
    :host {
      display: block;
    }
    .title {
      font-size: 1.125rem;
      font-weight: 600;
      line-height: 1.4;
      margin-bottom: 0.75rem;
      word-break: break-word;
    }
    .badges {
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
      align-items: center;
    }
    .stage-badge {
      display: inline-flex;
      align-items: center;
      padding: 0.15rem 0.5rem;
      border-radius: 9999px;
      font-size: 0.75rem;
      font-weight: 500;
      color: #fff;
    }
  `;

  @property({ attribute: false })
  task!: Task;

  render() {
    const t = this.task;
    const phaseLabel = PHASE_LABEL[t.phase] ?? '';
    const stageLabel = STAGE_LABEL[t.stage] ?? '';
    const stageColor = STAGE_COLOR[t.stage] ?? 'var(--sl-color-neutral-500)';
    const priorityVariant = PRIORITY_VARIANT[t.priority ?? 0] ?? 'neutral';
    const priorityLabel = PRIORITY_LABEL[t.priority ?? 0];

    return html`
      <div class="title">${t.name}</div>
      <div class="badges">
        ${phaseLabel
          ? html`<sl-badge variant="neutral">${phaseLabel}</sl-badge>`
          : nothing}
        ${stageLabel
          ? html`<span class="stage-badge" style="background:${stageColor}">${stageLabel}</span>`
          : nothing}
        ${priorityLabel
          ? html`<sl-badge variant=${priorityVariant} pill>${priorityLabel}</sl-badge>`
          : nothing}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ft-inspector-header': FtInspectorHeader;
  }
}
