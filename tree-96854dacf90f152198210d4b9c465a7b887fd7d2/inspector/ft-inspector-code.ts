import { LitElement, html, css, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { CodeContext } from '../../gen/types.js';
import { CIStatus, PullRequestStatus } from '../../gen/types.js';
<<<<<<< 439b309
import { safeHref } from '../../util/safe-url.js';
=======
import { safeExternalUrl } from '../../util/safe-url.js';
>>>>>>> 61ca67e

const PR_VARIANT: Record<number, string> = {
  [PullRequestStatus.OPEN]: 'primary',
  [PullRequestStatus.MERGED]: 'success',
  [PullRequestStatus.CLOSED]: 'neutral',
};

const PR_LABEL: Record<number, string> = {
  [PullRequestStatus.OPEN]: 'Open',
  [PullRequestStatus.MERGED]: 'Merged',
  [PullRequestStatus.CLOSED]: 'Closed',
};

// Renders a PR link only when the stored URL passes the scheme allow-list.
// Rows written before the server-side check existed may still hold a
// javascript:/data: URL, so the render path re-checks. A rejected URL degrades
// to plain text rather than disappearing, so the user can still see the value.
//
// Exported solely so safe-url.test.ts can drive its JSDOM assertions through
// THIS function rather than through a copy of it. A previous version of that
// test declared its own renderGuarded() and asserted against that, which meant
// replacing `safeHref(url)` with `url` here shipped green. Do not inline this
// back into the template without moving the pin with it.
export function renderPrLink(url: string, id: string) {
  const href = safeHref(url);
  if (href === undefined) {
    return html`<span class="pr-link pr-link-unsafe" title=${`Unsupported URL: ${url}`}>${id}</span>`;
  }
  return html`<a class="pr-link" href=${href} target="_blank" rel="noopener">${id}</a>`;
}

const CI_VARIANT: Record<number, string> = {
  [CIStatus.PENDING]: 'neutral',
  [CIStatus.RUNNING]: 'primary',
  [CIStatus.PASSED]: 'success',
  [CIStatus.FAILED]: 'danger',
};

const CI_LABEL: Record<number, string> = {
  [CIStatus.PENDING]: 'Pending',
  [CIStatus.RUNNING]: 'Running',
  [CIStatus.PASSED]: 'Passed',
  [CIStatus.FAILED]: 'Failed',
};

@customElement('ft-inspector-code')
export class FtInspectorCode extends LitElement {
  static styles = css`
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

  @property({ attribute: false })
  codeContext?: CodeContext;

  render() {
    const ctx = this.codeContext;
    if (!ctx) return nothing;

    return html`
      ${ctx.repo
        ? html`<div class="row">
            <span class="label">Repo</span>
            <span class="value">${ctx.repo}</span>
          </div>`
        : nothing}

      ${ctx.branch
        ? html`<div class="row">
            <span class="label">Branch</span>
            <span class="value">${ctx.branch}</span>
          </div>`
        : nothing}

      ${ctx.pullRequests.length > 0
        ? html`<div class="row">
            <span class="label">PRs</span>
            <span class="pr-list">
              ${ctx.pullRequests.map((pr) => {
                // `pr.url` is untrusted platform data — validate the scheme
                // before it reaches an href, and render the id unlinked when
                // the URL is not safe.
                const prUrl = safeExternalUrl(pr.url);
                return html`
                  <span class="pr-item">
<<<<<<< 439b309
                    ${renderPrLink(pr.url, pr.id)}
=======
                    ${prUrl
                      ? html`<a class="pr-link" href=${prUrl} target="_blank" rel="noopener noreferrer"
                          >${pr.id}</a
                        >`
                      : html`<span class="pr-link">${pr.id}</span>`}
>>>>>>> 61ca67e
                    <sl-badge variant=${PR_VARIANT[pr.status] ?? 'neutral'} pill>
                      ${PR_LABEL[pr.status] ?? 'Unknown'}
                    </sl-badge>
                  </span>
                `;
              })}
            </span>
          </div>`
        : nothing}

      ${ctx.ciStatus != null && ctx.ciStatus !== CIStatus.UNSPECIFIED
        ? html`<div class="row">
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
}

declare global {
  interface HTMLElementTagNameMap {
    'ft-inspector-code': FtInspectorCode;
  }
}
