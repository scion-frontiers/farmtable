var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { LitElement, css, html } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';
import { Platform } from '../gen/types.js';
import { platformIcon, platformLabel } from '../util/platform-label.js';
import './ft-new-collection-dialog.js';
let FtCollectionList = class FtCollectionList extends LitElement {
    constructor() {
        super(...arguments);
        this.errorMessage = '';
        this.collections = [];
        this.isLoading = true;
        this.loadError = '';
        this.loadToken = 0;
    }
    updated(changedProperties) {
        if (changedProperties.has('client') && this.client !== changedProperties.get('client')) {
            void this.loadCollections();
        }
    }
    render() {
        return html `
      <main class="shell">
        <div class="header">
          <div class="header-text">
            <h1>Select a collection</h1>
            <p class="lede">Choose which collection to open.</p>
          </div>
          <sl-button variant="primary" @click=${this.onNewProjectClick}>
            <sl-icon slot="prefix" name="plus-lg"></sl-icon>
            New Project
          </sl-button>
        </div>

        <!-- Shoelace renders sl-alert with role="alert" internally. -->
        ${this.errorMessage
            ? html `<sl-alert variant="warning" open>${this.errorMessage}</sl-alert>`
            : null}
        ${this.loadError
            ? html `<sl-alert variant="danger" open>${this.loadError}</sl-alert>`
            : null}

        ${this.isLoading
            ? html `<div class="loading"><sl-spinner></sl-spinner> Loading collections</div>`
            : this.collections.length === 0
                ? html `<div class="empty">No collections are available.</div>`
                : html `
                <div class="list">
                  ${this.collections.map((collection) => {
                    const isExternal = collection.platform !== Platform.FARMTABLE;
                    return html `
                      <button
                        class="collection"
                        type="button"
                        @click=${() => this.selectCollection(collection)}
                      >
                        <span class="name">${collection.name}</span>
                        <span class="meta">
                          <sl-icon name=${platformIcon(collection.platform)} aria-hidden="true"></sl-icon>
                          ${isExternal && collection.remoteId
                        ? html `${platformLabel(collection.platform)}: ${collection.remoteId}`
                        : platformLabel(collection.platform)}
                        </span>
                      </button>
                    `;
                })}
                </div>
              `}

        <ft-new-collection-dialog
          @collection-create=${this.onCollectionCreate}
        ></ft-new-collection-dialog>
      </main>
    `;
    }
    async loadCollections() {
        if (!this.client)
            return;
        const token = ++this.loadToken;
        this.isLoading = true;
        this.loadError = '';
        try {
            const collections = await this.client.listCollections();
            if (token === this.loadToken) {
                this.collections = collections;
            }
        }
        catch (error) {
            if (token === this.loadToken) {
                this.collections = [];
                this.loadError = 'Unable to load collections.';
            }
            console.warn('Failed to load collections', error);
        }
        finally {
            if (token === this.loadToken) {
                this.isLoading = false;
            }
        }
    }
    async onNewProjectClick() {
        await this.newCollectionDialog.show();
    }
    async onCollectionCreate(e) {
        const dialog = this.newCollectionDialog;
        if (!this.client) {
            dialog.setError('Service not available. Please reload.');
            return;
        }
        dialog.setError('');
        dialog.setCreating(true);
        try {
            const collection = await this.client.createCollection(e.detail.name);
            dialog.close();
            this.dispatchEvent(new CustomEvent('collection-select', {
                detail: { collectionId: collection.id },
                bubbles: true,
                composed: true,
            }));
        }
        catch (error) {
            dialog.setError('Failed to create collection. Please try again.');
            console.warn('Failed to create collection', error);
        }
        finally {
            dialog.setCreating(false);
        }
    }
    selectCollection(collection) {
        this.dispatchEvent(new CustomEvent('collection-select', {
            detail: { collectionId: collection.id },
            bubbles: true,
            composed: true,
        }));
    }
};
FtCollectionList.styles = css `
    :host {
      display: block;
      background: var(--sl-color-neutral-0);
      color: var(--sl-color-neutral-900);
      font-family: var(--sl-font-sans);
    }

    .shell {
      max-width: 760px;
      margin: 0 auto;
      padding: 3rem 1rem;
    }

    h1 {
      margin: 0 0 0.5rem;
      font-size: 1.75rem;
      line-height: 1.2;
      font-weight: var(--sl-font-weight-semibold);
    }

    .lede {
      margin: 0;
      color: var(--sl-color-neutral-600);
    }

    .header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 1rem;
      margin-bottom: 1.5rem;
    }

    .header-text {
      flex: 1;
    }

    sl-alert {
      margin-bottom: 1rem;
    }

    .list {
      display: grid;
      gap: 0.75rem;
    }

    button.collection {
      width: 100%;
      border: 1px solid var(--sl-color-neutral-200);
      border-radius: 6px;
      background: var(--sl-color-neutral-0);
      color: inherit;
      padding: 1rem;
      text-align: left;
      cursor: pointer;
      transition: border-color 120ms ease, box-shadow 120ms ease;
    }

    button.collection:hover {
      border-color: var(--sl-color-primary-400);
      box-shadow: var(--sl-shadow-x-small);
    }

    button.collection:focus-visible {
      outline: 2px solid var(--sl-color-primary-500);
      outline-offset: 2px;
    }

    .name {
      display: block;
      font-size: 1rem;
      font-weight: var(--sl-font-weight-semibold);
      overflow-wrap: anywhere;
    }

    .meta {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      margin-top: 0.25rem;
      color: var(--sl-color-neutral-600);
      font-size: 0.875rem;
    }

    .meta sl-icon {
      font-size: 0.8rem;
    }

    .empty,
    .loading {
      color: var(--sl-color-neutral-600);
      padding: 1rem 0;
    }
  `;
__decorate([
    query('ft-new-collection-dialog')
], FtCollectionList.prototype, "newCollectionDialog", void 0);
__decorate([
    property({ attribute: false })
], FtCollectionList.prototype, "client", void 0);
__decorate([
    property({ attribute: 'error-message' })
], FtCollectionList.prototype, "errorMessage", void 0);
__decorate([
    state()
], FtCollectionList.prototype, "collections", void 0);
__decorate([
    state()
], FtCollectionList.prototype, "isLoading", void 0);
__decorate([
    state()
], FtCollectionList.prototype, "loadError", void 0);
FtCollectionList = __decorate([
    customElement('ft-collection-list')
], FtCollectionList);
export { FtCollectionList };
//# sourceMappingURL=ft-collection-list.js.map