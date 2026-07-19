import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { ConnectionStatus } from '../store/stream-manager.js';

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

  @state()
  private isDark = document.documentElement.classList.contains('sl-theme-dark');

  render() {
    return html`
      <span class="title">Farm Table</span>

      <div class="filters">
        <sl-select placeholder="Phase" size="small" clearable>
          <sl-option value="open">Open</sl-option>
          <sl-option value="in_progress">In Progress</sl-option>
          <sl-option value="on_hold">On Hold</sl-option>
          <sl-option value="closed">Closed</sl-option>
        </sl-select>

        <sl-select placeholder="Assignee" size="small" clearable>
          <sl-option value="me">Me</sl-option>
          <sl-option value="unassigned">Unassigned</sl-option>
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
