var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { LitElement, html, css } from 'lit';
import { customElement, query, state } from 'lit/decorators.js';
let FtNewCollectionDialog = class FtNewCollectionDialog extends LitElement {
    constructor() {
        super(...arguments);
        this.isCreating = false;
        this.errorMessage = '';
    }
    async show() {
        await this.updateComplete;
        await this.dialog.show();
        this.nameInput.focus();
    }
    close() {
        void this.dialog.hide();
    }
    setCreating(isCreating) {
        this.isCreating = isCreating;
    }
    setError(message) {
        this.errorMessage = message;
    }
    onCancel() {
        if (this.isCreating)
            return;
        this.close();
    }
    onCreateClick() {
        this.renderRoot.querySelector('form')?.requestSubmit();
    }
    onSubmit(e) {
        e.preventDefault();
        const name = this.nameInput.value.trim();
        this.nameInput.value = name;
        if (!this.nameInput.reportValidity())
            return;
        this.errorMessage = '';
        this.dispatchEvent(new CustomEvent('collection-create', {
            detail: { name },
            bubbles: true,
            composed: true,
        }));
    }
    onAfterHide() {
        this.isCreating = false;
        this.errorMessage = '';
        this.nameInput.value = '';
    }
    onRequestClose(e) {
        if (this.isCreating)
            e.preventDefault();
    }
    render() {
        return html `
      <sl-dialog
        label="New Collection"
        @sl-after-hide=${this.onAfterHide}
        @sl-request-close=${this.onRequestClose}
      >
        <form id="new-collection-form" @submit=${this.onSubmit}>
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
};
FtNewCollectionDialog.styles = css `
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
__decorate([
    query('sl-dialog')
], FtNewCollectionDialog.prototype, "dialog", void 0);
__decorate([
    query('sl-input[name="name"]')
], FtNewCollectionDialog.prototype, "nameInput", void 0);
__decorate([
    state()
], FtNewCollectionDialog.prototype, "isCreating", void 0);
__decorate([
    state()
], FtNewCollectionDialog.prototype, "errorMessage", void 0);
FtNewCollectionDialog = __decorate([
    customElement('ft-new-collection-dialog')
], FtNewCollectionDialog);
export { FtNewCollectionDialog };
//# sourceMappingURL=ft-new-collection-dialog.js.map