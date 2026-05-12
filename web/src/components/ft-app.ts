import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { TaskStore } from '../store/task-store.js';
import { TaskStoreController } from '../store/task-store-controller.js';
import { StreamManager, type ConnectionStatus } from '../store/stream-manager.js';
import { MockFarmTableClient, type FarmTableServiceClient } from '../gen/service.js';

@customElement('ft-app')
export class FtApp extends LitElement {
  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      height: 100vh;
      font-family: var(--sl-font-sans);
    }
    .content {
      flex: 1;
      display: flex;
      overflow: hidden;
    }
    .main {
      flex: 1;
      overflow: auto;
      padding: 1rem;
    }
    .placeholder {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100%;
      color: var(--sl-color-neutral-500);
      font-size: 1.2rem;
    }
    .inspector {
      width: 400px;
      flex-shrink: 0;
      border-left: 1px solid var(--sl-color-neutral-200);
      padding: 1rem;
      overflow: hidden;
      background: var(--sl-color-neutral-50);
    }
  `;

  private taskStore = new TaskStore();
  private storeController = new TaskStoreController(this, this.taskStore);
  private streamManager!: StreamManager;
  private client!: FarmTableServiceClient;
  private onStatusChanged = ((e: CustomEvent) => {
    this.connectionStatus = e.detail.status;
  }) as EventListener;

  @state()
  private currentView: 'kanban' | 'tree' = 'kanban';

  @state()
  private selectedTaskId: string | null = null;

  @state()
  private connectionStatus: ConnectionStatus = 'disconnected';

  connectedCallback() {
    super.connectedCallback();
    this.client = new MockFarmTableClient();
    this.streamManager = new StreamManager(this.client, this.taskStore);
    this.streamManager.addEventListener('status-changed', this.onStatusChanged);
    this.streamManager.start();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.streamManager?.removeEventListener('status-changed', this.onStatusChanged);
    this.streamManager?.stop();
  }

  render() {
    const taskCount = this.storeController.taskStore.allTasks.length;

    return html`
      <ft-toolbar
        .currentView=${this.currentView}
        .connectionStatus=${this.connectionStatus}
        @view-change=${this.onViewChange}
      ></ft-toolbar>

      <div class="content">
        <div class="main">
          ${this.taskStore.isLoading
            ? html`<div class="placeholder"><sl-spinner style="font-size: 2rem;"></sl-spinner></div>`
            : this.currentView === 'kanban'
              ? html`
                  <ft-kanban-view
                    .store=${this.taskStore}
                    .client=${this.client}
                    selected-task-id=${this.selectedTaskId ?? ''}
                    @task-select=${this.onTaskSelect}
                  ></ft-kanban-view>
                `
              : html`
                  <ft-tree-view
                    .store=${this.taskStore}
                    .client=${this.client}
                    selected-task-id=${this.selectedTaskId ?? ''}
                    @task-select=${this.onTaskSelect}
                  ></ft-tree-view>
                `}
        </div>

        ${this.selectedTaskId
          ? html`
              <div class="inspector">
                <ft-inspector
                  taskId=${this.selectedTaskId}
                  .store=${this.taskStore}
                  .client=${this.client}
                  @close=${this.onInspectorClose}
                  @task-select=${this.onTaskSelect}
                ></ft-inspector>
              </div>
            `
          : null}
      </div>
    `;
  }

  private onViewChange(e: CustomEvent) {
    this.currentView = e.detail.view;
  }

  private onTaskSelect(e: CustomEvent) {
    this.selectedTaskId = e.detail.taskId;
  }

  private onInspectorClose() {
    this.selectedTaskId = null;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ft-app': FtApp;
  }
}
