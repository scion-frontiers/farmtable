var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { LitElement, html, css, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { CIStatus, PullRequestStatus } from '../../gen/types.js';
const PR_VARIANT = {
    [PullRequestStatus.OPEN]: 'primary',
    [PullRequestStatus.MERGED]: 'success',
    [PullRequestStatus.CLOSED]: 'neutral',
};
const PR_LABEL = {
    [PullRequestStatus.OPEN]: 'Open',
    [PullRequestStatus.MERGED]: 'Merged',
    [PullRequestStatus.CLOSED]: 'Closed',
};
const CI_VARIANT = {
    [CIStatus.PENDING]: 'neutral',
    [CIStatus.RUNNING]: 'primary',
    [CIStatus.PASSED]: 'success',
    [CIStatus.FAILED]: 'danger',
};
const CI_LABEL = {
    [CIStatus.PENDING]: 'Pending',
    [CIStatus.RUNNING]: 'Running',
    [CIStatus.PASSED]: 'Passed',
    [CIStatus.FAILED]: 'Failed',
};
let FtInspectorCode = class FtInspectorCode extends LitElement {
    render() {
        const ctx = this.codeContext;
        if (!ctx)
            return nothing;
        return html `
      ${ctx.repo
            ? html `<div class="row">
            <span class="label">Repo</span>
            <span class="value">${ctx.repo}</span>
          </div>`
            : nothing}

      ${ctx.branch
            ? html `<div class="row">
            <span class="label">Branch</span>
            <span class="value">${ctx.branch}</span>
          </div>`
            : nothing}

      ${ctx.pullRequests.length > 0
            ? html `<div class="row">
            <span class="label">PRs</span>
            <span class="pr-list">
              ${ctx.pullRequests.map((pr) => html `
                  <span class="pr-item">
                    <a class="pr-link" href=${pr.url} target="_blank" rel="noopener">${pr.id}</a>
                    <sl-badge variant=${PR_VARIANT[pr.status] ?? 'neutral'} pill>
                      ${PR_LABEL[pr.status] ?? 'Unknown'}
                    </sl-badge>
                  </span>
                `)}
            </span>
          </div>`
            : nothing}

      ${ctx.ciStatus != null && ctx.ciStatus !== CIStatus.UNSPECIFIED
            ? html `<div class="row">
            <span class="label">CI</span>
            <span class="value">
              <sl-badge variant=${CI_VARIANT[ctx.ciStatus] ?? 'neutral'} pill>
                ${CI_LABEL[ctx.ciStatus] ?? 'Unknown'}
              </sl-badge>
            </span>
          </div>`
            : nothing}
    `;
    }
};
FtInspectorCode.styles = css `
    :host {
      display: block;
    }
    .row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding: 0.375rem 0;
      font-size: 0.8125rem;
      gap: 0.5rem;
    }
    .label {
      color: var(--sl-color-neutral-500);
      flex-shrink: 0;
    }
    .value {
      text-align: right;
      word-break: break-all;
      font-family: var(--sl-font-mono);
      font-size: 0.75rem;
    }
    .pr-list {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      align-items: flex-end;
    }
    .pr-item {
      display: flex;
      align-items: center;
      gap: 0.375rem;
    }
    .pr-link {
      color: var(--sl-color-primary-600);
      text-decoration: none;
      font-size: 0.8125rem;
    }
    .pr-link:hover {
      text-decoration: underline;
    }
  `;
__decorate([
    property({ attribute: false })
], FtInspectorCode.prototype, "codeContext", void 0);
FtInspectorCode = __decorate([
    customElement('ft-inspector-code')
], FtInspectorCode);
export { FtInspectorCode };
//# sourceMappingURL=ft-inspector-code.js.map