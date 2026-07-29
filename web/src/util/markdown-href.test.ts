/**
 * Pins for the URL policy at the MARKDOWN sink.
 *
 * WHAT THIS PINS AND WHY IT IS A SEPARATE FILE FROM safe-url.test.ts.
 * `safe-url.test.ts` pins the policy; this pins that the markdown sink is ON
 * it. Those are different claims and the second one was false for the whole
 * life of the first: `renderMarkdown` produced real `<a href>` elements,
 * `unsafeHTML` injected them (ft-inspector-desc.ts, ft-inspector-comments.ts),
 * and `safeHref` was never called on that path. DOMPurify ran with defaults --
 * no ALLOWED_URI_REGEXP -- and 3.4.12's default URI policy has no rule about
 * userinfo, so a link that reads `github.com` and loads `evil.example`,
 * carrying `user:pass`, survived sanitising intact.
 *
 * THIS IS NOT AN XSS PIN. render-sink-xss.test.ts is the XSS pin and it stays
 * green either way: DOMPurify strips `javascript:` and `data:` on its own, and
 * did before this hook existed. What is pinned here is PHISHING and CREDENTIAL
 * DISCLOSURE -- destination confusion in an href, plus `user:pass` handed to
 * the target host on click.
 *
 * THE TWO HALVES OF THE GUARD, because a single table would hide which is
 * which:
 *
 *   HALF A -- refusal.   An absolute URL that safeHref rejects loses its href.
 *                        Pinned by testCredentialHrefsAreRefused and
 *                        testNonHttpSchemesAreRefused.
 *   HALF B -- carve-out. A reference that does not name a host (relative, root
 *                        relative, fragment) is NOT passed to safeHref, which
 *                        parses with no base and would reject all of them.
 *                        Pinned by testRelativeLinksAreUntouched.
 *
 * Delete half A and testCredentialHrefsAreRefused goes red. Delete half B and
 * testRelativeLinksAreUntouched goes red while half A's rows stay green -- the
 * mutation results are recorded in
 * .design/project-log/2026-07-29-markdown-href-bypass.md.
 *
 * EVERY TABLE HERE CARRIES A POSITIVE ARM. A hook that removed every href would
 * satisfy "no credential URL survives" perfectly; testOrdinaryLinksSurvive is
 * what stops that from reading green.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { assert, assertEqual } from './assertions.js';

/**
 * Resolve web/src. Compiled into .tmp-test/ before running, so import.meta.url
 * points at build output; walk up to the directory holding package.json.
 */
function sourceRoot(): string {
  let dir = fileURLToPath(new URL('.', import.meta.url));
  while (!existsSync(join(dir, 'package.json'))) {
    const parent = dirname(dir);
    if (parent === dir) throw new Error('could not locate web/package.json from ' + import.meta.url);
    dir = parent;
  }
  return join(dir, 'src');
}

/**
 * DOMPurify binds to `window` at module-evaluation time and, with no DOM,
 * defines neither `sanitize` nor `addHook` (measured: purify.es.mjs returns the
 * factory early when `!window.document`). So the globals must be installed
 * BEFORE `markdown.js` is imported, which is why the import below is dynamic.
 */
const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  url: 'https://dashboard.test/',
});
const g = globalThis as unknown as Record<string, unknown>;
const w = dom.window as unknown as Record<string, unknown>;
for (const key of Object.getOwnPropertyNames(dom.window)) {
  if (key in globalThis) continue;
  try {
    g[key] = w[key];
  } catch {
    // Getter-only jsdom globals cannot be copied. Anything genuinely required
    // surfaces as a loud ReferenceError from the import below rather than as a
    // quiet wrong answer.
  }
}
g.window = dom.window;
g.document = dom.window.document;

const { renderMarkdown } = await import('./markdown.js');

interface Anchor {
  readonly href: string | null;
  readonly text: string;
  readonly title: string | null;
}

/**
 * Parses the sanitised HTML and asks the DOM what the anchors are.
 *
 * A regex over the output string is not an oracle -- it cannot tell an
 * attribute from a text node, and the string `https://user:pass@evil.example/`
 * appearing in the output is exactly what a CORRECT refusal looks like once the
 * URL has moved into the title. The distinction that matters is whether the
 * value is in an `href`, so it is read off a parsed node.
 */
function anchorsOf(html: string): Anchor[] {
  const doc = new JSDOM(`<body>${html}</body>`).window.document;
  return Array.from(doc.querySelectorAll('a')).map((a) => ({
    href: a.getAttribute('href'),
    text: a.textContent ?? '',
    title: a.getAttribute('title'),
  }));
}

/** The single anchor in `md`'s rendering. Fails loudly if there is not exactly one. */
function onlyAnchor(md: string): Anchor {
  const found = anchorsOf(renderMarkdown(md));
  assertEqual(found.length, 1, `expected exactly one anchor from ${JSON.stringify(md)}`);
  return found[0]!;
}

