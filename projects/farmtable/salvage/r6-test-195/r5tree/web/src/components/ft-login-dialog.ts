import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';

/**
 * A login dialog that prompts the user to enter their Farm Table API token.
 * Posts to /api/auth/session and reloads the page on success.
 */
@customElement('ft-login-dialog')
export class FtLoginDialog extends LitElement {
  static styles = css`
    :host {
      display: block;
    }
    .overlay {
      position: fixed;
      inset: 0;
      z-index: 10000;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      animation: fade-in 0.2s ease-out;
    }
    @keyframes fade-in {
      from { opacity: 0; }
      to   { opacity: 1; }
    }
    .dialog {
      background: var(--sl-color-neutral-0, #fff);
      border-radius: var(--sl-border-radius-large, 8px);
      box-shadow: var(--sl-shadow-x-large, 0 8px 32px rgba(0,0,0,0.2));
      padding: 2rem;
      max-width: 420px;
      width: 90vw;
    }
    h2 {
      margin: 0 0 0.5rem;
      font-size: 1.25rem;
      font-weight: 600;
      color: var(--sl-color-neutral-900, #1a1a1a);
    }
    p {
      margin: 0 0 1.5rem;
      font-size: 0.875rem;
      color: var(--sl-color-neutral-600, #666);
      line-height: 1.5;
    }
    .form {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
    .error {
      color: var(--sl-color-danger-600, #dc2626);
      font-size: 0.8rem;
      margin: 0;
      min-height: 1.2em;
    }
    .actions {
      display: flex;
      justify-content: flex-end;
      gap: 0.5rem;
    }
  `;

  @state()
  private token = '';

  @state()
  private loading = false;

  @state()
  private error = '';

  render() {
    return html`
      <div class="overlay">
        <div class="dialog">
          <h2>Sign in to Farm Table</h2>
          <p>
            Enter your API token to access the dashboard. Tokens start with
            <code>ft_</code> and can be generated using the CLI.
          </p>
          <div class="form">
            <sl-input
              type="password"
              placeholder="ft_..."
              size="medium"
              .value=${this.token}
              ?disabled=${this.loading}
              @sl-input=${this.onTokenInput}
              @keydown=${this.onKeyDown}
            >
              <sl-icon name="key" slot="prefix"></sl-icon>
            </sl-input>
            <p class="error">${this.error}</p>
            <div class="actions">
              <sl-button
                variant="primary"
                size="medium"
                ?loading=${this.loading}
                ?disabled=${!this.token.trim() || this.loading}
                @click=${this.onLogin}
              >
                Sign in
              </sl-button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  private onTokenInput(e: Event) {
    const input = e.target as HTMLInputElement & { value: string };
    this.token = input.value;
    this.error = '';
  }

  private onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter' && this.token.trim()) {
      this.onLogin();
    }
  }

  private async onLogin() {
    if (this.loading || !this.token.trim()) return;

    this.loading = true;
    this.error = '';

    try {
      const response = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: this.token.trim() }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        this.error = (data as Record<string, string>).error || 'Authentication failed';
        this.loading = false;
        return;
      }

      // Success — reload the page. The session cookie is now set,
      // so the session-to-bearer middleware will handle auth.
      window.location.reload();
    } catch (err) {
      this.error = 'Could not reach the server. Please try again.';
      this.loading = false;
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ft-login-dialog': FtLoginDialog;
  }
}
