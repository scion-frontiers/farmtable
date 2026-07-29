var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { TaskStore } from '../store/task-store.js';
import { TaskStoreController } from '../store/task-store-controller.js';
import { StreamManager } from '../store/stream-manager.js';
import { PollManager } from '../store/poll-manager.js';
import { applyTaskUpdateFields } from '../gen/service.js';
import { Platform, RelationshipType, TaskPhase } from '../gen/types.js';
import { createGrpcFarmTableClientWithOptions } from '../gen/grpc-client.js';
import { getCapabilities } from '../capabilities.js';
import { matchesTaskFilters } from './task-filters.js';
import { isReady } from '../utils/task-ready.js';
import './ft-filter-chips.js';
import './ft-dashboard-view.js';
import './ready-queue/ft-ready-queue-view.js';
import './dependency/ft-dependency-view.js';
import './ft-command-palette.js';
import './ft-login-dialog.js';
/**
 * Default layout orientation for the parent-child Tree View.
 * Used as the fallback when no `?layoutdir=` URL param is present,
 * and as the comparison value when deciding whether to persist the
 * param (omitted when the current value equals this default).
 */
const DEFAULT_LAYOUT_ORIENTATION = 'LR';
let FtApp = class FtApp extends LitElement {
    constructor() {
        super(...arguments);
        this.taskStore = new TaskStore();
        this.storeController = new TaskStoreController(this, this.taskStore);
        this.onStatusChanged = ((e) => {
            this.connectionStatus = e.detail.status;
        });
        this.onWatchUnsupported = (() => {
            this.switchToPolling();
        });
        this.onPollRefreshEnd = ((e) => {
            this.lastRefreshed = e.detail.lastRefreshed;
            this.isRefreshing = false;
        });
        this.onPollRefreshStart = (() => {
            // no-op: background polls should not trigger the refresh spinner
        });
        this.onPollRefreshError = (() => {
            this.isRefreshing = false;
        });
        this.routeToken = 0;
        /**
         * Task ID parsed from the URL's `?task=` param during route application.
         * Stored separately because the task data may not be loaded yet when the
         * URL is first parsed. Applied after the task store emits `snapshot-complete`.
         */
        this._pendingTaskId = null;
        /** Listener bound to the task store's `snapshot-complete` event. */
        this.onSnapshotComplete = () => {
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
        this.currentView = 'dashboard';
        this.routeView = 'validating';
        this.currentCollectionId = null;
        this.collectionErrorMessage = '';
        this.selectedTaskId = null;
        /**
         * Shared Solo (isolate) mode state — sticky across Tree/Dependency view
         * switches. When true, the active view shows only the selected task and
         * its relevant sub-graph (descendants for Tree View, directed reachable
         * nodes for Dependency View). Cleared when selectedTaskId becomes null.
         */
        this.isolateMode = false;
        /**
         * Layout orientation for the parent-child Tree View.
         * 'LR' = left-to-right (default), 'TB' = top-to-bottom.
         * Persisted to the URL as `?layoutdir=TB` (omitted when at the default).
         */
        this.layoutOrientation = DEFAULT_LAYOUT_ORIENTATION;
        this.connectionStatus = 'disconnected';
        this.shortcutOverlayOpen = false;
        this.commandPaletteOpen = false;
        this.commandPaletteMode = 'navigate';
        this.addRelationshipTaskId = '';
        this.addRelationshipDefaultType = undefined;
        this.phaseFilter = null;
        this.assigneeFilter = null;
        this.users = [];
        this.isPolling = false;
        this.lastRefreshed = null;
        this.isRefreshing = false;
        this.dimOverlayVisible = false;
        this.showLogin = false;
        this.sessionUser = null;
        this.dimOverlayTimer = null;
        this.collectionLoadToken = 0;
        this.userLoadToken = 0;
        this.onDimOverlayInteraction = () => {
            this.hideDimOverlay();
        };
        this.onManualRefresh = () => {
            if (this.pollManager) {
                this.isRefreshing = true;
                void this.pollManager.refresh();
            }
        };
        this.onCollectionSelect = (e) => {
            const collectionId = e.detail.collectionId;
            const url = new URL(window.location.href);
            url.searchParams.set('collection', collectionId);
            // Clear task selection, Solo, and layout orientation — task IDs are scoped to a collection.
            url.searchParams.delete('task');
            url.searchParams.delete('solo');
            url.searchParams.delete('layoutdir');
            window.history.pushState({}, '', url);
            void this.applyRoute();
        };
        this.onPopState = () => {
            void this.applyRoute();
        };
        this.onDocumentKeyDown = (e) => {
            // Cmd+K / Ctrl+K — open command palette.
            // Intentionally fires from editable targets (modifier key prevents accidental activation).
            if (e.key === 'k' && (e.metaKey || e.ctrlKey) && !e.defaultPrevented) {
                e.preventDefault();
                if (this.routeView === 'board') {
                    if (this.commandPaletteOpen) {
                        this.commandPaletteOpen = false;
                        this.commandPaletteMode = 'navigate';
                        this.addRelationshipTaskId = '';
                    }
                    else {
                        this.commandPaletteMode = 'navigate';
                        this.addRelationshipTaskId = '';
                        this.commandPaletteOpen = true;
                    }
                }
                return;
            }
            if (e.key !== '?' || e.defaultPrevented)
                return;
            if (this.isEditableEventTarget(e))
                return;
            e.preventDefault();
            this.shortcutOverlayOpen = !this.shortcutOverlayOpen;
        };
    }
    get isReadOnly() {
        if (!this.currentCollection)
            return false;
        if (this.currentCollection.platform === Platform.FARMTABLE)
            return false;
        // External collections: check per-collection writable setting
        return !this.isCollectionWritable(this.currentCollection);
    }
    /**
     * Whether the current collection is a writable external collection.
     * Used by the toolbar to show "↔ GitHub" instead of "🔒 Read-only".
     */
    get isExternalWritable() {
        if (!this.currentCollection)
            return false;
        if (this.currentCollection.platform === Platform.FARMTABLE)
            return false;
        return this.isCollectionWritable(this.currentCollection);
    }
    /**
     * Per-operation capability flags for the current collection.
     * Farmtable collections get ALL_ENABLED; writable GitHub collections get
     * GITHUB_CAPABILITIES (with unmappable operations disabled); everything
     * else gets ALL_DISABLED.
     */
    get capabilities() {
        if (!this.currentCollection)
            return undefined;
        return getCapabilities(this.currentCollection);
    }
    isCollectionWritable(coll) {
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
    async checkSessionAndRoute() {
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
                const data = await response.json();
                this.sessionUser = data;
                this.showLogin = false;
            }
            else if (response.status === 404) {
                // Session endpoints not available (open access mode).
                // Proceed without session.
                this.showLogin = false;
            }
            else {
                this.showLogin = true;
                return; // Don't route until authenticated.
            }
        }
        catch {
            // Network error or session endpoints not configured — proceed.
            this.showLogin = false;
        }
        void this.applyRoute();
    }
    render() {
        if (this.showLogin) {
            return html `<ft-login-dialog></ft-login-dialog>`;
        }
        if (this.routeView !== 'board') {
            return html `
        ${this.routeView === 'validating'
                ? html `<div class="placeholder"><sl-spinner style="font-size: 2rem;"></sl-spinner></div>`
                : html `
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
        const filteredCount = this.phaseFilter !== null || this.assigneeFilter !== null
            ? allTasks.filter((task) => matchesTaskFilters(task, this.phaseFilter, this.assigneeFilter))
                .length
            : totalCount;
        return html `
      <ft-toolbar
        .currentView=${this.currentView}
        .connectionStatus=${this.connectionStatus}
        .client=${this.client}
        .unscopedClient=${this.unscopedClient}
        .collectionId=${this.currentCollectionId ?? ''}
        .phaseFilter=${this.phaseFilter}
        .assigneeFilter=${this.assigneeFilter}
        .layoutOrientation=${this.layoutOrientation}
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
          ${this.dimOverlayVisible ? html `<div class="dim-overlay"></div>` : null}
        </div>

        ${this.selectedTaskId
            ? html `
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
    renderMainView() {
        if (this.taskStore.isLoading) {
            return html `<div class="placeholder"><sl-spinner style="font-size: 2rem;"></sl-spinner></div>`;
        }
        switch (this.currentView) {
            case 'dashboard':
                return html `
          <ft-dashboard-view
            .store=${this.taskStore}
            @view-change=${this.onViewChange}
          ></ft-dashboard-view>
        `;
            case 'ready-queue':
                return html `
          <ft-ready-queue-view
            .store=${this.taskStore}
            .phaseFilter=${this.phaseFilter}
            .assigneeFilter=${this.assigneeFilter}
            selected-task-id=${this.selectedTaskId ?? ''}
            @task-select=${this.onTaskSelect}
          ></ft-ready-queue-view>
        `;
            case 'dependencies':
                return html `
          <ft-dependency-view
            .store=${this.taskStore}
            ?readOnly=${this.isReadOnly}
            ?isolateMode=${this.isolateMode}
            selected-task-id=${this.selectedTaskId ?? ''}
            @task-select=${this.onTaskSelect}
            @dependency-drop=${this.onDependencyDrop}
            @isolate-toggle=${this.onIsolateToggle}
          ></ft-dependency-view>
        `;
            case 'tree':
                return html `
          <ft-tree-view
            .store=${this.taskStore}
            .client=${this.client}
            .phaseFilter=${this.phaseFilter}
            .assigneeFilter=${this.assigneeFilter}
            ?readOnly=${this.isReadOnly}
            ?isolateMode=${this.isolateMode}
            .layoutOrientation=${this.layoutOrientation}
            .capabilities=${this.capabilities}
            selected-task-id=${this.selectedTaskId ?? ''}
            @task-select=${this.onTaskSelect}
            @write-error=${this.onWriteError}
            @isolate-toggle=${this.onIsolateToggle}
            @layout-orientation-toggle=${this.onLayoutOrientationToggle}
          ></ft-tree-view>
        `;
            case 'kanban':
            default:
                return html `
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
    onViewChange(e) {
        const view = e.detail.view;
        const url = new URL(window.location.href);
        url.searchParams.set('view', view);
        window.history.pushState({}, '', url);
        // Skip applyRoute() — view-only change doesn't need collection revalidation.
        this.currentView = view;
        if (this.selectedTaskId && !this.isTaskVisibleInCurrentView(this.selectedTaskId)) {
            this.showDimOverlay();
        }
        else {
            this.hideDimOverlay();
        }
    }
    onFilterChange(e) {
        const { phase, assigneeId } = e.detail;
        this.phaseFilter = phase;
        this.assigneeFilter = assigneeId;
        if (this.selectedTaskId && !this.isTaskVisibleInCurrentView(this.selectedTaskId)) {
            this.showDimOverlay();
        }
        else {
            this.hideDimOverlay();
        }
    }
    async loadUsers() {
        // TODO: ft-toolbar also calls listUsers() independently. Consider consolidating
        // into a single app-level user list passed to both toolbar and filter chips.
        const token = ++this.userLoadToken;
        try {
            const users = await this.client.listUsers();
            if (token === this.userLoadToken) {
                this.users = users;
            }
        }
        catch (error) {
            if (token === this.userLoadToken) {
                this.users = [];
            }
            console.warn('Failed to load active filter chip users', error);
        }
    }
    onTaskSelect(e) {
        this.selectedTaskId = e.detail.taskId;
        this.syncTaskToUrl();
        if (this.selectedTaskId && !this.isTaskVisibleInCurrentView(this.selectedTaskId)) {
            this.showDimOverlay();
        }
        else {
            this.hideDimOverlay();
        }
    }
    /**
     * Check whether the selected task would appear in the currently active view.
     * Used to decide whether to show a dim overlay indicating the task is
     * not scrollable-to in the main panel.
     */
    isTaskVisibleInCurrentView(taskId) {
        const task = this.taskStore.getTask(taskId);
        if (!task)
            return false;
        // Dashboard has no individual task selection.
        if (this.currentView === 'dashboard')
            return false;
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
                    if (rel.type !== RelationshipType.BLOCKED_BY)
                        continue;
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
        // Ready-queue only shows tasks that the Phase 1 availability model marks available.
        if (this.currentView === 'ready-queue') {
            return isReady(task, this.taskStore);
        }
        return true;
    }
    showDimOverlay() {
        this.dimOverlayVisible = true;
        this.clearDimOverlayTimer();
        this.dimOverlayTimer = setTimeout(() => {
            this.hideDimOverlay();
        }, 2500);
        // Defer listener registration so the triggering event itself doesn't
        // immediately dismiss the overlay.
        requestAnimationFrame(() => {
            if (!this.dimOverlayVisible)
                return;
            document.addEventListener('click', this.onDimOverlayInteraction, { capture: true });
            document.addEventListener('keydown', this.onDimOverlayInteraction, { capture: true });
        });
    }
    hideDimOverlay() {
        this.dimOverlayVisible = false;
        this.clearDimOverlayTimer();
        document.removeEventListener('click', this.onDimOverlayInteraction, { capture: true });
        document.removeEventListener('keydown', this.onDimOverlayInteraction, { capture: true });
    }
    clearDimOverlayTimer() {
        if (this.dimOverlayTimer) {
            clearTimeout(this.dimOverlayTimer);
            this.dimOverlayTimer = null;
        }
    }
    async onTaskUpdate(e) {
        if (this.isReadOnly)
            return;
        const { taskId, fields } = e.detail;
        await this.applyTaskUpdate(taskId, fields);
    }
    async applyTaskUpdate(taskId, fields) {
        const task = this.taskStore.getTask(taskId);
        if (!task)
            return;
        const updated = applyTaskUpdateFields(task, fields);
        this.taskStore.upsert(updated);
        this.pollManager?.markDirty(taskId);
        // Synthesize reciprocal relationships on target tasks so the UI reflects them instantly.
        const reciprocalSnapshots = [];
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
                    const removedTypes = new Set(task.relationships
                        .filter(r => r.targetTaskId === targetId)
                        .map(r => r.type === RelationshipType.BLOCKS ? RelationshipType.BLOCKED_BY
                        : r.type === RelationshipType.BLOCKED_BY ? RelationshipType.BLOCKS
                            : r.type));
                    this.taskStore.upsert({
                        ...target,
                        relationships: target.relationships.filter(r => !(r.targetTaskId === taskId && removedTypes.has(r.type))),
                    });
                }
            }
        }
        try {
            await this.client.updateTask(taskId, fields);
        }
        catch (error) {
            // TODO(ui-feedback): Show a toast/snackbar when an optimistic save rolls back.
            console.warn('Failed to update task; rolled back optimistic change', error);
            this.taskStore.upsert(task);
            // Roll back reciprocal changes on target tasks.
            for (const snap of reciprocalSnapshots) {
                this.taskStore.upsert(snap.original);
            }
            this.showWriteError(error);
        }
        finally {
            this.pollManager?.clearDirty(taskId);
        }
    }
    /** Map a write error to a user-friendly message and show it as a toast. */
    showWriteError(error) {
        const raw = error instanceof Error
            ? error.message
            : typeof error === 'string'
                ? error
                : String(error);
        let message;
        if (/permission|403|forbidden/i.test(raw)) {
            message = 'GitHub rejected this edit — your token may not have write access';
        }
        else if (/rate.?limit|429|too many requests/i.test(raw)) {
            message = 'GitHub rate limit reached — please wait before making more edits';
        }
        else if (/network|fetch|ECONNREFUSED|unavailable|deadline/i.test(raw)) {
            message = 'Could not reach the server — your change will retry on the next sync';
        }
        else {
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
        void alert.toast();
    }
    onWriteError(e) {
        this.showWriteError(e.detail.error);
    }
    onIsolateToggle(e) {
        this.isolateMode = e.detail.isolateMode;
        this.syncSoloToUrl();
    }
    onLayoutOrientationToggle(e) {
        this.layoutOrientation = e.detail.layoutOrientation;
        this.syncLayoutDirToUrl();
    }
    onInspectorClose() {
        this.selectedTaskId = null;
        if (this.isolateMode) {
            this.isolateMode = false;
            this.syncSoloToUrl();
        }
        this.syncTaskToUrl();
        this.hideDimOverlay();
    }
    onShortcutHelpOpen() {
        this.shortcutOverlayOpen = true;
    }
    onShortcutHelpClose() {
        this.shortcutOverlayOpen = false;
    }
    async applyRoute() {
        const token = ++this.routeToken;
        const params = new URLSearchParams(window.location.search);
        const collectionId = params.get('collection');
        const viewParam = params.get('view');
        const taskParam = params.get('task');
        const soloParam = params.get('solo');
        const layoutdirParam = params.get('layoutdir');
        const VALID_VIEWS = new Set(['kanban', 'tree', 'dashboard', 'ready-queue', 'dependencies']);
        // When the URL has a ?task= deep-link but no explicit ?view= param,
        // default to kanban (which supports task selection/highlighting) instead
        // of dashboard (which doesn't). This preserves Feature 62's task deep-link
        // UX while still defaulting to dashboard for normal navigation.
        const defaultView = taskParam && !viewParam ? 'kanban' : 'dashboard';
        this.currentView = VALID_VIEWS.has(viewParam ?? '') ? viewParam : defaultView;
        if (!collectionId) {
            this.showCollectionList('');
            return;
        }
        // Store pending task ID from URL — it will be applied once the task
        // store finishes its initial snapshot (tasks may not be loaded yet).
        this._pendingTaskId = taskParam || null;
        // Restore Solo mode from URL. Solo requires a task to be selected,
        // so it only takes effect when there is a pending task ID.
        this.isolateMode = soloParam === '1' && !!this._pendingTaskId;
        // Restore tree layout orientation from URL.
        // If the param is a valid orientation value, use it; otherwise fall
        // back to the default. This is generic — only the constant needs to
        // change if the default ever moves again.
        this.layoutOrientation =
            layoutdirParam === 'TB' || layoutdirParam === 'LR'
                ? layoutdirParam
                : DEFAULT_LAYOUT_ORIENTATION;
        this.routeView = 'validating';
        this.collectionErrorMessage = '';
        try {
            await this.unscopedClient.getCollection(collectionId);
            if (token !== this.routeToken)
                return;
            this.showBoard(collectionId);
        }
        catch (error) {
            if (token !== this.routeToken)
                return;
            console.warn('Collection from URL was not found', error);
            this.removeCollectionFromUrl();
            this.showCollectionList('Collection not found. Choose an available collection.');
        }
    }
    showCollectionList(errorMessage) {
        this.stopStream();
        this.stopPolling();
        this.taskStore.removeEventListener('snapshot-complete', this.onSnapshotComplete);
        this._pendingTaskId = null;
        this.client = this.unscopedClient;
        this.currentCollectionId = null;
        this.taskStore.clear();
        this.selectedTaskId = null;
        this.isolateMode = false;
        this.users = [];
        this.currentCollection = undefined;
        this.connectionStatus = 'disconnected';
        this.collectionErrorMessage = errorMessage;
        this.routeView = 'landing';
    }
    showBoard(collectionId) {
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
    stopStream() {
        this.streamManager?.removeEventListener('status-changed', this.onStatusChanged);
        this.streamManager?.removeEventListener('watch-unsupported', this.onWatchUnsupported);
        this.streamManager?.stop();
        this.streamManager = undefined;
    }
    /**
     * Called when WatchTasks returns Unimplemented for this collection.
     * Tears down the stream and starts periodic ListTasks polling.
     */
    switchToPolling() {
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
    stopPolling() {
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
    async onLogout() {
        try {
            await fetch('/api/auth/session', { method: 'DELETE' });
        }
        catch {
            // Ignore errors — reload will clear the UI state anyway.
        }
        window.location.reload();
    }
    async loadCurrentCollection() {
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
        }
        catch (error) {
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
    reconfigurePollInterval() {
        if (this.pollManager) {
            const interval = this.isExternalWritable
                ? 15_000
                : PollManager.DEFAULT_INTERVAL_MS;
            this.pollManager.setInterval(interval);
        }
    }
    removeCollectionFromUrl() {
        const url = new URL(window.location.href);
        url.searchParams.delete('collection');
        url.searchParams.delete('view');
        url.searchParams.delete('task');
        url.searchParams.delete('solo');
        url.searchParams.delete('layoutdir');
        window.history.replaceState({}, '', url);
    }
    /**
     * Update the URL to reflect the current task selection state.
     * Uses replaceState to keep the URL shareable without cluttering
     * browser history with every task click.
     */
    syncTaskToUrl() {
        const url = new URL(window.location.href);
        if (this.selectedTaskId) {
            url.searchParams.set('task', this.selectedTaskId);
        }
        else {
            url.searchParams.delete('task');
        }
        window.history.replaceState({}, '', url);
    }
    /**
     * Update the URL to reflect the current Solo (isolate) mode state.
     * When Solo is active, adds `&solo=1` to make the state deep-linkable.
     */
    syncSoloToUrl() {
        const url = new URL(window.location.href);
        if (this.isolateMode) {
            url.searchParams.set('solo', '1');
        }
        else {
            url.searchParams.delete('solo');
        }
        window.history.replaceState({}, '', url);
    }
    /**
     * Update the URL to reflect the current tree layout orientation.
     * Omits the param when the orientation matches the compile-time
     * default; adds it explicitly when it differs.  Generic — if
     * `DEFAULT_LAYOUT_ORIENTATION` changes, no logic update needed here.
     */
    syncLayoutDirToUrl() {
        const url = new URL(window.location.href);
        if (this.layoutOrientation !== DEFAULT_LAYOUT_ORIENTATION) {
            url.searchParams.set('layoutdir', this.layoutOrientation);
        }
        else {
            url.searchParams.delete('layoutdir');
        }
        window.history.replaceState({}, '', url);
    }
    onCommandPaletteClose() {
        this.commandPaletteOpen = false;
        this.commandPaletteMode = 'navigate';
        this.addRelationshipTaskId = '';
        this.addRelationshipDefaultType = undefined;
    }
    onOpenAddRelationship(e) {
        const { taskId, relationshipType } = e.detail;
        this.addRelationshipTaskId = taskId;
        this.addRelationshipDefaultType = relationshipType;
        this.commandPaletteMode = 'add-relationship';
        this.commandPaletteOpen = true;
    }
    async onRelationshipAdd(e) {
        if (this.isReadOnly)
            return;
        const { targetTaskId, relationshipType } = e.detail;
        const taskId = this.addRelationshipTaskId;
        if (!taskId)
            return;
        let fields;
        if (relationshipType === RelationshipType.BLOCKED_BY) {
            fields = { addBlockedBy: [targetTaskId] };
        }
        else {
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
    async onDependencyDrop(e) {
        if (this.isReadOnly)
            return;
        const { sourceTaskId, targetTaskId } = e.detail;
        await this.applyTaskUpdate(sourceTaskId, { addBlockedBy: [targetTaskId] });
    }
    isEditableEventTarget(e) {
        const path = e.composedPath();
        return path.some((target) => {
            if (!(target instanceof HTMLElement))
                return false;
            const tagName = target.tagName.toLowerCase();
            return (target.isContentEditable ||
                tagName === 'input' ||
                tagName === 'textarea' ||
                tagName === 'select' ||
                tagName === 'sl-input' ||
                tagName === 'sl-textarea' ||
                tagName === 'sl-select');
        });
    }
};
FtApp.styles = css `
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
__decorate([
    state()
], FtApp.prototype, "currentView", void 0);
__decorate([
    state()
], FtApp.prototype, "routeView", void 0);
__decorate([
    state()
], FtApp.prototype, "currentCollectionId", void 0);
__decorate([
    state()
], FtApp.prototype, "collectionErrorMessage", void 0);
__decorate([
    state()
], FtApp.prototype, "selectedTaskId", void 0);
__decorate([
    state()
], FtApp.prototype, "isolateMode", void 0);
__decorate([
    state()
], FtApp.prototype, "layoutOrientation", void 0);
__decorate([
    state()
], FtApp.prototype, "connectionStatus", void 0);
__decorate([
    state()
], FtApp.prototype, "shortcutOverlayOpen", void 0);
__decorate([
    state()
], FtApp.prototype, "commandPaletteOpen", void 0);
__decorate([
    state()
], FtApp.prototype, "commandPaletteMode", void 0);
__decorate([
    state()
], FtApp.prototype, "addRelationshipTaskId", void 0);
__decorate([
    state()
], FtApp.prototype, "addRelationshipDefaultType", void 0);
__decorate([
    state()
], FtApp.prototype, "phaseFilter", void 0);
__decorate([
    state()
], FtApp.prototype, "assigneeFilter", void 0);
__decorate([
    state()
], FtApp.prototype, "users", void 0);
__decorate([
    state()
], FtApp.prototype, "isPolling", void 0);
__decorate([
    state()
], FtApp.prototype, "lastRefreshed", void 0);
__decorate([
    state()
], FtApp.prototype, "isRefreshing", void 0);
__decorate([
    state()
], FtApp.prototype, "currentCollection", void 0);
__decorate([
    state()
], FtApp.prototype, "dimOverlayVisible", void 0);
__decorate([
    state()
], FtApp.prototype, "showLogin", void 0);
__decorate([
    state()
], FtApp.prototype, "sessionUser", void 0);
FtApp = __decorate([
    customElement('ft-app')
], FtApp);
export { FtApp };
//# sourceMappingURL=ft-app.js.map