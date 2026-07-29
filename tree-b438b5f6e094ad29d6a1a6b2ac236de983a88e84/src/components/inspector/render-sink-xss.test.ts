/**
 * XSS pins for the two stored-content RENDER SINKS.
 *
 * WHAT THIS PINS. `ft-inspector-desc` and `ft-inspector-comments` are the only
 * two places in web/src that push server-supplied text through `unsafeHTML`.
 * Both route it through `renderMarkdown`, which is one line:
 *
 *     DOMPurify.sanitize(marked.parse(md))          -- src/util/markdown.ts:5
 *
 * That line is the ONLY control between stored content and script execution in
 * an authenticated user's browser. Measured at faf1c8c: there is no
 * Content-Security-Policy anywhere in this repository, and the dashboard is
 * served by a bare http.FileServer that sets no headers. IAP does not help --
 * it authenticates the REQUEST; it does nothing about a script that a
 * legitimate user's own browser runs from content someone else stored.
 *
 * WHY THE ASSERTIONS PARSE A DOM INSTEAD OF GREPPING THE STRING. The first
 * version of this check used a regex over the sanitised HTML looking for
 * `onerror|javascript:|<script`. It reported three "leaks" against the real
 * production chain. All three were false:
 *
 *   <form action="javascript:...">   -> DOMPurify removed the action; a bare
 *                                       <form> survived and the regex saw "<form".
 *   style="background:url(javascript:...)"
 *                                    -> survives as CSS, is not executable in
 *                                       any current browser, and is not a sink.
 *   ![x](x" onerror="alert(1))       -> marked emitted it as literal TEXT inside
 *                                       <p>; the regex matched the word in prose.
 *
 * A regex over rendered HTML is not an oracle. It cannot tell an attribute from
 * a text node, and every one of its errors points the same way -- toward a
 * false alarm on code that is actually correct. So `findExecutable()` below
 * parses the output and asks the DOM what is an attribute, what is an element
 * and what is text. GREP IS NOT AN ORACLE.
 *
 * WHAT WOULD MAKE THESE TESTS GO RED. Deleting or bypassing the
 * `DOMPurify.sanitize(...)` call in src/util/markdown.ts. Measured, not
 * asserted: with the sanitiser removed, 15 of the 20 vectors below become real
 * executable constructs. With it in place, 0 of 20 do. Reversing the two calls
 * -- sanitising the markdown SOURCE and then parsing it -- reopens 2 of 20,
 * which is why `sanitiserRunsAfterParseNotBefore` exists as its own pin.
 */
import { JSDOM } from 'jsdom';
import { assert, assertEqual } from '../../util/assertions.js';

// Type-only, and load-bearing. `ft-inspector-comments.ts:112` does
// `this.shadowRoot?.querySelector('sl-details')` and then reads `.open` on the
// result, which only type-checks if Shoelace's HTMLElementTagNameMap
// augmentation is in the program. `npm run typecheck` gets it for free because
// it compiles all of src/, and src/index.ts imports the Shoelace components.
// The TEST program is a different, narrower program -- the transitive closure
// of *.test.ts -- so it does not, and importing the component here without this
// line fails to compile with TS2339 on a file this test does not even modify.
// `import type {}` pulls in the declaration without emitting a runtime import,
// which matters: importing the real component would drag Shoelace into jsdom.
import type {} from '@shoelace-style/shoelace/dist/components/details/details.js';

// ---------------------------------------------------------------------------
// jsdom globals must exist BEFORE lit or dompurify are imported. DOMPurify
// binds to `window` at module-evaluation time: with no DOM it sets
// isSupported=false and does not even define `sanitize`, so `renderMarkdown`
// would throw TypeError. That failure is an environment artefact with no
// security meaning, and a pin that can produce it is a false-alarm generator.
// `domPurifyIsOperativeInThisEnvironment` below turns that into an explicit
// checked precondition rather than a silent assumption.
// ---------------------------------------------------------------------------
const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  url: 'https://dashboard.test/',
  pretendToBeVisual: true,
});