/**
 * HALF A. Every one of these reads as a host it does not load, and the first
 * three additionally hand credentials to the host they do load.
 *
 * `https://:pass@evil.example/` is here for the same reason it is in
 * safe-url.test.ts: it parses with an EMPTY username, so a guard testing only
 * `username` waves it through. It is the row that pins the `||` in the clause
 * from the markdown side.
 */
function testCredentialHrefsAreRefused(): void {
  const refused: ReadonlyArray<readonly [string, string, string]> = [
    [
      'markdown link, user and password',
      '[github.com/farmtable/farmtable](https://user:pass@evil.example/)',
      'https://user:pass@evil.example/',
    ],
    [
      'markdown link, bare user spoofing a host',
      '[github.com/farmtable/farmtable](https://github.com@evil.example/)',
      'https://github.com@evil.example/',
    ],
    [
      'markdown link, empty username with a password',
      '[open the PR](https://:pass@evil.example/)',
      'https://:pass@evil.example/',
    ],
    [
      'angle autolink',
      '<https://github.com@evil.example/>',
      'https://github.com@evil.example/',
    ],
    [
      'bare autolink in prose',
      'see https://github.com@evil.example/ for details',
      'https://github.com@evil.example/',
    ],
    [
      'raw HTML anchor, no markdown syntax at all',
      '<a href="https://user:pass@evil.example/">github.com/farmtable/farmtable</a>',
      'https://user:pass@evil.example/',
    ],
    [
      'http, so the policy is not https-only here either',
      '[x](http://github.com@evil.example/)',
      'http://github.com@evil.example/',
    ],
  ];

  for (const [name, md, raw] of refused) {
    const a = onlyAnchor(md);
    assertEqual(a.href, null, `${name}: credential-bearing href survived the markdown sink`);
    assertEqual(
      a.title,
      `Unsupported URL: ${raw}`,
      `${name}: refusal did not record the rejected URL in the title`,
    );
  }
}

/**
 * REFUSAL DEGRADES TO INERT TEXT, IT DOES NOT VANISH.
 *
 * safe-url.ts asks call sites to keep a rejected value visible rather than drop
 * it, and vanishing is the harsher failure: a link that disappears reads as a
 * broken application, which is how a security control gets reported as a bug
 * and then relaxed. Removing the whole `<a>`, or emptying it, would satisfy
 * testCredentialHrefsAreRefused and fail here.
 */
function testRefusalKeepsTheTextOnScreen(): void {
  const md = '[github.com/farmtable/farmtable](https://user:pass@evil.example/)';
  const html = renderMarkdown(md);
  const a = onlyAnchor(md);
  assertEqual(a.text, 'github.com/farmtable/farmtable', 'the link text vanished with the href');
  assert(
    html.includes('github.com/farmtable/farmtable'),
    `the rendered output lost the author's text entirely: ${html}`,
  );
}

/**
 * An author-supplied markdown title is OVERWRITTEN on refusal, not preserved.
 *
 * `[t](url "title")` sets the title attribute, so without this the author of a
 * refused link would choose the text explaining why it was refused -- e.g. a
 * reassuring "Official GitHub repository" over a link to evil.example. On an
 * ACCEPTED link the author's title is left exactly as written; that arm is the
 * positive control and it is what stops this being implemented as "always
 * clobber the title".
 */
function testRefusalOwnsTheTitle(): void {
  const refused = onlyAnchor('[x](https://github.com@evil.example/ "Official GitHub repository")');
  assertEqual(
    refused.title,
    'Unsupported URL: https://github.com@evil.example/',
    'an attacker-supplied title survived on a refused link',
  );

  const accepted = onlyAnchor('[x](https://example.com/ "A perfectly ordinary title")');
  assertEqual(
    accepted.title,
    'A perfectly ordinary title',
    "an accepted link lost the author's own title",
  );
}

/**
 * THE POSITIVE ARM. Without this, a hook that stripped every href would pass
 * every other assertion in this file.
 */
function testOrdinaryLinksSurvive(): void {
  const survives: ReadonlyArray<readonly [string, string, string]> = [
    ['https link', '[ok](https://example.com/)', 'https://example.com/'],
    ['http link', '[ok](http://example.com/x)', 'http://example.com/x'],
    [
      'https link with a path, query and fragment',
      '[ok](https://example.com/a/b?c=d#e)',
      'https://example.com/a/b?c=d#e',
    ],
    [
      'a URL containing an at sign that is not userinfo',
      '[ok](https://example.com/@github.com)',
      'https://example.com/@github.com',
    ],
    ['bare autolink', 'see https://example.com/ for details', 'https://example.com/'],
  ];

  for (const [name, md, href] of survives) {
    const a = onlyAnchor(md);
    assertEqual(a.href, href, `${name}: a legitimate href was removed`);
    assertEqual(a.title, null, `${name}: an accepted link was given a refusal title`);
  }
}

