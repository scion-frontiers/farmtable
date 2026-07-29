var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state, query } from 'lit/decorators.js';
import { RelationshipType, TaskStage } from '../gen/types.js';
const WORD_BOUNDARY_RE = /[\s\-_]/;
/**
 * Simple fuzzy match: every character in the pattern must appear in order
 * within the target string (case-insensitive). Returns a score (lower is
 * better) or Infinity for no match. Consecutive-character runs and matches at
 * word boundaries score higher so "inv rpt" finds "Invoice Report" before
 * "Individual Rapport".
 */
function fuzzyScore(pattern, target) {
    const p = pattern.toLowerCase();
    const t = target.toLowerCase();
    let pi = 0;
    let score = 0;
    let lastMatchIndex = -1;
    for (let ti = 0; ti < t.length && pi < p.length; ti++) {
        if (t[ti] === p[pi]) {
            // Bonus for consecutive matches (gap penalty otherwise).
            const gap = lastMatchIndex === -1 ? 0 : ti - lastMatchIndex - 1;
            score += gap;
            // Bonus for matching at word boundaries (after space, dash, underscore, or start).
            if (ti === 0 || WORD_BOUNDARY_RE.test(t[ti - 1])) {
                score -= 2;
            }
            lastMatchIndex = ti;
            pi++;
        }
    }
    // All pattern characters consumed?
    return pi === p.length ? score : Infinity;
}
/** Human-readable labels for TaskStage enum values. */
const STAGE_NAMES = {
    [TaskStage.UNSPECIFIED]: '',
    [TaskStage.TRIAGE]: 'Triage',
    [TaskStage.ACCEPTED]: 'Accepted',
    [TaskStage.WORKING]: 'Working',
    [TaskStage.IN_REVIEW]: 'In Review',
    [TaskStage.IN_QA]: 'In QA',
    [TaskStage.DEPLOYING]: 'Deploying',
    [TaskStage.COMPLETED]: 'Completed',
    [TaskStage.WONT_FIX]: "Won't Fix",
    [TaskStage.DUPLICATE]: 'Duplicate',
    [TaskStage.CANCELLED]: 'Cancelled',
};
/** Labels for the relationship type pills. */
const REL_TYPE_LABELS = [
    { type: RelationshipType.BLOCKS, label: 'Blocks' },
    { type: RelationshipType.BLOCKED_BY, label: 'Blocked by' },
];
let paletteId = 0;
let FtCommandPalette = class FtCommandPalette extends LitElement {
    constructor() {
        super(...arguments);
        this.open = false;
        this.store = null;
        this.mode = 'navigate';
        this.excludeTaskId = '';
        this.searchQuery = '';
        this.activeIndex = 0;
        this.relationshipType = RelationshipType.BLOCKS;
        this.previouslyFocusedElement = null;
        this.labelId = `command-palette-label-${++paletteId}`;
        this.listboxId = `command-palette-listbox-${paletteId}`;
        // ── Event listeners ──
        this.onDocumentKeyDown = (e) => {
            if (!this.open)
                return;
            switch (e.key) {
                case 'Escape':
                    e.preventDefault();
                    e.stopPropagation();
                    this.requestClose();
                    break;
                case 'ArrowDown':
                    e.preventDefault();
                    this.moveActive(1);
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    this.moveActive(-1);
                    break;
                case 'Enter': {
                    e.preventDefault();
                    const results = this.filteredTasks();
                    if (results.length > 0 && this.activeIndex < results.length) {
                        this.selectTask(results[this.activeIndex].id);
                    }
                    break;
                }
                case 'Tab':
                    // Prevent tab from leaving the palette.
                    e.preventDefault();
                    break;
            }
        };
        this.onDocumentPointerDown = (e) => {
            if (!this.open)
                return;
            const panel = this.renderRoot.querySelector('.panel');
            if (panel && e.composedPath().includes(panel))
                return;
            this.requestClose();
        };
    }
    updated(changedProperties) {
        if (!changedProperties.has('open'))
            return;
        if (this.open) {
            this.searchQuery = '';
            this.activeIndex = 0;
            this.relationshipType = this.defaultRelationshipType ?? RelationshipType.BLOCKS;
            this.previouslyFocusedElement = this.deepActiveElement();
            this.addDismissListeners();
            void this.updateComplete.then(() => {
                this.inputEl?.focus();
            });
        }
        else {
            this.removeDismissListeners();
            this.restoreFocus();
        }
    }
    disconnectedCallback() {
        super.disconnectedCallback();
        this.removeDismissListeners();
    }
    addDismissListeners() {
        document.addEventListener('keydown', this.onDocumentKeyDown, { capture: true });
        document.addEventListener('pointerdown', this.onDocumentPointerDown, { capture: true });
    }
    removeDismissListeners() {
        document.removeEventListener('keydown', this.onDocumentKeyDown, { capture: true });
        document.removeEventListener('pointerdown', this.onDocumentPointerDown, { capture: true });
    }
    // ── Search and filtering ──
    /** Build a single searchable string from title and labels only. */
    searchableText(task) {
        return [task.name, ...task.labels].join(' ');
    }
    filteredTasks() {
        const tasks = this.store?.allTasks ?? [];
        const query = this.searchQuery.trim();
        if (!query) {
            return [];
        }
        const scored = [];
        for (const task of tasks) {
            // Exclude the current task in add-relationship mode.
            if (this.mode === 'add-relationship' && task.id === this.excludeTaskId)
                continue;
            // Score against title, each label, and combined title+labels text; take the best match.
            // fuzzyScore returns Infinity for no match; valid matches can score negative (boundary bonuses).
            const nameScore = fuzzyScore(query, task.name);
            const labelScores = task.labels.map((label) => fuzzyScore(query, label));
            const textScore = fuzzyScore(query, this.searchableText(task));
            const candidates = [nameScore, ...labelScores, textScore].filter(Number.isFinite);
            if (candidates.length === 0)
                continue;
            const bestScore = Math.min(...candidates);
            scored.push({ task, score: bestScore });
        }
        scored.sort((a, b) => a.score - b.score);
        return scored.map((s) => s.task).slice(0, 50);
    }
    stageLabel(task) {
        return STAGE_NAMES[task.stage] ?? '';
    }
    // ── Navigation ──
    moveActive(delta) {
        const results = this.filteredTasks();
        if (results.length === 0)
            return;
        this.activeIndex = Math.max(0, Math.min(results.length - 1, this.activeIndex + delta));
        this.scrollActiveIntoView();
    }
    scrollActiveIntoView() {
        void this.updateComplete.then(() => {
            const item = this.renderRoot.querySelector('.result-item[aria-selected="true"]');
            item?.scrollIntoView({ block: 'nearest' });
        });
    }
    selectTask(taskId) {
        if (this.mode === 'add-relationship') {
            this.dispatchEvent(new CustomEvent('relationship-add', {
                bubbles: true,
                composed: true,
                detail: { targetTaskId: taskId, relationshipType: this.relationshipType },
            }));
        }
        else {
            this.dispatchEvent(new CustomEvent('task-select', {
                bubbles: true,
                composed: true,
                detail: { taskId },
            }));
        }
        this.requestClose();
    }
    // ── Focus management ──
    deepActiveElement() {
        let el = document.activeElement;
        while (el?.shadowRoot?.activeElement) {
            el = el.shadowRoot.activeElement;
        }
        return el instanceof HTMLElement ? el : null;
    }
    restoreFocus() {
        const el = this.previouslyFocusedElement;
        this.previouslyFocusedElement = null;
        if (el?.isConnected)
            el.focus();
    }
    requestClose() {
        this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true }));
    }
    // ── Input handling ──
    onInput(e) {
        this.searchQuery = e.target.value;
        this.activeIndex = 0;
    }
    onItemPointerMove(index) {
        this.activeIndex = index;
    }
    onItemClick(taskId) {
        this.selectTask(taskId);
    }
    onRelTypePillClick(type) {
        this.relationshipType = type;
    }
    // ── Truncated task ID for display ──
    shortId(id) {
        // Show last 6 chars to keep the column narrow.
        return id.length > 8 ? `...${id.slice(-6)}` : id;
    }
    // ── Render ──
    render() {
        if (!this.open)
            return nothing;
        const results = this.filteredTasks();
        const isRelMode = this.mode === 'add-relationship';
        const placeholder = isRelMode ? 'Search tasks to relate...' : 'Search tasks...';
        const actionLabel = isRelMode ? 'add' : 'open';
        return html `
      <div class="backdrop">
        <div class="panel" role="dialog" aria-modal="true" aria-labelledby=${this.labelId}>
          <div class="search-row">
            <sl-icon class="search-icon" name="search"></sl-icon>
            <input
              id=${this.labelId}
              type="text"
              placeholder=${placeholder}
              autocomplete="off"
              spellcheck="false"
              .value=${this.searchQuery}
              @input=${this.onInput}
              role="combobox"
              aria-expanded="true"
              aria-controls=${this.listboxId}
              aria-activedescendant=${results.length > 0 ? `cp-item-${this.activeIndex}` : ''}
            />
          </div>

          ${isRelMode
            ? html `
                <div class="rel-type-row" role="radiogroup" aria-label="Relationship type">
                  <span class="rel-type-label">Type</span>
                  ${REL_TYPE_LABELS.map(({ type, label }) => html `
                      <button
                        class="rel-type-pill"
                        role="radio"
                        aria-checked=${type === this.relationshipType ? 'true' : 'false'}
                        @click=${() => this.onRelTypePillClick(type)}
                      >
                        ${label}
                      </button>
                    `)}
                </div>
              `
            : nothing}

          <div class="results" id=${this.listboxId} role="listbox">
            ${results.length === 0
            ? html `<div class="empty">
                  ${this.searchQuery.trim() ? 'No matching tasks' : 'Type to search tasks…'}
                </div>`
            : results.map((task, i) => {
                const stage = this.stageLabel(task);
                return html `
                    <div
                      id="cp-item-${i}"
                      class="result-item"
                      role="option"
                      aria-selected=${i === this.activeIndex ? 'true' : 'false'}
                      @pointermove=${() => this.onItemPointerMove(i)}
                      @click=${() => this.onItemClick(task.id)}
                    >
                      <span class="task-id">${this.shortId(task.id)}</span>
                      <span class="task-name">${task.name}</span>
                      ${stage
                    ? html `<span class="task-stage">${stage}</span>`
                    : nothing}
                    </div>
                  `;
            })}
          </div>

          <div class="footer">
            <span class="footer-hint"><kbd>&uarr;</kbd><kbd>&darr;</kbd> navigate</span>
            <span class="footer-hint"><kbd>&crarr;</kbd> ${actionLabel}</span>
            <span class="footer-hint"><kbd>esc</kbd> close</span>
          </div>
        </div>
      </div>
    `;
    }
};
FtCommandPalette.styles = css `
    :host {
      display: contents;
    }

    .backdrop {
      position: fixed;
      inset: 0;
      z-index: 1000;
      display: flex;
      align-items: flex-start;
      justify-content: center;
      padding: clamp(1rem, 10vh, 6rem) 1rem 1rem;
      background: rgba(15, 23, 42, 0.42);
    }

    .panel {
      width: min(36rem, 100%);
      max-height: min(28rem, calc(100vh - 4rem));
      display: flex;
      flex-direction: column;
      border: 1px solid var(--sl-color-neutral-200);
      border-radius: var(--sl-border-radius-medium);
      background: var(--sl-color-neutral-0);
      box-shadow: var(--sl-shadow-large);
      color: var(--sl-color-neutral-900);
      overflow: hidden;
    }

    .search-row {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.75rem 1rem;
      border-bottom: 1px solid var(--sl-color-neutral-200);
    }

    .search-icon {
      flex-shrink: 0;
      color: var(--sl-color-neutral-400);
      font-size: 1rem;
    }

    input {
      flex: 1;
      border: none;
      outline: none;
      font-family: var(--sl-font-sans);
      font-size: 0.9375rem;
      line-height: 1.4;
      color: var(--sl-color-neutral-900);
      background: transparent;
    }

    input::placeholder {
      color: var(--sl-color-neutral-400);
    }

    .rel-type-row {
      display: flex;
      align-items: center;
      gap: 0.375rem;
      padding: 0.5rem 1rem;
      border-bottom: 1px solid var(--sl-color-neutral-200);
    }

    .rel-type-label {
      font-size: 0.6875rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--sl-color-neutral-500);
      margin-right: 0.25rem;
    }

    .rel-type-pill {
      display: inline-flex;
      align-items: center;
      padding: 0.1875rem 0.5rem;
      border-radius: 9999px;
      border: 1px solid var(--sl-color-neutral-300);
      background: var(--sl-color-neutral-0);
      font-family: var(--sl-font-sans);
      font-size: 0.75rem;
      font-weight: 500;
      color: var(--sl-color-neutral-600);
      cursor: pointer;
      transition: background 0.15s, border-color 0.15s, color 0.15s;
    }

    .rel-type-pill:hover {
      border-color: var(--sl-color-primary-400);
      color: var(--sl-color-primary-600);
    }

    .rel-type-pill[aria-checked='true'] {
      background: var(--sl-color-primary-50);
      border-color: var(--sl-color-primary-500);
      color: var(--sl-color-primary-700);
      font-weight: 600;
    }

    .results {
      flex: 1;
      overflow-y: auto;
      padding: 0.25rem 0;
    }

    .empty {
      padding: 1.5rem 1rem;
      text-align: center;
      color: var(--sl-color-neutral-500);
      font-size: 0.875rem;
    }

    .result-item {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.5rem 1rem;
      cursor: pointer;
      font-size: 0.875rem;
      line-height: 1.4;
    }

    .result-item[aria-selected='true'] {
      background: var(--sl-color-primary-50);
    }

    .result-item:active {
      background: var(--sl-color-primary-100);
    }

    .task-id {
      flex-shrink: 0;
      color: var(--sl-color-neutral-400);
      font-family: var(--sl-font-mono);
      font-size: 0.75rem;
      min-width: 3rem;
    }

    .task-name {
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      color: var(--sl-color-neutral-800);
    }

    .task-stage {
      flex-shrink: 0;
      font-size: 0.6875rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--sl-color-neutral-500);
      background: var(--sl-color-neutral-100);
      padding: 0.125rem 0.375rem;
      border-radius: var(--sl-border-radius-small);
    }

    .footer {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 0.5rem 1rem;
      border-top: 1px solid var(--sl-color-neutral-200);
      font-size: 0.75rem;
      color: var(--sl-color-neutral-500);
    }

    .footer kbd {
      min-width: 1.25rem;
      padding: 0.0625rem 0.25rem;
      border: 1px solid var(--sl-color-neutral-300);
      border-bottom-width: 2px;
      border-radius: var(--sl-border-radius-small);
      background: var(--sl-color-neutral-50);
      color: var(--sl-color-neutral-600);
      font-family: var(--sl-font-mono);
      font-size: 0.6875rem;
      line-height: 1.35;
      text-align: center;
    }

    .footer-hint {
      display: flex;
      align-items: center;
      gap: 0.25rem;
    }

    @media (max-width: 520px) {
      .backdrop {
        align-items: flex-start;
        padding: 0;
      }
      .panel {
        width: 100%;
        max-height: 100vh;
        border-width: 0;
        border-radius: 0;
      }
    }
  `;
__decorate([
    property({ type: Boolean, reflect: true })
], FtCommandPalette.prototype, "open", void 0);
__decorate([
    property({ attribute: false })
], FtCommandPalette.prototype, "store", void 0);
__decorate([
    property({ type: String })
], FtCommandPalette.prototype, "mode", void 0);
__decorate([
    property({ type: String })
], FtCommandPalette.prototype, "excludeTaskId", void 0);
__decorate([
    property({ attribute: false })
], FtCommandPalette.prototype, "defaultRelationshipType", void 0);
__decorate([
    state()
], FtCommandPalette.prototype, "searchQuery", void 0);
__decorate([
    state()
], FtCommandPalette.prototype, "activeIndex", void 0);
__decorate([
    state()
], FtCommandPalette.prototype, "relationshipType", void 0);
__decorate([
    query('input')
], FtCommandPalette.prototype, "inputEl", void 0);
FtCommandPalette = __decorate([
    customElement('ft-command-palette')
], FtCommandPalette);
export { FtCommandPalette };
//# sourceMappingURL=ft-command-palette.js.map