const g = globalThis as unknown as Record<string, unknown>;
const w = dom.window as unknown as Record<string, unknown>;

// Lit resolves to its "node" export condition here (@lit/reactive-element/node/
// css-tag.js), which reads DOM constructors off the global scope at module
// evaluation time -- `Document` first. Enumerating rather than hand-listing:
// a hand-list is a checklist, and every constructor missing from it is a
// ReferenceError from inside a dependency, thrown at import time, with a
// message that names lit and not the omission. Copy every DOM constructor
// (capitalised) plus the lowercase globals lit and the components actually use,
// and never clobber something Node already defines.
const LOWERCASE_GLOBALS = [
  'window', 'document', 'customElements', 'localStorage', 'sessionStorage',
  'navigator', 'location', 'history', 'getComputedStyle', 'matchMedia',
  'requestAnimationFrame', 'cancelAnimationFrame', 'queueMicrotask',
];
for (const name of Object.getOwnPropertyNames(dom.window)) {
  const wanted = /^[A-Z]/.test(name) || LOWERCASE_GLOBALS.includes(name);
  if (!wanted) continue;
  if (name in globalThis && !LOWERCASE_GLOBALS.includes(name)) continue;
  try {
    g[name] = w[name];
  } catch {
    // Some jsdom globals are getter-only on the Node side; skipping them is
    // correct, and anything genuinely required will surface as a loud
    // ReferenceError from the import below rather than a silent wrong answer.
  }
}

// ---------------------------------------------------------------------------
// The oracle.
// ---------------------------------------------------------------------------

/** Anything in `html` that a browser would actually execute or navigate to. */
function findExecutable(html: string): string[] {
  const doc = new JSDOM(`<body>${html}</body>`).window.document;
  const hits: string[] = [];
  for (const el of Array.from(doc.querySelectorAll('*'))) {
    for (const attr of Array.from(el.attributes)) {
      if (/^on/i.test(attr.name)) {
        hits.push(`event-handler ${el.tagName.toLowerCase()}[${attr.name}]`);
      }
      if (/^(href|src|action|formaction|srcdoc|data|xlink:href)$/i.test(attr.name)) {
        // Strip whitespace and control characters the way a URL parser does,
        // so `java\tscript:` and `java script:` are not treated as clean.
        const v = (attr.value || '').replace(/[\s\x00-\x1f]/g, '').toLowerCase();
        if (v.startsWith('javascript:')) {
          hits.push(`javascript: in ${el.tagName.toLowerCase()}[${attr.name}]`);
        }
        if (v.startsWith('data:') && /html|script|svg/.test(v)) {
          hits.push(`dangerous data: in ${el.tagName.toLowerCase()}[${attr.name}]`);
        }
      }
    }
    if (/^(SCRIPT|IFRAME|OBJECT|EMBED|BASE)$/.test(el.tagName)) {
      hits.push(`<${el.tagName.toLowerCase()}> element`);
    }
  }
  return hits;
}

/**
 * Attack corpus. Every entry must be neutralised. Deleting rows from this list
 * weakens the pin silently, which is what run-tests.mjs's assertion count is
 * there to catch -- each vector is one assertion.
 */
