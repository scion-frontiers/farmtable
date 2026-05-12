import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { renderMarkdown } from '../../util/markdown.js';

@customElement('ft-inspector-desc')
export class FtInspectorDesc extends LitElement {
  static styles = css`
    :host {
      display: block;
    }
    .content {
      font-size: 0.875rem;
      line-height: 1.6;
      color: var(--sl-color-neutral-700);
    }
    .content p {
      margin: 0 0 0.5rem;
    }
    .content p:last-child {
      margin-bottom: 0;
    }
    .content code {
      background: var(--sl-color-neutral-100);
      padding: 0.1em 0.3em;
      border-radius: 3px;
      font-size: 0.85em;
    }
    .content pre {
      background: var(--sl-color-neutral-100);
      padding: 0.75rem;
      border-radius: 4px;
      overflow-x: auto;
    }
    .content a {
      color: var(--sl-color-primary-600);
    }
    .empty {
      color: var(--sl-color-neutral-400);
      font-style: italic;
      font-size: 0.875rem;
    }
  `;

  @property()
  description?: string;

  render() {
    if (!this.description) {
      return html`<span class="empty">No description</span>`;
    }
    return html`<div class="content">${unsafeHTML(renderMarkdown(this.description))}</div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ft-inspector-desc': FtInspectorDesc;
  }
}
