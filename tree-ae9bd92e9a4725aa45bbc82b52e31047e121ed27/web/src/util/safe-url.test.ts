import { LOCAL_HTTP_LINKS_ENABLED, safeExternalUrl } from './safe-url.js';

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
  }
}

function assertRejected(raw: string | null | undefined, message: string): void {
  assertEqual(safeExternalUrl(raw), null, message);
}

function run(): void {
  // ── Dangerous schemes ─────────────────────────────────────────────
  assertRejected('javascript:alert(1)', 'javascript: is rejected');
  assertRejected('JavaScript:alert(1)', 'mixed-case JavaScript: is rejected');
  assertRejected('JAVASCRIPT:alert(1)', 'upper-case JAVASCRIPT: is rejected');
  assertRejected('\tjavascript:alert(1)', 'tab-prefixed javascript: is rejected');
  assertRejected('\njavascript:alert(1)', 'newline-prefixed javascript: is rejected');
  assertRejected('  javascript:alert(1)  ', 'space-padded javascript: is rejected');
  assertRejected('java\tscript:alert(1)', 'embedded-tab javascript: is rejected');
  assertRejected('data:text/html,<script>alert(1)</script>', 'data: is rejected');
  assertRejected('vbscript:msgbox(1)', 'vbscript: is rejected');
  assertRejected('file:///etc/passwd', 'file: is rejected');
  assertRejected('blob:https://example.com/abc', 'blob: is rejected');
  assertRejected('ftp://example.com/x', 'ftp: is rejected');

  // ── Missing / malformed input ─────────────────────────────────────
  assertRejected('', 'empty string is rejected');
  assertRejected('   ', 'whitespace-only string is rejected');
  assertRejected(null, 'null is rejected');
  assertRejected(undefined, 'undefined is rejected');
  assertRejected('not a url', 'malformed input is rejected');
  assertRejected('/relative/path', 'relative path is rejected');
  assertRejected('//example.com/x', 'protocol-relative URL is rejected');
  assertRejected('https://', 'scheme without host is rejected');

  // ── http: is always rejected off-loopback ─────────────────────────
  assertRejected('http://example.com/issues/1', 'non-localhost http: is rejected');
  assertRejected('http://localhost.evil.example/x', 'localhost-prefixed host is rejected');
  assertRejected('http://evil.example/?q=localhost', 'localhost in query is rejected');
  assertRejected('http://localhost@evil.example/', 'localhost in userinfo is rejected');
  assertRejected('http://evil.example\\@localhost/', 'backslash userinfo trick is rejected');
  assertRejected('http://localhost。evil.example/', 'ideographic-dot host is rejected');

  // ── Embedded credentials are rejected (destination confusion) ─────
  // Both call sites render *static* link text, so the status bar is the user's
  // only cue: `https://github.com@evil.example/` reads as github.com.
  assertRejected('https://user:pass@evil.example/', 'https: with user:pass is rejected');
  assertRejected('https://ok.example@evil.example/', 'https: with userinfo is rejected');
  assertRejected('https://github.com@evil.example/', 'github.com-lookalike userinfo is rejected');
  assertRejected('https://:pass@evil.example/', 'https: with password only is rejected');
  assertRejected('http://user:pass@localhost/', 'loopback http: with credentials is rejected');

  // ── The http: loopback carve-out is dev-only ──────────────────────
  // Pinned rather than branched blindly: under the Node runner
  // `import.meta.env` does not exist, so this module takes its production
  // configuration and the assertions below are the production contract.
  assertEqual(
    LOCAL_HTTP_LINKS_ENABLED,
    false,
    'Node test runner must exercise the production (https-only) configuration',
  );

  assertRejected('http://localhost:8080/tasks/1', 'http://localhost is rejected in production');
  assertRejected('http://127.0.0.1:3000/tasks/1', 'http://127.0.0.1 is rejected in production');

  // Obfuscated loopback forms. WHATWG normalizes every one of these to hostname
  // `127.0.0.1`, so an allowlist that shipped would match them all.
  assertRejected('http://0x7f000001/x', 'hex-encoded loopback is rejected in production');
  assertRejected('http://2130706433/x', 'decimal-encoded loopback is rejected in production');
  assertRejected('http://127.1/x', 'short-form loopback is rejected in production');
  assertRejected('http://0177.0.0.1/x', 'octal-encoded loopback is rejected in production');
  assertRejected('http://127．0．0．1/x', 'fullwidth-dot loopback is rejected in production');
  assertRejected('http://0x7f000001:9200/api', 'hex loopback with port is rejected in production');
  assertRejected('http://[::1]/x', 'IPv6 loopback is rejected');

  // ── https: is allowed and normalized ──────────────────────────────
  assertEqual(
    safeExternalUrl('https://github.com/acme/repo/issues/12'),
    'https://github.com/acme/repo/issues/12',
    'https: is allowed',
  );
  assertEqual(
    safeExternalUrl('HTTPS://github.com/acme/repo'),
    'https://github.com/acme/repo',
    'upper-case https scheme is normalized and allowed',
  );
  assertEqual(
    safeExternalUrl('  https://github.com/acme/repo  '),
    'https://github.com/acme/repo',
    'space-padded https: is trimmed and allowed',
  );
  assertEqual(
    safeExternalUrl('https://example.com'),
    'https://example.com/',
    'https: without a path is normalized with a trailing slash',
  );
  assertEqual(
    safeExternalUrl('https://localhost:8443/x'),
    'https://localhost:8443/x',
    'https: on localhost is allowed',
  );

  console.log('safe-url tests passed');
}

run();
