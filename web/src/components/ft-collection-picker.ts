import { LitElement, css, html, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { FarmTableServiceClient } from '../gen/service.js';
import type { Collection } from '../gen/types.js';
import { platformLabel } from '../util/platform-label.js';

@customElement('ft-collection-picker')
export class FtCollectionPicker extends LitElement {
  static styles = css`
    :host {
      --sl-z-index-dropdown: 2000;

      display: inline-flex;
      align-items: center;
      max-width: 18rem;
      position: relative;
    }

    sl-dropdown,
    sl-button {
      max-width: 100%;
    }

    sl-dropdown::part(base__popup) {
      z-index: var(--sl-z-index-dropdown, 1000);
    }

    sl-dropdown::part(panel) {
      background: var(--sl-color-neutral-0);
      border-radius: var(--sl-border-radius-medium);
      box-shadow: var(--sl-shadow-medium);
    }

    .trigger-label {
      display: inline-block;
      max-width: 13rem;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    sl-menu {
      background: var(--sl-color-neutral-0);
      border: 1px solid var(--sl-color-neutral-200);
      box-shadow: var(--sl-shadow-medium);
      min-width: 16rem;
      max-width: 22rem;
    }

    sl-menu-item::part(base) {
      align-items: center;
      background: var(--sl-color-neutral-0);
      padding: 0.5rem 0.75rem;
      white-space: normal;
    }

    sl-menu-item::part(label) {
      overflow: visible;
    }

    sl-menu-item.current::part(base) {
      background: var(--sl-color-primary-50);
      color: var(--sl-color-primary-800);
    }

    .item-label {
      display: flex;
      flex-direction: column;
      min-width: 0;
      line-height: 1.25;
    }

    .check-icon {
      color: var(--sl-color-primary-700);
      font-size: 1rem;
    }

    .check-icon.placeholder {
      visibility: hidden;
    }

    .name {
      overflow-wrap: anywhere;
    }

    .platform {
      color: var(--sl-color-neutral-600);
      font-size: var(--sl-font-size-x-small);
    }

    .loading,
    .empty,
    .error {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 0.75rem;
      color: var(--sl-color-neutral-600);
      font-size: var(--sl-font-size-small);
    }

    .error {
      color: var(--sl-color-danger-700);
    }
  `;

  @property({ attribute: false })
  client?: FarmTableServiceClient;

  @property()
  collectionId = '';

  @state()
  private collections: Collection[] = [];

  @state()
  private isLoading = false;

  @state()
  private loadError = '';

  private loadToken = 0;

  protected override updated(changedProperties: PropertyValues<this>) {
    // TODO: Consider re-fetching on @sl-show for freshness.
    if (changedProperties.has('client') && this.client !== changedProperties.get('client')) {
      void this.loadCollections();
    }
  }

  render() {
    const currentCollection = this.collections.find((collection) => collection.id === this.collectionId);
    const triggerLabel = currentCollection?.name ?? (this.isLoading ? 'Loading collection' : 'Select collection');

    return html`
      <sl-dropdown placement="bottom-start" hoist>
        <sl-button slot="trigger" size="small" caret>
          <span class="trigger-label">${triggerLabel}</span>
        </sl-button>

        <sl-menu @sl-select=${this.onMenuSelect}>
          ${this.renderMenuContent()}
        </sl-menu>
      </sl-dropdown>
    `;
  }

  private renderMenuContent() {
    if (this.isLoading) {
      return html`<div class="loading"><sl-spinner></sl-spinner> Loading collections</div>`;
    }

    if (this.loadError) {
      return html`<div class="error">${this.loadError}</div>`;
    }

    if (this.collections.length === 0) {
      return html`<div class="empty">No collections are available.</div>`;
    }

    return this.collections.map((collection) => {
      const isCurrent = collection.id === this.collectionId;
      return html`
        <sl-menu-item
          class=${isCurrent ? 'current' : ''}
          value=${collection.id}
        >
          <sl-icon
            slot="prefix"
            class=${isCurrent ? 'check-icon' : 'check-icon placeholder'}
            name="check"
            aria-hidden="true"
          ></sl-icon>
          <span class="item-label">
            <span class="name">${collection.name}</span>
            <span class="platform">${platformLabel(collection.platform)}</span>
          </span>
        </sl-menu-item>
      `;
    });
  }

  private async loadCollections() {
    const token = ++this.loadToken;

    if (!this.client) {
      this.collections = [];
      this.isLoading = false;
      this.loadError = '';
      return;
    }

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
      console.warn('Failed to load collection picker options', error);
    } finally {
      if (token === this.loadToken) {
        this.isLoading = false;
      }
    }
  }

  private onMenuSelect(e: CustomEvent<{ item: HTMLElement & { value?: string } }>) {
    const collectionId = e.detail.item.value;
    if (!collectionId || collectionId === this.collectionId) return;

    this.dispatchEvent(new CustomEvent('collection-select', {
      detail: { collectionId },
      bubbles: true,
      composed: true,
    }));
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ft-collection-picker': FtCollectionPicker;
  }
}
