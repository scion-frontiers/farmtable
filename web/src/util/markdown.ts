import { marked } from 'marked';
import createDOMPurify from 'dompurify';
import { safeHref } from './safe-url.js';

/**
 * A PRIVATE SANITISER INSTANCE, NOT THE PROCESS-GLOBAL SINGLETON.
 *
 * `import DOMPurify from 'dompurify'` hands every importer the SAME object.
 * Hooks live on that object, so the previous version of this file installed the
 * URL policy where any other module -- application code, a dependency, a test
 * -- could remove it with one `DOMPurify.removeAllHooks()`, and where the order
 * of imports decided whether it was installed at all. Neither of those is a
 * property a reader can check by looking at this file.
 *
 * Calling the default export with a window returns an INSTANCE. This one is
 * module-private: nothing else can reach it, so the hook below cannot be
 * removed at a distance and cannot be raced by import order. Pinned by
 * testTheGlobalSanitiserCannotDisarmThisOne in markdown-href.test.ts, which
 * calls `removeAllHooks()` on the global and then re-checks a refusal.
 */
const purify = createDOMPurify(window);

/**
 * FAIL CLOSED WITHOUT A DOM, LOUDLY AND AT IMPORT TIME.
 *
 * `createDOMPurify` with no usable window returns a factory whose `sanitize` is
 * undefined (measured in purify.es.mjs: it returns early when
 * `!window.document`). Left alone that surfaces as a TypeError at first render,
 * on a value that has not been sanitised. This turns it into an error at import.
 */
if (!purify.isSupported) {
  throw new Error(
    'renderMarkdown requires a DOM: DOMPurify reports isSupported === false, so ' +
      'nothing would be sanitised.',
  );
}

/**
 * Attributes that carry a navigable reference in the output of `marked` plus
 * DOMPurify's defaults.
 *
 * `xlink:href` is here because DOMPurify's default configuration permits inline
 * SVG, and `<svg><a xlink:href="https://user:pass@evil.example/">` is a
 * clickable link that never carries an `href`. Measured on this pipeline before
 * this list existed: the SVG anchor survived with credentials intact while the
 * HTML anchor beside it was refused.
 *
 * `action` is here because A FORM IS A LINK WITH A BUTTON ON IT. DOMPurify's
 * current default permits `<form>`, `<button>` and `action`, and a form with no
 * `method` submits as GET, so this was one click from the same disclosure the
 * `href` rule exists to stop -- measured, verbatim survivor:
 *
 *   <form action="https://github.com@evil.example/"><button>View pull request
 *   #482</button></form>
 *
 * MEASURED NEGATIVE, on this version: `formaction` on `<input>` and `<button>`
 * is stripped by DOMPurify's own defaults before any hook runs, so it is not in
 * this list and is not pinned. That is somebody else's behaviour and it can
 * change without notice; if `formaction` ever survives, it belongs here.
 *
 * THE GAP IN THIS LIST IS PRESENT TENSE, AND SAYING SO IS THE POINT. An earlier
 * version of this paragraph called it a risk about a FUTURE DOMPurify default,
 * which read as "nothing to do today" and routed the reader straight past a live
 * hole: `action` was already permitted, already navigating, and already absent
 * from the list at the moment that sentence was written. C-4 is what that
 * mis-tensing cost. THIS LIST IS AN ENUMERATION AND IT IS ONLY AS CURRENT AS ITS
 * LAST MEASUREMENT -- today, right now, no check anywhere reconciles it against
 * what DOMPurify actually permits. The reconciliation that would make it
 * self-checking (walk DOMPurify's allowed-attribute set, assert that nothing
 * navigable is missing from here) IS NOT BUILT. Until it is, every DOMPurify
 * upgrade silently re-opens this question and nothing will fail to tell you.
 */
const LINK_ATTRS = ['href', 'xlink:href', 'action'] as const;