/**
 * HALF B -- the carve-out, and it is load-bearing rather than a convenience.
 *
 * `safeHref` parses with NO base argument by design, so it rejects every one of
 * these: `new URL('./docs/x.md')` throws. Handing them to it would delete every
 * ordinary in-document markdown link, which is a bug report, not a control.
 * None of them can name a host, so none of them can be destination confusion.
 */
function testRelativeLinksAreUntouched(): void {
  const untouched: ReadonlyArray<readonly [string, string, string]> = [
    ['relative path', '[docs](./docs/x.md)', './docs/x.md'],
    ['bare relative path', '[docs](docs/x.md)', 'docs/x.md'],
    ['root-relative path', '[task 7](/tasks/7)', '/tasks/7'],
    ['fragment only', '[section](#section)', '#section'],
    ['parent-relative path', '[up](../sibling/x.md)', '../sibling/x.md'],
  ];

  for (const [name, md, href] of untouched) {
    const a = onlyAnchor(md);
    assertEqual(a.href, href, `${name}: a relative link was refused as if it named a host`);
  }
}

/**
 * Protocol-relative references DO name a host, so they are inside the policed
 * set even though they carry no scheme. `safeHref` refuses `//evil.example/x`
 * rather than laundering it into the page's scheme -- which is precisely the
 * reason it has no base argument -- and the sink must inherit that decision
 * rather than treat the value as "relative" and skip it.
 */
function testProtocolRelativeLinksArePoliced(): void {
  const a = onlyAnchor('[x](//evil.example/x)');
  assertEqual(a.href, null, 'a protocol-relative href was treated as a relative link');
  assertEqual(a.title, 'Unsupported URL: //evil.example/x', 'refusal did not record the URL');
}

/**
 * NEGATIVE CONTROLS, and they are load-bearing twice over.
 *
 * They prove the sanitiser is running and CAN refuse (so the green rows above
 * mean something), and they prove this hook did not re-admit anything DOMPurify
 * had already stripped -- the hook runs AFTER attribute sanitising, so the
 * attribute is gone before it looks, and it must not put one back.
 *
 * `mailto:` is the documented COST of having one policy: SAFE_SCHEMES is
 * http/https, so a markdown mailto link is now inert text. It is pinned rather
 * than left to be discovered, so that reversing it is a deliberate edit here
 * and not a silent drift at the sink.
 */
function testNonHttpSchemesAreRefused(): void {
  const refused: ReadonlyArray<readonly [string, string]> = [
    ['javascript, stripped by DOMPurify itself', '[x](javascript:alert(1))'],
    ['data, stripped by DOMPurify itself', '[x](data:text/html,<b>hi</b>)'],
    ['mailto, refused by SAFE_SCHEMES', '[mail](mailto:someone@example.com)'],
    ['ftp, refused by SAFE_SCHEMES', '[ftp](ftp://example.com/f)'],
  ];

  for (const [name, md] of refused) {
    const a = onlyAnchor(md);
    assertEqual(a.href, null, `${name}: href survived`);
    assert(a.text.length > 0, `${name}: the link text vanished instead of degrading`);
  }
}

/**
 * THE FIX MUST BE ON THE LIVE PATH.
 *
 * Everything above tests `renderMarkdown`. This tests that `renderMarkdown` is
 * still what the two `unsafeHTML` sinks call, because a fix at a function the
 * components have stopped using is a fix that ships green and does nothing.
 * This is the same shape as testExternalAnchorsKeepTargetBlank in
 * safe-url.test.ts: a source-level pin on the binding, next to a behavioural
 * pin on the function.
 */
function testBothMarkdownSinksStillCallRenderMarkdown(): void {
  const sinks = [
    'components/inspector/ft-inspector-desc.ts',
    'components/inspector/ft-inspector-comments.ts',
  ];
  const src = sourceRoot();

  for (const rel of sinks) {
    const text = readFileSync(join(src, rel), 'utf8');
    const injections = text
      .split('\n')
      .filter((line) => line.includes('unsafeHTML(') && !line.trimStart().startsWith('*'));
    assert(injections.length > 0, `${rel}: expected an unsafeHTML injection, found none`);
    for (const line of injections) {
      assert(
        line.includes('unsafeHTML(renderMarkdown('),
        `${rel}: unsafeHTML is fed by something other than renderMarkdown, which this ` +
          `file's guarantees do not cover: ${line.trim()}`,
      );
    }
  }
}

function run(): void {
  testCredentialHrefsAreRefused();
  testRefusalKeepsTheTextOnScreen();
  testRefusalOwnsTheTitle();
  testOrdinaryLinksSurvive();
  testRelativeLinksAreUntouched();
  testProtocolRelativeLinksArePoliced();
  testNonHttpSchemesAreRefused();
  testBothMarkdownSinksStillCallRenderMarkdown();
  console.log('markdown-href: ok');
}

run();
