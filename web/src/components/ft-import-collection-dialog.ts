import { LitElement, html, css } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';
import type { GrpcFarmTableClient } from '../gen/grpc-client.js';

export interface CollectionImportDetail {
  collectionId: string;
  message: string;
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

type CollectionExportJson = {
  format_version?: unknown;
  name?: unknown;
  collection?: {
    name?: unknown;
    tasks?: unknown;
    comments?: unknown;
    relationships?: unknown;
  };
  tasks?: unknown;
  comments?: unknown;
  relationships?: unknown;
};

@customElement('ft-import-collection-dialog')
export class FtImportCollectionDialog extends LitElement {
  static styles = css`
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

  @property({ attribute: false }) client: any;

  @query('sl-dialog')
  private dialog!: ShoelaceDialog;

  @query('input[type="file"]')
  private fileInput!: HTMLInputElement;

  @query('sl-input[name="name"]')
  private nameInput!: ShoelaceInput;

  @state()
  private open = false;

  @state()
  private file: File | null = null;

  @state()
  private preview: { name: string; tasks: number; comments: number; relationships: number } | null = null;

  @state()
  private collectionName = '';

  @state()
  private loading = false;

  @state()
  private error = '';

  private fileText = '';

  async show() {
    this.open = true;
    await this.updateComplete;
    await this.dialog.show();
  }

  close() {
    void this.dialog.hide();
  }

  private onChooseFile() {
    if (this.loading) return;
    this.fileInput.click();
  }

  private async onFileChange() {
    const file = this.fileInput.files?.[0] ?? null;
    this.file = file;
    this.preview = null;
    this.collectionName = '';
    this.error = '';
    this.fileText = '';

    if (!file) return;

    try {
      const text = await this.readFile(file);
      const parsed = JSON.parse(text) as CollectionExportJson;

      if (parsed.format_version !== 1) {
        throw new Error('Unsupported collection export format.');
      }

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
    } catch (error) {
      this.file = null;
      this.preview = null;
      this.collectionName = '';
      this.fileText = '';
      this.error = error instanceof Error ? error.message : 'Failed to read collection export.';
      this.fileInput.value = '';
    }
  }

  private readFile(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
      reader.onerror = () => reject(new Error('Failed to read selected file.'));
      reader.readAsText(file);
    });
  }

  private extractCollectionName(parsed: CollectionExportJson): string {
    const name = parsed.collection?.name ?? parsed.name;
    return typeof name === 'string' && name.trim() ? name.trim() : 'Imported Collection';
  }

  private countArray(value: unknown): number {
    return Array.isArray(value) ? value.length : 0;
  }

  private onNameInput(e: Event) {
    const target = e.currentTarget as HTMLElement & { value: string };
    this.collectionName = target.value;
  }

  private onCancel() {
    if (this.loading) return;
    this.close();
  }

  private async onImportClick() {
    if (!this.preview || !this.fileText || this.loading) return;
    if (!this.client) {
      this.error = 'Service not available. Please reload.';
      return;
    }

    const name = this.collectionName.trim();
    this.nameInput.value = name;
    if (!this.nameInput.reportValidity()) return;

    this.loading = true;
    this.error = '';
    try {
      const data = new TextEncoder().encode(this.fileText);
      const grpcClient = this.client as GrpcFarmTableClient;
      const result = await grpcClient.importCollection(data, name, false);
      const message = this.successMessage(result.warnings);

      this.dispatchEvent(
        new CustomEvent<CollectionImportDetail>('collection-import', {
          detail: { collectionId: result.collectionId, message },
          bubbles: true,
          composed: true,
        }),
      );
    } catch (error) {
      this.error = 'Import failed: ' + (error instanceof Error ? error.message : 'Unknown error');
    } finally {
      this.loading = false;
    }
  }

  private successMessage(warnings: string[]): string {
    if (warnings.length === 0) return 'Collection imported successfully.';
    return 'Collection imported with warnings: ' + warnings.join(', ');
  }

  private onAfterHide() {
    this.open = false;
    this.file = null;
    this.preview = null;
    this.collectionName = '';
    this.loading = false;
    this.error = '';
    this.fileText = '';
    if (this.fileInput) {
      this.fileInput.value = '';
    }
  }

  private onRequestClose(e: Event) {
    if (this.loading) e.preventDefault();
  }

  render() {
    return html`
      <sl-dialog
        label="Import Collection"
        ?open=${this.open}
        @sl-after-hide=${this.onAfterHide}
        @sl-request-close=${this.onRequestClose}
      >
        <form id="import-collection-form">
          ${this.error
            ? html`
                <sl-alert variant="danger" open>
                  <sl-icon slot="icon" name="exclamation-triangle"></sl-icon>
                  ${this.error}
                </sl-alert>
              `
            : null}
          <div class="file-row">
            <input
              type="file"
              accept=".json"
              ?disabled=${this.loading}
              @change=${this.onFileChange}
            >
            <sl-button ?disabled=${this.loading} @click=${this.onChooseFile}>
              Choose JSON
            </sl-button>
            <span class="file-name">${this.file?.name ?? 'No file selected'}</span>
          </div>
          ${this.preview
            ? html`
                <div class="preview">
                  <div class="preview-title">Collection: "${this.preview.name}"</div>
                  <div class="preview-counts">
                    <span>Tasks: ${this.preview.tasks}</span>
                    <span>Comments: ${this.preview.comments}</span>
                    <span>Relationships: ${this.preview.relationships}</span>
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
}

declare global {
  interface HTMLElementTagNameMap {
    'ft-import-collection-dialog': FtImportCollectionDialog;
  }
}
