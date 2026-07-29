import { LitElement, html, css } from 'lit';
import { customElement, query, state } from 'lit/decorators.js';
import type { Collection } from '../gen/types.js';
import { platformLabel } from '../util/platform-label.js';

export interface CollectionUpdateDetail {
  id: string;
  name: string;
  description?: string;
}

type ShoelaceDialog = HTMLElement & {
  show(): Promise<void>;
  hide(): Promise<void>;
};

type ShoelaceInput = HTMLElement & {
  value: string;
  focus(): void;
  reportValidity(): boolean;
};

type ShoelaceTextarea = HTMLElement & {
  value: string;
};

@customElement('ft-collection-settings-dialog')
export class FtCollectionSettingsDialog extends LitElement {
  static styles = css`
    form {
      display: grid;
      gap: 1rem;
    }
    .platform-field {
      display: grid;
      gap: 0.25rem;
    }
    .platform-label {
      color: var(--sl-input-label-color);
      font-size: var(--sl-input-label-font-size-medium);
      font-weight: var(--sl-input-label-font-weight);
    }
    .platform-value {
      min-height: var(--sl-input-height-medium);
      display: flex;
      align-items: center;
      padding: 0 var(--sl-input-spacing-medium);
      border: solid var(--sl-input-border-width) var(--sl-input-border-color);
      border-radius: var(--sl-input-border-radius-medium);
      background: var(--sl-color-neutral-50);
      color: var(--sl-color-neutral-700);
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
  private descriptionTextarea!: ShoelaceTextarea;

  @state()
  private collection?: Collection;

  @state()
  private isSaving = false;

  @state()
  private errorMessage = '';

  async show(collection: Collection) {
    this.collection = collection;
    this.errorMessage = '';
    await this.updateComplete;
    this.nameInput.value = collection.name;
    this.descriptionTextarea.value = collection.description ?? '';
    await this.dialog.show();
    this.nameInput.focus();
  }

  close() {
    void this.dialog.hide();
  }

  setSaving(isSaving: boolean) {
    this.isSaving = isSaving;
  }

  setError(message: string) {
    this.errorMessage = message;
  }

  private onCancel() {
    if (this.isSaving) return;
    this.close();
  }

  private onSaveClick() {
    this.renderRoot.querySelector('form')?.requestSubmit();
  }

  private onSubmit(e: Event) {
    e.preventDefault();
    if (!this.collection) return;

    const name = this.nameInput.value.trim();
    const description = this.descriptionTextarea.value.trim();

    this.nameInput.value = name;
    if (!this.nameInput.reportValidity()) return;
    this.errorMessage = '';

    this.dispatchEvent(
      new CustomEvent<CollectionUpdateDetail>('collection-update', {
        detail: { id: this.collection.id, name, description },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private onAfterHide() {
    this.isSaving = false;
    this.errorMessage = '';
    this.collection = undefined;
  }

  private onRequestClose(e: Event) {
    if (this.isSaving) e.preventDefault();
  }

  render() {
    return html`
      <sl-dialog
        label="Collection Settings"
        @sl-after-hide=${this.onAfterHide}
        @sl-request-close=${this.onRequestClose}
      >
        <form id="collection-settings-form" @submit=${this.onSubmit}>
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
            value=${this.collection?.name ?? ''}
            ?disabled=${this.isSaving}
          ></sl-input>
          <sl-textarea
            name="description"
            label="Description"
            value=${this.collection?.description ?? ''}
            ?disabled=${this.isSaving}
          ></sl-textarea>
          <div class="platform-field">
            <span class="platform-label">Platform</span>
            <span class="platform-value">${this.collection ? platformLabel(this.collection.platform) : ''}</span>
          </div>
        </form>
        <div class="actions" slot="footer">
          <sl-button ?disabled=${this.isSaving} @click=${this.onCancel}>
            Cancel
          </sl-button>
          <sl-button
            variant="primary"
            ?loading=${this.isSaving}
            ?disabled=${this.isSaving}
            @click=${this.onSaveClick}
          >
            Save
          </sl-button>
        </div>
      </sl-dialog>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ft-collection-settings-dialog': FtCollectionSettingsDialog;
  }
}