const VECTORS: ReadonlyArray<readonly [string, string]> = [
  ['script element', '<script>alert(1)</script>'],
  ['img onerror', '<img src=x onerror="alert(1)">'],
  ['svg onload', '<svg onload="alert(1)"></svg>'],
  ['markdown link javascript:', '[click](javascript:alert(1))'],
  ['raw anchor javascript:', '<a href="javascript:alert(1)">c</a>'],
  ['markdown link data:', '[click](data:text/html,<script>alert(1)</script>)'],
  ['raw anchor data: base64', '<a href="data:text/html;base64,PHN2Zz4=">x</a>'],
  ['iframe srcdoc', '<iframe srcdoc="<script>alert(1)</script>"></iframe>'],
  ['form action javascript:', '<form action="javascript:alert(1)"><button>x</button></form>'],
  ['mXSS via noscript', '<noscript><p title="</noscript><img src=x onerror=alert(1)>">'],
  ['css url javascript:', '<div style="background:url(javascript:alert(1))">x</div>'],
  ['autofocus onfocus', '<input autofocus onfocus="alert(1)">'],
  ['markdown image breakout', '![x](x" onerror="alert(1))'],
  ['comment breakout', '<!--><img src=x onerror=alert(1)>-->'],
  ['base tag', '<base href="javascript:alert(1)//">'],
  ['mXSS via mglyph/style', '<math><mtext><table><mglyph><style><img src=x onerror=alert(1)>'],
  ['case-varied entity colon', '<a href="jAvAsCrIpT&colon;alert(1)">x</a>'],
  ['numeric entity javascript:', '<a href="&#106;avascript:alert(1)">x</a>'],
  ['unclosed img onerror', '<img src=x onerror=alert(1)//'],
  ['svg animate onbegin', '<svg><animate onbegin=alert(1) attributeName=x dur=1s>'],
];

/** A payload that is unambiguously script if anything survives at all. */
const CANARY = '<img src=x onerror="alert(1)"><script>alert(2)</script>';

// ---------------------------------------------------------------------------
// Component rendering helpers.
// ---------------------------------------------------------------------------

async function mount<T extends HTMLElement>(tag: string, apply: (el: T) => void): Promise<T> {
  const el = dom.window.document.createElement(tag) as unknown as T;
  apply(el);
  dom.window.document.body.appendChild(el as unknown as globalThis.Node);
  await (el as unknown as { updateComplete: Promise<unknown> }).updateComplete;
  return el;
}

function shadowHtml(el: HTMLElement): string {
  const root = (el as unknown as { shadowRoot: { innerHTML: string } | null }).shadowRoot;
  if (!root) throw new Error(`${el.tagName} rendered no shadow root`);
  return root.innerHTML;
}

// ---------------------------------------------------------------------------
// Tests.
// ---------------------------------------------------------------------------

/**
 * Precondition, not a courtesy. If DOMPurify is inert, `renderMarkdown` throws
 * and every pin below goes red for a reason that has nothing to do with the
 * product. Checking it explicitly means a red in this file means what it says.
 */
async function domPurifyIsOperativeInThisEnvironment(): Promise<void> {
  const DOMPurify = (await import('dompurify')).default;
  assertEqual(
    typeof (DOMPurify as unknown as { sanitize?: unknown }).sanitize,
    'function',
    'DOMPurify.sanitize must be a function: without a DOM it is undefined and every ' +
      'pin in this file would go red for an environment reason, not a security one',
  );
  assertEqual(
    (DOMPurify as unknown as { isSupported: boolean }).isSupported,
    true,
    'DOMPurify.isSupported must be true, otherwise sanitize() is a pass-through',
  );
}

/** The shared control both sinks depend on, swept against the whole corpus. */
async function renderMarkdownNeutralisesEveryKnownVector(): Promise<void> {
  const { renderMarkdown } = await import('../../util/markdown.js');
  for (const [name, payload] of VECTORS) {
    const hits = findExecutable(renderMarkdown(payload));
    assertEqual(hits.join(', '), '', `vector "${name}" must be neutralised by renderMarkdown`);
  }
}

/**
 * Anti-vacuity. `sanitize` returning "" for everything would satisfy every
 * assertion above. This fails if the sanitiser is replaced by something that
 * simply destroys its input -- a mutation the corpus alone cannot see.
 */
async function renderMarkdownPreservesBenignMarkdown(): Promise<void> {
  const { renderMarkdown } = await import('../../util/markdown.js');
  const out = renderMarkdown('# Title\n\n**bold** and [ok](https://example.com/x) and `code`');
  assert(out.includes('<h1>Title</h1>'), 'benign heading must survive sanitising');
  assert(out.includes('<strong>bold</strong>'), 'benign emphasis must survive sanitising');
  assert(out.includes('href="https://example.com/x"'), 'benign https link must survive sanitising');
  assert(out.includes('<code>code</code>'), 'benign code span must survive sanitising');
}

