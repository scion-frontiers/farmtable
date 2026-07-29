var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { LitElement, html, css } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';
const MAX_IMPORT_SIZE = 50 * 1024 * 1024;
let FtImportCollectionDialog = class FtImportCollectionDialog extends LitElement {
    constructor() {
        super(...arguments);
        this.file = null;
        this.detectedFormat = null;
        this.preview = null;
        this.collectionName = '';
        this.loading = false;
        this.error = '';
        this.fileText = '';
    }
    async show() {
        await this.updateComplete;
        await this.dialog.show();
    }
    close() {
        void this.dialog.hide();
    }
    onChooseFile() {
        if (this.loading)
            return;
        this.fileInput.click();
    }
    async onFileChange() {
        const file = this.fileInput.files?.[0] ?? null;
        this.file = file;
        this.preview = null;
        this.collectionName = '';
        this.error = '';
        this.fileText = '';
        this.detectedFormat = null;
        if (!file)
            return;
        if (file.size > MAX_IMPORT_SIZE) {
            this.file = null;
            this.error = 'File too large. Maximum import size is 50 MB.';
            this.fileInput.value = '';
            return;
        }
        try {
            const text = await this.readFile(file);
            const isJsonl = file.name.endsWith('.jsonl');
            if (isJsonl) {
                this.parseAsBeadsJsonl(text, file.name);
            }
            else {
                // Native Farmtable JSON format. If JSON.parse fails, fall back
                // to trying JSONL parsing — the user may have renamed a .jsonl
                // file to .json.
                try {
                    const parsed = JSON.parse(text);
                    if (parsed.format_version !== 1) {
                        throw new Error('Unsupported collection export format.');
                    }
                    this.detectedFormat = 'farmtable';
                    const name = this.extractCollectionName(parsed);
                    const preview = {
                        name,
                        tasks: this.countArray(parsed.tasks ?? parsed.collection?.tasks),
                        comments: this.countArray(parsed.comments ?? parsed.collection?.comments),
                        relationships: this.countArray(parsed.relationships ?? parsed.collection?.relationships),
                    };
                    this.fileText = text;
                    this.preview = preview;
                    this.collectionName = name;
                }
                catch {
                    // JSON parse failed — try JSONL as a fallback for misnamed files.
                    this.parseAsBeadsJsonl(text, file.name);
                }
            }
        }
        catch (error) {
            this.file = null;
            this.preview = null;
            this.collectionName = '';
            this.fileText = '';
            this.detectedFormat = null;
            this.error = error instanceof Error ? error.message : 'Failed to read import file.';
            this.fileInput.value = '';
        }
    }
    readFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
            reader.onerror = () => reject(new Error('Failed to read selected file.'));
            reader.readAsText(file);
        });
    }
    extractCollectionName(parsed) {
        const name = parsed.collection?.name ?? parsed.name;
        return typeof name === 'string' && name.trim() ? name.trim() : 'Imported Collection';
    }
    countArray(value) {
        return Array.isArray(value) ? value.length : 0;
    }
    parseAsBeadsJsonl(text, fileName) {
        // Beads JSONL format: count non-empty lines for an approximate preview.
        // The server filters by _type so the actual count may be lower.
        const lines = text.split('\n').filter((l) => l.trim().length > 0);
        const issueCount = lines.length;
        if (issueCount === 0) {
            throw new Error('No issues found in JSONL file.');
        }
        this.detectedFormat = 'beads';
        const name = fileName.replace(/\.(jsonl|json)$/, '');
        this.fileText = text;
        this.preview = {
            name,
            tasks: issueCount,
            comments: 0,
            relationships: 0,
        };
        this.collectionName = name;
    }
    onNameInput(e) {
        const target = e.currentTarget;
        this.collectionName = target.value;
    }
    onCancel() {
        if (this.loading)
            return;
        this.close();
    }
    async onImportClick() {
        if (!this.preview || !this.fileText || this.loading)
            return;
        if (!this.client) {
            this.error = 'Service not available. Please reload.';
            return;
        }
        const name = this.collectionName.trim();
        this.nameInput.value = name;
        if (!this.nameInput.reportValidity())
            return;
        this.loading = true;
        this.error = '';
        try {
            const data = new TextEncoder().encode(this.fileText);
            const result = await this.client.importCollection(data, name, false);
            const message = this.successMessage(result.warnings);
            this.dispatchEvent(new CustomEvent('collection-import', {
                detail: { collectionId: result.collectionId, message },
                bubbles: true,
                composed: true,
            }));
        }
        catch (error) {
            this.error = 'Import failed: ' + (error instanceof Error ? error.message : 'Unknown error');
        }
        finally {
            this.loading = false;
        }
    }
    successMessage(warnings) {
        if (warnings.length === 0)
            return 'Collection imported successfully.';
        return 'Collection imported with warnings: ' + warnings.join(', ');
    }
    onAfterHide() {
        this.file = null;
        this.preview = null;
        this.collectionName = '';
        this.loading = false;
        this.error = '';
        this.fileText = '';
        this.detectedFormat = null;
        if (this.fileInput) {
            this.fileInput.value = '';
        }
    }
    onRequestClose(e) {
        if (this.loading)
            e.preventDefault();
    }
    render() {
        return html `
      <sl-dialog
        label="Import Collection"
        @sl-after-hide=${this.onAfterHide}
        @sl-request-close=${this.onRequestClose}
      >
        <form id="import-collection-form">
          ${this.error
            ? html `
                <sl-alert variant="danger" open>
                  <sl-icon slot="icon" name="exclamation-triangle"></sl-icon>
                  ${this.error}
                </sl-alert>
              `
            : null}
          <div class="file-row">
            <input
              type="file"
              accept=".json,.jsonl"
              ?disabled=${this.loading}
              @change=${this.onFileChange}
            >
            <sl-button ?disabled=${this.loading} @click=${this.onChooseFile}>
              Choose File
            </sl-button>
            <span class="file-name">${this.file?.name ?? 'No file selected'}</span>
          </div>
          <div style="color: var(--sl-color-neutral-500); font-size: var(--sl-font-size-small);">
            Supported formats: Farmtable export (.json), Beads issue export (.jsonl)
          </div>
          ${this.preview
            ? html `
                <div class="preview">
                  <div class="preview-title">
                    ${this.detectedFormat === 'beads'
                ? `Beads Import: ~${this.preview.tasks} issues (approx)`
                : `Collection: "${this.preview.name}"`}
                  </div>
                  <div class="preview-counts">
                    <span>${this.detectedFormat === 'beads' ? '~Issues (approx)' : 'Tasks'}: ${this.preview.tasks}</span>
                    ${this.detectedFormat !== 'beads'
                ? html `
                          <span>Comments: ${this.preview.comments}</span>
                          <span>Relationships: ${this.preview.relationships}</span>
                        `
                : null}
                  </div>
                </div>
              `
            : null}
          <sl-input
            name="name"
            label="Collection Name"
            required
            maxlength="255"
            autocomplete="off"
            .value=${this.collectionName}
            ?disabled=${this.loading || !this.preview}
            @sl-input=${this.onNameInput}
          ></sl-input>
        </form>
        <div class="actions" slot="footer">
          <sl-button ?disabled=${this.loading} @click=${this.onCancel}>
            Cancel
          </sl-button>
          <sl-button
            variant="primary"
            ?loading=${this.loading}
            ?disabled=${this.loading || !this.preview}
            @click=${this.onImportClick}
          >
            Import
          </sl-button>
        </div>
      </sl-dialog>
    `;
    }
};
FtImportCollectionDialog.styles = css `
    form {
      display: grid;
      gap: 1rem;
    }
    input[type="file"] {
      display: none;
    }
    .file-row {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      min-width: 0;
    }
    .file-name {
      color: var(--sl-color-neutral-700);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .preview {
      display: grid;
      gap: 0.5rem;
      padding: 0.75rem;
      border: 1px solid var(--sl-color-neutral-200);
      border-radius: var(--sl-border-radius-medium);
      background: var(--sl-color-neutral-50);
    }
    .preview-title {
      font-weight: 600;
    }
    .preview-counts {
      display: flex;
      flex-wrap: wrap;
      gap: 0.75rem;
      color: var(--sl-color-neutral-700);
    }
    .actions {
      display: flex;
      justify-content: flex-end;
      gap: 0.5rem;
    }
  `;
__decorate([
    property({ attribute: false })
], FtImportCollectionDialog.prototype, "client", void 0);
__decorate([
    query('sl-dialog')
], FtImportCollectionDialog.prototype, "dialog", void 0);
__decorate([
    query('input[type="file"]')
], FtImportCollectionDialog.prototype, "fileInput", void 0);
__decorate([
    query('sl-input[name="name"]')
], FtImportCollectionDialog.prototype, "nameInput", void 0);
__decorate([
    state()
], FtImportCollectionDialog.prototype, "file", void 0);
__decorate([
    state()
], FtImportCollectionDialog.prototype, "detectedFormat", void 0);
__decorate([
    state()
], FtImportCollectionDialog.prototype, "preview", void 0);
__decorate([
    state()
], FtImportCollectionDialog.prototype, "collectionName", void 0);
__decorate([
    state()
], FtImportCollectionDialog.prototype, "loading", void 0);
__decorate([
    state()
], FtImportCollectionDialog.prototype, "error", void 0);
FtImportCollectionDialog = __decorate([
    customElement('ft-import-collection-dialog')
], FtImportCollectionDialog);
export { FtImportCollectionDialog };
//# sourceMappingURL=ft-import-collection-dialog.js.map