/**
 * THE DECISION IS THE PLATFORM PARSER'S, NOT A PATTERN'S.
 *
 * This function replaces a regular expression that tried to recognise "shapes
 * that can name a host" from the text of the reference. That regexp was a
 * second URL parser in a second dialect -- exactly the failure the hook below
 * exists to end, one level down -- and it was STRICTLY WEAKER than the function
 * it was carving around. Measured counterexamples, all of which it waved past
 * `safeHref` and all of which leave the origin:
 *
 *   ht<TAB>tps://user:pass@evil.example/   the tab sits INSIDE the scheme, so
 *                                          `^scheme:` did not match; the URL
 *                                          parser removes tab/CR/LF and
 *                                          resolves https://user:pass@evil...
 *   /\github.com@evil.example/             starts "/\", not "//", so
 *                                          `^//` did not match; WHATWG treats
 *                                          "/\" as "//" for special schemes.
 *   \/github.com@evil.example/             the same, mirrored.
 *
 * So the reference is RESOLVED, once, by `new URL(raw, document.baseURI)` --
 * the same parse the browser will perform on the attribute -- and the decision
 * is taken on the result:
 *
 *  - Unresolvable: REFUSED. Fail closed. The browser would not navigate
 *    anywhere useful either, and "I could not parse it" is not a reason to keep
 *    an attribute.
 *  - Any userinfo: REFUSED, before the origin comparison. `URL.origin` does not
 *    include userinfo, so `//user:pass@<our own host>/` is SAME-ORIGIN and
 *    still hands credentials to the host on click.
 *  - Resolved same-origin: PERMITTED. This is the carve-out for ordinary
 *    in-document links (`./docs/x.md`, `/tasks/7`, `#section`), and it is a
 *    property of the RESOLVED URL rather than of the string: `/\github...`
 *    looks relative and is not, `#section` looks like a fragment and is one.
 *    Opaque origins (`origin === 'null'`, e.g. an `about:blank` base) are
 *    excluded, so two opaque origins are never treated as "the same".
 *  - Everything else: `safeHref` decides, and it is handed the ABSOLUTE
 *    resolved href. That keeps safe-url.ts's no-base contract intact -- the
 *    resolution happens here, before the call, and `safeHref` still parses with
 *    no base.
 *
 * WHAT MOVED WHEN THE PREDICATE MOVED, and it is a real behaviour change rather
 * than a tidy-up. Deciding on the RESOLVED URL means the spelling stops
 * mattering in BOTH directions. `//evil.example/x` and `/\evil.example/x` now
 * resolve to `https://evil.example/x` and are KEPT, where the first version of
 * this hook refused the first of them and waved the second past. That is
 * consistent rather than lax: this policy is about SCHEMES and CREDENTIALS, an
 * attacker-chosen HOST is reachable through any plainly accepted link, and
 * owner ruling C2 keeps ordinary http(s) links clickable. Refusing one spelling
 * of a URL the policy accepts in another spelling is a decision about the
 * string, which is the class of decision being repaired here. `safeHref` at the
 * component bindings is unchanged: it still refuses `//host/x`, because there
 * is no resolution step there and the value is a stored field expected to be
 * absolute.
 *
 * WHAT THIS DOES NOT CLAIM. It does not claim the resolved URL is the one the
 * browser will navigate to in every embedding: `document.baseURI` is read at
 * decision time and a `<base>` element inserted after this runs would change
 * the answer. NOT MEASURED: whether any view in this application sets or
 * mutates `<base>`.
 */
