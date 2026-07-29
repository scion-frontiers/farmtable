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
    .comment-form {
      display: grid;
      gap: 0.5rem;
      padding-top: 0.75rem;
    }
    sl-textarea {
      --sl-input-font-size-medium: 0.8125rem;
    }
    .comment-actions {
      display: flex;
      justify-content: flex-end;
    }
    sl-alert {
      font-size: 0.8125rem;
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

  @state()
  private draft = '';

  @state()
  private submitting = false;

  @state()
  private errorMessage = '';

  private cachedTaskId = '';

  updated(changed: Map<string, unknown>) {
    if (changed.has('taskId') && this.taskId !== this.cachedTaskId) {
      this.loaded = false;
      this.comments = [];
      this.draft = '';
      this.errorMessage = '';
      this.cachedTaskId = this.taskId;
      const details = this.shadowRoot?.querySelector('sl-details');
      if (details?.open) {
        this.onExpand();
      }
    }
  }

  private isSectionOpen(): boolean {
    return localStorage.getItem('inspector.collapse.comments') !== 'false';
  }

  private async onExpand() {
    localStorage.setItem('inspector.collapse.comments', 'true');
    if (this.loaded && this.cachedTaskId === this.taskId) return;
    if (!this.client || !this.taskId) return;
    this.loading = true;
    this.errorMessage = '';
    try {
      this.comments = await this.client.listComments(this.taskId);
      this.cachedTaskId = this.taskId;
      this.loaded = true;
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : 'Failed to load comments';
    } finally {
      this.loading = false;
    }
  }

  private onCollapse() {
    localStorage.setItem('inspector.collapse.comments', 'false');
  }

  private onDraftInput(e: Event) {
    this.draft = (e.currentTarget as unknown as { value: string }).value;
    if (this.errorMessage) {
      this.errorMessage = '';
    }
  }

  private onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      this.submitComment();
    }
  }

  private async submitComment() {
    const body = this.trimmedDraft;
    if (!body) {
      this.errorMessage = 'Enter a comment before submitting.';
      return;
    }
    if (!this.client || !this.taskId || this.submitting) return;

    this.submitting = true;
    this.errorMessage = '';
    try {
      const comment = await this.client.addComment(this.taskId, body);
      this.comments = [comment, ...this.comments];
      this.loaded = true;
      this.draft = '';
      await this.updateComplete;
      this.renderRoot.querySelector<HTMLElement>('sl-textarea')?.focus();
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : 'Failed to add comment';
    } finally {
      this.submitting = false;
    }
  }

  private authorName(comment: Comment) {
    return comment.author.name.trim() || comment.author.id || 'Unknown author';
  }

  private get trimmedDraft(): string {
    return this.draft.trim();
  }

  render() {
    const count = this.loaded ? this.comments.length : '';
    const summary = `Comments${count !== '' ? ` (${count})` : ''}`;

    return html`
      <sl-details summary=${summary} ?open=${this.isSectionOpen()} @sl-show=${this.onExpand} @sl-hide=${this.onCollapse}>
        ${this.errorMessage
          ? html`
              <sl-alert variant="danger" open closable @sl-after-hide=${() => { this.errorMessage = ''; }}>
                ${this.errorMessage}
              </sl-alert>
            `
          : nothing}
        ${this.loading
          ? html`<sl-spinner style="font-size: 1rem;"></sl-spinner>`
          : this.loaded && this.comments.length === 0
            ? html`<div class="empty">No comments</div>`
            : this.comments.map(
                (c) => {
                  const authorName = this.authorName(c);
                  return html`
                    <div class="comment">
                      <div class="comment-header">
                        <sl-avatar
                          initials=${authorName.slice(0, 2)}
                          label=${authorName}
                          style="--size: 1.4rem; font-size: 0.55rem;"
                        ></sl-avatar>
                        <span class="comment-author">${authorName}</span>
                        <span class="comment-time">${formatTimestamp(c.createdAt)}</span>
                      </div>
                      <div class="comment-body">
                        ${unsafeHTML(renderMarkdown(c.body))}
                      </div>
                    </div>
                  `;
                }
              )}
        <div class="comment-form">
          <sl-textarea
            label="Add comment"
            placeholder="Ctrl+Enter to submit"
            rows="3"
            resize="auto"
            value=${this.draft}
            ?disabled=${this.submitting}
            @input=${this.onDraftInput}
            @keydown=${this.onKeyDown}
          ></sl-textarea>
          <div class="comment-actions">
            <sl-button
              size="small"
              variant="primary"
              ?loading=${this.submitting}
              ?disabled=${!this.trimmedDraft || this.submitting}
              @click=${this.submitComment}
            >
              Add comment
            </sl-button>
          </div>
        </div>
      </sl-details>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ft-inspector-comments': FtInspectorComments;
  }
}
