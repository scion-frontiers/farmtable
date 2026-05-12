import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import type { Comment } from '../../gen/types.js';
import type { FarmTableServiceClient } from '../../gen/service.js';
import { renderMarkdown } from '../../util/markdown.js';
import { formatTimestamp } from '../../util/format.js';

@customElement('ft-inspector-comments')
export class FtInspectorComments extends LitElement {
  static styles = css`
    :host {
      display: block;
    }
    .comment {
      padding: 0.5rem 0;
    }
    .comment + .comment {
      border-top: 1px solid var(--sl-color-neutral-200);
    }
    .comment-header {
      display: flex;
      align-items: center;
      gap: 0.375rem;
      margin-bottom: 0.25rem;
    }
    .comment-author {
      font-size: 0.8125rem;
      font-weight: 500;
    }
    .comment-time {
      font-size: 0.7rem;
      color: var(--sl-color-neutral-500);
      margin-left: auto;
    }
    .comment-body {
      font-size: 0.8125rem;
      line-height: 1.5;
      color: var(--sl-color-neutral-700);
    }
    .comment-body p {
      margin: 0 0 0.25rem;
    }
    .comment-body p:last-child {
      margin-bottom: 0;
    }
    .empty {
      font-size: 0.8125rem;
      color: var(--sl-color-neutral-400);
      font-style: italic;
      padding: 0.5rem 0;
    }
  `;

  @property()
  taskId = '';

  @property({ attribute: false })
  client?: FarmTableServiceClient;

  @state()
  private comments: Comment[] = [];

  @state()
  private loading = false;

  @state()
  private loaded = false;

  private cachedTaskId = '';

  updated(changed: Map<string, unknown>) {
    if (changed.has('taskId') && this.taskId !== this.cachedTaskId) {
      this.loaded = false;
      this.comments = [];
      this.cachedTaskId = this.taskId;
      const details = this.shadowRoot?.querySelector('sl-details');
      if (details?.open) {
        this.onExpand();
      }
    }
  }

  private async onExpand() {
    if (this.loaded && this.cachedTaskId === this.taskId) return;
    if (!this.client || !this.taskId) return;
    this.loading = true;
    try {
      this.comments = await this.client.listComments(this.taskId);
      this.cachedTaskId = this.taskId;
      this.loaded = true;
    } finally {
      this.loading = false;
    }
  }

  render() {
    const count = this.loaded ? this.comments.length : '';
    const summary = `Comments${count !== '' ? ` (${count})` : ''}`;

    return html`
      <sl-details summary=${summary} @sl-show=${this.onExpand}>
        ${this.loading
          ? html`<sl-spinner style="font-size: 1rem;"></sl-spinner>`
          : this.loaded && this.comments.length === 0
            ? html`<div class="empty">No comments</div>`
            : this.comments.map(
                (c) => html`
                  <div class="comment">
                    <div class="comment-header">
                      <sl-avatar
                        initials=${c.author.name.slice(0, 2)}
                        label=${c.author.name}
                        style="--size: 1.4rem; font-size: 0.55rem;"
                      ></sl-avatar>
                      <span class="comment-author">${c.author.name}</span>
                      <span class="comment-time">${formatTimestamp(c.createdAt)}</span>
                    </div>
                    <div class="comment-body">
                      ${unsafeHTML(renderMarkdown(c.body))}
                    </div>
                  </div>
                `,
              )}
      </sl-details>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ft-inspector-comments': FtInspectorComments;
  }
}
