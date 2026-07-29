var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { LitElement, html, css } from 'lit';
import { customElement, query, state } from 'lit/decorators.js';
import { platformLabel } from '../util/platform-label.js';
let FtCollectionSettingsDialog = class FtCollectionSettingsDialog extends LitElement {
    constructor() {
        super(...arguments);
        this.isSaving = false;
        this.errorMessage = '';
    }
    async show(collection) {
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
    setSaving(isSaving) {
        this.isSaving = isSaving;
    }
    setError(message) {
        this.errorMessage = message;
    }
    onCancel() {
        if (this.isSaving)
            return;
        this.close();
    }
    onSaveClick() {
        this.renderRoot.querySelector('form')?.requestSubmit();
    }
    onSubmit(e) {
        e.preventDefault();
        if (!this.collection)
            return;
        const name = this.nameInput.value.trim();
        const description = this.descriptionTextarea.value.trim();
        this.nameInput.value = name;
        if (!this.nameInput.reportValidity())
            return;
        this.errorMessage = '';
        this.dispatchEvent(new CustomEvent('collection-update', {
            detail: { id: this.collection.id, name, description },
            bubbles: true,
            composed: true,
        }));
    }
    onAfterHide() {
        this.isSaving = false;
        this.errorMessage = '';
        this.collection = undefined;
    }
    onRequestClose(e) {
        if (this.isSaving)
            e.preventDefault();
    }
    render() {
        return html `
      <sl-dialog
        label="Collection Settings"
        @sl-after-hide=${this.onAfterHide}
        @sl-request-close=${this.onRequestClose}
      >
        <form id="collection-settings-form" @submit=${this.onSubmit}>
          ${this.errorMessage
            ? html `
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
};
FtCollectionSettingsDialog.styles = css `
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
__decorate([
    query('sl-dialog')
], FtCollectionSettingsDialog.prototype, "dialog", void 0);
__decorate([
    query('sl-input[name="name"]')
], FtCollectionSettingsDialog.prototype, "nameInput", void 0);
__decorate([
    query('sl-textarea[name="description"]')
], FtCollectionSettingsDialog.prototype, "descriptionTextarea", void 0);
__decorate([
    state()
], FtCollectionSettingsDialog.prototype, "collection", void 0);
__decorate([
    state()
], FtCollectionSettingsDialog.prototype, "isSaving", void 0);
__decorate([
    state()
], FtCollectionSettingsDialog.prototype, "errorMessage", void 0);
FtCollectionSettingsDialog = __decorate([
    customElement('ft-collection-settings-dialog')
], FtCollectionSettingsDialog);
export { FtCollectionSettingsDialog };
//# sourceMappingURL=ft-collection-settings-dialog.js.map