/**
 * Order pin. `DOMPurify.sanitize(marked.parse(md))` is correct;
 * `marked.parse(DOMPurify.sanitize(md))` is not, because sanitising the SOURCE
 * leaves `[click](javascript:alert(1))` untouched -- it is plain text at that
 * point -- and marked then builds a live anchor out of it. Reversing the two
 * calls in markdown.ts turns this assertion red.
 */
async function sanitiserRunsAfterParseNotBefore(): Promise<void> {
  const { renderMarkdown } = await import('../../util/markdown.js');
  const hits = findExecutable(renderMarkdown('[click](javascript:alert(1))'));
  assertEqual(
    hits.join(', '),
    '',
    'a markdown link with a javascript: target must not become a live href; if this ' +
      'fails, markdown.ts is sanitising before parsing instead of after',
  );
}

/** SINK 1 -- ft-inspector-desc renders task.description through unsafeHTML. */
async function ftInspectorDescNeutralisesScriptPayloadInDescription(): Promise<void> {
  await import('./ft-inspector-desc.js');
  const el = await mount<HTMLElement>('ft-inspector-desc', (e) => {
    (e as unknown as { description: string }).description = CANARY;
    (e as unknown as { readOnly: boolean }).readOnly = true;
  });
  const html = shadowHtml(el);
  assertEqual(
    findExecutable(html).join(', '),
    '',
    'ft-inspector-desc must not render executable constructs from a task description',
  );
  assert(
    !/<script/i.test(html),
    'ft-inspector-desc must not emit a <script> tag from a task description',
  );
  // Proves the payload actually reached the sink: an <img> survives, stripped of
  // its handler. Without this, an empty shadow root would satisfy the checks above.
  assert(
    html.includes('<img'),
    'the payload must actually have reached the render sink (a sanitised <img> should remain)',
  );
}

/** SINK 2 -- ft-inspector-comments renders comment.body through unsafeHTML. */
async function ftInspectorCommentsNeutralisesScriptPayloadInCommentBody(): Promise<void> {
  await import('./ft-inspector-comments.js');
  dom.window.localStorage.setItem('inspector.collapse.comments', 'false');

  const comment = {
    id: 'c1',
    body: CANARY,
    author: { id: 'u1', name: 'Attacker', type: 1, status: 1 },
    createdAt: '2026-07-29T00:00:00.000Z',
  };
  const client = { listComments: async () => [comment] };

  const el = await mount<HTMLElement>('ft-inspector-comments', (e) => {
    (e as unknown as { taskId: string }).taskId = 'task-1';
    (e as unknown as { readOnly: boolean }).readOnly = true;
    (e as unknown as { client: unknown }).client = client;
  });

  // Drive the real load path rather than writing private state: the component
  // fetches comments in response to sl-details' sl-show event.
  const details = (el as unknown as { shadowRoot: { querySelector(s: string): unknown } })
    .shadowRoot.querySelector('sl-details') as { dispatchEvent(e: unknown): boolean } | null;
  assert(details !== null, 'ft-inspector-comments must render an sl-details host for its comments');
  details!.dispatchEvent(new dom.window.CustomEvent('sl-show'));
  await new Promise((r) => setTimeout(r, 0));
  await (el as unknown as { updateComplete: Promise<unknown> }).updateComplete;

  const html = shadowHtml(el);
  assertEqual(
    findExecutable(html).join(', '),
    '',
    'ft-inspector-comments must not render executable constructs from a comment body',
  );
  assert(
    !/<script/i.test(html),
    'ft-inspector-comments must not emit a <script> tag from a comment body',
  );
  assert(
    html.includes('<img'),
    'the comment payload must actually have reached the render sink (a sanitised <img> should remain)',
  );
}

/**
 * Locality pin. These tests are only worth anything if the two sinks keep
 * routing through the function they pin. A third `unsafeHTML` call site, or one
 * of these two switching to raw interpolation, must not slip in silently.
 */
