import { LitElement, html, css } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';
import type { TaskStage } from '../../gen/types.js';

export interface TaskCreateDetail {
  name: string;
  description?: string;
  stage?: TaskStage;
}

type ShoelaceDialog = HTMLElement & {
  show(): Promise<void>;
  hide(): Promise<void>;
};

type ShoelaceInput = HTMLElement & {
  value: string;
  reportValidity(): boolean;
};

@customElement('ft-add-task-dialog')
export class FtAddTaskDialog extends LitElement {
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

  @query('sl-input[name="name"]')
  private nameInput!: ShoelaceInput;

  @query('sl-textarea[name="description"]')
  private descriptionInput!: ShoelaceInput;

  @state()
  private isCreating = false;

  @state()
  private errorMessage = '';

  @property({ type: Number })
  targetStage: TaskStage | null = null;

  @property()
  targetStageLabel = '';

  async show() {
    await this.updateComplete;
    await this.dialog.show();
    this.nameInput.focus();
  }

  close() {
    void this.dialog.hide();
  }

  setCreating(isCreating: boolean) {
    this.isCreating = isCreating;
  }

  setError(message: string) {
    this.errorMessage = message;
  }

  setTarget(stage: TaskStage, label: string) {
    this.targetStage = stage;
    this.targetStageLabel = label;
  }

  private onCancel() {
    if (this.isCreating) return;
    this.close();
  }

  private onCreateClick() {
    this.renderRoot.querySelector('form')?.requestSubmit();
  }

  private onSubmit(e: Event) {
    e.preventDefault();
    const name = this.nameInput.value.trim();
    const description = this.descriptionInput.value.trim();

    this.nameInput.value = name;
    if (!this.nameInput.reportValidity()) return;
    this.errorMessage = '';

    this.dispatchEvent(
      new CustomEvent<TaskCreateDetail>('task-create', {
        detail: {
          name,
          description: description || undefined,
          stage: this.targetStage ?? undefined,
        },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private onAfterHide() {
    this.isCreating = false;
    this.errorMessage = '';
    this.targetStage = null;
    this.targetStageLabel = '';
    this.nameInput.value = '';
    this.descriptionInput.value = '';
  }

  private onRequestClose(e: Event) {
    if (this.isCreating) e.preventDefault();
  }

  render() {
    return html`
      <sl-dialog
        label=${this.targetStage != null ? `Add Task to ${this.targetStageLabel}` : 'Add Task'}
        @sl-after-hide=${this.onAfterHide}
        @sl-request-close=${this.onRequestClose}
      >
        <form id="add-task-form" @submit=${this.onSubmit}>
          ${this.errorMessage
            ? html`
                <sl-alert variant="danger" open>
                  <sl-icon slot="icon" name="exclamation-triangle"></sl-icon>
                  ${this.errorMessage}
                </sl-alert>
              `
            : null}
          <sl-input
            name="name"
            label="Name"
            required
            maxlength="255"
            autocomplete="off"
            ?disabled=${this.isCreating}
          ></sl-input>
          <sl-textarea
            name="description"
            label="Description"
            maxlength="10000"
            resize="vertical"
            ?disabled=${this.isCreating}
          ></sl-textarea>
        </form>
        <div class="actions" slot="footer">
          <sl-button ?disabled=${this.isCreating} @click=${this.onCancel}>
            Cancel
          </sl-button>
          <sl-button
            variant="primary"
            ?loading=${this.isCreating}
            ?disabled=${this.isCreating}
            @click=${this.onCreateClick}
          >
            Create
          </sl-button>
        </div>
      </sl-dialog>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ft-add-task-dialog': FtAddTaskDialog;
  }
}
