import { LitElement, html, css, nothing, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { renderMarkdown } from '../../util/markdown.js';
import type { UpdateTaskFields } from '../../gen/service.js';
import type { CollectionCapabilities } from '../../capabilities.js';
import { iconButtonFocusStyles } from './inspector-shared-styles.js';

@customElement('ft-inspector-desc')
export class FtInspectorDesc extends LitElement {
  static styles = [
    iconButtonFocusStyles,
    css`
    :host {
      display: block;
    }
    .section-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
      margin-bottom: 0.5rem;
    }
    .section-title {
      color: var(--sl-color-neutral-500);
      font-size: 0.75rem;
      font-weight: 600;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }
    .actions {
      display: flex;
      align-items: center;
      gap: 0.25rem;
      margin-left: auto;
    }
    .section-header > sl-icon-button {
      margin-left: auto;
    }
    .content {
      font-size: 0.875rem;
      line-height: 1.6;
      color: var(--sl-color-neutral-700);
      cursor: text;
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
      cursor: text;
    }
    sl-textarea {
      --sl-input-font-size-medium: 0.875rem;
    }
  `,
  ];

  @property()
  description?: string;

  @property()
  taskId = '';

  @property({ type: Boolean, attribute: 'hide-title' })
  hideTitle = false;

  @property({ type: Boolean })
  readOnly = false;

  @property({ attribute: false })
  capabilities?: CollectionCapabilities;

  @state()
  private isEditing = false;

  @state()
  private draft = '';

  override willUpdate(changedProps: PropertyValues<this>) {
    // taskId is a string primitive; Lit's equality check detects identity changes directly.
    if (changedProps.has('taskId')) {
      this.resetEditState();
    }
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this.removeDismissListener();
  }

  private async startEdit() {
    if (this.readOnly) return;
    this.draft = this.description ?? '';
    this.isEditing = true;
    this.addDismissListener();
    await this.updateComplete;
    this.renderRoot.querySelector<HTMLElement>('sl-textarea')?.focus();
  }

  private onDraftInput(e: Event) {
    this.draft = (e.currentTarget as unknown as { value: string }).value;
  }

  private onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      this.cancelEdit();
    } else if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      this.saveEdit();
    }
  }

  private saveEdit() {
    const nextDescription = this.draft.trim();
    this.isEditing = false;
    this.removeDismissListener();
    if (nextDescription === (this.description ?? '').trim()) return;

    this.dispatchTaskUpdate({ description: nextDescription });
  }

  private cancelEdit() {
    this.draft = this.description ?? '';
    this.isEditing = false;
    this.removeDismissListener();
  }

  private resetEditState() {
    this.isEditing = false;
    this.draft = '';
    this.removeDismissListener();
  }

  private onDocumentPointerDown = (e: PointerEvent) => {
    if (!this.isEditing) return;
    if (e.composedPath().includes(this)) return;
    this.cancelEdit();
  };

  private addDismissListener() {
    document.addEventListener('pointerdown', this.onDocumentPointerDown, { capture: true });
  }

  private removeDismissListener() {
    document.removeEventListener('pointerdown', this.onDocumentPointerDown, { capture: true });
  }

  private dispatchTaskUpdate(fields: UpdateTaskFields) {
    this.dispatchEvent(
      new CustomEvent('task-update', {
        detail: { taskId: this.taskId, fields },
        bubbles: true,
        composed: true,
      }),
    );
  }

  render() {
    if (this.isEditing) {
      return html`
        <div class="section-header">
          ${this.hideTitle ? nothing : html`<span class="section-title">Description</span>`}
          <span class="actions">
            <sl-icon-button
              name="check2"
              label="Save description"
              @click=${this.saveEdit}
            ></sl-icon-button>
            <sl-icon-button
              name="x-lg"
              label="Cancel description edit"
              @click=${this.cancelEdit}
            ></sl-icon-button>
          </span>
        </div>
        <sl-textarea
          rows="7"
          resize="auto"
          value=${this.draft}
          @input=${this.onDraftInput}
          @keydown=${this.onKeyDown}
        ></sl-textarea>
      `;
    }

    if (!this.description) {
      return html`
        <div class="section-header">
          ${this.hideTitle ? nothing : html`<span class="section-title">Description</span>`}
          ${this.readOnly ? nothing : html`<sl-icon-button
            name="pencil"
            label="Edit description"
            @click=${this.startEdit}
          ></sl-icon-button>`}
        </div>
        <span class="empty" @click=${this.readOnly ? undefined : this.startEdit}>No description</span>
      `;
    }
    return html`
      <div class="section-header">
        ${this.hideTitle ? nothing : html`<span class="section-title">Description</span>`}
        ${this.readOnly ? nothing : html`<sl-icon-button
          name="pencil"
          label="Edit description"
          @click=${this.startEdit}
        ></sl-icon-button>`}
      </div>
      <div class="content" @dblclick=${this.readOnly ? undefined : this.startEdit}>
        <!--
          renderMarkdown runs DOMPurify.sanitize over marked's output before this
          is injected, and it now also routes every host-naming href in that
          output through safeHref -- the hook lives in web/src/util/markdown.ts.
          Those are two controls, not one, and they are worth keeping apart.
          DOMPurify is the XSS sanitiser, configured with its defaults here --
          no explicit ALLOWED_URI_REGEXP -- so what it strips is whatever the
          installed version's defaults strip, which is a dependency fact rather
          than a property this repo states or tests. safeHref is the URL-scheme
          policy, which this repo does state and pin.

          Until the hook landed, the URL-scheme policy was not applied on this
          path AT ALL: markdown link syntax produced real anchors whose hrefs no
          call site ever checked, so a URL that reads as one host and loads
          another survived with attacker-chosen link text. Phishing and
          credential disclosure, not XSS -- DOMPurify strips javascript: and
          data: here and always did.

          WHAT THE SCANNER ASSERTS, AND WHAT IT STILL CANNOT SEE.
          web/src/util/url-binding-scan.test.ts asserts that every href binding
          IT CAN PARSE routes through safeHref, and its header lists its own
          blind spots. unsafeHTML is one of them -- it is this line. So the
          anchors renderMarkdown produces below are outside that scanner's reach
          both before and after the fix; what changed is that they are now
          covered by web/src/util/markdown-href.test.ts, which pins the sink's
          behaviour directly. A control's stated scope must not be its
          aspiration: the scanner's scope is the bindings it can parse, and the
          markdown path is pinned by a different file.

          web/src/util/safe-url.ts defines SAFE_SCHEMES and safeHref and
          web/src/util/safe-url.test.ts pins their behaviour. All of those test
          files are executed by "npm test", which discovers them rather than
          running a hardcoded list; make suite-manifest fails the build if any
          tracked test file compiles without executing. (No backticks in this
          comment: it sits inside a template literal, where a backtick ends the
          literal.)
        -->
        ${unsafeHTML(renderMarkdown(this.description))}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ft-inspector-desc': FtInspectorDesc;
  }
}
