import { LitElement, html, css, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { TaskStoreController } from '../../store/task-store-controller.js';
import type { TaskStore } from '../../store/task-store.js';
import type { FarmTableServiceClient } from '../../gen/service.js';
import { iconButtonFocusStyles } from './inspector-shared-styles.js';

@customElement('ft-inspector')
export class FtInspector extends LitElement {
  static styles = [
    iconButtonFocusStyles,
    css`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
    }
    .header-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-bottom: 0.5rem;
      flex-shrink: 0;
    }
    .header-label {
      font-size: 0.7rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--sl-color-neutral-500);
      font-weight: 600;
    }
    .close-btn {
      color: var(--sl-color-neutral-500);
    }
    .close-btn:hover {
      color: var(--sl-color-neutral-900);
    }
    .body {
      flex: 1;
      overflow-y: auto;
    }
    sl-tab-group {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    sl-tab-group::part(body) {
      flex: 1;
      overflow: hidden;
    }
    sl-tab-panel {
      height: 100%;
      overflow-y: auto;
    }
    sl-tab-panel::part(base) {
      padding: 0.5rem 0 0;
      height: 100%;
      overflow-y: auto;
    }
    sl-divider {
      --spacing: 0.75rem;
    }
  `,
  ];

  @property()
  taskId = '';

  @property({ attribute: false })
  store!: TaskStore;

  @property({ attribute: false })
  client?: FarmTableServiceClient;

  private storeCtrl?: TaskStoreController;

  override connectedCallback() {
    super.connectedCallback();
    if (!this.storeCtrl) {
      this.storeCtrl = new TaskStoreController(this, this.store);
    }
    this.addEventListener('keydown', this.onBodyKeyDown);
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this.removeEventListener('keydown', this.onBodyKeyDown);
  }

  private onClose() {
    this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true }));
  }

  private onBodyKeyDown(e: KeyboardEvent) {
    if (e.key !== 'Escape') return;

    e.preventDefault();
    e.stopPropagation();
    this.onClose();
  }

  render() {
    const task = this.store.getTask(this.taskId);
    if (!task) {
      return html`
        <div class="header-bar">
          <span class="header-label">Inspector</span>
          <sl-icon-button
            class="close-btn"
            name="x-lg"
            label="Close inspector"
            @click=${this.onClose}
          ></sl-icon-button>
        </div>
        <div style="color: var(--sl-color-neutral-400); font-style: italic; padding: 1rem 0;">
          Task not found
        </div>
      `;
    }

    return html`
      <div class="header-bar">
        <span class="header-label">Inspector</span>
        <sl-icon-button
          class="close-btn"
          name="x-lg"
          label="Close inspector"
          @click=${this.onClose}
        ></sl-icon-button>
      </div>

      <sl-tab-group>
        <sl-tab slot="nav" panel="general" active>General</sl-tab>
        <sl-tab slot="nav" panel="relationships">Relationships</sl-tab>

        <sl-tab-panel name="general" active>
          <div class="body" tabindex="0">
            <ft-inspector-header .task=${task}></ft-inspector-header>

            <sl-divider></sl-divider>

            <ft-inspector-meta .task=${task} .client=${this.client}></ft-inspector-meta>

            <sl-divider></sl-divider>

            <ft-inspector-desc
              taskId=${task.id}
              .description=${task.description}
            ></ft-inspector-desc>

            ${task.relationships.length > 0
              ? html`
                  <sl-divider></sl-divider>
                  <ft-inspector-relations .task=${task} .store=${this.store}></ft-inspector-relations>
                `
              : nothing}

            ${task.codeContext
              ? html`
                  <sl-divider></sl-divider>
                  <ft-inspector-code .codeContext=${task.codeContext}></ft-inspector-code>
                `
              : nothing}

            <sl-divider></sl-divider>

            <ft-inspector-comments
              taskId=${this.taskId}
              .client=${this.client}
            ></ft-inspector-comments>

            <sl-divider></sl-divider>

            <ft-inspector-changes
              taskId=${this.taskId}
              .client=${this.client}
            ></ft-inspector-changes>
          </div>
        </sl-tab-panel>

        <sl-tab-panel name="relationships">
          <ft-inspector-relationships
            .task=${task}
            .store=${this.store}
          ></ft-inspector-relationships>
        </sl-tab-panel>
      </sl-tab-group>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ft-inspector': FtInspector;
  }
}