function isPermitted(raw: string): boolean {
  let base: URL;
  let resolved: URL;
  try {
    base = new URL(document.baseURI);
    resolved = new URL(raw, base);
  } catch {
    return false;
  }

  if (resolved.username !== '' || resolved.password !== '') return false;
  if (resolved.origin !== 'null' && resolved.origin === base.origin) return true;

  return safeHref(resolved.href) !== undefined;
}

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
 * instead of leaving it a version behind. The first version of this hook then
 * introduced a second dialect anyway, in its carve-out, which is what
 * `isPermitted` above exists to correct.
 *
 * WHAT A REFUSAL RENDERS -- OPTION B, BY OWNER RULING. Quoted verbatim from
 * coordinator-rulings/PTONE-REJECTUX-2035.md:11: "Show the item's name with no
 * link and no trace of the address. The user sees a plain label and gets no
 * signal that anything was refused."
 *
 * So the reference attribute is removed and NOTHING is added. The element's own
 * text stays on screen exactly as written; there is no notice, no tooltip and
 * no residue of the rejected URL in any attribute.
 *
 * The first version of this hook wrote `Unsupported URL: <the rejected URL>`
 * into `title`, which is Option A. Both are equally safe against the attack --
 * the href is gone either way -- but A composes a user-visible string out of an
 * attacker-chosen one and renders it as part of the product, at whatever length
 * and over as many lines as its author likes. The ruling settles the trade
 * between diagnosability and disclosure in favour of disclosing nothing.
 *
 * WHAT "ADD NOTHING" LEAVES IN PLACE, stated because it is a real consequence
 * and not an oversight: an author-supplied markdown title (`[t](url "title")`)
 * SURVIVES on a refused link, because removing it would be adding a behaviour
 * the ruling did not ask for. That text is the author's, not this module's, and
 * it is the same reach the author already has over the link TEXT, which Option
 * B keeps by design. FILED, NOT DECIDED HERE.
 *
 * The two guarded call sites (ft-inspector-code.ts, ft-inspector-meta.ts) still
 * render Option A notices. They are a separate pass and are deliberately not
 * touched here.
 *
 * ONE POLICY MEANS ONE POLICY, INCLUDING ITS COSTS. `SAFE_SCHEMES` is http/https
 * only, so a markdown `mailto:` link now renders as inert text. That is a real
 * behaviour change and it is deliberate: the alternative is a markdown-specific
 * scheme set, which is the second-policy failure this hook exists to end. It is
 * pinned as a fixture so the trade is visible and reversible in one place.
 *
 * SCOPE, STATED RATHER THAN IMPLIED. This hook governs the attributes in
 * `LINK_ATTRS` -- `href`, `xlink:href` and `action` -- on EVERY element
 * DOMPurify keeps, not only on anchors; `<area href>` and `<form action>` are
 * policed by the same pass, and both arms are pinned.
 *
 * WHAT IS ACCEPTED, SIZED HONESTLY. `src` is NOT routed through `safeHref`: a
 * credential-bearing image URL is a different shape of the same class -- it
 * leaks ON RENDER rather than on click, with no interaction at all -- and it is
 * owner-ruled, not re-litigated here.
 *
 * THE ACCEPTED RISK IS A CLASS, AND THIS PARAGRAPH DELIBERATELY DOES NOT COUNT
 * IT. What is accepted is: ANY ATTRIBUTE DOMPURIFY PERMITS THAT CAUSES A FETCH
 * ON RENDER is not routed through this hook. Not a list of attributes -- the
 * property. Earlier drafts said "`src`", then "four attributes wide", and each
 * time the number was the newest measurement mistaken for the boundary. THE
 * SECOND VERSION WAS THE MORE DANGEROUS ONE, because "four" reads as the output
 * of an audit while "src" reads as an example. A COUNT IN PROSE WOULD NEED
 * EXACTLY THE RECONCILIATION THAT THE `LINK_ATTRS` DOCBLOCK ABOVE STATES IS NOT
 * BUILT; writing one here would re-commit, in the disclosure, the error the
 * disclosure exists to describe.
 *
 * KNOWN MEMBERS, AS EXAMPLES AND EXPRESSLY NOT AS THE DEFINITION. Measured on
 * this pipeline with `<a href>` and `<form action>` as negative controls in the
 * same run, both refused, so these are results and not a dead harness:
 * `src` (<img>, markdown images, <svg><image>), `srcset`, `poster`,
 * `background` (<table> and <td>), `style` (background-image:url(...),
 * background:url(...), list-style-image:url(...)), and the SVG functional IRIs
 * `fill`/`filter`/`mask`/`clip-path` written as url(...). If you can count these
 * and take the count for the boundary, this paragraph is written wrong.
 *
 * WHY THE CLASS EXISTS, WHICH IS THE PART THAT GENERALISES. Two distinct
 * mechanisms put members in it, and neither is a gap in this hook:
 *   1. `style` IS IN DOMPurify's DEFAULT_URI_SAFE_ATTRIBUTES (purify.cjs.js:683,
 *      consumed at :1801, where a URI-safe name is accepted in a branch that
 *      SHORT-CIRCUITS BEFORE `IS_ALLOWED_URI` is ever evaluated). So DOMPurify
 *      is not failing to police the URL inside a CSS declaration; IT IS
 *      DECLINING TO POLICE THE ATTRIBUTE AT ALL, by configuration, by default.
 *   2. The others are URI-valued attributes DOMPurify does check, whose values
 *      pass its scheme test because they are ordinary https. Its default URI
 *      policy has no rule about userinfo -- the same fact that made F-1
 *      possible at `href`.
 * The reusable half: A URL CAN SIT INSIDE AN ATTRIBUTE VALUE RATHER THAN BE ONE,
 * AND AN ATTRIBUTE-NAME POLICY CANNOT SEE IT. That is a different failure from
 * C-4, where the attribute WAS URL-typed and the list was merely short. This
 * widening came from reading ALLOWED_ATTR and DEFAULT_URI_SAFE_ATTRIBUTES, not
 * from fixtures, which is why it reached a class the fixtures had no case for.
 *
 * The RULING on the fetch-on-render class is unchanged and NO GUARD is added for
 * any member. Only the sizing changed, and it changed from a number to a
 * property so that the next member does not require this paragraph to be wrong
 * first. Recorded in the project log, not closed here.
 *
 * NOT MEASURED: whether a browser TRANSMITS the userinfo on a SUBRESOURCE fetch.
 * Browsers block embedded credentials there, so the FETCH is live and the
 * CREDENTIAL half may already be mitigated by the platform. JSDOM cannot answer
 * it and nothing here has tested it. This applies to the WHOLE class, including
 * the members disclosed before this note existed. Do not read the examples as
 * "credentials leak" and do not read this note as "safe": what is measured is
 * that the value SURVIVES SANITISING with the userinfo intact.
 *
 * NOT MEASURED, SEPARATELY: whether any browser dereferences an EXTERNAL SVG
 * functional IRI at all. Several restrict `fill`/`filter`/`mask`/`clip-path` to
 * same-document references, in which case those members are survival without a
 * fetch. Survival is measured; dereference is not. They are named because the
 * value reaches the DOM, not because a request was observed.
 *
 * NOT MEASURED: whether a `title` attribute on a non-HTML element (the SVG
 * anchor above) surfaces as a tooltip in any browser. The refusal is effective
 * either way -- the reference attribute is gone -- but the explanation may not
 * be visible there.
 */
