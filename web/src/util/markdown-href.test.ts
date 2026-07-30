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

/** The sanitised HTML, parsed. Used by the arms that look past `<a href>`. */
function parse(html: string): Document {
  return new JSDOM(`<body>${html}</body>`, { url: 'https://dashboard.test/' }).window.document;
}

/**
 * Every attribute VALUE in the rendered output.
 *
 * The Option B arms assert that a rejected address reaches no attribute at all,
 * which is a statement about the whole document rather than about one element:
 * a refusal that moved the URL from `href` to `title`, or to `data-*`, or onto
 * a wrapper, would satisfy a per-element check and violate the ruling. Text
 * nodes are deliberately NOT included -- Option B keeps the item's own name,
 * and an autolink's name IS the address.
 */
function attributeValues(html: string): string[] {
  const doc = parse(html);
  const values: string[] = [];
  for (const el of Array.from(doc.querySelectorAll('*'))) {
    for (const attr of Array.from(el.attributes)) values.push(attr.value);
  }
  return values;
}

/** The single SVG anchor in a rendering, read through its namespaced attribute. */
function svgAnchorOf(html: string): { href: string | null; title: string | null } {
  const doc = parse(html);
  const found = Array.from(doc.querySelectorAll('svg a'));
  assertEqual(found.length, 1, `expected exactly one SVG anchor in ${html}`);
  const el = found[0]!;
  return { href: el.getAttribute('xlink:href'), title: el.getAttribute('title') };
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
      null,
      `${name}: the refusal announced itself in a title attribute (Option B forbids the signal)`,
    );
    assert(
      !attributeValues(renderMarkdown(md)).some((v) => v.includes(raw)),
      `${name}: the rejected address survived in some attribute`,
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
 * OPTION B: A REFUSAL ADDS NOTHING AND ANNOUNCES NOTHING.
 *
 * Owner ruling, coordinator-rulings/PTONE-REJECTUX-2035.md:11 -- "Show the
 * item's name with no link and no trace of the address. The user sees a plain
 * label and gets no signal that anything was refused." An earlier version of
 * this sink wrote `Unsupported URL: <the rejected URL>` into the title, which
 * is Option A: it rendered attacker-authored text into the page, and the author
 * of the refused link composed the message explaining the refusal.
 *
 * So the hook now removes the reference attribute and writes nothing. Two
 * consequences are pinned here rather than left to be discovered:
 *
 *  - a refused link with no author title has NO title;
 *  - an author's own title (`[t](url "title")`) is left exactly as written, on
 *    refused and accepted links alike, because "add nothing" is the whole
 *    instruction. That means an author can still put arbitrary text in a
 *    tooltip over inert text -- the same reach they already have over the link
 *    TEXT, which Option B keeps by design. FILED, NOT DECIDED HERE.
 */
function testARefusalAddsNothing(): void {
  const bare = onlyAnchor('[x](https://github.com@evil.example/)');
  assertEqual(bare.title, null, 'a refusal added a title where the author wrote none');

  const authored = onlyAnchor('[x](https://github.com@evil.example/ "Official GitHub repository")');
  assertEqual(
    authored.title,
    'Official GitHub repository',
    "the refusal rewrote the author's title instead of adding nothing",
  );
  assertEqual(authored.href, null, 'the credential URL survived on the titled link');

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
 * PROTOCOL-RELATIVE REFERENCES ARE RESOLVED, NOT REFUSED BY SHAPE, AND THIS IS
 * A DELIBERATE CHANGE FROM THE FIRST VERSION OF THIS HOOK.
 *
 * `//evil.example/x` on an https page IS `https://evil.example/x`, and this
 * policy plainly accepts `https://evil.example/x` -- SAFE_SCHEMES is about
 * SCHEMES, and an attacker-chosen HOST is reachable through any ordinary link
 * (owner ruling C2: plain http(s) links stay clickable). Refusing the
 * protocol-relative spelling of a URL the policy accepts is a decision about
 * the STRING, which is the class of decision this hook has just been repaired
 * for making.
 *
 * `safeHref` still refuses `//evil.example/x` at the component bindings, where
 * there is no resolution step and the value is a stored field expected to be
 * absolute. Here it is resolved first, so `safeHref` sees the absolute form and
 * its no-base contract is untouched.
 *
 * The refusal arm is the same shape carrying credentials, which stays refused.
 */
function testProtocolRelativeLinksArePoliced(): void {
  const a = onlyAnchor('[x](//user:pass@evil.example/x)');
  assertEqual(a.href, null, 'a protocol-relative href carrying credentials was kept');
  assertEqual(a.title, null, 'the refusal announced itself in a title attribute');

  const resolved = onlyAnchor('[x](//evil.example/x)');
  assertEqual(
    resolved.href,
    '//evil.example/x',
    'a protocol-relative reference to an ordinary host was refused for its spelling',
  );
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
 * C-1. A CONTROL CHARACTER INSIDE THE SCHEME.
 *
 * `ht<TAB>tps://user:pass@evil.example/` is not a scheme to a pattern that
 * anchors on `^[a-z][a-z0-9+.-]*:`, and it IS `https:` to the URL parser, which
 * removes tab, CR and LF wherever they appear. DOMPurify keeps the attribute
 * (its own URI check strips the same characters before testing, then writes the
 * ORIGINAL value back), so the browser resolves
 * `https://user:pass@evil.example/` from an attribute no string pattern
 * recognised. Entity form `&#9;` is the same value after HTML parsing and is
 * pinned separately, because the two differ in the SOURCE and not in the DOM.
 *
 * BOTH POLARITIES. The SOH row is the measured non-vector: `` is NOT
 * removed by the URL parser, so the reference resolves as a same-origin PATH
 * (measured: https://dashboard.test/ht%01tps://user:pass@evil.example/) and is
 * kept. It is here so this arm cannot be satisfied by refusing every attribute
 * containing a control character, which is a different and wider policy than
 * the one being pinned.
 */
function testSchemeSplittingControlCharactersAreRefused(): void {
  const TAB = String.fromCharCode(9);
  const LF = String.fromCharCode(10);
  const CR = String.fromCharCode(13);
  const SOH = String.fromCharCode(1);

  const refused: ReadonlyArray<readonly [string, string]> = [
    ['tab inside the scheme', `<a href="ht${TAB}tps://user:pass@evil.example/">github.com</a>`],
    ['newline inside the scheme', `<a href="ht${LF}tps://user:pass@evil.example/">github.com</a>`],
    [
      'carriage return inside the scheme',
      `<a href="ht${CR}tps://user:pass@evil.example/">github.com</a>`,
    ],
    [
      'tab written as a character entity',
      '<a href="ht&#9;tps://user:pass@evil.example/">github.com</a>',
    ],
    [
      'tab in a protocol-relative reference',
      `<a href="/${TAB}/github.com@evil.example/">github.com</a>`,
    ],
  ];

  for (const [name, md] of refused) {
    const a = onlyAnchor(md);
    assertEqual(a.href, null, `${name}: the reference survived the markdown sink`);
    assert(a.text.length > 0, `${name}: the link text vanished instead of degrading`);
  }

  const kept = onlyAnchor(`<a href="ht${SOH}tps://user:pass@evil.example/">github.com</a>`);
  assertEqual(
    kept.href,
    `ht${SOH}tps://user:pass@evil.example/`,
    'a reference that resolves SAME-ORIGIN was refused for containing a control character; ' +
      'the policy is destination, not character class',
  );
}

/**
 * C-2. A BACKSLASH AUTHORITY.
 *
 * `/\github.com@evil.example/` does not begin `//`, so a pattern looking for a
 * protocol-relative reference does not see one. WHATWG treats `\` as `/` in the
 * authority position of a special scheme, so the browser resolves
 * `https://github.com@evil.example/` -- off-origin, with userinfo, from a
 * reference that reads like a local path. This is the row that shows why the
 * carve-out must be taken on the RESOLVED URL: the string is indistinguishable
 * from a relative path by inspection.
 *
 * BOTH POLARITIES, and the positive arm is not decoration: markdown link syntax
 * percent-encodes the backslash (measured: `[x](/\github.com@evil.example/)`
 * renders `href="/%5Cgithub.com@evil.example/"`), which resolves SAME-ORIGIN
 * and must be kept. The identical-looking source text therefore has two correct
 * answers, decided by resolution rather than by shape.
 */
function testBackslashAuthoritiesAreRefused(): void {
  const refused: ReadonlyArray<readonly [string, string]> = [
    ['slash backslash', '<a href="/\\github.com@evil.example/">github.com</a>'],
    ['backslash slash', '<a href="\\/github.com@evil.example/">github.com</a>'],
    ['two backslashes', '<a href="\\\\github.com@evil.example/">github.com</a>'],
  ];

  for (const [name, md] of refused) {
    const a = onlyAnchor(md);
    assertEqual(a.href, null, `${name}: a backslash authority survived as a live reference`);
  }

  // A backslash authority with NO credentials resolves to an ordinary
  // cross-origin https URL, and this policy accepts those: SAFE_SCHEMES is
  // about schemes, an attacker-chosen HOST is reachable through any plain link,
  // and owner ruling C2 keeps ordinary http(s) links clickable. Refusing this
  // spelling while accepting https://evil.example/x would be a decision about
  // the STRING again. Recorded here so the boundary is pinned rather than
  // inferred.
  const hostOnly = onlyAnchor('<a href="/\\evil.example/x">a local looking path</a>');
  assertEqual(
    hostOnly.href,
    '/\\evil.example/x',
    'a credential-free backslash authority was refused: that is a host policy, not a scheme one',
  );

  const encoded = onlyAnchor('[x](/\\github.com@evil.example/)');
  assertEqual(
    encoded.href,
    '/%5Cgithub.com@evil.example/',
    'markdown percent-encodes the backslash, which resolves same-origin: refusing it ' +
      'would delete a legitimate in-app link',
  );
}

/**
 * USERINFO IS DECIDED BEFORE ORIGIN, AND THAT ORDER IS THE POINT.
 *
 * `URL.origin` does not include userinfo, so `//user:pass@dashboard.test/x`
 * resolves SAME-ORIGIN and would pass a carve-out that only compared origins --
 * while still handing `user:pass` to the host on click. The positive arm is the
 * same host with no credentials, which must be kept.
 */
function testSameOriginCredentialsAreStillRefused(): void {
  const refused = onlyAnchor('<a href="//user:pass@dashboard.test/x">home</a>');
  assertEqual(refused.href, null, 'a same-origin reference carrying credentials was kept');

  const kept = onlyAnchor('<a href="//dashboard.test/x">home</a>');
  assertEqual(kept.href, '//dashboard.test/x', 'a same-origin reference without credentials was refused');
}

/**
 * C-3. SVG ANCHORS LINK WITHOUT AN `href`.
 *
 * DOMPurify's defaults permit inline SVG, and `<svg><a xlink:href="...">` is a
 * clickable link carrying no `href` at all -- so a hook keyed on the literal
 * attribute name never runs on it. Measured before the fix: the SVG anchor kept
 * `https://user:pass@evil.example/` while the HTML anchor beside it was
 * refused.
 *
 * BOTH POLARITIES: an ordinary https SVG link and a same-origin one must both
 * survive.
 */
function testSvgLinksArePoliced(): void {
  const refusedHtml = renderMarkdown(
    '<svg><a xlink:href="https://user:pass@evil.example/"><text>x</text></a></svg>',
  );
  const refused = svgAnchorOf(refusedHtml);
  assertEqual(refused.href, null, 'an SVG anchor kept a credential-bearing xlink:href');
  assert(
    !attributeValues(refusedHtml).some((v) => v.includes('evil.example')),
    `the rejected SVG address survived in an attribute: ${refusedHtml}`,
  );

  const keptAbsolute = svgAnchorOf(
    renderMarkdown('<svg><a xlink:href="https://example.com/x"><text>x</text></a></svg>'),
  );
  assertEqual(keptAbsolute.href, 'https://example.com/x', 'an ordinary SVG link was refused');

  const keptRelative = svgAnchorOf(
    renderMarkdown('<svg><a xlink:href="/tasks/7"><text>x</text></a></svg>'),
  );
  assertEqual(keptRelative.href, '/tasks/7', 'a same-origin SVG link was refused');
}

/**
 * T-3. `href` IS NOT ONLY AN ANCHOR ATTRIBUTE.
 *
 * The hook runs on every element DOMPurify keeps, so `<area href>` is inside
 * the policy. It was inside it before this arm existed too -- this is coverage
 * of behaviour that was untested, not a change to it -- and without the arm a
 * future narrowing of the hook to `a` elements would land green.
 */
function testHrefOnNonAnchorElementsIsPoliced(): void {
  const refusedHtml = renderMarkdown('<map><area href="https://user:pass@evil.example/"></map>');
  const doc = parse(refusedHtml);
  const refused = doc.querySelector('area');
  assert(refused !== null, 'the <area> element did not survive sanitising at all');
  assertEqual(refused!.getAttribute('href'), null, 'a non-anchor element kept a refused href');
  assert(
    !attributeValues(refusedHtml).some((v) => v.includes('evil.example')),
    `the rejected address survived in an attribute on a non-anchor element: ${refusedHtml}`,
  );

  const keptDoc = parse(renderMarkdown('<map><area href="https://example.com/x"></map>'));
  const kept = keptDoc.querySelector('area');
  assert(kept !== null, 'the <area> element did not survive sanitising at all');
  assertEqual(
    kept!.getAttribute('href'),
    'https://example.com/x',
    'a legitimate href on a non-anchor element was removed',
  );
}

/**
 * C-4. A FORM IS A LINK WITH A BUTTON ON IT.
 *
 * DOMPurify 3.4.12's default configuration permits `<form>`, `<button>` and
 * `action`, and a form with no `method` submits as GET. So this renders as one
 * clickable control that contacts the host in `action` and hands it the
 * userinfo, with the button's own text chosen by the same author:
 *
 *   <form action="https://github.com@evil.example/"><button>View pull request
 *   #482</button></form>
 *
 * That is F-1's impact sentence -- reads as one host, contacts another, leaks
 * `github.com:` on click -- at F-1's own sink, reached by an attribute the
 * policy's list did not name. The defect was never in `isPermitted`, which
 * returns the correct answer for this URL and always did. It was in `LINK_ATTRS`
 * being a LIST, and a list is only as current as its last measurement.
 *
 * MEASURED NEGATIVE, so the arm is not wider than its evidence: `formaction` on
 * `<input>` and on `<button>` is STRIPPED by DOMPurify's own defaults before any
 * hook runs, on this version. It is therefore not pinned here -- pinning
 * somebody else's behaviour as if it were ours is how a guard comes to look
 * bigger than it is -- and it is recorded in the docblock at markdown.ts.
 */
function testFormActionIsPoliced(): void {
  const cred = 'https://github.com@evil.example/';
  const refusedHtml = renderMarkdown(
    `<form action="${cred}"><button>View pull request #482</button></form>`,
  );
  const form = parse(refusedHtml).querySelector('form');
  assert(form !== null, 'the <form> element did not survive sanitising at all');
  assertEqual(form!.getAttribute('action'), null, 'a credential-bearing form action survived');
  assert(
    !attributeValues(refusedHtml).some((v) => v.includes('evil.example')),
    `the rejected address survived in an attribute on a form: ${refusedHtml}`,
  );
  assert(
    refusedHtml.includes('View pull request #482'),
    `Option B keeps the control's own label, and it was lost: ${refusedHtml}`,
  );

  // POST is the same policy. Without this row the arm would pass on a hook that
  // only policed GET forms, which is a distinction the URL policy does not make.
  const post = parse(
    renderMarkdown(`<form action="${cred}" method="post"><button>Go</button></form>`),
  ).querySelector('form');
  assertEqual(post!.getAttribute('action'), null, 'a credential-bearing POST action survived');

  // POSITIVE ARM. An ordinary form action is untouched, so this cannot pass by
  // stripping every action attribute.
  const keptHtml = renderMarkdown('<form action="https://example.com/search"><button>Go</button></form>');
  const kept = parse(keptHtml).querySelector('form');
  assert(kept !== null, 'the <form> element did not survive sanitising at all');
  assertEqual(
    kept!.getAttribute('action'),
    'https://example.com/search',
    'a legitimate form action was removed',
  );

  // And a same-origin action, which the resolution carve-out must keep.
  const relative = parse(
    renderMarkdown('<form action="/tasks/search"><button>Go</button></form>'),
  ).querySelector('form');
  assertEqual(relative!.getAttribute('action'), '/tasks/search', 'a same-origin action was refused');
}

/**
 * NO ATTACKER-AUTHORED STRING IS COMPOSED INTO AN ATTRIBUTE BY THE REFUSAL.
 *
 * This is the reason Option B is a security ruling and not a taste one. The
 * previous behaviour built a user-visible string out of the rejected URL, so
 * the author of the refused link wrote the body of the message -- at any length
 * and over as many lines as they liked -- and it was rendered as part of the
 * product. The address below is 400 characters long and contains line breaks
 * and a call to action; none of it may reach any attribute of the output.
 *
 * POSITIVE ARM, in the same shape: an accepted URL of the same length DOES
 * appear in an attribute, because it is the href. Without that arm this
 * assertion would also pass on a renderer that dropped every attribute.
 */
function testNoRejectedAddressReachesAnAttribute(): void {
  const noisy = `https://user:pass@evil.example/%20VERIFY%20YOUR%20ACCOUNT%20AT%20${'a'.repeat(400)}`;
  const refusedHtml = renderMarkdown(`<a href="${noisy}">Farm Table</a>`);
  const a = onlyAnchor(`<a href="${noisy}">Farm Table</a>`);
  assertEqual(a.href, null, 'the noisy credential URL was not refused at all');
  assertEqual(a.text, 'Farm Table', "the item's own name did not survive the refusal");
  for (const value of attributeValues(refusedHtml)) {
    assert(
      !value.includes('evil.example') && !value.includes('VERIFY%20YOUR%20ACCOUNT'),
      `a rejected address reached an attribute: ${JSON.stringify(value)}`,
    );
  }

  const long = `https://example.com/${'a'.repeat(400)}`;
  const keptHtml = renderMarkdown(`<a href="${long}">Farm Table</a>`);
  assert(
    attributeValues(keptHtml).some((v) => v.includes('example.com')),
    `an accepted URL of the same length lost its href: ${keptHtml}`,
  );
}

/**
 * THE POLICY CANNOT BE DISARMED AT A DISTANCE.
 *
 * `import DOMPurify from 'dompurify'` returns a process-global singleton, and
 * hooks live on the object. While the hook was installed there, ANY module --
 * app code, a dependency, another test -- could remove it with one call, and
 * import order decided whether it was installed at all. This calls
 * `removeAllHooks()` on the global and then re-checks both polarities through
 * `renderMarkdown`.
 *
 * If this file's own instance were the global, the refusal below would come
 * back green as a KEPT href and this assertion would fail.
 */
async function testTheGlobalSanitiserCannotDisarmThisOne(): Promise<void> {
  const globalPurify = (await import('dompurify')).default;
  globalPurify.removeAllHooks();

  const refused = onlyAnchor('[x](https://user:pass@evil.example/)');
  assertEqual(
    refused.href,
    null,
    'removeAllHooks() on the global DOMPurify disarmed the markdown URL policy',
  );

  const kept = onlyAnchor('[ok](https://example.com/)');
  assertEqual(kept.href, 'https://example.com/', 'an ordinary link was lost after the global was cleared');
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

async function run(): Promise<void> {
  testCredentialHrefsAreRefused();
  testRefusalKeepsTheTextOnScreen();
  testARefusalAddsNothing();
  testOrdinaryLinksSurvive();
  testRelativeLinksAreUntouched();
  testProtocolRelativeLinksArePoliced();
  testNonHttpSchemesAreRefused();
  testSchemeSplittingControlCharactersAreRefused();
  testBackslashAuthoritiesAreRefused();
  testSameOriginCredentialsAreStillRefused();
  testSvgLinksArePoliced();
  testHrefOnNonAnchorElementsIsPoliced();
  testFormActionIsPoliced();
  testNoRejectedAddressReachesAnAttribute();
  await testTheGlobalSanitiserCannotDisarmThisOne();
  testBothMarkdownSinksStillCallRenderMarkdown();
  console.log('markdown-href: ok');
}

await run();
