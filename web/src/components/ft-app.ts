import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { TaskStore } from '../store/task-store.js';
import { TaskStoreController } from '../store/task-store-controller.js';
import { StreamManager, type ConnectionStatus } from '../store/stream-manager.js';
import { MockFarmTableClient } from '../gen/service.js';

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
      width: 360px;
      border-left: 1px solid var(--sl-color-neutral-200);
      padding: 1rem;
      overflow: auto;
      background: var(--sl-color-neutral-50);
    }
    .task-count {
      text-align: center;
      margin-top: 0.5rem;
      color: var(--sl-color-neutral-400);
      font-size: 0.85rem;
    }
  `;

  private taskStore = new TaskStore();
  private storeController = new TaskStoreController(this, this.taskStore);
  private streamManager!: StreamManager;

  @state()
  private currentView: 'kanban' | 'tree' = 'kanban';

  @state()
  private selectedTaskId: string | null = null;

  @state()
  private connectionStatus: ConnectionStatus = 'disconnected';

  connectedCallback() {
    super.connectedCallback();
    const client = new MockFarmTableClient();
    this.streamManager = new StreamManager(client, this.taskStore);
    this.streamManager.addEventListener('status-changed', ((e: CustomEvent) => {
      this.connectionStatus = e.detail.status;
    }) as EventListener);
    this.streamManager.start();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
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
          <div class="placeholder">
            ${this.taskStore.isLoading
              ? html`<sl-spinner style="font-size: 2rem;"></sl-spinner>`
              : html`
                  <div>
                    <div>${this.currentView === 'kanban' ? 'Kanban Board' : 'Tree View'} — coming soon</div>
                    <div class="task-count">${taskCount} tasks loaded</div>
                  </div>
                `}
          </div>
        </div>

        ${this.selectedTaskId
          ? html`
              <div class="inspector">
                <div>Task Inspector</div>
                <div>ID: ${this.selectedTaskId}</div>
              </div>
            `
          : null}
      </div>
    `;
  }

  private onViewChange(e: CustomEvent) {
    this.currentView = e.detail.view;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ft-app': FtApp;
  }
}
