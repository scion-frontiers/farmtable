import { LitElement, html, css } from 'lit';
import { customElement, query, state } from 'lit/decorators.js';

export interface CollectionCreateDetail {
  name: string;
}

type ShoelaceDialog = HTMLElement & {
  show(): Promise<void>;
  hide(): Promise<void>;
};

type ShoelaceInput = HTMLElement & {
  value: string;
  reportValidity(): boolean;
};

@customElement('ft-new-collection-dialog')
export class FtNewCollectionDialog extends LitElement {
  static styles = css`
    form {
      display: grid;
      gap: 1rem;
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

  @state()
  private isCreating = false;

  @state()
  private errorMessage = '';

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

    this.nameInput.value = name;
    if (!this.nameInput.reportValidity()) return;
    this.errorMessage = '';

    this.dispatchEvent(
      new CustomEvent<CollectionCreateDetail>('collection-create', {
        detail: { name },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private onAfterHide() {
    this.isCreating = false;
    this.errorMessage = '';
    this.nameInput.value = '';
  }

  private onRequestClose(e: Event) {
    if (this.isCreating) e.preventDefault();
  }

  render() {
    return html`
      <sl-dialog
        label="New Collection"
        @sl-after-hide=${this.onAfterHide}
        @sl-request-close=${this.onRequestClose}
      >
        <form id="new-collection-form" @submit=${this.onSubmit}>
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
            minlength="1"
            maxlength="255"
            autocomplete="off"
            ?disabled=${this.isCreating}
          ></sl-input>
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
    'ft-new-collection-dialog': FtNewCollectionDialog;
  }
}
