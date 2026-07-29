import { html, css, nothing, type TemplateResult } from 'lit';

/**
 * Rendering for a URL that failed `safeExternalUrl`.
 *
 * The product decision (owner, 2026-07-29) is that a rejected address is
 * neither linked nor discarded: the item is marked deactivated in line, and the
 * original address stays on screen in a form the user can select and copy.
 * Dropping the value silently loses information the user may need in order to
 * decide the destination is fine and open it deliberately; linking it is the
 * vulnerability.
 *
 * FOUR CONSTRAINTS, and each one is asserted in
 * `test/deactivated-link.test.ts`:
 *
 *  1. The raw value never becomes an `href` — not here, not on a child, not on
 *     a wrapper someone adds later for styling. That is the whole feature.
 *  2. The raw value is rendered as TEXT, never as markup. Every string reaching
 *     this function failed validation, so it is attacker-authored by
 *     definition. Rendering it is the deliberate decision; PARSING it is the
 *     bug. The `${}` below is a Lit child binding, which produces a text node —
 *     do not "improve" it into `unsafeHTML`, and note that this file's sibling
 *     `ft-inspector-desc.ts` does legitimately use `unsafeHTML`, so the import
 *     is one autocomplete away.
 *  3. The marker sits adjacent to the copyable value. A badge at one end of the
 *     row and an address at the other is two facts the user has to join, and
 *     they are one paste away from navigating to a hostile address.
 *  4. Title-attribute delivery does not satisfy this. A tooltip is not
 *     selectable text and is not copyable on touch at all — and, separately, an
 *     attribute value cannot contain elements, so a `title` is inert by the
 *     parser's construction rather than by ours. That makes it untestable for
 *     the markup-injection case it would appear to cover.
 */
export const deactivatedLinkStyles = css`
  .deactivated-link {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    max-width: 100%;
    flex-wrap: wrap;
  }

  .deactivated-marker {
    flex: none;
    font-size: 0.6875rem;
    font-weight: 600;
    line-height: 1.4;
    letter-spacing: 0.02em;
    text-transform: uppercase;
    padding: 0.0625rem 0.375rem;
    border-radius: 0.625rem;
    color: var(--sl-color-danger-700, #b42318);
    background: var(--sl-color-danger-100, #fee4e2);
    border: 1px solid var(--sl-color-danger-200, #fecdca);
  }

  /*
   * user-select:all makes one click or one tap select the entire address, so
   * copying it does not require a drag the user could get wrong. This is the
   * copyable half of the owner's decision; it is not cosmetic.
   */
  .deactivated-url {
    user-select: all;
    -webkit-user-select: all;
    font-family: var(--sl-font-mono, ui-monospace, monospace);
    font-size: 0.75rem;
    line-height: 1.4;
    overflow-wrap: anywhere;
    word-break: break-all;
    color: var(--sl-color-neutral-700, #475467);
    background: var(--sl-color-neutral-100, #f2f4f7);
    padding: 0.0625rem 0.25rem;
    border-radius: 0.1875rem;
  }
`;

/**
 * Render the deactivated marker and the unusable original address together.
 *
 * Returns `nothing` when there is no address to show — an empty or absent value
 * carries no information for the user to copy, and an empty marker would be a
 * warning about nothing.
 */
export function renderDeactivatedLink(raw: string | null | undefined): TemplateResult | typeof nothing {
  if (raw == null || raw === '') return nothing;

  return html`<span class="deactivated-link" data-deactivated-link>
    <span class="deactivated-marker" data-deactivated-marker>Link deactivated</span>
    <code class="deactivated-url" data-deactivated-url>${raw}</code>
  </span>`;
}
