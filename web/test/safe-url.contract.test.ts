import { describe, expect, it } from 'vitest';
import { safeHref } from '../src/util/safe-url.js';

/**
 * Interface contract with dev-p2-fixes:
 *
 *   web/src/util/safe-url.ts
 *   export function safeHref(raw: string | null | undefined): string | undefined
 *
 * - https: and http: are always allowed (C2 ruling: allow by default)
 * - everything else returns undefined (not null — see @returns tag)
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

const cases: { input: string | null | undefined; expected: string | undefined }[] = [
  { input: 'https://example.com/a', expected: 'https://example.com/a' },
  { input: 'https://github.com/acme/repo/issues/7', expected: 'https://github.com/acme/repo/issues/7' },
  { input: 'http://localhost:3000/a', expected: 'http://localhost:3000/a' },
  { input: 'http://127.0.0.1:3000/a', expected: 'http://127.0.0.1:3000/a' },
  { input: 'http://example.com/a', expected: 'http://example.com/a' },
  { input: 'javascript:alert(1)', expected: undefined },
  { input: 'JAVASCRIPT:alert(1)', expected: undefined },
  { input: ' javascript:alert(1) ', expected: undefined },
  { input: 'data:text/html,<script>alert(1)</script>', expected: undefined },
  { input: 'vbscript:msgbox(1)', expected: undefined },
  { input: 'file:///etc/passwd', expected: undefined },
  { input: '/relative/path', expected: undefined },
  { input: 'not a url', expected: undefined },
  { input: '', expected: undefined },
  { input: null, expected: undefined },
  { input: undefined, expected: undefined },
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
   * returning `undefined`, every `if` would be skipped and this would pass having
   * executed zero assertions. Pinning the exact accepted count fails both ways
   * — an over-permissive change and a fail-closed one.
   */
  it('never returns a value whose scheme is not http(s)', () => {
    expect.hasAssertions();
    const accepted = cases
      .map((testCase) => safeHref(testCase.input))
      .filter((result): result is string => result !== undefined);

    expect(accepted).toHaveLength(cases.filter((testCase) => testCase.expected !== undefined).length);
    expect(accepted.length).toBeGreaterThan(0);
    for (const result of accepted) {
      expect(result).toMatch(/^https?:\/\//);
    }
  });

  /**
   * `safeHref` returns the ORIGINAL input string, not `url.href`.
   *
   * The docblock at safe-url.ts:112-115 makes this a contract: "we only want
   * to make a keep/reject decision here, not to rewrite what the user stored."
   * Also pinned by the @returns tag at safe-url.ts:117-118 and by the unit
   * test at safe-url.test.ts:128-134 (already-normalized inputs only).
   *
   * These inputs are deliberately un-normalized so `raw !== url.href`. They
   * verify that safeHref returns the input UNCHANGED — not the WHATWG-parsed
   * form — even when the two differ.
   */
  const rawPassthrough: { input: string; why: string }[] = [
    { input: 'HTTPS://Example.COM/a', why: 'mixed-case scheme and host are preserved' },
    { input: '  https://example.com/a  ', why: 'surrounding whitespace is preserved' },
    { input: 'https://example.com', why: 'missing trailing slash is not added' },
    { input: 'https://example.com:443/a', why: 'default port is not stripped' },
    { input: 'https://example.com/a/../b', why: 'dot segments are not resolved' },
  ];

  for (const testCase of rawPassthrough) {
    it(`returns the raw input unchanged: ${testCase.why}`, () => {
      const result = safeHref(testCase.input);

      expect(result).toBe(testCase.input);
      // Guard: the input must differ from url.href, otherwise this case does
      // not exercise the raw-vs-normalized distinction.
      expect(new URL(testCase.input).href, 'fixture is already normalized — add a different one').not.toBe(testCase.input);
    });
  }
});
