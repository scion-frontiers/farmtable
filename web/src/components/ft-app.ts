import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { TaskStore } from '../store/task-store.js';
import { TaskStoreController } from '../store/task-store-controller.js';
import { StreamManager, type ConnectionStatus } from '../store/stream-manager.js';
import { PollManager } from '../store/poll-manager.js';
import { applyTaskUpdateFields, type FarmTableServiceClient } from '../gen/service.js';
import type { UpdateTaskFields } from '../gen/service.js';
import { Platform, RelationshipType, TaskPhase, type Collection, type Task, type User } from '../gen/types.js';
import { createGrpcFarmTableClientWithOptions } from '../gen/grpc-client.js';
import { getCapabilities, type CollectionCapabilities } from '../capabilities.js';
import { matchesTaskFilters, type TaskFilterChangeDetail } from './task-filters.js';
import './ft-filter-chips.js';
import './ft-dashboard-view.js';
import './ready-queue/ft-ready-queue-view.js';
import './dependency/ft-dependency-view.js';
import './ft-command-palette.js';
import './ft-login-dialog.js';

/** Session info returned by GET /api/auth/session. */
interface SessionUser {
  userId: string;
  userName: string;
  email?: string;
  userType?: string;
}

@customElement('ft-app')
export class FtApp extends LitElement {
  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      height: 100vh;
      overflow: hidden;
      font-family: var(--sl-font-sans);
    }
    .content {
      flex: 1;
      display: flex;
      min-height: 0;
      overflow: hidden;
    }
    .main {
      flex: 1;
      min-width: 0;
      overflow: auto;
      padding: 1rem;
      position: relative;
    }
    .dim-overlay {
      position: absolute;
      inset: 0;
      background: rgba(0, 0, 0, 0.5);
      z-index: 10;
      pointer-events: none;
      animation: dim-fade-in 0.2s ease-out;
    }
    @keyframes dim-fade-in {
      from { opacity: 0; }
      to   { opacity: 1; }
    }
    .landing {
      flex: 1;
      overflow: auto;
      min-height: 0;
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
  private pollManager?: PollManager;
  private client!: FarmTableServiceClient;
  private unscopedClient!: FarmTableServiceClient;
  private onStatusChanged = ((e: CustomEvent) => {
    this.connectionStatus = e.detail.status;
  }) as EventListener;
  private onWatchUnsupported = (() => {
    this.switchToPolling();
  }) as EventListener;
  private onPollRefreshEnd = ((e: CustomEvent) => {
    this.lastRefreshed = e.detail.lastRefreshed as Date;
    this.isRefreshing = false;
  }) as EventListener;
  private onPollRefreshStart = (() => {
    // no-op: background polls should not trigger the refresh spinner
  }) as EventListener;
  private onPollRefreshError = (() => {
    this.isRefreshing = false;
  }) as EventListener;
  private routeToken = 0;

  /**
   * Task ID parsed from the URL's `?task=` param during route application.
   * Stored separately because the task data may not be loaded yet when the
   * URL is first parsed. Applied after the task store emits `snapshot-complete`.
   */
  private _pendingTaskId: string | null = null;

  /** Listener bound to the task store's `snapshot-complete` event. */
  private onSnapshotComplete = () => {
    if (this._pendingTaskId) {
      const taskId = this._pendingTaskId;
      this._pendingTaskId = null;
      // Detach immediately — the listener only needs to fire once per navigation.
      this.taskStore.removeEventListener('snapshot-complete', this.onSnapshotComplete);
      // Only apply if the task actually exists in the store.
      if (this.taskStore.getTask(taskId)) {
        this.selectedTaskId = taskId;
      }
    }
  };

  @state()
  private currentView: 'kanban' | 'tree' | 'dashboard' | 'ready-queue' | 'dependencies' = 'dashboard';

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
  private commandPaletteOpen = false;

  @state()
  private commandPaletteMode: 'navigate' | 'add-relationship' = 'navigate';

  @state()
  private addRelationshipTaskId = '';

  @state()
  private addRelationshipDefaultType: RelationshipType | undefined = undefined;

  @state()
  private phaseFilter: TaskPhase | null = null;

  @state()
  private assigneeFilter: string | null = null;

  @state()
  private users: User[] = [];

  @state()
  private isPolling = false;

  @state()
  private lastRefreshed: Date | null = null;

  @state()
  private isRefreshing = false;

  @state()
  private currentCollection?: Collection;

  @state()
  private dimOverlayVisible = false;

  @state()
  private showLogin = false;

  @state()
  private sessionUser: SessionUser | null = null;

  private dimOverlayTimer: ReturnType<typeof setTimeout> | null = null;

  private collectionLoadToken = 0;

  private userLoadToken = 0;

  private get isReadOnly(): boolean {
    if (!this.currentCollection) return false;
    if (this.currentCollection.platform === Platform.FARMTABLE) return false;
    // External collections: check per-collection writable setting
    return !this.isCollectionWritable(this.currentCollection);
  }

  /**
   * Whether the current collection is a writable external collection.
   * Used by the toolbar to show "↔ GitHub" instead of "🔒 Read-only".
   */
  private get isExternalWritable(): boolean {
    if (!this.currentCollection) return false;
    if (this.currentCollection.platform === Platform.FARMTABLE) return false;
    return this.isCollectionWritable(this.currentCollection);
  }

  /**
   * Per-operation capability flags for the current collection.
   * Farmtable collections get ALL_ENABLED; writable GitHub collections get
   * GITHUB_CAPABILITIES (with unmappable operations disabled); everything
   * else gets ALL_DISABLED.
   */
  private get capabilities(): CollectionCapabilities | undefined {
    if (!this.currentCollection) return undefined;
    return getCapabilities(this.currentCollection);
  }

  private isCollectionWritable(coll: Collection): boolean {
    // Check remote_data for explicit writable flag
    const rd = coll.remoteData;
    if (rd && typeof rd === 'object' && 'writable' in rd) {
      return rd.writable === true;
    }
    // Default: external collections are read-only unless explicitly enabled
    return false;
  }

  connectedCallback() {
    super.connectedCallback();
    this.unscopedClient = createGrpcFarmTableClientWithOptions({
      collectionId: null,
      readStoredCollectionId: false,
    });
    this.client = this.unscopedClient;
    void this.checkSessionAndRoute();
    // FtApp owns the global "?" toggle; ft-shortcut-overlay owns modal keys like Escape and Tab.
    document.addEventListener('keydown', this.onDocumentKeyDown, { capture: true });
    window.addEventListener('popstate', this.onPopState);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.streamManager?.removeEventListener('status-changed', this.onStatusChanged);
    this.streamManager?.removeEventListener('watch-unsupported', this.onWatchUnsupported);
    this.streamManager?.stop();
    this.taskStore.removeEventListener('snapshot-complete', this.onSnapshotComplete);
    this.stopPolling();
    this.hideDimOverlay();
    document.removeEventListener('keydown', this.onDocumentKeyDown, { capture: true });
    window.removeEventListener('popstate', this.onPopState);
  }

  /**
   * Check if the user has an active session. If not, and there is no
   * localStorage token fallback, show the login dialog.
   */
  private async checkSessionAndRoute() {
    // Check for localStorage token fallback (dev/testing).
    const localToken = localStorage.getItem('farmtable.token');
    if (localToken) {
      // User has a localStorage token — skip session check.
      void this.applyRoute();
      return;
    }

    try {
      const response = await fetch('/api/auth/session');
      if (response.ok) {
        const data = await response.json() as SessionUser;
        this.sessionUser = data;
        this.showLogin = false;
      } else if (response.status === 404) {
        // Session endpoints not available (open access mode).
        // Proceed without session.
        this.showLogin = false;
      } else {
        this.showLogin = true;
        return; // Don't route until authenticated.
      }
    } catch {
      // Network error or session endpoints not configured — proceed.
      this.showLogin = false;
    }

    void this.applyRoute();
  }

  render() {
    if (this.showLogin) {
      return html`<ft-login-dialog></ft-login-dialog>`;
    }

    if (this.routeView !== 'board') {
      return html`
        ${this.routeView === 'validating'
          ? html`<div class="placeholder"><sl-spinner style="font-size: 2rem;"></sl-spinner></div>`
          : html`
              <div class="landing">
                <ft-collection-list
                  .client=${this.unscopedClient}
                  .errorMessage=${this.collectionErrorMessage}
                  @collection-select=${this.onCollectionSelect}
                ></ft-collection-list>
              </div>
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
        ?isPolling=${this.isPolling}
        .lastRefreshed=${this.lastRefreshed}
        ?isRefreshing=${this.isRefreshing}
        ?readOnly=${this.isReadOnly}
        ?externalWritable=${this.isExternalWritable}
        .sessionUser=${this.sessionUser}
        @view-change=${this.onViewChange}
        @filter-change=${this.onFilterChange}
        @shortcut-help-open=${this.onShortcutHelpOpen}
        @collection-select=${this.onCollectionSelect}
        @manual-refresh=${this.onManualRefresh}
        @logout=${this.onLogout}
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
          ${this.renderMainView()}
          ${this.dimOverlayVisible ? html`<div class="dim-overlay"></div>` : null}
        </div>

        ${this.selectedTaskId
          ? html`
              <div class="inspector">
                <ft-inspector
                  taskId=${this.selectedTaskId}
                  .store=${this.taskStore}
                  .client=${this.client}
                  ?readOnly=${this.isReadOnly}
                  .capabilities=${this.capabilities}
                  @close=${this.onInspectorClose}
                  @task-select=${this.onTaskSelect}
                  @task-update=${this.onTaskUpdate}
                  @open-add-relationship=${this.onOpenAddRelationship}
                ></ft-inspector>
              </div>
            `
          : null}
      </div>

      <ft-shortcut-overlay
        .open=${this.shortcutOverlayOpen}
        @close=${this.onShortcutHelpClose}
      ></ft-shortcut-overlay>
      <ft-command-palette
        .open=${this.commandPaletteOpen}
        .store=${this.taskStore}
        .mode=${this.commandPaletteMode}
        .excludeTaskId=${this.addRelationshipTaskId}
        .defaultRelationshipType=${this.addRelationshipDefaultType}
        @task-select=${this.onTaskSelect}
        @relationship-add=${this.onRelationshipAdd}
        @close=${this.onCommandPaletteClose}
      ></ft-command-palette>
    `;
  }

  private renderMainView() {
    if (this.taskStore.isLoading) {
      return html`<div class="placeholder"><sl-spinner style="font-size: 2rem;"></sl-spinner></div>`;
    }
    switch (this.currentView) {
      case 'dashboard':
        return html`
          <ft-dashboard-view
            .store=${this.taskStore}
          ></ft-dashboard-view>
        `;
      case 'ready-queue':
        return html`
          <ft-ready-queue-view
            .store=${this.taskStore}
            .phaseFilter=${this.phaseFilter}
            .assigneeFilter=${this.assigneeFilter}
            selected-task-id=${this.selectedTaskId ?? ''}
            @task-select=${this.onTaskSelect}
          ></ft-ready-queue-view>
        `;
      case 'dependencies':
        return html`
          <ft-dependency-view
            .store=${this.taskStore}
            ?readOnly=${this.isReadOnly}
            selected-task-id=${this.selectedTaskId ?? ''}
            @task-select=${this.onTaskSelect}
            @dependency-drop=${this.onDependencyDrop}
          ></ft-dependency-view>
        `;
      case 'tree':
        return html`
          <ft-tree-view
            .store=${this.taskStore}
            .client=${this.client}
            .phaseFilter=${this.phaseFilter}
            .assigneeFilter=${this.assigneeFilter}
            ?readOnly=${this.isReadOnly}
            .capabilities=${this.capabilities}
            selected-task-id=${this.selectedTaskId ?? ''}
            @task-select=${this.onTaskSelect}
            @write-error=${this.onWriteError}
          ></ft-tree-view>
        `;
      case 'kanban':
      default:
        return html`
          <ft-kanban-view
            .store=${this.taskStore}
            .client=${this.client}
            .phaseFilter=${this.phaseFilter}
            .assigneeFilter=${this.assigneeFilter}
            ?readOnly=${this.isReadOnly}
            .capabilities=${this.capabilities}
            selected-task-id=${this.selectedTaskId ?? ''}
            @task-select=${this.onTaskSelect}
            @write-error=${this.onWriteError}
          ></ft-kanban-view>
        `;
    }
  }

  private onViewChange(e: CustomEvent) {
    const view = e.detail.view as 'kanban' | 'tree' | 'dashboard' | 'ready-queue' | 'dependencies';
    const url = new URL(window.location.href);
    url.searchParams.set('view', view);
    window.history.pushState({}, '', url);
    // Skip applyRoute() — view-only change doesn't need collection revalidation.
    this.currentView = view;
    if (this.selectedTaskId && !this.isTaskVisibleInCurrentView(this.selectedTaskId)) {
      this.showDimOverlay();
    } else {
      this.hideDimOverlay();
    }
  }

  private onFilterChange(e: CustomEvent) {
    const { phase, assigneeId } = e.detail as TaskFilterChangeDetail;
    this.phaseFilter = phase;
    this.assigneeFilter = assigneeId;
    if (this.selectedTaskId && !this.isTaskVisibleInCurrentView(this.selectedTaskId)) {
      this.showDimOverlay();
    } else {
      this.hideDimOverlay();
    }
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
    this.syncTaskToUrl();

    if (this.selectedTaskId && !this.isTaskVisibleInCurrentView(this.selectedTaskId)) {
      this.showDimOverlay();
    } else {
      this.hideDimOverlay();
    }
  }

  /**
   * Check whether the selected task would appear in the currently active view.
   * Used to decide whether to show a dim overlay indicating the task is
   * not scrollable-to in the main panel.
   */
  private isTaskVisibleInCurrentView(taskId: string): boolean {
    const task = this.taskStore.getTask(taskId);
    if (!task) return false;

    // Dashboard has no individual task selection.
    if (this.currentView === 'dashboard') return false;

    // Dependencies view shows non-closed tasks in blocking relationships.
    if (this.currentView === 'dependencies') {
      if (task.phase === TaskPhase.CLOSED) {
        return false;
      }
      // Visible if the task is involved in any active blocking relationship,
      // or if it is an unblocked (Layer 0 / ready) task.
      let involved = false;
      for (const rel of task.relationships) {
        if (rel.type === RelationshipType.BLOCKED_BY) {
          const blocker = this.taskStore.getTask(rel.targetTaskId);
          if (blocker && blocker.phase !== TaskPhase.CLOSED) {
            involved = true;
            break;
          }
        }
        if (rel.type === RelationshipType.BLOCKS) {
          const target = this.taskStore.getTask(rel.targetTaskId);
          if (target && target.phase !== TaskPhase.CLOSED) {
            involved = true;
            break;
          }
        }
      }
      // Layer 0 = unblocked OPEN/IN_PROGRESS tasks (matches isReady() in getVisibleTasks)
      if (!involved && (task.phase === TaskPhase.OPEN || task.phase === TaskPhase.IN_PROGRESS)) {
        let isBlocked = false;
        for (const rel of task.relationships) {
          if (rel.type !== RelationshipType.BLOCKED_BY) continue;
          const blocker = this.taskStore.getTask(rel.targetTaskId);
          if (blocker && blocker.phase !== TaskPhase.CLOSED) {
            isBlocked = true;
            break;
          }
        }
        involved = !isBlocked;
      }
      return involved;
    }

    // Task must pass the active phase + assignee filters.
    if (!matchesTaskFilters(task, this.phaseFilter, this.assigneeFilter)) {
      return false;
    }

    // Ready-queue only shows OPEN / IN_PROGRESS tasks that are not blocked.
    if (this.currentView === 'ready-queue') {
      if (task.phase !== TaskPhase.OPEN && task.phase !== TaskPhase.IN_PROGRESS) {
        return false;
      }
      // A ready-queue task must not be blocked by any non-closed task.
      for (const rel of task.relationships) {
        if (rel.type !== RelationshipType.BLOCKED_BY) continue;
        const blocker = this.taskStore.getTask(rel.targetTaskId);
        if (blocker && blocker.phase !== TaskPhase.CLOSED) {
          return false;
        }
      }
    }

    return true;
  }

  private showDimOverlay() {
    this.dimOverlayVisible = true;
    this.clearDimOverlayTimer();
    this.dimOverlayTimer = setTimeout(() => {
      this.hideDimOverlay();
    }, 2500);
    // Defer listener registration so the triggering event itself doesn't
    // immediately dismiss the overlay.
    requestAnimationFrame(() => {
      if (!this.dimOverlayVisible) return;
      document.addEventListener('click', this.onDimOverlayInteraction, { capture: true });
      document.addEventListener('keydown', this.onDimOverlayInteraction, { capture: true });
    });
  }

  private hideDimOverlay() {
    this.dimOverlayVisible = false;
    this.clearDimOverlayTimer();
    document.removeEventListener('click', this.onDimOverlayInteraction, { capture: true });
    document.removeEventListener('keydown', this.onDimOverlayInteraction, { capture: true });
  }

  private clearDimOverlayTimer() {
    if (this.dimOverlayTimer) {
      clearTimeout(this.dimOverlayTimer);
      this.dimOverlayTimer = null;
    }
  }

  private onDimOverlayInteraction = () => {
    this.hideDimOverlay();
  };

  private async onTaskUpdate(e: CustomEvent) {
    if (this.isReadOnly) return;
    const { taskId, fields } = e.detail as { taskId: string; fields: UpdateTaskFields };
    await this.applyTaskUpdate(taskId, fields);
  }

  private async applyTaskUpdate(taskId: string, fields: UpdateTaskFields) {
    const task = this.taskStore.getTask(taskId);
    if (!task) return;

    const updated = applyTaskUpdateFields(task, fields);
    this.taskStore.upsert(updated);
    this.pollManager?.markDirty(taskId);

    // Synthesize reciprocal relationships on target tasks so the UI reflects them instantly.
    const reciprocalSnapshots: Array<{ id: string; original: Task }> = [];

    if (fields.addBlocks?.length) {
      for (const targetId of fields.addBlocks) {
        const target = this.taskStore.getTask(targetId);
        if (target) {
          if (!reciprocalSnapshots.some(s => s.id === targetId)) {
            reciprocalSnapshots.push({ id: targetId, original: target });
          }
          if (!target.relationships.some(r => r.type === RelationshipType.BLOCKED_BY && r.targetTaskId === taskId)) {
            this.taskStore.upsert({
              ...target,
              relationships: [...target.relationships, { type: RelationshipType.BLOCKED_BY, targetTaskId: taskId }],
            });
          }
        }
      }
    }
    if (fields.addBlockedBy?.length) {
      for (const targetId of fields.addBlockedBy) {
        const target = this.taskStore.getTask(targetId);
        if (target) {
          if (!reciprocalSnapshots.some(s => s.id === targetId)) {
            reciprocalSnapshots.push({ id: targetId, original: target });
          }
          if (!target.relationships.some(r => r.type === RelationshipType.BLOCKS && r.targetTaskId === taskId)) {
            this.taskStore.upsert({
              ...target,
              relationships: [...target.relationships, { type: RelationshipType.BLOCKS, targetTaskId: taskId }],
            });
          }
        }
      }
    }
    if (fields.removeRelationships?.length) {
      for (const targetId of fields.removeRelationships) {
        const target = this.taskStore.getTask(targetId);
        if (target) {
          if (!reciprocalSnapshots.some(s => s.id === targetId)) {
            reciprocalSnapshots.push({ id: targetId, original: target });
          }
          // Find the relationship type(s) being removed from the source task
          // and remove only the reciprocal type from the target.
          const removedTypes = new Set(
            task.relationships
              .filter(r => r.targetTaskId === targetId)
              .map(r => r.type === RelationshipType.BLOCKS ? RelationshipType.BLOCKED_BY
                      : r.type === RelationshipType.BLOCKED_BY ? RelationshipType.BLOCKS
                      : r.type),
          );
          this.taskStore.upsert({
            ...target,
            relationships: target.relationships.filter(
              r => !(r.targetTaskId === taskId && removedTypes.has(r.type)),
            ),
          });
        }
      }
    }

    try {
      await this.client.updateTask(taskId, fields);
    } catch (error) {
      // TODO(ui-feedback): Show a toast/snackbar when an optimistic save rolls back.
      console.warn('Failed to update task; rolled back optimistic change', error);
      this.taskStore.upsert(task);
      // Roll back reciprocal changes on target tasks.
      for (const snap of reciprocalSnapshots) {
        this.taskStore.upsert(snap.original);
      }
      this.showWriteError(error);
    } finally {
      this.pollManager?.clearDirty(taskId);
    }
  }

  /** Map a write error to a user-friendly message and show it as a toast. */
  private showWriteError(error: unknown) {
    const raw =
      error instanceof Error
        ? error.message
        : typeof error === 'string'
          ? error
          : String(error);

    let message: string;

    if (/permission|403|forbidden/i.test(raw)) {
      message = 'GitHub rejected this edit — your token may not have write access';
    } else if (/rate.?limit|429|too many requests/i.test(raw)) {
      message = 'GitHub rate limit reached — please wait before making more edits';
    } else if (/network|fetch|ECONNREFUSED|unavailable|deadline/i.test(raw)) {
      message = 'Could not reach the server — your change will retry on the next sync';
    } else {
      message = `Failed to save changes: ${raw}`;
    }

    const alert = Object.assign(document.createElement('sl-alert'), {
      variant: 'danger',
      closable: true,
      duration: 8000,
    });
    const icon = document.createElement('sl-icon');
    icon.slot = 'icon';
    icon.setAttribute('name', 'exclamation-triangle');
    alert.append(icon, document.createTextNode(message));
    document.body.appendChild(alert);
    void (alert as HTMLElement & { toast(): Promise<void> }).toast();
  }

  private onWriteError(e: CustomEvent) {
    this.showWriteError(e.detail.error);
  }

  private onInspectorClose() {
    this.selectedTaskId = null;
    this.syncTaskToUrl();
    this.hideDimOverlay();
  }

  private onShortcutHelpOpen() {
    this.shortcutOverlayOpen = true;
  }

  private onShortcutHelpClose() {
    this.shortcutOverlayOpen = false;
  }

  private async applyRoute() {
    const token = ++this.routeToken;
    const params = new URLSearchParams(window.location.search);
    const collectionId = params.get('collection');
    const viewParam = params.get('view');
    const taskParam = params.get('task');
    const VALID_VIEWS = new Set<string>(['kanban', 'tree', 'dashboard', 'ready-queue', 'dependencies']);
    this.currentView = VALID_VIEWS.has(viewParam ?? '') ? (viewParam as 'kanban' | 'tree' | 'dashboard' | 'ready-queue' | 'dependencies') : 'dashboard';

    if (!collectionId) {
      this.showCollectionList('');
      return;
    }

    // Store pending task ID from URL — it will be applied once the task
    // store finishes its initial snapshot (tasks may not be loaded yet).
    this._pendingTaskId = taskParam || null;

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
    this.stopPolling();
    this.taskStore.removeEventListener('snapshot-complete', this.onSnapshotComplete);
    this._pendingTaskId = null;
    this.client = this.unscopedClient;
    this.currentCollectionId = null;
    this.taskStore.clear();
    this.selectedTaskId = null;
    this.users = [];
    this.currentCollection = undefined;
    this.connectionStatus = 'disconnected';
    this.collectionErrorMessage = errorMessage;
    this.routeView = 'landing';
  }

  private showBoard(collectionId: string) {
    this.stopStream();
    this.stopPolling();
    this.taskStore.removeEventListener('snapshot-complete', this.onSnapshotComplete);
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

    // Listen for snapshot-complete to apply the pending task selection from
    // the URL (the task data is not available until the snapshot finishes).
    if (this._pendingTaskId) {
      this.taskStore.addEventListener('snapshot-complete', this.onSnapshotComplete);
    }

    this.streamManager = new StreamManager(this.client, this.taskStore);
    this.streamManager.addEventListener('status-changed', this.onStatusChanged);
    this.streamManager.addEventListener('watch-unsupported', this.onWatchUnsupported);
    void this.streamManager.start();
    void this.loadUsers();
    void this.loadCurrentCollection();
  }

  private stopStream() {
    this.streamManager?.removeEventListener('status-changed', this.onStatusChanged);
    this.streamManager?.removeEventListener('watch-unsupported', this.onWatchUnsupported);
    this.streamManager?.stop();
    this.streamManager = undefined;
  }

  /**
   * Called when WatchTasks returns Unimplemented for this collection.
   * Tears down the stream and starts periodic ListTasks polling.
   */
  private switchToPolling(): void {
    this.stopStream();
    this.isPolling = true;
    this.connectionStatus = 'polling';

    // Shorter interval for writable external collections (user expects to see
    // their changes reflected quickly). Read-only external collections keep the
    // default 30s interval.
    const interval = this.isExternalWritable
      ? 15_000
      : PollManager.DEFAULT_INTERVAL_MS;

    this.pollManager = new PollManager(this.client, this.taskStore, interval);
    this.pollManager.addEventListener('refresh-start', this.onPollRefreshStart);
    this.pollManager.addEventListener('refresh-end', this.onPollRefreshEnd);
    this.pollManager.addEventListener('refresh-error', this.onPollRefreshError);
    void this.pollManager.start();
  }

  private stopPolling(): void {
    if (this.pollManager) {
      this.pollManager.removeEventListener('refresh-start', this.onPollRefreshStart);
      this.pollManager.removeEventListener('refresh-end', this.onPollRefreshEnd);
      this.pollManager.removeEventListener('refresh-error', this.onPollRefreshError);
      this.pollManager.stop();
      this.pollManager = undefined;
    }
    this.isPolling = false;
    this.lastRefreshed = null;
    this.isRefreshing = false;
  }

  private onManualRefresh = () => {
    if (this.pollManager) {
      this.isRefreshing = true;
      void this.pollManager.refresh();
    }
  };

  private async onLogout() {
    try {
      await fetch('/api/auth/session', { method: 'DELETE' });
    } catch {
      // Ignore errors — reload will clear the UI state anyway.
    }
    window.location.reload();
  }

  private async loadCurrentCollection() {
    const token = ++this.collectionLoadToken;
    if (!this.currentCollectionId) {
      this.currentCollection = undefined;
      return;
    }
    try {
      const collection = await this.unscopedClient.getCollection(this.currentCollectionId);
      if (token === this.collectionLoadToken) {
        this.currentCollection = collection;
        this.reconfigurePollInterval();
      }
    } catch (error) {
      if (token === this.collectionLoadToken) {
        this.currentCollection = undefined;
        this.reconfigurePollInterval();
      }
      console.warn('Failed to load current collection', error);
    }
  }

  /**
   * Reconfigure the poll interval based on the current collection's writable
   * status.  Called after currentCollection is set so the interval is correct
   * even when switchToPolling() fired before the collection loaded.
   */
  private reconfigurePollInterval(): void {
    if (this.pollManager) {
      const interval = this.isExternalWritable
        ? 15_000
        : PollManager.DEFAULT_INTERVAL_MS;
      this.pollManager.setInterval(interval);
    }
  }
  private onCollectionSelect = (e: CustomEvent) => {
    const collectionId = e.detail.collectionId as string;
    const url = new URL(window.location.href);
    url.searchParams.set('collection', collectionId);
    // Clear task selection — task IDs are scoped to a collection.
    url.searchParams.delete('task');
    window.history.pushState({}, '', url);
    void this.applyRoute();
  };

  private onPopState = () => {
    void this.applyRoute();
  };

  private removeCollectionFromUrl() {
    const url = new URL(window.location.href);
    url.searchParams.delete('collection');
    url.searchParams.delete('view');
    url.searchParams.delete('task');
    window.history.replaceState({}, '', url);
  }

  /**
   * Update the URL to reflect the current task selection state.
   * Uses replaceState to keep the URL shareable without cluttering
   * browser history with every task click.
   */
  private syncTaskToUrl() {
    const url = new URL(window.location.href);
    if (this.selectedTaskId) {
      url.searchParams.set('task', this.selectedTaskId);
    } else {
      url.searchParams.delete('task');
    }
    window.history.replaceState({}, '', url);
  }

  private onCommandPaletteClose() {
    this.commandPaletteOpen = false;
    this.commandPaletteMode = 'navigate';
    this.addRelationshipTaskId = '';
    this.addRelationshipDefaultType = undefined;
  }

  private onOpenAddRelationship(e: CustomEvent) {
    const { taskId, relationshipType } = e.detail as { taskId: string; relationshipType?: RelationshipType };
    this.addRelationshipTaskId = taskId;
    this.addRelationshipDefaultType = relationshipType;
    this.commandPaletteMode = 'add-relationship';
    this.commandPaletteOpen = true;
  }

  private async onRelationshipAdd(e: CustomEvent) {
    if (this.isReadOnly) return;
    const { targetTaskId, relationshipType } = e.detail as {
      targetTaskId: string;
      relationshipType: RelationshipType;
    };
    const taskId = this.addRelationshipTaskId;
    if (!taskId) return;

    let fields: UpdateTaskFields;
    if (relationshipType === RelationshipType.BLOCKED_BY) {
      fields = { addBlockedBy: [targetTaskId] };
    } else {
      // Default to BLOCKS for any type (BLOCKS is the only other proto-supported type).
      fields = { addBlocks: [targetTaskId] };
    }

    await this.applyTaskUpdate(taskId, fields);
  }

  /**
   * Handle a dependency-drop event from the dependency view.
   * Creates a BLOCKED_BY relationship: the dragged task becomes blocked by
   * the drop-target task.
   */
  private async onDependencyDrop(e: CustomEvent) {
    if (this.isReadOnly) return;
    const { sourceTaskId, targetTaskId } = e.detail as {
      sourceTaskId: string;
      targetTaskId: string;
    };
    await this.applyTaskUpdate(sourceTaskId, { addBlockedBy: [targetTaskId] });
  }

  private onDocumentKeyDown = (e: KeyboardEvent) => {
    // Cmd+K / Ctrl+K — open command palette.
    // Intentionally fires from editable targets (modifier key prevents accidental activation).
    if (e.key === 'k' && (e.metaKey || e.ctrlKey) && !e.defaultPrevented) {
      e.preventDefault();
      if (this.routeView === 'board') {
        if (this.commandPaletteOpen) {
          this.commandPaletteOpen = false;
          this.commandPaletteMode = 'navigate';
          this.addRelationshipTaskId = '';
        } else {
          this.commandPaletteMode = 'navigate';
          this.addRelationshipTaskId = '';
          this.commandPaletteOpen = true;
        }
      }
      return;
    }

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