purify.addHook('afterSanitizeAttributes', (node) => {
  for (const attr of LINK_ATTRS) {
    if (!node.hasAttribute(attr)) continue;
    if (isPermitted(node.getAttribute(attr) ?? '')) continue;
    node.removeAttribute(attr);
  }
});

/**
 * C89 / ISSUE #195: FORBID_TAGS AND FORBID_ATTR, per owner ruling.
 *
 * Owner ruling 2026-07-30T19:02:32Z, verbatim: "conforming to a similar set of
 * expectations as on github is a good default for questions like this." That
 * resolves both the form-control vector and the style-attribute overlay vector.
 *
 * FORBID_TAGS is a DENYLIST. It names six spellings of the hazard. An element
 * not on this list -- or a future DOMPurify default, or an SVG/MathML element
 * nobody listed -- can comply exactly and still put an interactive control on
 * the page. GitHub, by contrast, uses an ALLOWLIST of permitted tags. The cost
 * of migrating to an allowlist is measured in the C89 report
 * (reports/c89-fix.md, deliverable 3) but is NOT implemented here: regression
 * risk on existing rendered content is real and unmeasured.
 *
 * MEASURED, VERBATIM, BEFORE THIS CHANGE (DOMPurify 3.x defaults, no config):
 *
 *   <form action="https://github.com@evil.example/"><button>View pull request #482</button></form>
 *   survived as: <form><button>View pull request #482</button></form>
 *   The afterSanitizeAttributes hook stripped `action`, but the <form> and
 *   <button> elements survived as interactive controls on a trusted origin.
 *
 *   <input type="text" placeholder="Enter password">
 *   survived as: <input type="text" placeholder="Enter password">
 *
 *   <select><option value="a">A</option><option value="b">B</option></select>
 *   survived as: <p><select><option value="a">A</option><option value="b">B</option></select></p>
 *
 *   <textarea>Enter credentials</textarea>
 *   survived as: <textarea>Enter credentials</textarea>
 *
 *   <div style="position:fixed;top:0;left:0;width:100%;height:100%;background:white;z-index:9999">FAKE LOGIN</div>
 *   survived as: <div style="position:fixed;top:0;left:0;width:100%;height:100%;background:white;z-index:9999">FAKE LOGIN</div>
 *   The style attribute survived verbatim, permitting attacker-controlled CSS
 *   overlays over real UI.
 *
 * MEASURED, VERBATIM, AFTER THIS CHANGE (with FORBID_TAGS and FORBID_ATTR):
 *
 *   <form action="https://github.com@evil.example/"><button>View pull request #482</button></form>
 *   survived as: View pull request #482
 *   The <form> and <button> tags are stripped; text content is preserved.
 *
 *   <input type="text" placeholder="Enter password">
 *   survived as: (empty string)
 *   The <input> is stripped (void element, no text content to preserve).
 *
 *   <select><option value="a">A</option><option value="b">B</option></select>
 *   survived as: <p>AB</p>
 *   Tags stripped; text content of options preserved.
 *
 *   <textarea>Enter credentials</textarea>
 *   survived as: Enter credentials
 *   Tag stripped; text content preserved.
 *
 *   <div style="position:fixed;...">FAKE LOGIN</div>
 *   survived as: <div>FAKE LOGIN</div>
 *   The style attribute is stripped; the <div> and its text survive.
 *
 * MEASURED NEGATIVE: `formaction` on `<button>` is STILL stripped by
 * DOMPurify's own defaults before FORBID_TAGS fires, confirming the
 * existing negative documented in the LINK_ATTRS docblock above. With
 * FORBID_TAGS now stripping <button> itself, this is doubly unreachable.
 *
 * POSITIVE CONTROL for style stripping: `class` attribute on the same
 * element survives. Measured: <div class="info-box" style="color:red">text</div>
 * produces <div class="info-box">text</div>. The class attribute is present
 * (positive control alive); the style attribute is absent (refusal effective).
 *
 * WHY `input` IS NOT IN FORBID_TAGS (round 2 of this change). GFM task-list
 * syntax (`- [ ]`, `- [x]`) renders via `marked` as
 * `<input type="checkbox" disabled>`. A blanket `input` in FORBID_TAGS strips
 * those checkboxes, breaking a documented content pattern (mock data in
 * web/src/gen/service.ts:400 contains task lists). GitHub RENDERS task-list
 * checkboxes; a GitHub-conforming sanitiser must too.
 *
 * Instead, a `uponSanitizeElement` hook below strips `<input>` elements UNLESS
 * `type="checkbox"` AND `disabled` is present. This preserves the security
 * property for interactive inputs (text, password, submit, hidden, etc.) while
 * keeping the read-only display checkbox that GFM task lists produce.
 *
 * WHAT STILL REACHES THE PAGE THROUGH THIS GATE:
 *   <input type="checkbox" disabled>         — unchecked task-list item
 *   <input type="checkbox" disabled checked> — checked task-list item
 * Both are read-only (disabled prevents interaction), non-submittable (no
 * form to submit to — <form> is in FORBID_TAGS), and carry no credential
 * or phishing risk. DOMPurify's attribute sanitisation strips event handlers
 * (onclick etc.) and FORBID_ATTR strips `style` on surviving elements.
 *
 * WHAT DOES NOT REACH THE PAGE (measured):
 *   <input type="text" placeholder="Enter password">  — stripped (not checkbox)
 *   <input type="password">                            — stripped (not checkbox)
 *   <input type="submit" value="Go">                   — stripped (not checkbox)
 *   <input type="hidden" name="x" value="y">           — stripped (not checkbox)
 *   <input type="checkbox">                            — stripped (no disabled)
 *   <input>                                            — stripped (no type, no disabled)
 *
 * The distinction is: `type="checkbox"` AND `disabled`. Both conditions are
 * required. A checkbox without `disabled` is interactive (can be toggled) and
 * is stripped. An input with `disabled` but a non-checkbox type is a
 * non-display form control and is stripped. Only the read-only display
 * checkbox survives — the exact element GFM task lists produce.
 *
 * ATTACKER-INJECTED `<input type="checkbox" disabled>` IN RAW HTML also
 * survives this gate. This is the same element shape as a task-list checkbox
 * and carries the same (negligible) risk: a disabled, read-only, formless
 * checkbox. Distinguishing the source (marked's parser vs raw HTML) is not
 * possible at this layer, and the security property does not require it.
 */

