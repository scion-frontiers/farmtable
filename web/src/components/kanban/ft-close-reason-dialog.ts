import { LitElement, html, css } from 'lit';
import { customElement, query, state } from 'lit/decorators.js';
import type { TaskStage } from '../../gen/types.js';

export interface CloseReasonDetail {
  taskId: string;
  stage: TaskStage;
  reason: string;
}

type ShoelaceDialog = HTMLElement & {
  show(): Promise<void>;
  hide(): Promise<void>;
};

type ShoelaceTextarea = HTMLElement & {
  value: string;
  focus(): void;
};

@customElement('ft-close-reason-dialog')
export class FtCloseReasonDialog extends LitElement {
  static styles = css`
    form {
      display: grid;
      gap: 1rem;
    }
    sl-textarea::part(textarea) {
      min-height: 7rem;
    }
    .actions {
      display: flex;
      justify-content: flex-end;
      gap: 0.5rem;
    }
  `;

  @query('sl-dialog')
  private dialog!: ShoelaceDialog;

  @query('sl-textarea[name="reason"]')
  private reasonInput!: ShoelaceTextarea;

  @state()
  private taskId = '';

  @state()
  private stage: TaskStage | null = null;

  @state()
  private stageLabel = '';

  @state()
  private isClosing = false;

  @state()
  private errorMessage = '';

  async showFor(taskId: string, stage: TaskStage, stageLabel: string) {
    this.taskId = taskId;
    this.stage = stage;
    this.stageLabel = stageLabel;
    this.errorMessage = '';
    await this.updateComplete;
    this.reasonInput.value = '';
    await this.dialog.show();
    this.reasonInput.focus();
  }

  close() {
    void this.dialog.hide();
  }

  setClosing(isClosing: boolean) {
    this.isClosing = isClosing;
  }

  setError(message: string) {
    this.errorMessage = message;
  }

  private onCancel() {
    if (this.isClosing) return;
    this.close();
  }

  private onConfirmClick() {
    this.renderRoot.querySelector('form')?.requestSubmit();
  }

  private onSubmit(e: Event) {
    e.preventDefault();
    const reason = this.reasonInput.value.trim();
    this.reasonInput.value = reason;
    if (!reason) {
      this.errorMessage = 'Enter a reason before closing this task.';
      return;
    }
    if (!this.taskId || this.stage == null) return;
    this.errorMessage = '';
    this.dispatchEvent(
      new CustomEvent<CloseReasonDetail>('close-reason-submit', {
        detail: { taskId: this.taskId, stage: this.stage, reason },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private onAfterHide() {
    this.taskId = '';
    this.stage = null;
    this.stageLabel = '';
    this.isClosing = false;
    this.errorMessage = '';
    this.reasonInput.value = '';
  }

  private onRequestClose(e: Event) {
    if (this.isClosing) e.preventDefault();
  }

  render() {
    return html`
      <sl-dialog
        label=${this.stageLabel ? `Close as ${this.stageLabel}` : 'Close Task'}
        @sl-after-hide=${this.onAfterHide}
        @sl-request-close=${this.onRequestClose}
      >
        <form id="close-reason-form" @submit=${this.onSubmit}>
          ${this.errorMessage
            ? html`
                <sl-alert variant="danger" open>
                  <sl-icon slot="icon" name="exclamation-triangle"></sl-icon>
                  ${this.errorMessage}
                </sl-alert>
              `
            : null}
          <sl-textarea
            name="reason"
            label="Reason"
            required
            maxlength="1000"
            resize="vertical"
            ?disabled=${this.isClosing}
          ></sl-textarea>
        </form>
        <div class="actions" slot="footer">
          <sl-button ?disabled=${this.isClosing} @click=${this.onCancel}>
            Cancel
          </sl-button>
          <sl-button
            variant="primary"
            ?loading=${this.isClosing}
            ?disabled=${this.isClosing}
            @click=${this.onConfirmClick}
          >
            Close
          </sl-button>
        </div>
      </sl-dialog>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ft-close-reason-dialog': FtCloseReasonDialog;
  }
}
