var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { renderMarkdown } from '../../util/markdown.js';
import { iconButtonFocusStyles } from './inspector-shared-styles.js';
let FtInspectorDesc = class FtInspectorDesc extends LitElement {
    constructor() {
        super(...arguments);
        this.taskId = '';
        this.hideTitle = false;
        this.readOnly = false;
        this.isEditing = false;
        this.draft = '';
        this.onDocumentPointerDown = (e) => {
            if (!this.isEditing)
                return;
            if (e.composedPath().includes(this))
                return;
            this.cancelEdit();
        };
    }
    willUpdate(changedProps) {
        // taskId is a string primitive; Lit's equality check detects identity changes directly.
        if (changedProps.has('taskId')) {
            this.resetEditState();
        }
    }
    disconnectedCallback() {
        super.disconnectedCallback();
        this.removeDismissListener();
    }
    async startEdit() {
        if (this.readOnly)
            return;
        this.draft = this.description ?? '';
        this.isEditing = true;
        this.addDismissListener();
        await this.updateComplete;
        this.renderRoot.querySelector('sl-textarea')?.focus();
    }
    onDraftInput(e) {
        this.draft = e.currentTarget.value;
    }
    onKeyDown(e) {
        if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            this.cancelEdit();
        }
        else if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
            e.preventDefault();
            this.saveEdit();
        }
    }
    saveEdit() {
        const nextDescription = this.draft.trim();
        this.isEditing = false;
        this.removeDismissListener();
        if (nextDescription === (this.description ?? '').trim())
            return;
        this.dispatchTaskUpdate({ description: nextDescription });
    }
    cancelEdit() {
        this.draft = this.description ?? '';
        this.isEditing = false;
        this.removeDismissListener();
    }
    resetEditState() {
        this.isEditing = false;
        this.draft = '';
        this.removeDismissListener();
    }
    addDismissListener() {
        document.addEventListener('pointerdown', this.onDocumentPointerDown, { capture: true });
    }
    removeDismissListener() {
        document.removeEventListener('pointerdown', this.onDocumentPointerDown, { capture: true });
    }
    dispatchTaskUpdate(fields) {
        this.dispatchEvent(new CustomEvent('task-update', {
            detail: { taskId: this.taskId, fields },
            bubbles: true,
            composed: true,
        }));
    }
    render() {
        if (this.isEditing) {
            return html `
        <div class="section-header">
          ${this.hideTitle ? nothing : html `<span class="section-title">Description</span>`}
          <span class="actions">
            <sl-icon-button
              name="check2"
              label="Save description"
              @click=${this.saveEdit}
            ></sl-icon-button>
            <sl-icon-button
              name="x-lg"
              label="Cancel description edit"
              @click=${this.cancelEdit}
            ></sl-icon-button>
          </span>
        </div>
        <sl-textarea
          rows="7"
          resize="auto"
          value=${this.draft}
          @input=${this.onDraftInput}
          @keydown=${this.onKeyDown}
        ></sl-textarea>
      `;
        }
        if (!this.description) {
            return html `
        <div class="section-header">
          ${this.hideTitle ? nothing : html `<span class="section-title">Description</span>`}
          ${this.readOnly ? nothing : html `<sl-icon-button
            name="pencil"
            label="Edit description"
            @click=${this.startEdit}
          ></sl-icon-button>`}
        </div>
        <span class="empty" @click=${this.readOnly ? undefined : this.startEdit}>No description</span>
      `;
        }
        return html `
      <div class="section-header">
        ${this.hideTitle ? nothing : html `<span class="section-title">Description</span>`}
        ${this.readOnly ? nothing : html `<sl-icon-button
          name="pencil"
          label="Edit description"
          @click=${this.startEdit}
        ></sl-icon-button>`}
      </div>
      <div class="content" @dblclick=${this.readOnly ? undefined : this.startEdit}>
        <!-- renderMarkdown sanitizes with DOMPurify before this HTML is injected. -->
        ${unsafeHTML(renderMarkdown(this.description))}
      </div>
    `;
    }
};
FtInspectorDesc.styles = [
    iconButtonFocusStyles,
    css `
    :host {
      display: block;
    }
    .section-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
      margin-bottom: 0.5rem;
    }
    .section-title {
      color: var(--sl-color-neutral-500);
      font-size: 0.75rem;
      font-weight: 600;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }
    .actions {
      display: flex;
      align-items: center;
      gap: 0.25rem;
      margin-left: auto;
    }
    .section-header > sl-icon-button {
      margin-left: auto;
    }
    .content {
      font-size: 0.875rem;
      line-height: 1.6;
      color: var(--sl-color-neutral-700);
      cursor: text;
    }
    .content p {
      margin: 0 0 0.5rem;
    }
    .content p:last-child {
      margin-bottom: 0;
    }
    .content code {
      background: var(--sl-color-neutral-100);
      padding: 0.1em 0.3em;
      border-radius: 3px;
      font-size: 0.85em;
    }
    .content pre {
      background: var(--sl-color-neutral-100);
      padding: 0.75rem;
      border-radius: 4px;
      overflow-x: auto;
    }
    .content a {
      color: var(--sl-color-primary-600);
    }
    .empty {
      color: var(--sl-color-neutral-400);
      font-style: italic;
      font-size: 0.875rem;
      cursor: text;
    }
    sl-textarea {
      --sl-input-font-size-medium: 0.875rem;
    }
  `,
];
__decorate([
    property()
], FtInspectorDesc.prototype, "description", void 0);
__decorate([
    property()
], FtInspectorDesc.prototype, "taskId", void 0);
__decorate([
    property({ type: Boolean, attribute: 'hide-title' })
], FtInspectorDesc.prototype, "hideTitle", void 0);
__decorate([
    property({ type: Boolean })
], FtInspectorDesc.prototype, "readOnly", void 0);
__decorate([
    property({ attribute: false })
], FtInspectorDesc.prototype, "capabilities", void 0);
__decorate([
    state()
], FtInspectorDesc.prototype, "isEditing", void 0);
__decorate([
    state()
], FtInspectorDesc.prototype, "draft", void 0);
FtInspectorDesc = __decorate([
    customElement('ft-inspector-desc')
], FtInspectorDesc);
export { FtInspectorDesc };
//# sourceMappingURL=ft-inspector-desc.js.map