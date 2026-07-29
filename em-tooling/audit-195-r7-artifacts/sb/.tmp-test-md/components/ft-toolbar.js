var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { LitElement, html, css } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';
import { Platform, TaskPhase } from '../gen/types.js';
import { platformLabel } from '../util/platform-label.js';
import { UNASSIGNED_FILTER_VALUE } from './task-filters.js';
import './ft-collection-picker.js';
import './ft-new-collection-dialog.js';
import './ft-collection-settings-dialog.js';
import './ft-import-collection-dialog.js';
// UNSPECIFIED is the protobuf default, not a user-selectable task phase.
const PHASE_OPTIONS = [
    { value: TaskPhase.OPEN, label: 'Open' },
    { value: TaskPhase.IN_PROGRESS, label: 'In Progress' },
    { value: TaskPhase.ON_HOLD, label: 'On Hold' },
    { value: TaskPhase.CLOSED, label: 'Closed' },
];
let FtToolbar = class FtToolbar extends LitElement {
    constructor() {
        super(...arguments);
        this.currentView = 'kanban';
        this.connectionStatus = 'disconnected';
        this.collectionId = '';
        this.readOnly = false;
        this.externalWritable = false;
        this.phaseFilter = null;
        this.assigneeFilter = null;
        this.isPolling = false;
        this.lastRefreshed = null;
        this.isRefreshing = false;
        this.sessionUser = null;
        /** Layout orientation for the Tree View: 'TB' (top-to-bottom) or 'LR' (left-to-right). */
        this.layoutOrientation = 'TB';
        this.isDark = document.documentElement.classList.contains('sl-theme-dark');
        this.users = [];
        this.usersLoading = false;
        this.exporting = false;
        this.userLoadToken = 0;
        this.collectionLoadToken = 0;
    }
    updated(changedProps) {
        if (changedProps.has('client')) {
            void this.loadUsers();
        }
        if (changedProps.has('unscopedClient') || changedProps.has('collectionId')) {
            void this.loadCurrentCollection();
        }
    }
    render() {
        // Tree view and dashboard view do not consume task filters, so keep the
        // current filter state visible but disabled.
        const filtersDisabled = this.currentView === 'tree' || this.currentView === 'dashboard' || this.currentView === 'dependencies';
        return html `
      <div class="collection-controls">
        <ft-collection-picker
          .client=${this.unscopedClient}
          .collectionId=${this.collectionId}
          @collection-select=${this.onCollectionSelect}
        ></ft-collection-picker>
        <sl-icon-button
          class="toolbar-icon-button"
          name="plus-circle"
          label="New collection"
          @click=${this.onNewCollectionClick}
        ></sl-icon-button>
        ${this.currentCollection?.platform === Platform.FARMTABLE
            ? html `
              <sl-icon-button
                class="toolbar-icon-button"
                name="gear"
                label="Collection settings"
                @click=${this.onCollectionSettingsClick}
              ></sl-icon-button>
              <sl-icon-button
                class="toolbar-icon-button"
                name="download"
                label="Export collection"
                ?loading=${this.exporting}
                @click=${this.onExportClick}
              ></sl-icon-button>
            `
            : null}
        ${this.currentCollection && this.currentCollection.platform !== Platform.FARMTABLE
            ? this.renderExternalLink(this.currentCollection)
            : null}
        <sl-icon-button
          class="toolbar-icon-button"
          name="upload"
          label="Import collection"
          @click=${this.onImportClick}
        ></sl-icon-button>
        ${this.externalWritable
            ? html `<span class="platform-badge">↔ GitHub</span>`
            : this.readOnly
                ? html `<span class="read-only-badge"><sl-icon name="lock"></sl-icon>Read-only</span>`
                : null}
      </div>

      <span class="title">Farm Table</span>

      <div class="filters">
        <sl-select
          placeholder="Phase"
          size="small"
          clearable
          hoist
          value=${this.phaseFilter === null ? '' : String(this.phaseFilter)}
          ?disabled=${filtersDisabled}
          @sl-change=${this.onPhaseFilterChange}
        >
          ${PHASE_OPTIONS.map((option) => html `
              <sl-option value=${String(option.value)}>${option.label}</sl-option>
            `)}
        </sl-select>

        <sl-select
          placeholder="Assignee"
          size="small"
          clearable
          hoist
          value=${this.assigneeFilter ?? ''}
          ?disabled=${filtersDisabled}
          @sl-change=${this.onAssigneeFilterChange}
        >
          ${this.usersLoading
            ? html `<sl-option value="" disabled>Loading users...</sl-option>`
            : null}
          <sl-option value=${UNASSIGNED_FILTER_VALUE}>Unassigned</sl-option>
          ${this.users.map((user) => html `
              <sl-option value=${user.id}>${user.name || user.email || user.id}</sl-option>
            `)}
        </sl-select>
      </div>

      <sl-radio-group
        class="view-switcher"
        value=${this.currentView}
        size="small"
        @sl-change=${this.onViewChange}
      >
        <sl-tooltip content="Dashboard view">
          <sl-radio-button value="dashboard" aria-label="Dashboard view">
            <sl-icon name="grid" label="Dashboard view"></sl-icon>
          </sl-radio-button>
        </sl-tooltip>
        <sl-tooltip content="Kanban view">
          <sl-radio-button value="kanban" aria-label="Kanban view">
            <sl-icon name="kanban" label="Kanban view"></sl-icon>
          </sl-radio-button>
        </sl-tooltip>
        <sl-tooltip content="Tree view">
          <sl-radio-button value="tree" aria-label="Tree view">
            <sl-icon name="diagram-3" label="Tree view"></sl-icon>
          </sl-radio-button>
        </sl-tooltip>
        <sl-tooltip content="Dependencies view">
          <sl-radio-button value="dependencies" aria-label="Dependencies view">
            <sl-icon name="diagram-3" label="Dependencies view" style="transform: rotate(90deg)"></sl-icon>
          </sl-radio-button>
        </sl-tooltip>
        <sl-tooltip content="Available Queue">
          <sl-radio-button value="ready-queue" aria-label="Available Queue">
            <sl-icon name="list-check" label="Available Queue"></sl-icon>
          </sl-radio-button>
        </sl-tooltip>
      </sl-radio-group>

      <sl-icon-button
        class="toolbar-icon-button"
        name=${this.isDark ? 'sun' : 'moon'}
        label=${this.isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        @click=${this.onToggleTheme}
      ></sl-icon-button>

      <sl-icon-button
        class="toolbar-icon-button"
        name="question-circle"
        label="Show keyboard shortcuts"
        @click=${this.onShortcutHelpClick}
      ></sl-icon-button>

      ${this.isPolling ? this.renderRefreshControls() : null}

      <ft-connection-badge .status=${this.connectionStatus}></ft-connection-badge>

      ${this.sessionUser ? html `
        <span class="user-badge">
          <sl-icon name="person-circle"></sl-icon>
          ${this.sessionUser.userName || this.sessionUser.email || 'User'}
        </span>
        <sl-tooltip content="Sign out">
          <sl-icon-button
            class="toolbar-icon-button"
            name="box-arrow-right"
            label="Sign out"
            @click=${this.onLogoutClick}
          ></sl-icon-button>
        </sl-tooltip>
      ` : null}

      <ft-new-collection-dialog
        @collection-create=${this.onCollectionCreate}
      ></ft-new-collection-dialog>
      <ft-collection-settings-dialog
        @collection-update=${this.onCollectionUpdate}
      ></ft-collection-settings-dialog>
      <ft-import-collection-dialog
        .client=${this.unscopedClient}
        @collection-import=${this.onCollectionImport}
      ></ft-import-collection-dialog>
    `;
    }
    renderRefreshControls() {
        return html `
      <div class="refresh-controls">
        <sl-tooltip content="Refresh tasks now">
          <sl-button
            size="small"
            variant="default"
            ?loading=${this.isRefreshing}
            ?disabled=${this.isRefreshing}
            @click=${this.onRefreshClick}
          >
            <sl-icon slot="prefix" name="arrow-clockwise"></sl-icon>
            Refresh
          </sl-button>
        </sl-tooltip>
        ${this.lastRefreshed
            ? html `<span class="last-refreshed">Updated ${this.formatRelativeTime(this.lastRefreshed)}</span>`
            : null}
      </div>
    `;
    }
    onRefreshClick() {
        this.dispatchEvent(new CustomEvent('manual-refresh', { bubbles: true, composed: true }));
    }
    formatRelativeTime(date) {
        const diffSec = Math.floor((Date.now() - date.getTime()) / 1000);
        if (diffSec < 5)
            return 'just now';
        if (diffSec < 60)
            return `${diffSec}s ago`;
        const diffMin = Math.floor(diffSec / 60);
        if (diffMin < 60)
            return `${diffMin}m ago`;
        return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    }
    async onNewCollectionClick() {
        await this.newCollectionDialog.show();
    }
    async onCollectionSettingsClick() {
        if (!this.unscopedClient || !this.collectionId)
            return;
        try {
            const collection = this.currentCollection ?? await this.unscopedClient.getCollection(this.collectionId);
            await this.collectionSettingsDialog.show(collection);
        }
        catch (error) {
            console.warn('Failed to load collection settings', error);
        }
    }
    renderExternalLink(collection) {
        const GITHUB_REPO_RE = /^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/;
        if (collection.platform === Platform.GITHUB && collection.remoteId && GITHUB_REPO_RE.test(collection.remoteId)) {
            const url = `https://github.com/${collection.remoteId}`;
            return html `
        <a href=${url} target="_blank" rel="noopener" class="external-link" title="View on GitHub">
          <sl-icon name="box-arrow-up-right"></sl-icon>
          <span>View on GitHub</span>
        </a>
      `;
        }
        // Other non-farmtable platforms (or GitHub without valid remoteId): show badge without link.
        if (collection.platform !== Platform.FARMTABLE) {
            return html `
        <span class="platform-badge">${platformLabel(collection.platform)}</span>
      `;
        }
        return null;
    }
    async onExportClick() {
        if (this.exporting || !this.unscopedClient || !this.collectionId)
            return;
        this.exporting = true;
        try {
            const result = await this.unscopedClient.exportCollection(this.collectionId, false);
            const collName = this.currentCollection?.name ?? 'collection';
            const safeName = collName.replace(/[^a-zA-Z0-9_-]/g, '-');
            const date = new Date().toISOString().slice(0, 10);
            const filename = safeName + '-' + date + '.json';
            const jsonString = new TextDecoder().decode(result.data);
            const blob = new Blob([jsonString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            if (result.warnings.length > 0) {
                this.showToast('warning', 'Export warnings: ' + result.warnings.join(', '));
            }
        }
        catch (error) {
            this.showToast('danger', 'Export failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
        }
        finally {
            this.exporting = false;
        }
    }
    onImportClick() {
        void this.importCollectionDialog.show();
    }
    async onCollectionCreate(e) {
        const dialog = this.newCollectionDialog;
        if (!this.unscopedClient) {
            dialog.setError('Service not available. Please reload.');
            return;
        }
        dialog.setError('');
        dialog.setCreating(true);
        try {
            const collection = await this.unscopedClient.createCollection(e.detail.name);
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
    onCollectionImport(e) {
        this.importCollectionDialog.close();
        this.showToast('success', e.detail.message);
        this.dispatchEvent(new CustomEvent('collection-select', {
            detail: { collectionId: e.detail.collectionId },
            bubbles: true,
            composed: true,
        }));
    }
    async onCollectionUpdate(e) {
        const dialog = this.collectionSettingsDialog;
        if (!this.unscopedClient) {
            dialog.setError('Service not available. Please reload.');
            return;
        }
        dialog.setError('');
        dialog.setSaving(true);
        try {
            const fields = {};
            if (!this.currentCollection || e.detail.name !== this.currentCollection.name) {
                fields.name = e.detail.name;
            }
            if (e.detail.description !== (this.currentCollection?.description ?? '')) {
                fields.description = e.detail.description;
            }
            const collection = await this.unscopedClient.updateCollection(e.detail.id, fields);
            this.currentCollection = collection;
            dialog.close();
            await this.collectionPicker.refresh();
        }
        catch (error) {
            dialog.setError('Failed to update collection. Please try again.');
            console.warn('Failed to update collection', error);
        }
        finally {
            dialog.setSaving(false);
        }
    }
    async loadCurrentCollection() {
        const token = ++this.collectionLoadToken;
        if (!this.unscopedClient || !this.collectionId) {
            this.currentCollection = undefined;
            return;
        }
        try {
            const collection = await this.unscopedClient.getCollection(this.collectionId);
            if (token === this.collectionLoadToken) {
                this.currentCollection = collection;
            }
        }
        catch (error) {
            if (token === this.collectionLoadToken) {
                this.currentCollection = undefined;
            }
            console.warn('Failed to load current collection for toolbar', error);
        }
    }
    onToggleTheme() {
        this.isDark = !this.isDark;
        document.documentElement.classList.toggle('sl-theme-dark', this.isDark);
        localStorage.setItem('ft-theme', this.isDark ? 'dark' : 'light');
    }
    onViewChange(e) {
        const target = e.target;
        this.dispatchEvent(new CustomEvent('view-change', {
            detail: { view: target.value },
            bubbles: true,
            composed: true,
        }));
    }
    onCollectionSelect(e) {
        e.stopPropagation();
        this.dispatchEvent(new CustomEvent('collection-select', {
            detail: e.detail,
            bubbles: true,
            composed: true,
        }));
    }
    async loadUsers() {
        const token = ++this.userLoadToken;
        if (!this.client) {
            this.users = [];
            this.usersLoading = false;
            return;
        }
        this.usersLoading = true;
        try {
            const users = await this.client.listUsers();
            if (token === this.userLoadToken) {
                this.users = users;
                this.usersLoading = false;
            }
        }
        catch (error) {
            if (token === this.userLoadToken) {
                this.users = [];
                this.usersLoading = false;
            }
            console.warn('Failed to load toolbar assignee filters', error);
        }
    }
    onPhaseFilterChange(e) {
        const value = this.selectValue(e);
        this.dispatchFilterChange({
            phase: value ? Number(value) : null,
            assigneeId: this.assigneeFilter,
        });
    }
    onAssigneeFilterChange(e) {
        const value = this.selectValue(e);
        this.dispatchFilterChange({
            phase: this.phaseFilter,
            assigneeId: value || null,
        });
    }
    selectValue(e) {
        const target = e.currentTarget;
        return Array.isArray(target.value) ? target.value[0] ?? '' : target.value;
    }
    dispatchFilterChange(detail) {
        this.dispatchEvent(new CustomEvent('filter-change', {
            detail,
            bubbles: true,
            composed: true,
        }));
    }
    onShortcutHelpClick() {
        this.dispatchEvent(new CustomEvent('shortcut-help-open', {
            bubbles: true,
            composed: true,
        }));
    }
    onLogoutClick() {
        this.dispatchEvent(new CustomEvent('logout', {
            bubbles: true,
            composed: true,
        }));
    }
    showToast(variant, message) {
        const alert = Object.assign(document.createElement('sl-alert'), {
            variant,
            closable: true,
            duration: 5000,
        });
        const icon = document.createElement('sl-icon');
        icon.slot = 'icon';
        icon.setAttribute('name', variant === 'danger' ? 'exclamation-triangle' : 'info-circle');
        alert.append(icon, document.createTextNode(message));
        document.body.appendChild(alert);
        void alert.toast();
    }
};
FtToolbar.styles = css `
    :host {
      display: flex;
      align-items: center;
      position: relative;
      z-index: 100;
      padding: 0.75rem 1rem;
      gap: 1rem;
      border-bottom: 1px solid var(--sl-color-neutral-200);
      background: var(--sl-color-neutral-50);
    }
    .title {
      font-weight: 600;
      font-size: 1.1rem;
      margin-right: auto;
    }
    .collection-controls {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .filters {
      display: flex;
      gap: 0.5rem;
      align-items: center;
    }
    sl-select {
      min-width: 120px;
    }
    .toolbar-icon-button {
      cursor: pointer;
      font-size: 1.25rem;
      color: var(--sl-color-neutral-600);
    }
    .toolbar-icon-button:hover {
      color: var(--sl-color-neutral-900);
    }
    .external-link {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      font-size: 0.8rem;
      color: var(--sl-color-primary-600);
      text-decoration: none;
      padding: 0.125rem 0.5rem;
      border-radius: var(--sl-border-radius-small);
      background: var(--sl-color-primary-50);
    }
    .external-link:hover {
      color: var(--sl-color-primary-700);
      background: var(--sl-color-primary-100);
    }
    .external-link sl-icon {
      font-size: 0.75rem;
    }
    .platform-badge {
      font-size: 0.75rem;
      padding: 0.125rem 0.5rem;
      border-radius: var(--sl-border-radius-small);
      background: var(--sl-color-neutral-100);
      color: var(--sl-color-neutral-700);
    }
    .refresh-controls {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .last-refreshed {
      font-size: 0.75rem;
      color: var(--sl-color-neutral-500);
      white-space: nowrap;
    }
    .read-only-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      font-size: 0.75rem;
      padding: 0.125rem 0.5rem;
      border-radius: var(--sl-border-radius-small);
      background: var(--sl-color-warning-100);
      color: var(--sl-color-warning-700);
      font-weight: 500;
    }
    .read-only-badge sl-icon {
      font-size: 0.75rem;
    }
    .view-switcher sl-radio-button::part(button) {
      padding: 0.25rem 0.5rem;
      font-size: 1.1rem;
      line-height: 1;
      min-width: 2rem;
      min-height: 2rem;
    }
    .view-switcher sl-radio-button::part(label) {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0;
    }
    .user-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      font-size: 0.8rem;
      color: var(--sl-color-neutral-700);
      padding: 0.125rem 0.5rem;
      border-radius: var(--sl-border-radius-small);
      background: var(--sl-color-neutral-100);
      white-space: nowrap;
    }
    .user-badge sl-icon {
      font-size: 0.9rem;
    }
  `;
__decorate([
    property()
], FtToolbar.prototype, "currentView", void 0);
__decorate([
    property()
], FtToolbar.prototype, "connectionStatus", void 0);
__decorate([
    property({ attribute: false })
], FtToolbar.prototype, "client", void 0);
__decorate([
    property({ attribute: false })
], FtToolbar.prototype, "unscopedClient", void 0);
__decorate([
    property()
], FtToolbar.prototype, "collectionId", void 0);
__decorate([
    property({ type: Boolean })
], FtToolbar.prototype, "readOnly", void 0);
__decorate([
    property({ type: Boolean })
], FtToolbar.prototype, "externalWritable", void 0);
__decorate([
    property({ attribute: false })
], FtToolbar.prototype, "phaseFilter", void 0);
__decorate([
    property({ attribute: false })
], FtToolbar.prototype, "assigneeFilter", void 0);
__decorate([
    property({ type: Boolean, reflect: true })
], FtToolbar.prototype, "isPolling", void 0);
__decorate([
    property({ attribute: false })
], FtToolbar.prototype, "lastRefreshed", void 0);
__decorate([
    property({ type: Boolean, reflect: true })
], FtToolbar.prototype, "isRefreshing", void 0);
__decorate([
    property({ attribute: false })
], FtToolbar.prototype, "sessionUser", void 0);
__decorate([
    property({ attribute: false })
], FtToolbar.prototype, "layoutOrientation", void 0);
__decorate([
    state()
], FtToolbar.prototype, "isDark", void 0);
__decorate([
    state()
], FtToolbar.prototype, "users", void 0);
__decorate([
    state()
], FtToolbar.prototype, "usersLoading", void 0);
__decorate([
    state()
], FtToolbar.prototype, "exporting", void 0);
__decorate([
    state()
], FtToolbar.prototype, "currentCollection", void 0);
__decorate([
    query('ft-new-collection-dialog')
], FtToolbar.prototype, "newCollectionDialog", void 0);
__decorate([
    query('ft-collection-settings-dialog')
], FtToolbar.prototype, "collectionSettingsDialog", void 0);
__decorate([
    query('ft-import-collection-dialog')
], FtToolbar.prototype, "importCollectionDialog", void 0);
__decorate([
    query('ft-collection-picker')
], FtToolbar.prototype, "collectionPicker", void 0);
FtToolbar = __decorate([
    customElement('ft-toolbar')
], FtToolbar);
export { FtToolbar };
//# sourceMappingURL=ft-toolbar.js.map