import { describe, expect, it } from 'vitest';
import { safeExternalUrl } from '../src/util/safe-url.js';

/**
 * Interface contract with dev-p2-fixes:
 *
 *   web/src/util/safe-url.ts
 *   export function safeExternalUrl(raw: string | null | undefined): string | null
 *
 * - https: is always allowed
 * - http: is allowed only for localhost / 127.0.0.1, and only in a DEV build
 * - everything else returns null
 *
 * The loopback cases below pass because Vitest runs with `import.meta.env.DEV`
 * true. They are the *development* contract, not the production one: a
 * production bundle constant-folds the carve-out away and rejects loopback
 * http: entirely. The production side is asserted in
 * `src/util/safe-url.test.ts`, which runs under plain Node where
 * `import.meta.env` is undefined.
 *
 * Until that module lands this whole file fails to load, which is the intended
 * "the contracted API does not exist yet" signal. The rendered evidence that
 * the inspector actually sanitizes lives in
 * `test/ft-inspector-meta.safe-url.test.ts` and does not depend on this module.
 */

const cases: { input: string | null | undefined; expected: string | null }[] = [
  { input: 'https://example.com/a', expected: 'https://example.com/a' },
  { input: 'https://github.com/acme/repo/issues/7', expected: 'https://github.com/acme/repo/issues/7' },
  { input: 'http://localhost:3000/a', expected: 'http://localhost:3000/a' },
  { input: 'http://127.0.0.1:3000/a', expected: 'http://127.0.0.1:3000/a' },
  { input: 'http://example.com/a', expected: null },
  { input: 'javascript:alert(1)', expected: null },
  { input: 'JAVASCRIPT:alert(1)', expected: null },
  { input: ' javascript:alert(1) ', expected: null },
  { input: 'data:text/html,<script>alert(1)</script>', expected: null },
  { input: 'vbscript:msgbox(1)', expected: null },
  { input: 'file:///etc/passwd', expected: null },
  { input: '/relative/path', expected: null },
  { input: 'not a url', expected: null },
  { input: '', expected: null },
  { input: null, expected: null },
  { input: undefined, expected: null },
];

describe('safeExternalUrl', () => {
  for (const testCase of cases) {
    it(`maps ${JSON.stringify(testCase.input)} to ${JSON.stringify(testCase.expected)}`, () => {
      expect(safeExternalUrl(testCase.input)).toBe(testCase.expected);
    });
  }

  it('never returns a value whose scheme is not http(s)', () => {
    for (const testCase of cases) {
      const result = safeExternalUrl(testCase.input);
      if (result !== null) expect(result).toMatch(/^https?:\/\//);
    }
  });
});
