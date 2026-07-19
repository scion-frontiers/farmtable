import { LitElement, html, css } from 'lit';
import { customElement, query, state } from 'lit/decorators.js';

export interface TaskCreateDetail {
  name: string;
  description?: string;
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

  private onCancel() {
    if (this.isCreating) return;
    this.close();
  }

  private onSubmit(e: Event) {
    e.preventDefault();
    const name = this.nameInput.value.trim();
    const description = this.descriptionInput.value.trim();

    this.nameInput.value = name;
    if (!this.nameInput.reportValidity()) return;

    this.dispatchEvent(
      new CustomEvent<TaskCreateDetail>('task-create', {
        detail: { name, description: description || undefined },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private onAfterHide() {
    this.isCreating = false;
    this.nameInput.value = '';
    this.descriptionInput.value = '';
  }

  render() {
    return html`
      <sl-dialog label="Add Task" @sl-after-hide=${this.onAfterHide}>
        <form @submit=${this.onSubmit}>
          <sl-input
            name="name"
            label="Name"
            required
            autocomplete="off"
            ?disabled=${this.isCreating}
          ></sl-input>
          <sl-textarea
            name="description"
            label="Description"
            resize="vertical"
            ?disabled=${this.isCreating}
          ></sl-textarea>
          <div class="actions" slot="footer">
            <sl-button ?disabled=${this.isCreating} @click=${this.onCancel}>
              Cancel
            </sl-button>
            <sl-button
              type="submit"
              variant="primary"
              ?loading=${this.isCreating}
              ?disabled=${this.isCreating}
            >
              Create
            </sl-button>
          </div>
        </form>
      </sl-dialog>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ft-add-task-dialog': FtAddTaskDialog;
  }
}
