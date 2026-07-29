import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { safeHref } from './safe-url.js';

/**
 * Absolute (scheme-bearing) or protocol-relative references.
 *
 * These are the only two shapes that can name a host of the attacker's
 * choosing, and they are exactly the shapes `safeHref` is written to decide.
 * Everything else a markdown author can write -- `./docs/x.md`, `/tasks/7`,
 * `#section` -- resolves against the dashboard's own document base, so it
 * cannot leave the origin and cannot carry userinfo. `safeHref` deliberately
 * parses with NO base argument (see the note in safe-url.ts) and therefore
 * REJECTS every one of those relative forms; passing them to it would delete
 * legitimate in-document links and turn a security control into a bug report.
 * So the hook below polices absolute references only, and that carve-out is
 * pinned by its own fixtures.
 *
 * `//host/x` is INSIDE the policed set, not outside it: it names a host, and
 * `safeHref` refuses it (the no-base parse throws) rather than laundering it
 * into the page's scheme.
 */
const NAMES_A_HOST = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i;

/**
 * ONE URL POLICY, APPLIED AT THE MARKDOWN SINK.
 *
 * `renderMarkdown` turns markdown link syntax into real `<a href>` elements and
 * its output is injected with `unsafeHTML` (ft-inspector-desc.ts,
 * ft-inspector-comments.ts). Before this hook existed, `safeHref` was never
 * called on that path: DOMPurify ran with its defaults, no
 * `ALLOWED_URI_REGEXP`, and 3.4.12's default URI policy has no rule about
 * userinfo. So `[github.com/farmtable/farmtable](https://user:pass@evil.example/)`
 * survived sanitising with the href intact and the LINK TEXT chosen by the same
 * author -- measured, verbatim output:
 *
 *   <p><a href="https://user:pass@evil.example/">github.com/farmtable/farmtable</a></p>
 *
 * NOT XSS. DOMPurify does strip `javascript:` and `data:`, verified as negative
 * controls, and it still does -- this hook runs AFTER that stripping and never
 * sees those values, because the attribute is already gone. What survived was
 * PHISHING and CREDENTIAL DISCLOSURE: a link that reads as one host, navigates
 * to another, and hands `user:pass` to it on click. The defect predates the
 * credential clause; it is a binding the clause was never on.
 *
 * WHY A HOOK OVER `ALLOWED_URI_REGEXP`. Both close the hole. A regexp states
 * the URL policy a second time, in a second dialect, in a second place -- and
 * the whole finding here is that a second, weaker, unstated policy already
 * existed on this path. Routing through `safeHref` means there is ONE policy,
 * one set of fixtures pinning it, and one place to change it; a future edit to
 * SAFE_SCHEMES or to the credential clause reaches the markdown sink for free
 * instead of leaving it a version behind.
 *
 * REFUSAL DEGRADES TO INERT TEXT, IT DOES NOT VANISH. Only the `href` is
 * removed, so the anchor's text stays on screen exactly as written, and the
 * rejected URL is put in the `title` -- the same degradation contract as the
 * two guarded call sites (`Unsupported URL: ...` at ft-inspector-code.ts and
 * ft-inspector-meta.ts) and the one safe-url.ts asks callers for. Any
 * author-supplied markdown title (`[t](url "title")`) is OVERWRITTEN on refusal
 * rather than kept: the author of a refused link is the one party who must not
 * be able to choose the text explaining why it was refused.
 *
 * ONE POLICY MEANS ONE POLICY, INCLUDING ITS COSTS. `SAFE_SCHEMES` is http/https
 * only, so a markdown `mailto:` link now renders as inert text. That is a real
 * behaviour change and it is deliberate: the alternative is a markdown-specific
 * scheme set, which is the second-policy failure this hook exists to end. It is
 * pinned as a fixture so the trade is visible and reversible in one place.
 *
 * SCOPE, STATED RATHER THAN IMPLIED. This hook governs `href`. `src` (markdown
 * images) is NOT routed through `safeHref` here: a credential-bearing image URL
 * is a different shape of the same class -- it leaks on render rather than on
 * click -- and widening this change to cover it was outside the task that
 * produced the hook. It is recorded in the project log, not closed here.
 *
 * FAIL-CLOSED IN A DOM-LESS ENVIRONMENT. `DOMPurify` with no `window` returns a
 * factory with `isSupported === false` and defines neither `sanitize` nor
 * `addHook`, so importing this module without a DOM now throws at import time
 * rather than at first render. That is the same direction `renderMarkdown`
 * already failed in, moved earlier and made louder.
 */
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (!node.hasAttribute('href')) return;
  const raw = node.getAttribute('href') ?? '';
  if (!NAMES_A_HOST.test(raw)) return;
  if (safeHref(raw) !== undefined) return;
  node.removeAttribute('href');
  node.setAttribute('title', `Unsupported URL: ${raw}`);
});

export function renderMarkdown(md: string): string {
  return DOMPurify.sanitize(marked.parse(md) as string);
}
