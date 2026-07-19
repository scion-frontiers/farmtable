import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { TaskStore } from '../store/task-store.js';
import { TaskStoreController } from '../store/task-store-controller.js';
import { StreamManager, type ConnectionStatus } from '../store/stream-manager.js';
import { applyTaskUpdateFields, type FarmTableServiceClient } from '../gen/service.js';
import type { UpdateTaskFields } from '../gen/service.js';
import { TaskPhase, type User } from '../gen/types.js';
import { createGrpcFarmTableClientWithOptions } from '../gen/grpc-client.js';
import { matchesTaskFilters, type TaskFilterChangeDetail } from './task-filters.js';
import './ft-filter-chips.js';

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
  private streamManager?: StreamManager;
  private client!: FarmTableServiceClient;
  private unscopedClient!: FarmTableServiceClient;
  private onStatusChanged = ((e: CustomEvent) => {
    this.connectionStatus = e.detail.status;
  }) as EventListener;
  private routeToken = 0;

  @state()
  private currentView: 'kanban' | 'tree' = 'kanban';

  @state()
  private routeView: 'landing' | 'validating' | 'board' = 'validating';

  @state()
  private currentCollectionId: string | null = null;

  @state()
  private collectionErrorMessage = '';

  @state()
  private selectedTaskId: string | null = null;

  @state()
  private connectionStatus: ConnectionStatus = 'disconnected';

  @state()
  private shortcutOverlayOpen = false;

  @state()
  private phaseFilter: TaskPhase | null = null;

  @state()
  private assigneeFilter: string | null = null;

  @state()
  private users: User[] = [];

  private userLoadToken = 0;

  connectedCallback() {
    super.connectedCallback();
    this.unscopedClient = createGrpcFarmTableClientWithOptions({
      collectionId: null,
      readStoredCollectionId: false,
    });
    this.client = this.unscopedClient;
    void this.applyRoute();
    // FtApp owns the global "?" toggle; ft-shortcut-overlay owns modal keys like Escape and Tab.
    document.addEventListener('keydown', this.onDocumentKeyDown, { capture: true });
    window.addEventListener('popstate', this.onPopState);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.streamManager?.removeEventListener('status-changed', this.onStatusChanged);
    this.streamManager?.stop();
    document.removeEventListener('keydown', this.onDocumentKeyDown, { capture: true });
    window.removeEventListener('popstate', this.onPopState);
  }

  render() {
    if (this.routeView !== 'board') {
      return html`
        ${this.routeView === 'validating'
          ? html`<div class="placeholder"><sl-spinner style="font-size: 2rem;"></sl-spinner></div>`
          : html`
              <ft-collection-list
                .client=${this.unscopedClient}
                .errorMessage=${this.collectionErrorMessage}
                @collection-select=${this.onCollectionSelect}
              ></ft-collection-list>
            `}
        <ft-shortcut-overlay
          .open=${this.shortcutOverlayOpen}
          @close=${this.onShortcutHelpClose}
        ></ft-shortcut-overlay>
      `;
    }

    const allTasks = this.storeController.taskStore.allTasks;
    const totalCount = allTasks.length;
    const filteredCount =
      this.phaseFilter !== null || this.assigneeFilter !== null
        ? allTasks.filter((task) => matchesTaskFilters(task, this.phaseFilter, this.assigneeFilter))
            .length
        : totalCount;

    return html`
      <ft-toolbar
        .currentView=${this.currentView}
        .connectionStatus=${this.connectionStatus}
        .client=${this.client}
        .unscopedClient=${this.unscopedClient}
        .collectionId=${this.currentCollectionId ?? ''}
        .phaseFilter=${this.phaseFilter}
        .assigneeFilter=${this.assigneeFilter}
        @view-change=${this.onViewChange}
        @filter-change=${this.onFilterChange}
        @shortcut-help-open=${this.onShortcutHelpOpen}
        @collection-select=${this.onCollectionSelect}
      ></ft-toolbar>

      <ft-filter-chips
        .phaseFilter=${this.phaseFilter}
        .assigneeFilter=${this.assigneeFilter}
        .users=${this.users}
        .filteredCount=${filteredCount}
        .totalCount=${totalCount}
        @filter-clear=${this.onFilterChange}
      ></ft-filter-chips>

      <div class="content">
        <div class="main">
          ${this.taskStore.isLoading
            ? html`<div class="placeholder"><sl-spinner style="font-size: 2rem;"></sl-spinner></div>`
            : this.currentView === 'kanban'
              ? html`
                  <ft-kanban-view
                    .store=${this.taskStore}
                    .client=${this.client}
                    .phaseFilter=${this.phaseFilter}
                    .assigneeFilter=${this.assigneeFilter}
                    selected-task-id=${this.selectedTaskId ?? ''}
                    @task-select=${this.onTaskSelect}
                  ></ft-kanban-view>
                `
              : html`
                  <ft-tree-view
                    .store=${this.taskStore}
                    .client=${this.client}
                    .phaseFilter=${this.phaseFilter}
                    .assigneeFilter=${this.assigneeFilter}
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
                  @task-update=${this.onTaskUpdate}
                ></ft-inspector>
              </div>
            `
          : null}
      </div>

      <ft-shortcut-overlay
        .open=${this.shortcutOverlayOpen}
        @close=${this.onShortcutHelpClose}
      ></ft-shortcut-overlay>
    `;
  }

  private onViewChange(e: CustomEvent) {
    this.currentView = e.detail.view;
  }

  private onFilterChange(e: CustomEvent) {
    const { phase, assigneeId } = e.detail as TaskFilterChangeDetail;
    this.phaseFilter = phase;
    this.assigneeFilter = assigneeId;
  }

  private async loadUsers() {
    // TODO: ft-toolbar also calls listUsers() independently. Consider consolidating
    // into a single app-level user list passed to both toolbar and filter chips.
    const token = ++this.userLoadToken;

    try {
      const users = await this.client.listUsers();
      if (token === this.userLoadToken) {
        this.users = users;
      }
    } catch (error) {
      if (token === this.userLoadToken) {
        this.users = [];
      }
      console.warn('Failed to load active filter chip users', error);
    }
  }

  private onTaskSelect(e: CustomEvent) {
    this.selectedTaskId = e.detail.taskId;
  }

  private async onTaskUpdate(e: CustomEvent) {
    const { taskId, fields } = e.detail as { taskId: string; fields: UpdateTaskFields };
    await this.applyTaskUpdate(taskId, fields);
  }

  private async applyTaskUpdate(taskId: string, fields: UpdateTaskFields) {
    const task = this.taskStore.getTask(taskId);
    if (!task) return;

    const updated = applyTaskUpdateFields(task, fields);
    this.taskStore.upsert(updated);

    try {
      await this.client.updateTask(taskId, fields);
    } catch (error) {
      // TODO(ui-feedback): Show a toast/snackbar when an optimistic save rolls back.
      console.warn('Failed to update task; rolled back optimistic change', error);
      this.taskStore.upsert(task);
    }
  }

  private onInspectorClose() {
    this.selectedTaskId = null;
  }

  private onShortcutHelpOpen() {
    this.shortcutOverlayOpen = true;
  }

  private onShortcutHelpClose() {
    this.shortcutOverlayOpen = false;
  }

  private async applyRoute() {
    const token = ++this.routeToken;
    const collectionId = this.currentCollectionIdFromUrl();

    if (!collectionId) {
      this.showCollectionList('');
      return;
    }

    this.routeView = 'validating';
    this.collectionErrorMessage = '';

    try {
      await this.unscopedClient.getCollection(collectionId);
      if (token !== this.routeToken) return;
      this.showBoard(collectionId);
    } catch (error) {
      if (token !== this.routeToken) return;
      console.warn('Collection from URL was not found', error);
      this.removeCollectionFromUrl();
      this.showCollectionList('Collection not found. Choose an available collection.');
    }
  }

  private showCollectionList(errorMessage: string) {
    this.stopStream();
    this.client = this.unscopedClient;
    this.currentCollectionId = null;
    this.taskStore.clear();
    this.selectedTaskId = null;
    this.users = [];
    this.connectionStatus = 'disconnected';
    this.collectionErrorMessage = errorMessage;
    this.routeView = 'landing';
  }

  private showBoard(collectionId: string) {
    this.stopStream();
    this.phaseFilter = null;
    this.assigneeFilter = null;
    this.currentCollectionId = collectionId;
    this.client = createGrpcFarmTableClientWithOptions({
      collectionId,
      readStoredCollectionId: false,
    });
    this.taskStore.clear();
    this.selectedTaskId = null;
    this.connectionStatus = 'disconnected';
    this.collectionErrorMessage = '';
    this.routeView = 'board';

    this.streamManager = new StreamManager(this.client, this.taskStore);
    this.streamManager.addEventListener('status-changed', this.onStatusChanged);
    void this.streamManager.start();
    void this.loadUsers();
  }

  private stopStream() {
    this.streamManager?.removeEventListener('status-changed', this.onStatusChanged);
    this.streamManager?.stop();
    this.streamManager = undefined;
  }

  private currentCollectionIdFromUrl(): string | null {
    return new URLSearchParams(window.location.search).get('collection');
  }

  private onCollectionSelect = (e: CustomEvent) => {
    const collectionId = e.detail.collectionId as string;
    const url = new URL(window.location.href);
    url.searchParams.set('collection', collectionId);
    window.history.pushState({}, '', url);
    void this.applyRoute();
  };

  private onPopState = () => {
    void this.applyRoute();
  };

  private removeCollectionFromUrl() {
    const url = new URL(window.location.href);
    url.searchParams.delete('collection');
    window.history.replaceState({}, '', url);
  }

  private onDocumentKeyDown = (e: KeyboardEvent) => {
    if (e.key !== '?' || e.defaultPrevented) return;
    if (this.isEditableEventTarget(e)) return;

    e.preventDefault();
    this.shortcutOverlayOpen = !this.shortcutOverlayOpen;
  };

  private isEditableEventTarget(e: KeyboardEvent): boolean {
    const path = e.composedPath();
    return path.some((target) => {
      if (!(target instanceof HTMLElement)) return false;

      const tagName = target.tagName.toLowerCase();
      return (
        target.isContentEditable ||
        tagName === 'input' ||
        tagName === 'textarea' ||
        tagName === 'select' ||
        tagName === 'sl-input' ||
        tagName === 'sl-textarea' ||
        tagName === 'sl-select'
      );
    });
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ft-app': FtApp;
  }
}
