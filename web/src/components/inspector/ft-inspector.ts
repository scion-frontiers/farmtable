import { LitElement, html, css, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { TaskStoreController } from '../../store/task-store-controller.js';
import type { TaskStore } from '../../store/task-store.js';
import { phaseForStage, type FarmTableServiceClient } from '../../gen/service.js';
import type { TaskStage } from '../../gen/types.js';
import type { CollectionCapabilities } from '../../capabilities.js';
import { iconButtonFocusStyles } from './inspector-shared-styles.js';
import '../kanban/ft-close-reason-dialog.js';
import type { CloseReasonDetail, FtCloseReasonDialog } from '../kanban/ft-close-reason-dialog.js';

@customElement('ft-inspector')
export class FtInspector extends LitElement {
  static styles = [
    iconButtonFocusStyles,
    css`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
    }
    .header-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-bottom: 0.5rem;
      flex-shrink: 0;
    }
    .header-label {
      font-size: 0.7rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--sl-color-neutral-500);
      font-weight: 600;
    }
    .close-btn {
      color: var(--sl-color-neutral-500);
    }
    .close-btn:hover {
      color: var(--sl-color-neutral-900);
    }
    .body {
      padding-bottom: 1rem;
    }
    sl-tab-group {
      flex: 1;
      min-height: 0;
      overflow: hidden;
    }
    sl-tab-group::part(base) {
      height: 100%;
    }
    sl-tab-group::part(body) {
      flex: 1;
      overflow: hidden;
      min-height: 0;
    }
    sl-tab-panel {
      height: 100%;
      overflow-y: auto;
    }
    sl-tab-panel::part(base) {
      padding: 0.5rem 0 0;
      height: 100%;
      overflow-y: auto;
    }
    ft-inspector-header {
      margin-bottom: 0.5rem;
      flex-shrink: 0;
    }
    sl-details,
    ft-inspector-comments,
    ft-inspector-changes {
      margin-top: 0.75rem;
    }
    sl-details::part(base) {
      border: 1px solid var(--sl-color-neutral-200);
      border-radius: var(--sl-border-radius-medium);
    }
    sl-details::part(header) {
      padding: 0.5rem 0.75rem;
    }
    sl-details::part(content) {
      padding: 0 0.75rem 0.75rem;
    }
  `,
  ];

  @property()
  taskId = '';

  @property({ attribute: false })
  store!: TaskStore;

  @property({ attribute: false })
  client?: FarmTableServiceClient;

  @property({ type: Boolean })
  readOnly = false;

  @property({ attribute: false })
  capabilities?: CollectionCapabilities;

  private storeCtrl?: TaskStoreController;

  override connectedCallback() {
    super.connectedCallback();
    if (!this.storeCtrl) {
      this.storeCtrl = new TaskStoreController(this, this.store);
    }
    this.addEventListener('keydown', this.onBodyKeyDown);
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this.removeEventListener('keydown', this.onBodyKeyDown);
  }

  private isSectionOpen(key: string): boolean {
    return localStorage.getItem(`inspector.collapse.${key}`) !== 'false';
  }

  private persistSectionState(key: string, open: boolean) {
    localStorage.setItem(`inspector.collapse.${key}`, String(open));
  }

  private onClose() {
    this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true }));
  }

  private onBodyKeyDown(e: KeyboardEvent) {
    if (e.key !== 'Escape') return;

    e.preventDefault();
    e.stopPropagation();
    this.onClose();
  }

  private async onStageCloseRequest(e: CustomEvent<{ taskId: string; stage: TaskStage; stageLabel: string }>) {
    if (this.readOnly || this.capabilities?.canCloseTask === false) return;
    const { taskId, stage, stageLabel } = e.detail;
    const dialog = this.renderRoot.querySelector<FtCloseReasonDialog>('ft-close-reason-dialog');
    await dialog?.showFor(taskId, stage, stageLabel);
  }

  private async onCloseReasonSubmit(e: CustomEvent<CloseReasonDetail>) {
    const dialog = e.currentTarget as FtCloseReasonDialog;
    const { taskId, stage, reason } = e.detail;
    const task = this.store.getTask(taskId);
    if (!task || this.readOnly || this.capabilities?.canCloseTask === false) {
      dialog.close();
      return;
    }

    this.store.upsert({ ...task, stage, phase: phaseForStage(stage) });
    dialog.setClosing(true);

    try {
      if (!this.client) throw new Error('Not connected to the server');
      const updated = await this.client.closeTask(taskId, { stage, reason });
      this.store.upsert(updated);
      dialog.close();
    } catch (error) {
      console.warn('Failed to close task; rolled back optimistic change', error);
      this.store.upsert(task);
      dialog.setError('Failed to close task. Please try again.');
      this.dispatchEvent(new CustomEvent('write-error', {
        bubbles: true,
        composed: true,
        detail: { error, reason: 'stage-change-failed' },
      }));
    } finally {
      dialog.setClosing(false);
    }
  }

  render() {
    const task = this.store.getTask(this.taskId);
    if (!task) {
      return html`
        <div class="header-bar">
          <span class="header-label">Inspector</span>
          <sl-icon-button
            class="close-btn"
            name="x-lg"
            label="Close inspector"
            @click=${this.onClose}
          ></sl-icon-button>
        </div>
        <div style="color: var(--sl-color-neutral-400); font-style: italic; padding: 1rem 0;">
          Task not found
        </div>
      `;
    }

    return html`
      <div class="header-bar">
        <span class="header-label">Inspector</span>
        <sl-icon-button
          class="close-btn"
          name="x-lg"
          label="Close inspector"
          @click=${this.onClose}
        ></sl-icon-button>
      </div>

      <ft-inspector-header
        .task=${task}
        ?readOnly=${this.readOnly}
        .capabilities=${this.capabilities}
        @stage-close-request=${this.onStageCloseRequest}
      ></ft-inspector-header>

      <sl-tab-group>
        <sl-tab slot="nav" panel="general" active>General</sl-tab>
        <sl-tab slot="nav" panel="relationships">Relationships</sl-tab>

        <sl-tab-panel name="general" active>
          <div class="body" tabindex="0">
            <sl-details
              summary="Properties"
              ?open=${this.isSectionOpen('metadata')}
              @sl-show=${() => this.persistSectionState('metadata', true)}
              @sl-hide=${() => this.persistSectionState('metadata', false)}
            >
              <ft-inspector-meta .task=${task} .client=${this.client} ?readOnly=${this.readOnly} .capabilities=${this.capabilities}></ft-inspector-meta>
            </sl-details>

            <sl-details
              summary="Description"
              ?open=${this.isSectionOpen('description')}
              @sl-show=${() => this.persistSectionState('description', true)}
              @sl-hide=${() => this.persistSectionState('description', false)}
            >
              <ft-inspector-desc
                taskId=${task.id}
                .description=${task.description}
                ?readOnly=${this.readOnly}
                .capabilities=${this.capabilities}
                hide-title
              ></ft-inspector-desc>
            </sl-details>

            ${task.codeContext
              ? html`
                  <sl-details
                    summary="Code"
                    ?open=${this.isSectionOpen('code')}
                    @sl-show=${() => this.persistSectionState('code', true)}
                    @sl-hide=${() => this.persistSectionState('code', false)}
                  >
                    <ft-inspector-code .codeContext=${task.codeContext}></ft-inspector-code>
                  </sl-details>
                `
              : nothing}

            <ft-inspector-comments
              taskId=${this.taskId}
              .client=${this.client}
              ?readOnly=${this.readOnly}
              .capabilities=${this.capabilities}
            ></ft-inspector-comments>

            <ft-inspector-changes
              taskId=${this.taskId}
              .client=${this.client}
            ></ft-inspector-changes>
          </div>
        </sl-tab-panel>

        <sl-tab-panel name="relationships">
          <ft-inspector-relationships
            .task=${task}
            .store=${this.store}
            ?readOnly=${this.readOnly}
          ></ft-inspector-relationships>
        </sl-tab-panel>
      </sl-tab-group>
      <ft-close-reason-dialog @close-reason-submit=${this.onCloseReasonSubmit}></ft-close-reason-dialog>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ft-inspector': FtInspector;
  }
}