/**
 * SELECTIVE INPUT STRIPPING: all inputs except task-list checkboxes.
 *
 * This hook fires before DOMPurify's own allow/forbid decision. When it
 * detaches a node from its parent, DOMPurify recognises the detachment
 * (purify.cjs.js line 1681) and treats the element as removed.
 *
 * ORDER OF OPERATIONS:
 *   1. uponSanitizeElement hook (this) — strips non-checkbox inputs
 *   2. FORBID_TAGS check — strips form, button, select, textarea, option
 *   3. Attribute sanitisation — DOMPurify defaults + FORBID_ATTR + afterSanitizeAttributes hook
 *
 * A surviving checkbox input goes through steps 2 (passes — not in
 * FORBID_TAGS) and 3 (DOMPurify strips event handlers; FORBID_ATTR strips
 * style; afterSanitizeAttributes polices LINK_ATTRS, none of which apply to
 * input). The element that reaches the output has only type, disabled,
 * and optionally checked.
 */
purify.addHook('uponSanitizeElement', (node, data) => {
  if (data.tagName === 'input') {
    const el = node as unknown as Element;
    const isTaskListCheckbox =
      el.getAttribute('type') === 'checkbox' && el.hasAttribute('disabled');
    if (!isTaskListCheckbox) {
      node.parentNode?.removeChild(node);
    }
  }
});

export function renderMarkdown(md: string): string {
  return purify.sanitize(marked.parse(md) as string, {
    FORBID_TAGS: ['form', 'button', 'select', 'textarea', 'option'],
    FORBID_ATTR: ['style'],
  });
}
