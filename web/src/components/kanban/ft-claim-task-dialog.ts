import { LitElement, html, css } from 'lit';
import { customElement, query, state } from 'lit/decorators.js';
import type { Task } from '../../gen/types.js';

export interface ClaimTaskDetail {
  taskId: string;
}

type ShoelaceDialog = HTMLElement & {
  show(): Promise<void>;
  hide(): Promise<void>;
};

@customElement('ft-claim-task-dialog')
export class FtClaimTaskDialog extends LitElement {
  static styles = css`
    .body {
      display: grid;
      gap: 0.75rem;
    }
    .task-name {
      font-weight: 600;
    }
    .actions {
      display: flex;
      justify-content: flex-end;
      gap: 0.5rem;
    }
  `;

  @query('sl-dialog')
  private dialog!: ShoelaceDialog;

  @state()
  private taskId = '';

  @state()
  private taskName = '';

  @state()
  private isClaiming = false;

  @state()
  private errorMessage = '';

  async showFor(task: Task) {
    this.taskId = task.id;
    this.taskName = task.name;
    this.errorMessage = '';
    await this.updateComplete;
    await this.dialog.show();
  }

  close() {
    void this.dialog.hide();
  }

  setClaiming(isClaiming: boolean) {
    this.isClaiming = isClaiming;
  }

  setError(message: string) {
    this.errorMessage = message;
  }

  private onCancel() {
    if (this.isClaiming) return;
    this.close();
  }

  private onConfirmClick() {
    if (!this.taskId) return;
    this.errorMessage = '';
    this.dispatchEvent(
      new CustomEvent<ClaimTaskDetail>('claim-task-submit', {
        detail: { taskId: this.taskId },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private onAfterHide() {
    this.taskId = '';
    this.taskName = '';
    this.isClaiming = false;
    this.errorMessage = '';
  }

  private onRequestClose(e: Event) {
    if (this.isClaiming) e.preventDefault();
  }

  render() {
    return html`
      <sl-dialog
        label="Claim Task"
        @sl-after-hide=${this.onAfterHide}
        @sl-request-close=${this.onRequestClose}
      >
        <div class="body">
          ${this.errorMessage
            ? html`
                <sl-alert variant="danger" open>
                  <sl-icon slot="icon" name="exclamation-triangle"></sl-icon>
                  ${this.errorMessage}
                </sl-alert>
              `
            : null}
          <div>
            Claim <span class="task-name">${this.taskName}</span> and move it to Working?
          </div>
          <div>
            Claiming assigns the task to you and starts work.
          </div>
        </div>
        <div class="actions" slot="footer">
          <sl-button ?disabled=${this.isClaiming} @click=${this.onCancel}>
            Cancel
          </sl-button>
          <sl-button
            variant="primary"
            ?loading=${this.isClaiming}
            ?disabled=${this.isClaiming}
            @click=${this.onConfirmClick}
          >
            Claim
          </sl-button>
        </div>
      </sl-dialog>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ft-claim-task-dialog': FtClaimTaskDialog;
  }
}
