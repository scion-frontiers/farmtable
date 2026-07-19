import { LitElement, html, css, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { TaskPhase, type User } from '../gen/types.js';
import type { FarmTableServiceClient } from '../gen/service.js';
import type { ConnectionStatus } from '../store/stream-manager.js';
import { UNASSIGNED_FILTER_VALUE, type TaskFilterChangeDetail } from './task-filters.js';

// UNSPECIFIED is the protobuf default, not a user-selectable task phase.
const PHASE_OPTIONS = [
  { value: TaskPhase.OPEN, label: 'Open' },
  { value: TaskPhase.IN_PROGRESS, label: 'In Progress' },
  { value: TaskPhase.ON_HOLD, label: 'On Hold' },
  { value: TaskPhase.CLOSED, label: 'Closed' },
] as const;

@customElement('ft-toolbar')
export class FtToolbar extends LitElement {
  static styles = css`
    :host {
      display: flex;
      align-items: center;
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
  `;

  @property()
  currentView: 'kanban' | 'tree' = 'kanban';

  @property()
  connectionStatus: ConnectionStatus = 'disconnected';

  @property({ attribute: false })
  client?: FarmTableServiceClient;

  @property({ attribute: false })
  phaseFilter: TaskPhase | null = null;

  @property({ attribute: false })
  assigneeFilter: string | null = null;

  @state()
  private isDark = document.documentElement.classList.contains('sl-theme-dark');

  @state()
  private users: User[] = [];

  @state()
  private usersLoading = false;

  private userLoadToken = 0;

  override updated(changedProps: PropertyValues<this>) {
    if (changedProps.has('client')) {
      void this.loadUsers();
    }
  }

  render() {
    // Tree view does not consume task filters yet, so keep the current filter state visible but disabled.
    const filtersDisabled = this.currentView === 'tree';

    return html`
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
          ${PHASE_OPTIONS.map(
            (option) => html`
              <sl-option value=${String(option.value)}>${option.label}</sl-option>
            `,
          )}
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
            ? html`<sl-option value="" disabled>Loading users...</sl-option>`
            : null}
          <sl-option value=${UNASSIGNED_FILTER_VALUE}>Unassigned</sl-option>
          ${this.users.map(
            (user) => html`
              <sl-option value=${user.id}>${user.name || user.email || user.id}</sl-option>
            `,
          )}
        </sl-select>
      </div>

      <sl-radio-group
        value=${this.currentView}
        size="small"
        @sl-change=${this.onViewChange}
      >
        <sl-radio-button value="kanban">Kanban</sl-radio-button>
        <sl-radio-button value="tree">Tree</sl-radio-button>
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

      <ft-connection-badge .status=${this.connectionStatus}></ft-connection-badge>
    `;
  }

  private onToggleTheme() {
    this.isDark = !this.isDark;
    document.documentElement.classList.toggle('sl-theme-dark', this.isDark);
    localStorage.setItem('ft-theme', this.isDark ? 'dark' : 'light');
  }

  private onViewChange(e: Event) {
    const target = e.target as HTMLElement & { value: string };
    this.dispatchEvent(
      new CustomEvent('view-change', {
        detail: { view: target.value },
        bubbles: true,
        composed: true,
      })
    );
  }

  private async loadUsers() {
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
    } catch (error) {
      if (token === this.userLoadToken) {
        this.users = [];
        this.usersLoading = false;
      }
      console.warn('Failed to load toolbar assignee filters', error);
    }
  }

  private onPhaseFilterChange(e: Event) {
    const value = this.selectValue(e);
    this.dispatchFilterChange({
      phase: value ? Number(value) as TaskPhase : null,
      assigneeId: this.assigneeFilter,
    });
  }

  private onAssigneeFilterChange(e: Event) {
    const value = this.selectValue(e);
    this.dispatchFilterChange({
      phase: this.phaseFilter,
      assigneeId: value || null,
    });
  }

  private selectValue(e: Event): string {
    const target = e.currentTarget as HTMLElement & { value: string | string[] };
    return Array.isArray(target.value) ? target.value[0] ?? '' : target.value;
  }

  private dispatchFilterChange(detail: TaskFilterChangeDetail) {
    this.dispatchEvent(
      new CustomEvent<TaskFilterChangeDetail>('filter-change', {
        detail,
        bubbles: true,
        composed: true,
      }),
    );
  }

  private onShortcutHelpClick() {
    this.dispatchEvent(
      new CustomEvent('shortcut-help-open', {
        bubbles: true,
        composed: true,
      }),
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ft-toolbar': FtToolbar;
  }
}
