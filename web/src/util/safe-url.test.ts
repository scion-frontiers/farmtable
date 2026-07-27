import { safeExternalUrl } from './safe-url.js';

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

  // ── http: is local-only ───────────────────────────────────────────
  assertRejected('http://example.com/issues/1', 'non-localhost http: is rejected');
  assertRejected('http://localhost.evil.example/x', 'localhost-prefixed host is rejected');
  assertRejected('http://evil.example/?q=localhost', 'localhost in query is rejected');
  assertRejected('http://localhost@evil.example/', 'localhost in userinfo is rejected');

  assertEqual(
    safeExternalUrl('http://localhost:8080/tasks/1'),
    'http://localhost:8080/tasks/1',
    'http://localhost is allowed',
  );
  assertEqual(
    safeExternalUrl('http://127.0.0.1:3000/tasks/1'),
    'http://127.0.0.1:3000/tasks/1',
    'http://127.0.0.1 is allowed',
  );

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
