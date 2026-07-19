import { LitElement, css, html } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { FarmTableServiceClient } from '../gen/service.js';
import { Platform, type Collection } from '../gen/types.js';

@customElement('ft-collection-list')
export class FtCollectionList extends LitElement {
  static styles = css`
    :host {
      display: block;
      min-height: 100vh;
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
      margin: 0 0 1.5rem;
      color: var(--sl-color-neutral-600);
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
      display: block;
      margin-top: 0.25rem;
      color: var(--sl-color-neutral-600);
      font-size: 0.875rem;
    }

    .empty,
    .loading {
      color: var(--sl-color-neutral-600);
      padding: 1rem 0;
    }
  `;

  @property({ attribute: false })
  client!: FarmTableServiceClient;

  @property({ attribute: 'error-message' })
  errorMessage = '';

  @state()
  private collections: Collection[] = [];

  @state()
  private isLoading = true;

  @state()
  private loadError = '';

  private loadToken = 0;

  protected updated(changedProperties: Map<PropertyKey, unknown>) {
    if (changedProperties.has('client') && this.client !== changedProperties.get('client')) {
      void this.loadCollections();
    }
  }

  render() {
    return html`
      <main class="shell">
        <h1>Select a collection</h1>
        <p class="lede">Choose which collection to open.</p>

        <!-- Shoelace renders sl-alert with role="alert" internally. -->
        ${this.errorMessage
          ? html`<sl-alert variant="warning" open>${this.errorMessage}</sl-alert>`
          : null}
        ${this.loadError
          ? html`<sl-alert variant="danger" open>${this.loadError}</sl-alert>`
          : null}

        ${this.isLoading
          ? html`<div class="loading"><sl-spinner></sl-spinner> Loading collections</div>`
          : this.collections.length === 0
            ? html`<div class="empty">No collections are available.</div>`
            : html`
                <div class="list">
                  ${this.collections.map((collection) => html`
                    <button
                      class="collection"
                      type="button"
                      @click=${() => this.selectCollection(collection)}
                    >
                      <span class="name">${collection.name}</span>
                      <span class="meta">${this.platformLabel(collection.platform)}</span>
                    </button>
                  `)}
                </div>
              `}
      </main>
    `;
  }

  private async loadCollections() {
    if (!this.client) return;
    const token = ++this.loadToken;
    this.isLoading = true;
    this.loadError = '';

    try {
      const collections = await this.client.listCollections();
      if (token === this.loadToken) {
        this.collections = collections;
      }
    } catch (error) {
      if (token === this.loadToken) {
        this.collections = [];
        this.loadError = 'Unable to load collections.';
      }
      console.warn('Failed to load collections', error);
    } finally {
      if (token === this.loadToken) {
        this.isLoading = false;
      }
    }
  }

  private selectCollection(collection: Collection) {
    this.dispatchEvent(new CustomEvent('collection-select', {
      detail: { collectionId: collection.id },
      bubbles: true,
      composed: true,
    }));
  }

  private platformLabel(platform: Platform): string {
    switch (platform) {
      case Platform.FARMTABLE:
        return 'Farm Table';
      case Platform.GITHUB:
        return 'GitHub';
      case Platform.LINEAR:
        return 'Linear';
      case Platform.JIRA:
        return 'Jira';
      case Platform.ASANA:
        return 'Asana';
      case Platform.BEADS:
        return 'Beads';
      default:
        return 'Unknown platform';
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ft-collection-list': FtCollectionList;
  }
}
