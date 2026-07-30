import { describe, expect, it } from 'vitest';
import { safeHref } from '../src/util/safe-url.js';

/**
 * Interface contract with dev-p2-fixes:
 *
 *   web/src/util/safe-url.ts
 *   export function safeHref(raw: string | null | undefined): string | null
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

describe('safeHref', () => {
  for (const testCase of cases) {
    it(`maps ${JSON.stringify(testCase.input)} to ${JSON.stringify(testCase.expected)}`, () => {
      expect(safeHref(testCase.input)).toBe(testCase.expected);
    });
  }

  /**
   * The conditional body is the point of the test, so the loop has to be
   * stopped from proving nothing: if `safeHref` regressed to always
   * returning `null`, every `if` would be skipped and this would pass having
   * executed zero assertions. Pinning the exact accepted count fails both ways
   * — an over-permissive change and a fail-closed one.
   */
  it('never returns a value whose scheme is not http(s)', () => {
    expect.hasAssertions();
    const accepted = cases
      .map((testCase) => safeHref(testCase.input))
      .filter((result): result is string => result !== null);

    expect(accepted).toHaveLength(cases.filter((testCase) => testCase.expected !== null).length);
    expect(accepted.length).toBeGreaterThan(0);
    for (const result of accepted) {
      expect(result).toMatch(/^https?:\/\//);
    }
  });

  /**
   * `safeHref` returns `url.href` — the WHATWG-normalized form — not the
   * raw input, and the docstring makes that a contract. Normalization is the
   * security-relevant half: it is what collapses the casing and whitespace
   * tricks the scheme check then relies on. Returning `raw` instead survived
   * the round-2 mutation run because every other case in this file happens to
   * be already-normalized. These inputs are not.
   */
  const normalizations: { input: string; expected: string; why: string }[] = [
    { input: 'HTTPS://Example.COM/a', expected: 'https://example.com/a', why: 'scheme and host are lowercased' },
    { input: '  https://example.com/a  ', expected: 'https://example.com/a', why: 'surrounding whitespace is stripped' },
    { input: 'https://example.com', expected: 'https://example.com/', why: 'an empty path becomes /' },
    { input: 'https://example.com:443/a', expected: 'https://example.com/a', why: 'the default port is dropped' },
    { input: 'https://example.com/a/../b', expected: 'https://example.com/b', why: 'dot segments are resolved' },
  ];

  for (const testCase of normalizations) {
    it(`returns the normalized href, not the raw input: ${testCase.why}`, () => {
      const result = safeHref(testCase.input);

      expect(result).toBe(testCase.expected);
      // Guard against a future fixture that is accidentally already normalized,
      // which would make the assertion above pass on a raw-input regression.
      expect(result, 'this case no longer exercises normalization').not.toBe(testCase.input);
    });
  }
});
