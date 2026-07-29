var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { LitElement, html, css } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';
let FtAddTaskDialog = class FtAddTaskDialog extends LitElement {
    constructor() {
        super(...arguments);
        this.isCreating = false;
        this.errorMessage = '';
        this.targetStage = null;
        this.targetStageLabel = '';
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
    setTarget(stage, label) {
        this.targetStage = stage;
        this.targetStageLabel = label;
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
        const description = this.descriptionInput.value.trim();
        this.nameInput.value = name;
        if (!this.nameInput.reportValidity())
            return;
        this.errorMessage = '';
        this.dispatchEvent(new CustomEvent('task-create', {
            detail: {
                name,
                description: description || undefined,
                stage: this.targetStage ?? undefined,
            },
            bubbles: true,
            composed: true,
        }));
    }
    onAfterHide() {
        this.isCreating = false;
        this.errorMessage = '';
        this.targetStage = null;
        this.targetStageLabel = '';
        this.nameInput.value = '';
        this.descriptionInput.value = '';
    }
    onRequestClose(e) {
        if (this.isCreating)
            e.preventDefault();
    }
    render() {
        return html `
      <sl-dialog
        label=${this.targetStage != null ? `Add Task to ${this.targetStageLabel}` : 'Add Task'}
        @sl-after-hide=${this.onAfterHide}
        @sl-request-close=${this.onRequestClose}
      >
        <form id="add-task-form" @submit=${this.onSubmit}>
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
};
FtAddTaskDialog.styles = css `
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
__decorate([
    query('sl-dialog')
], FtAddTaskDialog.prototype, "dialog", void 0);
__decorate([
    query('sl-input[name="name"]')
], FtAddTaskDialog.prototype, "nameInput", void 0);
__decorate([
    query('sl-textarea[name="description"]')
], FtAddTaskDialog.prototype, "descriptionInput", void 0);
__decorate([
    state()
], FtAddTaskDialog.prototype, "isCreating", void 0);
__decorate([
    state()
], FtAddTaskDialog.prototype, "errorMessage", void 0);
__decorate([
    property({ type: Number })
], FtAddTaskDialog.prototype, "targetStage", void 0);
__decorate([
    property()
], FtAddTaskDialog.prototype, "targetStageLabel", void 0);
FtAddTaskDialog = __decorate([
    customElement('ft-add-task-dialog')
], FtAddTaskDialog);
export { FtAddTaskDialog };
//# sourceMappingURL=ft-add-task-dialog.js.map