async function bothSinksStillRouteThroughRenderMarkdown(): Promise<void> {
  const { readFileSync } = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const here = fileURLToPath(new URL('.', import.meta.url));
  // The pattern is the COMPOSITION, not the two names separately. An earlier
  // version asserted `includes('unsafeHTML') && includes('renderMarkdown')`,
  // and mutation arm M-F proved it vacuous: rewriting the sink to
  // `unsafeHTML(this.description)` left the now-unused `renderMarkdown` import
  // in the emitted file, so both substrings were still present and the
  // assertion stayed green while the sink was unsanitised. Checking the nesting
  // is what makes this an assertion rather than a spell-check.
  for (const file of ['ft-inspector-desc.js', 'ft-inspector-comments.js']) {
    const src = readFileSync(here + file, 'utf8');
    assert(
      /unsafeHTML\(\s*renderMarkdown\(/.test(src),
      `${file} must pass its unsafeHTML content through renderMarkdown directly ` +
        `(expected the composition unsafeHTML(renderMarkdown(...)))`,
    );
  }
  // Locality: exactly these two files may call unsafeHTML. A third sink added
  // elsewhere is not covered by anything in this file and must not pass quietly.
  const { readdirSync } = await import('node:fs');
  const componentsRoot = fileURLToPath(new URL('../', import.meta.url));
  const withUnsafeHtml: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = `${dir}${entry.name}`;
      if (entry.isDirectory()) walk(`${full}/`);
      else if (
        entry.name.endsWith('.js') &&
        !entry.name.endsWith('.test.js') &&
        readFileSync(full, 'utf8').includes('unsafeHTML(')
      ) {
        withUnsafeHtml.push(entry.name);
      }
    }
  };
  walk(componentsRoot);
  assertEqual(
    withUnsafeHtml.sort().join(','),
    'ft-inspector-comments.js,ft-inspector-desc.js',
    'exactly two components may call unsafeHTML; a new one is an unpinned render sink',
  );
}

/**
 * Every test runs even after one fails, and each failure is reported by name.
 *
 * This is not cosmetic. Under a `throw`-on-first-failure runner, a mutation to
 * markdown.ts fails `renderMarkdownNeutralisesEveryKnownVector` and aborts the
 * file, so the two per-sink tests never execute -- and "this test goes red when
 * you delete the sanitiser" could not be shown for them, only assumed. The
 * mutation matrix in the report names each test that goes red per arm, which
 * requires each test to actually get a turn. Same reasoning as
 * scripts/run-tests.mjs's own "runs all of them and reports each".
 */
const TESTS: ReadonlyArray<readonly [string, () => Promise<void>]> = [
  ['domPurifyIsOperativeInThisEnvironment', domPurifyIsOperativeInThisEnvironment],
  ['renderMarkdownNeutralisesEveryKnownVector', renderMarkdownNeutralisesEveryKnownVector],
  ['renderMarkdownPreservesBenignMarkdown', renderMarkdownPreservesBenignMarkdown],
  ['sanitiserRunsAfterParseNotBefore', sanitiserRunsAfterParseNotBefore],
  ['ftInspectorDescNeutralisesScriptPayloadInDescription', ftInspectorDescNeutralisesScriptPayloadInDescription],
  ['ftInspectorCommentsNeutralisesScriptPayloadInCommentBody', ftInspectorCommentsNeutralisesScriptPayloadInCommentBody],
  ['bothSinksStillRouteThroughRenderMarkdown', bothSinksStillRouteThroughRenderMarkdown],
];

async function run(): Promise<void> {
  const failures: string[] = [];
  for (const [name, fn] of TESTS) {
    try {
      await fn();
    } catch (err) {
      failures.push(`${name}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  if (failures.length > 0) {
    throw new Error(
      `render-sink-xss: ${failures.length} of ${TESTS.length} test(s) FAILED:\n  ` +
        failures.join('\n  '),
    );
  }
}

run().then(
  () => {
    console.log('render-sink-xss: OK');
  },
  (err: unknown) => {
    console.error(err);
    process.exit(1);
  },
);
